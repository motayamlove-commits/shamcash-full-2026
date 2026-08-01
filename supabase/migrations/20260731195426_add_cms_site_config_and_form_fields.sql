/*
# نظام إدارة المحتوى CMS

## الوصف
إضافة جداول نظام إدارة المحتوى الكامل لتمكين تعديل نصوص وصور وحقول النماذج لكل صفحة من لوحة التحكم.

## الجداول الجديدة

### 1. جدول `site_config`
يخزن محتوى كل قسم من الموقع بصيغة JSON قابلة للتعديل:
- `section` (text, unique) - اسم القسم: header, footer, home, register, login, verify, thank_you
- `content` (jsonb) - كل البيانات القابلة للتعديل لهذا القسم
- `updated_at` (timestamptz) - تاريخ آخر تحديث

### 2. جدول `form_fields`
يخزن حقول النماذج الديناميكية القابلة للإضافة والحذف والتعديل:
- `page_key` (text) - الصفحة/النموذج الذي ينتمي إليه الحقل
- `field_key` (text) - مفتاح فريد للحقل
- `field_type` (text) - نوع الحقل: text, email, tel, date, password, number, textarea
- `label` (text) - التسمية العربية للحقل
- `placeholder` (text) - النص التوضيحي
- `required` (boolean) - هل الحقل إلزامي
- `field_order` (integer) - ترتيب الحقل في النموذج
- `visible` (boolean) - هل الحقل ظاهر
- `is_core` (boolean) - الحقول الأساسية لا يمكن حذفها

## تعديلات الجداول الموجودة

### جدول `registrations`
- إضافة عمود `extra_fields` (jsonb) لتخزين قيم الحقول المضافة ديناميكياً من CMS

## الأمان
- تفعيل RLS على الجدولين الجديدين
- صلاحيات كاملة لـ anon + authenticated (تطبيق بدون نظام مصادقة صارم)

## ملاحظات مهمة
1. البيانات الأولية تُضاف مرة واحدة فقط (ON CONFLICT DO NOTHING)
2. الحقول الأساسية (email, password) محمية من الحذف بعلامة is_core = true
3. الجدول site_config يستخدم upsert عند التحديث من لوحة التحكم
*/

-- أضف عمود extra_fields لجدول registrations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'registrations' AND column_name = 'extra_fields'
  ) THEN
    ALTER TABLE registrations ADD COLUMN extra_fields jsonb NOT NULL DEFAULT '{}';
  END IF;
END $$;

-- إنشاء جدول site_config
CREATE TABLE IF NOT EXISTS site_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section text NOT NULL UNIQUE,
  content jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- إنشاء جدول form_fields
CREATE TABLE IF NOT EXISTS form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text NOT NULL,
  field_key text NOT NULL,
  field_type text NOT NULL DEFAULT 'text' CHECK (field_type IN ('text','email','tel','date','password','number','textarea')),
  label text NOT NULL,
  placeholder text NOT NULL DEFAULT '',
  required boolean NOT NULL DEFAULT true,
  field_order integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  is_core boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(page_key, field_key)
);

-- تفعيل RLS
ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_fields ENABLE ROW LEVEL SECURITY;

-- سياسات site_config
DROP POLICY IF EXISTS "anon_select_site_config" ON site_config;
CREATE POLICY "anon_select_site_config" ON site_config FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_site_config" ON site_config;
CREATE POLICY "anon_insert_site_config" ON site_config FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_site_config" ON site_config;
CREATE POLICY "anon_update_site_config" ON site_config FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_site_config" ON site_config;
CREATE POLICY "anon_delete_site_config" ON site_config FOR DELETE TO anon, authenticated USING (true);

