import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Clock, Shield, Users } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useSiteConfig } from '@/context/SiteConfigContext';

const stats = [
  { label: 'طلب تمويل مقدم', value: '+1200', icon: Users },
  { label: 'تم الموافقة', value: '98%', icon: CheckCircle },
  { label: 'متوسط وقت المعالجة', value: '24 ساعة', icon: Clock },
  { label: 'معيار الأمان', value: 'ISO 27001', icon: Shield },
];

const steps = [
  { step: '01', title: 'تقديم بيانات التمويل', desc: 'أدخل بياناتك ومعلومات التمويل المطلوب بدقة' },
  { step: '02', title: 'تسجيل الدخول', desc: 'سجّل بريدك الإلكتروني وكلمة المرور الخاصة بك' },
  { step: '03', title: 'التحقق من الهاتف', desc: 'أدخل رمز التحقق المرسل إلى هاتفك' },
  { step: '04', title: 'استلام الطلب', desc: 'تهانينا! تم استلام طلبك بنجاح وستتم مراجعته قريباً' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { config } = useSiteConfig();
  const h = config.home;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-white rounded-full translate-x-1/4 translate-y-1/4" />
          </div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div className="text-white space-y-6 order-2 md:order-1">
                <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  {h.badge_text}
                </div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight">
                  {h.hero_title}<br />
                  <span className="text-blue-200">{h.hero_title_highlight}</span>
                </h1>
                <p className="text-blue-100 text-base sm:text-lg leading-relaxed max-w-md">{h.hero_subtitle}</p>
                <div className="flex flex-col sm:flex-row gap-4 pt-2">
                  <button
                    onClick={() => navigate('/register')}
                    className="inline-flex items-center justify-center gap-2 bg-white text-blue-700 font-bold px-8 py-4 rounded-xl shadow-lg hover:bg-blue-50 hover:shadow-xl transform hover:-translate-y-0.5 transition-all text-base"
                  >
                    <span>{h.button_text}</span>
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="order-1 md:order-2 flex justify-center">
                <div className="relative w-full max-w-sm">
                  <div className="absolute inset-0 bg-white/10 rounded-3xl blur-2xl" />
                  <img
                    src={h.hero_image}
                    alt="تقديم طلب"
                    className="relative w-full h-64 sm:h-80 object-cover rounded-2xl shadow-2xl ring-4 ring-white/20"
                  />
                  
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="text-center space-y-2">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mx-auto">
                      <Icon className="w-6 h-6 text-blue-600" />
                    </div>
                    <p className="text-2xl font-extrabold text-slate-800">{stat.value}</p>
                    <p className="text-sm text-slate-500 font-medium">{stat.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Steps */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 mb-3">كيف يعمل النظام؟</h2>
            <p className="text-slate-500 max-w-xl mx-auto">أربع خطوات بسيطة لإرسال طلب التمويل والحصول على الموافقة</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((item) => (
              <div key={item.step} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-1 transition-all">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center font-extrabold text-lg mb-4 shadow-md">
                  {item.step}
                </div>
                <h3 className="font-bold text-slate-800 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 text-center">
            <button
              onClick={() => navigate('/register')}
              className="inline-flex items-center gap-2 bg-blue-600 text-white font-bold px-10 py-4 rounded-xl shadow-lg hover:bg-blue-700 hover:shadow-xl transform hover:-translate-y-0.5 transition-all text-base"
            >
              ابدأ الآن - {h.button_text}
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
