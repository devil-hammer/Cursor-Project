const express = require('express');
const router = express.Router();
const { getSql } = require('../database');

// GET all teams
router.get('/', async (req, res) => {
  const sql = getSql();
  try {
    const rows = await sql`SELECT * FROM teams ORDER BY name ASC;`;
    res.json(rows);
  } catch (err) {
    console.error('Error fetching teams:', err);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// GET a specific team by ID
router.get('/:id', async (req, res) => {
  const sql = getSql();
  const teamId = Number(req.params.id);

  if (!teamId) return res.status(400).json({ error: 'Invalid team id' });

  try {
    const rows = await sql`SELECT * FROM teams WHERE id = ${teamId};`;
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'Team not found' });
    res.json(row);
  } catch (err) {
    console.error('Error fetching team:', err);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

// POST create a new team
router.post('/', async (req, res) => {
  const sql = getSql();
  const { name } = req.body;

  if (!name || String(name).trim() === '') {
    return res.status(400).json({ error: 'Team name is required' });
  }

  const trimmedName = String(name).trim();

  try {
    const rows = await sql`
      INSERT INTO teams (name)
      VALUES (${trimmedName})
      RETURNING *;
    `;
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err && err.code === '23505') {
      return res.status(400).json({ error: 'Team name already exists' });
    }
    console.error('Error creating team:', err);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// GET statistics for a specific team
router.get('/stats/:teamId', async (req, res) => {
  const sql = getSql();
  const teamId = Number(req.params.teamId);

  if (!teamId) return res.status(400).json({ error: 'Invalid team id' });

  try {
    const teamRows = await sql`SELECT id, name FROM teams WHERE id = ${teamId};`;
    const team = teamRows[0];
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const totals = await sql`
      SELECT
        COALESCE(COUNT(s.id), 0)::int AS total_sessions,
        COALESCE(
          COUNT(s.id) FILTER (
            WHERE s.date >= date_trunc('month', current_date)::date
              AND s.date < (date_trunc('month', current_date) + interval '1 month')::date
          ),
          0
        )::int AS sessions_this_month,
        COALESCE(
          COUNT(s.id) FILTER (
            WHERE s.date >= date_trunc('year', current_date)::date
              AND s.date < (date_trunc('year', current_date) + interval '1 year')::date
          ),
          0
        )::int AS sessions_this_year
      FROM users u
      LEFT JOIN surf_sessions s ON s.user_id = u.id
      WHERE u.team_id = ${teamId};
    `;

    const members = await sql`
      SELECT COALESCE(COUNT(*), 0)::int AS member_count
      FROM users
      WHERE team_id = ${teamId};
    `;

    res.json({
      team_id: team.id,
      team_name: team.name,
      total_sessions: totals[0]?.total_sessions ?? 0,
      sessions_this_month: totals[0]?.sessions_this_month ?? 0,
      sessions_this_year: totals[0]?.sessions_this_year ?? 0,
      member_count: members[0]?.member_count ?? 0,
    });
  } catch (err) {
    console.error('Error calculating team stats:', err);
    res.status(500).json({ error: 'Failed to calculate statistics' });
  }
});

// GET all teams with their statistics
router.get('/leaderboard/all', async (req, res) => {
  const sql = getSql();
  try {
    const rows = await sql`
      SELECT
        t.*,
        COALESCE(COUNT(s.id), 0)::int AS total_sessions
      FROM teams t
      LEFT JOIN users u ON u.team_id = t.id
      LEFT JOIN surf_sessions s ON s.user_id = u.id
      GROUP BY t.id
      ORDER BY total_sessions DESC, t.name ASC;
    `;
    res.json(rows);
  } catch (err) {
    console.error('Error fetching team leaderboard:', err);
    res.status(500).json({ error: 'Failed to fetch team leaderboard' });
  }
});

module.exports = router;
