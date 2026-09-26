import { KeyRound, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ApiKeysPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-muted-foreground">Developer</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">API keys</h1><p className="mt-2 text-sm text-muted-foreground">Manage keys for future API integrations.</p></div><Button disabled><Plus /> Create key</Button></div>
      <div className="rounded-2xl border bg-card p-6"><div className="flex items-start gap-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted"><KeyRound className="h-5 w-5" /></div><div><h2 className="font-semibold">No API keys</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">API key storage and permissions will be added after the application data model is introduced.</p></div></div></div>
    </div>
  );
}
