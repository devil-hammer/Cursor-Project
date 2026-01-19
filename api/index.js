const { initDatabase } = require('../backend/database');

let initPromise = null;
function ensureInit() {
  if (!initPromise) initPromise = initDatabase();
  return initPromise;
}

let app = null;
function getApp() {
  if (!app) {
    // Require server lazily so require-time errors become a JSON 500.
    // `backend/server.js` skips listen/init when VERCEL is set.
    app = require('../backend/server');
  }
  return app;
}

module.exports = async (req, res) => {
  try {
    await ensureInit();
    // Vercel Node functions provide a Node-style (req, res).
    // An Express app is already a request handler function with this signature.
    return getApp()(req, res);
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
