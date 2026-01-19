const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database');

// GET all teams
router.get('/', (req, res) => {
  const db = getDatabase();
  
  db.all('SELECT * FROM teams ORDER BY name ASC', [], (err, rows) => {
    if (err) {
      console.error('Error fetching teams:', err.message);
      res.status(500).json({ error: 'Failed to fetch teams' });
      db.close();
      return;
    }
    res.json(rows);
    db.close();
  });
});

// GET a specific team by ID
router.get('/:id', (req, res) => {
  const db = getDatabase();
  const teamId = req.params.id;
  
  db.get('SELECT * FROM teams WHERE id = ?', [teamId], (err, row) => {
    if (err) {
      console.error('Error fetching team:', err.message);
      res.status(500).json({ error: 'Failed to fetch team' });
      db.close();
      return;
    }
    
    if (!row) {
      res.status(404).json({ error: 'Team not found' });
      db.close();
      return;
    }
    
    res.json(row);
    db.close();
  });
});

// POST create a new team
router.post('/', (req, res) => {
  const db = getDatabase();
  const { name } = req.body;
  
  // Validate input
  if (!name || name.trim() === '') {
    res.status(400).json({ error: 'Team name is required' });
    db.close();
    return;
  }
  
  // Insert team
  db.run(
    'INSERT INTO teams (name) VALUES (?)',
    [name.trim()],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          res.status(400).json({ error: 'Team name already exists' });
          db.close();
          return;
        }
        console.error('Error creating team:', err.message);
        res.status(500).json({ error: 'Failed to create team' });
        db.close();
        return;
      }
      
      // Return the created team
      db.get('SELECT * FROM teams WHERE id = ?', [this.lastID], (err, row) => {
        if (err) {
          console.error('Error fetching created team:', err.message);
          res.status(500).json({ error: 'Team created but failed to fetch' });
          db.close();
          return;
        }
        res.status(201).json(row);
        db.close();
      });
    }
  );
});

// GET statistics for a specific team
router.get('/stats/:teamId', (req, res) => {
  const db = getDatabase();
  const teamId = req.params.teamId;
  
  // Verify team exists
  db.get('SELECT id, name FROM teams WHERE id = ?', [teamId], (err, team) => {
    if (err) {
      console.error('Error checking team:', err.message);
      res.status(500).json({ error: 'Failed to validate team' });
      db.close();
      return;
    }
    
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      db.close();
      return;
    }
    
    // Get total sessions for all users in this team
    db.get(
      `SELECT COUNT(*) as total 
       FROM surf_sessions s
       JOIN users u ON s.user_id = u.id
       WHERE u.team_id = ?`,
      [teamId],
      (err, totalRow) => {
        if (err) {
          console.error('Error getting total sessions:', err.message);
          res.status(500).json({ error: 'Failed to calculate statistics' });
          db.close();
          return;
        }
        
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        
        // Get sessions this month for team
        db.get(
          `SELECT COUNT(*) as count 
           FROM surf_sessions s
           JOIN users u ON s.user_id = u.id
           WHERE u.team_id = ? 
           AND strftime('%Y', s.date) = ? 
           AND strftime('%m', s.date) = ?`,
          [teamId, String(currentYear), String(currentMonth).padStart(2, '0')],
          (err, monthRow) => {
            if (err) {
              console.error('Error getting monthly sessions:', err.message);
              res.status(500).json({ error: 'Failed to calculate statistics' });
              db.close();
              return;
            }
            
            // Get sessions this year for team
            db.get(
              `SELECT COUNT(*) as count 
               FROM surf_sessions s
               JOIN users u ON s.user_id = u.id
               WHERE u.team_id = ? 
               AND strftime('%Y', s.date) = ?`,
              [teamId, String(currentYear)],
              (err, yearRow) => {
                if (err) {
                  console.error('Error getting yearly sessions:', err.message);
                  res.status(500).json({ error: 'Failed to calculate statistics' });
                  db.close();
                  return;
                }
                
                // Get team members count
                db.get(
                  'SELECT COUNT(*) as count FROM users WHERE team_id = ?',
                  [teamId],
                  (err, membersRow) => {
                    if (err) {
                      console.error('Error getting team members:', err.message);
                      res.status(500).json({ error: 'Failed to calculate statistics' });
                      db.close();
                      return;
                    }
                    
                    res.json({
                      team_id: parseInt(teamId),
                      team_name: team.name,
                      total_sessions: totalRow.total,
                      sessions_this_month: monthRow.count,
                      sessions_this_year: yearRow.count,
                      member_count: membersRow.count
                    });
                    db.close();
                  }
                );
              }
            );
          }
        );
      }
    );
  });
});

// GET all teams with their statistics
router.get('/leaderboard/all', (req, res) => {
  const db = getDatabase();
  
  // Get all teams
  db.all('SELECT * FROM teams ORDER BY name ASC', [], (err, teams) => {
    if (err) {
      console.error('Error fetching teams:', err.message);
      res.status(500).json({ error: 'Failed to fetch teams' });
      db.close();
      return;
    }
    
    // Get stats for each team
    const teamPromises = teams.map(team => {
      return new Promise((resolve) => {
        db.get(
          `SELECT COUNT(*) as total 
           FROM surf_sessions s
           JOIN users u ON s.user_id = u.id
           WHERE u.team_id = ?`,
          [team.id],
          (err, row) => {
            if (err) {
              resolve({ ...team, total_sessions: 0 });
            } else {
              resolve({ ...team, total_sessions: row.total });
            }
          }
        );
      });
    });
    
    Promise.all(teamPromises).then(teamsWithStats => {
      // Sort by total sessions descending
      teamsWithStats.sort((a, b) => b.total_sessions - a.total_sessions);
      res.json(teamsWithStats);
      db.close();
    });
  });
});

module.exports = router;
