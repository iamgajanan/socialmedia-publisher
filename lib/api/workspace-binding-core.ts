export function isActiveWorkspaceMembership(workspaceId: unknown, activeWorkspaceIds: readonly unknown[]): boolean {
  return typeof workspaceId === "string" &&
    workspaceId.length > 0 &&
    activeWorkspaceIds.includes(workspaceId);
}
