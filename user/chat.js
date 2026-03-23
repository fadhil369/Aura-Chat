let socket;
let currentUser = null;
let currentChatPartner = null;
let contacts = [];

function initChat(userData) {
    currentUser = userData;
    // Load contacts specific to this user
    contacts = JSON.parse(localStorage.getItem(`chat_contacts_${currentUser.username}`) || '[]');
    
    document.getElementById('my-username').textContent = currentUser.username;
    document.getElementById('my-chat-id').textContent = currentUser.chatId;
    document.getElementById('my-avatar').textContent = currentUser.username[0].toUpperCase();
    
    // Connect to Socket.io
    socket = io(API);

    socket.on('connect', () => {
        console.log('Connected to chat server');
        socket.emit('join-personal-room', currentUser.username);
    });

    socket.on('receive-message', (msg) => {
        // Find if the sender is already in our contacts
        let contact = contacts.find(c => c.username === msg.sender);
        
        // If not, and it's not us, add them automatically!
        if (!contact && msg.sender !== currentUser.username) {
            contact = { username: msg.sender, chatId: msg.senderChatId, unread: true };
            contacts.unshift(contact);
        } else if (contact) {
            // Mark as unread if we're not currently chatting with them
            if (!currentChatPartner || currentChatPartner.chatId !== contact.chatId) {
                if (msg.sender !== currentUser.username) {
                    contact.unread = true;
                }
            }
            moveContactToTop(contact);
        }

        // Save incoming message to local storage immediately
        if (contact) {
            const room = getRoomName(currentUser.username, contact.username);
            const localKey = `chat_history_${currentUser.username}_${room}`;
            const localHistory = JSON.parse(localStorage.getItem(localKey) || '[]');
            localHistory.push(msg);
            localStorage.setItem(localKey, JSON.stringify(localHistory));
        }

        localStorage.setItem(`chat_contacts_${currentUser.username}`, JSON.stringify(contacts));
        renderContacts();

        if (currentChatPartner && 
           (msg.sender === currentChatPartner.username || msg.sender === currentUser.username)) {
            renderMessage(msg);
        }
    });

    socket.on('message-deleted', (data) => {
        const { room, id } = data;
        
        // Remove from UI
        const el = document.getElementById(`msg-${id}`);
        if (el) el.remove();

        // Remove from localStorage
        const localKey = `chat_history_${currentUser.username}_${room}`;
        const localHistory = JSON.parse(localStorage.getItem(localKey) || '[]');
        const updatedHistory = localHistory.filter(m => m.id !== id);
        localStorage.setItem(localKey, JSON.stringify(updatedHistory));
    });

    renderContacts();
}

function moveContactToTop(contact) {
    const index = contacts.findIndex(c => c.chatId === contact.chatId);
    if (index > -1) {
        contacts.splice(index, 1);
        contacts.unshift(contact);
        localStorage.setItem(`chat_contacts_${currentUser.username}`, JSON.stringify(contacts));
        renderContacts();
    }
}

async function searchContact() {
    const input = document.getElementById('contact-search');
    const id = input.value.trim();
    if (!id || id.length !== 10) {
        alert("Please enter a valid 10-digit ID");
        return;
    }
    if (id === currentUser.chatId) {
        alert("You cannot add yourself!");
        return;
    }

    try {
        const res = await fetch(`${API}/api/users/search/${id}`);
        if (!res.ok) throw new Error('User not found');
        const user = await res.json();
        
        if (!contacts.find(c => c.chatId === user.chatId)) {
            contacts.push(user);
            localStorage.setItem(`chat_contacts_${currentUser.username}`, JSON.stringify(contacts));
            renderContacts();
        }
        input.value = '';
        selectContact(user);
    } catch (err) {
        alert("User not found with that 10-digit ID.");
    }
}

