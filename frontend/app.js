// API Base URL:
// - local dev: hit local Express server
// - hosted on same origin (e.g. Vercel/custom domain): use same-origin /api
// - GitHub Pages: point to your Vercel deployment (replace the placeholder)
const API_BASE_URL = (() => {
  if (typeof window === 'undefined') return '/api';

  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  if (isLocal) return 'http://localhost:3000/api';

  const isGitHubPages = host.endsWith('github.io');
  if (isGitHubPages) return 'https://YOUR_VERCEL_PROJECT.vercel.app/api'; // replace YOUR_VERCEL_PROJECT

  // Vercel or any other hosting where frontend+API share an origin
  return `${window.location.origin}/api`;
})();

// State
let users = [];
let teams = [];
let sessions = [];
let selectedStatsUserId = null;
let currentSessionsPage = 1;
const SESSIONS_PER_PAGE = 5;

// DOM Elements - check if elements exist before assigning (for multi-page support)
const userForm = document.getElementById('userForm');
const teamForm = document.getElementById('teamForm');
const assignTeamForm = document.getElementById('assignTeamForm');
const sessionForm = document.getElementById('sessionForm');
const userMessage = document.getElementById('userMessage');
const teamMessage = document.getElementById('teamMessage');
const assignTeamMessage = document.getElementById('assignTeamMessage');
const sessionMessage = document.getElementById('sessionMessage');
const sessionUserSelect = document.getElementById('sessionUser');
const statsUserSelect = document.getElementById('statsUserSelect');
const filterUserSelect = document.getElementById('filterUser');
const userTeamSelect = document.getElementById('userTeam');
const assignUserSelect = document.getElementById('assignUser');
const assignTeamSelect = document.getElementById('assignTeam');
const statsContainer = document.getElementById('statsContainer');
const sessionsContainer = document.getElementById('sessionsContainer');
const sessionsPaginationContainer = document.getElementById('sessionsPaginationContainer');
const leaderboardContainer = document.getElementById('leaderboardContainer');
const teamLeaderboardContainer = document.getElementById('teamLeaderboardContainer');
const loadStatsBtn = document.getElementById('loadStatsBtn');
const refreshSessionsBtn = document.getElementById('refreshSessionsBtn');

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    // Load initial data (always needed for dropdowns)
    loadTeams();
    loadUsers();

    // Admin page specific initialization
    if (userForm) {
        userForm.addEventListener('submit', handleUserSubmit);
    }
    if (teamForm) {
        teamForm.addEventListener('submit', handleTeamSubmit);
    }
    if (assignTeamForm) {
        assignTeamForm.addEventListener('submit', handleAssignTeamSubmit);
        if (assignUserSelect) {
            assignUserSelect.addEventListener('change', updateAssignTeamSelect);
        }
    }

    // Main dashboard page specific initialization
    const sessionDateInput = document.getElementById('sessionDate');
    if (sessionDateInput) {
        // Set today's date as default for session form
        const today = new Date().toISOString().split('T')[0];
        sessionDateInput.value = today;
    }

    if (sessionForm) {
        sessionForm.addEventListener('submit', handleSessionSubmit);
    }
    if (loadStatsBtn) {
        loadStatsBtn.addEventListener('click', loadStats);
    }
    if (refreshSessionsBtn) {
        refreshSessionsBtn.addEventListener('click', () => loadSessions());
    }
    if (filterUserSelect) {
        filterUserSelect.addEventListener('change', () => loadSessions());
    }

    // Load dashboard-specific data
    if (leaderboardContainer || teamLeaderboardContainer || sessionsContainer) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3c4fecb4-2ae1-4496-aed3-7e149927a15a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:66',message:'Initialization start',data:{usersLength:users.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion

        loadUsers().then(() => {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/3c4fecb4-2ae1-4496-aed3-7e149927a15a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:70',message:'loadUsers completed',data:{usersLength:users.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            if (leaderboardContainer) {
                loadLeaderboard();
            }
            if (teamLeaderboardContainer) {
                loadTeamLeaderboard();
            }
        });
        if (sessionsContainer) {
            loadSessions();
        }
    }
});

