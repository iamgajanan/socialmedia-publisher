import { CalendarDays, FileText, Search } from "lucide-react";

export default function PostHistoryPage() {
  return (
    <div className="space-y-8">
      <div><p className="text-sm font-medium text-muted-foreground">Content</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Post history</h1><p className="mt-2 text-sm text-muted-foreground">Review drafts, scheduled content, and published posts.</p></div>
      <div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input placeholder="Search posts..." className="h-10 w-full rounded-lg border bg-card pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div><select className="h-10 rounded-lg border bg-card px-3 text-sm"><option>All statuses</option><option>Draft</option><option>Scheduled</option><option>Published</option></select></div>
      <div className="rounded-2xl border bg-card"><div className="flex flex-col items-center justify-center px-6 py-20 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted"><FileText className="h-5 w-5" /></div><h2 className="mt-4 font-semibold">No content yet</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">Your saved and published posts will appear here once the content data layer is connected.</p><div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /> History storage is part of the next milestone.</div></div></div>
    </div>
  );
}
