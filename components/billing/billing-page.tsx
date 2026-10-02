"use client";

import { useEffect, useState } from "react";
import { Check, CreditCard, ExternalLink, Loader2, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast-provider";

const plans = [
  { code: "free", name: "Free", usd: "$0", users: 1, accounts: 10, posts: "10 posts / rolling month", description: "Try OmniSocial with one publishing user.", popular: false },
  { code: "starter", name: "Starter", usd: "$9", users: 5, accounts: 10, posts: "Unlimited posts", description: "A simple publishing workspace for individuals and small businesses.", popular: false },
  { code: "pro", name: "Pro", usd: "$19", users: 20, accounts: 30, posts: "Unlimited posts", description: "More publishing users and destinations for growing workflows.", popular: true },
  { code: "premium", name: "Premium", usd: "$29", users: 50, accounts: 100, posts: "Unlimited posts", description: "Built for larger publishing operations with many destinations.", popular: false },
] as const;

type BillingPageProps = {
  currentPlan: (typeof plans)[number]["code"];
  currentPlanName: string;
  subscriptionStatus: string;
  hasStripeCustomer: boolean;
  stripeConfigured: boolean;
  checkoutResult?: "success" | "cancelled";
};

export function BillingPage({ currentPlan, currentPlanName, subscriptionStatus, hasStripeCustomer, stripeConfigured, checkoutResult }: BillingPageProps) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (checkoutResult === "success") toast({ title: "Checkout completed", message: "Stripe is confirming your subscription. Your plan will update as soon as the webhook is processed.", variant: "success" });
    if (checkoutResult === "cancelled") toast({ title: "Checkout cancelled", message: "No subscription changes were made.", variant: "error" });
  }, [checkoutResult, toast]);

  async function startCheckout(plan: Exclude<(typeof plans)[number]["code"], "free">) {
    setLoadingPlan(plan);
    try {
      const response = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
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

  const statusLabel = subscriptionStatus === "active" ? "Active" : subscriptionStatus === "past_due" ? "Payment issue" : subscriptionStatus === "cancelled" ? "Cancelled" : currentPlan === "free" ? "Free" : "Not activated";

  return (
    <div className="space-y-8">
      <div>
        <Badge variant="secondary" className="rounded-full px-3 py-1"><CreditCard className="mr-1.5 size-3.5" />Billing</Badge>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Choose your publishing plan.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">The Free plan includes 10 posts per rolling month and one publishing user. Paid plans unlock unlimited publishing and larger workspace limits.</p>
      </div>

      {checkoutResult === "success" && <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 text-sm"><Check className="mt-0.5 size-4 text-emerald-600" /><div><p className="font-medium">Payment completed.</p><p className="mt-1 text-muted-foreground">We are waiting for Stripe to confirm the subscription webhook. Refresh this page in a moment if the status has not updated.</p></div></div>}
      {checkoutResult === "cancelled" && <div className="rounded-2xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">Checkout was cancelled. No subscription changes were made.</div>}

      <Card className="overflow-hidden border-primary/20 bg-primary/[0.04] shadow-sm"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Current workspace</p><div className="mt-2 flex flex-wrap items-center gap-2"><p className="font-semibold">{currentPlanName}</p><Badge variant="secondary">{statusLabel}</Badge></div></div>{hasStripeCustomer && <Button variant="outline" onClick={openPortal} disabled={portalLoading}>{portalLoading ? <Loader2 className="animate-spin" /> : <ExternalLink />}Manage billing</Button>}</CardContent></Card>

      {!stripeConfigured && <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">Stripe checkout is not configured on this deployment yet. The pricing UI is live, but checkout will remain disabled until the Stripe server key and three USD recurring price IDs are added to the server environment.</div>}

      <div className="grid gap-5 lg:grid-cols-4">{plans.map((plan) => {
        const selected = currentPlan === plan.code;
        const loading = loadingPlan === plan.code;
        const isFree = plan.code === "free";
        return <Card key={plan.code} className={`relative overflow-hidden transition hover:-translate-y-1 hover:shadow-lg ${plan.popular ? "border-primary/45 shadow-primary/10" : ""}`}>{plan.popular && <div className="absolute right-5 top-5 rounded-full bg-primary px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">Popular</div>}<CardHeader><CardTitle>{plan.name}</CardTitle><CardDescription className="min-h-12">{plan.description}</CardDescription></CardHeader><CardContent><div className="flex items-end gap-1"><span className="text-4xl font-semibold tracking-tight">{plan.usd}</span><span className="pb-1 text-sm text-muted-foreground">/ month</span></div><div className="my-6 h-px bg-border" /><ul className="space-y-3 text-sm"><li className="flex items-center gap-2"><Check className="size-4 text-primary" />{plan.posts}</li><li className="flex items-center gap-2"><Check className="size-4 text-primary" />{plan.users} publishing user{plan.users === 1 ? "" : "s"}</li><li className="flex items-center gap-2"><Check className="size-4 text-primary" />{plan.accounts} social accounts</li><li className="flex items-center gap-2"><Check className="size-4 text-primary" />Scheduling & post history</li></ul><Button className="mt-7 w-full" variant={selected ? "outline" : plan.popular ? "default" : "outline"} disabled={loading || selected || isFree || !stripeConfigured} onClick={() => !isFree && startCheckout(plan.code as Exclude<(typeof plans)[number]["code"], "free">)}>{loading ? <><Loader2 className="animate-spin" />Opening checkout...</> : selected ? "Current plan" : isFree ? "Included" : <><Sparkles />Choose {plan.name}</>}</Button></CardContent></Card>;
      })}</div>

      <p className="text-center text-xs leading-5 text-muted-foreground">Prices are shown in USD. Checkout is hosted by Stripe. OmniSocial never handles or stores card details. Indian payment methods can be added later with Razorpay.</p>
    </div>
  );
}
