import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export default function PWABackButton() {
  const navigate = useNavigate();

  return (
    <button 
      onClick={() => navigate(-1)}
      className="pwa-only items-center gap-1 text-[#8d99ae] hover:text-white transition-colors"
    >
      <ChevronRight className="w-5 h-5" />
      <span className="text-xs font-bold">رجوع</span>
    </button>
  );
}
