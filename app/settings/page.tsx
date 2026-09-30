import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, CreditCard, Mail, Palette, ShieldCheck, UserRound, Workflow } from "lucide-react";

import { AccountSecurityForm, DeleteAccountForm, PasswordForm, ProfileForm, WorkspaceForm } from "@/components/settings/settings-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { updateAccountPassword, deleteAccount, updateEmail, updateProfile, updateWorkspace } from "./actions";

export const instant = false;

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims?.sub) redirect("/auth/login");

  const userId = String(claims.claims.sub);
  const email = typeof claims.claims.email === "string" ? claims.claims.email : "";
  const { data: profile, error } = await supabase
    .from("socialmedia_profiles")
    .select("display_name, workspace_name, timezone, default_posting_preferences")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const preferences = profile?.default_posting_preferences && typeof profile.default_posting_preferences === "object" && !Array.isArray(profile.default_posting_preferences)
    ? profile.default_posting_preferences as { autoSaveDrafts?: boolean; defaultStatus?: "draft" | "scheduled" }
    : {};

  return (
    <div className="space-y-8">
      <div className="max-w-3xl">
        <Badge variant="secondary" className="rounded-full px-3 py-1"><Palette className="mr-1.5 size-3.5" />Workspace settings</Badge>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Make OmniSocial yours.</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">Manage your profile, workspace defaults, billing, and account security from one place.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_.6fr]">
        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader><CardTitle className="flex items-center gap-2"><UserRound className="size-5" />Profile</CardTitle><CardDescription>How your identity is shown inside the workspace.</CardDescription></CardHeader>
            <CardContent><ProfileForm action={updateProfile} displayName={profile?.display_name ?? ""} /></CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader><CardTitle className="flex items-center gap-2"><Workflow className="size-5" />Workspace & scheduling</CardTitle><CardDescription>Set the name, timezone, and defaults used by future publishing flows.</CardDescription></CardHeader>
            <CardContent><WorkspaceForm action={updateWorkspace} workspaceName={profile?.workspace_name ?? "My workspace"} timezone={profile?.timezone ?? "Asia/Kolkata"} autoSaveDrafts={preferences.autoSaveDrafts ?? true} defaultStatus={preferences.defaultStatus ?? "draft"} /></CardContent>
          </Card>

          <Card className="overflow-hidden border-primary/20 bg-primary/[0.03] shadow-sm">
            <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="size-5" />Billing</CardTitle><CardDescription>Choose your plan, update your subscription, and manage invoices securely through Stripe.</CardDescription></CardHeader>
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">Plans & subscription</p><p className="mt-1 text-sm text-muted-foreground">Publishing is unlimited on every paid plan.</p></div><Button asChild variant="outline"><Link href="/billing">Open billing <ArrowUpRight /></Link></Button></CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader><CardTitle className="flex items-center gap-2"><Mail className="size-5" />Email</CardTitle><CardDescription>Keep your sign-in email up to date.</CardDescription></CardHeader>
            <CardContent><AccountSecurityForm action={updateEmail} currentEmail={email} /></CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5" />Password</CardTitle><CardDescription>Change the password used to access your account.</CardDescription></CardHeader>
            <CardContent><PasswordForm action={updateAccountPassword} /></CardContent>
          </Card>

          <Card className="shadow-sm"><CardHeader><CardTitle className="text-destructive">Danger zone</CardTitle><CardDescription>Permanent account deletion and data removal.</CardDescription></CardHeader><CardContent><DeleteAccountForm action={deleteAccount} /></CardContent></Card>
        </div>

        <aside className="h-fit space-y-4 xl:sticky xl:top-24">
          <Card className="overflow-hidden border-primary/20 bg-primary/[0.03] shadow-sm"><CardContent className="p-6"><div className="flex size-10 items-center justify-center rounded-xl bg-primary/10"><Palette className="size-5 text-primary" /></div><h2 className="mt-4 font-semibold">A workspace that fits you</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Your workspace is the shared boundary for publishing users, connected social accounts, publishing, and billing.</p></CardContent></Card>
          <Card className="shadow-sm"><CardContent className="p-6"><p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Current timezone</p><p className="mt-2 text-lg font-semibold">{profile?.timezone ?? "Asia/Kolkata"}</p><p className="mt-1 text-xs text-muted-foreground">All future scheduling UI will respect this preference.</p></CardContent></Card>
        </aside>
      </div>
    </div>
  );
}
