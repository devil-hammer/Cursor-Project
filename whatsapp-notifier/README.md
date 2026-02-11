# WhatsApp Notifier (Surf Tracker)

Sends surf session notifications to a WhatsApp group when sessions are logged via the main Surf Tracker API.

## What it does

- Exposes `POST /notify-session` to send a message to WhatsApp
- Maintains a persistent WhatsApp Web login session on Fly volume storage
- Provides `GET /health` for readiness checks

## Deploy to Fly.io

### 1. Install Fly CLI

```bash
# macOS
curl -L https://fly.io/install.sh | sh
# or: brew install flyctl
```

### 2. Login

```bash
fly auth login
```

### 3. Create persistent volume (for WhatsApp session)

```bash
cd whatsapp-notifier
fly volumes create whatsapp_data --size 1 --region iad
```

### 4. Deploy

```bash
fly launch
```

- Use app name `surf-tracker-whatsapp-notifier` (or your choice).
- Say **no** to Postgres and Redis.

### 5. First-time setup: scan QR code

1. Run `fly logs` and watch for the QR code.
2. Open WhatsApp → Settings → Linked Devices → Link a Device.
3. Scan the QR from the logs.
4. Once ready, the app resolves the target group and starts accepting notifications.

### 6. Get your notifier URL

After deploy, your app URL is something like:

```
https://surf-tracker-whatsapp-notifier.fly.dev
```

### 7. Configure main Surf Tracker API (Vercel)

In Vercel → Project → Settings → Environment Variables, add:

- **Name:** `WHATSAPP_NOTIFIER_URL`
- **Value:** `https://surf-tracker-whatsapp-notifier.fly.dev` (your Fly URL)
- **Environment:** Production (and Preview if you want)

Redeploy the main app so the API uses this variable.

## Test a manual notification

This sends a WhatsApp message only (it does **not** write to your Surf Tracker DB):

```bash
curl -s -X POST https://surf-tracker-whatsapp-notifier.fly.dev/notify-session \
  -H "Content-Type: application/json" \
  -d '{"user_name":"Test User","location":"Test Break","notes":"Test ping","team_name":"The North"}'
```

## Health check

```bash
curl https://surf-tracker-whatsapp-notifier.fly.dev/health
```

Expect `whatsapp_ready: true` and `group_found: true` once linked and the group is detected.

## Troubleshooting

- `whatsapp_ready: false`:
  - Wait ~30-60s after deploy and check logs again.
  - If needed, re-link device from WhatsApp mobile app.
- `group_found: false`:
  - Confirm `WHATSAPP_GROUP_ID` (preferred) or group name/invite values.
  - Check app logs for group resolution errors/timeouts.
- Notifications fail from main app but manual notifier test works:
  - Confirm `WHATSAPP_NOTIFIER_URL` is set in Vercel.
  - Redeploy Vercel after changing env vars.

## Environment variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default `3001`) |
| `WHATSAPP_GROUP_NAME` | WhatsApp group name (fallback when resolving by name) |
| `WHATSAPP_GROUP_ID` | Use this group ID directly; skips lookup (e.g. `123456789@g.us`) |
| `WHATSAPP_GROUP_INVITE_CODE` | Invite code or full link (e.g. `KPTH...` or `https://chat.whatsapp.com/KPTH...`). Used to resolve the group without `getChats`, avoiding timeouts. |
| `WHATSAPP_AUTH_PATH` | Path for auth data (default `/data/.wwebjs_auth` on Fly) |
| `PUPPETEER_EXECUTABLE_PATH` | Chromium path (set in Dockerfile for Fly) |
