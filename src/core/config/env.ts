export const config = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: Number(process.env.PORT || 3000),
    PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`,

    SESSION_SECRET: process.env.SESSION_SECRET || 'dev-secret-change-in-production',

    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
    STRIPE_PRICE_ID_BASIC:   process.env.STRIPE_PRICE_ID_BASIC   || '',
    STRIPE_PRICE_ID_PRO:     process.env.STRIPE_PRICE_ID_PRO     || '',
    STRIPE_PRICE_ID_EMPRESA: process.env.STRIPE_PRICE_ID_EMPRESA || '',
  
    SMTP_URL: process.env.SMTP_URL || '',
    EMAIL_FROM: process.env.EMAIL_FROM || 'CobroFlash <no-reply@cobroflash.local>',
  
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
  } as const;
  
  export const BASE_URL = config.PUBLIC_BASE_URL;
  