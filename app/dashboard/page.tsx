import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  FileEdit,
  Link2,
  Plus,
  Send,
  Sparkles,
  Timer,
  UserRound,
} from "lucide-react";
import { redirect } from "next/navigation";

export const instant = false;

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { PostStatusBadge } from "@/components/post-status-badge";

const platformNames: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  threads: "Threads",
  linkedin: "LinkedIn",
  x: "X",
  youtube: "YouTube",
  tiktok: "TikTok",
};

const platformMarks: Record<string, string> = {
  facebook: "f",
  instagram: "◎",
  threads: "@",
  linkedin: "in",
  x: "𝕏",
  youtube: "▶",
  tiktok: "♪",
};

function formatDate(value: string | null) {
  if (!value) return "No date set";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function StatIcon({ type }: { type: string }) {
  const Icon =
    type === "accounts"
      ? Link2
      : type === "drafts"
        ? FileEdit
        : type === "scheduled"
          ? CalendarClock
          : type === "published"
            ? CheckCircle2
            : CircleAlert;

  return <Icon className="size-4" />;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claims?.claims?.sub) {
    redirect("/auth/login");
  }

  const profileId = String(claims.claims.sub);
  const { data: profile } = await supabase
    .from("socialmedia_profiles")
    .select("workspace_id")
    .eq("id", profileId)
    .maybeSingle();

  const workspaceId = profile?.workspace_id ?? "";

  const [
    accountsResult,
    connectedPlatformsResult,
    draftsResult,
    scheduledResult,
    publishedResult,
    failedResult,
    upcomingResult,
    recentResult,
    usersResult,
  ] = await Promise.all([
    supabase
      .from("socialmedia_social_accounts")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profileId)
      .eq("status", "connected"),
    supabase
      .from("socialmedia_social_accounts")
      .select("id, platform, account_name, username, avatar_url, provider_account_url")
      .eq("profile_id", profileId)
      .eq("status", "connected")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("socialmedia_posts")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profileId)
      .eq("status", "draft"),
    supabase
      .from("socialmedia_posts")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profileId)
      .eq("status", "scheduled"),
    supabase
      .from("socialmedia_posts")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profileId)
      .eq("status", "published"),
    supabase
      .from("socialmedia_posts")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profileId)
      .eq("status", "failed"),
    supabase
      .from("socialmedia_posts")
      .select("id, content, status, scheduled_at")
      .eq("profile_id", profileId)
      .eq("status", "scheduled")
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(5),
    supabase
      .from("socialmedia_posts")
      .select("id, content, status, scheduled_at, created_at")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("socialmedia_users")
      .select("id, name")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true }),
  ]);

  const stats = [
    { key: "accounts", label: "Connected accounts", value: accountsResult.count ?? 0, helper: "Ready to publish" },
    { key: "drafts", label: "Drafts", value: draftsResult.count ?? 0, helper: "Waiting for your ideas" },
    { key: "scheduled", label: "Scheduled", value: scheduledResult.count ?? 0, helper: "Queued for publishing" },
    { key: "published", label: "Published", value: publishedResult.count ?? 0, helper: "Successfully published" },
    { key: "failed", label: "Failed", value: failedResult.count ?? 0, helper: "Need your attention" },
  ];

  const hasDataError = [
    accountsResult.error,
    connectedPlatformsResult.error,
    draftsResult.error,
    scheduledResult.error,
    publishedResult.error,
    failedResult.error,
    upcomingResult.error,
    recentResult.error,
    usersResult.error,
  ].some(Boolean);

  const hasPublishingUser = (usersResult.data?.length ?? 0) > 0;
  const hasConnectedAccount = (accountsResult.count ?? 0) > 0;
  const hasFirstPost = (publishedResult.count ?? 0) > 0;
  const onboardingComplete = hasPublishingUser && hasConnectedAccount && hasFirstPost;

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-background via-background to-accent/35 p-6 shadow-sm sm:p-8">
        <div className="absolute -right-20 -top-24 size-64 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-28 left-1/3 size-52 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <Badge variant="secondary" className="rounded-full border-primary/15 bg-primary/10 px-3 py-1 text-primary-foreground">
              <Sparkles className="mr-1.5 size-3.5" />
              Your social workspace
            </Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Good to see you back.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
              Keep your content organized, stay ahead of your schedule, and publish from one focused workspace.
            </p>
          </div>
          <Button asChild size="lg" className="w-full sm:w-fit">
            <Link href="/create-post"><Plus />Create post</Link>
          </Button>
        </div>
      </section>

      {!onboardingComplete && !hasDataError && (
        <Card className="overflow-hidden border-primary/20 bg-primary/[0.03] shadow-sm">
          <CardHeader className="border-b bg-background/60">
            <Badge variant="secondary" className="w-fit rounded-full border-primary/15 bg-primary/10 text-primary-foreground">
              <Sparkles className="mr-1.5 size-3.5" />Get started
            </Badge>
            <CardTitle className="mt-2 text-xl">Set up your publishing workflow</CardTitle>
            <CardDescription>
              Complete these steps to go from a new workspace to your first successful post.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 p-4 sm:p-5 lg:grid-cols-3">
            {[
              {
                done: hasPublishingUser,
                icon: UserRound,
                title: "Create a publishing user",
                description: hasPublishingUser ? "Your publishing identity is ready." : "Create the identity you will publish as.",
                href: "/users",
                action: "Create user",
              },
              {
                done: hasConnectedAccount,
                icon: Link2,
                title: "Connect a social account",
                description: hasConnectedAccount ? "A social destination is connected." : "Connect the platform where you want to publish.",
                href: "/connect-accounts",
                action: "Connect account",
              },
              {
                done: hasFirstPost,
                icon: Send,
                title: "Publish your first post",
                description: hasFirstPost ? "Your first post was published successfully." : "Create a post and publish it when you're ready.",
                href: "/create-post",
                action: "Create post",
              },
            ].map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className={`rounded-2xl border p-4 transition ${step.done ? "border-primary/20 bg-background" : "bg-background hover:border-primary/30 hover:shadow-sm"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className={`flex size-10 items-center justify-center rounded-xl ${step.done ? "bg-primary/10 text-primary" : "bg-muted"}`}>
                      {step.done ? <CheckCircle2 className="size-5" /> : <Icon className="size-5" />}
                    </div>
                    {step.done && <Badge variant="outline" className="text-primary">Complete</Badge>}
                  </div>
                  <h3 className="mt-4 text-sm font-semibold">{step.title}</h3>
                  <p className="mt-1 min-h-10 text-xs leading-5 text-muted-foreground">{step.description}</p>
                  {!step.done && <Button asChild size="sm" className="mt-4 w-full"><Link href={step.href}>{step.action}<ArrowUpRight /></Link></Button>}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {hasDataError && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Some workspace metrics could not be loaded. The rest of your dashboard is still available.
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.key} className="group overflow-hidden shadow-sm transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-primary/25 hover:shadow-lg">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground transition group-hover:scale-105">
                  <StatIcon type={stat.key} />
                </div>
                <span className="text-2xl font-semibold tracking-tight">{stat.value}</span>
              </div>
              <p className="mt-4 text-sm font-medium">{stat.label}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{stat.helper}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="flex-row items-start justify-between space-y-0 border-b bg-muted/15">
          <div>
            <CardTitle>Connected platforms</CardTitle>
            <CardDescription className="mt-1">
              Your publishing destinations at a glance.
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/connect-accounts"><Link2 />Manage</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          {connectedPlatformsResult.data && connectedPlatformsResult.data.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {connectedPlatformsResult.data.map((account) => {
                const platform = String(account.platform).toLowerCase();
                const name = platformNames[platform] ?? account.platform;
                const mark = platformMarks[platform] ?? "?";
                return (
                  <Link
                    key={account.id}
                    href="/connect-accounts"
                    className="group flex items-center gap-3 rounded-2xl border bg-background p-3.5 transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/45 hover:shadow-sm"
                    title="Manage connected account"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted font-bold text-sm transition group-hover:bg-primary group-hover:text-primary-foreground">
                      {mark}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {account.username ? "@" + account.username : account.account_name}
                      </p>
                    </div>
                    <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition group-hover:text-foreground" />
                  </Link>
                );
              })}
            </div>
          ) : (
            <Link
              href="/connect-accounts"
              className="group flex items-center justify-between gap-4 rounded-2xl border border-dashed bg-muted/15 p-5 transition hover:border-primary/30 hover:bg-accent/35"
            >
              <div>
                <p className="text-sm font-semibold">Connect your first platform</p>
                <p className="mt-1 text-sm text-muted-foreground">Facebook, Instagram, Threads, LinkedIn, X, YouTube, or TikTok.</p>
              </div>
              <ArrowUpRight className="size-4 shrink-0 transition group-hover:translate-x-0.5" />
            </Link>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <Card className="shadow-sm">
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Upcoming schedule</CardTitle>
              <CardDescription className="mt-1">Your next scheduled posts, in order.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {upcomingResult.data && upcomingResult.data.length > 0 ? (
              <div className="divide-y rounded-2xl border">
                {upcomingResult.data.map((post) => (
                  <div key={post.id} className="flex items-center gap-4 p-4 transition hover:bg-accent/35">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted"><Timer className="size-4" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{post.content?.trim() || "Untitled post"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDate(post.scheduled_at)}</p>
                    </div>
                    <PostStatusBadge status="scheduled" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed bg-muted/20 px-6 py-12 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-background shadow-sm"><CalendarClock className="size-5 text-muted-foreground" /></div>
                <h3 className="mt-4 text-sm font-semibold">Nothing scheduled yet</h3>
                <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">Once you schedule a post, the next publishing slots will appear here.</p>
                <Button asChild variant="outline" className="mt-5"><Link href="/create-post">Plan a post</Link></Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription className="mt-1">Jump straight into your next task.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {[
              { href: "/create-post", icon: Send, title: "Create a post", description: "Write and prepare content" },
              { href: "/connect-accounts", icon: Link2, title: "Connect an account", description: "Add a social channel" },
              { href: "/post-history", icon: FileEdit, title: "Review history", description: "See recent publishing activity" },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group flex items-center gap-3 rounded-2xl border p-4 transition-[transform,border-color,background-color] duration-200 hover:-translate-y-px hover:border-primary/25 hover:bg-accent/35"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted transition group-hover:bg-background"><Icon className="size-4" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{action.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{action.description}</p>
                  </div>
                  <ArrowUpRight className="size-4 text-muted-foreground transition group-hover:text-foreground" />
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </section>

      <Card className="shadow-sm">
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription className="mt-1">The latest posts and changes in your workspace.</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm"><Link href="/post-history">View history <ArrowUpRight /></Link></Button>
        </CardHeader>
        <CardContent>
          {recentResult.data && recentResult.data.length > 0 ? (
            <div className="divide-y rounded-2xl border">
              {recentResult.data.map((post) => (
                <div key={post.id} className="flex items-center gap-4 p-4 transition hover:bg-accent/35">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                    {post.status === "published" ? <CheckCircle2 className="size-4" /> : post.status === "failed" ? <CircleAlert className="size-4" /> : post.status === "scheduled" ? <CalendarClock className="size-4" /> : <FileEdit className="size-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{post.content?.trim() || "Untitled post"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Created {formatDate(post.created_at)}</p>
                  </div>
                  <PostStatusBadge status={post.status} />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed bg-muted/20 px-6 py-12 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-background shadow-sm"><FileEdit className="size-5 text-muted-foreground" /></div>
              <h3 className="mt-4 text-sm font-semibold">Your workspace is ready</h3>
              <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">Create a draft to start building your publishing history. Your activity will appear here automatically.</p>
              <Button asChild className="mt-5"><Link href="/create-post"><Plus />Create a post</Link></Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
