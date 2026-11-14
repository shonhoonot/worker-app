# AJIL — Japan jobs for Mongolian speakers

Private full-stack beta. React + TypeScript on the Sites Vinext/Cloudflare Workers runtime, with a D1 database and Drizzle schema migrations.

## Implemented

- Mobile-first Mongolian interface with job search, city/category/language/type/pay filters.
- Server-owned jobs: create, edit, close, resubmit. New/edited jobs enter `pending`.
- Admin review: approve or reject with a reason; audit entries for moderation decisions.
- Identity-scoped saved jobs, publisher blocking, report submission and admin resolution.
- ChatGPT identity supplied by Sites dispatch; no local-storage authentication or client-granted roles.
- Revision checks prevent stale edits/approvals; validation and prepared SQL; same-origin JSON mutations.
- Clearly separated example listings; they are never inserted into the live database.

## Source map

- `app/ui.tsx`: mobile and desktop UI, forms, dialogs, moderation queue.
- `app/api/board/route.ts`: identity boundary, HTTP errors, origin checks, no-store responses.
- `lib/service.ts`: authorization and job lifecycle against D1-compatible statements.
- `lib/domain.ts`: data contracts and Zod validation.
- `db/schema.ts`, `drizzle/`: schema and immutable migration history.
- `tests/service.test.mjs`: real SQLite integration tests with isolated identities.
- `legacy/prototype.html`: original local-storage prototype, retained as reference only.

## Runtime configuration

`.openai/hosting.json` retains the existing Site project ID and declares `d1: "DB"`.
`AJIL_ADMIN_EMAIL` must be configured server-side through Sites environment variables. It has no default; absent configuration grants nobody admin. Never expose this value in browser code or a `NEXT_PUBLIC_` variable. Authorization uses the platform-verified identity, not request JSON.
The Site audience remains owner-private. No custom OAuth provider is configured.

## Checks

```sh
npm run typecheck
npm test
npm run build
```

Tests use Node 24's built-in SQLite; they execute the generated migration, not a substitute schema. Test compilation is written under ignored `.sites-runtime/`.
Use the Sites lifecycle helpers for actual dependency installation, local preview, packaging and publishing. Apply generated migrations to the local D1 preview separately from hosted production; never edit applied migrations.

## Product boundaries

This is not an App Store / Google Play native binary. No payments, chat, resume upload, employer identity verification, push notification service, Google/Apple login or automated application submission has been added.

Before public launch: determine the Japanese job-information service classification; finalize operator/support details, privacy/retention terms and account/data deletion; implement stronger abuse controls and pagination; verify identity and moderation flows with multiple live accounts; test on physical mobile devices and build native clients as needed. Current list limits: 500 jobs and 200 unresolved reports. Closed jobs stay in owner history. Saved references to closed/unpublished jobs remain stored but are not displayed to other readers.

The original browser-local data is not silently uploaded or migrated. Users can re-enter selected jobs through the reviewed submission flow.

## Work dates and listing visibility (2026-11-12)

- New/edited listings require `plan`: single day, date range, or up to 31 unique selected days with per-day headcount; same-team/flexible staffing; JST application deadline; 1–30 listing days.
- Work duration and advertising duration are independent. Approval sets `published_at` and `expires_at = min(deadline, approval + listingDays * 24h)`. Pending moderation consumes no visibility time. Reads and public actions exclude expired listings; owners retain them with derived `expired` status. No cron is required.
- Migration 0001 adds nullable plan/publication/expiry columns and preserves older jobs. New dates are required when editing an older listing. Dates and deadline are validated on the server, including again on approval.
- Copy creates a new pending listing with refreshed dates, rather than updating the old listing. Close hides it immediately. Construction/demolition categories and daily pay are supported.
- ¥50/day is an illustrative maximum-price preview only. Beta remains free: no checkout, wallet, invoice, charge, or automatic renewal is implemented.
- In-app applications, candidate acceptance, filled-position counting and LINE/push notifications are not yet implemented. Contact remains email.

Validation: 23 SQLite-backed service tests, TypeScript and production build. Previous UI component QA covered range presets and selected-day rows; hosted authenticated create/approve flow still requires signed-in verification.

## GitHub and local development

Canonical GitHub export: https://github.com/shonhoonot/worker-app

Use Node 24 (`.nvmrc`) and pnpm 11.25.0. A fresh checkout uses the portable profile:

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm test
pnpm run build
pnpm dev
```

See [Монгол хөгжүүлэлтийн заавар](docs/DEVELOPMENT_MN.md). GitHub Actions runs typecheck, service tests and a production build on pushes and pull requests. It does not deploy the Site. GitHub hosts the source; Cloudflare/Sites still hosts the app and D1 database. This export does not include historical Site commits, runtime secrets, live data or generated build output.

For local D1 initialization, build first, then execute each SQL file in `drizzle/` in order, once per fresh local database:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_lethal_christian_walker.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_known_rumiko_fujikawa.sql
```

Local preview identity is development-only. Do not expose the dev server to the internet. Moving outside Sites requires a trusted authentication gateway or a replacement session implementation; never trust caller-supplied identity headers directly in production.
