// src/modules/jobs/domain/albaranBarrido.ts — SCRUM-371
//
// EL BARRIDO DE POBLACIÓN. SCRUM-369 construyó el verificador del sello y **ninguna superficie lo
// llamaba**: el mecanismo existe y nadie lo dispara, que es justo el patrón que ese ticket vino a
// cerrar. Esto es lo que lo dispara.
//
// La pregunta que responde no es «¿este albarán cuadra?» —ésa la contesta un badge, de uno en uno,
// cuando alguien ya tiene el documento delante—. Es:
//
//     ¿CUÁNTOS ALBARANES FIRMADOS HAY DE CADA VERSIÓN DE SOBRE, Y CUADRAN TODOS?
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ AQUÍ NO SE ESCRIBE NADA. NI PARA ARREGLAR.
//
// Si un albarán no cuadra, se DECLARA en el informe y en el log. No se recalcula, no se migra, no
// se «deja bien». Mismo espíritu que la regla 29 con las facturas: lo firmado no se toca ni siquiera
// para arreglarlo — un sobre reescrito deja de ser prueba de nada, y el arreglo destruiría justo el
// dato que documenta el incidente.
//
// Tampoco escribe en `AuditLog`, y no es un olvido: `AuditAction` es una unión CERRADA
// (`system/audit.service.ts`) y ampliarla es decisión del fundador, no un detalle de
// implementación (regla 5). Así que el barrido **solo lee**, y eso se comprueba sobre el AST en
// `tests/scrum371-barrido-poblacion.test.mjs`: ninguna llamada a `prisma` fuera de las de lectura.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ EL ADAPTADOR ES LA PIEZA DELICADA, Y NO LA CONSULTA
//
// El verificador recalcula el hash a partir de unas FUENTES. Si el barrido resuelve esas fuentes
// de forma distinta a como las resolvió `buildFirmaEvidencia` al sellar —un `||` donde había un
// `??`, el nombre comercial donde iba el fiscal— el hash sale distinto **sobre albaranes
// intactos**, y el informe acusaría de manipulación a toda la población de golpe.
//
// Por eso `entradaDesdeFilas` copia la resolución del sellador campo a campo, y hay un guard que
// las cara sobre el AST: si alguien cambia una en `buildFirmaEvidencia`, el rojo sale aquí.
//
// Lo que NO se hace, y es deliberado: **no se importa nada del sellador para «reutilizar» esa
// resolución.** El verificador y el sellador son dos testigos independientes (SCRUM-369); atar el
// barrido al sellador los convertiría en un espejo, que es exactamente el valor que se perdería.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// MULTI-TENANT (regla 2): SE BARRE MERCHANT A MERCHANT
//
// Un cron no tiene `req.merchantId`, así que el bucle exterior son los merchants y cada consulta
// lleva su filtro literal. No es solo higiene de tenencia: cruzar el `Job` de un merchant con el
// albarán de otro produciría fuentes equivocadas y, otra vez, una acusación falsa.
import { prisma } from '../../../core/db/prisma';
import { verificarPoblacion } from './albaranVerificacion';
import type { EntradaVerificacion, InformeVerificacion } from './albaranVerificacion';

/** Cuántos albaranes firmados se leen por vuelta. Ni el barrido ni el informe dependen de esto. */
const LOTE = 200;

/**
 * Las filas que hacen falta, en forma ESTRUCTURAL y no como tipos de Prisma.
 *
 * ⚠️ SCRUM-300 (C5) ya entró: `lugarEntrega`, `fechaEntrega`, `firmadoPorNombre` y
 * `firmadoPorCalidad` son columnas reales y los CUATRO entran en el contenido sellado de v:2.
 * Siguen siendo opcionales en esta interfaz porque valen `null` en toda la población v:1 —que no
 * los sella— y porque el barrido no debe reventar con una fila que no los traiga.
 *
 * 🔴 Si faltaran al construir la entrada, un albarán v:2 INTACTO se recalcularía con nulos y
 * saldría como «no coincide»: la acusación de falsificación contra un papel que nadie tocó.
 */
export interface FilaAlbaranFirmado {
  id: number;
  merchantId: number;
  jobId: number;
  numero: string;
  fecha: Date | string;
  modoValoracion: string;
  lineas: unknown;
  notas: string | null;
  evidenciaFirma: unknown;
  lugarEntrega?: string | null;
  fechaEntrega?: Date | string | null;
  firmadoPorNombre?: string | null;
  firmadoPorCalidad?: string | null;
}
export interface FilaJob { titulo: string | null; direccion: string | null; merchantId: number }
export interface FilaCustomer { name: string | null; legalName: string | null }
export interface FilaMerchant { name: string | null; legalName: string | null; taxId: string | null }

