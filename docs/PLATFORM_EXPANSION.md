# OmniSocial Platform Expansion Guide

This document covers the Phase 27 integrations added after the original Facebook, Instagram, Threads, LinkedIn, X and YouTube integrations.

Current Phase 27 additions:

- Pinterest
- Bluesky
- Google Business Profile
- Reddit

The existing Publishing User → Social Account model, OAuth encryption, publishing worker, immediate publishing and scheduled publishing flows are unchanged.

> Never commit client secrets, OAuth tokens, Supabase service-role credentials, or encryption keys. Store secrets in `.env.local`, Vercel Environment Variables, or an approved secret manager.

---

## 1. Pinterest

### Environment variables

```env
PINTEREST_CLIENT_ID=
PINTEREST_CLIENT_SECRET=
PINTEREST_OAUTH_SCOPES=user_accounts:read boards:read boards:write pins:read pins:write
```

### Create the Pinterest app

1. Open the Pinterest Developer Platform.
2. Create/sign in to the developer account.
3. Create or open the OmniSocial app.
4. Find the App ID and App Secret in the app configuration.
5. Configure the OmniSocial production redirect URI:

```text
https://YOUR-DOMAIN/api/social/oauth/callback
```

6. Request/configure the scopes required by OmniSocial:

```text
user_accounts:read
boards:read
boards:write
pins:read
pins:write
```

7. If Pinterest requires app approval/access-tier approval, complete that process before production testing.

Pinterest's OAuth flow requires the registered redirect URI to exactly match the URI used in the authorization request. The authorization-code flow exchanges the code using the app ID/client secret. Newer Pinterest apps use continuous refresh tokens rather than the legacy fixed lifetime refresh-token behavior. citeturn0search1turn0search4

### OmniSocial flow

```text
Pinterest Developer Platform
  ↓
Create/Open App
  ↓
App ID + App Secret
  ↓
Redirect URI + scopes
  ↓
Vercel environment variables
  ↓
OmniSocial → Connect Pinterest
  ↓
Pinterest OAuth
  ↓
Account discovery
  ↓
Publishing User association
```

### Publishing behavior

The current OmniSocial Pinterest integration publishes **image Pins**. It can discover an existing board and can create/use a board when the integration requires one.

Pinterest video Pins are intentionally not enabled in the current implementation because the provider's video flow is asynchronous and requires additional media/cover handling. Do not claim video Pin support until that flow is implemented and tested end to end.

### Production test

- Connect Pinterest.
- Confirm the account appears.
- Associate it with a Publishing User.
- Publish one image Pin.
- Confirm the Pin is visible on Pinterest.
- Confirm Post History contains the correct platform/status.
- Schedule an image Pin and confirm the worker publishes it.
- Reconnect/refresh the account and verify token rotation does not create a duplicate account.

---

## 2. Bluesky

Bluesky is different from the conventional client-secret OAuth integrations. The current OmniSocial implementation uses the AT Protocol OAuth flow with PKCE/DPoP and public client metadata.

### Environment variables

```env
# Optional when using the default public client metadata URL.
# BLUESKY_CLIENT_ID=https://YOUR-DOMAIN/api/social/bluesky/client-metadata
BLUESKY_PDS_URL=https://bsky.social
```

Do **not** create a fake client secret for Bluesky. The client metadata endpoint identifies the OAuth client configuration.

### Public client metadata

The application exposes:

```text
https://YOUR-DOMAIN/api/social/bluesky/client-metadata
```

This URL must be publicly reachable by the Bluesky authorization server. It must not require an OmniSocial login session.

The metadata advertises the dedicated callback used by OmniSocial:

```text
https://YOUR-DOMAIN/api/social/oauth/callback/bluesky
```

### OmniSocial flow

```text
OmniSocial Connect Bluesky
  ↓
Discover/configure Bluesky OAuth metadata
  ↓
PAR + PKCE/DPoP authorization
  ↓
Bluesky consent
  ↓
Dedicated Bluesky callback
  ↓
Persist encrypted session + DID
  ↓
Publishing User association
```

Bluesky's official OAuth documentation recommends an OAuth implementation for applications serving end users and describes PKCE, PAR, DPoP and token refresh as part of the protocol. citeturn0search10

### Publishing behavior

The current integration supports text posts and image media. Bluesky video publishing is not enabled by the current OmniSocial provider.

### Production test

- Open the public client metadata URL without being logged in to OmniSocial.
- Connect Bluesky.
- Complete authorization.
- Confirm the account/DID appears correctly.
- Publish a text post.
- Publish a text + image post.
- Confirm Post History.
- Run OAuth health/refresh behavior and confirm the stored DID is preserved.

---

## 3. Google Business Profile

Google Business Profile is a Google OAuth integration, but it publishes **business Local Posts**, not YouTube videos.

### Environment variables

The current implementation reuses the Google OAuth client credentials used by YouTube:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

