# MyTempMail

Disposable inboxes on **Next.js + Vercel**, inbound mail via **Resend**, storage in **TursoDB**. No extra server.

Set `ACCESS_PASSWORD` so only people who know that password can open the **member** workspace. Guests can still open a **single inbox** if a member created a password for it. `/settings` is a second lock with `SETTINGS_SECRET`. The Resend webhook stays reachable so mail can still be delivered.

## How mail actually moves

- **Receiving** is a Resend webhook. Mail is stored even if the website is closed. Each message expires 24 hours after receipt by default (Settings TTL). New deliveries and webhook retries do not extend older messages. Expired mail is immediately hidden and physically removed by cleanup. Imported mail keeps its original remaining TTL.
- **The inbox UI** only queries inbox summaries while this site is open. It checks every 30 seconds while visible. **Watch** temporarily speeds that up to every 5 seconds for 3 minutes, then returns to 30 seconds. Switching away pauses checks. Manual **Refresh** also runs the Resend recovery sync. Expired address tabs drop off the sidebar.
- **Random / New** mint a unique `word-word-xxxxxx` address. Typed **Use** stays whatever you type.
- **Guest access** is receive-only. A member clicks **Guest access** on an inbox to create a password for 1, 3, 7, or 30 days, or 6 calendar months. Settings → Guest access selects the permitted guest email domains and default duration (3 days). No domains are enabled for guests until explicitly selected; existing installations must select their guest domains after upgrading. Guests sign in with that address + password and stay signed in until it expires. Removing a guest domain blocks new logins and existing sessions. Changing the default duration does not change existing passwords. Revoking or rotating the password ends existing guest sessions. Guests cannot send, reply, or delete.
- **Guest administration** in Settings → Guest inboxes lists and searches existing guest grants, including disabled domains. Reset a timeout to 1, 3, 7, or 30 days, or 6 calendar months from now without changing the password, or revoke access immediately. Extensions may require guests to sign in again after their current session ends. Expired/revoked grants disappear; this is not a historical audit log.
- **Compose / Reply** send as the selected `user@your-domain`. Resend allows any local-part on a verified domain. You cannot send as `@gmail.com`. Guests never see compose.

## Local (mock, no keys)

