import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getRetrySchedule } from "./retry";
import { buildIdempotencyKey } from "./idempotency";
import { resolveMedia } from "./media";
import { prepareMediaForPlatform } from "./media-preparation";
import { getUsableAccessToken } from "./refresh";
import { getPublisher } from "./providers";
import { PublisherError } from "./providers/types";
import { getPublishingPostOutcome } from "./outcome";
import { enqueueNotification } from "@/lib/notifications";
import { getPostTitle } from "@/lib/notifications/email";
import type { PublisherAccount } from "./providers/types";

const BATCH_SIZE = 10;
type WorkerRow = { profileId: string; id: string; post_id: string; social_account_id: string; status: string; platform_post_id: string | null; retry_count: number; max_retries: number; account: PublisherAccount; content: string; mediaPaths: string[] };

async function requeueDueRetries(supabase: ReturnType<typeof createAdminClient>, now: string) {
  const { data: retryRows } = await supabase
    .from("socialmedia_post_platforms")
    .select("id,post_id")
    .eq("status", "failed")
    .not("next_retry_at", "is", null)
    .lte("next_retry_at", now)
    .limit(BATCH_SIZE * 5);

  const postIds = [...new Set((retryRows ?? []).map((row) => row.post_id))];
  if (!postIds.length) return;

  const { data: posts } = await supabase
    .from("socialmedia_posts")
    .select("id,status")
    .in("id", postIds);

  const eligiblePostIds = new Set(
    (posts ?? [])
      .filter((post) => post.status === "failed" || post.status === "scheduled")
      .map((post) => post.id),
  );

  for (const row of retryRows ?? []) {
    if (!eligiblePostIds.has(row.post_id)) continue;

    await supabase
      .from("socialmedia_post_platforms")
      .update({ status: "scheduled", next_retry_at: null })
      .eq("id", row.id)
      .eq("status", "failed")
      .not("next_retry_at", "is", null)
      .lte("next_retry_at", now);

    await supabase
      .from("socialmedia_posts")
      .update({ status: "scheduled", scheduled_at: now })
      .eq("id", row.post_id)
      .eq("status", "failed");
  }
}

export type PublishingWorkerResult = { scanned: number; deferred: number; claimed: number; published: number; failed: number };

