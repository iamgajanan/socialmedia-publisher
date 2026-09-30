import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

export async function getCurrentWorkspace() {
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claims?.claims?.sub) {
    redirect("/auth/login");
  }

  const profileId = String(claims.claims.sub);
  const { data: profile, error: profileError } = await supabase
    .from("socialmedia_profiles")
    .select("workspace_id, display_name")
    .eq("id", profileId)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  if (!profile?.workspace_id) {
    throw new Error("Your workspace has not been initialized yet.");
  }

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
    .select("id, name, timezone, owner_profile_id")
    .eq("id", profile.workspace_id)
    .single();

  if (workspaceError) throw new Error(workspaceError.message);

  return {
    supabase,
    profileId,
    profileName: profile.display_name ?? "",
    workspace,
    membership: membership as { id: string; role: WorkspaceRole; status: string },
  };
}

export async function requireWorkspaceAdmin() {
  const context = await getCurrentWorkspace();
  if (!(["owner", "admin"] as WorkspaceRole[]).includes(context.membership.role)) {
    redirect("/settings");
  }
  return context;
}
