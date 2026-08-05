// SCRUM-284 (B1) · LA PANTALLA COLOCA DESDE EL MAPA, no desde una copia escrita a mano.
//
// ── POR QUÉ ESTE GUARD, Y NO BASTA CON EL DE ASIGNACIÓN ──────────────────────────────────────
// El guard de asignación (`scrum284-asignacion-submenus`) comprueba que el MAPA está sano en sus
// cuatro sentidos. Y eso es correcto y no basta: **un mapa sano del que la pantalla no lee es un
// mapa que no describe nada**. Mientras el mapa vivió solo en `tests/`, su verde no decía una sola
// cosa sobre lo que el profesional ve — bastaba con colocar un campo en otro sitio dentro de
// `settingsView.js` para que las dos versiones divergieran en silencio.
//
// Es el mismo defecto del ticket una vuelta más: dos fuentes que empiezan de acuerdo y se separan
// sin que nadie lo note. Por eso el mapa se mudó a `public/dashboard/js/settingsSubmenus.js` — el
// fichero que la pantalla CARGA — y por eso hace falta este guard, que comprueba la otra mitad:
// que la colocación pasa por el mapa y no puede escribirse a mano.
//
// ── EL MECANISMO ─────────────────────────────────────────────────────────────────────────────
// AST sobre `settingsView.js` (no `grep`: un `grep` cazaría estas mismas palabras en el comentario
// que explica la prohibición — le ha pasado cinco veces a esta casa). Se deriva:
//   · toda llamada a `colocar('clave', …)` y su clave literal
//   · si aparece alguna clave de submenú ESCRITA A MANO en la vista
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { censarConfiguracion } from './_censo-configuracion.mjs';
import mapa from '../public/dashboard/js/settingsSubmenus.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const VISTA = path.join(RAIZ, 'public/dashboard/js/settingsView.js');
const codigo = fs.readFileSync(VISTA, 'utf8');

const CLAVES_CENSO = censarConfiguracion(codigo, 'settingsView.js').campos.map((c) => c.clave);

/** Deriva del árbol las claves colocadas y las claves de submenú escritas como literal. */
function censarColocacion(fuente) {
  const sf = ts.createSourceFile('settingsView.js', fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const colocadas = [];
  const superficies = [];
  const submenusLiterales = [];
  const noLiteral = [];
  const L = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

  (function ver(n) {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)
        && (n.expression.text === 'colocar' || n.expression.text === 'panelDeSuperficie')) {
      const a0 = n.arguments[0];
      const destino = n.expression.text === 'colocar' ? colocadas : superficies;
      if (a0 && ts.isStringLiteralLike(a0)) destino.push(a0.text);
      else noLiteral.push(`L${L(n)}: ${n.getText().slice(0, 60)}`);
    }
    // (a) una clave de submenú escrita como cadena…
    if (ts.isStringLiteralLike(n) && mapa.SUBMENUS.includes(n.text)) {
      submenusLiterales.push(`«${n.text}» literal (L${L(n)})`);
    }
    // (b) …y `paneles.cobro`, que es la MISMA colocación a mano sin ser un literal. Sin este caso
    // el guard sería ciego a la forma más cómoda de saltarse el mapa, que es justo la que se
    // escribe sin pensar. Aquí ya mordió una vez: el bloque de Connect entró así.
    if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'paneles'
        && mapa.SUBMENUS.includes(n.name.text)) {
      submenusLiterales.push(`paneles.${n.name.text} (L${L(n)})`);
    }
    ts.forEachChild(n, ver);
  })(sf);

  return { colocadas, superficies, submenusLiterales, noLiteral };
}

const CENSO = censarColocacion(codigo);

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-284 · SUELO: el escáner ve las colocaciones', () => {
  assert.ok(CENSO.colocadas.length >= 18,
    `🔴 ESCÁNER CIEGO: solo veo ${CENSO.colocadas.length} llamadas a colocar() (esperaba ≥18). ` +
    'Con cero, todo lo de abajo pasaría en vacío.');
  assert.deepEqual(CENSO.noLiteral, [],
    '🔴 hay colocaciones cuya clave no es un literal, así que el guard NO puede leerlas y quedarían ' +
    'fuera de toda comprobación:\n   · ' + CENSO.noLiteral.join('\n   · '));
});

// ── EL GUARD ─────────────────────────────────────────────────────────────────────────────────
test('SCRUM-284 · todo campo del censo se COLOCA, o lo coloca SU superficie en el mismo submenú', () => {
  // Un campo puede llegar a pantalla de dos formas legítimas: colocado él mismo, o pintado por una
  // superficie que sí está colocada. Los `pp-*`/`qr-*` son del segundo tipo — no son ajustes
  // sueltos, son controles DE la tarjeta de la página pública.
  //
  // ⚠️ Y AQUÍ ESTÁ EL CRUCE ENTRE LAS DOS POBLACIONES: no basta con que la superficie esté colocada
  // en algún sitio; tiene que estarlo en EL MISMO submenú que dice el mapa para esos campos. Si no,
  // el mapa diría `publica` y la pantalla los enseñaría en otro panel, con los dos guards en verde.
  const superficiesColocadas = new Set(CENSO.superficies);
  const submenusCubiertosPorSuperficie = new Set(
    [...superficiesColocadas].map((s) => mapa.ASIGNACION_SUPERFICIE[s]).filter(Boolean),
  );

  const enMapa = CLAVES_CENSO.filter((c) => c in mapa.ASIGNACION_SUBMENU);
  const sinColocar = enMapa.filter((c) =>
    !CENSO.colocadas.includes(c) && !submenusCubiertosPorSuperficie.has(mapa.ASIGNACION_SUBMENU[c]));

  assert.deepEqual(sinColocar, [],
    '🔴 estos campos están asignados a un submenú en el mapa pero la pantalla NO los pinta en ' +
    'ninguno —ni por sí mismos ni por una superficie colocada en ese submenú—: existen en el ' +
    'código y no se ven. Es el fallo mudo del ticket, con el mapa sano y la pantalla no:\n   · ' +
    sinColocar.join('\n   · '));
});

