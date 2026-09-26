// src/modules/messaging/domain/weeklyDigest.service.ts
// Resumen semanal por email: se envía los lunes a las 9h.
import { prisma } from '../../../core/db/prisma';
import { config } from '../../../core/config/env';
import { maskEmail, formatImporteEs } from '../../../core/utils/utils';
import { enviarCorreo, ResultadoCorreo, resultadoSinDestino } from '../../../integrations/enviarCorreo';
// SCRUM-475 · un aviso que no sale deja constancia, y su fallo VIAJA hasta el cron.
import { dejarConstancia, parteNuevo, type ParteDeAvisos } from './avisoConstancia';
// SCRUM-508: la clase de correo sale del vocabulario cerrado, no de un literal a mano.
import { CLASES_DE_CORREO } from './registroDeEnvios';
// SCRUM-974: las dos se LEEN, ninguna se toca.
import { getPendientesFacturar } from '../../jobs/domain/pendientesFacturar.service';
import { getEmissionMode } from '../../invoicing/domain/emission.service';
// SCRUM-1116: la retención de garantía la calcula J2 (SCRUM-1108). Se LEE; el cálculo no se rehace.
import { garantiasRetenidasPorCliente } from '../../billing/domain/garantiasRetenidas';

// SCRUM-475 · el POST propio se retira: emisor único, y la respuesta se devuelve con su acuse.
// 🔴 SIGUE LANZANDO CUANDO NO SALE, Y ES DELIBERADO (SCRUM-475).
//
// Antes el `axios.post` lanzaba ante un error HTTP, y de eso dependía el control de flujo de sus
// llamadores. Devolver un resultado sin lanzar habría roto DOS cosas en silencio:
//   · los `.catch()` de los llamadores quedarían muertos — un fallo dejaría de registrarse;
//   · el `console.log('✓ enviado')` de la línea de abajo se imprimiría sobre un correo que no
//     salió — el log dejaría de ser una medición y pasaría a ser un adorno.
// Esta fase unifica el EMISOR y rescata el ACUSE; cambiar la semántica de fallo de cinco módulos
// es otra cosa y no se cuela aquí de tapadillo.
// SCRUM-508 · `merchantId` entra por parámetro para poder dejar fila. Es lo único que cambia de esta
// función: **sigue lanzando** cuando el correo no sale, y eso no se toca (fase 1 de SCRUM-475).
async function sendEmail(
  merchantId: number, to: string, subject: string, html: string,
): Promise<ResultadoCorreo> {
  if (!to || !to.includes('@')) return resultadoSinDestino();
  const r = await enviarCorreo({
    to, subject, html, origen: 'weeklyDigest',
    // El resumen va AL PROFESIONAL, así que `customerId` es nulo: no hay cliente al que atarlo. Y no
    // hay documento — el digest es un resumen, no la entrega de nada.
    registro: { merchantId, kind: CLASES_DE_CORREO.resumenSemanal },
  });
  if (!r.enviado) throw new Error(`no se pudo enviar el email (${r.motivo || 'desconocido'})`);
  return r;
}

function fmt(n: number, currency = '') {
  return formatImporteEs(n) + (currency ? ' ' + currency : '');
}

/**
 * 🔴 SCRUM-475 · DEVUELVE UN PARTE, Y ANTES ERA `Promise<void>`.
 *
 * El censo lo marcaba `ignora-resultado` en `cron.ts:61` —«nadie mira lo que devolvió»— y la verdad
 * era peor: **no había nada que mirar**. El fallo de cada merchant moría en el `console.error` de
 * abajo, en prosa, sin decir a QUÉ profesional se quedó sin su resumen; y el cron, que es el único
 * que podría enterarse, recibía `undefined`. Un resumen semanal que no sale no lo echa de menos
 * nadie: no hay pantalla donde se vea su ausencia.
 */
