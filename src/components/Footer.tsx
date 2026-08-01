import { Building2, Mail, Phone, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSiteConfig } from '@/context/SiteConfigContext';

export default function Footer() {
  const { config } = useSiteConfig();
  const f = config.footer;

  return (
    <footer className="bg-slate-800 text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-blue-500 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <span className="text-white font-bold text-base">{config.header.logo_text}</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">{f.brand_description}</p>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wide">روابط سريعة</h3>
            <ul className="space-y-2 text-sm">
              {[
                { label: 'الصفحة الرئيسية', href: '/' },
                { label: 'تقديم طلب جديد', href: '/register' },
                { label: 'تسجيل الدخول', href: '/login' },
                { label: 'لوحة التحكم', href: '/admin' },
              ].map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className="hover:text-blue-400 transition-colors">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wide">تواصل معنا</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-400 shrink-0" />
                <span>{f.contact_email}</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-400 shrink-0" />
                <span dir="ltr">{f.contact_phone}</span>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
                <span>{f.contact_address}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-700 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p>© 2024 {config.header.logo_text}. جميع الحقوق محفوظة.</p>
          <p>مبني بتقنيات حديثة وآمنة</p>
        </div>
      </div>
    </footer>
  );
}
