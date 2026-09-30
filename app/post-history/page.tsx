import Link from "next/link";
import { ChevronLeft, ChevronRight, FileEdit, Search } from "lucide-react";
import { redirect } from "next/navigation";

import { HistoryFilters, HistoryList } from "@/components/post-history/history-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

const PAGE_SIZE = 20;
const VALID_STATUSES = ["draft", "scheduled", "publishing", "published", "failed", "cancelled"] as const;
const PLATFORM_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  threads: "Threads",
  linkedin: "LinkedIn",
  x: "X",
  youtube: "YouTube",
  tiktok: "TikTok",
};

type SearchParams = Promise<{ q?: string; status?: string; page?: string }>;

function sanitizeSearch(value: string) {
  return value.replace(/[%_]/g, "").trim().slice(0, 120);
}

function pageHref(page: number, query: string, status: string) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `/post-history?${search}` : "/post-history";
}

export default async function PostHistoryPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims?.sub) redirect("/auth/login");

  const userId = String(claims.claims.sub);
  const params = await searchParams;
  const query = sanitizeSearch(params.q ?? "");
  const status = params.status ?? "";
  const safeStatus = VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number]) ? status : "";
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  let matchingPostIds: string[] | null = null;
  if (query) {
    const [contentResult, accountResult] = await Promise.all([
      supabase.from("socialmedia_posts").select("id").eq("profile_id", userId).ilike("content", `%${query}%`).limit(5000),
      supabase.from("socialmedia_social_accounts").select("id").eq("profile_id", userId).or(`platform.ilike.%${query}%,account_name.ilike.%${query}%,username.ilike.%${query}%`).limit(5000),
    ]);
    const matchingIds = new Set((contentResult.data ?? []).map((row) => row.id));
    const accountIds = (accountResult.data ?? []).map((row) => row.id);
    if (accountIds.length) {
      const { data: platformLinks } = await supabase.from("socialmedia_post_platforms").select("post_id").in("social_account_id", accountIds).limit(5000);
      for (const row of platformLinks ?? []) matchingIds.add(row.post_id);
    }
    const { data: platformNameLinks } = await supabase.from("socialmedia_post_platforms").select("post_id").eq("platform", query).limit(5000);
    for (const row of platformNameLinks ?? []) matchingIds.add(row.post_id);
    matchingPostIds = [...matchingIds];
  }

  const offset = (page - 1) * PAGE_SIZE;
  let postQuery = supabase
    .from("socialmedia_posts")
    .select("id,content,status,scheduled_at,published_at,created_at,socialmedia_user_id", { count: "exact" })
    .eq("profile_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (safeStatus) postQuery = postQuery.eq("status", safeStatus);
  if (matchingPostIds) {
    if (!matchingPostIds.length) postQuery = postQuery.eq("id", "00000000-0000-0000-0000-000000000000");
    else postQuery = postQuery.in("id", matchingPostIds);
  }
  const { data: posts, error, count } = await postQuery.range(offset, offset + PAGE_SIZE - 1);

  const postIds = (posts ?? []).map((post) => post.id);
  const links = postIds.length
    ? (await supabase.from("socialmedia_post_platforms").select("post_id,status,social_account_id,platform").in("post_id", postIds)).data ?? []
    : [];
  const accountIds = [...new Set(links.map((link) => link.social_account_id))];
  const accounts = accountIds.length
    ? (await supabase.from("socialmedia_social_accounts").select("id,platform,account_name").in("id", accountIds).eq("profile_id", userId)).data ?? []
    : [];
  const userIds = [...new Set((posts ?? []).map((post) => post.socialmedia_user_id).filter((id): id is string => Boolean(id)))];
  const publishingUsers = userIds.length
    ? (await supabase.from("socialmedia_users").select("id,name").in("id", userIds)).data ?? []
    : [];

  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  const userMap = new Map(publishingUsers.map((publishingUser) => [publishingUser.id, publishingUser.name]));
  const history = (posts ?? []).map((post) => ({
    ...post,
    publishing_user_name: userMap.get(post.socialmedia_user_id ?? "") ?? "Default",
    platforms: links
      .filter((link) => link.post_id === post.id)
      .map((link) => ({
        platform: PLATFORM_LABELS[link.platform ?? ""] ?? PLATFORM_LABELS[accountMap.get(link.social_account_id)?.platform ?? ""] ?? link.platform ?? "Platform",
        account_name: accountMap.get(link.social_account_id)?.account_name ?? "Account",
        status: link.status,
      })),
  }));

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  return (
    <div className="space-y-8">
      <section>
        <Badge variant="secondary"><FileEdit className="mr-1.5 size-3.5" />Post history</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Post history</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Search, inspect, edit, duplicate, retry, queue, reschedule, and remove your posts.</p>
      </section>

      <HistoryFilters query={query} status={safeStatus} />
      {error ? (
        <Card><CardContent className="p-6 text-sm text-destructive">Post history could not be loaded.</CardContent></Card>
      ) : history.length ? (
        <>
          <HistoryList posts={history} />
          {totalPages > 1 && (
            <div className="flex items-center justify-between rounded-2xl border bg-muted/20 p-3">
              <Button asChild variant="outline" size="sm" disabled={currentPage <= 1}>
                <Link href={pageHref(currentPage - 1, query, safeStatus)} aria-disabled={currentPage <= 1}><ChevronLeft />Previous</Link>
              </Button>
              <span className="text-xs text-muted-foreground">Page {currentPage} of {totalPages} · {count ?? 0} posts</span>
              <Button asChild variant="outline" size="sm" disabled={currentPage >= totalPages}>
                <Link href={pageHref(currentPage + 1, query, safeStatus)} aria-disabled={currentPage >= totalPages}>Next<ChevronRight /></Link>
              </Button>
            </div>
          )}
        </>
      ) : (
        <Card className="border-dashed"><CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center"><div className="flex size-14 items-center justify-center rounded-2xl bg-muted"><Search className="size-6" /></div><h2 className="mt-5 text-xl font-semibold">No posts found</h2><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Try a different search term or status filter.</p></CardContent></Card>
      )}
    </div>
  );
}
