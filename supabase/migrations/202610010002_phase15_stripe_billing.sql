-- Phase 15: Stripe billing persistence.
-- Stripe is the source of truth for payment; the workspace stores only identifiers
-- and the minimum subscription state needed by the application.

alter table public.socialmedia_workspaces
  add column if not exists stripe_price_id text,
  add column if not exists stripe_billing_currency text,
  add column if not exists stripe_current_period_end timestamptz,
  add column if not exists stripe_checkout_session_id text;

alter table public.socialmedia_workspaces
  drop constraint if exists socialmedia_workspaces_stripe_billing_currency_check;

alter table public.socialmedia_workspaces
  add constraint socialmedia_workspaces_stripe_billing_currency_check
  check (stripe_billing_currency is null or stripe_billing_currency in ('inr', 'usd'));

alter table public.socialmedia_workspaces
  add constraint socialmedia_workspaces_stripe_checkout_session_id_key unique (stripe_checkout_session_id);

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
