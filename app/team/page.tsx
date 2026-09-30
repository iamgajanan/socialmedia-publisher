import { redirect } from "next/navigation";

import { TeamManagement, type TeamMemberView } from "@/components/team/team-management";
import { WorkspacePlanCard } from "@/components/team/workspace-plan-card";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceAdmin } from "@/lib/workspace/server";

export const instant = false;

export default async function TeamPage() {
  const context = await requireWorkspaceAdmin();
  const { data: memberships, error } = await context.supabase
    .from("socialmedia_workspace_members")
    .select("id, profile_id, role, status, joined_at")
    .eq("workspace_id", context.workspace.id)
    .order("joined_at", { ascending: true });
  if (error) throw new Error(error.message);

  const admin = createAdminClient();
  const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) throw new Error(usersError.message);

  const userMap = new Map(usersData.users.map((user) => [user.id, user]));
  const profileIds = memberships?.map((member) => member.profile_id) ?? [];
  const { data: profiles, error: profilesError } = profileIds.length
    ? await admin.from("socialmedia_profiles").select("id, display_name").in("id", profileIds)
    : { data: [], error: null };
  if (profilesError) throw new Error(profilesError.message);

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name ?? ""]));
  const members: TeamMemberView[] = (memberships ?? []).map((member) => {
    const user = userMap.get(member.profile_id);
    return {
      id: member.id,
      email: user?.email ?? "Pending invitation",
      displayName: profileMap.get(member.profile_id) || user?.user_metadata?.full_name || "Team member",
      role: member.role,
      status: member.status,
      isOwner: member.role === "owner" || member.profile_id === context.workspace.owner_profile_id,
    };
  });

  if (!members.some((member) => member.isOwner)) redirect("/settings");

  return (
    <div className="space-y-8">
      <div className="max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Workspace</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Team & access</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">Manage who can work inside {context.workspace.name}. Every teammate uses their own OmniSocial login while sharing the same workspace boundary.</p>
      </div>
      <WorkspacePlanCard plan={context.plan} memberCount={members.length} />
      <TeamManagement members={members} />
    </div>
  );
}
