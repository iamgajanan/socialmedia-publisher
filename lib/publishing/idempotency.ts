export function buildIdempotencyKey(postId: string, socialAccountId: string): string {
  return `social-publisher:v1:${postId}:${socialAccountId}`;
}
