-- Phase 14: publishing architecture hardening.
-- Unlimited publishing is plan-wide; user and social-account caps remain enforced.

alter table public.socialmedia_plans
  add column if not exists unlimited_publishing boolean not null default false;

update public.socialmedia_plans
set unlimited_publishing = true,
    updated_at = now();

create index if not exists socialmedia_posts_status_scheduled_at_idx
  on public.socialmedia_posts (status, scheduled_at asc)
  where status = 'scheduled' and scheduled_at is not null;

create index if not exists socialmedia_posts_profile_created_id_idx
  on public.socialmedia_posts (profile_id, created_at desc, id desc);

create index if not exists socialmedia_posts_workspace_created_id_idx
  on public.socialmedia_posts (workspace_id, created_at desc, id desc);

create index if not exists socialmedia_posts_user_created_id_idx
  on public.socialmedia_posts (socialmedia_user_id, created_at desc, id desc)
  where socialmedia_user_id is not null;

create index if not exists socialmedia_post_platforms_post_status_updated_idx
  on public.socialmedia_post_platforms (post_id, status, updated_at desc);

create index if not exists socialmedia_social_accounts_workspace_user_created_idx
  on public.socialmedia_social_accounts (workspace_id, socialmedia_user_id, created_at desc);

create unique index if not exists socialmedia_social_accounts_user_platform_key
  on public.socialmedia_social_accounts (socialmedia_user_id, lower(platform))
  where socialmedia_user_id is not null;
