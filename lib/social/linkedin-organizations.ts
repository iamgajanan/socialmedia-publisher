import "server-only";

const LINKEDIN_VERSION = process.env.LINKEDIN_VERSION?.trim() || "202609";

type JsonRecord = Record<string, unknown>;

export type LinkedInOrganization = {
  id: string;
  urn: string;
  name: string;
  vanityName: string | null;
  url: string | null;
  role: string | null;
  state: string | null;
};

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" ? value as JsonRecord : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function linkedInHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    "X-Restli-Protocol-Version": "2.0.0",
    "Linkedin-Version": LINKEDIN_VERSION,
    Accept: "application/json",
  };
}

async function linkedinFetch(url: string, accessToken: string) {
  const response = await fetch(url, {
    headers: linkedInHeaders(accessToken),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`LinkedIn organization API returned ${response.status}${body ? `: ${body.slice(0, 500)}` : ""}`);
  }

  return response.json() as Promise<unknown>;
}

/**
 * Finds organizations for which the authenticated member has an approved
 * organization role. LinkedIn exposes the organization URN through the
 * organizationAcls finder; organization lookup then gives us a display name.
 */
export async function discoverLinkedInOrganizations(accessToken: string): Promise<LinkedInOrganization[]> {
  const aclUrl = new URL("https://api.linkedin.com/rest/organizationAcls");
  aclUrl.searchParams.set("q", "roleAssignee");
  aclUrl.searchParams.set("role", "ADMINISTRATOR");
  aclUrl.searchParams.set("state", "APPROVED");

  const aclPayload = record(await linkedinFetch(aclUrl.toString(), accessToken));
  const elements = Array.isArray(aclPayload.elements) ? aclPayload.elements : [];

  const candidates = elements
    .map((value) => record(value))
    .filter((element) => text(element.state)?.toUpperCase() === "APPROVED")
    .map((element) => {
      const organizationTarget = text(element.organizationTarget) ?? text(element.organization);
      const decorated = record(element["organization~"]);
      const decoratedUrn = text(decorated.entityUrn) ?? text(decorated["$URN"]);
      const urn = organizationTarget ?? decoratedUrn;
      const role = text(element.role);
      if (!urn || !urn.startsWith("urn:li:organization:")) return null;
      return { urn, role, state: text(element.state) };
    })
    .filter((value): value is { urn: string; role: string | null; state: string | null } => Boolean(value));

  const unique = new Map(candidates.map((candidate) => [candidate.urn, candidate]));
  if (!unique.size) return [];

  const ids = [...unique.keys()].map((urn) => urn.replace("urn:li:organization:", "")).filter(Boolean);
  const lookupUrl = new URL("https://api.linkedin.com/rest/organizations");
  lookupUrl.searchParams.set("ids", `List(${ids.join(",")})`);

  const lookupPayload = record(await linkedinFetch(lookupUrl.toString(), accessToken));
  const results = record(lookupPayload.results);

  return ids.flatMap((id) => {
    const candidate = unique.get(`urn:li:organization:${id}`);
    const organization = record(results[id]);
    const name = text(organization.localizedName) ?? text(record(organization.name).localizedName) ?? `LinkedIn Company Page ${id}`;
    const vanityName = text(organization.vanityName);
    return [{
      id,
      urn: `urn:li:organization:${id}`,
      name,
      vanityName,
      url: vanityName ? `https://www.linkedin.com/company/${vanityName}` : null,
      role: candidate?.role ?? null,
      state: candidate?.state ?? null,
    }];
  });
}
