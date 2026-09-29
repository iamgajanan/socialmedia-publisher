"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { normalizeTimeZone, zonedDateTimeToUtc } from "@/lib/scheduling/timezone";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  postId: z.string().uuid(),
  scheduledAtLocal: z.string().min(1),
});

export type RescheduleState = { ok: boolean; message: string; kind?: "success" | "error" | "scheduled" };

export async function reschedulePost(_previous: RescheduleState, formData: FormData): Promise<RescheduleState> {
  const parsed = schema.safeParse({
    postId: formData.get("postId"),
    scheduledAtLocal: formData.get("scheduledAtLocal"),
  });
  if (!parsed.success) return { ok: false, message: "Choose a valid future date and time." };

  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (claimsError || !userId) redirect("/auth/login");

  const [{ data: profile }, { data: post, error: postError }, { data: platformRows, error: platformError }] = await Promise.all([
    supabase.from("socialmedia_profiles").select("timezone").eq("id", String(userId)).maybeSingle(),
    supabase.from("socialmedia_posts").select("id, status, scheduled_at").eq("id", parsed.data.postId).eq("profile_id", String(userId)).maybeSingle(),
    supabase.from("socialmedia_post_platforms").select("id, status").eq("post_id", parsed.data.postId),
  ]);

  if (postError || !post || post.status !== "scheduled") {
    return { ok: false, message: "Only scheduled posts can be rescheduled." };
  }
  if (platformError) return { ok: false, message: "The post destinations could not be checked." };
  if ((platformRows ?? []).some((row) => row.status === "publishing" || row.status === "published")) {
    return { ok: false, message: "This post is already being published and cannot be rescheduled." };
  }

  const timezone = normalizeTimeZone(profile?.timezone);
  const scheduledDate = zonedDateTimeToUtc(parsed.data.scheduledAtLocal, timezone);
  if (!scheduledDate || scheduledDate.getTime() <= Date.now()) {
    return { ok: false, message: "The new scheduled time must be valid and in the future." };
  }

  const scheduledAt = scheduledDate.toISOString();
  const { error: postUpdateError } = await supabase
    .from("socialmedia_posts")
    .update({ scheduled_at: scheduledAt, status: "scheduled" })
    .eq("id", parsed.data.postId)
    .eq("profile_id", String(userId))
    .eq("status", "scheduled");

  if (postUpdateError) return { ok: false, message: "The post could not be rescheduled." };

  const { error: platformUpdateError } = await supabase
    .from("socialmedia_post_platforms")
    .update({
      status: "scheduled",
      scheduled_at: scheduledAt,
      error_message: null,
      retry_count: 0,
      next_retry_at: null,
      last_attempt_at: null,
    })
    .eq("post_id", parsed.data.postId)
    .in("status", ["scheduled", "failed", "pending"]);

  if (platformUpdateError) return { ok: false, message: "The post time changed, but its destinations could not be rescheduled." };

  revalidatePath("/schedule");
  revalidatePath("/dashboard");
  return {
    ok: true,
    message: `Rescheduled for ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(scheduledDate)} (${timezone}).`,
  };
}
