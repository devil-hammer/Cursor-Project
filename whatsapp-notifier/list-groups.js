const { createAndInitializeClient, destroyClient } = require('./whatsapp-client');

async function main() {
  let client = null;
  try {
    client = await createAndInitializeClient();
    const chats = await client.getChats();
    const groups = chats
      .filter((chat) => chat.isGroup && chat.name)
      .map((chat) => ({ name: chat.name, id: chat.id._serialized }))
      .sort((a, b) => a.name.localeCompare(b.name));

    console.log(`Found ${groups.length} group(s):`);
    for (const group of groups) {
      console.log(`- ${group.name}: ${group.id}`);
    }
  } finally {
    await destroyClient(client);
  }
}

main().catch((err) => {
  console.error('Failed to list WhatsApp groups:', err);
  process.exit(1);
});
