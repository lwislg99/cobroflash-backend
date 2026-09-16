// src/core/db/unicidadNombreProducto.ts
//
// SCRUM-631 — ¿SIGUE EXISTIENDO LA UNICIDAD DEL NOMBRE DE PRODUCTO? SE PREGUNTA AL CATÁLOGO.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL HUECO QUE CIERRA, Y ESTÁ MEDIDO
//
// La opción B de este ticket mueve la unicidad del nombre a un ÍNDICE PARCIAL
// (`UNIQUE (merchant_id, name_search) WHERE is_active = true`). Prisma 6.18 no sabe declarar un
// índice parcial, así que ese índice vive FUERA de `prisma/schema.prisma`. Medido el 5-sep-2026:
//
//   · `prisma db push` NO se lo lleva — responde «already in sync» y lo deja intacto. La
//     advertencia heredada («lo tira, y en CADA push») era cierta para un índice TOTAL y falsa
//     para uno parcial: en el mismo disparo, Prisma propuso `DROP INDEX` del total y no dijo
//     una palabra del parcial.
//   · 🔴 PERO EL PREVIEW DICE EXACTAMENTE LO MISMO CON EL ÍNDICE Y SIN ÉL. No distingue los dos
//     estados. Así que el peligro no es que se lo lleven: es que **nada lo recrea y nada nota su
//     ausencia**. Una base levantada desde el esquema, un `--force-reset` o una restauración de
//     copia no lo tendrían, y todo saldría verde.
//
// Y no había vigilante: los dos guardianes de la casa miran COLUMNAS, no índices —
// `schemaDrift.ts:25` lo declara él mismo («NO: … índices …») y `constanciaDelAlter.ts:58`
// consulta `information_schema.columns`. Sin esto, la garantía se puede perder EN SILENCIO y el
// primer síntoma sería que empiezan a aparecer dos productos ACTIVOS con el mismo nombre.
//
// ── POR QUÉ NO SE METE DENTRO DE `schemaDrift` ─────────────────────────────────────────────
// Se reutiliza su FORMA (función pura → desenlace puro → cáscara que lee, decide y habla) y su
// sitio en el arranque, que es lo que se puede reutilizar. Su LÓGICA no: aquél compara el DMMF
// del cliente contra `information_schema.columns` y este pregunta a `pg_index`. Son fuentes
// distintas y preguntas distintas; fundirlas obligaría a que su contrato declarado —«tablas y
// columnas, y sólo eso»— dejara de ser cierto.
//
// ── QUÉ COMPRUEBA Y QUÉ NO (declararlo importa: un guard que exagera su cobertura miente) ───
//   SÍ: que exista AL MENOS UN índice ÚNICO sobre (merchant_id, name_search) en `products`, sea
//       TOTAL (el estado de hoy) o PARCIAL sobre las filas activas (el estado tras la opción B).
//   NO: que sea el uno o el otro. Y es DELIBERADO: los dos son estados legítimos de esta
//       migración, así que este guard es válido ANTES, DURANTE y DESPUÉS de aplicarla, y puede
//       mergearse sin depender de cuándo se aplique el ALTER en cada base. Lo que no admite es
//       que no quede NINGUNO, que es justo la pérdida silenciosa que existe para cazar.
//   NO: nada de otras tablas. `providers` tiene la misma forma y no está medido (queda fuera).
//
// ⚠️ SE PREGUNTA POR PROPIEDAD, NUNCA POR EL NOMBRE DEL ÍNDICE. Un guard que buscara
// «products_merchant_nombre_activo_key» se cae el día que alguien lo renombre, y peor: pasaría a
// verde con un índice que se llama igual y no garantiza nada. Aquí se piden `indisunique`, la
// LISTA DE COLUMNAS y el PREDICADO, que es lo que describe lo que el índice hace.
//
// 🔴 Y EL CONTROL NEGATIVO NO ES HIPOTÉTICO: en `products` convive
// `products_merchant_id_name_search_idx`, que está sobre LAS MISMAS DOS COLUMNAS y NO es único.
// Si este guard mirara sólo las columnas, ese índice lo pondría verde con la garantía perdida.
import { prisma } from './prisma';
import { config } from '../config/env';

/** La tabla y las columnas cuya unicidad se vigila. Una sola fuente para consulta y mensajes. */
export const TABLA = 'products';
export const COLUMNAS = ['merchant_id', 'name_search'] as const;

/** Un índice tal y como lo devuelve el catálogo. `predicado` es `null` si el índice es total. */
export type IndiceBd = {
  nombre: string;
  unico: boolean;
  columnas: string[] | null;
  predicado: string | null;
};

export type Forma = 'total' | 'parcial-activos';

