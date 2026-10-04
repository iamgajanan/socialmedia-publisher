# OmniSocial Setup & Social Provider Guide

This guide is the source of truth for setting up OmniSocial locally, staging it, and configuring the OAuth credentials required to connect social platforms.

> **Important:** Never commit client secrets, service-role keys, OAuth encryption keys, API keys, or provider tokens to Git. Store secrets in Vercel Environment Variables, your local `.env.local`, or another approved secret manager.

## 1. How OmniSocial works

The normal user flow is:

```text
Sign up
  ↓
Create Publishing User
  ↓
Connect a social platform
  ↓
Complete provider OAuth
  ↓
Provider account appears in OmniSocial
  ↓
Associate account with Publishing User
  ↓
Create post
  ↓
Publish now OR schedule
  ↓
Provider publishes
  ↓
Post History records the result
```

For immediate publishing, OmniSocial starts the publishing operation immediately. Scheduled posts are handled by the scheduled publishing worker.

---

## 2. Local environment

Create `.env.local` from `.env.example`.

The current application environment variables are:

### Core

```env
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
CRON_SECRET=
SOCIAL_OAUTH_ENCRYPTION_KEY=
OPS_ADMIN_EMAILS=
SITE_URL=http://localhost:3000
```

### What these are for

- `SUPABASE_URL` — Supabase project URL.
- `SUPABASE_PUBLISHABLE_KEY` — public/publishable Supabase key used by the application.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only Supabase service-role key. Never expose it to the browser.
- `RESEND_API_KEY` — email delivery API key, when email features are enabled.
- `RESEND_FROM_EMAIL` — verified sender address.
- `CRON_SECRET` — secret used to authorize scheduled worker endpoints.
- `SOCIAL_OAUTH_ENCRYPTION_KEY` — server-side key used to encrypt stored OAuth credentials.
- `OPS_ADMIN_EMAILS` — comma-separated production operator emails allowed to open `/ops`.
- `SITE_URL` — canonical application origin. Production must use the production HTTPS origin.

Generate a strong random value for secrets such as `CRON_SECRET` and `SOCIAL_OAUTH_ENCRYPTION_KEY`; do not reuse provider client secrets for these values.

---

# 3. Common OAuth callback

OmniSocial uses the OAuth callback route:

```text
/api/social/oauth/callback
```

Therefore the provider redirect URI is normally:

```text
https://YOUR-DOMAIN/api/social/oauth/callback
```

For local development:

```text
http://localhost:3000/api/social/oauth/callback
```

Use the exact HTTPS production URL in production. OAuth providers generally require an exact redirect URI match, including scheme, host, path, and relevant trailing-slash differences.

---

# 4. Meta: Facebook + Instagram

OmniSocial uses Meta credentials for Facebook and has separate Instagram application credentials in the current configuration.

## 4.1 Facebook setup

1. Go to the Meta for Developers portal:
   - https://developers.facebook.com/
2. Sign in with the Meta account that owns/manages the developer application.
3. Open **My Apps**.
4. Create a new app, or open the existing OmniSocial Meta app.
5. Configure the Facebook product/use case required by the application.
6. Open the app's settings and copy:
   - App ID
   - App Secret
7. Put them in:

```env
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
META_GRAPH_VERSION=your_supported_graph_version
```

8. Configure the OAuth redirect URI:

```text
https://YOUR-DOMAIN/api/social/oauth/callback
```

9. Configure the required Facebook permissions/scopes used by OmniSocial:

```text
pages_manage_metadata
pages_manage_posts
pages_manage_read_engagement
pages_show_list
```

The exact approval/review requirements depend on the Meta app and the permissions requested. Do not request additional permissions unless OmniSocial actually needs them.

### Facebook flow

```text
Meta for Developers
  ↓
My Apps
  ↓
Create/Open App
  ↓
Configure Facebook
  ↓
App ID + App Secret
  ↓
OAuth redirect URI
  ↓
Required permissions
  ↓
Save production credentials
  ↓
OmniSocial → Connect Facebook
```

---

## 4.2 Instagram setup

For OmniSocial's current implementation, configure the Instagram application credentials separately:

```env
INSTAGRAM_APP_ID=your_instagram_app_id
INSTAGRAM_APP_SECRET=your_instagram_app_secret
INSTAGRAM_OAUTH_SCOPES=instagram_business_basic,instagram_business_content_publish
```

Meta/Instagram setup generally requires the appropriate Instagram professional/business configuration and a Meta developer application with the relevant Instagram product/API access.

