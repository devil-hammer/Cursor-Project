const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database');

// GET all users
router.get('/', (req, res) => {
  const db = getDatabase();
  
  db.all(`
    SELECT 
      u.*,
      t.name as team_name
    FROM users u
    LEFT JOIN teams t ON u.team_id = t.id
    ORDER BY u.created_at DESC
  `, [], (err, rows) => {
    if (err) {
      console.error('Error fetching users:', err.message);
      res.status(500).json({ error: 'Failed to fetch users' });
      db.close();
      return;
    }
    res.json(rows);
    db.close();
  });
});

// GET a specific user by ID
router.get('/:id', (req, res) => {
  const db = getDatabase();
  const userId = req.params.id;
  
  db.get(`
    SELECT 
      u.*,
      t.name as team_name
    FROM users u
    LEFT JOIN teams t ON u.team_id = t.id
    WHERE u.id = ?
  `, [userId], (err, row) => {
    if (err) {
      console.error('Error fetching user:', err.message);
      res.status(500).json({ error: 'Failed to fetch user' });
      db.close();
      return;
    }
    
    if (!row) {
      res.status(404).json({ error: 'User not found' });
      db.close();
      return;
    }
    
    res.json(row);
    db.close();
  });
});

// POST create a new user
router.post('/', (req, res) => {
  const db = getDatabase();
  const { name, email, team_id } = req.body;
  
  // Validate input
  if (!name || name.trim() === '') {
    res.status(400).json({ error: 'Name is required' });
    db.close();
    return;
  }
  
  // Validate team_id if provided
  if (team_id) {
    db.get('SELECT id FROM teams WHERE id = ?', [team_id], (err, team) => {
      if (err || !team) {
        res.status(400).json({ error: 'Invalid team_id' });
        db.close();
        return;
      }
      insertUser();
    });
  } else {
    insertUser();
  }
  
  function insertUser() {
    // Insert user
    db.run(
      'INSERT INTO users (name, email, team_id) VALUES (?, ?, ?)',
      [name.trim(), email ? email.trim() : null, team_id || null],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            res.status(400).json({ error: 'Email already exists' });
            db.close();
            return;
          }
          console.error('Error creating user:', err.message);
          res.status(500).json({ error: 'Failed to create user' });
          db.close();
          return;
        }
        
        // Return the created user with team name
        db.get(`
          SELECT 
            u.*,
            t.name as team_name
          FROM users u
          LEFT JOIN teams t ON u.team_id = t.id
          WHERE u.id = ?
        `, [this.lastID], (err, row) => {
          if (err) {
            console.error('Error fetching created user:', err.message);
            res.status(500).json({ error: 'User created but failed to fetch' });
            db.close();
            return;
          }
          res.status(201).json(row);
          db.close();
        });
      }
    );
  }
});

// PUT update user's team
router.put('/:id/team', (req, res) => {
  const db = getDatabase();
  const userId = req.params.id;
  const { team_id } = req.body;
  
  // Validate user exists
  db.get('SELECT id FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      console.error('Error checking user:', err.message);
      res.status(500).json({ error: 'Failed to validate user' });
      db.close();
      return;
    }
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      db.close();
      return;
    }
    
    // Validate team_id if provided (null is allowed to remove from team)
    if (team_id) {
      db.get('SELECT id FROM teams WHERE id = ?', [team_id], (err, team) => {
        if (err || !team) {
          res.status(400).json({ error: 'Invalid team_id' });
          db.close();
          return;
        }
        updateTeam();
      });
    } else {
      updateTeam();
    }
    
    function updateTeam() {
      // Update user's team
      db.run(
        'UPDATE users SET team_id = ? WHERE id = ?',
        [team_id || null, userId],
        function(err) {
          if (err) {
            console.error('Error updating user team:', err.message);
            res.status(500).json({ error: 'Failed to update user team' });
            db.close();
            return;
          }
          
          // Return the updated user with team name
          db.get(`
            SELECT 
              u.*,
              t.name as team_name
            FROM users u
            LEFT JOIN teams t ON u.team_id = t.id
            WHERE u.id = ?
          `, [userId], (err, row) => {
            if (err) {
              console.error('Error fetching updated user:', err.message);
              res.status(500).json({ error: 'User updated but failed to fetch' });
              db.close();
              return;
            }
            res.json(row);
            db.close();
          });
        }
      );
    }
  });
});

module.exports = router;
