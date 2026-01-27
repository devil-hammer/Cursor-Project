const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const GROUP_NAME = process.env.WHATSAPP_GROUP_NAME || 'Semi-kooks';

let client = null;
let groupId = null;
let isReady = false;

function initWhatsApp() {
  const puppeteerOptions = {};
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    puppeteerOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    puppeteerOptions.args = ['--no-sandbox', '--disable-setuid-sandbox'];
  }

  client = new Client({
    puppeteer: Object.keys(puppeteerOptions).length ? puppeteerOptions : undefined,
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

    const chats = await client.getChats();
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

  client.initialize();
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
    await client.sendMessage(groupId, message);
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
