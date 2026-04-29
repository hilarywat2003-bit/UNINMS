export type PlanKey = 'free' | 'basic' | 'standard' | 'premium' | 'enterprise';

export interface PlanFeatures {
  plagiarism:         boolean;
  semantic_search:    boolean;
  ai_insights:        boolean;
  research_pipeline:  boolean;
  knowledge_transfer: boolean;
  vc_dashboard:       boolean;
  tetfund_reports:    boolean;
  national_hub:       boolean;
  api_access:         boolean;
  sso:                boolean;
  custom_branding:    boolean;
  priority_support:   boolean;
}

export interface PlanDefinition {
  key:          PlanKey;
  label:        string;
  tagline:      string;
  priceNaira:   number;        // Annual price in ₦ (0 = free, -1 = custom)
  maxUsers:     number;        // -1 = unlimited
  maxStorageGb: number;        // -1 = unlimited
  plagiarismChecksPerMonth: number; // -1 = unlimited
  features:     PlanFeatures;
  badge:        string;        // Tailwind badge class
  highlight?:   boolean;       // Mark as popular
}

export const PLANS: Record<PlanKey, PlanDefinition> = {
  free: {
    key:          'free',
    label:        'Free',
    tagline:      'Get started at no cost',
    priceNaira:   0,
    maxUsers:     50,
    maxStorageGb: 5,
    plagiarismChecksPerMonth: 0,
    badge:        'badge-stone',
    features: {
      plagiarism:         false,
      semantic_search:    false,
      ai_insights:        false,
      research_pipeline:  false,
      knowledge_transfer: false,
      vc_dashboard:       false,
      tetfund_reports:    false,
      national_hub:       false,
      api_access:         false,
      sso:                false,
      custom_branding:    false,
      priority_support:   false,
    },
  },

  basic: {
    key:          'basic',
    label:        'Basic',
    tagline:      'For small institutions getting started',
    priceNaira:   250_000,
    maxUsers:     500,
    maxStorageGb: 25,
    plagiarismChecksPerMonth: 50,
    badge:        'badge-blue',
    features: {
      plagiarism:         true,
      semantic_search:    false,
      ai_insights:        false,
      research_pipeline:  true,
      knowledge_transfer: false,
      vc_dashboard:       false,
      tetfund_reports:    false,
      national_hub:       false,
      api_access:         false,
      sso:                false,
      custom_branding:    false,
      priority_support:   false,
    },
  },

  standard: {
    key:          'standard',
    label:        'Standard',
    tagline:      'Most popular for mid-size universities',
    priceNaira:   750_000,
    maxUsers:     2_000,
    maxStorageGb: 100,
    plagiarismChecksPerMonth: 500,
    badge:        'badge-green',
    highlight:    true,
    features: {
      plagiarism:         true,
      semantic_search:    true,
      ai_insights:        true,
      research_pipeline:  true,
      knowledge_transfer: true,
      vc_dashboard:       true,
      tetfund_reports:    false,
      national_hub:       false,
      api_access:         false,
      sso:                false,
      custom_branding:    false,
      priority_support:   true,
    },
  },

  premium: {
    key:          'premium',
    label:        'Premium',
    tagline:      'For large universities with full needs',
    priceNaira:   2_000_000,
    maxUsers:     10_000,
    maxStorageGb: 500,
    plagiarismChecksPerMonth: 2_000,
    badge:        'badge-purple',
    features: {
      plagiarism:         true,
      semantic_search:    true,
      ai_insights:        true,
      research_pipeline:  true,
      knowledge_transfer: true,
      vc_dashboard:       true,
      tetfund_reports:    true,
      national_hub:       true,
      api_access:         true,
      sso:                true,
      custom_branding:    true,
      priority_support:   true,
    },
  },

  enterprise: {
    key:          'enterprise',
    label:        'Enterprise',
    tagline:      'Unlimited scale — custom agreement',
    priceNaira:   -1,
    maxUsers:     -1,
    maxStorageGb: -1,
    plagiarismChecksPerMonth: -1,
    badge:        'badge-gold',
    features: {
      plagiarism:         true,
      semantic_search:    true,
      ai_insights:        true,
      research_pipeline:  true,
      knowledge_transfer: true,
      vc_dashboard:       true,
      tetfund_reports:    true,
      national_hub:       true,
      api_access:         true,
      sso:                true,
      custom_branding:    true,
      priority_support:   true,
    },
  },
};

export const PLAN_LIST = Object.values(PLANS);

export const FEATURE_LABELS: Record<keyof PlanFeatures, string> = {
  plagiarism:         'Plagiarism detection',
  semantic_search:    'AI semantic search',
  ai_insights:        'AI research insights',
  research_pipeline:  'Research pipeline',
  knowledge_transfer: 'Knowledge transfer',
  vc_dashboard:       'VC / management dashboard',
  tetfund_reports:    'TETFund reporting',
  national_hub:       'National research hub',
  api_access:         'API access',
  sso:                'Single sign-on (SSO)',
  custom_branding:    'Custom branding',
  priority_support:   'Priority support',
};

export function formatPrice(naira: number): string {
  if (naira === 0)  return 'Free';
  if (naira === -1) return 'Custom';
  return '₦' + naira.toLocaleString('en-NG') + '/yr';
}

export function formatLimit(n: number, unit = ''): string {
  if (n === -1) return 'Unlimited';
  return n.toLocaleString() + (unit ? ' ' + unit : '');
}
