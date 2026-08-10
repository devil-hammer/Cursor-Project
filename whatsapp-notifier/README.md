# WhatsApp Notifier (Surf Tracker)

Sends surf session notifications to a WhatsApp group using a **DB outbox + short-lived sender** model.

## How it works

1. When a surf session is created, the main API writes a row to `whatsapp_notification_outbox` in Postgres.
2. A GitHub Actions workflow runs every 10 minutes.
3. Each run starts a short-lived Fly machine that:
   - reads pending outbox rows
   - starts Chromium/WhatsApp only if there is work to send
   - sends messages
   - exits and releases memory

This avoids keeping Chromium running 24/7.

## Deploy to Fly.io

### 1. Install Fly CLI and login

```bash
curl -L https://fly.io/install.sh | sh
fly auth login
```

### 2. Create persistent volume (WhatsApp session)

```bash
cd whatsapp-notifier
fly volumes create whatsapp_data --size 1 --region iad
```

### 3. Set secrets on Fly

The outbox processor needs the same Postgres connection string as your main API:

```bash
fly secrets set POSTGRES_URL='your-neon-connection-string' -a surf-tracker-whatsapp-notifier
```

### 4. Deploy the image

```bash
fly deploy
```

### 5. Stop any old always-on machine

If you previously ran the old HTTP notifier, destroy or stop the existing machine so the volume is free for scheduled runs:

```bash
fly machines list -a surf-tracker-whatsapp-notifier
fly machine destroy <machine-id> -a surf-tracker-whatsapp-notifier
```

### 6. First-time WhatsApp linking

Run the processor manually and watch logs for a QR code:

```bash
fly machine run $(fly image show -a surf-tracker-whatsapp-notifier -j | jq -r '.[0].Tag') \
  --app surf-tracker-whatsapp-notifier \
  --region iad \
  --volume whatsapp_data:/data \
  --vm-memory 2048 \
  --rm \
  node process-outbox.js
```

Scan the QR code from WhatsApp → Settings → Linked Devices.

## Configure main Surf Tracker API (Vercel)

WhatsApp notifications are enabled by default. To disable them:

- `WHATSAPP_NOTIFICATIONS_ENABLED=false`

No `WHATSAPP_NOTIFIER_URL` is needed anymore.

Redeploy Vercel after changing env vars so the API creates outbox rows.

## GitHub Actions scheduler

Workflow: `.github/workflows/process-whatsapp-outbox.yml`

Required repo secret:

- `FLY_API_TOKEN` — Fly deploy token for `surf-tracker-whatsapp-notifier`

After pushing this workflow, you can also run it manually from GitHub → Actions → Process WhatsApp Outbox → Run workflow.

## Manual test

1. Log a surf session in the app.
2. Confirm a row exists in `whatsapp_notification_outbox` with `status = 'pending'`.
3. Run the GitHub Action manually or wait up to 10 minutes.
4. Confirm the row becomes `status = 'sent'`.

## Environment variables

| Variable | Description |
|----------|-------------|
| `POSTGRES_URL` | Postgres connection string (required on Fly) |
| `WHATSAPP_GROUP_ID` | Target WhatsApp group ID |
| `WHATSAPP_GROUP_NAME` | Group name (legacy fallback) |
| `WHATSAPP_GROUP_INVITE_CODE` | Invite code (legacy fallback) |
| `WHATSAPP_AUTH_PATH` | Auth data path (default `/data/.wwebjs_auth`) |
| `PUPPETEER_EXECUTABLE_PATH` | Chromium path (set in Dockerfile) |
| `WHATSAPP_INIT_TIMEOUT_MS` | Init timeout (default `120000`) |
| `WHATSAPP_MAX_ATTEMPTS` | Max send attempts per outbox row (default `5`) |
| `WHATSAPP_BATCH_SIZE` | Max rows processed per run (default `50`) |

## Troubleshooting

- **No messages sent**
  - Check outbox rows in Postgres (`status`, `attempts`, `last_error`)
  - Confirm GitHub Action runs are succeeding
  - Confirm `POSTGRES_URL` is set on Fly
- **QR code appears again**
  - Re-link device from WhatsApp mobile app
  - Confirm `/data` volume is mounted
- **Volume mount fails in GitHub Action**
  - Ensure no old always-on machine still has the volume attached
