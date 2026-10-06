import Link from "next/link";
import { BarChart3, FileText, LayoutDashboard, Users, LineChart } from "lucide-react";

export const instant = false;

const items = [
  { href: "/analytics", label: "Overview", icon: LayoutDashboard },
  { href: "/analytics/posts", label: "Posts", icon: FileText },
  { href: "/analytics/accounts", label: "Accounts", icon: Users },
  { href: "/analytics/reports", label: "Reports", icon: LineChart },
];

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-6 rounded-2xl border bg-card p-3 shadow-sm">
          <div className="flex items-center gap-2 px-3 py-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><BarChart3 className="size-4" /></div>
            <div><p className="text-sm font-semibold">Analytics</p><p className="text-xs text-muted-foreground">Reporting workspace</p></div>
          </div>
          <nav className="mt-2 space-y-1" aria-label="Analytics">
            {items.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"> <Icon className="size-4" /> {item.label}</Link>; })}
          </nav>
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
