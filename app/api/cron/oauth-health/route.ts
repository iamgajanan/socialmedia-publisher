import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runFacebookOAuthHealthChecks } from "@/lib/social/oauth-health";

export const maxDuration = 60;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json({
      ok: true,
      ...(await runFacebookOAuthHealthChecks()),
    });
  } catch (error) {
    console.error("cron_oauth_health_failed", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { ok: false, error: "OAuth health worker failed." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
