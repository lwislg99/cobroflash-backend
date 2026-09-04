// tests/_cifras-sin-ancla.mjs — SCRUM-737 · «un número necesita su unidad, su ÁRBOL y su HORA»
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA VÍCTIMA, Y ES DE HOY: S3 escribió siete cifras y a los 90 minutos seis ya eran otras.
//
// Un número escrito en un comentario **no tiene fecha de caducidad visible**, y quien lo lee no
// sabe que ya no vale. Es la misma familia que SCRUM-498 («el 21 se cuenta; la prosa que lo
// escribe, se ata») y SCRUM-680 («una frase sin número no se desincroniza»), una capa más abajo:
// allí se ataba UNA población concreta; aquí se CENSA quién más tiene el mismo problema.
//
// ── QUÉ CUENTA ESTE INSTRUMENTO, dicho antes del número (lección de SCRUM-714) ────────────
//
// **NO** cuenta «toda cifra que aparece en un comentario». Eso son 312 en 171 ficheros y la
// inmensa mayoría son legítimas: `«Caso 2:»`, `«las 4 rutas»`, `«21% IVA»`, `«3 merchants del
// mismo test»`. Ninguna caduca, porque ninguna afirma un estado del árbol.
//
// Cuenta **las afirmaciones de RECUENTO DEL ÁRBOL EN UN MOMENTO**: las que dicen cuántos hay
// *hoy*, cuántos *se midieron*, cuántos pasan en la *suite*. Ésas envejecen solas y en silencio.
//
// ── POR QUÉ NO ES UN BARRIDO DE TEXTO ────────────────────────────────────────────────────
//
// Los comentarios se obtienen **del motor de SCRUM-693/696** (`soloCodigo`), que tokeniza con el
// scanner de TypeScript: `'http://x'` dentro de una cadena NO es comentario, y una cadena dentro
// de un comentario SÍ lo es. Aquí no se reimplementa nada — se **deriva**: lo que aquel módulo
// blanquea es, por definición, lo que hay que mirar. Si mañana mejora, esto mejora con él, y no
// pueden divergir.
//
// ⚠️ LÍMITE HEREDADO, MEDIDO Y DECLARADO: `soloCodigo` pierde código real ante un literal de
// expresión regular con dos barras pegadas (`!/^https?:\/\//i.test(v)`) — el mismo caso que su
// cabecera dice haber arreglado, citando una línea que ya no existe. **Medido: CERO ficheros del
// árbol lo disparan hoy**, así que no afecta a este censo. Es un fallo latente, no activo, y va
// reportado como hallazgo de otro carril (regla 9).
// ═════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { soloCodigo } from './_solo-codigo.mjs';

/** La población, DECLARADA: dónde se busca y con qué extensión. */
export const POBLACION = [
  { dir: 'tests', ext: '.mjs' },
  { dir: 'scripts', ext: '.mjs' },
];

/**
 * Los COMENTARIOS de un fuente, derivados de `soloCodigo`: lo que él blanquea es comentario.
 * Se conservan las posiciones (y los saltos), así que el número de línea sigue siendo el real.
 */
export function soloComentarios(fuente, nombre = 'x.js') {
  const cod = soloCodigo(fuente, nombre);
  let out = '';
  for (let i = 0; i < fuente.length; i++) {
    const c = fuente[i];
    if (c === '\n') { out += '\n'; continue; }
    out += (cod[i] === ' ' && c !== ' ') ? c : ' ';
  }
  return out;
}

/** Unidades que convierten un número en un recuento de algo del árbol. */
const UNIDAD = 'pass|fail|tests?|marcas?|ficheros?|ocurrencias?|columnas?|tablas?|casos?'
  + '|merchants?|filas?|modelos?|guards?|entradas?|usos?|superficies?|apariciones?|sitios?'
  + '|rutas?|llamadas?|viajes?|consultas?|saltados?|verdes?|rojos?|citas?';