export type ResultadoUnicidad =
  | { estado: 'garantizada'; forma: Forma; indice: string; mirados: number }
  | { estado: 'perdida'; mirados: number; candidatos: string[] }
  | { estado: 'no-pude-comprobar'; motivo: string };

/**
 * ¿QUÉ FORMA TIENE ESTE ÍNDICE, si es que sirve? PURA.
 *
 * Devuelve `null` cuando el índice no garantiza nada de lo que aquí importa. Los tres motivos por
 * los que un índice de `products` cae aquí, y los tres están vivos en la base de hoy:
 *   · no es único (`products_merchant_id_name_search_idx`, sobre las mismas columnas);
 *   · es único pero de otras columnas (`products_pkey`, sobre `id`);
 *   · es único y parcial pero su predicado no habla de `is_active` — no lo hay hoy, y por eso
 *     se comprueba: un índice parcial sobre otra condición no dice nada de los activos.
 *
 * ⚠️ EL PREDICADO SE MIRA POR LO QUE DICE, y se acepta sólo la forma que restringe A LOS ACTIVOS.
 * Postgres lo normaliza y lo devuelve como `(is_active = true)` —medido, no supuesto—, así que se
 * exige `is_active` y se RECHAZA cualquier negación (`false`, `NOT`, `<>`): un índice parcial
 * sobre los INACTIVOS dejaría a dos activos llamarse igual, que es la regla que no se toca.
 */
export function clasificarIndice(i: IndiceBd): Forma | null {
  if (!i.unico) return null;
  const cols = i.columnas ?? [];
  if (cols.length !== COLUMNAS.length) return null;
  for (const c of COLUMNAS) if (!cols.includes(c)) return null;
  if (i.predicado === null) return 'total';
  const p = i.predicado.toLowerCase();
  if (!p.includes('is_active')) return null;
  if (p.includes('false') || p.includes('not ') || p.includes('<>')) return null;
  return 'parcial-activos';
}

/**
 * EL VEREDICTO. PURA, con los índices inyectados, para poder ejercitar los tres controles
 * —positivo, suelo y negativo— en milisegundos y sin base delante. Mismo motivo por el que
 * `compararConstancia` (SCRUM-687) y `compararEsquema` (SCRUM-222) son puras.
 *
 * 🔴 EL SUELO VA PRIMERO. Una lista VACÍA no significa «no hay índice único»: significa que no se
 * ha mirado la tabla —`products` siempre tiene al menos su clave primaria—. Sin esta rama, «la
 * garantía se ha perdido» y «la consulta no devolvió nada» darían el mismo veredicto, que es
 * exactamente el defecto que este guard existe para cazar, un nivel más abajo.
 */
export function evaluarUnicidad(indices: IndiceBd[]): ResultadoUnicidad {
  if (!Array.isArray(indices) || indices.length === 0) {
    return {
      estado: 'no-pude-comprobar',
      motivo: `el catálogo no devolvió ni un índice de \`${TABLA}\`, y esa tabla tiene al menos su `
        + 'clave primaria: la consulta no está mirando lo que cree.',
    };
  }
  for (const i of indices) {
    const forma = clasificarIndice(i);
    if (forma) return { estado: 'garantizada', forma, indice: i.nombre, mirados: indices.length };
  }
  return {
    estado: 'perdida',
    mirados: indices.length,
    candidatos: indices.filter((i) => i.unico).map((i) => i.nombre),
  };
}

/**
 * QUÉ SE HACE CON EL VEREDICTO. PURA, con `nodeEnv` inyectado: así un test puede afirmar qué pasa
 * EN PRODUCCIÓN sin arrancar producción. Los tres desenlaces son los MISMOS de `schemaDrift`
 * (SCRUM-222), copiados y no inventados — un guard de arranque que decida distinto que el de al
 * lado obliga a recordar dos políticas, y la que se olvida es la que falla.
 *
 *   GARANTIZADA        → arranca, y DICE QUÉ FORMA encontró: durante la migración de este ticket
 *                        esa línea es la única manera de saber, mirando el log, en qué estado
 *                        está cada base.
 *   PERDIDA            → en producción NO arranca. Dos productos activos podrían llamarse igual
 *                        y nadie se enteraría hasta que un cliente viera el catálogo duplicado.
 *                        Fuera de producción sólo avisa: en local el esquema está a medias la
 *                        mitad del tiempo, y eso es trabajar, no un incidente.
 *   NO PUDE COMPROBAR  → arranca, con un aviso que dice «no pude comprobar» y JAMÁS «todo bien».
 *                        Tumbar producción por un hipo de red es una cura peor que la enfermedad.
 */
export type Desenlace = { arranca: boolean; nivel: 'log' | 'warn' | 'error'; mensaje: string };

