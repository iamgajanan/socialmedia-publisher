"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, CalendarClock, CircleHelp, FileText, Image as ImageIcon,
  LayoutDashboard, Link2, Menu, Plus, Settings, Sparkles, X,
} from "lucide-react";
import { useState } from "react";

import { LogoutButton } from "@/components/logout-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const navigation = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Create post", href: "/create-post", icon: Plus },
  { label: "Calendar", href: "/calendar", icon: CalendarClock },
  { label: "Post history", href: "/post-history", icon: FileText },
  { label: "Media library", href: "/media", icon: ImageIcon },
  { label: "Connected accounts", href: "/connect-accounts", icon: Link2 },
];
const secondaryNavigation = [
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];

type DashboardShellProps = { children: React.ReactNode; user: { name: string; email: string; avatarUrl: string | null; workspaceName?: string | null } };

function Brand() {
  return <Link href="/dashboard" className="flex items-center gap-3 px-2"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"><Sparkles className="size-4" /></span><span className="text-base font-semibold tracking-tight">OmniSocial</span></Link>;
}

function Navigation({ onNavigate, mobile = false }: { onNavigate?: () => void; mobile?: boolean }) {
  const pathname = usePathname();
  const render = (item: (typeof navigation)[number] | (typeof secondaryNavigation)[number]) => {
    const Icon = item.icon;
    const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
    const future = item.href !== "/dashboard" && item.href !== "/settings";
    return <Link key={item.href} href={item.href} prefetch={item.href === "/connect-accounts" ? false : undefined} onClick={onNavigate} className={cn("group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors", active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
      <Icon className="size-4 shrink-0" /><span>{item.label}</span>{future && <span className={cn("ml-auto text-[10px] font-medium", active ? "text-primary-foreground/70" : "text-muted-foreground/60")}>Soon</span>}
    </Link>;
  };
  return <nav className={cn("space-y-1", mobile && "mt-5")}><p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">Workspace</p>{navigation.map(render)}<p className="mb-2 mt-7 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">Manage</p>{secondaryNavigation.map(render)}</nav>;
}

export function DashboardShell({ children, user }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const initials = user.name.slice(0, 2).toUpperCase();
  return <div className="min-h-svh bg-muted/20">
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] border-r bg-background/95 px-4 py-5 backdrop-blur lg:flex lg:flex-col">
      <Brand /><div className="mt-8 flex-1 overflow-y-auto px-1"><Navigation /></div>
      <div className="space-y-3 border-t pt-4">
        <div className="rounded-2xl border bg-muted/40 p-3"><div className="flex items-start gap-3"><div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-background text-xs font-semibold shadow-sm">{initials}</div><div className="min-w-0"><p className="truncate text-sm font-medium">{user.workspaceName || user.name}</p><p className="truncate text-xs text-muted-foreground">{user.email}</p></div></div></div>
        <div className="flex items-center justify-between px-2"><div className="flex items-center gap-1 text-xs text-muted-foreground"><CircleHelp className="size-3.5" /><span>Need help?</span></div><ThemeSwitcher /></div>
      </div>
    </aside>
    {mobileOpen && <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Close navigation" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} /><aside className="relative flex h-full w-[290px] flex-col border-r bg-background px-4 py-5 shadow-2xl"><div className="flex items-center justify-between"><Brand /><button aria-label="Close navigation" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => setMobileOpen(false)}><X className="size-5" /></button></div><div className="flex-1 overflow-y-auto"><Navigation onNavigate={() => setMobileOpen(false)} mobile /></div><div className="border-t pt-4"><div className="mb-3 flex items-center gap-3 rounded-2xl bg-muted/50 p-3"><div className="flex size-9 items-center justify-center rounded-xl bg-background text-xs font-semibold shadow-sm">{initials}</div><div className="min-w-0"><p className="truncate text-sm font-medium">{user.workspaceName || user.name}</p><p className="truncate text-xs text-muted-foreground">{user.email}</p></div></div><div className="flex items-center justify-between"><LogoutButton /><ThemeSwitcher /></div></div></aside></div>}
    <div className="lg:pl-[260px]"><header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur"><div className="flex min-h-16 items-center justify-between gap-3 px-3 py-2 sm:px-6 lg:px-8"><div className="flex items-center gap-3"><button aria-label="Open navigation" className="rounded-xl border bg-background p-2 text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="size-5" /></button><div><p className="text-sm font-semibold lg:hidden">{user.workspaceName || "OmniSocial"}</p><p className="hidden text-sm text-muted-foreground lg:block">{user.workspaceName || "Workspace"}</p></div></div><div className="flex items-center gap-2"><Link href="/create-post" className="hidden rounded-xl bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 sm:inline-flex sm:items-center sm:gap-2"><Plus className="size-4" />Create post</Link><ThemeSwitcher /><DropdownMenu><DropdownMenuTrigger asChild><button className="flex size-11 items-center justify-center rounded-xl border bg-background text-xs font-semibold shadow-sm transition hover:bg-muted">{initials}</button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-52"><div className="px-2 py-2"><p className="truncate text-sm font-medium">{user.name}</p><p className="truncate text-xs text-muted-foreground">{user.email}</p></div><DropdownMenuSeparator /><DropdownMenuItem asChild><Link href="/settings"><Settings className="size-4" />Settings</Link></DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem asChild><LogoutButton /></DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></div></header><main id="main-content" className="min-h-[calc(100svh-4rem)] px-3 py-5 sm:px-6 sm:py-8 lg:px-8"><a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg">Skip to content</a><div className="mx-auto w-full max-w-[1440px]">{children}</div></main></div>
  </div>;
}