function renderContacts() {
    const list = document.getElementById('contact-list');
    list.innerHTML = contacts.map(c => `
        <div class="contact-item ${currentChatPartner?.chatId === c.chatId ? 'active' : ''}" onclick="selectContact(${JSON.stringify(c).replace(/"/g, '&quot;')})">
            <div class="avatar">${c.username[0].toUpperCase()}</div>
            <div class="user-info">
                <div class="username">${c.username}</div>
                <div class="chat-id">${c.chatId}</div>
            </div>
            ${c.unread ? '<div class="notification-dot"></div>' : ''}
        </div>
    `).join('');
}

async function selectContact(contact) {
    if (window.innerWidth <= 768) {
        document.querySelector('.chat-sidebar').classList.add('hidden-mobile');
    }

    const contactRef = contacts.find(c => c.chatId === contact.chatId);
    if (contactRef) {
        contactRef.unread = false;
        localStorage.setItem(`chat_contacts_${currentUser.username}`, JSON.stringify(contacts));
    }
    
    currentChatPartner = contact;
    document.getElementById('chat-header-info').classList.remove('hidden');
    document.getElementById('target-contact-name').textContent = contact.username;
    document.getElementById('target-avatar').textContent = contact.username[0].toUpperCase();
    document.getElementById('chat-input-area').classList.remove('hidden');
    document.getElementById('chat-placeholder').classList.add('hidden');
    
    const room = getRoomName(currentUser.username, contact.username);
    socket.emit('join-room', room);
    
    renderContacts();
    
    // --- LOCAL-FIRST LOAD ---
    const localKey = `chat_history_${currentUser.username}_${room}`;
    const localHistory = JSON.parse(localStorage.getItem(localKey) || '[]');
    const container = document.getElementById('chat-messages');
    container.innerHTML = '';
    localHistory.forEach(renderMessage);
    
    // --- CLOUD SYNC ---
    try {
        const res = await fetch(`${API}/api/messages/${room}`);
        const serverHistory = await res.json();
        
        // Merge and update if needed
        if (serverHistory.length > localHistory.length) {
            container.innerHTML = '';
            serverHistory.forEach(renderMessage);
            localStorage.setItem(localKey, JSON.stringify(serverHistory));
        }
    } catch (err) {
        console.warn("Offline: Using local history only.");
    }
}

function backToList() {
    document.querySelector('.chat-sidebar').classList.remove('hidden-mobile');
}

function getRoomName(u1, u2) {
    return [u1, u2].sort().join('_');
}

function sendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if (!text || !currentChatPartner) return;

    const room = getRoomName(currentUser.username, currentChatPartner.username);
    socket.emit('send-message', {
        room,
        sender: currentUser.username,
        senderChatId: currentUser.chatId,
        target: currentChatPartner.username,
        text
    });
    
    // Move the active contact to the top
    if (currentChatPartner) {
        moveContactToTop(currentChatPartner);
    }

    input.value = '';
}

function deleteMessage(msgId) {
    if (!currentChatPartner) return;
    const room = getRoomName(currentUser.username, currentChatPartner.username);
    socket.emit('delete-message', { room, id: msgId });
}

function renderMessage(msg) {
    const container = document.getElementById('chat-messages');
    
    // Check if already rendered (to prevent duplicates on sync)
    if (document.getElementById(`msg-${msg.id}`)) return;

    const div = document.createElement('div');
    div.id = `msg-${msg.id}`;
    div.className = `message ${msg.sender === currentUser.username ? 'sent' : 'received'}`;
    
    const isSent = msg.sender === currentUser.username;
    const timeStr = msg.time || new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    div.innerHTML = `
        <div class="message-content">${msg.text}</div>
        <div class="message-meta">
            <span class="message-time">${timeStr}</span>
            ${isSent ? `
                <button class="btn-delete-msg" onclick="deleteMessage('${msg.id}')" title="Delete message">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            ` : ''}
        </div>
    `;
    
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}
