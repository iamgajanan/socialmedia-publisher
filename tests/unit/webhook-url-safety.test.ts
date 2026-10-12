import assert from "node:assert/strict";
import test from "node:test";
import { isPublicIpAddress, validateWebhookUrl } from "../../lib/webhooks/url-safety.ts";

test("blocks private, loopback, link-local, shared and reserved IPv4 ranges", () => {
  for (const address of [
    "0.0.0.0", "10.1.2.3", "100.64.0.1", "127.0.0.1", "169.254.10.2",
    "172.16.0.1", "192.168.1.1", "198.18.0.1", "203.0.113.10", "224.0.0.1",
  ]) assert.equal(isPublicIpAddress(address), false, address);
  assert.equal(isPublicIpAddress("8.8.8.8"), true);
  assert.equal(isPublicIpAddress("1.1.1.1"), true);
});

test("blocks private and special IPv6 ranges and mapped private IPv4", () => {
  for (const address of [
    "::", "::1", "fc00::1", "fd12::1", "fe80::1", "ff02::1",
    "2001:db8::1", "2001:0db8:0000:0000:0000:0000:0000:0001",
    "2001:0000:4136:e378:8000:63bf:3fff:fdd2", "2002:0808:0808::1",
    "3fff::1", "::ffff:127.0.0.1",
  ]) {
    assert.equal(isPublicIpAddress(address), false, address);
  }
  assert.equal(isPublicIpAddress("2606:4700:4700::1111"), true);
  assert.equal(isPublicIpAddress("2606:4700:4700:0000:0000:0000:0000:1111"), true);
});

test("requires public HTTPS URLs without embedded credentials or local hostnames", () => {
  assert.equal(validateWebhookUrl("https://hooks.example.com/events").hostname, "hooks.example.com");
  for (const url of [
    "http://hooks.example.com/events",
    "https://localhost/events",
    "https://service.local/events",
    "https://user:pass@hooks.example.com/events",
    "https://127.0.0.1/events",
    "https://[::1]/events",
    "https://[2001:0db8:0000:0000:0000:0000:0000:0001]/events",
    "https://metadata.home.arpa/events",
    "https://service.onion/events",
    "https://service.internal/events",
  ]) assert.throws(() => validateWebhookUrl(url));
});
