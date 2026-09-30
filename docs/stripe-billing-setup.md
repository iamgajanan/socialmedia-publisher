# Stripe billing setup

Phase 15 uses Stripe-hosted Checkout for recurring subscriptions. The current release accepts **USD only**. Indian payments can be added later with Razorpay without changing the publishing-user architecture. Card details never enter OmniSocial.

## 1. Create a Stripe account

Create or sign in to your Stripe account at https://dashboard.stripe.com/.

Stripe has separate **Test mode** and **Live mode**. Build and verify OmniSocial using Test mode first. Test payments do not charge a real card.

## 2. Get the Stripe secret key

In the Stripe Dashboard, turn on **Test mode**, then open **Developers → API keys**. Copy the **Secret key** (`sk_test_...`). Never commit it to GitHub or expose it as `NEXT_PUBLIC_*`.

For production, switch to Live mode and use the live Secret key (`sk_live_...`) only in Vercel Production environment variables.

## 3. Create the three USD recurring prices

Create three Products in Test mode and add a recurring monthly Price to each:

| Plan | Monthly price | Environment variable |
| --- | ---: | --- |
| Starter | $9/month | `STRIPE_PRICE_STARTER_USD` |
| Pro | $19/month | `STRIPE_PRICE_PRO_USD` |
| Premium | $29/month | `STRIPE_PRICE_PREMIUM_USD` |

After creating each recurring price, open its Price details and copy the Price ID (`price_...`) into the matching environment variable.

Do the same again in **Live mode** before production. Test-mode Price IDs and live Price IDs are different.

## 4. Configure local/test environment

Use:

- `STRIPE_SECRET_KEY=sk_test_...`
- `STRIPE_PRICE_STARTER_USD=price_...`
- `STRIPE_PRICE_PRO_USD=price_...`
- `STRIPE_PRICE_PREMIUM_USD=price_...`
- `SUPABASE_SERVICE_ROLE_KEY=...`
- `SITE_URL=http://localhost:3000`

Never put Stripe secret keys or the Supabase service-role key in client-side code.

## 5. Get the webhook signing secret

Install the Stripe CLI, authenticate it with your Stripe account, then run:

`stripe listen --forward-to localhost:3000/api/billing/webhook`

The CLI prints a webhook signing secret beginning with `whsec_...`. Put that value in:

`STRIPE_WEBHOOK_SECRET=whsec_...`

This is the easiest way to test the webhook locally. The application verifies the raw webhook payload before updating the workspace subscription.

## 6. Test checkout

Run OmniSocial locally, open **Billing**, choose Starter/Pro/Premium, and select the plan. Checkout opens on Stripe's hosted page.

Use Stripe's official test card numbers from its testing documentation. The common successful Visa test card is:

`4242 4242 4242 4242`

Use any future expiry date, any three-digit CVC, and any valid-looking postal code when Stripe asks for them. Test mode does not charge the card.

After checkout, Stripe sends webhook events and OmniSocial updates the workspace subscription state. The browser redirect alone is not treated as proof of payment.

## 7. Webhook events

For production, register this HTTPS endpoint in Stripe Workbench:

`https://<production-host>/api/billing/webhook`

Subscribe to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`
- `invoice.paid`

The webhook handler verifies the raw request body against `STRIPE_WEBHOOK_SECRET` before processing an event.

## 8. Vercel production setup

Add the following server-only environment variables in the Vercel project:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER_USD`
- `STRIPE_PRICE_PRO_USD`
- `STRIPE_PRICE_PREMIUM_USD`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SITE_URL`

For Preview/testing, use the `sk_test_...`, `whsec_...`, and Test-mode Price IDs. For Production, use the corresponding Live-mode values.

## 9. Switch to production

Before accepting real payments:

1. Finish Stripe account/business verification as required by Stripe.
2. Create the same three products and monthly USD prices in Live mode.
3. Copy the three Live Price IDs.
4. Get the Live Secret key from **Developers → API keys**.
5. Create the production webhook endpoint and copy its signing secret.
6. Add the live values to Vercel Production only.
7. Redeploy.
8. Make one small real transaction and verify the Checkout → webhook → workspace subscription flow.

Do not reuse Test-mode Price IDs or webhook secrets in Production.

## Customer flow

1. Authenticated owner opens **Billing**.
2. They choose a USD plan.
3. OmniSocial creates/reuses the workspace Stripe Customer.
4. OmniSocial creates a subscription Checkout Session using the configured USD recurring Price ID.
5. Stripe hosts the payment flow.
6. Stripe sends webhook events to OmniSocial.
7. The webhook updates the workspace's Stripe identifiers, selected plan, subscription state, currency, and current period end.
8. The customer can later use **Manage billing** to open Stripe Customer Portal.

## Indian payments later

Razorpay can be added later as a separate payment provider for INR/Indian payment methods. Keep the current Stripe integration USD-only and do not mix Razorpay credentials into the Stripe flow.
