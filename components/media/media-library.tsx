"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, ExternalLink, FileImage, Loader2, Search, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createMediaPreviewUrl, deleteMediaFile } from "@/app/media/actions";

type MediaFile = { path: string; name: string; size: number; type: string; createdAt: string | null; updatedAt: string | null };
type SortMode = "newest" | "oldest" | "name";

function size(n: number) {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(n) / Math.log(1024)), 3);
  return (n / 1024 ** index).toFixed(index ? 1 : 0) + " " + units[index];
}

function date(value: string | null) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value)) : "Unknown date";
}

export function MediaLibrary({ initialFiles }: { initialFiles: MediaFile[] }) {
  const [files, setFiles] = useState(initialFiles);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("newest");
  const [selected, setSelected] = useState<MediaFile | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { toast } = useToast();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...files]
      .filter((file) => !q || file.name.toLowerCase().includes(q) || file.type.toLowerCase().includes(q))
      .sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : (sort === "newest" ? -1 : 1) * (new Date(a.createdAt ?? a.updatedAt ?? 0).getTime() - new Date(b.createdAt ?? b.updatedAt ?? 0).getTime()));
  }, [files, query, sort]);

  async function preview(file: MediaFile) {
    setSelected(file);
    try {
      const result = await createMediaPreviewUrl(file.path);
      setUrl(result.signedUrl);
    } catch (error) {
      setUrl(null);
      toast({ title: "Preview failed", message: error instanceof Error ? error.message : "This media file could not be previewed.", variant: "error" });
    }
  }

  async function remove(file: MediaFile) {
    if (!window.confirm(`Delete “${file.name}” from your media library?`)) return;
    setBusy(file.path);
    try {
      await deleteMediaFile(file.path);
      setFiles((current) => current.filter((item) => item.path !== file.path));
      if (selected?.path === file.path) {
        setSelected(null);
        setUrl(null);
      }
      toast({ title: "Media deleted", message: `${file.name} was removed from your library.`, variant: "success" });
    } catch (error) {
      toast({ title: "Delete failed", message: error instanceof Error ? error.message : "The media file could not be deleted.", variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  const close = () => {
    setSelected(null);
    setUrl(null);
  };

  return <>
    <Card><CardContent className="p-4 sm:p-5"><div className="flex flex-col gap-3 lg:flex-row"><div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search files by name or type…" className="pl-9" /></div><Button type="button" variant="outline" onClick={() => setSort((current) => current === "newest" ? "oldest" : current === "oldest" ? "name" : "newest")}><ArrowUpDown />{sort === "newest" ? "Newest" : sort === "oldest" ? "Oldest" : "Name"}</Button></div></CardContent></Card>
    {!filtered.length ? <Card className="border-dashed"><CardContent className="flex flex-col items-center justify-center p-16 text-center"><FileImage className="size-8 text-muted-foreground" /><h2 className="mt-4 text-xl font-semibold">{files.length ? "No matching media" : "Your media library is empty"}</h2><p className="mt-2 text-sm text-muted-foreground">{files.length ? "Try another search." : "Upload media from the post composer."}</p></CardContent></Card> : <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filtered.map((file) => <Card key={file.path} className="overflow-hidden"><button type="button" className="aspect-square w-full bg-muted" onClick={() => preview(file)} aria-label={`Preview ${file.name}`}><MediaThumbnail file={file} /></button><CardContent className="p-4"><p className="truncate text-sm font-semibold">{file.name}</p><p className="mt-1 text-xs text-muted-foreground">{size(file.size)} · {date(file.createdAt)}</p><div className="mt-3 flex gap-2"><Button size="sm" variant="outline" className="flex-1" onClick={() => preview(file)}><ExternalLink />Preview</Button><Button size="icon" variant="outline" aria-label={`Delete ${file.name}`} onClick={() => remove(file)} disabled={busy === file.path}>{busy === file.path ? <Loader2 className="animate-spin" /> : <Trash2 />}</Button></div></CardContent></Card>)}</div>}
    {selected && url && <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-3 pt-16 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true"><button className="absolute inset-0" aria-label="Close preview" onClick={close} /><div className="relative z-10 w-full max-w-4xl overflow-hidden rounded-2xl border bg-background shadow-2xl"><div className="flex items-center justify-between border-b p-3"><p className="truncate text-sm font-semibold">{selected.name}</p><Button size="icon" variant="ghost" onClick={close}><X /></Button></div><div className="flex max-h-[75vh] items-center justify-center p-4">{selected.type.startsWith("image/") ? <img src={url} alt={selected.name} className="max-h-[70vh] max-w-full object-contain" /> : <video src={url} controls className="max-h-[70vh] max-w-full" />}</div></div></div>}
  </>;
}

function MediaThumbnail({ file }: { file: MediaFile }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void createMediaPreviewUrl(file.path).then((result) => { if (active) setUrl(result.signedUrl); }).catch(() => { if (active) setUrl(null); });
    return () => { active = false; };
  }, [file.path]);
  if (!url) return <div className="flex size-full items-center justify-center"><Loader2 className="animate-spin" /></div>;
  return file.type.startsWith("video/") ? <video src={url} muted playsInline preload="metadata" className="size-full object-cover" /> : <img src={url} alt="" className="size-full object-cover" />;
}
