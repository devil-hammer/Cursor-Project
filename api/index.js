const serverless = require('serverless-http');
const { initDatabase } = require('../backend/database');

let initPromise = null;
function ensureInit() {
  if (!initPromise) initPromise = initDatabase();
  return initPromise;
}

// require server after we've set VERCEL; server.js skips listen/init when VERCEL is set
const app = require('../backend/server');

module.exports = async (req, res) => {
  await ensureInit();
  return serverless(app)(req, res);
};
