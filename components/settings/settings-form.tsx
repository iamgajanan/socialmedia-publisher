"use client";

import { useActionState, useEffect } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast-provider";

type State = { error: string | null; success: string | null };

const initialState: State = { error: null, success: null };

function useSettingsToast(state: State) {
  const { toast } = useToast();

  useEffect(() => {
    if (state.error) toast({ title: "Update failed", message: state.error, variant: "error" });
    if (state.success) toast({ title: "Settings saved", message: state.success, variant: "success" });
  }, [state, toast]);
}

export function ProfileForm({
  action,
  displayName,
}: {
  action: (state: State, formData: FormData) => Promise<State>;
  displayName: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  useSettingsToast(state);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="displayName">Display name</Label>
        <Input id="displayName" name="displayName" defaultValue={displayName} maxLength={80} required />
        <p className="text-xs text-muted-foreground">This name appears across your OmniSocial workspace.</p>
      </div>
      <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Save profile</Button>
    </form>
  );
}

export function WorkspaceForm({
  action,
  workspaceName,
  timezone,
  autoSaveDrafts,
  defaultStatus,
}: {
  action: (state: State, formData: FormData) => Promise<State>;
  workspaceName: string;
  timezone: string;
  autoSaveDrafts: boolean;
  defaultStatus: "draft" | "scheduled";
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  useSettingsToast(state);
  const timezones = ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "UTC"];

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="workspaceName">Workspace name</Label>
          <Input id="workspaceName" name="workspaceName" defaultValue={workspaceName} maxLength={80} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="timezone">Timezone</Label>
          <select id="timezone" name="timezone" defaultValue={timezone} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring">
            {timezones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
          </select>
          <p className="text-xs text-muted-foreground">Used for scheduling and calendar displays.</p>
        </div>
      </div>
      <div className="rounded-2xl border bg-muted/20 p-4">
        <p className="text-sm font-medium">Default posting behavior</p>
        <p className="mt-1 text-xs text-muted-foreground">These preferences will become defaults in the composer.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="flex items-start gap-3 rounded-xl border bg-background p-3">
            <input type="checkbox" name="autoSaveDrafts" defaultChecked={autoSaveDrafts} className="mt-1 size-4 accent-primary" />
            <span><span className="block text-sm font-medium">Auto-save drafts</span><span className="block text-xs text-muted-foreground">Keep unfinished posts safe automatically.</span></span>
          </label>
          <div className="space-y-2">
            <Label htmlFor="defaultStatus">Default new post status</Label>
            <select id="defaultStatus" name="defaultStatus" defaultValue={defaultStatus} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
            </select>
          </div>
        </div>
      </div>
      <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Save workspace settings</Button>
    </form>
  );
}

export function AccountSecurityForm({
  action,
  currentEmail,
}: {
  action: (state: State, formData: FormData) => Promise<State>;
  currentEmail: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  useSettingsToast(state);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <Input id="email" name="email" type="email" defaultValue={currentEmail} required />
        <p className="text-xs text-muted-foreground">Changing your email requires confirmation from the new address.</p>
      </div>
      <Button type="submit" variant="outline" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Update email</Button>
    </form>
  );
}

export function PasswordForm({
  action,
}: {
  action: (state: State, formData: FormData) => Promise<State>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  useSettingsToast(state);

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="password">New password</Label><Input id="password" name="password" type="password" minLength={6} required /></div>
        <div className="space-y-2"><Label htmlFor="repeatPassword">Confirm password</Label><Input id="repeatPassword" name="repeatPassword" type="password" minLength={6} required /></div>
      </div>
      <Button type="submit" variant="outline" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Update password</Button>
    </form>
  );
}

export function DeleteAccountForm({
  action,
}: {
  action: (state: State, formData: FormData) => Promise<State>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  useSettingsToast(state);

  return (
    <form action={formAction} className="space-y-4">
      <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4">
        <p className="text-sm font-medium text-destructive">This action cannot be undone.</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">Your OmniSocial profile and publishing data will be removed. Your Supabase Auth account will also be deleted.</p>
        <div className="mt-4 space-y-2">
          <Label htmlFor="confirmation">Type DELETE to confirm</Label>
          <Input id="confirmation" name="confirmation" placeholder="DELETE" autoComplete="off" required />
        </div>
      </div>
      <Button type="submit" variant="destructive" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Delete my account</Button>
    </form>
  );
}
