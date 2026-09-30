import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Check,
  ChevronRight,
  CreditCard,
  Layers3,
  Link2,
  Send,
  Settings2,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const features = [
  { icon: Send, title: "Create & publish", text: "Prepare one post and send it to the connected destinations already supported by OmniSocial." },
  { icon: CalendarClock, title: "Schedule with confidence", text: "Keep upcoming publishing work visible and organized without changing the existing scheduling flow." },
  { icon: Link2, title: "Connected platforms", text: "See your Facebook, Instagram, Threads, LinkedIn, X, YouTube, and TikTok connections in one place." },
  { icon: Settings2, title: "Workspace settings", text: "Control profile, workspace defaults, posting preferences, and account security from Settings." },
  { icon: Layers3, title: "History & media", text: "Move between your publishing history and media library without losing your workflow context." },
  { icon: Sparkles, title: "Focused workspace", text: "A calm interface with clear actions, consistent cards, and responsive light/dark themes." },
];

const platforms = [
  ["f", "Facebook"], ["◎", "Instagram"], ["@", "Threads"], ["in", "LinkedIn"], ["𝕏", "X"], ["▶", "YouTube"], ["♪", "TikTok"],
];

const pricing = [
  {
    name: "Starter",
    price: "₹999 / $9",
    period: "/ month",
    description: "For individuals and small businesses.",
    features: ["Unlimited publishing", "5 publishing users", "10 social accounts", "Scheduling & post history"],
  },
  {
    name: "Pro",
    price: "₹1,999 / $19",
    period: "/ month",
    description: "For growing publishing workflows.",
    features: ["Unlimited publishing", "20 publishing users", "30 social accounts", "Scheduling & post history"],
    featured: true,
  },
  {
    name: "Premium",
    price: "₹2,999 / $29",
    period: "/ month",
    description: "For larger publishing operations.",
    features: ["Unlimited publishing", "50 publishing users", "100 social accounts", "Scheduling & post history"],
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-5 px-5 lg:px-8">
          <Link href="/" className="group flex items-center gap-2.5 font-semibold tracking-tight">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition group-hover:-translate-y-px group-hover:shadow-md"><Sparkles className="size-4" /></span>
            <span>OmniSocial</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#solutions" className="transition hover:text-foreground">Solutions</a>
            <a href="#features" className="transition hover:text-foreground">Features</a>
            <a href="#platforms" className="transition hover:text-foreground">Platforms</a>
            <a href="#pricing" className="transition hover:text-foreground">Pricing</a>
          </nav>
          <div className="flex items-center gap-2"><Button asChild variant="ghost" size="sm"><Link href="/auth/login">Log in</Link></Button><Button asChild size="sm"><Link href="/auth/sign-up">Get started <ArrowRight /></Link></Button></div>
        </div>
      </header>

      <section className="relative">
        <div className="absolute inset-x-0 top-0 -z-10 h-[620px] bg-[radial-gradient(circle_at_72%_28%,hsl(var(--primary)/.18),transparent_38%),radial-gradient(circle_at_20%_12%,hsl(var(--accent)/.8),transparent_34%)]" />
        <div className="mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-16 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:pb-28 lg:pt-24">
          <div className="flex flex-col justify-center">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border bg-card/80 px-3.5 py-1.5 text-xs font-medium shadow-sm"><span className="size-1.5 rounded-full bg-primary" />One workspace for your social publishing<ChevronRight className="size-3.5 text-muted-foreground" /></div>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-0.04em] sm:text-6xl lg:text-7xl">Your content.<br /><span className="text-primary">Everywhere.</span><br />Without the chaos.</h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">Create, schedule, connect, and manage the social publishing workflow you already have in OmniSocial—inside one calm, modern workspace.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Button asChild size="lg"><Link href="/auth/sign-up">Start for free <ArrowRight /></Link></Button><Button asChild size="lg" variant="outline"><Link href="/auth/login">Open workspace</Link></Button></div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">{["Light + dark mode", "Multi-platform ready", "Secure OAuth connections"].map((item) => <span key={item} className="flex items-center gap-2"><Check className="size-4 text-primary" />{item}</span>)}</div>
          </div>
          <div className="relative flex items-center"><div className="absolute -inset-10 rounded-full bg-primary/10 blur-3xl" /><div className="relative w-full rounded-[2rem] border bg-card/90 p-3 shadow-2xl shadow-black/10 backdrop-blur"><div className="rounded-[1.5rem] border bg-background p-5 sm:p-6">
            <div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Workspace overview</p><p className="mt-1 text-xs text-muted-foreground">Everything in one glance</p></div><span className="rounded-full bg-primary/12 px-3 py-1 text-xs font-semibold text-accent-foreground">Live</span></div>
            <div className="mt-6 grid grid-cols-3 gap-3">{[["12", "Drafts"], ["8", "Scheduled"], ["24", "Published"]].map(([value, label]) => <div key={label} className="group rounded-2xl border bg-card p-4 transition hover:-translate-y-1 hover:border-primary/30 hover:shadow-md"><p className="text-2xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>)}</div>
            <div className="mt-4 rounded-2xl border bg-muted/20 p-4"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Connected platforms</p><p className="mt-1 text-xs text-muted-foreground">Ready destinations</p></div><Link href="/connect-accounts" className="text-xs font-medium text-primary hover:underline">Manage</Link></div><div className="mt-4 flex flex-wrap gap-2">{platforms.slice(0, 6).map(([mark, name]) => <Link key={name} href="/connect-accounts" title={name} className="group flex size-10 items-center justify-center rounded-xl border bg-background text-xs font-bold transition hover:-translate-y-1 hover:border-primary/35 hover:bg-primary hover:text-primary-foreground hover:shadow-md">{mark}</Link>)}</div></div>
            <div className="mt-4 space-y-2">{["Launch announcement", "Customer story", "Product tips"].map((item, index) => <Link key={item} href="/post-history" className="group flex items-center justify-between rounded-xl border bg-background p-3.5 transition hover:-translate-y-px hover:border-primary/25 hover:bg-accent/35"><div><p className="text-sm font-medium">{item}</p><p className="mt-1 text-xs text-muted-foreground">{index === 0 ? "Published today" : "Draft"}</p></div><ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" /></Link>)}</div>
          </div></div></div>
        </div>
      </section>

      <section id="platforms" className="border-y bg-card/45"><div className="mx-auto max-w-7xl px-5 py-10 lg:px-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Platforms</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Connect the destinations you already use.</h2></div><Button asChild variant="outline"><Link href="/connect-accounts">View connections <ArrowRight /></Link></Button></div><div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">{platforms.map(([mark, name]) => <Link key={name} href="/connect-accounts" className="group flex items-center gap-3 rounded-2xl border bg-background p-4 transition hover:-translate-y-1 hover:border-primary/30 hover:bg-accent/45 hover:shadow-sm"><span className="flex size-9 items-center justify-center rounded-xl bg-muted text-xs font-bold transition group-hover:bg-primary group-hover:text-primary-foreground">{mark}</span><span className="text-sm font-medium">{name}</span></Link>)}</div></div></section>

      <section id="solutions" className="mx-auto max-w-7xl px-5 py-20 lg:px-8"><div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Built for</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">A focused workspace for every publishing rhythm.</h2></div><div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{["Creators", "Small businesses", "Agencies", "Marketing teams"].map((solution) => <div key={solution} className="group rounded-2xl border bg-card p-6 transition hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"><div className="size-2 rounded-full bg-primary transition group-hover:scale-150" /><p className="mt-5 font-semibold">{solution}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">Keep your publishing workflow organized without switching between disconnected tools.</p></div>)}</div></section>

      <section id="features" className="border-y bg-muted/20"><div className="mx-auto max-w-7xl px-5 py-20 lg:px-8"><div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Product</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Everything important stays close.</h2><p className="mt-4 text-muted-foreground">No extra product areas were invented for this redesign. The experience simply makes the functionality already in OmniSocial easier to discover and use.</p></div><div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{features.map(({ icon: Icon, title, text }) => <div key={title} className="group rounded-2xl border bg-background p-6 transition hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"><div className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground transition group-hover:scale-105"><Icon className="size-5" /></div><h3 className="mt-5 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></div>)}</div></div></section>

      <section id="pricing" className="mx-auto max-w-7xl px-5 py-20 lg:px-8"><div className="mx-auto max-w-2xl text-center"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Pricing</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Simple plans. Unlimited publishing.</h2><p className="mt-4 text-muted-foreground">Choose by the number of publishing users and social destinations you need—not by how many posts you publish.</p></div><div className="mt-10 grid gap-5 lg:grid-cols-3">{pricing.map((plan) => <div key={plan.name} className={`relative rounded-3xl border bg-card p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${plan.featured ? "border-primary/45 shadow-primary/10" : ""}`}>{plan.featured && <span className="absolute right-5 top-5 rounded-full bg-primary px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">Popular</span>}<p className="text-sm font-semibold">{plan.name}</p><div className="mt-5 flex items-end gap-1"><span className="text-4xl font-semibold tracking-tight">{plan.price}</span><span className="pb-1 text-sm text-muted-foreground">{plan.period}</span></div><p className="mt-3 min-h-12 text-sm leading-6 text-muted-foreground">{plan.description}</p><div className="my-6 h-px bg-border" /><ul className="space-y-3">{plan.features.map((feature) => <li key={feature} className="flex items-center gap-2 text-sm"><Check className="size-4 text-primary" />{feature}</li>)}</ul><Button asChild variant={plan.featured ? "default" : "outline"} className="mt-7 w-full"><Link href="/auth/sign-up">Get started <ArrowRight /></Link></Button></div>)}</div><div className="mt-7 flex justify-center"><Button asChild variant="ghost"><Link href="/billing">Already have a workspace? Manage billing <CreditCard /></Link></Button></div></section>

      <section className="border-t bg-primary/[0.06]"><div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-16 sm:flex-row sm:items-center sm:justify-between lg:px-8"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Ready when you are</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Bring your publishing workflow together.</h2></div><Button asChild size="lg"><Link href="/auth/sign-up">Start for free <ArrowRight /></Link></Button></div></section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-8"><p>© 2026 OmniSocial</p><div className="flex gap-5"><Link href="/settings" className="hover:text-foreground">Settings</Link><Link href="/connect-accounts" className="hover:text-foreground">Connections</Link><Link href="/auth/login" className="hover:text-foreground">Log in</Link></div></footer>
    </main>
  );
}
