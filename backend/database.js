const { neon } = require('@neondatabase/serverless');

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
        'Missing Postgres connection string. Set POSTGRES_URL or DATABASE_URL in environment variables.'
      );
    }
    sqlClient = neon(connectionString);
  }
  return sqlClient;
}

async function initDatabase() {
  const sql = getSql();

  // Create tables if they don't exist (safe to run repeatedly).
  await sql`
    CREATE TABLE IF NOT EXISTS teams (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      team_id BIGINT REFERENCES teams(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS surf_sessions (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id),
      date DATE NOT NULL,
      location TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
}

module.exports = {
  initDatabase,
  getSql,
};
