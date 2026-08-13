// src/modules/messaging/domain/lifecycle.service.ts
// Sistema de emails del ciclo de vida del usuario (Sprint EMAIL).
//  - Bienvenida: al registrarse (sendWelcomeEmail)
//  - Día 3 / 7 / 12 / expirado / inactivo: cron diario (runLifecycleEmails)
//  - Primer pago: al confirmar suscripción (sendFirstPaymentEmail)
// Evita duplicados con el campo Merchant.lifecycleEmailsSent (Json).
import { prisma } from '../../../core/db/prisma';
import { config } from '../../../core/config/env';
import { maskEmail } from '../../../core/utils/utils';
import { enviarCorreo, ResultadoCorreo, resultadoSinDestino } from '../../../integrations/enviarCorreo';
// SCRUM-475 · un aviso que no sale deja constancia, y NO se marca como enviado.
import { dejarConstancia, parteNuevo, type ParteDeAvisos } from './avisoConstancia';
// SCRUM-508: la clase de correo sale del vocabulario cerrado, no de un literal a mano.
import { CLASES_DE_CORREO } from './registroDeEnvios';

const DASHBOARD_URL = `${config.PUBLIC_BASE_URL || 'https://yaqu.app'}/dashboard/`;

// SCRUM-475 · el POST propio se retira: hay UN emisor, y su respuesta se DEVUELVE con el acuse del
// proveedor en vez de tirarse. Antes esto era `Promise<void>` — quien llamaba no podía saber si el
// correo había salido, ni con qué id.
// 🔴 SIGUE LANZANDO CUANDO NO SALE, Y ES DELIBERADO (SCRUM-475).
//
// Antes el `axios.post` lanzaba ante un error HTTP, y de eso dependía el control de flujo de sus
// llamadores. Devolver un resultado sin lanzar habría roto DOS cosas en silencio:
//   · los `.catch()` de los llamadores quedarían muertos — un fallo dejaría de registrarse;
//   · y `markSent()` marcaría como ENVIADO un correo que no salió: el merchant no lo recibe
//     nunca y el sistema cree que sí, que es justo lo que no puede pasar en el ciclo de vida.
// Esta fase unifica el EMISOR y rescata el ACUSE; cambiar la semántica de fallo de cinco módulos
// es otra cosa y no se cuela aquí de tapadillo.
// SCRUM-508 · `merchantId` entra por parámetro para poder dejar fila. Lo único que cambia: **sigue
// lanzando** cuando el correo no sale, y de eso depende que `markSent` no marque un envío que no
// existió (fase 1 de SCRUM-475, y el defecto que cerró la fase 3).
async function sendEmail(
  merchantId: number, to: string, subject: string, html: string,
): Promise<ResultadoCorreo> {
  if (!to || !to.includes('@')) return resultadoSinDestino();
  // SCRUM-101: el aviso de dev se conserva. Lo que cambia es que ya no ABANDONA aquí: si hay SMTP
  // configurado, `enviarCorreo` lo usa — antes este emisor era el único que ni lo intentaba.
  if (!config.RESEND_API_KEY) {
    console.log(`[lifecycle] (sin RESEND) email a ${maskEmail(to)}: ${subject}`);
  }
  const r = await enviarCorreo({
    to, subject, html, origen: 'lifecycle',
    // Van AL PROFESIONAL: `customerId` nulo, y no hay documento al que atarlos.
    registro: { merchantId, kind: CLASES_DE_CORREO.cicloDeVida },
  });
  if (!r.enviado) throw new Error(`no se pudo enviar el email (${r.motivo || 'desconocido'})`);
  return r;
}

// Plantilla con cabecera de marca YaQu
function wrap(bodyHtml: string, cta?: { label: string; url: string }): string {
  const button = cta
    ? `<p style="margin:28px 0"><a href="${cta.url}" style="background:#22c55e;color:#052e16;padding:13px 26px;border-radius:10px;text-decoration:none;font-weight:700;display:inline-block">${cta.label}</a></p>`
    : '';
  return `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:540px;margin:0 auto;color:#0f172a">
    <div style="padding:8px 0 20px"><span style="color:#22c55e;font-weight:800;font-size:20px">YaQu</span></div>
    <div style="font-size:15px;line-height:1.6;color:#374151">${bodyHtml}${button}</div>
    <hr style="border:none;border-top:1px solid #eef2f7;margin:28px 0 14px"/>
    <p style="font-size:12px;color:#9ca3af">YaQu · Cotiza por WhatsApp y cobra antes de empezar · <a href="https://yaqu.app" style="color:#9ca3af">yaqu.app</a></p>
  </div>`.trim();
}

// ── Helpers de tracking ───────────────────────────────────────────────────
function alreadySent(merchant: { lifecycleEmailsSent: any }, key: string): boolean {
  const sent = (merchant.lifecycleEmailsSent || {}) as Record<string, unknown>;
  return !!sent[key];
}