// API Helper Functions
async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API call error:', error);
        throw error;
    }
}

// Load Users
async function loadUsers() {
    try {
        users = await apiCall('/users');
        populateUserSelects();
        updateAssignTeamSelect(); // Update assign team select after loading users
    } catch (error) {
        showError(userMessage, 'Failed to load users: ' + error.message);
    }
}

// Load Teams
async function loadTeams() {
    try {
        teams = await apiCall('/teams');
        populateTeamSelects();
    } catch (error) {
        console.error('Failed to load teams:', error);
    }
}

// Populate team dropdowns
function populateTeamSelects() {
    // Clear and populate user team select (if exists)
    if (userTeamSelect) {
        userTeamSelect.innerHTML = '<option value="">No team</option>';
        teams.forEach(team => {
            const option = document.createElement('option');
            option.value = team.id;
            option.textContent = team.name;
            userTeamSelect.appendChild(option);
        });
    }

    // Clear and populate assign team select (if exists)
    if (assignTeamSelect) {
        assignTeamSelect.innerHTML = '<option value="">No team</option>';
        teams.forEach(team => {
            const option = document.createElement('option');
            option.value = team.id;
            option.textContent = team.name;
            assignTeamSelect.appendChild(option);
        });
        
        // Update assign team select if a user is already selected
        updateAssignTeamSelect();
    }
}

// Update assign team select based on selected user
function updateAssignTeamSelect() {
    if (!assignUserSelect || !assignTeamSelect) return;
    
    const userId = parseInt(assignUserSelect.value);
    if (userId) {
        const user = users.find(u => u.id === userId);
        if (user && user.team_id) {
            assignTeamSelect.value = user.team_id;
        } else {
            assignTeamSelect.value = '';
        }
    }
}

// Populate user dropdowns
function populateUserSelects() {
    // Clear and populate session user select (if exists)
    if (sessionUserSelect) {
        sessionUserSelect.innerHTML = '<option value="">Select a user...</option>';
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.name + (user.team_name ? ` (${user.team_name})` : '');
            sessionUserSelect.appendChild(option);
        });
    }

    // Clear and populate stats user select (if exists)
    if (statsUserSelect) {
        statsUserSelect.innerHTML = '<option value="">Select user for stats...</option>';
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.name + (user.team_name ? ` (${user.team_name})` : '');
            statsUserSelect.appendChild(option);
        });
    }

    // Clear and populate filter user select (if exists)
    if (filterUserSelect) {
        filterUserSelect.innerHTML = '<option value="">All users</option>';
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.name + (user.team_name ? ` (${user.team_name})` : '');
            filterUserSelect.appendChild(option);
        });
    }

    // Clear and populate assign user select (if exists)
    if (assignUserSelect) {
        assignUserSelect.innerHTML = '<option value="">Select a user...</option>';
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.name + (user.team_name ? ` (${user.team_name})` : '');
            assignUserSelect.appendChild(option);
        });
        updateAssignTeamSelect(); // Update team select after populating users
    }
}

// Handle Team Form Submission
async function handleTeamSubmit(e) {
    e.preventDefault();
    const formData = new FormData(teamForm);
    const teamData = {
        name: formData.get('name')
    };

    try {
        const newTeam = await apiCall('/teams', {
            method: 'POST',
            body: JSON.stringify(teamData)
        });

        showSuccess(teamMessage, `Team "${newTeam.name}" created successfully!`);
        teamForm.reset();
        await loadTeams();
    } catch (error) {
        showError(teamMessage, 'Failed to create team: ' + error.message);
    }
}

// Handle Assign Team Form Submission
async function handleAssignTeamSubmit(e) {
    e.preventDefault();
    const formData = new FormData(assignTeamForm);
    const userId = parseInt(formData.get('user_id'));
    const teamId = formData.get('team_id') ? parseInt(formData.get('team_id')) : null;

    if (!userId) {
        showError(assignTeamMessage, 'Please select a user');
        return;
    }

    try {
        const updatedUser = await apiCall(`/users/${userId}/team`, {
            method: 'PUT',
            body: JSON.stringify({ team_id: teamId })
        });

        const message = teamId 
            ? `User "${updatedUser.name}" assigned to team "${updatedUser.team_name}"!`
            : `User "${updatedUser.name}" removed from team!`;
        showSuccess(assignTeamMessage, message);
        assignTeamForm.reset();
        await loadUsers();
        // Only refresh dashboard widgets if they're present on this page
        if (teamLeaderboardContainer) {
            await loadTeamLeaderboard();
        }
    } catch (error) {
        showError(assignTeamMessage, 'Failed to assign team: ' + error.message);
    }
}

