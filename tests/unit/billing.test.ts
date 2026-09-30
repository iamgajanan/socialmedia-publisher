import test from "node:test";
import assert from "node:assert/strict";

import { getStripePlanByPriceId, getStripePriceId } from "../../lib/stripe.ts";

test("Stripe price mapping resolves configured USD plan", () => {
  process.env.STRIPE_PRICE_STARTER_USD = "price_starter_usd_test";
  process.env.STRIPE_PRICE_PRO_USD = "price_pro_usd_test";

  assert.equal(getStripePriceId("starter"), "price_starter_usd_test");
  assert.equal(getStripePriceId("pro"), "price_pro_usd_test");
  assert.equal(getStripePlanByPriceId("price_starter_usd_test"), "starter");
  assert.equal(getStripePlanByPriceId("price_pro_usd_test"), "pro");
  assert.equal(getStripePlanByPriceId("price_unknown"), null);
});

test("Stripe price mapping ignores legacy INR variables", () => {
  process.env.STRIPE_PRICE_PREMIUM_INR = "legacy_inr_price";
  process.env.STRIPE_PRICE_PREMIUM_USD = "price_premium_usd_test";

  assert.equal(getStripePriceId("premium"), "price_premium_usd_test");
  assert.equal(getStripePlanByPriceId("legacy_inr_price"), null);
});

test("Stripe price mapping fails clearly when a USD price is not configured", () => {
  delete process.env.STRIPE_PRICE_PREMIUM_USD;
  assert.throws(() => getStripePriceId("premium"), /STRIPE_PRICE_PREMIUM_USD/);
});
