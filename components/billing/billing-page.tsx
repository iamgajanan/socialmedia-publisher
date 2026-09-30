"use client";

import { useState } from "react";
import { Check, CreditCard, ExternalLink, Loader2, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast-provider";

const plans = [
  { code: "starter", name: "Starter", inr: "₹999", usd: "$9", users: 5, accounts: 10, description: "A simple publishing workspace for individuals and small businesses." },
  { code: "pro", name: "Pro", inr: "₹1,999", usd: "$19", users: 20, accounts: 30, description: "More publishing users and destinations for growing workflows.", popular: true },
  { code: "premium", name: "Premium", inr: "₹2,999", usd: "$29", users: 50, accounts: 100, description: "Built for larger publishing operations with many destinations." },
] as const;

type BillingPageProps = {
  currentPlan: (typeof plans)[number]["code"];
  currentPlanName: string;
  subscriptionStatus: string;
  billingCurrency: "inr" | "usd";
  hasStripeCustomer: boolean;
  stripeConfigured: boolean;
};

export function BillingPage({ currentPlan, currentPlanName, subscriptionStatus, billingCurrency: initialCurrency, hasStripeCustomer, stripeConfigured }: BillingPageProps) {
  const [currency, setCurrency] = useState<"inr" | "usd">(initialCurrency);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const { toast } = useToast();

  async function startCheckout(plan: (typeof plans)[number]["code"]) {
    setLoadingPlan(plan);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, currency }),
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error || "Unable to start checkout.");
      window.location.assign(data.url);
    } catch (error) {
      toast({ title: "Billing unavailable", message: error instanceof Error ? error.message : "Unable to start checkout.", variant: "error" });
      setLoadingPlan(null);
    }
  }

  async function openPortal() {
    setPortalLoading(true);
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error || "Unable to open billing portal.");
      window.location.assign(data.url);
    } catch (error) {
      toast({ title: "Billing portal unavailable", message: error instanceof Error ? error.message : "Unable to open billing portal.", variant: "error" });
      setPortalLoading(false);
    }
  }

  const statusLabel = subscriptionStatus === "active" ? "Active" : subscriptionStatus === "past_due" ? "Payment issue" : subscriptionStatus === "cancelled" ? "Cancelled" : "Not activated";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge variant="secondary" className="rounded-full px-3 py-1"><CreditCard className="mr-1.5 size-3.5" />Billing</Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Choose your publishing plan.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Unlimited publishing on every paid plan. Your plan controls publishing users and connected social accounts, while platform limits still apply.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border bg-card p-1">
          <button type="button" onClick={() => setCurrency("inr")} className={`rounded-lg px-3 py-2 text-sm font-medium transition ${currency === "inr" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>₹ INR</button>
          <button type="button" onClick={() => setCurrency("usd")} className={`rounded-lg px-3 py-2 text-sm font-medium transition ${currency === "usd" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>$ USD</button>
        </div>
      </div>

      <Card className="overflow-hidden border-primary/20 bg-primary/[0.04] shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Current workspace</p>
            <div className="mt-2 flex flex-wrap items-center gap-2"><p className="font-semibold">{currentPlanName}</p><Badge variant="secondary">{statusLabel}</Badge></div>
          </div>
          {hasStripeCustomer && <Button variant="outline" onClick={openPortal} disabled={portalLoading}>{portalLoading ? <Loader2 className="animate-spin" /> : <ExternalLink />}Manage billing</Button>}
        </CardContent>
      </Card>

      {!stripeConfigured && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
          Stripe checkout is not configured on this deployment yet. The pricing UI is live, but checkout will remain disabled until the Stripe server key and six recurring price IDs are added to the server environment.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {plans.map((plan) => {
          const selected = currentPlan === plan.code;
          const loading = loadingPlan === plan.code;
          return (
            <Card key={plan.code} className={`relative overflow-hidden transition hover:-translate-y-1 hover:shadow-lg ${plan.popular ? "border-primary/45 shadow-primary/10" : ""}`}>
              {plan.popular && <div className="absolute right-5 top-5 rounded-full bg-primary px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">Popular</div>}
              <CardHeader><CardTitle>{plan.name}</CardTitle><CardDescription className="min-h-12">{plan.description}</CardDescription></CardHeader>
              <CardContent>
                <div className="flex items-end gap-1"><span className="text-4xl font-semibold tracking-tight">{currency === "inr" ? plan.inr : plan.usd}</span><span className="pb-1 text-sm text-muted-foreground">/ month</span></div>
                <div className="my-6 h-px bg-border" />
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-2"><Check className="size-4 text-primary" />Unlimited publishing</li>
                  <li className="flex items-center gap-2"><Check className="size-4 text-primary" />{plan.users} publishing users</li>
                  <li className="flex items-center gap-2"><Check className="size-4 text-primary" />{plan.accounts} social accounts</li>
                  <li className="flex items-center gap-2"><Check className="size-4 text-primary" />Scheduling & post history</li>
                </ul>
                <Button className="mt-7 w-full" variant={selected ? "outline" : plan.popular ? "default" : "outline"} disabled={loading || !stripeConfigured || selected} onClick={() => startCheckout(plan.code)}>
                  {loading ? <><Loader2 className="animate-spin" />Opening checkout...</> : selected ? "Current plan" : <><Sparkles />Choose {plan.name}</>}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-xs leading-5 text-muted-foreground">Checkout is hosted by Stripe. OmniSocial never handles or stores card details. Subscription state is confirmed server-side from Stripe webhooks.</p>
    </div>
  );
}
