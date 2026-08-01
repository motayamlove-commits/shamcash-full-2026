import { useState } from 'react';
import { Save, Check, Image, Type, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSiteConfig, SiteConfig } from '@/context/SiteConfigContext';

type PageKey = 'home' | 'register' | 'login' | 'verify' | 'thank_you';

const PAGES: { key: PageKey; label: string }[] = [
  { key: 'home', label: 'الرئيسية' },
  { key: 'register', label: 'التسجيل' },
  { key: 'login', label: 'الدخول' },
  { key: 'verify', label: 'التحقق' },
  { key: 'thank_you', label: 'صفحة الشكر' },
];

const PAGE_FIELDS: Record<PageKey, { key: string; label: string; multiline?: boolean; isImage?: boolean }[]> = {
  home: [
    { key: 'hero_title', label: 'عنوان البطل' },
    { key: 'hero_title_highlight', label: 'الجزء المميز من العنوان' },
    { key: 'hero_subtitle', label: 'النص الفرعي', multiline: true },
    { key: 'hero_image', label: 'رابط الصورة الرئيسية', isImage: true },
    { key: 'badge_text', label: 'نص الشارة' },
    { key: 'button_text', label: 'نص الزر الأول' },
    { key: 'button2_text', label: 'نص الزر الثاني' },
  ],
  register: [
    { key: 'title', label: 'عنوان الصفحة' },
    { key: 'subtitle', label: 'النص الفرعي' },
    { key: 'button_text', label: 'نص زر التسجيل' },
  ],
  login: [
    { key: 'title', label: 'عنوان الصفحة' },
    { key: 'subtitle', label: 'النص الفرعي' },
    { key: 'button_text', label: 'نص الزر' },
  ],
  verify: [
    { key: 'title', label: 'عنوان الصفحة' },
    { key: 'subtitle', label: 'النص الفرعي' },
    { key: 'button_text', label: 'نص زر التحقق' },
    { key: 'resend_text', label: 'نص إعادة الإرسال' },
  ],
  thank_you: [
    { key: 'title', label: 'العنوان الرئيسي' },
    { key: 'success_text', label: 'نص النجاح' },
    { key: 'message', label: 'رسالة الشكر', multiline: true },
    { key: 'button_text', label: 'نص الزر الأول' },
    { key: 'button2_text', label: 'نص الزر الثاني' },
  ],
};

export default function PageContentEditor() {
  const { config } = useSiteConfig();
  const [activePage, setActivePage] = useState<PageKey>('home');
  const [pageValues, setPageValues] = useState<Record<PageKey, Record<string, string>>>({
    home: { ...config.home },
    register: { ...config.register },
    login: { ...config.login },
    verify: { ...config.verify },
    thank_you: { ...config.thank_you },
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fields = PAGE_FIELDS[activePage];
  const values = pageValues[activePage];

  const setValue = (key: string, val: string) => {
    setPageValues((prev) => ({ ...prev, [activePage]: { ...prev[activePage], [key]: val } }));
  };

  const savePage = async () => {
    setSaving(true);
    await supabase.from('site_config').upsert(
      { key: activePage, value: pageValues[activePage] },
      { onConflict: 'key' }
    );
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const currentConfig = config[activePage] as Record<string, string>;
  const homeConfig = config.home;

  return (
    <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
      {/* Page Tabs */}
      <div className="border-b border-slate-700 px-5 pt-4">
        <div className="flex gap-1 overflow-x-auto pb-3">
          {PAGES.map((p) => (
            <button key={p.key} onClick={() => { setActivePage(p.key); setSaved(false); }}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activePage === p.key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Fields */}
      <div className="p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" />
            تعديل محتوى صفحة: {PAGES.find((p) => p.key === activePage)?.label}
          </h3>
          <button onClick={savePage} disabled={saving}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              saved ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'
            } disabled:opacity-50`}>
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : saved ? <><Check className="w-4 h-4" />تم الحفظ</>
              : <><Save className="w-4 h-4" />حفظ</>}
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {fields.filter((f) => !f.isImage && !f.multiline).map((f) => (
            <div key={f.key} className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                <Type className="w-3 h-3" /> {f.label}
              </label>
              <input value={values[f.key] || ''} onChange={(e) => setValue(f.key, e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </div>
          ))}
        </div>

        {fields.filter((f) => f.multiline).map((f) => (
          <div key={f.key} className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
              <Type className="w-3 h-3" /> {f.label}
            </label>
            <textarea value={values[f.key] || ''} onChange={(e) => setValue(f.key, e.target.value)} rows={3}
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none" />
          </div>
        ))}

        {fields.filter((f) => f.isImage).map((f) => (
          <div key={f.key} className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
              <Image className="w-3 h-3" /> {f.label}
            </label>
            <input value={values[f.key] || ''} onChange={(e) => setValue(f.key, e.target.value)}
              placeholder="https://..."
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ltr text-left" />
            {values[f.key] && (
              <div className="mt-2">
                <p className="text-xs text-slate-500 mb-1.5">معاينة الصورة:</p>
                <img src={values[f.key]} alt="preview"
                  className="h-32 w-full object-cover rounded-xl border border-slate-600"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
