-- Phase 5: secure OAuth token storage and server-owned social accounts
alter table public.socialmedia_social_accounts
  add column if not exists access_token_ciphertext text,
  add column if not exists refresh_token_ciphertext text,
  add column if not exists token_expires_at timestamptz,
  add column if not exists refresh_token_expires_at timestamptz,
  add column if not exists scopes text[] not null default '{}',
  add column if not exists provider_account_url text;

revoke insert, update, delete on public.socialmedia_social_accounts from authenticated;

comment on column public.socialmedia_social_accounts.access_token_ciphertext is 'AES-256-GCM encrypted provider access token. Never expose to client roles.';
comment on column public.socialmedia_social_accounts.refresh_token_ciphertext is 'AES-256-GCM encrypted provider refresh token. Never expose to client roles.';
comment on column public.socialmedia_social_accounts.scopes is 'OAuth scopes granted by the provider.';
