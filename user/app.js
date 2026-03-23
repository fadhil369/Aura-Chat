// CHANGE THIS to your hosted Render URL (e.g., https://your-server.onrender.com)
// Using your local IP for mobile access on same Wi-Fi.
const API = 'http://192.168.1.126:3000';
let loggedInUser = null;


function switchTab(tab) {
    document.getElementById('form-login').classList.toggle('hidden', tab !== 'login');
    document.getElementById('form-register').classList.toggle('hidden', tab !== 'register');
    document.getElementById('tab-login').classList.toggle('active', tab === 'login');
    document.getElementById('tab-register').classList.toggle('active', tab === 'register');
    clearAlerts();
}

function showAlert(id, type, msg) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.className = `alert ${type}`;
    el.classList.remove('hidden');
}

function clearAlerts() {
    ['login-alert', 'reg-alert'].forEach(id => {
        const el = document.getElementById(id);
        el.className = 'alert hidden';
        el.textContent = '';
    });
}

function setLoading(btn, loader, loading) {
    document.getElementById(btn).disabled = loading;
    document.querySelector(`#${btn} .btn-text`).classList.toggle('hidden', loading);
    document.querySelector(`#${btn} .btn-loader`).classList.toggle('hidden', !loading);
}

function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    const isText = input.type === 'text';
    input.type = isText ? 'password' : 'text';
    btn.style.opacity = isText ? '0.5' : '1';
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    clearAlerts();
    setLoading('btn-login', 'btn-loader', true);
    try {
        const res = await fetch(`${API}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (res.ok) {
            loggedInUser = data; // Contains username and chatId
            document.getElementById('form-login').classList.add('hidden');
            document.getElementById('screen-success').classList.remove('hidden');
            document.getElementById('success-title').textContent = 'Perfectly Connected!';
            document.getElementById('success-username').textContent = username;
            document.querySelector('.tabs').classList.add('hidden');
        } else {
            showAlert('login-alert', 'error', data.error || 'Login failed.');
        }
    } catch {
        showAlert('login-alert', 'error', 'Could not connect to server. Make sure the backend is running.');
    } finally {
        setLoading('btn-login', 'btn-loader', false);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    clearAlerts();
    if (password.length < 6) {
        showAlert('reg-alert', 'error', 'Password must be at least 6 characters.');
        return;
    }
    setLoading('btn-register', 'btn-loader', true);
    try {
        const res = await fetch(`${API}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (res.ok) {
            showAlert('reg-alert', 'success', '✓ Account created! You can now log in.');
            document.getElementById('reg-username').value = '';
            document.getElementById('reg-password').value = '';
            setTimeout(() => switchTab('login'), 1800);
        } else {
            showAlert('reg-alert', 'error', data.error || 'Registration failed.');
        }
    } catch {
        showAlert('reg-alert', 'error', 'Could not connect to server. Make sure the backend is running.');
    } finally {
        setLoading('btn-register', 'btn-loader', false);
    }
}

function logout() {
    loggedInUser = null;
    contacts = []; // Clear chat contacts from memory on logout
    currentChatPartner = null;
    document.getElementById('screen-chat').classList.add('hidden');
    document.querySelector('.tabs').classList.remove('hidden');
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    
    if (socket) socket.disconnect();
    switchTab('login');
}

function proceedToChat() {
    if (!loggedInUser) return;
    document.getElementById('screen-success').classList.add('hidden');
    document.querySelector('.container').classList.add('hidden');
    document.getElementById('screen-chat').classList.remove('hidden');
    initChat(loggedInUser);
}
