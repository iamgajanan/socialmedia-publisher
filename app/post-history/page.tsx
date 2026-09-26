import Link from "next/link";
import { FileEdit, Plus, Search } from "lucide-react";
import { redirect } from "next/navigation";

import { HistoryFilters, HistoryList } from "@/components/post-history/history-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

type SearchParams = Promise<{ q?: string; status?: string }>;

export default async function PostHistoryPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims?.sub) redirect("/auth/login");
  const userId = String(claims.claims.sub);
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const status = params.status ?? "";
  const validStatuses = ["draft","scheduled","publishing","published","failed"];
  const safeStatus = validStatuses.includes(status) ? status : "";

  let postQuery = supabase.from("socialmedia_posts").select("id,content,status,scheduled_at,published_at,created_at").eq("profile_id",userId).order("created_at",{ascending:false}).limit(100);
  if (safeStatus) postQuery = postQuery.eq("status",safeStatus);
  if (query) postQuery = postQuery.ilike("content",`%${query.replace(/[%_]/g,"")}%`);
  const { data: posts, error } = await postQuery;
  const postIds = (posts ?? []).map((p)=>p.id);
  const { data: links } = postIds.length ? await supabase.from("socialmedia_post_platforms").select("post_id,status,social_account_id").in("post_id",postIds) : {data:[]};
  const accountIds = [...new Set((links ?? []).map((l)=>l.social_account_id))];
  const { data: accounts } = accountIds.length ? await supabase.from("socialmedia_social_accounts").select("id,platform,account_name").in("id",accountIds).eq("profile_id",userId) : {data:[]};
  const accountMap = new Map((accounts ?? []).map((a)=>[a.id,a]));
  const history = (posts ?? []).map((post)=>({ ...post, platforms:(links ?? []).filter((l)=>l.post_id===post.id).map((l)=>({platform:accountMap.get(l.social_account_id)?.platform ?? "unknown",account_name:accountMap.get(l.social_account_id)?.account_name ?? "Account",status:l.status})) }));
  const filtered = query ? history.filter((p)=>p.content.toLowerCase().includes(query.toLowerCase()) || p.platforms.some((x)=>x.platform.toLowerCase().includes(query.toLowerCase()) || x.account_name.toLowerCase().includes(query.toLowerCase()))) : history;
  return <div className="space-y-8">
    <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><Badge variant="secondary"><FileEdit className="mr-1.5 size-3.5"/>Post history</Badge><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Post history</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Search, inspect, edit, duplicate, retry, queue, reschedule, and remove your posts.</p></div><Button asChild><Link href="/create-post"><Plus/>Create post</Link></Button></section>
    <HistoryFilters query={query} status={safeStatus}/>
    {error ? <Card><CardContent className="p-6 text-sm text-destructive">Post history could not be loaded.</CardContent></Card> : filtered.length ? <HistoryList posts={filtered}/> : <Card className="border-dashed"><CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center"><div className="flex size-14 items-center justify-center rounded-2xl bg-muted"><Search className="size-6"/></div><h2 className="mt-5 text-xl font-semibold">No posts found</h2><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Try a different search term or status filter.</p></CardContent></Card>}
  </div>;
}
