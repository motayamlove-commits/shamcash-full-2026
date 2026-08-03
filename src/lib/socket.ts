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
