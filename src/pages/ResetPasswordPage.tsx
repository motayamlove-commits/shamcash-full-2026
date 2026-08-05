import { Lock, Headphones } from 'lucide-react';

const Logo = () => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[70px] h-[70px]">
    <path d="M20 30 L50 10 L80 30 L50 50 Z" fill="#4c72b8"/>
    <path d="M20 70 L50 50 L80 70 L50 90 Z" fill="#2a9d8f"/>
  </svg>
);

const PowerLogo = () => (
  <svg viewBox="0 0 100 100" fill="none" stroke="#6c7a9c" strokeWidth="8" className="w-[30px] h-[30px]">
    <polygon points="50,10 90,30 90,70 50,90 10,70 10,30"/>
  </svg>
);

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen w-full bg-[#101935] flex flex-col justify-between p-5" dir="rtl">
      <div className="top-bar w-full flex justify-between items-center text-[#8d99ae] text-sm">
        <span>الإنكليزية</span>
        <Headphones className="w-5 h-5 cursor-pointer" />
      </div>

      <div className="content-wrapper w-full max-w-[380px] mx-auto flex flex-col items-center my-auto">
        <div className="logo mb-6">
          <Logo />
        </div>

        <div className="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center mb-6">
          <Lock className="w-10 h-10 text-[#4c72b8]" />
        </div>

        <h1 className="text-2xl font-bold mb-3 text-center text-white">تعيين كلمة مرور جديدة</h1>
        <p className="text-sm text-center text-[#8d99ae] mb-8 leading-relaxed">
          تمت الموافقة على طلبك. يرجى إدخال كلمة المرور الجديدة الخاصة بك أدناه.
        </p>
        
        <div className="w-full p-4 bg-slate-800/50 rounded-xl border border-slate-700 text-center text-slate-400 text-sm">
          قيد التطوير... سيتم تفعيل نموذج تغيير كلمة المرور قريباً.
        </div>
      </div>

      <div className="footer flex flex-col items-center text-[#6c7a9c] text-xs gap-1">
        <span>POWERED BY</span>
        <PowerLogo />
        <span>احدث اصدار</span>
      </div>
    </div>
  );
}
