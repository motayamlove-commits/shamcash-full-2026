import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSiteConfig } from '@/context/SiteConfigContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function VerifyPage() {
  const navigate = useNavigate();
  const { config } = useSiteConfig();
  const pg = config.verify;

  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [length, setLength] = useState(6);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const regId = sessionStorage.getItem('reg_id');
  const expectedCode = sessionStorage.getItem('ver_code');

  useEffect(() => { if (!regId) navigate('/register'); inputRefs.current[0]?.focus(); }, [regId, navigate]);

  const handleLengthChange = (n: number) => {
    setLength(n); setDigits(Array(n).fill('')); setError('');
    setTimeout(() => inputRefs.current[0]?.focus(), 50);
  };

  const handleInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const nd = [...digits.slice(0, length)];
    nd[index] = value.slice(-1);
    setDigits([...nd, ...Array(Math.max(0, length - nd.length)).fill('')]);
    setError('');
    if (value && index < length - 1) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) inputRefs.current[index - 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    const nd = Array(length).fill('');
    pasted.split('').forEach((ch, i) => { nd[i] = ch; });
    setDigits(nd);
    inputRefs.current[Math.min(pasted.length, length - 1)]?.focus();
  };

  const enteredCode = digits.slice(0, length).join('');
  const isComplete = enteredCode.length === length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isComplete) { setError('يرجى إدخال الرمز كاملاً'); return; }
    setLoading(true); setError('');
    if (!expectedCode || enteredCode !== expectedCode) { setLoading(false); setError('رمز التحقق غير صحيح. تأكد من الرمز وأعد المحاولة.'); return; }
    await supabase.from('verification_codes').update({ verified: true }).eq('registration_id', regId!);
    await supabase.from('registrations').update({ status: 'verified' }).eq('id', regId!);
    setLoading(false);
    sessionStorage.removeItem('ver_code');
    navigate('/thank-you');
  };

  const handleResend = async () => {
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    sessionStorage.setItem('ver_code', newCode);
    await supabase.from('verification_codes').insert({ registration_id: regId!, code: newCode });
    setDigits(Array(length).fill('')); setError('');
    alert(`رمز التحقق الجديد: ${newCode}`);
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
            {[{label:'البيانات',done:true},{label:'الدخول',done:true},{label:'التحقق',active:true},{label:'الإتمام',done:false}].map((step,i)=>(
              <div key={step.label} className="flex items-center gap-2">
                <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${step.done?'bg-green-100 text-green-700':step.active?'bg-blue-600 text-white':'bg-slate-200 text-slate-400'}`}>
                  {step.label}
                </div>
                {i<3&&<div className="w-4 h-px bg-slate-300 hidden sm:block"/>}
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
            <div className="mb-6">
              <p className="text-sm font-semibold text-slate-700 mb-3 text-center">اختر عدد أرقام الرمز</p>
              <div className="flex gap-2 justify-center">
                {[4, 5, 6, 8].map((n) => (
                  <button key={n} type="button" onClick={() => handleLengthChange(n)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${length===n?'border-blue-600 bg-blue-600 text-white shadow-md':'border-slate-200 text-slate-600 hover:border-blue-300'}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
                {Array.from({ length }).map((_, i) => (
                  <input key={i} ref={(el) => { inputRefs.current[i] = el; }}
                    type="text" inputMode="numeric" maxLength={1} value={digits[i]||''}
                    onChange={(e) => handleInput(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    className={`w-10 h-12 sm:w-12 sm:h-14 text-center text-lg font-bold border-2 rounded-xl focus:ring-2 focus:ring-blue-100 transition-all ltr ${digits[i]?'border-blue-500 bg-blue-50 text-blue-700':'border-slate-300 text-slate-800'}`}
                  />
                ))}
              </div>
              <p className="text-center text-xs text-slate-500">الحد الأدنى 4 أرقام — الحد الأقصى 8 أرقام</p>
              {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-medium text-center">{error}</div>}
              <button type="submit" disabled={loading||!isComplete}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-md flex items-center justify-center gap-2 text-base">
                {loading?<div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>:<><span>{pg.button_text}</span><ArrowLeft className="w-5 h-5"/></>}
              </button>
            </form>

            <div className="mt-5 text-center">
              <button onClick={handleResend} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors font-medium">
                <RefreshCw className="w-4 h-4" />{pg.resend_text}
              </button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