/** Lo que convierte el recuento en una foto de UN MOMENTO — y por tanto en algo que caduca. */
const MOMENTO = /\b(hoy|medid[oa]s?|censad[oa]s?|censo|actualmente|ahora mismo|suite|de sus|de los|de las)\b/i;

/** Un número YA anclado: lleva fecha visible o sha. No es el defecto (criterio de SCRUM-498). */
export function llevaAncla(texto) {
  return /\b\d{1,2}[-/](?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[-/]\d{2,4}\b/i.test(texto)
    || /\b[0-9a-f]{40}\b/.test(texto)
    || /\b\d{4}-\d{2}-\d{2}\b/.test(texto);
}

/** Trozos que NO son cifras de recuento: identificadores, fechas, versiones, líneas, %. */
function limpiarRuido(t) {
  return t
    .replace(/SCRUM-\d+/gi, ' ')
    .replace(/#\d+/g, ' ')
    .replace(/\bv\d+(?:\.\d+)*/gi, ' ')
    .replace(/\b(?:19|20)\d{2}\b/g, ' ')
    .replace(/:\d+\b/g, ' ')
    .replace(/\b[A-Z]{1,3}\d+(?:\.\d+)*/g, ' ')
    .replace(/\b\d+\s*%/g, ' ')
    .replace(/\b\d+\s*(?:€|ms|s|h|px|KB|MB)\b/gi, ' ');
}

/** Las cifras de recuento SIN ancla de un fuente. */
export function cifrasSinAncla(rel, fuente) {
  const com = soloComentarios(fuente, rel);
  const out = [];
  const lineas = com.split('\n');
  for (let i = 0; i < lineas.length; i++) {
    const txt = lineas[i].trim();
    if (!txt) continue;
    if (!MOMENTO.test(txt)) continue;      // no afirma un momento → no caduca
    if (llevaAncla(txt)) continue;         // ya está anclada → no es el defecto
    const limpio = limpiarRuido(txt);
    const re = new RegExp(`\\b(\\d+)\\s+(?:${UNIDAD})\\b|\\b(?:${UNIDAD})\\s*[:=]\\s*(\\d+)\\b`, 'gi');
    let m;
    while ((m = re.exec(limpio)) !== null) {
      const cifra = m[1] ?? m[2];
      if (cifra === undefined || Number(cifra) < 2) continue;
      out.push({ fichero: rel, linea: i + 1, cifra: Number(cifra), frase: txt.slice(0, 120) });
    }
  }
  return out;
}

/** Recorre la población declarada. */
export function censo(raiz) {
  const out = [];
  for (const { dir, ext } of POBLACION) {
    const abs = path.join(raiz, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs)) {
      if (!f.endsWith(ext)) continue;
      const rel = `${dir}/${f}`;
      out.push(...cifrasSinAncla(rel, fs.readFileSync(path.join(abs, f), 'utf8')));
    }
  }
  return out;
}

/** Cuántos ficheros se leyeron — para que un cero pueda distinguirse de un barrido ciego. */
export function tamanoPoblacion(raiz) {
  let n = 0;
  for (const { dir, ext } of POBLACION) {
    const abs = path.join(raiz, dir);
    if (fs.existsSync(abs)) n += fs.readdirSync(abs).filter((f) => f.endsWith(ext)).length;
  }
  return n;
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// AUTOPRUEBA — sobre fuente sintética, antes de creerse ningún número del árbol
// ═════════════════════════════════════════════════════════════════════════════════════════
export const CEBO = [
  'const url = "http://ejemplo.com/25";        // 25 marcas hoy en el censo',
  '// el 4-sep-2026 el censo veía 99 ficheros',
  '/* de sus 23 llamadas, ninguna mira lo que devuelve */',
  '// Caso 2: el cliente escribe',
  '// las 4 rutas de webhook',
  'const n = 42; // sin unidad ni momento',
].join('\n');

/** Lo que el cebo DEBE producir: sólo las dos que afirman un recuento del árbol sin fecha. */
export const CEBO_ESPERADO = [
  { linea: 1, cifra: 25 },
  { linea: 3, cifra: 23 },
];