// Handle User Form Submission
async function handleUserSubmit(e) {
    e.preventDefault();
    const formData = new FormData(userForm);
    const userData = {
        name: formData.get('name'),
        email: formData.get('email'),
        team_id: formData.get('team_id') ? parseInt(formData.get('team_id')) : null
    };

    try {
        const newUser = await apiCall('/users', {
            method: 'POST',
            body: JSON.stringify(userData)
        });

        showSuccess(userMessage, `User "${newUser.name}" added successfully!`);
        userForm.reset();
        await loadUsers();
        // Only refresh dashboard widgets if they're present on this page
        if (teamLeaderboardContainer) {
            await loadTeamLeaderboard();
        }
        
        // Auto-select the new user in session form
        if (sessionUserSelect) {
            sessionUserSelect.value = newUser.id;
        }
    } catch (error) {
        showError(userMessage, 'Failed to add user: ' + error.message);
    }
}

// Handle Session Form Submission
async function handleSessionSubmit(e) {
    e.preventDefault();
    const formData = new FormData(sessionForm);
    const sessionData = {
        user_id: parseInt(formData.get('user_id')),
        date: formData.get('date'),
        location: formData.get('location'),
        notes: formData.get('notes')
    };

    // Validation
    if (!sessionData.user_id) {
        showError(sessionMessage, 'Please select a user');
        return;
    }

    if (!sessionData.date) {
        showError(sessionMessage, 'Please select a date');
        return;
    }

    try {
        const newSession = await apiCall('/sessions', {
            method: 'POST',
            body: JSON.stringify(sessionData)
        });

        const userName = newSession.user_name || 'User';
        const teamInfo = newSession.team_name ? ` (Team: ${newSession.team_name})` : '';
        showSuccess(sessionMessage, `Surf session logged for ${userName}!${teamInfo}`);
        sessionForm.reset();
        document.getElementById('sessionDate').value = new Date().toISOString().split('T')[0];
        
        // Reload data
        await loadSessions();
        await loadLeaderboard();
        await loadTeamLeaderboard();
        
        // Reload stats if this user is selected
        if (selectedStatsUserId === sessionData.user_id) {
            await loadStats();
        }
    } catch (error) {
        showError(sessionMessage, 'Failed to add session: ' + error.message);
    }
}

// Load Sessions
async function loadSessions() {
    try {
        const userId = filterUserSelect.value;
        const endpoint = userId ? `/sessions?user_id=${userId}` : '/sessions';
        sessions = await apiCall(endpoint);
        currentSessionsPage = 1; // Reset to first page when loading new sessions
        displaySessions();
    } catch (error) {
        sessionsContainer.innerHTML = `<p class="placeholder error">Failed to load sessions: ${error.message}</p>`;
    }
}

// Display Sessions
function displaySessions() {
    if (sessions.length === 0) {
        sessionsContainer.innerHTML = '<p class="placeholder">No sessions found. Log your first surf session!</p>';
        sessionsPaginationContainer.innerHTML = '';
        return;
    }

    // Calculate pagination
    const totalPages = Math.ceil(sessions.length / SESSIONS_PER_PAGE);
    const startIndex = (currentSessionsPage - 1) * SESSIONS_PER_PAGE;
    const endIndex = startIndex + SESSIONS_PER_PAGE;
    const paginatedSessions = sessions.slice(startIndex, endIndex);

    // Display paginated sessions
    sessionsContainer.innerHTML = paginatedSessions.map(session => {
        const formattedDate = formatDate(session.date);
        const teamInfo = session.team_name ? `<span class="session-team">🏆 ${escapeHtml(session.team_name)}</span>` : '';
        return `
            <div class="session-card">
                <div class="session-header">
                    <div>
                        <div class="session-user">${escapeHtml(session.user_name)}</div>
                        ${teamInfo}
                    </div>
                    <div class="session-date">${formattedDate}</div>
                </div>
                ${session.location ? `<div class="session-location">📍 ${escapeHtml(session.location)}</div>` : ''}
                ${session.notes ? `<div class="session-notes">${escapeHtml(session.notes)}</div>` : ''}
            </div>
        `;
    }).join('');

    // Display pagination controls
    displaySessionsPagination(totalPages);
}