Recommended setup flow:

```text
https://developers.facebook.com/
  ↓
My Apps
  ↓
Create/Open Meta app
  ↓
Add/configure Instagram API capability
  ↓
Configure OAuth
  ↓
Configure redirect URI
  ↓
Request/configure Instagram permissions
  ↓
Copy application credentials
  ↓
Set INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET
```

Required current scopes:

```text
instagram_business_basic
instagram_business_content_publish
```

### Instagram account requirement

Use an Instagram account type supported by the API flow implemented by OmniSocial. If Meta requires a linked Facebook Page/business asset for the selected API flow, complete that association before testing OAuth.

### Instagram publishing behavior

OmniSocial supports:

- Single-image publishing
- Video/Reel publishing where supported by the implementation
- Multiple images as an Instagram carousel

For multiple images, the current implementation creates the required child media containers and then creates the carousel container.

---

# 5. Threads

Threads uses its own application credentials in OmniSocial:

```env
THREADS_APP_ID=your_threads_app_id
THREADS_APP_SECRET=your_threads_app_secret
THREADS_OAUTH_SCOPES=threads_basic,threads_content_publish
```

Setup flow:

```text
https://developers.facebook.com/
  ↓
My Apps
  ↓
Create/Open the Meta developer app used for Threads
  ↓
Configure Threads API/product
  ↓
Configure OAuth redirect URI
  ↓
Configure Threads permissions
  ↓
Copy App ID + App Secret
  ↓
Set THREADS_APP_ID / THREADS_APP_SECRET
```

Current OmniSocial scopes:

```text
threads_basic
threads_content_publish
```

OAuth callback:

```text
https://YOUR-DOMAIN/api/social/oauth/callback
```

### Threads test flow

1. Log in to OmniSocial.
2. Create/select a Publishing User.
3. Connect Threads.
4. Complete the provider authorization screen.
5. Confirm the Threads account appears.
6. Associate it with the Publishing User.
7. Publish a test post.
8. Verify the provider result and Post History.

---

# 6. LinkedIn

LinkedIn credentials are configured as:

```env
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
LINKEDIN_OAUTH_SCOPES=openid profile email w_member_social w_organization_social r_organization_admin
LINKEDIN_VERSION=202609
```

## Create the LinkedIn application

1. Open the LinkedIn Developer Portal:
   - https://www.linkedin.com/developers/
2. Sign in.
3. Open **My Apps**.
4. Select **Create app**.
5. Enter the application information requested by LinkedIn.
6. Open the application's **Auth** configuration.
7. Copy:
   - Client ID
   - Client Secret
8. Add the OmniSocial redirect URI:

```text
https://YOUR-DOMAIN/api/social/oauth/callback
```

9. Configure/request the products and permissions required by the OmniSocial implementation.

Current scopes configured in the application are:

```text
openid
profile
email
w_member_social
w_organization_social
r_organization_admin
```

### LinkedIn flow

```text
LinkedIn Developer Portal
  ↓
My Apps
  ↓
Create App
  ↓
Auth
  ↓
Client ID + Client Secret
  ↓
Authorized redirect URL
  ↓
Products / permissions
  ↓
OmniSocial Connect LinkedIn
  ↓
OAuth consent
  ↓
Account association
```

### LinkedIn organization publishing

If publishing to a LinkedIn Company Page, the authenticated LinkedIn user must have the required organization administration rights and the application must have the relevant organization permissions approved/configured.

OmniSocial should not claim organization publishing is available merely because a Client ID exists; the required LinkedIn product/permission access must actually be granted.

---

# 7. YouTube

YouTube uses Google OAuth web-application credentials.

Current environment variables:

```env
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
YOUTUBE_OAUTH_SCOPES=https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly
```

## Create Google Cloud project

1. Open Google Cloud Console:
   - https://console.cloud.google.com/
2. Create a new project or select the project used by OmniSocial.
3. Open **APIs & Services → Library**.
4. Search for **YouTube Data API v3**.
5. Enable it.

Google's official documentation confirms that applications using YouTube Data API access need an API project and authorization credentials, and private/user-authorized operations use OAuth 2.0. citeturn0search0turn0search1

## Create OAuth credentials

1. Open **APIs & Services → Credentials**.
2. Configure the OAuth consent screen/Google Auth Platform as required by the current Google Cloud UI.
3. Create an **OAuth client**.
4. Select **Web application**.
5. Add the authorized redirect URI:

```text
https://YOUR-DOMAIN/api/social/oauth/callback
```

