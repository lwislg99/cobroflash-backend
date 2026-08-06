// src/modules/jobs/domain/albaranesListado.ts — SCRUM-301 (C1)
//
// EL LISTADO GLOBAL DE ALBARANES. Hoy los albaranes no existen como sitio: viven dentro de cada
// Trabajo, así que «¿qué tengo sin firmar?» —la pregunta del lunes de un reformista con seis obras
// abiertas— solo se contesta entrando obra por obra.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LOS DOS EJES NO SE APLANAN, Y ESTO ES LO PRIMERO PORQUE ES DONDE SE ROMPE
//
// El ticket original pedía cinco pestañas planas: `Todos · Borrador · Entregado · Firmado ·
// Facturado`. Medido, eso es incorrecto en dos cosas, y las dos las corrige el asesor:
//
//   ① NO EXISTE «Enviado»/«Entregado». El estado del modelo se llama `emitido`:
//      `canTransitionAlbaran` va `borrador → emitido → firmado` y nada más. «Enviado» es un
//      nombre de PANTALLA, y confundirlo con el del modelo es el error que tuvo B2 con «Borrador».
//
//   ② «Facturado» NO ES UN ESTADO. Es un DERIVADO con TRES valores que se calcula contra el libro
//      `AlbaranLineaFacturada` (SCRUM-170): `sin_facturar · parcial · facturado`. No hay flag que
//      poner, y anular una factura DEVUELVE la cantidad a pendiente (la anulación borra las filas
//      del libro, `invoicesAdmin.routes.ts`).
//
// Consecuencia: son **TRES estados del enum MÁS UN EJE DERIVADO**, no cinco casillas. Aplanarlos
// obligaría a inventarse un estado que no existe y **perdería el `parcial`** — que en una obra por
// fases no es el caso raro, es el normal.
//
// Por eso los dos ejes viajan SEPARADOS y se DERIVAN de sus constantes (`ALBARAN_ESTADOS` y
// `ESTADOS_COBRO`): nadie los enumera a mano en ningún sitio, y menos aún en el navegador. Una
// lista escrita a mano no avisa de lo que le falta.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL SUELO: UN CERO DE «NO HAY» Y UNO DE «NO SUPE MIRAR» SON IDÉNTICOS EN PANTALLA
//
// Si el contador de «sin firmar» dice 0 porque la consulta falló, el profesional se va a casa
// tranquilo con tres albaranes sin firmar. Por eso aquí NADA devuelve ceros por defecto:
//
//   · `contarAlbaranes` LANZA si no recibe una lista de verdad;
//   · `listarAlbaranesDelMerchant` NO captura los errores del lector: si la lectura falla, la
//     promesa se rompe y quien llama tiene que decidir — la ruta devuelve 500 y la pantalla pinta
//     un error, nunca una tabla de ceros.
//
// «Cero albaranes» sigue siendo una respuesta legítima (un merchant que empieza), y por eso se
// distingue de «no se pudo leer» en el TIPO y no en la buena voluntad de quien lo pinte.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// TENENCIA (regla 2), Y POR QUÉ EL LECTOR ES INYECTABLE
//
// El filtro por merchant no se prueba mirando si el fichero menciona `merchantId`: el analizador de
// SCRUM-243 da por cubierta cualquier lectura dentro de un handler que lo nombre por cualquier
// motivo (medido en SCRUM-348). Con el lector inyectable, el test mete albaranes de DOS merchants
// en una tienda falsa que aplica el filtro TAL Y COMO SE LO PASEN —igual que Postgres— y pregunta
// como uno de ellos. Si el código olvidase el filtro, la tienda devolvería los del otro y el test
// se pone rojo. Eso prueba el camino, no la prosa.
import { ALBARAN_ESTADOS } from './albaran.service';
import { ESTADOS_COBRO, estadoCobroAlbaran, facturadoPorLinea } from './albaranFacturacion';
import type { EstadoCobro, LineaAlbaran } from './albaranFacturacion';

/** Los dos ejes, derivados de su fuente. El navegador los recibe; no los sabe de memoria. */
export const EJES_ALBARAN = Object.freeze({
  estado: ALBARAN_ESTADOS as readonly string[],
  cobro: ESTADOS_COBRO as readonly string[],
});

export interface FilaAlbaranListado {
  id: number;
  numero: string;
  /** Fecha de ENTREGA/visita (editable en borrador). */
  fecha: Date | string;
  /** Fecha de EMISIÓN — `createdAt`. Son distintas a propósito (SCRUM-67). */
  emisionAt: Date | string;
  estado: string;
  estadoCobro: EstadoCobro;
  clienteId: number | null;
  cliente: string | null;
  jobId: number;
  trabajo: string | null;
}

export interface ContadoresAlbaran {
  total: number;
  porEstado: Record<string, number>;
  porCobro: Record<string, number>;
}

/**
 * Los contadores de las pestañas. Se cuentan SOBRE LAS MISMAS FILAS que se pintan, y por eso la
 * suma de las pestañas de un eje siempre es el total: no hay dos consultas que puedan discrepar.
 *
 * Todos los valores del eje arrancan a 0 AUNQUE NO HAYA NINGUNA FILA de ese valor — una pestaña que
 * desaparece cuando su contador es cero convierte «no tienes ninguno sin firmar» en «esa pregunta
 * ya no existe».
 */
