// SCRUM-1735 · LA FACTURA COBRADA TOMA LA FECHA DEL COBRO, NO LA DE LA CONFIRMACIÓN.
//
// Medido por jv-j1em en SCRUM-1732 c.21820, ejecutando: un Bizum del 31-mar confirmado el 13-nov
// dejaba el `Charge` con `paidAt = 2026-03-31` (SCRUM-397/1301 ya lo arreglaron ahí) y la FACTURA con
// `paidAt = <reloj del proceso>`. Con criterio de caja, el libro la devengaba en el T4 y no en el T1.
//
// `/webhooks/psp` escribe la factura en DOS sitios, que se activan por caminos distintos:
//   · el marcado robusto (P0-3): la factura ya está enlazada al cobro (`invoice.findFirst`);
//   · tras `ensureInvoiceForCharge` (con `AUTO_INVOICE_ON_PAID`): la factura la devuelve él.
// Cada uno lleva su caso. Los dos tienen la fecha declarada a mano: es `resolucion.fecha`, la misma
// que acaba de guardar el `Charge`.
//
// `mpWebhook.routes.ts` NO está aquí: lo confirma Mercado Pago y no llega ninguna fecha declarada
// (medido en SCRUM-1735 c.21826). Su reloj lo sigue vigilando `scrum397-fecha-real-de-cobro`.
//
// GO: SCRUM-1732 c.21824 («GO a J2: rojo primero y arreglo») y SCRUM-1735 c.21828 («Sí a las dos»).
//
// ⛔ Sin base: el doble es el de la casa (`_envio-doblado.mjs`), con estado para la factura y el cobro.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { dobleDeLaBase } from './_envio-doblado.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(import.meta.url);
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));

// Las dos piezas del arreglo, cada una con el caso que la sujeta (meta-guard de mutaciones).
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El marcado robusto vuelve al reloj del proceso.
    fichero: 'src/modules/billing/app/routes/psp.routes.ts',
    de: "data: { status: 'paid', paidAt: resolucion.fecha },",
    a: "data: { status: 'paid', paidAt: new Date() },",
    cae: 'SCRUM-1735 · 🔴 factura ENLAZADA al cobro: toma la fecha declarada',
  },
  {
    // La escritura tras `ensureInvoiceForCharge` vuelve al reloj del proceso.
    fichero: 'src/modules/billing/app/routes/psp.routes.ts',
    de: '                paidAt: resolucion.fecha,',
    a: '                paidAt: new Date(),',
    cae: 'SCRUM-1735 · 🔴 factura que devuelve `ensureInvoiceForCharge`: toma la fecha declarada',
  },
];

const M = 4735;
const FACTURA = 1735;
const COBRO = 2735;
const DECLARADA = '2026-03-31';

const estado = { fila: null, cobro: null, enlazada: true, escrituras: [] };

function nuevoCaso({ enlazada }) {
  estado.fila = {
    id: FACTURA, merchantId: M, number: 'F-2026-1735', status: 'pending', type: 'F1', paidAt: null,
    chargeId: enlazada ? COBRO : null, quoteId: null,
  };
  estado.cobro = {
    id: COBRO, merchantId: M, customerId: null, status: 'pending', amount: '1000.00', currency: 'EUR',
    method: 'bizum_manual', intentId: null, customer: null, paidAt: null,
  };
  estado.enlazada = enlazada;
  estado.escrituras = [];
}

/** ¿Casa la fila con este `where`? Lo justo para las escrituras de `psp.routes`, o lanza. */
function casa(fila, where = {}) {
  return Object.entries(where).every(([k, v]) => {
    if (k === 'OR') return v.some((w) => casa(fila, w));
    if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
      return Object.entries(v).every(([op, x]) => {
        if (op === 'not') return fila[k] !== x;
        throw new Error(`🔴 EL DOBLE NO SABE EVALUAR \`${k}: { ${op} }\`. Enséñaselo; no lo des por bueno.`);
      });
    }
    return fila[k] === v;
  });
}

const doble = dobleDeLaBase({
  'invoice.findFirst': (a) => (estado.enlazada && casa(estado.fila, a?.where) ? { ...estado.fila } : null),
  'invoice.findUnique': () => ({ ...estado.fila }),
  'invoice.update': (a) => {
    if (!casa(estado.fila, a?.where)) { const e = new Error('Record to update not found.'); e.code = 'P2025'; throw e; }
    estado.escrituras.push(a.data);
    Object.assign(estado.fila, a.data);
    return { ...estado.fila };
  },
  'merchant.findUnique': () => ({ id: M, country: 'ES', timezone: 'Europe/Madrid' }),
  'charge.findUnique': () => ({ ...estado.cobro }),
  'charge.update': (a) => {
    const { events, reconciliations, ...columnas } = a?.data ?? {};
    Object.assign(estado.cobro, columnas);
    return { ...estado.cobro };
  },
});

