// src/modules/jobs/domain/albaranIdempotencia.ts — SCRUM-358 (H3)
//
// EL ALTA DE ALBARÁN, IDEMPOTENTE. La mitad de servidor.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// QUÉ PROBLEMA RESUELVE, Y CUÁL NO
//
// El profesional firma sin cobertura, la cola reintenta, y el primer envío SÍ había llegado —
// se perdió la respuesta, no la petición. Sin clave, eso son **dos albaranes** con dos números
// de serie, los dos válidos, y el pro ve dos partes donde hizo uno.
//
// ⚠️ **FIRMAR ya era idempotente** y no se toca: `POST /:id/firmar` devuelve 409 `albaran_locked`
// sobre un albarán ya firmado (medido en SCRUM-358). El que no lo era es **EL ALTA**, y es lo
// único que gobierna este módulo.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 POR QUÉ SE PREGUNTA AL CONSTRAINT Y NO SE CAPTURA EL `P2002`
//
// Es la forma de `allocateInvoiceNumber` (`invoiceNumber.service.ts:115-122`), copiada con su
// motivo porque el motivo es lo que la hace correcta:
//
//   · en PostgreSQL **una sentencia fallida ABORTA la transacción**. Capturar el `P2002` del
//     `create` y seguir dentro de la misma `tx` no es reintentar: es insistir sobre una tx
//     muerta (`25P02 current transaction is aborted`);
//   · y la consulta va **DENTRO del `pg_advisory_xact_lock(SERIE_LOCK_NS, merchantId)`**, cuya
//     clave es `merchantId` — **exactamente el alcance del índice `[merchantId,
//     claveIdempotencia]`**. Dentro de ese cerrojo, «¿existe ya esta clave?» no tiene carrera
//     para el mismo merchant, y entre merchants distintos el choque es imposible por
//     construcción.
//
// 🔴 Y POR QUÉ LA PREGUNTA VA **ANTES** DE RESERVAR EL NÚMERO: si se reservara primero y luego
// se descubriera que la clave ya existe, ese número quedaría **consumido y sin documento** — un
// HUECO EN LA SERIE, que es justo lo que `allocateAlbaranNumber` pone dentro de la transacción
// para evitar (SCRUM-234/302). La idempotencia mal puesta rompe la serie.
import type { Prisma } from '@prisma/client';
import { SERIE_LOCK_NS } from '../../invoicing/domain/invoiceNumber.service';

/** Tope de la columna (`VARCHAR(64)`). NO se trunca: ver `normalizarClaveIdempotencia`. */
export const CLAVE_IDEMPOTENCIA_MAX = 64;

export const ERROR_CLAVE_INVALIDA = 'clave_idempotencia_invalida';
export const ERROR_CLAVE_REUTILIZADA = 'clave_idempotencia_reutilizada';

/** Qué pasó con la idempotencia en esta petición. Va en la respuesta: ver el porqué abajo. */
export type ResultadoIdempotencia = 'aplicada' | 'repetida' | 'no_solicitada';

// ═════════════════════════════════════════════════════════════════════════════════════════
// MICROCOPY DEL 409 — **APROBADA por el asesor el 11-ago-2026** (regla 30). NO se reformula.
//
// 🔴 LA CORRECCIÓN QUE TRAJO, Y POR QUÉ SE ANOTA AQUÍ: la propuesta anterior terminaba en «Vuelve
// a crearlo desde el trabajo», y eso **contradice la frase anterior**. Si el original existe y lo
// que se está evitando es duplicarlo, la salida no puede ser CREAR OTRO: es ABRIR el que hay.
//
// > **Un mensaje que da una salida que produce el problema que acaba de evitar es peor que uno
// > sin salida.**
//
// Y fuera «datos de envío»: un fontanero no sabe qué es eso. «Datos distintos», sí.
//
// El número del original se NOMBRA cuando se tiene —y en el 409 siempre se tiene—: decirle «el
// parte ALB-2026-097 sigue guardado» le ahorra buscarlo. Sin número se cae al texto aprobado tal
// cual, que es el que vale por defecto.

/** El texto aprobado, con el número del original si se conoce. */
export function msgClaveReutilizada(numeroOriginal?: string | null): string {
  const cual = numeroOriginal ? `el parte ${numeroOriginal}` : 'el parte original';
  return (
    'Este parte ya se creó antes con datos distintos a los que se están enviando ahora. ' +
    `No hemos creado nada para no duplicarlo: ${cual} sigue guardado. ` +
    'Ábrelo desde el trabajo para revisarlo.'
  );
}

/**
 * 🔴 UNA CLAVE DEMASIADO LARGA SE RECHAZA, NO SE RECORTA.
 *
 * Recortar a 64 es lo cómodo y es lo peligroso: dos claves distintas que compartan los primeros
 * 64 caracteres se convertirían en LA MISMA, y la segunda alta se tomaría por una repetición de
 * la primera. **Un albarán se perdería en silencio** — exactamente el modo de fallo que el propio
 * ticket señala al descartar el content hash como clave.
 *
 * Vacío → `null` (= no se pidió idempotencia), que es un caso legítimo: ver `ResultadoIdempotencia`.
 */
