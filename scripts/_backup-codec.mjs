// scripts/_backup-codec.mjs — SCRUM-242 · cómo viajan los BYTES en el volcado lógico.
//
// ── POR QUÉ ESTO ES UN MÓDULO APARTE, Y NO DOS FUNCIONES EN CADA SCRIPT ─────────────────────
// El volcado escribe y la restauración lee. Si las dos mitades se escriben por separado, pueden
// desincronizarse **y el día que se nota es el día de la restauración**, que es el peor de todos.
// Con un solo códec compartido eso deja de ser posible: no es disciplina, es que no hay dos sitios.
//
// Y además hace falta para poder PROBARLO: `backup-dump.mjs` y `backup-restore.mjs` ejecutan al
// importarlos (leen `process.env`, llaman a `process.exit`), así que ningún test puede importarlos.
// Este módulo es puro, así que `tests/scrum242-backup-codec.test.mjs` lo prueba de verdad, con
// bytes reales y sin base de datos.
//
// ── EL PROBLEMA QUE RESUELVE, CON SU NÚMERO ────────────────────────────────────────────────
// `attachments.data` es `bytea`: las FOTOS de los trabajos viven dentro de Postgres (MEDIA-1,
// fallback sin R2). Prisma devuelve un `Uint8Array` y `JSON.stringify` lo escribía como un objeto
// de claves numéricas —`{"0":137,"1":80,…}`—, o sea **~12,5 caracteres por cada byte de fichero**
// (medido: 12,36× a 0,5 MB, 13,36× a 5 MB).
//
// El volcado entero termina en UN `JSON.stringify`, así que el techo es `MAX_STRING_LENGTH`
// (536.870.888 en Node 24). Con 12,5× eso son **~41 MB de fotos**: con `FOTO_MAX_BYTES = 5 MB`,
// **OCHO fotos**. Y no se degrada — `JSON.stringify` LANZA, y con el fail-closed de SCRUM-241 no
// se escribe fichero: el día de la foto nº 9 deja de haber backup, del todo y en silencio.
//
// En base64 el factor es 1,34×, así que el mismo techo pasa a ~400 MB. El tope no desaparece —los
// topes no desaparecen, se mueven—, y por eso está MEDIDO y escrito en `docs/RUNBOOKS.md` §R14 y
// vigilado con un número en el guard.
import { Buffer } from 'node:buffer';

/** Lo que escribe el volcado HOY. */
export const FORMATO_ACTUAL = 'yaqu-logical-v2';

/**
 * Lo que la restauración sabe leer. `v1` se sigue aceptando: guardaba los bytes como objeto de
 * índices, y aunque no conste que exista ningún fichero v1 (el volcado no lo dispara nadie: 0
 * invocaciones medidas), un backup que el propio proyecto dejó de entender es la definición de
 * copia inútil. Cuesta una rama del decodificador.
 */
export const FORMATOS_QUE_SE_RESTAURAN = Object.freeze(['yaqu-logical-v1', FORMATO_ACTUAL]);

/** Los tipos de Prisma que NO viajan como valor JSON y hay que codificar. */
export const TIPOS_BINARIOS = Object.freeze(new Set(['Bytes']));

export function esBinario(v) {
  return v instanceof Uint8Array || Buffer.isBuffer(v);
}

/** Uint8Array/Buffer → cadena base64. Es lo que baja el factor de 12,5× a 1,34×. */
export function codificarBinario(v) {
  if (v === null || v === undefined) return v;
  return Buffer.from(v.buffer ? v : Buffer.from(v)).toString('base64');
}

/**
 * Lo que salga del JSON → Buffer. Entiende las DOS formas, y se distingue por el TIPO del valor,
 * no por la versión declarada en la cabecera: un fichero con la versión mal puesta se restaura
 * igual, en vez de corromper los ficheros en silencio.
 *
 *   · v2 → cadena base64.
 *   · v1 → objeto `{"0":137,…}` (o array, si alguna vez lo fue).
 */
export function decodificarBinario(v) {
  if (v === null || v === undefined) return v;
  if (Buffer.isBuffer(v)) return v;
  if (typeof v === 'string') return Buffer.from(v, 'base64');
  if (Array.isArray(v)) return Buffer.from(v);
  if (typeof v === 'object') {
    // `{type:'Buffer',data:[…]}` — lo que sale de `Buffer.prototype.toJSON`. Hoy Prisma devuelve un
    // `Uint8Array` pelado (medido), pero si algún día devolviera un `Buffer`, `JSON.stringify` le
    // llamaría al `toJSON` ANTES de que el codificador lo viera y el fichero saldría con esta forma.
    // Entenderla al LEER no puede estropear nada —solo se aplica a columnas ya sabidas binarias— y
    // evita que un cambio de versión de Prisma deje ilegibles los backups viejos.
    if (v.type === 'Buffer' && Array.isArray(v.data)) return Buffer.from(v.data);
    // POR ÍNDICE, no con `Object.values`: no depender del orden de enumeración. Un byte movido de
    // sitio es un fichero corrupto que nadie mira hasta que lo abre.
    const claves = Object.keys(v);
    const buf = Buffer.alloc(claves.length);
    for (const k of claves) buf[Number(k)] = v[k];
    return buf;
  }
  return v;
}
