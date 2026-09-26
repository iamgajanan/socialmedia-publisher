import Link from "next/link";
import { ArrowUpRight, CalendarClock, CheckCircle2, FileText, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

const stats = [
  { label: "Drafts", value: "12", icon: FileText },
  { label: "Scheduled", value: "8", icon: CalendarClock },
  { label: "Published", value: "24", icon: CheckCircle2 },
  { label: "Connected accounts", value: "0", icon: Send },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-sm font-medium text-muted-foreground">Workspace</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Dashboard</h1><p className="mt-2 text-sm text-muted-foreground">Your social publishing activity at a glance.</p></div>
        <Button asChild><Link href="/create-post"><Plus /> Create post</Link></Button>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => <div key={label} className="rounded-2xl border bg-card p-5"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{label}</span><Icon className="h-4 w-4 text-muted-foreground" /></div><p className="mt-4 text-3xl font-semibold">{value}</p></div>)}
      </section>
      <section className="grid gap-6 lg:grid-cols-[1.4fr_.6fr]">
        <div className="rounded-2xl border bg-card p-6">
          <div className="flex items-center justify-between"><div><h2 className="font-semibold">Recent content</h2><p className="mt-1 text-sm text-muted-foreground">Your latest publishing activity.</p></div><Button asChild variant="ghost" size="sm"><Link href="/post-history">View all <ArrowUpRight /></Link></Button></div>
          <div className="mt-6 rounded-xl border border-dashed p-8 text-center"><p className="font-medium">No posts yet</p><p className="mt-1 text-sm text-muted-foreground">Create your first draft to start building your publishing history.</p><Button asChild className="mt-4"><Link href="/create-post">Create your first post</Link></Button></div>
        </div>
        <div className="rounded-2xl border bg-card p-6"><h2 className="font-semibold">Next step</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Connect a social account before publishing. Account OAuth will be added in the next integration milestone.</p><Button asChild variant="outline" className="mt-5 w-full"><Link href="/connect-accounts">Connect accounts</Link></Button></div>
      </section>
    </div>
  );
}
