const { neon } = require('@neondatabase/serverless');

const MAX_ATTEMPTS = Number(process.env.WHATSAPP_MAX_ATTEMPTS || 5);
const BATCH_SIZE = Number(process.env.WHATSAPP_BATCH_SIZE || 50);

let sqlClient = null;

function getConnectionString() {
  return (
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NO_SSL
  );
}

function getSql() {
  if (!sqlClient) {
    const connectionString = getConnectionString();
    if (!connectionString) {
      throw new Error(
        'Missing Postgres connection string. Set POSTGRES_URL or DATABASE_URL on Fly.'
      );
    }
    sqlClient = neon(connectionString);
  }
  return sqlClient;
}

async function fetchPendingNotifications() {
  const sql = getSql();
  return sql`
    SELECT id, session_id, message, attempts
    FROM whatsapp_notification_outbox
    WHERE status = 'pending'
      AND attempts < ${MAX_ATTEMPTS}
    ORDER BY created_at ASC
    LIMIT ${BATCH_SIZE};
  `;
}

async function markSent(id) {
  const sql = getSql();
  await sql`
    UPDATE whatsapp_notification_outbox
    SET status = 'sent',
        sent_at = now(),
        last_error = NULL
    WHERE id = ${id};
  `;
}

async function markFailed(id, errorMessage) {
  const sql = getSql();
  await sql`
    UPDATE whatsapp_notification_outbox
    SET attempts = attempts + 1,
        last_error = ${errorMessage},
        status = CASE
          WHEN attempts + 1 >= ${MAX_ATTEMPTS} THEN 'failed'
          ELSE 'pending'
        END
    WHERE id = ${id};
  `;
}

async function requeueSentNotifications() {
  const sql = getSql();
  const rows = await sql`
    UPDATE whatsapp_notification_outbox
    SET status = 'pending',
        sent_at = NULL,
        last_error = NULL
    WHERE status = 'sent'
    RETURNING id, session_id;
  `;
  return rows;
}

module.exports = {
  fetchPendingNotifications,
  markSent,
  markFailed,
  requeueSentNotifications,
};
