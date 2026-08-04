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

if (supabase) {
  console.log('[Supabase] ✅ Connected to Supabase');
} else {
  console.log('[Supabase] ❌ SUPABASE_SERVICE_KEY not found - using fallback');
}

// Initialize Firebase Admin
let firebaseInitialized = false;

function initializeFirebase() {
  console.log('[FCM] 🔧 Initializing Firebase Admin SDK...');
  
  if (firebaseInitialized) {
    console.log('[FCM] Already initialized, skipping...');
    return;
  }
  
  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    console.log('[FCM] 📋 FIREBASE_SERVICE_ACCOUNT:', serviceAccount ? 'FOUND' : 'NOT FOUND');
    
    if (serviceAccount) {
      const parsed = JSON.parse(serviceAccount);
      console.log('[FCM] 📊 Service account project_id:', parsed.project_id);
      console.log('[FCM] 📊 Service account client_email:', parsed.client_email);
      
      admin.initializeApp({
        credential: admin.credential.cert(parsed),
      });
      firebaseInitialized = true;
      console.log('[FCM] ✅ Firebase Admin initialized successfully');
    } else {
      console.log('[FCM] ❌ FIREBASE_SERVICE_ACCOUNT not found in environment variables');
      console.log('[FCM] 💡 Notifications will NOT work without this');
      console.log('[FCM] 💡 Please set FIREBASE_SERVICE_ACCOUNT in Railway environment variables');
    }
  } catch (error) {
    console.log('[FCM] ❌ Error initializing Firebase:', error.message);
    console.log('[FCM] 💡 Check if FIREBASE_SERVICE_ACCOUNT is valid JSON');
  }
}

// Initialize on startup
initializeFirebase();

