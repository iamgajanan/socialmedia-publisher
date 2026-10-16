export type AnalyticsAccountCapability = {
  platform: string;
  metadata: Record<string, unknown> | null;
  scopes: string[] | null;
};

export function getAnalyticsCapabilityWarning(account: AnalyticsAccountCapability): string | null {
  const platform = account.platform.toLowerCase();

  // X requires a paid API tier for the analytics endpoints used here. It is
  // intentionally outside the current release scope, so do not make the
  // daily analytics worker fail on X accounts.
  if (platform === "x") return "x_analytics_not_in_release_scope";
  if (platform !== "linkedin") return null;

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
