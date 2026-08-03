import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { initSocket, disconnectSocket } from '@/lib/socket';

export default function VerifyWaitingPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  // Socket.io connection
  useEffect(() => {
    initSocket('/verify-waiting');
    
    return () => {
      disconnectSocket();
    };
  }, []);

  useEffect(() => {
    const attemptId = sessionStorage.getItem('verification_attempt_id');
    
    if (!attemptId) {
      navigate('/verify');
      return;
    }

    // الاشتراك في التحديثات المباشرة
    const channel = supabase
      .channel('verify-waiting-channel')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'verification_codes' 
      }, async (payload) => {
        if (payload.new.id === attemptId) {
          if (payload.new.status === 'approved') {
            // تم الموافقة
            sessionStorage.removeItem('verification_attempt_id');
            navigate('/thank-you');
          } else if (payload.new.status === 'rejected') {
            // تم الرفض
            sessionStorage.setItem('verify_error', 'true');
            sessionStorage.setItem('verify_message', 'تم رفض رمز التحقق. يرجى المحاولة مرة أخرى.');
            sessionStorage.removeItem('verification_attempt_id');
            navigate('/verify');
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50" dir="rtl">
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <ShieldCheck className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 mb-4">
            جارٍ التحقق
          </h1>
          <p className="text-slate-500 text-lg mb-6">
            يرجى الانتظار...
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
