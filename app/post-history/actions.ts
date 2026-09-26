"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { buildIdempotencyKey } from "@/lib/publishing/idempotency";
import { enqueueNotification } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

const postIdSchema = z.object({ postId: z.string().uuid() });

async function getUser() {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (claimsError(error) || !userId) redirect("/auth/login");
  return { supabase, userId: String(userId) };
}

function claimsError(error: unknown) {
  return Boolean(error);
}

export type PostActionState = { ok: boolean; message: string };

export async function deletePost(_previous: PostActionState, formData: FormData): Promise<PostActionState> {
  const parsed = postIdSchema.safeParse({ postId: formData.get("postId") });
  if (!parsed.success) return { ok: false, message: "Invalid post." };
  const { supabase, userId } = await getUser();
  const { data: post } = await supabase.from("socialmedia_posts").select("id,status").eq("id", parsed.data.postId).eq("profile_id", userId).maybeSingle();
  if (!post) return { ok: false, message: "Post not found." };
  if (post.status === "publishing" || post.status === "published") return { ok: false, message: "Published or currently publishing posts cannot be deleted." };
  const { error } = await supabase.from("socialmedia_posts").delete().eq("id", post.id).eq("profile_id", userId);
  if (error) return { ok: false, message: "The post could not be deleted." };
  revalidatePath("/post-history");
  revalidatePath("/dashboard");
  revalidatePath("/schedule");
  return { ok: true, message: "Post deleted." };
}

export async function duplicatePost(_previous: PostActionState, formData: FormData): Promise<PostActionState> {
  const parsed = postIdSchema.safeParse({ postId: formData.get("postId") });
  if (!parsed.success) return { ok: false, message: "Invalid post." };
  const { supabase, userId } = await getUser();
  const { data: post } = await supabase.from("socialmedia_posts").select("id,content,media_urls").eq("id", parsed.data.postId).eq("profile_id", userId).maybeSingle();
  if (!post) return { ok: false, message: "Post not found." };
  const { data: links, error: linksError } = await supabase.from("socialmedia_post_platforms").select("social_account_id").eq("post_id", post.id);
  if (linksError) return { ok: false, message: "The post destinations could not be loaded." };
  if (!links?.length) return { ok: false, message: "This post has no destinations to duplicate." };
  const { data: copy, error: copyError } = await supabase.from("socialmedia_posts").insert({
    profile_id: userId, content: post.content, media_urls: post.media_urls, status: "draft", scheduled_at: null,
  }).select("id").single();
  if (copyError || !copy) return { ok: false, message: "The post could not be duplicated." };
  const { error: destinationError } = await supabase.from("socialmedia_post_platforms").insert(
    links.map((link) => ({
      post_id: copy.id, social_account_id: link.social_account_id, status: "pending",
      scheduled_at: null, idempotency_key: buildIdempotencyKey(copy.id, link.social_account_id),
      retry_count: 0, next_retry_at: null, last_attempt_at: null,
    })),
  );
  if (destinationError) {
    await supabase.from("socialmedia_posts").delete().eq("id", copy.id).eq("profile_id", userId);
    return { ok: false, message: "The duplicate was not fully created." };
  }
  revalidatePath("/post-history");
  revalidatePath("/dashboard");
  return { ok: true, message: "Post duplicated as a draft." };
}

export async function retryPost(_previous: PostActionState, formData: FormData): Promise<PostActionState> {
  const parsed = postIdSchema.safeParse({ postId: formData.get("postId") });
  if (!parsed.success) return { ok: false, message: "Invalid post." };
  const { supabase, userId } = await getUser();
  const { data: post } = await supabase.from("socialmedia_posts").select("id,status").eq("id", parsed.data.postId).eq("profile_id", userId).maybeSingle();
  if (!post || post.status !== "failed") return { ok: false, message: "Only failed posts can be retried." };
  const { data: failedLinks } = await supabase.from("socialmedia_post_platforms").select("id,status").eq("post_id", post.id).eq("status", "failed");
  if (!failedLinks?.length) return { ok: false, message: "There are no failed destinations to retry." };
  const scheduledAt = new Date(Date.now() + 60_000).toISOString();
  const { error: postError } = await supabase.from("socialmedia_posts").update({ status: "scheduled", scheduled_at: scheduledAt }).eq("id", post.id).eq("profile_id", userId).eq("status", "failed");
  if (postError) return { ok: false, message: "The post could not be queued for retry." };
  const { error } = await supabase.from("socialmedia_post_platforms").update({
    status: "scheduled", scheduled_at: scheduledAt, error_message: null, next_retry_at: null, last_attempt_at: null,
  }).eq("post_id", post.id).eq("status", "failed");
  if (error) return { ok: false, message: "The failed destinations could not be queued." };
  revalidatePath("/post-history");
  revalidatePath("/schedule");
  revalidatePath("/dashboard");
  return { ok: true, message: "Failed destinations queued for retry." };
}

export async function queuePublishNow(_previous: PostActionState, formData: FormData): Promise<PostActionState> {
  const parsed = postIdSchema.safeParse({ postId: formData.get("postId") });
  if (!parsed.success) return { ok: false, message: "Invalid post." };
  const { supabase, userId } = await getUser();
  const { data: post } = await supabase.from("socialmedia_posts").select("id,status").eq("id", parsed.data.postId).eq("profile_id", userId).maybeSingle();
  if (!post || !["draft", "scheduled"].includes(post.status)) return { ok: false, message: "Only drafts and scheduled posts can be queued." };
  const scheduledAt = new Date(Date.now() + 60_000).toISOString();
  const { error: postError } = await supabase.from("socialmedia_posts").update({ status: "scheduled", scheduled_at: scheduledAt }).eq("id", post.id).eq("profile_id", userId).in("status", ["draft", "scheduled"]);
  if (postError) return { ok: false, message: "The post could not be queued." };
  const { error } = await supabase.from("socialmedia_post_platforms").update({ status: "scheduled", scheduled_at: scheduledAt }).eq("post_id", post.id).in("status", ["pending", "scheduled"]);
  if (!error) await enqueueNotification({ profileId: userId, eventType: "post_scheduled", dedupeKey: `post_scheduled:${post.id}:${scheduledAt}`, postId: post.id, payload: { scheduledAt } });
  if (error) return { ok: false, message: "The post time changed, but destinations could not be queued." };
  revalidatePath("/post-history");
  revalidatePath("/schedule");
  revalidatePath("/dashboard");
  return { ok: true, message: "Queued for publishing." };
}
