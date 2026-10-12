import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_WORKSPACE_BRANDING,
  isMissingWorkspaceBrandingColumn,
  normalizeWorkspaceBranding,
} from "../../lib/workspace/branding-core.ts";

test("workspace branding defaults preserve existing workspaces without branding data", () => {
  assert.deepEqual(normalizeWorkspaceBranding(null), DEFAULT_WORKSPACE_BRANDING);
  assert.deepEqual(normalizeWorkspaceBranding(undefined), DEFAULT_WORKSPACE_BRANDING);
});

test("workspace branding preserves saved tenant-specific values", () => {
  assert.deepEqual(
    normalizeWorkspaceBranding({
      slug: "studio-123",
      logo_url: "https://cdn.example.com/logo.png",
      primary_color: "#123abc",
      accent_color: "#fedcba",
      custom_domain: "social.example.com",
    }),
    {
      slug: "studio-123",
      logo_url: "https://cdn.example.com/logo.png",
      primary_color: "#123abc",
      accent_color: "#fedcba",
      custom_domain: "social.example.com",
    },
  );
});

test("workspace branding defaults only missing nullable fields", () => {
  assert.deepEqual(
    normalizeWorkspaceBranding({ slug: null, primary_color: null, accent_color: "#abcdef" }),
    {
      slug: null,
      logo_url: null,
      primary_color: DEFAULT_WORKSPACE_BRANDING.primary_color,
      accent_color: "#abcdef",
      custom_domain: null,
    },
  );
});

test("legacy schema fallback only handles missing branding columns", () => {
  assert.equal(isMissingWorkspaceBrandingColumn({ code: "42703", message: "column logo_url does not exist" }), true);
  assert.equal(isMissingWorkspaceBrandingColumn({ code: "PGRST204", message: "Could not find the 'primary_color' column" }), true);
  assert.equal(isMissingWorkspaceBrandingColumn({ code: "42703", message: "column workspace_id does not exist" }), false);
  assert.equal(isMissingWorkspaceBrandingColumn({ code: "42501", message: "permission denied" }), false);
  assert.equal(isMissingWorkspaceBrandingColumn(null), false);
});
