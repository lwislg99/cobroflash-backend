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
//
// Los diez rótulos están APROBADOS por el fundador (5-ago-2026). No eran redacción nueva: los nueve
// primeros vienen escritos en la descripción del ticket y el décimo es el nombre que usó al colocar
// `approvalThreshold`. Aterrizarlos no fue escribir microcopy, fue dejar de usar el marcador.
//
// El guard cambia de forma en consecuencia: ya no exige el marcador —eso solo impedía INVENTAR
// mientras no había texto—, sino que **fija el texto aprobado carácter a carácter**, que es lo que
// impide CAMBIARLO sin pasar por el fundador. Es lo mismo que se hizo en SCRUM-344 al aprobarse las
// cinco ranuras del aviso de cierre.
const ROTULOS_APROBADOS = {
  empresa: 'Empresa',
  facturacion: 'Facturación',
  numeracion: 'Numeración',
  cobro: 'Cobros',
  avisos: 'Avisos',
  publica: 'Tu página pública',
  marca: 'Marca',
  datos: 'Tus datos',
  cumplimiento: 'Cumplimiento',
  equipo: 'Equipo',
};

test('SCRUM-284 · los diez rótulos dicen EXACTAMENTE el texto aprobado (regla 30)', () => {
  assert.deepEqual([...mapa.SUBMENUS].sort(), Object.keys(ROTULOS_APROBADOS).sort(),
    '🔴 el juego de submenús no es el que tiene rótulo aprobado: uno sin rótulo no lo vigila nadie.');
  const distintos = mapa.SUBMENUS
    .filter((s) => mapa.ROTULOS[s] !== ROTULOS_APROBADOS[s])
    .map((s) => `${s}: es «${mapa.ROTULOS[s]}», debía «${ROTULOS_APROBADOS[s]}»`);
  assert.deepEqual(distintos, [],
    '🔴 un rótulo cambió respecto al APROBADO por el fundador. El texto lo aprueba él, también al ' +
    'cambiarlo: si el cambio es deliberado, actualiza este test en el mismo commit y que se vea en ' +
    'el diff:\n   · ' + distintos.join('\n   · '));
});

test('SCRUM-284 · la vista pinta el rótulo DESDE el mapa, no escrito a mano', () => {
  const sf = ts.createSourceFile('v.js', codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const sospechosos = [];
  (function ver(n) {
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isPropertyAccessExpression(n.left) && n.left.name.text === 'textContent'
        && ts.isIdentifier(n.left.expression) && n.left.expression.text === 'b'
        && !(ts.isCallExpression(n.right) && ts.isIdentifier(n.right.expression)
             && n.right.expression.text === 'rotuloDeSubmenu')) {
      sospechosos.push(n.getText().slice(0, 70));
    }
    ts.forEachChild(n, ver);
  })(sf);
  assert.deepEqual(sospechosos, [],
    '🔴 el rótulo de una pestaña no sale de `rotuloDeSubmenu`. Escribirlo a mano sería una segunda ' +
    'copia del texto aprobado:\n   · ' + sospechosos.join('\n   · '));
  // Y el mecanismo falla ruidoso si falta un rótulo, igual que con los campos.
  assert.throws(() => mapa.rotuloDeSubmenu('submenuInventado'), /sin rótulo/);
  assert.equal(mapa.rotuloDeSubmenu('cobro'), 'Cobros');
});

test('SCRUM-284 · el estado vacío SIGUE con el marcador: eso sí es redacción nueva', () => {
  // Los rótulos se aprobaron porque ya estaban escritos en el ticket. El texto de «aquí todavía no
  // hay nada» NO está en ninguna parte, así que es microcopy nueva y sigue sin aprobar.
  assert.equal(mapa.MARCA_MICROCOPY_SUBMENU, '[PENDIENTE microcopy oficial]');
  assert.match(codigo, /empty-state-title[^]{0,40}MARCA_MICROCOPY_SUBMENU/,
    '🔴 el estado vacío de un submenú ya no usa el marcador. Ese texto no lo ha aprobado nadie.');
});

