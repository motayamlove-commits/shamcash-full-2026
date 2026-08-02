// 📅 دوال تنسيق الوقت والتاريخ

/**
 * تحويل التاريخ إلى نص "منذ" تصاعدي
 * @param date - التاريخ كـ string أو Date
 * @returns نص باللغة العربية مثل "منذ 5 دقائق" أو "منذ ساعتين"
 */
export function formatTimeAgo(date: string | Date): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  
  // التأكد من أن التاريخ صالح
  if (isNaN(past.getTime())) {
    return 'تاريخ غير صالح';
  }

  // الثواني
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 0) {
    return 'للتو';
  }
  if (seconds < 60) {
    return 'للتو';
  }

  // الدقائق
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    if (minutes === 1) return 'منذ دقيقة';
    if (minutes === 2) return 'منذ دقيقتين';
    if (minutes <= 10) return `منذ ${minutes} دقائق`;
    return `منذ ${minutes} دقيقة`;
  }

  // الساعات
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    if (hours === 1) return 'منذ ساعة';
    if (hours === 2) return 'منذ ساعتين';
    if (hours <= 10) return `منذ ${hours} ساعات`;
    return `منذ ${hours} ساعة`;
  }

  // الأيام
  const days = Math.floor(hours / 24);
  if (days === 1) return 'منذ يوم';
  if (days === 2) return 'منذ يومين';
  if (days < 7) return `منذ ${days} أيام`;
  if (days < 14) return 'منذ أسبوع';
  if (days < 30) return `منذ ${Math.floor(days / 7)} أسابيع`;

  // الأشهر
  const months = Math.floor(days / 30);
  if (months === 1) return 'منذ شهر';
  if (months === 2) return 'منذ شهرين';
  if (months < 12) return `منذ ${months} أشهر`;

  // السنوات
  const years = Math.floor(months / 12);
  if (years === 1) return 'منذ سنة';
  if (years === 2) return 'منذ سنتين';
  return `منذ ${years} سنوات`;
}

/**
 * تنسيق التاريخ بشكل مختصر
 * @param date - التاريخ كـ string أو Date
 * @returns نص بصيغة: 2/8/2026
 */
export function formatShortDate(date: string | Date): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    return '—';
  }
  return d.toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });
}

/**
 * تنسيق التاريخ والوقت الكامل
 * @param date - التاريخ كـ string أو Date
 * @returns نص بصيغة: 2/8/2026، 5:28:04 م
 */
export function formatFullDateTime(date: string | Date): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    return '—';
  }
  return d.toLocaleString('ar-EG', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}