export function normalizarClaveIdempotencia(
  v: unknown,
): { ok: true; clave: string | null } | { ok: false; error: string; message: string } {
  if (v === undefined || v === null) return { ok: true, clave: null };
  if (typeof v !== 'string') {
    return { ok: false, error: ERROR_CLAVE_INVALIDA, message: 'La clave de idempotencia tiene que ser una cadena.' };
  }
  const clave = v.trim();
  if (!clave) return { ok: true, clave: null };
  if (clave.length > CLAVE_IDEMPOTENCIA_MAX) {
    return {
      ok: false,
      error: ERROR_CLAVE_INVALIDA,
      message: `La clave de idempotencia supera ${CLAVE_IDEMPOTENCIA_MAX} caracteres. No se recorta: dos claves con el mismo prefijo se confundirían y un albarán se perdería en silencio.`,
    };
  }
  return { ok: true, clave };
}

/**
 * Toma el cerrojo de serie del merchant. **Se toma ANTES de mirar la clave**, para que la
 * pregunta al constraint y la reserva del número vivan bajo el MISMO cerrojo.
 *
 * Mismo namespace que la numeración (`SERIE_LOCK_NS`) y no uno propio: son la MISMA sección
 * crítica —decidir si este alta ocurre y con qué número—, y separarlas dejaría que dos peticiones
 * con la misma clave pasaran a la vez la comprobación y se llevaran dos números.
 *
 * ⚠️ Es un cerrojo de TRANSACCIÓN: se libera al commit, y tomarlo dos veces en la misma `tx` es
 * inocuo (`allocateAlbaranNumber` lo vuelve a tomar). Por eso esto NO se puede llamar con el
 * cliente global: se tomaría y se soltaría en el mismo instante y no serviría de nada.
 */
export async function tomarCerrojoDeSerie(tx: Prisma.TransactionClient, merchantId: number): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SERIE_LOCK_NS}::int, ${merchantId}::int)`;
}

/** Los campos del alta que definen QUÉ se pidió crear. */
export interface ContenidoDeAlta {
  jobId: number;
  modoValoracion: string;
  lineas: unknown;
  notas: string | null;
}

/** Serialización determinista para comparar dos altas. No se guarda: solo se compara. */
function canonico(c: ContenidoDeAlta): string {
  return JSON.stringify({
    jobId: c.jobId,
    modoValoracion: c.modoValoracion,
    notas: c.notas ?? null,
    lineas: Array.isArray(c.lineas) ? c.lineas : [],
  });
}

/**
 * ¿La repetición pide LO MISMO que el alta original?
 *
 * 🔴 MISMA CLAVE CON CONTENIDO DISTINTO **NO ES UNA REPETICIÓN**: es la misma etiqueta puesta a
 * dos cosas. Devolver el original sería tirar el segundo alta en silencio; crear uno nuevo sería
 * romper el único. Se declara conflicto y se nombra qué cambió.
 *
 * ⚠️ **LÍMITE DECLARADO, y no es pequeño:** se compara contra el contenido ACTUAL del albarán
 * original, porque no se guarda ninguna huella de cómo nació (eso pediría otra columna). Si
 * alguien EDITA el albarán y después llega la repetición, saldrá conflicto sobre una repetición
 * legítima. En el escenario de la cola eso no puede pasar —si la respuesta se perdió, el
 * profesional no sabe que el albarán existe y no ha podido editarlo—, pero fuera de ese
 * escenario sí, y por eso queda escrito aquí en vez de suponerse.
 */
export function compararAlta(
  original: ContenidoDeAlta,
  entrante: ContenidoDeAlta,
): { mismo: true } | { mismo: false; diferencias: string[] } {
  if (canonico(original) === canonico(entrante)) return { mismo: true };
  const diferencias: string[] = [];
  if (original.jobId !== entrante.jobId) diferencias.push('el Trabajo al que cuelga');
  if (original.modoValoracion !== entrante.modoValoracion) diferencias.push('el modo de valoración');
  if ((original.notas ?? null) !== (entrante.notas ?? null)) diferencias.push('las notas');
  const lo = JSON.stringify(Array.isArray(original.lineas) ? original.lineas : []);
  const le = JSON.stringify(Array.isArray(entrante.lineas) ? entrante.lineas : []);
  if (lo !== le) diferencias.push('las líneas');
  // Si el canónico difiere, ALGO cambió. Un «no sé cuál» es peor que un nombre aproximado: el
  // mensaje tiene que poder discutirse.
  if (diferencias.length === 0) diferencias.push('el contenido (sin poder señalar qué campo)');
  return { mismo: false, diferencias };
}

/** El error del conflicto, con los datos que hacen falta para contestarlo sin adivinar. */
export class ClaveIdempotenciaReutilizadaError extends Error {
  readonly clave: string;
  readonly numeroOriginal: string;
  readonly diferencias: string[];

  constructor(clave: string, numeroOriginal: string, diferencias: string[]) {
    super(
      `${ERROR_CLAVE_REUTILIZADA}: la clave «${clave}» ya creó el albarán ${numeroOriginal}, y este ` +
      `alta pide algo distinto (${diferencias.join(', ')}). No se devuelve el original —sería tirar ` +
      'este alta en silencio— ni se crea otro —chocaría contra el único—.',
    );
    this.name = 'ClaveIdempotenciaReutilizadaError';
    this.clave = clave;
    this.numeroOriginal = numeroOriginal;
    this.diferencias = diferencias;
  }
}
