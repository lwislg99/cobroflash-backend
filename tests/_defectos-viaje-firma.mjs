// SCRUM-1362 · el cargador de `scripts/_defectos-viaje-firma-declarados.json`.
//
// La lista de defectos del viaje de la firma (SCRUM-1351) vivía DENTRO del test. Quien arreglaba
// un defecto tenía que borrar su línea ahí, y quitarle una entrada a un test se parece a quitar
// una prueba. Mismo camino que SCRUM-1293 con los marcadores: los DATOS fuera, las ASERCIONES
// donde estaban.
//
// 🔴 FALLA CERRADO. «No pude leer la lista» y «no queda ningún defecto» darían el mismo resultado
// —una lista vacía— y con una lista vacía el trinquete llamaría «nuevo» a todo, o peor, a nada.
// Por eso una sección vacía sólo vale si alguien escribió POR QUÉ está vacía.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const RUTA_DEFECTOS = path.join(RAIZ, 'scripts', '_defectos-viaje-firma-declarados.json');

/** Las claves del bloque `"defectos": { ... }` tal como están ESCRITAS (JSON.parse se come las repetidas). */
function clavesEscritas(texto) {
  const m = texto.match(/"defectos"\s*:\s*\{([^{}]*)\}/);
  if (!m) return null;
  return [...m[1].matchAll(/"((?:[^"\\]|\\.)*)"\s*:/g)].map((x) => x[1]);
}

/** Devuelve `{ ok: true, defectos: string[] }` o `{ ok: false, motivo }`. */
export function leerDefectosDeclarados(ruta = RUTA_DEFECTOS) {
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
  const obj = json?.defectos;
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, motivo: `falta \`defectos\` en ${ruta}` };
  }
  const entradas = Object.entries(obj);
  for (const [k, v] of entradas) {
    if (typeof v !== 'string' || v.trim() === '') {
      return { ok: false, motivo: `\`defectos["${k}"]\` tiene que decir dónde vive el defecto y de quién es, no venir vacío` };
    }
  }
  const escritas = clavesEscritas(texto);
  if (!escritas) return { ok: false, motivo: 'no sé leer el TEXTO de `defectos` para buscar claves repetidas' };
  const vistas = new Set();
  const repetidas = escritas.filter((k) => (vistas.has(k) ? true : (vistas.add(k), false)));
  if (repetidas.length) {
    return { ok: false, motivo: `\`defectos\` repite ${repetidas.map((k) => `"${k}"`).join(', ')}: la última gana en silencio` };
  }
  if (escritas.length !== entradas.length) {
    return { ok: false, motivo: `\`defectos\`: ${escritas.length} claves escritas y ${entradas.length} leídas` };
  }
  const motivoVacio = json.vacio_a_proposito;
  const hayMotivo = typeof motivoVacio === 'string' && motivoVacio.trim() !== '';
  if (entradas.length === 0 && !hayMotivo) {
    return { ok: false, motivo: '`defectos` está VACÍO y nadie escribió `vacio_a_proposito`: eso es «no supe leer», no «no queda ninguno»' };
  }
  if (entradas.length > 0 && motivoVacio !== undefined) {
    return { ok: false, motivo: '`vacio_a_proposito` está escrito pero `defectos` NO está vacío: una de las dos cosas sobra' };
  }
  return { ok: true, defectos: Object.freeze(entradas.map(([k]) => k)) };
}

/** Para el test: la lista, o un error que nombra el motivo. */
export function defectosDeclarados(ruta = RUTA_DEFECTOS) {
  const r = leerDefectosDeclarados(ruta);
  if (!r.ok) throw new Error(`🔴 CIEGO · no puedo leer los defectos declarados: ${r.motivo}`);
  return r.defectos;
}
