const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const GROUP_NAME = process.env.WHATSAPP_GROUP_NAME || 'Semi-kooks';
const GROUP_ID = process.env.WHATSAPP_GROUP_ID || null;
const INVITE_CODE = (() => {
  const v = process.env.WHATSAPP_GROUP_INVITE_CODE || '';
  if (!v) return null;
  const match = v.trim().match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)$/) || v.trim().match(/^([A-Za-z0-9]+)$/);
  return match ? match[1] : v.trim();
})();
const MAX_INIT_RETRIES = 4;
const INIT_RETRY_DELAY_MS = 20000;
const PAGE_TIMEOUT_MS = 300000;

let client = null;
let groupId = null;
let isReady = false;

async function doInit(retryCount = 0) {
  if (client) {
    try {
      await client.destroy();
    } catch (e) {
      /* ignore */
    }
    client = null;
  }
  isReady = false;
  groupId = null;

  const puppeteerArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--no-first-run',
    '--disable-extensions',
  ];
  const puppeteerOptions = {
    protocolTimeout: 600000,
  };
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    puppeteerOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    puppeteerOptions.args = puppeteerArgs;
  }

  client = new Client({
    puppeteer: puppeteerOptions,
    authStrategy: new LocalAuth({
      dataPath: process.env.WHATSAPP_AUTH_PATH || '/data/.wwebjs_auth',
    }),
  });

  client.on('qr', (qr) => {
    console.log('QR Code received, scan with your phone:');
    qrcode.generate(qr, { small: true });
  });

  const target = GROUP_NAME.trim().toLowerCase();

  client.on('ready', async () => {
    console.log('WhatsApp client is ready!');
    isReady = true;

    if (client.pupPage && typeof client.pupPage.setDefaultTimeout === 'function') {
      client.pupPage.setDefaultTimeout(PAGE_TIMEOUT_MS);
    }

    const fetchGroupsWithRetry = async (attempt = 1, maxAttempts = 3) => {
      try {
        return await client.getChats();
      } catch (e) {
        const isTimeout = (e.message || '').includes('timed out');
        if (isTimeout && attempt < maxAttempts) {
          console.log(`getChats timeout, retrying in 10s (attempt ${attempt}/${maxAttempts})...`);
          await new Promise((r) => setTimeout(r, 10000));
          return fetchGroupsWithRetry(attempt + 1, maxAttempts);
        }
        throw e;
      }
    };

    try {
      if (GROUP_ID) {
        groupId = GROUP_ID.trim();
        console.log(`Using group ID from config: ${groupId}`);
        return;
      }

      if (INVITE_CODE) {
        try {
          const gid = await client.acceptInvite(INVITE_CODE);
          if (gid) {
            groupId = gid;
            console.log(`Resolved group from invite code: ${groupId}`);
            return;
          }
        } catch (inviteErr) {
          console.warn('Invite lookup failed (may already be in group):', inviteErr.message);
        }
      }

      const chats = await fetchGroupsWithRetry();
      const group = chats.find(
        (chat) =>
          chat.isGroup &&
          chat.name &&
          chat.name.trim().toLowerCase() === target
      );

      if (group) {
        groupId = group.id._serialized;
        console.log(`Found group "${group.name}" with ID: ${groupId}`);
      } else {
        const groupNames = chats.filter((c) => c.isGroup).map((c) => c.name);
        console.error(`Group "${GROUP_NAME}" not found. Available groups:`, groupNames);
      }
    } catch (e) {
      console.error('Error resolving group:', e.message);
    }
  });

  client.on('authenticated', () => {
    console.log('WhatsApp authenticated');
  });

  client.on('auth_failure', (msg) => {
    console.error('WhatsApp authentication failed:', msg);
  });

  client.on('disconnected', (reason) => {
    console.log('WhatsApp client disconnected:', reason);
    isReady = false;
  });

  try {
    await client.initialize();
  } catch (err) {
    console.error('WhatsApp init error:', err.message);
    const isCtxDestroyed = (err.message || '').includes('Execution context was destroyed');
    if (isCtxDestroyed && retryCount < MAX_INIT_RETRIES) {
      console.log(`Retrying in ${INIT_RETRY_DELAY_MS / 1000}s (attempt ${retryCount + 1}/${MAX_INIT_RETRIES})...`);
      await new Promise((r) => setTimeout(r, INIT_RETRY_DELAY_MS));
      return doInit(retryCount + 1);
    }
    console.error('WhatsApp init failed. Server will keep running; /health will show whatsapp_ready: false.');
  }
}

function initWhatsApp() {
  doInit().catch((err) => {
    console.error('WhatsApp init failed permanently:', err);
  });
}

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    whatsapp_ready: isReady,
    group_found: !!groupId,
  });
});

app.get('/debug-groups', async (req, res) => {
  if (!isReady || !client) {
    return res.status(503).json({ error: 'WhatsApp not ready' });
  }
  try {
    const chats = await client.getChats();
    const groups = chats
      .filter((c) => c.isGroup && c.name)
      .map((c) => ({ name: c.name, id: c.id._serialized }));
    res.json({ groups });
  } catch (err) {
    console.error('Debug groups error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/notify-session', async (req, res) => {
  if (!isReady || !groupId) {
    return res.status(503).json({
      error: 'WhatsApp not ready or group not found',
      ready: isReady,
      groupId: !!groupId,
    });
  }

  const { user_name, location, notes, team_name } = req.body;

  let message = '🏄 Surf session logged\n\n';
  message += `Surfer: ${user_name}\n`;
  if (location) message += `Location: ${location}\n`;
  if (team_name) message += `Team: ${team_name}\n`;
  if (notes) message += `Notes: ${notes}\n`;

  try {
    await client.sendMessage(groupId, message, { sendSeen: false });
    console.log('Message sent to WhatsApp group');
    res.json({ success: true, message: 'Notification sent' });
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    res.status(500).json({
      error: 'Failed to send notification',
      details: error.message,
    });
  }
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`WhatsApp notifier server running on port ${PORT}`);
  initWhatsApp();
});
