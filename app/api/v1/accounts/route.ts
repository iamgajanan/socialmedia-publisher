import { NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api/api-auth";
import { getApiConnectedAccounts } from "@/lib/api/connected-accounts";
import { normalizeConnectedAccount, parsePlatformFilter } from "@/lib/api/connected-accounts-core";

export async function GET(request: Request) {
  const authentication = await authenticateApiRequest(request);
  if (!authentication.ok) return NextResponse.json({ error: authentication.error }, { status: authentication.status });

  const url = new URL(request.url);
  const filter = parsePlatformFilter(url.searchParams.get("platforms"));
  if (filter.error) return NextResponse.json({ error: filter.error }, { status: 400 });

  const result = await getApiConnectedAccounts(authentication.profileId, filter.platforms);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });

  const accounts = result.accounts
    .map(normalizeConnectedAccount)
    .filter((account): account is NonNullable<typeof account> => account !== null);

  return NextResponse.json({ accounts, count: accounts.length });
}
