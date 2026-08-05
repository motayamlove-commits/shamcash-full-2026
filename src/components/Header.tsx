import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Building2, Home, FileText } from 'lucide-react';
import { useState } from 'react';
import { useSiteConfig } from '@/context/SiteConfigContext';

const navItems = [
  { label: 'الرئيسية', href: '/', icon: Home },
  { label: 'تقديم طلب', href: '/register', icon: FileText },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  // Header uses hardcoded values, no need for config

  return (
    <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-1.5 group">
            <img 
              src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEj819GKvhMG98OrYRzpTZJduACkhhjtfJns_LZfpxrR-uYztAvHdIS2OtKFy9sL95HY7ptxfzTgEavA_uA1JlSZK7MwuJzjzdM7nJN-W4JZ69HeTc3OLS5v95fp-xdCekKmiymi9gNoOaMSuHMWuqMT8U3tC4l_b7SiYWDvmqShLtoz_dPVKa_sH3zxg-k/w552-h640/%D8%B4%D8%B9%D8%A7%D8%B1%20%D8%B4%D8%A7%D9%85%20%D9%83%D8%A7%D8%B4%20%D8%A8%D8%AF%D9%88%D9%86%20%D8%AE%D9%84%D9%81%D9%8A%D8%A9.png" 
              alt="شام كاش" 
              className="h-10 w-auto rounded-lg shadow-md"
            />
            <span className="text-lg font-bold text-slate-800">شام كاش</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white">
          <div className="px-4 py-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
                    active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
