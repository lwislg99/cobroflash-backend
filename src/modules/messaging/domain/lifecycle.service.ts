// src/modules/messaging/domain/lifecycle.service.ts
// Sistema de emails del ciclo de vida del usuario (Sprint EMAIL).
//  - Bienvenida: al registrarse (sendWelcomeEmail)
//  - Día 3 / 7 / 12 / expirado / inactivo: cron diario (runLifecycleEmails)
//  - Primer pago: al confirmar suscripción (sendFirstPaymentEmail)
// Evita duplicados con el campo Merchant.lifecycleEmailsSent (Json).
import axios from 'axios';
import { prisma } from '../../../core/db/prisma';
import { config } from '../../../core/config/env';

const DASHBOARD_URL = `${config.PUBLIC_BASE_URL || 'https://yaqu.app'}/dashboard/`;

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!to || !to.includes('@')) return;
  if (!config.RESEND_API_KEY) {
    console.log(`[lifecycle] (sin RESEND) email a ${to}: ${subject}`);
    return;
  }
  await axios.post(
    'https://api.resend.com/emails',
    { from: config.EMAIL_FROM, to: [to], subject, html },
    { headers: { Authorization: `Bearer ${config.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 10_000 },
  );
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

// ── Emails individuales ───────────────────────────────────────────────────
export async function sendWelcomeEmail(merchantId: number): Promise<void> {
  const m = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { id: true, email: true, name: true, lifecycleEmailsSent: true },
  });
  if (!m?.email || alreadySent(m, 'welcome')) return;
  const html = wrap(`
    <p>¡Hola ${m.name || ''}! 👋</p>
    <p>Bienvenido a <strong>YaQu</strong>. A partir de ahora vas a cotizar por WhatsApp, cobrar antes de empezar y olvidarte del papeleo.</p>
    <p>Para arrancar solo necesitas 3 cosas: tu catálogo de servicios, un cliente y pulsar enviar. En 30 segundos tu primera cotización está en camino.</p>
  `, { label: 'Crear mi primera cotización', url: DASHBOARD_URL });
  await sendEmail(m.email, '¡Bienvenido a YaQu! 🎉', html).catch((e) => console.error('[lifecycle] welcome:', e?.message));
  await markSent(m.id, m.lifecycleEmailsSent, 'welcome');
}

export async function sendFirstPaymentEmail(merchantId: number): Promise<void> {
  const m = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { id: true, email: true, name: true, lifecycleEmailsSent: true },
  });
  if (!m?.email || alreadySent(m, 'firstPayment')) return;
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
  await sendEmail(m.email, 'Bienvenido al plan Pro de YaQu', html).catch((e) => console.error('[lifecycle] firstPayment:', e?.message));
  await markSent(m.id, m.lifecycleEmailsSent, 'firstPayment');
}

// ── Evaluador diario ──────────────────────────────────────────────────────
export async function runLifecycleEmails(): Promise<void> {
  const merchants = await prisma.merchant.findMany({
    where: { status: 'active', email: { not: null } },
    select: { id: true, email: true, name: true, plan: true, createdAt: true, lifecycleEmailsSent: true },
  });

  for (const m of merchants) {
    if (!m.email) continue;
    const age = daysSince(m.createdAt);
    const isTrial = m.plan === 'trial';

    try {
      // Día 3 sin ninguna cotización enviada
      if (age >= 3 && !alreadySent(m, 'day3')) {
        const quoteCount = await prisma.quote.count({ where: { merchantId: m.id, status: { not: 'draft' } } });
        if (quoteCount === 0) {
          const html = wrap(`
            <p>Hola ${m.name || ''},</p>
            <p>Vimos que aún no has enviado tu primera cotización. ¿Te echamos una mano? Aquí van 3 tips:</p>
            <ol>
              <li>Carga tu catálogo de servicios (lo tienes precargado por oficio).</li>
              <li>Crea una cotización rápida desde Inicio.</li>
              <li>Envíala por WhatsApp: la mayoría de clientes responde en menos de 2 horas.</li>
            </ol>
          `, { label: 'Enviar mi primera cotización', url: DASHBOARD_URL });
          await sendEmail(m.email, '¿Te ayudamos a empezar con YaQu?', html);
          await markSent(m.id, m.lifecycleEmailsSent, 'day3');
          continue;
        }
      }

      // Día 7 — trial activo
      if (isTrial && age >= 7 && !alreadySent(m, 'day7')) {
        const html = wrap(`
          <p>Hola ${m.name || ''},</p>
          <p>Tu prueba de YaQu expira en unos 7 días. ¿Qué tal va todo? Si tienes dudas, respóndenos a este correo y te ayudamos.</p>
        `, { label: 'Ver mi panel', url: DASHBOARD_URL });
        await sendEmail(m.email, 'Tu prueba de YaQu expira en 7 días', html);
        await markSent(m.id, m.lifecycleEmailsSent, 'day7');
        continue;
      }

      // Día 12 — 2 días antes de expirar
      if (isTrial && age >= 12 && !alreadySent(m, 'day12')) {
        const html = wrap(`
          <p>Hola ${m.name || ''},</p>
          <p>Te quedan unos 2 días de prueba. Si activas el plan Pro, sigues con cotizaciones y facturas ilimitadas, cobro integrado y soporte. Si no, perderías el acceso a tu panel (tus datos se guardan).</p>
        `, { label: 'Activar plan Pro', url: `${DASHBOARD_URL}#plans` });
        await sendEmail(m.email, 'Solo 2 días de prueba en YaQu', html);
        await markSent(m.id, m.lifecycleEmailsSent, 'day12');
        continue;
      }

      // Día 15 — trial expirado
      if (isTrial && age >= 15 && !alreadySent(m, 'trialExpired')) {
        const html = wrap(`
          <p>Hola ${m.name || ''},</p>
          <p>Tu prueba de YaQu ha terminado, pero tus datos siguen aquí. Activa el plan Pro cuando quieras y retomas justo donde lo dejaste.</p>
        `, { label: 'Continuar con YaQu', url: `${DASHBOARD_URL}#plans` });
        await sendEmail(m.email, 'Tus datos te esperan en YaQu', html);
        await markSent(m.id, m.lifecycleEmailsSent, 'trialExpired');
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
          await sendEmail(m.email, '¿Qué ha pasado? Cuéntanos', html);
          await markSent(m.id, m.lifecycleEmailsSent, 'inactive');
        }
      }
    } catch (err: any) {
      console.error(`[lifecycle] merchant ${m.id}:`, err?.message);
    }
  }
}