// Display Sessions Pagination
function displaySessionsPagination(totalPages) {
    if (totalPages <= 1) {
        sessionsPaginationContainer.innerHTML = '';
        return;
    }

    const prevDisabled = currentSessionsPage === 1;
    const nextDisabled = currentSessionsPage === totalPages;

    sessionsPaginationContainer.innerHTML = `
        <div class="pagination">
            <button class="pagination-btn prev-btn" ${prevDisabled ? 'disabled' : ''} data-page="${currentSessionsPage - 1}">
                Previous
            </button>
            <span class="pagination-info">
                Page ${currentSessionsPage} of ${totalPages}
            </span>
            <button class="pagination-btn next-btn" ${nextDisabled ? 'disabled' : ''} data-page="${currentSessionsPage + 1}">
                Next
            </button>
        </div>
    `;

    // Add event listeners to pagination buttons
    const prevBtn = sessionsPaginationContainer.querySelector('.prev-btn');
    const nextBtn = sessionsPaginationContainer.querySelector('.next-btn');
    
    if (prevBtn && !prevDisabled) {
        prevBtn.addEventListener('click', () => goToSessionsPage(currentSessionsPage - 1));
    }
    
    if (nextBtn && !nextDisabled) {
        nextBtn.addEventListener('click', () => goToSessionsPage(currentSessionsPage + 1));
    }
}

