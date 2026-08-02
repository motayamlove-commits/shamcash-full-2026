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
  const { config } = useSiteConfig();
  const h = config.header;

  return (
    <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md group-hover:bg-blue-700 transition-colors">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div className="hidden sm:block">
              <p className="text-base font-bold text-slate-800 leading-tight">{h.logo_text}</p>
              <p className="text-xs text-slate-500">{h.logo_subtitle}</p>
            </div>
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
