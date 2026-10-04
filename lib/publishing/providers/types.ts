import "server-only";

export type PublisherAccount = {
  id: string; platform: string; external_account_id: string; account_name: string;
  username: string | null; metadata: Record<string, unknown>;
  token_expires_at: string | null;
};
export type MediaAsset = { path: string; url: string; mimeType: string; size: number };
export type PublishInput = { account: PublisherAccount; content: string; media: MediaAsset[]; idempotencyKey: string };
export type PublishResult = { platformPostId: string };
export type Publisher = {
  platform: string;
  validate(input: PublishInput): void;
  publish(input: PublishInput, accessToken: string): Promise<PublishResult>;
  refreshToken?(account: PublisherAccount, refreshToken: string): Promise<{ accessToken: string; expiresIn?: number } | null>;
  refreshAccessToken?(account: PublisherAccount, accessToken: string): Promise<{ accessToken: string; expiresIn?: number } | null>;
  getAccount(accessToken: string): Promise<Partial<PublisherAccount>>;
  disconnect?(accessToken: string, account: PublisherAccount): Promise<void>;
};
export class PublisherError extends Error {
  readonly retryable: boolean;
  readonly code: string;
  readonly retryAfterSeconds: number | null;

  constructor(message: string, options: { retryable?: boolean; code?: string; retryAfterSeconds?: number | null } = {}) {
    super(message);
    this.name = "PublisherError";
    this.retryable = options.retryable ?? false;
    this.code = options.code ?? "provider_error";
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
  }
}
