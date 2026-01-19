const express = require('express');
const router = express.Router();
const { getSql } = require('../database');

// GET all users
router.get('/', async (req, res) => {
  const sql = getSql();
  try {
    const rows = await sql`
      SELECT
        u.*,
        t.name AS team_name
      FROM users u
      LEFT JOIN teams t ON u.team_id = t.id
      ORDER BY u.created_at DESC;
    `;
    res.json(rows);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET a specific user by ID
router.get('/:id', async (req, res) => {
  const sql = getSql();
  const userId = Number(req.params.id);

  if (!userId) return res.status(400).json({ error: 'Invalid user id' });

  try {
    const rows = await sql`
      SELECT
        u.*,
        t.name AS team_name
      FROM users u
      LEFT JOIN teams t ON u.team_id = t.id
      WHERE u.id = ${userId};
    `;
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'User not found' });
    res.json(row);
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST create a new user
router.post('/', async (req, res) => {
  const sql = getSql();
  const { name, email, team_id } = req.body;

  if (!name || String(name).trim() === '') {
    return res.status(400).json({ error: 'Name is required' });
  }

  const trimmedName = String(name).trim();
  const trimmedEmail = email ? String(email).trim() : null;
  const teamId = team_id ? Number(team_id) : null;

  try {
    if (teamId) {
      const teamRows = await sql`SELECT id FROM teams WHERE id = ${teamId};`;
      if (!teamRows[0]) return res.status(400).json({ error: 'Invalid team_id' });
    }

    const rows = await sql`
      SELECT
        u.*,
        t.name AS team_name
      FROM (
        INSERT INTO users (name, email, team_id)
        VALUES (${trimmedName}, ${trimmedEmail}, ${teamId})
        RETURNING *
      ) u
      LEFT JOIN teams t ON u.team_id = t.id;
    `;

    res.status(201).json(rows[0]);
  } catch (err) {
    if (err && err.code === '23505') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT update user's team
router.put('/:id/team', async (req, res) => {
  const sql = getSql();
  const userId = Number(req.params.id);
  const { team_id } = req.body;

  if (!userId) return res.status(400).json({ error: 'Invalid user id' });

  const teamId = team_id ? Number(team_id) : null;

  try {
    const userRows = await sql`SELECT id FROM users WHERE id = ${userId};`;
    if (!userRows[0]) return res.status(404).json({ error: 'User not found' });

    if (teamId) {
      const teamRows = await sql`SELECT id FROM teams WHERE id = ${teamId};`;
      if (!teamRows[0]) return res.status(400).json({ error: 'Invalid team_id' });
    }

    const rows = await sql`
      SELECT
        u.*,
        t.name AS team_name
      FROM (
        UPDATE users
        SET team_id = ${teamId}
        WHERE id = ${userId}
        RETURNING *
      ) u
      LEFT JOIN teams t ON u.team_id = t.id;
    `;

    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating user team:', err);
    res.status(500).json({ error: 'Failed to update user team' });
  }
});

module.exports = router;
