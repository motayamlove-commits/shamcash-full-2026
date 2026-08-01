import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import AutoMigrator from './components/AutoMigrator';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AutoMigrator><App /></AutoMigrator>
  </StrictMode>,
);
