// tests/scrum1108b-pantalla-garantia.test.mjs — SCRUM-1108b
//
// LA PANTALLA DE LA GARANTÍA RETENIDA, Y EL DÍA QUE PINTA.
//
// ① La ficha 360 PINTADA de verdad (banco de vistas, no grep): una línea por retención con el
//    literal firmado (docs/microcopy/2026-09-25-SCRUM-1108-garantia-retenida.md), `.alert warning`
//    si la fecha ya llegó e `.alert info` si no, y «al día ✓» se calla cuando hay garantía sin
//    cobrar — ahí sería falso.
// ② `POST /admin/charges/:id/garantia` guarda un día suelto como el PRIMER instante de ese día en la
//    zona del merchant. Antes guardaba la medianoche UTC y en México o Bogotá la ficha decía
//    «liberación desde el 22/09» para una retención declarada el 23 (medido en el PASO 0).
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { constaAprobado } from './_microcopy-aprobada.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));

// ═══ ① La ficha ═════════════════════════════════════════════════════════════════════════════

const CLIENTE = {
  id: 6108, name: 'Cliente QA 1108b', phone: null, mobile: null, email: null, notes: null, portalToken: null,
  createdAt: '2026-01-10T00:00:00.000Z', waOptOut: false, taxId: null, legalName: null, companyId: null,
  contactKind: null, tipoDestinatario: null, billingPeriodicity: 'NINGUNA', tags: null, internalRef: null,
  billingAddress: null, billingCity: null, billingPostalCode: null, billingProvince: null, billingCountry: null,
};
const STATS_AL_DIA = { totalQuotes: 0, acceptedQuotes: 0, totalBilled: 0, totalPaid: 0, totalExpenses: 0, profit: 0, totalPending: 0, pendingCount: 0 };
const GARANTIA = {
  total: 800, count: 2, liberable: { total: 500, count: 1 }, proximaLiberacion: '2026-03-01T00:00:00.000Z', aviso: true,
  retenciones: [
    { importe: 500, liberacionDia: '2026-03-01', aviso: true },
    { importe: 300, liberacionDia: '2027-09-23', aviso: false },
  ],
};

async function montarFicha(stats) {
  const banco = cargarDashboard(RAIZ, {
    datos: (url) => {
      const u = String(url || '');
      if (/\/admin\/customers\/\d+\/detail$/.test(u)) return { customer: CLIENTE, quotes: [], invoices: [], events: [], stats };
      if (/\/admin\/customers\/\d+\/historial$/.test(u)) return { trabajos: [], partesSueltos: [] };
      return { ...CLIENTE };
    },
  });
  assert.deepEqual(banco.fallos, [], 'un script del panel no cargó: nada de lo de abajo mediría');
  const r = await pintarVista(banco, 'renderCustomer360View', CLIENTE.id);
  assert.equal(r.error, null, `la ficha 360 no montó: ${r.error && r.error.message}`);
  const nodos = todos(r.contenedor);
  assert.ok(nodos.some((n) => n.className === 'kpi-card'), '🔴 CIEGO: la ficha no pintó ni una cifra');
  return { banco, nodos };
}

const lineasDeGarantia = (nodos) => nodos.filter((n) => /^Garantía retenida:/.test(String(n.textContent || '')));
const hayAlDia = (nodos) => nodos.some((n) => String(n.textContent || '').includes('al día ✓'));

test('SCRUM-1108b · 🔴 una línea POR RETENCIÓN, en el orden del servidor, con su clase', async () => {
  const { banco, nodos } = await montarFicha({ ...STATS_AL_DIA, garantiaRetenida: GARANTIA });
  const lineas = lineasDeGarantia(nodos);
  assert.equal(lineas.length, 2, `🔴 tiene que haber una línea por retención; salieron ${lineas.length}`);
  const fmt = (n) => banco.ctx.fmtMoneyEs(n, 'EUR');
  assert.equal(lineas[0].textContent, `Garantía retenida: ${fmt(500)} · liberación desde el 01/03/2026 · sin cobrar`);
  assert.equal(lineas[1].textContent, `Garantía retenida: ${fmt(300)} · liberación desde el 23/09/2027 · sin cobrar`);
  assert.equal(lineas[0].className, 'alert warning', '🔴 la que ya llegó a su fecha va en `.alert warning`');
  assert.equal(lineas[1].className, 'alert info', '🔴 la que aún no llegó va en `.alert info`');
});

test('SCRUM-1108b · 🔴 con garantía sin cobrar y ninguna factura pendiente, «al día ✓» NO se pinta', async () => {
  const { nodos } = await montarFicha({ ...STATS_AL_DIA, garantiaRetenida: GARANTIA });
  assert.equal(hayAlDia(nodos), false, '🔴 «al día ✓» con 800 € retenidos es falso');
});

