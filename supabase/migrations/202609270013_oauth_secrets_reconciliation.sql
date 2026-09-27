-- Ensure the server-only OAuth token store exists in every environment.
-- This is idempotent and reconciles databases where the security-hardening
-- migration was not applied before the OAuth callback started using it.

create table if not exists public.socialmedia_account_secrets (
  social_account_id uuid primary key references public.socialmedia_social_accounts(id) on delete cascade,
  access_token_ciphertext text,
  refresh_token_ciphertext text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on public.socialmedia_account_secrets from public, anon, authenticated;
grant select, insert, update, delete on public.socialmedia_account_secrets to service_role;

drop trigger if exists socialmedia_account_secrets_updated_at on public.socialmedia_account_secrets;
create trigger socialmedia_account_secrets_updated_at
before update on public.socialmedia_account_secrets
for each row execute function public.socialmedia_set_updated_at();