// Go to specific sessions page
function goToSessionsPage(page) {
    const totalPages = Math.ceil(sessions.length / SESSIONS_PER_PAGE);
    if (page >= 1 && page <= totalPages) {
        currentSessionsPage = page;
        displaySessions();
        // Scroll to top of sessions section
        document.querySelector('.sessions-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Load Statistics
async function loadStats() {
    const userId = statsUserSelect.value;
    
    if (!userId) {
        statsContainer.innerHTML = '<p class="placeholder">Please select a user to view statistics</p>';
        return;
    }

    selectedStatsUserId = parseInt(userId);

    try {
        const stats = await apiCall(`/sessions/stats/${userId}`);
        displayStats(stats);
    } catch (error) {
        statsContainer.innerHTML = `<p class="placeholder error">Failed to load statistics: ${error.message}</p>`;
    }
}

// Display Statistics
function displayStats(stats) {
    const sessionsThisYear = Number(stats.sessions_this_year) || 0;
    const { year, dayOfYear, daysInYear, daysRemaining } = getCalendarYearProgress();
    const projectedYearEndTotal = calculateYearEndProjection(sessionsThisYear, dayOfYear, daysInYear);

    statsContainer.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${projectedYearEndTotal}</div>
            <div class="stat-label">Projected ${year} Total</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${sessionsThisYear}</div>
            <div class="stat-label">Sessions This Year</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${daysRemaining}</div>
            <div class="stat-label">Days Remaining</div>
        </div>
    `;
}

function getCalendarYearProgress() {
    const now = new Date();
    const year = now.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const startOfNextYear = new Date(year + 1, 0, 1);
    const msPerDay = 24 * 60 * 60 * 1000;
    const dayOfYear = Math.floor((now - startOfYear) / msPerDay) + 1;
    const daysInYear = Math.floor((startOfNextYear - startOfYear) / msPerDay);

    return {
        year,
        dayOfYear,
        daysInYear,
        daysRemaining: Math.max(daysInYear - dayOfYear, 0)
    };
}

function calculateYearEndProjection(sessionsThisYear, dayOfYear, daysInYear) {
    if (!sessionsThisYear || dayOfYear <= 0 || daysInYear <= 0) {
        return 0;
    }

    const sessionsPerDay = sessionsThisYear / dayOfYear;
    return Math.round(sessionsPerDay * daysInYear);
}

// Load Leaderboard
async function loadLeaderboard() {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3c4fecb4-2ae1-4496-aed3-7e149927a15a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:440',message:'loadLeaderboard called',data:{usersLength:users.length,users:users.map(u=>({id:u.id,name:u.name}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    try {
        // Load stats for all users
        const leaderboardPromises = users.map(async (user) => {
            try {
                const stats = await apiCall(`/sessions/stats/${user.id}`);
                return {
                    id: user.id,
                    name: user.name,
                    total: stats.total_sessions
                };
            } catch (error) {
                return {
                    id: user.id,
                    name: user.name,
                    total: 0
                };
            }
        });

        const leaderboard = await Promise.all(leaderboardPromises);
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3c4fecb4-2ae1-4496-aed3-7e149927a15a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:465',message:'Leaderboard data ready',data:{leaderboardLength:leaderboard.length,leaderboard},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        // Sort by total sessions (descending)
        leaderboard.sort((a, b) => b.total - a.total);
        
        displayLeaderboard(leaderboard);
    } catch (error) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3c4fecb4-2ae1-4496-aed3-7e149927a15a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:468',message:'loadLeaderboard error',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        leaderboardContainer.innerHTML = `<p class="placeholder error">Failed to load leaderboard: ${error.message}</p>`;
    }
}

// Display Leaderboard
function displayLeaderboard(leaderboard) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3c4fecb4-2ae1-4496-aed3-7e149927a15a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:472',message:'displayLeaderboard called',data:{leaderboardLength:leaderboard.length,leaderboard},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    if (leaderboard.length === 0) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3c4fecb4-2ae1-4496-aed3-7e149927a15a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:475',message:'Leaderboard empty',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        leaderboardContainer.innerHTML = '<p class="placeholder">No users yet. Add a user to get started!</p>';
        return;
    }

    leaderboardContainer.innerHTML = leaderboard.map((item, index) => {
        const rank = index + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
        return `
            <div class="leaderboard-item">
                <span class="rank">${rank}${medal ? ' ' + medal : ''}</span>
                <span class="name">${escapeHtml(item.name)}</span>
                <span class="count">${item.total} session${item.total !== 1 ? 's' : ''}</span>
            </div>
        `;
    }).join('');
}

// Load Team Leaderboard
async function loadTeamLeaderboard() {
    // This widget only exists on the main dashboard page
    if (!teamLeaderboardContainer) return;

    try {
        const teamsWithStats = await apiCall('/teams/leaderboard/all');
        
        displayTeamLeaderboard(teamsWithStats);
    } catch (error) {
        teamLeaderboardContainer.innerHTML = `<p class="placeholder error">Failed to load team leaderboard: ${error.message}</p>`;
    }
}

// Display Team Leaderboard
function displayTeamLeaderboard(teams) {
    // This widget only exists on the main dashboard page
    if (!teamLeaderboardContainer) return;

    if (teams.length === 0) {
        teamLeaderboardContainer.innerHTML = '<p class="placeholder">No teams yet. Create a team to get started!</p>';
        return;
    }

    teamLeaderboardContainer.innerHTML = teams.map((team, index) => {
        const rank = index + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
        return `
            <div class="leaderboard-item">
                <span class="rank">${rank}${medal ? ' ' + medal : ''}</span>
                <span class="name">${escapeHtml(team.name)}</span>
                <span class="count">${team.total_sessions} session${team.total_sessions !== 1 ? 's' : ''}</span>
            </div>
        `;
    }).join('');
}

// Utility Functions
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        weekday: 'short'
    };
    return date.toLocaleDateString('en-US', options);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showSuccess(element, message) {
    element.textContent = message;
    element.className = 'message success';
    setTimeout(() => {
        element.className = 'message';
        element.textContent = '';
    }, 5000);
}

function showError(element, message) {
    element.textContent = message;
    element.className = 'message error';
    setTimeout(() => {
        element.className = 'message';
        element.textContent = '';
    }, 7000);
}
