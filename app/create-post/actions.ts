"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizeTimeZone, zonedDateTimeToUtc } from "@/lib/scheduling/timezone";
import { buildIdempotencyKey } from "@/lib/publishing/idempotency";
import { runPublishingWorker } from "@/lib/publishing/worker";
import { enqueueNotification } from "@/lib/notifications";
import { getPostTitle } from "@/lib/notifications/email";
import { mediaTypeFromPath, validateMediaSelection } from "@/lib/publishing/media-capabilities";

const draftSchema = z.object({
  postId: z.string().uuid().optional(),
  content: z.string().max(5000),
  accountIds: z.array(z.string().uuid()).min(1, "Select at least one connected account."),
  mediaPaths: z.array(z.string().min(1)).max(20).default([]),
  mode: z.enum(["draft", "schedule"]).default("draft"),
  intent: z.enum(["draft", "schedule", "publish"]).default("draft"),
  scheduledAtLocal: z.string().optional(),
  timezone: z.string().default("Asia/Kolkata"),
});

export type SaveDraftState = { ok: boolean; message: string; postId?: string; kind?: "success" | "error" | "scheduled" };

const POST_LIMIT_MESSAGE = "Your Free plan allows 10 posts per rolling month. The limit resets one month after the first post in your current usage period. Upgrade your plan to publish more.";

function isPostLimitError(error: { message?: string | null } | null | undefined) {
  return error?.message === "POST_LIMIT_REACHED";
}

