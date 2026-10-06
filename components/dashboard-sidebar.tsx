"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, KeyRound, LayoutDashboard, PenSquare, Settings, Share2, Users, ChevronDown, Sparkles, Bot, ClipboardCheck } from "lucide-react";
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

const aiItems = [
  { href: "/ai-content", label: "AI Content", icon: Sparkles },
  { href: "/ai-content/approvals", label: "Approvals", icon: ClipboardCheck },
  { href: "/mcp", label: "MCP Server", icon: Bot },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const aiActive = aiItems.some(({ href }) => pathname === href || pathname.startsWith(`${href}/`));
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-card lg:block">
      <div className="sticky top-0 flex h-screen flex-col">
        <div className="flex h-16 items-center gap-2 border-b px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><BarChart3 className="h-4 w-4" /></span>
          <Link href="/dashboard" className="font-semibold tracking-tight">OmniSocial</Link>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Main navigation">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground", active && "bg-muted font-medium text-foreground")}><Icon className="h-4 w-4" aria-hidden="true" /><span>{label}</span></Link>;
          })}
          <div className="pt-3">
            <div className={cn("flex items-center gap-2 px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground", aiActive && "text-foreground")}><Sparkles className="h-3.5 w-3.5" />AI & Automation<ChevronDown className="ml-auto h-3.5 w-3.5" /></div>
            <div className="ml-2 border-l pl-2">
              {aiItems.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground", active && "bg-muted font-medium text-foreground")}><Icon className="h-4 w-4" aria-hidden="true" /><span>{label}</span></Link>;
              })}
            </div>
          </div>
        </nav>
        <div className="border-t p-4 text-xs text-muted-foreground">Publishing workspace</div>
      </div>
    </aside>
  );
}
