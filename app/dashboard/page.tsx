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
} from "lucide-react";
import { redirect } from "next/navigation";

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

const statusStyles = {
  draft: "secondary",
  scheduled: "outline",
  published: "default",
  failed: "destructive",
} as const;

const statusLabels = {
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
  failed: "Failed",
} as const;

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

  const [
    accountsResult,
    draftsResult,
    scheduledResult,
    publishedResult,
    failedResult,
    upcomingResult,
    recentResult,
  ] = await Promise.all([
    supabase
      .from("socialmedia_social_accounts")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profileId)
      .eq("status", "connected"),
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
  ]);

  const stats = [
    {
      key: "accounts",
      label: "Connected accounts",
      value: accountsResult.count ?? 0,
      helper: "Ready to publish",
    },
    {
      key: "drafts",
      label: "Drafts",
      value: draftsResult.count ?? 0,
      helper: "Waiting for your ideas",
    },
    {
      key: "scheduled",
      label: "Scheduled",
      value: scheduledResult.count ?? 0,
      helper: "Queued for publishing",
    },
    {
      key: "published",
      label: "Published",
      value: publishedResult.count ?? 0,
      helper: "Successfully published",
    },
    {
      key: "failed",
      label: "Failed",
      value: failedResult.count ?? 0,
      helper: "Need your attention",
    },
  ];

  const hasDataError = [
    accountsResult.error,
    draftsResult.error,
    scheduledResult.error,
    publishedResult.error,
    failedResult.error,
    upcomingResult.error,
    recentResult.error,
  ].some(Boolean);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-background via-background to-muted/70 p-6 shadow-sm sm:p-8">
        <div className="absolute -right-20 -top-24 size-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <Badge variant="secondary" className="rounded-full px-3 py-1">
              <Sparkles className="mr-1.5 size-3.5" />
              Your social workspace
            </Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Good to see you back.
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              Keep your content organized, stay ahead of your schedule, and
              publish from one focused workspace.
            </p>
          </div>
          <Button asChild size="lg" className="w-full sm:w-fit">
            <Link href="/create-post">
              <Plus />
              Create your first post
            </Link>
          </Button>
        </div>
      </section>

      {hasDataError && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Some workspace metrics could not be loaded. The rest of your
          dashboard is still available.
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.key} className="overflow-hidden shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex size-9 items-center justify-center rounded-xl bg-muted">
                  <StatIcon type={stat.key} />
                </div>
                <span className="text-2xl font-semibold tracking-tight">
                  {stat.value}
                </span>
              </div>
              <p className="mt-4 text-sm font-medium">{stat.label}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {stat.helper}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <Card className="shadow-sm">
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Upcoming schedule</CardTitle>
              <CardDescription className="mt-1">
                Your next scheduled posts, in order.
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/calendar">
                View calendar
                <ArrowUpRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {upcomingResult.data && upcomingResult.data.length > 0 ? (
              <div className="divide-y rounded-2xl border">
                {upcomingResult.data.map((post) => (
                  <div
                    key={post.id}
                    className="flex items-center gap-4 p-4 transition hover:bg-muted/40"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                      <Timer className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {post.content?.trim() || "Untitled post"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(post.scheduled_at)}
                      </p>
                    </div>
                    <Badge variant="outline">Scheduled</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed bg-muted/20 px-6 py-12 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-background shadow-sm">
                  <CalendarClock className="size-5 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-sm font-semibold">
                  Nothing scheduled yet
                </h3>
                <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                  Once you schedule a post, the next few publishing slots will
                  appear here.
                </p>
                <Button asChild variant="outline" className="mt-5">
                  <Link href="/create-post">Plan a post</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription className="mt-1">
              Jump straight into your next task.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {[
              {
                href: "/create-post",
                icon: Send,
                title: "Create a post",
                description: "Write and prepare content",
              },
              {
                href: "/connect-accounts",
                icon: Link2,
                title: "Connect an account",
                description: "Add a social channel",
              },
              {
                href: "/post-history",
                icon: FileEdit,
                title: "Review history",
                description: "See recent publishing activity",
              },
            ].map((action) => {
              const Icon = action.icon;
              return (
                {action.href === "/connect-accounts" ? (
                  <a
                    key={action.href}
                    href={action.href}
                    className="group flex items-center gap-3 rounded-2xl border p-4 transition hover:border-foreground/20 hover:bg-muted/40"
                  >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted transition group-hover:bg-background">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{action.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {action.description}
                    </p>
                  </div>
                  <ArrowUpRight className="size-4 text-muted-foreground transition group-hover:text-foreground" />
                  </a>
                ) : (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="group flex items-center gap-3 rounded-2xl border p-4 transition hover:border-foreground/20 hover:bg-muted/40"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted transition group-hover:bg-background">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{action.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{action.description}</p>
                    </div>
                    <ArrowUpRight className="size-4 text-muted-foreground transition group-hover:text-foreground" />
                  </Link>
                )}
              );
            })}
          </CardContent>
        </Card>
      </section>

      <Card className="shadow-sm">
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription className="mt-1">
              The latest posts and changes in your workspace.
            </CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/post-history">
              View history
              <ArrowUpRight />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentResult.data && recentResult.data.length > 0 ? (
            <div className="divide-y rounded-2xl border">
              {recentResult.data.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center gap-4 p-4 transition hover:bg-muted/40"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                    {post.status === "published" ? (
                      <CheckCircle2 className="size-4" />
                    ) : post.status === "failed" ? (
                      <CircleAlert className="size-4" />
                    ) : post.status === "scheduled" ? (
                      <CalendarClock className="size-4" />
                    ) : (
                      <FileEdit className="size-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {post.content?.trim() || "Untitled post"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Created {formatDate(post.created_at)}
                    </p>
                  </div>
                  <Badge
                    variant={
                      statusStyles[post.status as keyof typeof statusStyles] ??
                      "secondary"
                    }
                  >
                    {statusLabels[post.status as keyof typeof statusLabels] ??
                      post.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed bg-muted/20 px-6 py-12 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-background shadow-sm">
                <FileEdit className="size-5 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-sm font-semibold">
                Your workspace is ready
              </h3>
              <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                Create a draft to start building your publishing history. Your
                activity will appear here automatically.
              </p>
              <Button asChild className="mt-5">
                <Link href="/create-post">
                  <Plus />
                  Create a post
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
