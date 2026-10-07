/**
 * SCRUM-1404 · EL REINTENTO DEL SELLADO — el mecanismo entero, y hoy INERTE.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * QUÉ CIERRA
 *
 * Una factura nace `pendiente_de_sellado` y se sella después del commit (`sellarTrasEmision`).
 * Si ese sellado falla, o el proceso muere antes de intentarlo, la factura se queda donde nació
 * y NADIE vuelve a por ella: ninguna de las tareas programadas la busca (medido en SCRUM-1404).
 * Las dos frases del 409 de su PDF prometen que se reintenta; esto es lo que lo haría cierto.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * 🔴 POR QUÉ ESTÁ INERTE, Y QUÉ LO ACTIVA
 *
 * `REINTENTO_ACTIVO_DESDE` vale `null`: con `null` esto no lee ni escribe una sola factura, y su
 * parte lo dice. Además no lo llama nadie todavía. Lo activa un SEGUNDO PR, que lleva las tres
 * cosas a la vez:
 *   ① la fecha, escrita DESPUÉS de que este fichero esté desplegado;
 *   ② su línea en `src/core/cron/cron.ts` (carril de S1: se pide, no se toca desde aquí);
 *   ③ el arreglo del `catch` de las dos rutas del PDF.
 * El orden es decisión del fundador (SCRUM-1404, comentario 18783): la respuesta nunca antes que
 * el reintento.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * 🔴 QUÉ FACTURAS TOCA: LAS TRES CONDICIONES, Y NINGUNA SOBRA
 *
 *   · `vf_estado = pendiente_de_sellado`. NO BASTA: es el valor por defecto de la columna y
 *     ningún camino de alta lo escribe, así que también lo lleva todo el histórico (medido por J2,
 *     SCRUM-1404 comentario 18836). Seleccionar sólo por él sellaría facturas viejas.
 *   · NACIDA EN O DESPUÉS DE LA FECHA DE CORTE (población B, comentario 18833), y la fecha es la
 *     del despliegue del propio reintento (comentario 18840): no puede alcanzar nada anterior a
 *     su existencia. El histórico queda fuera por geometría.
 *   · Y SIN HUELLA (comentario 18840; «la huella manda», SCRUM-205). Una factura con huella no se
 *     vuelve a sellar, sea cual sea su estado y su fecha.
 *
 * ⚠️ EL HUECO QUE LA TERCERA DEJA, declarado: una factura con la huella ESCRITA y el estado sin
 * marcar (el proceso murió entre las dos escrituras de `sellarTrasEmision`) queda fuera de la
 * selección, y su PDF seguirá sin salir. Terminarla sería entrar en el sellado, que nada
 * autoriza. Aquí se CUENTA en cada parte —también cuando son cero— y no se toca.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * DE DÓNDE SALE EL ESTADO DEL REINTENTO, SIN COLUMNA NUEVA
 *
 * Cada sellado fallido deja un `sellado_fallido` en el registro de auditoría (lo escribe
 * `sellarTrasEmision`). Cuántos lleva una factura y cuándo fue el último salen de ahí.
 *
 * ⚠️ Ese registro se escribe sin esperar (`recordAudit`): si la escritura falla, ese intento no
 * cuenta. Va hacia el lado prudente —un intento de más, nunca una factura dada por agotada sin
 * haberlo estado—, y con la base caída no hay intento: la selección falla antes.
 *
 * ⚠️ Y `puntoDeFallo` saldrá como `emision` también en un fallo del reintento: lo escribe
 * `sellarTrasEmision`. Decir `reintento` pide un parámetro allí y una lista cerrada que firma el
 * fundador: propuesto en `docs/master/SCRUM-1404.md`, no construido.
 */
import { prisma as defaultPrisma } from '../../../core/db/prisma';
import { sellarTrasEmision, SELLADO_PENDIENTE, SELLADO_HECHO, SELLADO_NO_APLICA } from './selladoEstado';

