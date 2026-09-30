import Link from "next/link";
import { CalendarClock, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { redirect } from "next/navigation";

import { RescheduleForm } from "@/components/schedule/reschedule-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

function formatDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value));
}

function pageHref(page: number) {
  return page > 1 ? `/schedule?page=${page}` : "/schedule";
}

export const instant = false;

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims?.sub) redirect("/auth/login");

  const userId = String(claims.claims.sub);
  const params = await searchParams;
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = 20;
  const offset = (page - 1) * pageSize;
  const [{ data: profile }, { data: posts, error, count }] = await Promise.all([
    supabase.from("socialmedia_profiles").select("timezone").eq("id", userId).maybeSingle(),
    supabase.from("socialmedia_posts").select("id, content, scheduled_at, created_at", { count: "exact" }).eq("profile_id", userId).eq("status", "scheduled").not("scheduled_at", "is", null).order("scheduled_at", { ascending: true }).order("id", { ascending: true }).range(offset, offset + pageSize - 1),
  ]);

  const timezone = profile?.timezone || "Asia/Kolkata";
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / pageSize));
  const currentPage = Math.min(page, totalPages);

  return (
    <div className="space-y-8">
      <section>
        <Badge variant="secondary"><CalendarClock className="mr-1.5 size-3.5" />Scheduling</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Scheduled posts</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Review upcoming posts and move them to a new time without changing their destinations or idempotency keys.</p>
      </section>

      {error ? (
        <Card><CardContent className="p-6 text-sm text-destructive">Scheduled posts could not be loaded.</CardContent></Card>
      ) : posts && posts.length > 0 ? (
        <>
          <div className="grid gap-4">
            {posts.map((post) => (
              <Card key={post.id} className="shadow-sm">
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <CardTitle className="line-clamp-2 text-base">{post.content?.trim() || "Untitled post"}</CardTitle>
                      <CardDescription className="mt-1 flex items-center gap-1.5"><Clock3 className="size-3.5" />{formatDate(post.scheduled_at!, timezone)}</CardDescription>
                    </div>
                    <Badge variant="outline">{timezone}</Badge>
                  </div>
                </CardHeader>
                <CardContent><RescheduleForm postId={post.id} scheduledAt={post.scheduled_at!} timezone={timezone} /></CardContent>
              </Card>
            ))}
          </div>
          {totalPages > 1 && <div className="flex items-center justify-between rounded-2xl border bg-muted/20 p-3"><Button asChild variant="outline" size="sm" disabled={currentPage <= 1}><Link href={pageHref(currentPage - 1)} aria-disabled={currentPage <= 1}><ChevronLeft />Previous</Link></Button><span className="text-xs text-muted-foreground">Page {currentPage} of {totalPages} · {count ?? 0} scheduled</span><Button asChild variant="outline" size="sm" disabled={currentPage >= totalPages}><Link href={pageHref(currentPage + 1)} aria-disabled={currentPage >= totalPages}>Next<ChevronRight /></Link></Button></div>}
        </>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted"><CalendarClock className="size-6" /></div>
            <h2 className="mt-5 text-xl font-semibold">Nothing scheduled</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Schedule a post from the composer and it will appear here for quick rescheduling.</p>
            <Button asChild className="mt-6"><Link href="/create-post"><CalendarClock />Schedule a post</Link></Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
