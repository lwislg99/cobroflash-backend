// tests/scrum1624b-portal-fila-descuento-global.test.mjs — SCRUM-1624b
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// En el portal del cliente, con un descuento GLOBAL, las líneas del presupuesto sumaban más que el total
//
// ── LA VÍCTIMA, MEDIDA (c.21089) ────────────────────────────────────────────────────────
// Con SCRUM-1568 cada línea lleva su descuento de LÍNEA, pero el global sólo lo resta `q.total`.
// «Mano de obra» 2 × 100 € al 21 % con 10 %, «Material» 1 × 50 € al 21 %, 20 € de global:
// total 254,10 €, y las filas 217,80 + 60,50 = 278,30 €. El hueco es 24,20 = 20 × 1,21.
//
// ── LO FIRMADO (SCRUM-1624 c.21094, P1-P5 ✅) ───────────────────────────────────────────
//   P1. SOLO con descuento global, una fila «Descuento global» (el rótulo de la tarjeta de
//       factura), en negativo y con IVA. Sin descuento global, la tarjeta no cambia.
//   P2. Importe = calcTotal(líneas) − calcTotal(líneas, global): ninguna cuenta nueva.
//   P3. La fila va la PRIMERA.   P4. «Ver detalles (N líneas)» no la cuenta.
//
// Se pide la ruta con el Prisma de mentira de scrum1568 y se leen las cifras que ve el cliente.
// Lo esperado sale de `calcTotal`, no de un literal, salvo el ejemplo del ticket, que se escribe
// entero para que el test diga las mismas cifras que la firma.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // La fila deja de salir: las filas vuelven a sumar 278,30 €.
    fichero: 'src/modules/system/app/routes/customerPortal.routes.ts',
    de: 'if (!(conGlobal < sinGlobal)) return null;',
    a: 'if (!(conGlobal < sinGlobal) || true) return null;',
    cae: 'SCRUM-1624b · con descuento global, las filas de la tarjeta suman el total: 254,10 €, no 278,30 €',
  },
  {
    // La fila se cuenta en «Ver detalles (N líneas)».
    fichero: 'src/modules/system/app/routes/customerPortal.routes.ts',
    de: 'const nLineas = lineasDelPresupuesto.length;',
    a: 'const nLineas = lineasDelPresupuesto.length + (filaDescuentoGlobal ? 1 : 0);',
    cae: 'SCRUM-1624b · «Ver detalles (N líneas)» no cuenta la fila del descuento global',
  },
];

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));

// ── El Prisma de mentira, en la caché ANTES de cargar la ruta (el de scrum1568) ─────────────
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
  id: 1624, name: 'Taller', legalName: 'Taller SL', email: 'taller@test.local', logoUrl: null, address: null,
  country: 'ES', brandColor: null, brandAccentColor: null, whatsappPhone: null, flags: {},
  connectStatus: 'none', stripeAccountId: null, timezone: 'Europe/Madrid',
};