const fPrisma = rutaDe('dist/core/db/prisma.js');
requiere.cache[fPrisma] = { id: fPrisma, filename: fPrisma, loaded: true, exports: { prisma: doble } };
for (const [r, exports] of [
  ['dist/lib/email.js', { sendInvoiceEmail: async () => {} }],
  ['dist/lib/invoicing.js', {
    // Sólo en el caso «no enlazada» devuelve la factura: así cada caso ejercita UNA de las dos escrituras.
    ensureInvoiceForCharge: async () => (estado.enlazada ? null : { id: FACTURA, status: estado.fila.status }),
    ensureChargeReceiptToken: async () => 'tok_1735',
  }],
]) {
  const f = rutaDe(r);
  requiere.cache[f] = { id: f, filename: f, loaded: true, exports };
}

const { config } = requiere(rutaDe('dist/core/config/env.js'));
const pspRouter = requiere(rutaDe('dist/modules/billing/app/routes/psp.routes.js'));
const capa = (pspRouter.default || pspRouter).stack.find((l) => l.route?.path === '/' && l.route.methods.post);
assert.ok(capa, '🔴 CIEGO: no encuentro POST / en psp.routes');
const pspH = capa.route.stack.at(-1).handle;

async function aviso({ ts } = {}) {
  const r = { statusCode: 200, cuerpo: null };
  const res = { status(c) { r.statusCode = c; return res; }, json(x) { r.cuerpo = x; return res; } };
  const body = { event: 'payment.confirmed', charge_id: COBRO, method: 'bizum_manual', bank_ref: 'b-1735', amount: 1000, currency: 'EUR' };
  if (ts !== undefined) body.ts = ts;
  const antes = config.AUTO_INVOICE_ON_PAID;
  const errorOriginal = console.error;
  config.AUTO_INVOICE_ON_PAID = true;
  console.error = () => {};
  try {
    await pspH({ body, headers: {} }, res, (e) => { if (e) throw e; });
  } finally {
    config.AUTO_INVOICE_ON_PAID = antes;
    console.error = errorOriginal;
  }
  return r;
}

/** Comprueba que el caso ha pasado por la escritura que dice, y por ninguna otra. */
function unaEscritura() {
  assert.equal(estado.escrituras.length, 1,
    `🔴 CIEGO: el caso tenía que escribir la factura UNA vez y la escribió ${estado.escrituras.length}`);
  assert.equal(estado.fila.status, 'paid', 'precondición: la factura queda cobrada');
}

const esMarzoDe2026 = (d) => d instanceof Date && d.getUTCFullYear() === 2026 && d.getUTCMonth() === 2;

// ── LAS DOS BOCAS CON FECHA DECLARADA ──────────────────────────────────────────────────────

test('SCRUM-1735 · 🔴 factura ENLAZADA al cobro: toma la fecha declarada', async () => {
  nuevoCaso({ enlazada: true });
  const r = await aviso({ ts: DECLARADA });
  assert.equal(r.statusCode, 200, JSON.stringify(r.cuerpo));
  unaEscritura();
  assert.ok(esMarzoDe2026(estado.cobro.paidAt), `precondición: el cobro guarda la fecha declarada (${estado.cobro.paidAt?.toISOString?.()})`);
  assert.equal(estado.fila.paidAt?.getTime(), estado.cobro.paidAt.getTime(),
    `🔴 LA FACTURA SE FECHA CON EL RELOJ: ${estado.fila.paidAt?.toISOString?.()} y el cobro es del `
    + `${estado.cobro.paidAt.toISOString()}. Con criterio de caja, eso la cambia de trimestre (SCRUM-1732 c.21820).`);
});

test('SCRUM-1735 · 🔴 factura que devuelve `ensureInvoiceForCharge`: toma la fecha declarada', async () => {
  nuevoCaso({ enlazada: false });
  const r = await aviso({ ts: DECLARADA });
  assert.equal(r.statusCode, 200, JSON.stringify(r.cuerpo));
  unaEscritura();
  assert.ok(esMarzoDe2026(estado.cobro.paidAt), 'precondición: el cobro guarda la fecha declarada');
  assert.equal(estado.fila.paidAt?.getTime(), estado.cobro.paidAt.getTime(),
    `🔴 LA FACTURA SE FECHA CON EL RELOJ: ${estado.fila.paidAt?.toISOString?.()} y el cobro es del `
    + `${estado.cobro.paidAt.toISOString()}. Con criterio de caja, eso la cambia de trimestre (SCRUM-1732 c.21820).`);
});

// ── CONTROL: SIN FECHA DECLARADA, IGUAL QUE HOY ───────────────────────────────────────────

async function sinFechaDeclarada(enlazada) {
  nuevoCaso({ enlazada });
  const antes = Date.now();
  const r = await aviso();
  const despues = Date.now();
  assert.equal(r.statusCode, 200, JSON.stringify(r.cuerpo));
  unaEscritura();
  const t = estado.fila.paidAt?.getTime();
  assert.ok(t >= antes && t <= despues,
    `🔴 sin \`ts\` la factura tenía que llevar el instante del aviso, como hoy, y lleva ${estado.fila.paidAt?.toISOString?.()}`);
}

test('SCRUM-1735 · CONTROL: sin fecha declarada, la factura enlazada se fecha con el instante del aviso', async () => {
  await sinFechaDeclarada(true);
});

test('SCRUM-1735 · CONTROL: sin fecha declarada, la factura de `ensureInvoiceForCharge` se fecha con el instante del aviso', async () => {
  await sinFechaDeclarada(false);
});