export async function runPublishingWorker(): Promise<PublishingWorkerResult> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  await requeueDueRetries(supabase, now);
  const { data: duePosts, error } = await supabase.from("socialmedia_posts").select("id,profile_id,content,media_urls,scheduled_at").eq("status","scheduled").not("scheduled_at","is",null).lte("scheduled_at",now).order("scheduled_at",{ascending:true}).limit(BATCH_SIZE);
  if (error) throw new Error(`Unable to load scheduled posts: ${error.message}`);
  let claimed=0, deferred=0, published=0, failed=0;

  for (const post of duePosts ?? []) {
    if (!post.scheduled_at) continue;
    const { data: claimedPost } = await supabase.from("socialmedia_posts").update({status:"publishing"}).eq("id",post.id).eq("status","scheduled").eq("scheduled_at",post.scheduled_at).select("id").maybeSingle();
    if (!claimedPost) continue;
    claimed += 1;

    const { data: links, error: linksError } = await supabase.from("socialmedia_post_platforms").select("id,post_id,social_account_id,status,platform_post_id,retry_count,max_retries").eq("post_id",post.id);
    if (linksError || !links?.length) {
      await supabase.from("socialmedia_posts").update({status:"failed"}).eq("id",post.id).eq("status","publishing");
      failed += 1; continue;
    }

    const rows: WorkerRow[] = [];
    for (const link of links) {
      if (link.status === "skipped") continue;
      const { data: account } = await supabase.from("socialmedia_social_accounts").select("id,platform,external_account_id,account_name,username,metadata,token_expires_at").eq("id",link.social_account_id).maybeSingle();
      if (!account) {
        await supabase.from("socialmedia_post_platforms").update({status:"failed",error_message:"Connected social account was not found.",last_attempt_at:now}).eq("id",link.id).eq("status","scheduled");
        failed += 1; continue;
      }
      rows.push({ profileId: String((post as { profile_id?: string }).profile_id ?? ""), id:link.id, post_id:link.post_id, social_account_id:link.social_account_id, status:link.status, platform_post_id:link.platform_post_id, retry_count:link.retry_count ?? 0, max_retries:link.max_retries ?? 3, account:account as PublisherAccount, content:String(post.content ?? ""), mediaPaths:Array.isArray(post.media_urls) ? post.media_urls.filter((v:unknown):v is string => typeof v==="string") : [] });
    }

    for (const row of rows.filter((item) => item.status === "scheduled")) {
      const { data: claimedLink } = await supabase.from("socialmedia_post_platforms").update({status:"publishing",last_attempt_at:now}).eq("id",row.id).eq("status","scheduled").select("id").maybeSingle();
      if (!claimedLink) continue;

      if (row.platform_post_id) {
        await supabase.from("socialmedia_post_platforms").update({status:"published",published_at:now,error_message:null}).eq("id",row.id).eq("status","publishing");
        published += 1; continue;
      }

      try {
        const publisher = getPublisher(row.account.platform);
        const media = await resolveMedia(row.mediaPaths);
        const preparedMedia = await prepareMediaForPlatform(row.account.platform, media);
        const input = { account:row.account, content:row.content, media:preparedMedia, idempotencyKey:buildIdempotencyKey(row.post_id,row.social_account_id) };
        publisher.validate(input);
        const token = await getUsableAccessToken(row.account);
        const result = await publisher.publish(input,token);
        await supabase.from("socialmedia_post_platforms").update({status:"published",platform_post_id:result.platformPostId,published_at:now,error_message:null,next_retry_at:null}).eq("id",row.id).eq("status","publishing");
        published += 1;
      } catch (error) {
        const providerError = error instanceof PublisherError ? error : new PublisherError(error instanceof Error ? error.message : "Publishing failed.");
        console.error("[publishing] destination failed", {
          platform: row.account.platform,
          accountId: row.social_account_id,
          postId: row.post_id,
          code: providerError.code,
          message: providerError.message,
        });
        const next = getRetrySchedule(row.retry_count + 1,row.max_retries,new Date());
        await supabase.from("socialmedia_post_platforms").update({
          status:"failed", error_message:providerError.message.slice(0,1000), retry_count:row.retry_count+1,
          next_retry_at:next.canRetry && providerError.retryable ? next.nextRetryAt : null, last_attempt_at:now
        }).eq("id",row.id).eq("status","publishing");
        if (providerError.code === "http_401" || providerError.code === "http_403" || providerError.code === "token_refresh_failed") {
          await supabase.from("socialmedia_social_accounts").update({status:"error"}).eq("id",row.social_account_id);
          await enqueueNotification({ profileId: row.profileId, eventType: "token_expired", dedupeKey: `token_expired:${row.social_account_id}`, socialAccountId: row.social_account_id, payload: { platform: row.account.platform, account: row.account.account_name } });
        }
        failed += 1;
      }
    }

    const { data: finalLinks } = await supabase
      .from("socialmedia_post_platforms")
      .select("status,next_retry_at,social_account_id,platform")
      .eq("post_id",post.id);
    const destinationRows = (finalLinks ?? []).map((link) => ({ status: link.status, nextRetryAt: link.next_retry_at }));
    const destinationAccountIds = [...new Set((finalLinks ?? []).map((link) => link.social_account_id).filter((id): id is string => Boolean(id)))];
    const { data: destinationAccounts } = destinationAccountIds.length
      ? await supabase.from("socialmedia_social_accounts").select("id,platform").in("id", destinationAccountIds)
      : { data: [] };
    const platformByAccountId = new Map((destinationAccounts ?? []).map((account) => [account.id, account.platform]));
    const publishedPlatforms = (finalLinks ?? [])
      .filter((link) => link.status === "published")
      .map((link) => link.platform ?? platformByAccountId.get(link.social_account_id))
      .filter((platform): platform is string => Boolean(platform));
    const failedPlatforms = (finalLinks ?? [])
      .filter((link) => link.status === "failed" && !link.next_retry_at)
      .map((link) => link.platform ?? platformByAccountId.get(link.social_account_id))
      .filter((platform): platform is string => Boolean(platform));
    const outcome = getPublishingPostOutcome(destinationRows);
    const { data: notificationProfile } = await supabase
      .from("socialmedia_profiles")
      .select("timezone")
      .eq("id", String((post as { profile_id?: string }).profile_id ?? ""))
      .maybeSingle();
    const notificationTimeZone = notificationProfile?.timezone || "Asia/Kolkata";
    if (outcome === "published") {
      await supabase.from("socialmedia_posts").update({status:"published",published_at:now,scheduled_at:null}).eq("id",post.id).eq("status","publishing");
      await enqueueNotification({
        profileId: String((post as { profile_id?: string }).profile_id ?? ""),
        eventType: "post_published",
        dedupeKey: `post_published:${post.id}`,
        postId: post.id,
        payload: {
          postId: post.id,
          postTitle: getPostTitle(post.content),
          platforms: [...new Set(publishedPlatforms)],
          publishedAt: now,
          timezone: notificationTimeZone,
        },
      });
    } else if (outcome === "failed") {
      await supabase.from("socialmedia_posts").update({status:"failed"}).eq("id",post.id).eq("status","publishing");
      await enqueueNotification({
        profileId: String((post as { profile_id?: string }).profile_id ?? ""),
        eventType: "post_failed",
        dedupeKey: `post_failed:${post.id}`,
        postId: post.id,
        payload: {
          postId: post.id,
          postTitle: getPostTitle(post.content),
          platforms: [...new Set(publishedPlatforms)],
          failedPlatforms: [...new Set(failedPlatforms)],
          publishedAt: now,
          timezone: "UTC",
        },
      });
    } else {
      await supabase.from("socialmedia_posts").update({status:"scheduled"}).eq("id",post.id).eq("status","publishing");
      deferred += 1;
    }
  }
  return {scanned:duePosts?.length ?? 0,deferred,claimed,published,failed};
}
