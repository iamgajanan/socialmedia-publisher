"use client";

import Link from "next/link";
import { Copy, Edit3, Eye, RotateCcw, Send, Trash2 } from "lucide-react";
import { useActionState } from "react";

import { deletePost, duplicatePost, queuePublishNow, retryPost, type PostActionState } from "@/app/post-history/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type HistoryPost = {
  id: string; content: string; status: string; scheduled_at: string | null; published_at: string | null; created_at: string;
  platforms: { platform: string; account_name: string; status: string }[];
};

const labels: Record<string,string> = { draft:"Draft", scheduled:"Scheduled", publishing:"Publishing", published:"Published", failed:"Failed" };
const variants: Record<string,"secondary"|"outline"|"default"|"destructive"> = { draft:"secondary", scheduled:"outline", publishing:"outline", published:"default", failed:"destructive" };

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));
}

function ActionForm({ action, postId, children }: { action:(state:PostActionState, formData:FormData)=>Promise<PostActionState>; postId:string; children:React.ReactNode }) {
  const [state, formAction, pending] = useActionState(action,{ok:false,message:""});
  return <form action={formAction} className="inline-flex"><input type="hidden" name="postId" value={postId}/><Button type="submit" variant="ghost" size="sm" disabled={pending}>{children}</Button>{state.message && <span className={cn("sr-only",state.ok?"":"text-destructive")}>{state.message}</span>}</form>;
}

export function HistoryList({ posts }: { posts: HistoryPost[] }) {
  return <div className="space-y-4">
    {posts.map((post)=>(
      <Card key={post.id} className="min-w-0 overflow-hidden shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={variants[post.status] ?? "secondary"}>{labels[post.status] ?? post.status}</Badge>
                  {post.platforms.slice(0,4).map((p)=><Badge key={p.platform+p.account_name} variant="outline">{p.platform}</Badge>)}
                </div>
                <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6">{post.content || "Untitled post"}</p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                  <span>Created {formatDate(post.created_at)}</span>
                  {post.scheduled_at && <span>Scheduled {formatDate(post.scheduled_at)}</span>}
                  {post.published_at && <span>Published {formatDate(post.published_at)}</span>}
                </div>
              </div>
              <div className="flex flex-wrap gap-1 lg:max-w-sm lg:justify-end">
                <Button asChild variant="outline" size="sm"><Link href={`/post-history/${post.id}`}><Eye/>View</Link></Button>
                {post.status !== "published" && post.status !== "publishing" && <Button asChild variant="outline" size="sm"><Link href={`/post-history/${post.id}/edit`}><Edit3/>Edit</Link></Button>}
                <ActionForm action={duplicatePost} postId={post.id}><Copy/>Duplicate</ActionForm>
                {post.status === "failed" && <ActionForm action={retryPost} postId={post.id}><RotateCcw/>Retry</ActionForm>}
                {(post.status === "draft" || post.status === "scheduled") && <ActionForm action={queuePublishNow} postId={post.id}><Send/>Queue</ActionForm>}
                {post.status !== "published" && post.status !== "publishing" && <ActionForm action={deletePost} postId={post.id}><Trash2/></ActionForm>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    ))}
  </div>;
}

export function HistoryFilters({ query, status }: { query: string; status: string }) {
  return <form method="get" className="grid gap-3 rounded-2xl border bg-muted/20 p-4 sm:grid-cols-[1fr_180px_auto]">
    <div className="relative"><Input name="q" defaultValue={query} placeholder="Search post content, platform, account…" aria-label="Search posts"/><span className="sr-only">Search</span></div>
    <select name="status" defaultValue={status} aria-label="Filter by status" className="h-9 rounded-md border border-input bg-background px-3 text-sm">
      <option value="">All statuses</option><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="publishing">Publishing</option><option value="published">Published</option><option value="failed">Failed</option>
    </select>
    <Button type="submit">Filter</Button>
  </form>;
}
