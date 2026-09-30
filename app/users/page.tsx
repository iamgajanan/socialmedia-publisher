import Link from "next/link";
import { UserRound, Plus, ShieldCheck, Trash2, Link2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireWorkspaceAdmin } from "@/lib/workspace/server";
import { createPublishingUser, deletePublishingUser, renamePublishingUser } from "./actions";
import { CreateUserForm } from "@/components/users/create-user-form";

export const instant = false;

export default async function UsersPage() {
  const context = await requireWorkspaceAdmin();
  const { data: users, error } = await context.supabase.from("socialmedia_users").select("id, name, avatar_url, created_at").eq("workspace_id", context.workspace.id).order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const userCount = users?.length ?? 0;
  const percent = Math.min(100, Math.round((userCount / context.plan.max_users) * 100));

  return <div className="space-y-8">
    <section className="max-w-3xl"><Badge variant="secondary" className="rounded-full">Publishing users</Badge><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Users</h1><p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">Create simple publishing profiles inside your workspace. One login can manage multiple users, and each user can connect one account per supported platform.</p></section>
    <Card className="border-primary/15 bg-primary/[0.03] shadow-sm"><CardContent className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-center"><div><div className="flex items-center justify-between gap-3 text-sm"><span className="font-medium">User capacity</span><span className="text-muted-foreground">{userCount}/{context.plan.max_users}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} /></div><p className="mt-2 text-xs text-muted-foreground">{context.plan.name} · {context.plan.max_social_accounts} social accounts · {context.plan.unlimited_publishing ? "Unlimited publishing" : `${context.plan.monthly_post_limit.toLocaleString("en-IN")} posts/month`}</p></div><Badge className="w-fit">₹{context.plan.monthly_price_inr.toLocaleString("en-IN")} / ${context.plan.monthly_price_usd} / month</Badge></CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Plus className="size-5 text-primary" />Create a user</CardTitle><CardDescription>No email invitation. No second login. Just create a name and connect one account per supported platform.</CardDescription></CardHeader><CardContent><CreateUserForm action={createPublishingUser} /></CardContent></Card>
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{(users ?? []).map((user) => <Card key={user.id} className="overflow-hidden transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><UserRound className="size-5" /></div><Badge variant="outline"><ShieldCheck className="mr-1 size-3.5" />Publishing user</Badge></div><CardTitle className="mt-3">{user.name}</CardTitle><CardDescription>Connect one account per supported social platform to this user.</CardDescription></CardHeader><CardContent className="space-y-4"><Button asChild className="w-full"><Link href={`/connect-accounts?user=${encodeURIComponent(user.id)}`}><Link2 />Connect platforms</Link></Button><form action={renamePublishingUser} className="flex gap-2"><input type="hidden" name="id" value={user.id} /><Input name="name" defaultValue={user.name} aria-label={`Rename ${user.name}`} /><Button type="submit" variant="outline">Save</Button></form><form action={deletePublishingUser}><input type="hidden" name="id" value={user.id} /><Button type="submit" variant="ghost" className="w-full text-destructive hover:text-destructive"><Trash2 />Delete user</Button></form></CardContent></Card>)}</section>
  </div>;
}