export async function saveDraft(_previous: SaveDraftState, formData: FormData): Promise<SaveDraftState> {
  const rawAccountIds = formData.getAll("accountIds").filter((value): value is string => typeof value === "string");
  const rawMediaPaths = formData.getAll("mediaPaths").filter((value): value is string => typeof value === "string");
  const parsed = draftSchema.safeParse({
    postId: typeof formData.get("postId") === "string" && formData.get("postId") ? formData.get("postId") : undefined,
    content: String(formData.get("content") ?? ""),
    accountIds: rawAccountIds,
    mediaPaths: rawMediaPaths,
    mode: formData.get("intent") === "schedule" || formData.get("intent") === "publish" ? "schedule" : "draft",
    intent: formData.get("intent") === "schedule" || formData.get("intent") === "publish" ? String(formData.get("intent")) : "draft",
    scheduledAtLocal: typeof formData.get("scheduledAtLocal") === "string" ? String(formData.get("scheduledAtLocal")) : undefined,
    timezone: typeof formData.get("timezone") === "string" ? String(formData.get("timezone")) : "Asia/Kolkata",
  });
  if (!parsed.success) return { ok: false, kind: "error", message: parsed.error.issues[0]?.message ?? "Please review the post." };

  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (claimsError || !userId) redirect("/auth/login");
  const { data: profile } = await supabase.from("socialmedia_profiles").select("timezone, workspace_id").eq("id", String(userId)).maybeSingle();
  const timezone = normalizeTimeZone(profile?.timezone);
  const workspaceId = profile?.workspace_id ? String(profile.workspace_id) : null;
  if (!workspaceId) return { ok: false, kind: "error", message: "Your workspace has not been initialized yet." };
  let scheduledAt: string | null = null;

  if (parsed.data.intent === "publish") {
    // Immediate publishing must enter the publishing worker now. The worker
    // remains the single publishing path; cron is reserved for scheduled posts.
    scheduledAt = new Date().toISOString();
  } else if (parsed.data.mode === "schedule") {
    if (!parsed.data.scheduledAtLocal) return { ok: false, kind: "error", message: "Choose a date and time for the scheduled post." };
    const scheduledDate = zonedDateTimeToUtc(parsed.data.scheduledAtLocal, timezone);
    if (!scheduledDate) return { ok: false, kind: "error", message: "The selected date and time is invalid for the workspace timezone." };
    if (scheduledDate.getTime() <= Date.now()) return { ok: false, kind: "error", message: "Scheduled posts must be set for a future time." };
    scheduledAt = scheduledDate.toISOString();
  }

  const userPathPrefix = `${String(userId)}/`;
  const selectedAccountRows = await supabase
    .from("socialmedia_social_accounts")
    .select("id, platform, socialmedia_user_id")
    .eq("profile_id", String(userId))
    .eq("status", "connected")
    .in("id", parsed.data.accountIds);

  if (selectedAccountRows.error || !selectedAccountRows.data || selectedAccountRows.data.length !== parsed.data.accountIds.length) {
    return { ok: false, kind: "error", message: "One or more selected accounts are no longer connected." };
  }

  const publishingUserIds = [...new Set(selectedAccountRows.data.map((account) => account.socialmedia_user_id).filter(Boolean))];
  if (publishingUserIds.length !== 1 || selectedAccountRows.data.some((account) => !account.socialmedia_user_id)) {
    return { ok: false, kind: "error", message: "Select destinations from one publishing user at a time." };
  }
  const publishingUserId = publishingUserIds[0]!;

  const selectedPlatforms = [...new Set((selectedAccountRows.data ?? []).map((account) => account.platform))];
  if (selectedPlatforms.includes("x")) return { ok: false, kind: "error", message: "X publishing is temporarily disabled in Omnisocial." };

  if (parsed.data.mediaPaths.some((path) => !path.startsWith(userPathPrefix) || path.includes(".."))) {
    return { ok: false, kind: "error", message: "One or more media files are not owned by your account." };
  }

  if (parsed.data.mediaPaths.length > 0) {
    const admin = createAdminClient();
    const { data: ownedFiles, error: mediaError } = await admin.storage
      .from("social-media-assets")
      .list(String(userId), { limit: 1000, sortBy: { column: "created_at", order: "desc" } });
    if (mediaError) return { ok: false, kind: "error", message: "The media could not be verified." };
    const ownedFilesByPath = new Map((ownedFiles ?? []).map((file) => [`${userPathPrefix}${file.name}`, file]));
    if (parsed.data.mediaPaths.some((path) => !ownedFilesByPath.has(path))) return { ok: false, kind: "error", message: "One or more selected media files could not be verified." };
    const selectedMedia = parsed.data.mediaPaths.map((path) => ownedFilesByPath.get(path)).filter(Boolean);
    const invalidMedia = selectedMedia.find((file) => !file?.metadata?.mimetype || (file.metadata.size ?? 0) > 100 * 1024 * 1024);
    if (invalidMedia) return { ok: false, kind: "error", message: "One or more media files exceed the supported type or 100 MB size limit." };
    const mediaTypes = selectedMedia.map((file) => String(file?.metadata?.mimetype ?? ""));
    const mediaValidationError = validateMediaSelection(selectedPlatforms, mediaTypes);
    if (mediaValidationError) return { ok: false, kind: "error", message: mediaValidationError };
  }

  const mediaPathValidationError = validateMediaSelection(selectedPlatforms, parsed.data.mediaPaths.map(mediaTypeFromPath));
  if (mediaPathValidationError) return { ok: false, kind: "error", message: mediaPathValidationError };

  let postId = parsed.data.postId;
  let createdNewPost = false;
  if (postId) {
    const { data: existingPost, error: existingPostError } = await supabase
      .from("socialmedia_posts")
      .select("id,status,socialmedia_user_id")
      .eq("id", postId)
      .eq("profile_id", String(userId))
      .eq("socialmedia_user_id", publishingUserId)
      .maybeSingle();
    if (existingPostError || !existingPost) return { ok: false, kind: "error", message: "Post not found for this publishing user." };
    if (existingPost.status === "published" || existingPost.status === "publishing") return { ok: false, kind: "error", message: "Published or currently publishing posts cannot be changed." };
    const { error } = await supabase.from("socialmedia_posts")
      .update({ content: parsed.data.content, status: parsed.data.mode === "schedule" ? "scheduled" : "draft", scheduled_at: scheduledAt, media_urls: parsed.data.mediaPaths, socialmedia_user_id: publishingUserId, workspace_id: workspaceId })
      .eq("id", postId)
      .eq("profile_id", String(userId))
      .eq("socialmedia_user_id", publishingUserId);
    if (error) return { ok: false, kind: "error", message: "The draft could not be updated." };
    const { error: deleteError } = await supabase.from("socialmedia_post_platforms").delete().eq("post_id", postId);
    if (deleteError) return { ok: false, kind: "error", message: "The draft changed, but its destinations could not be updated." };
  } else {
    const { data: post, error } = await supabase.from("socialmedia_posts")
      .insert({ profile_id: String(userId), workspace_id: workspaceId, socialmedia_user_id: publishingUserId, content: parsed.data.content, status: parsed.data.mode === "schedule" ? "scheduled" : "draft", scheduled_at: scheduledAt, media_urls: parsed.data.mediaPaths })
      .select("id")
      .single();
    if (isPostLimitError(error)) return { ok: false, kind: "error", message: POST_LIMIT_MESSAGE };
    if (error || !post) return { ok: false, kind: "error", message: "The draft could not be saved." };
    postId = post.id;
    createdNewPost = true;
  }

  const { error: linksError } = await supabase.from("socialmedia_post_platforms").insert(
    parsed.data.accountIds.map((socialAccountId) => ({ post_id: postId, social_account_id: socialAccountId, socialmedia_user_id: publishingUserId, workspace_id: workspaceId, status: parsed.data.mode === "schedule" ? "scheduled" : "pending", scheduled_at: scheduledAt, idempotency_key: buildIdempotencyKey(postId!, socialAccountId) })),
  );
  if (linksError) {
    if (createdNewPost && postId) {
      const admin = createAdminClient();
      await admin.from("socialmedia_posts").delete().eq("id", postId).eq("profile_id", String(userId));
      await admin.rpc("socialmedia_release_post_usage", { p_workspace_id: workspaceId });
    }
    return { ok: false, kind: "error", message: "The draft was saved, but its destinations could not be saved." };
  }

  if (parsed.data.mode === "schedule" && scheduledAt && parsed.data.intent !== "publish") {
    const platforms = [...new Set(selectedAccountRows.data.map((account) => account.platform))];
    await enqueueNotification({
      profileId: String(userId),
      eventType: "post_scheduled",
      dedupeKey: `post_scheduled:${postId}:${scheduledAt}`,
      postId,
      payload: {
        postId,
        postTitle: getPostTitle(parsed.data.content),
        platforms,
        scheduledAt,
        timezone,
      },
    });
  }

  // Immediate Publish: invoke the existing publishing worker directly instead
  // of waiting for the minute-based cron poll. Scheduled posts never take this
  // path and remain cron-driven.
  if (parsed.data.intent === "publish") {
    try {
      await runPublishingWorker();
    } catch (error) {
      console.error("immediate_publish_worker_failed", {
        postId,
        userId: String(userId),
        message: error instanceof Error ? error.message : "Unknown error",
      });
      return { ok: false, kind: "error", message: "The post was created, but publishing could not be started. Please retry from Post History." };
    }
  }

  revalidatePath("/create-post");
  revalidatePath("/dashboard");
  revalidatePath("/post-history");

  if (parsed.data.intent === "publish") {
    return { ok: true, kind: "success", message: "Your post is publishing now.", postId };
  }
  return parsed.data.mode === "schedule"
    ? { ok: true, kind: "scheduled", message: `Your post is scheduled for ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(scheduledAt!))} (${timezone}).`, postId }
    : { ok: true, kind: "success", message: "Your draft has been saved.", postId };
}