The required Business Profile scope is:

```text
https://www.googleapis.com/auth/business.manage
```

### Google Cloud setup

1. Open Google Cloud Console.
2. Create/select the OmniSocial Google Cloud project.
3. Enable the APIs required by the Google Business Profile implementation.
4. Configure the OAuth consent screen/Google Auth Platform.
5. Open **APIs & Services → Credentials**.
6. Create/use a **Web application** OAuth client.
7. Add the dedicated OmniSocial Business Profile callback:

```text
https://YOUR-DOMAIN/api/social/oauth/callback/google_business_profile
```

8. Copy the Client ID and Client Secret to Vercel.

### Important callback distinction

YouTube uses the common callback:

```text
https://YOUR-DOMAIN/api/social/oauth/callback
```

Google Business Profile uses the dedicated callback:

```text
https://YOUR-DOMAIN/api/social/oauth/callback/google_business_profile
```

Do not replace one with the other.

### OmniSocial flow

```text
Google Cloud
  ↓
OAuth Web Client
  ↓
Business Profile scope
  ↓
Dedicated callback
  ↓
Google authorization
  ↓
Discover Business Profile accounts/locations
  ↓
Select destination
  ↓
Publishing User association
```

Google's Business Profile API supports Local Posts such as event, call-to-action and offer posts and uses account/location resources for publishing. citeturn0search0

### Publishing behavior

The current OmniSocial integration publishes supported Local Posts with optional image media. It is **not** a generic Google Business Profile analytics integration.

### Production test

- Connect a Google account that has access to a Business Profile.
- Confirm account/location discovery.
- Select a valid location.
- Publish a supported Local Post.
- Confirm it appears on the Business Profile.
- Verify Post History.
- Test scheduled publishing.

---

## 4. Reddit

### Environment variables

```env
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_OAUTH_SCOPES=identity submit read
REDDIT_DEFAULT_SUBREDDIT=
```

`REDDIT_DEFAULT_SUBREDDIT` is optional. If it is empty, the current provider uses the connected user's profile-feed destination behavior.

### Create the Reddit application

1. Sign in to Reddit with the account that will own the integration.
2. Open Reddit's developer/app settings.
3. Create a web application/script appropriate for OAuth access.
4. Copy the client ID.
5. Copy the client secret.
6. Configure the OmniSocial redirect URI:

```text
https://YOUR-DOMAIN/api/social/oauth/callback/reddit
```

7. Request the scopes used by OmniSocial:

```text
identity
submit
read
```

Reddit requires OAuth for Data API access. The official API documents `POST /api/submit` for creating link/self/image/video/videogif submissions, subject to the account, subreddit and API rules. citeturn0search5turn0search6

### OmniSocial flow

```text
Reddit app
  ↓
Client ID + Client Secret
  ↓
Dedicated redirect URI
  ↓
OmniSocial → Connect Reddit
  ↓
Reddit OAuth
  ↓
Profile discovery
  ↓
Destination/subreddit selection
  ↓
Publishing User association
```

### Current publishing behavior

The current OmniSocial Reddit integration is deliberately conservative. It supports the provider capabilities implemented in the Reddit publisher and validates media before publishing rather than silently converting unsupported content.

In particular, image/video destinations must satisfy the provider-specific media validation. If the UI reports that the selected Reddit mode is text-only, remove incompatible media or choose a supported destination/content type instead of relying on a provider-side failure.

### Production test

- Connect Reddit.
- Confirm the account appears.
- Associate it with a Publishing User.
- Publish a safe test post to a subreddit/profile destination where the account is allowed to post.
- Confirm Reddit accepts the submission.
- Verify Post History.
- Test a scheduled submission.
- Test an unsupported media combination and confirm OmniSocial shows the platform-specific validation message before publishing.

---

## 5. Phase 27 verification matrix

| Platform | OAuth | Token refresh | Publishing | Media validation | Scheduling | Documentation |
|---|---|---|---|---|---|---|
| Pinterest | Yes | Yes | Image Pins | Yes | Yes | Yes |
| Bluesky | Yes | Yes | Text + image | Yes | Yes | Yes |
| Google Business Profile | Yes | Yes | Local Posts | Yes | Yes | Yes |
| Reddit | Yes | Yes | Supported Reddit posts | Yes | Yes | Yes |

### End-to-end acceptance flow

For every Phase 27 provider:

```text
Connect
  ↓
OAuth callback
  ↓
Account discovered
  ↓
Publishing User association
  ↓
Create compatible post
  ↓
Publish now
  ↓
Provider result
  ↓
Post History
  ↓
Schedule compatible post
  ↓
Worker
  ↓
Provider publish
  ↓
Post History
```

Automated CI should cover deterministic provider logic, capability validation and registration. Real-provider OAuth and publishing require provider credentials and a real test account, so those final checks must be performed manually when credentials are available.
