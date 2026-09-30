import { NextResponse } from "next/server";
import { z } from "zod";

import { requireWorkspaceAdmin } from "@/lib/workspace/server";
import { createStripeCheckoutSession, createStripeCustomer, getStripePriceId } from "@/lib/stripe";

const schema = z.object({
  plan: z.enum(["starter", "pro", "premium"]),
  currency: z.enum(["inr", "usd"]),
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
    if (!parsed.success) return NextResponse.json({ error: "Choose a valid plan and currency." }, { status: 400 });

    const { plan, currency } = parsed.data;
    const priceId = getStripePriceId(plan, currency);
    const origin = getOrigin(request);
    let customerId = context.workspace.stripe_customer_id;

    if (!customerId) {
      const customer = await createStripeCustomer({
        email: String(context.supabase.auth.getUser ? (await context.supabase.auth.getUser()).data.user?.email ?? "" : ""),
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
      currency,
      successUrl: `${origin}/billing?checkout=success`,
      cancelUrl: `${origin}/billing?checkout=cancelled`,
    });

    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start Stripe Checkout.";
    const status = /login|member|workspace/i.test(message) ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
