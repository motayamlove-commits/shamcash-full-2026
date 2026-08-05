/*
 * Unified Service Worker for Sham Cash PWA and Firebase Cloud Messaging.
 * This is the only service worker registered for the root scope.
 */

const CACHE_NAME = 'sham-cash-v2-unified-fcm';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

function resolveNotificationUrl(notificationData = {}) {
  const fcmMessage = notificationData.FCM_MSG || {};

  return notificationData.url
    || notificationData.click_action
    || fcmMessage.fcmOptions?.link
    || fcmMessage.data?.url
    || fcmMessage.data?.click_action
    || '/admin';
}

// Firebase requires a custom click handler to be registered before its scripts
// are imported; otherwise Firebase may replace the custom behavior.
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const rawTargetUrl = resolveNotificationUrl(event.notification.data);
  const targetUrl = new URL(rawTargetUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(async (clientList) => {
        const existingClient = clientList.find((client) => {
          return new URL(client.url).origin === self.location.origin;
        });

        if (existingClient) {
          if ('navigate' in existingClient) {
            await existingClient.navigate(targetUrl);
          }

          if ('focus' in existingClient) {
            return existingClient.focus();
          }
        }

        return self.clients.openWindow(targetUrl);
      }),
  );
});

self.addEventListener('notificationclose', () => {
  console.log('[SW] Notification closed');
});

// Use the compat SDK because this public service worker is served without a
// JavaScript bundling step.
importScripts('https://www.gstatic.com/firebasejs/12.17.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.17.0/firebase-messaging-compat.js');

try {
  firebase.initializeApp({
    apiKey: 'AIzaSyDP3Ap-vyUxOVrXXiDJckm99ZtZFSaoaIM',
    authDomain: 'shamnew-3ff53.firebaseapp.com',
    projectId: 'shamnew-3ff53',
    storageBucket: 'shamnew-3ff53.firebasestorage.app',
    messagingSenderId: '373411273175',
    appId: '1:373411273175:web:0b341757c3f0aeb4429392',
  });

  const messaging = firebase.messaging();

  // The server sends notification + data payloads. Firebase displays those
  // notifications automatically in the background, so this callback must not
  // call showNotification again or the user could receive a duplicate.
  messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background FCM message received:', payload.data?.type || 'unknown');
  });
  
  console.log('[SW] Firebase Messaging initialized');
} catch (error) {
  console.warn('[SW] Firebase Messaging not available:', error);
}

self.addEventListener('install', (event) => {
  console.log('[SW] Installing unified service worker');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating unified service worker');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }

            return false;
          }),
        );
      })
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  // Cache API supports GET requests only. Cross-origin requests such as
  // Supabase, Socket.IO, Firebase, and Railway must pass through untouched.
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const responseToCache = response.clone();
            void caches.open(CACHE_NAME)
              .then((cache) => cache.put('/index.html', responseToCache));
          }

          return response;
        })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const responseToCache = response.clone();
          void caches.open(CACHE_NAME)
            .then((cache) => cache.put(event.request, responseToCache));
        }

        return response;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        return cachedResponse || new Response('Offline', { status: 503 });
      }),
  );
});

// Handle skip waiting message from main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[SW] Unified PWA + FCM service worker loaded');
