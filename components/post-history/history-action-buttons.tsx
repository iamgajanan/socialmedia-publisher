"use client";

import * as React from "react";
import { useActionState, useEffect } from "react";
import { Copy, Edit3, RotateCcw, Send, Trash2 } from "lucide-react";
import Link from "next/link";

import { deletePost, duplicatePost, queuePublishNow, retryPost, type PostActionState } from "@/app/post-history/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";

function Action({ action, postId, children }: { action:(state:PostActionState, formData:FormData)=>Promise<PostActionState>; postId:string; children:React.ReactNode }) {
  const [state, formAction, pending] = useActionState(action,{ok:false,message:""});
  return <form action={formAction}><input type="hidden" name="postId" value={postId}/><Button type="submit" variant="outline" size="sm" disabled={pending}>{children}</Button>{state.message&&<span className="ml-2 text-xs text-muted-foreground">{state.message}</span>}</form>;
}
export function HistoryActionButtons({postId,status}:{postId:string;status:string}) {
 return <div className="flex flex-wrap gap-2">
  {status!=="published"&&status!=="publishing"&&<Button asChild variant="outline" size="sm"><Link href={`/post-history/${postId}/edit`}><Edit3/>Edit</Link></Button>}
  <Action action={duplicatePost} postId={postId}><Copy/>Duplicate</Action>
  {status==="failed"&&<Action action={retryPost} postId={postId}><RotateCcw/>Retry</Action>}
  {(status==="draft"||status==="scheduled")&&<Action action={queuePublishNow} postId={postId}><Send/>Queue</Action>}
  {status!=="published"&&status!=="publishing"&&<Action action={deletePost} postId={postId}><Trash2/>Delete</Action>}
 </div>;
}
