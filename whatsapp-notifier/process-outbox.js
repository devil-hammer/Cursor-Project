const { fetchPendingNotifications, markSent, markFailed } = require('./db');
const { createAndInitializeClient, sendMessage, destroyClient } = require('./whatsapp-client');

async function main() {
  const pending = await fetchPendingNotifications();

  if (pending.length === 0) {
    console.log('No pending WhatsApp notifications.');
    return;
  }

  console.log(`Processing ${pending.length} pending notification(s)...`);

  let client = null;
  try {
    client = await createAndInitializeClient();

    for (const row of pending) {
      try {
        await sendMessage(client, row.message);
        await markSent(row.id);
        console.log(`Sent notification ${row.id} for session ${row.session_id}`);
      } catch (err) {
        const errorMessage = err?.message || String(err);
        await markFailed(row.id, errorMessage);
        console.error(`Failed notification ${row.id}: ${errorMessage}`);
      }
    }
  } finally {
    await destroyClient(client);
  }
}

main().catch((err) => {
  console.error('Outbox processor failed:', err);
  process.exit(1);
});
