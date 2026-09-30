# Stripe billing setup

Phase 15 uses Stripe-hosted Checkout for recurring subscriptions. The application keeps Stripe IDs and subscription state in `socialmedia_workspaces`; card details never enter OmniSocial.

## Server environment

Configure these values in Vercel and local development as needed:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER_INR`
- `STRIPE_PRICE_STARTER_USD`
- `STRIPE_PRICE_PRO_INR`
- `STRIPE_PRICE_PRO_USD`
- `STRIPE_PRICE_PREMIUM_INR`
- `STRIPE_PRICE_PREMIUM_USD`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; required by the webhook)
- `SITE_URL`

Never prefix Stripe secrets or the Supabase service-role key with `NEXT_PUBLIC_`.

## Stripe prices

Create six recurring monthly prices in Stripe:

| Plan | INR | USD |
| --- | ---: | ---: |
| Starter | ₹999 | $9 |
| Pro | ₹1,999 | $19 |
| Premium | ₹2,999 | $29 |

Use the resulting Price IDs in the six `STRIPE_PRICE_*` variables.

## Webhook

Register this HTTPS endpoint in Stripe Workbench:

`https://<production-host>/api/billing/webhook`

Subscribe to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`
- `invoice.paid`

The handler verifies the raw request body against `STRIPE_WEBHOOK_SECRET` before processing any event.

## Customer flow

1. Authenticated owner opens **Billing**.
2. They choose INR or USD and a plan.
3. OmniSocial creates/reuses the workspace's Stripe Customer.
4. OmniSocial creates a subscription Checkout Session using the configured recurring Price ID.
5. Stripe hosts the payment flow.
6. Stripe sends webhook events to OmniSocial.
7. The webhook updates the workspace's Stripe identifiers, selected plan, subscription state, currency, and current period end.
8. The customer can later use **Manage billing** to open Stripe Customer Portal.

Subscription entitlements should continue to be enforced server-side in the subscription lifecycle phase; the Phase 15 UI does not trust the browser redirect as proof of payment.

## Local webhook testing

Install the Stripe CLI and forward events to the local route:

`stripe listen --forward-to localhost:3000/api/billing/webhook`

Use the signing secret printed by the CLI as `STRIPE_WEBHOOK_SECRET`, then trigger a subscription/checkout event from the Stripe test environment.
