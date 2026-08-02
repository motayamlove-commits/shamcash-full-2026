import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SiteConfigProvider } from '@/context/SiteConfigContext';
import { AdminAuthProvider, useAdminAuth } from '@/context/AdminAuthContext';
import { initClientId } from '@/lib/clientId';
import HomePage from '@/pages/HomePage';
import RegisterPage from '@/pages/RegisterPage';
import LoginPage from '@/pages/LoginPage';
import VerifyPage from '@/pages/VerifyPage';
import ThankYouPage from '@/pages/ThankYouPage';
import WaitingPage from '@/pages/WaitingPage';
import VerifyWaitingPage from '@/pages/VerifyWaitingPage';
import AdminPage from '@/pages/AdminPage';
import AdminLoginPage from '@/pages/AdminLoginPage';

// Protected Route Component for Admin
function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAdminAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/adminlogin" replace />;
  }

  return <>{children}</>;
}

// Redirect authenticated admin from login page
function AdminLoginRedirect({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAdminAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  // Initialize client ID on app load
  useEffect(() => {
    const clientId = initClientId();
    // Don't log client ID to console for security
  }, []);

  return (
    <SiteConfigProvider>
      <AdminAuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Client Pages */}
            <Route path="/" element={<HomePage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/verify" element={<VerifyPage />} />
            <Route path="/thank-you" element={<ThankYouPage />} />
            <Route path="/waiting" element={<WaitingPage />} />
            <Route path="/verify-waiting" element={<VerifyWaitingPage />} />
            
            {/* Admin Pages - Protected */}
            <Route 
              path="/admin" 
              element={
                <ProtectedAdminRoute>
                  <AdminPage />
                </ProtectedAdminRoute>
              } 
            />
            <Route 
              path="/adminlogin" 
              element={
                <AdminLoginRedirect>
                  <AdminLoginPage />
                </AdminLoginRedirect>
              } 
            />
          </Routes>
        </BrowserRouter>
      </AdminAuthProvider>
    </SiteConfigProvider>
  );
}
