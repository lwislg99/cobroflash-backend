// src/modules/invoicing/domain/cerrojoSaturado.ts — SCRUM-728
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LO QUE VE EL SEXTO PROFESIONAL CUANDO EL CERROJO DE SERIE SE SATURA.
//
// El cerrojo de SCRUM-234/728 serializa la reserva de número: eso es correcto y no se toca — es
// lo único que impide que dos documentos salgan con el mismo número. Pero serializar cuesta:
// **~880 ms por reserva contra base remota** (5 viajes × 175 ms de RTT, medido en SCRUM-728), y
// el `timeout` por defecto de Prisma es **5000 ms**. 5000 ÷ 880 = **5,7**: **a partir de la sexta
// creación simultánea del mismo merchant, la que espera revienta**.
//
// Hasta hoy eso salía así, medido corriendo:
//
//     [POST /admin/jobs/:id/albaranes]  PrismaClientKnownRequestError P2028
//     Transaction already closed: … The timeout for this transaction was 5000 ms, however
//     6978 ms passed since the start of the transaction.
//     → HTTP 500 {"error":"internal_error"}
//
// y el panel lo pintaba tal cual: **«No se pudo crear el albarán: API 500: internal_error»**.
// Un identificador interno en la cara de un fontanero que quería crear un albarán.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE ESTE MÓDULO NO HACE, Y ES LA MITAD DE SU VALOR
//
// **No sube el timeout.** Está medido por qué no: a 20 s daría margen para 22 simultáneas, pero
// el coste es lineal —la enésima espera n × 880 ms— y **el usuario número 22 esperaría 19
// segundos** mirando la pantalla. Se cambiaría un fallo rápido por una espera larga. Hay un guard
// (`scrum728-seccion-critica-de-la-serie`, caso ③) que lo impide.
//
// **No toca el cerrojo** ni la reserva. Sólo traduce un fallo concreto a algo que se puede leer.
//
// **Y no tapa cualquier error**: reconoce UN código de Prisma por identidad. Convertir todo fallo
// en «inténtalo otra vez» sería cambiar un error técnico por una mentira amable — el profesional
// reintentaría diez veces algo que nunca va a salir.
import { Prisma } from '@prisma/client';

/**
 * `P2028` — «Transaction already closed». Es el código que Prisma da cuando una transacción
 * interactiva supera su `timeout`, y es el que salió en las cuatro caídas medidas en SCRUM-728,
 * las cuatro **dentro del `$executeRaw` del cerrojo**, o sea esperando turno.
 *
 * Se compara por IDENTIDAD del código, nunca por subcadena del mensaje: el texto de Prisma está
 * en inglés, cambia entre versiones y lleva dentro los milisegundos concretos de cada caída.
 */
const TRANSACCION_EXPIRADA = 'P2028';

/** Código propio de la respuesta. El del ORM no sale a la superficie pública. */
export const ERROR_CERROJO_SATURADO = 'serie_ocupada';

/**
 * MICROCOPY OFICIAL — **aprobada por el fundador el 8-sep-2026, en SCRUM-728**, sin cambios.
 * Registro: `docs/microcopy/2026-09-08-SCRUM-728-serie-ocupada.md`.
 *
 * Dice lo que pasó sin jerga, no culpa a nadie y dice qué hacer **y cuándo**: «en unos segundos»
 * no es relleno — con ~880 ms por reserva, la cola que tiene delante se vacía en eso.
 */
export const COPY_CERROJO_SATURADO =
  'No hemos podido crear el documento. Inténtalo otra vez en unos segundos.';

/**
 * ¿Este error es el de la sección crítica saturada?
 *
 * 🔴 SÓLO ese código. Un `P2002` (número duplicado), un `P2025` (fila que no está) o un fallo de
 * red NO son esto y tienen que seguir saliendo como salen hoy: si aquí entrara cualquier cosa,
 * el profesional recibiría «inténtalo otra vez» ante un error que no se arregla reintentando.
 */
export function esCerrojoSaturado(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === TRANSACCION_EXPIRADA;
}

/**
 * El cuerpo de la respuesta, igual en todas las rutas que reservan número.
 *
 * **503 y no 500**: no es un fallo del servidor, es una espera que no cupo — la misma petición
 * repetida unos segundos después sale bien. Y no es 409: no hay conflicto que resolver, hay cola.
 */
export function cuerpoCerrojoSaturado(): { error: string; message: string } {
  return { error: ERROR_CERROJO_SATURADO, message: COPY_CERROJO_SATURADO };
}

/** El estado HTTP, en un solo sitio para que las rutas no elijan cada una el suyo. */
export const ESTADO_CERROJO_SATURADO = 503;
