// tests/_banco-emision-con-estado.mjs — SCRUM-1304 / SCRUM-1330
//
// EL BANCO CON ESTADO DEL CAMINO DE EMISIÓN. Nació dentro de
// `tests/scrum1304-un-cobro-una-factura.test.mjs` y se sacó a un módulo cuando lo necesitó un
// segundo fichero (`tests/scrum1330-una-sellada-no-se-resella.test.mjs`). El código es el mismo.
//
// Dobla la BASE, el PDF y el correo, y nada más: lo que corre encima es `dist/` tal cual.
//
// EL BANCO TIENE ESTADO (lo que se escribe se lee), evalúa el `where` entero con el evaluador de
// la casa (`_where-como-prisma.mjs`) y modela el cerrojo consultivo como lo que es: una exclusión
// por clave que se suelta al terminar la transacción, re-entrante dentro de la misma.
//
// 🔴 SUS LÍMITES, DICHOS:
//   · NO deshace una transacción que lanza (no hay rollback).
//   · NO aísla: lo escrito dentro de una transacción se ve fuera antes del commit.
//   · NO es Postgres. La carrera contra una base real no se ha medido: en la máquina donde se
//     escribió no hay ninguna, y darle una en CI es tocar un workflow.
//   · El `select` se ignora: devuelve la fila entera.
//
// ⚠️ HAY QUE IMPORTARLO ANTES de cargar nada de `dist/`: al importarse deja el doble de la base,
// del PDF y del correo en la caché de `require`. Un `dist/` cargado antes hablaría con Prisma.
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { casa, filaNoEncontrada } from './_where-como-prisma.mjs';

// ANTES de cargar `dist/`: ningún aviso sale hacia Meta (`whatsapp.ts`, dry-run).
process.env.WHATSAPP_DRY_RUN = '1';

const RAIZ = path.resolve(import.meta.dirname, '..');
export const requiere = createRequire(import.meta.url);
export const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));

export const M_PT = 4304; // fuera de España: emite factura sin entrar en la cadena (como la sonda de J6)
export const M_ES = 5304; // España con el flag por merchant: entra en la cadena
export const CLIENTE = 6304;
export const NS_SERIE = 1749;

export const banco = {
  tablas: {},
  ids: {},
  cerrojos: new Map(), // clave → promesa de la cola
  tomas: [],           // cada toma del cerrojo de serie, en orden
  alPedirCerrojoDeSerie: null,
  pdf: { fallos: 0, generados: 0 },
  ajenas: [],          // llamadas a modelos que el banco no gobierna
  escriturasFactura: [], // cada `invoice.update`, en orden: { id, campos } — para contar por EFECTO qué se escribió
};

// `auditLog` tiene estado desde SCRUM-1330: un encolado que no llega a la cola deja ahí su
// `encolado_fallido`, y contar los intentos de encolar exige poder leerlo.
const CON_ESTADO = ['merchant', 'customer', 'charge', 'event', 'quote', 'invoice', 'vfSubmission', 'auditLog'];

export function reiniciar() {
  banco.tablas = Object.fromEntries(CON_ESTADO.map((t) => [t, []]));
  banco.ids = {};
  banco.cerrojos = new Map();
  banco.tomas = [];
  banco.alPedirCerrojoDeSerie = null;
  banco.pdf = { fallos: 0, generados: 0 };
  banco.ajenas = [];
  banco.escriturasFactura = [];
  banco.tablas.merchant.push(
    {
      id: M_PT, name: 'Canalizações do Porto', legalName: null, taxId: 'PT509999990', country: 'PT',
      email: 'porto@ejemplo.invalid', flags: null, timezone: 'Europe/Lisbon', address: 'Rua 1', logoUrl: null,
      whatsappPhone: null, googleReviewUrl: null, notifyEmailOnPaid: false,
      invoiceSeriesPrefix: null, nextInvoiceNumber: 1, nextRectInvoiceNumber: 1, invoiceSeriesYear: null,
      invoiceStartSeq: null, invoiceStartYear: null,
    },
    {
      id: M_ES, name: 'Fontanería de Lugo', legalName: null, taxId: 'B27000001', country: 'ES',
      email: 'lugo@ejemplo.invalid', flags: { INVOICING_ES_ENABLED: true }, timezone: 'Europe/Madrid', address: 'Rúa 1', logoUrl: null,
      whatsappPhone: null, googleReviewUrl: null, notifyEmailOnPaid: false,
      invoiceSeriesPrefix: null, nextInvoiceNumber: 1, nextRectInvoiceNumber: 1, invoiceSeriesYear: null,
      invoiceStartSeq: null, invoiceStartYear: null,
    },
  );
  banco.tablas.customer.push({ id: CLIENTE, name: 'Clienta de prueba', legalName: null, taxId: null, address: null, email: null, phone: null, whatsappPhone: null });
}

