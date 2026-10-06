import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api/api-auth";
import { approveGeneration, getGeneration } from "@/lib/ai/content-engine";

function json(body: unknown, status: number, requestId: string) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } }); }

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const requestId = randomUUID();
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return json({ error: auth.error, code: "authentication_failed" }, auth.status, requestId);
  const { id } = await context.params;
  const result = await getGeneration(auth.profileId, id);
  if (!result) return json({ error: "AI generation not found.", code: "generation_not_found" }, 404, requestId);
  return json({ success: true, ...result }, 200, requestId);
}

export async function POST(request: Request, context: Context) {
  const requestId = randomUUID();
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return json({ error: auth.error, code: "authentication_failed" }, auth.status, requestId);
  const { id } = await context.params;
  let body: Record<string, unknown> = {};
  try { body = await request.json(); } catch { /* empty body is accepted for approval */ }
  if (body.action !== "approve") return json({ error: "Only action=approve is supported.", code: "unsupported_action" }, 400, requestId);
  try {
    const result = await approveGeneration(auth.profileId, id, auth.profileId);
    return json({ success: true, generation: result }, 200, requestId);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unable to approve generation.", code: "approval_failed" }, 400, requestId);
  }
}