6. Create the credential.
7. Copy:
   - Client ID
   - Client Secret
8. Set:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Google's server-side OAuth documentation specifically requires the client ID, client secret, and exact authorized redirect URI for a web-server OAuth flow. citeturn0search9

### YouTube scopes

OmniSocial currently requests:

```text
https://www.googleapis.com/auth/youtube.upload
https://www.googleapis.com/auth/youtube.readonly
```

### Important: YouTube media behavior

The current OmniSocial YouTube integration is for video publishing. Do not describe it as a generic standalone-image publishing destination. If a user selects YouTube and uploads an image-only post, the UI should explain that the current OmniSocial YouTube publishing integration requires supported video media and guide the user to remove YouTube or add compatible media.

---

# 8. X

X uses OAuth application credentials:

```env
X_CLIENT_ID=your_x_client_id
X_CLIENT_SECRET=your_x_client_secret
```

## Create/configure the X application

1. Open the X Developer Portal:
   - https://developer.x.com/
2. Sign in with the X developer account.
3. Create or open the project/application used by OmniSocial.
4. Configure the application's OAuth settings.
5. Configure the application's callback/redirect URI:

```text
https://YOUR-DOMAIN/api/social/oauth/callback
```

6. Copy the Client ID.
7. Copy the Client Secret.
8. Store them as:

```env
X_CLIENT_ID=...
X_CLIENT_SECRET=...
```

9. Configure the access level/scopes required by the X API product available to the account.

### X flow

```text
X Developer Portal
  ↓
Project / App
  ↓
User authentication settings
  ↓
OAuth configuration
  ↓
Callback URI
  ↓
Client ID + Client Secret
  ↓
OmniSocial Connect X
  ↓
OAuth consent
  ↓
Account association
```

Do not hard-code X scopes in this document unless they are explicitly required by the current OmniSocial implementation and provider plan. X API access levels and available capabilities can change; keep the app configuration aligned with the current X Developer Portal and OmniSocial OAuth implementation.

---

# 9. Production configuration checklist

Before enabling a provider in production:

- [ ] Production `SITE_URL` is correct.
- [ ] HTTPS is enabled.
- [ ] Provider redirect URI exactly matches `/api/social/oauth/callback`.
- [ ] Client ID is set.
- [ ] Client Secret is set server-side.
- [ ] Required provider product/API is enabled.
- [ ] Required permissions/scopes are approved/configured.
- [ ] Provider test account is ready.
- [ ] OAuth callback succeeds.
- [ ] Account appears in OmniSocial.
- [ ] Account is associated with a Publishing User.
- [ ] Test post succeeds.
- [ ] Post History records the correct provider and status.
- [ ] Scheduled test succeeds where supported.
- [ ] Provider tokens are never exposed to the browser or API responses.

---

# 10. Vercel environment variables

For production, add the required variables in the Vercel project under the appropriate Environment (Production/Preview/Development).

At minimum, production normally requires:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
CRON_SECRET
SOCIAL_OAUTH_ENCRYPTION_KEY
SITE_URL
```

Then add the credentials for every provider you intend to enable:

```text
META_APP_ID
META_APP_SECRET
META_GRAPH_VERSION
META_FACEBOOK_SCOPES
INSTAGRAM_APP_ID
INSTAGRAM_APP_SECRET
INSTAGRAM_OAUTH_SCOPES
THREADS_APP_ID
THREADS_APP_SECRET
THREADS_OAUTH_SCOPES
LINKEDIN_CLIENT_ID
LINKEDIN_CLIENT_SECRET
LINKEDIN_OAUTH_SCOPES
LINKEDIN_VERSION
X_CLIENT_ID
X_CLIENT_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
YOUTUBE_OAUTH_SCOPES
```

Only set provider credentials for integrations that have actually been configured and approved. Empty/unused credentials should not be treated as an enabled integration.

---

# 11. First-time OmniSocial setup

## Step 1 — Start the application

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Step 2 — Create an account

Sign up and sign in.

## Step 3 — Create a Publishing User

A Publishing User represents the identity used by OmniSocial to publish to connected social accounts.

Example:

```text
Default
Omni
Marketing
```

## Step 4 — Connect a social platform

Choose a provider and complete its OAuth flow.

## Step 5 — Associate the account

Associate the connected account with the intended Publishing User.

## Step 6 — Create the first post

Choose:

- Publishing User
- Destination platform(s)
- Text
- Media, if required

## Step 7 — Publish now

Publish Now starts the publishing operation immediately.

## Step 8 — Schedule

For a scheduled post, choose a future date/time. The scheduled publishing worker will process it.

## Step 9 — Verify Post History

Confirm:

- Publishing User
- Platform
- Content
- Status
- Timestamp
- Provider result where available

---

# 12. Multi-platform media rules

OmniSocial allows media to be selected independently from the destination platform selection. Platform compatibility is checked when necessary.

Examples:

### Instagram carousel

```text
2–10 images
      ↓
