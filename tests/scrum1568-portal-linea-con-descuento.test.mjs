// tests/scrum1568-portal-linea-con-descuento.test.mjs — SCRUM-1568
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// En el portal del cliente, las líneas de un presupuesto con descuento sumaban MÁS que el total
//
// ── LA VÍCTIMA, MEDIDA ──────────────────────────────────────────────────────────────────
// La tarjeta del presupuesto pintaba cada línea como `qty||1 × price||0 × (1+tax)` —sin el `dto`
// de la línea— y el total como `quote.total`, que sí lo lleva. Con 2 × 100 € al 21 % y un 10 %
// de descuento: la línea decía 242,00 € y el total 217,80 €, sin ninguna fila que lo explicara.
// Y una cabecera de apartado (un título, sin precio) salía como «0,00 €».
//
// ── LO FIRMADO (SCRUM-1568 c.21043) ─────────────────────────────────────────────────────
//   1. la línea se pinta CON el descuento aplicado, sin fila «Descuento» ni texto nuevo;
//   2. la línea de apartado sale VACÍA, como en la página de firma y en el PDF.
//
// ── POR QUÉ SE PIDE LA RUTA Y NO SE LEE EL FUENTE ───────────────────────────────────────
// El defecto era una CUENTA, y una cuenta sólo se ve con números. Se pide `/portal/<token>` con
// un Prisma de mentira —el de `_sonda-fecha-impresa.mjs` (SCRUM-1470), con la petición de scrum1309— y se leen los
// importes que el cliente ve. Lo esperado sale de `calcTotal`, la función que guarda el total,
// no de un literal: así el test pregunta «¿suman lo que el presupuesto dice que vale?».
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // La línea vuelve a pintarse sin su descuento.
    fichero: 'src/modules/system/app/routes/customerPortal.routes.ts',
    de: 'const importe = calcTotal([l]);',
    a: 'const importe = calcTotal([{ ...l, dto: undefined }]);',
    cae: 'SCRUM-1568 · la línea con descuento se pinta CON él: 2 × 100 € al 21 % con 10 % da el total, no 242,00 €',
  },
  {
    // La cabecera de apartado vuelve a llevar importe.
    fichero: 'src/modules/system/app/routes/customerPortal.routes.ts',
    de: "if (lineasQueSuman([l]).length === 0) return '';",
    a: "if (lineasQueSuman([l]).length === -1) return '';",
    cae: 'SCRUM-1568 · una línea de apartado sale VACÍA, no «0,00 €»',
  },
];

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));

// ── El Prisma de mentira, en la caché ANTES de cargar la ruta ──────────────────────────────
// Un modelo o un método que no está puesto LANZA con su nombre: si la ruta empieza a pedir otra
// cosa, el test cae diciéndolo, en vez de pintar otra página y medirla.
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
const { calcTotal, formatMoneyEs } = require_('./dist/core/utils/utils.js');
const express = require_('express');

const merchant = {
  id: 1568, name: 'Taller', legalName: 'Taller SL', email: 'taller@test.local', logoUrl: null, address: null,
  country: 'ES', brandColor: null, brandAccentColor: null, whatsappPhone: null, flags: {},
  connectStatus: 'none', stripeAccountId: null, timezone: 'Europe/Madrid',
};

