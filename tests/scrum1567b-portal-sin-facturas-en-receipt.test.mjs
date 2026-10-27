// tests/scrum1567b-portal-sin-facturas-en-receipt.test.mjs — SCRUM-1567b
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// El portal del cliente hablaba de «facturas» a un comercio que no puede emitirlas
//
// ── LA VÍCTIMA, MEDIDA (SCRUM-1567 c.21118) ─────────────────────────────────────────────
// Con `INVOICING_ES_ENABLED` en OFF no nace ningún documento (SCRUM-1027), y aun así el portal
// de un comercio ES saludaba con «Aquí tienes tus presupuestos, facturas y pagos.», pintaba el
// apartado «Facturas» con «No hay facturas aún.», y llamaba «Factura J-…» a un justificante
// antiguo. El fichero no miraba el modo de emisión en ninguna línea.
//
// ── LO FIRMADO (SCRUM-1567 c.21121, punto 3) ────────────────────────────────────────────
//   · comercio en `receipt`: saludo «Aquí tienes tus presupuestos.», sin el apartado «Facturas»
//     ni «No hay facturas aún.»; con un J- antiguo, «Justificante J-…» y «📄 Descargar justificante»;
//   · con el flag en ON, el portal sigue como hoy.
//
// ── POR QUÉ SE PIDE LA RUTA ─────────────────────────────────────────────────────────────
// Lo que decide es el comercio que llega a la ruta, y eso sólo se ve pidiéndola. Mismo banco que
// scrum1568: un Prisma de mentira en la caché y la petición con `node:http` (SCRUM-1204). El modo
// se fija con el override del propio comercio (`merchants.flags`), que manda sobre el entorno:
// así el test no depende de qué tenga puesto la máquina.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El portal deja de mirar el modo: vuelve a hablar de facturas a todos.
    fichero: 'src/modules/system/app/routes/customerPortal.routes.ts',
    de: "const sinFacturas = getEmissionMode(m) === 'receipt';",
    a: 'const sinFacturas = false;',
    cae: 'SCRUM-1567b · comercio en receipt sin documentos: ni saludo con facturas, ni apartado «Facturas», ni «No hay facturas aún.»',
  },
  {
    // El J- antiguo vuelve a llamarse factura en un comercio sin facturas.
    fichero: 'src/modules/system/app/routes/customerPortal.routes.ts',
    de: 'const esJustificante = sinFacturas && isReceiptNumber(inv.number);',
    a: 'const esJustificante = false;',
    cae: 'SCRUM-1567b · comercio en receipt con un J- antiguo: «Justificante J-…» y «📄 Descargar justificante»',
  },
];

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));

const tablas = {};
const prisma = new Proxy({}, {
  get(_t, modelo) {
    if (typeof modelo !== 'string' || modelo === 'then') return undefined;
    return new Proxy({}, {
      get(_m, metodo) {
        const f = tablas[modelo]?.[metodo];
        if (!f) return async () => { throw new Error(`test: nadie ha puesto prisma.${modelo}.${String(metodo)}`); };
        return f;
      },
    });
  },
});
const R_PRISMA = require_.resolve('./dist/core/db/prisma.js');
require_.cache[R_PRISMA] = { id: R_PRISMA, filename: R_PRISMA, loaded: true, exports: { prisma } };

const rutaPortal = require_('./dist/modules/system/app/routes/customerPortal.routes.js').default;
const { getEmissionMode } = require_('./dist/modules/invoicing/domain/emission.service.js');
const express = require_('express');

/** Un comercio ES real (no el demo: id ≠ 1 y otro email), con el flag fijado en su fila. */
const comercio = (flagOn) => ({
  id: 1567, name: 'Taller', legalName: 'Taller SL', email: 'taller1567@test.local', logoUrl: null, address: null,
  country: 'ES', brandColor: null, brandAccentColor: null, whatsappPhone: null,
  flags: { INVOICING_ES_ENABLED: flagOn },
  connectStatus: 'none', stripeAccountId: null, timezone: 'Europe/Madrid',
});

const documento = (number) => ({
  id: 5, number, status: 'paid', createdAt: new Date('2026-10-27T10:00:00Z'),
  paidAt: new Date('2026-10-27T10:00:00Z'), total: 121, currency: 'EUR',
  lines: [], charge: null, pdfUrl: '/pdf/doc-5.pdf',
});

