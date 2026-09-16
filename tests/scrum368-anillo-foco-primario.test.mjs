// tests/scrum368-anillo-foco-primario.test.mjs — SCRUM-368, guard estructural, sin gate.
//
// EL BOTÓN PRINCIPAL DEL PRODUCTO SE PUEDE USAR CON TECLADO, Y NADIE LO DESHACE EN SILENCIO.
//
// MEDIDO en navegador real con Tab REAL (no `.focus()`, que no siempre dispara `:focus-visible`)
// y comprobado POR PÍXELES —capturando cada parada en reposo y enfocada y comparando los bytes—:
// de las 9 paradas de tabulación de una página con las clases compartidas, las 3 únicas que no
// cambiaban un solo píxel al enfocarlas eran `.btn-primary`: con `.btn`, sin `.btn` y dentro de
// `.qq-modal .modal-footer`. Las otras 6 enseñaban `rgba(34,197,94,.3) 0 0 0 3px`.
//
// El mecanismo está explicado en `_censo-anillo-foco.mjs`: la regla global `:focus-visible`
// pierde la cascada contra cualquier `box-shadow` de botón declarado después con la misma
// especificidad. No es un error de escritura de nadie — es una trampa que el CSS deja puesta.
//
// Este fichero vigila tres cosas, y las tres hacen falta:
//   1. QUÉ HAY — censo DERIVADO de las clases de botón (las agrupadas con `.btn`). Con SUELO:
//      si el analizador no encuentra ninguna, falla. «Todo cumple» y «no supe mirar» son el
//      mismo verde, y aquí el segundo deja el producto entero sin foco con un tick al lado.
//   2. QUE SIGUE ARREGLADO — cada clase, en cada contexto que el CSS declare, gana un anillo.
//   3. QUE EL GUARD VE DE VERDAD — se le quita el anillo al primario sobre una copia en memoria
//      y se exige que caiga NOMBRANDO la clase. Un guard que no se pone rojo no vigila nada.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { censarAnilloDeFoco, censarClasesDeBoton, parsearReglas, esAnillo } from './_censo-anillo-foco.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const RUTA_CSS = path.join(RAIZ, 'public/dashboard/css/styles.css');
const HOJA = fs.readFileSync(RUTA_CSS, 'utf8');

const CENSO = censarAnilloDeFoco(HOJA);

// ── 1. SUELO ────────────────────────────────────────────────────────────────
// Si el analizador no reconoce ninguna clase de botón, no puede afirmar nada sobre ninguna.

test('SUELO: el censo deriva clases de botón del CSS real', () => {
  assert.ok(
    CENSO.clases.length >= 3,
    `el censo no encontró clases de botón (${CENSO.clases.length}). Si el CSS cambió de forma ` +
      'de escribir las variantes, el analizador está CIEGO: arréglalo antes de fiarte del verde.',
  );
  // la base tiene que estar viva para que la derivación signifique algo
  assert.ok(
    CENSO.clases.includes('btn-primary'),
    `.btn-primary no aparece agrupada con .btn — clases vistas: ${CENSO.clases.join(', ')}`,
  );
});

test('SUELO: la regla global de foco sigue existiendo', () => {
  assert.ok(
    CENSO.hayReglaGlobal,
    'no hay ninguna regla `:focus-visible { box-shadow: … }` en la hoja: si desaparece, NINGÚN ' +
      'elemento del dashboard enseña foco y este guard mediría el vacío.',
  );
});

test('SUELO: el analizador distingue un anillo de una sombra de reposo', () => {
  assert.equal(esAnillo('var(--ring)'), true);
  assert.equal(esAnillo('0 0 0 3px rgba(34,197,94,.30)'), true);
  assert.equal(esAnillo('0 1px 2px rgba(5,46,22,.18)'), false, 'la sombra de reposo NO es anillo');
  assert.equal(esAnillo('none'), false);
  assert.equal(esAnillo(null), false);
});

// ── 2. LO VIGILADO ──────────────────────────────────────────────────────────

test('toda clase de botón enseña anillo al enfocarla con teclado, en todos sus contextos', () => {
  const ciegas = CENSO.filas.filter((f) => !f.tieneAnillo);
  const detalle = ciegas
    .map((f) => `  .${f.clase}${f.contexto ? ` (dentro de \`${f.contexto}\`)` : ''} → ` +
      `gana \`${f.selectorGanador}\` con box-shadow: ${f.valor}`)
    .join('\n');
  assert.equal(
    ciegas.length, 0,
    `hay ${ciegas.length} caso(s) sin anillo de foco visible:\n${detalle}\n\n` +
      'El botón queda inoperable con teclado: `outline:none` global + un box-shadow que pisa ' +
      '`var(--ring)`. Añade `<selector>:focus-visible { box-shadow: <la de reposo>, var(--ring); }`.',
  );
});

