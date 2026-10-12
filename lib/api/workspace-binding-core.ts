export function isWorkspaceBindingValid(apiKeyWorkspaceId: unknown, profileWorkspaceId: unknown): boolean {
  return typeof apiKeyWorkspaceId === "string" &&
    apiKeyWorkspaceId.length > 0 &&
    typeof profileWorkspaceId === "string" &&
    profileWorkspaceId.length > 0 &&
    apiKeyWorkspaceId === profileWorkspaceId;
}
