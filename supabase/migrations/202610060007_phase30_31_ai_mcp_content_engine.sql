create table if not exists public.socialmedia_ai_generations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.socialmedia_profiles(id) on delete cascade,
  workspace_id uuid,
  master_content text not null,
  brand_voice text,
  instructions text,
  requested_platforms text[] not null default '{}',
  model text not null,
  provider text not null default 'openai',
  status text not null default 'completed' check (status in ('processing','completed','partial','failed','approved')),
  requires_approval boolean not null default false,
  approved_at timestamptz,
  approved_by uuid,
  result jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.socialmedia_ai_content_variants (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.socialmedia_ai_generations(id) on delete cascade,
  profile_id uuid not null references public.socialmedia_profiles(id) on delete cascade,
  platform text not null,
  caption text not null default '',
  title text,
  hashtags text[] not null default '{}',
  cta text,
  media_recommendations text[] not null default '{}',
  character_count integer not null default 0,
  character_limit integer,
  validation jsonb not null default '{}'::jsonb,
  variation integer not null default 1,
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(generation_id, platform, variation)
);

create table if not exists public.socialmedia_mcp_audit_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.socialmedia_profiles(id) on delete cascade,
  api_key_id uuid references public.socialmedia_api_keys(id) on delete set null,
  request_id text,
  method text not null,
  tool_name text,
  status text not null default 'success' check (status in ('success','error','denied','input_required')),
  arguments jsonb not null default '{}'::jsonb,
  error_code text,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists socialmedia_ai_generations_profile_created_idx on public.socialmedia_ai_generations(profile_id, created_at desc);
create index if not exists socialmedia_ai_variants_generation_idx on public.socialmedia_ai_content_variants(generation_id);
create index if not exists socialmedia_ai_variants_profile_platform_idx on public.socialmedia_ai_content_variants(profile_id, platform, created_at desc);
create index if not exists socialmedia_mcp_audit_profile_created_idx on public.socialmedia_mcp_audit_logs(profile_id, created_at desc);

alter table public.socialmedia_ai_generations enable row level security;
alter table public.socialmedia_ai_content_variants enable row level security;
alter table public.socialmedia_mcp_audit_logs enable row level security;

drop policy if exists socialmedia_ai_generations_select_own on public.socialmedia_ai_generations;
create policy socialmedia_ai_generations_select_own on public.socialmedia_ai_generations for select using (profile_id = auth.uid());

drop policy if exists socialmedia_ai_variants_select_own on public.socialmedia_ai_content_variants;
create policy socialmedia_ai_variants_select_own on public.socialmedia_ai_content_variants for select using (profile_id = auth.uid());

drop policy if exists socialmedia_mcp_audit_select_own on public.socialmedia_mcp_audit_logs;
create policy socialmedia_mcp_audit_select_own on public.socialmedia_mcp_audit_logs for select using (profile_id = auth.uid());

comment on table public.socialmedia_ai_generations is 'Phase 31 platform-aware AI content generation requests and results.';
comment on table public.socialmedia_ai_content_variants is 'Phase 31 normalized per-platform content variants and validation.';
comment on table public.socialmedia_mcp_audit_logs is 'Phase 30 MCP tool invocation audit trail; arguments must never contain provider OAuth secrets.';