export async function sendWeeklyDigests(): Promise<ParteDeAvisos> {
  const parte = parteNuevo();
  const now      = new Date();
  const weekAgo  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  weekAgo.setHours(0, 0, 0, 0);

  // Solo merchants activos con email y digest activado
  const merchants = await prisma.merchant.findMany({
    where: {
      status: 'active',
      notifyEmailWeeklyDigest: true,
      email: { not: null },
    },
    select: {
      // SCRUM-974: `country` y `flags` son lo que lee `getEmissionMode` (solo lectura).
      id: true, name: true, email: true, defaultCurrency: true, country: true, flags: true,
    },
  });

  if (!merchants.length) return parte;
  console.log(`[weeklyDigest] Enviando ${merchants.length} resumen(es)…`);

  for (const merchant of merchants) {
    parte.intentados += 1;
    // Los DOS canales, porque el fallo se cae por cualquiera de ellos: `sendEmail` LANZA cuando el
    // envío revienta y DEVUELVE `sin_destino` —sin lanzar— cuando el correo del merchant no tiene
    // `@`. El `console.error` de antes solo veía el primero, y el segundo no dejaba nada.
    let resultado: ResultadoCorreo;
    try {
      resultado = await sendDigestForMerchant(merchant, weekAgo, now);
    } catch (e: any) {
      console.error(`[weeklyDigest] Error merchant ${merchant.id}:`, e?.message);
      const registro = dejarConstancia('resumen_semanal', merchant.email ?? '', { error: e });
      if (registro) parte.perdidos.push(registro);
      continue;
    }
    if (resultado.enviado) { parte.entregados += 1; continue; }
    const registro = dejarConstancia('resumen_semanal', merchant.email ?? '', resultado);
    if (registro) parte.perdidos.push(registro);
  }
  return parte;
}

/**
 * SCRUM-974 · EL BLOQUE «FIRMADO Y SIN FACTURAR». Devuelve '' cuando no debe salir.
 *
 * · La definición es la de la bandeja del panel —`getPendientesFacturar`, sin tocarla— y el
 *   importe, el suyo: `importePotencial` CON IVA, sumado en céntimos.
 * · Solo con la facturación ENCENDIDA para ese negocio, y el interruptor es el MODO DE EMISIÓN,
 *   el mismo que decide el botón «Nueva factura» (`facturaSuelta.ts`). En `receipt` (profesional
 *   español con `INVOICING_ES_ENABLED` apagado) un correo que llega solo cada lunes diciendo
 *   «esto está sin facturar» le empujaría a algo que YaQu no le deja hacer (regla 7). Solo se LEE.
 * · Importe 0 → no sale: ausente no es cero.
 * Texto firmado: docs/microcopy/2026-09-21-SCRUM-974-firmado-sin-facturar.md.
 */
async function bloqueFirmadoSinFacturar(
  merchant: { id: number; email: string | null; country: string | null; flags: unknown },
  currency: string,
): Promise<string> {
  if (getEmissionMode(merchant) === 'receipt') return '';
  const clientes = await getPendientesFacturar(merchant.id, prisma);
  let totalCents = 0;
  let partes = 0;
  for (const c of clientes) {
    for (const g of c.grupos) {
      // El tipo público solo declara euros; se suma en céntimos para no acumular decimales.
      totalCents += Math.round(g.importePotencial.total * 100);
      partes += g.albaranes.length;
    }
  }
  if (totalCents <= 0) return '';
  const nClientes = clientes.length;
  const detalle = `${partes} ${partes === 1 ? 'parte firmado' : 'partes firmados'} de ${nClientes} ${nClientes === 1 ? 'cliente' : 'clientes'}`;
  return `
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:16px">
      <div style="font-size:13px;font-weight:700;color:#0f172a">📝 Firmado y sin facturar</div>
      <div style="font-size:20px;font-weight:800;color:#0f172a;margin-top:4px">${fmt(totalCents / 100, currency)}</div>
      <div style="font-size:12px;color:#64748b;margin-top:2px">${detalle}</div>
    </div>`;
}

/**
 * SCRUM-1116 · LA GARANTÍA RETENIDA DE TODO EL MERCHANT, UNA ENTRADA POR DÍA DE LIBERACIÓN.
 *
 * La retención vive en un `Charge` normalmente ya PAGADO, así que `Invoice.status='pending'` no la ve.
 * Se suma por día (lo del mismo día, aunque sea de clientes distintos) y se ordena del más temprano
 * al más tardío: lo primero que se puede reclamar, primero. NO se junta en un total con una fecha:
 * con la más temprana diría que todo se libera ya, y con la más tardía callaría lo que se libera antes.
 * El día es `liberacionDia`, ya en la zona del merchant (SCRUM-735). Se suma en céntimos.
 */
async function garantiaPorDia(merchantId: number): Promise<Array<{ importe: number; dia: string }>> {
  const porDia = new Map<string, number>();
  for (const g of (await garantiasRetenidasPorCliente(merchantId)).values()) {
    for (const r of g.retenciones) {
      porDia.set(r.liberacionDia, (porDia.get(r.liberacionDia) ?? 0) + Math.round(r.importe * 100));
    }
  }
  return [...porDia].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([dia, cent]) => ({ importe: cent / 100, dia }));
}

/** `YYYY-MM-DD` → `dd/mm/aaaa`, sin pasar por `Date`: el día ya viene en la zona del merchant. */
function diaEs(dia: string): string {
  const [a, m, d] = dia.split('-');
  return `${d}/${m}/${a}`;
}

