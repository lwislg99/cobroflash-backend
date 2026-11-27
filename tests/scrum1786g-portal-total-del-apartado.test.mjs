// tests/scrum1786g-portal-total-del-apartado.test.mjs — SCRUM-1786g (parte J2)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// El PORTAL del cliente pinta «Total del apartado» bajo cada apartado del presupuesto
//
// ── LO FIRMADO ───────────────────────────────────────────────────────────────────────────
// SCRUM-1786 c.22269: literal `Total del apartado` (regla 39) y GO a P1-P5.
// SCRUM-1786 c.22329: el subtotal es «la suma de sus líneas, igual que el total del documento»;
// sin apartados no cambia nada. Deuda: cuando S1 haga `capitulos()`, se pasa a usarla. (Hecho en
// SCRUM-1807c: el recorrido sale de `capitulos()`, en `apartados.ts`.)
//
// ── EL CRITERIO, EL MISMO QUE EL PDF (1786f1, `pdf.service.ts`) ─────────────────────────
// Cabecera = la línea que `lineasQueSuman` deja fuera; sus líneas, las que la siguen hasta la
// próxima cabecera; las líneas ANTES de la primera cabecera no son de ningún apartado.
// La cifra: en el portal cada línea se pinta CON IVA y con su descuento de línea (`calcTotal`
// sobre la línea sola, SCRUM-1568), y el total de la tarjeta es `calcTotal` de todas. Así que
// el total del apartado es `calcTotal` de las líneas del apartado: la misma función que el total
// del documento, y la fila suma lo que el cliente ve encima. (El PDF usa la base sin IVA porque
// SU columna va sin IVA, SCRUM-1446e.)
//
// Se pide la ruta con el Prisma de mentira de scrum1568/1624b y se leen las filas que ve el cliente.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';

export const MUTACIONES_QUE_ME_TUMBAN = [
  // SCRUM-1807c · las dos mutaciones siguen siendo las mismas DOS FORMAS de fallar, reapuntadas al
  // código nuevo: el recorrido pasó de este fichero a `capitulos()` en `apartados.ts`, y el texto
  // que citaban ya no existe. Las dos se han corrido y caen (SCRUM-1807.md).
  {
    // La fila desaparece: el último apartado (el de 2 líneas) se queda sin total.
    fichero: 'src/modules/system/app/routes/customerPortal.routes.ts',
    de: 'if (cabecera) filas.push({ totalDelApartado: calcTotal(delApartado) });',
    a: 'if (cabecera && delApartado.length > 2) filas.push({ totalDelApartado: calcTotal(delApartado) });',
    cae: 'SCRUM-1786g · dos apartados → dos filas «Total del apartado», cada una bajo el suyo y con su importe',
  },
  {
    // Suma mal: el total arrastra las líneas de los apartados anteriores.
    fichero: 'src/modules/quotes/domain/apartados.ts',
    de: '      abierto = { cabecera: l, lineas: [] };',
    a: '      abierto = { cabecera: l, lineas: abierto ? [...abierto.lineas] : [] };',
    cae: 'SCRUM-1786g · dos apartados → dos filas «Total del apartado», cada una bajo el suyo y con su importe',
  },
];

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));

// ── El Prisma de mentira, en la caché ANTES de cargar la ruta (el de scrum1568/1624b) ───────
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

const LITERAL = 'Total del apartado';

const merchant = {
  id: 1786, name: 'Taller', legalName: 'Taller SL', email: 'taller@test.local', logoUrl: null, address: null,
  country: 'ES', brandColor: null, brandAccentColor: null, whatsappPhone: null, flags: {},
  connectStatus: 'none', stripeAccountId: null, timezone: 'Europe/Madrid',
};

