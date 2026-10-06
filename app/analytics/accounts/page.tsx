import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { AnalyticsSyncButton } from "@/components/analytics-sync-button";

function n(value: unknown) { return new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value ?? 0)); }

export default async function AnalyticsAccountsPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/auth/login");
  const profileId = String(claims.claims.sub);
  const { data: rows } = await supabase.from("socialmedia_account_analytics").select("id,social_account_id,platform,follower_count,impressions,reach,likes,comments,shares,saves,clicks,video_views,captured_at").eq("profile_id", profileId).order("captured_at", { ascending: false }).limit(100);
  const accountIds = [...new Set((rows ?? []).map((row) => row.social_account_id))];
  const { data: accounts } = accountIds.length ? await supabase.from("socialmedia_social_accounts").select("id,account_name,username,status").in("id", accountIds) : { data: [] };
  const accountMap = new Map((accounts ?? []).map((account) => [account.id, account]));
  return <div className="space-y-6"><header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-3xl font-semibold tracking-tight">Account analytics</h1><p className="mt-2 text-sm text-muted-foreground">Audience and account-level performance snapshots.</p></div><AnalyticsSyncButton /></header><div className="grid gap-4 sm:grid-cols-2">{rows?.length ? rows.map((row) => { const account = accountMap.get(row.social_account_id); return <Card key={row.id}><CardHeader className="flex-row items-start justify-between space-y-0"><div><CardTitle className="text-base">{account?.account_name ?? row.platform}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{account?.username ? `@${account.username}` : row.platform}</p></div><Badge variant="secondary" className="capitalize">{row.platform}</Badge></CardHeader><CardContent><div className="grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-muted/40 p-3"><span className="text-muted-foreground">Followers</span><p className="mt-1 text-xl font-semibold">{row.follower_count == null ? "—" : n(row.follower_count)}</p></div><div className="rounded-xl bg-muted/40 p-3"><span className="text-muted-foreground">Impressions</span><p className="mt-1 text-xl font-semibold">{n(row.impressions)}</p></div><div className="rounded-xl bg-muted/40 p-3"><span className="text-muted-foreground">Reach</span><p className="mt-1 text-xl font-semibold">{n(row.reach)}</p></div><div className="rounded-xl bg-muted/40 p-3"><span className="text-muted-foreground">Interactions</span><p className="mt-1 text-xl font-semibold">{n(Number(row.likes ?? 0) + Number(row.comments ?? 0) + Number(row.shares ?? 0) + Number(row.saves ?? 0))}</p></div></div><p className="mt-4 text-xs text-muted-foreground">Captured {new Date(row.captured_at).toLocaleString("en-IN")}</p></CardContent></Card>; }) : <Card className="sm:col-span-2"><CardContent className="py-12 text-center text-sm text-muted-foreground">No account analytics snapshots yet.</CardContent></Card>}</div></div>;
}
