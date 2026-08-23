# MyTempMail

Disposable inboxes on **Next.js + Vercel**, inbound mail via **Resend**, storage in **Upstash Redis**. No extra server.

Inboxes are public to anyone who knows the address. Protect `/settings` with `SETTINGS_SECRET`.

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
3. Set `SETTINGS_SECRET` in Vercel env. Set `MOCK_MODE=0` (or omit it once Redis exists).
4. Open `/settings`, paste a Resend API key and your public app URL, save. The app registers `email.received` on `/api/webhooks/resend`.
5. **Add domain** in Settings. Copy DNS (MX/SPF/DKIM) to your registrar. Click **I added DNS records**. When Resend shows verified / receiving, the domain appears in the inbox dropdown.

A subdomain such as `mail.example.com` is safer than your root domain.

Upstash Free (500K commands/month) is enough for normal use: polling only happens while a tab is visible.

## Env vs Settings

| Stays in env | Editable in Settings (Redis overlay) |
| --- | --- |
| Redis URL/token (Marketplace) | Resend API key |
| `SETTINGS_SECRET` | Webhook secret (usually auto-filled) |
| `MOCK_MODE` | Domains, TTL, max messages, app URL |

Env values are defaults. Saving Settings overrides them without a redeploy.
