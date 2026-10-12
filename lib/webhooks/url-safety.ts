import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpsRequest } from "node:https";

type Address = { address: string; family: number };

function ipv4Number(address: string): number | null {
  if (isIP(address) !== 4) return null;
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return (((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256 + parts[3]) >>> 0;
}

function inV4Range(address: string, base: string, bits: number): boolean {
  const value = ipv4Number(address);
  const network = ipv4Number(base);
  if (value === null || network === null) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (value & mask) === (network & mask);
}

function ipv6Parts(input: string): number[] | null {
  let address = input.toLowerCase().split("%")[0] ?? "";
  if (isIP(address) !== 6) return null;

  // Convert a dotted IPv4 tail (including IPv4-mapped notation) into two hextets.
  const ipv4Tail = address.match(/(\\d{1,3}(?:\\.\\d{1,3}){3})$/);
  if (ipv4Tail) {
    const value = ipv4Number(ipv4Tail[1]);
    if (value === null) return null;
    const high = ((value >>> 16) & 0xffff).toString(16);
    const low = (value & 0xffff).toString(16);
    address = address.slice(0, -ipv4Tail[1].length) + high + ":" + low;
  }

  const halves = address.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
  const parts = [...left, ...Array.from({ length: missing }, () => "0"), ...right];
  if (parts.length !== 8 || parts.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return null;
  return parts.map((part) => Number.parseInt(part, 16));
}

function inV6Range(address: string, base: string, bits: number): boolean {
  const value = ipv6Parts(address);
  const network = ipv6Parts(base);
  if (!value || !network) return false;
  const fullWords = Math.floor(bits / 16);
  for (let index = 0; index < fullWords; index++) {
    if (value[index] !== network[index]) return false;
  }
  const remainingBits = bits % 16;
  if (remainingBits === 0) return true;
  const mask = (0xffff << (16 - remainingBits)) & 0xffff;
  return ((value[fullWords] ?? 0) & mask) === ((network[fullWords] ?? 0) & mask);
}

export function isPublicIpAddress(input: string): boolean {
  const address = input.toLowerCase().split("%")[0] ?? "";
  const family = isIP(address);
  if (family === 4) {
    const blocked: Array<[string, number]> = [
      ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
      ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
      ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
      ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
    ];
    return !blocked.some(([base, bits]) => inV4Range(address, base, bits));
  }
  if (family !== 6) return false;

  // Only global-unicast IPv6 is eligible. Prefix comparisons use parsed 128-bit
  // values so expanded/compressed spellings of special ranges behave identically.
  if (!inV6Range(address, "2000::", 3)) return false;
  const blocked: Array<[string, number]> = [
    ["2001::", 23],       // IETF protocol assignments, including Teredo/ORCHID ranges
    ["2001:db8::", 32],   // Documentation
    ["2002::", 16],       // 6to4
    ["3fff::", 20],       // Documentation
  ];
  return !blocked.some(([base, bits]) => inV6Range(address, base, bits));
}

export function validateWebhookUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Webhook URL is invalid.");
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (url.protocol !== "https:") throw new Error("Webhook delivery requires HTTPS.");
  if (url.username || url.password) throw new Error("Webhook URLs must not contain credentials.");
  const nonPublicSuffixes = [
    ".localhost", ".local", ".internal", ".test", ".invalid", ".example",
    ".arpa", ".onion", ".home", ".home.arpa", ".lan", ".corp",
  ];
  if (!hostname || hostname === "localhost" || hostname === "local" ||
      hostname === "internal" || hostname === "test" ||
      nonPublicSuffixes.some((suffix) => hostname.endsWith(suffix))) {
    throw new Error("Webhook URL hostname is not publicly routable.");
  }
  if (isIP(hostname) && !isPublicIpAddress(hostname)) {
    throw new Error("Webhook URL resolves to a non-public IP address.");
  }
  return url;
}

async function resolvePublicAddress(hostname: string): Promise<Address> {
  if (isIP(hostname)) {
    if (!isPublicIpAddress(hostname)) throw new Error("Webhook URL resolves to a non-public IP address.");
    return { address: hostname, family: isIP(hostname) };
  }
  let addresses: Address[];
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("Webhook hostname could not be resolved.");
  }
  if (addresses.length === 0 || addresses.some((entry) => !isPublicIpAddress(entry.address))) {
    throw new Error("Webhook hostname resolves to a non-public IP address.");
  }
  return addresses[0];
}

export async function postPublicHttpsJson(
  rawUrl: string,
  headers: Record<string, string>,
  body: string,
  timeoutMs = 10_000,
): Promise<{ status: number; ok: boolean; body: string }> {
  const url = validateWebhookUrl(rawUrl);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const pinned = await resolvePublicAddress(hostname);
  const pinnedLookup = ((...args: unknown[]) => {
    const options = args[1] as { all?: boolean } | undefined;
    const callback = args[2] as (...values: unknown[]) => void;
    if (options?.all) callback(null, [{ address: pinned.address, family: pinned.family }]);
    else callback(null, pinned.address, pinned.family);
  }) as never;

  return await new Promise((resolve, reject) => {
    const request = httpsRequest(url, {
      method: "POST",
      headers,
      lookup: pinnedLookup,
      servername: isIP(hostname) ? undefined : hostname,
    }, (response) => {
      const chunks: Buffer[] = [];
      let bytes = 0;
      response.on("data", (chunk: Buffer | string) => {
        if (bytes >= 4000) return;
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        const remaining = 4000 - bytes;
        chunks.push(buffer.subarray(0, remaining));
        bytes += Math.min(buffer.length, remaining);
      });
      response.on("end", () => {
        const status = response.statusCode ?? 0;
        resolve({ status, ok: status >= 200 && status < 300, body: Buffer.concat(chunks).toString("utf8") });
      });
      response.on("error", reject);
    });
    request.setTimeout(timeoutMs, () => request.destroy(new Error("Webhook request timed out.")));
    request.on("error", reject);
    request.end(body);
  });
}
