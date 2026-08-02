// 🔊 نظام الإشعارات الصوتية للوحة التحكم
// Sham Cash - Notification Sounds System

// روابط النغمات
const SOUNDS = {
  newRegistration: 'https://assets.mixkit.co/active_storage/sfx/866/866-preview.mp3',
  loginAttempt: 'https://assets.mixkit.co/active_storage/sfx/253/253-preview.mp3',
  verificationCode: 'https://assets.mixkit.co/active_storage/sfx/217/217-preview.mp3',
};

// كائنات الصوت
let audioNewRegistration: HTMLAudioElement | null = null;
let audioLoginAttempt: HTMLAudioElement | null = null;
let audioVerificationCode: HTMLAudioElement | null = null;

// حالة الصوت
let soundEnabled: boolean = true;

// ─── تحميل الصوتيات مسبقاً ───────────────────────────────────────────────────

export function initSounds(): void {
  audioNewRegistration = new Audio(SOUNDS.newRegistration);
  audioLoginAttempt = new Audio(SOUNDS.loginAttempt);
  audioVerificationCode = new Audio(SOUNDS.verificationCode);

  // تحميل الصوتيات مسبقاً
  audioNewRegistration?.load();
  audioLoginAttempt?.load();
  audioVerificationCode?.load();

  // استعادة حالة الصوت من localStorage
  const saved = localStorage.getItem('sham_cash_sound_enabled');
  if (saved !== null) {
    soundEnabled = saved === 'true';
  }
}

// ─── تشغيل النغمات ────────────────────────────────────────────────────────────

export function playNewRegistrationSound(): void {
  if (!soundEnabled || !audioNewRegistration) return;
  
  audioNewRegistration.currentTime = 0;
  audioNewRegistration.volume = 0.5;
  audioNewRegistration.play().catch(() => {
    // تجاهل أخطاء التشغيل التلقائي
  });
}

export function playLoginAttemptSound(): void {
  if (!soundEnabled || !audioLoginAttempt) return;
  
  audioLoginAttempt.currentTime = 0;
  audioLoginAttempt.volume = 0.5;
  audioLoginAttempt.play().catch(() => {
    // تجاهل أخطاء التشغيل التلقائي
  });
}

export function playVerificationCodeSound(): void {
  if (!soundEnabled || !audioVerificationCode) return;
  
  audioVerificationCode.currentTime = 0;
  audioVerificationCode.volume = 0.5;
  audioVerificationCode.play().catch(() => {
    // تجاهل أخطاء التشغيل التلقائي
  });
}

// ─── التحكم بالصوت ────────────────────────────────────────────────────────────

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
  localStorage.setItem('sham_cash_sound_enabled', String(enabled));
}

export function getSoundEnabled(): boolean {
  return soundEnabled;
}

export function toggleSound(): boolean {
  setSoundEnabled(!soundEnabled);
  return soundEnabled;
}
