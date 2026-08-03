import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { initSocket, disconnectSocket } from '@/lib/socket';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function WaitingPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'waiting' | 'approved' | 'rejected'>('waiting');
  const [dots, setDots] = useState('');

  // Socket.io connection
  useEffect(() => {
    initSocket('/waiting');
    
    return () => {
      disconnectSocket();
    };
  }, []);

  useEffect(() => {
    const attemptId = sessionStorage.getItem('login_attempt_id');
    
    if (!attemptId) {
      navigate('/login');
      return;
    }

    // إضافة نقاط متحركة
    const dotsInterval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);

    // التحقق من حالة المحاولة كل ثانية
    const checkStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('login_attempts')
          .select('status')
          .eq('id', attemptId)
          .single();

        if (error) {
          console.error('Error checking status:', error);
          return;
        }

        if (data?.status === 'approved') {
          setStatus('approved');
          clearInterval(dotsInterval);
          sessionStorage.removeItem('login_attempt_id');
          setTimeout(() => navigate('/verify'), 1500);
        } else if (data?.status === 'rejected') {
          setStatus('rejected');
          clearInterval(dotsInterval);
          sessionStorage.removeItem('login_attempt_id');
          sessionStorage.setItem('login_rejected', 'true');
          setTimeout(() => navigate('/login'), 2000);
        }
      } catch (err) {
        console.error('Error:', err);
      }
    };

    const statusInterval = setInterval(checkStatus, 1000);
    checkStatus(); // تحقق فوري

    return () => {
      clearInterval(dotsInterval);
      clearInterval(statusInterval);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50" dir="rtl">
      <Header />
      <main className="flex-1 flex items-center justify-center py-10 px-4 sm:px-6">
        <div className="w-full max-w-md text-center">
          {status === 'waiting' && (
            <>
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                <Clock className="w-10 h-10 text-blue-600" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 mb-4">
                جارٍ التحقق من البيانات{dots}
              </h1>
              <p className="text-slate-500 text-lg">
                يرجى الانتظار حتى يتم مراجعة طلبك من قبل المسؤول
              </p>
              <div className="mt-8 flex justify-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </>
          )}

          {status === 'approved' && (
            <>
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-green-700 mb-4">
                تمت الموافقة
              </h1>
              <p className="text-slate-500 text-lg">
                جارٍ التحويل إلى صفحة التحقق...
              </p>
            </>
          )}

          {status === 'rejected' && (
            <>
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-10 h-10 text-red-600" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-red-700 mb-4">
                تم الرفض
              </h1>
              <p className="text-slate-500 text-lg">
                جارٍ إعادتك إلى صفحة تسجيل الدخول...
              </p>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
