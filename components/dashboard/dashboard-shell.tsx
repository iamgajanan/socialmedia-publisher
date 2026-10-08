"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, CalendarClock, CircleHelp, CreditCard, FileText, Image as ImageIcon, KeyRound,
  LayoutDashboard, Link2, Menu, Plus, Settings, Sparkles, Users, Webhook, ChevronDown, X,
  ClipboardCheck,
} from "lucide-react";
import { useState } from "react";

import { LogoutButton } from "@/components/logout-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher";

const navigation = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Create post", href: "/create-post", icon: Plus },
  { label: "Schedule", href: "/schedule", icon: CalendarClock },
  { label: "Post history", href: "/post-history", icon: FileText },
  { label: "Media library", href: "/media", icon: ImageIcon },
  { label: "Connected accounts", href: "/connect-accounts", icon: Link2 },
  { label: "Users", href: "/users", icon: Users },
];

const secondaryNavigation = [
  { label: "Billing", href: "/billing", icon: CreditCard },
  { label: "Usage", href: "/usage", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Branding", href: "/settings/branding", icon: Sparkles },
  { label: "API keys", href: "/api-keys", icon: KeyRound },
  { label: "Webhooks", href: "/webhooks", icon: Webhook },
];

const analyticsNavigation = [
  { label: "Overview", href: "/analytics" },
  { label: "Posts", href: "/analytics/posts" },
  { label: "Accounts", href: "/analytics/accounts" },
  { label: "Reports", href: "/analytics/reports" },
];

const aiNavigation = [
  { label: "AI Content", href: "/ai-content" },
  { label: "Approvals", href: "/ai-content/approvals" },
  { label: "MCP Server", href: "/mcp" },
];

type DashboardShellProps = {
  children: React.ReactNode;
  user: { name: string; email: string; avatarUrl: string | null; workspaceName?: string | null };
  currentWorkspace: { id: string; name: string; logoUrl: string | null; primaryColor: string; accentColor: string };
  workspaces: { id: string; name: string; role: string }[];
};

function Brand({ workspace }: { workspace: DashboardShellProps["currentWorkspace"] }) { return <Link href="/dashboard" className="group flex min-w-0 items-center gap-3 px-2 outline-none"><span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl text-white shadow-sm transition-[transform,box-shadow] duration-200 group-hover:-translate-y-px group-hover:shadow-md" style={{ backgroundColor: workspace.primaryColor }}>{workspace.logoUrl ? <img src={workspace.logoUrl} alt="" className="size-full object-cover" /> : <Sparkles className="size-4" />}</span><span className="truncate text-base font-semibold tracking-tight">{workspace.name}</span></Link>; }

function Navigation({ onNavigate, mobile = false }: { onNavigate?: () => void; mobile?: boolean }) {
  const pathname = usePathname();
  const render = (item: (typeof navigation)[number] | (typeof secondaryNavigation)[number]) => { const Icon = item.icon; const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href); return <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cn("group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium outline-none transition-[background-color,color,transform,box-shadow] duration-200", active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:-translate-y-px hover:bg-accent/80 hover:text-accent-foreground", "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", mobile && "py-3")}><span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors", active ? "bg-primary-foreground/12" : "bg-transparent group-hover:bg-background/70")}><Icon className="size-4" /></span><span>{item.label}</span></Link>; };
  const analyticsActive = pathname === "/analytics" || pathname.startsWith("/analytics/");
  const aiActive = pathname === "/ai-content" || pathname.startsWith("/ai-content/") || pathname === "/mcp" || pathname.startsWith("/mcp/");
  return <nav className={cn("space-y-1.5", mobile && "mt-5")}>
    <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/65">Workspace</p>
    {navigation.map(render)}
    <div className="pt-1">
      <Link href="/analytics" onClick={onNavigate} aria-current={analyticsActive ? "page" : undefined} className={cn("group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium outline-none transition-[background-color,color,transform,box-shadow] duration-200", analyticsActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:-translate-y-px hover:bg-accent/80 hover:text-accent-foreground", "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", mobile && "py-3")}>
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", analyticsActive ? "bg-primary-foreground/12" : "group-hover:bg-background/70")}><BarChart3 className="size-4" /></span>
        <span className="flex-1">Analytics</span><ChevronDown className={cn("size-3.5 transition-transform", analyticsActive && "rotate-180")} />
      </Link>
      <div className={cn("ml-6 mt-1 border-l pl-3", !analyticsActive && "hidden")}>
        {analyticsNavigation.map((item) => { const active = pathname === item.href; return <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cn("block rounded-lg px-3 py-2 text-xs font-medium transition-colors", active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/70 hover:text-foreground")}>{item.label}</Link>; })}
      </div>
    </div>
    <div className="pt-1">
      <Link href="/ai-content" onClick={onNavigate} aria-current={aiActive ? "page" : undefined} className={cn("group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium outline-none transition-[background-color,color,transform,box-shadow] duration-200", aiActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:-translate-y-px hover:bg-accent/80 hover:text-accent-foreground", "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", mobile && "py-3")}>
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", aiActive ? "bg-primary-foreground/12" : "group-hover:bg-background/70")}><Sparkles className="size-4" /></span>
        <span className="flex-1">AI & Automation</span><ChevronDown className={cn("size-3.5 transition-transform", aiActive && "rotate-180")} />
      </Link>
      <div className={cn("ml-6 mt-1 border-l pl-3", !aiActive && "hidden")}>
        {aiNavigation.map((item) => { const active = pathname === item.href || pathname.startsWith(`${item.href}/`); return <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} title={item.label} className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors", active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/70 hover:text-foreground")}><span>{item.label}</span>{item.href === "/ai-content/approvals" ? <ClipboardCheck className="ml-auto size-3.5" /> : null}</Link>; })}
      </div>
    </div>
    <p className="mb-2 mt-7 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/65">Manage</p>{secondaryNavigation.map(render)}
  </nav>;
}

function UserIdentity({ user, initials }: { user: DashboardShellProps["user"]; initials: string }) { return <div className="rounded-2xl border bg-muted/40 p-3"><div className="flex items-center gap-3"><div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-background text-xs font-semibold shadow-sm">{user.avatarUrl ? <img src={user.avatarUrl} alt="" className="size-full object-cover" /> : initials}</div><div className="min-w-0"><p className="truncate text-sm font-medium">{user.workspaceName || user.name}</p><p className="truncate text-xs text-muted-foreground">{user.email}</p></div></div></div>; }

export function DashboardShell({ children, user, currentWorkspace, workspaces }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false); const initials = user.name.slice(0, 2).toUpperCase();
  return <div className="min-h-svh bg-muted/20"><aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] border-r bg-background/95 px-4 py-5 shadow-[10px_0_35px_-30px_hsl(var(--foreground)/.2)] backdrop-blur lg:flex lg:flex-col"><Brand workspace={currentWorkspace} /><WorkspaceSwitcher currentWorkspaceId={currentWorkspace.id} workspaces={workspaces} /><div className="mt-6 flex-1 overflow-y-auto px-1"><Navigation /></div><div className="space-y-3 border-t pt-4"><UserIdentity user={user} initials={initials} /><div className="flex items-center justify-between px-2"><div className="flex items-center gap-1 text-xs text-muted-foreground"><CircleHelp className="size-3.5" /><span>Need help?</span></div><ThemeSwitcher /></div></div></aside>{mobileOpen ? <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Close navigation" className="absolute inset-0 bg-foreground/35 backdrop-blur-sm" onClick={() => setMobileOpen(false)} /><aside className="relative flex h-full w-[290px] flex-col border-r bg-background px-4 py-5 shadow-2xl"><div className="flex items-center justify-between"><Brand workspace={currentWorkspace} /><button aria-label="Close navigation" className="rounded-xl border bg-background p-2 text-muted-foreground transition hover:bg-accent hover:text-accent-foreground" onClick={() => setMobileOpen(false)}><X className="size-5" /></button></div><WorkspaceSwitcher currentWorkspaceId={currentWorkspace.id} workspaces={workspaces} /><div className="flex-1 overflow-y-auto"><Navigation onNavigate={() => setMobileOpen(false)} mobile /></div><div className="border-t pt-4"><UserIdentity user={user} initials={initials} /><div className="mt-3 flex items-center justify-between"><LogoutButton /><ThemeSwitcher /></div></div></aside></div> : null}<div className="lg:pl-[260px]"><header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-xl"><div className="flex min-h-16 items-center justify-between gap-3 px-3 py-2 sm:px-6 lg:px-8"><div className="flex min-w-0 items-center gap-3"><button aria-label="Open navigation" className="rounded-xl border bg-background p-2 text-muted-foreground shadow-sm transition hover:-translate-y-px hover:bg-accent hover:text-accent-foreground lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="size-5" /></button><div className="min-w-0"><p className="truncate text-sm font-semibold lg:hidden">{currentWorkspace.name || user.workspaceName || "OmniSocial"}</p><p className="hidden text-sm font-medium text-foreground/85 lg:block">{currentWorkspace.name || user.workspaceName || "Workspace"}</p><p className="hidden text-xs text-muted-foreground lg:block">Publish consistently from one focused workspace</p></div></div><div className="flex shrink-0 items-center gap-2"><Link href="/create-post" className="hidden items-center gap-2 rounded-xl bg-primary px-3.5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-[background-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:bg-primary/90 hover:shadow-md sm:inline-flex"><Plus className="size-4" />Create post</Link><ThemeSwitcher /><DropdownMenu><DropdownMenuTrigger asChild><button aria-label="Open account menu" className="flex size-10 items-center justify-center overflow-hidden rounded-xl border bg-background text-xs font-semibold shadow-sm transition-[background-color,border-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-primary/30 hover:bg-accent hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">{user.avatarUrl ? <img src={user.avatarUrl} alt="" className="size-full object-cover" /> : initials}</button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-64 rounded-2xl p-2"><div className="rounded-xl bg-accent/55 p-3"><p className="truncate text-sm font-semibold">{user.name}</p><p className="truncate text-xs text-muted-foreground">{user.email}</p></div><div className="my-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">Workspace</div><DropdownMenuItem asChild className="rounded-xl py-2.5"><Link href="/dashboard"><LayoutDashboard className="size-4" />Overview</Link></DropdownMenuItem><DropdownMenuItem asChild className="rounded-xl py-2.5"><Link href="/create-post"><Plus className="size-4" />Create post</Link></DropdownMenuItem><DropdownMenuItem asChild className="rounded-xl py-2.5"><Link href="/connect-accounts"><Link2 className="size-4" />Connected platforms</Link></DropdownMenuItem><DropdownMenuItem asChild className="rounded-xl py-2.5"><Link href="/analytics"><BarChart3 className="size-4" />Analytics</Link></DropdownMenuItem><DropdownMenuItem asChild className="rounded-xl py-2.5"><Link href="/ai-content"><Sparkles className="size-4" />AI Content</Link></DropdownMenuItem><DropdownMenuItem asChild className="rounded-xl py-2.5"><Link href="/ai-content/approvals"><ClipboardCheck className="size-4" />Approvals</Link></DropdownMenuItem><DropdownMenuItem asChild className="rounded-xl py-2.5"><Link href="/mcp"><Sparkles className="size-4" />MCP server</Link></DropdownMenuItem><DropdownMenuItem asChild className="rounded-xl py-2.5"><Link href="/users"><Users className="size-4" />Users</Link></DropdownMenuItem><DropdownMenuItem asChild className="rounded-xl py-2.5"><Link href="/post-history"><FileText className="size-4" />Post history</Link></DropdownMenuItem><DropdownMenuSeparator className="my-2" /><div className="px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">Account</div><DropdownMenuItem asChild className="rounded-xl py-2.5"><Link href="/billing"><CreditCard className="size-4" />Billing</Link></DropdownMenuItem><DropdownMenuItem asChild className="rounded-xl py-2.5"><Link href="/settings"><Settings className="size-4" />Settings</Link></DropdownMenuItem><DropdownMenuItem asChild className="rounded-xl py-2.5"><Link href="/api-keys"><KeyRound className="size-4" />API keys</Link></DropdownMenuItem><DropdownMenuItem asChild className="rounded-xl py-2.5"><Link href="/webhooks"><Webhook className="size-4" />Webhooks</Link></DropdownMenuItem><DropdownMenuSeparator className="my-2" /><DropdownMenuItem asChild className="rounded-xl py-2.5"><LogoutButton /></DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></div></header><main id="main-content" className="min-h-[calc(100svh-4rem)] px-3 py-5 sm:px-6 sm:py-8 lg:px-8"><a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg">Skip to content</a><div className="mx-auto w-full max-w-[1440px]">{children}</div></main></div></div>;
}
