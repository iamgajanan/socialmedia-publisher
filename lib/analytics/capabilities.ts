export type AnalyticsAccountCapability = {
  platform: string;
  metadata: Record<string, unknown> | null;
  scopes: string[] | null;
};

export function getAnalyticsCapabilityWarning(account: AnalyticsAccountCapability): string | null {
  if (account.platform.toLowerCase() !== "linkedin") return null;

  const metadata = account.metadata ?? {};
  const scopes = new Set(account.scopes ?? []);
  const organizationId = String(metadata.linkedin_organization_id ?? metadata.organization_id ?? "").trim();

  if (organizationId) {
    return scopes.has("r_organization_social") || scopes.has("rw_organization_admin")
      ? null
      : "linkedin_organization_analytics_scope_missing";
  }

  return scopes.has("r_member_postAnalytics") ? null : "linkedin_member_analytics_scope_missing";
}