/**
 * 🔴 LA FECHA DE CORTE. `null` = el reintento NO ACTÚA.
 *
 * Se rellena en el PR de activación con un instante ISO en UTC, leído de la cabecera `Date:` de
 * GitHub DESPUÉS de comprobar que este fichero ya está desplegado. No es una preferencia: una
 * fecha puesta «por lo bajo» devuelve el histórico entero, idéntico a no poner fecha.
 */
export const REINTENTO_ACTIVO_DESDE: string | null = null;

/**
 * El suelo de esa fecha: cuándo se escribió este fichero (cabecera `Date:` de GitHub). Una fecha
 * de corte anterior es anterior al mecanismo, así que se rechaza y el reintento no actúa.
 */
export const SUELO_DE_LA_FECHA_DE_CORTE = '2026-10-07T23:43:18Z';

/**
 * Tope de sellados fallidos por factura, y la espera entre ellos. NO son números de este ticket:
 * son los que la casa ya firmó para la cola de remisión (`sif.cola.ts`: `MAX_INTENTOS`,
 * `ESPERA_MINIMA_S`, y su misma progresión ×2). No se importan de allí a propósito: aquellos
 * son del flujo de control de la AEAT, y sellar no llama a la AEAT; si un día cambian por un
 * motivo de la AEAT, éstos no tienen por qué moverse. Su igualdad de HOY la fija un test.
 *
 * Con 5: el fallo de la emisión y cuatro reintentos, a 1, 2, 4 y 8 minutos del anterior.
 * No se pudo medir contra fallos reales de sellado: no hay ninguno a mano.
 */
export const TOPE_DE_FALLOS = 5;
export const ESPERA_INICIAL_S = 60;

/** Cuántas candidatas mira una pasada. Si las hay todas, el parte lo dice (`truncado`). */
export const LOTE_DEL_REINTENTO = 500;

export type DecisionDeCorte = { desde: Date; motivo: null } | { desde: null; motivo: string };

/** Lee la fecha de corte. Todo lo que no sea una fecha válida y no anterior al suelo es «no actúa». */
export function fechaDeCorte(valor: string | null = REINTENTO_ACTIVO_DESDE): DecisionDeCorte {
  if (valor === null) return { desde: null, motivo: 'sin fecha de corte: el reintento no está activado' };
  // Se exige el instante completo en UTC. `new Date('2026-10-09')` también parsea, y una fecha sin
  // hora es justo la clase de valor que se escribe a ojo.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(valor)) {
    return { desde: null, motivo: `fecha de corte ilegible (${valor}): se espera un instante ISO en UTC` };
  }
  const desde = new Date(valor);
  if (Number.isNaN(desde.getTime())) return { desde: null, motivo: `fecha de corte ilegible (${valor})` };
  if (desde.getTime() < new Date(SUELO_DE_LA_FECHA_DE_CORTE).getTime()) {
    return { desde: null, motivo: `fecha de corte (${valor}) anterior al propio reintento (${SUELO_DE_LA_FECHA_DE_CORTE})` };
  }
  return { desde, motivo: null };
}

/** Lo que hace falta saber de una factura para decidir si es del reintento. */
export interface FilaDelReintento {
  vfEstado: string;
  vfHash: string | null;
  createdAt: Date;
}

/**
 * LAS TRES CONDICIONES, en un solo sitio. La consulta las lleva en su `where`; esto las vuelve a
 * exigir sobre cada fila que devuelve, para que un `where` mal escrito no pueda ensanchar la
 * población en silencio.
 */
export function entraEnElReintento(f: FilaDelReintento, desde: Date): boolean {
  return f.vfEstado === SELLADO_PENDIENTE && !f.vfHash && f.createdAt.getTime() >= desde.getTime();
}

/** El `where` de la selección. Exportado para que el test lo lea tal cual lo usa la pasada. */
export function whereDelReintento(desde: Date) {
  return { vfEstado: SELLADO_PENDIENTE, vfHash: null, createdAt: { gte: desde } };
}

