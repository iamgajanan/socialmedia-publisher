import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: webhook } = await supabase
    .from("socialmedia_webhooks")
    .select("id,events,status")
    .eq("id", id)
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!webhook) return NextResponse.json({ error: "Webhook not found." }, { status: 404 });
  if (webhook.status !== "active") {
    return NextResponse.json({ error: "Webhook is not active." }, { status: 409 });
  }

  // Event/delivery tables intentionally do not expose INSERT policies to browser
  // sessions. The test endpoint is a server-side action, so use the admin client
  // after verifying that the webhook belongs to the authenticated profile above.
  const admin = createAdminClient();
  const { data: event, error: eventError } = await admin
    .from("socialmedia_webhook_events")
    .insert({
      profile_id: user.id,
      event_type: "post.created",
      payload: {
        test: true,
        message: "OmniSocial webhook test event",
        webhook_id: id,
      },
    })
    .select("id")
    .single();

  if (eventError || !event) {
    console.error("webhook_test_event_queue_failed", {
      webhookId: id,
      profileId: user.id,
      code: eventError?.code,
      message: eventError?.message,
    });
    return NextResponse.json({ error: "Unable to queue webhook test." }, { status: 500 });
  }

  const { error: deliveryError } = await admin
    .from("socialmedia_webhook_deliveries")
    .insert({ webhook_id: id, event_id: event.id });

  if (deliveryError) {
    console.error("webhook_test_delivery_queue_failed", {
      webhookId: id,
      eventId: event.id,
      code: deliveryError.code,
      message: deliveryError.message,
    });
    await admin.from("socialmedia_webhook_events").delete().eq("id", event.id);
    return NextResponse.json({ error: "Unable to queue webhook test delivery." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, event_id: event.id });
}