export function nuevoId(tabla) {
  banco.ids[tabla] = (banco.ids[tabla] ?? 100) + 1;
  return banco.ids[tabla];
}

/** `startsWith` es lo único que el evaluador de la casa no sabe y `allocateInvoiceNumber` usa. */
function casaBanco(fila, where = {}) {
  return Object.entries(where).every(([k, v]) => {
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && Object.keys(v).join() === 'startsWith') {
      return typeof fila[k] === 'string' && fila[k].startsWith(v.startsWith);
    }
    return casa(fila, { [k]: v });
  });
}

function ordenar(filas, orderBy) {
  if (!orderBy) return filas;
  const [[campo, sentido], ...resto] = Object.entries(orderBy);
  assert.equal(resto.length, 0, '🔴 EL BANCO NO SABE ordenar por más de un campo');
  const s = sentido === 'desc' ? -1 : 1;
  return [...filas].sort((a, b) => (a[campo] > b[campo] ? s : a[campo] < b[campo] ? -s : 0));
}

export const POR_DEFECTO = {
  invoice: () => ({
    status: 'pending', paidAt: null, vfEstado: 'pendiente_de_sellado', vfHash: null, vfPrevHash: null,
    vfTimestamp: null, vfAnulHash: null, vfAnulTimestamp: null, chargeId: null, quoteId: null,
    stageLabel: null, rectifiesId: null, createdAt: new Date(),
  }),
  event: () => ({ ts: new Date() }),
};

function conRelaciones(tabla, fila, include) {
  const copia = { ...fila };
  if (tabla !== 'charge' || !include) return copia;
  if (include.customer) copia.customer = banco.tablas.customer.find((c) => c.id === fila.customerId) ?? null;
  if (include.merchant) copia.merchant = banco.tablas.merchant.find((m) => m.id === fila.merchantId) ?? null;
  if (include.events) copia.events = banco.tablas.event.filter((e) => e.chargeId === fila.id).map((e) => ({ ...e }));
  return copia;
}

function modeloConEstado(tabla) {
  const filas = () => banco.tablas[tabla];
  return {
    findUnique: async (a) => {
      const f = filas().find((x) => casaBanco(x, a?.where));
      return f ? conRelaciones(tabla, f, a?.include) : null;
    },
    findFirst: async (a) => {
      const f = ordenar(filas().filter((x) => casaBanco(x, a?.where)), a?.orderBy)[0];
      return f ? conRelaciones(tabla, f, a?.include) : null;
    },
    findMany: async (a) => ordenar(filas().filter((x) => casaBanco(x, a?.where)), a?.orderBy).map((f) => ({ ...f })),
    count: async (a) => filas().filter((x) => casaBanco(x, a?.where)).length,
    create: async (a) => {
      const fila = { id: nuevoId(tabla), ...(POR_DEFECTO[tabla]?.() ?? {}), ...a.data };
      filas().push(fila);
      return { ...fila };
    },
    update: async (a) => {
      const f = filas().find((x) => casaBanco(x, a?.where));
      if (!f) throw filaNoEncontrada();
      if (tabla === 'invoice') banco.escriturasFactura.push({ id: f.id, campos: Object.keys(a.data ?? {}) });
      for (const [k, v] of Object.entries(a.data ?? {})) {
        // Escrituras anidadas: sólo las que la ruta usa de verdad sobre el cobro.
        if (v && typeof v === 'object' && !(v instanceof Date) && 'create' in v) {
          if (tabla === 'charge' && k === 'events') {
            banco.tablas.event.push({ id: nuevoId('event'), ...POR_DEFECTO.event(), chargeId: f.id, ...v.create });
          } else if (tabla === 'charge' && k === 'reconciliations') {
            banco.ajenas.push('reconciliation.create');
          } else {
            throw new Error(`🔴 EL BANCO NO SABE la escritura anidada \`${tabla}.${k}\`. Enséñasela; no la des por buena.`);
          }
          continue;
        }
        f[k] = v;
      }
      return conRelaciones(tabla, f, a?.include);
    },
  };
}

