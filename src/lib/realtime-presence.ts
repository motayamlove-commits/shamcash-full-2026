import { ref, set, onValue, onDisconnect, serverTimestamp, remove, update, get } from 'firebase/database';
import { rtdb } from './firebase-config';

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export type OnlineUser = {
  clientId: string;
  page: string;
  online: boolean;
  lastSeen: number;
  userId?: string;
  name?: string;
};

// ═══════════════════════════════════════════════════════════
// PRESENCE TRACKING
// ═══════════════════════════════════════════════════════════

const PRESENCE_PATH = 'presence';

/**
 * Get the presence reference for a client
 */
const getPresenceRef = (clientId: string) => ref(rtdb, `${PRESENCE_PATH}/${clientId}`);

/**
 * Get the all presence reference
 */
const getAllPresenceRef = () => ref(rtdb, PRESENCE_PATH);

/**
 * Set user as online with page info
 */
export const setUserOnline = async (clientId: string, page: string, userId?: string, name?: string): Promise<void> => {
  if (!rtdb) return;
  
  const presenceRef = getPresenceRef(clientId);
  
  const userData: OnlineUser = {
    clientId,
    page,
    online: true,
    lastSeen: Date.now(),
  };
  
  // Only add userId and name if they are defined
  if (userId) userData.userId = userId;
  if (name) userData.name = name;
  
  await set(presenceRef, userData);
  
  // Set up disconnect handler - remove when user disconnects
  const disconnectRef = onDisconnect(presenceRef);
  await disconnectRef.remove();
};

/**
 * Update user's current page
 */
export const updateUserPage = async (clientId: string, page: string): Promise<void> => {
  if (!rtdb) return;
  
  const presenceRef = getPresenceRef(clientId);
  
  await update(presenceRef, {
    page,
    lastSeen: Date.now(),
    online: true,
  });
};

/**
 * Set user as offline
 */
export const setUserOffline = async (clientId: string): Promise<void> => {
  if (!rtdb) return;
  
  const presenceRef = getPresenceRef(clientId);
  await remove(presenceRef);
};

/**
 * Get all online users
 */
export const getOnlineUsers = async (): Promise<OnlineUser[]> => {
  if (!rtdb) return [];
  
  const presenceRef = getAllPresenceRef();
  const snapshot = await get(presenceRef);
  
  if (!snapshot.exists()) return [];
  
  const users: OnlineUser[] = [];
  snapshot.forEach((child) => {
    users.push(child.val() as OnlineUser);
  });
  
  return users;
};

/**
 * Subscribe to online users (realtime)
 */
export const subscribeToOnlineUsers = (callback: (users: OnlineUser[]) => void): (() => void) => {
  if (!rtdb) {
    callback([]);
    return () => {};
  }
  
  const presenceRef = getAllPresenceRef();
  
  const unsubscribe = onValue(presenceRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    
    const users: OnlineUser[] = [];
    snapshot.forEach((child) => {
      const user = child.val() as OnlineUser;
      // Only include users seen in the last 30 seconds
      if (Date.now() - user.lastSeen < 30000) {
        users.push(user);
      }
    });
    
    callback(users);
  });
  
  return unsubscribe;
};

/**
 * Subscribe to specific user's presence
 */
export const subscribeToUserPresence = (
  clientId: string,
  callback: (user: OnlineUser | null) => void
): (() => void) => {
  if (!rtdb) {
    callback(null);
    return () => {};
  }
  
  const presenceRef = getPresenceRef(clientId);
  
  const unsubscribe = onValue(presenceRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    
    callback(snapshot.val() as OnlineUser);
  });
  
  return unsubscribe;
};

/**
 * Clean up stale presence data (older than 30 seconds)
 */
export const cleanupStalePresence = async (): Promise<void> => {
  if (!rtdb) return;
  
  const presenceRef = getAllPresenceRef();
  const snapshot = await get(presenceRef);
  
  if (!snapshot.exists()) return;
  
  const now = Date.now();
  const updates: Record<string, null> = {};
  
  snapshot.forEach((child) => {
    const user = child.val() as OnlineUser;
    if (now - user.lastSeen > 30000) {
      updates[child.key as string] = null;
    }
  });
  
  if (Object.keys(updates).length > 0) {
    await update(presenceRef, updates);
  }
};

// ═══════════════════════════════════════════════════════════
// PRESENCE HEARTBEAT
// ═══════════════════════════════════════════════════════════

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let currentClientId: string | null = null;

/**
 * Start sending heartbeat to keep user online
 */
export const startHeartbeat = (clientId: string, page: string): void => {
  stopHeartbeat();
  currentClientId = clientId;
  
  // Send heartbeat every 10 seconds
  heartbeatInterval = setInterval(async () => {
    if (currentClientId) {
      await updateUserPage(currentClientId, page);
    }
  }, 10000);
};

/**
 * Stop heartbeat
 */
export const stopHeartbeat = (): void => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  
  if (currentClientId) {
    setUserOffline(currentClientId).catch(console.error);
    currentClientId = null;
  }
};

// ═══════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Get page display name from path
 */
export const getPageDisplayName = (path: string): string => {
  const pageNames: Record<string, string> = {
    '/': 'الصفحة الرئيسية',
    '/register': 'تسجيل جديد',
    '/login': 'تسجيل الدخول',
    '/verify': 'التحقق من الهاتف',
    '/waiting': 'انتظار الموافقة',
    '/verify-waiting': 'انتظار التحقق',
    '/thank-you': 'شكراً',
  };
  
  return pageNames[path] || path;
};

/**
 * Count users on each page
 */
export const getPageCounts = (users: OnlineUser[]): Record<string, number> => {
  const counts: Record<string, number> = {};
  
  users.forEach(user => {
    const page = user.page || '/';
    counts[page] = (counts[page] || 0) + 1;
  });
  
  return counts;
};
