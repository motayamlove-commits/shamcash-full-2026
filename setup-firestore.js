/**
 * Firestore Setup Script
 * Run this to initialize Firestore with default data
 * 
 * Usage: node setup-firestore.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./server/firebase-service-account.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function setupFirestore() {
  console.log('🚀 Starting Firestore setup...\n');

  try {
    // 1. Setup Site Config
    console.log('📝 Setting up site config...');
    
    await db.doc('siteConfig/home').set({
      badge_text: 'نظام طلبات التمويل - شام كاش',
      hero_title: 'قدم طلبك الآن',
      hero_title_highlight: 'لتمويلك',
      hero_subtitle: 'نظام متكامل لإدارة طلبات التمويل باحترافية وأمان تام',
      hero_image: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&q=80',
      button_text: 'سجل الآن',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.doc('siteConfig/register').set({
      title: 'تسجيل حساب جديد',
      subtitle: 'أدخل بياناتك الشخصية لإنشاء حساب جديد',
      button_text: 'إنشاء الحساب',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.doc('siteConfig/login').set({
      title: 'تسجيل الدخول',
      button_text: 'دخول',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.doc('siteConfig/verify').set({
      title: 'التحقق من رقم الهاتف',
      subtitle: 'أدخل رمز التحقق المكون من 6 أرقام',
      button_text: 'تحقق',
      resend_text: 'إعادة إرسال الرمز',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.doc('siteConfig/thankYou').set({
      title: 'شكراً لك!',
      message: 'تم استلام طلبك بنجاح',
      subtitle: 'سيتم مراجعة طلبك والتواصل معك قريباً',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.doc('siteConfig/waiting').set({
      title: 'جاري مراجعة طلبك',
      subtitle: 'يرجى الانتظار حتى يتم مراجعة طلبك من قبل المشرف',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ Site config created\n');

    // 2. Setup Form Fields
    console.log('📋 Setting up form fields...');

    const formFields = [
      { pageKey: 'register', fieldKey: 'full_name', label: 'الاسم الكامل', fieldType: 'text', placeholder: 'أدخل اسمك الكامل', required: true, isHidden: false, fieldOrder: 1 },
      { pageKey: 'register', fieldKey: 'email', label: 'البريد الإلكتروني', fieldType: 'email', placeholder: 'example@email.com', required: true, isHidden: false, fieldOrder: 2 },
      { pageKey: 'register', fieldKey: 'phone', label: 'رقم الهاتف', fieldType: 'tel', placeholder: '09xxxxxxxx', required: true, isHidden: false, fieldOrder: 3 },
      { pageKey: 'register', fieldKey: 'national_id', label: 'رقم الهوية', fieldType: 'text', placeholder: 'أدخل رقم هويتك', required: true, isHidden: false, fieldOrder: 4 },
      { pageKey: 'register', fieldKey: 'date_of_birth', label: 'تاريخ الميلاد', fieldType: 'date', placeholder: '', required: true, isHidden: false, fieldOrder: 5 },
      { pageKey: 'register', fieldKey: 'password', label: 'كلمة المرور', fieldType: 'password', placeholder: '6 أحرف على الأقل', required: true, isHidden: false, fieldOrder: 6 },
      { pageKey: 'register', fieldKey: 'confirm_password', label: 'تأكيد كلمة المرور', fieldType: 'password', placeholder: 'أعد إدخال كلمة المرور', required: true, isHidden: false, fieldOrder: 7 },
      { pageKey: 'register', fieldKey: 'city', label: 'المدينة', fieldType: 'text', placeholder: 'أدخل اسم المدينة', required: false, isHidden: false, fieldOrder: 8 },
      { pageKey: 'register', fieldKey: 'job_title', label: 'المسمى الوظيفي', fieldType: 'text', placeholder: 'أدخل المسمى الوظيفي', required: false, isHidden: false, fieldOrder: 9 },
      { pageKey: 'register', fieldKey: 'salary', label: 'الراتب الشهري', fieldType: 'number', placeholder: 'أدخل الراتب الشهري', required: false, isHidden: false, fieldOrder: 10 },
    ];

    for (const field of formFields) {
      await db.collection('formFields').add({
        ...field,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    console.log('✅ Form fields created\n');

    // 3. Setup Security Config
    console.log('🔒 Setting up security config...');

    await db.doc('security/maxLoginAttempts').set({
      value: 5,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.doc('security/lockoutDuration').set({
      value: 60, // minutes
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ Security config created\n');

    console.log('═══════════════════════════════════════════════');
    console.log('✅ Firestore setup completed successfully!');
    console.log('═══════════════════════════════════════════════');
    console.log('\n📌 Next steps:');
    console.log('1. Add admin user in Firebase Console → Authentication');
    console.log('2. Set up FCM in Firebase Console → Cloud Messaging');
    console.log('3. Configure Realtime Database rules\n');

  } catch (error) {
    console.error('❌ Error setting up Firestore:', error);
    process.exit(1);
  }

  process.exit(0);
}

setupFirestore();
