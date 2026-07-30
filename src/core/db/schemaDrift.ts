// src/core/db/schemaDrift.ts — SCRUM-222 · DERIVA-PROD-1
//
// El código se despliega solo (Railway, push a main) y el schema se aplica a mano (db-push-prod).
// Las dos vías no se cruzan: nada comprueba que la BD tenga las columnas que el código EXIGE. Eso
// desplegó código que pedía `quotes.job_id`, prod no lo tenía, y la home dio 500 por petición.
//
// Este módulo es la LÓGICA del assert de arranque (fail-closed, antes de `app.listen`). Se escribe
// aparte y con la BD INYECTADA (`consultar`) para poder probar sus dos caminos SIN BD. El cableado
// en `src/index.ts` es el último paso (SCRUM-222), y sólo se da tras confirmar en el panel de Railway
// que un arranque fallido MANTIENE el deploy anterior — si lo dejara caído, este fail-closed pasaría
// de protección a gatillo de caída.
import fs from 'node:fs';
import path from 'node:path';

export type Manifiesto = Record<string, string[]>;
export interface FilaColumna { table_name: string; column_name: string; }

/**
 * Columnas del manifiesto que la BD NO tiene. Comparación una-direccional (esperadas ⊆ reales): una
 * columna de MÁS en prod no es problema, una de MENOS sí. Con SUELO fail-closed:
 *   · catálogo vacío cumpliría el "⊆" al revés (todo ausente) — pero un vacío es "no miré", no
 *     "faltan todas"; se lanza.
 *   · `merchants` es la tabla raíz del tenant: si no aparece, estamos mirando el schema/search_path
 *     equivocado (`current_schema()` puede no ser el correcto). Se lanza en vez de dar verde a ciegas.
 */
export function columnasFaltantes(manifiesto: Manifiesto, filas: FilaColumna[]): string[] {
  const actual = new Set(filas.map((f) => `${f.table_name}.${f.column_name}`));
  const tablasVistas = new Set(filas.map((f) => f.table_name));

  if (actual.size === 0) {
    throw new Error('[SCHEMA] information_schema devolvió 0 columnas — schema/search_path equivocado. No se comprueba a ciegas (SUELO).');
  }
  if (!tablasVistas.has('merchants')) {
    throw new Error('[SCHEMA] no se ve la tabla centinela `merchants` — mirando el schema equivocado o vacío. Fail-closed (SUELO).');
  }

  const faltan: string[] = [];
  for (const [tabla, cols] of Object.entries(manifiesto)) {
    for (const col of cols) {
      if (!actual.has(`${tabla}.${col}`)) faltan.push(`${tabla}.${col}`);
    }
  }
  return faltan;
}

export interface OpcionesAssert {
  reintentos?: number;
  backoffMs?: number;
  esperar?: (ms: number) => Promise<void>;
}

/**
 * Assert de arranque. `consultar` devuelve las filas de `information_schema.columns` (inyectado para
 * poder probar sin BD). DOS SEVERIDADES, distintas a propósito — el mensaje del log tiene que decir
 * en dos segundos si mirar la RED o aplicar una COLUMNA:
 *
 *   · la consulta FALLA (conexión/red): se REINTENTA hasta `reintentos` con backoff creciente; si
 *     tras eso sigue fallando, se lanza «no se pudo comprobar» — porque un blip de red durante el
 *     deploy no debe bloquear un deploy legítimo, pero "no puedo comprobar" tampoco es un pase.
 *   · la consulta va BIEN pero FALTA una columna: se lanza INMEDIATO, sin reintentos — reintentar no
 *     hace aparecer una columna. Mensaje: aplica el schema (db push).
 *
 * Ambos acaban lanzando (→ el proceso sale ≠ 0 antes de escuchar → Railway no promueve el deploy),
 * pero por caminos y mensajes distintos.
 */
