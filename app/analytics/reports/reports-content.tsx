import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

type DailyPoint = { day: string; impressions: number; reach: number; likes: number; comments: number; shares: number; saves: number; clicks: number; video_views: number };
function n(value: number) { return new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(value); }
function day(value: string) { return value.slice(0, 10); }

export default async function ReportsContent() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/auth/login");

  const profileId = String(claims.claims.sub);
  const from = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: rows } = await supabase
    .from("socialmedia_post_analytics")
    .select("post_platform_id,platform,impressions,reach,likes,comments,shares,saves,clicks,video_views,captured_at,period_end")
    .eq("profile_id", profileId)
    .gte("period_end", from)
    .order("captured_at", { ascending: false })
    .limit(2000);

  const latestByDestinationDay = new Map<string, NonNullable<typeof rows>[number]>();
  for (const row of rows ?? []) {
    const key = `${row.post_platform_id}:${day(row.captured_at)}`;
    if (!latestByDestinationDay.has(key)) latestByDestinationDay.set(key, row);
  }

  const grouped = new Map<string, DailyPoint>();
  for (const row of latestByDestinationDay.values()) {
    const key = day(row.captured_at);
    const current = grouped.get(key) ?? { day: key, impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0, video_views: 0 };
    current.impressions += Number(row.impressions ?? 0);
    current.reach += Number(row.reach ?? 0);
    current.likes += Number(row.likes ?? 0);
    current.comments += Number(row.comments ?? 0);
    current.shares += Number(row.shares ?? 0);
    current.saves += Number(row.saves ?? 0);
    current.clicks += Number(row.clicks ?? 0);
    current.video_views += Number(row.video_views ?? 0);
    grouped.set(key, current);
  }

  const points = [...grouped.values()].sort((a, b) => a.day.localeCompare(b.day)).slice(-30);
  const max = Math.max(1, ...points.map((point) => point.impressions));
  const totals = points.reduce((acc, point) => ({
    impressions: acc.impressions + point.impressions,
    reach: acc.reach + point.reach,
    likes: acc.likes + point.likes,
    comments: acc.comments + point.comments,
    shares: acc.shares + point.shares,
    clicks: acc.clicks + point.clicks,
  }), { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, clicks: 0 });

  return <div className="space-y-6">
    <header><h1 className="text-3xl font-semibold tracking-tight">Reports</h1><p className="mt-2 text-sm text-muted-foreground">Thirty-day reporting from the latest daily provider snapshots.</p></header>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[
        ["Impressions", totals.impressions],
        ["Reach", totals.reach],
        ["Interactions", totals.likes + totals.comments + totals.shares],
        ["Clicks", totals.clicks],
      ].map(([label, value]) => <Card key={label}><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{n(Number(value))}</p><p className="mt-1 text-xs text-muted-foreground">30-day reported total</p></CardContent></Card>)}
    </div>

    <Card><CardHeader><CardTitle>Impressions trend</CardTitle></CardHeader><CardContent>
      {points.length ? <div className="space-y-3">{points.map((point) => <div key={point.day} className="grid grid-cols-[80px_1fr_70px] items-center gap-3 text-xs">
        <span className="text-muted-foreground">{point.day.slice(5)}</span>
        <div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, (point.impressions / max) * 100)}%` }} /></div>
        <span className="text-right font-medium">{n(point.impressions)}</span>
      </div>)}</div> : <div className="py-12 text-center"><p className="text-sm font-medium">No reporting data yet.</p><p className="mt-1 text-xs text-muted-foreground">Run analytics sync after publishing a supported post.</p></div>}
    </CardContent></Card>

    <Card><CardHeader><CardTitle>Daily totals</CardTitle></CardHeader><CardContent>
      {points.length ? <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm">
        <thead><tr className="border-b text-left text-muted-foreground"><th className="p-3">Day</th><th className="p-3">Impressions</th><th className="p-3">Reach</th><th className="p-3">Likes</th><th className="p-3">Comments</th><th className="p-3">Shares</th><th className="p-3">Clicks</th></tr></thead>
        <tbody>{points.map((point) => <tr key={point.day} className="border-b last:border-0"><td className="p-3">{point.day}</td><td className="p-3">{n(point.impressions)}</td><td className="p-3">{n(point.reach)}</td><td className="p-3">{n(point.likes)}</td><td className="p-3">{n(point.comments)}</td><td className="p-3">{n(point.shares)}</td><td className="p-3">{n(point.clicks)}</td></tr>)}</tbody>
      </table></div> : <p className="py-12 text-center text-sm text-muted-foreground">No daily snapshots have been captured yet.</p>}
    </CardContent></Card>
  </div>;
}
