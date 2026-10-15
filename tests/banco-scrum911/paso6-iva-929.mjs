// SCRUM-911b · (a) de c.19802: repetir el recorrido en STAGING con el flag SÓLO para el negocio QA
// y ver el borrador del ciclo CON IVA. Es el control positivo de SCRUM-929, no un «no falla».
//
// Un solo proceso, de principio a fin, porque el flag NO puede quedarse encendido si algo revienta
// a medias: el ciclo es GLOBAL y diario (10:00 UTC), y un flag olvidado propone solo mañana. La
// restauración va en el `finally`.
//
// La discriminación: el MISMO instrumento mira el borrador NUEVO y el del 17-sep (#1889, nacido con
// el defecto: 320,00 € para una línea de 320 € + 21 %). Si los dos enseñaran lo mismo, el
// instrumento no distinguiría el arreglo del defecto.
//
// Lo heredado de los tramos 1 y 2, y que no se deshace: el `now` va por PARÁMETRO (no se tocan
// fechas), la PUERTA aborta si un plan ajeno entraría en el ciclo, y nada sale a Meta (se comprueba
// en runtime que este proceso no lleva credenciales de WhatsApp).
//
//   YAQU_ENV_FILE=<secreto> node tests/banco-scrum911/paso6-iva-929.mjs     (con el TURNO tomado)
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { cargarSecretos, imp, sesionQA, BASE, WT } from './_entorno.mjs';

const DIR = `${WT}/tests/banco-scrum911`;
const BORRADOR_17SEP = 1889; // el que creó el ciclo el 17-sep, con el defecto de 929 dentro
const ESPERADO = 387.2;      // 320 × 1,21 — la línea mantenible del presupuesto origen, CON IVA

const secretos = cargarSecretos();
process.env.DATABASE_URL = secretos.DATABASE_URL_STAGING;
delete process.env.WHATSAPP_PHONE_NUMBER_ID;
delete process.env.WHATSAPP_TOKEN;

const { parseBDSegura, STAGING_HOST } = await imp('scripts/_db-guard.mjs');
const p = parseBDSegura(process.env.DATABASE_URL);
if (!p || p.host !== STAGING_HOST) throw new Error(`NO ES STAGING (host=${p?.host ?? 'ilegible'})`);

const { config } = await imp('dist/core/config/env.js');
const creds = { id: !!config.WHATSAPP_PHONE_NUMBER_ID, token: !!config.WHATSAPP_TOKEN };
console.log('credenciales de WhatsApp en ESTE proceso:', creds);
if (creds.id || creds.token) throw new Error('ABORTA: hay credenciales de WhatsApp; este recorrido podría enviar de verdad');

const { prisma } = await imp('dist/core/db/prisma.js');
const [{ current_database }] = await prisma.$queryRaw`select current_database()`;
if (current_database !== 'railway') throw new Error(`base inesperada: ${current_database}`);
const ver = await (await fetch(`${BASE}/version`)).json();
console.log(`BD: ${current_database} @ ${p.host} · staging /version: ${ver.version}`);

// El original del fixture: se compara, NO se reescribe (README, primer candado).
const original = JSON.parse(fs.readFileSync(`${DIR}/merchant2-antes.json`, 'utf8'));
const antes = await prisma.merchant.findUnique({ where: { id: 2 }, select: { flags: true, trade: true } });
console.log('merchant 2 ANTES:', antes, '· original guardado:', original);
if (JSON.stringify(antes) !== JSON.stringify(original)) {
  throw new Error('ABORTA: merchant 2 no está como el original; alguien lo está usando o lo dejó encendido');
}

const R = {};
const out = { inicio: new Date().toISOString(), staging: ver.version };
const { api } = await sesionQA();
const maxQuoteAntes = (await prisma.quote.aggregate({ _max: { id: true } }))._max.id;

