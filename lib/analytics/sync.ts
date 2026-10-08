import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getUsableAccessToken } from "@/lib/publishing/refresh";
import type { PublisherAccount } from "@/lib/publishing/providers/types";

export type SyncResult = { accountId: string; platform: string; postsScanned: number; metricsWritten: number; ok: boolean; error?: string };
type Account = { id: string; profile_id: string; platform: string; external_account_id: string; account_name: string; username: string | null; metadata: Record<string, unknown> | null; token_expires_at: string | null };
type Metrics = { impressions?: number; reach?: number; likes?: number; comments?: number; shares?: number; saves?: number; clicks?: number; video_views?: number; engagement_rate?: number | null; follower_count?: number; raw_metrics?: Record<string, unknown> };
function n(value: unknown): number { const parsed = Number(value ?? 0); return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0; }
async function jsonFetch(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const body = await response.text();
  let data: unknown = {};
  try { data = body ? JSON.parse(body) : {}; } catch { data = { raw: body }; }
  if (!response.ok) {
    const details = data && typeof data === "object" ? data as Record<string, unknown> : {};
    const nestedError = details.error && typeof details.error === "object" ? details.error as Record<string, unknown> : {};
    const message = typeof details.message === "string" ? details.message : typeof details.error_description === "string" ? details.error_description : typeof nestedError.message === "string" ? nestedError.message : "";
    throw new Error(`Provider request failed (${response.status})${message ? `: ${message}` : "."}`);
  }
  // Provider response shapes differ and are normalized at adapter boundaries.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data as Record<string, any>;
}
function graphVersion() { const value = process.env.META_GRAPH_VERSION?.trim(); if (!value) throw new Error("META_GRAPH_VERSION is not configured."); return value; }

