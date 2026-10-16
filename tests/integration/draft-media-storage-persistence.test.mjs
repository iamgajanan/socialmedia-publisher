import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const editPage = readFileSync("app/post-history/[id]/edit/page.tsx", "utf8");

test("draft media metadata is read with admin Storage access only after the post is profile-scoped", () => {
  assert.match(editPage, /\.eq\("profile_id",userId\)/);
  assert.match(editPage, /const ownedPaths=mediaPaths\.filter\(\(path\)=>path\.startsWith\(\`\$\{userId\}\/\`\)&&!path\.includes\("\.\."\)\)/);
  assert.match(editPage, /createAdminClient\(\)/);
  assert.match(editPage, /admin\.storage\.from\("social-media-assets"\)\.list\(userId/);
  assert.match(editPage, /item\.name===storageName/);
  assert.match(editPage, /available=Boolean\(isOwned&&file\?\.name\)/);
});

test("draft media metadata lookup does not depend on end-user Storage SELECT ownership metadata", () => {
  assert.doesNotMatch(editPage, /supabase\.storage\.from\("social-media-assets"\)\.list/);
});
