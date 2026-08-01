import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type HeaderConfig = {
  logo_text: string;
  logo_subtitle: string;
};

export type FooterConfig = {
  brand_description: string;
  contact_email: string;
  contact_phone: string;
  contact_address: string;
};

export type HomeConfig = {
  hero_title: string;
  hero_title_highlight: string;
  hero_subtitle: string;
  hero_image: string;
  button_text: string;
  button2_text: string;
  badge_text: string;
};

export type PageConfig = {
  title: string;
  subtitle: string;
  button_text: string;
};

export type VerifyConfig = PageConfig & { resend_text: string };

export type ThankYouConfig = {
  title: string;
  success_text: string;
  message: string;
  button_text: string;
  button2_text: string;
};

export type SiteConfig = {
  header: HeaderConfig;
  footer: FooterConfig;
  home: HomeConfig;
  register: PageConfig;
  login: PageConfig;
  verify: VerifyConfig;
  thank_you: ThankYouConfig;
};

export type FormField = {
  id: string;
  page_key: string;
  field_key: string;
  field_type: 'text' | 'email' | 'tel' | 'date' | 'password' | 'number' | 'textarea' | 'select';
  label: string;
  placeholder: string;
  required: boolean;
  field_order: number;
  is_hidden: boolean;
  is_core: boolean;
};

// ─── Default values (used as fallback) ───────────────────────────────────────

export const DEFAULT_CONFIG: SiteConfig = {
  header: { logo_text: 'بوابة التسجيل', logo_subtitle: 'الخدمات الإلكترونية' },
  footer: {
    brand_description: 'منصة إلكترونية متكاملة لتقديم طلبات التسجيل.',
    contact_email: 'info@portal.gov',
    contact_phone: '+966 11 000 0000',
    contact_address: 'الرياض، المملكة العربية السعودية',
  },
  home: {
    hero_title: 'مرحباً بك في',
    hero_title_highlight: 'بوابة التسجيل',
    hero_subtitle: 'قدّم طلبك الآن بكل سهولة وأمان.',
    hero_image: 'https://images.pexels.com/photos/8441786/pexels-photo-8441786.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    button_text: 'تقديم طلب الآن',
    button2_text: 'تسجيل الدخول',
    badge_text: 'البوابة الإلكترونية الرسمية',
  },
  register: { title: 'إنشاء حساب جديد', subtitle: 'أدخل بياناتك الشخصية', button_text: 'تسجيل والمتابعة' },
  login: { title: 'تسجيل الدخول', subtitle: 'أدخل بياناتك للمتابعة', button_text: 'تسجيل الدخول' },
  verify: { title: 'رمز التحقق', subtitle: 'أدخل رمز التحقق', button_text: 'تحقق وإتمام التسجيل', resend_text: 'إعادة إرسال المركز' },
  thank_you: {
    title: 'تهانينا!',
    success_text: 'تم تسجيلك بنجاح',
    message: 'شكراً لك على إتمام عملية التسجيل.',
    button_text: 'العودة للرئيسية',
    button2_text: 'تسجيل حساب آخر',
  },
};

// ─── Context ──────────────────────────────────────────────────────────────────

type ContextType = {
  config: SiteConfig;
  formFields: FormField[];
  reload: () => Promise<void>;
};

const SiteConfigContext = createContext<ContextType>({
  config: DEFAULT_CONFIG,
  formFields: [],
  reload: async () => {},
});

export function useSiteConfig() {
  return useContext(SiteConfigContext);
}

// ─── Loading screen blocks render until DB data is fetched (prevents flash) ──

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-3">
      <div className="w-9 h-9 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-400 text-sm font-medium">جاري التحميل...</p>
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SiteConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<SiteConfig>(DEFAULT_CONFIG);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const [cfgRes, ffRes] = await Promise.all([
        supabase.from('site_config').select('key, value'),
        supabase.from('form_fields').select('*').order('field_order', { ascending: true }),
      ]);

      if (cfgRes.data) {
        const merged = { ...DEFAULT_CONFIG };
        for (const row of cfgRes.data) {
          const configKey = row.key as keyof SiteConfig;
          if (configKey in merged) {
            (merged as Record<string, unknown>)[configKey] = {
              ...(merged as Record<string, unknown>)[configKey] as object,
              ...(row.value as object),
            };
          }
        }
        setConfig(merged);
      }

      if (ffRes.data) setFormFields(ffRes.data as FormField[]);
    } catch (err) {
      console.error('Reload error:', err);
    }
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));

    const channel = supabase
      .channel('cms-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_config' }, () => reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'form_fields' }, () => reload())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [reload]);

  // Block render until data is fetched — eliminates content flash
  if (loading) return <LoadingScreen />;

  return (
    <SiteConfigContext.Provider value={{ config, formFields, reload }}>
      {children}
    </SiteConfigContext.Provider>
  );
}
