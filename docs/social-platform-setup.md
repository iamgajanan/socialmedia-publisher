# LinkedIn and YouTube setup

This guide prepares OmniSocial for connecting and publishing to LinkedIn member profiles and YouTube channels. The application already contains provider OAuth, encrypted token storage, scheduled publishing, and provider publishers; this guide covers the external developer credentials and consent configuration needed to activate them.

## Common callback URL

Both providers use the same OAuth callback:

`https://YOUR_OMNISOCIAL_DOMAIN/api/social/oauth/callback`

For local development:

`http://localhost:3000/api/social/oauth/callback`

Set `SITE_URL` to the canonical origin used by the environment. Do not use a trailing path.

---

## LinkedIn

### 1. Create a LinkedIn Page

LinkedIn's current developer quick start asks developers to create a LinkedIn Page before creating the developer application. Use a real Page you control if the developer portal requires it.

### 2. Create the application

Open the LinkedIn Developer Portal and create a new application.

Record:

- Client ID → `LINKEDIN_CLIENT_ID`
- Client Secret → `LINKEDIN_CLIENT_SECRET`

Keep the client secret server-side only.

### 3. Add the required products

In the application's **Products** section, add:

- **Sign In with LinkedIn using OpenID Connect**
- **Share on LinkedIn**

The first provides the OpenID Connect identity scopes used by OmniSocial (`openid`, `profile`, `email`). Share on LinkedIn provides `w_member_social`, which is required to create posts for an authenticated member.

### 4. Configure OAuth redirect URL

In the LinkedIn application's Auth settings, add the exact OmniSocial callback URL:

`https://YOUR_OMNISOCIAL_DOMAIN/api/social/oauth/callback`

For local testing also add:

`http://localhost:3000/api/social/oauth/callback`

The URL must match exactly.

### 5. Environment variables

```env
LINKEDIN_CLIENT_ID=your-client-id
LINKEDIN_CLIENT_SECRET=your-client-secret
LINKEDIN_OAUTH_SCOPES=openid profile email w_member_social
LINKEDIN_VERSION=202609
```

The application uses LinkedIn's versioned `/rest/posts` API for publishing. Keep `LINKEDIN_VERSION` configurable because LinkedIn publishes API versions monthly.

### 6. What OmniSocial does

1. User chooses a publishing user.
2. User clicks **Connect LinkedIn**.
3. OmniSocial redirects to LinkedIn OAuth.
4. LinkedIn asks the member to approve the requested permissions.
5. OmniSocial exchanges the authorization code for an access token.
6. OmniSocial retrieves the member profile through LinkedIn OIDC `/v2/userinfo`.
7. The token is encrypted before it is stored.
8. The LinkedIn account becomes available for publishing.
9. Scheduled/queued posts use the encrypted token and LinkedIn's Posts API.

The current implementation intentionally supports **text-only LinkedIn publishing**. Media publishing requires the appropriate LinkedIn asset-upload flow and product/access configuration and is not silently enabled.

---

## YouTube

### 1. Create a Google Cloud project

Open Google Cloud Console and create or select a project dedicated to OmniSocial.

### 2. Enable YouTube Data API v3

In **APIs & Services → Library**, enable **YouTube Data API v3**.

### 3. Configure the OAuth consent screen

Configure the OAuth consent screen with OmniSocial's real application name, support email, developer contact information, and the application's public website/privacy information.

Use the smallest scopes needed by the product. OmniSocial currently needs:

- `https://www.googleapis.com/auth/youtube.upload` — upload/manage videos
- `https://www.googleapis.com/auth/youtube.readonly` — read the authenticated channel after authorization

Google may show the application as unverified while it is being tested or before required verification is completed. Follow Google's verification requirements before opening the integration to a broad production audience if Google requires verification for the requested scopes.

### 4. Create OAuth credentials

In **APIs & Services → Credentials**, create an OAuth 2.0 Client ID with application type **Web application**.

Record:

- Client ID → `GOOGLE_CLIENT_ID`
- Client Secret → `GOOGLE_CLIENT_SECRET`

### 5. Configure redirect URI

Add the exact callback URL:

`https://YOUR_OMNISOCIAL_DOMAIN/api/social/oauth/callback`

For local development:

`http://localhost:3000/api/social/oauth/callback`

Do not add a wildcard or a different path.

### 6. Environment variables

```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
YOUTUBE_OAUTH_SCOPES=https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly
```

### 7. What OmniSocial does

1. User chooses a publishing user.
2. User clicks **Connect YouTube**.
3. OmniSocial redirects to Google OAuth.
4. Google asks the user to grant YouTube permissions.
5. OmniSocial requests offline access so scheduled publishing can continue after the user leaves the browser.
6. The authorization code is exchanged for access/refresh tokens.
7. The authenticated channel is loaded with `channels.list`.
8. Access and refresh tokens are encrypted before storage.
9. A video selected in OmniSocial can be queued or scheduled.
10. The publishing worker uploads the video through the YouTube Data API.

YouTube publishing currently expects **exactly one video** for a destination. The post text is used as the video description, while channel metadata can provide an optional title/category/privacy configuration.

---

## Production checklist

Before enabling either provider for customers:

- [ ] `SITE_URL` is the real HTTPS OmniSocial domain.
- [ ] LinkedIn callback URL exactly matches the application setting.
- [ ] Google callback URL exactly matches the OAuth client setting.
- [ ] Secrets are stored only in Vercel/server environment variables.
- [ ] No provider secret is committed to Git.
- [ ] OAuth works for a real test account.
- [ ] The connected account appears under the correct publishing user.
- [ ] Disconnect/reconnect works.
- [ ] A direct LinkedIn text post publishes successfully.
- [ ] A YouTube test video uploads successfully.
- [ ] A scheduled YouTube video is published by the existing worker.
- [ ] Failed provider responses appear as failed destinations rather than falsely showing success.
- [ ] Token refresh is tested for YouTube.
- [ ] OAuth health checks report expired/invalid grants correctly.
- [ ] CI is green before merging to `main`.

## Important API notes

LinkedIn requires OAuth member authorization for member resources and uses the `w_member_social` permission for posting on behalf of an authenticated member. LinkedIn's versioned APIs require a `LinkedIn-Version` header; keep the version configurable and update it before a supported version sunsets.

YouTube Data API requests that modify user data require OAuth authorization. API keys alone are not sufficient for uploads or other private/account-authorized operations.