/** Pide el portal con un presupuesto aceptado y los documentos dados; devuelve el HTML. */
async function portal(merchant, documentos) {
  tablas.customer = { findUnique: async () => ({ id: 3, merchantId: merchant.id, name: 'Ana', portalToken: 'tok1567b', merchant }) };
  tablas.quote = {
    findMany: async () => [{
      id: 9, quoteNumber: 7, status: 'accepted', createdAt: new Date('2026-10-27T10:00:00Z'), currency: 'EUR',
      total: 121, lines: [], decisionToken: null,
    }],
  };
  tablas.invoice = { findMany: async () => documentos };
  tablas.job = { findFirst: async () => null };

  const app = express();
  app.use('/portal', rutaPortal);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const { status, cuerpo } = await new Promise((ok, ko) => {
      const req = http.request(
        { host: '127.0.0.1', port: server.address().port, path: '/portal/tok1567b', method: 'GET', agent: false },
        (res) => {
          let b = '';
          res.setEncoding('utf8');
          res.on('data', (c) => { b += c; });
          res.on('end', () => ok({ status: res.statusCode, cuerpo: b }));
        },
      );
      req.on('error', ko);
      req.end();
    });
    assert.equal(status, 200, `el portal no contestó 200: ${status} · ${cuerpo.slice(0, 200)}`);
    return cuerpo;
  } finally {
    await new Promise((r) => server.close(r));
  }
}

const saludo = (html) => (html.match(/<div class="pf-greeting-sub"[^>]*>([^<]*)<\/div>/) || [])[1];
const titulos = (html) => [...html.matchAll(/<div class="pf-section-title"[^>]*>([^<]*)<\/div>/g)].map((m) => m[1]);
const tarjetas = (html) => [...html.matchAll(/<div class="pf-card-title"[^>]*>([^<]*)<\/div>/g)].map((m) => m[1]);

test('SCRUM-1567b · ✅ CONTROL: los dos comercios del banco están en el modo que dice el test', () => {
  // Si esto cae, el resto mide otro modo: el banco no prueba lo que dice.
  assert.equal(getEmissionMode(comercio(false)), 'receipt');
  assert.equal(getEmissionMode(comercio(true)), 'fiscal');
});

test('SCRUM-1567b · comercio en receipt sin documentos: ni saludo con facturas, ni apartado «Facturas», ni «No hay facturas aún.»', async () => {
  const html = await portal(comercio(false), []);
  // Positivo del lector: el apartado de presupuestos sí está, así que un «no hay títulos» no es un verde.
  assert.ok(titulos(html).includes('Presupuestos'), `el lector no ve el apartado de presupuestos: ${JSON.stringify(titulos(html))}`);
  assert.equal(saludo(html), 'Aquí tienes tus presupuestos.');
  assert.ok(!titulos(html).includes('Facturas'), 'el apartado «Facturas» sigue en el portal de un comercio que no puede emitir');
  assert.ok(!html.includes('No hay facturas aún.'), '«No hay facturas aún.» sigue en el portal');
  assert.ok(!/factura/i.test(html.replace(/<script[\s\S]*?<\/script>/g, '')), 'queda la palabra «factura» en algún sitio del portal');
});

test('SCRUM-1567b · comercio en receipt con un J- antiguo: «Justificante J-…» y «📄 Descargar justificante»', async () => {
  const html = await portal(comercio(false), [documento('J-20260611-AB3C')]);
  assert.equal(saludo(html), 'Aquí tienes tus presupuestos.');
  assert.ok(tarjetas(html).includes('Justificante J-20260611-AB3C'), `no sale «Justificante J-…»: ${JSON.stringify(tarjetas(html))}`);
  assert.ok(html.includes('>📄 Descargar justificante</a>'), 'no sale «📄 Descargar justificante»');
  assert.ok(!titulos(html).includes('Facturas'), 'el apartado «Facturas» sigue en el portal');
  assert.ok(!html.includes('Descargar factura'), 'el botón sigue diciendo «Descargar factura»');
  assert.ok(!html.includes('Factura J-'), 'el J- sigue llamándose factura');
});

test('SCRUM-1567b · CONTROL: con el flag en ON el portal sigue como hoy', async () => {
  const vacio = await portal(comercio(true), []);
  assert.equal(saludo(vacio), 'Aquí tienes tus presupuestos, facturas y pagos.');
  assert.ok(titulos(vacio).includes('Facturas'), 'con el flag en ON ha desaparecido el apartado «Facturas»');
  assert.ok(vacio.includes('<p class="pf-empty">No hay facturas aún.</p>'), 'con el flag en ON ha desaparecido «No hay facturas aún.»');

  const conJ = await portal(comercio(true), [documento('J-20260611-AB3C')]);
  assert.ok(tarjetas(conJ).includes('Factura J-20260611-AB3C'), `con el flag en ON el título de la tarjeta ha cambiado: ${JSON.stringify(tarjetas(conJ))}`);
  assert.ok(conJ.includes('>📄 Descargar factura</a>'), 'con el flag en ON el botón ha cambiado');
  assert.ok(!conJ.includes('ustificante'), 'con el flag en ON aparece «justificante»');
});
