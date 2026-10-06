import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ApprovalQueue } from "@/components/ai-content/approval-queue";

export const instant = false;

export default async function ApprovalPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/auth/login");
  return <div className="space-y-6"><header><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">AI & Automation</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Content approvals</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Review AI-generated content that was explicitly marked for human approval before publishing.</p></header><ApprovalQueue /></div>;
}
