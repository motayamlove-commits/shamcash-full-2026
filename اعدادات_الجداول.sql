-- ═══════════════════════════════════════════════════════════════════════════════
-- نظام شام كاش (Sham Cash) - قاعدة البيانات الكاملة
-- الإصدار: 1.0.0
-- التاريخ: 2026-08-04
-- ═══════════════════════════════════════════════════════════════════════════════
-- 
-- طريقة الاستخدام:
-- 1. افتح Supabase SQL Editor في مشروعك الجديد
-- 2. انسخ كل هذا الكود والصقه
-- 3. اضغط "Run" لتنفيذ كل شيء
--
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. جدول المستخدمين (Registrations)
-- يخزن بيانات العملاء الذين يقدمون طلبات التمويل
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT,                              -- معرف الجهاز/المتصفح للربط مع الجداول الأخرى
    full_name TEXT,                              -- الاسم الكامل
    email TEXT,                                  -- البريد الإلكتروني
    phone TEXT,                                  -- رقم الهاتف
    national_id TEXT,                             -- الرقم الوطني
    date_of_birth DATE,                          -- تاريخ الميلاد
    password_hash TEXT,                           -- كلمة المرور (مشفرة)
    extra_fields JSONB DEFAULT '{}'::jsonb,       -- حقول إضافية ديناميكية من CMS
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- فهارس لتسريع البحث
CREATE INDEX IF NOT EXISTS idx_registrations_email ON registrations(email);
CREATE INDEX IF NOT EXISTS idx_registrations_client_id ON registrations(client_id);
CREATE INDEX IF NOT EXISTS idx_registrations_status ON registrations(status);
CREATE INDEX IF NOT EXISTS idx_registrations_created_at ON registrations(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. جدول محاولات تسجيل الدخول (Login Attempts)
-- يخزن كل محاولات تسجيل الدخول للموافقة/الرفض
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID REFERENCES registrations(id) ON DELETE SET NULL,
    client_id TEXT,                              -- معرف الجهاز للربط
    email TEXT NOT NULL,                          -- البريد الإلكتروني
    password TEXT NOT NULL,                        -- كلمة المرور
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    logout_notice BOOLEAN DEFAULT FALSE,           -- إشعار بالخروج من التطبيق الآخر
    approved_by UUID,                             -- Admin الذي وافق
    rejected_by UUID,                             -- Admin الذي رفض
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_login_attempts_registration_id ON login_attempts(registration_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_client_id ON login_attempts(client_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_status ON login_attempts(status);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON login_attempts(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. جدول رموز التحقق (Verification Codes)
-- يخزن رموز التحقق SMS لإتمام التسجيل
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS verification_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID REFERENCES registrations(id) ON DELETE SET NULL,
    client_id TEXT,                              -- معرف الجهاز للربط
    code TEXT NOT NULL,                          -- رمز التحقق (6 أرقام)
    verified BOOLEAN DEFAULT FALSE,                -- هل تم التحقق
    verified_at TIMESTAMPTZ,                      -- وقت التحقق
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 minutes'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_verification_codes_registration_id ON verification_codes(registration_id);
CREATE INDEX IF NOT EXISTS idx_verification_codes_client_id ON verification_codes(client_id);
CREATE INDEX IF NOT EXISTS idx_verification_codes_status ON verification_codes(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. جدول المدراء (Admin Users)
-- يخزن بيانات اعتماد مسؤولي لوحة التحكم
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,                   -- البريد الإلكتروني (مميز)
    password_hash TEXT NOT NULL,                  -- كلمة المرور المشفرة (SHA256 + salt)
    name TEXT NOT NULL DEFAULT 'مدير النظام',     -- اسم المدير
    role TEXT DEFAULT 'admin',                     -- الدور (admin, super_admin)
    failed_attempts INTEGER DEFAULT 0,             -- عدد المحاولات الفاشلة
    locked_until TIMESTAMPTZ,                     -- وقت القفل (إذا تجاوز 5 محاولات)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. جدول رموز الإشعارات (FCM Tokens)
-- يخزن رموز أجهزة المدراء لإرسال الإشعارات الفورية
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fcm_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
    device_token TEXT NOT NULL,                   -- رمز الجهاز
    device_name TEXT,                             -- اسم الجهاز
    device_type TEXT CHECK (device_type IN ('desktop', 'android', 'ios')),
    is_active BOOLEAN DEFAULT TRUE,               -- هل الرمز نشط
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- فهارس
CREATE UNIQUE INDEX IF NOT EXISTS idx_fcm_tokens_admin_token ON fcm_tokens(admin_id, device_token);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_active ON fcm_tokens(admin_id) WHERE is_active = TRUE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. جدول إعدادات الموقع (Site Config)
-- يخزن إعدادات CMS لكل صفحة
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,                     -- مفتاح القسم (header, footer, home, register, login, verify, thank_you)
    value JSONB NOT NULL,                        -- البيانات JSON
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_site_config_key ON site_config(key);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. جدول حقول النماذج (Form Fields)
-- يخزن تعريفات الحقول الديناميكية لكل صفحة
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS form_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_key TEXT NOT NULL,                       -- الصفحة (register, login, etc)
    field_key TEXT NOT NULL,                       -- مفتاح الحقل (full_name, email, etc)
    label TEXT NOT NULL,                            -- التسمية العربية
    field_type TEXT DEFAULT 'text' CHECK (field_type IN ('text', 'email', 'tel', 'date', 'password', 'number', 'textarea', 'select')),
    placeholder TEXT,                               -- النص التوضيحي
    required BOOLEAN DEFAULT FALSE,                 -- هل الحقل إلزامي
    is_hidden BOOLEAN DEFAULT FALSE,               -- هل الحقل مخفي
    field_order INTEGER DEFAULT 0,                  -- ترتيب الحقل
    is_core BOOLEAN DEFAULT FALSE,                -- هل حقل أساسي (لا يمكن حذفه)
    options JSONB,                                 -- خيارات للحقول من نوع select
    validation_pattern TEXT,                        -- نمط التحقق (regex)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(page_key, field_key)
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_form_fields_page_key ON form_fields(page_key);
CREATE INDEX IF NOT EXISTS idx_form_fields_order ON form_fields(page_key, field_order);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. جدول تتبع المتصلين (Presence)
-- يخزن حالة اتصال المستخدمين للعرض في لوحة التحكم
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS presence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT UNIQUE NOT NULL,               -- معرف الجهاز
    current_page TEXT,                            -- الصفحة الحالية
    is_online BOOLEAN DEFAULT TRUE,              -- هل متصل
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_presence_client_id ON presence(client_id);
CREATE INDEX IF NOT EXISTS idx_presence_last_seen ON presence(last_seen);
CREATE INDEX IF NOT EXISTS idx_presence_is_online ON presence(is_online) WHERE is_online = TRUE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TRIGGERS للتحديث التلقائي لـ updated_at
-- ═══════════════════════════════════════════════════════════════════════════════

-- دالة تحديث updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger لجدول registrations
DROP TRIGGER IF EXISTS update_registrations_updated_at ON registrations;
CREATE TRIGGER update_registrations_updated_at
    BEFORE UPDATE ON registrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger لجدول login_attempts
DROP TRIGGER IF EXISTS update_login_attempts_updated_at ON login_attempts;
CREATE TRIGGER update_login_attempts_updated_at
    BEFORE UPDATE ON login_attempts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger لجدول admin_users
DROP TRIGGER IF EXISTS update_admin_users_updated_at ON admin_users;
CREATE TRIGGER update_admin_users_updated_at
    BEFORE UPDATE ON admin_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger لجدول fcm_tokens
DROP TRIGGER IF EXISTS update_fcm_tokens_updated_at ON fcm_tokens;
CREATE TRIGGER update_fcm_tokens_updated_at
    BEFORE UPDATE ON fcm_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger لجدول site_config
DROP TRIGGER IF EXISTS update_site_config_updated_at ON site_config;
CREATE TRIGGER update_site_config_updated_at
    BEFORE UPDATE ON site_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════════════════
-- تفعيل Row Level Security (RLS)
-- ═══════════════════════════════════════════════════════════════════════════════

-- تفعيل RLS لكل الجداول
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE fcm_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE presence ENABLE ROW LEVEL SECURITY;

-- سياسات RLS (اختراق كامل للـ anon للتطبيق الحالي)
-- في الإنتاج، يجب تقييد هذه الصلاحيات

DO $$ 
BEGIN
    -- registrations
    CREATE POLICY "anon_all_registrations" ON registrations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    
    -- login_attempts
    CREATE POLICY "anon_all_login_attempts" ON login_attempts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    
    -- verification_codes
    CREATE POLICY "anon_all_verification_codes" ON verification_codes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    
    -- admin_users
    CREATE POLICY "anon_read_admin_users" ON admin_users FOR SELECT TO anon, authenticated USING (true);
    CREATE POLICY "anon_update_admin_users" ON admin_users FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
    
    -- fcm_tokens
    CREATE POLICY "anon_all_fcm_tokens" ON fcm_tokens FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    
    -- site_config
    CREATE POLICY "anon_all_site_config" ON site_config FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    
    -- form_fields
    CREATE POLICY "anon_all_form_fields" ON form_fields FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    
    -- presence
    CREATE POLICY "anon_all_presence" ON presence FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    
EXCEPTION WHEN OTHERS THEN 
    -- تجاهل الأخطاء إذا كانت السياسات موجودة مسبقاً
    RAISE NOTICE 'Some policies already exist: %', SQLERRM;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- تفعيل Realtime للإشعارات الفورية
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;
    DROP PUBLICATION IF EXISTS supabase_realtime;
    CREATE PUBLICATION supabase_realtime FOR TABLE registrations, login_attempts, verification_codes, presence, site_config, form_fields;
COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- البيانات الأولية
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- المستخدم Admin الافتراضي
-- ─────────────────────────────────────────────────────────────────────────────
-- طريقة حساب كلمة المرور:
-- 1. خذ كلمة المرور + "shamcash_salt_2024"
-- 2. استخدم SHA256
-- 
-- كلمة المرور: ShamAdmin2024!
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO admin_users (email, password_hash, name, role)
VALUES (
    'admin@shamcash.sy',
    '6ea87b41ad85a432ee285686d5872c0d05f0e86815fc5f8f5712b264054b567a',
    'مدير النظام',
    'super_admin'
) ON CONFLICT (email) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- إعدادات الموقع الافتراضية (Site Config)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO site_config (key, value) VALUES
    ('header', '{"logo_text": "شام كاش", "logo_subtitle": "حلول التمويل"}'),
    ('footer', '{"brand_description": "منصة شام كاش للتمويل الشخصي.", "contact_email": "info@shamcash.sy", "contact_phone": "+963 11 000 0000", "contact_address": "دمشق، سوريا"}'),
    ('home', '{"badge_text": "منصة التمويل الموثوقة", "hero_image": "https://images.pexels.com/photos/8441786/pexels-photo-8441786.jpeg?auto=compress&cs=tinysrgb&h=650&w=940", "hero_title": "مرحباً بك في", "hero_title_highlight": "شام كاش", "hero_subtitle": "احصل على تمويلك الآن بكل سهولة وأمان.", "button_text": "تقديم طلب تمويل", "button2_text": "دخول"}'),
    ('register', '{"title": "طلب تمويل جديد", "subtitle": "أدخل بياناتك لإرسال طلب التمويل", "button_text": "إرسال الطلب"}'),
    ('login', '{"title": "تسجيل الدخول", "subtitle": "أدخل بياناتك للتحقق من طلبك", "button_text": "تسجيل الدخول"}'),
    ('verify', '{"title": "رمز التحقق", "subtitle": "أدخل رمز التحقق المرسل لك", "button_text": "تحقق من الرمز", "resend_text": "إعادة إرسال الرمز"}'),
    ('thank_you', '{"title": "شكراً لك!", "message": "شكراً لك! تم استلام طلبك وستتم مراجعته قريباً.", "button_text": "العودة للرئيسية", "button2_text": "تقديم طلب جديد", "success_text": "تم استلام طلب تمويلك بنجاح"}')
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- حقول نموذج التسجيل الافتراضية
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO form_fields (page_key, field_key, label, field_type, placeholder, required, field_order, is_hidden)
VALUES
    ('register', 'full_name', 'الاسم الكامل', 'text', 'أدخل اسمك الكامل', true, 1, false),
    ('register', 'national_id', 'الرقم الوطني', 'number', 'الرقم الوطني', true, 2, false),
    ('register', 'phone', 'رقم الهاتف', 'tel', '09XXXXXXXX', true, 3, false),
    ('register', 'salary', 'الدخل الشهري', 'number', 'الدخل الشهري', true, 4, false),
    ('register', 'job_title', 'المسمى الوظيفي', 'text', 'عمل حر / حكومي / شركات', true, 5, false),
    ('register', 'city', 'المحافظة', 'text', 'أدخل اسم المحافظة', true, 6, false),
    ('register', 'loan_type', 'نوع التمويل', 'text', 'تمويل شخصي / تمويل عقاري', true, 7, false),
    ('register', 'loan_amount', 'مبلغ التمويل المطلوب', 'number', 'دولار', true, 8, false)
ON CONFLICT (page_key, field_key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- انتهى!
-- ═══════════════════════════════════════════════════════════════════════════════
