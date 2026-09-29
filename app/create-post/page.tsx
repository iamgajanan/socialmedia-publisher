import { Link2, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";

import { PostComposer } from "@/components/create-post/post-composer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

// Phase 3 sanity verification: account-attention flow is covered in production UI.
// Production sanity check: connected destinations render the composer; attention states render reconnect.
export const instant = false;

export default async function CreatePostPage() {
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims?.sub) redirect("/auth/login");
  const userId = String(claims.claims.sub);

  const [{ data: accounts }, { data: profile }] = await Promise.all([
    supabase
      .from("socialmedia_social_accounts")
      .select("id, platform, account_name, username, avatar_url, status")
      .eq("profile_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("socialmedia_profiles")
      .select("timezone")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  const timezone = profile?.timezone || "Asia/Kolkata";
  const connectedAccounts = (accounts ?? []).filter((account) => account.status === "connected");
  const attentionAccounts = (accounts ?? []).filter((account) => account.status !== "connected");

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
        <Button asChild variant="outline"><a href="/connect-accounts"><Link2 />Manage accounts</a></Button>
      </section>
      {connectedAccounts.length > 0 ? (
        <PostComposer accounts={connectedAccounts} timezone={timezone} />
      ) : attentionAccounts.length > 0 ? (
        <Card className="border-destructive/30 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10">
              <Link2 className="size-6 text-destructive" />
            </div>
            <h2 className="mt-5 text-xl font-semibold">Reconnect your social account</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Your connected account needs attention before it can be used for publishing. Reconnect it, then return here to create your post.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {attentionAccounts.map((account) => (
                <Button asChild><a href={`/api/social/oauth/start/${account.platform}`}>Reconnect {account.account_name}</a></Button>
              ))}
              <Button asChild variant="outline"><a href="/connect-accounts">Manage accounts</a></Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed shadow-sm">
          <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted"><Link2 className="size-6" /></div>
            <h2 className="mt-5 text-xl font-semibold">Connect an account first</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Your composer needs at least one connected destination. Connect a Facebook, Instagram, Threads, LinkedIn, X, YouTube, or TikTok account to start.
            </p>
            <Button asChild className="mt-6"><a href="/connect-accounts">Connect social account</a></Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

