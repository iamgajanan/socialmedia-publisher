import { Buffer } from "node:buffer";

const STRIPE_API_BASE = "https://api.stripe.com/v1";

export type StripeCustomer = {
  id: string;
};

export type StripeCheckoutSession = {
  id: string;
  url: string | null;
  customer: string | null;
  subscription: string | null;
};

export type StripePortalSession = {
  id: string;
  url: string;
};

function getSecretKey() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("Stripe billing is not configured yet. Add STRIPE_SECRET_KEY.");
  return key;
}

export function getStripePriceId(plan: "starter" | "pro" | "premium") {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_USD` as const;
  const priceId = process.env[key]?.trim();
  if (!priceId) throw new Error(`Stripe price is not configured for ${plan} (USD). Add ${key}.`);
  return priceId;
}

export function getStripePlanByPriceId(priceId: string | null | undefined) {
  if (!priceId) return null;
  const prices: Record<string, "starter" | "pro" | "premium"> = {};
  for (const plan of ["starter", "pro", "premium"] as const) {
    const id = process.env[`STRIPE_PRICE_${plan.toUpperCase()}_USD`]?.trim();
    if (id) prices[id] = plan;
  }
  return prices[priceId] ?? null;
}

async function stripeRequest<T>(path: string, body?: URLSearchParams, idempotencyKey?: string): Promise<T> {
  const secretKey = getSecretKey();
  const headers: Record<string, string> = {
    Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
  };
  if (body) headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers,
    body,
    cache: "no-store",
  });
  const data = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message || "Stripe request failed.");
  return data;
}

export function createStripeCustomer(input: { email: string; name: string; workspaceId: string }) {
  const body = new URLSearchParams();
  body.set("email", input.email);
  body.set("name", input.name);
  body.set("metadata[workspace_id]", input.workspaceId);
  return stripeRequest<StripeCustomer>("/customers", body, `workspace-customer-${input.workspaceId}`);
}

export function createStripeCheckoutSession(input: {
  customerId: string;
  priceId: string;
  workspaceId: string;
  plan: "starter" | "pro" | "premium";
  successUrl: string;
  cancelUrl: string;
}) {
  const body = new URLSearchParams();
  body.set("mode", "subscription");
  body.set("customer", input.customerId);
  body.set("line_items[0][price]", input.priceId);
  body.set("line_items[0][quantity]", "1");
  body.set("success_url", input.successUrl);
  body.set("cancel_url", input.cancelUrl);
  body.set("client_reference_id", input.workspaceId);
  body.set("allow_promotion_codes", "true");
  body.set("subscription_data[metadata][workspace_id]", input.workspaceId);
  body.set("subscription_data[metadata][plan]", input.plan);
  body.set("subscription_data[metadata][currency]", "usd");
  body.set("metadata[workspace_id]", input.workspaceId);
  body.set("metadata[plan]", input.plan);
  body.set("metadata[currency]", "usd");
  return stripeRequest<StripeCheckoutSession>("/checkout/sessions", body);
}

export function createStripePortalSession(input: { customerId: string; returnUrl: string }) {
  const body = new URLSearchParams();
  body.set("customer", input.customerId);
  body.set("return_url", input.returnUrl);
  return stripeRequest<StripePortalSession>("/billing_portal/sessions", body);
}