function snapshotWindow(now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 86400000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function dedupeAccounts(accounts: Account[]) {
  const seen = new Set<string>();
  return accounts.filter((account) => {
    const key = `${account.platform.toLowerCase()}:${account.external_account_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchPostMetrics(platform: string, postId: string, token: string, account?: Account): Promise<Metrics> {
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
    const version = graphVersion(); const metrics = "post_media_view,post_reactions_by_type_total,post_comments,post_shares";
    const data = await jsonFetch(`https://graph.facebook.com/${version}/${encodeURIComponent(postId)}/insights?metric=${metrics}&access_token=${encodeURIComponent(token)}`);
    const result: Metrics = { raw_metrics: data };
    for (const item of data.data ?? []) { const value = item.values?.[0]?.value; if (item.name === "post_media_view") result.impressions = n(value); if (item.name === "post_comments") result.comments = n(value); if (item.name === "post_shares") result.shares = n(value); if (item.name === "post_reactions_by_type_total") { const reactions = value && typeof value === "object" ? value : {}; result.likes = Object.values(reactions as Record<string, unknown>).reduce<number>((total, reaction) => total + n(reaction), 0); } }
    return result;
  }
  if (platform === "instagram") {
    const version = graphVersion();
    const data = await jsonFetch(`https://graph.instagram.com/${version}/${encodeURIComponent(postId)}/insights?metric=views,reach,likes,comments,saved,shares`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result: Metrics = { raw_metrics: data };
    for (const item of data.data ?? []) {
      const value = item.values?.[0]?.value ?? item.value;
      if (item.name === "views") { result.video_views = n(value); result.impressions = n(value); }
      if (item.name === "reach") result.reach = n(value);
      if (item.name === "likes") result.likes = n(value);
      if (item.name === "comments") result.comments = n(value);
      if (item.name === "saved") result.saves = n(value);
      if (item.name === "shares") result.shares = n(value);
    }
    return result;
  }
  if (platform === "threads") {
    const data = await jsonFetch(`https://graph.threads.net/v1.0/${encodeURIComponent(postId)}/insights?metric=views,likes,replies,reposts,quotes,shares&access_token=${encodeURIComponent(token)}`);
    const result: Metrics = { raw_metrics: data };
    for (const item of data.data ?? []) {
      const value = item.values?.[0]?.value ?? item.value;
      if (item.name === "views") { result.impressions = n(value); result.video_views = n(value); }
      if (item.name === "likes") result.likes = n(value);
      if (item.name === "replies") result.comments = n(value);
      if (item.name === "shares") result.shares = n(value);
      if (item.name === "reposts" || item.name === "quotes") result.shares = n(result.shares) + n(value);
    }
    return result;
  }
  if (platform === "threads") {
    const data = await jsonFetch("https://graph.threads.net/v1.0/me/threads_insights?metric=views,likes,replies,reposts,quotes,followers_count", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result: Metrics = { raw_metrics: data };
    for (const item of data.data ?? []) {
      const value = item.total_value?.value ?? item.values?.[item.values.length - 1]?.value ?? item.value;
      if (item.name === "followers_count") result.follower_count = n(value);
      if (item.name === "views") result.impressions = n(value);
      if (item.name === "likes") result.likes = n(value);
      if (item.name === "replies") result.comments = n(value);
      if (item.name === "reposts" || item.name === "quotes") result.shares = n(result.shares) + n(value);
    }
    return result;
  }
  if (platform === "tiktok") {
    const data = await jsonFetch("https://open.tiktokapis.com/v2/video/query/?fields=id,like_count,comment_count,share_count,view_count", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ filters: { video_ids: [postId] } }) });
    const video = Array.isArray(data.data?.videos) ? data.data.videos[0] ?? {} : {};
    return { video_views: n(video.view_count), impressions: n(video.view_count), likes: n(video.like_count), comments: n(video.comment_count), shares: n(video.share_count), raw_metrics: video };
  }
  if (platform === "linkedin") {
    const metadata = account?.metadata ?? {};
    const organizationId = String(metadata.linkedin_organization_id ?? metadata.organization_id ?? "").trim();
    const headers = {
      Authorization: `Bearer ${token}`,
      "Linkedin-Version": process.env.LINKEDIN_VERSION ?? "202609",
      "X-Restli-Protocol-Version": "2.0.0",
    };
    if (organizationId) {
      const organizationUrn = String(metadata.linkedin_organization_urn ?? `urn:li:organization:${organizationId}`);
      const query = new URLSearchParams({ q: "organizationalEntity", organizationalEntity: organizationUrn });
      if (postId.includes(":ugcPost:")) query.set("ugcPosts[0]", postId); else query.set("shares", `List(${postId})`);
      const data = await jsonFetch(`https://api.linkedin.com/rest/organizationalEntityShareStatistics?${query.toString()}`, { headers });
      const stats = data.elements?.[0]?.totalShareStatistics ?? {};
      return { impressions: n(stats.impressionCount), reach: n(stats.uniqueImpressionsCount ?? stats.uniqueImpressionsCounts), likes: n(stats.likeCount), comments: n(stats.commentCount), shares: n(stats.shareCount), clicks: n(stats.clickCount), engagement_rate: Number.isFinite(Number(stats.engagement)) ? Number(stats.engagement) : null, raw_metrics: data.elements?.[0] ?? data };
    }

    const metricNames = [
      ["IMPRESSION", "impressions"],
      ["MEMBERS_REACHED", "reach"],
      ["RESHARE", "shares"],
      ["REACTION", "likes"],
      ["COMMENT", "comments"],
    ] as const;
    const responses = await Promise.all(metricNames.map(async ([queryType]) => {
      const query = new URLSearchParams({ q: "entity", entity: postId, queryType, aggregation: "TOTAL" });
      const data = await jsonFetch(`https://api.linkedin.com/rest/memberCreatorPostAnalytics?${query.toString()}`, { headers });
      return { queryType, data };
    }));
    const result: Metrics = { raw_metrics: { memberCreatorPostAnalytics: responses.map((item) => item.data) } };
    for (const item of responses) {
      const count = item.data.elements?.[0]?.count ?? item.data.count;
      if (item.queryType === "IMPRESSION") result.impressions = n(count);
      if (item.queryType === "MEMBERS_REACHED") result.reach = n(count);
      if (item.queryType === "RESHARE") result.shares = n(count);
      if (item.queryType === "REACTION") result.likes = n(count);
      if (item.queryType === "COMMENT") result.comments = n(count);
    }
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
  if (platform === "x") {
    const data = await jsonFetch(`https://api.x.com/2/users/${encodeURIComponent(account.external_account_id)}?user.fields=public_metrics`, { headers: { Authorization: `Bearer ${token}` } });
    const m = data.data?.public_metrics ?? {};
    return { follower_count: n(m.followers_count), raw_metrics: m };
  }
  if (platform === "facebook") {
    const version = graphVersion();
    const data = await jsonFetch(`https://graph.facebook.com/${version}/${encodeURIComponent(account.external_account_id)}?fields=id,name,followers_count,fan_count`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { follower_count: n(data.followers_count ?? data.fan_count), raw_metrics: data };
  }
  if (platform === "instagram") {
    const version = graphVersion();
    const data = await jsonFetch(`https://graph.instagram.com/${version}/${encodeURIComponent(account.external_account_id)}?fields=id,username,followers_count,media_count`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { follower_count: n(data.followers_count), raw_metrics: data };
  }
  if (platform === "tiktok") {
    const data = await jsonFetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,username,follower_count,following_count,likes_count,video_count", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const user = data.data?.user ?? {};
    return { follower_count: n(user.follower_count), likes: n(user.likes_count), raw_metrics: user };
  }
  if (platform === "linkedin") {
    const metadata = account.metadata ?? {};
    const organizationId = String(metadata.linkedin_organization_id ?? metadata.organization_id ?? "").trim();
    const headers = {
      Authorization: `Bearer ${token}`,
      "Linkedin-Version": process.env.LINKEDIN_VERSION ?? "202609",
      "X-Restli-Protocol-Version": "2.0.0",
    };
    if (organizationId) {
      const organizationUrn = String(metadata.linkedin_organization_urn ?? `urn:li:organization:${organizationId}`);
      const query = new URLSearchParams({ q: "organization", organization: organizationUrn });
      const data = await jsonFetch(`https://api.linkedin.com/rest/organizationPageStatistics?${query.toString()}`, { headers });
      const stats = data.elements?.[0]?.totalPageStatistics ?? {};
      const views = stats.views ?? {};
      const allPageViews = views.allPageViews ?? {};
      return { impressions: n(allPageViews.pageViews), raw_metrics: data.elements?.[0] ?? data };
    }

    const metricNames = [
      ["IMPRESSION", "impressions"],
      ["MEMBERS_REACHED", "reach"],
      ["RESHARE", "shares"],
      ["REACTION", "likes"],
      ["COMMENT", "comments"],
    ] as const;
    const responses = await Promise.all(metricNames.map(async ([queryType]) => {
      const query = new URLSearchParams({ q: "me", queryType, aggregation: "TOTAL" });
      const data = await jsonFetch(`https://api.linkedin.com/rest/memberCreatorPostAnalytics?${query.toString()}`, { headers });
      return { queryType, data };
    }));
    const result: Metrics = { raw_metrics: { memberCreatorPostAnalytics: responses.map((item) => item.data) } };
    for (const item of responses) {
      const count = item.data.elements?.[0]?.count ?? item.data.count;
      if (item.queryType === "IMPRESSION") result.impressions = n(count);
      if (item.queryType === "MEMBERS_REACHED") result.reach = n(count);
      if (item.queryType === "RESHARE") result.shares = n(count);
      if (item.queryType === "REACTION") result.likes = n(count);
      if (item.queryType === "COMMENT") result.comments = n(count);
    }
    return result;
  }
  return { raw_metrics: { provider: platform, status: "account_metrics_not_supported" } };
}
export async function syncAnalyticsForProfile(profileId: string, runId?: string): Promise<{ results: SyncResult[] }> {
  const admin = createAdminClient();
  const { data: rawAccounts, error } = await admin.from("socialmedia_social_accounts").select("id,profile_id,platform,external_account_id,account_name,username,metadata,token_expires_at").eq("profile_id", profileId).eq("status", "connected");
  if (error) {
    console.error("analytics_connected_accounts_lookup_failed", { profileId, code: error.code, message: error.message });
    throw new Error("Unable to load connected social accounts.");
  }
  const accounts = dedupeAccounts((rawAccounts ?? []) as Account[]);
  const results: SyncResult[] = [];
  const now = new Date();
  const { start: periodStart, end: periodEnd } = snapshotWindow(now);
  for (const account of accounts) {
    const result: SyncResult = { accountId: account.id, platform: account.platform, postsScanned: 0, metricsWritten: 0, ok: false };
    try {
      const publisherAccount: PublisherAccount = { id: account.id, platform: account.platform, external_account_id: account.external_account_id, account_name: account.account_name, username: account.username, metadata: account.metadata ?? {}, token_expires_at: account.token_expires_at };
      const token = await getUsableAccessToken(publisherAccount);
      const from = new Date(now.getTime() - 30 * 86400000);
      const { data: postPlatforms, error: postsError } = await admin.from("socialmedia_post_platforms").select("id,post_id,platform_post_id,platform,status,published_at").eq("social_account_id", account.id).eq("status", "published").not("platform_post_id", "is", null).gte("published_at", from.toISOString()).order("published_at", { ascending: false }).limit(50);
      if (postsError) throw new Error("Unable to load published destinations.");
      result.postsScanned = postPlatforms?.length ?? 0;
      for (const destination of postPlatforms ?? []) {
        try {
          const metrics = await fetchPostMetrics(account.platform.toLowerCase(), String(destination.platform_post_id), token, account);
          const { error: writeError } = await admin.from("socialmedia_post_analytics").upsert({ profile_id: profileId, post_id: destination.post_id, post_platform_id: destination.id, social_account_id: account.id, platform: account.platform, platform_post_id: destination.platform_post_id, period_start: periodStart, period_end: periodEnd, impressions: Math.round(n(metrics.impressions)), reach: Math.round(n(metrics.reach)), likes: Math.round(n(metrics.likes)), comments: Math.round(n(metrics.comments)), shares: Math.round(n(metrics.shares)), saves: Math.round(n(metrics.saves)), clicks: Math.round(n(metrics.clicks)), video_views: Math.round(n(metrics.video_views)), engagement_rate: metrics.engagement_rate ?? null, raw_metrics: metrics.raw_metrics ?? {}, source: "provider", captured_at: now.toISOString() }, { onConflict: "post_platform_id,period_start,period_end,source" });
          if (!writeError) result.metricsWritten += 1;
          else console.warn("analytics_post_metrics_write_failed", { accountId: account.id, platform: account.platform, code: writeError.code, message: writeError.message });
        } catch (postError) { console.warn("analytics_post_sync_failed", account.platform, destination.platform_post_id, postError instanceof Error ? postError.message : postError); }
      }
      const accountMetrics = await fetchAccountMetrics(account, token);
      const { error: accountWriteError } = await admin.from("socialmedia_account_analytics").upsert({ profile_id: profileId, social_account_id: account.id, platform: account.platform, period_start: periodStart, period_end: periodEnd, follower_count: accountMetrics.follower_count == null ? null : Math.round(accountMetrics.follower_count), impressions: Math.round(n(accountMetrics.impressions)), reach: Math.round(n(accountMetrics.reach)), likes: Math.round(n(accountMetrics.likes)), comments: Math.round(n(accountMetrics.comments)), shares: Math.round(n(accountMetrics.shares)), saves: Math.round(n(accountMetrics.saves)), clicks: Math.round(n(accountMetrics.clicks)), video_views: Math.round(n(accountMetrics.video_views)), engagement_rate: accountMetrics.engagement_rate ?? null, raw_metrics: accountMetrics.raw_metrics ?? {}, source: "provider", captured_at: now.toISOString() }, { onConflict: "social_account_id,period_start,period_end,source" });
      if (accountWriteError) throw new Error(`Unable to write account analytics: ${accountWriteError.message}`);
      result.ok = true;
    } catch (accountError) { result.error = accountError instanceof Error ? accountError.message : "Analytics sync failed."; }
    results.push(result);
  }
  if (runId) { const failed = results.filter((item) => !item.ok).length; await admin.from("socialmedia_analytics_sync_runs").update({ status: failed === 0 ? "succeeded" : failed === results.length ? "failed" : "partial", finished_at: new Date().toISOString(), accounts_scanned: results.length, accounts_succeeded: results.filter((item) => item.ok).length, accounts_failed: failed, posts_scanned: results.reduce((total, item) => total + item.postsScanned, 0), metrics_written: results.reduce((total, item) => total + item.metricsWritten, 0), error_count: failed, errors: results.filter((item) => item.error).map((item) => ({ account_id: item.accountId, platform: item.platform, error: item.error })) }).eq("id", runId); }
  return { results };
}
