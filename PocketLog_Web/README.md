# PocketLog Web and API

Next.js 16 App Router application containing PocketLog's responsive web interface and owner-scoped `/api/v1` backend. MongoDB Atlas stores structured records; Cloudinary stores document bytes as authenticated assets.

## Setup

1. Run `npm install`.
2. Start locally with `npm run dev`. When no external MongoDB configuration exists, PocketLog starts a persistent embedded MongoDB under `.local-data`, generates `.env.local` secrets, and provisions the local-only account printed in the terminal. The first run may download a MongoDB binary.
3. To use Atlas instead, copy `.env.example` to `.env.local`, configure MongoDB and independent 32+ character authentication secrets, and omit `POCKETLOG_EMBEDDED_MONGO=true`. Provision or reset that private account with `npm run setup:account`.
4. Production commands remain `npm run build` and `npm start`; production never uses the embedded development database.

Default local-only credentials are `demo@pocketlog.local` / `PocketLog-Local-2026!`. They are provisioned only for the gitignored embedded local database, never for Atlas or production.

Running `npm run dev` in a second terminal is safe: it reports the existing server instead of starting a competing MongoDB process. If an earlier process left an unresponsive database lock, startup automatically selects a persistent recovery slot under `.local-data` rather than deleting or overwriting the locked data directory.

Verification commands are `npm run typecheck`, `npm run lint`, `npm test`, and `npm run test:e2e`. Playwright requires browser installation before its first run.

## Architecture

- `src/contracts` contains strict Zod write contracts. `/api/v1/openapi` exposes the versioned API description.
- `src/lib/auth` implements secure web cookies, ten-minute mobile access tokens, hashed rotating refresh tokens, token-reuse revocation, origin enforcement, and ownership derived only from authentication.
- Generic resource routes provide bounded cursor pagination and optimistic version checks for transactions, categories, merchant rules, budgets, accounts/payments, habits/completions/tasks, vehicles/fuel/maintenance, documents, card metadata, imports, and reminders.
- Mutation envelopes require idempotency keys. `/api/v1/sync` accepts at most 25 operations and returns per-operation results.
- Money is stored as integer paise and dates as UTC instants or explicit local dates. Transfers and linked card repayments are excluded from ordinary expense summaries.
- CSV export protects against spreadsheet-formula injection. Account export is owner-scoped and account deletion revokes sessions before staging cloud cleanup.

## Cloudinary

The API secret is server-only. Clients request a narrowly scoped signed upload for an owner/document path, upload with delivery type `authenticated`, and call the finalize endpoint. Finalization queries Cloudinary before recording `synced`. Preview/download access requires PocketLog authorization and returns a five-minute download URL. Database records store internal asset identifiers, not permanent delivery URLs.

Configure authenticated delivery in the Cloudinary product environment and do not replace it with the default public `upload` type. Failed cloud deletion jobs remain in `cleanup_jobs` for a worker or administrator to retry.

## Deployment

Deploy to Vercel with the same environment variables and MongoDB Atlas network access. Set `NEXT_PUBLIC_APP_ORIGIN` and `ALLOWED_ORIGINS` to the exact HTTPS production origin. Never expose `AUTH_SECRET`, `REFRESH_TOKEN_PEPPER`, `MONGODB_URI`, or `CLOUDINARY_API_SECRET` through `NEXT_PUBLIC_*` variables.

No seed/demo balances are included. The system requires a real MongoDB connection and the setup command before sign-in.

