"use client";

import { Loader2, Plus } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

export function CreateUserForm({ action }: { action: (formData: FormData) => void | Promise<void> }) {
  return (
    <form action={action} className="space-y-4">
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
      <PendingFeedback />
    </form>
  );
}