```bash
cp .env.example .env.local
# MOCK_MODE=1 is already set
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use **Random** / **Use**, **Seed** to inject a test message, **Refresh**, or the temporary 5-second **Watch** mode, plus **Compose** / **Reply**. Select a guest domain in Settings, then open **Guest access** on an inbox to choose a duration and mint a receive-only password. Settings are unlocked in mock mode when `SETTINGS_SECRET` is empty. To try the split login locally, set `ACCESS_PASSWORD` in `.env.local`.

```bash
npm test
npm run lint
npm run build
```

## Vercel + Turso setup

1. Create a **TursoDB** database in [Turso Cloud](https://turso.tech) on the Free plan. Enable the TursoDB toggle. This app uses `@tursodatabase/serverless` for the new engine. Keep paid overages disabled.
2. Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in your local environment or `.env.local`. Keep both server-only. Run `npm run db:setup` once against the target database; rerunning setup is safe. Use Node.js 22.9+ for the setup/migration commands.
3. Add the same credentials to Vercel, plus `ACCESS_PASSWORD`, `SETTINGS_SECRET`, `MOCK_MODE=0`, and a long random `CRON_SECRET`. Deploy. Missing production database configuration fails visibly instead of using temporary memory.
4. Open `/settings`, paste a Resend API key and your public app URL, and save. The app registers `email.received` on `/api/webhooks/resend`.
5. **Add domain** in Settings. Copy DNS (MX/SPF/DKIM) to your registrar. Click **I added DNS records**. When Resend shows verified / receiving, the domain appears in the inbox dropdown.

A subdomain such as `mail.example.com` is safer than your root domain. Keep your existing Vercel and Resend plans; their limits and charges are separate from database costs.

The database stores email summaries separately from bodies so polling never transfers full emails. Inbox writes and trimming are transactional. Send and guest-login limits use atomic SQL sliding windows (10 sends / 10 minutes and 5 guest login attempts / 10 minutes per IP). A database error does not bypass those limits.

`vercel.json` schedules authenticated cleanup daily at approximately 03:00 UTC (compatible with a once-daily Hobby cron). Vercel supplies `Authorization: Bearer CRON_SECRET`. Every read excludes expired records even before cleanup runs. Incoming mail also removes up to 500 expired messages; rate-limit calls prune expired counters. Daily cleanup removes expired messages, grants and counters in bounded batches. Its JSON `more: true` means another authenticated cleanup invocation is needed. Monitor cron failures and database usage in the provider dashboards. Deleting rows allows storage reuse; the allocated database file may not immediately shrink.

## Migrating existing Upstash data

The import script reads Redis and **never modifies or deletes source keys**. It preserves settings, guest password hashes/salts/versions, and remaining message/access TTLs. Existing target records are not overwritten, so retries are safe. Inbox summaries are rebuilt from live message records. Rate-limit counters restart on cutover; existing member/guest cookies remain valid when `ACCESS_PASSWORD` is unchanged.

1. Create a fresh TursoDB database and run `npm run db:setup`. Keep your existing Redis instance and deployment available until verification is complete.
2. Add the old `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_URL` / `KV_REST_API_TOKEN`) to your **local** environment, alongside the new Turso credentials. Do not commit credentials. `npm run db:migrate:redis -- --dry-run` checks source connectivity and counts readable records without writing to Turso.
3. Deploy this version to the production URL with `STORAGE_MAINTENANCE=1`, Turso credentials, and `MOCK_MODE=0`. This returns 503 for app requests and webhook deliveries while copying. Ensure old deployment URLs are not accepting traffic or writes. Keep this maintenance window short so failed Resend deliveries can be retried.
4. Run `npm run db:migrate:redis`. If it fails partway, fix the reported setup/connectivity problem and rerun against the same target **before resuming traffic**. The script prints counts only, never email contents or secrets. It requires message keys to have a TTL; inspect any malformed source data before cutover.
5. Remove `STORAGE_MAINTENANCE` (or set `0`) and redeploy. Verify existing inboxes and guest login, password rotation/revocation, a new inbound email, outbound sending, and an authenticated cleanup call. Check Resend's webhook dashboard and retry failed deliveries if necessary. A database move does not require changing your webhook URL or DNS.
6. After verification, remove old Redis credentials and disconnect/cancel the paid Upstash integration in its billing dashboard. Removing the npm dependency does not cancel that subscription. Keep a source backup until confident in the migration; after Turso begins accepting writes, rolling back requires reconciling those new records.

The importer copies the source's remaining TTL rather than restarting a 24-hour timer. Source writes must stay paused during import; it is not a continuous replication service. No migration is run automatically on deployment.

## Local SQL integration

Mock mode remains available for UI development. The test suite exercises the real Turso engine locally using `@tursodatabase/database`; it needs no cloud credentials. Real app mode requires a remote `turso://` or `https://` database URL and an auth token. No SQLite file is stored on Vercel.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `ACCESS_PASSWORD` | Production | Locks the **member** workspace behind `/login`. Guests use a per-inbox password created in the UI (configurable password and session duration). Leave unset for open local mock. |
| `SETTINGS_SECRET` | Production | Second lock for `/settings` (Resend keys, domains). |
| `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` | Production | Remote TursoDB database credentials, server-only. |
| `CRON_SECRET` | Production | Authenticates the daily expiry cleanup. |
| `STORAGE_MAINTENANCE` | Migration only | `1` returns 503 while copying existing data; remove after import. |
| `RESEND_API_KEY` | To send/receive | Optional in env if you paste it in Settings. |
| `RESEND_WEBHOOK_SECRET` | To verify inbound | Usually auto-filled when Settings registers the webhook. |
| `APP_URL` | To auto-register webhook | Public site URL. Falls back to `VERCEL_URL`. |
| `DOMAINS` | Optional | Default allowlist. Settings can override. |
| `INBOX_TTL_SECONDS` | Optional | Default `86400` (24h). |
| `MAX_MESSAGES_PER_INBOX` | Optional | Default `50`. |
| `MOCK_MODE` | Local | `1` = in-memory store, stubbed sends. Omit/`0` in production. |

Settings uses four dashboard tabs: App & delivery, Guest policy, Guest inboxes, and Domains. The Guest inboxes tab keeps search and timeout/revoke controls separate from the other settings.

Env values are defaults. Saving Settings overlays Resend/domains/TTL without a redeploy. Passwords stay in env only.

`POST /api/webhooks/resend` stays public so Resend can deliver mail. `/login`, `/api/access`, `/api/guest`, `/api/config`, and `/api/session` stay reachable so guests can sign in. Inbox reads require a member cookie or a guest cookie bound to that address. Send, delete, and share mutations are member-only.
