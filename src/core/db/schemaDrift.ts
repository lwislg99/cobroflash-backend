// src/core/db/schemaDrift.ts
//
// SCRUM-222 — ¿el esquema que la app CREE tener es el que la base TIENE?
//
// EL HUECO QUE CIERRA. Antes de esto, el despliegue era `install` → `tsc` → `node dist/index.js`,
// sin `prestart` ni Procfile ni Dockerfile: **nada comprobaba el esquema antes de escuchar**. Si
// un PR añade una columna y el `db push` no se ejecuta, el proceso arranca sano, responde al
// healthcheck y solo falla —en producción, con un cliente delante— cuando alguien toca la ruta
// que usa esa columna. Arrancar así es arrancar mintiendo.
//
// POR QUÉ NO SE REUTILIZA `scripts/preflight-schema-drift.mjs` (SCRUM-167), que ya compara BD
// contra schema. Tres razones medidas, no supuestas:
//   1. Tiene un guard ANTI-PROD deliberado (`if (host === PROD_HOST) … ABORTADO`) y su cabecera
//      dice literalmente «NO apuntes esto a prod». En producción devolvería siempre «no pude
//      comparar»: sería un chequeo que no chequea.
//   2. Lanza el CLI de Prisma (`node_modules/prisma/build/index.js migrate diff`), y `prisma` es
//      **devDependency**; solo `@prisma/client` es dependencia de runtime. Si el proveedor poda
//      las devDeps tras el build, el fichero no existe y el chequeo revienta. No dependemos de un
//      comportamiento del proveedor que nadie ha medido y que puede cambiar sin avisar.
//   3. `migrate diff` introspecciona la base entera y lanza un proceso hijo: coste y una
//      dependencia nueva en el camino crítico del arranque.
// Aquí se usa el DMMF de `@prisma/client` —que SÍ es dependencia de runtime— y UNA consulta.
//
// QUÉ COMPRUEBA Y QUÉ NO (declararlo importa: un guard que exagera su cobertura miente).
//   SÍ: que exista cada TABLA y cada COLUMNA que el cliente Prisma va a nombrar.
//   NO: tipos, nullability, defaults, índices, claves ajenas, ni valores de enum. Esas derivas
//       existen y no las ve. El fallo que tumba una ruta en producción es, casi siempre, «esa
//       columna no está»; eso es lo que se cubre, y solo eso se promete.
//
// DIRECCIÓN DE LA COMPARACIÓN: esperado ⊆ real. Una columna que está en la base y no en el
// esquema NO es deriva que rompa nada — es el orden seguro (la base va por delante del código,
// que es justo como se despliega un cambio aditivo). Lo que rompe es lo contrario.

import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { config } from '../config/env';

export type ColumnaBd = { tabla: string; columna: string };

export type TablaEsperada = {
  modelo: string;
  tabla: string;
  columnas: Array<{ campo: string; columna: string }>;
};

export type ColumnaQueFalta = { modelo: string; tabla: string; campo: string; columna: string };

export type ResultadoDeriva =
  | { estado: 'en-sync'; tablas: number; columnas: number }
  | { estado: 'deriva'; tablasQueFaltan: string[]; columnasQueFaltan: ColumnaQueFalta[] }
  | { estado: 'no-pude-comprobar'; motivo: string };

/**
 * El esquema que el cliente Prisma va a nombrar, leído del DMMF.
 *
 * `dbName ?? name` resuelve el `@map`: el schema de YaQu lo usa a medias a propósito
 * (`chargeId @map("charge_id")` pero `merchantId` sin mapear), y el DMMF deja `dbName`
 * undefined cuando la columna se llama igual que el campo. Confundir eso daría falsos
 * positivos en masa.
 *
 * Se descartan los campos `kind: 'object'` — son relaciones, no columnas. En este datamodel
 * solo existen los kinds `scalar` y `object` (medido), pero el filtro es por «no es objeto»
 * para que un `enum` futuro entre solo, ya que sí ocupa columna.
 *
 * PURA y con el datamodel inyectable para poder probarla sin base y con casos inventados.
 */
export function tablasEsperadas(
  datamodel: { models: readonly any[] } = Prisma.dmmf.datamodel,
): TablaEsperada[] {
  return datamodel.models.map((m) => ({
    modelo: m.name,
    tabla: m.dbName ?? m.name,
    columnas: m.fields
      .filter((f: any) => f.kind !== 'object')
      .map((f: any) => ({ campo: f.name, columna: f.dbName ?? f.name })),
  }));
}

