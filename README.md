# Surf Tracker

A web application to track surfing sessions with your friends. Log sessions, manage teams, view leaderboards, and see each surfer's projected end-of-year score.

## Features

- Team and user management via Admin page
- Log surf sessions with date, location, and notes
- Individual and team leaderboards
- Projected score card (end-of-calendar-year projection based on current pace)
- Session filtering and pagination
- Optional WhatsApp notifications for newly logged sessions (via Fly.io notifier service)
- Modern, responsive design

## Prerequisites

Before you can run this app, you need to install:

1. **Node.js** (version 14 or higher)
   - Download from: https://nodejs.org/
   - This includes npm (Node Package Manager)

2. **A code editor** (you're already using Cursor!)

## Installation

1. **Install backend dependencies**:
   ```bash
   cd backend
   npm install
   ```

   This will install:
   - Express (web server framework)
   - Neon Postgres client (`@neondatabase/serverless`)
   - CORS (allows frontend to communicate with backend)
   - Body-parser (reads JSON from requests)

## Running the Application

### Step 1: Start the Backend Server

Open a terminal in the `backend` folder and run:

```bash
cd backend
node server.js
```

The backend requires a Postgres connection string in your environment (for example `POSTGRES_URL` or `DATABASE_URL`).

You should see:
```
Database tables initialized
Server is running on http://localhost:3000
API health check: http://localhost:3000/api/health
```

**Keep this terminal window open** - the server needs to keep running.

### Step 2: Open the Frontend

You have two options:

**Option A: Simple (Double-click)**
- Navigate to the `frontend` folder
- Double-click `index.html`
- It will open in your default browser

**Option B: Using a Local Server (Recommended)**
- Install a simple HTTP server: `npm install -g http-server`
- In a new terminal, navigate to the `frontend` folder
- Run: `http-server`
- Open the URL it shows (usually `http://localhost:8080`)

### Step 3: Use the App!

1. Open the dashboard (`frontend/index.html`) and go to **Admin Panel**
2. Create teams, add users, and assign users to teams
3. Return to dashboard and log surf sessions
4. Select a user and click **Load Stats** to see their projected year-end score
5. Check individual/team leaderboards and recent sessions

## Project Structure

```
surf-tracker/
├── frontend/
│   ├── index.html          # Dashboard
│   ├── admin.html          # Team/user admin panel
│   ├── styles.css          # Styling
│   ├── app.js              # Frontend logic
│   └── assets/             # Favicon + brand assets
├── backend/
│   ├── server.js           # Express server
│   ├── database.js         # Postgres init/client
│   ├── routes/
│   │   ├── teams.js        # Team APIs + leaderboard
│   │   ├── users.js        # User APIs + assignment
│   │   └── sessions.js     # Session APIs + user stats
│   └── package.json
├── api/
│   └── index.js            # Vercel serverless entrypoint
├── whatsapp-notifier/      # Optional Fly.io WhatsApp service
└── README.md
```

## API Endpoints

Key endpoints:

- `GET /api/health` - API health check
- `GET /api/teams` / `POST /api/teams`
- `GET /api/users` / `POST /api/users`
- `PUT /api/users/:id/team` - Assign/remove team for a user
- `GET /api/sessions` - List sessions (optional `?user_id=<id>`)
- `POST /api/sessions` - Create a session
- `GET /api/sessions/stats/:userId` - User stats used for projection + cards
- `GET /api/teams/leaderboard/all` - Team leaderboard stats

## Troubleshooting

### "npm: command not found"
- You need to install Node.js first (see Prerequisites)

### "Cannot GET /" or connection errors
- Make sure the backend server is running on port 3000
- Check that you're opening the frontend from a web server (not just file://)

### CORS errors in browser console
- Make sure the backend server is running
- Check that the API_BASE_URL in `frontend/app.js` matches your backend URL

### Database errors
- This project uses **Postgres** (Neon / Vercel Postgres).
- For local dev, ensure you have a Postgres connection string set (for example `POSTGRES_URL` or `DATABASE_URL`).

### Favicon / logo not updating after deploy
- Browsers cache icons and brand assets aggressively.
- Hard refresh the page (`Cmd+Shift+R` on macOS) or clear site data for your domain.
- If needed, open the site in a private window to verify latest assets.

### iPhone "Add to Home Screen" uses old icon
- iOS prefers an Apple touch icon, not just standard favicon links.
- Add an explicit touch icon in your `<head>`, for example:
  - `<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">`
- Use a `180x180` PNG, then remove/re-add the Home Screen shortcut.

## Deploying to Vercel (Neon Postgres)

The app is configured for Vercel + Neon Postgres.

- On Vercel, connect Neon to your project so `POSTGRES_URL` / `DATABASE_URL` are injected.
- For local backend, set `POSTGRES_URL` (or `DATABASE_URL`) before running `node backend/server.js`.

**Deploy basics**

1. Install Vercel CLI: `npm i -g vercel`
2. From project root: `vercel`
3. Follow prompts and deploy

## Optional: WhatsApp Notifications

If you want new session messages in a WhatsApp group:

1. Deploy `whatsapp-notifier/` to Fly.io (see `whatsapp-notifier/README.md`)
2. Set `POSTGRES_URL` as a Fly secret on the notifier app
3. Add `FLY_API_TOKEN` to GitHub repo secrets so the scheduled outbox processor can run
4. Redeploy Vercel so the API creates outbox rows when sessions are logged

Notifications are queued in Postgres and sent every ~10 minutes by a short-lived Fly job.

---

## Next Steps

Once you have the basic app working, you can:
- Add user authentication (login/logout)
- Add photo uploads for sessions
- Edit or delete sessions
- Add more detailed statistics (graphs, charts)
- Deploy it online so your friends can access it

## Learning Resources

- **HTML/CSS**: https://developer.mozilla.org/en-US/docs/Web/HTML
- **JavaScript**: https://developer.mozilla.org/en-US/docs/Web/JavaScript
- **Node.js**: https://nodejs.org/en/docs/
- **Express**: https://expressjs.com/
- **Postgres**: https://www.postgresql.org/docs/

## Getting Help

1. Check the browser console (F12) for JavaScript errors
2. Check the server terminal for backend errors
3. Search error messages on Stack Overflow
4. Ask your friend who suggested Cursor!

Happy coding! 🏄
