const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});
const port = process.env.PORT || 3000;

// Enable CORS so the separate user and developer frontends can access the API
app.use(cors());
app.use(express.json());

// In-memory database with file persistence
const USERS_FILE = path.join(__dirname, 'users.json');
const MESSAGES_FILE = path.join(__dirname, 'messages.json');

let users = {};
let messages = {}; // { room: [{ sender, text, timestamp }] }

// Load users from file
if (fs.existsSync(USERS_FILE)) {
    try {
        users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch (e) { console.error('Error loading users:', e); }
}

// Load messages from file
if (fs.existsSync(MESSAGES_FILE)) {
    try {
        messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
    } catch (e) { console.error('Error loading messages:', e); }
}

function saveUsers() { fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2)); }
function saveMessages() { fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2)); }

function generateChatId() {
    let id;
    do {
        id = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    } while (Object.values(users).some(u => u.chatId === id));
    return id;
}

// In-memory database for system logs (for the developer dashboard)
// Structure: [{ type: 'REGISTER' | 'LOGIN_SUCCESS' | 'LOGIN_FAILED', username: string, timestamp: Date }]
const systemLogs = [];

function addLog(type, username) {
    systemLogs.unshift({
        type,
        username,
        timestamp: new Date()
    });
    // Keep only the last 100 logs
    if (systemLogs.length > 100) systemLogs.pop();
}

// ---------------------------
// USER ENDPOINTS
// ---------------------------

// Register a new user
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        if (users[username]) {
            return res.status(409).json({ error: 'Username already exists' });
        }

        // --- SECURE PASSWORD HANDLING ---
        // Hash the password with a generated salt. 
        // The plain text password is NEVER stored or sent to the developer dashboard.
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Store the hashed password securely
        users[username] = {
            passwordHash: passwordHash,
            chatId: generateChatId(),
            createdAt: new Date()
        };

        saveUsers(); // Persist to file
        addLog('REGISTER', username);

        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login an existing user
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const userRecord = users[username];

        if (!userRecord) {
            addLog('LOGIN_FAILED', username);
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // --- SECURE AUTHENTICATION ---
        // Compare the provided plain text password with the stored hash
        const match = await bcrypt.compare(password, userRecord.passwordHash);

        if (match) {
            // Generate chatId for legacy users who registered before the update
            if (!userRecord.chatId) {
                userRecord.chatId = generateChatId();
                saveUsers();
            }

            addLog('LOGIN_SUCCESS', username);
            res.status(200).json({ 
                message: 'Login successful', 
                token: 'dummy-jwt-token',
                username: username,
                chatId: userRecord.chatId
            });
        } else {
            addLog('LOGIN_FAILED', username);
            res.status(401).json({ error: 'Invalid username or password' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Search for a user by Chat ID
app.get('/api/users/search/:id', (req, res) => {
    const targetId = req.params.id;
    const foundUser = Object.keys(users).find(name => users[name].chatId === targetId);
    
    if (foundUser) {
        res.json({ username: foundUser, chatId: targetId });
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

// Get messages for a specific room (chat between two users)
app.get('/api/messages/:room', (req, res) => {
    const room = req.params.room;
    res.json(messages[room] || []);
});

// Delete a specific message
app.delete('/api/messages/:room/:id', (req, res) => {
    const { room, id } = req.params;
    if (messages[room]) {
        const initialLength = messages[room].length;
        messages[room] = messages[room].filter(m => m.id !== id);
        if (messages[room].length < initialLength) {
            saveMessages();
            io.to(room).emit('message-deleted', { room, id });
            return res.json({ success: true });
        }
    }
    res.status(404).json({ error: 'Message not found' });
});

// ---------------------------
// DEVELOPER DASHBOARD ENDPOINTS
// ---------------------------

// Remove a user
app.delete('/api/admin/users/:chatId', (req, res) => {
    const chatId = req.params.chatId;
    const username = Object.keys(users).find(u => users[u].chatId === chatId);
    
    if (username) {
        delete users[username];
        saveUsers();
        addLog('USER_REMOVED', username);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

// Get system logs and sanitized user list
app.get('/api/admin/system-logs', (req, res) => {
    // Map the users object into an array, exposing ONLY the hash, to prove passwords are secure
    const sanitizedUsers = Object.keys(users).map(username => ({
        username,
        chatId: users[username].chatId,
        passwordHash: users[username].passwordHash,
        createdAt: users[username].createdAt
    }));

    res.json({
        logs: systemLogs,
        users: sanitizedUsers
    });
});

// ---------------------------
// SOCKET.IO REAL-TIME CHAT
// ---------------------------
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join-room', (room) => {
        socket.join(room);
        console.log(`User joined room: ${room}`);
    });

    // Join a personal room for universal message delivery
    socket.on('join-personal-room', (username) => {
        socket.join(`user_${username}`);
        console.log(`User joined personal room: user_${username}`);
    });

    socket.on('send-message', (data) => {
        const { room, sender, senderChatId, text, target } = data;
        const now = new Date();
        const msg = { 
            id: Date.now().toString(), 
            sender, 
            senderChatId, 
            text, 
            timestamp: now,
            time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        
        if (!messages[room]) messages[room] = [];
        messages[room].push(msg);
        saveMessages();

        // Emit to the specific chat room
        io.to(room).emit('receive-message', msg);
        
        // Also emit to the target's personal room so they "discover" the message/sender
        if (target && target !== sender) {
            io.to(`user_${target}`).emit('receive-message', msg);
        }
    });

    socket.on('delete-message', (data) => {
        const { room, id } = data;
        if (messages[room]) {
            messages[room] = messages[room].filter(m => m.id !== id);
            saveMessages();
            io.to(room).emit('message-deleted', { room, id });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

server.listen(port, () => {
    console.log(`Secure Login & Chat Backend running at http://localhost:${port}`);
    console.log(`Developer API available at http://localhost:${port}/api/admin/system-logs`);
});
