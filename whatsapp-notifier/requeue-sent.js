const { requeueSentNotifications } = require('./db');

async function main() {
  const rows = await requeueSentNotifications();
  if (rows.length === 0) {
    console.log('No sent notifications to requeue.');
    return;
  }
  console.log(`Requeued ${rows.length} notification(s):`);
  for (const row of rows) {
    console.log(`- outbox ${row.id} (session ${row.session_id})`);
  }
}

main().catch((err) => {
  console.error('Failed to requeue sent notifications:', err);
  process.exit(1);
});
