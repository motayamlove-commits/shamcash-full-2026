import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const INITIAL_FIELDS = [
  { page_key: 'register', field_key: 'full_name', label: 'الاسم الكامل', field_type: 'text', required: true, field_order: 1 },
  { page_key: 'register', field_key: 'email', label: 'البريد الإلكتروني', field_type: 'email', required: true, field_order: 2 },
  { page_key: 'register', field_key: 'password', label: 'كلمة المرور', field_type: 'password', required: true, field_order: 3 },
];

export default function AutoMigrator({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function migrate() {
      try {
        // Check if registrations table exists by trying to select from it
        const { error: checkError } = await supabase.from('registrations').select('id').limit(1);
        
        // If error code is 42P01, the table doesn't exist
        if (checkError && (checkError.code === '42P01' || checkError.message.includes('does not exist'))) {
          console.log('Database tables not found. Please run the SQL in /supabase/full_schema.sql in your Supabase SQL Editor.');
          setError('قاعدة البيانات غير مهيأة. يرجى تشغيل سكربت SQL الموفر في ملف full_schema.sql داخل Supabase SQL Editor.');
          
          // Try to seed initial data if tables were just created manually
          // Note: In client-side JS, we can't easily run full SQL DDL due to security,
          // so we advise the user to run it once.
        } else {
          // Tables exist, ensure initial form fields are seeded if empty
          const { data: fields } = await supabase.from('form_fields').select('id').limit(1);
          if (!fields || fields.length === 0) {
            await supabase.from('form_fields').insert(INITIAL_FIELDS);
          }
          setReady(true);
        }
      } catch (err) {
        console.error('Migration check failed:', err);
        setReady(true); // Continue anyway to avoid blocking
      }
    }
    migrate();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6 text-center" dir="rtl">
        <div className="max-w-md w-full bg-slate-800 rounded-2xl p-8 border border-red-500/30 shadow-2xl">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-4">قاعدة البيانات غير متصلة</h2>
          <p className="text-slate-400 mb-6 text-sm leading-relaxed">{error}</p>
          <div className="bg-slate-900 rounded-lg p-4 text-left mb-6 overflow-x-auto">
            <code className="text-xs text-blue-400">
              -- الخطوة 1: افتح SQL Editor في Supabase<br/>
              -- الخطوة 2: انسخ محتوى ملف /supabase/full_schema.sql<br/>
              -- الخطوة 3: الصق الكود واضغط Run
            </code>
          </div>
          <button onClick={() => window.location.reload()} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all">
            إعادة المحاولة بعد التشغيل
          </button>
        </div>
      </div>
    );
  }

  if (!ready) return null;
  return <>{children}</>;
}
