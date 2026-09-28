import "server-only";

export type MetaPageDestination = {
  id: string;
  name: string;
  accessToken: string;
  tasks: string[];
  instagramBusinessAccountId: string | null;
};

type MetaPagePayload = {
  data?: Array<{
    id?: string;
    name?: string;
    access_token?: string;
    tasks?: string[];
    instagram_business_account?: { id?: string };
  }>;
};

export async function discoverMetaPages(accessToken: string, graphVersion: string): Promise<MetaPageDestination[]> {
  const endpoint = new URL(`https://graph.facebook.com/${graphVersion}/me/accounts`);
  endpoint.searchParams.set("fields", "id,name,access_token,tasks,instagram_business_account");
  endpoint.searchParams.set("access_token", accessToken);

  const response = await fetch(endpoint, { method: "GET", cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Meta Page discovery failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as MetaPagePayload;
  return (payload.data ?? [])
    .map((page) => ({
      id: typeof page.id === "string" ? page.id : "",
      name: typeof page.name === "string" ? page.name : "",
      accessToken: typeof page.access_token === "string" ? page.access_token : "",
      tasks: Array.isArray(page.tasks) ? page.tasks.filter((task): task is string => typeof task === "string") : [],
      instagramBusinessAccountId:
        typeof page.instagram_business_account?.id === "string" ? page.instagram_business_account.id : null,
    }))
    .filter((page) => page.id && page.name && page.accessToken);
}

export function canCreatePageContent(page: MetaPageDestination) {
  return page.tasks.includes("CREATE_CONTENT");
}
