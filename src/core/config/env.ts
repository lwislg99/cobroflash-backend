// SCRUM-247: el id del sistema informático es una CONSTANTE del repo, no una variable de
// entorno. Se importa para poder validarlo en el arranque.
import { VERIFACTU_ID_SISTEMA } from '../../modules/fiscal/verifactu/productor';

export const config = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: Number(process.env.PORT || 3000),
    PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`,

    // SCRUM-45: identificador de build para el aviso de versión nueva (/version y /health).
    // Railway inyecta RAILWAY_GIT_COMMIT_SHA en cada deploy; fallback (dev/local) = arranque del proceso.
    BUILD_ID: process.env.RAILWAY_GIT_COMMIT_SHA || String(Date.now()),

    RESEND_API_KEY: process.env.RESEND_API_KEY || '',
    // SCRUM-475 (fase 2B): el secreto del webhook de entregas y rebotes. Sin él el receptor es
    // fail-closed y lo dice como `NO_SE_PUDO_COMPROBAR`, que NO es «firma inválida».
    RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET || '',

    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
    STRIPE_PRICE_ID_PRO:        process.env.STRIPE_PRICE_ID_PRO        || '',
    STRIPE_PRICE_ID_PRO_ANNUAL: process.env.STRIPE_PRICE_ID_PRO_ANNUAL || '',

    // CONNECT-1 (C1-0): webhook separado para eventos de cuentas conectadas
    // (account.updated + checkout.session.completed de direct charges) y fee
    // de plataforma en basis points (90 = 0,9 %, W1/D3 del master).
    STRIPE_CONNECT_WEBHOOK_SECRET: process.env.STRIPE_CONNECT_WEBHOOK_SECRET || '',
    APPLICATION_FEE_BPS: Number(process.env.APPLICATION_FEE_BPS || 90),

    // SCRUM-247: las cinco `VERIFACTU_PRODUCTOR_*` YA NO SE LEEN DE AQUÍ.
    //
    // Vivían en este bloque leyéndose de `process.env` con `|| ''`, y por tanto en el panel de
    // Railway: estaban en staging y NO en producción, así que encender la facturación no habría
    // emitido nada. Ahora son CONSTANTES VERSIONADAS en
    // `src/modules/fiscal/verifactu/productor.ts` — cambiar el NIF del productor es un hecho
    // fiscal, no configuración, y como constante aparece en un diff, se revisa y queda fechado.
    //
    // No se dejan aquí «por compatibilidad»: dos sitios con el mismo dato es exactamente el
    // patrón que este ticket desmonta. Un guard impide que vuelvan a `process.env`.

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
  
    // SCRUM-129: env vars de n8n RETIRADAS (n8n viola la regla nº1: WhatsApp = Meta Cloud API
    // directa, jamás n8n). Eran código muerto; el guard estructural vive en scrum129-n8n-guard
    // (busca el prefijo de env var, escrito con guion bajo, que aquí no repito para no auto-marcarme).



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

  // SCRUM-102: gate REAL de "cuenta owner" para todo lo sensible (fees.csv = facturación
  // de TODA la plataforma, platform-funnel, paywall/plan). Dos factores independientes:
  // email en OWNER_EMAILS (env var, se puede escribir mal o vaciar sin que nadie se
  // entere — precedente SCRUM-99) Y Merchant.isPlatformOwner en BD (default false,
  // requiere un UPDATE explícito, no se activa "por accidente"). AMBOS, no uno u otro.
  export function isVerifiedPlatformOwner(merchant?: { email?: string | null; isPlatformOwner?: boolean | null } | null): boolean {
    if (!merchant) return false;
    return isOwnerEmail(merchant.email) && merchant.isPlatformOwner === true;
  }

  // SCRUM-99: aviso de arranque en producción si falta algún secreto de webhook. Los
  // handlers ya son fail-closed (rechazan sin el secreto) — esto es para descubrirlo en
  // los logs de despliegue, no cuando llega la primera petición falsificada o el primer
  // webhook legítimo empieza a fallar.
  export function warnMissingWebhookSecrets(): void {
    if (config.NODE_ENV !== 'production') return;
    const required: Array<[string, string]> = [
      ['STRIPE_WEBHOOK_SECRET', config.STRIPE_WEBHOOK_SECRET],
      ['STRIPE_CONNECT_WEBHOOK_SECRET', config.STRIPE_CONNECT_WEBHOOK_SECRET],
      ['MP_WEBHOOK_SECRET', config.MP_WEBHOOK_SECRET],
      ['WHATSAPP_APP_SECRET', config.WHATSAPP_APP_SECRET],
      // SCRUM-475 (fase 2B): sin él, TODO aviso de entrega o rebote se rechaza (fail-closed) y el
      // embudo del correo se queda mudo. Que salga en el ARRANQUE es justo lo que hace falta: el
      // síntoma —que no llega ningún aviso— es indistinguible de «no ha rebotado nada».
      ['RESEND_WEBHOOK_SECRET', config.RESEND_WEBHOOK_SECRET],
    ];
    const missing = required.filter(([, value]) => !value).map(([name]) => name);
    if (missing.length) {
      console.error(
        `🚨 [webhooks] FALTAN secretos en producción: ${missing.join(', ')} — esos webhooks ` +
        `RECHAZARÁN todas las peticiones (fail-closed) hasta que se configuren en Railway.`,
      );
    }
  }

  // SCRUM-102: mismo patrón que warnMissingWebhookSecrets — aviso ruidoso al arrancar en
  // producción si OWNER_EMAILS está vacía. isVerifiedPlatformOwner() ya es fail-closed
  // (sin email en la lista, nadie pasa), pero eso también significa que las cuentas owner
  // reales (fees.csv, paywall, platform-funnel) dejarían de funcionar en SILENCIO — mejor
  // descubrirlo en el log de arranque que cuando el fundador no puede ver su propia
  // facturación.
  export function warnEmptyOwnerEmails(): void {
    if (config.NODE_ENV !== 'production') return;
    if (config.OWNER_EMAILS.length === 0) {
      console.error(
        `🚨 [owner] OWNER_EMAILS está vacía en producción — ninguna cuenta pasará ` +
        `isVerifiedPlatformOwner() (paywall/fees.csv/platform-funnel) hasta que se configure en Railway.`,
      );
    }
  }

  /**
   * SCRUM-163 — ¿`PUBLIC_BASE_URL` es una URL de verdad?
   *
   * Devuelve el motivo del rechazo, o `null` si está bien. PURA a propósito: así se puede
   * probar sin arrancar nada ni tocar `process.env`.
   *
   * NACE DE un fallo real: staging tenía el **placeholder literal de las instrucciones**
   * (`https://<TU-URL-DE-STAGING>`). Como `BASE_URL` es la raíz de TODO enlace absoluto que
   * genera el sistema, eso dejó rotos los enlaces de pago, los recibos y los magic links de
   * acceso e invitación — y encima tumbó `confirm-bizum`, que se llama a sí mismo por
   * `${BASE_URL}/webhooks/psp` (500, el pro no podía confirmar un Bizum cobrado de verdad).
   *
   * Por qué no se vio antes: el arranque YA imprimía el valor (`listening on …`) y nadie lo
   * leyó, y los E2E construyen las URLs por su cuenta con el host bueno — así que solo falla
   * lo que genera el SERVIDOR, que es el camino menos probado.
   */
  export function invalidPublicBaseUrl(value: string): string | null {
    const v = (value || '').trim();
    if (!v) return 'está vacía';
    // Marcadores de plantilla sin sustituir. `<`/`>` cubre cualquier <PON-AQUI-LO-TUYO>.
    if (/[<>]/.test(v)) return `parece un placeholder sin sustituir: ${v}`;
    if (/TU-URL|TU_URL|EXAMPLE\.COM|CAMBIAME/i.test(v)) return `parece un valor de ejemplo: ${v}`;
    let url: URL;
    try {
      url = new URL(v);
    } catch {
      return `no es una URL válida: ${v}`;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return `no es http/https: ${v}`;
    if (!url.hostname) return `no tiene host: ${v}`;
    return null;
  }

  /**
   * SCRUM-163 — a diferencia de los dos `warn*` de arriba, esto **REVIENTA**.
   *
   * Un secreto que falta degrada una función (el webhook rechaza, el owner no ve su
   * facturación); una `PUBLIC_BASE_URL` inválida envenena en SILENCIO todo lo que el sistema
   * manda al cliente final — enlaces de pago que no abren, invitaciones que no entran— y no da
   * ninguna señal hasta que alguien se queja. Arrancar con eso mal es peor que no arrancar.
   *
   * En dev/local se deja pasar con aviso: el default es `http://localhost:PORT` y nadie manda
   * enlaces desde ahí.
   */
  export function assertPublicBaseUrl(): void {
    const motivo = invalidPublicBaseUrl(config.PUBLIC_BASE_URL);
    if (!motivo) return;
    const msg =
      `🚨 [config] PUBLIC_BASE_URL ${motivo}. Es la raíz de TODO enlace que el sistema envía ` +
      `(pagos, recibos, magic links de acceso e invitación) y de la llamada interna de ` +
      `confirm-bizum. Configúrala en Railway con la URL real del entorno.`;
    if (config.NODE_ENV === 'production') throw new Error(msg);
    console.warn(msg);
  }

  /**
   * SCRUM-217 (AEAT 1177) — `VERIFACTU_ID_SISTEMA` es fail-open de manual arriba: el `|| ''`
   * convierte «no configurado» en «configurado a vacío» y sigue.
   *
   * La AEAT exige EXACTAMENTE dos posiciones, cada una letra mayúscula (salvo la Ñ) o dígito.
   * Un valor vacío ya lo para el emisor (`verifactu_productor_no_configurado`), pero un valor
   * PRESENTE Y MAL —`abc`, `a`, `ñ1`, `a1`— pasa ese guard y llega a la AEAT como error 1177.
   * Ese es el hueco de verdad: lo que no está no engaña a nadie; lo que está mal, sí.
   *
   * PURA para poder probarla con el valor exacto sin tocar `process.env`.
   */
  export function invalidVerifactuIdSistema(value: string | undefined | null): string | null {
    const v = (value ?? '').trim();
    if (!v) return 'no está configurado';
    if (v.length !== 2) return `debe tener EXACTAMENTE 2 caracteres (tiene ${v.length}: ${JSON.stringify(v)})`;
    if (!/^[0-9A-Z]{2}$/.test(v) || v.includes('Ñ')) {
      return `solo admite mayúsculas (salvo Ñ) o dígitos: ${JSON.stringify(v)}`;
    }
    return null;
  }

  /**
   * Arranque: revienta si el id del sistema no es válido.
   *
   * ⚠️ SCRUM-247 RETIRÓ LA ASIMETRÍA QUE HABÍA AQUÍ, y merece explicarse porque era deliberada:
   * antes la AUSENCIA solo se avisaba por log y solo el valor MALFORMADO reventaba. El motivo era
   * que las cinco `VERIFACTU_*` iban vacías a propósito y hacer que la ausencia reventase habría
   * tumbado producción en el arranque siguiente.
   *
   * Con el productor en constantes versionadas, **la ausencia ya no puede ocurrir en tiempo de
   * ejecución**: una constante vacía se caza en el PR (`tests/scrum247-productor-constante.test.mjs`),
   * no en el arranque. Así que aquí ya no hace falta tolerarla — y seguir tolerándola sería
   * mantener una excepción cuyo motivo desapareció.
   */
  export function assertVerifactuIdSistema(): void {
    const motivo = invalidVerifactuIdSistema(VERIFACTU_ID_SISTEMA);
    if (!motivo) return;
    const msg =
      `🚨 [verifactu] VERIFACTU_ID_SISTEMA ${motivo}. La AEAT lo rechaza con el error 1177 y el ` +
      `emisor NO puede detectarlo (solo comprueba que no esté vacío). Es una CONSTANTE del repo ` +
      `(src/modules/fiscal/verifactu/productor.ts): corrígela ahí, no en Railway.`;
    if (config.NODE_ENV === 'production') throw new Error(msg);
    console.warn(msg);
  }

  export const BASE_URL = config.PUBLIC_BASE_URL;
  