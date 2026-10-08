"use client";

import { Building2, Check, ChevronDown } from "lucide-react";
import { useFormStatus } from "react-dom";

import { switchWorkspace } from "@/app/workspace/actions";
import { Button } from "@/components/ui/button";

type WorkspaceOption = { id: string; name: string; role: string };

function SubmitButton({ name }: { name: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="ghost" className="w-full justify-between rounded-xl px-3 py-2.5 text-left" disabled={pending}>
      <span className="flex min-w-0 items-center gap-2">
        <Building2 className="size-4 shrink-0 text-primary" />
        <span className="truncate">{pending ? "Switching…" : name}</span>
      </span>
      <Check className="size-4 opacity-0" />
    </Button>
  );
}

export function WorkspaceSwitcher({
  currentWorkspaceId,
  workspaces,
}: {
  currentWorkspaceId: string;
  workspaces: WorkspaceOption[];
}) {
  if (workspaces.length <= 1) return null;
  return (
    <div className="mt-5 rounded-2xl border bg-card p-2 shadow-sm">
      <div className="flex items-center gap-2 px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
        <span>Workspace</span><ChevronDown className="ml-auto size-3" />
      </div>
      <div className="max-h-48 space-y-1 overflow-y-auto">
        {workspaces.map((workspace) => (
          <form key={workspace.id} action={switchWorkspace}>
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <SubmitButton name={workspace.name} />
            {workspace.id === currentWorkspaceId ? <span className="sr-only">Current workspace</span> : null}
          </form>
        ))}
      </div>
    </div>
  );
}
