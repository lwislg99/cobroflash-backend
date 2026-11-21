// tests/_viajes-de-la-reserva.mjs — SCRUM-728d
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// CUÁNTOS VIAJES A LA BASE HACE LA RESERVA DE NÚMERO, MEDIDO **EN EJECUCIÓN** Y SIN BASE.
//
// SCRUM-728 midió 880 ms = 5 viajes × 175 ms. Ese desglose es de `allocateAlbaranNumber`
// (fase A: «BEGIN + pg_advisory_xact_lock + findUnique + update + COMMIT»). **La FACTURA no hace
// cinco**, y el ticket nunca lo midió: su §C5 lo declara como hueco —*«Sólo albaranes. No he
// medido `allocateInvoiceNumber`»*—. Esto lo tapa.
//
// ── POR QUÉ UN DOBLE Y NO UNA LECTURA DEL CÓDIGO ────────────────────────────────────────────
//
// `allocateInvoiceNumber` recibe `tx` como PARÁMETRO, así que un doble que apunte cada llamada
// cuenta los viajes **exactamente**, ejecutando el camino de verdad. Contar `await` leyendo el
// fichero daría otro número: hay ramas (justificante / F1 / rectificativa) que hacen consultas
// distintas, y un `await` dentro de un `if` no es un viaje hasta que ese `if` se cumple.
//
// 🔴 ESTO LEE EL CAMINO DE EMISIÓN, NO LO MODIFICA (regla 38 / AA1.4). Se le pasa un `tx` falso
// y se apunta lo que pide. Ni una firma cambia, ni se exporta nada nuevo para poder mirarlo.
//
// ── EL CERROJO ES DE TRANSACCIÓN, Y ESO DECIDE QUÉ CUENTA ───────────────────────────────────
//
// `pg_advisory_xact_lock` se libera **en el COMMIT**, no al salir de la función. Así que la
// sección crítica no es «lo que hace la reserva»: es **todo lo que pasa entre el cerrojo y el
// COMMIT**, incluido el `invoice.create` del llamador. Por eso aquí se cuentan las dos cosas por
// separado — los viajes de la función, y los que quedan DENTRO del cerrojo.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(path.join(RAIZ, 'tests', 'x.mjs'));

/** «No supe mirar» y «no hace viajes» son el mismo número con significados opuestos. */
export class CensoCiego extends Error {}

export const RUTA_SERVICIO = 'dist/modules/invoicing/domain/invoiceNumber.service.js';

export function cargarServicio() {
  try {
    return requiere(`../${RUTA_SERVICIO}`);
  } catch (e) {
    throw new CensoCiego(
      `🔴 no he podido cargar ${RUTA_SERVICIO}: ${e.message}. Sin el servicio no se cuenta NADA, y `
      + 'cero viajes se leería como «la reserva no toca la base». Compila antes: `npm run build`.');
  }
}

/**
 * Los tres merchants que producen los tres caminos. **No son gustos: son los tres modos de
 * emisión** que `getEmissionMode` distingue (V0-0), y cada uno hace un número de viajes distinto.
 *
 * ⚠️ `id: 1` es el merchant DEMO (regla 8) y sale en modo `demo`, no `receipt`. Un fixture con
 * id 1 mediría el camino equivocado creyendo que mide el del profesional español — pasó al
 * escribir esto, y por eso los ids van lejos del 1.
 */
export const MERCHANTS = {
  /** El profesional español real de hoy: `INVOICING_ES_ENABLED` OFF → emite JUSTIFICANTE. */
  justificante: { id: 42, email: 'fontanero@gmail.com', country: 'ES', flags: null },
  /** No-ES: emite factura fiscal SIEMPRE, sin mirar el flag. */
  fiscal: { id: 43, email: 'plombier@exemple.fr', country: 'FR', flags: null },
};

const CONTADORES = {
  invoiceSeriesPrefix: 'YQ',
  nextInvoiceNumber: 7,
  nextRectInvoiceNumber: 3,
  invoiceSeriesYear: new Date().getFullYear(),
};

/**
 * Las dos formas de quedarse ciego. Va aparte y exportada A PROPÓSITO: sólo así se puede probar
 * EN ROJO sin romper el árbol — con el doble puesto, el servicio real siempre usa su `tx`, así
 * que estos dos casos no se alcanzarían nunca desde `espiarReserva` y quedarían sin probar.
 */
export function exigirSueloDeViajes(viajes) {
  if (viajes.length === 0) {
    throw new CensoCiego(
      '🔴 la reserva no ha pedido NI UN viaje al doble. O el servicio dejó de usar el `tx` que '
      + 'recibe —y entonces el cerrojo no protege nada— o el doble no está interceptando.');
  }
  if (viajes[0] !== 'pg_advisory_xact_lock') {
    throw new CensoCiego(
      `🔴 el primer viaje no es el cerrojo, es \`${viajes[0]}\`. O el cerrojo bajó de sitio (y deja `
      + 'de proteger lo que se lee antes) o este censo no lo reconoce. Las dos hay que mirarlas.');
  }
  return viajes;
}

