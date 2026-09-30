-- Phase 15: Stripe billing persistence.
-- Stripe is the source of truth for payment; the workspace stores only identifiers
-- and the minimum subscription state needed by the application.

do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='socialmedia_workspaces' and column_name='stripe_price_id') then
    alter table public.socialmedia_workspaces add column stripe_price_id text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='socialmedia_workspaces' and column_name='stripe_billing_currency') then
    alter table public.socialmedia_workspaces add column stripe_billing_currency text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='socialmedia_workspaces' and column_name='stripe_current_period_end') then
    alter table public.socialmedia_workspaces add column stripe_current_period_end timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='socialmedia_workspaces' and column_name='stripe_checkout_session_id') then
    alter table public.socialmedia_workspaces add column stripe_checkout_session_id text;
  end if;
end $$;

alter table public.socialmedia_workspaces
  drop constraint if exists socialmedia_workspaces_stripe_billing_currency_check;

alter table public.socialmedia_workspaces
  add constraint socialmedia_workspaces_stripe_billing_currency_check
  check (stripe_billing_currency is null or stripe_billing_currency in ('inr', 'usd'));

do $$ begin
  if not exists (select 1 from pg_constraint where conname='socialmedia_workspaces_stripe_checkout_session_id_key') then
    alter table public.socialmedia_workspaces add constraint socialmedia_workspaces_stripe_checkout_session_id_key unique (stripe_checkout_session_id);
  end if;
end $$;

alter table public.socialmedia_plans
  drop constraint if exists socialmedia_plans_monthly_post_limit_check;

alter table public.socialmedia_plans
  add constraint socialmedia_plans_monthly_post_limit_check check (monthly_post_limit >= 0);

update public.socialmedia_plans
set monthly_post_limit = 0,
    unlimited_publishing = true,
    updated_at = now();

create index if not exists socialmedia_workspaces_subscription_status_idx
  on public.socialmedia_workspaces (subscription_status, updated_at desc);

create index if not exists socialmedia_workspaces_stripe_customer_id_idx
  on public.socialmedia_workspaces (stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists socialmedia_workspaces_stripe_subscription_id_idx
  on public.socialmedia_workspaces (stripe_subscription_id)
  where stripe_subscription_id is not null;
