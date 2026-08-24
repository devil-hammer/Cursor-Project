const { createAndInitializeClient, sendMessage, destroyClient } = require('./whatsapp-client');

async function main() {
  const message =
    process.argv.slice(2).join(' ') ||
    '🧪 Surf Tracker test message — if you see this in Semi-kooks, notifications are working.';

  let client = null;
  try {
    client = await createAndInitializeClient();
    await sendMessage(client, message);
    console.log('Test message sent successfully.');
  } finally {
    await destroyClient(client);
  }
}

main().catch((err) => {
  console.error('Failed to send test message:', err);
  process.exit(1);
});