/** Pide el portal con UN presupuesto aceptado (sin token que acuñar) y una factura sin cobro. */
async function portalCon(lineasPresupuesto, lineasFactura = []) {
  tablas.customer = { findUnique: async () => ({ id: 3, merchantId: merchant.id, name: 'Ana', portalToken: 'tok1568', merchant }) };
  tablas.quote = {
    findMany: async () => [{
      id: 9, quoteNumber: 7, status: 'accepted', createdAt: new Date('2026-10-27T10:00:00Z'), currency: 'EUR',
      total: calcTotal(lineasPresupuesto), lines: lineasPresupuesto, decisionToken: null,
    }],
  };
  tablas.invoice = {
    findMany: async () => lineasFactura.length ? [{
      id: 5, number: 'F-2026-0001', status: 'paid', createdAt: new Date('2026-10-27T10:00:00Z'),
      paidAt: new Date('2026-10-27T10:00:00Z'), total: calcTotal(lineasFactura), currency: 'EUR',
      lines: lineasFactura, charge: null, pdfUrl: null,
    }] : [],
  };
  tablas.job = { findFirst: async () => null };

  const app = express();
  app.use('/portal', rutaPortal);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    // `node:http` con `agent: false`, NUNCA `fetch` (SCRUM-1204, ver scrum910d): con `fetch` y
    // `--test-force-exit` este fichero salía 0xC0000409 DESPUÉS de los cuatro casos en verde.
    const { status, cuerpo } = await new Promise((ok, ko) => {
      const req = http.request(
        { host: '127.0.0.1', port: server.address().port, path: '/portal/tok1568', method: 'GET', agent: false },
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
    // Cada tarjeta, con su total y sus líneas, en el orden en que salen: presupuestos y luego facturas.
    const tarjetas = cuerpo.split('<div class="pf-card">').slice(1).map((t) => ({
      total: (t.match(/<div class="pf-card-amount">([^<]*)<\/div>/) || [])[1],
      lineas: [...t.matchAll(/<span class="pf-line-concept">([^<]*)<\/span>\s*<span class="pf-line-amount">([^<]*)<\/span>/g)]
        .map((m) => ({ concepto: m[1], importe: m[2].trim() })),
    }));
    return tarjetas;
  } finally {
    await new Promise((r) => server.close(r));
  }
}

/** «1.234,56 €» → 1234.56. Lo que no es un importe da NaN, y una suma con NaN no cuadra con nada. */
const aNumero = (s) => Number(String(s).replace(/[^\d,-]/g, '').replace(',', '.'));

const EJEMPLO = { concept: 'Mano de obra', qty: 2, price: 100, tax: 0.21, dto: 10 };

test('SCRUM-1568 · ✅ CONTROL POSITIVO: el lector ve el total y la línea de la tarjeta', async () => {
  const sinDto = { concept: 'Desplazamiento', qty: 1, price: 100, tax: 0.21 };
  const [tarjeta] = await portalCon([sinDto]);
  assert.ok(tarjeta, 'no hay ninguna tarjeta en el portal: el lector no vale para nada de lo de abajo');
  assert.equal(tarjeta.lineas.length, 1, `el lector no encuentra la línea: ${JSON.stringify(tarjeta)}`);
  // Una línea SIN descuento se pinta como siempre: con su IVA, 121,00 €. Si esto cambia, el arreglo
  // ha movido también las líneas que no tenían nada que arreglar.
  assert.equal(tarjeta.lineas[0].importe, formatMoneyEs(121, 'EUR'));
  assert.equal(tarjeta.total, formatMoneyEs(121, 'EUR'));
});

test('SCRUM-1568 · la línea con descuento se pinta CON él: 2 × 100 € al 21 % con 10 % da el total, no 242,00 €', async () => {
  const [tarjeta] = await portalCon([EJEMPLO]);
  // El ejemplo del ticket, con las dos cifras que medía: 217,80 € de total.
  assert.equal(tarjeta.total, formatMoneyEs(217.8, 'EUR'), `el total de la tarjeta no es el del ticket: ${tarjeta.total}`);
  assert.notEqual(tarjeta.lineas[0].importe, formatMoneyEs(242, 'EUR'), 'la línea sigue pintándose SIN su descuento (242,00 €)');
  assert.equal(tarjeta.lineas[0].importe, tarjeta.total, 'una sola línea tiene que dar el total del presupuesto');
});

test('SCRUM-1568 · una línea de apartado sale VACÍA, no «0,00 €»', async () => {
  const [tarjeta] = await portalCon([{ concept: '1. FONTANERÍA', apartado: true }, EJEMPLO]);
  assert.equal(tarjeta.lineas.length, 2, `el lector no ve las dos líneas: ${JSON.stringify(tarjeta.lineas)}`);
  assert.equal(tarjeta.lineas[0].concepto, '1. FONTANERÍA');
  assert.equal(tarjeta.lineas[0].importe, '', `la cabecera de apartado lleva importe: «${tarjeta.lineas[0].importe}»`);
});

test('SCRUM-1568 · las líneas de un presupuesto con apartado, descuentos e IVA distintos suman su total', async () => {
  const lineas = [
    { concept: '1. MATERIAL', apartado: true },
    EJEMPLO,
    { concept: 'Tubería', qty: 3, price: 12.5, tax: 0.21, dto: 5 },
    { concept: 'Libro de instrucciones', qty: 1, price: 20, tax: 0.04 },
  ];
  const [tarjeta] = await portalCon(lineas);
  const conImporte = tarjeta.lineas.filter((l) => l.importe !== '');
  assert.equal(conImporte.length, 3, `esperaba 3 líneas con importe: ${JSON.stringify(tarjeta.lineas)}`);
  const suma = Math.round(conImporte.reduce((a, l) => a + aNumero(l.importe), 0) * 100) / 100;
  assert.equal(suma, aNumero(tarjeta.total), `las líneas suman ${suma} y el total dice ${tarjeta.total}`);
});
