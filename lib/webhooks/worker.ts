import crypto from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const MAX_ATTEMPTS = 6;
const RETRIES_MS = [60_000, 300_000, 1_800_000, 7_200_000, 21_600_000];

type Delivery = { id: string; attempt: number; event_id: string; webhook_id: string; url: string; secret: string; event_type: string; payload: Record<string, unknown> };

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
  const { data, error } = await supabase
    .from("socialmedia_webhook_deliveries")
    .select("id,attempt,event_id,webhook_id,socialmedia_webhooks!inner(url,secret),socialmedia_webhook_events!inner(event_type,payload)")
    .eq("status", "pending")
    .lte("next_attempt_at", now)
    .order("next_attempt_at", { ascending: true })
    .limit(limit);
  if (error) throw error;

  let delivered = 0; let failed = 0;
  for (const row of data ?? []) {
    const webhook = Array.isArray(row.socialmedia_webhooks) ? row.socialmedia_webhooks[0] : row.socialmedia_webhooks;
    const event = Array.isArray(row.socialmedia_webhook_events) ? row.socialmedia_webhook_events[0] : row.socialmedia_webhook_events;
    if (!webhook || !event) continue;
    const payload = JSON.stringify({ id: row.event_id, type: event.event_type, created_at: new Date().toISOString(), data: event.payload });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    try {
      const response = await fetch(webhook.url, { method: "POST", headers: { "content-type": "application/json", "user-agent": "OmniSocial-Webhooks/1.0", "x-omnisocial-event-id": row.event_id, "x-omnisocial-event": event.event_type, "x-omnisocial-timestamp": timestamp, "x-omnisocial-signature": `v1=${signature(webhook.secret, timestamp, payload)}` }, body: payload, signal: AbortSignal.timeout(10_000) });
      const text = (await response.text()).slice(0, 4000);
      if (response.ok) {
        await supabase.from("socialmedia_webhook_deliveries").update({ status: "delivered", response_status: response.status, response_body: text, delivered_at: new Date().toISOString(), attempt: row.attempt + 1 }).eq("id", row.id);
        await supabase.from("socialmedia_webhooks").update({ last_delivery_at: new Date().toISOString(), last_success_at: new Date().toISOString(), failure_count: 0, status: "active" }).eq("id", row.webhook_id);
        delivered++;
      } else throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      const attempt = row.attempt + 1;
      const terminal = attempt >= MAX_ATTEMPTS;
      await supabase.from("socialmedia_webhook_deliveries").update({ status: terminal ? "failed" : "pending", response_body: error instanceof Error ? error.message : "Webhook delivery failed", attempt, next_attempt_at: new Date(Date.now() + (RETRIES_MS[Math.min(attempt - 1, RETRIES_MS.length - 1)] ?? 21_600_000)).toISOString() }).eq("id", row.id);
      await supabase.from("socialmedia_webhooks").update({ last_delivery_at: new Date().toISOString(), failure_count: (row.attempt ?? 0) + 1, status: terminal ? "failing" : "active" }).eq("id", row.webhook_id);
      failed++;
    }
  }
  return { processed: (data ?? []).length, delivered, failed };
}
