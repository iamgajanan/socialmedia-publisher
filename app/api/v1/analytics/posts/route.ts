import { authenticateApiRequest } from "@/lib/api/api-auth";
import {
  addAnalyticsTotals,
  emptyAnalyticsTotals,
  engagementRate,
  interactionCount,
  parseAnalyticsQuery,
  type AnalyticsMetric,
} from "@/lib/api/analytics-core";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiJson, getRequestId, withRequestId } from "@/lib/api/api-response";

function latestByDestination<T extends { post_platform_id: string; captured_at: string }>(rows: T[]): T[] {
  const latest = new Map<string, T>();
  for (const row of rows) {
    const existing = latest.get(row.post_platform_id);
    if (!existing || new Date(row.captured_at).getTime() > new Date(existing.captured_at).getTime()) {
      latest.set(row.post_platform_id, row);
    }
  }
  return [...latest.values()];
}

async function GETImpl(request: Request) {
  const requestId = getRequestId(request);
  const authentication = await authenticateApiRequest(request);
  if (!authentication.ok) {
    return apiJson(
      { error: authentication.error },
      authentication.status,
      requestId,
      authentication.retryAfterSeconds ? { "Retry-After": String(authentication.retryAfterSeconds) } : undefined,
    );
  }

  const parsed = parseAnalyticsQuery(new URL(request.url).searchParams);
  if (!parsed.ok) return apiJson({ error: parsed.message, code: "invalid_analytics_query" }, 400, requestId);

  const searchParams = new URL(request.url).searchParams;
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 20), 1), 100);
  const offset = Math.min(Math.max(Number(searchParams.get("offset") ?? 0), 0), 10000);
  const { from, to, platforms } = parsed.data;
  const allowedPlatforms = platforms ? new Set(platforms) : null;
  const admin = createAdminClient();

  const { data: posts, error: postsError, count } = await admin
    .from("socialmedia_posts")
    .select("id,content,status,scheduled_at,published_at,created_at,updated_at", { count: "exact" })
    .eq("profile_id", authentication.profileId)
    .eq("workspace_id", authentication.workspaceId)
    .gte("created_at", from)
    .lt("created_at", to)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (postsError) {
    console.error("api_analytics_posts_list_failed", { requestId, profileId: authentication.profileId, code: postsError.code, message: postsError.message });
    return apiJson({ error: "Unable to load post analytics.", code: "analytics_posts_list_failed" }, 500, requestId);
  }

  const postIds = (posts ?? []).map((post) => post.id);
  const { data: links, error: linksError } = postIds.length
    ? await admin
        .from("socialmedia_post_platforms")
        .select("id,post_id,social_account_id,platform,status,platform_post_id,error_message,published_at")
        .in("post_id", postIds)
    : { data: [], error: null };

  if (linksError) {
    console.error("api_analytics_posts_destinations_failed", { requestId, profileId: authentication.profileId, code: linksError.code, message: linksError.message });
    return apiJson({ error: "Unable to load post destinations.", code: "analytics_posts_destinations_failed" }, 500, requestId);
  }

  const filteredLinks = (links ?? []).filter((link) => !allowedPlatforms || allowedPlatforms.has(link.platform));
  const filteredPostIds = new Set(filteredLinks.map((link) => link.post_id));
  const filteredPosts = (posts ?? []).filter((post) => !allowedPlatforms || filteredPostIds.has(post.id));
  const postPlatformIds = filteredLinks.map((link) => link.id);

  const { data: analytics, error: analyticsError } = postPlatformIds.length
    ? await admin
        .from("socialmedia_post_analytics")
        .select("post_platform_id,social_account_id,platform,platform_post_id,captured_at,impressions,reach,likes,comments,shares,saves,clicks,video_views,engagement_rate")
        .eq("profile_id", authentication.profileId)
        .in("post_platform_id", postPlatformIds)
        .gte("period_start", from)
        .lte("period_end", to)
        .order("captured_at", { ascending: false })
    : { data: [], error: null };

  if (analyticsError && analyticsError.code !== "42P01") {
    console.error("api_analytics_posts_metrics_failed", { requestId, profileId: authentication.profileId, code: analyticsError.code, message: analyticsError.message });
    return apiJson({ error: "Unable to load post metrics.", code: "analytics_posts_metrics_failed" }, 500, requestId);
  }

  const latest = latestByDestination(analytics ?? []);
  const metricsByDestination = new Map(latest.map((row) => [row.post_platform_id, row]));

  const rows = filteredPosts.map((post) => {
    const destinations = filteredLinks.filter((link) => link.post_id === post.id).map((link) => {
      const metrics = metricsByDestination.get(link.id);
      const totals = emptyAnalyticsTotals();
      if (metrics) addAnalyticsTotals(totals, metrics as Partial<Record<AnalyticsMetric, number>>);
      return {
        id: link.id,
        platform: link.platform,
        social_account_id: link.social_account_id,
        status: link.status,
        platform_post_id: link.platform_post_id,
        published_at: link.published_at,
        error: link.status === "failed" ? link.error_message : null,
        metrics: {
          ...totals,
          interactions: interactionCount(totals),
          engagement_rate: engagementRate(totals),
          captured_at: metrics?.captured_at ?? null,
        },
      };
    });

    const total = emptyAnalyticsTotals();
    for (const destination of destinations) addAnalyticsTotals(total, destination.metrics as Partial<Record<AnalyticsMetric, number>>);

    return {
      id: post.id,
      content: post.content,
      status: post.status,
      scheduled_at: post.scheduled_at,
      published_at: post.published_at,
      created_at: post.created_at,
      updated_at: post.updated_at,
      destinations,
      metrics: {
        ...total,
        interactions: interactionCount(total),
        engagement_rate: engagementRate(total),
      },
    };
  });

  return apiJson({
    success: true,
    period: { from, to },
    platforms: platforms ?? null,
    posts: rows,
    count: allowedPlatforms ? rows.length : count ?? rows.length,
    limit,
    offset,
    metric_source: latest.length ? "provider_snapshots" : "publishing_data_only",
  }, 200, requestId);
}

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  return withRequestId(await GETImpl(request), requestId);
}
