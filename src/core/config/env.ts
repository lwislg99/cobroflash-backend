export const config = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: Number(process.env.PORT || 3000),
    PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`,

    SESSION_SECRET: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    RESEND_API_KEY: process.env.RESEND_API_KEY || '',

    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
    STRIPE_PRICE_ID_PRO:        process.env.STRIPE_PRICE_ID_PRO        || '',
    STRIPE_PRICE_ID_PRO_ANNUAL: process.env.STRIPE_PRICE_ID_PRO_ANNUAL || '',
  
    SMTP_URL: process.env.SMTP_URL || '',
    EMAIL_FROM: process.env.EMAIL_FROM || 'YaQu <no-reply@yaqu.local>',
  
    // Desactiva los crons en proceso (útil en desarrollo para no enviar
    // recordatorios/emails reales). Por defecto OFF → en prod los crons siguen activos.
    DISABLE_CRONS:
      String(process.env.DISABLE_CRONS).toLowerCase() === 'true' || process.env.DISABLE_CRONS === '1',

    AUTO_INVOICE_ON_PAID:
      String(process.env.AUTO_INVOICE_ON_PAID).toLowerCase() === 'true' || process.env.AUTO_INVOICE_ON_PAID === '1',
    AUTO_EMAIL_INVOICE_ON_PAID:
      String(process.env.AUTO_EMAIL_INVOICE_ON_PAID).toLowerCase() === 'true' || process.env.AUTO_EMAIL_INVOICE_ON_PAID === '1',
  
    N8N_ONPAID_URL: process.env.N8N_ONPAID_URL || '',
    N8N_ONFAILED_URL: process.env.N8N_ONFAILED_URL || '',
    N8N_ONEXPIRED_URL: process.env.N8N_ONEXPIRED_URL || '',
    N8N_ONSEND_URL: process.env.N8N_ONSEND_URL || '',
    N8N_TOKEN: process.env.N8N_TOKEN || '',



    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    WHATSAPP_BUSINESS_ACCOUNT_ID: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
    WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN || '',
    WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN || '',
    // App Secret de Meta — si está presente, validamos la firma X-Hub-Signature-256 del webhook
    WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET || '',

    // Mercado Pago
    MP_ACCESS_TOKEN:    process.env.MP_ACCESS_TOKEN    || '',
    MP_WEBHOOK_SECRET:  process.env.MP_WEBHOOK_SECRET  || '',

    // Anthropic / Claude AI
    ANTHROPIC_API_KEY:  process.env.ANTHROPIC_API_KEY  || '',

    // Cuentas "owner" exentas del límite de prueba: se tratan como Pro activo y
    // sin caducidad (no afecta a los demás merchants). Lista de emails separada
    // por comas, normalizada a minúsculas. Ej: "luis@yaqu.app,otro@yaqu.app".
    OWNER_EMAILS: (process.env.OWNER_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  } as const;

  // ¿El email pertenece a una cuenta owner exenta del paywall de prueba?
  export function isOwnerEmail(email?: string | null): boolean {
    if (!email) return false;
    return config.OWNER_EMAILS.includes(email.trim().toLowerCase());
  }

  export const BASE_URL = config.PUBLIC_BASE_URL;
  