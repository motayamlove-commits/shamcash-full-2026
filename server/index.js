const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client for database access
const supabaseUrl = process.env.SUPABASE_URL || 'https://ckfnijbydegatcsvgtky.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Initialize Supabase client for Realtime
const supabaseRealtimeUrl = process.env.SUPABASE_URL || 'https://ckfnijbydegatcsvgtky.supabase.co';
const supabaseRealtimeKey = process.env.SUPABASE_ANON_KEY || supabaseKey;
const supabaseRealtime = supabaseRealtimeKey ? createClient(supabaseRealtimeUrl, supabaseRealtimeKey) : null;

if (supabase) {
  console.log('[Supabase] Connected to Supabase');
} else {
  console.log('[Supabase] SUPABASE_SERVICE_KEY not found - using fallback');
}

// Initialize Firebase Admin
let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) return;
  
  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (serviceAccount) {
      const parsed = JSON.parse(serviceAccount);
      admin.initializeApp({
        credential: admin.credential.cert(parsed),
      });
      firebaseInitialized = true;
      console.log('[FCM] Firebase Admin initialized successfully');
    } else {
      console.log('[FCM] FIREBASE_SERVICE_ACCOUNT not found - notifications disabled');
    }
  } catch (error) {
    console.log('[FCM] Error initializing Firebase:', error.message);
  }
}

// Initialize on startup
initializeFirebase();

// Function to send push notification
async function sendPushNotification(tokens, title, body, data = {}) {
  if (!firebaseInitialized) {
    console.log('[FCM] Firebase not initialized - skipping notification');
    return { success: false, error: 'Firebase not initialized' };
  }

  if (!tokens || tokens.length === 0) {
    console.log('[FCM] No tokens provided - skipping notification');
    return { success: false, error: 'No tokens provided' };
  }

  try {
    const message = {
      notification: {
        title: title,
        body: body,
      },
      data: {
        ...data,
        click_action: '/admin',
      },
      tokens: tokens,
      webpush: {
        fcmOptions: {
          link: '/admin',
        },
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log('[FCM] Notification sent:', {
      successCount: response.successCount,
      failureCount: response.failureCount,
    });

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    console.error('[FCM] Error sending notification:', error.message);
    return { success: false, error: error.message };
  }
}

const app = express();
app.use(cors());
app.use(express.json());

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
    fcmEnabled: firebaseInitialized,
  });
});

// API endpoint to send notification
app.post('/api/send-notification', async (req, res) => {
  const { tokens, title, body, data } = req.body;

  if (!tokens || !title || !body) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  console.log('[API] Sending notification:', { title, body, tokenCount: Array.isArray(tokens) ? tokens.length : 1 });

  const result = await sendPushNotification(tokens, title, body, data);
  
  res.json(result);
});

// API endpoint to register FCM token for admin
app.post('/api/admin/register-token', async (req, res) => {
  const { adminId, token } = req.body;

  if (!adminId || !token) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Store token in memory (in production, save to database)
  adminTokens.set(adminId, token);
  console.log('[API] Admin token registered:', adminId);

  res.json({ success: true });
});

// In-memory store for admin FCM tokens
const adminTokens = new Map();

// Function to get all admin tokens
function getAdminTokens() {
  return Array.from(adminTokens.values());
}

// Function to get admin tokens from database
async function getAdminTokensFromDB() {
  if (!supabase) {
    console.log('[FCM] Supabase not connected - using memory store');
    return getAdminTokens();
  }

  try {
    const { data, error } = await supabase
      .from('fcm_tokens')
      .select('device_token')
      .eq('is_active', true);

    if (error) {
      console.error('[FCM] Error fetching tokens from DB:', error.message);
      return getAdminTokens();
    }

    const tokens = data.map(row => row.device_token);
    console.log('[FCM] Fetched', tokens.length, 'tokens from database');
    return tokens;
  } catch (error) {
    console.error('[FCM] Error:', error.message);
    return getAdminTokens();
  }
}

// Function to send new registration notification
async function notifyNewRegistration(registrationData) {
  const tokens = await getAdminTokensFromDB();

  if (tokens.length === 0) {
    console.log('[FCM] No admin tokens - skipping notification');
    return;
  }

  const title = '📝 طلب تسجيل جديد!';
  const body = registrationData.name 
    ? `عميل جديد: ${registrationData.name}` 
    : `لديك طلب تسجيل جديد`;

  await sendPushNotification(tokens, title, body, {
    type: 'new_registration',
    registrationId: registrationData.id || 'unknown',
    timestamp: new Date().toISOString(),
  });
}

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, async () => {
  log(`✅ Socket.io Server running on port ${PORT}`);
  log(`📡 Health check: http://localhost:${PORT}/`);
  log(`🔌 Socket.io endpoint: http://localhost:${PORT}/socket.io/`);

  // Subscribe to new registrations for FCM notifications
  if (supabaseRealtime) {
    console.log('[Realtime] Subscribing to registrations table...');
    
    const channel = supabaseRealtime
      .channel('registrations-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'registrations'
        },
        async (payload) => {
          console.log('[Realtime] New registration detected:', payload.new);
          
          // Send FCM notification to all admins
          await notifyNewRegistration(payload.new);
          
          // Broadcast to all connected admins
          io.emit('new_registration', payload.new);
        }
      )
      .subscribe();

    console.log('[Realtime] Subscribed to registrations changes');
  } else {
    console.log('[Realtime] Supabase not connected - realtime disabled');
  }
});
