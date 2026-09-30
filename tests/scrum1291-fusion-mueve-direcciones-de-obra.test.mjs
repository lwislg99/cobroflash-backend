// SCRUM-1291 · FUSIONAR UN CLIENTE CON DIRECCIONES DE OBRA DABA UN 500, Y EL REINTENTO TAMBIÉN.
//
// `fusionarClientes` movía nueve tablas del fusionado al principal y luego lo borraba. La décima
// con `customerId`, `customer_sites` (SCRUM-1014), no estaba — y su FK a `customers` es
// `ON DELETE RESTRICT` (DDL real, `prisma migrate diff --from-empty`, citado en el registro). El
// `DELETE` final fallaba, la transacción entera volvía atrás, la ruta respondía 500 y el siguiente
// intento se encontraba exactamente lo mismo: un botón que no podía salir bien nunca.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 POR QUÉ EL BANCO SACA LAS TABLAS Y LAS FK DEL ESQUEMA, Y NO DE UNA LISTA
//
// El defecto fue exactamente eso: una lista escrita a mano (las nueve del censo de SCRUM-1057)
// que no se enteró de que el esquema había ganado una tabla. Un test con su propia lista de diez
// repetiría la forma del fallo con la tabla once. Así que aquí:
//   · las tablas que la fusión tiene que mover son TODOS los modelos de `prisma/schema.prisma` con
//     un campo `customerId`, menos una excepción declarada (`Invoice`, con su motivo y su caso);
//   · las FK a `customers` salen de las relaciones `Customer` del mismo esquema, con la regla de
//     Prisma para `onDelete` ausente: relación obligatoria → RESTRICT, opcional → SET NULL.
// Si mañana aparece un duodécimo modelo con `customerId` y la fusión no lo mueve, el caso ① cae.
//
// El banco HACE CUMPLIR el `where` entero (patrón SCRUM-1292), el `RESTRICT` al borrar, y deshace
// la transacción si el callback lanza: sin eso no se vería que el reintento vuelve a fallar.
//
// La mitad con Postgres REAL vive en `scrum1057b-fusion-clientes-postgres.test.mjs` (banco
// desechable de CI): allí la FK la pone el motor, no este banco.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../dist/core/db/prisma.js';
import routerModulo from '../dist/modules/system/app/routes/customersAdmin.routes.js';

const RAIZ = path.resolve(import.meta.dirname, '..');
const router = routerModulo.default ?? routerModulo;
const M = 1291;
const OTRO_M = 1292;

// ── El esquema, leído ────────────────────────────────────────────────────────────────────────
const ESQUEMA = fs.readFileSync(path.join(RAIZ, 'prisma/schema.prisma'), 'utf8');
const MODELOS = [...ESQUEMA.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)].map(([, nombre, cuerpo]) => ({ nombre, cuerpo }));
const delegado = (modelo) => modelo[0].toLowerCase() + modelo.slice(1);

/** Modelos con un campo `customerId` (la población que la fusión tiene que mover). */
const CON_CUSTOMER_ID = MODELOS.filter((m) => /^\s+customerId\s+Int\??\b/m.test(m.cuerpo)).map((m) => delegado(m.nombre));

/** FK a `customers`: delegado → 'restrict' | 'setnull'. */
const FK_A_CUSTOMERS = new Map(MODELOS.flatMap((m) => {
  const r = m.cuerpo.match(/^\s+\w+\s+Customer(\??)\s+@relation\(([^)]*)\)/m);
  if (!r || !/fields:\s*\[customerId\]/.test(r[2])) return [];
  const explicito = r[2].match(/onDelete:\s*(\w+)/)?.[1];
  const accion = explicito ? explicito.toLowerCase() : (r[1] === '?' ? 'setnull' : 'restrict');
  return [[delegado(m.nombre), accion]];
}));

