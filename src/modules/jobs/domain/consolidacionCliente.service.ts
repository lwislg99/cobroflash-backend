// src/modules/jobs/domain/consolidacionCliente.service.ts — SCRUM-70 (FACT-2)
//
// ÁMBITO CLIENTE + MES NATURAL, cruzando Trabajos. Decisión del fundador (27-jul-2026).
//
// POR QUÉ CAMBIA EL ÁMBITO. La bandeja "Pendientes de facturar" (SCRUM-69) ya agrupa los
// albaranes por CLIENTE y mes natural cruzando Trabajos, pero el motor de consolidación estaba
// scopeado a un Job (`POST /admin/jobs/:id/consolidar-albaranes`, «V1: 1 Job = 1 cliente»). Un
// cliente con 3 Trabajos en el mismo mes aparecía en la bandeja como UN grupo y solo podía
// facturarse Trabajo a Trabajo: la pantalla prometía algo que el motor no sabía emitir.
//
// Los dos ámbitos son legales —agrupar MENOS de lo permitido nunca lo es—, así que es decisión
// de producto: el art. 13 RD 1619/2012 habla de operaciones a un mismo destinatario dentro de
// un mes natural, no de "trabajos".
//
// ESTE MÓDULO ES SOLO SELECCIÓN. No emite nada, ni toca `emitInvoice` ni VeriFactu: la emisión
// está en manos de SCRUM-173 (agujero de VeriFactu en esa misma ruta) y se cablea después.
import {
  mesNaturalKey,
  type AlbaranConsolidable,
} from './albaran.service';

/**
 * Un albarán candidato, con lo que aporta su Trabajo. `tipoOperacion` viaja aquí porque a
 * ámbito de cliente deja de ser una propiedad de "la operación" y pasa a ser un criterio de
 * elegibilidad POR ALBARÁN: el mismo cliente puede tener a la vez un mantenimiento (se agrupa
 * por meses) y una obra única (se factura al concluir).
 */
export interface AlbaranCandidato extends AlbaranConsolidable {
  jobId: number;
  tipoOperacion?: string | null;
}

export type MotivoDescarte =
  | 'otro_cliente'
  | 'no_firmado'
  | 'sin_precios'
  | 'ya_facturado'
  // SCRUM-171a: el albarán a medias (SCRUM-170) NO lleva `invoiceId` —ese campo significa
  // «facturado entero»—, así que sin este motivo propio se colaría como elegible y la
  // recapitulativa cobraría otra vez lo ya facturado.
  | 'facturado_parcial'
  | 'obra_unica'
  | 'fuera_de_rango';

export interface Descartado {
  id: number;
  numero: string;
  motivo: MotivoDescarte;
  mensaje: string;
}

export interface FiltrosConsolidacion {
  /** Ruta 1 — rango de FECHAS de albarán (inclusive por ambos extremos). */
  desde?: Date | string | null;
  hasta?: Date | string | null;
  /** Ruta 2 — rango de NÚMEROS de albarán (inclusive), formato `ALB-2026-001`. */
  numeroDesde?: string | null;
  numeroHasta?: string | null;
  /** Un solo mes natural, "YYYY-MM". Atajo de la bandeja de SCRUM-69. */
  mes?: string | null;
}

const MENSAJE: Record<MotivoDescarte, (numero: string) => string> = {
  otro_cliente: (n) => `El parte ${n} es de otro cliente.`,
  no_firmado: (n) => `El parte ${n} no está firmado.`,
  sin_precios: (n) => `El parte ${n} no lleva precios.`,
  ya_facturado: (n) => `El parte ${n} ya está facturado.`,
  facturado_parcial: (n) => `El parte ${n} ya tiene líneas facturadas: factura lo que queda desde el propio parte.`,
  obra_unica: (n) => `El parte ${n} es de una obra única: se factura al concluir, no se agrupa por meses.`,
  fuera_de_rango: (n) => `El parte ${n} queda fuera del rango elegido.`,
};

/**
 * Orden de un número de albarán, para comparar rangos.
 *
 * `ALB-2026-001` va relleno a TRES dígitos, así que comparar como texto se rompe en cuanto un
 * merchant pasa de 999 partes: `"ALB-2026-1000" < "ALB-2026-999"` en orden alfabético. Se
 * compara (año, secuencia) como números. Un número con otro formato devuelve null y NUNCA se
 * descarta por rango: quedarse fuera de una factura por no saber leer su número sería peor que
 * incluirlo y que el usuario lo vea en la confirmación.
 */
export function ordenNumeroAlbaran(numero: string): number | null {
  const m = /^ALB-(\d{4})-(\d+)$/.exec(String(numero || '').trim());
  if (!m) return null;
  return Number(m[1]) * 1_000_000 + Number(m[2]);
}

