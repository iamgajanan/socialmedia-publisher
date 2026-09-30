import { getCurrentWorkspace } from "@/lib/workspace/server";
import { BillingPage } from "@/components/billing/billing-page";

export const dynamic = "force-dynamic";

export default async function BillingRoute() {
  const context = await getCurrentWorkspace();
  return (
    <BillingPage
      currentPlan={context.plan.code}
      currentPlanName={context.plan.name}
      subscriptionStatus={context.workspace.subscription_status}
      billingCurrency={(context.workspace.stripe_billing_currency as "inr" | "usd" | null) ?? "inr"}
      hasStripeCustomer={Boolean(context.workspace.stripe_customer_id)}
      stripeConfigured={Boolean(
        process.env.STRIPE_SECRET_KEY &&
        process.env.STRIPE_PRICE_STARTER_INR &&
        process.env.STRIPE_PRICE_STARTER_USD &&
        process.env.STRIPE_PRICE_PRO_INR &&
        process.env.STRIPE_PRICE_PRO_USD &&
        process.env.STRIPE_PRICE_PREMIUM_INR &&
        process.env.STRIPE_PRICE_PREMIUM_USD,
      )}
    />
  );
}
