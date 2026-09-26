import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type NotificationEvent =
  | "post_scheduled"
  | "post_published"
  | "post_failed"
  | "account_disconnected"
  | "token_expired";

type NotificationInput = {
  profileId: string;
  eventType: NotificationEvent;
  dedupeKey: string;
  postId?: string | null;
  socialAccountId?: string | null;
  payload?: Record<string, unknown>;
};

export async function enqueueNotification(input: NotificationInput) {
  const admin = createAdminClient();
  const { error } = await admin.from("socialmedia_notification_logs").insert({
    profile_id: input.profileId,
    event_type: input.eventType,
    dedupe_key: input.dedupeKey,
    post_id: input.postId ?? null,
    social_account_id: input.socialAccountId ?? null,
    payload: input.payload ?? {},
  });
  if (error && !String(error.message).toLowerCase().includes("duplicate")) {
    throw new Error(`Unable to queue notification: ${error.message}`);
  }
}

export function notificationIdempotencyKey(dedupeKey: string) {
  return `socialmedia-notification:v1:${dedupeKey}`.slice(0, 256);
}
