const express = require('express');
const router = express.Router();
const { getSql } = require('../database');

const WHATSAPP_NOTIFIER_URL = process.env.WHATSAPP_NOTIFIER_URL || '';

// GET all sessions (optionally filtered by user_id)
router.get('/', async (req, res) => {
  const sql = getSql();
  const userId = req.query.user_id ? Number(req.query.user_id) : null;

  if (req.query.user_id && !userId) {
    return res.status(400).json({ error: 'Invalid user_id' });
  }

  try {
    const rows = userId
      ? await sql`
          SELECT
            s.*,
            u.name AS user_name,
            u.team_id,
            t.name AS team_name
          FROM surf_sessions s
          JOIN users u ON s.user_id = u.id
          LEFT JOIN teams t ON u.team_id = t.id
          WHERE s.user_id = ${userId}
          ORDER BY s.date DESC, s.created_at DESC;
        `
      : await sql`
          SELECT
            s.*,
            u.name AS user_name,
            u.team_id,
            t.name AS team_name
          FROM surf_sessions s
          JOIN users u ON s.user_id = u.id
          LEFT JOIN teams t ON u.team_id = t.id
          ORDER BY s.date DESC, s.created_at DESC;
        `;

    res.json(rows);
  } catch (err) {
    console.error('Error fetching sessions:', err);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// POST create a new surf session
router.post('/', async (req, res) => {
  const sql = getSql();
  const { user_id, date, location, notes } = req.body;

  if (!user_id) return res.status(400).json({ error: 'user_id is required' });
  if (!date) return res.status(400).json({ error: 'date is required' });

  const userId = Number(user_id);
  if (!userId) return res.status(400).json({ error: 'Invalid user_id' });

  const locationValue = location ? String(location).trim() : null;
  const notesValue = notes ? String(notes).trim() : null;

  try {
    const userRows = await sql`SELECT id FROM users WHERE id = ${userId};`;
    if (!userRows[0]) return res.status(404).json({ error: 'User not found' });

    const rows = await sql`
      WITH inserted AS (
        INSERT INTO surf_sessions (user_id, date, location, notes)
        VALUES (${userId}, ${date}, ${locationValue}, ${notesValue})
        RETURNING *
      )
      SELECT
        inserted.*,
        u.name AS user_name,
        u.team_id,
        t.name AS team_name
      FROM inserted
      JOIN users u ON inserted.user_id = u.id
      LEFT JOIN teams t ON u.team_id = t.id;
    `;

    if (WHATSAPP_NOTIFIER_URL) {
      fetch(`${WHATSAPP_NOTIFIER_URL}/notify-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_name: rows[0].user_name,
          date: rows[0].date,
          location: rows[0].location,
          notes: rows[0].notes,
          team_name: rows[0].team_name,
        }),
      }).catch((err) => console.error('WhatsApp notify failed:', err));
    }

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error creating session:', err);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// GET statistics for a specific user
router.get('/stats/:userId', async (req, res) => {
  const sql = getSql();
  const userId = Number(req.params.userId);

  if (!userId) return res.status(400).json({ error: 'Invalid user id' });

  try {
    const userRows = await sql`
      SELECT
        u.id,
        u.name,
        u.team_id,
        t.name AS team_name
      FROM users u
      LEFT JOIN teams t ON u.team_id = t.id
      WHERE u.id = ${userId};
    `;
    const user = userRows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const statsRows = await sql`
      SELECT
        COALESCE(COUNT(*), 0)::int AS total_sessions,
        COALESCE(
          COUNT(*) FILTER (
            WHERE date >= date_trunc('month', current_date)::date
              AND date < (date_trunc('month', current_date) + interval '1 month')::date
          ),
          0
        )::int AS sessions_this_month,
        COALESCE(
          COUNT(*) FILTER (
            WHERE date >= date_trunc('year', current_date)::date
              AND date < (date_trunc('year', current_date) + interval '1 year')::date
          ),
          0
        )::int AS sessions_this_year
      FROM surf_sessions
      WHERE user_id = ${userId};
    `;

    const stats = statsRows[0] || {
      total_sessions: 0,
      sessions_this_month: 0,
      sessions_this_year: 0,
    };

    res.json({
      user_id: user.id,
      user_name: user.name,
      total_sessions: stats.total_sessions,
      sessions_this_month: stats.sessions_this_month,
      sessions_this_year: stats.sessions_this_year,
      team_id: user.team_id,
      team_name: user.team_name,
    });
  } catch (err) {
    console.error('Error calculating user stats:', err);
    res.status(500).json({ error: 'Failed to calculate statistics' });
  }
});

module.exports = router;
