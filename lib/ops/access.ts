import "server-only";

import { createClient } from "@/lib/supabase/server";

function getAllowedEmails() {
  return (process.env.OPS_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireOpsAdmin() {
  const allowedEmails = getAllowedEmails();
  if (!allowedEmails.length) return null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email?.trim().toLowerCase();
  if (!email || !allowedEmails.includes(email)) return null;

  return user;
}
