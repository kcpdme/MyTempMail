# MyTempMail

Disposable inboxes on **Next.js + Vercel**, inbound mail via **Resend**, storage in **Upstash Redis**. No extra server.

Set `ACCESS_PASSWORD` so only people who know that password can open the **member** workspace. Guests can still open a **single inbox** if a member created a password for it. `/settings` is a second lock with `SETTINGS_SECRET`. The Resend webhook stays reachable so mail can still be delivered.

## How mail actually moves

- **Receiving** is a Resend webhook. Mail is stored even if the website is closed. Quiet inboxes expire after 24 hours idle (Settings TTL); a new message resets that clock.
- **The inbox UI** only talks to Redis while this site is open. It checks every 30 seconds while visible. **Watch** temporarily speeds that up to every 5 seconds for 3 minutes, then returns to 30 seconds. Switching away pauses checks. Manual **Refresh** also runs the Resend recovery sync. Expired address tabs drop off the sidebar.
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

## Vercel (Hobby is enough)

1. Deploy this repo to Vercel (Hobby/free is fine).
2. Add Redis:
   - **Marketplace:** Storage → Upstash Redis → Free, or
   - Create a DB at [upstash.com](https://upstash.com) and paste `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`.
3. Set `ACCESS_PASSWORD` and `SETTINGS_SECRET` in Vercel env. Set `MOCK_MODE=0` (or omit it once Redis exists). Without `ACCESS_PASSWORD`, anyone with the URL can read inboxes.
4. Open `/settings`, paste a Resend API key and your public app URL, save. The app registers `email.received` on `/api/webhooks/resend`.
5. **Add domain** in Settings. Copy DNS (MX/SPF/DKIM) to your registrar. Click **I added DNS records**. When Resend shows verified / receiving, the domain appears in the inbox dropdown.

A subdomain such as `mail.example.com` is safer than your root domain.

Upstash Free (500K commands/month) is enough for normal use: standard checks run every 30 seconds only while a tab is visible, and 5-second Watch mode automatically ends after 3 minutes.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `ACCESS_PASSWORD` | Production | Locks the **member** workspace behind `/login`. Guests use a per-inbox password created in the UI (configurable password and session duration). Leave unset for open local mock. |
| `SETTINGS_SECRET` | Production | Second lock for `/settings` (Resend keys, domains). |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Production | Inbox storage. Marketplace may inject `KV_REST_API_*` instead. |
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
