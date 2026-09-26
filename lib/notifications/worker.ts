import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { notificationIdempotencyKey } from "./index";

const BATCH_SIZE = 20;
const MAX_ATTEMPTS = 5;
const STALE_SENDING_MINUTES = 10;

type NotificationRow = {
  id: string; profile_id: string; event_type: string; dedupe_key: string;
  post_id: string | null; social_account_id: string | null; payload: Record<string, unknown>;
  attempts: number; next_attempt_at: string; created_at: string;
};

function backoff(attempt: number) {
  return Math.min(60 * 60, 60 * 2 ** Math.max(0, attempt - 1));
}

function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[char] ?? char);
}

function renderEmail(row: NotificationRow) {
  const payload = row.payload ?? {};
  const title =
    row.event_type === "post_scheduled" ? "Post scheduled" :
    row.event_type === "post_published" ? "Post published successfully" :
    row.event_type === "post_failed" ? "Post publishing failed" :
    row.event_type === "account_disconnected" ? "Social account disconnected" :
    "Social account token expired";
  const heading = row.event_type === "post_scheduled" ? "Your post is scheduled." :
    row.event_type === "post_published" ? "Your post has been published." :
    row.event_type === "post_failed" ? "A post could not be published." :
    row.event_type === "account_disconnected" ? "A social account was disconnected." :
    "A social account needs attention.";
  const details = Object.entries(payload)
    .filter(([key]) => !["content"].includes(key))
    .map(([key, value]) => `<tr><td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#6b7280;">${esc(key)}</td><td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#111827;">${esc(value)}</td></tr>`)
    .join("");
  return {
    subject: title,
    html: `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;background:#f9fafb;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:32px 16px;"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;"><tr><td style="padding:32px;font-family:Arial,Helvetica,sans-serif;"><h1 style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:32px;color:#111827;">${esc(title)}</h1><p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:#374151;">${esc(heading)}</p><table width="100%" cellpadding="0" cellspacing="0" border="0">${details}</table></td></tr></table></td></tr></table></body></html>`,
  };
}

async function sendWithResend(to: string, row: NotificationRow) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) throw new Error("Resend email configuration is missing.");
  const email = renderEmail(row);
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
      const canRetry = attempts < MAX_ATTEMPTS;
      const nextAttemptAt = new Date(Date.now() + backoff(attempts) * 1000).toISOString();
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
