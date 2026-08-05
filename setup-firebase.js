/**
 * Setup Script for Firebase Firestore
 * 
 * Run with: node setup-firebase.js
 * 
 * Make sure to set these environment variables:
 * - FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin
function initFirebase() {
  let serviceAccount;
  
  // Check for service account file
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    serviceAccount = require(path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH));
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } else {
    // Try default location
    const defaultPath = path.join(__dirname, 'server', 'firebase-service-account.json');
    if (fs.existsSync(defaultPath)) {
      serviceAccount = require(defaultPath);
    } else {
      console.error('❌ No Firebase service account found!');
      console.error('   Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON environment variable');
      process.exit(1);
    }
  }
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  
  console.log('✅ Firebase Admin initialized');
  return admin.firestore();
}

// Default data to setup
const DEFAULT_FORM_FIELDS = [
  {
    id: 'field_fullName',
    fieldKey: 'fullName',
    label: 'الاسم الكامل',
    fieldType: 'text',
    placeholder: 'أدخل اسمك الكامل',
    required: true,
    isHidden: false,
    fieldOrder: 1,
    pageKey: 'register',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  {
    id: 'field_email',
    fieldKey: 'email',
    label: 'البريد الإلكتروني',
    fieldType: 'email',
    placeholder: 'example@email.com',
    required: true,
    isHidden: false,
    fieldOrder: 2,
    pageKey: 'register',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  {
    id: 'field_phone',
    fieldKey: 'phone',
    label: 'رقم الهاتف',
    fieldType: 'tel',
    placeholder: '09XXXXXXXX',
    required: true,
    isHidden: false,
    fieldOrder: 3,
    pageKey: 'register',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  {
    id: 'field_nationalId',
    fieldKey: 'nationalId',
    label: 'رقم الهوية',
    fieldType: 'text',
    placeholder: 'أدخل رقم الهوية الوطنية',
    required: true,
    isHidden: false,
    fieldOrder: 4,
    pageKey: 'register',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  {
    id: 'field_dateOfBirth',
    fieldKey: 'dateOfBirth',
    label: 'تاريخ الميلاد',
    fieldType: 'date',
    placeholder: '',
    required: true,
    isHidden: false,
    fieldOrder: 5,
    pageKey: 'register',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  },
];

const DEFAULT_SITE_CONFIG = {
  home: {
    badge_text: 'نظام طلبات التمويل - شام كاش',
    hero_title: 'قدم طلبك الآن',
    hero_title_highlight: 'لتمويلك',
    hero_subtitle: 'نظام متكامل لإدارة طلبات التمويل باحترافية وأمان تام',
    hero_image: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&q=80',
    button_text: 'سجل الآن',
  },
  register: {
    title: 'تسجيل حساب جديد',
    subtitle: 'أدخل بياناتك الشخصية لإنشاء حساب جديد',
    button_text: 'إنشاء الحساب',
  },
  login: {
    title: 'تسجيل الدخول',
    button_text: 'دخول',
  },
  verify: {
    title: 'التحقق من رقم الهاتف',
    subtitle: 'أدخل رمز التحقق المكون من 6 أرقام',
    button_text: 'تحقق',
    resend_text: 'إعادة إرسال الرمز',
  },
  thankYou: {
    title: 'شكراً لك!',
    message: 'تم استلام طلبك بنجاح',
    subtitle: 'سيتم مراجعة طلبك والتواصل معك قريباً',
  },
  waiting: {
    title: 'جاري مراجعة طلبك',
    subtitle: 'يرجى الانتظار حتى يتم مراجعة طلبك من قبل المشرف',
  },
};

async function setupFirestore() {
  const db = initFirebase();
  
  console.log('\n📦 Setting up Firestore data...\n');
  
  // Setup Form Fields
  console.log('📝 Creating form fields...');
  const formFieldsRef = db.collection('formFields');
  
  for (const field of DEFAULT_FORM_FIELDS) {
    await formFieldsRef.doc(field.id).set(field);
    console.log(`   ✅ Created field: ${field.label}`);
  }
  
  // Setup Site Config
  console.log('\n⚙️  Creating site config...');
  const siteConfigRef = db.collection('siteConfig');
  
  for (const [key, value] of Object.entries(DEFAULT_SITE_CONFIG)) {
    await siteConfigRef.doc(key).set({
      value,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`   ✅ Created config: ${key}`);
  }
  
  // Setup Admin User (optional)
  console.log('\n👤 Creating default admin user...');
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@shamcash.sy';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456';
  
  try {
    await admin.auth().createUser({
      email: adminEmail,
      password: adminPassword,
      displayName: 'Admin',
    });
    console.log(`   ✅ Created admin user: ${adminEmail}`);
    console.log(`   ⚠️  Password: ${adminPassword}`);
  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      console.log(`   ⚠️  Admin user already exists: ${adminEmail}`);
    } else {
      console.log(`   ❌ Error creating admin: ${error.message}`);
    }
  }
  
  console.log('\n✅ Firestore setup complete!');
  console.log('\n📋 Summary:');
  console.log('   - Form Fields: 5 fields created');
  console.log('   - Site Config: 6 configs created');
  console.log('   - Admin User: Created (if not exists)');
  
  process.exit(0);
}

setupFirestore().catch((error) => {
  console.error('❌ Setup failed:', error);
  process.exit(1);
});
