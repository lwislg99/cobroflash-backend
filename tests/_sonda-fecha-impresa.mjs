// tests/_sonda-fecha-impresa.mjs — SCRUM-1470 · SCRUM-1471 · SCRUM-1472
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA SONDA QUE ARRANCA CON EL RELOJ DE PRODUCCIÓN. No es un test: es el instrumento de los tests.
//
// Los tres tickets dicen lo mismo de tres papeles: una fecha pintada sin zona sale con el reloj del
// PROCESO, y el de Railway va en UTC. Eso no se puede medir desde la tanda: `Date` fija su zona al
// arrancar, y la máquina donde se escribe esto va en la hora de Madrid —el defecto NO se ve—
// mientras que el CI va en UTC. Por eso es un proceso hijo que se pone la zona él mismo, igual que
// `_sonda-calendarios.mjs` (SCRUM-750), y con su mismo control de ceguera: si `Intl` no resuelve la
// zona pedida sale con estado 2 y NO publica nada.
//
// 🔴 PASA POR EL CÓDIGO REAL, NO POR UNA COPIA DE SUS EXPRESIONES:
//   · el PDF del presupuesto se GENERA (`generateQuotePdf` + el constructor de las cuatro puertas)
//     y se LEE su texto;
//   · la página pública, el recibo y el portal se piden POR SU RUTA, con un Prisma de mentira;
//   · el resumen semanal sale de `sendWeeklyDigests`, con el reloj puesto en el lunes que se pida,
//     y se lee el ASUNTO del correo que habría salido.
//
// USO:  node tests/_sonda-fecha-impresa.mjs <zonaDelProceso> <json>
//         json = { papeles: [{ zona, instante }], lunes: [{ zona, ahora }] }
//         `zona` vacía o null = negocio SIN zona declarada.
//       Imprime UNA línea de JSON: { zonaDelProceso, papeles: [...], lunes: [...] }.
// ═════════════════════════════════════════════════════════════════════════════════════════════
const [ZONA_PROCESO, ENCARGO] = process.argv.slice(2);
process.env.TZ = ZONA_PROCESO;
// Una clave inventada para que el correo vaya por `axios.post`, que es donde se lee (SCRUM-1116).
process.env.RESEND_API_KEY = 're_test_sonda_fecha_no_sale';
delete process.env.INVOICING_ES_ENABLED;

const { default: fs } = await import('node:fs');
const { default: path } = await import('node:path');
const { default: http } = await import('node:http');
const { createRequire } = await import('node:module');
const { mock } = await import('node:test');
const { extraerTextoPdf } = await import('./_texto-del-pdf.mjs');

const ciego = (motivo) => { console.log(JSON.stringify({ ciego: motivo })); process.exit(2); };

const resuelta = Intl.DateTimeFormat().resolvedOptions().timeZone;
if (resuelta !== ZONA_PROCESO) ciego(`pedi ${ZONA_PROCESO}, Date resuelve ${resuelta}`);

let encargo;
try { encargo = JSON.parse(ENCARGO); } catch (e) { ciego(`el encargo no es JSON: ${e.message}`); }

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));

// ── El Prisma de mentira: UNO, puesto en la caché antes de cargar nada de `dist/` ────────────────
// Un modelo o un método que la sonda no conoce LANZA con su nombre: si una ruta empieza a pedir algo
// más, la sonda se queda ciega diciéndolo, en vez de contestar `undefined` y medir otra página.
const tablas = {};
const prisma = new Proxy({}, {
  get(_t, modelo) {
    if (typeof modelo !== 'string' || modelo === 'then') return undefined;
    return new Proxy({}, {
      get(_m, metodo) {
        const f = tablas[modelo]?.[metodo];
        if (!f) return async () => { throw new Error(`sonda: nadie ha puesto prisma.${modelo}.${String(metodo)}`); };
        return f;
      },
    });
  },
});
const R_PRISMA = require_.resolve('./dist/core/db/prisma.js');
require_.cache[R_PRISMA] = { id: R_PRISMA, filename: R_PRISMA, loaded: true, exports: { prisma } };

const { paramsDePresupuestoParaPdf } = require_('./dist/modules/quotes/domain/presupuestoParaPdf.js');
const { generateQuotePdf } = require_('./dist/modules/invoicing/infra/pdf/pdf.service.js');
const { quoteDecisionLandingRouter } = require_('./dist/modules/system/app/routes/quoteDecisionLanding.routes.js');
const rutaRecibo = require_('./dist/modules/billing/app/routes/receipt.routes.js').default;
const rutaPortal = require_('./dist/modules/system/app/routes/customerPortal.routes.js').default;
const { sendWeeklyDigests } = require_('./dist/modules/messaging/domain/weeklyDigest.service.js');
const axios = require_('axios');
const express = require_('express');

