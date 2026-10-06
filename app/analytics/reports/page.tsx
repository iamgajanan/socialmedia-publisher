import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

function n(value: number) { return new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(value); }
function day(value: string) { return value.slice(0, 10); }

export default async function AnalyticsReportsPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/auth/login");
  const profileId = String(claims.claims.sub);
  const from = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: rows } = await supabase.from("socialmedia_post_analytics").select("platform,impressions,reach,likes,comments,shares,saves,clicks,video_views,captured_at").eq("profile_id", profileId).gte("period_end", from).order("captured_at", { ascending: true }).limit(1000);
  const grouped = new Map<string, any>();
  for (const row of rows ?? []) { const key = day(row.captured_at); const current = grouped.get(key) ?? { day: key, impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0, video_views: 0 }; for (const key of ["impressions","reach","likes","comments","shares","saves","clicks","video_views"]) current[key] += Number(row[key] ?? 0); grouped.set(key, current); }
  const points = [...grouped.values()].slice(-30);
  const max = Math.max(1, ...points.map((point) => point.impressions));
  return <div className="space-y-6"><header><h1 className="text-3xl font-semibold tracking-tight">Reports</h1><p className="mt-2 text-sm text-muted-foreground">Thirty-day trend reporting from captured provider snapshots.</p></header><Card><CardHeader><CardTitle>Impressions trend</CardTitle></CardHeader><CardContent>{points.length ? <div className="space-y-3">{points.map((point) => <div key={point.day} className="grid grid-cols-[80px_1fr_70px] items-center gap-3 text-xs"><span className="text-muted-foreground">{point.day.slice(5)}</span><div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, (point.impressions / max) * 100)}%` }} /></div><span className="text-right font-medium">{n(point.impressions)}</span></div>)}</div> : <p className="py-12 text-center text-sm text-muted-foreground">No reporting data yet.</p>}</CardContent></Card><Card><CardHeader><CardTitle>Daily totals</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-3">Day</th><th className="p-3">Impressions</th><th className="p-3">Reach</th><th className="p-3">Likes</th><th className="p-3">Comments</th><th className="p-3">Shares</th><th className="p-3">Clicks</th></tr></thead><tbody>{points.map((point) => <tr key={point.day} className="border-b last:border-0"><td className="p-3">{point.day}</td><td className="p-3">{n(point.impressions)}</td><td className="p-3">{n(point.reach)}</td><td className="p-3">{n(point.likes)}</td><td className="p-3">{n(point.comments)}</td><td className="p-3">{n(point.shares)}</td><td className="p-3">{n(point.clicks)}</td></tr>)}</tbody></table></div></CardContent></Card></div>;
}
