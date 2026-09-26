"use client";

import { useActionState } from "react";
import { Check, Loader2 } from "lucide-react";

import { reschedulePost, type RescheduleState } from "@/app/schedule/actions";
import { Button } from "@/components/ui/button";

const initialState: RescheduleState = { ok: false, message: "" };

export function RescheduleForm({ postId, scheduledAt, timezone }: { postId: string; scheduledAt: string; timezone: string }) {
  const [state, formAction, pending] = useActionState(reschedulePost, initialState);
  const date = new Date(scheduledAt);
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const initial = `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <input type="hidden" name="postId" value={postId} />
      <label className="space-y-2">
        <span className="text-xs font-medium">New date and time</span>
        <input
          type="datetime-local"
          name="scheduledAtLocal"
          defaultValue={initial}
          min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
          aria-label="New scheduled date and time"
          required
          className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span className="block text-[11px] text-muted-foreground">{timezone}</span>
      </label>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Check />}
        {pending ? "Rescheduling…" : "Reschedule"}
      </Button>
      {state.message && <p className={state.ok ? "text-xs text-primary sm:col-span-2" : "text-xs text-destructive sm:col-span-2"}>{state.message}</p>}
    </form>
  );
}
