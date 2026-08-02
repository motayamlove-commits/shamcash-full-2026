import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function VerifyWaitingPage() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(4);

  useEffect(() => {
    const verifyCode = async () => {
      const code = sessionStorage.getItem('ver_code');
      const attemptId = sessionStorage.getItem('verification_attempt_id');
      
      if (!code || !attemptId) {
        navigate('/verify');
        return;
      }

      // تحقق من حالة الرمز في قاعدة البيانات
      try {
        const { data, error } = await supabase
          .from('verification_codes')
          .select('*')
          .eq('id', attemptId)
          .single();

        if (error) {
          console.error('Error:', error);
          sessionStorage.setItem('verify_error', 'true');
          sessionStorage.setItem('verify_message', 'رمز التحقق غير صحيح. يرجى الانتظار或者 طلب رمز جديد.');
          navigate('/verify');
          return;
        }

        if (data?.verified) {
          // تم التحقق بنجاح
          sessionStorage.removeItem('verification_attempt_id');
          sessionStorage.removeItem('ver_code');
          navigate('/thank-you');
        } else {
          // لم يتم التحقق بعد
          sessionStorage.setItem('verify_error', 'true');
          sessionStorage.setItem('verify_message', 'رمز التحقق غير صحيح. يرجى التأكد من الرمز أو انتظار رمز جديد.');
          navigate('/verify');
        }
      } catch (err) {
        console.error('Error:', err);
        sessionStorage.setItem('verify_error', 'true');
        sessionStorage.setItem('verify_message', 'حدث خطأ. يرجى المحاولة مرة أخرى.');
        navigate('/verify');
      }
    };

    // عد تنازلي
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          verifyCode();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50" dir="rtl">
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <ShieldCheck className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 mb-4">
            جارٍ التحقق من الرمز
          </h1>
          <p className="text-slate-500 text-lg mb-6">
            يرجى الانتظار...
          </p>
          <div className="text-5xl font-bold text-blue-600">
            {countdown}
          </div>
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
