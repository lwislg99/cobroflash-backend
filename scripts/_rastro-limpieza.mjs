// scripts/_rastro-limpieza.mjs — SCRUM-260 (constancia de clean-staging-tests)
//
// DÓNDE VIVE EL RASTRO: `COMMENT ON SCHEMA yaqu_rastro` — un schema DEDICADO que el script crea
// (`IF NOT EXISTS`) y por tanto posee. Elegido tras MEDIR con `prisma migrate diff --from-empty`:
// el universo que Prisma gestiona son 24 tablas en `public` y CERO `COMMENT ON DATABASE|SCHEMA`
// y CERO `CREATE SCHEMA` → Prisma no modela los comentarios de schema, así que un `db push` no los
// borra. Es la MISMA clase de objeto que el slot de SCRUM-232 (COMMENT ON SCHEMA public), que
// sobrevive a cada push. No `public` (lo ocupa 232) ni DATABASE (lo ocupa el marcador de 188):
// un tercer objeto propio, sin colisión.
//   POR QUÉ NO auditLog: `AuditLog.merchantId` es obligatorio (schema.prisma:722) y clean-staging
//   borra auditLog POR merchant (`:78`) → un rastro en un merchant de test se borraría a sí mismo
//   en la siguiente pasada. Un registro que su propio autor borra no es registro.
//
// FORMATO (rolling): una cabecera con el contador TOTAL de pasadas y cuántas entradas se han
// DESCARTADO, y las últimas MAX_ENTRADAS entradas. Cuando se llena, la más vieja se pierde PERO
// `total` y `descartadas` lo dejan ver — un log que descarta en silencio sería el verde hueco que
// este ticket existe para cerrar («no consta» pareciendo «no pasó»).
//
// TODO ES BEST-EFFORT (R5): un formato roto degrada a historial vacío y JAMÁS lanza hacia el
// script. La constancia no puede tumbar la limpieza ni, sobre todo, la barrera anti-producción.

export const SCHEMA_RASTRO = 'yaqu_rastro';
export const MAX_ENTRADAS = 20; // N declarado, aquí y en la cabecera del comentario.

const CABECERA = 'YAQU_RASTRO_LIMPIEZA';
const SEP = ' || '; // separador de entradas: fuera del charset de los campos, no colisiona.

// Charset seguro (misma doctrina que RE_CTX_SEGURO de 232): SIN comillas, `;`, `$` ni saltos —
// porque el texto se interpola en el SQL. Lo que no encaje se sanea a `·`, nunca rompe el write.
const RE_SEGURO = /^[A-Za-z0-9 @._:\-,#/=()[\]|+]*$/;
// Sanea un campo dejándolo LEGIBLE y a la vez seguro: neutraliza los separadores del formato
// (`|`, `||`, `::`) para que ningún campo pueda corromper el parseo, y descarta lo que quede fuera
// del set legible/SQL-seguro. El reemplazo (`/` o nada) SIEMPRE está dentro de RE_SEGURO — así la
// puntuación útil (`:` de la hora ISO y del marcador, `-`, `.`, `@`) se conserva.
const saneaCampo = (s) => String(s ?? '')
  .replace(/\|/g, '/') // separador de campos/entradas: fuera del contenido de un campo
  .replace(/::/g, ':') // separador cabecera::cuerpo: se colapsa a uno
  .replace(/[^A-Za-z0-9 @._:\-+/]/g, ''); // el resto (raro o SQL-inseguro): se descarta

/**
 * Compone UNA entrada de una línea con los cinco campos. `turnMarker` null/vacío → «NO CONSTA»
 * EXPLÍCITO (nunca una cadena vacía que se lea como «sin turno» cuando en realidad no se pudo leer).
 */
export function componerEntrada({ ranAt, turnMarker, applied, merchantsCount, merchantEmails, jobsCount }) {
  const turno = turnMarker ? saneaCampo(turnMarker) : 'NO-CONSTA';
  const emails = Array.isArray(merchantEmails) ? merchantEmails.map(saneaCampo).join(',') : saneaCampo(merchantEmails);
  return [
    saneaCampo(ranAt),
    `turno=${turno}`,
    `applied=${applied ? 'SI' : 'dry-run'}`,
    `merchants=${Number(merchantsCount) || 0}[${emails}]`,
    `jobs=${Number.isFinite(jobsCount) ? jobsCount : '?'}`,
  ].join(' | ');
}

/** Parsea el comentario crudo. Ilegible/null → historial fresco (degrada, no lanza). */
export function parsearHistorial(crudo) {
  const vacio = { total: 0, descartadas: 0, max: MAX_ENTRADAS, entradas: [] };
  if (!crudo || typeof crudo !== 'string') return vacio;
  const m = crudo.match(new RegExp(`^${CABECERA} total=(\\d+) descartadas=(\\d+) max=(\\d+)::(.*)$`, 's'));
  if (!m) return vacio;
  const cuerpo = m[4] ?? '';
  const entradas = cuerpo ? cuerpo.split(SEP).filter(Boolean) : [];
  return { total: Number(m[1]), descartadas: Number(m[2]), max: Number(m[3]) || MAX_ENTRADAS, entradas };
}

/**
 * Añade una entrada al frente (más nueva primero), sube `total`, y si se pasa de `max` deja caer
 * las más viejas SUMÁNDOLAS a `descartadas`. Función PURA: se prueba sin BD.
 */
export function añadirEntrada(crudo, entrada, { max = MAX_ENTRADAS } = {}) {
  const h = parsearHistorial(crudo);
  const entradas = [entrada, ...h.entradas];
  let descartadas = h.descartadas;
  if (entradas.length > max) {
    descartadas += entradas.length - max;
    entradas.length = max;
  }
  const cab = `${CABECERA} total=${h.total + 1} descartadas=${descartadas} max=${max}`;
  return `${cab}::${entradas.join(SEP)}`;
}

// ─── IO contra la BD (aislado de la lógica para poder inyectar un doble en los tests) ───────────

async function leerComentario(cliente) {
  const filas = await cliente.$queryRawUnsafe(
    `SELECT obj_description(oid, 'pg_namespace') AS c FROM pg_namespace WHERE nspname = '${SCHEMA_RASTRO}'`,
  );
  return filas?.[0]?.c ?? null;
}

async function escribirComentario(cliente, texto) {
  if (!RE_SEGURO.test(texto)) {
    throw new Error('SCRUM-260: rastro fuera del charset seguro — abortado antes de tocar SQL.');
  }
  // El schema es un identificador constante y seguro; se crea IF NOT EXISTS por si un día no está.
  await cliente.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA_RASTRO}`);
  await cliente.$executeRawUnsafe(
    `DO $$ BEGIN EXECUTE format('COMMENT ON SCHEMA ${SCHEMA_RASTRO} IS %L', '${texto}'); END $$;`,
  );
}

/** IO real respaldado por un cliente Prisma. Los tests pasan su propio `{ leer, escribir }`. */
export function ioDeCliente(cliente) {
  return { leer: () => leerComentario(cliente), escribir: (t) => escribirComentario(cliente, t) };
}

/**
 * Lee → añade → escribe. BEST-EFFORT (R5): captura TODO y devuelve `{ ok:false }` en vez de
 * propagar. La constancia jamás puede tumbar la limpieza ni la barrera anti-producción.
 */
export async function registrar(io, datos) {
  try {
    const crudo = await io.leer().catch(() => null);
    const nuevo = añadirEntrada(crudo, componerEntrada(datos));
    await io.escribir(nuevo);
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: e?.message ?? String(e) };
  }
}
