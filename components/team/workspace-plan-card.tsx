import { Check, Crown, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkspacePlan } from "@/lib/workspace/server";

const icons = { starter: Users, pro: Crown, premium: Crown } as const;

export function WorkspacePlanCard({ plan, memberCount }: { plan: WorkspacePlan; memberCount: number }) {
  const Icon = icons[plan.code];
  const percentage = Math.min(100, Math.round((memberCount / plan.max_team_members) * 100));

  return (
    <Card className="overflow-hidden border-primary/15 bg-primary/[0.03] shadow-sm">
      <CardHeader className="flex-row items-start justify-between space-y-0 border-b bg-background/60">
        <div>
          <div className="flex items-center gap-2"><Badge className="capitalize">{plan.name}</Badge><span className="text-xs text-muted-foreground">Current plan</span></div>
          <CardTitle className="mt-2 text-lg">Workspace capacity</CardTitle>
        </div>
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></div>
      </CardHeader>
      <CardContent className="grid gap-5 p-5 sm:grid-cols-3">
        <div><p className="text-xs text-muted-foreground">Monthly price</p><p className="mt-1 text-lg font-semibold">₹{plan.monthly_price_inr.toLocaleString("en-IN")} <span className="text-xs font-normal text-muted-foreground">/ $ {plan.monthly_price_usd} /mo</span></p></div>
        <div><div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Team members</span><span className="font-medium">{memberCount}/{plan.max_team_members}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percentage}%` }} /></div></div>
        <div className="space-y-2 text-xs text-muted-foreground"><p className="flex items-center gap-2"><Check className="size-3.5 text-primary" />{plan.max_social_accounts} connected accounts</p><p className="flex items-center gap-2"><Check className="size-3.5 text-primary" />{plan.monthly_post_limit.toLocaleString("en-IN")} posts/month</p></div>
      </CardContent>
    </Card>
  );
}
