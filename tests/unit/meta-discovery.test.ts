import test from "node:test";
import assert from "node:assert/strict";
import { canCreatePageContent, discoverMetaPages, getInstagramBusinessProfile } from "../../lib/social/meta-discovery.ts";

test("Meta discovery only treats pages with CREATE_CONTENT as publishable", () => {
  const page = {
    id: "page-1",
    name: "Example Page",
    accessToken: "page-token",
    tasks: ["MODERATE", "CREATE_CONTENT"],
    instagramBusinessAccountId: null,
  };
  assert.equal(canCreatePageContent(page), true);
  assert.equal(canCreatePageContent({ ...page, tasks: ["MODERATE"] }), false);
});

test("Meta page discovery normalizes pages and linked Instagram account IDs", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    data: [
      { id: "page-1", name: "Example Page", access_token: "page-token", tasks: ["CREATE_CONTENT"], instagram_business_account: { id: "ig-1" } },
      { id: "page-2", name: "No Publish", access_token: "page-token-2", tasks: ["MODERATE"] },
      { name: "Incomplete", access_token: "ignored" },
    ],
  }), { status: 200 })) as typeof fetch;

  try {
    const pages = await discoverMetaPages("user-token", "v21.0");
    assert.deepEqual(pages, [{
      id: "page-1",
      name: "Example Page",
      accessToken: "page-token",
      tasks: ["CREATE_CONTENT"],
      instagramBusinessAccountId: "ig-1",
    }, {
      id: "page-2",
      name: "No Publish",
      accessToken: "page-token-2",
      tasks: ["MODERATE"],
      instagramBusinessAccountId: null,
    }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Instagram profile discovery returns publish-account metadata", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    id: "ig-1",
    username: "pashan_dental_studio",
    name: "Pashan Dental Studio",
    profile_picture_url: "https://example.com/avatar.jpg",
  }), { status: 200 })) as typeof fetch;

  try {
    const profile = await getInstagramBusinessProfile("page-token", "v21.0", "ig-1");
    assert.deepEqual(profile, {
      id: "ig-1",
      username: "pashan_dental_studio",
      name: "Pashan Dental Studio",
      avatarUrl: "https://example.com/avatar.jpg",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
