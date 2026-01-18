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
app.use(cors()); // Allow frontend to make requests
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

// Initialize database and start server
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

module.exports = app;
