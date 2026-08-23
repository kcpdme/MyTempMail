# MyTempMail

Disposable inboxes on **Next.js + Vercel**, inbound mail via **Resend**, storage in **Upstash Redis**. No extra server.

Set `ACCESS_PASSWORD` so only people who know that password can open the inbox. `/settings` is a second lock with `SETTINGS_SECRET`. The Resend webhook stays reachable so mail can still be delivered.

## How mail actually moves

- **Receiving** is a Resend webhook. Mail is stored even if the website is closed.
- **The inbox UI** only talks to Redis while this site is open. Close the tab and polling stops. Switch away and Auto refresh pauses. Refresh always fetches once.
- **Compose / Reply** send as the selected `user@your-domain`. Resend allows any local-part on a verified domain. You cannot send as `@gmail.com`.

## Local (mock, no keys)

```bash
cp .env.example .env.local
# MOCK_MODE=1 is already set
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use **Random** / **Use**, **Seed** to inject a test message, **Refresh** or Auto 5s, **Compose** / **Reply**. Settings are unlocked in mock mode when `SETTINGS_SECRET` is empty.

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

Upstash Free (500K commands/month) is enough for normal use: polling only happens while a tab is visible.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `ACCESS_PASSWORD` | Production | Locks the inbox UI and APIs behind `/login`. Leave unset for open local mock. |
| `SETTINGS_SECRET` | Production | Second lock for `/settings` (Resend keys, domains). |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Production | Inbox storage. Marketplace may inject `KV_REST_API_*` instead. |
| `RESEND_API_KEY` | To send/receive | Optional in env if you paste it in Settings. |
| `RESEND_WEBHOOK_SECRET` | To verify inbound | Usually auto-filled when Settings registers the webhook. |
| `APP_URL` | To auto-register webhook | Public site URL. Falls back to `VERCEL_URL`. |
| `DOMAINS` | Optional | Default allowlist. Settings can override. |
| `INBOX_TTL_SECONDS` | Optional | Default `86400` (24h). |
| `MAX_MESSAGES_PER_INBOX` | Optional | Default `50`. |
| `MOCK_MODE` | Local | `1` = in-memory store, stubbed sends. Omit/`0` in production. |

Env values are defaults. Saving Settings overlays Resend/domains/TTL without a redeploy. Passwords stay in env only.

`POST /api/webhooks/resend` stays public so Resend can deliver mail. Everything else is gated when `ACCESS_PASSWORD` is set.
