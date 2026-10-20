import { Suspense } from "react";
import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace/server";

export default function WorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[60vh] items-center justify-center" aria-live="polite" aria-busy="true">
          <p className="text-sm text-muted-foreground">Loading workspace…</p>
        </main>
      }
    >
      <WorkspaceContent>{children}</WorkspaceContent>
    </Suspense>
  );
}

async function WorkspaceContent({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/auth/login");

  const userId = String(data.claims.sub);
  const context = await getCurrentWorkspace();
  const { data: profile } = await supabase
    .from("socialmedia_profiles")
    .select("display_name, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  const { data: memberships, error: membershipsError } = await supabase
    .from("socialmedia_workspace_members")
    .select("workspace_id, role, socialmedia_workspaces(id, name)")
    .eq("profile_id", userId)
    .eq("status", "active");

  if (membershipsError) throw new Error(membershipsError.message);

  const workspaces = (memberships ?? [])
    .map((membership) => {
      const workspace = Array.isArray(membership.socialmedia_workspaces)
        ? membership.socialmedia_workspaces[0]
        : membership.socialmedia_workspaces;
      return workspace
        ? { id: String(workspace.id), name: String(workspace.name), role: String(membership.role) }
        : null;
    })
    .filter((workspace): workspace is { id: string; name: string; role: string } => workspace !== null);

  const email =
    typeof data.claims.email === "string" ? data.claims.email : "Account";

  return (
    <DashboardShell
      user={{
        email,
        name: profile?.display_name ?? email.split("@")[0] ?? "Creator",
        avatarUrl: profile?.avatar_url ?? null,
        workspaceName: context.workspace.name,
      }}
      currentWorkspace={{
        id: context.workspace.id,
        name: context.workspace.name,
        logoUrl: context.workspace.logo_url,
        primaryColor: context.workspace.primary_color,
        accentColor: context.workspace.accent_color,
      }}
      workspaces={workspaces}
    >
      {children}
    </DashboardShell>
  );
}
