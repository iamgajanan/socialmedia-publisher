import crypto from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const MAX_ATTEMPTS = 6;
const RETRIES_MS = [60_000, 300_000, 1_800_000, 7_200_000, 21_600_000];

function admin() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service-role configuration.");
  return createSupabaseClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function signature(secret: string, timestamp: string, body: string) {
  return crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export async function runWebhookWorker(limit = 50) {
  const supabase = admin();
  const now = new Date().toISOString();

  // Query deliveries without relying on Supabase's embedded-resource relationship
  // resolution. Production has had more than one webhook schema shape during the
  // Phase 28 rollout, while the delivery rows themselves are stable. Fetching the
  // referenced webhook/event explicitly makes the worker independent of PostgREST
  // relationship metadata and also lets us report malformed rows instead of silently
  // skipping them.
  const { data: deliveries, error: deliveryQueryError } = await supabase
    .from("socialmedia_webhook_deliveries")
    .select("id,attempt,event_id,webhook_id,status,next_attempt_at")
    .eq("status", "pending")
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
    .order("next_attempt_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  if (deliveryQueryError) throw deliveryQueryError;

  let delivered = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of deliveries ?? []) {
    const { data: webhook, error: webhookError } = await supabase
      .from("socialmedia_webhooks")
      .select("id,url,secret,status")
      .eq("id", row.webhook_id)
      .maybeSingle();

    const { data: event, error: eventError } = await supabase
      .from("socialmedia_webhook_events")
      .select("id,event_type,payload")
      .eq("id", row.event_id)
      .maybeSingle();

    if (webhookError || eventError || !webhook || !event) {
      const message = webhookError?.message ?? eventError?.message ?? "Webhook or event record not found.";
      const attempt = (row.attempt ?? 0) + 1;
      const terminal = attempt >= MAX_ATTEMPTS;

      await supabase
        .from("socialmedia_webhook_deliveries")
        .update({
          status: terminal ? "failed" : "pending",
          attempt,
          response_body: message,
          next_attempt_at: new Date(
            Date.now() + (RETRIES_MS[Math.min(attempt - 1, RETRIES_MS.length - 1)] ?? 21_600_000),
          ).toISOString(),
        })
        .eq("id", row.id);

      failed++;
      continue;
    }

    if (webhook.status !== "active" && webhook.status !== "failing") {
      skipped++;
      continue;
    }

    const payload = JSON.stringify({
      id: row.event_id,
      type: event.event_type,
      created_at: new Date().toISOString(),
      data: event.payload,
    });
    const timestamp = Math.floor(Date.now() / 1000).toString();

    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "OmniSocial-Webhooks/1.0",
          "x-omnisocial-event-id": row.event_id,
          "x-omnisocial-event": event.event_type,
          "x-omnisocial-timestamp": timestamp,
          "x-omnisocial-signature": `v1=${signature(webhook.secret, timestamp, payload)}`,
        },
        body: payload,
        signal: AbortSignal.timeout(10_000),
      });

      const text = (await response.text()).slice(0, 4000);
      const attempt = (row.attempt ?? 0) + 1;

      if (response.ok) {
        const { error: markDeliveredError } = await supabase
          .from("socialmedia_webhook_deliveries")
          .update({
            status: "delivered",
            response_status: response.status,
            response_body: text,
            delivered_at: new Date().toISOString(),
            attempt,
          })
          .eq("id", row.id);

        if (markDeliveredError) throw markDeliveredError;

        await supabase
          .from("socialmedia_webhooks")
          .update({
            last_delivery_at: new Date().toISOString(),
            last_success_at: new Date().toISOString(),
            failure_count: 0,
            status: "active",
          })
          .eq("id", row.webhook_id);

        delivered++;
      } else {
        throw new Error(`HTTP ${response.status}: ${text}`);
      }
    } catch (error) {
      const attempt = (row.attempt ?? 0) + 1;
      const terminal = attempt >= MAX_ATTEMPTS;
      const message = error instanceof Error ? error.message : "Webhook delivery failed";

      await supabase
        .from("socialmedia_webhook_deliveries")
        .update({
          status: terminal ? "failed" : "pending",
          response_body: message,
          attempt,
          next_attempt_at: new Date(
            Date.now() + (RETRIES_MS[Math.min(attempt - 1, RETRIES_MS.length - 1)] ?? 21_600_000),
          ).toISOString(),
        })
        .eq("id", row.id);

      await supabase
        .from("socialmedia_webhooks")
        .update({
          last_delivery_at: new Date().toISOString(),
          failure_count: attempt,
          status: terminal ? "failing" : "active",
        })
        .eq("id", row.webhook_id);

      failed++;
    }
  }

  return {
    processed: (deliveries ?? []).length,
    delivered,
    failed,
    skipped,
  };
}
