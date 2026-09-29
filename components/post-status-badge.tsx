import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: {
    label: "Draft",
    className: "border-slate-400/30 bg-slate-500/10 text-slate-700 dark:text-slate-200",
  },
  pending: {
    label: "Pending",
    className: "border-slate-400/30 bg-slate-500/10 text-slate-700 dark:text-slate-200",
  },
  scheduled: {
    label: "Scheduled",
    className: "border-amber-500/30 bg-amber-400/10 text-amber-800 dark:text-amber-200",
  },
  publishing: {
    label: "Publishing",
    className: "border-orange-500/30 bg-orange-500/10 text-orange-800 dark:text-orange-200",
  },
  published: {
    label: "Published",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  },
  failed: {
    label: "Failed",
    className: "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200",
  },
  cancelled: {
    label: "Cancelled",
    className: "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-200",
  },
};

export function PostStatusBadge({ status, className }: { status: string; className?: string }) {
  const config = statusConfig[status] ?? {
    label: status.replace(/_/g, " "),
    className: "border-border bg-muted text-muted-foreground",
  };

  return (
    <Badge variant="outline" className={cn("rounded-full px-2.5 py-1", config.className, className)}>
      {config.label}
    </Badge>
  );
}