/** Pide el portal con UN presupuesto aceptado y lee su tarjeta: total, rótulo del desplegable y filas. */
async function tarjetaDelPresupuesto(lineas, discountGlobalAmount) {
  tablas.customer = { findUnique: async () => ({ id: 3, merchantId: merchant.id, name: 'Ana', portalToken: 'tok1624', merchant }) };
  tablas.quote = {
    findMany: async () => [{
      id: 9, quoteNumber: 7, status: 'accepted', createdAt: new Date('2026-10-27T10:00:00Z'), currency: 'EUR',
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
        { host: '127.0.0.1', port: server.address().port, path: '/portal/tok1624', method: 'GET', agent: false },
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
    return {
      total: (t.match(/<div class="pf-card-amount"[^>]*>([^<]*)<\/div>/) || [])[1],
      desplegable: ((t.match(/<button class="pf-lines-toggle"[^>]*>([\s\S]*?)<\/button>/) || [])[1] ?? '')
        .replace(/<span class="pf-chevron"[^>]*>[^<]*<\/span>/, '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(),
      filas: [...t.matchAll(/<span class="pf-line-concept"[^>]*>([^<]*)<\/span>\s*<span class="pf-line-amount"[^>]*>([^<]*)<\/span>/g)]
        .map((m) => ({ concepto: m[1], importe: m[2].trim() })),
      html: t,
    };
  } finally {
    await new Promise((r) => server.close(r));
  }
}

/** «-1.234,56 €» → -1234.56. Lo que no es un importe da NaN, y una suma con NaN no cuadra con nada. */
const aNumero = (s) => Number(String(s).replace(/[^\d,-]/g, '').replace(',', '.'));
const sumaDe = (filas) => Math.round(filas.filter((f) => f.importe !== '').reduce((a, f) => a + aNumero(f.importe), 0) * 100) / 100;

const EJEMPLO = [
  { concept: 'Mano de obra', qty: 2, price: 100, tax: 0.21, dto: 10 },
  { concept: 'Material', qty: 1, price: 50, tax: 0.21 },
];

// El rótulo de la tarjeta de FACTURA vive en una constante NO exportada del camino de emisión
// (`invoiceLines.service.ts`). Exportarla sería tocar ese camino (regla 38), así que el portal
// lleva el mismo literal y aquí se comprueba que es EL MISMO: si uno cambia, esto cae.
const ROTULO = (() => {
  const fuente = fs.readFileSync(path.join(RAIZ, 'src/modules/invoicing/domain/invoiceLines.service.ts'), 'utf8');
  const m = fuente.match(/^const ROTULO_DESCUENTO_GLOBAL = '([^']+)';$/m);
  assert.ok(m, 'no encuentro ROTULO_DESCUENTO_GLOBAL en invoiceLines.service.ts: el test no sabe qué rótulo esperar');
  return m[1];
})();

test('SCRUM-1624b · ✅ CONTROL: el lector ve la tarjeta, su desplegable y sus filas', async () => {
  const t = await tarjetaDelPresupuesto(EJEMPLO, null);
  assert.equal(t.filas.length, 2, `el lector no encuentra las dos filas: ${JSON.stringify(t.filas)}`);
  assert.equal(t.desplegable, 'Ver detalles (2 líneas)');
  assert.equal(t.total, formatMoneyEs(278.3, 'EUR'));
});

test('SCRUM-1624b · con descuento global, las filas de la tarjeta suman el total: 254,10 €, no 278,30 €', async () => {
  const t = await tarjetaDelPresupuesto(EJEMPLO, 20);
  assert.equal(t.total, formatMoneyEs(254.1, 'EUR'), `el total de la tarjeta no es el del ticket: ${t.total}`);
  assert.equal(sumaDe(t.filas), 254.1, `las filas suman ${sumaDe(t.filas)}: ${JSON.stringify(t.filas)}`);
});

test('SCRUM-1624b · la fila «Descuento global» va la PRIMERA, en negativo y con IVA (−24,20 €)', async () => {
  const t = await tarjetaDelPresupuesto(EJEMPLO, 20);
  assert.equal(t.filas.length, 3, `esperaba la fila del descuento y las dos líneas: ${JSON.stringify(t.filas)}`);
  assert.equal(t.filas[0].concepto, ROTULO);
  assert.equal(t.filas[0].importe, formatMoneyEs(-24.2, 'EUR'));
  // P2: la misma función que da el total, ninguna cuenta nueva.
  assert.equal(aNumero(t.filas[0].importe), Math.round((calcTotal(EJEMPLO, 20) - calcTotal(EJEMPLO)) * 100) / 100);
  assert.deepEqual(t.filas.slice(1).map((f) => f.concepto), ['Mano de obra', 'Material']);
});

test('SCRUM-1624b · «Ver detalles (N líneas)» no cuenta la fila del descuento global', async () => {
  const t = await tarjetaDelPresupuesto(EJEMPLO, 20);
  assert.equal(t.desplegable, 'Ver detalles (2 líneas)');
});

test('SCRUM-1624b · sin descuento global (null, 0 o una cadena vacía), la tarjeta es idéntica', async () => {
  const base = await tarjetaDelPresupuesto(EJEMPLO, null);
  for (const g of [0, '0', '', undefined]) {
    const t = await tarjetaDelPresupuesto(EJEMPLO, g);
    assert.equal(t.html, base.html, `con discountGlobalAmount=${JSON.stringify(g)} la tarjeta cambia`);
    assert.ok(!t.html.includes(ROTULO), `con discountGlobalAmount=${JSON.stringify(g)} sale la fila`);
  }
});
