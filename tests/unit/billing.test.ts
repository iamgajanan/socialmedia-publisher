import test from "node:test";
import assert from "node:assert/strict";

import { getStripePlanByPriceId, getStripePriceId } from "../../lib/stripe.ts";

test("Stripe price mapping resolves configured plan and currency", () => {
  process.env.STRIPE_PRICE_STARTER_INR = "price_starter_inr_test";
  process.env.STRIPE_PRICE_PRO_USD = "price_pro_usd_test";

  assert.equal(getStripePriceId("starter", "inr"), "price_starter_inr_test");
  assert.equal(getStripePriceId("pro", "usd"), "price_pro_usd_test");
  assert.equal(getStripePlanByPriceId("price_starter_inr_test"), "starter");
  assert.equal(getStripePlanByPriceId("price_pro_usd_test"), "pro");
  assert.equal(getStripePlanByPriceId("price_unknown"), null);
});

test("Stripe price mapping fails clearly when a price is not configured", () => {
  delete process.env.STRIPE_PRICE_PREMIUM_INR;
  assert.throws(() => getStripePriceId("premium", "inr"), /STRIPE_PRICE_PREMIUM_INR/);
});
