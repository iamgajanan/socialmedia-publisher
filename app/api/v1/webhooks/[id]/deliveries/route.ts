import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: webhook } = await supabase.from("socialmedia_webhooks").select("id").eq("id", id).eq("profile_id", user.id).maybeSingle();
  if (!webhook) return NextResponse.json({ error: "Webhook not found." }, { status: 404 });
  const { data, error } = await supabase.from("socialmedia_webhook_deliveries").select("id,event_id,status,attempt,response_status,response_body,next_attempt_at,delivered_at,created_at,socialmedia_webhook_events!inner(event_type,payload,created_at)").eq("webhook_id", id).order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: "Unable to load delivery logs." }, { status: 500 });
  return NextResponse.json({ deliveries: data ?? [] });
}