async function markSent(merchantId: number, current: any, key: string): Promise<void> {
  const sent = { ...((current || {}) as Record<string, number>), [key]: 1 };
  await prisma.merchant.update({ where: { id: merchantId }, data: { lifecycleEmailsSent: sent } });
}

function daysSince(date: Date): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
}

/**
 * 🔴 SCRUM-475 · ¿SALIÓ ESE AVISO? Anota lo que pasó y contesta si se puede marcar como enviado.
 *
 * EL DEFECTO QUE CIERRA: el patrón que había era `await sendEmail(...)` como sentencia suelta y
 * `markSent(...)` en la línea siguiente, y eso **marcaba como ENVIADO un correo que no se había
 * mandado**. No por el canal que todos vigilaban:
 *
 *   · si `sendEmail` LANZA, el `catch` de fuera corta antes de `markSent`. Ese caso estaba bien.
 *   · si `sendEmail` **DEVUELVE** `sin_destino` —el correo del merchant sin `@`, y no lanza— la
 *     ejecución seguía y `markSent` escribía `day3: 1`. El merchant no lo recibe nunca, el sistema
 *     cree que sí, **y no se reintenta jamás porque `alreadySent` ya dice que se mandó**.
 *
 * Es la mentira exacta que SCRUM-475 fase 1 se negó a introducir («`markSent()` marcaría como
 * ENVIADO un correo que no existe») y que estaba viva por el otro canal. Cinco avisos la tenían.
 *
 * ⚠️ POR QUÉ ESTO DEVUELVE UN BOOLEANO EN VEZ DE HACER EL `markSent` ÉL MISMO, que sería más
 * limpio: `tests/_censo-aviso-vs-bloqueo.mjs` (SCRUM-337, guard AJENO) deriva CUÁLES son los avisos
 * del ciclo de vida buscando cada `markSent(…, 'clave')` **dentro de `runLifecycleEmails`**, con la
 * clave como literal. Al extraerlo a un helper, ese censo pasó a ver CERO avisos y su suelo cantó
 * rojo: *«cero avisos no significa "no hay correos que prometan nada": significa que la derivación
 * está ciega»*. Tenía razón — es la misma lección que SCRUM-475 fase 2 aprendió al revés—, así que
 * el `markSent` se queda donde el guard ajeno lo busca y lo que se extrae es la decisión.
 */
function anotarEnvio(parte: ParteDeAvisos, destinatario: string, r: ResultadoCorreo): boolean {
  parte.intentados += 1;
  if (r.enviado) { parte.entregados += 1; return true; }
  const registro = dejarConstancia('ciclo_de_vida', destinatario, r);
  if (registro) parte.perdidos.push(registro);
  return false;
}

// ── Emails individuales ───────────────────────────────────────────────────
/**
 * 🔴 SCRUM-475 · DEVUELVE LO QUE PASÓ. Antes era `Promise<void>` con un `.catch()` inline que se
 * comía el fallo, y `markSent` corría **después de ese catch**: la bienvenida se marcaba como
 * enviada aunque no hubiera salido. Quien llama lo pasa por `conConstancia`, que anota los dos
 * canales con identidad.
 *
 * `null` = NO HUBO ENVÍO del que dejar constancia (ya constaba enviada, o el merchant no existe).
 * Es distinto de «salió» y de «falló», y por eso no se finge un `ResultadoCorreo`.
 */
export async function sendWelcomeEmail(merchantId: number): Promise<ResultadoCorreo | null> {
  const m = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { id: true, email: true, name: true, lifecycleEmailsSent: true },
  });
  if (!m || alreadySent(m, 'welcome')) return null;
  // Sin correo NO se manda nada, y eso ahora se DICE: `sin_destino` es un dato, no un hueco.
  if (!m.email) return resultadoSinDestino();
  const html = wrap(`
    <p>¡Hola ${m.name || ''}! 👋</p>
    <p>Bienvenido a <strong>YaQu</strong>. A partir de ahora vas a cotizar por WhatsApp, cobrar antes de empezar y olvidarte del papeleo.</p>
    <p>Para arrancar solo necesitas 3 cosas: tu catálogo de servicios, un cliente y pulsar enviar. En 30 segundos tu primera cotización está en camino.</p>
  `, { label: 'Crear mi primera cotización', url: DASHBOARD_URL });
  // 🔴 El `.catch()` inline se retira: era lo que impedía que el fallo llegara a quien llama, y lo
  // que dejaba correr el `markSent` de abajo sobre un correo que no salió.
  const r = await sendEmail(m.id, m.email, '¡Bienvenido a YaQu! 🎉', html);
  if (r.enviado) await markSent(m.id, m.lifecycleEmailsSent, 'welcome');
  return r;
}

