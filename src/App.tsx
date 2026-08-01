import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SiteConfigProvider } from '@/context/SiteConfigContext';
import HomePage from '@/pages/HomePage';
import RegisterPage from '@/pages/RegisterPage';
import LoginPage from '@/pages/LoginPage';
import VerifyPage from '@/pages/VerifyPage';
import ThankYouPage from '@/pages/ThankYouPage';
import AdminPage from '@/pages/AdminPage';

export default function App() {
  return (
    <SiteConfigProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/thank-you" element={<ThankYouPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </BrowserRouter>
    </SiteConfigProvider>
  );
}