export async function assertSchemaColumns(
  manifiesto: Manifiesto,
  consultar: () => Promise<FilaColumna[]>,
  opciones: OpcionesAssert = {},
): Promise<void> {
  const reintentos = opciones.reintentos ?? 3;
  const backoffMs = opciones.backoffMs ?? 500;
  const esperar = opciones.esperar ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  let ultimoError: unknown;
  for (let intento = 1; intento <= reintentos; intento++) {
    let filas: FilaColumna[];
    try {
      filas = await consultar();
    } catch (e) {
      // CAMINO CONEXIÓN: la consulta en sí falló. Reintentar SÍ puede ayudar (blip de red).
      ultimoError = e;
      if (intento < reintentos) {
        await esperar(backoffMs * intento);
        continue;
      }
      const msg = (ultimoError as { message?: string })?.message ?? String(ultimoError);
      throw new Error(
        `[SCHEMA] no se pudo comprobar el schema contra la BD tras ${reintentos} intentos (¿red/conexión?): ${msg}. `
        + 'Arranque abortado: «no puedo comprobar» es fallo, no pase.',
      );
    }

    // CAMINO COLUMNA: la consulta fue bien. Una columna ausente es un fallo DURO e INMEDIATO.
    const faltan = columnasFaltantes(manifiesto, filas); // puede lanzar por SUELO
    if (faltan.length) {
      const muestra = faltan.slice(0, 20).join(', ') + (faltan.length > 20 ? ` (+${faltan.length - 20} más)` : '');
      throw new Error(
        `[SCHEMA] la BD NO tiene ${faltan.length} columna(s) que el código exige: ${muestra}. `
        + 'Aplica el schema a esta BD antes de desplegar (db push). Reintentar no hace aparecer una columna.',
      );
    }
    return; // todo cuadra
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// CABLEADO DE PRODUCCIÓN (SCRUM-222). El manifiesto se lee como FICHERO PLANO (nunca DMMF en runtime)
// y la consulta usa el cliente Prisma real. La lógica de arriba queda pura y testeable; esto es el
// borde impuro que la conecta a la app.
// ─────────────────────────────────────────────────────────────────────────────────────────
interface ClientePrisma { $queryRaw: (...args: any[]) => Promise<unknown>; }

// dist/core/db/schemaDrift.js → ../../../prisma/schema-manifest.json (raíz del repo, VERSIONADO).
const RUTA_MANIFIESTO = path.resolve(__dirname, '..', '..', '..', 'prisma', 'schema-manifest.json');

/** Lee el manifiesto versionado. Fail-closed: sin manifiesto legible NO se comprueba a ciegas. */
export function cargarManifiesto(ruta: string = RUTA_MANIFIESTO): Manifiesto {
  let texto: string;
  try {
    texto = fs.readFileSync(ruta, 'utf8');
  } catch (e) {
    throw new Error(`[SCHEMA] no se pudo leer el manifiesto (${ruta}): ${(e as Error).message}. Fail-closed.`);
  }
  let man: unknown;
  try { man = JSON.parse(texto); } catch { throw new Error('[SCHEMA] el manifiesto no es JSON válido. Fail-closed.'); }
  if (!man || typeof man !== 'object' || Array.isArray(man) || Object.keys(man).length === 0) {
    throw new Error('[SCHEMA] el manifiesto está vacío o mal formado. Fail-closed.');
  }
  return man as Manifiesto;
}

/** El `consultar` de producción: lee information_schema con el cliente Prisma. Query estática. */
export function consultaProd(prisma: ClientePrisma): () => Promise<FilaColumna[]> {
  return async () => (await prisma.$queryRaw`
    SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = current_schema()
  `) as FilaColumna[];
}

/** Entrada del ARRANQUE: carga el manifiesto y comprueba contra la BD viva (fail-closed, puede lanzar). */
export async function comprobarSchemaEnArranque(prisma: ClientePrisma, opciones: OpcionesAssert = {}): Promise<void> {
  await assertSchemaColumns(cargarManifiesto(), consultaProd(prisma), opciones);
}

/**
 * Chequeo de RUNTIME (para /health): NO lanza JAMÁS. Devuelve el estado para un campo informativo.
 * Runtime ≠ arranque: con el proceso vivo no se puede tumbar nada por deriva (matar = servicio caído
 * y no hay "anterior" al que volver). Cualquier fallo (consulta, suelo) → 'desconocido', nunca throw —
 * por eso /health puede llamarlo sabiendo que su status NUNCA se vuelve rojo por deriva.
 */
export async function estadoDerivaRuntime(
  manifiesto: Manifiesto,
  consultar: () => Promise<FilaColumna[]>,
): Promise<{ schema: 'ok' | 'drift' | 'desconocido'; faltan?: string[] }> {
  try {
    const faltan = columnasFaltantes(manifiesto, await consultar());
    return faltan.length ? { schema: 'drift', faltan } : { schema: 'ok' };
  } catch {
    return { schema: 'desconocido' };
  }
}
