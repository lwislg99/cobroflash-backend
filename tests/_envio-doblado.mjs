// tests/_envio-doblado.mjs — SCRUM-590 / SCRUM-590b (CONT-19)
//
// EJERCITAR EL CAMINO REAL DE ENVÍO SIN BASE Y SIN META — en un solo sitio.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// POR QUÉ ES UN MÓDULO Y NO UNA COPIA EN CADA TEST
//
// Lo usan al menos dos ficheros: el que prueba que el documento sale al móvil
// (`scrum590-el-movil-es-el-canal`) y el que prueba el viaje entero desde la pantalla
// (`scrum590b-el-campo-en-la-pantalla`). Dos copias de un doble son dos sitios donde divergir, y
// un doble que diverge **no mide de menos: mide otra cosa**, y su verde se lee igual que el bueno.
// Es la lección de `_bocas-de-emision.mjs` (tres listas idénticas que se desincronizaron) y la de
// `_banco-vistas.mjs` («un banco infiel no mide de menos: mide OTRA COSA»).
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LOS DOS DOBLES, Y QUÉ **NO** SE DOBLA
//
//  · LA BASE, por `require.cache` de `dist/core/db/prisma.js`, ANTES de cargar nada de `dist/`.
//  · META, con el mecanismo que YA existe: `WHATSAPP_DRY_RUN=1` + `globalThis.__waDryRunOutbox`.
//    En dry-run los senders **pasan TODOS los guards** (opt-out, demo, topes, validación J7) y
//    sólo se saltan la llamada HTTP — está escrito en `whatsapp.ts:20`. Por eso un caso de
//    opt-out montado con esto es real: el guard se comprueba ANTES del corte de dry-run.
//
// ⛔ NO SALE UN SOLO BYTE HACIA META ni un mensaje a ningún número real: `metaHttp` lanza si algo
//    lo intentara (SCRUM-180), y los números de prueba salen del rango imposible (SCRUM-262).
//
// 🔴 LO QUE **NO** SE DOBLA es lo que se mide: el resolvedor del canal, los guards de envío y
//    `sendQuoteWhatsAppToCustomer` entero son el código de producción tal cual.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// ANTES de cargar `dist/`: `config` se congela al importarse.
process.env.WHATSAPP_DRY_RUN = '1';

const requiere = createRequire(import.meta.url);

/** El merchant NO es el 1: el 1 es el demo y `demoSendBlocked` lo trata aparte (V0-2). Con el
 *  demo, un bloqueo por lista blanca se confundiría con el bloqueo que se está midiendo. */
export const MERCHANT = 4242;
export const CLIENTE = 55;

/**
 * Devuelve lo vacío por defecto —lista vacía, `null`, `0`— para que ninguna consulta que el test
 * no gobierna (ventana de servicio, topes A3.2, log WA-0b, historial) decida nada por su cuenta.
 */
export function dobleDeLaBase(respuestas) {
  const porDefecto = (metodo) => {
    if (metodo === 'findMany') return [];
    if (metodo === 'count') return 0;
    if (metodo === 'aggregate') return { _max: {}, _count: 0 };
    if (metodo === 'findUnique' || metodo === 'findFirst') return null;
    if (metodo === 'updateMany' || metodo === 'deleteMany') return { count: 0 };
    return {};
  };
  const modelo = (nombre) =>
    new Proxy({}, {
      get: (_t, metodo) => async (args) => {
        const propia = respuestas[`${nombre}.${String(metodo)}`];
        return typeof propia === 'function' ? propia(args) : propia ?? porDefecto(String(metodo));
      },
    });
  const cache = new Map();
  return new Proxy({}, {
    get: (_t, prop) => {
      const nombre = String(prop);
      if (nombre.startsWith('$')) return async () => undefined; // $disconnect, $transaction…
      if (!cache.has(nombre)) cache.set(nombre, modelo(nombre));
      return cache.get(nombre);
    },
  });
}

/** Inyecta el doble de la base y descarta los módulos que lo capturaron. */
export function inyectarBase(respuestas) {
  const rutaPrisma = requiere.resolve('../dist/core/db/prisma.js');
  requiere.cache[rutaPrisma] = {
    id: rutaPrisma, filename: rutaPrisma, loaded: true,
    exports: { prisma: dobleDeLaBase(respuestas) },
  };
  for (const m of ['../dist/modules/quotes/domain/sendQuote.service.js', '../dist/integrations/whatsapp.js']) {
    delete requiere.cache[requiere.resolve(m)];
  }
}

/**
 * Manda un PRESUPUESTO a `cliente` por el camino real y devuelve a qué números salió.
 *
 * `dadosDeBaja` son las filas que devolvería la consulta de `isWaOptedOut`: los clientes de ese
 * merchant con `waOptOut = true`. Vacío = nadie se ha dado de baja.
 */
export async function enviarPresupuestoDeVerdad({ cliente, dadosDeBaja = [] }) {
  const quote = {
    id: 7,
    merchantId: MERCHANT,
    customerId: CLIENTE,
    status: 'sent',
    quoteNumber: 12,
    total: '150.00',
    currency: 'EUR',
    decisionToken: 'tok-590-de-laboratorio', // ya existe: no hace falta escribir en la base
    merchant: { id: MERCHANT, name: 'Taller de prueba', legalName: null },
    customer: cliente,
  };

  inyectarBase({
    'quote.findUnique': () => quote,
    'customer.findMany': () => dadosDeBaja,
  });

  const buzon = [];
  globalThis.__waDryRunOutbox = buzon;
  try {
    const { sendQuoteWhatsAppToCustomer } = requiere('../dist/modules/quotes/domain/sendQuote.service.js');
    // 🔴 SUELO: si el export desaparece o cambia de nombre, esto NO puede pasar en silencio.
    assert.equal(typeof sendQuoteWhatsAppToCustomer, 'function',
      'CIEGO: no se encuentra el camino de envío del presupuesto. Sabemos que existe: si se ha '
      + 'movido o renombrado, hay que reapuntar el test, no borrarlo.');
    const resultado = await sendQuoteWhatsAppToCustomer(7, MERCHANT);
    return { resultado, destinos: buzon.map((e) => e.to), buzon };
  } finally {
    delete globalThis.__waDryRunOutbox;
  }
}
