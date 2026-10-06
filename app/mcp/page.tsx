import Link from "next/link";
import { Bot, ShieldCheck, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const tools = [
  ["list_connected_accounts", "Read-only account discovery"],
  ["publish_post", "Immediate publishing; confirm=true required"],
  ["schedule_post", "Future publishing; confirm=true required"],
  ["get_post_status", "Read publishing status"],
  ["get_analytics", "Overview, posts, accounts and reports"],
  ["generate_platform_content", "Platform-aware AI content generation"],
];

export default function McpPage() {
  return <div className="space-y-6"><header><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">AI & Automation</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">MCP server</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Connect an AI agent to OmniSocial through an authenticated, stateless Model Context Protocol endpoint.</p></header><div className="grid gap-5 lg:grid-cols-2"><Card><CardHeader><div className="flex items-center justify-between"><CardTitle className="flex items-center gap-2"><Bot className="size-5" />Connection</CardTitle><Badge>Stateless MCP</Badge></div></CardHeader><CardContent className="space-y-4"><div className="rounded-xl border bg-muted/30 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Endpoint</p><code className="mt-2 block break-all text-sm">{process.env.NEXT_PUBLIC_SITE_URL || "https://your-domain.example"}/api/mcp</code></div><div className="rounded-xl border bg-muted/30 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Authentication</p><p className="mt-2 text-sm">Use an OmniSocial API key as <code>Authorization: Bearer &lt;API_KEY&gt;</code>. Provider OAuth tokens are never exposed to MCP clients.</p></div><div className="flex flex-wrap gap-2"><Button asChild><Link href="/api-keys">Manage API keys</Link></Button><Button variant="outline" asChild><Link href="/ai-content">Open AI Content</Link></Button></div></CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5" />Safety model</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground"><p>• Read operations are available without destructive capabilities.</p><p>• Publishing and scheduling are high-impact actions and require <code>confirm=true</code>.</p><p>• There is no MCP delete/disconnect tool.</p><p>• Tool calls are audited without storing provider secrets or media contents.</p><p>• API-key rate limits and profile scoping remain enforced by the existing API layer.</p></CardContent></Card></div><Card><CardHeader><CardTitle className="flex items-center gap-2"><Terminal className="size-5" />Available tools</CardTitle></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-2">{tools.map(([name, description]) => <div key={name} className="rounded-xl border p-4"><code className="text-sm font-semibold">{name}</code><p className="mt-1 text-xs text-muted-foreground">{description}</p></div>)}</div></CardContent></Card></div>;
}
