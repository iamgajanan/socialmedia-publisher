"use client";

import { Loader2, Plus, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { CreatePublishingUserState } from "@/app/users/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: CreatePublishingUserState = {};

function PendingFeedback() {
  const { pending } = useFormStatus();
  if (!pending) return null;

  return (
    <div className="grid gap-3 rounded-2xl border border-primary/10 bg-muted/20 p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center" role="status" aria-live="polite">
      <div className="size-10 animate-pulse rounded-xl bg-muted" />
      <div className="space-y-2">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-3 w-56 max-w-full animate-pulse rounded bg-muted" />
      </div>
      <div className="h-9 w-28 animate-pulse rounded-lg bg-muted" />
      <span className="sr-only">Creating your publishing user. Your new user card will appear when creation finishes.</span>
    </div>
  );
}

function CreateButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <Plus />}
      {pending ? "Creating user…" : "Create user"}
    </Button>
  );
}

function FormFeedback({ state }: { state: CreatePublishingUserState }) {
  if (!state.error) return null;

  return (
    <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4" role="alert">
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{state.limitReached ? "Publishing user limit reached" : "Unable to create publishing user"}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{state.error}</p>
          {state.limitReached ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button asChild size="sm">
                <Link href="/billing">View plans</Link>
              </Button>
              <Badge variant="secondary">Current plan: {state.planName}</Badge>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function CreateUserForm({ action }: { action: (previousState: CreatePublishingUserState, formData: FormData) => Promise<CreatePublishingUserState> }) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          name="name"
          required
          placeholder="e.g. OmniSocial, Gajanan, Client A"
          aria-label="Publishing user name"
          autoComplete="organization"
          className="sm:max-w-md"
        />
        <CreateButton />
      </div>
      <FormFeedback state={state} />
      <PendingFeedback />
    </form>
  );
}
