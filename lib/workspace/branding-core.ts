export type WorkspaceBranding = {
  slug: string | null;
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
  custom_domain: string | null;
};

export type WorkspaceBrandingRow = {
  [Key in keyof WorkspaceBranding]?: WorkspaceBranding[Key] | null;
} | null | undefined;

export const DEFAULT_WORKSPACE_BRANDING: WorkspaceBranding = {
  slug: null,
  logo_url: null,
  primary_color: "#111827",
  accent_color: "#f59e0b",
  custom_domain: null,
};

export function normalizeWorkspaceBranding(row: WorkspaceBrandingRow): WorkspaceBranding {
  return {
    slug: row?.slug ?? null,
    logo_url: row?.logo_url ?? null,
    primary_color: row?.primary_color ?? DEFAULT_WORKSPACE_BRANDING.primary_color,
    accent_color: row?.accent_color ?? DEFAULT_WORKSPACE_BRANDING.accent_color,
    custom_domain: row?.custom_domain ?? null,
  };
}

export function isMissingWorkspaceBrandingColumn(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error || (error.code !== "PGRST204" && error.code !== "42703")) return false;
  return /(slug|logo_url|primary_color|accent_color|custom_domain)/i.test(error.message ?? "");
}
