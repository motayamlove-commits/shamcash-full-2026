/**
 * Firebase Messaging Service Worker
 * Sham Cash - Push Notifications System
 */

// Import Firebase SDKs from CDN
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Firebase configuration - loaded from environment at runtime
const firebaseConfig = {
  apiKey: 'AIzaSyB9StmQjkqgKPMhsVZq4eg85AUUxwuFp28',
  authDomain: 'shamcash-661df.firebaseapp.com',
  projectId: 'shamcash-661df',
  storageBucket: 'shamcash-661df.firebasestorage.app',
  messagingSenderId: '622772155097',
  appId: '1:622772155097:web:26fbb6ea065feadd1884c8',
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get Messaging instance
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[FCM SW] Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'إشعار جديد من شام كاش';
  const notificationOptions = {
    body: payload.notification?.body || 'لديك إشعار جديد',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: payload.data?.tag || 'default',
    data: payload.data,
    dir: 'rtl',
    lang: 'ar',
    vibrate: [200, 100, 200],
    requireInteraction: true,
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[FCM SW] Notification clicked:', event);
  
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/admin';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/admin') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

console.log('[FCM SW] Service Worker loaded successfully');