/**
 * El comparador. PURO: dos listas entran, un veredicto sale. Todo lo interesante de este
 * fichero se prueba aquí, sin base de datos y sin arrancar nada.
 *
 * EL SUELO ANTI-FALSO-POSITIVO (`enLaBd.length === 0`) es la parte que más importa y la menos
 * obvia. Si el catálogo no devuelve NI UNA columna, la lectura no significa «la base está
 * vacía»: significa que la conexión mira a un esquema que no es el de la app (un `search_path`
 * distinto, un `?schema=` en la URL) o que no se pudo leer el catálogo. Sin este suelo, ese
 * caso se traduciría en «faltan las 24 tablas» → deriva → producción no arranca, por un motivo
 * que no es deriva. Eso es exactamente la cura peor que la enfermedad: convertir un cambio de
 * conexión en una caída total. Se degrada a «no pude comprobar», que arranca y grita.
 */
export function compararEsquema(
  esperadas: readonly TablaEsperada[],
  enLaBd: readonly ColumnaBd[],
): ResultadoDeriva {
  if (enLaBd.length === 0) {
    return {
      estado: 'no-pude-comprobar',
      motivo:
        'el catálogo no devolvió NINGUNA columna. O la conexión apunta a un esquema que no es ' +
        'el de la app, o no se pudo leer information_schema. En ninguno de los dos casos puedo ' +
        'afirmar que el esquema coincide, y tampoco puedo afirmar que haya deriva.',
    };
  }

  const real = new Set(enLaBd.map((c) => `${c.tabla}.${c.columna}`));
  const tablasReales = new Set(enLaBd.map((c) => c.tabla));

  const tablasQueFaltan: string[] = [];
  const columnasQueFaltan: ColumnaQueFalta[] = [];

  for (const t of esperadas) {
    if (!tablasReales.has(t.tabla)) {
      // La tabla entera no está: se reporta UNA vez, no una línea por cada una de sus columnas.
      // Un informe de arranque con 40 líneas para una sola tabla ausente no se lee.
      tablasQueFaltan.push(t.tabla);
      continue;
    }
    for (const c of t.columnas) {
      if (!real.has(`${t.tabla}.${c.columna}`)) {
        columnasQueFaltan.push({ modelo: t.modelo, tabla: t.tabla, campo: c.campo, columna: c.columna });
      }
    }
  }

  if (tablasQueFaltan.length === 0 && columnasQueFaltan.length === 0) {
    return {
      estado: 'en-sync',
      tablas: esperadas.length,
      columnas: esperadas.reduce((n, t) => n + t.columnas.length, 0),
    };
  }
  return { estado: 'deriva', tablasQueFaltan, columnasQueFaltan };
}

/**
 * El detalle en claro de la deriva. PURO para poder afirmar en un test QUÉ dice el mensaje:
 * el valor de este chequeo no es que pare, es que diga exactamente qué falta.
 */
export function mensajeDeDeriva(r: Extract<ResultadoDeriva, { estado: 'deriva' }>): string {
  const partes: string[] = [];
  if (r.tablasQueFaltan.length) {
    partes.push(`TABLAS que faltan (${r.tablasQueFaltan.length}): ${r.tablasQueFaltan.join(', ')}`);
  }
  if (r.columnasQueFaltan.length) {
    const lista = r.columnasQueFaltan.map((c) => `${c.tabla}.${c.columna} (${c.modelo}.${c.campo})`);
    partes.push(`COLUMNAS que faltan (${r.columnasQueFaltan.length}): ${lista.join(', ')}`);
  }
  return partes.join(' · ');
}

// ── Lectura de la base: UNA consulta, solo lectura ────────────────────────────
//
// `current_schema()` y no `'public'` a pelo: si la URL trae `?schema=…`, Prisma fija el
// search_path y esto lo sigue solo. El caso en que devuelve vacío lo absorbe el suelo del
// comparador, no un COALESCE que se inventaría un esquema.
const CONSULTA_COLUMNAS = `
  SELECT table_name AS tabla, column_name AS columna
  FROM information_schema.columns
  WHERE table_schema = current_schema()
`;

/** Milisegundos que se le conceden al chequeo. Ver `comprobarDerivaDeSchema`. */
export const TIMEOUT_MS = 5000;

/**
 * Lee la base y compara. NUNCA lanza: cualquier fallo —conexión, permisos, timeout— se traduce
 * a «no pude comprobar» con el motivo dentro.
 *
 * POR QUÉ HAY TIMEOUT: sin él, una base que no responde deja el arranque colgado para siempre.
 * Un proceso que no llega a escuchar es una caída igual que un proceso que revienta, solo que
 * más difícil de diagnosticar. El timeout convierte «la base tarda» en «no pude comprobar» —
 * ruidoso, pero arrancando.
 */