export function contarAlbaranes(filas: FilaAlbaranListado[]): ContadoresAlbaran {
  if (!Array.isArray(filas)) {
    // El suelo. Devolver ceros aquí sería exactamente el fallo del ticket: una pantalla tranquila
    // construida sobre una lectura que no ocurrió.
    throw new Error('albaranes_listado_sin_poblacion: contarAlbaranes exige una lista, no ausencia de datos');
  }
  const porEstado: Record<string, number> = {};
  const porCobro: Record<string, number> = {};
  for (const v of EJES_ALBARAN.estado) porEstado[v] = 0;
  for (const v of EJES_ALBARAN.cobro) porCobro[v] = 0;

  for (const f of filas) {
    // Un valor que no esté en el eje NO se descarta en silencio: se cuenta igual y aparece en el
    // censo. Si algún día el modelo gana un estado, el contador lo enseña en vez de esconderlo.
    porEstado[f.estado] = (porEstado[f.estado] || 0) + 1;
    porCobro[f.estadoCobro] = (porCobro[f.estadoCobro] || 0) + 1;
  }
  return { total: filas.length, porEstado, porCobro };
}

/** Busca por número, cliente o trabajo. Sin acentos ni mayúsculas: se escribe con prisa. */
export function filtrarAlbaranes(filas: FilaAlbaranListado[], texto: string): FilaAlbaranListado[] {
  const q = normalizar(texto);
  if (!q) return filas;
  return filas.filter((f) =>
    normalizar(f.numero).includes(q) ||
    normalizar(f.cliente || '').includes(q) ||
    normalizar(f.trabajo || '').includes(q));
}

function normalizar(s: string): string {
  // El rango de marcas diacriticas combinantes va ESCAPADO en la cadena, no como caracteres
  // literales: un acento suelto entre corchetes es invisible al revisar un diff.
  return String(s).toLowerCase().normalize("NFD").replace(new RegExp("[\u0300-\u036f]", "g"), "").trim();
}

// ─── LECTURA ─────────────────────────────────────────────────────────────────────────────

export interface LectorListado {
  albaranes(filtro: { merchantId: number }): Promise<Array<{
    id: number; merchantId: number; jobId: number; numero: string;
    fecha: Date | string; createdAt: Date | string; estado: string;
    lineas: unknown; invoiceId: number | null;
  }>>;
  jobs(filtro: { merchantId: number; ids: number[] }): Promise<Array<{ id: number; titulo: string | null; customerId: number }>>;
  customers(filtro: { merchantId: number; ids: number[] }): Promise<Array<{ id: number; name: string | null; legalName: string | null }>>;
  libro(filtro: { merchantId: number; albaranIds: number[] }): Promise<Array<{ albaranId: number; lineaIndex: number; cantidad: unknown; invoiceId: number }>>;
}

export interface ListadoAlbaranes {
  filas: FilaAlbaranListado[];
  contadores: ContadoresAlbaran;
  ejes: { estado: readonly string[]; cobro: readonly string[] };
}

/**
 * El listado de UN merchant. Cada lectura lleva su `merchantId` explícito: no es higiene, es que
 * mezclar el Trabajo de otro merchant enseñaría el nombre de su cliente en esta tabla.
 *
 * El estado de cobro se calcula con LAS MISMAS PIEZAS que usan el detalle (C2) y la facturación
 * parcial: `facturadoPorLinea` + `estadoCobroAlbaran`. Reimplementar aquí la regla haría que el
 * listado y el detalle pudieran decir cosas distintas del mismo albarán.
 */
export async function listarAlbaranesDelMerchant(
  merchantId: number,
  lector: LectorListado,
): Promise<ListadoAlbaranes> {
  const albaranes = await lector.albaranes({ merchantId });

  const jobIds = [...new Set(albaranes.map((a) => a.jobId))];
  const jobs = new Map((await lector.jobs({ merchantId, ids: jobIds })).map((j) => [j.id, j]));

  const customerIds = [...new Set([...jobs.values()].map((j) => j.customerId))];
  const customers = new Map((await lector.customers({ merchantId, ids: customerIds })).map((c) => [c.id, c]));

  const libro = await lector.libro({ merchantId, albaranIds: albaranes.map((a) => a.id) });
  const libroPorAlbaran = new Map<number, Array<{ lineaIndex: number; cantidad: any; invoiceId: number }>>();
  for (const fila of libro) {
    if (!libroPorAlbaran.has(fila.albaranId)) libroPorAlbaran.set(fila.albaranId, []);
    libroPorAlbaran.get(fila.albaranId)!.push(fila);
  }

  const filas: FilaAlbaranListado[] = albaranes.map((a) => {
    const job = jobs.get(a.jobId) ?? null;
    const customer = job ? customers.get(job.customerId) ?? null : null;
    const lineas = (Array.isArray(a.lineas) ? a.lineas : []) as LineaAlbaran[];
    const facturado = facturadoPorLinea(libroPorAlbaran.get(a.id) ?? []);
    return {
      id: a.id,
      numero: a.numero,
      fecha: a.fecha,
      emisionAt: a.createdAt,
      estado: a.estado,
      estadoCobro: estadoCobroAlbaran(lineas, facturado, !!a.invoiceId),
      clienteId: customer?.id ?? null,
      cliente: customer?.legalName || customer?.name || null,
      jobId: a.jobId,
      trabajo: job?.titulo || null,
    };
  });

  return { filas, contadores: contarAlbaranes(filas), ejes: EJES_ALBARAN };
}
