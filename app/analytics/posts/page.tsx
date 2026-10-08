import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { AnalyticsSyncButton } from "@/components/analytics-sync-button";

export const instant = false;

function n(value: unknown) {
  return new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value ?? 0));
}

export default async function AnalyticsPostsPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/auth/login");

  const profileId = String(claims.claims.sub);
  const { data: snapshots } = await supabase
    .from("socialmedia_post_analytics")
    .select("id,post_id,post_platform_id,platform,platform_post_id,impressions,reach,likes,comments,shares,saves,clicks,video_views,captured_at")
    .eq("profile_id", profileId)
    .order("captured_at", { ascending: false })
    .limit(1000);

  const latestByDestination = new Map<string, NonNullable<typeof snapshots>[number]>();
  for (const row of snapshots ?? []) {
    if (!latestByDestination.has(row.post_platform_id)) latestByDestination.set(row.post_platform_id, row);
  }
  const rows = [...latestByDestination.values()];
  const postIds = [...new Set(rows.map((row) => row.post_id))];

  const { data: posts } = postIds.length
    ? await supabase.from("socialmedia_posts").select("id,content,status,published_at").in("id", postIds)
    : { data: [] };
  const postMap = new Map((posts ?? []).map((post) => [post.id, post]));

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Post analytics</h1>
          <p className="mt-2 text-sm text-muted-foreground">One latest analytics snapshot per published destination.</p>
        </div>
        <AnalyticsSyncButton />
      </header>
      <Card>
        <CardHeader><CardTitle>Latest snapshots</CardTitle></CardHeader>
        <CardContent>
          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-3">Post</th><th className="p-3">Platform</th><th className="p-3">Impressions</th>
                    <th className="p-3">Reach</th><th className="p-3">Likes</th><th className="p-3">Comments</th>
                    <th className="p-3">Shares</th><th className="p-3">Clicks</th><th className="p-3">Captured</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const post = postMap.get(row.post_id);
                    return (
                      <tr key={row.id} className="border-b last:border-0">
                        <td className="max-w-[260px] p-3">
                          <p className="truncate font-medium">{post?.content?.trim() || "Untitled post"}</p>
                          <Badge variant="outline" className="mt-1">{post?.status ?? "unknown"}</Badge>
                        </td>
                        <td className="p-3 capitalize">{row.platform}</td>
                        <td className="p-3">{n(row.impressions)}</td>
                        <td className="p-3">{n(row.reach)}</td>
                        <td className="p-3">{n(row.likes)}</td>
                        <td className="p-3">{n(row.comments)}</td>
                        <td className="p-3">{n(row.shares)}</td>
                        <td className="p-3">{n(row.clicks)}</td>
                        <td className="p-3 text-xs text-muted-foreground">{new Date(row.captured_at).toLocaleString("en-IN")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-sm font-medium">No post analytics snapshots yet.</p>
              <p className="mt-1 text-xs text-muted-foreground">Publish a post, then run “Sync analytics” for its connected destination.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