// Function to send push notification
async function sendPushNotification(tokens, title, body, data = {}) {
  console.log('[FCM] 🚀 sendPushNotification called');
  console.log('[FCM] 📝 Title:', title);
  console.log('[FCM] 📝 Body:', body);
  console.log('[FCM] 📊 Tokens count:', tokens?.length || 0);
  
  if (!firebaseInitialized) {
    console.log('[FCM] ❌ Firebase Admin SDK not initialized');
    console.log('[FCM] 💡 Check FIREBASE_SERVICE_ACCOUNT environment variable');
    return { success: false, error: 'Firebase not initialized' };
  }

  if (!tokens || tokens.length === 0) {
    console.log('[FCM] ❌ No tokens provided - skipping notification');
    return { success: false, error: 'No tokens provided' };
  }

  try {
    console.log('[FCM] 📤 Preparing FCM message...');
    
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

    console.log('[FCM] 📡 Sending to Firebase Cloud Messaging...');
    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log('[FCM] ✅ Firebase response received:');
    console.log('[FCM]    - Success count:', response.successCount);
    console.log('[FCM]    - Failure count:', response.failureCount);
    
    // Log individual results
    if (response.responses) {
      response.responses.forEach((resp, index) => {
        if (resp.success) {
          console.log(`[FCM]    ✅ Token ${index + 1}: SUCCESS`);
        } else {
          console.log(`[FCM]    ❌ Token ${index + 1}: FAILED`);
          console.log(`[FCM]       Error:`, resp.error?.message || 'Unknown error');
        }
      });
    }

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    console.error('[FCM] ❌ Exception while sending:', error.message);
    console.error('[FCM] 💡 Error details:', error);
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

  // Handle new registration event from frontend
  socket.on('registration_completed', async (data) => {
    log(`📝 Registration completed:`, data);
    
    // Send notification immediately
    await notifyNewRegistration(data);
    
    // Broadcast to all admins
    io.emit('new_registration', data);
  });

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
    fcmEnabled: firebaseInitialized,
    supabaseConnected: !!supabase,
    notificationMode: 'polling',
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

// API endpoint to trigger notification for new registration (fallback for polling)
app.post('/api/notify-new-registration', async (req, res) => {
  const { registrationData } = req.body;

  if (!registrationData) {
    return res.status(400).json({ error: 'Missing registration data' });
  }

  console.log('[API] Received new registration notification request');
  
  await notifyNewRegistration(registrationData);
  
  res.json({ success: true });
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

// Track last check for polling fallback
let lastRegistrationCheck = new Date().toISOString();

// Function to get all admin tokens
function getAdminTokens() {
  return Array.from(adminTokens.values());
}

// Function to get admin tokens from database
async function getAdminTokensFromDB() {
  console.log('[FCM] getAdminTokensFromDB called');
  
  if (!supabase) {
    console.log('[FCM] ❌ Supabase not connected - using memory store');
    return getAdminTokens();
  }

  try {
    console.log('[FCM] 📡 Fetching tokens from fcm_tokens table...');
    
    const { data, error } = await supabase
      .from('fcm_tokens')
      .select('id, admin_id, device_token, is_active')
      .eq('is_active', true);

    if (error) {
      console.error('[FCM] ❌ Error fetching tokens from DB:', error.message);
      return getAdminTokens();
    }

    console.log('[FCM] 📊 Query result:', {
      count: data?.length || 0,
    });

    if (!data || data.length === 0) {
      console.log('[FCM] ⚠️ No active tokens found in database');
      return getAdminTokens();
    }

    const tokens = data.map(row => row.device_token);
    console.log('[FCM] ✅ Found', tokens.length, 'active tokens');
    return tokens;
  } catch (error) {
    console.error('[FCM] ❌ Exception:', error.message);
    return getAdminTokens();
  }
}

// Function to check for new registrations (polling fallback)
async function checkForNewRegistrations() {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('registrations')
      .select('*')
      .gt('created_at', lastRegistrationCheck)
      .order('created_at', { ascending: true });

    if (error) {
      console.log('[Polling] Error checking registrations:', error.message);
      return [];
    }

    if (data && data.length > 0) {
      console.log('[Polling] Found', data.length, 'new registrations');
      lastRegistrationCheck = new Date().toISOString();
      return data;
    }

    return [];
  } catch (error) {
    console.log('[Polling] Error:', error.message);
    return [];
  }
}

// Polling interval (every 10 seconds as fallback)
setInterval(async () => {
  try {
    const newRegistrations = await checkForNewRegistrations();
    
    for (const registration of newRegistrations) {
      console.log('[Polling] Processing new registration:', registration.id);
      await notifyNewRegistration(registration);
    }
  } catch (error) {
    console.log('[Polling] Error in polling loop:', error.message);
  }
}, 10000);

// Function to send new registration notification
async function notifyNewRegistration(registrationData) {
  console.log('[FCM] 🔔 notifyNewRegistration called');
  console.log('[FCM] 📋 Registration data:', JSON.stringify(registrationData, null, 2));
  
  const tokens = await getAdminTokensFromDB();
  console.log('[FCM] 📊 Tokens to notify:', tokens.length);

  if (tokens.length === 0) {
    console.log('[FCM] ⚠️ No admin tokens available - notification NOT sent');
    console.log('[FCM] 💡 Possible reasons:');
    console.log('[FCM]    1. No admin has enabled notifications yet');
    console.log('[FCM]    2. FCM tokens table is empty');
    console.log('[FCM]    3. All tokens are inactive');
    return;
  }

  const title = '📝 طلب تسجيل جديد!';
  const body = registrationData.name 
    ? `عميل جديد: ${registrationData.name}` 
    : `لديك طلب تسجيل جديد`;

  console.log('[FCM] 📤 Sending notification...');
  await sendPushNotification(tokens, title, body, {
    type: 'new_registration',
    registrationId: registrationData.id || 'unknown',
    timestamp: new Date().toISOString(),
  });
}

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, async () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║           🚀 Socket.io Server Started                 ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Port: ${PORT}`);
  console.log(`║  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`║  Firebase: ${firebaseInitialized ? '✅ Initialized' : '❌ NOT Initialized'}`);
  console.log(`║  Supabase: ${supabase ? '✅ Connected' : '❌ NOT Connected'}`);
  console.log('║  Notifications: Polling (every 10 seconds)');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('[Polling] 🔄 Starting polling for new registrations...');
});