async function sendDigestForMerchant(
  merchant: { id: number; name: string; email: string | null; defaultCurrency: string; country: string | null; flags: unknown },
  from: Date,
  to: Date,
): Promise<ResultadoCorreo> {
  // SCRUM-475 · era `return;` a secas: un merchant sin correo no recibía el resumen y no quedaba
  // rastro de que no se le mandó. `sin_destino` es un dato, no un hueco (mismo arreglo que le hizo
  // SCRUM-477 a `sendTechQuoteApprovedEmail`).
  if (!merchant.email) return resultadoSinDestino();

  const [paidInvoices, newInvoices, acceptedQuotes, newQuotes, newCustomers, pendingInvoices] = await Promise.all([
    // Facturas cobradas esta semana
    prisma.invoice.aggregate({
      where: { merchantId: merchant.id, status: 'paid', paidAt: { gte: from, lte: to } },
      _sum: { total: true }, _count: { id: true },
    }),
    // Facturas emitidas
    prisma.invoice.count({ where: { merchantId: merchant.id, createdAt: { gte: from, lte: to } } }),
    // Presupuestos aceptados
    prisma.quote.count({ where: { merchantId: merchant.id, status: 'accepted', acceptedAt: { gte: from, lte: to } } }),
    // Presupuestos enviados
    prisma.quote.count({ where: { merchantId: merchant.id, createdAt: { gte: from, lte: to } } }),
    // Clientes nuevos
    prisma.customer.count({ where: { merchantId: merchant.id, createdAt: { gte: from, lte: to } } }),
    // Facturas pendientes acumuladas
    prisma.invoice.aggregate({
      where: { merchantId: merchant.id, status: 'pending' },
      _sum: { total: true }, _count: { id: true },
    }),
  ]);

  const cobrado   = Number(paidInvoices._sum.total ?? 0);
  const pendiente = Number(pendingInvoices._sum.total ?? 0);
  const currency  = merchant.defaultCurrency || 'EUR';
  // SCRUM-1116 · sólo hace falta cuando no hay facturas pendientes: es lo que decide si el
  // «✅ ¡No tienes facturas pendientes de cobro!» es cierto. NO es best-effort, y es deliberado: si
  // la consulta falla, caer al literal con ✅ sería volver a afirmar lo falso; mejor que el resumen
  // de ese merchant no salga y quede constancia (SCRUM-475), como con cualquier otra consulta.
  const garantia = pendiente > 0 ? [] : await garantiaPorDia(merchant.id);
  // SCRUM-974 · best-effort: si la bandeja falla, el resumen sale igual, sin este bloque.
  const firmadoSinFacturar = await bloqueFirmadoSinFacturar(merchant, currency).catch((e) => {
    console.error(`[weeklyDigest] firmado sin facturar, merchant ${merchant.id}:`, e?.message);
    return '';
  });

  const weekStr = `${from.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} — ${new Date(to.getTime() - 1).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}`;

  const subject = `📊 Tu semana en YaQu (${weekStr})`;

  const statRow = (label: string, value: string, color = '#0f172a') =>
    `<tr><td style="padding:8px 0;color:#64748b;font-size:13px;border-bottom:1px solid #f1f5f9">${label}</td>
     <td style="padding:8px 0;text-align:right;font-weight:700;font-size:13px;color:${color};border-bottom:1px solid #f1f5f9">${value}</td></tr>`;

  // 🔴 SCRUM-1116 · sin facturas pendientes pero CON garantía retenida, el bloque va SIN el ✅ y sin
  // el verde, A PROPÓSITO: el visto verde convierte la frase en un certificado de que no le deben
  // nada, y con dinero retenido eso es falso. Una línea por día de liberación; con un solo día es
  // carácter por carácter el literal firmado. Textos:
  // docs/microcopy/2026-09-25-SCRUM-1108-garantia-retenida.md y 2026-09-25-SCRUM-1116-digest-garantia.md.
  const html = `
<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
  <div style="background:#0f172a;padding:20px 24px;border-radius:12px 12px 0 0">
    <span style="color:#22c55e;font-weight:800;font-size:18px">YaQu</span>
    <span style="color:#64748b;font-size:13px;margin-left:8px">Resumen semanal</span>
  </div>
  <div style="background:#f8fafc;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none">
    <h2 style="margin:0 0 4px;font-size:18px;font-weight:800">¡Hola, ${merchant.name}! 👋</h2>
    <p style="color:#64748b;font-size:13px;margin:0 0 20px">${weekStr}</p>

    <div style="background:#fff;border-radius:10px;padding:16px 18px;border:1px solid #e2e8f0;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;margin-bottom:12px">Esta semana</div>
      <table style="width:100%;border-collapse:collapse">
        ${statRow('💰 Cobrado', fmt(cobrado, currency), cobrado > 0 ? '#16a34a' : '#0f172a')}
        ${statRow('🧾 Facturas emitidas', String(newInvoices))}
        ${statRow('✅ Presupuestos aceptados', String(acceptedQuotes), acceptedQuotes > 0 ? '#16a34a' : '#0f172a')}
        ${statRow('📋 Presupuestos enviados', String(newQuotes))}
        ${statRow('👤 Clientes nuevos', String(newCustomers))}
      </table>
    </div>

    ${pendiente > 0 ? `
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;margin-bottom:16px">
      <div style="font-size:13px;font-weight:700;color:#92400e">⏳ Pendiente de cobro</div>
      <div style="font-size:20px;font-weight:800;color:#92400e;margin-top:4px">${fmt(pendiente, currency)}</div>
      <div style="font-size:12px;color:#78350f;margin-top:2px">${pendingInvoices._count.id} factura${pendingInvoices._count.id !== 1 ? 's' : ''} sin cobrar</div>
    </div>` : garantia.length > 0 ? `
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:16px;color:#0f172a;font-size:13px">
      ${garantia.map((g, i) => `<div${i > 0 ? ' style="margin-top:6px"' : ''}>${i === 0 ? 'No tienes facturas pendientes de cobro. ' : ''}Tienes ${fmt(g.importe, currency)} en garantía retenida, liberable desde el ${diaEs(g.dia)}.</div>`).join('')}
    </div>` : `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 16px;margin-bottom:16px;text-align:center;color:#166534;font-weight:600;font-size:13px">
      ✅ ¡No tienes facturas pendientes de cobro!
    </div>`}
${firmadoSinFacturar}

    <div style="text-align:center;margin-top:8px">
      <a href="${config.PUBLIC_BASE_URL}/dashboard/" style="display:inline-block;background:#22c55e;color:#052e16;padding:11px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">
        Abrir YaQu →
      </a>
    </div>

    <p style="color:#94a3b8;font-size:11px;margin:16px 0 0;text-align:center">
      Para desactivar este resumen ve a Configuración → Notificaciones.
    </p>
  </div>
</div>`;

  const r = await sendEmail(merchant.id, merchant.email, subject, html);
  // 🔴 SCRUM-475 · EL «✓ enviado» SOLO SI SALIÓ. Esto es lo que la fase 1 de SCRUM-475 anticipó
  // como riesgo («el log dejaría de ser una medición y pasaría a ser un adorno») y estaba VIVO por
  // el otro canal: `sendEmail` DEVUELVE `sin_destino` sin lanzar cuando el correo no tiene `@`, así
  // que esta línea imprimía «✓ enviado» sobre un correo que no se intentó mandar.
  if (r.enviado) console.log(`[weeklyDigest] ✓ enviado a ${maskEmail(merchant.email)}`); // SCRUM-101
  return r;
}

