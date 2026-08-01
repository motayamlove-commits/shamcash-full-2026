import { useState } from 'react';
import { Plus, Trash2, Edit2, Check, X, ChevronUp, ChevronDown, Eye, EyeOff, Lock, GripVertical, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSiteConfig, FormField } from '@/context/SiteConfigContext';

const FIELD_TYPES = [
  { value: 'text', label: 'نص' },
  { value: 'email', label: 'بريد إلكتروني' },
  { value: 'tel', label: 'هاتف' },
  { value: 'date', label: 'تاريخ' },
  { value: 'password', label: 'كلمة مرور' },
  { value: 'number', label: 'رقم' },
  { value: 'textarea', label: 'نص طويل' },
];

type NewField = {
  field_key: string;
  field_type: string;
  label: string;
  placeholder: string;
  required: boolean;
};

const EMPTY_NEW: NewField = { field_key: '', field_type: 'text', label: '', placeholder: '', required: true };

function slugify(str: string) {
  return str.trim().toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w_]/g, '')
    .replace(/^_+|_+$/g, '') || `field_${Date.now()}`;
}

export default function FormFieldsEditor() {
  const { formFields } = useSiteConfig();
  const fields = formFields.filter((f) => f.page_key === 'register').sort((a, b) => a.field_order - b.field_order);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<FormField>>({});
  const [adding, setAdding] = useState(false);
  const [newField, setNewField] = useState<NewField>(EMPTY_NEW);
  const [saving, setSaving] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const startEdit = (f: FormField) => {
    setEditingId(f.id);
    setEditValues({ label: f.label, placeholder: f.placeholder, field_type: f.field_type, required: f.required });
  };

  const saveEdit = async (f: FormField) => {
    setSaving(f.id);
    try {
      await supabase.from('form_fields').update(editValues).eq('id', f.id);
      setEditingId(null);
    } catch (err) {
      alert('فشل حفظ التعديل');
    } finally {
      setSaving(null);
    }
  };

  const toggleVisible = async (f: FormField) => {
    setSaving(f.id);
    try {
      await supabase.from('form_fields').update({ is_hidden: !f.is_hidden }).eq('id', f.id);
    } catch (err) {
      alert('فشل تغيير الحالة');
    } finally {
      setSaving(null);
    }
  };

  const moveField = async (f: FormField, dir: 'up' | 'down') => {
    const idx = fields.findIndex((x) => x.id === f.id);
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= fields.length) return;
    const other = fields[swapIdx];
    setSaving(f.id);
    try {
      await Promise.all([
        supabase.from('form_fields').update({ field_order: other.field_order }).eq('id', f.id),
        supabase.from('form_fields').update({ field_order: f.field_order }).eq('id', other.id),
      ]);
    } catch (err) {
      alert('فشل إعادة الترتيب');
    } finally {
      setSaving(null);
    }
  };

  const deleteField = async (id: string) => {
    setSaving(id);
    try {
      await supabase.from('form_fields').delete().eq('id', id);
      setDeleteConfirm(null);
    } catch (err) {
      alert('فشل حذف الحقل');
    } finally {
      setSaving(null);
    }
  };

  const addField = async () => {
    if (!newField.label.trim()) return;
    const key = slugify(newField.label);
    const maxOrder = fields.length > 0 ? Math.max(...fields.map((f) => f.field_order)) + 1 : 1;
    setSaving('new');
    try {
      await supabase.from('form_fields').insert({
        page_key: 'register',
        field_key: key,
        field_type: newField.field_type,
        label: newField.label.trim(),
        placeholder: newField.placeholder.trim(),
        required: newField.required,
        field_order: maxOrder,
        is_hidden: false,
      });
      setAdding(false); 
      setNewField(EMPTY_NEW);
    } catch (err) {
      alert('فشل إضافة الحقل');
    } finally {
      setSaving(null);
    }
  };

  const typeLabel = (t: string) => FIELD_TYPES.find((x) => x.value === t)?.label || t;

  return (
    <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden text-right" dir="rtl">
      <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-blue-400" />
          <h3 className="font-semibold text-white text-sm">حقول نموذج التسجيل</h3>
          <span className="bg-slate-700 text-slate-400 text-xs px-2 py-0.5 rounded-full">{fields.length} حقل</span>
        </div>
        <button onClick={() => { setAdding(true); setNewField(EMPTY_NEW); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors">
          <Plus className="w-4 h-4" /> إضافة حقل
        </button>
      </div>

      <div className="divide-y divide-slate-700/50">
        {fields.map((f, idx) => (
          <div key={f.id} className={`px-5 py-4 transition-colors ${f.is_hidden ? 'opacity-50' : ''}`}>
            {editingId === f.id ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">التسمية</label>
                    <input value={editValues.label || ''} onChange={(e) => setEditValues((p) => ({ ...p, label: e.target.value }))}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">النص التوضيحي</label>
                    <input value={editValues.placeholder || ''} onChange={(e) => setEditValues((p) => ({ ...p, placeholder: e.target.value }))}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">نوع الحقل</label>
                    <select value={editValues.field_type || 'text'}
                      onChange={(e) => setEditValues((p) => ({ ...p, field_type: e.target.value as FormField['field_type'] }))}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500">
                      {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-3 pt-5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={editValues.required ?? true}
                        onChange={(e) => setEditValues((p) => ({ ...p, required: e.target.checked }))}
                        className="w-4 h-4 accent-blue-500" />
                      <span className="text-sm text-slate-300">إلزامي</span>
                    </label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(f)} disabled={!!saving}
                    className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-lg transition-colors">
                    {saving === f.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    حفظ التعديل
                  </button>
                  <button onClick={() => setEditingId(null)} className="px-4 py-2 bg-slate-600 text-white text-sm rounded-lg">إلغاء</button>
                </div>
              </div>
            ) : deleteConfirm === f.id ? (
              <div className="flex items-center justify-between">
                <p className="text-sm text-red-400">هل تريد حذف حقل "{f.label}" نهائياً؟</p>
                <div className="flex gap-2">
                  <button onClick={() => deleteField(f.id)} className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg">تأكيد الحذف</button>
                  <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 bg-slate-600 text-white text-sm rounded-lg">إلغاء</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button onClick={() => moveField(f, 'up')} disabled={idx === 0} className="text-slate-500 hover:text-slate-300 disabled:opacity-20"><ChevronUp className="w-4 h-4" /></button>
                  <button onClick={() => moveField(f, 'down')} disabled={idx === fields.length - 1} className="text-slate-500 hover:text-slate-300 disabled:opacity-20"><ChevronDown className="w-4 h-4" /></button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">{f.label}</span>
                    <span className="bg-slate-700 text-slate-400 text-xs px-2 py-0.5 rounded-full">{typeLabel(f.field_type)}</span>
                    {f.required && <span className="bg-red-900/40 text-red-400 text-xs px-2 py-0.5 rounded-full">إلزامي</span>}
                  </div>
                  {f.placeholder && <p className="text-xs text-slate-500 mt-0.5 truncate">{f.placeholder}</p>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => toggleVisible(f)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700">
                    {f.is_hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button onClick={() => startEdit(f)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-700"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => setDeleteConfirm(f.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {adding && (
        <div className="border-t border-slate-700 p-5 bg-slate-750 space-y-4">
          <h4 className="text-sm font-semibold text-white">إضافة حقل جديد</h4>
          <div className="grid grid-cols-2 gap-3">
            <input value={newField.label} onChange={(e) => setNewField((p) => ({ ...p, label: e.target.value }))} placeholder="التسمية (مثال: المدينة)" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
            <input value={newField.placeholder} onChange={(e) => setNewField((p) => ({ ...p, placeholder: e.target.value }))} placeholder="النص التوضيحي" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select value={newField.field_type} onChange={(e) => setNewField((p) => ({ ...p, field_type: e.target.value }))} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white">
              {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <label className="flex items-center gap-2 cursor-pointer pt-2">
              <input type="checkbox" checked={newField.required} onChange={(e) => setNewField((p) => ({ ...p, required: e.target.checked }))} className="w-4 h-4 accent-blue-500" />
              <span className="text-sm text-slate-300">إلزامي</span>
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={addField} disabled={!newField.label.trim() || !!saving} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl">إضافة الحقل</button>
            <button onClick={() => setAdding(false)} className="px-5 py-2.5 bg-slate-700 text-white text-sm rounded-xl">إلغاء</button>
          </div>
        </div>
      )}
    </div>
  );
}
