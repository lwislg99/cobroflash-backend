// tests/scrum672-un-test-que-desaparece.test.mjs — SCRUM-672
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// UN TEST QUE DESAPARECE NO ES UN TEST QUE FALLA
//
// Medido el 2-sep-2026 como efecto colateral de otro instrumento: al romper un `import` a
// propósito, la tanda pasó de 4391 a 4377 con `fail 2` — **catorce tests desaparecieron**. Aquella
// vez hubo señal porque el import roto produjo rojos, pero cualquier camino que saque un fichero
// de la tanda **sin producir un rojo** se lleva sus tests y nadie se entera.
//
// 🔴 ES LA CLASE CARA: produce VERDES FALSOS. Un test que falla grita; uno que deja de existir no
// dice nada, el recuento baja y el porcentaje de verdes puede incluso MEJORAR.
//
// Todo lo de aquí es PURO: entra el texto de un TAP, sale un veredicto. Así el rojo se ejercita
// sin correr la tanda dentro de la tanda.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  veredictoDelSuelo, totalDelTap, SUELO_TESTS, MEDIDO_CONTRA,
  SALIDA_POR_DEBAJO, SALIDA_NO_SUPE_MIRAR,
} from '../scripts/_suelo-de-la-tanda.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const tap = (n) => `TAP version 13\nok 1 - algo\n1..${n}\n# tests ${n}\n# pass ${n}\n# fail 0\n`;

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL ROJO · una tanda VERDE con tests perdidos
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-672 · 🔴 con `fail 0` y menos tests, CAE y dice CUÁNTOS faltan', () => {
  // Éste es el caso real, no una hipótesis: se reprodujo sacando un fichero de la tanda con un
  // patrón de descubrimiento que dejó de casarlo. Salida 0, `fail 0`, y once tests menos.
  const v = veredictoDelSuelo(tap(SUELO_TESTS - 11));
  assert.equal(v.ok, false, '🔴 una tanda con 11 tests menos pasa por buena.');
  assert.equal(v.salida, SALIDA_POR_DEBAJO);
  // SCRUM-702 · el titulo dice «POR DEBAJO DEL SUELO» y ya no «HA PERDIDO»: estar por debajo es
  // un INDICIO —compara con un numero declarado en otro arbol—, no una perdida comprobada. El
  // que afirma una perdida es el de los ficheros mudos, que la ve en el TAP.
  assert.match(v.titulo, /11 TEST\(S\) POR DEBAJO/,
    '🔴 no dice CUÁNTOS faltan. «Algo va mal» no es accionable; «faltan 11» sí.');
  assert.match(v.titulo, new RegExp(String(SUELO_TESTS - 11)), '🔴 no dice el total corrido.');
  assert.match(v.titulo, new RegExp(String(SUELO_TESTS)), '🔴 no dice contra qué suelo.');

  // Y lo que lo hace accionable: adónde mirar, y que borrar tests A PROPÓSITO es legítimo.
  assert.match(v.detalle, /renombrado o movido/, '🔴 no dice dónde mirar primero.');
  assert.match(v.detalle, /BAJA el suelo/,
    '🔴 no dice qué hacer cuando la pérdida es deliberada. Sin esa salida, la gente lo apaga.');
});

test('SCRUM-672 · 🔴 UN solo test perdido también cae: TOLERANCIA CERO', () => {
  const v = veredictoDelSuelo(tap(SUELO_TESTS - 1));
  assert.equal(v.ok, false,
    '🔴 un margen «por si acaso» convertiría esto en el umbral con holgura que SCRUM-559 tuvo que '
    + 'retirar: la pérdida PARCIAL es justo la que pasa por debajo de los umbrales.');
  assert.match(v.titulo, /1 TEST\(S\) POR DEBAJO/);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// CONTROL NEGATIVO · lo que NO debe hacerlo caer
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-672 · CONTROL NEGATIVO: añadir tests NO lo tumba, y dice el margen', () => {
  const v = veredictoDelSuelo(tap(SUELO_TESTS + 40));
  assert.equal(v.ok, true, '🔴 salta cuando la tanda CRECE: sería un espejo, no un suelo.');
  assert.equal(v.salida, 0);
  assert.equal(v.margen, 40);
  assert.match(v.titulo, /margen 40/,
    '🔴 no imprime el margen. Es la compensación de haber elegido un suelo: sin verlo, un suelo '
    + 'rancio no se nota hasta que ya no vigila nada.');
});

test('SCRUM-672 · el borde EXACTO pasa: el suelo es un mínimo, no un «más que»', () => {
  const v = veredictoDelSuelo(tap(SUELO_TESTS));
  assert.equal(v.ok, true, '🔴 cae con el total justo en el suelo.');
  assert.equal(v.margen, 0);
  assert.match(v.titulo, /margen 0/);
});

