// Default form fields for the registration page
export const DEFAULT_FORM_FIELDS = [
  {
    fieldKey: 'fullName',
    label: 'الاسم الكامل',
    fieldType: 'text',
    placeholder: 'أدخل اسمك الكامل',
    required: true,
    isHidden: false,
    fieldOrder: 1,
    pageKey: 'register',
  },
  {
    fieldKey: 'email',
    label: 'البريد الإلكتروني',
    fieldType: 'email',
    placeholder: 'example@email.com',
    required: true,
    isHidden: false,
    fieldOrder: 2,
    pageKey: 'register',
  },
  {
    fieldKey: 'phone',
    label: 'رقم الهاتف',
    fieldType: 'tel',
    placeholder: '09XXXXXXXX',
    required: true,
    isHidden: false,
    fieldOrder: 3,
    pageKey: 'register',
  },
  {
    fieldKey: 'nationalId',
    label: 'رقم الهوية',
    fieldType: 'text',
    placeholder: 'أدخل رقم الهوية الوطنية',
    required: true,
    isHidden: false,
    fieldOrder: 4,
    pageKey: 'register',
  },
  {
    fieldKey: 'dateOfBirth',
    label: 'تاريخ الميلاد',
    fieldType: 'date',
    placeholder: '',
    required: true,
    isHidden: false,
    fieldOrder: 5,
    pageKey: 'register',
  },
];

// Default site config
export const DEFAULT_SITE_CONFIG = {
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
