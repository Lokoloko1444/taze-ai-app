/**
 * Core configuration constants for the Taze server.
 * Centralized configuration for models, timeouts, and rate limits.
 */

module.exports = {
  // AI Model Configuration
  MODELS: {
    DEFAULT: 'gpt-4.1',
    RIA: 'gpt-5.4-mini',
    FALLBACK: 'gpt-5.4-mini',
  },

  // Timeout & Cooldown Settings (milliseconds)
  TIMEOUTS: {
    OPENAI_AUTH_COOLDOWN_MS: 15 * 60 * 1000, // 15 minutes
    BARCODE_CACHE_TTL_MS: 10 * 60 * 1000,     // 10 minutes
    HEALTH_CHECK_CACHE_MS: 5 * 60 * 1000,     // 5 minutes for healthy status
    HEALTH_CHECK_ERROR_CACHE_MS: 60 * 1000,   // 1 minute for errors
    OPENAI_HEALTH_CHECK_TIMEOUT_MS: 5000,     // 5 seconds
  },

  // Recognition & Product Lookup Limits
  RECOGNITION: {
    BARCODE_CACHE_MAX: 200,                    // Max barcodes to cache
    MAX_BARCODE_LENGTH: 128,
    MAX_IMAGE_URI_LENGTH: 2048,
    MAX_IMAGE_BASE64_LENGTH: 512 * 1024,       // 512 KB
    RATE_LIMIT_WINDOW_MS: 60 * 1000,           // 1 minute
    RATE_LIMIT_MAX_REQUESTS: 10,               // 10 requests per minute
  },

  // API Request Limits
  API: {
    MAX_JSON_PAYLOAD_SIZE: '1mb',
  },

  // Default Values
  DEFAULTS: {
    SUPPORT_EMAIL: 'lgstudio144@gmail.com',
    SUPPORT_NAME: 'Taze',
    APP_URL: 'https://app.taze.to',
    BREVO_SENDER_EMAIL: 'hello@taze.to',
    BILLING_INTERVAL: 'month',
    CURRENCY: 'EUR',
    NODE_ENV: 'development',
    PORT: 3000,
    DEMO_MODE: false,
  },

  // Route Mappings by Screen
  ROUTE_BY_SCREEN: {
    account: '/account',
    contact: '/contact',
    newsletter: '/newsletter',
    payments: '/payments',
    partners: '/partners',
    privacy: '/privacy',
    security: '/security',
    services: '/services',
    support: '/support',
    helpdesk: '/support',
    trace: '/trace',
    transport: '/transport',
    updates: '/updates',
  },

  DEFAULT_ROUTE: '/explore',

  // Stripe Configuration
  STRIPE: {
    WEBHOOK_ALLOWED_EVENTS: ['checkout.session.completed'],
    REFUND_APPROVAL_EXPIRY_DAYS: 7,
    API_VERSION: '2026-02-25.clover',
  },

  // Environment Variables to Load at Runtime
  RUNTIME_ENV_KEYS: [
    'NODE_ENV',
    'PORT',
    'OPENAI_API_KEY',
    'OPENAI_MODEL',
    'AI_MODEL',
    'RIA_MODEL',
    'EXPO_PUBLIC_APP_URL',
    'EXPO_PUBLIC_API_URL',
    'EXPO_PUBLIC_SERVER_URL',
    'EXPO_PUBLIC_DEMO_MODE',
    'EXPO_PUBLIC_ENABLE_INTERNAL_TOOLS',
    'EXPO_PUBLIC_REQUIRE_LOGIN',
    'EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'BREVO_ENABLED',
    'BREVO_API_KEY',
    'BREVO_LIST_ID',
    'BREVO_SENDER_EMAIL',
    'BREVO_SENDER_NAME',
    'CORS_ORIGINS',
    'RETURN_URL_ORIGINS',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
  ],
};
