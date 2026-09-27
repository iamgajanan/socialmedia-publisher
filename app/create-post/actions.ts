"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizeTimeZone, zonedDateTimeToUtc } from "@/lib/scheduling/timezone";
import { buildIdempotencyKey } from "@/lib/publishing/idempotency";
import { enqueueNotification } from "@/lib/notifications";

const draftSchema = z.object({
  postId: z.string().uuid().optional(),
  content: z.string().max(5000),
  accountIds: z.array(z.string().uuid()).min(1, "Select at least one connected account."),
  mediaPaths: z.array(z.string().min(1)).max(20).default([]),
  mode: z.enum(["draft", "schedule"]).default("draft"),
  scheduledAtLocal: z.string().optional(),
  timezone: z.string().default("Asia/Kolkata"),
});

export type SaveDraftState = { ok: boolean; message: string; postId?: string };

export async function saveDraft(_previous: SaveDraftState, formData: FormData): Promise<SaveDraftState> {
  const rawAccountIds = formData.getAll("accountIds").filter((value): value is string => typeof value === "string");
  const rawMediaPaths = formData.getAll("mediaPaths").filter((value): value is string => typeof value === "string");
  const parsed = draftSchema.safeParse({
    postId: typeof formData.get("postId") === "string" && formData.get("postId") ? formData.get("postId") : undefined,
    content: String(formData.get("content") ?? ""),
    accountIds: rawAccountIds,
    mediaPaths: rawMediaPaths,
    mode: formData.get("mode") === "schedule" ? "schedule" : "draft",
    scheduledAtLocal: typeof formData.get("scheduledAtLocal") === "string" ? String(formData.get("scheduledAtLocal")) : undefined,
    timezone: typeof formData.get("timezone") === "string" ? String(formData.get("timezone")) : "Asia/Kolkata",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please review the post." };

  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (claimsError || !userId) redirect("/auth/login");
  const { data: profile } = await supabase.from("socialmedia_profiles").select("timezone").eq("id", String(userId)).maybeSingle();
  const timezone = normalizeTimeZone(profile?.timezone);
  let scheduledAt: string | null = null;

  if (parsed.data.mode === "schedule") {
    if (!parsed.data.scheduledAtLocal) return { ok: false, message: "Choose a date and time for the scheduled post." };
    const scheduledDate = zonedDateTimeToUtc(parsed.data.scheduledAtLocal, timezone);
    if (!scheduledDate) return { ok: false, message: "The selected date and time is invalid for the workspace timezone." };
    if (scheduledDate.getTime() <= Date.now()) return { ok: false, message: "Scheduled posts must be set for a future time." };
    scheduledAt = scheduledDate.toISOString();
  }

  const userPathPrefix = `${String(userId)}/`;
  const selectedAccountRows = await supabase.from("socialmedia_social_accounts").select("id, platform").eq("profile_id", String(userId)).eq("status", "connected").in("id", parsed.data.accountIds);
  if (selectedAccountRows.error || !selectedAccountRows.data || selectedAccountRows.data.length !== parsed.data.accountIds.length) return { ok: false, message: "One or more selected accounts are no longer connected." };

  if (parsed.data.mediaPaths.some((path) => !path.startsWith(userPathPrefix) || path.includes(".."))) {
    return { ok: false, message: "One or more media files are not owned by your account." };
  }

  if (parsed.data.mediaPaths.length > 0) {
    const admin = createAdminClient();
    const { data: ownedFiles, error: mediaError } = await admin.storage
      .from("social-media-assets")
      .list(String(userId), { limit: 1000, sortBy: { column: "created_at", order: "desc" } });
    if (mediaError) return { ok: false, message: "The media could not be verified." };
    const ownedFilesByPath = new Map((ownedFiles ?? []).map((file) => [`${userPathPrefix}${file.name}`, file]));
    if (parsed.data.mediaPaths.some((path) => !ownedFilesByPath.has(path))) return { ok: false, message: "One or more selected media files could not be verified." };
    const selectedMedia = parsed.data.mediaPaths.map((path) => ownedFilesByPath.get(path)).filter(Boolean);
    const invalidMedia = selectedMedia.find((file) => !file?.metadata?.mimetype || (file.metadata.size ?? 0) > 100 * 1024 * 1024);
    if (invalidMedia) return { ok: false, message: "One or more media files exceed the supported type or 100 MB size limit." };
    const mediaTypes = selectedMedia.map((file) => String(file?.metadata?.mimetype ?? ""));
    const hasImage = mediaTypes.some((type) => type.startsWith("image/"));
    const hasVideo = mediaTypes.some((type) => type.startsWith("video/"));
    const selectedPlatforms = selectedAccountRows.data.map((account) => account.platform);
    if ((selectedPlatforms.includes("youtube") || selectedPlatforms.includes("tiktok")) && hasImage) return { ok: false, message: "YouTube and TikTok destinations require video media in this composer." };
    if (!hasImage && !hasVideo) return { ok: false, message: "The selected media type is not supported." };
  }


  let postId = parsed.data.postId;
  if (postId) {
    const { error } = await supabase.from("socialmedia_posts")
      .update({ content: parsed.data.content, status: parsed.data.mode === "schedule" ? "scheduled" : "draft", scheduled_at: scheduledAt, media_urls: parsed.data.mediaPaths })
      .eq("id", postId)
      .eq("profile_id", String(userId));
    if (error) return { ok: false, message: "The draft could not be updated." };
    const { error: deleteError } = await supabase.from("socialmedia_post_platforms").delete().eq("post_id", postId);
    if (deleteError) return { ok: false, message: "The draft changed, but its destinations could not be updated." };
  } else {
    const { data: post, error } = await supabase.from("socialmedia_posts")
      .insert({ profile_id: String(userId), content: parsed.data.content, status: parsed.data.mode === "schedule" ? "scheduled" : "draft", scheduled_at: scheduledAt, media_urls: parsed.data.mediaPaths })
      .select("id")
      .single();
    if (error || !post) return { ok: false, message: "The draft could not be saved." };
    postId = post.id;
  }

  const { error: linksError } = await supabase.from("socialmedia_post_platforms").insert(
    parsed.data.accountIds.map((socialAccountId) => ({ post_id: postId, social_account_id: socialAccountId, status: parsed.data.mode === "schedule" ? "scheduled" : "pending", scheduled_at: scheduledAt, idempotency_key: buildIdempotencyKey(postId!, socialAccountId) })),
  );
  if (linksError) return { ok: false, message: "The draft was saved, but its destinations could not be saved." };

  if (parsed.data.mode === "schedule" && scheduledAt) await enqueueNotification({ profileId: String(userId), eventType: "post_scheduled", dedupeKey: `post_scheduled:${postId}:${scheduledAt}`, postId, payload: { scheduledAt, timezone } });

  revalidatePath("/create-post");
  revalidatePath("/dashboard");
  return { ok: true, message: parsed.data.mode === "schedule" ? `Post scheduled for ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(scheduledAt!))} (${timezone}).` : "Draft saved.", postId };
}
