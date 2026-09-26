"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FileImage, Film, Loader2, Upload, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "social-media-assets";
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
];

export type UploadedMedia = {
  path: string;
  name: string;
  type: string;
  size: number;
};

function safeFileName(name: string) {
  const cleaned = name.normalize("NFKC").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return cleaned.slice(-120) || "media";
}

export function MediaUploader({
  uploaded,
  onUploaded,
}: {
  uploaded: UploadedMedia[];
  onUploaded: (media: UploadedMedia[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;

    setUploading(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Your session has expired. Please sign in again.");

      const results: UploadedMedia[] = [];
      for (const file of Array.from(files)) {
        if (!ACCEPTED_TYPES.includes(file.type)) {
          throw new Error(`Unsupported file type: ${file.type || "unknown"}.`);
        }
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(`${file.name} is larger than the 100 MB upload limit.`);
        }

        const path = `${userData.user.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false,
        });
        if (error) throw new Error(`Could not upload ${file.name}: ${error.message}`);

        results.push({ path, name: file.name, type: file.type, size: file.size });
      }

      onUploaded([...uploaded, ...results]);
      setMessage(`${results.length} media file${results.length === 1 ? "" : "s"} uploaded.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mt-5 rounded-2xl border bg-muted/20 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Media</p>
          <p className="text-xs leading-5 text-muted-foreground">Upload images or videos to your private media storage.</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES.join(",")}
          className="sr-only"
          onChange={(event) => handleFiles(event.target.files)}
          disabled={uploading}
        />
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
          {uploading ? "Uploading…" : "Upload media"}
        </Button>
      </div>

      {uploaded.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {uploaded.map((item) => (
            <div key={item.path} className="flex min-w-0 items-center gap-3 rounded-xl border bg-background p-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                {item.type.startsWith("video/") ? <Film className="size-4" /> : <FileImage className="size-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{item.name}</span>
                <span className="block text-xs text-muted-foreground">{(item.size / 1024 / 1024).toFixed(1)} MB · {item.type.split("/")[1]?.toUpperCase()}</span>
              </span>
              <CheckCircle2 className="size-4 shrink-0 text-primary" />
            </div>
          ))}
        </div>
      )}

      {message && (
        <div className={cn("mt-3 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs", message.includes("uploaded") ? "border-primary/20 bg-primary/5" : "border-destructive/30 bg-destructive/5 text-destructive")}>
          {message.includes("uploaded") ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <XCircle className="mt-0.5 size-4 shrink-0" />}
          <span>{message}</span>
        </div>
      )}
    </div>
  );
}
