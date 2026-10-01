// tests/scrum1306-consta-en-alguno.test.mjs — SCRUM-1306
//
// Sin gate: lee ficheros. Ni BD, ni red, ni servidor.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// «¿CONSTA EN ALGUNA FICHA?» NO DISTINGUE UNA FIRMA VIGENTE DE UNA SUPERADA
//
// `constaAprobado(texto)` contesta si el literal está firmado en ALGÚN registro de
// `docs/microcopy/`. El historial no se borra, así que un literal que una firma posterior sustituyó
// sigue constando para siempre. Lo midió J2 con la fusión (SCRUM-1126): volver al `todoPasa` del
// 29-sep no tumbaba el caso que preguntaba «¿consta en alguna ficha de SCRUM-1126?».
//
// Lo que decidió el orquestador (SCRUM-1306, sobre el censo de J5): NO se cambia el helper, que es
// compartido con el equipo de Luis y en 98 fichas hay UNA sola sustitución entre fichas. La regla
// queda escrita en su JSDoc y en `docs/microcopy/README.md`: un texto que se puede volver a firmar
// se comprueba contra su ficha, por ticket Y ranura. Y para que la regla no sea sólo una nota, este
// TRINQUETE: los guards que preguntan de la forma débil no pueden AUMENTAR.
//
// Débil es cualquiera de estas dos formas:
//   · LAXA ········ `constaAprobado(t)` mirado sólo por su longitud: «¿en alguna ficha?».
//   · POR TICKET ·· `constaAprobado(t).some((r) => r.includes('SCRUM-n'))`, o elegir la ficha del
//                   barrido por ticket sin ranura. Falla justo cuando la firma nueva es del mismo
//                   ticket, y `.find` además se queda con la ficha MÁS ANTIGUA.
// Fuerte: la ruta exacta de la ficha (`.includes(FICHA)`) o el ticket Y la ranura.
// No cuentan las negaciones (`deepEqual(constaAprobado(t), [])`): afirmar que algo NO consta no
// se engaña con una firma vieja.
//
// Población: todo `tests/*.test.mjs` que llame al helper, MENOS los tests del propio instrumento,
// que se reconocen solos: importan del helper algo más que `constaAprobado` y
// `aprobacionesDeMicrocopy` (hoy 709, 715, 726 y 861). No hay lista a mano.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_TESTS = path.join(RAIZ, 'tests');
const ESTE = path.basename(fileURLToPath(import.meta.url));

/**
 * Medido el 30-sep-2026 contra `origin/main` = 0e86f5de, con 1154 y 1196 ya pasados a ticket y
 * ranura en este mismo PR: 9 laxos + 6 por ticket. Sólo puede BAJAR.
 */
const TOPE = 15;

// Partido a propósito: escrito entero, este fichero casaría consigo mismo.
const CONSTA = 'constaAprobado' + '(';
const BARRIDO = 'aprobacionesDeMicrocopy' + '(';
const USOS_DE_PRODUCTO = new Set(['constaAprobado', 'aprobacionesDeMicrocopy']);


/** ¿Importa del helper algo más que las dos funciones de producto? Entonces prueba el instrumento. */
export function esDelInstrumento(src) {
  const m = /import\s*\{([^}]*)\}\s*from\s*['"]\.\/_microcopy-aprobada\.mjs['"]/.exec(src);
  if (!m) return false;
  return m[1].split(',').map((s) => s.trim()).filter(Boolean).some((n) => !USOS_DE_PRODUCTO.has(n));
}

/** La sentencia que empieza en `i`: hasta el primer `;` a nivel de línea, con un máximo de 6 líneas. */
function sentencia(codigo, i) {
  const inicio = codigo.lastIndexOf('\n', i) + 1;
  let fin = inicio;
  for (let n = 0; n < 6; n++) {
    const salto = codigo.indexOf('\n', fin);
    if (salto === -1) { fin = codigo.length; break; }
    fin = salto + 1;
    if (/;\s*$/.test(codigo.slice(inicio, salto))) break;
  }
  return codigo.slice(inicio, fin);
}

