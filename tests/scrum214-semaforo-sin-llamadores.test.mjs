// SCRUM-214 · NADIE LLAMA AL SEMÁFORO TODAVÍA — y eso deja de ser un acuerdo para ser un guard.
//
// POR QUÉ EXISTE
//
// `semaforoFiscal.js` (SCRUM-210) se sirve a TODO merchant real: está en el <script> de
// index.html, con su catálogo de avisos y su copy aprobado dentro del bundle. Hoy no puede verlo
// nadie por tres razones, y las tres son frágiles de distinta manera:
//   ① nadie lo llama · ② `fetchSemaforo` devuelve 'verde' fijo · ③ en verde no se pinta nada.
//
// La ① es la única que protege de verdad, y es una PROHIBICIÓN SIN MECANISMO: se evapora en
// cuanto alguien cablee una vista. Y cablearla antes de SCRUM-207 no es un bug cosmético — es un
// ámbar de mentira delante de un profesional, con `avisoVersion: 0`, que NO es una versión del
// catálogo real, quedando escrita en AuditLog como prueba de lo que aceptó.
//
// Se eligió guard y no flag a propósito: un flag hay que acordarse de retirarlo el día del
// cableado, y lo que no se retira se queda apagado o se enciende sin querer. Este guard, en
// cambio, EXIGE que quien cablee toque este fichero — y al tocarlo lee por qué no debía.
//
// ⚠️ AST, NO `grep`. Un guard de texto se caza a sí mismo en el comentario que explica la
// prohibición: este fichero está lleno de las palabras que vigila (`pintarSemaforo`,
// `renderAmbar`…) y con `grep` saldría rojo contra su propia prosa. Es el fallo de SCRUM-176 y
// SCRUM-168, y el motivo de que exista `_guard-texto.mjs`. El árbol solo ve identificadores: un
// nombre dentro de un comentario no es un nodo. La prueba de que esto es así está abajo, en el
// test «un nombre en un COMENTARIO no cuenta».
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const DIR_JS = path.join(RAIZ, 'public', 'dashboard', 'js');
const MODULO = 'semaforoFiscal.js';

/**
 * Los cinco símbolos que pueden PONER UN AVISO EN PANTALLA o alimentarlo.
 * Se dejan fuera a propósito `buildAvisoPayload`, `avisoPlazoVencido` y `renderVerde`: ninguno
 * pinta nada por sí solo, y vigilarlos daría rojos que no protegen de nada.
 */
const VIGILADOS = new Set([
  'pintarSemaforo',
  'fetchSemaforo',
  'renderAmbar',
  'renderRojo',
  'SEMAFORO_AVISOS',
]);

/**
 * ALLOWLIST — visible y con motivo, nunca silenciosa.
 *  · `semaforoFiscal.js` es quien los DEFINE; excluirlo no es una excepción, es el sujeto.
 *  · `index.html` no se analiza aquí porque no es JS: se comprueba aparte, en su propio test,
 *    que solo CARGA el fichero y no lo invoca en línea.
 *  · Este test lee el módulo como TEXTO y no lo ejecuta; vive en `tests/`, fuera del barrido.
 */
const ALLOWLIST = new Set([MODULO]);

