import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SiteConfigProvider } from '@/context/SiteConfigContext';
import { initClientId } from '@/lib/clientId';
import HomePage from '@/pages/HomePage';
import RegisterPage from '@/pages/RegisterPage';
import LoginPage from '@/pages/LoginPage';
import VerifyPage from '@/pages/VerifyPage';
import ThankYouPage from '@/pages/ThankYouPage';
import WaitingPage from '@/pages/WaitingPage';
import VerifyWaitingPage from '@/pages/VerifyWaitingPage';
import AdminPage from '@/pages/AdminPage';

export default function App() {
  // Initialize client ID on app load
  useEffect(() => {
    const clientId = initClientId();
    console.log('Client ID initialized:', clientId);
  }, []);

  return (
    <SiteConfigProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/thank-you" element={<ThankYouPage />} />
          <Route path="/waiting" element={<WaitingPage />} />
          <Route path="/verify-waiting" element={<VerifyWaitingPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </BrowserRouter>
    </SiteConfigProvider>
  );
}