test('SCRUM-284 · toda superficie colocada existe en el mapa de superficies', () => {
  const desconocidas = CENSO.superficies.filter((s) => !(s in mapa.ASIGNACION_SUPERFICIE));
  assert.deepEqual(desconocidas, [],
    '🔴 la vista coloca superficies que el mapa no conoce:\n   · ' + desconocidas.join('\n   · '));
  // Suelo: si dejara de ver superficies, el cruce de arriba se volvería vacuo.
  assert.ok(CENSO.superficies.length >= 3,
    `🔴 ESCÁNER CIEGO: solo veo ${CENSO.superficies.length} superficies colocadas (esperaba ≥3).`);
});

test('SCRUM-284 · la vista NO escribe ninguna clave de submenú a mano', () => {
  assert.deepEqual(CENSO.submenusLiterales, [],
    '🔴 la vista escribe claves de submenú como literal. Eso es una SEGUNDA copia del mapa: el día ' +
    'que el mapa cambie, la pantalla seguirá colocando donde decía la copia, y el guard de ' +
    'asignación seguirá verde porque él mira el mapa. Coloca con `colocar(clave, bloque)`:\n   · ' +
    CENSO.submenusLiterales.join('\n   · '));
});

test('SCRUM-284 · colocar un campo que el mapa no conoce LANZA (ruidoso, no mudo)', () => {
  assert.throws(() => mapa.submenuDeCampo('campoQueNadieHaColocado'), /sin submenú en el mapa/,
    '🔴 un campo desconocido se colocaría «donde caiga» en vez de fallar. Caer en el sitio ' +
    'equivocado es mudo; fallar se oye.');
  // Control positivo del mismo mecanismo: uno que SÍ está devuelve su submenú.
  assert.equal(mapa.submenuDeCampo('iban'), 'cobro');
});

// ── MICROCOPY (regla 30) ─────────────────────────────────────────────────────────────────────
test('SCRUM-284 · los rótulos de los diez submenús son el marcador, no texto inventado', () => {
  assert.equal(mapa.MARCA_MICROCOPY_SUBMENU, '[PENDIENTE microcopy oficial]');
  // El botón de cada pestaña se pinta con el marcador; que no haya diez rótulos escritos a mano se
  // deriva de que la vista no contiene ninguna cadena que parezca el nombre de un submenú.
  const sf = ts.createSourceFile('v.js', codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const sospechosos = [];
  (function ver(n) {
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isPropertyAccessExpression(n.left) && n.left.name.text === 'textContent'
        && ts.isIdentifier(n.left.expression) && n.left.expression.text === 'b'
        && !(ts.isIdentifier(n.right) && n.right.text === 'MARCA_MICROCOPY_SUBMENU')) {
      sospechosos.push(n.getText().slice(0, 70));
    }
    ts.forEachChild(n, ver);
  })(sf);
  assert.deepEqual(sospechosos, [],
    '🔴 el rótulo de una pestaña de submenú no sale del marcador. Los diez nombres son microcopy ' +
    'sin aprobar (regla 30):\n   · ' + sospechosos.join('\n   · '));
});

// ── INYECCIONES ──────────────────────────────────────────────────────────────────────────────
test('SCRUM-284 · INYECCIÓN: colocar a mano en un panel hace caer el guard', () => {
  const inyectado = codigo.replace('colocar("iban", fIban.wrapper);', 'paneles["cobro"].appendChild(fIban.wrapper);');
  assert.notEqual(inyectado, codigo, '🔴 la inyección no encontró la colocación del IBAN.');
  const c = censarColocacion(inyectado);
  assert.ok(!c.colocadas.includes('iban'), '🔴 el censo sigue viendo `iban` como colocado por el mapa.');
  assert.ok(c.submenusLiterales.length >= 1, '🔴 el guard no ve la clave de submenú escrita a mano.');
});

test('SCRUM-284 · INYECCIÓN: dejar un campo sin colocar hace caer el guard', () => {
  const inyectado = codigo.replace('colocar("approvalThreshold", fApproval.wrapper);', '');
  assert.notEqual(inyectado, codigo, '🔴 la inyección no encontró la colocación de approvalThreshold.');
  const c = censarColocacion(inyectado);
  assert.ok(!c.colocadas.includes('approvalThreshold'),
    '🔴 el guard seguiría dando por colocado un campo que ya no se pinta en ningún sitio.');
});
