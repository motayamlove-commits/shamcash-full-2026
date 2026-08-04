import { io, Socket } from 'socket.io-client';
import { getClientId } from './clientId';

// Socket.io server URL - configurable via environment variable
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

// Types
export type SocketUser = {
  clientId: string;
  page: string;
  online: boolean;
  lastSeen: string;
};

export type NotificationEventType = 'registration' | 'login_attempt' | 'verification_code';

export type NotificationEventData = {
  id: string;
  name?: string;
  registration_id?: string | null;
  created_at?: string;
};

export type NotificationDispatchResult = {
  success: boolean;
  deduplicated?: boolean;
  error?: string;
};

type UsersUpdateCallback = (users: SocketUser[]) => void;

// Socket instance
let socket: Socket | null = null;
let currentPage: string = '';
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let listeners: UsersUpdateCallback[] = [];

// Get page name in Arabic
const PAGE_NAMES: Record<string, string> = {
  '/': 'الصفحة الرئيسية',
  '/register': 'صفحة التسجيل',
  '/login': 'صفحة الدخول',
  '/verify': 'صفحة التحقق',
  '/thank-you': 'صفحة الشكر',
  '/waiting': 'صفحة الانتظار',
  '/verify-waiting': 'صفحة انتظار التحقق',
};

export function getPageDisplayName(pageKey: string): string {
  return PAGE_NAMES[pageKey] || pageKey || '';
}

// Initialize Socket connection
export function initSocket(page: string = '/'): void {
  // If already connected, just update page
  if (socket?.connected) {
    updatePage(page);
    return;
  }

  const clientId = getClientId();
  if (!clientId) {
    console.warn('No client ID available for socket connection');
    return;
  }

  currentPage = page;

  // Connect to Socket.io server
  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('🔌 Socket connected');
    
    // Send online event
    socket?.emit('user_online', {
      clientId,
      page: currentPage,
    });

    // Start heartbeat
    startHeartbeat();
  });

  socket.on('disconnect', () => {
    console.log('🔴 Socket disconnected');
    stopHeartbeat();
  });

  socket.on('connect_error', (error) => {
    console.warn('Socket connection error:', error.message);
  });

  // Listen for users update
  socket.on('users_update', (users: SocketUser[]) => {
    console.log('📡 Users update received:', users.length);
    
    // Notify all listeners
    listeners.forEach(callback => callback(users));
  });
}

// Update current page
export function updatePage(page: string): void {
  const clientId = getClientId();
  if (!clientId || !socket?.connected) return;

  currentPage = page;
  
  socket.emit('user_page_change', {
    clientId,
    page,
  });
}

// Start heartbeat to keep connection alive
function startHeartbeat(): void {
  stopHeartbeat();
  
  heartbeatInterval = setInterval(() => {
    const clientId = getClientId();
    if (!clientId || !socket?.connected) return;

    socket.emit('user_heartbeat', { clientId });
  }, 10000); // Every 10 seconds
}

// Stop heartbeat
function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// Disconnect socket
export function disconnectSocket(): void {
  const clientId = getClientId();
  
  stopHeartbeat();

  if (socket?.connected && clientId) {
    socket.emit('user_offline', { clientId });
  }

  socket?.disconnect();
  socket = null;
}

// Subscribe to users update
export function onUsersUpdate(callback: UsersUpdateCallback): () => void {
  listeners.push(callback);
  
  // Return unsubscribe function
  return () => {
    listeners = listeners.filter(l => l !== callback);
  };
}

// Get all online users
export function getOnlineUsers(): Promise<SocketUser[]> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve([]);
      return;
    }

    // The users are received via 'users_update' event
    // For now, we'll create a one-time listener
    const timeout = setTimeout(() => {
      socket?.off('users_update', handler);
      resolve([]);
    }, 1000);

    const handler = (users: SocketUser[]) => {
      clearTimeout(timeout);
      socket?.off('users_update', handler);
      resolve(users);
    };

    socket.on('users_update', handler);
  });
}

// Check if socket is connected
export function isSocketConnected(): boolean {
  return socket?.connected || false;
}

const NOTIFICATION_EVENT_NAMES: Record<NotificationEventType, string> = {
  registration: 'registration_completed',
  login_attempt: 'login_attempt_completed',
  verification_code: 'verification_code_completed',
};

const NOTIFICATION_TIMEOUT_MS = 6000;

function sanitizeNotificationData(
  eventType: NotificationEventType,
  eventData: NotificationEventData,
): NotificationEventData {
  const safeData: NotificationEventData = {
    id: String(eventData.id),
    created_at: eventData.created_at || new Date().toISOString(),
  };

  if (eventData.name) {
    safeData.name = String(eventData.name);
  }

  if (eventData.registration_id && eventType !== 'registration') {
    safeData.registration_id = String(eventData.registration_id);
  }

  return safeData;
}

function emitNotificationWithAcknowledgement(
  eventName: string,
  eventData: NotificationEventData,
): Promise<NotificationDispatchResult> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ success: false, error: 'Socket is not connected' });
      return;
    }

    let settled = false;
    const timeout = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve({ success: false, error: 'Socket acknowledgement timed out' });
      }
    }, NOTIFICATION_TIMEOUT_MS);

    socket.emit(eventName, eventData, (result: NotificationDispatchResult) => {
      if (settled) return;

      settled = true;
      window.clearTimeout(timeout);
      resolve(result || { success: false, error: 'Empty Socket acknowledgement' });
    });
  });
}

async function sendNotificationHttpFallback(
  eventType: NotificationEventType,
  eventData: NotificationEventData,
): Promise<NotificationDispatchResult> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), NOTIFICATION_TIMEOUT_MS);

  try {
    const response = await fetch(`${SOCKET_URL.replace(/\/$/, '')}/api/notify-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ eventType, eventData }),
      signal: controller.signal,
    });

    const result = await response.json().catch(() => null) as NotificationDispatchResult | null;

    if (!response.ok) {
      return {
        success: false,
        error: result?.error || `HTTP fallback failed with status ${response.status}`,
      };
    }

    return result || { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'HTTP fallback failed',
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function emitInstantNotification(
  eventType: NotificationEventType,
  eventData: NotificationEventData,
): Promise<NotificationDispatchResult> {
  const safeData = sanitizeNotificationData(eventType, eventData);
  const eventName = NOTIFICATION_EVENT_NAMES[eventType];

  if (socket?.connected) {
    const socketResult = await emitNotificationWithAcknowledgement(eventName, safeData);

    if (socketResult.success || socketResult.deduplicated) {
      return socketResult;
    }

    console.warn('[Notifications] Socket delivery failed, trying HTTP fallback:', socketResult.error);
  }

  const httpResult = await sendNotificationHttpFallback(eventType, safeData);

  if (!httpResult.success && !httpResult.deduplicated) {
    console.warn('[Notifications] Instant notification delivery failed:', httpResult.error);
  }

  return httpResult;
}
