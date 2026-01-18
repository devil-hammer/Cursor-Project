const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { initDatabase } = require('./database');
const userRoutes = require('./routes/users');
const sessionRoutes = require('./routes/sessions');
const teamRoutes = require('./routes/teams');

const app = express();
const PORT = 3000;

// Middleware
const allowedOrigins = [
  'https://YOUR_GITHUB_USERNAME.github.io',  // Replace with your GitHub Pages origin (no trailing slash)
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8080',
];
// Add 'https://yourdomain.com' to allowedOrigins if you use a custom domain for the frontend
app.use(cors({ origin: allowedOrigins }));
app.use(bodyParser.json()); // Parse JSON request bodies
app.use(bodyParser.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Routes
app.use('/api/users', userRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/teams', teamRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Surf Tracker API is running' });
});

// On Vercel, we export the app for serverless; init and listen are done in api/index.js
if (!process.env.VERCEL) {
  initDatabase()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
        console.log(`API health check: http://localhost:${PORT}/api/health`);
      });
    })
    .catch((err) => {
      console.error('Failed to initialize database:', err);
      process.exit(1);
    });
}

module.exports = app;
