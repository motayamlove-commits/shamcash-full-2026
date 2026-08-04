import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import AutoMigrator from './components/AutoMigrator';
import './index.css';

// Register the single PWA + Firebase Messaging service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      await registration.update();
      console.log('[App] Unified Service Worker registered:', registration.scope);
    } catch (error) {
      console.log('[App] Unified Service Worker registration failed:', error);
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AutoMigrator><App /></AutoMigrator>
  </StrictMode>,
);