/**
 * De filas de la base a la entrada que el verificador sabe comprobar.
 *
 * ⚠️ CADA RESOLUCIÓN ES LA DEL SELLADOR, COPIADA. `buildFirmaEvidencia` resuelve con cadenas `||`
 * (vacío → `null`) todo lo que viene de otras tablas, y con `??` lo que es del propio albarán.
 * Cambiar una sola por su parecida haría que el hash recalculado no coincidiera con el sellado, y
 * el informe diría «manipulado» sobre un documento intacto: la acusación que no se puede hacer
 * sola. `tests/scrum371-barrido-poblacion.test.mjs` cara las dos resoluciones sobre el AST.
 *
 * `job` llega null si no se pudo resolver (o si es de otro merchant). Eso NO se disimula: las
 * fuentes van a null y, si el sello se hizo con ellas puestas, el albarán saldrá como hallazgo. Es
 * lo correcto — «no pude leer el Trabajo» no puede leerse como «cuadra».
 */
export function entradaDesdeFilas(
  a: FilaAlbaranFirmado,
  job: FilaJob | null,
  customer: FilaCustomer | null,
  merchant: FilaMerchant | null,
): EntradaVerificacion {
  return {
    evidencia: (a.evidenciaFirma ?? null) as EntradaVerificacion['evidencia'],
    contenido: {
      numero: a.numero,
      fecha: a.fecha,
      modoValoracion: a.modoValoracion,
      lineas: a.lineas,
      notas: a.notas ?? null,
      // ⚠️ Las DOS fuentes de `obra` viajan JUNTAS y SIN elegir: cuál manda depende de la versión
      // del sobre (v:1 → `Job.direccion`; v:2 → `Albaran.lugarEntrega`) y elegir es trabajo de la
      // receta, no del adaptador. Es el contrato escrito de `FuentesContenido`.
      jobDireccion: job?.direccion || null,
      lugarEntrega: a.lugarEntrega ?? null,
      referenciaTrabajo: job?.titulo || null,
      cliente: customer?.legalName || customer?.name || null,
      emisor: merchant?.legalName || merchant?.name || null,
      emisorNif: merchant?.taxId || null,
      // SCRUM-300 (C5): los tres que estrena v:2. En v:1 la receta los ignora, así que ponerlos
      // aquí no toca el recálculo del histórico.
      fechaEntrega: a.fechaEntrega ?? null,
      firmadoPorNombre: a.firmadoPorNombre ?? null,
      firmadoPorCalidad: a.firmadoPorCalidad ?? null,
    },
  };
}

/** El informe del verificador + de dónde salió la población. */
export interface InformeBarrido extends InformeVerificacion {
  merchantsBarridos: number;
  /** Los albaranes que no cuadran, con su merchant, para poder ir a mirarlos. */
  aRevisar: Array<{ merchantId: number; numero: string; motivo: string }>;
}

export interface LectorDePoblacion {
  merchants(): Promise<number[]>;
  albaranesFirmados(merchantId: number, desdeId: number, lote: number): Promise<FilaAlbaranFirmado[]>;
  jobs(merchantId: number, ids: number[]): Promise<Map<number, FilaJob & { customerId: number }>>;
  customers(merchantId: number, ids: number[]): Promise<Map<number, FilaCustomer>>;
  merchant(merchantId: number): Promise<FilaMerchant | null>;
}

/**
 * El lector de verdad. Cada consulta filtra por `merchantId` con un `where` literal (regla 2 y el
 * censo de tenencia de SCRUM-243): un barrido que cruzase merchants no sería un fallo de higiene,
 * sería un informe lleno de acusaciones falsas.
 */
