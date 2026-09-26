import Link from "next/link";
import { ImagePlus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CreatePostPage() {
  return (
    <div className="space-y-8">
      <div><p className="text-sm font-medium text-muted-foreground">Content</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Create post</h1><p className="mt-2 text-sm text-muted-foreground">Prepare a post now; connected-channel publishing will be wired in later.</p></div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border bg-card p-6">
          <label htmlFor="post-content" className="text-sm font-medium">Post content</label>
          <textarea id="post-content" placeholder="What do you want to share?" className="mt-3 min-h-48 w-full resize-y rounded-xl border bg-background p-4 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" />
          <div className="mt-4 flex flex-col gap-3 sm:flex-row"><Button variant="outline" disabled><ImagePlus /> Add media</Button><Button variant="outline" disabled><Sparkles /> AI assist</Button></div>
          <div className="mt-6 flex justify-end gap-3"><Button variant="outline" disabled>Save draft</Button><Button disabled>Publish</Button></div>
        </div>
        <div className="rounded-2xl border bg-card p-6"><h2 className="font-semibold">Preview</h2><div className="mt-5 rounded-xl border bg-muted/20 p-5"><p className="text-sm text-muted-foreground">Your channel preview will appear here after an account is connected.</p></div><Button asChild variant="link" className="mt-4 px-0"><Link href="/connect-accounts">Connect an account</Link></Button></div>
      </div>
    </div>
  );
}