Instagram carousel
```

### YouTube

The current OmniSocial YouTube publisher expects supported video media. An image-only post should not fail with an unexplained generic error; the UI should explain the compatibility issue and allow the user to remove YouTube while keeping other selected platforms.

### Mixed destinations

A single post may target multiple platforms, but each platform must receive media/content that its OmniSocial integration supports.

---

# 13. Troubleshooting

## `redirect_uri_mismatch`

Check that the provider dashboard contains the exact:

```text
https://YOUR-DOMAIN/api/social/oauth/callback
```

Also check that `SITE_URL` points to the same production domain.

## OAuth app/client not configured

Check that the relevant Client ID and Client Secret are present in the deployment environment and that the provider application is configured for the correct environment.

## Permission/scope error

The provider application may not have the requested product or permission approved. Compare the provider dashboard with the scopes documented above.

## Account connects but publishing fails

Check:

1. The account is associated with the correct Publishing User.
2. The required provider permissions were granted.
3. The media type is supported.
4. The provider account has the necessary publishing capability.
5. Post History/provider error details.
6. OAuth/token health.

## YouTube image warning

The current OmniSocial YouTube publishing path is video-oriented. Remove YouTube from an image-only post or add compatible video media.

## Scheduled post does not publish

Check:

1. `CRON_SECRET`.
2. Scheduled time is in the future and interpreted correctly.
3. Worker execution/operations dashboard.
4. Provider OAuth/token health.
5. Post History.

---

# 14. Security rules

Never:

- commit `.env.local`;
- commit provider client secrets;
- expose client secrets in browser code;
- expose Supabase service-role keys to users;
- store OAuth access/refresh tokens in frontend state;
- paste secrets into GitHub issues or public documentation;
- log OAuth tokens;
- put provider secrets in URLs.

Client secrets and OAuth tokens are credentials. Treat them as production secrets.

---

# 15. API / automation setup

OmniSocial also exposes a profile-scoped API. See:

- `docs/API.md`
- `docs/openapi.yaml`
- `docs/SECURITY.md`

The API uses a Bearer API key. Store that API key in the automation platform's secret/credential storage, not inside workflow text or source code.

A typical automation flow is:

```text
n8n / automation
      ↓
POST /api/v1/media (when media is needed)
      ↓
POST /api/v1/publish
      ↓
GET /api/v1/posts/{post_id}
```

---

# 16. Provider quick-reference

| Platform | Credentials | Main OAuth scopes/config | Callback |
|---|---|---|---|
| Facebook | `META_APP_ID`, `META_APP_SECRET` | `META_FACEBOOK_SCOPES` | `/api/social/oauth/callback` |
| Instagram | `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` | `INSTAGRAM_OAUTH_SCOPES` | `/api/social/oauth/callback` |
| Threads | `THREADS_APP_ID`, `THREADS_APP_SECRET` | `THREADS_OAUTH_SCOPES` | `/api/social/oauth/callback` |
| LinkedIn | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | `LINKEDIN_OAUTH_SCOPES` | `/api/social/oauth/callback` |
| X | `X_CLIENT_ID`, `X_CLIENT_SECRET` | Provider/app configuration | `/api/social/oauth/callback` |
| YouTube | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `YOUTUBE_OAUTH_SCOPES` | `/api/social/oauth/callback` |

Provider dashboards and requirements can change. When the provider's current UI differs from this guide, use the provider's current developer documentation for the exact screen labels while keeping the OmniSocial callback path and environment-variable names above aligned with the application.

---

# 17. Official provider documentation

- Meta for Developers: https://developers.facebook.com/
- LinkedIn Developers: https://www.linkedin.com/developers/
- LinkedIn authentication documentation: https://learn.microsoft.com/en-us/linkedin/shared/authentication/
- Google Cloud Console: https://console.cloud.google.com/
- YouTube Data API: https://developers.google.com/youtube/v3
- YouTube OAuth for web applications: https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps
- X Developer Portal: https://developer.x.com/

Always verify current provider requirements before production configuration because OAuth products, review requirements, permissions, and portal UIs can change.
