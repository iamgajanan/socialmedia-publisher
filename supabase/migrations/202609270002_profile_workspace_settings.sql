-- Phase 4: profile, workspace, and posting preferences
alter table public.socialmedia_profiles
  add column if not exists workspace_name text,
  add column if not exists timezone text not null default 'Asia/Kolkata',
  add column if not exists default_posting_preferences jsonb not null default '{}'::jsonb;

comment on column public.socialmedia_profiles.workspace_name is 'User workspace display name.';
comment on column public.socialmedia_profiles.timezone is 'IANA timezone used for scheduling and workspace display.';
comment on column public.socialmedia_profiles.default_posting_preferences is 'JSON preferences for future publishing defaults.';
