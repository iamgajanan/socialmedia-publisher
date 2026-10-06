import { Eye, Heart, MessageCircle, MousePointerClick, Share2, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { AnalyticsSyncButton } from "@/components/analytics-sync-button";

// Supabase row inference is intentionally kept local to this presentation helper.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sum(rows: any[], key: string) { return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0); }
function format(value: number) { return new Intl.NumberFormat("en-IN", { notation: value > 9999 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value); }

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/auth/login");
  const profileId = String(claims.claims.sub);
  const from = new Date(Date.now() - 30 * 86400000).toISOString();
  const [postResult, accountResult, runResult] = await Promise.all([
    supabase.from("socialmedia_post_analytics").select("platform,impressions,reach,likes,comments,shares,saves,clicks,video_views,captured_at").eq("profile_id", profileId).gte("period_end", from).order("captured_at", { ascending: false }).limit(500),
    supabase.from("socialmedia_account_analytics").select("platform,follower_count,impressions,reach,likes,comments,shares,saves,clicks,video_views,captured_at").eq("profile_id", profileId).gte("period_end", from).order("captured_at", { ascending: false }).limit(100),
    supabase.from("socialmedia_analytics_sync_runs").select("status,finished_at,metrics_written,accounts_scanned,accounts_failed").eq("profile_id", profileId).order("requested_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const posts = postResult.data ?? [];
  const accounts = accountResult.data ?? [];
  const metrics = [
    ["Impressions", sum(posts, "impressions"), Eye],
    ["Reach", sum(posts, "reach"), Users],
    ["Interactions", sum(posts, "likes") + sum(posts, "comments") + sum(posts, "shares") + sum(posts, "saves"), Heart],
    ["Clicks", sum(posts, "clicks"), MousePointerClick],
    ["Comments", sum(posts, "comments"), MessageCircle],
    ["Shares", sum(posts, "shares"), Share2],
  ] as const;
  const platforms = [...new Set(posts.map((row) => row.platform))];

  return <div className="space-y-6">
    <header className="flex flex-col gap-4 rounded-3xl border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div><Badge variant="secondary" className="mb-2">Last 30 days</Badge><h1 className="text-3xl font-semibold tracking-tight">Analytics overview</h1><p className="mt-2 text-sm text-muted-foreground">Understand publishing performance across every connected destination.</p></div>
      <AnalyticsSyncButton />
    </header>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{metrics.map(([label, value, Icon]) => <Card key={label}><CardContent className="p-5"><div className="flex items-center justify-between"><div className="flex size-10 items-center justify-center rounded-xl bg-accent"><Icon className="size-4" /></div><span className="text-2xl font-semibold">{format(value)}</span></div><p className="mt-4 text-sm font-medium">{label}</p><p className="mt-1 text-xs text-muted-foreground">Provider snapshots and publishing data</p></CardContent></Card>)}</div>
    <section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
      <Card><CardHeader><CardTitle>Platform performance</CardTitle></CardHeader><CardContent>{platforms.length ? <div className="space-y-3">{platforms.map((platform) => { const rows = posts.filter((r) => r.platform === platform); return <div key={platform} className="rounded-2xl border p-4"><div className="flex justify-between"><span className="font-medium capitalize">{platform}</span><span className="text-sm text-muted-foreground">{format(sum(rows, "impressions"))} impressions</span></div><div className="mt-2 grid grid-cols-3 gap-3 text-xs text-muted-foreground"><span>{format(sum(rows, "likes"))} likes</span><span>{format(sum(rows, "comments"))} comments</span><span>{format(sum(rows, "shares"))} shares</span></div></div>; })}</div> : <p className="py-10 text-center text-sm text-muted-foreground">No provider analytics yet. Connect an account, publish a post, then sync analytics.</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle>Sync health</CardTitle></CardHeader><CardContent>{runResult.data ? <div className="space-y-4"><div className="flex items-center justify-between"><span className="text-sm">Latest run</span><Badge>{runResult.data.status}</Badge></div><div className="grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-muted/40 p-3"><p className="text-muted-foreground">Accounts</p><p className="mt-1 text-xl font-semibold">{runResult.data.accounts_scanned ?? 0}</p></div><div className="rounded-xl bg-muted/40 p-3"><p className="text-muted-foreground">Snapshots</p><p className="mt-1 text-xl font-semibold">{runResult.data.metrics_written ?? 0}</p></div></div><p className="text-xs text-muted-foreground">{runResult.data.finished_at ? `Finished ${new Date(runResult.data.finished_at).toLocaleString("en-IN")}` : "Run in progress"}</p></div> : <p className="py-10 text-center text-sm text-muted-foreground">No sync has run yet.</p>}</CardContent></Card>
    </section>
    <p className="text-xs text-muted-foreground">{accounts.length} account snapshot rows available · analytics are provider-dependent and may be unavailable when a platform does not grant reporting access.</p>
  </div>;
}
