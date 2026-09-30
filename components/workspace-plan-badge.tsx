import Link from "next/link";
import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { WorkspacePlan } from "@/lib/workspace/server";

export function WorkspacePlanBadge({ plan }: { plan: WorkspacePlan }) {
  return (
    <Link href="/team" className="inline-flex items-center gap-2 rounded-full transition hover:opacity-90" title={`Current plan: ${plan.name}`}>
      <Badge variant="secondary" className="rounded-full px-3 py-1">
        <Sparkles className="mr-1.5 size-3.5 text-primary" />
        {plan.name}
      </Badge>
    </Link>
  );
}
