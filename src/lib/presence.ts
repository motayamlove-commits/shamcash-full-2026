import { getClientId } from './clientId';
import { rtdb } from './firebase-config';

export type PresenceStatus = 'online' | 'offline';
export type PresenceUser = {
  client_id: string;
  current_page: string | null;
  is_online: boolean;
  last_seen: string;
};

const PRESENCE_INTERVAL = 5000; // 5 seconds heartbeat
const TTL = 30000; // 30 seconds TTL

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let currentPage: string = '';
let userRef: any = null;

// Check if rtdb is available and has the ref method
const isRtdbAvailable = (): boolean => {
  return !!(rtdb && typeof (rtdb as any).ref === 'function');
};

// Map Arabic page keys to readable names
const PAGE_NAMES: Record<string, string> = {
  'التسجيل': 'صفحة التسجيل',
  'تسجيل الدخول': 'صفحة الدخول',
  'التحقق': 'صفحة التحقق',
  'الرئيسية': 'الصفحة الرئيسية',
  '/': 'الصفحة الرئيسية',
  '/register': 'صفحة التسجيل',
  '/login': 'صفحة الدخول',
  '/verify': 'صفحة التحقق',
  '/thank-you': 'صفحة الشكر',
  '/admin': 'لوحة الإدارة',
};

export function getPageName(pageKey: string): string {
  return PAGE_NAMES[pageKey] || pageKey || '';
}

export async function updatePresence(page: string): Promise<void> {
  if (!isRtdbAvailable()) return;
  
  const clientId = getClientId();
  if (!clientId) return;

  currentPage = page;

  try {
    userRef = (rtdb as any).ref(`presence/${clientId}`);
    await userRef.set({
      current_page: page,
      is_online: true,
      last_seen: Date.now(),
    });
    
    // Auto-remove after TTL
    setTimeout(async () => {
      try {
        const snapshot = await userRef.once('value');
        const data = snapshot?.val();
        if (data && Date.now() - data.last_seen > TTL) {
          await userRef.remove();
        }
      } catch {
        // Ignore cleanup errors
      }
    }, TTL + 1000);
  } catch (error) {
    console.warn('Failed to update presence:', error);
  }
}

export async function removePresence(): Promise<void> {
  if (!isRtdbAvailable()) return;
  
  const clientId = getClientId();
  if (!clientId) return;

  try {
    await (rtdb as any).ref(`presence/${clientId}`).remove();
  } catch (error) {
    console.warn('Failed to remove presence:', error);
  }
}

export async function fetchActivePresence(): Promise<PresenceUser[]> {
  if (!isRtdbAvailable()) return [];

  try {
    const snapshot = await (rtdb as any).ref('presence').once('value');
    const allPresence = snapshot.val() || {};
    const now = Date.now();
    
    const users: PresenceUser[] = [];
    
    for (const [clientId, data] of Object.entries(allPresence)) {
      const presence = data as any;
      if (presence.is_online && now - presence.last_seen < TTL) {
        users.push({
          client_id: clientId,
          current_page: presence.current_page,
          is_online: presence.is_online,
          last_seen: new Date(presence.last_seen).toISOString(),
        });
      }
    }

    return users.sort((a, b) => 
      new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime()
    );
  } catch (error) {
    console.warn('Failed to fetch presence:', error);
    return [];
  }
}

export function startPresenceTracking(page: string): void {
  if (!isRtdbAvailable()) return;
  
  stopPresenceTracking();
  updatePresence(page);
  
  heartbeatInterval = setInterval(() => {
    updatePresence(currentPage);
  }, PRESENCE_INTERVAL);

  window.addEventListener('beforeunload', removePresence);
}

export function stopPresenceTracking(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  removePresence();
  window.removeEventListener('beforeunload', removePresence);
}
