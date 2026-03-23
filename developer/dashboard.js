// YOUR LIVE PUBLIC RENDER SERVER!
const API = 'https://aura-chat-r2hn.onrender.com';

let refreshInterval;
let countdown = 5;
let currentSection = 'overview';

// Set initial branding
document.getElementById('page-subtitle').textContent = 'Real-time Aura Chat ecosystem status';

// --- Navigation ---
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const section = item.dataset.section;
        switchSection(section);
    });
});

function switchSection(section) {
    currentSection = section;
    document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.section === section));
    document.querySelectorAll('.section').forEach(s => s.classList.toggle('active', s.id === `section-${section}`));
    const titles = { overview: ['Overview', 'Real-time system metrics'], users: ['Registered Users', 'All users with hashed passwords'], logs: ['Activity Logs', 'Full system event history'] };
    document.getElementById('page-title').textContent = titles[section][0];
    document.getElementById('page-subtitle').textContent = titles[section][1];
    fetchData();
}

// --- Data Fetching ---
async function fetchData() {
    try {
        const res = await fetch(`${API}/api/admin/system-logs`);
        if (!res.ok) throw new Error('Server error');
        const data = await res.json();
        updateStatus(true);
        renderStats(data);
        renderRecentLogs(data.logs);
        renderFullLogs(data.logs);
        renderUsers(data.users);
    } catch {
        updateStatus(false);
    }
}

function updateStatus(online) {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    dot.classList.toggle('online', online);
    text.textContent = online ? 'Server Online' : 'Server Offline';
}

// --- Rendering ---
function renderStats(data) {
    const { logs, users } = data;
    document.getElementById('stat-users').textContent = users.length;
    document.getElementById('stat-logins').textContent = logs.filter(l => l.type === 'LOGIN_SUCCESS').length;
    document.getElementById('stat-failed').textContent = logs.filter(l => l.type === 'LOGIN_FAILED').length;
    document.getElementById('stat-registers').textContent = logs.filter(l => l.type === 'REGISTER').length;
}

function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function logBadge(type) {
    const map = {
        LOGIN_SUCCESS: ['success', 'Login ✓'],
        LOGIN_FAILED:  ['failed', 'Failed ✗'],
        REGISTER:      ['register', 'Register'],
        USER_REMOVED:  ['failed', 'Removed']
    };
    const [cls, label] = map[type] || ['register', type];
    return `<span class="log-badge badge-${cls}">${label}</span>`;
}

function renderLogEntry(log) {
    return `<div class="log-entry">
        ${logBadge(log.type)}
        <span class="log-user">${escHtml(log.username)}</span>
        <span class="log-time">${formatTime(log.timestamp)}</span>
    </div>`;
}

function renderRecentLogs(logs) {
    const el = document.getElementById('recent-logs');
    if (!logs.length) { el.innerHTML = '<div class="empty-state">No activity yet. Try registering or logging in from the User Portal.</div>'; return; }
    el.innerHTML = logs.slice(0, 8).map(renderLogEntry).join('');
}

function renderFullLogs(logs) {
    const el = document.getElementById('full-logs');
    if (!logs.length) { el.innerHTML = '<div class="empty-state">No activity yet.</div>'; return; }
    el.innerHTML = logs.map(renderLogEntry).join('');
}

function renderUsers(users) {
    const el = document.getElementById('users-table-wrapper');
    if (!users.length) { el.innerHTML = '<div class="empty-state">No users registered yet.</div>'; return; }
    const rows = users.map(u => `
        <tr>
            <td><span class="user-avatar">${escHtml(u.username[0].toUpperCase())}</span>${escHtml(u.username)}</td>
            <td><span class="chat-id-badge">${u.chatId}</span></td>
            <td class="hash-cell" title="${escHtml(u.passwordHash)}">${escHtml(u.passwordHash)}</td>
            <td>${new Date(u.createdAt).toLocaleString()}</td>
            <td><button class="btn-remove" onclick="removeUser('${u.chatId}', '${escHtml(u.username)}')">Remove</button></td>
        </tr>`).join('');
    el.innerHTML = `<table class="users-table">
        <thead><tr><th>Username</th><th>Chat ID</th><th>Password Hash</th><th>Registered</th><th>Action</th></tr></thead>
        <tbody>${rows}</tbody>
    </table>`;
}

async function removeUser(chatId, username) {
    if (!confirm(`Are you sure you want to remove ${username}? Data will be lost forever.`)) return;
    
    try {
        const res = await fetch(`${API}/api/admin/users/${chatId}`, { method: 'DELETE' });
        if (res.ok) {
            fetchData();
        } else {
            alert("Failed to remove user.");
        }
    } catch (err) {
        alert("Server error.");
    }
}

function escHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// --- Auto-refresh countdown ---
function startCountdown() {
    countdown = 5;
    clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
        countdown--;
        document.getElementById('refresh-countdown').textContent = countdown;
        if (countdown <= 0) { fetchData(); countdown = 5; }
    }, 1000);
}

// Init
fetchData();
startCountdown();
