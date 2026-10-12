import "server-only";

import { createClient } from "@/lib/supabase/server";

export type ApiWorkspaceContext =
  | { ok: true; profileId: string; workspaceId: string }
  | { ok: false; status: 401 | 403 | 500; error: string };

export async function getApiWorkspaceContext(): Promise<ApiWorkspaceContext> {
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  const profileId = claims?.claims?.sub ? String(claims.claims.sub) : "";

  if (claimsError || !profileId) {
    return { ok: false, status: 401, error: "Authentication required." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("socialmedia_profiles")
    .select("workspace_id")
    .eq("id", profileId)
    .maybeSingle();

  if (profileError) {
    console.error("ai_workspace_profile_lookup_failed", {
      profileId,
      code: profileError.code,
      message: profileError.message,
    });
    return { ok: false, status: 500, error: "Unable to resolve the current workspace." };
  }

  const workspaceId = profile?.workspace_id ? String(profile.workspace_id) : "";
  if (!workspaceId) {
    return { ok: false, status: 403, error: "No active workspace is assigned to this profile." };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("socialmedia_workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("profile_id", profileId)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError) {
    console.error("ai_workspace_membership_lookup_failed", {
      profileId,
      workspaceId,
      code: membershipError.code,
      message: membershipError.message,
    });
    return { ok: false, status: 500, error: "Unable to verify workspace membership." };
  }

  if (!membership) {
    return { ok: false, status: 403, error: "Active membership in the current workspace is required." };
  }

  return { ok: true, profileId, workspaceId };
}
