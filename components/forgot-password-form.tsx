"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { requestPasswordReset } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast-provider";

const initialState = { error: null };

export function ForgotPasswordForm({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  const [state, formAction, isPending] = useActionState(requestPasswordReset, initialState);
  const { toast } = useToast();
  useEffect(() => {
    if (state.error) toast({ title: "Password reset failed", message: state.error, variant: "error" });
  }, [state, toast]);
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card><CardHeader><CardTitle className="text-2xl">Reset Your Password</CardTitle><CardDescription>Type in your email and we&apos;ll send you a reset link.</CardDescription></CardHeader>
        <CardContent><form action={formAction}><div className="flex flex-col gap-6">
          <div className="grid gap-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" placeholder="m@example.com" required /></div>
          {!state.error && <p className="text-sm text-muted-foreground">If the account exists, you will receive password reset instructions.</p>}
          <Button type="submit" className="w-full" disabled={isPending}>{isPending ? "Sending..." : "Send reset email"}</Button>
        </div><div className="mt-4 text-center text-sm">Already have an account? <Link href="/auth/login" className="underline underline-offset-4">Login</Link></div></form></CardContent>
      </Card>
    </div>
  );
}