test('SCRUM-672 · 🔴 el margen se imprime SIEMPRE, no sólo cuando falla', () => {
  for (const n of [SUELO_TESTS, SUELO_TESTS + 1, SUELO_TESTS + 999]) {
    const v = veredictoDelSuelo(tap(n));
    assert.match(v.titulo, /suelo \d+ · total actual \d+ · margen \d+/,
      `🔴 con ${n} tests no imprime las tres cifras. Un suelo rancio tiene que VERSE.`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL SUELO DEL PROPIO GUARD · «no supe leer» no es «está bien»
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-672 · 🔴 SUELO: sin `# tests` en el TAP no hay veredicto', () => {
  for (const basura of ['', '   ', 'TAP version 13\nok 1 - algo\n', null, undefined, '# pass 10']) {
    const v = veredictoDelSuelo(basura);
    assert.equal(v.salida, SALIDA_NO_SUPE_MIRAR,
      `🔴 con «${JSON.stringify(basura)}» da un veredicto. Si esto leyera 0 y comparara, saltaría `
      + 'siempre y alguien lo apagaría — y entonces no vigilaría nada.');
    assert.match(v.titulo, /NO SUPE MIRAR/);
    assert.match(v.detalle, /NO es «la tanda está bien»/,
      '🔴 no distingue ceguera de verde. Son el mismo cero con significados opuestos.');
  }
});

test('SCRUM-672 · 🔴 CONTROL del suelo: con un TAP bueno NO se declara ciego', () => {
  // Sin esto, todos los «no supe mirar» de arriba también saldrían con un lector roto.
  assert.equal(totalDelTap(tap(1234)), 1234, '🔴 no sabe leer un TAP correcto.');
  assert.equal(veredictoDelSuelo(tap(SUELO_TESTS)).salida, 0);
});

test('SCRUM-672 · se toma la ÚLTIMA línea `# tests`, no la primera', () => {
  // Un TAP con subtests anidados puede llevar resúmenes intermedios; el de la tanda es el último.
  const conAnidados = `TAP version 13\n# Subtest: x\n# tests 3\n# pass 3\nok 1 - x\n# tests 900\n# pass 900\n`;
  assert.equal(totalDelTap(conAnidados), 900,
    '🔴 se queda con un resumen intermedio: contaría los tests de un subtest como los de la tanda.');
});

test('SCRUM-672 · no confunde `# tests` con otras líneas que empiezan igual', () => {
  assert.equal(totalDelTap('# tests-de-algo 5\n'), null, '🔴 casa con una línea que no es el resumen.');
  assert.equal(totalDelTap('# tests\n'), null, '🔴 acepta un resumen sin número.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL NÚMERO: procedencia, y la regla de conflicto ESCRITA EN EL FICHERO
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-672 · 🔴 la regla de conflicto está escrita DONDE se resuelve el conflicto', () => {
  // No en la entrada de máster: quien resuelve un conflicto está mirando ESTE fichero, y si la
  // regla vive en otro sitio no la lee. Un merge que elija el número menor baja el suelo en
  // silencio — el defecto de este ticket entrando por la puerta de atrás.
  const src = fs.readFileSync(path.join(RAIZ, 'scripts/_suelo-de-la-tanda.mjs'), 'utf8');
  assert.match(src, /SE QUEDA EL MÁS ALTO/,
    '🔴 el fichero no dice qué hacer si dos ramas cambian el número a la vez.');
  assert.match(src, /Nunca el más bajo/i,
    '🔴 no dice explícitamente que el menor NO vale: es el error que hay que impedir.');
});

test('SCRUM-672 · el suelo declara CONTRA QUÉ se midió', () => {
  assert.match(MEDIDO_CONTRA, /origin\/main = [0-9a-f]{8}/,
    '🔴 el suelo es un número sin procedencia: nadie puede saber si está rancio.');
  assert.ok(Number.isInteger(SUELO_TESTS) && SUELO_TESTS > 0);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// MENCIONAR NO ES HACER · alguien tiene que ejecutarlo
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-672 · 🔴 el CI lo EJECUTA, y sobre el TAP que ya escribe', () => {
  const ci = fs.readFileSync(path.join(RAIZ, '.github/workflows/ci.yml'), 'utf8');
  assert.match(ci, /node scripts\/suelo-de-la-tanda\.mjs/,
    '🔴 el CI no llama al guard: existir no sirve de nada.');
  assert.match(ci, /--test-reporter=tap/,
    '🔴 CIEGO: el CI ya no genera TAP, así que el guard no tendría qué leer.');

  // 🔴 Y CORRE SIEMPRE, no sólo cuando la tanda falla. Si dependiera de un rojo, no vería nunca
  // el caso que persigue — que es precisamente una tanda VERDE con tests de menos.
  const i = ci.indexOf('node scripts/suelo-de-la-tanda.mjs');
  const paso = ci.slice(ci.lastIndexOf('- name:', i), i);
  assert.equal(/if:\s*failure\(\)/.test(paso), false,
    '🔴 el guard sólo corre si la tanda falla. El defecto que persigue sale con `fail 0`: así no '
    + 'lo vería NUNCA.');
});
