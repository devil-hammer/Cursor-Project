const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database');

// GET all sessions (optionally filtered by user_id)
router.get('/', (req, res) => {
  const db = getDatabase();
  const userId = req.query.user_id;
  
  let query = `
    SELECT 
      s.*,
      u.name as user_name,
      u.team_id,
      t.name as team_name
    FROM surf_sessions s
    JOIN users u ON s.user_id = u.id
    LEFT JOIN teams t ON u.team_id = t.id
  `;
  const params = [];
  
  if (userId) {
    query += ' WHERE s.user_id = ?';
    params.push(userId);
  }
  
  query += ' ORDER BY s.date DESC, s.created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error fetching sessions:', err.message);
      res.status(500).json({ error: 'Failed to fetch sessions' });
      return;
    }
    res.json(rows);
  });
});

// POST create a new surf session
router.post('/', (req, res) => {
  const db = getDatabase();
  const { user_id, date, location, notes } = req.body;
  
  // Validate input
  if (!user_id) {
    res.status(400).json({ error: 'user_id is required' });
    return;
  }
  
  if (!date) {
    res.status(400).json({ error: 'date is required' });
    return;
  }
  
  // Verify user exists
  db.get('SELECT id FROM users WHERE id = ?', [user_id], (err, user) => {
    if (err) {
      console.error('Error checking user:', err.message);
      res.status(500).json({ error: 'Failed to validate user' });
      return;
    }
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    // Insert session
    db.run(
      'INSERT INTO surf_sessions (user_id, date, location, notes) VALUES (?, ?, ?, ?)',
      [user_id, date, location ? location.trim() : null, notes ? notes.trim() : null],
      function(err) {
        if (err) {
          console.error('Error creating session:', err.message);
          res.status(500).json({ error: 'Failed to create session' });
          return;
        }
        
        // Return the created session with user name and team info
        db.get(`
          SELECT 
            s.*,
            u.name as user_name,
            u.team_id,
            t.name as team_name
          FROM surf_sessions s
          JOIN users u ON s.user_id = u.id
          LEFT JOIN teams t ON u.team_id = t.id
          WHERE s.id = ?
        `, [this.lastID], (err, row) => {
          if (err) {
            console.error('Error fetching created session:', err.message);
            res.status(500).json({ error: 'Session created but failed to fetch' });
            return;
          }
          res.status(201).json(row);
        });
      }
    );
  });
});

// GET statistics for a specific user
router.get('/stats/:userId', (req, res) => {
  const db = getDatabase();
  const userId = req.params.userId;
  
  // Verify user exists
  db.get('SELECT id, name FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      console.error('Error checking user:', err.message);
      res.status(500).json({ error: 'Failed to validate user' });
      return;
    }
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    // Get total sessions
    db.get(
      'SELECT COUNT(*) as total FROM surf_sessions WHERE user_id = ?',
      [userId],
      (err, totalRow) => {
        if (err) {
          console.error('Error getting total sessions:', err.message);
          res.status(500).json({ error: 'Failed to calculate statistics' });
          return;
        }
        
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        
        // Get sessions this month
        db.get(
          `SELECT COUNT(*) as count 
           FROM surf_sessions 
           WHERE user_id = ? 
           AND strftime('%Y', date) = ? 
           AND strftime('%m', date) = ?`,
          [userId, String(currentYear), String(currentMonth).padStart(2, '0')],
          (err, monthRow) => {
            if (err) {
              console.error('Error getting monthly sessions:', err.message);
              res.status(500).json({ error: 'Failed to calculate statistics' });
              return;
            }
            
            // Get sessions this year
            db.get(
              `SELECT COUNT(*) as count 
               FROM surf_sessions 
               WHERE user_id = ? 
               AND strftime('%Y', date) = ?`,
              [userId, String(currentYear)],
              (err, yearRow) => {
                if (err) {
                  console.error('Error getting yearly sessions:', err.message);
                  res.status(500).json({ error: 'Failed to calculate statistics' });
                  return;
                }
                
                // Get user's team info
                db.get(`
                  SELECT 
                    u.team_id,
                    t.name as team_name
                  FROM users u
                  LEFT JOIN teams t ON u.team_id = t.id
                  WHERE u.id = ?
                `, [userId], (err, teamRow) => {
                  if (err) {
                    console.error('Error getting team info:', err.message);
                    res.status(500).json({ error: 'Failed to calculate statistics' });
                    return;
                  }
                  
                  res.json({
                    user_id: parseInt(userId),
                    user_name: user.name,
                    total_sessions: totalRow.total,
                    sessions_this_month: monthRow.count,
                    sessions_this_year: yearRow.count,
                    team_id: teamRow ? teamRow.team_id : null,
                    team_name: teamRow ? teamRow.team_name : null
                  });
                });
              }
            );
          }
        );
      }
    );
  });
});

module.exports = router;
