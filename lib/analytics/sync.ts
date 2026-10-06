import "server-only";

import { decryptToken } from "@/lib/social/token-crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type SyncResult = {
  accountId: string;
  platform: string;
  postsScanned: number;
  metricsWritten: number;
  ok: boolean;
  error?: string;
};

type Account = {
  id: string;
  profile_id: string;
  platform: string;
  external_account_id: string;
  metadata: Record<string, unknown> | null;
  access_token_ciphertext: string | null;
};

type Metrics = {
  impressions?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  clicks?: number;
  video_views?: number;
  engagement_rate?: number | null;
  follower_count?: number;
  raw_metrics?: Record<string, unknown>;
};

function n(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

async function jsonFetch(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const body = await response.text();
  let data: unknown = {};
  try { data = body ? JSON.parse(body) : {}; } catch { data = { raw: body }; }
  if (!response.ok) throw new Error(`Provider request failed (${response.status}).`);
  // Provider response shapes differ and are intentionally normalized at adapter boundaries below.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data as Record<string, any>;
}

function graphVersion() {
  const value = process.env.META_GRAPH_VERSION?.trim();
  if (!value) throw new Error("META_GRAPH_VERSION is not configured.");
  return value;
}

async function fetchPostMetrics(platform: string, postId: string, token: string): Promise<Metrics> {
  if (platform === "x") {
    const data = await jsonFetch(`https://api.x.com/2/tweets/${encodeURIComponent(postId)}?tweet.fields=public_metrics`, { headers: { Authorization: `Bearer ${token}` } });
    const m = data.data?.public_metrics ?? {};
    return { likes: n(m.like_count), comments: n(m.reply_count), shares: n(m.retweet_count), clicks: n(m.url_link_clicks), impressions: n(m.impression_count), raw_metrics: m };
  }
  if (platform === "youtube") {
    const data = await jsonFetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${encodeURIComponent(postId)}`, { headers: { Authorization: `Bearer ${token}` } });
    const m = data.items?.[0]?.statistics ?? {};
    return { video_views: n(m.viewCount), impressions: n(m.viewCount), likes: n(m.likeCount), comments: n(m.commentCount), raw_metrics: m };
  }
  if (platform === "facebook") {
    const version = graphVersion();
    const metrics = "post_impressions,post_reactions_by_type_total,post_comments,post_shares";
    const data = await jsonFetch(`https://graph.facebook.com/${version}/${encodeURIComponent(postId)}/insights?metric=${metrics}&access_token=${encodeURIComponent(token)}`);
    const result: Metrics = { raw_metrics: data };
    for (const item of data.data ?? []) { const value = item.values?.[0]?.value; if (item.name === "post_impressions") result.impressions = n(value); if (item.name === "post_comments") result.comments = n(value); if (item.name === "post_shares") result.shares = n(value); if (item.name === "post_reactions_by_type_total") { const reactions = value && typeof value === "object" ? value : {}; result.likes = Object.values(reactions as Record<string, unknown>).reduce((total, value) => total + n(value), 0); } }
    return result;
  }
  if (platform === "instagram") {
    const version = graphVersion();
    const data = await jsonFetch(`https://graph.facebook.com/${version}/${encodeURIComponent(postId)}/insights?metric=impressions,reach,likes,comments,saved,shares&access_token=${encodeURIComponent(token)}`);
    const result: Metrics = { raw_metrics: data };
    for (const item of data.data ?? []) { const value = item.values?.[0]?.value; if (item.name === "impressions") result.impressions = n(value); if (item.name === "reach") result.reach = n(value); if (item.name === "likes") result.likes = n(value); if (item.name === "comments") result.comments = n(value); if (item.name === "saved") result.saves = n(value); if (item.name === "shares") result.shares = n(value); }
    return result;
  }
  if (platform === "threads") {
    const data = await jsonFetch(`https://graph.threads.net/v1.0/${encodeURIComponent(postId)}/insights?metric=views,likes,replies,reposts,quotes&access_token=${encodeURIComponent(token)}`);
    const result: Metrics = { raw_metrics: data };
    for (const item of data.data ?? []) { const value = item.values?.[0]?.value ?? item.value; if (item.name === "views") result.impressions = n(value); if (item.name === "likes") result.likes = n(value); if (item.name === "replies") result.comments = n(value); if (item.name === "reposts" || item.name === "quotes") result.shares = n(result.shares) + n(value); }
    return result;
  }
  throw new Error(`Analytics provider is not available for ${platform}.`);
}

async function fetchAccountMetrics(account: Account, token: string): Promise<Metrics> {
  const platform = account.platform.toLowerCase();
  if (platform === "youtube") {
    const data = await jsonFetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${encodeURIComponent(account.external_account_id)}`, { headers: { Authorization: `Bearer ${token}` } });
    const m = data.items?.[0]?.statistics ?? {};
    return { follower_count: n(m.subscriberCount), impressions: n(m.viewCount), comments: n(m.commentCount), raw_metrics: m };
  }
  if (platform === "linkedin") {
    const organizationId = String(account.metadata?.organization_id ?? account.external_account_id);
    const version = process.env.LINKEDIN_VERSION ?? "202609";
    const start = Date.now() - 24 * 60 * 60 * 1000;
    const end = Date.now();
    const query = new URLSearchParams({ q: "organization", organization: `urn:li:organization:${organizationId}`, "timeIntervals.timeGranularityType": "DAY", "timeIntervals.timeRange.start": String(start), "timeIntervals.timeRange.end": String(end) });
    const data = await jsonFetch(`https://api.linkedin.com/rest/organizationPageStatistics?${query}`, { headers: { Authorization: `Bearer ${token}`, "Linkedin-Version": version, "X-Restli-Protocol-Version": "2.0.0" } });
    return { raw_metrics: data };
  }
  return { raw_metrics: { provider: platform, status: "account_metrics_not_supported" } };
}

export async function syncAnalyticsForProfile(profileId: string, runId?: string): Promise<{ results: SyncResult[] }> {
  const admin = createAdminClient();
  const { data: accounts, error } = await admin.from("socialmedia_social_accounts").select("id,profile_id,platform,external_account_id,metadata,access_token_ciphertext").eq("profile_id", profileId).eq("status", "connected");
  if (error) throw new Error("Unable to load connected social accounts.");
  const results: SyncResult[] = [];
  for (const account of (accounts ?? []) as Account[]) {
    const result: SyncResult = { accountId: account.id, platform: account.platform, postsScanned: 0, metricsWritten: 0, ok: false };
    try {
      if (!account.access_token_ciphertext) throw new Error("Account has no server-side access token.");
      const token = decryptToken(account.access_token_ciphertext);
      const now = new Date(); const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const { data: postPlatforms, error: postsError } = await admin.from("socialmedia_post_platforms").select("id,post_id,platform_post_id,platform,status,published_at").eq("social_account_id", account.id).eq("status", "published").not("platform_post_id", "is", null).gte("published_at", from.toISOString()).order("published_at", { ascending: false }).limit(50);
      if (postsError) throw new Error("Unable to load published destinations.");
      result.postsScanned = postPlatforms?.length ?? 0;
      for (const destination of postPlatforms ?? []) {
        try {
          const metrics = await fetchPostMetrics(account.platform.toLowerCase(), String(destination.platform_post_id), token);
          const periodStart = destination.published_at ?? from.toISOString();
          const { error: writeError } = await admin.from("socialmedia_post_analytics").upsert({ profile_id: profileId, post_id: destination.post_id, post_platform_id: destination.id, social_account_id: account.id, platform: account.platform, platform_post_id: destination.platform_post_id, period_start: periodStart, period_end: now.toISOString(), impressions: Math.round(n(metrics.impressions)), reach: Math.round(n(metrics.reach)), likes: Math.round(n(metrics.likes)), comments: Math.round(n(metrics.comments)), shares: Math.round(n(metrics.shares)), saves: Math.round(n(metrics.saves)), clicks: Math.round(n(metrics.clicks)), video_views: Math.round(n(metrics.video_views)), engagement_rate: metrics.engagement_rate ?? null, raw_metrics: metrics.raw_metrics ?? {}, source: "provider", captured_at: now.toISOString() }, { onConflict: "post_platform_id,period_start,period_end,source" });
          if (!writeError) result.metricsWritten += 1;
        } catch (postError) { console.warn("analytics_post_sync_failed", account.platform, destination.platform_post_id, postError instanceof Error ? postError.message : postError); }
      }
      const accountMetrics = await fetchAccountMetrics(account, token);
      await admin.from("socialmedia_account_analytics").upsert({ profile_id: profileId, social_account_id: account.id, platform: account.platform, period_start: from.toISOString(), period_end: now.toISOString(), follower_count: accountMetrics.follower_count == null ? null : Math.round(accountMetrics.follower_count), impressions: Math.round(n(accountMetrics.impressions)), reach: Math.round(n(accountMetrics.reach)), likes: Math.round(n(accountMetrics.likes)), comments: Math.round(n(accountMetrics.comments)), shares: Math.round(n(accountMetrics.shares)), saves: Math.round(n(accountMetrics.saves)), clicks: Math.round(n(accountMetrics.clicks)), video_views: Math.round(n(accountMetrics.video_views)), engagement_rate: accountMetrics.engagement_rate ?? null, raw_metrics: accountMetrics.raw_metrics ?? {}, source: "provider", captured_at: now.toISOString() }, { onConflict: "social_account_id,period_start,period_end,source" });
      result.ok = true;
    } catch (accountError) { result.error = accountError instanceof Error ? accountError.message : "Analytics sync failed."; }
    results.push(result);
  }
  if (runId) {
    const failed = results.filter((item) => !item.ok).length;
    await admin.from("socialmedia_analytics_sync_runs").update({ status: failed === 0 ? "succeeded" : failed === results.length ? "failed" : "partial", finished_at: new Date().toISOString(), accounts_scanned: results.length, accounts_succeeded: results.filter((item) => item.ok).length, accounts_failed: failed, posts_scanned: results.reduce((sum, item) => sum + item.postsScanned, 0), metrics_written: results.reduce((sum, item) => sum + item.metricsWritten, 0), error_count: failed, errors: results.filter((item) => item.error).map((item) => ({ account_id: item.accountId, platform: item.platform, error: item.error })) }).eq("id", runId);
  }
  return { results };
}
