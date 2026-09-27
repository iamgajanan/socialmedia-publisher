import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function WorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/auth/login");

  const userId = String(data.claims.sub);
  const { data: profile } = await supabase
    .from("socialmedia_profiles")
    .select("display_name, avatar_url, workspace_name")
    .eq("id", userId)
    .maybeSingle();

  const email =
    typeof data.claims.email === "string" ? data.claims.email : "Account";

  return (
    <DashboardShell
      user={{
        email,
        name: profile?.display_name ?? email.split("@")[0] ?? "Creator",
        avatarUrl: profile?.avatar_url ?? null,
        workspaceName: profile?.workspace_name ?? null,
      }}
    >
      {children}
    </DashboardShell>
  );
}
