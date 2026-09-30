"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { signUp } from "@/app/auth/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast-provider";

const initialState = { error: null };
const plans = [
  { code: "starter", name: "Starter", price: "₹999 / $9", members: "Up to 5 members", description: "For individuals and small teams" },
  { code: "pro", name: "Pro", price: "₹1,999 / $19", members: "Up to 20 members", description: "For growing social teams" },
  { code: "premium", name: "Premium", price: "₹2,999 / $29", members: "Up to 50 members", description: "For larger publishing teams" },
] as const;

export function SignUpForm({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  const [state, formAction, isPending] = useActionState(signUp, initialState);
  const { toast } = useToast();
  useEffect(() => { if (state.error) toast({ title: "Sign up failed", message: state.error, variant: "error" }); }, [state, toast]);

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Create your workspace</CardTitle>
          <CardDescription>Choose a starting plan. Billing and Stripe activation will be connected in the billing phase.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction}>
            <div className="flex flex-col gap-5">
              <div className="grid gap-2"><Label htmlFor="displayName">Name</Label><Input id="displayName" name="displayName" placeholder="Your name" autoComplete="name" /></div>
              <div className="grid gap-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" placeholder="m@example.com" autoComplete="email" required /></div>
              <div className="grid gap-2"><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required /></div>
              <div className="grid gap-2"><Label htmlFor="repeat-password">Repeat Password</Label><Input id="repeat-password" name="repeatPassword" type="password" autoComplete="new-password" minLength={8} required /></div>
              <fieldset className="grid gap-3">
                <legend className="text-sm font-medium">Choose your plan</legend>
                <div className="grid gap-3">
                  {plans.map((plan) => (
                    <label key={plan.code} className="group cursor-pointer">
                      <input type="radio" name="plan" value={plan.code} defaultChecked={plan.code === "starter"} className="peer sr-only" />
                      <div className="rounded-2xl border p-4 transition group-hover:border-primary/30 peer-checked:border-primary peer-checked:bg-primary/[0.05] peer-checked:ring-1 peer-checked:ring-primary/20">
                        <div className="flex items-start justify-between gap-3">
                          <div><div className="flex items-center gap-2"><p className="font-semibold">{plan.name}</p>{plan.code === "pro" && <Badge variant="secondary">Popular</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">{plan.description} · {plan.members}</p></div>
                          <p className="shrink-0 text-sm font-semibold">{plan.price}<span className="font-normal text-muted-foreground">/mo</span></p>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </fieldset>
              <Button type="submit" className="w-full" disabled={isPending}>{isPending ? "Creating workspace..." : "Create workspace"}</Button>
            </div>
            <div className="mt-4 text-center text-sm">Already have an account? <Link href="/auth/login" className="underline underline-offset-4">Login</Link></div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
