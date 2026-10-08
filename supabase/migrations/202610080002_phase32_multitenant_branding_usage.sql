-- Phase 32: complete tenant isolation, workspace branding, and usage foundations.

alter table public.socialmedia_workspaces
  add column if not exists slug text,
  add column if not exists logo_url text,
  add column if not exists primary_color text not null default '#111827',
  add column if not exists accent_color text not null default '#f59e0b',
  add column if not exists custom_domain text;

update public.socialmedia_workspaces
set slug = lower(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(id::text, 1, 8)
where slug is null or trim(slug) = '';

alter table public.socialmedia_workspaces
  alter column slug set not null;

create unique index if not exists socialmedia_workspaces_slug_uidx
  on public.socialmedia_workspaces(slug);

create unique index if not exists socialmedia_workspaces_custom_domain_uidx
  on public.socialmedia_workspaces(custom_domain)
  where custom_domain is not null and trim(custom_domain) <> '';

alter table public.socialmedia_workspaces
  drop constraint if exists socialmedia_workspaces_primary_color_check;
alter table public.socialmedia_workspaces
  add constraint socialmedia_workspaces_primary_color_check
  check (primary_color ~ '^#[0-9a-fA-F]{6}$');

alter table public.socialmedia_workspaces
  drop constraint if exists socialmedia_workspaces_accent_color_check;
alter table public.socialmedia_workspaces
  add constraint socialmedia_workspaces_accent_color_check
  check (accent_color ~ '^#[0-9a-fA-F]{6}$');

alter table public.socialmedia_ai_generations
  add column if not exists workspace_id uuid;

update public.socialmedia_ai_generations g
set workspace_id = p.workspace_id
from public.socialmedia_profiles p
where g.profile_id = p.id
  and g.workspace_id is null;

alter table public.socialmedia_ai_generations
  drop constraint if exists socialmedia_ai_generations_workspace_id_fkey;
alter table public.socialmedia_ai_generations
  add constraint socialmedia_ai_generations_workspace_id_fkey
  foreign key (workspace_id) references public.socialmedia_workspaces(id) on delete cascade;

alter table public.socialmedia_ai_generations alter column workspace_id set not null;

create index if not exists socialmedia_ai_generations_workspace_created_idx
  on public.socialmedia_ai_generations(workspace_id, created_at desc);

alter table public.socialmedia_ai_content_variants
  add column if not exists workspace_id uuid;

update public.socialmedia_ai_content_variants v
set workspace_id = g.workspace_id
from public.socialmedia_ai_generations g
where v.generation_id = g.id
  and v.workspace_id is null;

alter table public.socialmedia_ai_content_variants
  drop constraint if exists socialmedia_ai_content_variants_workspace_id_fkey;
alter table public.socialmedia_ai_content_variants
  add constraint socialmedia_ai_content_variants_workspace_id_fkey
  foreign key (workspace_id) references public.socialmedia_workspaces(id) on delete cascade;

alter table public.socialmedia_ai_content_variants alter column workspace_id set not null;

create index if not exists socialmedia_ai_variants_workspace_created_idx
  on public.socialmedia_ai_content_variants(workspace_id, created_at desc);

alter table public.socialmedia_mcp_audit_logs
  add column if not exists workspace_id uuid;

update public.socialmedia_mcp_audit_logs l
set workspace_id = p.workspace_id
from public.socialmedia_profiles p
where l.profile_id = p.id
  and l.workspace_id is null;

alter table public.socialmedia_mcp_audit_logs
  drop constraint if exists socialmedia_mcp_audit_logs_workspace_id_fkey;
alter table public.socialmedia_mcp_audit_logs
  add constraint socialmedia_mcp_audit_logs_workspace_id_fkey
  foreign key (workspace_id) references public.socialmedia_workspaces(id) on delete cascade;

create index if not exists socialmedia_mcp_audit_workspace_created_idx
  on public.socialmedia_mcp_audit_logs(workspace_id, created_at desc);

alter table public.socialmedia_api_keys
  add column if not exists workspace_id uuid;

update public.socialmedia_api_keys k
set workspace_id = p.workspace_id
from public.socialmedia_profiles p
where k.profile_id = p.id
  and k.workspace_id is null;

alter table public.socialmedia_api_keys
  drop constraint if exists socialmedia_api_keys_workspace_id_fkey;
alter table public.socialmedia_api_keys
  add constraint socialmedia_api_keys_workspace_id_fkey
  foreign key (workspace_id) references public.socialmedia_workspaces(id) on delete cascade;

alter table public.socialmedia_api_keys alter column workspace_id set not null;

create index if not exists socialmedia_api_keys_workspace_created_idx
  on public.socialmedia_api_keys(workspace_id, created_at desc);

create table if not exists public.socialmedia_workspace_usage_monthly (
  workspace_id uuid not null references public.socialmedia_workspaces(id) on delete cascade,
  period_start date not null,
  posts_created integer not null default 0,
  posts_published integer not null default 0,
  ai_generations integer not null default 0,
  api_requests integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, period_start),
  check (posts_created >= 0),
  check (posts_published >= 0),
  check (ai_generations >= 0),
  check (api_requests >= 0)
);

