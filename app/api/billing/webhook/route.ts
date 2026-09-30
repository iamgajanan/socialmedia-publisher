import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getStripePlanByPriceId } from "@/lib/stripe";

export const runtime = "nodejs";

function verifyStripeSignature(payload: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const parts = signature.split(",");
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0) return false;

  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestampNumber) > 300) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const expected = createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return signatures.some((candidate) => {
    const candidateBuffer = Buffer.from(candidate, "utf8");
    return candidateBuffer.length === expectedBuffer.length && timingSafeEqual(candidateBuffer, expectedBuffer);
  });
}

function mapSubscriptionStatus(status: string | undefined) {
  if (status === "active") return "active" as const;
  if (status === "trialing") return "trialing" as const;
  if (status === "past_due") return "past_due" as const;
  if (status === "incomplete") return "incomplete" as const;
  return "cancelled" as const;
}

async function updateWorkspaceById(input: {
  workspaceId: string;
  customerId?: string | null;
  subscriptionId?: string | null;
  subscriptionStatus?: string;
  priceId?: string | null;
  currency?: string | null;
  currentPeriodEnd?: number | null;
}) {
  const admin = createAdminClient();
  const planCode = getStripePlanByPriceId(input.priceId);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.customerId) patch.stripe_customer_id = input.customerId;
  if (input.subscriptionId !== undefined) patch.stripe_subscription_id = input.subscriptionId;
  if (input.subscriptionStatus) patch.subscription_status = mapSubscriptionStatus(input.subscriptionStatus);
  if (input.priceId !== undefined) patch.stripe_price_id = input.priceId;
  if (input.currency !== undefined) patch.stripe_billing_currency = input.currency;
  if (input.currentPeriodEnd !== undefined) patch.stripe_current_period_end = input.currentPeriodEnd ? new Date(input.currentPeriodEnd * 1000).toISOString() : null;

  if (planCode) {
    const { data: plan, error: planError } = await admin.from("socialmedia_plans").select("id").eq("code", planCode).single();
    if (planError) throw new Error(planError.message);
    patch.plan_id = plan.id;
  }

  const { error } = await admin.from("socialmedia_workspaces").update(patch).eq("id", input.workspaceId);
  if (error) throw new Error(error.message);
}

async function updateWorkspaceByCustomer(input: Parameters<typeof updateWorkspaceById>[0] & { customerId: string }) {
  const admin = createAdminClient();
  const { data: workspace, error } = await admin.from("socialmedia_workspaces").select("id").eq("stripe_customer_id", input.customerId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!workspace) return;
  await updateWorkspaceById({ ...input, workspaceId: workspace.id });
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 500 });

  const payload = await request.text();
  if (!verifyStripeSignature(payload, request.headers.get("stripe-signature"), webhookSecret)) {
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  try {
    const event = JSON.parse(payload) as { type: string; data?: { object?: Record<string, unknown> } };
    const object = event.data?.object ?? {};

    switch (event.type) {
      case "checkout.session.completed": {
        const metadata = (object.metadata ?? {}) as Record<string, string>;
        const workspaceId = metadata.workspace_id;
        if (workspaceId) {
          await updateWorkspaceById({
            workspaceId,
            customerId: typeof object.customer === "string" ? object.customer : null,
            subscriptionId: typeof object.subscription === "string" ? object.subscription : null,
            subscriptionStatus: "active",
            priceId: null,
            currency: metadata.currency ?? null,
          });
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const metadata = (object.metadata ?? {}) as Record<string, string>;
        const items = (object.items as { data?: Array<{ price?: { id?: string; currency?: string } }> } | undefined)?.data ?? [];
        const priceId = items[0]?.price?.id ?? null;
        const currency = items[0]?.price?.currency ?? null;
        const customerId = typeof object.customer === "string" ? object.customer : null;
        const input = {
          workspaceId: metadata.workspace_id,
          customerId,
          subscriptionId: typeof object.id === "string" ? object.id : null,
          subscriptionStatus: typeof object.status === "string" ? object.status : undefined,
          priceId,
          currency,
          currentPeriodEnd: typeof object.current_period_end === "number" ? object.current_period_end : null,
        };
        if (input.workspaceId) await updateWorkspaceById(input);
        else if (customerId) await updateWorkspaceByCustomer({ ...input, customerId });
        break;
      }
      case "customer.subscription.deleted": {
        const customerId = typeof object.customer === "string" ? object.customer : null;
        const metadata = (object.metadata ?? {}) as Record<string, string>;
        const workspaceId = metadata.workspace_id;
        if (workspaceId) await updateWorkspaceById({ workspaceId, customerId, subscriptionId: null, subscriptionStatus: "cancelled" });
        else if (customerId) await updateWorkspaceByCustomer({ workspaceId: "", customerId, subscriptionStatus: "cancelled", subscriptionId: null });
        break;
      }
      case "invoice.payment_failed": {
        const customerId = typeof object.customer === "string" ? object.customer : null;
        if (customerId) await updateWorkspaceByCustomer({ workspaceId: "", customerId, subscriptionStatus: "past_due" });
        break;
      }
      case "invoice.paid": {
        const customerId = typeof object.customer === "string" ? object.customer : null;
        if (customerId) await updateWorkspaceByCustomer({ workspaceId: "", customerId, subscriptionStatus: "active" });
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
