const serverless = require('serverless-http');
const { initDatabase } = require('../backend/database');

let initPromise = null;
function ensureInit() {
  if (!initPromise) initPromise = initDatabase();
  return initPromise;
}

let handler = null;
function getHandler() {
  if (!handler) {
    // Require server lazily so require-time errors become a JSON 500.
    // server.js skips listen/init when VERCEL is set.
    const app = require('../backend/server');
    // Prevent open handles (e.g., sqlite connections) from blocking the response.
    handler = serverless(app, { callbackWaitsForEmptyEventLoop: false });
  }
  return handler;
}

module.exports = async (req, res) => {
  try {
    await ensureInit();
    return await getHandler()(req, res);
  } catch (err) {
    console.error('Unhandled API error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: 'Internal Server Error',
        message: err && err.message ? err.message : String(err),
      })
    );
  }
};
