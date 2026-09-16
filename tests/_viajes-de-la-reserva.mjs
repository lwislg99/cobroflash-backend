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
 * Ejecuta la reserva con un `tx` que APUNTA cada viaje.
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
  const viajes = [];
  const apunta = (q) => viajes.push(q);

  const tx = {
    $executeRaw: (trozos) => {
      const sql = Array.isArray(trozos?.raw) ? trozos.raw.join('?') : String(trozos);
      apunta(sql.includes('pg_advisory_xact_lock') ? 'pg_advisory_xact_lock' : `$executeRaw ${sql.trim().slice(0, 40)}`);
      return Promise.resolve(1);
    },
    merchant: {
      findUnique: async () => {
        apunta('merchant.findUnique');
        if (viajeExtra) apunta('⚠️ VIAJE AÑADIDO A LA SECCIÓN CRÍTICA');
        return m;
      },
      update: async () => { apunta('merchant.update'); return m; },
    },
    invoice: {
      findUnique: async ({ where }) => {
        apunta('invoice.findUnique (¿referencia libre?)');
        return ocupadas.has(where?.merchantId_number?.number) ? { id: 1 } : null;
      },
      findMany: async () => { apunta('invoice.findMany (SERIE F ENTERA — escala con los datos)'); return emitidas; },
    },
    auditLog: { create: async () => { apunta('auditLog.create'); return { id: 1 }; } },
  };

  const numero = await allocateInvoiceNumber(
    tx, m.id,
    { camino: 'C7-suelta', actor: { tipo: 'merchant', merchantId: m.id, teamMemberId: null }, rectifying },
    now,
  );

  exigirSueloDeViajes(viajes);

  // BEGIN y COMMIT no pasan por `tx` —los emite `$transaction`— pero son viajes igual, y el
  // desglose de la fase A los cuenta. Se suman DECLARADOS, no escondidos.
  return {
    numero,
    sentencias: viajes,
    // Total de la función, en el mismo criterio que el ticket usó para los albaranes.
    viajes: viajes.length + 2,
    // Del cerrojo al COMMIT, ambos inclusive: lo que de verdad se serializa.
    dentroDelCerrojo: viajes.length + 1,
  };
}

/**
 * Los viajes de la TRANSACCIÓN COMPLETA de una emisión: la reserva más el `invoice.create` que
 * hace `emitInvoice` después. Es el número que decide el ticket, porque el cerrojo no se suelta
 * hasta el COMMIT.
 */
export function conElCreateDelLlamador(r) {
  return { viajes: r.viajes + 1, dentroDelCerrojo: r.dentroDelCerrojo + 1 };
}