/** Pide el portal con UN presupuesto y lee su tarjeta: total, desplegable, filas en orden. */
async function tarjetaDelPresupuesto(lineas, discountGlobalAmount = null) {
  tablas.customer = { findUnique: async () => ({ id: 3, merchantId: merchant.id, name: 'Ana', portalToken: 'tok1786', merchant }) };
  tablas.quote = {
    findMany: async () => [{
      id: 9, quoteNumber: 7, status: 'accepted', createdAt: new Date('2026-11-21T10:00:00Z'), currency: 'EUR',
      total: calcTotal(lineas, discountGlobalAmount), lines: lineas, decisionToken: null, discountGlobalAmount,
    }],
  };
  tablas.invoice = { findMany: async () => [] };
  tablas.job = { findFirst: async () => null };

  const app = express();
  app.use('/portal', rutaPortal);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    // `node:http` con `agent: false`, nunca `fetch` (SCRUM-1204).
    const { status, cuerpo } = await new Promise((ok, ko) => {
      const req = http.request(
        { host: '127.0.0.1', port: server.address().port, path: '/portal/tok1786', method: 'GET', agent: false },
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
    const t = cuerpo.split(/<div class="pf-card"[^>]*>/)[1] ?? '';
    // Las filas EN ORDEN: las de línea (`pf-line-concept`) y las de total (cualquier fila con el
    // literal firmado), para poder decir DEBAJO de qué va cada total.
    const filas = [...t.matchAll(/<div class="pf-line-row[^"]*"[^>]*>\s*<span class="([^"]+)"[^>]*>([^<]*)<\/span>\s*<span class="[^"]+"[^>]*>([^<]*)<\/span>/g)]
      .map((m) => ({ clase: m[1], concepto: m[2], importe: m[3].trim() }));
    return {
      total: (t.match(/<div class="pf-card-amount"[^>]*>([^<]*)<\/div>/) || [])[1],
      desplegable: ((t.match(/<button class="pf-lines-toggle"[^>]*>([\s\S]*?)<\/button>/) || [])[1] ?? '')
        .replace(/<span class="pf-chevron"[^>]*>[^<]*<\/span>/, '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(),
      filas,
      totales: filas.filter((f) => f.concepto === LITERAL),
      html: t,
    };
  } finally {
    await new Promise((r) => server.close(r));
  }
}

/** «1.234,56 €» → 1234.56. Lo que no es un importe da NaN. */
const aNumero = (s) => Number(String(s).replace(/[^\d,-]/g, '').replace(',', '.'));
const redondea = (x) => Math.round(x * 100) / 100;

// Datos de EJEMPLO (el «Salón» de c.22263): dos apartados, con IVA distinto y un descuento de línea.
const SALON = [
  { concept: 'Pintura de paredes', qty: 2, price: 100, tax: 0.21, dto: 10 }, // 217,80
  { concept: 'Rodapié', qty: 4, price: 12.5, tax: 0.21 },                     //  60,50
];
const COCINA = [
  { concept: 'Alicatado', qty: 1, price: 200, tax: 0.21 },                    // 242,00
  { concept: 'Fontanería', qty: 1, price: 50, tax: 0.10 },                     //  55,00
];
const CON_APARTADOS = [
  { concept: 'Salón', apartado: true }, ...SALON,
  { concept: 'Cocina', apartado: true }, ...COCINA,
];
const SIN_APARTADOS = [...SALON, ...COCINA];

test('SCRUM-1786g · ✅ CONTROL: el lector ve la tarjeta y las seis filas del presupuesto con apartados', async () => {
  const t = await tarjetaDelPresupuesto(CON_APARTADOS);
  const conceptos = t.filas.filter((f) => f.concepto !== LITERAL).map((f) => f.concepto);
  assert.deepEqual(conceptos, ['Salón', 'Pintura de paredes', 'Rodapié', 'Cocina', 'Alicatado', 'Fontanería']);
  assert.equal(t.total, formatMoneyEs(575.3, 'EUR'));
});

test('SCRUM-1786g · dos apartados → dos filas «Total del apartado», cada una bajo el suyo y con su importe', async () => {
  const t = await tarjetaDelPresupuesto(CON_APARTADOS);
  assert.equal(t.totales.length, 2, `esperaba dos filas «${LITERAL}»: ${JSON.stringify(t.filas)}`);
  // Posición: tras la última línea de cada apartado (la del Salón, ANTES de la cabecera Cocina).
  const orden = t.filas.map((f) => f.concepto);
  assert.deepEqual(orden, ['Salón', 'Pintura de paredes', 'Rodapié', LITERAL, 'Cocina', 'Alicatado', 'Fontanería', LITERAL]);
  // Importe: la MISMA función que el total del documento, sobre las líneas del apartado.
  assert.equal(t.totales[0].importe, formatMoneyEs(calcTotal(SALON), 'EUR'));
  assert.equal(t.totales[1].importe, formatMoneyEs(calcTotal(COCINA), 'EUR'));
  // Y las cifras del ejemplo, escritas, para que el test diga lo que ve el cliente.
  assert.equal(t.totales[0].importe, formatMoneyEs(278.3, 'EUR'));
  assert.equal(t.totales[1].importe, formatMoneyEs(297, 'EUR'));
});

test('SCRUM-1786g · los totales de los apartados cuadran con las líneas de encima y con el total de la tarjeta', async () => {
  const t = await tarjetaDelPresupuesto(CON_APARTADOS);
  // Cada total = la suma de las filas que tiene encima en su apartado.
  let acumulado = 0;
  const sumasDeEncima = [];
  for (const f of t.filas) {
    if (f.concepto === LITERAL) { sumasDeEncima.push(redondea(acumulado)); continue; }
    if (f.importe === '') { acumulado = 0; continue; } // cabecera: abre apartado
    acumulado += aNumero(f.importe);
  }
  assert.deepEqual(t.totales.map((f) => aNumero(f.importe)), sumasDeEncima);
  // Y los apartados juntos son el total de la tarjeta (sin líneas sueltas ni descuento global).
  assert.equal(redondea(t.totales.reduce((a, f) => a + aNumero(f.importe), 0)), aNumero(t.total));
});

test('SCRUM-1786g · «Ver detalles (N líneas)» no cuenta las filas de total', async () => {
  const t = await tarjetaDelPresupuesto(CON_APARTADOS);
  assert.equal(t.desplegable, 'Ver detalles (6 líneas)');
});

test('SCRUM-1786g · las líneas antes de la primera cabecera no son de ningún apartado: no llevan total', async () => {
  const lineas = [{ concept: 'Desplazamiento', qty: 1, price: 30, tax: 0.21 }, ...CON_APARTADOS];
  const t = await tarjetaDelPresupuesto(lineas);
  assert.equal(t.totales.length, 2);
  assert.equal(t.filas[0].concepto, 'Desplazamiento');
  assert.equal(t.totales[0].importe, formatMoneyEs(calcTotal(SALON), 'EUR'));
});

// Huella de la tarjeta SIN apartados, tomada del código de ANTES del cambio (dist de origin/main
// 0b2f6451af74f2142cf27e18c9a4c42fb56c1e65). Si el portal cambia algo sin apartados, esto cae.
const HUELLA_SIN_APARTADOS = '37f1bf5be2429053794812193c210c2417a7db00a9cd2b9efad1a5bcd53f26c4';

test('SCRUM-1786g · CONTROL: sin apartados, la tarjeta es idéntica a la de antes y no sale la fila', async () => {
  const t = await tarjetaDelPresupuesto(SIN_APARTADOS);
  assert.ok(!t.html.includes(LITERAL), 'sin apartados sale «Total del apartado»');
  assert.equal(t.filas.length, 4);
  const huella = crypto.createHash('sha256').update(t.html).digest('hex');
  assert.equal(huella, HUELLA_SIN_APARTADOS, 'sin apartados la tarjeta del portal ha cambiado');
});
