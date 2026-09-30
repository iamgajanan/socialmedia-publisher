import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";
export type WorkspacePlan = {
  id: string;
  code: "starter" | "pro" | "premium";
  name: string;
  monthly_price_inr: number;
  monthly_price_usd: number;
  max_team_members: number;
  max_users: number;
  max_social_accounts: number;
  monthly_post_limit: number;
};

export async function getCurrentWorkspace() {
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims?.sub) redirect("/auth/login");

  const profileId = String(claims.claims.sub);
  const { data: profile, error: profileError } = await supabase
    .from("socialmedia_profiles")
    .select("workspace_id, display_name")
    .eq("id", profileId)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);
  if (!profile?.workspace_id) throw new Error("Your workspace has not been initialized yet.");

  const { data: membership, error: membershipError } = await supabase
    .from("socialmedia_workspace_members")
    .select("id, role, status")
    .eq("workspace_id", profile.workspace_id)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (membershipError) throw new Error(membershipError.message);
  if (!membership) throw new Error("You are not a member of this workspace.");

  const { data: workspace, error: workspaceError } = await supabase
    .from("socialmedia_workspaces")
    .select("id, name, timezone, owner_profile_id, plan_id, subscription_status")
    .eq("id", profile.workspace_id)
    .single();
  if (workspaceError) throw new Error(workspaceError.message);

  const { data: plan, error: planError } = await supabase
    .from("socialmedia_plans")
    .select("id, code, name, monthly_price_inr, monthly_price_usd, max_team_members, max_users, max_social_accounts, monthly_post_limit")
    .eq("id", workspace.plan_id)
    .single();
  if (planError) throw new Error(planError.message);

  return {
    supabase,
    profileId,
    profileName: profile.display_name ?? "",
    workspace: workspace as typeof workspace & { plan_id: string; subscription_status: string },
    plan: plan as WorkspacePlan,
    membership: membership as { id: string; role: WorkspaceRole; status: string },
  };
}

export async function requireWorkspaceAdmin() {
  const context = await getCurrentWorkspace();
  if (!("owner" === context.membership.role || "admin" === context.membership.role)) redirect("/settings");
  return context;
}
