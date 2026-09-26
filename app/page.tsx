import Link from "next/link";
import { ArrowRight, CalendarClock, Check, Layers3, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Send, title: "Publish everywhere", text: "Prepare one piece of content for the social channels your business uses." },
  { icon: CalendarClock, title: "Plan ahead", text: "Build a consistent publishing workflow with scheduling-ready content." },
  { icon: Layers3, title: "One workspace", text: "Keep connected accounts, drafts, history, and settings in one focused dashboard." },
];

const solutions = ["Creators", "Small businesses", "Agencies", "Marketing teams"];

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            OmniSocial
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#solutions" className="transition hover:text-foreground">Solutions</a>
            <a href="#features" className="transition hover:text-foreground">Features</a>
            <a href="#pricing" className="transition hover:text-foreground">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link href="/auth/login">Log in</Link></Button>
            <Button asChild size="sm"><Link href="/auth/sign-up">Get started</Link></Button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-20 lg:grid-cols-[1.1fr_.9fr] lg:px-8 lg:pb-28 lg:pt-28">
        <div className="flex flex-col justify-center">
          <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> Social publishing, simplified
          </div>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
            Create once. <span className="text-muted-foreground">Publish with purpose.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            OmniSocial gives you a clean workspace to prepare, organize, schedule, and manage social content without jumping between platforms.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg"><Link href="/auth/sign-up">Start for free <ArrowRight /></Link></Button>
            <Button asChild size="lg" variant="outline"><Link href="/auth/login">Open dashboard</Link></Button>
          </div>
          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {["Simple workspace", "Multi-account ready", "Built with Supabase"].map((item) => (
              <span key={item} className="flex items-center gap-2"><Check className="h-4 w-4" />{item}</span>
            ))}
          </div>
        </div>

        <div className="relative flex items-center">
          <div className="w-full rounded-3xl border bg-card p-4 shadow-2xl shadow-black/5">
            <div className="rounded-2xl border bg-muted/30 p-5">
              <div className="mb-5 flex items-center justify-between">
                <div><p className="text-sm font-medium">Content overview</p><p className="text-xs text-muted-foreground">This week</p></div>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium">Workspace</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  ["12", "Drafts"],
                  ["8", "Scheduled"],
                  ["24", "Published"],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-xl border bg-background p-4">
                    <p className="text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-3">
                {["Launch announcement", "Weekly customer story", "Product tips"].map((item, index) => (
                  <div key={item} className="flex items-center justify-between rounded-xl border bg-background p-4">
                    <div><p className="text-sm font-medium">{item}</p><p className="text-xs text-muted-foreground">{index + 1} channel{index ? "s" : ""}</p></div>
                    <span className="text-xs text-muted-foreground">{index === 0 ? "Today" : "Draft"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="solutions" className="border-y bg-muted/25">
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
          <p className="text-sm font-medium text-muted-foreground">BUILT FOR</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {solutions.map((solution) => <div key={solution} className="rounded-2xl border bg-background p-5 text-base font-medium">{solution}</div>)}
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-muted-foreground">FEATURES</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">A calmer way to manage social content.</h2>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted"><Icon className="h-5 w-5" /></div>
              <h3 className="mt-5 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="border-y bg-muted/25">
        <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium text-muted-foreground">PRICING</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">Start simple. Scale when you need to.</h2>
            <p className="mt-4 text-muted-foreground">The product foundation is ready for the publishing, scheduling, and analytics capabilities we will add next.</p>
          </div>
          <div className="mx-auto mt-10 max-w-md rounded-3xl border bg-background p-8 shadow-sm">
            <p className="text-sm font-medium">Starter</p>
            <p className="mt-3 text-4xl font-semibold">Free</p>
            <p className="mt-2 text-sm text-muted-foreground">Core workspace access while the platform is being built.</p>
            <Button asChild className="mt-6 w-full"><Link href="/auth/sign-up">Create account</Link></Button>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <p>© {new Date().getFullYear()} OmniSocial</p>
        <p>Social publishing workspace</p>
      </footer>
    </main>
  );
}