/** Espera, en segundos, tras el fallo número `fallos` (1 → 60, 2 → 120, 3 → 240…). */
export function esperaTrasFalloS(fallos: number): number {
  const n = Math.max(1, Math.floor(fallos));
  return ESPERA_INICIAL_S * 2 ** (n - 1);
}

export type TurnoDelReintento = 'toca' | 'espera' | 'agotada';

/**
 * ¿Le toca ya a esta factura?
 *
 * Sin ningún fallo anotado (el proceso murió antes de intentar sellar) se espera la inicial desde
 * su NACIMIENTO: una factura recién creada puede tener su sellado de emisión todavía en marcha.
 */
export function turnoDe(
  f: { createdAt: Date },
  fallos: { cuantos: number; ultimo: Date | null },
  ahora: Date,
): TurnoDelReintento {
  if (fallos.cuantos >= TOPE_DE_FALLOS) return 'agotada';
  const desde = fallos.ultimo ?? f.createdAt;
  const esperaS = fallos.cuantos === 0 ? ESPERA_INICIAL_S : esperaTrasFalloS(fallos.cuantos);
  return ahora.getTime() - desde.getTime() >= esperaS * 1000 ? 'toca' : 'espera';
}

export interface FacturaNombrada {
  id: number;
  numero: string;
  merchantId: number;
}

export interface ParteDelReintento {
  /** `false` = no se ha leído ni escrito nada, y `motivo` dice por qué. */
  activo: boolean;
  motivo: string | null;
  desde: string | null;
  candidatas: number;
  /** Había al menos un lote entero: puede haber más de las que se miraron. */
  truncado: boolean;
  selladas: FacturaNombrada[];
  noAplica: FacturaNombrada[];
  siguenPendientes: FacturaNombrada[];
  enEspera: number;
  /** Tope agotado: ya no se reintentan. Son las que tiene que mirar una persona. */
  agotadas: Array<FacturaNombrada & { fallos: number }>;
  /** La pasada sobre esa factura lanzó. No se traga: se nombra. */
  conError: Array<FacturaNombrada & { error: string }>;
  /** Huella escrita y estado sin marcar, nacidas tras el corte. Se cuentan; no se tocan. */
  conHuellaSinMarcar: FacturaNombrada[];
}

function parteVacio(activo: boolean, motivo: string | null, desde: Date | null): ParteDelReintento {
  return {
    activo, motivo, desde: desde ? desde.toISOString() : null,
    candidatas: 0, truncado: false, selladas: [], noAplica: [], siguenPendientes: [], enEspera: 0,
    agotadas: [], conError: [], conHuellaSinMarcar: [],
  };
}

/**
 * UNA PASADA. Una factura a la vez, con el cliente global, por el punto único
 * (`sellarTrasEmision`): no hay aquí otro camino de entrada a la cadena.
 *
 * No lanza por una factura: lo que falle se nombra en el parte y la pasada sigue. Sí lanza si no
 * puede ni leer las candidatas — quien la programe decide qué hace con una pasada que no miró.
 */
