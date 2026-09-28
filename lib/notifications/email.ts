import "server-only";

export type NotificationEmailPayload = Record<string, unknown>;

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function getPostTitle(content: unknown, fallback = "Untitled post") {
  const value = stringValue(content);
  if (!value) return fallback;
  const firstLine = value.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? value;
  return firstLine.length > 100 ? `${firstLine.slice(0, 97)}...` : firstLine;
}

function formatPlatform(platform: string) {
  const names: Record<string, string> = {
    facebook: "Facebook",
    instagram: "Instagram",
    threads: "Threads",
    x: "X",
    linkedin: "LinkedIn",
    youtube: "YouTube",
    tiktok: "TikTok",
  };
  return names[platform.toLowerCase()] ?? platform;
}

function formatPlatforms(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => stringValue(item))
    .filter(Boolean)
    .map(formatPlatform)
    .join(", ");
}

function formatDate(value: unknown, timeZone = "Asia/Kolkata") {
  const date = new Date(stringValue(value));
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    }).format(date);
  }
}

export function renderNotificationEmail(eventType: string, payload: NotificationEmailPayload) {
  const title =
    eventType === "post_scheduled" ? "Post scheduled" :
    eventType === "post_published" ? "Post published successfully" :
    eventType === "post_failed" ? "Post publishing failed" :
    eventType === "account_disconnected" ? "Social account disconnected" :
    "Social account token expired";

  const heading =
    eventType === "post_scheduled" ? "Your post is scheduled and will be published at the time below." :
    eventType === "post_published" ? "Your post was successfully published to the selected destinations." :
    eventType === "post_failed" ? "Your post could not be published to one or more destinations." :
    eventType === "account_disconnected" ? "A social account was disconnected." :
    "A social account needs attention.";

  const postTitle = getPostTitle(payload.postTitle, "Untitled post");
  const platforms = formatPlatforms(payload.platforms);
  const failedPlatforms = formatPlatforms(payload.failedPlatforms);
  const timezone = stringValue(payload.timezone) || "Asia/Kolkata";
  const scheduledAt = formatDate(payload.scheduledAt, timezone);
  const publishedAt = formatDate(payload.publishedAt, timezone);
  const postId = stringValue(payload.postId);

  const details: Array<[string, string]> = [];

  if (eventType.startsWith("post_")) {
    details.push(["Post", postTitle]);
    if (platforms) details.push([eventType === "post_scheduled" ? "Publishing to" : "Published to", platforms]);
    if (failedPlatforms) details.push(["Failed on", failedPlatforms]);
    if (scheduledAt && eventType === "post_scheduled") details.push(["Scheduled for", `${scheduledAt} (${timezone})`]);
    if (publishedAt && eventType === "post_published") details.push(["Published at", `${publishedAt} (${timezone})`]);
    if (postId) details.push(["Post ID", postId]);
  } else {
    for (const [key, value] of Object.entries(payload)) {
      if (["content", "postTitle", "platforms", "failedPlatforms", "scheduledAt", "publishedAt", "timezone", "postId"].includes(key)) continue;
      details.push([key, Array.isArray(value) ? value.join(", ") : String(value ?? "")]);
    }
  }

  const rows = details
    .filter(([, value]) => value)
    .map(([label, value]) => `<tr><td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#6b7280;width:140px;vertical-align:top;">${esc(label)}</td><td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#111827;vertical-align:top;font-weight:600;">${esc(value)}</td></tr>`)
    .join("");

  return {
    subject: title,
    html: `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;background:#f9fafb;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:32px 16px;"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;"><tr><td style="padding:32px;font-family:Arial,Helvetica,sans-serif;"><h1 style="margin:0 0 12px;font-size:24px;line-height:32px;color:#111827;">${esc(title)}</h1><p style="margin:0 0 24px;font-size:16px;line-height:24px;color:#374151;">${esc(heading)}</p><table width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table></td></tr></table></td></tr></table></body></html>`,
  };
}

function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" })[char] ?? char);
}