/**
 * SCRUM-1787j · el `tx` falso, COMPARTIDO por la reserva y por la emisión entera.
 *
 * 🔴 Antes era un objeto con SEIS métodos escritos a mano (los que hoy pide `allocateInvoiceNumber`).
 * Eso tenía dos defectos que se sumaban: lo que la emisión pidiera FUERA de la reserva no pasaba
 * por aquí, y un modelo nuevo (`tx.customer`, que trajo SCRUM-1787d) no existía en el doble. Ahora
 * es un `Proxy`: CUALQUIER `tx.<modelo>.<método>(…)` se apunta como un viaje, esté o no en la
 * lista de respuestas. La lista de abajo sólo decide QUÉ DEVUELVE, nunca SI SE CUENTA.
 */
function txQueApunta({ m, emitidas, ocupadas, viajeExtra }) {
  const viajes = [];
  const apunta = (q) => viajes.push(q);
  const RESPUESTAS = {
    'merchant.findUnique': () => {
      if (viajeExtra) apunta('⚠️ VIAJE AÑADIDO A LA SECCIÓN CRÍTICA');
      return m;
    },
    'merchant.update': () => m,
    'invoice.findUnique': ({ where } = {}) => (ocupadas.has(where?.merchantId_number?.number) ? { id: 1 } : null),
    'invoice.findMany': () => emitidas,
    'invoice.create': ({ data } = {}) => ({ id: 1, ...data }),
    'auditLog.create': () => ({ id: 1 }),
  };
  // Lo que no está en RESPUESTAS se CUENTA igual y devuelve lo más neutro de su forma: una
  // lectura de una fila, «no hay»; una de varias, ninguna; una escritura, la fila con lo escrito.
  const neutro = (metodo, args) => {
    if (metodo === 'findMany') return [];
    if (metodo.startsWith('find')) return null;
    if (metodo === 'count') return 0;
    return { id: 1, ...(args?.data || {}) };
  };
  const ETIQUETA = {
    'invoice.findUnique': 'invoice.findUnique (¿referencia libre?)',
    'invoice.findMany': 'invoice.findMany (SERIE F ENTERA — escala con los datos)',
  };
  const modelo = (nombre) => new Proxy({}, {
    get: (_, metodo) => {
      if (typeof metodo !== 'string') return undefined;
      return async (args) => {
        const clave = `${nombre}.${metodo}`;
        apunta(ETIQUETA[clave] || clave);
        return RESPUESTAS[clave] ? RESPUESTAS[clave](args) : neutro(metodo, args);
      };
    },
  });
  const sql = (que) => (trozos) => {
    const texto = Array.isArray(trozos?.raw) ? trozos.raw.join('?') : String(trozos);
    apunta(texto.includes('pg_advisory_xact_lock') ? 'pg_advisory_xact_lock' : `${que} ${texto.trim().slice(0, 40)}`);
    return Promise.resolve(que === '$queryRaw' ? [] : 1);
  };
  const tx = new Proxy({}, {
    get: (_, nombre) => {
      if (typeof nombre !== 'string' || nombre === 'then') return undefined;
      if (nombre === '$executeRaw' || nombre === '$queryRaw') return sql(nombre);
      if (nombre.startsWith('$')) {
        // `$transaction` anidada, `$executeRawUnsafe`… no las usa hoy la emisión. Si aparecen, se
        // dice: contarlas como un viaje o como cero sería elegir el número.
        throw new CensoCiego(`🔴 la emisión ha pedido \`tx.${nombre}\`, que este doble no sabe contar.`);
      }
      return modelo(nombre);
    },
  });
  return { tx, viajes };
}

/** BEGIN y COMMIT no pasan por `tx` —los emite `$transaction`— pero son viajes igual. */
function totales(viajes) {
  return {
    // Total, en el mismo criterio que el ticket usó para los albaranes: + BEGIN + COMMIT.
    viajes: viajes.length + 2,
    // Del cerrojo al COMMIT, ambos inclusive: lo que de verdad se serializa. Vale porque
    // `exigirSueloDeViajes` ya ha comprobado que el cerrojo es lo PRIMERO.
    dentroDelCerrojo: viajes.length + 1,
  };
}