/** SCRUM-475 · mismo cambio y mismo motivo que `sendWelcomeEmail`. */
export async function sendFirstPaymentEmail(merchantId: number): Promise<ResultadoCorreo | null> {
  const m = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { id: true, email: true, name: true, lifecycleEmailsSent: true },
  });
  if (!m || alreadySent(m, 'firstPayment')) return null;
  if (!m.email) return resultadoSinDestino();
  const html = wrap(`
    <p>¡Gracias por confiar en YaQu, ${m.name || ''}! 🚀</p>
    <p>Ya tienes el plan <strong>Pro</strong> activo. 5 cosas que quizá no sabías:</p>
    <ul>
      <li>La IA puede redactar tus cotizaciones a partir de una descripción.</li>
      <li>Puedes ofrecer 3 opciones de precio (Good/Better/Best) y cierras más.</li>
      <li>Las facturas se generan solas al cobrar.</li>
      <li>Tienes informes de rentabilidad por servicio.</li>
      <li>Puedes invitar a tu equipo con roles.</li>
    </ul>
  `, { label: 'Ir a mi panel', url: DASHBOARD_URL });
  const r = await sendEmail(m.id, m.email, 'Bienvenido al plan Pro de YaQu', html);
  if (r.enviado) await markSent(m.id, m.lifecycleEmailsSent, 'firstPayment');
  return r;
}

// ── Evaluador diario ──────────────────────────────────────────────────────
/**
 * 🔴 SCRUM-475 · DEVUELVE UN PARTE, Y ANTES ERA `Promise<void>`.
 *
 * El censo lo marcaba `ignora-resultado` en `cron.ts:71`. La verdad era peor que «nadie mira lo que
 * devolvió»: **no había nada que mirar**, y los cinco avisos de dentro marcaban `markSent` sobre
 * correos que podían no haber salido. Ver `enviarAvisoDeCiclo`.
 */
