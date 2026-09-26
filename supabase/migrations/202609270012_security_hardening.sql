-- Phase 12: security hardening.
create table if not exists public.socialmedia_account_secrets (
  social_account_id uuid primary key references public.socialmedia_social_accounts(id) on delete cascade,
  access_token_ciphertext text,
  refresh_token_ciphertext text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
revoke all on public.socialmedia_account_secrets from public, anon, authenticated;
grant select, insert, update, delete on public.socialmedia_account_secrets to service_role;
insert into public.socialmedia_account_secrets (social_account_id, access_token_ciphertext, refresh_token_ciphertext)
select id, access_token_ciphertext, refresh_token_ciphertext from public.socialmedia_social_accounts
where access_token_ciphertext is not null or refresh_token_ciphertext is not null
on conflict (social_account_id) do update set access_token_ciphertext=excluded.access_token_ciphertext, refresh_token_ciphertext=excluded.refresh_token_ciphertext;
alter table public.socialmedia_social_accounts drop column if exists access_token_ciphertext, drop column if exists refresh_token_ciphertext;
create table if not exists public.socialmedia_rate_limits (key text primary key, window_started_at timestamptz not null, request_count integer not null default 0, updated_at timestamptz not null default now());
revoke all on public.socialmedia_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.socialmedia_rate_limits to service_role;
create or replace function public.socialmedia_consume_rate_limit(p_key text,p_limit integer,p_window_seconds integer) returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare current_row public.socialmedia_rate_limits%rowtype; now_at timestamptz:=clock_timestamp();
begin
 if p_limit<1 or p_window_seconds<1 then return false; end if;
 select * into current_row from public.socialmedia_rate_limits where key=p_key for update;
 if not found then insert into public.socialmedia_rate_limits(key,window_started_at,request_count,updated_at) values(p_key,now_at,1,now_at); return true; end if;
 if current_row.window_started_at <= now_at-make_interval(secs=>p_window_seconds) then update public.socialmedia_rate_limits set window_started_at=now_at,request_count=1,updated_at=now_at where key=p_key; return true; end if;
 if current_row.request_count>=p_limit then return false; end if;
 update public.socialmedia_rate_limits set request_count=request_count+1,updated_at=now_at where key=p_key; return true;
end; $$;
revoke all on function public.socialmedia_consume_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.socialmedia_consume_rate_limit(text,integer,integer) to service_role;
revoke insert, update, delete on public.socialmedia_notification_logs from authenticated, anon;
grant select on public.socialmedia_notification_logs to authenticated;