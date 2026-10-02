import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptToken } from "@/lib/social/token-crypto";
import { discoverLinkedInOrganizations } from "@/lib/social/linkedin-organizations";
import { getUsableAccessToken } from "@/lib/publishing/refresh";
import type { PublisherAccount } from "@/lib/publishing/providers/types";

function redirect(request: Request, params: Record<string, string>) {
  const url = new URL("/connect-accounts", request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const profileId = claims?.claims?.sub;
  if (!profileId) return redirect(request, { error: "auth" });

  const requestedUserId = new URL(request.url).searchParams.get("user");
  const { data: profile } = await supabase
    .from("socialmedia_profiles")
    .select("workspace_id")
    .eq("id", String(profileId))
    .maybeSingle();
  if (!profile?.workspace_id) return redirect(request, { error: "workspace" });

  const { data: selectedUser } = await supabase
    .from("socialmedia_users")
    .select("id")
    .eq("workspace_id", profile.workspace_id)
    .eq("id", requestedUserId ?? "")
    .maybeSingle();
  if (!selectedUser) return redirect(request, { error: "user_required" });

  const { data: accounts } = await supabase
    .from("socialmedia_social_accounts")
    .select("id, platform, external_account_id, account_name, username, metadata, token_expires_at, status")
    .eq("profile_id", String(profileId))
    .eq("workspace_id", profile.workspace_id)
    .eq("socialmedia_user_id", selectedUser.id)
    .eq("platform", "linkedin")
    .order("created_at", { ascending: true });

  const personal = (accounts ?? []).find((account) => {
    const metadata = account.metadata && typeof account.metadata === "object" ? account.metadata as Record<string, unknown> : {};
    return metadata.linkedin_account_type !== "organization";
  });

  if (!personal) return redirect(request, { error: "linkedin_personal_required", user: selectedUser.id });

  const publisherAccount: PublisherAccount = {
    id: personal.id,
    platform: "linkedin",
    external_account_id: personal.external_account_id,
    account_name: personal.account_name,
    username: personal.username,
    metadata: (personal.metadata ?? {}) as Record<string, unknown>,
    token_expires_at: personal.token_expires_at,
  };

  let accessToken: string;
  try {
    accessToken = await getUsableAccessToken(publisherAccount);
  } catch (error) {
    console.error("linkedin_company_page_token_failed", error);
    return redirect(request, { error: "linkedin_token", user: selectedUser.id });
  }

  let organizations;
  try {
    organizations = await discoverLinkedInOrganizations(accessToken);
  } catch (error) {
    console.error("linkedin_company_page_discovery_failed", error);
    return redirect(request, { error: "linkedin_org_permission", user: selectedUser.id });
  }

  const admin = createAdminClient();
  const existingOrganizationIds = new Set(
    (accounts ?? [])
      .map((account) => {
        const metadata = account.metadata && typeof account.metadata === "object" ? account.metadata as Record<string, unknown> : {};
        return typeof metadata.linkedin_organization_id === "string" ? metadata.linkedin_organization_id : null;
      })
      .filter((value): value is string => Boolean(value)),
  );

  const { data: workspace } = await admin
    .from("socialmedia_workspaces")
    .select("plan_id")
    .eq("id", profile.workspace_id)
    .single();
  if (!workspace) return redirect(request, { error: "workspace", user: selectedUser.id });

  const { data: plan } = await admin
    .from("socialmedia_plans")
    .select("max_social_accounts")
    .eq("id", workspace.plan_id)
    .single();
  if (!plan) return redirect(request, { error: "plan", user: selectedUser.id });

  const { count: connectedCount } = await admin
    .from("socialmedia_social_accounts")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", profile.workspace_id)
    .eq("status", "connected");

  const availableSlots = Math.max(0, Number(plan.max_social_accounts) - Number(connectedCount ?? 0));
  const newOrganizations = organizations.filter((organization) => !existingOrganizationIds.has(organization.id));
  const toConnect = newOrganizations.slice(0, availableSlots);

  await admin
    .from("socialmedia_social_accounts")
    .update({
      metadata: {
        ...((personal.metadata ?? {}) as Record<string, unknown>),
        linkedin_account_type: "personal",
        linkedin_member_id: personal.external_account_id,
      },
    })
    .eq("id", personal.id);

  for (const organization of toConnect) {
    const metadata = {
      linkedin_account_type: "organization",
      linkedin_organization_id: organization.id,
      linkedin_organization_urn: organization.urn,
      linkedin_author_urn: organization.urn,
      linkedin_member_id: personal.external_account_id,
      linkedin_role: organization.role,
      linkedin_role_state: organization.state,
    };

    const { data: savedAccount, error: accountError } = await admin
      .from("socialmedia_social_accounts")
      .upsert({
        profile_id: String(profileId),
        workspace_id: profile.workspace_id,
        socialmedia_user_id: selectedUser.id,
        platform: "linkedin",
        account_name: organization.name,
        external_account_id: organization.id,
        username: organization.vanityName,
        avatar_url: null,
        status: "connected",
        metadata,
        token_expires_at: personal.token_expires_at,
        refresh_token_expires_at: null,
        provider_account_url: organization.url,
        scopes: ["w_organization_social", "r_organization_admin"],
      }, { onConflict: "profile_id,platform,external_account_id" })
      .select("id")
      .single();

    if (accountError || !savedAccount?.id) {
      console.error("linkedin_company_page_save_failed", {
        organizationId: organization.id,
        code: accountError?.code,
        message: accountError?.message,
      });
      continue;
    }

    const { error: secretError } = await admin
      .from("socialmedia_account_secrets")
      .upsert({
        social_account_id: savedAccount.id,
        access_token_ciphertext: encryptToken(accessToken),
        refresh_token_ciphertext: null,
      }, { onConflict: "social_account_id" });

    if (secretError) {
      console.error("linkedin_company_page_secret_failed", {
        organizationId: organization.id,
        code: secretError.code,
        message: secretError.message,
      });
    }
  }

  const connected = toConnect.length;
  const skipped = newOrganizations.length - connected;
  return redirect(request, {
    connected: connected ? "1" : "0",
    platform: "linkedin",
    user: selectedUser.id,
    linkedin_pages: String(connected),
    linkedin_pages_skipped: String(skipped),
  });
}
