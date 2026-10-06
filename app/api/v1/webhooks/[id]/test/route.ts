import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: webhook } = await supabase.from("socialmedia_webhooks").select("id,events").eq("id", id).eq("profile_id", user.id).maybeSingle();
  if (!webhook) return NextResponse.json({ error: "Webhook not found." }, { status: 404 });
  const { data: event, error: eventError } = await supabase.from("socialmedia_webhook_events").insert({ profile_id: user.id, event_type: "post.created", aggregate_type: "test", payload: { test: true, message: "OmniSocial webhook test event" } }).select("id").single();
  if (eventError || !event) return NextResponse.json({ error: "Unable to queue webhook test." }, { status: 500 });
  const { error } = await supabase.from("socialmedia_webhook_deliveries").insert({ webhook_id: id, event_id: event.id });
  if (error) return NextResponse.json({ error: "Unable to queue webhook test delivery." }, { status: 500 });
  return NextResponse.json({ ok: true, event_id: event.id });
}