-- سياسات form_fields
DROP POLICY IF EXISTS "anon_select_form_fields" ON form_fields;
CREATE POLICY "anon_select_form_fields" ON form_fields FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_form_fields" ON form_fields;
CREATE POLICY "anon_insert_form_fields" ON form_fields FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_form_fields" ON form_fields;
CREATE POLICY "anon_update_form_fields" ON form_fields FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_form_fields" ON form_fields;
CREATE POLICY "anon_delete_form_fields" ON form_fields FOR DELETE TO anon, authenticated USING (true);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_form_fields_page_order ON form_fields(page_key, field_order);
CREATE INDEX IF NOT EXISTS idx_site_config_section ON site_config(section);

-- trigger لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_site_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS site_config_updated_at_trigger ON site_config;
CREATE TRIGGER site_config_updated_at_trigger
  BEFORE UPDATE ON site_config
  FOR EACH ROW EXECUTE FUNCTION update_site_config_updated_at();

-- بيانات أولية: site_config
INSERT INTO site_config (section, content) VALUES
  ('header', '{"logo_text": "بوابة التسجيل", "logo_subtitle": "الخدمات الإلكترونية"}'),
  ('footer', '{"brand_description": "منصة إلكترونية متكاملة لتقديم طلبات التسجيل والحصول على الخدمات بكل سهولة وأمان.", "contact_email": "info@portal.gov", "contact_phone": "+966 11 000 0000", "contact_address": "الرياض، المملكة العربية السعودية"}'),
  ('home', '{"hero_title": "مرحباً بك في", "hero_title_highlight": "بوابة التسجيل", "hero_subtitle": "قدّم طلبك الآن بكل سهولة وأمان. نوفر لك تجربة تسجيل سلسة وسريعة مع متابعة فورية لحالة طلبك.", "hero_image": "https://images.pexels.com/photos/8441786/pexels-photo-8441786.jpeg?auto=compress&cs=tinysrgb&h=650&w=940", "button_text": "تقديم طلب الآن", "button2_text": "تسجيل الدخول", "badge_text": "البوابة الإلكترونية الرسمية"}'),
  ('register', '{"title": "إنشاء حساب جديد", "subtitle": "أدخل بياناتك الشخصية لإتمام التسجيل", "button_text": "تسجيل والمتابعة"}'),
  ('login', '{"title": "تسجيل الدخول", "subtitle": "أدخل بياناتك للمتابعة إلى خطوة التحقق", "button_text": "تسجيل الدخول"}'),
  ('verify', '{"title": "رمز التحقق", "subtitle": "أدخل رمز التحقق لإتمام تسجيلك", "button_text": "تحقق وإتمام التسجيل", "resend_text": "إعادة إرسال الرمز"}'),
  ('thank_you', '{"title": "تهانينا!", "success_text": "تم تسجيلك بنجاح", "message": "شكراً لك على إتمام عملية التسجيل. لقد استلمنا بياناتك بنجاح وسيتم مراجعة طلبك في أقرب وقت ممكن.", "button_text": "العودة للرئيسية", "button2_text": "تسجيل حساب آخر"}')
ON CONFLICT (section) DO NOTHING;

-- بيانات أولية: form_fields لصفحة التسجيل
INSERT INTO form_fields (page_key, field_key, field_type, label, placeholder, required, field_order, visible, is_core) VALUES
  ('register', 'full_name',        'text',     'الاسم الكامل',           'أدخل اسمك الكامل',   true, 1, true, false),
  ('register', 'national_id',      'text',     'رقم الهوية الوطنية',     'أدخل رقم الهوية',    true, 2, true, false),
  ('register', 'email',            'email',    'البريد الإلكتروني',      'example@mail.com',   true, 3, true, true),
  ('register', 'phone',            'tel',      'رقم الهاتف',             '05xxxxxxxx',         true, 4, true, false),
  ('register', 'date_of_birth',    'date',     'تاريخ الميلاد',          '',                   true, 5, true, false),
  ('register', 'password',         'password', 'كلمة المرور',            '••••••••',           true, 6, true, true),
  ('register', 'confirm_password', 'password', 'تأكيد كلمة المرور',     '••••••••',           true, 7, true, true)
ON CONFLICT (page_key, field_key) DO NOTHING;
