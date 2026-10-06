import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { isWebhookEventType, type WebhookEventType } from "@/lib/webhooks/events";

export async function emitWebhookEvent(profileId: string, eventType: WebhookEventType, payload: Record<string, unknown>) {
  if (!isWebhookEventType(eventType)) return null;
  const admin = createAdminClient();
  const { data: hooks, error: hookError } = await admin
    .from("socialmedia_webhooks")
    .select("id, events, status")
    .eq("profile_id", profileId)
    .in("status", ["active", "failing"]);
  if (hookError) throw hookError;

  const matching = (hooks ?? []).filter((hook) => Array.isArray(hook.events) && hook.events.includes(eventType));
  if (!matching.length) return null;

  const { data: event, error: eventError } = await admin
    .from("socialmedia_webhook_events")
    .insert({ id: randomUUID(), profile_id: profileId, event_type: eventType, payload })
    .select("id")
    .single();
  if (eventError || !event) throw eventError ?? new Error("Unable to create webhook event.");

  const { error: deliveryError } = await admin.from("socialmedia_webhook_deliveries").insert(
    matching.map((hook) => ({ webhook_id: hook.id, event_id: event.id, status: "pending", attempt: 0, next_attempt_at: new Date().toISOString() })),
  );
  if (deliveryError) throw deliveryError;
  return { eventId: event.id, deliveryCount: matching.length };
}
