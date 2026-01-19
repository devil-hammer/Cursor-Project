# Surf Tracker

A web application to track surfing sessions with your friends. Log your surf sessions, view statistics, and compete on the leaderboard!

## Features

- Add users (you and your friends)
- Log surf sessions with date, location, and notes
- View statistics (total sessions, monthly, yearly)
- Leaderboard showing everyone's session counts
- Filter sessions by user
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

1. **Add yourself as a user**: Fill in your name (and optionally email)
2. **Add your friends**: Add them as users too
3. **Log surf sessions**: Select a user, date, location, and add notes
4. **View statistics**: Select a user and click "Load Stats"
5. **Check the leaderboard**: See who's logged the most sessions!

## Project Structure

```
surf-tracker/
├── frontend/
│   ├── index.html       # Main webpage
│   ├── styles.css       # Styling
│   └── app.js           # Frontend logic
├── backend/
│   ├── server.js        # Express server
│   ├── database.js      # Database setup
│   ├── routes/
│   │   ├── users.js     # User API endpoints
│   │   └── sessions.js  # Session API endpoints
│   └── package.json     # Dependencies
└── README.md            # This file
```

## API Endpoints

The backend provides these API endpoints:

- `GET /api/users` - Get all users
- `POST /api/users` - Create a new user
- `GET /api/users/:id` - Get a specific user
- `GET /api/sessions` - Get all sessions (optionally filtered by `?user_id=X`)
- `POST /api/sessions` - Create a new session
- `GET /api/sessions/stats/:userId` - Get statistics for a user

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

## Deploying to Vercel (Neon Postgres)

The app is set up to run on Vercel using **Neon Postgres** (via the Vercel integration).

- **On Vercel**: connect a Neon Postgres database to your project. Vercel will inject environment variables like `POSTGRES_URL` / `DATABASE_URL`.
- **Locally**: set `POSTGRES_URL` (or `DATABASE_URL`) in your environment before running the backend.

**Deploy:**

1. Install the Vercel CLI: `npm i -g vercel`
2. From the project root: `vercel`
3. Follow the prompts (link to an existing project or create one).

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
