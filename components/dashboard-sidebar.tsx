"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, KeyRound, LayoutDashboard, PenSquare, Settings, Share2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/connect-accounts", label: "Connect accounts", icon: Share2 },
  { href: "/create-post", label: "Create post", icon: PenSquare },
  { href: "/post-history", label: "Post history", icon: CalendarDays },
  { href: "/team", label: "Team & access", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/api-keys", label: "API keys", icon: KeyRound },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-card lg:block">
      <div className="sticky top-0 flex h-screen flex-col">
        <div className="flex h-16 items-center gap-2 border-b px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><BarChart3 className="h-4 w-4" /></span>
          <Link href="/dashboard" className="font-semibold tracking-tight">OmniSocial</Link>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return <Link key={href} href={href} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground", active && "bg-muted font-medium text-foreground")}><Icon className="h-4 w-4" />{label}</Link>;
          })}
        </nav>
        <div className="border-t p-4 text-xs text-muted-foreground">Publishing workspace</div>
      </div>
    </aside>
  );
}
