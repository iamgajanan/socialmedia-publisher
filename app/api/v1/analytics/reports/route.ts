import { authenticateApiRequest } from "@/lib/api/api-auth";
import { parseAnalyticsQuery, emptyAnalyticsTotals, addAnalyticsTotals, type AnalyticsMetric } from "@/lib/api/analytics-core";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiJson, getRequestId, withRequestId } from "@/lib/api/api-response";

function dateKey(value: string) { return value.slice(0, 10); }

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return apiJson({ error: auth.error }, auth.status, requestId);
  const parsed = parseAnalyticsQuery(new URL(request.url).searchParams);
  if (!parsed.ok) return apiJson({ error: parsed.message, code: "invalid_analytics_query" }, 400, requestId);

  const admin = createAdminClient();
  const { data: workspacePosts, error: postsError } = await admin
    .from("socialmedia_posts")
    .select("id")
    .eq("workspace_id", auth.workspaceId)
    .eq("profile_id", auth.profileId)
    .gte("created_at", parsed.data.from)
    .lt("created_at", parsed.data.to);

  if (postsError) return apiJson({ error: "Unable to load workspace posts.", code: "analytics_workspace_posts_failed" }, 500, requestId);
  const postIds = (workspacePosts ?? []).map((row) => row.id);
  if (!postIds.length) return withRequestId(apiJson({ success: true, period: parsed.data, granularity: "day", rows: [], count: 0 }, 200, requestId), requestId);

  const { data: destinations, error: destinationsError } = await admin
    .from("socialmedia_post_platforms")
    .select("id")
    .in("post_id", postIds);

  if (destinationsError) return apiJson({ error: "Unable to load workspace destinations.", code: "analytics_workspace_destinations_failed" }, 500, requestId);
  const destinationIds = (destinations ?? []).map((row) => row.id);
  if (!destinationIds.length) return withRequestId(apiJson({ success: true, period: parsed.data, granularity: "day", rows: [], count: 0 }, 200, requestId), requestId);

  const { data, error } = await admin
    .from("socialmedia_post_analytics")
    .select("platform,captured_at,impressions,reach,likes,comments,shares,saves,clicks,video_views")
    .eq("profile_id", auth.profileId)
    .in("post_platform_id", destinationIds)
    .gte("period_end", parsed.data.from)
    .lte("period_end", parsed.data.to)
    .order("captured_at", { ascending: true })
    .limit(5000);

  if (error && error.code !== "42P01") return apiJson({ error: "Unable to load analytics report.", code: "analytics_report_failed" }, 500, requestId);

  const groups = new Map<string, { totals: ReturnType<typeof emptyAnalyticsTotals>; platforms: Set<string> }>();
  for (const row of data ?? []) {
    if (parsed.data.platforms && !parsed.data.platforms.includes(row.platform as never)) continue;
    const key = dateKey(row.captured_at);
    const group = groups.get(key) ?? { totals: emptyAnalyticsTotals(), platforms: new Set<string>() };
    addAnalyticsTotals(group.totals, row as Partial<Record<AnalyticsMetric, number>>);
    group.platforms.add(row.platform);
    groups.set(key, group);
  }
  const rows = [...groups.entries()].map(([date, group]) => ({ date, platforms: [...group.platforms], ...group.totals })).sort((a, b) => a.date.localeCompare(b.date));
  return withRequestId(apiJson({ success: true, period: parsed.data, granularity: "day", rows, count: rows.length }, 200, requestId), requestId);
}
