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

// Map to store online users: clientId -> { clientId, page, online, lastSeen }
const onlineUsers = new Map();

// Helper function to broadcast all users
function broadcastUsers() {
  const users = Array.from(onlineUsers.values());
  io.emit('users_update', users);
}

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Handle user join
  socket.on('user_online', (data) => {
    const { clientId, page } = data;
    
    if (!clientId) return;

    const user = {
      clientId,
      page: page || '/',
      online: true,
      lastSeen: new Date().toISOString(),
    };

    onlineUsers.set(clientId, user);
    console.log(`✅ User online: ${clientId} on page: ${page}`);
    
    // Broadcast to all clients
    broadcastUsers();
  });

  // Handle page change
  socket.on('user_page_change', (data) => {
    const { clientId, page } = data;
    
    if (!clientId || !onlineUsers.has(clientId)) return;

    const user = onlineUsers.get(clientId);
    user.page = page;
    user.lastSeen = new Date().toISOString();
    
    onlineUsers.set(clientId, user);
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
      console.log(`❌ User offline: ${clientId}`);
      broadcastUsers();
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`🔴 Client disconnected: ${socket.id}`);
    
    // Find and remove user by socket.id (we need to track socket.id -> clientId)
    // For now, we'll rely on heartbeat timeout on client side
  });
});

// Periodic cleanup of stale users (no heartbeat for 60 seconds)
setInterval(() => {
  const now = Date.now();
  const timeout = 60000; // 60 seconds
  
  let changed = false;
  
  for (const [clientId, user] of onlineUsers.entries()) {
    const lastSeen = new Date(user.lastSeen).getTime();
    if (now - lastSeen > timeout) {
      onlineUsers.delete(clientId);
      changed = true;
      console.log(`🧹 Cleaned up stale user: ${clientId}`);
    }
  }
  
  if (changed) {
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
  console.log(`🚀 Socket.io Server running on port ${PORT}`);
});
