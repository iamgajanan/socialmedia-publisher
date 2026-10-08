"use client";

import { Check, Copy, KeyRound, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast-provider";

type ApiKey = {
  id: string;
  name: string;
  tokenPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

type CreatedApiKey = ApiKey & { token: string };

function formatDate(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function ApiKeysManager() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [name, setName] = useState("");
  const [createdToken, setCreatedToken] = useState<CreatedApiKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const { toast } = useToast();

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/api-keys", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to load API keys.");
      setKeys(body.apiKeys ?? []);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to load API keys.";
      toast({ title: "API keys could not be loaded", message, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  async function createKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setCreating(true);
    setCreatedToken(null);
    setCopied(false);
    try {
      const response = await fetch("/api/v1/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to create API key.");
      setCreatedToken(body.apiKey);
      setName("");
      await loadKeys();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to create API key.";
      toast({ title: "API key creation failed", message, variant: "error" });
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(id: string) {
    if (!window.confirm("Revoke this API key? Any integration using it will stop authenticating.")) return;

    setRevokingId(id);
    try {
      const response = await fetch(`/api/v1/api-keys/${id}`, { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to revoke API key.");
      await loadKeys();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to revoke API key.";
      toast({ title: "API key revocation failed", message, variant: "error" });
    } finally {
      setRevokingId(null);
    }
  }

  async function copyToken() {
    if (!createdToken) return;
    await navigator.clipboard.writeText(createdToken.token);
    setCopied(true);
    toast({ title: "API key copied", message: "Store it somewhere secure.", variant: "success" });
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Developer</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">API keys</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create workspace credentials for n8n and other integrations to access the current OmniSocial workspace.
          </p>
        </div>
        <form onSubmit={createKey} className="flex w-full gap-2 sm:w-auto">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Key name" maxLength={80} aria-label="API key name" className="sm:w-52" />
          <Button type="submit" disabled={creating || !name.trim()}>
            {creating ? <Loader2 className="animate-spin" /> : <Plus />}
            Create key
          </Button>
        </form>
      </div>

      {createdToken ? (
        <div className="rounded-2xl border border-amber-300/60 bg-amber-50/70 p-5 dark:border-amber-500/30 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">Copy your new API key now</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                This is the only time the full token will be shown. Store it securely before leaving this page.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Input readOnly value={createdToken.token} aria-label="New API key token" className="font-mono text-xs" />
                <Button type="button" variant="outline" onClick={() => void copyToken()}>
                  {copied ? <Check /> : <Copy />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border bg-card">
        <div className="border-b px-6 py-5">
          <h2 className="font-semibold">Workspace API keys</h2>
          <p className="mt-1 text-sm text-muted-foreground">Keys are scoped to the current workspace and can be managed by workspace admins.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-muted-foreground"><Loader2 className="animate-spin" /> Loading API keys…</div>
        ) : keys.length === 0 ? (
          <div className="flex items-start gap-4 px-6 py-10">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted"><KeyRound className="h-5 w-5" /></div>
            <div>
              <h3 className="font-semibold">No API keys yet</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Create a key above to authenticate n8n or another integration.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y">
            {keys.map((apiKey) => (
              <div key={apiKey.id} className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{apiKey.name}</h3>
                    {apiKey.revokedAt ? <Badge variant="destructive">Revoked</Badge> : <Badge variant="secondary">Active</Badge>}
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{apiKey.tokenPrefix}••••••••</p>
                  <p className="mt-2 text-xs text-muted-foreground">Created {formatDate(apiKey.createdAt)} · Last used {formatDate(apiKey.lastUsedAt)}</p>
                </div>
                {!apiKey.revokedAt ? (
                  <Button type="button" variant="outline" onClick={() => void revokeKey(apiKey.id)} disabled={revokingId === apiKey.id}>
                    {revokingId === apiKey.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                    Revoke
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border bg-muted/30 px-6 py-5">
        <div className="flex items-start gap-3">
          <RotateCcw className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div>
            <h3 className="font-medium">Using your API key</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Send it as <code className="rounded bg-muted px-1 py-0.5">Authorization: Bearer &lt;your-key&gt;</code>. The API resolves the key to its workspace and calling profile. Provider credentials are never exposed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
