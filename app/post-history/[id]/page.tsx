import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { RescheduleForm } from "@/components/schedule/reschedule-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { HistoryActionButtons } from "@/components/post-history/history-action-buttons";

export const instant = false;

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims?.sub) redirect("/auth/login");
  const userId = String(claims.claims.sub);
  const { data: post } = await supabase.from("socialmedia_posts").select("id,content,status,scheduled_at,published_at,created_at,updated_at,media_urls").eq("id",id).eq("profile_id",userId).maybeSingle();
  if (!post) notFound();
  const { data: links } = await supabase.from("socialmedia_post_platforms").select("id,status,platform_post_id,error_message,scheduled_at,published_at,social_account_id,retry_count,max_retries,next_retry_at,last_attempt_at,idempotency_key").eq("post_id",id).order("created_at");
  const accountIds=[...(links??[]).map((x)=>x.social_account_id)];
  const { data: accounts } = accountIds.length ? await supabase.from("socialmedia_social_accounts").select("id,platform,account_name,username,provider_account_url").in("id",accountIds).eq("profile_id",userId) : {data:[]};
  const accountMap=new Map((accounts??[]).map((a)=>[a.id,a]));
  const timezone=(await supabase.from("socialmedia_profiles").select("timezone").eq("id",userId).maybeSingle()).data?.timezone ?? "Asia/Kolkata";
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><Button asChild variant="ghost"><Link href="/post-history"><ArrowLeft/>Back to history</Link></Button><HistoryActionButtons postId={id} status={post.status}/></div>
    <section><Badge variant="secondary"><FileText className="mr-1.5 size-3.5"/>Post details</Badge><h1 className="mt-3 text-3xl font-semibold tracking-tight">Post details</h1><p className="mt-2 text-sm text-muted-foreground">Created {new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeStyle:"short"}).format(new Date(post.created_at))}</p></section>
    <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
      <Card><CardHeader><CardTitle>Content</CardTitle><CardDescription>{post.status}</CardDescription></CardHeader><CardContent><div className="whitespace-pre-wrap rounded-2xl border bg-muted/20 p-5 text-sm leading-7">{post.content}</div>{Array.isArray(post.media_urls) && post.media_urls.length>0 && <div className="mt-4 rounded-2xl border p-4 text-xs text-muted-foreground">{post.media_urls.length} media file(s) attached.</div>}</CardContent></Card>
      <Card><CardHeader><CardTitle>Timeline</CardTitle></CardHeader><CardContent className="space-y-4 text-sm"><div><p className="font-medium">Scheduled</p><p className="text-muted-foreground">{post.scheduled_at ? new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeStyle:"short",timeZone:timezone}).format(new Date(post.scheduled_at))+" ("+timezone+")" : "Not scheduled"}</p></div><div><p className="font-medium">Published</p><p className="text-muted-foreground">{post.published_at ? new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeStyle:"short",timeZone:timezone}).format(new Date(post.published_at)) : "Not published"}</p></div></CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle>Destinations</CardTitle><CardDescription>Per-account publishing state, retry metadata, and provider identifiers.</CardDescription></CardHeader><CardContent className="space-y-3">{(links??[]).map((link)=>{const a=accountMap.get(link.social_account_id);return <div key={link.id} className="rounded-2xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{a?.account_name ?? "Account"}</p><p className="text-xs text-muted-foreground">{a?.platform ?? "Unknown"}{a?.username ? " · @"+a.username : ""}</p></div><Badge variant={link.status==="failed"?"destructive":link.status==="published"?"default":"outline"}>{link.status}</Badge></div>{link.error_message&&<p className="mt-3 text-sm text-destructive">{link.error_message}</p>}<div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2"><span>Retries: {link.retry_count}/{link.max_retries}</span><span>Next retry: {link.next_retry_at ? new Date(link.next_retry_at).toLocaleString() : "—"}</span><span>Last attempt: {link.last_attempt_at ? new Date(link.last_attempt_at).toLocaleString() : "—"}</span><span>Platform post ID: {link.platform_post_id ?? "—"}</span></div></div>})}</CardContent></Card>
    {post.status==="scheduled" && post.scheduled_at && <Card><CardHeader><CardTitle>Reschedule</CardTitle></CardHeader><CardContent><RescheduleForm postId={post.id} scheduledAt={post.scheduled_at} timezone={timezone}/></CardContent></Card>}
  </div>;
}
