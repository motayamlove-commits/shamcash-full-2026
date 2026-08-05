/*
 * Service Worker for Sham Cash PWA and Firebase Cloud Messaging.
 * CACHING DISABLED - All requests go directly to server.
 */

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

  messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background FCM message received:', payload.data?.type || 'unknown');
  });

  console.log('[SW] Firebase Messaging initialized');
} catch (error) {
  console.warn('[SW] Firebase Messaging not available:', error);
}

// CACHING DISABLED - No caching, all requests go to server
self.addEventListener('fetch', (event) => {
  // Let all requests pass through to the network
  // No caching at all - always get latest version from server
  return;
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker');
  event.waitUntil(self.skipWaiting());
});

console.log('[SW] PWA + FCM service worker loaded (CACHING DISABLED)');
