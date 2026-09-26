"use client";

import { useActionState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { signUp } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState = { error: null };

export function SignUpForm({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  const [state, formAction, isPending] = useActionState(signUp, initialState);
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card><CardHeader><CardTitle className="text-2xl">Sign up</CardTitle><CardDescription>Create your OmniSocial workspace</CardDescription></CardHeader>
        <CardContent><form action={formAction}><div className="flex flex-col gap-6">
          <div className="grid gap-2"><Label htmlFor="displayName">Name</Label><Input id="displayName" name="displayName" placeholder="Your name" autoComplete="name" /></div>
          <div className="grid gap-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" placeholder="m@example.com" autoComplete="email" required /></div>
          <div className="grid gap-2"><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" autoComplete="new-password" minLength={6} required /></div>
          <div className="grid gap-2"><Label htmlFor="repeat-password">Repeat Password</Label><Input id="repeat-password" name="repeatPassword" type="password" autoComplete="new-password" minLength={6} required /></div>
          {state.error && <p className="text-sm text-red-500">{state.error}</p>}
          <Button type="submit" className="w-full" disabled={isPending}>{isPending ? "Creating an account..." : "Sign up"}</Button>
        </div><div className="mt-4 text-center text-sm">Already have an account? <Link href="/auth/login" className="underline underline-offset-4">Login</Link></div></form></CardContent>
      </Card>
    </div>
  );
}
