import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Home, Star } from 'lucide-react';
import { useSiteConfig } from '@/context/SiteConfigContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function ThankYouPage() {
  const navigate = useNavigate();
  const { config } = useSiteConfig();
  const pg = config.thank_you;

  useEffect(() => {
    sessionStorage.removeItem('reg_id');
    sessionStorage.removeItem('reg_email');
    sessionStorage.removeItem('ver_code');
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-lg text-center">
          <div className="relative inline-flex mb-8">
            <div className="w-28 h-28 bg-green-100 rounded-full flex items-center justify-center animate-pulse">
              <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-xl">
                <CheckCircle className="w-12 h-12 text-white" strokeWidth={2.5} />
              </div>
            </div>
            {['-top-2 -right-2', '-top-2 -left-2', '-bottom-2 -right-2', '-bottom-2 -left-2'].map((pos) => (
              <div key={pos} className={`absolute ${pos} w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center shadow`}>
                <Star className="w-3 h-3 text-white fill-white" />
              </div>
            ))}
          </div>

          <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-8 sm:p-12 space-y-5">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-800">{pg.title}</h1>
            <div className="space-y-2">
              <p className="text-xl font-bold text-green-600">{pg.success_text}</p>
              <p className="text-slate-500 leading-relaxed max-w-md mx-auto">{pg.message}</p>
            </div>

            <div className="grid grid-cols-3 gap-4 my-6">
              {[{value:'✓',label:'تم الاستلام'},{value:'24h',label:'وقت المراجعة'},{value:'100%',label:'بيانات آمنة'}].map((item)=>(
                <div key={item.label} className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-extrabold text-blue-600">{item.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">{item.label}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button onClick={() => navigate('/')}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-600 text-white font-bold px-6 py-3.5 rounded-xl shadow-md hover:bg-blue-700 transition-all">
                <Home className="w-4 h-4" />{pg.button_text}
              </button>
              <button onClick={() => navigate('/register')}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-slate-100 text-slate-700 font-semibold px-6 py-3.5 rounded-xl hover:bg-slate-200 transition-all">
                {pg.button2_text}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
            {['بيانات التمويل', 'الدخول', 'التحقق', 'استلام الطلب'].map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <div className="px-3 py-1.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">{step}</div>
                {i < 3 && <div className="w-4 h-px bg-green-300 hidden sm:block" />}
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
