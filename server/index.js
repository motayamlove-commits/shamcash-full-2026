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
    };

    const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, '');
    if (frontendUrl) {
      message.webpush = {
        fcmOptions: {
          link: `${frontendUrl}/admin`,
        },
      };
    }

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
      success: response.successCount > 0,
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
  socket.on('registration_completed', async (data, acknowledge) => {
    log('📝 Registration completed', { id: data?.id });

    const result = await dispatchEventNotification('registration', data);

    // Preserve the existing realtime broadcast for connected dashboards
    io.emit('new_registration', data);

    if (typeof acknowledge === 'function') {
      acknowledge(result);
    }
  });

  // Handle a new login attempt without sending credentials in the event
  socket.on('login_attempt_completed', async (data, acknowledge) => {
    log('🔐 Login attempt completed', { id: data?.id });

    const result = await dispatchEventNotification('login_attempt', data);

    if (typeof acknowledge === 'function') {
      acknowledge(result);
    }
  });

  // Handle a new verification-code attempt without sending the code itself
  socket.on('verification_code_completed', async (data, acknowledge) => {
    log('🔢 Verification code completed', { id: data?.id });

    const result = await dispatchEventNotification('verification_code', data);

    if (typeof acknowledge === 'function') {
      acknowledge(result);
    }
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
    databaseRealtimeStatus,
    notificationMode: 'database_realtime_with_socket_http_and_polling_fallback',
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

// Generic HTTP fallback for instant event notifications
app.post('/api/notify-event', async (req, res) => {
  const { eventType, eventData } = req.body;
  const supportedEventTypes = new Set(['registration', 'login_attempt', 'verification_code']);

  if (!supportedEventTypes.has(eventType)) {
    return res.status(400).json({ success: false, error: 'Unsupported event type' });
  }

  if (!eventData || typeof eventData !== 'object' || !eventData.id) {
    return res.status(400).json({ success: false, error: 'Missing event data or event id' });
  }

  console.log('[API] Received notification event:', eventType, eventData.id);

  const result = await dispatchEventNotification(eventType, eventData);
  const statusCode = result.success || result.deduplicated ? 200 : 503;

  return res.status(statusCode).json(result);
});

// Keep the existing registration endpoint for backwards compatibility
app.post('/api/notify-new-registration', async (req, res) => {
  const { registrationData } = req.body;

  if (!registrationData) {
    return res.status(400).json({ error: 'Missing registration data' });
  }

  console.log('[API] Received new registration notification request');

  const result = await dispatchEventNotification('registration', registrationData);
  const statusCode = result.success || result.deduplicated ? 200 : 503;

  return res.status(statusCode).json(result);
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

const DATABASE_EVENT_SOURCES = [
  {
    eventType: 'registration',
    table: 'registrations',
    select: 'id, full_name, client_id, created_at',
    broadcastEvent: 'new_registration',
  },
  {
    eventType: 'login_attempt',
    table: 'login_attempts',
    select: 'id, registration_id, client_id, email, created_at',
    broadcastEvent: 'new_login_attempt',
  },
  {
    eventType: 'verification_code',
    table: 'verification_codes',
    select: 'id, registration_id, client_id, created_at',
    broadcastEvent: 'new_verification_code',
  },
];

const lastEventChecks = new Map(
  DATABASE_EVENT_SOURCES.map((source) => [source.eventType, new Date().toISOString()]),
);
let databaseRealtimeStatus = 'not_started';
let databaseEventChannel = null;

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

async function checkForNewDatabaseEvents(source) {
  if (!supabase) return [];

  const lastCheck = lastEventChecks.get(source.eventType) || new Date().toISOString();

  try {
    const { data, error } = await supabase
      .from(source.table)
      .select(source.select)
      .gt('created_at', lastCheck)
      .order('created_at', { ascending: true });

    if (error) {
      console.log(`[Polling] Error checking ${source.table}:`, error.message);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    const lastCreatedAt = data[data.length - 1]?.created_at;
    if (lastCreatedAt) {
      lastEventChecks.set(source.eventType, lastCreatedAt);
    }

    console.log(`[Polling] Found ${data.length} new ${source.table} row(s)`);
    return data;
  } catch (error) {
    console.log(`[Polling] Exception checking ${source.table}:`, error.message);
    return [];
  }
}

async function pollDatabaseEvents() {
  for (const source of DATABASE_EVENT_SOURCES) {
    const newEvents = await checkForNewDatabaseEvents(source);

    for (const eventData of newEvents) {
      console.log(`[Polling] Processing ${source.eventType}:`, eventData.id);
      await dispatchEventNotification(source.eventType, eventData);
      io.emit(source.broadcastEvent, eventData);
    }
  }
}

function startDatabaseEventSubscriptions() {
  if (!supabase || typeof supabase.channel !== 'function') {
    databaseRealtimeStatus = 'unavailable';
    console.log('[Realtime] Supabase Realtime is unavailable; polling remains active');
    return;
  }

  databaseEventChannel = supabase.channel('server-instant-notifications');

  for (const source of DATABASE_EVENT_SOURCES) {
    databaseEventChannel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: source.table },
      async (payload) => {
        const eventData = payload?.new;
        if (!eventData?.id) return;

        console.log(`[Realtime] New ${source.eventType}:`, eventData.id);
        await dispatchEventNotification(source.eventType, eventData);
        io.emit(source.broadcastEvent, eventData);
      },
    );
  }

  databaseEventChannel.subscribe((status) => {
    databaseRealtimeStatus = status;
    console.log('[Realtime] Database event subscription status:', status);
  });
}

// Polling remains as a fallback if the realtime subscription is interrupted.
setInterval(() => {
  pollDatabaseEvents().catch((error) => {
    console.log('[Polling] Error in database event loop:', error.message);
  });
}, 10000);

async function fetchEventRow(eventType, eventId) {
  if (!supabase || !eventId || eventType === 'registration') return null;

  const table = eventType === 'login_attempt' ? 'login_attempts' : 'verification_codes';
  const select = eventType === 'login_attempt'
    ? 'id, registration_id, client_id, email, created_at'
    : 'id, registration_id, client_id, created_at';

  try {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .eq('id', eventId)
      .maybeSingle();

    if (error) {
      console.log(`[FCM] Could not fetch ${eventType} row:`, error.message);
      return null;
    }

    return data;
  } catch (error) {
    console.log(`[FCM] Exception fetching ${eventType} row:`, error.message);
    return null;
  }
}

async function findRegistrationForEvent(eventData) {
  if (!supabase) return null;

  const lookups = [
    eventData.registration_id
      ? { column: 'id', value: eventData.registration_id }
      : null,
    eventData.client_id
      ? { column: 'client_id', value: eventData.client_id }
      : null,
    eventData.email
      ? { column: 'email', value: eventData.email }
      : null,
  ].filter(Boolean);

  for (const lookup of lookups) {
    try {
      const { data, error } = await supabase
        .from('registrations')
        .select('id, full_name, client_id, created_at')
        .eq(lookup.column, lookup.value)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        return data;
      }

      if (error) {
        console.log(`[FCM] Registration lookup by ${lookup.column} failed:`, error.message);
      }
    } catch (error) {
      console.log(`[FCM] Registration lookup by ${lookup.column} threw:`, error.message);
    }
  }

  return null;
}

async function enrichEventNotificationData(eventType, eventData) {
  const enrichedData = { ...eventData };
  const eventId = eventData?.id ? String(eventData.id) : '';

  if (eventType === 'registration') {
    enrichedData.name = enrichedData.name || enrichedData.full_name || '';
    enrichedData.registration_id = enrichedData.registration_id || eventId;
    return enrichedData;
  }

  const eventRow = await fetchEventRow(eventType, eventId);
  if (eventRow) {
    enrichedData.registration_id = enrichedData.registration_id || eventRow.registration_id || null;
    enrichedData.client_id = enrichedData.client_id || eventRow.client_id || null;
    enrichedData.email = enrichedData.email || eventRow.email || null;
    enrichedData.created_at = enrichedData.created_at || eventRow.created_at;
  }

  const registration = await findRegistrationForEvent(enrichedData);
  if (registration) {
    enrichedData.name = enrichedData.name || registration.full_name || '';
    enrichedData.registration_id = enrichedData.registration_id || registration.id;
    enrichedData.client_id = enrichedData.client_id || registration.client_id || null;
  }

  return enrichedData;
}

const EVENT_NOTIFICATION_CONFIG = {
  registration: {
    title: '📝 طلب تسجيل جديد',
    body: (eventData) => eventData.name
      ? `طلب تسجيل جديد للعميل ${eventData.name}`
      : 'لديك طلب تسجيل جديد',
    data: (eventData) => ({
      type: 'new_registration',
      registrationId: String(eventData.registration_id || eventData.id),
      customerName: String(eventData.name || ''),
    }),
  },
  login_attempt: {
    title: '🔐 تسجيل دخول جديد',
    body: (eventData) => eventData.name
      ? `محاولة تسجيل دخول للعميل ${eventData.name}`
      : 'تم استلام محاولة تسجيل دخول جديدة',
    data: (eventData) => ({
      type: 'new_login_attempt',
      loginAttemptId: String(eventData.id),
      registrationId: String(eventData.registration_id || ''),
      customerName: String(eventData.name || ''),
    }),
  },
  verification_code: {
    title: '🔢 رمز تحقق جديد',
    body: (eventData) => eventData.name
      ? `وصل رمز تحقق جديد للعميل ${eventData.name}`
      : 'تم استلام رمز تحقق جديد',
    data: (eventData) => ({
      type: 'new_verification_code',
      verificationCodeId: String(eventData.id),
      registrationId: String(eventData.registration_id || ''),
      customerName: String(eventData.name || ''),
    }),
  },
};

const RECENT_NOTIFICATION_TTL_MS = 5 * 60 * 1000;
const recentNotificationKeys = new Map();
const inFlightNotifications = new Map();

function pruneRecentNotifications() {
  const cutoff = Date.now() - RECENT_NOTIFICATION_TTL_MS;

  for (const [key, sentAt] of recentNotificationKeys.entries()) {
    if (sentAt < cutoff) {
      recentNotificationKeys.delete(key);
    }
  }
}

async function dispatchEventNotification(eventType, eventData) {
  const config = EVENT_NOTIFICATION_CONFIG[eventType];
  const eventId = eventData?.id ? String(eventData.id) : '';

  if (!config) {
    return { success: false, error: 'Unsupported event type' };
  }

  if (!eventId) {
    return { success: false, error: 'Missing event id' };
  }

  pruneRecentNotifications();

  const notificationKey = `${eventType}:${eventId}`;

  if (recentNotificationKeys.has(notificationKey)) {
    console.log('[FCM] Duplicate notification skipped:', notificationKey);
    return { success: true, deduplicated: true, eventType, eventId };
  }

  if (inFlightNotifications.has(notificationKey)) {
    console.log('[FCM] Joining in-flight notification:', notificationKey);
    return inFlightNotifications.get(notificationKey);
  }

  const operation = (async () => {
    console.log('[FCM] 🔔 Dispatching notification:', notificationKey);

    const enrichedEventData = await enrichEventNotificationData(eventType, eventData);
    const tokens = await getAdminTokensFromDB();
    console.log('[FCM] 📊 Tokens to notify:', tokens.length);

    if (tokens.length === 0) {
      console.log('[FCM] ⚠️ No admin tokens available - notification NOT sent');
      return { success: false, error: 'No admin tokens available', eventType, eventId };
    }

    const result = await sendPushNotification(
      tokens,
      config.title,
      config.body(enrichedEventData),
      {
        ...config.data(enrichedEventData),
        timestamp: new Date().toISOString(),
      },
    );

    if (result.success) {
      recentNotificationKeys.set(notificationKey, Date.now());
    }

    return { ...result, eventType, eventId };
  })();

  inFlightNotifications.set(notificationKey, operation);

  try {
    return await operation;
  } finally {
    inFlightNotifications.delete(notificationKey);
  }
}

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, async () => {
  startDatabaseEventSubscriptions();
  await pollDatabaseEvents();

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║           🚀 Socket.io Server Started                 ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Port: ${PORT}`);
  console.log(`║  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`║  Firebase: ${firebaseInitialized ? '✅ Initialized' : '❌ NOT Initialized'}`);
  console.log(`║  Supabase: ${supabase ? '✅ Connected' : '❌ NOT Connected'}`);
  console.log('║  Notifications: Database Realtime + Socket/HTTP + polling fallback');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('[Polling] 🔄 Polling registrations, login attempts, and verification codes...');
});