test('SCRUM-284 · toda colocación PROVISIONAL declara su motivo Y qué la sustituye', () => {
  // «Temporal» es exactamente como se quedan las cosas. Una colocación provisional sin fecha de
  // caducidad escrita es una permanente que todavía no lo sabe.
  const entradas = Object.entries(mapa.SUPERFICIES_PROVISIONALES);
  assert.ok(entradas.length >= 2,
    `🔴 solo veo ${entradas.length} provisionales (esperaba ≥2: «Invita y gana» y el hueco de datos ` +
    'de ejemplo). Si alguna ya encontró su sitio, quita también su colocación provisional.');
  const flojas = entradas.filter(([, d]) =>
    !d || typeof d.motivo !== 'string' || d.motivo.trim().length < 40
       || typeof d.sustituye !== 'string' || d.sustituye.trim().length < 10
       || !Array.isArray(d.seMontaCon) || d.seMontaCon.length === 0);
  assert.deepEqual(flojas.map(([k]) => k), [],
    '🔴 estas provisionales no declaran motivo, sustituto o cómo se montan:\n   · ' +
    flojas.map(([k]) => k).join('\n   · '));
});

test('SCRUM-284 · LA OTRA MITAD: toda provisional se sigue MONTANDO de verdad', () => {
  // Declarada y no pintada sería la regresión que la declaración existe para impedir. Se comprueba
  // por AST —no por substring— que cada identificador declarado en `seMontaCon` se USA en la vista:
  // un `grep` casaría con el comentario que explica la regla, que a esta casa le ha mordido cinco veces.
  const sf = ts.createSourceFile('v.js', codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const usados = new Set();
  (function ver(n) {
    if (ts.isIdentifier(n)) usados.add(n.text);
    ts.forEachChild(n, ver);
  })(sf);
  // Suelo: si el escáner no viera identificadores, todo lo de abajo pasaría en vacío.
  assert.ok(usados.size > 100, `🔴 ESCÁNER CIEGO: solo ${usados.size} identificadores en la vista.`);

  const sinMontar = [];
  for (const [clave, d] of Object.entries(mapa.SUPERFICIES_PROVISIONALES)) {
    for (const id of d.seMontaCon) if (!usados.has(id)) sinMontar.push(`${clave} → ${id}`);
  }
  assert.deepEqual(sinMontar, [],
    '🔴 estas provisionales están DECLARADAS pero ya no se montan en la vista: quedarían ' +
    'inalcanzables, que es justo lo que la declaración existe para impedir:\n   · ' +
    sinMontar.join('\n   · '));
});

test('SCRUM-284 · el hueco de SCRUM-314 se monta Y se rellena (las dos mitades, no una)', () => {
  // El hueco vive lejos de donde se resolvió el conflicto y es fácil perder una de las dos piezas al
  // fusionar. Un div que se crea y no se rellena no es un botón: es un div.
  const sf = ts.createSourceFile('v.js', codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let seAppendea = false;
  let seMonta = false;
  (function ver(n) {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
        && n.expression.name.text === 'appendChild' && n.arguments.length === 1
        && ts.isIdentifier(n.arguments[0]) && n.arguments[0].text === 'huecoEjemplo') seAppendea = true;
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)
        && n.expression.text === 'montarDatosDeEjemplo') seMonta = true;
    ts.forEachChild(n, ver);
  })(sf);
  assert.ok(seAppendea, '🔴 el hueco `datos-ejemplo` ya no se añade a la pantalla (SCRUM-314).');
  assert.ok(seMonta,
    '🔴 `montarDatosDeEjemplo` ya no se llama: el hueco existiría vacío para siempre y el botón de ' +
    'la cuenta demo no aparecería nunca. Vive lejos del conflicto y es lo primero que se pierde al ' +
    'fusionar.');
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
