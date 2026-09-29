// tests/_marcadores-declarados.mjs — SCRUM-1293
//
// El cargador de `scripts/_marcadores-pendientes-declarados.json`: las LISTAS de los censos de
// marcadores que antes vivían dentro de scrum402, scrum667 y scrum650d. Los tests conservan sus
// aserciones; de aquí sólo sacan los datos.
//
// 🔴 UN CARGADOR QUE NO SABE LEER NO PUEDE DEVOLVER UNA LISTA VACÍA. Con la lista vacía, el
// trinquete de «ningún marcador nuevo» caería en rojo (bien), pero el de «el papel trae tantos
// como hay declarados» pasaría a comparar contra cero, y el de «si baja, se aprieta» no tendría
// nada que apretar. Así que aquí no hay valor por defecto: o se lee entero y sano, o se lanza
// diciendo por qué, y el test que lo importa sale en ROJO en la carga.
//
// 🔴 Y LAS CLAVES REPETIDAS. En JSON, igual que en un literal de JavaScript, dos claves iguales
// no dan error: la última gana en silencio. Es el defecto que el censo de SCRUM-402 ya sufrió
// (`invoicesView.js` dos veces, el PR #1065 mergeado en rojo) y cuyo guard, «R4c», se citaba en
// un comentario sin existir. Aquí se mira el TEXTO del fichero, antes de parsearlo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const RUTA_DECLARADOS = path.join(RAIZ, 'scripts', '_marcadores-pendientes-declarados.json');

/** Las claves del bloque `"<nombre>": { ... }` (sin llaves anidadas), tal como están ESCRITAS. */
function clavesEscritas(texto, nombre) {
  const m = texto.match(new RegExp(`"${nombre}"\\s*:\\s*\\{([^{}]*)\\}`));
  if (!m) return null;
  return [...m[1].matchAll(/"((?:[^"\\]|\\.)*)"\s*:/g)].map((x) => x[1]);
}

/**
 * Lee y valida. Devuelve `{ ok: true, panel, servidor, papel }` o `{ ok: false, motivo }`.
 * Nunca devuelve una sección vacía como buena.
 */
export function leerMarcadoresDeclarados(ruta = RUTA_DECLARADOS) {
  let texto;
  try {
    texto = fs.readFileSync(ruta, 'utf8');
  } catch (e) {
    return { ok: false, motivo: `no se puede leer ${ruta}: ${e.code || e.message}` };
  }
  let json;
  try {
    json = JSON.parse(texto);
  } catch (e) {
    return { ok: false, motivo: `${ruta} no es JSON válido: ${e.message}` };
  }
  const secciones = [
    ['panel', 'ficheros', (v) => Number.isInteger(v) && v > 0, 'un entero MAYOR que 0 (una entrada que llega a 0 se BORRA)'],
    ['servidor', 'ficheros', (v) => Number.isInteger(v) && v > 0, 'un entero MAYOR que 0 (una entrada que llega a 0 se BORRA)'],
    ['papel', 'constantes', (v) => typeof v === 'string' && v.trim() !== '', 'la condición en que se imprime, no vacía'],
  ];
  const out = { ok: true };
  for (const [seccion, bloque, valido, debeSer] of secciones) {
    const obj = json?.[seccion]?.[bloque];
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return { ok: false, motivo: `falta \`${seccion}.${bloque}\` en ${ruta}` };
    }
    const entradas = Object.entries(obj);
    if (entradas.length === 0) {
      return { ok: false, motivo: `\`${seccion}.${bloque}\` está VACÍO: eso es «no supe leer», no «no queda ninguno»` };
    }
    for (const [k, v] of entradas) {
      if (!valido(v)) {
        return { ok: false, motivo: `\`${seccion}.${bloque}["${k}"]\` = ${JSON.stringify(v)}: tiene que ser ${debeSer}` };
      }
    }
    out[seccion] = Object.freeze({ ...obj });
  }
  // Las repetidas, contadas sobre el texto: `ficheros` aparece dos veces (panel y servidor), así
  // que se trocea por sección antes de buscar el bloque.
  for (const [seccion, bloque] of secciones) {
    const desde = texto.indexOf(`"${seccion}"`);
    const escritas = desde < 0 ? null : clavesEscritas(texto.slice(desde), bloque);
    if (!escritas) {
      return { ok: false, motivo: `no sé leer el TEXTO de \`${seccion}.${bloque}\` para buscar claves repetidas` };
    }
    const vistas = new Set();
    const repetidas = escritas.filter((k) => (vistas.has(k) ? true : (vistas.add(k), false)));
    if (repetidas.length) {
      return { ok: false, motivo: `\`${seccion}.${bloque}\` repite ${repetidas.map((k) => `"${k}"`).join(', ')}: la última gana en silencio` };
    }
    if (escritas.length !== Object.keys(out[seccion]).length) {
      return { ok: false, motivo: `\`${seccion}.${bloque}\`: ${escritas.length} claves escritas y ${Object.keys(out[seccion]).length} leídas` };
    }
  }
  return out;
}

/** Para los tests: los datos, o un error que nombra el motivo. Nunca una lista vacía. */
export function marcadoresDeclarados(ruta = RUTA_DECLARADOS) {
  const r = leerMarcadoresDeclarados(ruta);
  if (!r.ok) {
    throw new Error(`🔴 SCRUM-1293 · NO SE PUEDE LEER LA LISTA DE MARCADORES DECLARADOS: ${r.motivo}. ` +
      'Sin lista no hay veredicto: los censos de scrum402, scrum667 y scrum650d no pueden decir nada.');
  }
  return r;
}
