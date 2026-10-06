import { redirect } from "next/navigation";
import { AiContentStudio } from "@/components/ai-content/ai-content-studio";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function AiContentPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/auth/login");
  return <div className="space-y-6"><header><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">AI & Automation</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">AI Content</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Create platform-native social content from one master message. Every output is validated against destination character limits before you copy or publish it.</p></header><AiContentStudio /></div>;
}
