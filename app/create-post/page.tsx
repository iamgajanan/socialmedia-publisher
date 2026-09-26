import Link from "next/link";
import { Link2, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";

import { PostComposer } from "@/components/create-post/post-composer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function CreatePostPage() {
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims?.sub) redirect("/auth/login");
  const userId = String(claims.claims.sub);

  const [{ data: accounts }, { data: profile }] = await Promise.all([
    supabase
      .from("socialmedia_social_accounts")
      .select("id, platform, account_name, username, avatar_url")
      .eq("profile_id", userId)
      .eq("status", "connected")
      .order("created_at", { ascending: false }),
    supabase
      .from("socialmedia_profiles")
      .select("timezone")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  const timezone = profile?.timezone || "Asia/Kolkata";

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              <Sparkles className="mr-1.5 size-3.5" />Composer
            </Badge>
            <span className="text-xs text-muted-foreground">Phase 8</span>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Create a post</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Compose once, choose your destinations, and save a draft or prepare a scheduled post.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/connect-accounts"><Link2 />Manage accounts</Link>
        </Button>
      </section>
      {(accounts?.length ?? 0) > 0 ? (
        <PostComposer accounts={accounts ?? []} timezone={timezone} />
      ) : (
        <Card className="border-dashed shadow-sm">
          <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted"><Link2 className="size-6" /></div>
            <h2 className="mt-5 text-xl font-semibold">Connect an account first</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Your composer needs at least one connected destination. Connect a Facebook, Instagram, LinkedIn, X, YouTube, or TikTok account to start.
            </p>
            <Button asChild className="mt-6"><Link href="/connect-accounts">Connect social account</Link></Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