export async function reintentarSelladosPendientes(opciones: {
  ahora?: Date;
  corte?: DecisionDeCorte;
  prisma?: any;
  sellar?: typeof sellarTrasEmision;
} = {}): Promise<ParteDelReintento> {
  const ahora = opciones.ahora ?? new Date();
  const corte = opciones.corte ?? fechaDeCorte();
  const prisma = opciones.prisma ?? defaultPrisma;
  const sellar = opciones.sellar ?? sellarTrasEmision;

  if (corte.desde === null) return parteVacio(false, corte.motivo, null);
  const desde = corte.desde;
  const parte = parteVacio(true, null, desde);

  const filas: any[] = await prisma.invoice.findMany({
    where: whereDelReintento(desde),
    orderBy: { id: 'asc' },
    take: LOTE_DEL_REINTENTO,
    select: {
      id: true, number: true, total: true, createdAt: true, merchantId: true, type: true,
      vfEstado: true, vfHash: true,
      merchant: { select: { country: true, taxId: true, email: true } },
    },
  });
  parte.truncado = filas.length >= LOTE_DEL_REINTENTO;

  const sinMarcar: any[] = await prisma.invoice.findMany({
    where: { vfEstado: SELLADO_PENDIENTE, vfHash: { not: null }, createdAt: { gte: desde } },
    orderBy: { id: 'asc' },
    take: LOTE_DEL_REINTENTO,
    select: { id: true, number: true, merchantId: true },
  });
  parte.conHuellaSinMarcar = sinMarcar.map((f) => ({ id: f.id, numero: f.number, merchantId: f.merchantId }));

  for (const f of filas) {
    // El cinturón: lo que la consulta devuelva y no cumpla las tres condiciones NO se sella.
    if (!entraEnElReintento(f, desde)) continue;
    parte.candidatas += 1;
    const nombrada: FacturaNombrada = { id: f.id, numero: f.number, merchantId: f.merchantId };
    try {
      const anotados: Array<{ createdAt: Date }> = await prisma.auditLog.findMany({
        where: { merchantId: f.merchantId, entityType: 'invoice', entityId: f.id, action: 'sellado_fallido' },
        select: { createdAt: true },
      });
      const ultimo = anotados.reduce<Date | null>(
        (m, a) => (m === null || a.createdAt.getTime() > m.getTime() ? a.createdAt : m), null);
      const turno = turnoDe(f, { cuantos: anotados.length, ultimo }, ahora);
      if (turno === 'agotada') { parte.agotadas.push({ ...nombrada, fallos: anotados.length }); continue; }
      if (turno === 'espera') { parte.enEspera += 1; continue; }

      const r = await sellar(
        { id: f.id, number: f.number, total: f.total, createdAt: f.createdAt, merchantId: f.merchantId, type: f.type },
        f.merchant ?? {},
        prisma,
      );
      if (r.estado === SELLADO_HECHO) parte.selladas.push(nombrada);
      else if (r.estado === SELLADO_NO_APLICA) parte.noAplica.push(nombrada);
      else parte.siguenPendientes.push(nombrada);
    } catch (e: any) {
      parte.conError.push({ ...nombrada, error: String(e?.message ?? e).slice(0, 300) });
    }
  }
  return parte;
}

export type ConclusionDelReintento = 'inactivo' | 'nada_que_mirar' | 'todo_en_orden' | 'hay_que_mirar';

/** Qué pide el parte: `hay_que_mirar` es lo que una persona tiene que abrir. */
export function conclusionDelReintento(p: ParteDelReintento): ConclusionDelReintento {
  if (!p.activo) return 'inactivo';
  if (p.agotadas.length || p.conError.length || p.conHuellaSinMarcar.length || p.truncado) return 'hay_que_mirar';
  if (p.candidatas === 0) return 'nada_que_mirar';
  return 'todo_en_orden';
}

/** Una línea para el log de la tarea programada. Todas las cuentas salen SIEMPRE, también a cero. */
export function resumenDelReintento(p: ParteDelReintento): string {
  if (!p.activo) return `reintento de sellado INACTIVO: ${p.motivo}`;
  const nombres = (l: FacturaNombrada[]) => l.map((f) => `${f.numero} (factura ${f.id}, merchant ${f.merchantId})`).join(', ');
  const partes = [
    `reintento de sellado desde ${p.desde}`,
    `candidatas ${p.candidatas}${p.truncado ? ` (LOTE LLENO: puede haber más de ${LOTE_DEL_REINTENTO})` : ''}`,
    `selladas ${p.selladas.length}`,
    `no aplica ${p.noAplica.length}`,
    `siguen pendientes ${p.siguenPendientes.length}`,
    `en espera ${p.enEspera}`,
    `agotadas ${p.agotadas.length}${p.agotadas.length ? `: ${nombres(p.agotadas)}` : ''}`,
    `con error ${p.conError.length}${p.conError.length ? `: ${nombres(p.conError)}` : ''}`,
    `con huella y sin marcar ${p.conHuellaSinMarcar.length}${p.conHuellaSinMarcar.length ? `: ${nombres(p.conHuellaSinMarcar)}` : ''}`,
  ];
  return partes.join(' · ');
}