function dentroDeRangoFecha(fecha: Date | string, f: FiltrosConsolidacion): boolean {
  const t = new Date(fecha).getTime();
  if (f.desde) {
    const d = new Date(f.desde);
    // Desde el PRIMER instante del día indicado.
    d.setHours(0, 0, 0, 0);
    if (t < d.getTime()) return false;
  }
  if (f.hasta) {
    const h = new Date(f.hasta);
    // Hasta el ÚLTIMO instante del día indicado: "hasta el 31" incluye el 31 entero, que es lo
    // que cualquiera espera de un rango de fechas de facturación.
    h.setHours(23, 59, 59, 999);
    if (t > h.getTime()) return false;
  }
  if (f.mes && mesNaturalKey(fecha) !== f.mes) return false;
  return true;
}

function dentroDeRangoNumero(numero: string, f: FiltrosConsolidacion): boolean {
  if (!f.numeroDesde && !f.numeroHasta) return true;
  const n = ordenNumeroAlbaran(numero);
  if (n === null) return true; // formato desconocido → no se descarta (ver ordenNumeroAlbaran)
  if (f.numeroDesde) {
    const d = ordenNumeroAlbaran(f.numeroDesde);
    if (d !== null && n < d) return false;
  }
  if (f.numeroHasta) {
    const h = ordenNumeroAlbaran(f.numeroHasta);
    if (h !== null && n > h) return false;
  }
  return true;
}

/**
 * Selecciona los albaranes de UN cliente que pueden entrar en una recapitulativa, aplicando
 * los filtros de las rutas 1 y 2, y devuelve también lo DESCARTADO con su motivo.
 *
 * DESCARTAR, NO FALLAR — y es la diferencia de fondo con el ámbito de Trabajo. Ahí el usuario
 * elegía a mano cada parte, así que uno inválido en la selección es un ERROR suyo y se rechaza
 * la operación entera. Aquí la selección es AUTOMÁTICA (todo lo del cliente en el periodo): si
 * un parte sin firmar tumbara la llamada, un cliente con veinte partes no podría facturar
 * nunca por culpa de uno. Se excluye con su motivo y se enseña — que además es lo que exige el
 * criterio del ticket: el usuario SIEMPRE ve y confirma qué se va a agrupar antes de emitir.
 */
export function seleccionarConsolidablesDeCliente(
  candidatos: AlbaranCandidato[],
  customerId: number,
  filtros: FiltrosConsolidacion = {},
): { elegibles: AlbaranCandidato[]; descartados: Descartado[] } {
  const elegibles: AlbaranCandidato[] = [];
  const descartados: Descartado[] = [];

  const fuera = (a: AlbaranCandidato, motivo: MotivoDescarte) =>
    descartados.push({ id: a.id, numero: a.numero, motivo, mensaje: MENSAJE[motivo](a.numero) });

  for (const a of Array.isArray(candidatos) ? candidatos : []) {
    // El orden importa para el MENSAJE: se informa del motivo más específico primero. Un parte
    // de otro cliente no debería ni haber llegado (la consulta filtra por cliente), pero si
    // llega se dice eso y no "fuera de rango", que despistaría.
    if (a.customerId !== customerId) { fuera(a, 'otro_cliente'); continue; }
    if (a.invoiceId != null) { fuera(a, 'ya_facturado'); continue; }
    if (a.facturadoParcial) { fuera(a, 'facturado_parcial'); continue; }
    if (a.tipoOperacion === 'TRABAJO_UNICO') { fuera(a, 'obra_unica'); continue; }
    if (a.estado !== 'firmado') { fuera(a, 'no_firmado'); continue; }
    if (a.modoValoracion !== 'VALORADO') { fuera(a, 'sin_precios'); continue; }
    if (!dentroDeRangoFecha(a.fecha, filtros) || !dentroDeRangoNumero(a.numero, filtros)) {
      fuera(a, 'fuera_de_rango'); continue;
    }
    elegibles.push(a);
  }

  return { elegibles, descartados };
}

export interface GrupoCliente {
  mesKey: string;
  albaranes: AlbaranCandidato[];
  /** De qué Trabajos sale el grupo — es lo NUEVO del ámbito de cliente y hay que enseñarlo. */
  jobIds: number[];
}

/**
 * Agrupa por mes natural (la rotura del art. 13) conservando de qué Trabajos viene cada grupo.
 *
 * No reutiliza `groupByRotura` porque aquel devuelve `AlbaranConsolidable[]` y perdería `jobId`
 * y `tipoOperacion` por el camino; la rotura —la clave de mes— es la misma función
 * (`mesNaturalKey`), que es lo que de verdad no puede divergir.
 */
export function agruparPorMes(albaranes: AlbaranCandidato[]): GrupoCliente[] {
  const map = new Map<string, AlbaranCandidato[]>();
  for (const a of albaranes) {
    const key = mesNaturalKey(a.fecha);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(a);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mesKey, list]) => ({
      mesKey,
      albaranes: list,
      jobIds: [...new Set(list.map((a) => a.jobId))].sort((x, y) => x - y),
    }));
}
