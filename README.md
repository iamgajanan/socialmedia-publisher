# OmniSocial

OmniSocial is a SaaS social-media publishing platform built with Next.js, TypeScript, Tailwind CSS, shadcn/ui, Supabase/PostgreSQL, OAuth-based social integrations, background publishing workers, and Vercel.

## OmniSocial documentation

- **[User Guide](docs/USER_GUIDE.md)** — Getting started, Publishing Users, creating posts, scheduling, Media Library, platform behavior, troubleshooting and FAQ.
- **[Setup & Social Provider Guide](docs/SETUP.md)** — Local/production environment setup plus step-by-step OAuth configuration for Facebook, Instagram, Threads, LinkedIn, YouTube and X, including Client IDs, Client Secrets, redirect URI, scopes and provider flows.
- **[Platform Expansion Guide](docs/PLATFORM_EXPANSION.md)** — Phase 27 setup, OAuth flows, environment variables, publishing behavior, media limitations and production verification for Pinterest, Bluesky, Google Business Profile and Reddit.
- **[Pinterest Integration Guide](docs/PINTEREST.md)** — Pinterest OAuth setup, account connection, board handling, image Pin publishing, token refresh and production testing.
- **[API documentation](docs/API.md)** — REST API endpoints and automation integration.
- **[OpenAPI specification](docs/openapi.yaml)** — Machine-readable API specification.
- **[Security guide](docs/SECURITY.md)** — Production API security model and release checklist.

## Local development

1. Create a Supabase project.
2. Clone the repository and install dependencies.
3. Create `.env.local` from `.env.example`.
4. Follow **[docs/SETUP.md](docs/SETUP.md)** and **[docs/PLATFORM_EXPANSION.md](docs/PLATFORM_EXPANSION.md)** for all required environment variables and social-provider OAuth configuration.
5. Start the application:

```bash
npm install
npm run dev
```

The local application is normally available at http://localhost:3000.

## API

Production API base URL: https://socialmedia-publisher-gules.vercel.app

The API uses profile-scoped Bearer API keys. Keep API keys server-side and store them in an automation platform's credential/secret storage.

## Security

See [docs/SECURITY.md](docs/SECURITY.md) for the production API security model and release checklist.
