import { createBrowserClient } from "@supabase/ssr";

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/SUPABASE_PUBLISHABLE_KEY environment variables.",
    );
  }

  return { url, publishableKey };
}

export function createClient() {
  const { url, publishableKey } = getSupabaseConfig();

  return createBrowserClient(url, publishableKey);
}
