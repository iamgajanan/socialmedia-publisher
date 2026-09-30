import { BillingPage } from "@/components/billing/billing-page";
import { getCurrentWorkspace } from "@/lib/workspace/server";

export const dynamic = "force-dynamic";

type BillingRouteProps = {
  searchParams: Promise<{ checkout?: string }>;
};

export default async function BillingRoute({ searchParams }: BillingRouteProps) {
  const [context, params] = await Promise.all([getCurrentWorkspace(), searchParams]);
  const checkoutResult = params.checkout === "success" || params.checkout === "cancelled" ? params.checkout : undefined;

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
      checkoutResult={checkoutResult}
    />
  );
}
