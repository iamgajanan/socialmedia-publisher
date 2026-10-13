-- Restrict the legacy shared rate-limit store to trusted server-side callers.
-- The application uses public.socialmedia_consume_rate_limit through service_role.
-- service_role bypasses RLS; authenticated/anon callers have no direct table or RPC access.

alter table public.socialmedia_rate_limits enable row level security;

revoke all on table public.socialmedia_rate_limits from public, anon, authenticated;
grant all on table public.socialmedia_rate_limits to service_role;

revoke all on function public.socialmedia_consume_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.socialmedia_consume_rate_limit(text, integer, integer)
  to service_role;

comment on table public.socialmedia_rate_limits is
  'Internal server-side rate-limit counters. RLS enabled; direct access is restricted to service_role.';