test('CONTROL NEGATIVO: una clase que ya cumplía no salta', () => {
  // `.btn-secondary` nunca declara box-shadow propio: hereda el anillo global y siempre lo tuvo.
  // Si este test se pone rojo, el guard está inventando fallos donde no los hay.
  const suyas = CENSO.filas.filter((f) => f.clase === 'btn-secondary');
  assert.ok(suyas.length > 0, 'el censo perdió de vista .btn-secondary');
  for (const f of suyas) {
    assert.equal(f.tieneAnillo, true, `.btn-secondary marcada como ciega sin serlo: ${f.valor}`);
  }
});

// ── 3. ROJO POR EL MECANISMO ────────────────────────────────────────────────
// Se le quita el anillo al primario sobre una COPIA en memoria (el fichero no se toca) y se
// exige que el guard caiga, y que caiga NOMBRANDO la clase — no con un fallo genérico.

test('ROJO: si se le quita el anillo a .btn-primary, el guard cae nombrando la clase', () => {
  const mutada = HOJA.replace(
    /^\.btn-primary:focus-visible\s*\{[^}]*\}\s*$/m,
    '/* anillo retirado por el test */',
  );
  assert.notEqual(mutada, HOJA, 'la mutación no encontró la regla del anillo: revisa el guard');

  const censoMutado = censarAnilloDeFoco(mutada);
  const ciegas = censoMutado.filas.filter((f) => !f.tieneAnillo);
  assert.ok(ciegas.length > 0, 'quitado el anillo, el guard siguió en verde: NO VIGILA NADA');
  assert.ok(
    ciegas.some((f) => f.clase === 'btn-primary'),
    `el guard cayó, pero sin nombrar btn-primary (dijo: ${ciegas.map((f) => f.clase).join(', ')})`,
  );
});

test('ROJO: si desaparece la regla del contexto `.qq-modal`, el guard también cae', () => {
  // Ese pie gana por especificidad (0,3,0) y necesita línea propia: sin ella el botón principal
  // del modal de presupuesto rápido se queda sin foco aunque el suelto lo tenga.
  const mutada = HOJA.replace(
    /^\.qq-modal \.modal-footer \.btn-primary:focus-visible\s*\{[^}]*\}\s*$/m,
    '/* anillo del contexto retirado por el test */',
  );
  assert.notEqual(mutada, HOJA, 'la mutación no encontró la regla del contexto');

  const ciegas = censarAnilloDeFoco(mutada).filas.filter((f) => !f.tieneAnillo);
  assert.ok(
    ciegas.some((f) => f.clase === 'btn-primary' && f.contexto.includes('qq-modal')),
    `esperaba ver btn-primary dentro de .qq-modal como ciega; vi: ${JSON.stringify(ciegas)}`,
  );
});

// ── 4. LA OTRA CARA ─────────────────────────────────────────────────────────

test('OTRA CARA: el arreglo no le quita a .btn-primary su sombra de reposo', () => {
  // Verificado además por hash de píxeles: de 36 casillas (2 anchos × 9 paradas × reposo/foco)
  // solo cambiaron las 6 de `.btn-primary` ENFOCADO. El reposo quedó byte a byte idéntico.
  const reglas = parsearReglas(HOJA);
  const suya = reglas.find((r) => r.selectores.includes('.btn-primary:focus-visible'));
  assert.ok(suya, 'no está la regla de foco de .btn-primary');
  const valor = suya.decls.get('box-shadow');
  assert.match(
    valor, /var\(--shadow-btn\)/,
    `el foco debe SUMAR el anillo a la sombra de reposo, no sustituirla. Vale: ${valor}`,
  );
  assert.match(valor, /var\(--ring\)/, `falta el anillo compartido: ${valor}`);
});

test('OTRA CARA: el anillo es el token compartido, no uno inventado', () => {
  // Un anillo nuevo sería una decisión de identidad (regla 30). Este reutiliza el que ya usan
  // las otras 6 paradas, así que no cambia el aspecto de la marca en ningún sitio.
  const reglas = parsearReglas(HOJA);
  for (const sel of ['.btn-primary:focus-visible', '.qq-modal .modal-footer .btn-primary:focus-visible']) {
    const r = reglas.find((x) => x.selectores.includes(sel));
    assert.ok(r, `falta la regla ${sel}`);
    assert.match(
      r.decls.get('box-shadow'), /var\(--ring\)/,
      `${sel} no usa var(--ring): un anillo propio es un cambio de identidad, y eso lo decide el fundador`,
    );
  }
});

test('el censo deriva: si mañana se agrupa una variante nueva con .btn, entra sola', () => {
  const inventada = HOJA.replace(
    /^\.btn,\r?\n\.btn-primary,/m,
    '.btn,\n.btn-inventada-por-el-test,\n.btn-primary,',
  );
  assert.notEqual(inventada, HOJA, 'no se pudo inyectar la variante de prueba');
  assert.ok(
    censarClasesDeBoton(parsearReglas(inventada)).includes('btn-inventada-por-el-test'),
    'el censo NO recogió una variante nueva agrupada con .btn: está enumerando, no derivando',
  );
});
