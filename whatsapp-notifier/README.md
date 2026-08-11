# WhatsApp Notifier (Surf Tracker)

Sends surf session notifications to a WhatsApp group using a **DB outbox + short-lived sender** model.

## How it works

1. When a surf session is created, the main API writes a row to `whatsapp_notification_outbox` in Postgres.
2. A GitHub Actions workflow runs every 10 minutes.
3. Each run starts the existing Fly machine (the one that already has the WhatsApp volume):
   - reads pending outbox rows
   - starts Chromium/WhatsApp only if there is work to send
   - sends messages
   - exits and stays stopped until the next run

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

### 5. Keep a single machine with the volume attached

Do **not** destroy the machine that owns `whatsapp_data`. A Fly volume can only attach to one machine, so scheduled runs start that same machine.

After deploy, stop it if it is still running the old always-on process:

```bash
fly machines list -a surf-tracker-whatsapp-notifier
fly machine stop <machine-id> -a surf-tracker-whatsapp-notifier
```

### 6. First-time WhatsApp linking

Start the existing machine and watch logs for a QR code:

```bash
fly machine start <machine-id> -a surf-tracker-whatsapp-notifier
fly logs -a surf-tracker-whatsapp-notifier
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
- **`No unattached volumes in region 'iad'`**
  - The old workflow tried to create a *new* machine. The volume is already attached to the existing one.
  - Use the updated workflow, which starts that existing machine instead.