// La ÚNICA excepción: una factura emitida no se reasigna nunca (regla 29). No se mueve porque la
// fusión se RECHAZA antes si existe — lo demuestra el caso ⑤, no esta línea.
const EXCEPCIONES = { invoice: 'regla 29: con una factura emitida la fusión se rechaza (409 factura_emitida), caso ⑤' };
const A_MOVER = CON_CUSTOMER_ID.filter((d) => !(d in EXCEPCIONES));

test('SCRUM-1291 · SUELO del instrumento: el esquema se lee y la población no está vacía', () => {
  // Una regex que no casara devolvería [] y todos los casos de abajo pasarían sin mover nada.
  assert.ok(CON_CUSTOMER_ID.length >= 11, `🔴 sólo ${CON_CUSTOMER_ID.length} modelos con customerId: el lector del esquema no casa`);
  for (const d of ['quote', 'job', 'customerEvent', 'charge', 'customerSite', 'emailMessage', 'invoice']) {
    assert.ok(CON_CUSTOMER_ID.includes(d), `🔴 ${d} no aparece en la población leída del esquema`);
  }
  for (const d of Object.keys(EXCEPCIONES)) assert.ok(CON_CUSTOMER_ID.includes(d), `🔴 la excepción «${d}» ya no existe en el esquema`);
  assert.equal(FK_A_CUSTOMERS.get('customerSite'), 'restrict', '🔴 la FK de customer_sites ya no es RESTRICT: re-mide el ticket');
  assert.equal(FK_A_CUSTOMERS.get('quote'), 'restrict');
  assert.equal(FK_A_CUSTOMERS.get('charge'), 'setnull', 'Charge.customer es opcional → SET NULL (DDL real)');
  assert.equal(FK_A_CUSTOMERS.has('job'), false, 'Job.customerId no tiene relación: sin FK');
});

// ── El banco ─────────────────────────────────────────────────────────────────────────────────
class ErrorFk extends Error {
  constructor(tabla) { super(`Foreign key constraint violated: ${tabla}_customer_id_fkey`); this.code = 'P2003'; }
}

const casa = (fila, where = {}) => Object.entries(where).every(([k, v]) => {
  if (v === undefined) return true;
  if (v && typeof v === 'object' && 'in' in v) return v.in.includes(fila[k]);
  if (v && typeof v === 'object') throw new Error(`🔴 el banco no sabe evaluar ${k}: ${JSON.stringify(v)} — enséñaselo`);
  return fila[k] === v;
});

function montarBanco(sembrado) {
  let tablas = structuredClone(sembrado);
  let siguienteId = 100000;
  const tabla = (d) => {
    if (!(d in tablas)) throw new Error(`🔴 el banco no conoce la tabla «${d}» y el código la ha pedido`);
    return tablas[d];
  };
  const proyecta = (fila, select) => (fila && select ? Object.fromEntries(Object.keys(select).map((k) => [k, fila[k]])) : fila);
  const delegadoDe = (d) => ({
    findFirst: async ({ where, select } = {}) => proyecta(structuredClone(tabla(d).find((f) => casa(f, where)) ?? null), select),
    findUnique: async ({ where, select } = {}) => proyecta(structuredClone(tabla(d).find((f) => casa(f, where)) ?? null), select),
    count: async ({ where } = {}) => tabla(d).filter((f) => casa(f, where)).length,
    create: async ({ data }) => { const f = { id: siguienteId++, ...structuredClone(data) }; tabla(d).push(f); return structuredClone(f); },
    updateMany: async ({ where, data }) => {
      const filas = tabla(d).filter((f) => casa(f, where));
      for (const f of filas) Object.assign(f, structuredClone(data));
      return { count: filas.length };
    },
    deleteMany: async ({ where }) => {
      const van = tabla(d).filter((f) => casa(f, where));
      if (d === 'customer') {
        const ids = new Set(van.map((f) => f.id));
        for (const [hija, accion] of FK_A_CUSTOMERS) {
          const colgadas = (tablas[hija] ?? []).filter((f) => ids.has(f.customerId));
          if (colgadas.length && accion === 'restrict') throw new ErrorFk(hija);
          for (const f of colgadas) f.customerId = null;
        }
      }
      tablas[d] = tabla(d).filter((f) => !van.includes(f));
      return { count: van.length };
    },
  });
  const delegados = Object.fromEntries(Object.keys(tablas).map((d) => [d, delegadoDe(d)]));
  const $transaction = async (cb) => {
    if (typeof cb !== 'function') throw new Error('🔴 el banco sólo imita la $transaction interactiva');
    const copia = structuredClone(tablas);
    try {
      return await cb(new Proxy({}, { get: (_t, p) => delegados[p] ?? (() => { throw new Error(`🔴 tx.${String(p)} no existe en el banco`); })() }));
    } catch (e) {
      tablas = copia; // Postgres deshace la transacción entera.
      throw e;
    }
  };
  return { delegados, $transaction, leer: () => tablas };
}

