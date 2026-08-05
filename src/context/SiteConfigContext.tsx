import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getSiteConfig, setSiteConfig, getFormFields, subscribeToSiteConfig, subscribeToFormFields, FormField } from '@/lib/firestore';
import { DEFAULT_FORM_FIELDS, DEFAULT_SITE_CONFIG } from '@/lib/defaultData';

// Default configuration
const DEFAULT_CONFIG = {
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

export type FormFieldType = {
  id?: string;
  pageKey: string;
  fieldKey: string;
  label: string;
  fieldType: string;
  placeholder?: string;
  required: boolean;
  isHidden: boolean;
  fieldOrder: number;
};

type SiteConfig = {
  home: any;
  register: any;
  login: any;
  verify: any;
  thankYou: any;
  waiting: any;
};

type SiteConfigContextType = {
  config: SiteConfig;
  formFields: FormFieldType[];
  updateConfig: (key: string, value: any) => Promise<void>;
  updateFormFields: (pageKey: string, fields: FormFieldType[]) => Promise<void>;
  loading: boolean;
};

const SiteConfigContext = createContext<SiteConfigContextType | undefined>(undefined);

export function SiteConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SiteConfig>(DEFAULT_CONFIG);
  const [formFields, setFormFields] = useState<FormFieldType[]>([]);
  const [loading, setLoading] = useState(true);

  // Load initial config and form fields
  useEffect(() => {
    loadInitialData();
  }, []);

  // Subscribe to real-time updates
  useEffect(() => {
    // Subscribe to home config
    const unsubHome = subscribeToSiteConfig('home', (value) => {
      if (value) {
        setConfig(prev => ({ ...prev, home: value }));
      }
    });

    // Subscribe to register config
    const unsubRegister = subscribeToSiteConfig('register', (value) => {
      if (value) {
        setConfig(prev => ({ ...prev, register: value }));
      }
    });

    // Subscribe to login config
    const unsubLogin = subscribeToSiteConfig('login', (value) => {
      if (value) {
        setConfig(prev => ({ ...prev, login: value }));
      }
    });

    // Subscribe to verify config
    const unsubVerify = subscribeToSiteConfig('verify', (value) => {
      if (value) {
        setConfig(prev => ({ ...prev, verify: value }));
      }
    });

    // Subscribe to thankYou config
    const unsubThankYou = subscribeToSiteConfig('thankYou', (value) => {
      if (value) {
        setConfig(prev => ({ ...prev, thankYou: value }));
      }
    });

    // Subscribe to waiting config
    const unsubWaiting = subscribeToSiteConfig('waiting', (value) => {
      if (value) {
        setConfig(prev => ({ ...prev, waiting: value }));
      }
    });

    // Subscribe to form fields
    const unsubFields = subscribeToFormFields('register', (fields) => {
      setFormFields(fields);
      setLoading(false);
    });

    return () => {
      unsubHome();
      unsubRegister();
      unsubLogin();
      unsubVerify();
      unsubThankYou();
      unsubWaiting();
      unsubFields();
    };
  }, []);

  const loadInitialData = async () => {
    try {
      // Load all configs
      const keys = ['home', 'register', 'login', 'verify', 'thankYou', 'waiting'];
      const configs: Partial<SiteConfig> = {};
      let hasAnyConfig = false;

      for (const key of keys) {
        const value = await getSiteConfig(key);
        if (value) {
          (configs as any)[key] = value;
          hasAnyConfig = true;
        }
      }

      // Use loaded configs or fall back to defaults
      if (hasAnyConfig) {
        setConfig(prev => ({ ...prev, ...configs }));
      } else {
        console.log('[SiteConfig] Using default config (no Firebase data found)');
        setConfig(DEFAULT_SITE_CONFIG);
      }

      // Load form fields
      const fields = await getFormFields('register');
      if (fields && fields.length > 0) {
        setFormFields(fields);
      } else {
        console.log('[SiteConfig] Using default form fields (no Firebase data found)');
        setFormFields(DEFAULT_FORM_FIELDS as any);
      }
    } catch (error) {
      console.error('Error loading site config:', error);
      // Use defaults on error
      setConfig(DEFAULT_SITE_CONFIG);
      setFormFields(DEFAULT_FORM_FIELDS as any);
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (key: string, value: any) => {
    try {
      await setSiteConfig(key, value);
      setConfig(prev => ({ ...prev, [key]: value }));
    } catch (error) {
      console.error('Error updating config:', error);
      throw error;
    }
  };

  const updateFormFields = async (pageKey: string, fields: FormFieldType[]) => {
    try {
      // Save all fields
      for (const field of fields) {
        await import('@/lib/firestore').then(({ saveFormField }) => {
          saveFormField({
            pageKey: field.pageKey,
            fieldKey: field.fieldKey,
            label: field.label,
            fieldType: field.fieldType,
            placeholder: field.placeholder,
            required: field.required,
            isHidden: field.isHidden,
            fieldOrder: field.fieldOrder,
          });
        });
      }
      
      // Update local state
      if (pageKey === 'register') {
        setFormFields(fields);
      }
    } catch (error) {
      console.error('Error updating form fields:', error);
      throw error;
    }
  };

  return (
    <SiteConfigContext.Provider
      value={{
        config,
        formFields,
        updateConfig,
        updateFormFields,
        loading,
      }}
    >
      {children}
    </SiteConfigContext.Provider>
  );
}

export function useSiteConfig() {
  const context = useContext(SiteConfigContext);
  if (context === undefined) {
    throw new Error('useSiteConfig must be used within a SiteConfigProvider');
  }
  return context;
}
