"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceAdmin } from "@/lib/workspace/server";

export type TeamActionState = {
  ok: boolean;
  message: string;
};

const validRoles = new Set(["admin", "member", "viewer"]);

function siteUrl() {
  return process.env.SITE_URL ?? "http://localhost:3000";
}

export async function inviteTeamMember(
  _state: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  try {
    const context = await requireWorkspaceAdmin();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const role = String(formData.get("role") ?? "member");

    if (!email || !email.includes("@")) {
      return { ok: false, message: "Enter a valid email address." };
    }
    if (!validRoles.has(role)) {
      return { ok: false, message: "Choose a valid team role." };
    }
    if (email === (await getCurrentUserEmail())) {
      return { ok: false, message: "You are already the workspace owner." };
    }

    const admin = createAdminClient();
    const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (usersError) throw usersError;

    let user = usersData.users.find((candidate) => candidate.email?.toLowerCase() === email);

    if (!user) {
      const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${siteUrl()}/auth/confirm?next=/team`,
      });
      if (inviteError) throw inviteError;
      user = inviteData.user;
    }

    if (!user?.id) throw new Error("The team member account could not be created.");

    const { error: profileError } = await admin
      .from("socialmedia_profiles")
      .upsert({ id: user.id }, { onConflict: "id" });
    if (profileError) throw profileError;

    const { error: memberError } = await admin
      .from("socialmedia_workspace_members")
      .upsert(
        {
          workspace_id: context.workspace.id,
          profile_id: user.id,
          role,
          status: "invited",
        },
        { onConflict: "workspace_id,profile_id" },
      );
    if (memberError) throw memberError;

    revalidatePath("/team");
    revalidatePath("/settings");
    return { ok: true, message: `Invitation sent to ${email}.` };
  } catch (error) {
    console.error("team_member_invite_failed", error);
    return { ok: false, message: error instanceof Error ? error.message : "Could not invite the team member." };
  }
}

async function getCurrentUserEmail() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.email?.toLowerCase() ?? "";
}