/** Siembra: principal (10), fusionado (20), y una fila del fusionado en cada tabla pedida. */
function sembrar(tablasConFila, { facturaDe = null, sitioDelPrincipal = false } = {}) {
  const t = { customer: [], invoice: [] };
  for (const d of CON_CUSTOMER_ID) t[d] ??= [];
  t.customer.push(
    { id: 10, merchantId: M, name: 'Ana Principal', taxId: null, tags: [], companyId: null },
    { id: 20, merchantId: M, name: 'Ana Duplicada', taxId: null, tags: [], companyId: null },
    { id: 30, merchantId: OTRO_M, name: 'De otro merchant', taxId: null, tags: [], companyId: null },
  );
  let id = 1;
  for (const d of tablasConFila) t[d].push({ id: id++, merchantId: M, customerId: 20, name: 'Piso 3ºB', address: 'C/ Mayor 1' });
  if (sitioDelPrincipal) t.customerSite.push({ id: id++, merchantId: M, customerId: 10, name: 'Piso 3ºB', address: 'C/ Mayor 1' });
  // Una fila de OTRO merchant: la fusión no puede tocarla.
  t.customerSite.push({ id: id++, merchantId: OTRO_M, customerId: 30, name: 'Ajena', address: null });
  if (facturaDe) t.invoice.push({ id: id++, merchantId: M, customerId: facturaDe });
  return t;
}

/** Llama al handler REAL de `POST /admin/customers/:id/fusionar` sobre el banco. */
async function fusionarPorLaRuta(banco, { principal = 10, con = 20 } = {}) {
  const originales = {};
  const poner = { ...banco.delegados, $transaction: banco.$transaction };
  for (const k of Object.keys(poner)) { originales[k] = prisma[k]; prisma[k] = poner[k]; }
  const errorOriginal = console.error;
  console.error = () => {}; // el 500 se loguea; aquí se mide por el status.
  let status = 200;
  let cuerpo = null;
  const res = { status(c) { status = c; return res; }, json(b) { cuerpo = b; return res; } };
  try {
    const capa = router.stack.find((l) => l.route?.path === '/:id/fusionar' && l.route.methods.post);
    assert.ok(capa, 'no encuentro POST /:id/fusionar');
    await capa.route.stack[capa.route.stack.length - 1].handle(
      { merchantId: M, userRole: 'admin', params: { id: String(principal) }, body: { con }, query: {} }, res);
  } finally {
    for (const k of Object.keys(originales)) prisma[k] = originales[k];
    console.error = errorOriginal;
  }
  return { status, cuerpo };
}

const SIN_SITIOS = A_MOVER.filter((d) => d !== 'customerSite');

test('SCRUM-1291 · ① CONTROL POSITIVO: sin direcciones de obra, la fusión mueve todas las demás tablas y borra al fusionado', async () => {
  const banco = montarBanco(sembrar(SIN_SITIOS));
  const r = await fusionarPorLaRuta(banco);
  assert.equal(r.status, 200, `🔴 la fusión sin direcciones de obra ya no funciona: ${JSON.stringify(r.cuerpo)}`);
  const t = banco.leer();
  for (const d of SIN_SITIOS) {
    assert.ok(t[d].length >= 1, `🔴 la fila sembrada de ${d} desapareció`);
    assert.ok(t[d].filter((f) => f.merchantId === M).every((f) => f.customerId === 10), `🔴 ${d} se quedó apuntando al fusionado (borrado)`);
  }
  assert.equal(t.customer.some((c) => c.id === 20), false, '🔴 el fusionado sigue existiendo');
  assert.ok(t.customerEvent.some((e) => e.type === 'fusion' && e.customerId === 10), '🔴 no queda el apunte de la fusión');
});