/** Todos los identificadores del fuente que casan con los vigilados. AST, no texto. */
function llamadoresEn(codigo, ruta) {
  const sf = ts.createSourceFile(ruta, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const hallazgos = [];
  const visitar = (n) => {
    // Un Identifier es un NODO del árbol. Lo que hay dentro de un comentario no lo es — por eso
    // este guard no se caza a sí mismo aunque su propia prosa esté llena de estos nombres.
    if (ts.isIdentifier(n) && VIGILADOS.has(n.text)) {
      hallazgos.push({
        simbolo: n.text,
        linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
      });
    }
    ts.forEachChild(n, visitar);
  };
  ts.forEachChild(sf, visitar);
  return hallazgos;
}

function barrerDashboard() {
  return fs.readdirSync(DIR_JS)
    .filter((f) => f.endsWith('.js') && !ALLOWLIST.has(f))
    .flatMap((f) => llamadoresEn(fs.readFileSync(path.join(DIR_JS, f), 'utf8'), f)
      .map((h) => ({ ...h, fichero: f })));
}

// ── 1 · SUELO: que el analizador VEA ─────────────────────────────────────────────────────
// Sin esto, el día que el módulo se renombre o el parser se atragante, el barrido devolvería 0
// y el guard pasaría en VERDE sin haber mirado nada. Un verde hueco es peor que un rojo.
test('SCRUM-214 · el analizador ve los símbolos donde SÍ están (suelo anti-verde-hueco)', () => {
  const propios = llamadoresEn(fs.readFileSync(path.join(DIR_JS, MODULO), 'utf8'), MODULO);
  const vistos = new Set(propios.map((h) => h.simbolo));
  assert.deepEqual([...vistos].sort(), [...VIGILADOS].sort(),
    '🔴 el analizador no encuentra los 5 símbolos en su propio módulo: está ciego, no limpio');
});

// ── 2 · LA PRUEBA DE QUE ESTO ES AST Y NO grep ───────────────────────────────────────────
test('SCRUM-214 · un nombre en un COMENTARIO no cuenta como llamador', () => {
  const conComentario = [
    '// aquí se explica que no se debe llamar a pintarSemaforo ni a renderAmbar',
    '/* SEMAFORO_AVISOS tampoco se toca, ni fetchSemaforo, ni renderRojo */',
    'const x = 1;',
  ].join('\n');
  assert.deepEqual(llamadoresEn(conComentario, 'ficticio.js'), [],
    '🔴 el guard está mirando TEXTO: cazaría su propia prosa y sería inmantenible');

  // Y el contraste: el MISMO nombre, esta vez como código, sí se ve.
  assert.equal(llamadoresEn('window.pintarSemaforo(a, b, c);', 'ficticio.js').length, 1);
});

// ── 3 · EL GUARD ─────────────────────────────────────────────────────────────────────────
test('SCRUM-214 · ninguna vista del dashboard llama al semáforo', () => {
  const hallazgos = barrerDashboard();
  const detalle = hallazgos.map((h) => `${h.fichero}:${h.linea} → ${h.simbolo}`).join('\n   ');
  assert.deepEqual(
    hallazgos, [],
    '🔴 alguien cableó el semáforo antes de que exista el catálogo de avisos (SCRUM-207):\n   '
    + detalle
    + '\n\n   Hasta que SCRUM-207 publique el catálogo, `avisoVersion: 0` NO es una versión real.'
    + '\n   Un ámbar pintado hoy le enseña al profesional un aviso de mentira y deja en AuditLog'
    + '\n   una aceptación contra una versión que nunca existió.'
    + '\n   Si vienes de cablearlo DE VERDAD: retira el símbolo de VIGILADOS en este fichero,'
    + '\n   con el ticket que lo autoriza al lado.',
  );
});

// ── 4 · index.html: que siga solo CARGANDO ───────────────────────────────────────────────
// No es JS, así que queda fuera del barrido del árbol. Se comprueba aquí para que la allowlist
// sea explícita y no un hueco silencioso: el <script src> es legítimo, una llamada en línea no.
test('SCRUM-214 · index.html carga el módulo pero no lo invoca', () => {
  const html = fs.readFileSync(path.join(RAIZ, 'public', 'dashboard', 'index.html'), 'utf8');
  assert.match(html, /<script src="\.\/js\/semaforoFiscal\.js"><\/script>/,
    'el módulo debe seguir sirviéndose; si se retiró, este guard sobra');

  // Solo el contenido de los <script> EN LÍNEA, que es donde cabría una llamada. El atributo
  // `src` no se analiza: cargar no es invocar.
  const enLinea = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1]).join('\n');
  assert.deepEqual(llamadoresEn(enLinea, 'index.html (inline)'), [],
    '🔴 hay una llamada al semáforo en un <script> en línea de index.html');
});