export async function runLifecycleEmails(): Promise<ParteDeAvisos> {
  const parte = parteNuevo();
  const merchants = await prisma.merchant.findMany({
    where: { status: 'active', email: { not: null } },
    select: { id: true, email: true, name: true, plan: true, createdAt: true, lifecycleEmailsSent: true },
  });

  for (const m of merchants) {
    if (!m.email) continue;
    const age = daysSince(m.createdAt);
    const isTrial = m.plan === 'trial';

    try {
      // Día 3 sin ninguna cotización enviada.
      //
      // SCRUM-337 · el tip del catálogo decía «lo tienes precargado por oficio», sin condición.
      // Medido: eso depende de CUATRO cosas —tener oficio, que no sea «otro», no desmarcar la
      // casilla del wizard (`onboardingView.js:135`) y que la carga no reviente—, y la cuarta
      // FALLA EN SILENCIO (el `POST /admin/products/load-catalog` va dentro de un catch vacío,
      // `onboardingView.js:165`; eso es SCRUM-338, no se arregla aquí).
      // Ahora el texto NO afirma el estado del usuario: dice dónde mirar. La segunda mitad existe
      // para el que NO tiene catálogo, que es justo el que está atrapado en 338 y el que más
      // necesita saber qué hacer — mandarle solo a comprobar sería mandarle a una pared.
      if (age >= 3 && !alreadySent(m, 'day3')) {
        const quoteCount = await prisma.quote.count({ where: { merchantId: m.id, status: { not: 'draft' } } });
        if (quoteCount === 0) {
          const html = wrap(`
            <p>Hola ${m.name || ''},</p>
            <p>Vimos que aún no has enviado tu primera cotización. ¿Te echamos una mano? Aquí van 3 tips:</p>
            <ol>
              <li>Revisa tu catálogo en Productos: si se precargó una lista para tu oficio, ya está ahí; si no, puedes añadir tus servicios desde esa misma pantalla.</li>
              <li>Crea una cotización rápida desde Inicio.</li>
              <li>Envíala por WhatsApp: la mayoría de clientes responde en menos de 2 horas.</li>
            </ol>
          `, { label: 'Enviar mi primera cotización', url: DASHBOARD_URL });
          const r = await sendEmail(m.id, m.email, '¿Te ayudamos a empezar con YaQu?', html);
          if (anotarEnvio(parte, m.email, r)) await markSent(m.id, m.lifecycleEmailsSent, 'day3');
          continue;
        }
      }

      // Día 7 — trial activo
      if (isTrial && age >= 7 && !alreadySent(m, 'day7')) {
        const html = wrap(`
          <p>Hola ${m.name || ''},</p>
          <p>Tu prueba de YaQu expira en unos 7 días. ¿Qué tal va todo? Si tienes dudas, respóndenos a este correo y te ayudamos.</p>
        `, { label: 'Ver mi panel', url: DASHBOARD_URL });
        const r = await sendEmail(m.id, m.email, 'Tu prueba de YaQu expira en 7 días', html);
        if (anotarEnvio(parte, m.email, r)) await markSent(m.id, m.lifecycleEmailsSent, 'day7');
        continue;
      }

      // Día 12 — 2 días antes de expirar.
      //
      // SCRUM-337 · decía «perderías el acceso a tu panel» y el panel NO se pierde. Decisión del
      // fundador: se corrige el TEXTO, no se amplía el bloqueo (gatear 95 rutas cambiaría el
      // comportamiento de todas las cuentas en prueba, y dejar ver los datos e impedir crear cosas
      // nuevas es una decisión razonable). El texto no se inventa: describe el mecanismo medido —
      // `requireActivePlan` está montado en 4 sitios y son exactamente `POST /quote/create`
      // (la ÚNICA ruta de creación de presupuestos), `POST /admin/quotes/:id/send-whatsapp` y las
      // dos de albaranes, que son de ENVÍO por WhatsApp (`albaranes.routes.ts:571` y `:588`).
      // Crear albaranes NO caduca. El guard `scrum337-aviso-atado-al-bloqueo` ata las dos caras.
      //
      // ⚠️ La enumeración de lo que sigue funcionando NO usa el posesivo del documento fiscal, y
      // no es un olvido: el trinquete de SCRUM-299 (Parte M) lo caza como PROMESA —el documento
      // post-pago es justificante hasta SIF-1 (reglas 24/26)—. «El resto del panel sigue
      // funcionando» ya lo cubre entero sin prometer nada. El guard tenía razón y el texto cedió.
      if (isTrial && age >= 12 && !alreadySent(m, 'day12')) {
        const html = wrap(`
          <p>Hola ${m.name || ''},</p>
          <p>Te quedan unos 2 días de prueba. Si activas el plan Pro, sigues con cotizaciones y facturas ilimitadas, cobro integrado y soporte. Si no, dejarás de poder crear presupuestos nuevos y de enviar presupuestos y albaranes por WhatsApp. El resto del panel sigue funcionando: tus cobros, tus clientes y tus datos siguen ahí.</p>
        `, { label: 'Activar plan Pro', url: `${DASHBOARD_URL}#plans` });
        const r = await sendEmail(m.id, m.email, 'Solo 2 días de prueba en YaQu', html);
        if (anotarEnvio(parte, m.email, r)) await markSent(m.id, m.lifecycleEmailsSent, 'day12');
        continue;
      }

      // Día 15 — trial expirado
      if (isTrial && age >= 15 && !alreadySent(m, 'trialExpired')) {
        const html = wrap(`
          <p>Hola ${m.name || ''},</p>
          <p>Tu prueba de YaQu ha terminado, pero tus datos siguen aquí. Activa el plan Pro cuando quieras y retomas justo donde lo dejaste.</p>
        `, { label: 'Continuar con YaQu', url: `${DASHBOARD_URL}#plans` });
        const r = await sendEmail(m.id, m.email, 'Tus datos te esperan en YaQu', html);
        if (anotarEnvio(parte, m.email, r)) await markSent(m.id, m.lifecycleEmailsSent, 'trialExpired');
        continue;
      }

      // 14 días inactivo (sin cotizaciones recientes) — solo una vez
      if (age >= 14 && !alreadySent(m, 'inactive')) {
        const recent = await prisma.quote.count({
          where: { merchantId: m.id, createdAt: { gte: new Date(Date.now() - 14 * 86_400_000) } },
        });
        if (recent === 0) {
          const html = wrap(`
            <p>Hola ${m.name || ''},</p>
            <p>Hace un par de semanas que no te vemos por YaQu. ¿En qué fallamos? Respóndenos a este correo: leemos todo y nos ayuda muchísimo a mejorar.</p>
          `, { label: 'Volver a mi panel', url: DASHBOARD_URL });
          const r = await sendEmail(m.id, m.email, '¿Qué ha pasado? Cuéntanos', html);
          if (anotarEnvio(parte, m.email, r)) await markSent(m.id, m.lifecycleEmailsSent, 'inactive');
        }
      }
    } catch (err: any) {
      // SCRUM-475 · el OTRO canal. `anotarEnvio` cubre el fallo DEVUELTO; aquí llega el que LANZA
      // —`sendEmail` lanza cuando el envío revienta— y también un fallo de BD, que igualmente deja
      // al merchant sin su aviso. En los dos casos el aviso no salió, y eso es lo que consta.
      console.error(`[lifecycle] merchant ${m.id}:`, err?.message);
      const registro = dejarConstancia('ciclo_de_vida', m.email, { error: err });
      if (registro) parte.perdidos.push(registro);
    }
  }
  return parte;
}