test('SCRUM-1291 · ② 🔴 con UNA dirección de obra, la fusión termina y la dirección pasa al principal', async () => {
  const banco = montarBanco(sembrar(['customerSite']));
  const r = await fusionarPorLaRuta(banco);
  assert.equal(r.status, 200, `🔴 fusionar un cliente con dirección de obra responde ${r.status} ${JSON.stringify(r.cuerpo)}`);
  const t = banco.leer();
  assert.deepEqual(t.customerSite.filter((s) => s.merchantId === M).map((s) => s.customerId), [10], '🔴 la dirección de obra no pasó al principal');
  assert.equal(t.customer.some((c) => c.id === 20), false, '🔴 el fusionado sigue existiendo');
  assert.deepEqual(t.customerSite.filter((s) => s.merchantId === OTRO_M).map((s) => s.customerId), [30], '🔴 se tocó la dirección de OTRO merchant');
});

test('SCRUM-1291 · ③ la MISMA dirección en los dos clientes: no hay unicidad que choque, el principal se queda con las dos', async () => {
  // Medido en el DDL: `customer_sites` no tiene índice único. Deduplicar sería BORRAR datos del
  // cliente (STOP) — no se hace: se mueven las dos y el profesional decide.
  assert.equal(/@@unique|@unique/.test(MODELOS.find((m) => m.nombre === 'CustomerSite').cuerpo), false,
    '🔴 CustomerSite ganó una restricción de unicidad: mover a pelo puede chocar, re-decidir');
  const banco = montarBanco(sembrar(A_MOVER, { sitioDelPrincipal: true }));
  const r = await fusionarPorLaRuta(banco);
  assert.equal(r.status, 200, `🔴 ${r.status} ${JSON.stringify(r.cuerpo)}`);
  const sitios = banco.leer().customerSite.filter((s) => s.merchantId === M);
  assert.equal(sitios.length, 2, '🔴 se perdió una dirección de obra');
  assert.ok(sitios.every((s) => s.customerId === 10));
});

test('SCRUM-1291 · ④ una fusión que falla deja TODO como estaba (el banco deshace de verdad)', async () => {
  // Control del propio banco: si su rollback no funcionara, ⑤ no probaría «no se tocó nada».
  const banco = montarBanco(sembrar(['customerSite', 'job']));
  const antes = structuredClone(banco.leer());
  await assert.rejects(() => banco.$transaction(async (tx) => {
    await tx.job.updateMany({ where: { merchantId: M, customerId: 20 }, data: { customerId: 10 } });
    await tx.customer.deleteMany({ where: { id: 20, merchantId: M } });
  }), (e) => e.code === 'P2003', '🔴 el banco no hace cumplir el RESTRICT de customer_sites');
  assert.deepEqual(banco.leer(), antes, '🔴 el banco no deshizo la transacción');
});

test('SCRUM-1291 · ⑤ con una factura emitida sigue saliendo 409 factura_emitida y no se mueve nada', async () => {
  for (const facturaDe of [10, 20]) {
    const banco = montarBanco(sembrar(A_MOVER, { facturaDe }));
    const antes = structuredClone(banco.leer());
    const r = await fusionarPorLaRuta(banco);
    assert.equal(r.status, 409, `🔴 factura en el cliente ${facturaDe}: responde ${r.status}`);
    assert.deepEqual(r.cuerpo, { error: 'factura_emitida' });
    assert.deepEqual(banco.leer(), antes, '🔴 se movió algo pese al rechazo');
  }
});