// Generar preview del digest para un merchant (sin enviar)
export async function getDigestPreview(merchantId: number): Promise<{ subject: string; stats: object }> {
  const now     = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  weekAgo.setHours(0, 0, 0, 0);

  const [paidInvoices, newInvoices, acceptedQuotes, newQuotes, newCustomers, pendingInvoices] = await Promise.all([
    prisma.invoice.aggregate({ where: { merchantId, status: 'paid', paidAt: { gte: weekAgo } }, _sum: { total: true }, _count: { id: true } }),
    prisma.invoice.count({ where: { merchantId, createdAt: { gte: weekAgo } } }),
    prisma.quote.count({ where: { merchantId, status: 'accepted', acceptedAt: { gte: weekAgo } } }),
    prisma.quote.count({ where: { merchantId, createdAt: { gte: weekAgo } } }),
    prisma.customer.count({ where: { merchantId, createdAt: { gte: weekAgo } } }),
    prisma.invoice.aggregate({ where: { merchantId, status: 'pending' }, _sum: { total: true }, _count: { id: true } }),
  ]);

  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId }, select: { defaultCurrency: true } });

  return {
    subject: `📊 Tu semana en YaQu`,
    stats: {
      cobrado:          { amount: Number(paidInvoices._sum.total ?? 0), count: paidInvoices._count.id, currency: merchant?.defaultCurrency || 'EUR' },
      facturasEmitidas: newInvoices,
      presupuestosAceptados: acceptedQuotes,
      presupuestosEnviados:  newQuotes,
      clientesNuevos: newCustomers,
      pendiente:       { amount: Number(pendingInvoices._sum.total ?? 0), count: pendingInvoices._count.id, currency: merchant?.defaultCurrency || 'EUR' },
    },
  };
}
