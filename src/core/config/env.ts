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

    // CONNECT-1 (C1-0): webhook separado para eventos de cuentas conectadas
    // (account.updated + checkout.session.completed de direct charges) y fee
    // de plataforma en basis points (90 = 0,9 %, W1/D3 del master).
    STRIPE_CONNECT_WEBHOOK_SECRET: process.env.STRIPE_CONNECT_WEBHOOK_SECRET || '',
    APPLICATION_FEE_BPS: Number(process.env.APPLICATION_FEE_BPS || 90),
  
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
    // Número REAL del bot de YaQu en formato internacional sin '+' (ej. 34XXXXXXXXX),
    // para los enlaces wa.me del perfil público (QR → bot con el merchant en el texto).
    // No es secreto (es el número al que escriben los clientes). Vacío → cae al WhatsApp del pro.
    WHATSAPP_BOT_PHONE: (process.env.WHATSAPP_BOT_PHONE || '').replace(/\D/g, ''),
    WHATSAPP_BUSINESS_ACCOUNT_ID: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
    WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN || '',
    WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN || '',
    // App Secret de Meta — si está presente, validamos la firma X-Hub-Signature-256 del webhook
    WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET || '',

    // Mercado Pago
    MP_ACCESS_TOKEN:    process.env.MP_ACCESS_TOKEN    || '',
    MP_WEBHOOK_SECRET:  process.env.MP_WEBHOOK_SECRET  || '',

    // Asistente IA (sugerir líneas + mensaje). Preferencia: Gemini (tier gratis)
    // > Claude (fallback). Si ninguna está configurada, el asistente responde 503.
    ANTHROPIC_API_KEY:  process.env.ANTHROPIC_API_KEY  || '',
    GEMINI_API_KEY:     process.env.GEMINI_API_KEY     || '',
    // Lista de modelos a probar EN ORDEN (coma). Si el 1º tiene cuota gratis a 0
    // o no existe, se pasa al siguiente. Override con GEMINI_MODEL en Railway.
    GEMINI_MODEL:       process.env.GEMINI_MODEL       || 'gemini-2.5-flash,gemini-2.0-flash,gemini-flash-latest',

    // Cuentas "owner" exentas del límite de prueba: se tratan como Pro activo y
    // sin caducidad (no afecta a los demás merchants). Lista de emails separada
    // por comas, normalizada a minúsculas. Ej: "luis@yaqu.app,otro@yaqu.app".
    OWNER_EMAILS: (process.env.OWNER_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),

    // A3.2 (PV-WA-CAPS) · Topes anti-abuso del número compartido de WhatsApp:
    // máximo de PLANTILLAS iniciadas por negocio al día por merchant, y tope
    // duro J6 de mensajes-iniciados-por-negocio por cliente y día.
    WA_DAILY_TEMPLATE_CAP: Number(process.env.WA_DAILY_TEMPLATE_CAP || 100),
    WA_CUSTOMER_DAILY_CAP: Number(process.env.WA_CUSTOMER_DAILY_CAP || 3),

    // V0-2 · Modo demo seguro: números a los que el merchant demo SÍ puede enviar
    // WhatsApp (separados por comas; admite con y sin prefijo de país). Lista vacía
    // = el demo no puede enviar a NADIE (anti-spam duro).
    DEMO_SAFE_NUMBERS: (process.env.DEMO_SAFE_NUMBERS || '')
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean),
  } as const;

  // ¿El email pertenece a una cuenta owner exenta del paywall de prueba?
  export function isOwnerEmail(email?: string | null): boolean {
    if (!email) return false;
    return config.OWNER_EMAILS.includes(email.trim().toLowerCase());
  }

  export const BASE_URL = config.PUBLIC_BASE_URL;
  