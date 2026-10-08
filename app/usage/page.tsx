import { BarChart3, Bot, Link2, Send, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentWorkspace } from "@/lib/workspace/server";

export const instant = false;

function monthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function UsageBar({ used, limit }: { used: number; limit: number | null }) {
  const percent = limit == null ? Math.min(100, used > 0 ? 12 : 0) : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  return <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} /></div>;
}

export default async function UsagePage() {
  const context = await getCurrentWorkspace();
  const periodStart = monthStart();
  const [{ data: usage }, { count: teamCount }, { count: accountCount }] = await Promise.all([
    context.supabase.rpc("socialmedia_workspace_usage", { target_workspace_id: context.workspace.id, target_period_start: periodStart }),
    context.supabase.from("socialmedia_workspace_members").select("id", { count: "exact", head: true }).eq("workspace_id", context.workspace.id).in("status", ["active", "invited"]),
    context.supabase.from("socialmedia_social_accounts").select("id", { count: "exact", head: true }).eq("workspace_id", context.workspace.id).eq("status", "connected"),
  ]);

  const row = Array.isArray(usage) ? usage[0] : usage;
  const postsCreated = Number(row?.posts_created ?? 0);
  const postsPublished = Number(row?.posts_published ?? 0);
  const aiGenerations = Number(row?.ai_generations ?? 0);
  const apiRequests = Number(row?.api_requests ?? 0);

  return <div className="space-y-8">
    <div className="max-w-3xl"><Badge variant="secondary" className="rounded-full px-3 py-1"><BarChart3 className="mr-1.5 size-3.5" />Workspace usage</Badge><h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Usage & limits.</h1><p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">See how the current workspace is using its publishing, team, AI, and API capacity for this month.</p></div>

    <Card className="border-primary/20 bg-primary/[0.03] shadow-sm"><CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Current plan</p><p className="mt-1 text-lg font-semibold">{context.plan.name}</p></div><Badge variant="secondary">{context.plan.unlimited_publishing ? "Unlimited publishing" : `${context.plan.monthly_post_limit.toLocaleString("en-IN")} posts / month`}</Badge></CardContent></Card>

    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card><CardHeader className="pb-3"><CardDescription className="flex items-center gap-2"><Send className="size-4" />Posts created</CardDescription><CardTitle className="text-3xl">{postsCreated.toLocaleString("en-IN")}</CardTitle></CardHeader><CardContent><UsageBar used={postsCreated} limit={context.plan.unlimited_publishing ? null : context.plan.monthly_post_limit} /><p className="mt-2 text-xs text-muted-foreground">{context.plan.unlimited_publishing ? "No monthly publishing cap" : `${Math.max(0, context.plan.monthly_post_limit - postsCreated).toLocaleString("en-IN")} remaining`}</p></CardContent></Card>
      <Card><CardHeader className="pb-3"><CardDescription className="flex items-center gap-2"><Send className="size-4" />Published</CardDescription><CardTitle className="text-3xl">{postsPublished.toLocaleString("en-IN")}</CardTitle></CardHeader><CardContent><p className="text-xs text-muted-foreground">Published successfully this month.</p></CardContent></Card>
      <Card><CardHeader className="pb-3"><CardDescription className="flex items-center gap-2"><Bot className="size-4" />AI generations</CardDescription><CardTitle className="text-3xl">{aiGenerations.toLocaleString("en-IN")}</CardTitle></CardHeader><CardContent><p className="text-xs text-muted-foreground">Platform-aware generations this month.</p></CardContent></Card>
      <Card><CardHeader className="pb-3"><CardDescription className="flex items-center gap-2"><BarChart3 className="size-4" />API requests</CardDescription><CardTitle className="text-3xl">{apiRequests.toLocaleString("en-IN")}</CardTitle></CardHeader><CardContent><p className="text-xs text-muted-foreground">Authenticated API requests recorded this month.</p></CardContent></Card>
    </section>

    <section className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="size-5" />Team capacity</CardTitle><CardDescription>{teamCount ?? 0} active or invited members in this workspace.</CardDescription></CardHeader><CardContent><UsageBar used={teamCount ?? 0} limit={context.plan.max_team_members} /><p className="mt-2 text-xs text-muted-foreground">{Math.max(0, context.plan.max_team_members - (teamCount ?? 0))} member slots remaining on {context.plan.name}.</p></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Link2 className="size-5" />Connected accounts</CardTitle><CardDescription>{accountCount ?? 0} connected destinations in this workspace.</CardDescription></CardHeader><CardContent><UsageBar used={accountCount ?? 0} limit={context.plan.max_social_accounts} /><p className="mt-2 text-xs text-muted-foreground">{Math.max(0, context.plan.max_social_accounts - (accountCount ?? 0))} connected-account slots remaining.</p></CardContent></Card>
    </section>

    <p className="text-xs leading-5 text-muted-foreground">Usage is isolated by workspace. Plan limits remain enforced server-side by the existing publishing and account-management flows.</p>
  </div>;
}