/** Cómo pregunta una llamada: 'negacion', 'fuerte', 'ticket' o 'laxa'. */
export function formaDe(s, { barrido = false } = {}) {
  if (barrido) {
    if (!/\.(find|filter)\(/.test(s)) return 'fuerte';
    const porTicket = /SCRUM-\d+|\.ticket\b/.test(s);
    const concreta = /\.ranura\b|\.nombre\s*===|\.ruta\s*===/.test(s);
    return porTicket && !concreta ? 'ticket' : 'fuerte';
  }
  if (/deepEqual\(\s*constaAprobado\([\s\S]*?\),\s*\[\s*\]/.test(s)) return 'negacion';
  if (/throws\(\s*\(\)\s*=>\s*constaAprobado/.test(s)) return 'negacion';
  if (/\.includes\(\s*(?!['"`]SCRUM-)[^)]+\)/.test(s) && !/\.includes\(\s*['"`]SCRUM-/.test(s)) return 'fuerte';
  if (/deepEqual\(\s*constaAprobado\([\s\S]*?\),\s*\[\s*['"`]docs\/microcopy\//.test(s)) return 'fuerte';
  if (/SCRUM-\d+/.test(s)) return 'ticket';
  return 'laxa';
}

/** ¿Cae la posición `i` dentro de una cadena de su línea? Una llamada citada en un mensaje no es una llamada. */
function dentroDeCadena(codigo, i) {
  const linea = codigo.slice(codigo.lastIndexOf('\n', i) + 1, i);
  let abierta = null;
  for (let k = 0; k < linea.length; k++) {
    const ch = linea[k];
    if (ch === '\\') { k++; continue; }
    if (abierta) { if (ch === abierta) abierta = null; } else if (ch === "'" || ch === '"' || ch === '`') abierta = ch;
  }
  return abierta !== null;
}

/** Las formas de pregunta de un fichero. */
export function formasDelFichero(src) {
  // Lo que se cuenta es la llamada, no la palabra: los comentarios, en blanco (SCRUM-694).
  const codigo = soloCodigo(src);
  const out = [];
  for (const [aguja, barrido] of [[CONSTA, false], [BARRIDO, true]]) {
    let i = codigo.indexOf(aguja);
    while (i !== -1) {
      const antes = codigo.slice(Math.max(0, i - 9), i);
      if (!/function\s+$/.test(antes) && !dentroDeCadena(codigo, i)) out.push(formaDe(sentencia(codigo, i), { barrido }));
      i = codigo.indexOf(aguja, i + aguja.length);
    }
  }
  return out;
}

/** Los guards de producto con al menos una pregunta débil, con sus formas. */
export function censo() {
  const debiles = [];
  let poblacion = 0;
  let instrumento = 0;
  for (const nombre of fs.readdirSync(DIR_TESTS).sort()) {
    if (!nombre.endsWith('.test.mjs') || nombre === ESTE) continue;
    const src = fs.readFileSync(path.join(DIR_TESTS, nombre), 'utf8');
    const formas = formasDelFichero(src);
    if (formas.length === 0) continue;
    if (esDelInstrumento(src)) { instrumento++; continue; }
    poblacion++;
    const d = formas.filter((f) => f === 'laxa' || f === 'ticket');
    if (d.length) debiles.push({ nombre, laxa: d.filter((f) => f === 'laxa').length, ticket: d.filter((f) => f === 'ticket').length });
  }
  return { debiles, poblacion, instrumento };
}

test('SCRUM-1306 · SUELO: el censo ve la población que existe', () => {
  const { poblacion, instrumento } = censo();
  // 21 guards de producto y 4 del instrumento, medidos a mano el 30-sep-2026. Un número mucho menor
  // significa que el barrido no supo mirar, y entonces el tope de abajo se cumpliría a ciegas.
  assert.ok(poblacion >= 18, `🔴 CIEGO: sólo ${poblacion} guards de producto llaman al helper, y había 21.`);
  assert.ok(instrumento >= 4, `🔴 CIEGO: sólo ${instrumento} tests del instrumento, y había 4 (709, 715, 726, 861).`);
});

test('SCRUM-1306 · 🔴 los guards que preguntan «¿consta en alguna ficha?» NO SUBEN', () => {
  const { debiles } = censo();
  const lista = debiles.map((d) => `     · tests/${d.nombre}  (laxa ${d.laxa} · por ticket ${d.ticket})`).join('\n');
  assert.ok(debiles.length <= TOPE,
    `🔴 HAN APARECIDO GUARDS NUEVOS QUE PREGUNTAN DE LA FORMA DÉBIL: ${debiles.length} (el tope es ${TOPE}).\n\n`
    + `${lista}\n\n`
    + '    «¿Consta en alguna ficha?» sigue diciendo que sí cuando el texto ya se volvió a firmar: el\n'
    + '    historial no se borra. Compruébalo contra SU ficha, por ticket Y ranura, o por la ruta exacta:\n'
    + '        const r = aprobacionesDeMicrocopy().find((a) => a.ticket === T && a.ranura === R);\n'
    + '    La regla está en el JSDoc de `constaAprobado` y en docs/microcopy/README.md (SCRUM-1306).');
  if (debiles.length < TOPE) {
    assert.fail(`✅ han bajado a ${debiles.length}. Baja \`TOPE\` a ese número en este fichero: `
      + 'un trinquete que se queda por encima de lo medido ya viene flojo.\n\n' + lista);
  }
});

test('SCRUM-1306 · CONTROLES: el clasificador distingue las cuatro formas', () => {
  const c = (s) => formasDelFichero(s);
  assert.deepEqual(c("assert.ok(constaAprobado(t).length > 0, 'x');"), ['laxa']);
  assert.deepEqual(c("assert.notDeepEqual(constaAprobado(t), [], 'x');"), ['laxa']);
  assert.deepEqual(c("const s = xs.filter((x) => constaAprobado(x).length === 0);"), ['laxa']);
  assert.deepEqual(c("assert.ok(constaAprobado(t).some((f) => f.includes('SCRUM-1126')), 'x');"), ['ticket']);
  assert.deepEqual(c("const d = constaAprobado(t);\nassert.ok(d.some((r) => /-SCRUM-1257-/.test(r)));"), ['laxa'],
    'la sentencia es la de la llamada: lo que se hace DESPUÉS con el resultado no se ve (límite declarado)');
  assert.deepEqual(c("assert.ok(constaAprobado(t).includes(FICHA), 'x');"), ['fuerte']);
  assert.deepEqual(c("assert.deepEqual(constaAprobado(t), [], 'x');"), ['negacion']);
  assert.deepEqual(c("assert.throws(() => constaAprobado(''), /CIEGO/);"), ['negacion']);
  assert.deepEqual(c("const r = aprobacionesDeMicrocopy().find((a) => a.ruta.includes('SCRUM-1154'));"), ['ticket']);
  assert.deepEqual(c("const r = aprobacionesDeMicrocopy().find((a) => a.ticket === T && a.ranura === R);"), ['fuerte']);
  assert.deepEqual(c('// constaAprobado(t).length > 0 en un comentario'), [], 'un comentario no es una llamada');
  assert.deepEqual(c('export function constaAprobado(texto) {}'), [], 'la definición no es una llamada');
  assert.deepEqual(c("assert.ok(x, 'sin registro, `constaAprobado()` no puede confirmarlo');"), [],
    'una llamada citada dentro de un mensaje no es una llamada (el falso positivo de scrum631)');
  assert.deepEqual(c("assert.ok(y, 'texto'); assert.ok(constaAprobado(t).length > 0);"), ['laxa'],
    'y una cadena CERRADA antes de la llamada no la esconde');
  assert.equal(esDelInstrumento("import { constaAprobado, firmanteDe } from './_microcopy-aprobada.mjs';"), true);
  assert.equal(esDelInstrumento("import { constaAprobado, aprobacionesDeMicrocopy } from './_microcopy-aprobada.mjs';"), false);
});