export function desenlaceDeArranque(r: ResultadoUnicidad, nodeEnv: string): Desenlace {
  if (r.estado === 'garantizada') {
    return {
      arranca: true,
      nivel: 'log',
      mensaje: `[unicidad] nombre de producto: garantizada por índice ${r.forma} `
        + `(${r.indice}), de ${r.mirados} índices de \`${TABLA}\`.`,
    };
  }
  if (r.estado === 'no-pude-comprobar') {
    return {
      arranca: true,
      nivel: 'error',
      mensaje: `🚨 [unicidad] no pude comprobar la unicidad del nombre de producto: ${r.motivo} `
        + 'La app arranca igualmente (un fallo transitorio no debe tumbar producción), pero esto '
        + 'NO significa que esté todo bien: significa que no se sabe.',
    };
  }
  const mensaje = `🚨 [unicidad] LA UNICIDAD DEL NOMBRE DE PRODUCTO SE HA PERDIDO. Ningún índice `
    + `ÚNICO cubre (${COLUMNAS.join(', ')}) en \`${TABLA}\`, ni total ni parcial sobre los activos `
    + `— mirados ${r.mirados} índices`
    + (r.candidatos.length ? `, únicos: ${r.candidatos.join(', ')}` : ', ninguno único')
    + '. Dos productos ACTIVOS pueden llamarse igual y nadie lo vería hasta que el catálogo '
    + 'saliera duplicado. Aplica `docs/sql/scrum-631-paso-1-crear-indice-parcial.sql` en ESTA '
    + 'base y compruébalo con `docs/sql/scrum-631-verificar.sql`. No se arranca.';
  return nodeEnv === 'production'
    ? { arranca: false, nivel: 'error', mensaje }
    : { arranca: true, nivel: 'warn', mensaje };
}

/**
 * LA CONSULTA. Se pide POR PROPIEDAD: `indisunique`, las columnas resueltas a su nombre y el
 * predicado. Nunca por el nombre del índice.
 *
 * ⚠️ `indkey` es un vector de números de columna, no de nombres, y su ORDEN importa para el
 * índice — se resuelve con `WITH ORDINALITY` para no depender de que `array_agg` conserve el
 * orden de una subconsulta, que no está garantizado.
 *
 * ⚠️ `n.nspname = current_schema()`: sin acotar el esquema, una tabla `products` de otro esquema
 * del mismo servidor entraría en el recuento y podría poner esto verde con el índice de otra.
 */
export const CONSULTA_INDICES = `
  SELECT i.relname AS nombre,
         ix.indisunique AS unico,
         (SELECT array_agg(a.attname ORDER BY k.ord)
            FROM unnest(ix.indkey) WITH ORDINALITY AS k(attnum, ord)
            JOIN pg_attribute a ON a.attrelid = ix.indrelid AND a.attnum = k.attnum) AS columnas,
         pg_get_expr(ix.indpred, ix.indrelid) AS predicado
    FROM pg_index ix
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
   WHERE t.relname = '${TABLA}' AND n.nspname = current_schema()
`;

/** El mismo tope que `schemaDrift.TIMEOUT_MS`: el arranque no espera a una base que no contesta. */
export const TIMEOUT_MS = 5000;

/** Lee el catálogo y evalúa. Nunca lanza: un fallo se convierte en `no-pude-comprobar`. */
export async function comprobarUnicidadDeNombre(opts?: {
  cliente?: { $queryRawUnsafe: (sql: string) => Promise<unknown> };
  timeoutMs?: number;
}): Promise<ResultadoUnicidad> {
  const cliente = opts?.cliente ?? prisma;
  const tope = opts?.timeoutMs ?? TIMEOUT_MS;
  let reloj: NodeJS.Timeout | undefined;
  try {
    const filas = (await Promise.race([
      cliente.$queryRawUnsafe(CONSULTA_INDICES),
      new Promise((_, no) => {
        reloj = setTimeout(() => no(new Error(`la consulta al catálogo pasó de ${tope} ms`)), tope);
      }),
    ])) as IndiceBd[];
    return evaluarUnicidad(filas);
  } catch (e) {
    return {
      estado: 'no-pude-comprobar',
      motivo: (e instanceof Error ? e.message : String(e)) + '.',
    };
  } finally {
    if (reloj) clearTimeout(reloj);
  }
}

/** El enganche del arranque (`src/index.ts`, ANTES de escuchar). Cáscara: lee, decide, habla. */
export async function assertUnicidadDeNombre(
  opts?: Parameters<typeof comprobarUnicidadDeNombre>[0],
): Promise<ResultadoUnicidad> {
  const r = await comprobarUnicidadDeNombre(opts);
  const d = desenlaceDeArranque(r, config.NODE_ENV);
  if (!d.arranca) throw new Error(d.mensaje);
  console[d.nivel](d.mensaje);
  return r;
}
