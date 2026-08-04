import { useState, useEffect, useCallback } from 'react';
import { Bell, Smartphone, CheckCircle, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { 
  requestPermissionAndGetToken, 
  getCurrentToken, 
  isSupported,
  getDeviceType,
  getDeviceName 
} from '@/lib/firebase';

interface NotificationPermissionProps {
  adminId: string;
  onComplete?: (success: boolean) => void;
  onSkip?: () => void;
}

export default function NotificationPermission({ 
  adminId, 
  onComplete, 
  onSkip 
}: NotificationPermissionProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceType] = useState(getDeviceType());

  // Check if already has token
  const checkExistingToken = useCallback(async () => {
    try {
      const existingToken = await getCurrentToken();
      if (existingToken) {
        // Check if token exists in database
        const { data } = await supabase
          .from('fcm_tokens')
          .select('id, is_active')
          .eq('admin_id', adminId)
          .eq('device_token', existingToken)
          .eq('is_active', true)
          .single();

        if (data) {
          // Token already exists and is active
          console.log('Notification already enabled for this device');
          onComplete?.(true);
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error('Error checking existing token:', err);
      return false;
    }
  }, [adminId, onComplete]);

  // Save token to database
  const saveTokenToDatabase = async (token: string) => {
    try {
      const { error: insertError } = await supabase
        .from('fcm_tokens')
        .upsert({
          admin_id: adminId,
          device_token: token,
          device_name: getDeviceName(),
          device_type: deviceType,
          is_active: true,
          last_used_at: new Date().toISOString(),
        }, {
          onConflict: 'admin_id,device_token',
        });

      if (insertError) {
        console.error('Error saving token to database:', insertError);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Error saving token:', err);
      return false;
    }
  };

  // Send test notification
  const sendTestNotification = async (token: string) => {
    try {
      // Call API to send test notification
      const response = await fetch('/api/send-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          title: '✅ تم تفعيل الإشعارات بنجاح!',
          body: 'ستصلك إشعارات فورية عند وجود طلبات جديدة.',
          data: {
            type: 'test',
            url: '/admin',
          },
        }),
      });

      if (!response.ok) {
        console.warn('Test notification failed, but token is saved');
      }

      return true;
    } catch (err) {
      console.warn('Could not send test notification:', err);
      // Token is saved, notification will come later
      return true;
    }
  };

  // Handle enable notifications
  const handleEnable = async () => {
    setLoading(true);
    setError(null);

    try {
      // Check if browser supports notifications
      if (!isSupported()) {
        setError('المتصفح لا يدعم الإشعارات. يرجى استخدام متصفح حديث.');
        setLoading(false);
        return;
      }

      // Request permission and get token
      const result = await requestPermissionAndGetToken();

      if (!result.success || !result.token) {
        setError(result.error || 'فشل في تفعيل الإشعارات');
        setLoading(false);
        return;
      }

      // Save token to database
      const saved = await saveTokenToDatabase(result.token);
      if (!saved) {
        setError('حدث خطأ في حفظ رمز الإشعارات');
        setLoading(false);
        return;
      }

      // Send test notification
      await sendTestNotification(result.token);

      // Success!
      setLoading(false);
      onComplete?.(true);
    } catch (err: any) {
      console.error('Error enabling notifications:', err);
      setError(err.message || 'حدث خطأ غير متوقع');
      setLoading(false);
    }
  };

  // Handle skip
  const handleSkip = () => {
    onSkip?.();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-700">
        {/* Close button */}
        <button 
          onClick={handleSkip}
          className="absolute top-4 left-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Icon */}
        <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Bell className="w-8 h-8 text-blue-400" />
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-white text-center mb-2">
          تفعيل الإشعارات
        </h2>

        {/* Description */}
        <p className="text-slate-400 text-sm text-center mb-4 leading-relaxed">
          احصل على إشعارات فورية عند وجود طلبات جديدة
          <br />
          حتى عند إغلاق المتصفح!
        </p>

        {/* Device Info */}
        <div className="bg-slate-700/50 rounded-xl p-3 mb-4 flex items-center gap-3">
          <Smartphone className="w-5 h-5 text-slate-400" />
          <div className="text-sm">
            <p className="text-white font-medium">{getDeviceName()}</p>
            <p className="text-slate-500 text-xs">الجهاز الحالي</p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}

        {/* Buttons */}
        <div className="space-y-3">
          {/* Enable Button */}
          <button
            onClick={handleEnable}
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-500/50 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>جارٍ التفعيل...</span>
              </>
            ) : (
              <>
                <Bell className="w-5 h-5" />
                <span>تفعيل الإشعارات</span>
              </>
            )}
          </button>

          {/* Skip Button */}
          <button
            onClick={handleSkip}
            className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-xl transition-all"
          >
            ليس الآن
          </button>
        </div>

        {/* Note for iOS */}
        {deviceType === 'ios' && (
          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <p className="text-amber-400 text-xs text-center">
              💡 ملاحظة: في iOS، قد تحتاج لإضافة هذا الموقع لشاشة الهاتف الرئيسية للحصول على الإشعارات
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
