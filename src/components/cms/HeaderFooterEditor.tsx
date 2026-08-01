import { useState } from 'react';
import { Save, Check, Building2, Mail, Phone, MapPin, Type } from 'lucide-react';
import { api } from '@/lib/api';
import { useSiteConfig, HeaderConfig, FooterConfig } from '@/context/SiteConfigContext';

function Field({ label, icon: Icon, value, onChange, multiline = false }: {
  label: string; icon: React.ElementType; value: string;
  onChange: (v: string) => void; multiline?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-2">
        <Icon className="w-3.5 h-3.5" /> {label}
      </label>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3}
          className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none" />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
      )}
    </div>
  );
}

function SaveButton({ onClick, saving, saved }: { onClick: () => void; saving: boolean; saved: boolean }) {
  return (
    <button onClick={onClick} disabled={saving}
      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
        saved ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'
      } disabled:opacity-50`}>
      {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        : saved ? <><Check className="w-4 h-4" />تم الحفظ</>
        : <><Save className="w-4 h-4" />حفظ التغييرات</>}
    </button>
  );
}

export default function HeaderFooterEditor() {
  const { config } = useSiteConfig();
  const [header, setHeader] = useState<HeaderConfig>({ ...config.header });
  const [footer, setFooter] = useState<FooterConfig>({ ...config.footer });
  const [savingH, setSavingH] = useState(false);
  const [savedH, setSavedH] = useState(false);
  const [savingF, setSavingF] = useState(false);
  const [savedF, setSavedF] = useState(false);

  const saveHeader = async () => {
    setSavingH(true);
    await api.siteConfig.upsert('site_config', { ...config, header });
    setSavingH(false); setSavedH(true);
    setTimeout(() => setSavedH(false), 2500);
  };

  const saveFooter = async () => {
    setSavingF(true);
    await api.siteConfig.upsert('site_config', { ...config, footer });
    setSavingF(false); setSavedF(true);
    setTimeout(() => setSavedF(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Header Editor */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-400" />
            <h3 className="font-semibold text-white text-sm">تعديل الرأس (Header)</h3>
          </div>
          <SaveButton onClick={saveHeader} saving={savingH} saved={savedH} />
        </div>
        <div className="p-5 grid sm:grid-cols-2 gap-5">
          <Field label="نص الشعار" icon={Type} value={header.logo_text} onChange={(v) => setHeader((p) => ({ ...p, logo_text: v }))} />
          <Field label="النص الفرعي للشعار" icon={Type} value={header.logo_subtitle} onChange={(v) => setHeader((p) => ({ ...p, logo_subtitle: v }))} />
        </div>
        {/* Live Preview */}
        <div className="mx-5 mb-5 bg-slate-900 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-3 font-medium">معاينة مباشرة:</p>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">{header.logo_text || '...'}</p>
              <p className="text-xs text-slate-400">{header.logo_subtitle || '...'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Editor */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-400" />
            <h3 className="font-semibold text-white text-sm">تعديل التذييل (Footer)</h3>
          </div>
          <SaveButton onClick={saveFooter} saving={savingF} saved={savedF} />
        </div>
        <div className="p-5 space-y-4">
          <Field label="وصف المنصة" icon={Type} value={footer.brand_description}
            onChange={(v) => setFooter((p) => ({ ...p, brand_description: v }))} multiline />
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="البريد الإلكتروني" icon={Mail} value={footer.contact_email}
              onChange={(v) => setFooter((p) => ({ ...p, contact_email: v }))} />
            <Field label="رقم الهاتف" icon={Phone} value={footer.contact_phone}
              onChange={(v) => setFooter((p) => ({ ...p, contact_phone: v }))} />
          </div>
          <Field label="العنوان" icon={MapPin} value={footer.contact_address}
            onChange={(v) => setFooter((p) => ({ ...p, contact_address: v }))} />
        </div>
      </div>
    </div>
  );
}
