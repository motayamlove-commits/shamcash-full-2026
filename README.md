# Sham Cash - نظام إدارة طلبات التمويل

نظام متكامل لإدارة طلبات التمويل باستخدام **Firebase** كنظام backend.

## 🚀 التقنيات المستخدمة

| التقنية | الاستخدام |
|--------|----------|
| **React + TypeScript** | واجهة المستخدم |
| **Vite** | بناء المشروع |
| **TailwindCSS** | تنسيق الصفحات |
| **Firebase Firestore** | قاعدة البيانات |
| **Firebase Realtime Database** | تتبع المتصلين |
| **Firebase Auth** | مصادقة الأدمن |
| **Firebase Cloud Messaging** | الإشعارات الفورية |
| **Socket.io** | التواصل الفوري |

## 📁 هيكل المشروع

```
├── src/
│   ├── lib/
│   │   ├── firebase-config.ts    # إعدادات Firebase
│   │   ├── firestore.ts         # خدمات Firestore
│   │   ├── firebase-auth.ts     # خدمات المصادقة
│   │   ├── realtime-presence.ts # تتبع المتصلين
│   │   └── messaging.ts        # خدمات الإشعارات
│   ├── context/
│   │   ├── AdminAuthContext.tsx # سياق المصادقة
│   │   └── SiteConfigContext.tsx # سياق الإعدادات
│   └── pages/
│       ├── HomePage.tsx        # الصفحة الرئيسية
│       ├── RegisterPage.tsx    # صفحة التسجيل
│       ├── LoginPage.tsx       # صفحة الدخول
│       ├── VerifyPage.tsx      # صفحة التحقق
│       ├── AdminPage.tsx       # لوحة التحكم
│       └── AdminLoginPage.tsx  # دخول الأدمن
├── server/
│   ├── index.js                # Socket.io Server
│   └── firebase-service-account.json
├── .env                        # متغيرات البيئة
└── setup-firestore.js          # سكريبت تهيئة Firestore
```

## 🔧 التثبيت

### 1. تثبيت الاعتماديات
```bash
npm install
cd server && npm install
```

### 2. إعداد Firebase
1. أنشئ مشروع جديد في [Firebase Console](https://console.firebase.google.com)
2. فعّل **Firestore Database**
3. فعّل **Realtime Database**
4. فعّل **Authentication** (Email/Password)
5. فعّل **Cloud Messaging**
6. أنشئ **Web App** واحصل على الإعدادات

### 3. نسخ المتغيرات
```bash
cp .env.example .env
# عدّل .env بالإعدادات الخاصة بك
```

### 4. تشغيل السكريبت
```bash
npm run setup:firebase
```

### 5. تشغيل المشروع
```bash
# تشغيل الواجهة
npm run dev

# تشغيل السيرفر (في terminal آخر)
npm run server
```

## 🔐 بيانات الدخول للأدمن

- **البريد:** `admin@admin.com`
- **كلمة المرور:** `Aa123456@`

> ⚠️ غيّر كلمة المرور فوراً بعد أول تسجيل دخول!

## 📊 هيكل Firestore

### Collections

| Collection | الوصف |
|-----------|-------|
| `users` | بيانات العملاء |
| `loginAttempts` | سجل محاولات الدخول |
| `verificationCodes` | أكواد التحقق |
| `adminTokens` | توكنات FCM للأدمن |
| `siteConfig` | إعدادات الموقع |
| `formFields` | حقول النموذج |

### Realtime Database

| Path | الوصف |
|------|-------|
| `/presence/{clientId}` | حالة المتصلين |

## 🎯 الميزات

- ✅ تسجيل عملاء جدد
- ✅ نظام تحقق ثنائي
- ✅ لوحة تحكم للأدمن
- ✅ إشعارات فورية
- ✅ تتبع المتصلين
- ✅ إحصائيات حية
- ✅ إدارة المحتوى

## 📝 Environment Variables

```env
# Firebase Config
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_VAPID_KEY=

# Socket.io
VITE_SOCKET_URL=http://localhost:3001
```

## 🚀 النشر

### Frontend (Vercel/Railway)
```bash
npm run build
```

### Server (Railway)
1. أضف `FIREBASE_SERVICE_ACCOUNT` في Railway Variables
2. انشر من مجلد `server`

## 📄 الرخصة

MIT License
