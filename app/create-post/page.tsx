import { Link2, Sparkles, UserRound } from "lucide-react";
import { redirect } from "next/navigation";

import { PostComposer } from "@/components/create-post/post-composer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

// Phase 3 sanity verification: account-attention flow is covered in production UI.
// Publishing users are intentionally isolated: the composer only receives destinations
// belonging to the selected logical publishing user.
export const instant = false;

export default async function CreatePostPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const requestedUser = typeof params.user === "string" ? params.user : null;

  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims?.sub) redirect("/auth/login");
  const profileId = String(claims.claims.sub);

  const [{ data: profile }, { data: users, error: usersError }] = await Promise.all([
    supabase.from("socialmedia_profiles").select("timezone, workspace_id").eq("id", profileId).maybeSingle(),
    supabase.from("socialmedia_users").select("id, name").order("created_at", { ascending: true }),
  ]);

  if (!profile?.workspace_id) redirect("/users");
  if (usersError) throw new Error(usersError.message);
  if (!users?.length) redirect("/users");

  const activeUser = users.find((user) => user.id === requestedUser) ?? users[0];
  const timezone = profile.timezone || "Asia/Kolkata";

  const [{ data: accounts }, { data: attentionAccounts }] = await Promise.all([
    supabase
      .from("socialmedia_social_accounts")
      .select("id, platform, account_name, username, avatar_url, status")
      .eq("profile_id", profileId)
      .eq("socialmedia_user_id", activeUser.id)
      .eq("status", "connected")
      .order("created_at", { ascending: false }),
    supabase
      .from("socialmedia_social_accounts")
      .select("id, platform, account_name, username, avatar_url, status")
      .eq("profile_id", profileId)
      .eq("socialmedia_user_id", activeUser.id)
      .neq("status", "connected")
      .order("created_at", { ascending: false }),
  ]);

  const connectedAccounts = accounts ?? [];
  const attention = attentionAccounts ?? [];
  const switchHref = (userId: string) => `/create-post?user=${encodeURIComponent(userId)}`;

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              <Sparkles className="mr-1.5 size-3.5" />Composer
            </Badge>
            <span className="text-xs text-muted-foreground">Publishing user</span>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Create a post</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Compose for one publishing user at a time. Only the social accounts connected to that user are available as destinations.
          </p>
        </div>
        <Button asChild variant="outline"><a href="/connect-accounts"><Link2 />Manage accounts</a></Button>
      </section>

      <Card className="border-primary/15 bg-primary/[0.03] shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><UserRound className="size-5" /></div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Publishing user</p>
              <p className="mt-1 text-lg font-semibold">{activeUser.name}</p>
            </div>
          </div>
          <form action="/create-post" method="get" className="flex items-center gap-2">
            <select name="user" defaultValue={activeUser.id} aria-label="Select publishing user" className="h-10 min-w-[190px] rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
              {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
            <Button type="submit" variant="outline">Switch</Button>
          </form>
        </CardContent>
      </Card>

      {connectedAccounts.length > 0 ? (
        <PostComposer accounts={connectedAccounts} timezone={timezone} />
      ) : attention.length > 0 ? (
        <Card className="border-destructive/30 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10"><Link2 className="size-6 text-destructive" /></div>
            <h2 className="mt-5 text-xl font-semibold">Reconnect an account for {activeUser.name}</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              This publishing user has accounts that need attention before they can be used for publishing.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {attention.map((account) => <Button key={account.id} asChild><a href={`/api/social/oauth/start/${account.platform}?user=${encodeURIComponent(activeUser.id)}`}>Reconnect {account.account_name}</a></Button>)}
              <Button asChild variant="outline"><a href={`/connect-accounts?user=${encodeURIComponent(activeUser.id)}`}>Manage accounts</a></Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed shadow-sm">
          <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted"><Link2 className="size-6" /></div>
            <h2 className="mt-5 text-xl font-semibold">Connect an account for {activeUser.name}</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              No social destination is connected to this publishing user yet. Connect a platform, then come back here to create the post.
            </p>
            <Button asChild className="mt-6"><a href={`/connect-accounts?user=${encodeURIComponent(activeUser.id)}`}>Connect social account</a></Button>
          </CardContent>
        </Card>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Connected destinations are isolated by publishing user. Switch the user above to create content for another user.
      </p>
    </div>
  );
}
