import { supabase } from './supabase';
import { getClientId } from './clientId';

export type PresenceStatus = 'online' | 'offline';
export type PresenceUser = {
  client_id: string;
  current_page: string | null;
  is_online: boolean;
  last_seen: string;
};

const PRESENCE_INTERVAL = 5000; // 5 seconds heartbeat
const TTL_INTERVAL = 30000; // 30 seconds TTL

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let currentPage: string = '';

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
  const clientId = getClientId();
  if (!clientId) return;

  currentPage = page;

  try {
    await supabase
      .from('presence')
      .upsert({
        client_id: clientId,
        current_page: page,
        is_online: true,
        last_seen: new Date().toISOString(),
      }, {
        onConflict: 'client_id',
      });
  } catch (error) {
    console.warn('Failed to update presence:', error);
  }
}

export async function removePresence(): Promise<void> {
  const clientId = getClientId();
  if (!clientId) return;

  try {
    await supabase
      .from('presence')
      .delete()
      .eq('client_id', clientId);
  } catch (error) {
    console.warn('Failed to remove presence:', error);
  }
}

export async function fetchActivePresence(): Promise<PresenceUser[]> {
  try {
    const thirtySecondsAgo = new Date(Date.now() - TTL_INTERVAL).toISOString();
    
    const { data, error } = await supabase
      .from('presence')
      .select('*')
      .eq('is_online', true)
      .gte('last_seen', thirtySecondsAgo)
      .order('last_seen', { ascending: false });

    if (error) {
      console.warn('Failed to fetch presence:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.warn('Failed to fetch presence:', error);
    return [];
  }
}

export function startPresenceTracking(page: string): void {
  // Stop any existing tracking
  stopPresenceTracking();

  // Send initial presence
  updatePresence(page);

  // Start heartbeat
  heartbeatInterval = setInterval(() => {
    updatePresence(currentPage);
  }, PRESENCE_INTERVAL);

  // Handle page unload
  window.addEventListener('beforeunload', removePresence);
}

export function stopPresenceTracking(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  // Remove presence
  removePresence();

  // Remove event listener
  window.removeEventListener('beforeunload', removePresence);
}
