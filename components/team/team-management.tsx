"use client";

import { useActionState, useEffect } from "react";
import { MailPlus, ShieldCheck, UserPlus, Users } from "lucide-react";

import { inviteTeamMember, type TeamActionState } from "@/app/team/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast-provider";

export type TeamMemberView = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  isOwner: boolean;
};

const initialState: TeamActionState = { ok: false, message: "" };

export function TeamManagement({ members }: { members: TeamMemberView[] }) {
  const [state, formAction, pending] = useActionState(inviteTeamMember, initialState);
  const { toast } = useToast();

  useEffect(() => {
    if (!state.message) return;
    toast({ title: state.ok ? "Team updated" : "Team action failed", message: state.message, variant: state.ok ? "success" : "error" });
  }, [state, toast]);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="border-b bg-muted/15">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Badge variant="secondary" className="rounded-full px-3 py-1"><Users className="mr-1.5 size-3.5" /> Team workspace</Badge>
              <CardTitle className="mt-3 text-xl">Bring your team into OmniSocial</CardTitle>
              <CardDescription className="mt-1 max-w-2xl">Invite teammates with their own OmniSocial login. Their social accounts can be connected to this shared workspace without sharing passwords.</CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2 rounded-2xl border bg-background px-3 py-2 text-sm"><ShieldCheck className="size-4 text-primary" /><span>{members.length} member{members.length === 1 ? "" : "s"}</span></div>
          </div>
        </CardHeader>
        <CardContent className="p-5 sm:p-6">
          <form action={formAction} className="grid gap-4 rounded-2xl border bg-muted/10 p-4 sm:grid-cols-[1fr_180px_auto] sm:items-end">
            <div className="space-y-2"><Label htmlFor="team-email">Team member email</Label><Input id="team-email" name="email" type="email" placeholder="teammate@company.com" autoComplete="email" required /></div>
            <div className="space-y-2">
              <Label htmlFor="team-role">Role</Label>
              <select id="team-role" name="role" defaultValue="member" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring">
                <option value="admin">Admin</option><option value="member">Member</option><option value="viewer">Viewer</option>
              </select>
            </div>
            <Button type="submit" disabled={pending} className="w-full sm:w-auto"><MailPlus />{pending ? "Sending…" : "Invite member"}</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader><CardTitle>Workspace members</CardTitle><CardDescription>Each person signs in with their own account. Roles control what they can manage.</CardDescription></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {members.map((member) => (
              <div key={member.id} className="flex flex-col gap-3 p-4 transition hover:bg-accent/25 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex min-w-0 items-center gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">{(member.displayName || member.email).slice(0, 1).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-semibold">{member.displayName || member.email}</p><p className="truncate text-xs text-muted-foreground">{member.email}</p></div></div>
                <div className="flex items-center gap-2"><Badge variant="outline" className="capitalize">{member.role}</Badge>{member.isOwner ? <Badge className="bg-primary/10 text-primary hover:bg-primary/10">Owner</Badge> : <Badge variant={member.status === "active" ? "secondary" : "outline"} className="capitalize">{member.status}</Badge>}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/15 bg-primary/[0.03] shadow-sm"><CardContent className="flex gap-4 p-5 sm:p-6"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><UserPlus className="size-5" /></div><div><p className="font-semibold">Social accounts belong to the workspace</p><p className="mt-1 text-sm leading-6 text-muted-foreground">A teammate can connect their own Facebook, Instagram, Threads, LinkedIn, X, YouTube, or TikTok account, and the connected destination is available to the workspace instead of being tied to one login.</p></div></CardContent></Card>
    </div>
  );
}
