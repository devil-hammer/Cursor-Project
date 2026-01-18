const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file path
const DB_PATH = path.join(__dirname, 'surf_tracker.db');

// Create and initialize database
function initDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
        reject(err);
        return;
      }
      console.log('Connected to SQLite database');
    });

    // Create teams table first
    db.run(`CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) {
        console.error('Error creating teams table:', err.message);
        db.close();
        reject(err);
        return;
      }
      
      // Create users table after teams table is created
      // Check if users table exists first
      db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (err, row) => {
        const tableExists = !!row;
        
        const continueWithSessions = () => {
          // Create surf_sessions table after users table is created
          db.run(`CREATE TABLE IF NOT EXISTS surf_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            date DATE NOT NULL,
            location TEXT,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
          )`, (err) => {
            if (err) {
              console.error('Error creating surf_sessions table:', err.message);
              db.close();
              reject(err);
              return;
            }
            console.log('Database tables initialized');
            resolve(db);
          });
        };
        
        if (!tableExists) {
          // Create users table with team_id from the start
          db.run(`CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE,
            team_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (team_id) REFERENCES teams(id)
          )`, (err) => {
            if (err) {
              console.error('Error creating users table:', err.message);
              db.close();
              reject(err);
              return;
            }
            continueWithSessions();
          });
        } else {
          // Table exists, try to add team_id column if it doesn't exist
          db.run(`ALTER TABLE users ADD COLUMN team_id INTEGER`, (err) => {
            // Ignore error if column already exists
            if (err && !err.message.includes('duplicate column')) {
              console.warn('Could not add team_id column:', err.message);
            }
            continueWithSessions();
          });
        }
      });
    });
  });
}

// Get database connection
function getDatabase() {
  return new sqlite3.Database(DB_PATH);
}

module.exports = {
  initDatabase,
  getDatabase
};