/** Lo que el banco no gobierna (avisos, trabajos): vacío, y apuntado. */
function modeloAjeno(nombre) {
  return new Proxy({}, {
    get: (_t, metodo) => async () => {
      const m = String(metodo);
      banco.ajenas.push(`${nombre}.${m}`);
      if (m === 'findMany') return [];
      if (m === 'count') return 0;
      if (m === 'aggregate') return { _max: {}, _sum: {}, _count: 0 };
      if (m === 'findUnique' || m === 'findFirst') return null;
      if (m === 'updateMany' || m === 'deleteMany') return { count: 0 };
      return { id: 1 };
    },
  });
}

const modelos = new Map();
function modelo(nombre) {
  if (!modelos.has(nombre)) modelos.set(nombre, CON_ESTADO.includes(nombre) ? modeloConEstado(nombre) : modeloAjeno(nombre));
  return modelos.get(nombre);
}

async function tomarCerrojo(clave, misCerrojos) {
  if (misCerrojos.has(clave)) return; // re-entrante dentro de la misma transacción
  const anterior = banco.cerrojos.get(clave) ?? Promise.resolve();
  let soltar;
  banco.cerrojos.set(clave, new Promise((r) => { soltar = r; }));
  await anterior;
  misCerrojos.set(clave, soltar);
}

function clienteDeTransaccion(misCerrojos) {
  return new Proxy({}, {
    get: (_t, prop) => {
      const nombre = String(prop);
      // Como el `tx` de Prisma: no lleva `$transaction`, y `applyVeriFactu` se apoya en eso.
      if (nombre === '$transaction') return undefined;
      if (nombre === '$executeRaw') {
        return async (trozos, ...valores) => {
          const sql = Array.isArray(trozos) ? trozos.join('?') : String(trozos);
          assert.match(sql, /pg_advisory_xact_lock/, `🔴 EL BANCO NO SABE este SQL: ${sql}`);
          const [ns, clave] = valores;
          if (ns === NS_SERIE) {
            const gancho = banco.alPedirCerrojoDeSerie;
            if (gancho && !misCerrojos.has(`${ns}:${clave}`)) { banco.alPedirCerrojoDeSerie = null; await gancho(); }
            banco.tomas.push({ clave, facturasAlTomarlo: banco.tablas.invoice.length });
          }
          await tomarCerrojo(`${ns}:${clave}`, misCerrojos);
          return 1;
        };
      }
      assert.ok(!nombre.startsWith('$'), `🔴 EL BANCO NO SABE imitar \`tx.${nombre}\``);
      return modelo(nombre);
    },
  });
}

export const prisma = new Proxy({}, {
  get: (_t, prop) => {
    const nombre = String(prop);
    if (nombre === '$transaction') {
      return async (cb) => {
        assert.equal(typeof cb, 'function', '🔴 EL BANCO sólo sabe la `$transaction` interactiva');
        const misCerrojos = new Map();
        try { return await cb(clienteDeTransaccion(misCerrojos)); }
        finally { for (const soltar of misCerrojos.values()) soltar(); }
      };
    }
    if (nombre === '$connect' || nombre === '$disconnect') return async () => undefined;
    if (nombre === 'then') return undefined;
    assert.ok(!nombre.startsWith('$'), `🔴 EL BANCO NO SABE imitar \`prisma.${nombre}\` fuera de una transacción`);
    return modelo(nombre);
  },
});

// ── LO QUE SE DOBLA: la base, el PDF y el correo. Y nada más. ─────────────────────────────

const fPrisma = rutaDe('dist/core/db/prisma.js');
requiere.cache[fPrisma] = { id: fPrisma, filename: fPrisma, loaded: true, exports: { prisma } };
for (const [r, exports] of [
  ['dist/lib/pdf.js', {
    generateInvoicePdf: async (d) => {
      if (banco.pdf.fallos > 0) { banco.pdf.fallos--; throw new Error('pdf_caido_a_proposito'); }
      banco.pdf.generados++;
      return { publicUrlPath: `/admin/invoices/${d.invoiceId}/pdf` };
    },
    generateQuotePdf: async () => ({}),
  }],
  ['dist/lib/email.js', { sendInvoiceEmail: async () => {} }],
]) {
  const f = rutaDe(r);
  requiere.cache[f] = { id: f, filename: f, loaded: true, exports };
}

/** Deja que terminen los avisos sin `await` de la ruta, para que un caso no escriba en el siguiente. */
export const asentar = () => new Promise((r) => setTimeout(r, 20));