export const lectorPrisma: LectorDePoblacion = {
  async merchants() {
    const filas = await prisma.merchant.findMany({ select: { id: true }, orderBy: { id: 'asc' } });
    return filas.map((m) => m.id);
  },
  async albaranesFirmados(merchantId, desdeId, lote) {
    return prisma.albaran.findMany({
      where: { merchantId, estado: 'firmado', id: { gt: desdeId } },
      orderBy: { id: 'asc' },
      take: lote,
      select: {
        id: true, merchantId: true, jobId: true, numero: true, fecha: true,
        modoValoracion: true, lineas: true, notas: true, evidenciaFirma: true,
        // SCRUM-300 (C5): sin estos cuatro, un albarán v:2 intacto saldría como «no coincide».
        lugarEntrega: true, fechaEntrega: true, firmadoPorNombre: true, firmadoPorCalidad: true,
      },
    });
  },
  async jobs(merchantId, ids) {
    const filas = await prisma.job.findMany({
      where: { merchantId, id: { in: ids } },
      select: { id: true, titulo: true, direccion: true, customerId: true, merchantId: true },
    });
    return new Map(filas.map((j) => [j.id, j]));
  },
  async customers(merchantId, ids) {
    const filas = await prisma.customer.findMany({
      where: { merchantId, id: { in: ids } },
      select: { id: true, name: true, legalName: true },
    });
    return new Map(filas.map((c) => [c.id, c]));
  },
  async merchant(merchantId) {
    return prisma.merchant.findFirst({
      where: { id: merchantId },
      select: { name: true, legalName: true, taxId: true },
    });
  },
};

/**
 * Barre TODA la población de albaranes firmados y devuelve el informe por versión de sobre.
 *
 * El suelo NO se reimplementa aquí: la conclusión la pone `verificarPoblacion`, que es su dueño.
 * Duplicar esa regla en el barrido sería tener dos sitios donde decidir si «cero examinados» es
 * «todo cuadra», y tarde o temprano dirían cosas distintas.
 */
export async function barrerSellosAlbaran(lector: LectorDePoblacion = lectorPrisma): Promise<InformeBarrido> {
  const entradas: EntradaVerificacion[] = [];
  const merchantPorNumero = new Map<string, number>();
  const merchants = await lector.merchants();

  for (const merchantId of merchants) {
    const datosMerchant = await lector.merchant(merchantId);
    let desdeId = 0;
    for (;;) {
      const lote = await lector.albaranesFirmados(merchantId, desdeId, LOTE);
      if (lote.length === 0) break;
      desdeId = lote[lote.length - 1].id;

      const jobs = await lector.jobs(merchantId, [...new Set(lote.map((a) => a.jobId))]);
      const customers = await lector.customers(
        merchantId,
        [...new Set([...jobs.values()].map((j) => j.customerId))],
      );

      for (const a of lote) {
        const job = jobs.get(a.jobId) ?? null;
        const customer = job ? customers.get(job.customerId) ?? null : null;
        entradas.push(entradaDesdeFilas(a, job, customer, datosMerchant));
        merchantPorNumero.set(a.numero, a.merchantId);
      }
      if (lote.length < LOTE) break;
    }
  }

  const informe = verificarPoblacion(entradas);
  return {
    ...informe,
    merchantsBarridos: merchants.length,
    aRevisar: informe.hallazgos.map((h) => ({
      merchantId: merchantPorNumero.get(h.numero) ?? -1,
      numero: h.numero,
      motivo: h.cuadra ? 'cuadra' : h.motivo,
    })),
  };
}

/**
 * La línea que se lee en los logs. Nunca dice «todo cuadra» sin haber mirado nada: «cero
 * manipulados» y «no supe mirar» son el mismo número con significados opuestos, y el sitio donde
 * esa confusión hace daño de verdad es aquí, en la frase que alguien leerá por encima.
 */
export function resumenDelBarrido(informe: InformeBarrido): string {
  const censo = Object.entries(informe.censoPorVersion)
    .map(([v, n]) => `${v === 'sin_version' ? 'sin versión' : `v:${v}`}=${n}`)
    .join(' · ') || '—';

  if (informe.conclusion === 'no_se_pudo_mirar') {
    return `sellos de albarán: NO SE PUDO MIRAR — cero albaranes firmados en ${informe.merchantsBarridos} merchant(s). ` +
      'Esto NO es «todo cuadra»: es que no había nada que comprobar.';
  }
  if (informe.conclusion === 'todo_cuadra') {
    return `sellos de albarán: ${informe.cuadran}/${informe.examinados} cuadran · censo ${censo}`;
  }
  const noSoportadas = informe.versionesNoSoportadas.length
    ? ` · versiones SIN receta: v:${informe.versionesNoSoportadas.join(', v:')}`
    : '';
  return `sellos de albarán: ${informe.hallazgos.length} A REVISAR de ${informe.examinados} · censo ${censo}${noSoportadas} · ` +
    informe.aRevisar.map((h) => `[merchant ${h.merchantId}] ${h.numero} (${h.motivo})`).join(' · ') +
    ' — NO se toca ninguno: se declaran.';
}
