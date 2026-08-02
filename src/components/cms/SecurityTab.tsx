import { useState } from 'react';
import { Shield, Mail, Lock, Eye, EyeOff, Save, Check, AlertCircle, User, RefreshCw } from 'lucide-react';
import { useAdminAuth } from '@/context/AdminAuthContext';

export default function SecurityTab() {
  const { admin, updateAdmin, logout } = useAdminAuth();
  
  // Current credentials (for verification)
  const [currentEmail, setCurrentEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  
  // New credentials
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  
  // States
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    // Validation
    if (!currentEmail.trim()) {
      setError('البريد الإلكتروني الحالي مطلوب');
      return;
    }
    if (!currentPassword) {
      setError('كلمة المرور الحالية مطلوبة');
      return;
    }
    
    if (newPassword) {
      if (newPassword.length < 6) {
        setError('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('كلمة المرور الجديدة غير متطابقة مع التاكيد');
        return;
      }
    }
    
    if (newEmail && !newEmail.includes('@')) {
      setError('البريد الإلكتروني الجديد غير صحيح');
      return;
    }

    setSaving(true);
    
    const result = await updateAdmin(
      currentEmail,
      currentPassword,
      newEmail || undefined,
      newPassword || undefined
    );
    
    setSaving(false);
    
    if (result.success) {
      setSuccess('تم تحديث البيانات بنجاح');
      // Clear form
      setCurrentEmail('');
      setCurrentPassword('');
      setNewEmail('');
      setNewPassword('');
      setConfirmPassword('');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      setError(result.error || 'حدث خطأ أثناء تحديث البيانات');
    }
  };

  const handleLogout = () => {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
      logout();
    }
  };

  return (
    <div className="space-y-6">
      {/* Account Info */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-blue-400" />
            <h3 className="font-semibold text-white text-sm">معلومات الحساب</h3>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-red-600/20 text-red-400 hover:bg-red-600/30 text-sm font-semibold rounded-xl transition-colors"
          >
            تسجيل الخروج
          </button>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center">
              <User className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="font-bold text-white">{admin?.name || 'مدير النظام'}</p>
              <p className="text-slate-400 text-sm">{admin?.email}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Change Credentials */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            <h3 className="font-semibold text-white text-sm">تغيير البريد وكلمة المرور</h3>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Current Credentials Section */}
          <div className="border-b border-slate-700 pb-5">
            <h4 className="text-sm font-semibold text-slate-400 mb-4 flex items-center gap-2">
              <Lock className="w-4 h-4" />
              البيانات الحالية (للتأكيد)
            </h4>
            
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Mail className="w-3 h-3" />
                  البريد الإلكتروني الحالي
                </label>
                <input
                  type="email"
                  value={currentEmail}
                  onChange={(e) => setCurrentEmail(e.target.value)}
                  placeholder={admin?.email || 'admin@example.com'}
                  dir="ltr"
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Lock className="w-3 h-3" />
                  كلمة المرور الحالية
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    dir="ltr"
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 pr-10 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* New Credentials Section */}
          <div>
            <h4 className="text-sm font-semibold text-slate-400 mb-4 flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              البيانات الجديدة (اختياري)
            </h4>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Mail className="w-3 h-3" />
                  البريد الإلكتروني الجديد
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="اتركه فارغاً إذا لا تريد تغييره"
                  dir="ltr"
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                    <Lock className="w-3 h-3" />
                    كلمة المرور الجديدة
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="اتركها فارغة إذا لا تريد تغييرها"
                      dir="ltr"
                      className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 pr-10 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                    >
                      {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                    <Lock className="w-3 h-3" />
                    تأكيد كلمة المرور الجديدة
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPass ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="أعد إدخال كلمة المرور الجديدة"
                      dir="ltr"
                      className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 pr-10 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                    >
                      {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}
          
          {success && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
              <Check className="w-5 h-5 text-green-400 shrink-0" />
              <p className="text-sm text-green-300">{success}</p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all ${
                saved
                  ? 'bg-green-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              } disabled:opacity-50`}
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : saved ? (
                <Check className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? 'جارٍ الحفظ...' : saved ? 'تم الحفظ' : 'حفظ التغييرات'}
            </button>
          </div>
        </form>
      </div>

      {/* Security Info */}
      <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h4 className="font-semibold text-white mb-1">معلومات الأمان</h4>
            <ul className="text-sm text-slate-400 space-y-1">
              <li>• نظام الحماية: 5 محاولات فقط ثم قفل لمدة ساعة</li>
              <li>• جميع محاولات الدخول مسجلة ومراقبة</li>
              <li>• يجب تأكيد البيانات الحالية عند تغيير أي معلومة</li>
              <li>• كلمة المرور يجب أن تكون 6 أحرف على الأقل</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