test('SCRUM-1108b · control: sin garantía, la ficha sigue diciendo «al día ✓» y no pinta ninguna línea', async () => {
  const { nodos } = await montarFicha(STATS_AL_DIA);
  assert.equal(hayAlDia(nodos), true, '🔴 CIEGO: el instrumento no ve «al día ✓» ni donde tiene que estar');
  assert.equal(lineasDeGarantia(nodos).length, 0);
});

test('SCRUM-1108b · 🔴 lo que se pinta es el literal FIRMADO (constaAprobado), no uno parecido', async () => {
  const { banco, nodos } = await montarFicha({ ...STATS_AL_DIA, garantiaRetenida: GARANTIA });
  const lineas = lineasDeGarantia(nodos);
  assert.ok(lineas.length > 0, '🔴 CIEGO: no hay ninguna línea que comprobar');
  const importes = GARANTIA.retenciones.map((r) => banco.ctx.fmtMoneyEs(r.importe, 'EUR'));
  for (const l of lineas) {
    let plantilla = String(l.textContent);
    for (const i of importes) plantilla = plantilla.replace(i, '{importe}');
    plantilla = plantilla.replace(/\b\d{2}\/\d{2}\/\d{4}\b/, '{dd/mm/aaaa}');
    assert.notDeepEqual(constaAprobado(plantilla), [],
      `🔴 «${plantilla}» no consta aprobado en docs/microcopy/ (regla 30/39)`);
  }
});

// ═══ ② El día que guarda la ruta ═══════════════════════════════════════════════════════════

const R_PRISMA = require_.resolve('./dist/core/db/prisma.js');
const R_ROUTES = require_.resolve('./dist/modules/billing/app/routes/chargesAdmin.routes.js');
const { diaNaturalEn } = require_('./dist/core/zonaDelMerchant.js');

/** `node:http` con `agent: false`, como en scrum1107b (con `fetch` revienta libuv al cerrar). */
function peticion(puerto, url, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request({
      host: '127.0.0.1', port: puerto, path: url, method: 'POST', agent: false,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (t) => { data += t; });
      res.on('end', () => { let c = null; try { c = JSON.parse(data); } catch { /* null */ } resolve({ status: res.statusCode, cuerpo: c }); });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function declarar(timezone, liberacion) {
  const escritas = [];
  const prisma = {
    charge: {
      findFirst: async ({ where }) => (where.merchantId === 42 ? { id: where.id, merchant: { timezone } } : null),
      update: async ({ data }) => { escritas.push(data); return {}; },
    },
  };
  delete require_.cache[R_ROUTES];
  require_.cache[R_PRISMA] = { id: R_PRISMA, filename: R_PRISMA, loaded: true, exports: { prisma } };
  const express = require_('express');
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.merchantId = 42; req.userRole = 'admin'; next(); });
  app.use('/admin/charges', require_(R_ROUTES).default);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const r = await peticion(server.address().port, '/admin/charges/7/garantia', { total: 10000, porcentaje: 5, liberacion });
    return { ...r, escritas };
  } finally {
    await new Promise((r) => server.close(r));
  }
}

for (const zona of ['America/Mexico_City', 'America/Bogota', 'Europe/Madrid', 'Atlantic/Canary', 'Pacific/Auckland']) {
  test(`SCRUM-1108b · 🔴 «2027-09-23» declarado en ${zona} se lee 23 en ${zona}, no el día de antes`, async () => {
    const r = await declarar(zona, '2027-09-23');
    assert.equal(r.status, 200, `🔴 CIEGO: ${JSON.stringify(r.cuerpo)}`);
    assert.equal(r.escritas.length, 1);
    const guardada = r.escritas[0].retencionGarantiaLiberacion;
    assert.ok(guardada instanceof Date, '🔴 CIEGO: la ruta no escribió la fecha de liberación');
    assert.equal(diaNaturalEn(guardada, zona), '2027-09-23');
  });
}

test('SCRUM-1108b · un día que no existe («2027-02-30») es un 400, no el 2 de marzo', async () => {
  const r = await declarar('Europe/Madrid', '2027-02-30');
  assert.equal(r.status, 400);
  assert.equal(r.cuerpo.error, 'liberacion_invalida');
  assert.equal(r.escritas.length, 0, '🔴 un 400 no puede haber escrito ya en la base');
});

test('SCRUM-1108b · un INSTANTE completo se respeta tal cual (sólo el día suelto se ancla a la zona)', async () => {
  const r = await declarar('America/Mexico_City', '2027-09-23T12:00:00.000Z');
  assert.equal(r.status, 200);
  assert.equal(r.escritas[0].retencionGarantiaLiberacion.toISOString(), '2027-09-23T12:00:00.000Z');
});
