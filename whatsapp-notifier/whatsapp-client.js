const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const GROUP_ID = process.env.WHATSAPP_GROUP_ID ? process.env.WHATSAPP_GROUP_ID.trim() : null;
const INIT_TIMEOUT_MS = Number(process.env.WHATSAPP_INIT_TIMEOUT_MS || 120000);

function getPuppeteerOptions() {
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--no-first-run',
    '--disable-extensions',
    '--no-zygote',
    '--disable-accelerated-2d-canvas',
  ];

  const options = {
    protocolTimeout: 300000,
    headless: true,
  };

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    options.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    options.args = args;
  }

  return options;
}

async function createAndInitializeClient() {
  return new Promise((resolve, reject) => {
    const client = new Client({
      puppeteer: getPuppeteerOptions(),
      authStrategy: new LocalAuth({
        dataPath: process.env.WHATSAPP_AUTH_PATH || '/data/.wwebjs_auth',
      }),
    });

    let settled = false;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      fn(value);
    };

    const timeout = setTimeout(() => {
      finish(reject, new Error(`WhatsApp client init timed out after ${INIT_TIMEOUT_MS}ms`));
    }, INIT_TIMEOUT_MS);

    client.on('qr', (qr) => {
      console.log('QR Code received, scan with your phone:');
      qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
      console.log('WhatsApp client is ready');
      finish(resolve, client);
    });

    client.on('auth_failure', (msg) => {
      finish(reject, new Error(`WhatsApp auth failure: ${msg}`));
    });

    client.on('disconnected', (reason) => {
      finish(reject, new Error(`WhatsApp disconnected during init: ${reason}`));
    });

    client.initialize().catch((err) => {
      finish(reject, err);
    });
  });
}

async function sendMessage(client, message) {
  if (!GROUP_ID) {
    throw new Error('WHATSAPP_GROUP_ID is not configured');
  }
  await client.sendMessage(GROUP_ID, message, { sendSeen: false });
}

async function destroyClient(client) {
  if (!client) return;
  try {
    await client.destroy();
  } catch (err) {
    console.warn('Error destroying WhatsApp client:', err.message);
  }
}

module.exports = {
  createAndInitializeClient,
  sendMessage,
  destroyClient,
};
