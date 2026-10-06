import { authenticateApiRequest } from "@/lib/api/api-auth";
import { parseAnalyticsQuery, emptyAnalyticsTotals, addAnalyticsTotals, interactionCount, engagementRate, type AnalyticsMetric } from "@/lib/api/analytics-core";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiJson, getRequestId, withRequestId } from "@/lib/api/api-response";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return apiJson({ error: auth.error }, auth.status, requestId);
  const parsed = parseAnalyticsQuery(new URL(request.url).searchParams);
  if (!parsed.ok) return apiJson({ error: parsed.message, code: "invalid_analytics_query" }, 400, requestId);
  const admin = createAdminClient();
  const { data, error } = await admin.from("socialmedia_account_analytics").select("social_account_id,platform,period_start,period_end,captured_at,follower_count,impressions,reach,likes,comments,shares,saves,clicks,video_views,engagement_rate").eq("profile_id", auth.profileId).gte("period_start", parsed.data.from).lte("period_end", parsed.data.to).order("captured_at", { ascending: false }).limit(1000);
  if (error && error.code !== "42P01") return apiJson({ error: "Unable to load account analytics.", code: "analytics_accounts_failed" }, 500, requestId);
  const latest = new Map<string, any>();
  for (const row of data ?? []) if (!latest.has(row.social_account_id)) latest.set(row.social_account_id, row);
  const accounts = [...latest.values()].filter((row) => !parsed.data.platforms || parsed.data.platforms.includes(row.platform as never)).map((row) => { const totals = emptyAnalyticsTotals(); addAnalyticsTotals(totals, row as Partial<Record<AnalyticsMetric, number>>); return { social_account_id: row.social_account_id, platform: row.platform, period: { from: row.period_start, to: row.period_end }, follower_count: row.follower_count, metrics: { ...totals, interactions: interactionCount(totals), engagement_rate: engagementRate(totals) }, captured_at: row.captured_at }; });
  return withRequestId(apiJson({ success: true, period: parsed.data, accounts, count: accounts.length, metric_source: accounts.length ? "provider_snapshots" : "publishing_data_only" }, 200, requestId), requestId);
}
