import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { notificationIdempotencyKey } from "./idempotency";
import { canRetryNotification, getNextNotificationAttemptAt } from "./retry";
import { renderNotificationEmail } from "./email";

const BATCH_SIZE = 20;
const STALE_SENDING_MINUTES = 10;

type NotificationRow = {
  id: string; profile_id: string; event_type: string; dedupe_key: string;
  post_id: string | null; social_account_id: string | null; payload: Record<string, unknown>;
  attempts: number; next_attempt_at: string; created_at: string;
};

async function sendWithResend(to: string, row: NotificationRow) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) throw new Error("Resend email configuration is missing.");
  const email = renderNotificationEmail(row.event_type, row.payload);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": notificationIdempotencyKey(row.dedupe_key),
    },
    body: JSON.stringify({ from, to: [to], subject: email.subject, html: email.html }),
    cache: "no-store",
  });
  const body = await response.text();
  if (!response.ok) {
    let message = body;
    try {
      const parsed = JSON.parse(body) as { message?: string; name?: string };
      message = parsed.message ?? parsed.name ?? body;
    } catch {}
    throw new Error(message || `Resend returned HTTP ${response.status}.`);
  }
  const parsed = JSON.parse(body) as { id?: string };
  if (!parsed.id) throw new Error("Resend did not return an email ID.");
  return parsed.id;
}

export type NotificationWorkerResult = { scanned: number; sent: number; failed: number; skipped: number };

export async function runNotificationWorker(): Promise<NotificationWorkerResult> {
  const admin = createAdminClient();
  const now = new Date();
  await admin.from("socialmedia_rate_limits").delete().lt("updated_at", new Date(now.getTime()-86400000).toISOString());
  const nowIso = now.toISOString();
  const stale = new Date(now.getTime() - STALE_SENDING_MINUTES * 60_000).toISOString();

  await admin.from("socialmedia_notification_logs")
    .update({ status: "queued", next_attempt_at: nowIso, error_message: "Recovered stale notification claim." })
    .eq("status", "sending").lt("last_attempt_at", stale);

  const { data, error } = await admin.from("socialmedia_notification_logs")
    .select("id,profile_id,event_type,dedupe_key,post_id,social_account_id,payload,attempts,next_attempt_at,created_at")
    .eq("status", "queued").lte("next_attempt_at", nowIso)
    .order("created_at", { ascending: true }).limit(BATCH_SIZE);
  if (error) throw new Error(`Unable to load notification queue: ${error.message}`);

  let sent = 0, failed = 0, skipped = 0;
  for (const row of (data ?? []) as NotificationRow[]) {
    const { data: claim } = await admin.from("socialmedia_notification_logs")
      .update({ status: "sending", attempts: row.attempts + 1, last_attempt_at: nowIso, error_message: null })
      .eq("id", row.id).eq("status", "queued").select("id").maybeSingle();
    if (!claim) continue;

    const { data: authUser } = await admin.auth.admin.getUserById(row.profile_id);
    const email = authUser.user?.email;
    if (!email) {
      await admin.from("socialmedia_notification_logs").update({ status: "failed", error_message: "No email address is available for this profile." }).eq("id", row.id).eq("status", "sending");
      failed += 1;
      continue;
    }

    try {
      const providerMessageId = await sendWithResend(email, row);
      await admin.from("socialmedia_notification_logs").update({ status: "sent", sent_at: new Date().toISOString(), provider_message_id: providerMessageId, error_message: null }).eq("id", row.id).eq("status", "sending");
      sent += 1;
    } catch (error) {
      const attempts = row.attempts + 1;
      const canRetry = canRetryNotification(attempts);
      const nextAttemptAt = getNextNotificationAttemptAt(attempts).toISOString();
      await admin.from("socialmedia_notification_logs").update({
        status: canRetry ? "queued" : "failed",
        next_attempt_at: canRetry ? nextAttemptAt : nowIso,
        error_message: error instanceof Error ? error.message.slice(0, 1000) : "Notification delivery failed.",
      }).eq("id", row.id).eq("status", "sending");
      failed += 1;
    }
  }
  skipped = Math.max(0, (data?.length ?? 0) - sent - failed);
  return { scanned: data?.length ?? 0, sent, failed, skipped };
}
