import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export function getRequestId(request: Request): string {
  return request.headers.get("x-request-id")?.trim() || randomUUID();
}

export function apiJson(
  body: unknown,
  status: number,
  requestId: string,
  extraHeaders?: Record<string, string>,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Request-Id": requestId,
      ...extraHeaders,
    },
  });
}

export function withRequestId(response: Response, requestId: string): Response {
  if (!response.headers.has("X-Request-Id")) response.headers.set("X-Request-Id", requestId);
  if (!response.headers.has("Cache-Control")) response.headers.set("Cache-Control", "no-store");
  return response;
}
