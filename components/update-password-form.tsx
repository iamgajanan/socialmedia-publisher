"use client";

import { useActionState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { updatePassword } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast-provider";

const initialState = { error: null };

export function UpdatePasswordForm({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  const [state, formAction, isPending] = useActionState(updatePassword, initialState);
  const { toast } = useToast();
  useEffect(() => {
    if (state.error) toast({ title: "Password update failed", message: state.error, variant: "error" });
  }, [state, toast]);
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card><CardHeader><CardTitle className="text-2xl">Reset Your Password</CardTitle><CardDescription>Please enter your new password below.</CardDescription></CardHeader>
        <CardContent><form action={formAction}><div className="flex flex-col gap-6">
          <div className="grid gap-2"><Label htmlFor="password">New password</Label><Input id="password" name="password" type="password" placeholder="New password" minLength={6} required /></div>
          <Button type="submit" className="w-full" disabled={isPending}>{isPending ? "Saving..." : "Save new password"}</Button>
        </div></form></CardContent>
      </Card>
    </div>
  );
}
