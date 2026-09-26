"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function disconnectAccount(accountId: string) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/auth/login");

  const admin = createAdminClient();
  const { error } = await admin.from("socialmedia_social_accounts").delete().eq("id", accountId).eq("profile_id", String(userId));
  if (error) redirect("/connect-accounts?error=disconnect");
  redirect("/connect-accounts?disconnected=1");
}
