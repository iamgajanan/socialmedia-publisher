import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: webhook } = await supabase.from("socialmedia_webhooks").select("id").eq("id", id).eq("profile_id", user.id).maybeSingle();
  if (!webhook) return NextResponse.json({ error: "Webhook not found." }, { status: 404 });
  const { data: eventId, error } = await supabase.rpc("socialmedia_record_webhook_event", {
    p_profile_id: user.id,
    p_event_type: "post.created",
    p_aggregate_type: "test",
    p_aggregate_id: null,
    p_payload: { test: true, message: "OmniSocial webhook test event" },
  });
  if (error) return NextResponse.json({ error: "Unable to queue webhook test." }, { status: 500 });
  return NextResponse.json({ ok: true, event_id: eventId });
}
