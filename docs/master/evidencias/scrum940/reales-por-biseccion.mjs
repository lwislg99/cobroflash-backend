// docs/master/evidencias/scrum940/reales-por-biseccion.mjs — SCRUM-940
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL VALOR REAL DE UN SUELO, MEDIDO EJECUTANDO — Y SIN PARSEAR NINGÚN MENSAJE
//
// Un suelo no publica su población cuando pasa. La primera vía que probé fue elevarlo a un valor
// imposible y leer la cifra del rojo: **no sirve**, porque los mensajes llevan números que no son
// la población (empezando por el `542` de `scrum542-…`, que es parte de la RUTA). Un parseo que
// confunde el nombre del fichero con la medida es exactamente el defecto que esta casa persigue.
//
// Así que se mide por BISECCIÓN: se sube el tope a X y se mira si el test CAE. El mayor X que NO
// cae es la población real. No hay que interpretar nada — sólo el código de salida.
//
//   · caro: ~log2(N) ejecuciones por suelo. Por eso se hace sobre una MUESTRA declarada, no sobre
//     los 495. Lo que no se mide se queda en NO DECIDIBLE, del lado malo.
//
// Cada fichero se restaura byte a byte y se verifica por SHA-256; si algo revienta, el `finally`
// restaura igual y el banco PARA.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { censarSuelos, clasificar } from '../../../../scripts/_censo-de-suelos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const MAG_EV = /\.(length|size|poblacion|total|ficheros|modulos|count|filas|lineas|casos|vistos|mirados)$/;

/** Pone el tope de UN suelo en `valor`, en su línea. Devuelve cómo deshacerlo, o null si es ambiguo. */
function ponerTope(s, valor) {
  const abs = path.join(RAIZ, s.fichero);
  const original = fs.readFileSync(abs);
  const antes = sha(original);
  const lineas = original.toString('utf8').split('\n');
  const i = s.linea - 1;
  // 🔴 Los escapes van dobles A PROPÓSITO, y me costó una medición entera: escribí este fichero
  // con un heredoc y `'\\b'` llegó al disco como `'\b'`, que en JavaScript es el carácter
  // BACKSPACE — no un límite de palabra. El regex no casaba NUNCA, y seis suelos de once salieron
  // «no decidible» por un fallo mío, no por el árbol. Lo destapó que la línea contuviera
  // `SUELO_GUARDS` a la vista y el contador dijera cero.
  const re = s.tope === null
    ? new RegExp('(?<![\\w.])' + s.declarado + '(?![\\w.])', 'g')
    : new RegExp('\\b' + s.tope + '\\b', 'g');
  if ((lineas[i].match(re) || []).length !== 1) return null;
  lineas[i] = lineas[i].replace(re, String(valor));
  fs.writeFileSync(abs, lineas.join('\n'));
  return { restaurar: () => { fs.writeFileSync(abs, original); return sha(fs.readFileSync(abs)) === antes; } };
}

/** ¿Cae el fichero con el tope puesto en `valor`? */
function caeCon(s, valor) {
  const m = ponerTope(s, valor);
  if (!m) return null;
  try {
    const r = spawnSync(process.execPath, ['--test', '--test-force-exit', path.join(RAIZ, s.fichero)],
      { encoding: 'utf8', cwd: RAIZ, timeout: 180000 });
    return r.status !== 0;
  } finally {
    if (!m.restaurar()) { console.log('🔴 NO SE RESTAURÓ ' + s.fichero + ' — PARANDO'); process.exit(2); }
  }
}

/**
 * La población real: el mayor tope que TODAVÍA no dispara. Se acota primero por arriba doblando,
 * y luego se biseca. `tope` se prueba siempre por encima del declarado, así que un suelo que ya
 * esté rojo se detecta en la primera llamada.
 */
function realDe(s) {
  if (caeCon(s, s.declarado) === true) return { real: null, motivo: 'ya está en rojo con su propio valor: no es medible así' };
  let alto = Math.max(2, s.declarado * 2);
  let vueltas = 0;
  while (caeCon(s, alto) === false && vueltas < 14) { alto *= 2; vueltas++; }
  if (vueltas >= 14) return { real: null, motivo: 'no cae ni doblando catorce veces: el suelo no gobierna esa comparación' };
  let bajo = s.declarado;                 // no cae
  while (alto - bajo > 1) {
    const medio = Math.floor((bajo + alto) / 2);
    const cae = caeCon(s, medio);
    if (cae === null) return { real: null, motivo: 'no se pudo sustituir sin ambigüedad' };
    if (cae) alto = medio; else bajo = medio;
  }
  return { real: bajo, motivo: null };    // el mayor que NO dispara == la población de hoy
}

const censo = censarSuelos(RAIZ);
const sujeto = censo.conMinimoConcreto.filter((s) => MAG_EV.test(s.magnitud) || s.porNombre);
if (!sujeto.length) { console.log('🔴 CIEGO: cero suelos de población censada.'); process.exit(3); }

// La MUESTRA, y cómo se eligió: los dos casos conocidos (control positivo) más uno por cada
// tramo de tamaño, para no mirar sólo los extremos.
const porFichero = new Map();
for (const s of sujeto) if (!porFichero.has(s.fichero + ':' + s.linea)) porFichero.set(s.fichero + ':' + s.linea, s);
const todos = [...porFichero.values()];
const conocidos = todos.filter((s) => /^SUELO_(GUARDS|DECLARACIONES)$/.test(s.tope || ''));
const tramo = (s) => (s.declarado <= 5 ? 'a' : s.declarado <= 20 ? 'b' : s.declarado <= 100 ? 'c' : 'd');
const porTramo = new Map();
for (const s of todos) {
  if (conocidos.includes(s)) continue;
  const k = tramo(s);
  if (!porTramo.has(k)) porTramo.set(k, []);
  if (porTramo.get(k).length < 2) porTramo.get(k).push(s);
}
const MUESTRA = [...conocidos, ...[...porTramo.values()].flat()];

console.log('SUJETO: ' + sujeto.length + ' suelos de población censada · MUESTRA medida: ' + MUESTRA.length);
console.log('');
console.log('decl   real   cociente  clase         dónde');
console.log('-'.repeat(96));
const filas = [];
for (const s of MUESTRA) {
  const { real, motivo } = realDe(s);
  const clase = clasificar(s.declarado, real, s.magnitudDeListaFija);
  filas.push({ ...s, real, clase, motivo });
  const coc = real ? (s.declarado / real).toFixed(2) : '—';
  console.log(String(s.declarado).padStart(5) + '  ' + String(real ?? '—').padStart(5) + '  '
    + coc.padStart(8) + '  ' + clase.padEnd(13) + s.fichero + ':' + s.linea + (motivo ? '  · ' + motivo : ''));
}
fs.writeFileSync(new URL('./reales.json', import.meta.url), JSON.stringify(filas, null, 1) + '\n');
console.log('');
const cuenta = (c) => filas.filter((f) => f.clase === c).length;
console.log('EN LA MUESTRA: VIVO ' + cuenta('VIVO') + ' · MUERTO ' + cuenta('MUERTO')
  + ' · AJUSTADO ' + cuenta('AJUSTADO') + ' · NO_DECIDIBLE ' + cuenta('NO_DECIDIBLE'));