/**
 * Ejecuta SÓLO la reserva con un `tx` que APUNTA cada viaje. Sirve para lo que es de la reserva
 * (el cerrojo primero, la serie F leída entera); el número de la emisión lo da `espiarEmision`.
 *
 * @param opts.merchant   uno de `MERCHANTS` (se le añaden los contadores).
 * @param opts.emitidas   lo que devuelve `invoice.findMany` — la serie F ya emitida.
 * @param opts.ocupadas   referencias de justificante ya usadas (para ejercer el bucle).
 * @param opts.viajeExtra si es true, el doble hace UN viaje de más: sirve para ver el guard en
 *                        rojo sin tocar `src/`, que es lo que no se puede hacer aquí.
 */
export async function espiarReserva({
  merchant, rectifying = false, emitidas = [], ocupadas = new Set(), viajeExtra = false,
  now = new Date(),
} = {}) {
  const { allocateInvoiceNumber } = cargarServicio();
  const m = { ...merchant, ...CONTADORES };
  const { tx, viajes } = txQueApunta({ m, emitidas, ocupadas, viajeExtra });

  const numero = await allocateInvoiceNumber(
    tx, m.id,
    { camino: 'C7-suelta', actor: { tipo: 'merchant', merchantId: m.id, teamMemberId: null }, rectifying },
    now,
  );

  exigirSueloDeViajes(viajes);
  return { numero, sentencias: viajes, ...totales(viajes) };
}

export const RUTA_EMISION = 'dist/modules/invoicing/domain/invoicing.service.js';
export const RUTA_CREAR = 'dist/modules/invoicing/domain/crearFacturaEmitida.js';

function cargar(ruta) {
  try {
    return requiere(`../${ruta}`);
  } catch (e) {
    throw new CensoCiego(`🔴 no he podido cargar ${ruta}: ${e.message}. Compila antes: \`npm run build\`.`);
  }
}

/**
 * SCRUM-1787j · los viajes de la TRANSACCIÓN COMPLETA de una emisión, CONTADOS, no sumados.
 *
 * Sustituye a `conElCreateDelLlamador`, que añadía un `+1` FIJO por el `invoice.create`: todo lo
 * que la emisión hiciera después de la reserva —la lectura de la dirección de SCRUM-1787d, por
 * ejemplo— quedaba fuera, y el guard seguía en verde (medido: SCRUM-1787 c.22326 y tramo 1787g).
 *
 * - F1: corre `emitInvoice` de verdad (reserva + `crearFacturaEmitida`) con el `tx` que apunta.
 * - R1: no hay función exportada; la ruta (`invoicesAdmin.routes.ts`, `$transaction` de la
 *   rectificativa) hace `allocateInvoiceNumber(tx, …, { rectifying: true })` y después
 *   `crearFacturaEmitida(tx, …, { rectifiesId })`. Aquí se llaman ESAS DOS funciones reales, en
 *   ese orden: lo que cada una haga dentro se cuenta; si la ruta añadiera una tercera llamada en
 *   su `$transaction`, esto NO la vería (dicho en el registro de 1787j).
 *
 * El cliente y el emisor congelados van vacíos: se leen FUERA de la transacción (SCRUM-729/665) y
 * aquí sólo se derraman en el `data` del `create`.
 */
export async function espiarEmision({
  merchant, rectifying = false, emitidas = [], ocupadas = new Set(), viajeExtra = false,
  now = new Date(),
} = {}) {
  const m = { ...merchant, ...CONTADORES };
  const { tx, viajes } = txQueApunta({ m, emitidas, ocupadas, viajeExtra });
  const actor = { tipo: 'merchant', merchantId: m.id, teamMemberId: null };
  let factura;
  if (rectifying) {
    const { allocateInvoiceNumber } = cargarServicio();
    const { crearFacturaEmitida } = cargar(RUTA_CREAR);
    const number = await allocateInvoiceNumber(tx, m.id, { rectifying: true, camino: 'C5', actor }, now);
    factura = await crearFacturaEmitida(tx, {}, {}, {
      merchantId: m.id, customerId: 7, number, total: '-121.00', currency: 'EUR', type: 'R1',
      rectifiesId: 99, pdfUrl: 'PENDING_PDF', qrData: 'PENDING_QR', registerId: null,
    });
  } else {
    const { emitInvoice } = cargar(RUTA_EMISION);
    factura = await emitInvoice(tx, {
      merchantId: m.id, customerId: 7, total: '121.00', currency: 'EUR',
      actor, origen: 'C7-suelta', clienteCongelado: {}, emisorCongelado: {},
    });
  }
  exigirSueloDeViajes(viajes);
  const creates = viajes.filter((v) => v === 'invoice.create').length;
  if (creates !== 1) {
    throw new CensoCiego(`🔴 la emisión ha hecho ${creates} \`invoice.create\`: este doble no está viendo una emisión.`);
  }
  return { numero: factura.number, sentencias: viajes, ...totales(viajes) };
}
