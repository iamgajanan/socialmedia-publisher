import { NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api/api-auth";
import { getApiConnectedAccounts } from "@/lib/api/connected-accounts";
import { normalizeConnectedAccount, parsePlatformFilter } from "@/lib/api/connected-accounts-core";
import { apiJson, getRequestId, withRequestId } from "@/lib/api/api-response";

async function GETImpl(request: Request) {
  const requestId = getRequestId(request);
  const authentication = await authenticateApiRequest(request);
  if (!authentication.ok) {
    return apiJson(
      { error: authentication.error },
      authentication.status,
      requestId,
      authentication.retryAfterSeconds ? { "Retry-After": String(authentication.retryAfterSeconds) } : undefined,
    );
  }

  const url = new URL(request.url);
  const filter = parsePlatformFilter(url.searchParams.get("platforms"));
  if (filter.error) return apiJson({ error: filter.error, code: "invalid_platform_filter" }, 400, requestId);

  const result = await getApiConnectedAccounts(authentication.profileId, filter.platforms);
  if (result.error) return apiJson({ error: result.error, code: "accounts_lookup_failed" }, 500, requestId);

  const accounts = result.accounts
    .map(normalizeConnectedAccount)
    .filter((account): account is NonNullable<typeof account> => account !== null);

  return apiJson({ accounts, count: accounts.length }, 200, requestId);
}

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  return withRequestId(await GETImpl(request), requestId);
}
