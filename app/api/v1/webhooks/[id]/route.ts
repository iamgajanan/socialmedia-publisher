import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isWebhookEventType } from "@/lib/webhooks/events";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { error } = await supabase.from("socialmedia_webhooks").delete().eq("id", id).eq("profile_id", user.id);
  if (error) return NextResponse.json({ error: "Unable to delete webhook." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { url?: string; events?: string[]; description?: string; status?: string } | null;
  const patch: Record<string, unknown> = {};
  if (body?.url !== undefined) {
    try { if (new URL(body.url).protocol !== "https:") throw new Error(); } catch { return NextResponse.json({ error: "Webhook URL must be a valid HTTPS URL." }, { status: 400 }); }
    patch.url = body.url.trim();
  }
  if (body?.events !== undefined) {
    const events = Array.isArray(body.events) ? [...new Set(body.events)] : [];
    if (events.some((event) => typeof event !== "string" || !isWebhookEventType(event))) return NextResponse.json({ error: "One or more webhook events are unsupported." }, { status: 400 });
    patch.events = events;
  }
  if (body?.description !== undefined) patch.description = body.description?.trim() || null;
  if (body?.status !== undefined) {
    if (!["active","disabled"].includes(body.status)) return NextResponse.json({ error: "Invalid webhook status." }, { status: 400 });
    patch.status = body.status;
  }
  const { data, error } = await supabase.from("socialmedia_webhooks").update(patch).eq("id", id).eq("profile_id", user.id).select("id,url,status,events,description,created_at,updated_at,last_delivery_at,last_success_at,failure_count").single();
  if (error) return NextResponse.json({ error: "Unable to update webhook." }, { status: 500 });
  return NextResponse.json({ webhook: data });
}