export async function comprobarDerivaDeSchema(opts?: {
  client?: { $queryRawUnsafe: (sql: string) => Promise<unknown> };
  timeoutMs?: number;
  datamodel?: { models: readonly any[] };
}): Promise<ResultadoDeriva> {
  const client = opts?.client ?? prisma;
  const timeoutMs = opts?.timeoutMs ?? TIMEOUT_MS;

  let filas: ColumnaBd[];
  try {
    let temporizador: NodeJS.Timeout | undefined;
    const seAcabaElTiempo = new Promise<never>((_, rechaza) => {
      temporizador = setTimeout(
        () => rechaza(new Error(`la base no respondió en ${timeoutMs} ms`)),
        timeoutMs,
      );
      // Sin unref, el temporizador mantendría vivo el bucle de eventos hasta agotarse aunque
      // la consulta ya hubiera contestado: retrasaría el arranque por nada.
      temporizador.unref?.();
    });
    try {
      filas = (await Promise.race([
        client.$queryRawUnsafe(CONSULTA_COLUMNAS),
        seAcabaElTiempo,
      ])) as ColumnaBd[];
    } finally {
      if (temporizador) clearTimeout(temporizador);
    }
  } catch (err) {
    return {
      estado: 'no-pude-comprobar',
      motivo: `no se pudo leer information_schema: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!Array.isArray(filas)) {
    return { estado: 'no-pude-comprobar', motivo: 'la consulta al catálogo no devolvió filas.' };
  }
  return compararEsquema(tablasEsperadas(opts?.datamodel), filas);
}

export type Desenlace = { arranca: boolean; nivel: 'log' | 'warn' | 'error'; mensaje: string };

/**
 * QUÉ SE HACE CON EL VEREDICTO. PURA, y con `nodeEnv` inyectado, para poder afirmar en un test
 * qué pasa EN PRODUCCIÓN sin arrancar producción — mismo motivo por el que `invalidPublicBaseUrl`
 * es pura y su `assert*` es una cáscara.
 *
 * LOS DOS DESENLACES, Y POR QUÉ SON DISTINTOS — decisión del fundador en SCRUM-222:
 *
 *   HAY DERIVA → no arranca, con el detalle de qué falta. La base no tiene lo que el código
 *   nombra: cada ruta que toque eso va a fallar delante de un cliente. Mejor no arrancar que
 *   arrancar mintiendo.
 *
 *   NO PUDE COMPROBAR → **arranca**, con un aviso ruidoso que dice «no pude comprobar» y jamás
 *   «todo bien». Un chequeo de arranque que tumba producción por un fallo transitorio es una
 *   cura peor que la enfermedad: convierte un hipo de red en una caída total. Lo que NO se
 *   admite es que pase en SILENCIO — ahí es donde esto se convertiría en el fail-open de
 *   SCRUM-206. Por eso arranca, pero por `console.error` y con esas palabras.
 *
 * Que los dos desenlaces sean distinguibles es el punto entero, y es el mismo motivo por el que
 * `preflight-schema-drift.mjs` reserva el exit 3 para la deriva y el 2/1 para «no pude
 * comparar»: si compartieran desenlace, «hay deriva» y «el chequeo está roto» serían
 * indistinguibles POR CONSTRUCCIÓN, y ninguna comprobación previa lo arreglaría.
 *
 * FUERA DE PRODUCCIÓN LA DERIVA SOLO AVISA, igual que `assertPublicBaseUrl`: en local el
 * esquema está desincronizado la mitad del tiempo, y eso es trabajar, no un incidente.
 */
export function desenlaceDeArranque(r: ResultadoDeriva, nodeEnv: string): Desenlace {
  if (r.estado === 'en-sync') {
    return {
      arranca: true,
      nivel: 'log',
      mensaje: `[schema] en sync: ${r.tablas} tablas / ${r.columnas} columnas comprobadas.`,
    };
  }
  if (r.estado === 'no-pude-comprobar') {
    return {
      arranca: true,
      nivel: 'error',
      mensaje:
        `🚨 [schema] no pude comprobar si el esquema de la base coincide con el del código: ` +
        `${r.motivo} La app arranca igualmente (un fallo transitorio no debe tumbar producción), ` +
        `pero esto NO significa que esté todo bien: significa que no se sabe.`,
    };
  }
  const mensaje =
    `🚨 [schema] DERIVA de esquema: la base NO tiene lo que el código nombra. ` +
    `${mensajeDeDeriva(r)}. Falta aplicar el cambio de esquema a esta base ` +
    `(preview con \`prisma migrate diff\` y luego \`db push\`). No se arranca: cada ruta que ` +
    `use eso fallaría delante de un cliente.`;
  return nodeEnv === 'production'
    ? { arranca: false, nivel: 'error', mensaje }
    : { arranca: true, nivel: 'warn', mensaje };
}

/** El enganche del arranque (`src/index.ts`, ANTES de escuchar). Cáscara: lee, decide, habla. */
export async function assertSchemaSinDeriva(
  opts?: Parameters<typeof comprobarDerivaDeSchema>[0],
): Promise<ResultadoDeriva> {
  const r = await comprobarDerivaDeSchema(opts);
  const d = desenlaceDeArranque(r, config.NODE_ENV);
  if (!d.arranca) throw new Error(d.mensaje);
  console[d.nivel](d.mensaje);
  return r;
}
