import { NextResponse } from "next/server";

import { requireWorkspaceAdmin } from "@/lib/workspace/server";
import { createStripePortalSession } from "@/lib/stripe";

function getOrigin(request: Request) {
  const configured = process.env.SITE_URL?.trim();
  if (configured) return new URL(configured).origin;
  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  try {
    const context = await requireWorkspaceAdmin();
    const customerId = context.workspace.stripe_customer_id;
    if (!customerId) return NextResponse.json({ error: "No Stripe billing account exists yet. Choose a plan first." }, { status: 400 });

    const session = await createStripePortalSession({
      customerId,
      returnUrl: `${getOrigin(request)}/billing`,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to open Stripe Billing Portal.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
