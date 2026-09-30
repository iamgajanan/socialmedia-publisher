import { NextResponse } from "next/server";
import { z } from "zod";

import { requireWorkspaceAdmin } from "@/lib/workspace/server";
import { createStripeCheckoutSession, createStripeCustomer, getStripePriceId } from "@/lib/stripe";

const schema = z.object({
  plan: z.enum(["starter", "pro", "premium"]),
});

function getOrigin(request: Request) {
  const configured = process.env.SITE_URL?.trim();
  if (configured) return new URL(configured).origin;
  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  try {
    const context = await requireWorkspaceAdmin();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Choose a valid plan." }, { status: 400 });

    const { plan } = parsed.data;
    const priceId = getStripePriceId(plan);
    const origin = getOrigin(request);
    let customerId = context.workspace.stripe_customer_id;
    const { data: user } = await context.supabase.auth.getUser();
    const email = user.user?.email?.trim();
    if (!email) return NextResponse.json({ error: "Your account email is required for billing." }, { status: 400 });

    if (!customerId) {
      const customer = await createStripeCustomer({
        email,
        name: context.workspace.name,
        workspaceId: context.workspace.id,
      });
      customerId = customer.id;
      const { error } = await context.supabase
        .from("socialmedia_workspaces")
        .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
        .eq("id", context.workspace.id);
      if (error) throw new Error(error.message);
    }

    const session = await createStripeCheckoutSession({
      customerId,
      priceId,
      workspaceId: context.workspace.id,
      plan,
      successUrl: `${origin}/billing?checkout=success`,
      cancelUrl: `${origin}/billing?checkout=cancelled`,
    });

    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    const { error: sessionError } = await context.supabase
      .from("socialmedia_workspaces")
      .update({ stripe_checkout_session_id: session.id, stripe_price_id: priceId, stripe_billing_currency: "usd", updated_at: new Date().toISOString() })
      .eq("id", context.workspace.id);
    if (sessionError) throw new Error(sessionError.message);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start Stripe Checkout.";
    const status = /login|member|workspace/i.test(message) ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
