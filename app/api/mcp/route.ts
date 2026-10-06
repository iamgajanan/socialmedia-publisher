import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api/api-auth";
import { getBearerToken } from "@/lib/api/api-key-auth";
import { discoveryResult, executeTool, MCP_PROTOCOL_VERSION, MCP_TOOLS } from "@/lib/mcp/server";

function rpc(id: unknown, result: unknown, status = 200) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, result }, { status, headers: { "Cache-Control": "no-store", "MCP-Protocol-Version": MCP_PROTOCOL_VERSION } });
}
function errorRpc(id: unknown, code: number, message: string, data?: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message, ...(data === undefined ? {} : { data }) } }, { status: 200, headers: { "Cache-Control": "no-store", "MCP-Protocol-Version": MCP_PROTOCOL_VERSION } });
}

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") || randomUUID();
  const bearerToken = getBearerToken(request);
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error, code: "authentication_failed", request_id: requestId }, { status: auth.status, headers: auth.retryAfterSeconds ? { "Retry-After": String(auth.retryAfterSeconds) } : undefined });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return errorRpc(null, -32700, "Parse error."); }
  const id = body.id;
  const method = String(body.method ?? "");
  const params = (body.params && typeof body.params === "object" ? body.params : {}) as Record<string, unknown>;

  if (method === "notifications/initialized") return new NextResponse(null, { status: 202, headers: { "MCP-Protocol-Version": MCP_PROTOCOL_VERSION } });
  if (method === "initialize") return rpc(id, { protocolVersion: "2025-11-25", capabilities: { tools: {} }, serverInfo: { name: "OmniSocial MCP", version: "1.0.0" }, instructions: "Use tools/list_connected_accounts for read-only account discovery. Publishing and scheduling require confirm=true." });
  if (method === "server/discover") return rpc(id, discoveryResult());
  if (method === "tools/list") return rpc(id, { tools: MCP_TOOLS, ttlMs: 300000, cacheScope: "public" });
  if (method === "tools/call") {
    const name = String(params.name ?? "");
    const tool = MCP_TOOLS.find((item) => item.name === name);
    if (!tool) return errorRpc(id, -32602, "Unknown tool.", { code: "unknown_tool" });
    const ctx = { profileId: auth.profileId, apiKeyId: auth.apiKeyId, bearerToken: bearerToken ?? "", origin: new URL(request.url).origin, requestId };
    const result = await executeTool(ctx, name, (params.arguments && typeof params.arguments === "object" ? params.arguments : {}) as Record<string, unknown>);
    return rpc(id, result);
  }
  return errorRpc(id, -32601, `Method not found: ${method}`);
}

export async function GET() {
  return NextResponse.json({ error: "MCP Streamable HTTP uses POST requests. GET is not available for stateless MCP 2026-07-28.", code: "method_not_allowed" }, { status: 405, headers: { Allow: "POST" } });
}

export async function DELETE() {
  return NextResponse.json({ error: "MCP sessions are not used by the OmniSocial stateless endpoint.", code: "method_not_allowed" }, { status: 405, headers: { Allow: "POST" } });
}
