import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { WEBHOOK_EVENTS, isWebhookEventType } from "@/lib/webhooks/events";

function validUrl(value: string) {
  try { const url = new URL(value); return url.protocol === "https:"; } catch { return false; }
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase.from("socialmedia_webhooks").select("id,url,status,events,description,created_at,updated_at,last_delivery_at,last_success_at,failure_count").eq("profile_id", user.id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Unable to load webhooks." }, { status: 500 });
  return NextResponse.json({ webhooks: data ?? [], supported_events: WEBHOOK_EVENTS });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { url?: string; events?: string[]; description?: string } | null;
  const url = body?.url?.trim() ?? "";
  const events = Array.isArray(body?.events) ? [...new Set(body.events)] : [];
  if (!validUrl(url)) return NextResponse.json({ error: "Webhook URL must be a valid HTTPS URL." }, { status: 400 });
  if (events.some((event) => typeof event !== "string" || !isWebhookEventType(event))) return NextResponse.json({ error: "One or more webhook events are unsupported." }, { status: 400 });
  const secret = `whsec_${randomBytes(24).toString("hex")}`;
  const { data, error } = await supabase.from("socialmedia_webhooks").insert({ profile_id: user.id, url, secret, events, description: body?.description?.trim() || null }).select("id,url,status,events,description,created_at").single();
  if (error) return NextResponse.json({ error: "Unable to create webhook." }, { status: 500 });
  return NextResponse.json({ webhook: data, secret, warning: "Store this secret now. It is only returned at creation time." }, { status: 201 });
}
