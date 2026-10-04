# OmniSocial User Guide

## 1. Getting Started

OmniSocial lets you manage social publishing from one application using **Publishing Users** and connected social accounts.

The recommended first-use flow is:

```text
Sign up
  ↓
Create Publishing User
  ↓
Connect a social account
  ↓
Create your first post
  ↓
Publish now
```

Start by signing up and opening the application dashboard.

---

## 2. Publishing Users

A Publishing User is the identity/profile that OmniSocial uses to associate connected social accounts and publishing activity.

Example:

```text
Default
Marketing
Omni
```

### Create a Publishing User

1. Open **Publishing Users**.
2. Select **Create Publishing User**.
3. Enter the desired name.
4. Save.
5. Associate connected social accounts with that Publishing User.

The number of Publishing Users available depends on the active plan.

---

## 3. Connecting Social Accounts

Open the social-account/connection area and choose the platform you want to connect.

Supported OmniSocial platforms:

- Facebook
- Instagram
- Threads
- LinkedIn
- YouTube
- X where enabled by the current integration/configuration

Select **Connect**, complete the provider's OAuth consent flow, and return to OmniSocial.

After a successful connection:

```text
Provider OAuth
  ↓
Account discovered
  ↓
Account shown in OmniSocial
  ↓
Associate with Publishing User
```

For provider developer setup, Client IDs, Client Secrets, callback URLs, scopes, and dashboard configuration, see `docs/SETUP.md`.

---

## 4. Creating a Post

Open **Create Post**.

Select:

1. Publishing User
2. One or more supported destinations
3. Text/content
4. Media if required
5. Publish Now or Schedule

The editor supports normal text selection, typing, copying, pasting, and editing.

### Publish Now

Publish Now starts the publishing operation immediately. It is not intentionally delayed until the scheduled cron interval.

After a successful submission, the form is cleared and the post moves through the normal publishing flow.

### Schedule

Select a future date and time.

```text
Create post
  ↓
Schedule
  ↓
Scheduled status
  ↓
Publishing worker
  ↓
Provider
  ↓
Post History
```

Scheduled posts must have a future scheduled time.

---

## 5. Media Library

The Media Library is used to upload media once and reuse it when creating posts.

```text
Upload media
  ↓
Media Library
  ↓
Reuse media
  ↓
Create/schedule post
```

The application validates media compatibility for selected destinations.

### Multiple images

Multiple images are supported for destinations whose OmniSocial integration supports multi-image publishing.

Instagram supports multi-image carousel publishing in the current implementation.

### YouTube image-only posts

The current OmniSocial YouTube publishing integration is video-oriented. YouTube should not be treated as a generic image-post destination in OmniSocial.

If an image-only post has YouTube selected, the UI should explain the incompatibility and allow YouTube to be removed while leaving other destinations selected.

---

## 6. Post Statuses

OmniSocial uses clear status states:

| Status | Meaning |
|---|---|
| Published | Provider publishing succeeded |
| Failed | Provider publishing failed |
| Cancelled | The post was cancelled |
| Scheduled | Waiting for its scheduled time |
| Publishing | Publishing is currently being processed |

The Post History screen should show the platform and Publishing User associated with the destination.

---

## 7. Post History

Post History lets you inspect previous publishing activity.

Review:

- Post content
- Publishing User
- Destination platform
- Status
- Created/scheduled/published timestamps
- Provider result/error information when available

Use Post History when diagnosing a failed or delayed provider operation.

---

## 8. Scheduling

Scheduling is intended for future posts.

Recommended flow:

```text
Create Post
  ↓
Select Publishing User
  ↓
Select platforms
  ↓
Add content/media
  ↓
Choose future date/time
  ↓
Schedule
```

The publishing worker processes due posts. Immediate publishing does not intentionally wait for the scheduled worker interval.

---

## 9. Supported platform notes

### Facebook

Supports the current Facebook publishing integration and connected Page workflow configured for the OmniSocial application.

### Instagram

Supports image/video publishing and multi-image carousel publishing where the connected account and provider permissions allow it.

### Threads

Supports the current Threads publishing integration and its configured OAuth permissions.

### LinkedIn

The current implementation supports personal/organization publishing paths that have been configured and approved by LinkedIn, including text, image, and video publishing where supported by the connected account and application permissions.

### YouTube

The current publishing integration is video-focused. Use compatible video media for YouTube publishing.

### X

X support depends on the current X application configuration and API access level. Keep the X Developer Portal configuration aligned with the credentials and capabilities enabled for the OmniSocial deployment.

---

## 10. Plans and limits

The current conceptual plans are:

| Plan | Price |
|---|---:|
| Starter | $9/month |
| Pro | $19/month |
| Premium | $29/month |

Plan architecture controls limits such as Publishing Users and connected social accounts.

Stripe billing is currently paused pending Stripe India onboarding. Do not assume a successful Stripe subscription is required for the current development/staging workflow until billing is enabled.

---

## 11. Troubleshooting

### A social account does not connect

Check:

1. Provider Client ID and Client Secret.
2. Exact OAuth callback URL.
3. Provider product/API configuration.
4. Required permissions/scopes.
5. Production `SITE_URL`.
6. Provider account eligibility.

See `docs/SETUP.md` for provider-specific setup.

### Publishing fails

Check:

1. The correct Publishing User is selected.
2. The connected account is still authorized.
3. The media type is compatible.
4. The provider permissions are valid.
5. Post History for the provider error.
6. OAuth/token health if the connection has expired.

### YouTube rejects an image-only post

The current OmniSocial YouTube publishing integration is video-oriented. Remove YouTube from the destination list or add compatible video media.

### A scheduled post does not publish

Check:

1. Scheduled time.
2. Post History.
3. Worker/operations status.
4. OAuth/token health.
5. Provider availability.

---

## 12. FAQ

### Can I connect multiple social accounts?

Yes, subject to the account and Publishing User limits enforced by the active plan and current database configuration.

### Can one Publishing User have multiple platforms?

Yes. A Publishing User can be associated with multiple supported social platforms according to the existing plan limits.

### Can I publish immediately?

Yes. **Publish Now** starts the publishing operation immediately.

### Can I schedule a post?

Yes. Select a future time and OmniSocial's scheduled publishing worker processes it when due.

### Can I publish multiple images to Instagram?

Yes. Multiple images are published as an Instagram carousel where supported by the connected account and permissions.

### Can I publish an image-only post to YouTube?

Not through the current OmniSocial YouTube publishing integration. The current YouTube publishing path is video-oriented.

### Where can I see whether a post succeeded?

Open **Post History** and inspect the destination status and provider result.

### What should I do if OAuth expires?

Reconnect or reauthorize the affected social account when OmniSocial indicates that authorization needs attention.

### Where are provider credentials configured?

Provider credentials are server-side environment variables. See `docs/SETUP.md` for exact variable names and provider setup flows.

### Is Stripe billing active?

Stripe architecture exists, but billing is currently paused pending Stripe India onboarding. Do not rely on billing being active until the billing phase is resumed and completed.

---

## 13. Security

Never share or commit:

- Client Secrets
- Supabase service-role keys
- OAuth access/refresh tokens
- OAuth encryption keys
- Cron secrets
- API keys

Provider secrets belong in server-side environment configuration.

---

## 14. Related documentation

- `docs/SETUP.md` — full local/production setup and provider OAuth configuration
- `docs/API.md` — API endpoints and automation integration
- `docs/openapi.yaml` — OpenAPI specification
- `docs/SECURITY.md` — production API security model and release checklist
