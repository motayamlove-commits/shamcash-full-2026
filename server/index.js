const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Logging helper
function log(message, data = null) {
  const timestamp = new Date().toISOString();
  const logMessage = data ? `${timestamp} - ${message} ${JSON.stringify(data)}` : `${timestamp} - ${message}`;
  console.log(logMessage);
}

log('🚀 Socket.io Server starting...');
log('📦 Environment:', {
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || 'development'
});

// Map to store online users: clientId -> { clientId, page, online, lastSeen }
const onlineUsers = new Map();

// Helper function to broadcast all users
function broadcastUsers() {
  const users = Array.from(onlineUsers.values());
  io.emit('users_update', users);
}

io.on('connection', (socket) => {
  log(`🔌 Client connected: ${socket.id}`);

  // Handle user join
  socket.on('user_online', (data) => {
    const { clientId, page } = data;
    
    if (!clientId) {
      log('⚠️ user_online received but no clientId!');
      return;
    }

    const user = {
      clientId,
      page: page || '/',
      online: true,
      lastSeen: new Date().toISOString(),
    };

    onlineUsers.set(clientId, user);
    log(`✅ User online: ${clientId} on page: ${page}`);
    
    // Broadcast to all clients
    broadcastUsers();
  });

  // Handle page change
  socket.on('user_page_change', (data) => {
    const { clientId, page } = data;
    
    if (!clientId || !onlineUsers.has(clientId)) {
      log(`⚠️ user_page_change: clientId=${clientId}, found=${onlineUsers.has(clientId)}`);
      return;
    }

    const user = onlineUsers.get(clientId);
    user.page = page;
    user.lastSeen = new Date().toISOString();
    
    onlineUsers.set(clientId, user);
    log(`📍 User ${clientId} changed page to: ${page}`);
    broadcastUsers();
  });

  // Handle user heartbeat (to keep connection alive)
  socket.on('user_heartbeat', (data) => {
    const { clientId } = data;
    
    if (!clientId || !onlineUsers.has(clientId)) return;

    const user = onlineUsers.get(clientId);
    user.lastSeen = new Date().toISOString();
    user.online = true;
    
    onlineUsers.set(clientId, user);
  });

  // Handle user offline
  socket.on('user_offline', (data) => {
    const { clientId } = data;
    
    if (!clientId) return;

    if (onlineUsers.has(clientId)) {
      onlineUsers.delete(clientId);
      log(`❌ User offline: ${clientId}`);
      broadcastUsers();
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    log(`🔴 Client disconnected: ${socket.id}`);
    
    // Find and remove user by socket.id (we need to track socket.id -> clientId)
    // For now, we'll rely on heartbeat timeout on client side
  });
});

// Periodic cleanup of stale users (no heartbeat for 60 seconds)
setInterval(() => {
  const now = Date.now();
  const timeout = 60000; // 60 seconds
  
  let changed = false;
  let cleanedCount = 0;
  
  for (const [clientId, user] of onlineUsers.entries()) {
    const lastSeen = new Date(user.lastSeen).getTime();
    if (now - lastSeen > timeout) {
      onlineUsers.delete(clientId);
      changed = true;
      cleanedCount++;
    }
  }
  
  if (changed) {
    log(`🧹 Cleaned up ${cleanedCount} stale users. Total online: ${onlineUsers.size}`);
    broadcastUsers();
  }
}, 30000); // Check every 30 seconds

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    onlineUsers: onlineUsers.size,
    users: Array.from(onlineUsers.values()),
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  log(`✅ Socket.io Server running on port ${PORT}`);
  log(`📡 Health check: http://localhost:${PORT}/`);
  log(`🔌 Socket.io endpoint: http://localhost:${PORT}/socket.io/`);
});
