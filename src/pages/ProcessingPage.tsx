import { CheckCircle2, Clock, Headphones } from 'lucide-react';

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

export default function ProcessingPage() {
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
          <Logo />
        </div>

        {/* Success Icon */}
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" 
          style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)' }}>
          <CheckCircle2 className="w-10 h-10" style={{ color: '#22c55e' }} />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold mb-3 text-center" style={{ color: '#ffffff' }}>
          طلبك قيد المعالجة
        </h1>
        
        <p className="text-sm text-center mb-8 leading-relaxed" style={{ color: '#8d99ae' }}>
          يرجى الانتظار، سيتم التواصل معك من قبل فريق العمل في أقرب وقت ممكن.
        </p>

        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
          style={{ 
            backgroundColor: 'rgba(76, 114, 184, 0.1)', 
            border: '1px solid rgba(76, 114, 184, 0.2)',
            color: '#4c72b8'
          }}>
          <Clock className="w-5 h-5 animate-pulse" />
          <span>شكراً لثقتك بنا</span>
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