async function pedir(montaje, ruta, url) {
  const app = express();
  app.use(montaje, ruta);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}${url}`, { redirect: 'manual' });
    return { status: res.status, cuerpo: await res.text() };
  } finally {
    await new Promise((r) => server.close(r));
  }
}

/** Un PNG de 1×1: la firma tiene que ser una imagen que PDFKit sepa abrir, o el bloque no se pinta. */
const FIRMA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const merchantDe = (zona) => ({
  id: 1470, name: 'Taller', legalName: 'Taller SL', email: 'taller@test.local', logoUrl: null, address: null,
  country: 'ES', brandColor: null, brandAccentColor: null, whatsappPhone: null, flags: {},
  connectStatus: 'none', stripeAccountId: null, iban: null, clabe: null, bizumPhone: null,
  clausulasPresupuesto: null, timezone: zona || null,
});

const uno = (texto, patron) => { const m = texto.match(patron); return m ? m[1].trim() : null; };
let nPdf = 0;

async function papeles({ zona, instante }) {
  const cuando = new Date(instante);
  const merchant = merchantDe(zona);
  const quote = {
    id: 147000 + (nPdf += 1), quoteNumber: 7, revision: 0, status: 'accepted', currency: 'EUR',
    total: { toString: () => '121.00' }, lines: [{ concept: 'Mano de obra', qty: 1, price: 100, tax: 0.21 }],
    createdAt: cuando, validUntil: null, acceptedAt: cuando, rejectedAt: null, signatureUrl: FIRMA,
    evidenciaFirma: { canal: 'remoto', firmadoAt: cuando.toISOString(), firmante: 'Ana', contentHash: 'a'.repeat(64) },
    merchant, customer: { name: 'Ana' },
  };

  // ① EL PDF del presupuesto, por el constructor de las cuatro puertas.
  const { outPath } = await generateQuotePdf(paramsDePresupuestoParaPdf({ quote, merchant, customer: quote.customer }));
  const leido = extraerTextoPdf(fs.readFileSync(outPath));
  fs.rmSync(outPath, { force: true });
  if (!leido.ok) ciego(`no supe leer el PDF: ${leido.motivo}`);
  const pdf = leido.texto.replace(/\s+/g, ' ');

  // ② LA PÁGINA pública del mismo presupuesto, ya aceptado.
  tablas.quote = { findUnique: async () => quote };
  const pagina = await pedir('/pay', quoteDecisionLandingRouter, '/pay/quote/tok1470');

  // ③ EL RECIBO de un cobro pagado en ese instante.
  const charge = {
    id: 71, receiptToken: 'tok1471', status: 'paid', amount: 121, currency: 'EUR', concept: 'Mano de obra',
    method: 'bizum', payMethods: null, createdAt: cuando, paidAt: cuando,
    merchant, customer: { id: 3, name: 'Ana', email: null },
    events: [{ type: 'paid', ts: cuando, payload: {} }], reconciliations: [],
  };
  tablas.charge = { findUnique: async () => charge };
  tablas.quote = { findFirst: async () => null };
  tablas.invoice = { findFirst: async () => null, findUnique: async () => null };
  const recibo = await pedir('/recibo', rutaRecibo, '/recibo/tok1471');

  // ④ EL PORTAL del cliente: un presupuesto y una factura creados y pagada en ese instante.
  tablas.customer = { findUnique: async () => ({ id: 3, merchantId: merchant.id, name: 'Ana', portalToken: 'tokp', merchant }) };
  tablas.quote = {
    findMany: async () => [{ id: 9, quoteNumber: 7, status: 'accepted', createdAt: cuando, total: 121, currency: 'EUR', lines: [] }],
  };
  tablas.invoice = {
    findMany: async () => [{ id: 5, number: 'F-2026-0001', status: 'paid', createdAt: cuando, paidAt: cuando, total: 121, currency: 'EUR', lines: [], charge: null }],
  };
  tablas.job = { findFirst: async () => null };
  const portal = await pedir('/portal', rutaPortal, '/portal/tokp');
  const metas = [...portal.cuerpo.matchAll(/<div class="pf-card-meta"[^>]*>([^<]*)<\/div>/g)].map((m) => m[1].trim());

  return {
    zona: zona || null, instante,
    pdfFirma: uno(pdf, /Firmado digitalmente por .*? el (\d{2} de \S+ de \d{4})/),
    pdfSello: uno(pdf, /Sello temporal\s*(.*?)\s*\(hora del servidor\)/),
    paginaEstado: pagina.status,
    pagina: uno(pagina.cuerpo, /Ya aceptaste este [^<]*? el (\d{2} de \S+ de \d{4})/),
    reciboEstado: recibo.status,
    reciboPagado: uno(recibo.cuerpo, /Pagado el (\d{2} de \S+ de \d{4})/),
    reciboEvento: uno(recibo.cuerpo, /<li[^>]*>paid · ([^<]*)<\/li>/),
    portalEstado: portal.status,
    portalPresupuesto: metas[0] ?? null,
    portalFactura: metas[1] ?? null,
  };
}

async function lunes({ zona, ahora }) {
  const merchant = { ...merchantDe(zona), defaultCurrency: 'EUR' };
  tablas.merchant = { findMany: async () => [merchant], findUnique: async () => ({ timezone: merchant.timezone }) };
  tablas.invoice = { aggregate: async () => ({ _sum: { total: null }, _count: { id: 0 } }), count: async () => 0 };
  tablas.quote = { count: async () => 0 };
  tablas.customer = { count: async () => 0 };
  tablas.charge = { findMany: async () => [] };
  tablas.emailMessage = { create: async () => ({ id: 1 }) };
  const asuntos = [];
  const postOriginal = axios.post;
  axios.post = async (_url, body) => { asuntos.push(body.subject); return { data: { id: 're_sonda' } }; };
  mock.timers.enable({ apis: ['Date'], now: new Date(ahora) });
  let parte;
  try {
    parte = await sendWeeklyDigests();
  } finally {
    mock.timers.reset();
    axios.post = postOriginal;
  }
  if (asuntos.length !== 1) ciego(`el resumen no salio una vez (${asuntos.length}); parte: ${JSON.stringify(parte)}`);
  return { zona: zona || null, ahora, asunto: asuntos[0] };
}

const salida = { zonaDelProceso: resuelta, papeles: [], lunes: [] };
try {
  for (const c of encargo.papeles ?? []) salida.papeles.push(await papeles(c));
  for (const c of encargo.lunes ?? []) salida.lunes.push(await lunes(c));
} catch (e) {
  ciego(`la sonda revento: ${e?.stack || e}`);
}
console.log(JSON.stringify(salida));
process.exit(0);