create index if not exists socialmedia_workspace_usage_monthly_period_idx
  on public.socialmedia_workspace_usage_monthly(period_start desc);

alter table public.socialmedia_workspace_usage_monthly enable row level security;

drop policy if exists socialmedia_workspace_usage_monthly_select_member on public.socialmedia_workspace_usage_monthly;
create policy socialmedia_workspace_usage_monthly_select_member
on public.socialmedia_workspace_usage_monthly
for select to authenticated
using (workspace_id in (select private.socialmedia_user_workspace_ids()));

create or replace function public.socialmedia_workspace_usage(
  target_workspace_id uuid,
  target_period_start date
)
returns table (
  posts_created bigint,
  posts_published bigint,
  ai_generations bigint,
  api_requests bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    (select count(*) from public.socialmedia_posts p
      where p.workspace_id = target_workspace_id
        and p.created_at >= target_period_start::timestamptz
        and p.created_at < (target_period_start + interval '1 month')) as posts_created,
    (select count(*) from public.socialmedia_posts p
      where p.workspace_id = target_workspace_id
        and p.status = 'published'
        and p.published_at >= target_period_start::timestamptz
        and p.published_at < (target_period_start + interval '1 month')) as posts_published,
    (select count(*) from public.socialmedia_ai_generations g
      where g.workspace_id = target_workspace_id
        and g.created_at >= target_period_start::timestamptz
        and g.created_at < (target_period_start + interval '1 month')) as ai_generations,
    (select coalesce(u.api_requests, 0) from public.socialmedia_workspace_usage_monthly u
      where u.workspace_id = target_workspace_id
        and u.period_start = target_period_start) as api_requests;
$$;

revoke all on function public.socialmedia_workspace_usage(uuid, date) from public, anon;
grant execute on function public.socialmedia_workspace_usage(uuid, date) to authenticated;

create or replace function public.socialmedia_record_api_request(
  target_workspace_id uuid,
  target_period_start date
)
returns void
language plpgsql
security definer
set search_path = public
as $
begin
  insert into public.socialmedia_workspace_usage_monthly (workspace_id, period_start, api_requests)
  values (target_workspace_id, target_period_start, 1)
  on conflict (workspace_id, period_start)
  do update set api_requests = public.socialmedia_workspace_usage_monthly.api_requests + 1,
                updated_at = now();
end;
$;

revoke all on function public.socialmedia_record_api_request(uuid, date) from public, anon, authenticated;

comment on table public.socialmedia_workspace_usage_monthly is 'Phase 32 workspace usage foundation for plan quotas and SaaS reporting.';
comment on table public.socialmedia_workspaces is 'Shared tenant boundary including white-label branding and custom domain configuration.';