try {
  // 1 · ENCENDER sólo para el merchant QA (override de merchant; Parte P, opt-in por negocio).
  await prisma.merchant.update({ where: { id: 2 }, data: { flags: { MAINTENANCE_ENABLED: true }, trade: 'fontanero' } });
  const encendido = await prisma.merchant.findUnique({ where: { id: 2 }, select: { flags: true, trade: true } });
  const otros = await prisma.$queryRaw`select id from merchants where flags ? 'MAINTENANCE_ENABLED' and id <> 2`;
  console.log('merchant 2 ENCENDIDO:', encendido, '· otros merchants con override:', otros);
  R.flagSoloQA = encendido.flags?.MAINTENANCE_ENABLED === true && otros.length === 0 ? 'funciona' : 'falla';

  // 2 · presupuesto con la línea mantenible (la misma del 17-sep) → aceptado → plan.
  const cr = await api('POST', '/quote/create', {
    merchant_id: 2, customer_id: 3927, currency: 'EUR', paymentTerms: 'FULL_UPFRONT',
    lines: [
      { concept: 'Sustitución de termo eléctrico 80 L', qty: 1, price: 320, tax: 0.21 },
      { concept: 'Desplazamiento', qty: 1, price: 25, tax: 0.21 },
    ],
  });
  console.log('POST /quote/create →', cr.status, JSON.stringify(cr.json).slice(0, 300));
  const quoteId = cr.json?.id ?? cr.json?.quote?.id ?? cr.json?.quoteId;
  out.crear = { status: cr.status, error: cr.json?.error ?? null };
  if (!quoteId) throw new Error(`sin presupuesto: POST /quote/create → ${cr.status} ${JSON.stringify(cr.json)}`);
  out.quoteId = quoteId;

  const acc = await api('POST', `/admin/quotes/${quoteId}/accept`, { channel: 'backoffice', comment: 'SCRUM-911b' });
  console.log('POST accept →', acc.status, JSON.stringify(acc.json).slice(0, 200));
  const det = await api('GET', `/admin/quotes/${quoteId}`);
  const s = det.json?.maintenance?.suggestion;
  console.log('sugerencia en el aceptado:', JSON.stringify(s));
  R.sugerencia = s ? 'funciona' : 'falla';

  const alta = await api('POST', '/admin/maintenance', { customerId: 3927, quoteId, title: s?.title ?? 'Revisión de termo/calentador', intervalMonths: s?.intervalMonths ?? 12 });
  console.log('POST /admin/maintenance →', alta.status, JSON.stringify(alta.json));
  R.alta = alta.status === 201 ? 'funciona' : `falla (${alta.status})`;
  const planId = alta.json?.id;
  if (!planId) throw new Error('sin plan');
  out.planId = planId;

  // 3 · EL CICLO con `now` simulado, y la PUERTA delante.
  // ⚠️ Medido en la 1ª pasada del 15-oct: con `now` = vencimiento + 1 día, el ciclo dio
  // `customer_cooldown_90d` y no propuso. El cliente 3927 arrastra un `lastProposedAt` SIMULADO
  // (2027) de las pasadas anteriores, y el enfriamiento de 90 días por cliente es correcto como
  // producto (`maintenance.service.ts:367`). Así que el `now` cae también pasado ese enfriamiento.
  const mio = await prisma.maintenancePlan.findUnique({ where: { id: planId } });
  const ultima = (await prisma.maintenancePlan.aggregate({
    where: { customerId: mio.customerId }, _max: { lastProposedAt: true },
  }))._max.lastProposedAt;
  const DIA = 24 * 3600 * 1000;
  const tras = Math.max(mio.nextDueAt.getTime() + DIA, ultima ? ultima.getTime() + 91 * DIA : 0);
  console.log(`última propuesta del cliente: ${ultima?.toISOString() ?? 'ninguna'}`);
  const d = new Date(tras);
  const now = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 10, 0, 0)); // 12:00 Madrid
  out.now = now.toISOString();
  const vencidos = await prisma.maintenancePlan.findMany({
    where: { active: true, nextDueAt: { lte: now } }, select: { id: true, merchantId: true },
  });
  const ajenos = vencidos.filter((v) => v.id !== planId);
  console.log(`now SIMULADO ${now.toISOString()} · planes activos vencidos a ese now: ${vencidos.length} · ajenos: ${ajenos.length}`);
  if (ajenos.length) throw new Error(`ABORTA: ${ajenos.length} plan(es) ajenos entrarían en el ciclo: ${JSON.stringify(ajenos)}`);

  const { runMaintenanceProposals } = await imp('dist/modules/maintenance/domain/maintenance.service.js');
  const res = await runMaintenanceProposals(now);
  console.log('runMaintenanceProposals →', res);
  out.ciclo = res;
  R.cicloPropone = res.due === 1 && res.proposed === 1 ? 'funciona' : 'falla';

  // 4 · EL IMPORTE, en la BASE, por la API y en la PANTALLA.
  const draft = await prisma.quote.findFirst({
    where: { merchantId: 2, origin: 'maintenance', id: { gt: maxQuoteAntes } },
    select: { id: true, quoteNumber: true, status: true, total: true, lines: true },
  });
  const viejo = await prisma.quote.findUnique({ where: { id: BORRADOR_17SEP }, select: { id: true, total: true, origin: true } });
  console.log('borrador NUEVO:', JSON.stringify(draft));
  console.log('borrador del 17-sep (control):', JSON.stringify(viejo));
  if (!draft) throw new Error('el ciclo no dejó borrador');
  out.draftId = draft.id;
  out.base = { nuevo: Number(draft.total), viejo: Number(viejo?.total) };
  R.baseConIva = Number(draft.total) === ESPERADO ? 'funciona' : `falla (total=${draft.total})`;
  R.baseControl17sep = Number(viejo?.total) === 320 ? 'el instrumento ve el defecto viejo (320)' : `control roto (total=${viejo?.total})`;

  const apiDraft = await api('GET', `/admin/quotes/${draft.id}`);
  out.api = { status: apiDraft.status, total: apiDraft.json?.total ?? null };
  console.log(`GET /admin/quotes/${draft.id} →`, apiDraft.status, 'total =', apiDraft.json?.total);
  R.apiConIva = Number(apiDraft.json?.total) === ESPERADO ? 'funciona' : `falla (total=${apiDraft.json?.total})`;

  const { lanzarNavegador } = await imp('scripts/_navegador.mjs');
  const { cookie } = await sesionQA();
  const [nombre, ...resto] = cookie.split('=');
  const nav = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });
  try {
    const page = await nav.newPage();
    await page.setViewport({ width: 1280, height: 1400 });
    await page.setCookie({ name: nombre, value: resto.join('='), domain: new URL(BASE).hostname, path: '/' });
    await page.goto(`${BASE}/dashboard/`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForFunction('typeof window.renderAppView === "function"', { timeout: 30000 });
    const mirar = async (id, foto) => {
      await page.evaluate((q) => window.renderAppView('quotes-detail', { quoteId: q }), id);
      await page.waitForFunction(() => /Revisión de termo/i.test(document.body.innerText), { timeout: 20000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 1500));
      const t = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
      await page.screenshot({ path: `${DIR}/${foto}`, fullPage: true });
      // El TOTAL DEL DOCUMENTO, no una subcadena: la columna TOTAL de la línea enseña 387,20 € en
      // los DOS borradores (1ª pasada del 15-oct: «control roto»), y lo que los separa es esto.
      const m = /\bTotal:\s*([\d.]+,\d{2})\s*€/.exec(t);
      const i = t.search(/Total/);
      return { id, totalDocumento: m ? m[1] : null, seAbre: /Revisión de termo/i.test(t), recorte: t.slice(Math.max(0, i - 120), i + 200) };
    };
    const pNuevo = await mirar(draft.id, 'pantalla-911b-borrador-nuevo.png');
    const pViejo = await mirar(BORRADOR_17SEP, 'pantalla-911b-borrador-17sep.png');
    console.log('PANTALLA nuevo:', JSON.stringify(pNuevo, null, 2));
    console.log('PANTALLA 17-sep (control):', JSON.stringify(pViejo, null, 2));
    out.pantalla = { nuevo: pNuevo, viejo: pViejo };
    R.pantallaConIva = pNuevo.seAbre && pNuevo.totalDocumento === '387,20' ? 'funciona' : `falla (abre=${pNuevo.seAbre} total=${pNuevo.totalDocumento})`;
    R.pantallaDistingue = pViejo.seAbre && pViejo.totalDocumento === '320,00'
      ? 'funciona (el del 17-sep enseña Total: 320,00)' : `control roto (abre=${pViejo.seAbre} total=${pViejo.totalDocumento})`;
  } finally {
    await nav.close().catch(() => {});
  }
} finally {
  // 5 · DEVOLVER el fixture, pase lo que pase.
  await prisma.merchant.update({ where: { id: 2 }, data: { flags: original.flags ?? null, trade: original.trade ?? null } });
  const apagados = await prisma.maintenancePlan.updateMany({ where: { merchantId: 2, active: true }, data: { active: false } });
  const despues = await prisma.merchant.findUnique({ where: { id: 2 }, select: { flags: true, trade: true } });
  const activos = await prisma.maintenancePlan.count({ where: { active: true } });
  const conOverride = await prisma.$queryRaw`select id from merchants where flags ? 'MAINTENANCE_ENABLED'`;
  console.log('merchant 2 RESTAURADO:', despues, '· planes desactivados:', apagados.count, '· activos en toda la BD:', activos, '· overrides:', conOverride.length);
  R.restaurado = JSON.stringify(despues) === JSON.stringify(original) && activos === 0 && conOverride.length === 0 ? 'sí' : 'NO';
  out.fin = new Date().toISOString();
  out.R = R;
  fs.writeFileSync(`${DIR}/paso6.json`, JSON.stringify(out, null, 2));
  console.log('VEREDICTOS paso 6:', R);
  await prisma.$disconnect();
}
