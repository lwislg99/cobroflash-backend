// tests/scrum1339d-senal-de-nombres.test.mjs — SCRUM-1339d
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA SEÑAL POR NOMBRES, CON SUS CUATRO CONTROLES (SCRUM-1339 c.17935 y c.17954)
//
//   ① EL ROJO ........ un TAP al que le faltan casos declarados sale con FICHERO y RANGO DE LÍNEAS.
//   ② 🔴 EL POSITIVO .. un TAP completo no lleva NINGÚN aviso. Es el que puede tumbar la señal: una
//                      que avisa sobre tandas sanas se apaga sola a las dos semanas.
//   ③ LA LÍNEA ....... sale SIEMPRE, con su población: con 0, con ausentes y sin poder medir.
//   ④ EL GUION ....... sale 0 pase lo que pase —TAP ausente, JSON inválido, su propio módulo
//                      borrado— y DICE que no pudo medir. Un catch que se calla es un CIEGO.
//
// Aquí todo es FABRICADO: fuentes y TAP escritos a mano, con la respuesta sabida. La pasada sobre
// los TAP de verdad (114 artefactos del CI, cada uno contra el árbol que probó su job) y el cruce
// con una segunda sonda están en `docs/master/SCRUM-1339.md`, sección 1339d, con sus guiones en
// `docs/master/evidencias/SCRUM-1339/d-*.mjs`.
//
// Las líneas de TAP de «EL ESCAPE» no las he escrito yo: son las que dejó el reporter de node 24
// al correr el banco `d-banco-de-nombres.txt`. Si se escribieran con la función que prueban, el
// test se comprobaría a sí mismo.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { temporal } from './_temporal.mjs';
import { testsDeclarados, testsDeclaradosEn } from './_poblacion-de-tests.mjs';
import {
  escaparComoTap, llamadasDeclaradas, declaradosDelArbol, leerTap, senalDeNombres, describirBloque,
  lineaDeRegistro, registroDesdeLinea, informe, comandosDeAnotacion, tasaDeRegistros, lineaDeTasa,
  MAX_ANOTACIONES, VENTANA_DE_RUNS, UMBRAL_DE_BLOQUEO, FECHA_TOPE,
} from '../scripts/_senal-de-nombres.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const GUION = path.join(RAIZ, 'scripts', 'senal-de-nombres.mjs');
const NL = String.fromCharCode(10);

/**
 * Cada una es un defecto que esta señal promete no tener, y el test que tiene que verlo.
 * Vistas caer una a una antes de entrar: `docs/master/evidencias/SCRUM-1339/d-salida-mutaciones.txt`.
 */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // la señal acusa a una tanda SANA: el falso positivo que la apagaría en dos semanas
    fichero: 'scripts/_senal-de-nombres.mjs',
    de: '    const registrado = registrados.get(clave) ?? 0;',
    a: '    const registrado = 0; // no mira el TAP, a proposito',
    cae: 'SCRUM-1339d · ② 🔴 EL POSITIVO: un TAP completo no lleva NINGÚN aviso, y la línea de registro sale igual',
  },
  {
    // un nombre repetido vuelve a contarse UNA vez: el agujero por diseño de la primera sonda
    fichero: 'scripts/_senal-de-nombres.mjs',
    de: '    if (registrado >= sitios.length) continue;',
    a: '    if (registrado >= 1) continue; // sin multiplicidad, a proposito',
    cae: 'SCRUM-1339d · MULTIPLICIDAD: el mismo nombre en dos ficheros con UNA sola línea en el TAP no cuenta como presente',
  },
  {
    // un TAP cortado se mide como si estuviera entero
    fichero: 'scripts/_senal-de-nombres.mjs',
    de: '  else if (!t.entero) motivo = t.motivo;',
    a: '  else if (!t.entero && false) motivo = t.motivo; // se fia de un TAP roto, a proposito',
    cae: 'SCRUM-1339d · un TAP que NO está entero no se mide: vacío, con NUL, sin resumen, con dos resúmenes, o con menos líneas que su resumen',
  },
  {
    // lo que no se pudo medir cuenta como limpio y baja la tasa
    fichero: 'scripts/_senal-de-nombres.mjs',
    de: '  const medidos = todos.filter((r) => r && r.medible === true && Number.isFinite(r.ausentes));',
    a: '  const medidos = todos.filter((r) => r); // los ciegos cuentan como medidos, a proposito',
    cae: 'SCRUM-1339d · LA TASA es pura y sale SIEMPRE con su población: lo que no se midió no cuenta como limpio',
  },
  {
    // el catch de nivel superior se CALLA: el guion sale 0 sin decir que no midió
    fichero: 'scripts/senal-de-nombres.mjs',
    de: '  noPudeMedir(`el guion reventó: ${unaLinea(e)}`);',
    a: '  void e; // el catch se calla, a proposito',
    cae: 'SCRUM-1339d · ④ 🔴 EL GUION ROTO A PROPÓSITO sale 0 y DICE que no pudo medir: nunca calla y nunca tumba el job',
  },
];

// ── los fabricados ────────────────────────────────────────────────────────────────────────

/** Un fuente con seis tests literales, uno por línea a partir de la 3. */
const FUENTE_SEIS = [
  "import test from 'node:test';",
  '',
  "test('uno', () => {});",
  "test('dos', () => {});",
  "test('tres', () => {});",
  "test('cuatro', () => {});",
  "test('cinco', () => {",
  '});',
  "test('seis', () => {});",
].join(NL);

/**
 * Un TAP como los escribe node: `entradas` son los nombres YA como salen en el fichero (crudos),
 * o `[crudo, { tipo, directiva, sangria }]`. El resumen cuenta las líneas que no son suite.
 */
function tap(entradas, { tests } = {}) {
  const L = ['TAP version 13'];
  let n = 0;
  let deTest = 0;
  for (const e of entradas) {
    const [crudo, o = {}] = Array.isArray(e) ? e : [e];
    const s = ' '.repeat(o.sangria ?? 0);
    const tipo = o.tipo ?? 'test';
    if (tipo !== 'suite') deTest++;
    L.push(`${s}# Subtest: ${crudo}`, `${s}ok ${++n} - ${crudo}${o.directiva ? ' # ' + o.directiva : ''}`,
      `${s}  ---`, `${s}  duration_ms: 0.1`, `${s}  type: '${tipo}'`, `${s}  ...`);
  }
  L.push(`1..${n}`, `# tests ${tests ?? deTest}`, '# suites 0', `# pass ${deTest}`, '# fail 0', '# cancelled 0', '# skipped 0', '# todo 0', '');
  return L.join(NL);
}

const SEIS = ['uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis'];
const fuentesSeis = [{ fichero: 'a.test.mjs', codigo: FUENTE_SEIS }];
const avisos = (r) => comandosDeAnotacion(r).filter((c) => c.startsWith('::warning'));

// ── ① ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-1339d · ① EL ROJO: a un TAP le falta la cola y sale con fichero, posiciones y rango de LÍNEAS', () => {
  const r = senalDeNombres({ fuentes: fuentesSeis, tap: tap(SEIS.slice(0, 3)) });
  assert.equal(r.medible, true);
  assert.equal(r.ausentes, 3);
  assert.equal(r.bloques.length, 1);
  const [b] = r.bloques;
  assert.deepEqual({ fichero: b.fichero, faltan: b.faltan, llamadas: b.llamadas, forma: b.forma },
    { fichero: 'a.test.mjs', faltan: 3, llamadas: 6, forma: 'cola' });
  // «cinco» ocupa las líneas 7 y 8: el rango llega hasta donde ACABA la última llamada ausente
  assert.deepEqual(b.tramos, [{ desde: 4, hasta: 6, lineaDesde: 6, lineaHasta: 9, ausentes: 3, noComparablesJunto: 0 }]);
  assert.equal(describirBloque(b), 'tests/a.test.mjs · faltan 3 de 6 (cola) · posiciones 4–6 · líneas 6–9');

  // y eso es lo que ANOTA: un aviso, con el rango dentro del TEXTO (c.17961: no depende de `file=`)
  const w = avisos(r);
  assert.equal(w.length, 1);
  assert.match(w[0], /^::warning title=señal de nombres · faltan casos::tests\/a\.test\.mjs · faltan 3 de 6 \(cola\) · posiciones 4–6 · líneas 6–9\./);
  assert.match(informe(r), /FALTAN AL MENOS 3 casos declarados, en 1 fichero\(s\)/);
});

// ── ② ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-1339d · ② 🔴 EL POSITIVO: un TAP completo no lleva NINGÚN aviso, y la línea de registro sale igual', () => {
  const r = senalDeNombres({ fuentes: fuentesSeis, tap: tap(SEIS) });
  assert.equal(r.medible, true);
  assert.equal(r.ausentes, 0);
  assert.equal(r.dudosos, 0);
  assert.deepEqual(r.bloques, []);
  assert.equal(avisos(r).length, 0, 'un run completo no anota nada');
  const comandos = comandosDeAnotacion(r);
  assert.equal(comandos.length, 1);
  // el estado va en el TÍTULO: los ceros se descartan de un vistazo, sin abrir la anotación
  assert.match(comandos[0], /^::notice title=señal de nombres · completo · 0 ausentes::\[señal de nombres v1\] medible=si ausentes=0 /);
  assert.match(informe(r), /Los 6 nombres literales que el árbol declara están en el TAP/);

  // el orden del TAP no importa, ni que traiga MÁS de lo declarado (subtests, casos de un bucle)
  const desordenado = senalDeNombres({ fuentes: fuentesSeis, tap: tap([...SEIS].reverse().concat(['un subtest', 'otro'])) });
  assert.equal(desordenado.ausentes, 0);
  assert.equal(avisos(desordenado).length, 0);
});

// ── ③ ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-1339d · ③ la línea de registro sale SIEMPRE con su población: con 0, con ausentes y sin poder medir', () => {
  const limpio = senalDeNombres({ fuentes: fuentesSeis, tap: tap(SEIS) });
  const roto = senalDeNombres({ fuentes: fuentesSeis, tap: tap(SEIS.slice(0, 3)) });
  const ciego = senalDeNombres({ fuentes: fuentesSeis, tap: 'TAP version 13' + NL + 'ok 1 - uno' + NL });

  assert.equal(lineaDeRegistro(limpio),
    '[señal de nombres v1] medible=si ausentes=0 ficheros_con_ausentes=0 dudosos=0 declarados=6 literales=6 no_comparables=0 ficheros=1 tap_tests=6 tap_fail=0');
  assert.equal(lineaDeRegistro(roto),
    '[señal de nombres v1] medible=si ausentes=3 ficheros_con_ausentes=1 dudosos=0 declarados=6 literales=6 no_comparables=0 ficheros=1 tap_tests=3 tap_fail=0');
  // sin poder medir, los ausentes son «?», NUNCA 0: un cero que no se midió no es un cero
  assert.equal(lineaDeRegistro(ciego),
    '[señal de nombres v1] medible=no ausentes=? ficheros_con_ausentes=? dudosos=? declarados=6 literales=6 no_comparables=0 ficheros=1 tap_tests=? tap_fail=?');

  // las tres salen como PRIMERA línea del informe y como `::notice`, con su estado en el título
  const TITULOS = new Map([[limpio, 'completo · 0 ausentes'], [roto, 'FALTAN al menos 3 en 1 fichero(s)'], [ciego, 'NO PUDE MEDIR']]);
  for (const r of [limpio, roto, ciego]) {
    assert.equal(informe(r).split(NL)[0], lineaDeRegistro(r));
    assert.equal(comandosDeAnotacion(r)[0], `::notice title=señal de nombres · ${TITULOS.get(r)}::` + lineaDeRegistro(r));
    assert.match(informe(r), /POBLACIÓN: 1 ficheros de tests\/ · 6 llamadas test\(\)\/it\(\) \(censo de SCRUM-708: 6, coincide\)/);
  }

  // y la vuelta: de la línea al registro, que es lo que lee quien calcula la tasa desde fuera
  assert.deepEqual(registroDesdeLinea('ruido antes' + NL + lineaDeRegistro(roto) + NL + 'ruido después'), {
    version: 1, medible: true, ausentes: 3, ficherosConAusentes: 1, dudosos: 0,
    declarados: 6, literales: 6, noComparables: 0, ficheros: 1, tapTests: 3, tapFail: 0,
  });
  assert.equal(registroDesdeLinea(lineaDeRegistro(ciego)).medible, false);
  assert.equal(registroDesdeLinea(lineaDeRegistro(ciego)).ausentes, null);
  assert.equal(registroDesdeLinea('una línea cualquiera del log'), null);
});

// ── el control que ata «declarados N» al censo ────────────────────────────────────────────

test('SCRUM-1339d · «declarados N» está ATADO al censo de SCRUM-708: fichero a fichero y sobre un árbol en disco', () => {
  // un fuente con todas las formas: literal, plantilla, construido, sin nombre, `it` dentro de `describe`,
  // y lo que NO es una declaración (un `t.test`, un `re.test(s)`, un `test(` comentado o dentro de una cadena)
  const variado = [
    "import { test, it, describe } from 'node:test';",
    "test('literal', () => {});",
    'test(`plantilla sin sustitución`, () => {});',
    "for (const x of [1, 2]) test(`caso ${x}`, () => {});",
    "test(nombreEnUnaVariable, () => {});",
    "test('', () => {});",
    'test(() => {});',
    "describe('grupo', () => { it('dentro del grupo', () => {}); });",
    "test('padre', async (t) => { await t.test('hijo', () => {}); });",
    "const s = /x/.test('no soy un test'); // test('comentado', () => {});",
    'const ejemplo = "test(\'dentro de una cadena\', () => {})";',
  ].join(NL);
  const ll = llamadasDeclaradas(variado, 'v.test.mjs');
  assert.deepEqual(ll.map((x) => [x.posicion, x.clase, x.nombre, x.linea]), [
    [1, 'literal', 'literal', 2],
    [2, 'literal', 'plantilla sin sustitución', 3],
    [3, 'construido', null, 4],
    [4, 'construido', null, 5],
    [5, 'sin-nombre', null, 6],
    [6, 'sin-nombre', null, 7],
    [7, 'literal', 'dentro del grupo', 8],
    [8, 'literal', 'padre', 9],
  ]);
  // EL CONTROL: lo que cuenta mi recorrido es lo que cuenta el censo, sobre la MISMA entrada fabricada
  assert.equal(ll.length, testsDeclarados(variado, 'v.test.mjs'));
  assert.equal(llamadasDeclaradas(FUENTE_SEIS).length, testsDeclarados(FUENTE_SEIS));

  const d = declaradosDelArbol([{ fichero: 'v.test.mjs', codigo: variado }, { fichero: 'a.test.mjs', codigo: FUENTE_SEIS }]);
  assert.deepEqual([d.llamadas, d.control.censo, d.control.coincide], [14, 14, true]);
  assert.deepEqual(d.ficheros.map((f) => f.fichero), ['a.test.mjs', 'v.test.mjs'], 'ordenados por nombre');

  // y sobre un árbol EN DISCO, contra `testsDeclaradosEn(raiz)` — el censo leyendo por su camino
  const raiz = temporal('scrum1339d-censo-');
  fs.mkdirSync(path.join(raiz, 'tests'));
  fs.writeFileSync(path.join(raiz, 'tests', 'v.test.mjs'), variado);
  fs.writeFileSync(path.join(raiz, 'tests', 'a.test.mjs'), FUENTE_SEIS);
  fs.writeFileSync(path.join(raiz, 'tests', '_ayudante.mjs'), "test('no cuento: no soy un .test.mjs', () => {});");
  assert.equal(testsDeclaradosEn(raiz), 14);
  assert.equal(d.llamadas, testsDeclaradosEn(raiz));

  // 🔴 si la lista de ficheros que se me pasa NO es la que ve el censo, NO se mide: se dice
  const todos = [...SEIS, 'literal', 'plantilla sin sustitución', 'dentro del grupo', 'padre'];
  const atado = senalDeNombres({ fuentes: [{ fichero: 'v.test.mjs', codigo: variado }, { fichero: 'a.test.mjs', codigo: FUENTE_SEIS }], tap: tap(todos), censoDelArbol: 14 });
  assert.equal(atado.medible, true);
  assert.equal(atado.ausentes, 0);
  const desatado = senalDeNombres({ fuentes: fuentesSeis, tap: tap(SEIS), censoDelArbol: 14 });
  assert.equal(desatado.medible, false);
  assert.equal(desatado.ausentes, null);
  assert.match(desatado.motivo, /mi recuento de llamadas \(6\) no casa con el del censo de SCRUM-708 \(14\)/);
  assert.match(informe(desatado), /NO PUDE MEDIR/);
  assert.match(informe(desatado), /censo de SCRUM-708: 14, NO COINCIDE/);
});

// ── el punto ciego, contado ───────────────────────────────────────────────────────────────

test('SCRUM-1339d · EL PUNTO CIEGO va CONTADO e impreso: nombres construidos en bucle y tests sin nombre', () => {
  const conBucle = [
    "import test from 'node:test';",
    "test('antes', () => {});",
    "for (const x of CASOS) test(`caso ${x.nombre}`, () => {});",
    "test('después uno', () => {});",
    "test('después dos', () => {});",
    'test(() => {});',
  ].join(NL);
  const fuentes = [{ fichero: 'b.test.mjs', codigo: conBucle }];
  // el TAP trae 23 casos del bucle: la señal no los espera, y tampoco los echa de menos
  const delBucle = Array.from({ length: 23 }, (_, i) => `caso ${i}`);
  const completo = senalDeNombres({ fuentes, tap: tap(['antes', ...delBucle, 'después uno', 'después dos', '<anonymous>']) });
  assert.equal(completo.ausentes, 0);
  assert.deepEqual(
    [completo.poblacion.llamadas, completo.poblacion.literales, completo.poblacion.construidos, completo.poblacion.sinNombre, completo.poblacion.noComparables, completo.poblacion.ficherosConNoComparables],
    [5, 3, 1, 1, 2, 1],
  );
  assert.match(informe(completo), /PUNTO CIEGO: 2 llamadas NO se comparan \(1 con el nombre construido, 1 sin nombre\) en 1 ficheros\. Si se pierden, esta señal no lo ve\./);
  assert.match(lineaDeRegistro(completo), / no_comparables=2 /);

  // 🔴 LO QUE NO VE, visto: se pierden los 23 del bucle y NADA más → 0 ausentes. Es un falso limpio,
  // y por eso el recuento de no comparables va en la línea de registro de cada run.
  const soloElBucle = senalDeNombres({ fuentes, tap: tap(['antes', 'después uno', 'después dos', '<anonymous>']) });
  assert.equal(soloElBucle.ausentes, 0);

  // el caso MEDIDO (scrum524b, 26 perdidos y 3 nombrados): cae la cola, con el bucle dentro del hueco.
  // La señal nombra los 2 literales y DICE que en ese hueco hay una llamada que no puede comparar.
  const cola = senalDeNombres({ fuentes, tap: tap(['antes']) });
  assert.equal(cola.ausentes, 2);
  assert.deepEqual(cola.bloques[0].tramos, [{ desde: 3, hasta: 4, lineaDesde: 4, lineaHasta: 5, ausentes: 2, noComparablesJunto: 2 }]);
  assert.equal(describirBloque(cola.bloques[0]),
    'tests/b.test.mjs · faltan AL MENOS 2 de 5 (cola) · posiciones 3–4 · líneas 4–5'
    + ' · en el mismo hueco hay 2 llamada(s) de nombre construido: pueden faltar más casos y esta señal no los ve');
});

// ── multiplicidad ─────────────────────────────────────────────────────────────────────────

test('SCRUM-1339d · MULTIPLICIDAD: el mismo nombre en dos ficheros con UNA sola línea en el TAP no cuenta como presente', () => {
  const uno = "import test from 'node:test';" + NL + "test('propio de uno', () => {});" + NL + "test('compartido', () => {});";
  const dos = "import test from 'node:test';" + NL + "test('compartido', () => {});" + NL + "test('propio de dos', () => {});";
  const fuentes = [{ fichero: 'uno.test.mjs', codigo: uno }, { fichero: 'dos.test.mjs', codigo: dos }];

  const lasDos = senalDeNombres({ fuentes, tap: tap(['propio de uno', 'compartido', 'compartido', 'propio de dos']) });
  assert.deepEqual([lasDos.ausentes, lasDos.dudosos], [0, 0]);
  assert.deepEqual([lasDos.poblacion.nombresDistintos, lasDos.poblacion.nombresRepetidos, lasDos.poblacion.nombresRepetidosEntreFicheros], [3, 1, 1]);

  // llega UNA de las dos: falta una, y el TAP no dice de qué fichero. Es un DUDOSO: se cuenta,
  // se avisa, y NO se le cuelga a ninguno de los dos ficheros a ojo.
  const una = senalDeNombres({ fuentes, tap: tap(['propio de uno', 'compartido', 'propio de dos']) });
  assert.deepEqual([una.ausentes, una.dudosos], [0, 1]);
  assert.deepEqual(una.bloques, []);
  assert.deepEqual(una.dudas, [{ nombre: 'compartido', declarado: 2, registrado: 1, faltan: 1, ficheros: ['dos.test.mjs', 'uno.test.mjs'] }]);
  assert.equal(avisos(una).length, 1);
  assert.equal(avisos(una)[0], '::warning title=señal de nombres · dudosos::faltan 1 apariciones de 1 nombre(s) repetido(s): «compartido» (dos.test.mjs, uno.test.mjs)');
  assert.match(informe(una), /DUDOSOS: faltan 1 apariciones de 1 nombre\(s\) repetido\(s\)/);
  assert.match(lineaDeRegistro(una), / ausentes=0 ficheros_con_ausentes=0 dudosos=1 /);

  // no llega NINGUNA: ahí no hay duda, faltan las dos y cada fichero lleva la suya
  const ninguna = senalDeNombres({ fuentes, tap: tap(['propio de uno', 'propio de dos']) });
  assert.deepEqual([ninguna.ausentes, ninguna.dudosos], [2, 0]);
  assert.deepEqual(ninguna.bloques.map((b) => [b.fichero, b.faltan, b.forma]), [['dos.test.mjs', 1, 'cabeza'], ['uno.test.mjs', 1, 'cola']]);

  // un literal dentro de un bucle se registra más veces de las declaradas: eso NO es una pérdida
  const literalEnBucle = "import test from 'node:test';" + NL + "for (const x of [1, 2, 3]) test('siempre igual', () => {});";
  const tres = senalDeNombres({ fuentes: [{ fichero: 'c.test.mjs', codigo: literalEnBucle }], tap: tap(['siempre igual', 'siempre igual', 'siempre igual']) });
  assert.deepEqual([tres.ausentes, tres.dudosos], [0, 0]);
});

test('SCRUM-1339d · una SUITE que se llama igual que un test no tapa su pérdida', () => {
  const codigo = "import { test, describe } from 'node:test';" + NL + "describe('mismo nombre', () => {});" + NL + "test('mismo nombre', () => {});";
  const fuentes = [{ fichero: 's.test.mjs', codigo }];
  const soloLaSuite = senalDeNombres({ fuentes, tap: tap([['mismo nombre', { tipo: 'suite' }]]) });
  assert.equal(soloLaSuite.tap.lineasDeSuite, 1);
  assert.equal(soloLaSuite.ausentes, 1);
  const conElTest = senalDeNombres({ fuentes, tap: tap([['mismo nombre', { tipo: 'suite' }], 'mismo nombre']) });
  assert.equal(conElTest.ausentes, 0);
});

// ── el escape ─────────────────────────────────────────────────────────────────────────────

test('SCRUM-1339d · EL ESCAPE es el del reporter de node: se escapa lo DECLARADO, y un tabulador sale como barra-barra-t', () => {
  const TAB = String.fromCharCode(9);
  const BARRA = String.fromCharCode(92);
  // izquierda: el nombre como lo da el AST · derecha: la línea que escribió node 24 (banco d-banco-de-nombres)
  const MEDIDO = [
    ['simple', 'simple'],
    ['con # almohadilla y ' + BARRA + ' barra', 'con ' + BARRA + '# almohadilla y ' + BARRA + BARRA + ' barra'],
    ['con  dos  espacios   y tab' + TAB + 'aqui', 'con  dos  espacios   y tab' + BARRA + BARRA + 'taqui'],
    ['plantilla' + NL + 'en dos lineas', 'plantilla' + BARRA + BARRA + 'nen dos lineas'],
    ['  con espacios al borde  ', '  con espacios al borde  '],
    ['termina en # SKIP falso', 'termina en ' + BARRA + '# SKIP falso'],
  ];
  for (const [declarado, enElTap] of MEDIDO) assert.equal(escaparComoTap(declarado), enElTap);

  // de punta a punta, con el fuente que declara esos nombres y el TAP con las líneas medidas
  const codigo = ["import test from 'node:test';", ...MEDIDO.map(([d]) => `test(${JSON.stringify(d)}, () => {});`)].join(NL);
  const fuentes = [{ fichero: 'e.test.mjs', codigo }];
  assert.equal(senalDeNombres({ fuentes, tap: tap(MEDIDO.map(([, t]) => t)) }).ausentes, 0);
  // control: si el TAP trajera el nombre SIN escapar, la señal lo echa de menos (el escape hace algo)
  assert.equal(senalDeNombres({ fuentes, tap: tap(MEDIDO.map(([d]) => d.split(NL).join(' '))) }).ausentes, 4);
});

test('SCRUM-1339d · un test SALTADO o TODO está registrado; un «# SKIP» dentro del nombre no es una directiva', () => {
  const codigo = ["import test from 'node:test';",
    "test('saltado con motivo', { skip: 'x' }, () => {});",
    "test('saltado sin motivo', { skip: true }, () => {});",
    "test('pendiente', { todo: true }, () => {});",
    "test('termina en # SKIP falso', () => {});"].join(NL);
  const fuentes = [{ fichero: 'k.test.mjs', codigo }];
  const BARRA = String.fromCharCode(92);
  const t = tap([
    ['saltado con motivo', { directiva: 'SKIP motivo ' + BARRA + '# con almohadilla' }],
    ['saltado sin motivo', { directiva: 'SKIP' }],
    ['pendiente', { directiva: 'TODO' }],
    'termina en ' + BARRA + '# SKIP falso',
  ]);
  assert.deepEqual([...leerTap(t).nombres.keys()], ['saltado con motivo', 'saltado sin motivo', 'pendiente', 'termina en ' + BARRA + '# SKIP falso']);
  assert.equal(senalDeNombres({ fuentes, tap: t }).ausentes, 0);
});

// ── un TAP que no está entero ─────────────────────────────────────────────────────────────

test('SCRUM-1339d · un TAP que NO está entero no se mide: vacío, con NUL, sin resumen, con dos resúmenes, o con menos líneas que su resumen', () => {
  const bueno = tap(SEIS);
  assert.deepEqual([leerTap(bueno).entero, leerTap(bueno).motivo, leerTap(bueno).tests, leerTap(bueno).lineasDeTest], [true, null, 6, 6]);

  const CASOS = [
    ['', /el TAP está vacío/],
    [bueno + String.fromCharCode(0).repeat(7), /el TAP lleva 7 bytes NUL/],
    [bueno.split(NL).filter((l) => !l.startsWith('# tests')).join(NL), /no tiene resumen \(`# tests N`\): la tanda no llegó al final/],
    [bueno + bueno, /tiene 2 resúmenes: hay otro `node --test` escribiendo en él/],
    [tap(SEIS, { tests: 9 }), /tiene 6 líneas de test y su resumen dice 9/],
  ];
  for (const [texto, motivo] of CASOS) {
    const t = leerTap(texto);
    assert.equal(t.entero, false);
    assert.match(t.motivo, motivo);
    const r = senalDeNombres({ fuentes: fuentesSeis, tap: texto });
    assert.equal(r.medible, false);
    assert.equal(r.ausentes, null, 'sin medir, los ausentes son null y NUNCA 0');
    assert.match(informe(r), /NO PUDE MEDIR: /);
    assert.match(informe(r), /Esto NO es «no falta nada»: es que no se ha podido comprobar\./);
    const w = avisos(r);
    assert.equal(w.length, 1);
    assert.match(w[0], /^::warning title=señal de nombres · NO PUDE MEDIR::/);
  }

  // y un árbol que no declara nada tampoco es «no falta nada»
  const sinArbol = senalDeNombres({ fuentes: [], tap: bueno });
  assert.equal(sinArbol.medible, false);
  assert.match(sinArbol.motivo, /el árbol no declara ningún test/);
});

// ── las formas ────────────────────────────────────────────────────────────────────────────

test('SCRUM-1339d · LAS FORMAS: entero, cola, cabeza y medio; y el fichero que sale en el TAP como UNA línea', () => {
  const forma = (presentes) => senalDeNombres({ fuentes: fuentesSeis, tap: tap(presentes) }).bloques[0];
  assert.equal(forma(['otro']).forma, 'entero');
  assert.equal(forma(['uno', 'dos']).forma, 'cola');
  assert.equal(forma(['cinco', 'seis']).forma, 'cabeza');
  const medio = forma(['uno', 'tres', 'seis']);
  assert.equal(medio.forma, 'medio');
  assert.deepEqual(medio.tramos.map((t) => [t.desde, t.hasta, t.lineaDesde, t.lineaHasta]), [[2, 2, 4, 4], [4, 5, 6, 8]]);
  assert.equal(describirBloque(medio), 'tests/a.test.mjs · faltan 3 de 6 (medio) · posiciones 2 · líneas 4 ; posiciones 4–5 · líneas 6–8');

  // lo medido en scrum237 (4 jobs): el fichero entero sale como una sola línea `ok N - tests/x.test.mjs`
  const conEntrada = senalDeNombres({ fuentes: fuentesSeis, tap: tap(['tests/a.test.mjs']) });
  assert.equal(conEntrada.bloques[0].forma, 'entero');
  assert.equal(conEntrada.bloques[0].conEntradaDeFichero, true);
  assert.match(describirBloque(conEntrada.bloques[0]), /el fichero sale en el TAP como UNA línea: corrió y no informó de sus casos$/);
  assert.equal(forma(['otro']).conEntradaDeFichero, false);
});

test('SCRUM-1339d · CASO REAL (meta-guard de main, run 36886780786): el resumen CUADRA con lo que llegó y faltan los 4 últimos', () => {
  // Los seis nombres son los de `tests/scrum859-identidad-y-motivo-cerrado.test.mjs`. El meta-guard
  // escribió: «node:test contó 16 tests frente a los 16 que este script acumuló. Cuadran, y eso NO
  // prueba que el fichero terminara: el resumen lo emite el proceso padre con lo que le llegó.»
  const NOMBRES = [
    'SCRUM-859 · SUELO: hay exentas que examinar y entradas contra las que casarlas',
    'SCRUM-859 · ✅ cada clave exenta apunta a UNA entrada real — una por una',
    'SCRUM-859 · 🔴 insertar una entrada en medio NO mueve ninguna clave',
    'SCRUM-859 · 🔴 CONTROL del control: por POSICIÓN sí se habrían desplazado',
    'SCRUM-859 · 🔴 `INVISIBLE_HASTA_859` está cerrado en CINCO',
    'SCRUM-859 · 🔴 CONTROL: una SEXTA que alegue el motivo hace CAER el guard',
  ];
  const codigo = ["import test from 'node:test';", ...NOMBRES.map((n) => `test(${JSON.stringify(n)}, () => {});`)].join(NL);
  const llego = tap(NOMBRES.slice(0, 2));
  // el recuento del runner es coherente consigo mismo: por eso NO sirve para saber si está completo
  assert.equal(leerTap(llego).tests, leerTap(llego).lineasDeTest);
  assert.equal(leerTap(llego).entero, true);
  const r = senalDeNombres({ fuentes: [{ fichero: 'scrum859-identidad-y-motivo-cerrado.test.mjs', codigo }], tap: llego });
  assert.equal(r.ausentes, 4);
  assert.equal(describirBloque(r.bloques[0]), 'tests/scrum859-identidad-y-motivo-cerrado.test.mjs · faltan 4 de 6 (cola) · posiciones 3–6 · líneas 4–7');
});

// ── las anotaciones ───────────────────────────────────────────────────────────────────────

test('SCRUM-1339d · las anotaciones caben en el tope de GitHub, y la última dice cuántos ficheros se quedan fuera', () => {
  const fuentes = Array.from({ length: 30 }, (_, i) => ({
    fichero: `f${String(i).padStart(2, '0')}.test.mjs`,
    codigo: "import test from 'node:test';" + NL + `test('caso del fichero ${i}', () => {});`,
  }));
  const r = senalDeNombres({ fuentes, tap: tap(['otra cosa']) });
  assert.equal(r.ausentes, 30);
  const comandos = comandosDeAnotacion(r);
  assert.equal(MAX_ANOTACIONES, 10);
  assert.equal(comandos.length, MAX_ANOTACIONES);
  assert.equal(comandos.filter((c) => c.startsWith('::notice')).length, 1);
  assert.equal(avisos(r).length, 9);
  assert.match(comandos.at(-1), /^::warning title=señal de nombres · y 22 más::no caben en las anotaciones; están todas en el log del paso\.$/);
  // en el log van TODOS, no sólo los que caben
  assert.equal(informe(r).split(NL).filter((l) => l.includes('.test.mjs · faltan 1 de 1')).length, 30);
  // y con pocos, uno por fichero y sin la de «y N más»
  const pocos = senalDeNombres({ fuentes: fuentes.slice(0, 3), tap: tap(['otra cosa']) });
  assert.equal(avisos(pocos).length, 3);
  assert.equal(avisos(pocos).filter((c) => c.includes('más::')).length, 0);

  // un comando de workflow es UNA línea: el salto y el `%` van escapados
  const raro = senalDeNombres({ fuentes: [{ fichero: 'd.test.mjs', codigo: "import test from 'node:test';" + NL + 'test(`cien % y' + NL + 'dos líneas`, () => {});' + NL + 'test(`cien % y' + NL + 'dos líneas`, () => {});' }], tap: tap(['cien % y' + String.fromCharCode(92, 92) + 'ndos líneas']) });
  assert.equal(raro.dudosos, 1);
  for (const c of comandosDeAnotacion(raro)) assert.equal(c.split(NL).length, 1);
  assert.match(avisos(raro)[0], /cien %25 y/);
});

// ── la tasa ───────────────────────────────────────────────────────────────────────────────

test('SCRUM-1339d · LA TASA es pura y sale SIEMPRE con su población: lo que no se midió no cuenta como limpio', () => {
  const limpio = { medible: true, ausentes: 0 };
  const perdio = { medible: true, ausentes: 7 };
  const ciego = { medible: false, ausentes: null };

  // 2 de 4 medidos; el ciego y el run sin registro (null) NO bajan la tasa
  const t = tasaDeRegistros([limpio, perdio, limpio, perdio, ciego, null]);
  assert.deepEqual(t, { poblacion: 6, medidos: 4, sinMedir: 2, conAusentes: 2, tasa: 0.5, ventanaCompleta: false, bajoElUmbral: null });
  assert.equal(lineaDeTasa(t),
    '[señal de nombres · tasa] 2 de 4 runs medidos con nombres ausentes (50.0 %) · población 6 runs · sin medir 2'
    + ' · NO SE PUEDE DECIR si está por debajo del 5 %: hacen falta 50 runs medidos y hay 4 · tope 2026-10-15 (SCRUM-1339 c.17935)');

  // con CERO medidos no hay tasa: no es un 0 %
  const nada = tasaDeRegistros([ciego, null]);
  assert.deepEqual([nada.medidos, nada.tasa, nada.bajoElUmbral], [0, null, null]);
  assert.match(lineaDeTasa(nada), /^\[señal de nombres · tasa\] 0 de 0 runs medidos con nombres ausentes \(sin tasa\) · población 2 runs · sin medir 2 /);
  assert.match(lineaDeTasa(tasaDeRegistros([])), /población 0 runs · sin medir 0 · NO SE PUEDE DECIR/);

  // con la ventana entera (50 medidos) sí se pronuncia, a los dos lados del 5 %
  assert.deepEqual([VENTANA_DE_RUNS, UMBRAL_DE_BLOQUEO, FECHA_TOPE], [50, 0.05, '2026-10-15']);
  const cincuenta = (malos) => [...Array(malos).fill(perdio), ...Array(50 - malos).fill(limpio)];
  const dos = tasaDeRegistros(cincuenta(2)); // 4 %
  assert.deepEqual([dos.tasa, dos.ventanaCompleta, dos.bajoElUmbral], [0.04, true, true]);
  assert.match(lineaDeTasa(dos), /2 de 50 runs medidos con nombres ausentes \(4\.0 %\) .* por DEBAJO del 5 % sobre 50 runs medidos/);
  const tres = tasaDeRegistros(cincuenta(3)); // 6 %
  assert.equal(tres.bajoElUmbral, false);
  assert.match(lineaDeTasa(tres), /3 de 50 runs medidos con nombres ausentes \(6\.0 %\) .* por ENCIMA del 5 % sobre 50 runs medidos/);
  const cero = tasaDeRegistros(cincuenta(0));
  assert.deepEqual([cero.tasa, cero.bajoElUmbral], [0, true]);
  assert.match(lineaDeTasa(cero), /^\[señal de nombres · tasa\] 0 de 50 runs medidos con nombres ausentes \(0\.0 %\) · población 50 runs/);
});

// ── ④ el guion ────────────────────────────────────────────────────────────────────────────

/**
 * El guion como lo corre el paso del CI, con el entorno construido a mano (A21): sin lo que el
 * arnés deja puesto. El guion NO mira si está en el CI —imprime lo mismo en los dos sitios—, así
 * que esto es exactamente lo que corre el paso.
 */
function correr(guion, args, resumen = null) {
  const env = { ...process.env };
  for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR', 'GITHUB_STEP_SUMMARY']) delete env[k];
  if (resumen) env.GITHUB_STEP_SUMMARY = resumen;
  const r = spawnSync(process.execPath, [guion, ...args], { env, encoding: 'utf8' });
  return { salida: r.status, texto: String(r.stdout) + String(r.stderr) };
}
const avisosDe = (texto) => texto.split(NL).filter((l) => l.startsWith('::warning'));

test('SCRUM-1339d · EL GUION, de punta a punta sobre un árbol fabricado: anota el rojo, calla en el completo, y sale 0 las dos veces', () => {
  // un árbol de mentira con `tests/a.test.mjs` (los seis) y un TAP al que le falta la cola
  const rojo = temporal('scrum1339d-rojo-');
  fs.mkdirSync(path.join(rojo, 'tests'));
  fs.writeFileSync(path.join(rojo, 'tests', 'a.test.mjs'), FUENTE_SEIS);
  const tapRojo = path.join(rojo, 'tanda.tap');
  fs.writeFileSync(tapRojo, tap(SEIS.slice(0, 3)));
  const resumen = path.join(rojo, 'resumen.md');

  const r = correr(GUION, [tapRojo, '--raiz', rojo], resumen);
  assert.equal(r.salida, 0, 'avisar es anotar, no fallar');
  assert.match(r.texto, /^\[señal de nombres v1\] medible=si ausentes=3 ficheros_con_ausentes=1 /m);
  assert.match(r.texto, /^::notice title=señal de nombres · FALTAN al menos 3 en 1 fichero\(s\)::\[señal de nombres v1\] medible=si ausentes=3 /m);
  assert.equal(avisosDe(r.texto).length, 1);
  assert.equal(avisosDe(r.texto)[0],
    '::warning title=señal de nombres · faltan casos::tests/a.test.mjs · faltan 3 de 6 (cola) · posiciones 4–6 · líneas 6–9. La tanda no informó de ellos y salió igual.');
  assert.match(fs.readFileSync(resumen, 'utf8'), /FALTAN AL MENOS 3 casos declarados/);

  // el mismo árbol con el TAP completo: la `::notice` sale igual y NINGÚN aviso
  const completo = temporal('scrum1339d-completo-');
  fs.mkdirSync(path.join(completo, 'tests'));
  fs.writeFileSync(path.join(completo, 'tests', 'a.test.mjs'), FUENTE_SEIS);
  const tapCompleto = path.join(completo, 'tanda.tap');
  fs.writeFileSync(tapCompleto, tap(SEIS));
  const c = correr(GUION, [tapCompleto, '--raiz', completo]);
  assert.equal(c.salida, 0);
  assert.match(c.texto, /^::notice title=señal de nombres · completo · 0 ausentes::\[señal de nombres v1\] medible=si ausentes=0 /m);
  assert.equal(avisosDe(c.texto).length, 0, 'un run completo no anota NADA');
  assert.match(c.texto, /Los 6 nombres literales que el árbol declara están en el TAP/);
});

test('SCRUM-1339d · ④ 🔴 EL GUION ROTO A PROPÓSITO sale 0 y DICE que no pudo medir: nunca calla y nunca tumba el job', () => {
  const raiz = temporal('scrum1339d-roto-');
  fs.mkdirSync(path.join(raiz, 'tests'));
  fs.writeFileSync(path.join(raiz, 'tests', 'a.test.mjs'), FUENTE_SEIS);
  const rutaTap = path.join(raiz, 'tanda.tap');
  fs.writeFileSync(rutaTap, tap(SEIS));
  const tapVacio = path.join(raiz, 'vacio.tap');
  fs.writeFileSync(tapVacio, '');
  const registrosRotos = path.join(raiz, 'registros.json');
  fs.writeFileSync(registrosRotos, '{ esto no es JSON');
  const noEsLista = path.join(raiz, 'no-lista.json');
  fs.writeFileSync(noEsLista, '{"medible": true}');

  // el guion SOLO, sin su módulo al lado: el `import()` no resuelve. Es el «fichero ausente» del control.
  const huerfano = temporal('scrum1339d-huerfano-');
  fs.mkdirSync(path.join(huerfano, 'scripts'));
  const guionSolo = path.join(huerfano, 'scripts', 'senal-de-nombres.mjs');
  fs.copyFileSync(GUION, guionSolo);

  const ROTOS = [
    ['sin argumentos', GUION, [], /NO PUDE MEDIR: falta la ruta del TAP/],
    ['el TAP no existe', GUION, [path.join(raiz, 'no-existe.tap'), '--raiz', raiz], /NO PUDE MEDIR: no pude leer el TAP/],
    ['la raíz no tiene tests/', GUION, [rutaTap, '--raiz', path.join(raiz, 'no-existe')], /NO PUDE MEDIR: el guion reventó: ENOENT/],
    ['el TAP es una carpeta', GUION, [raiz, '--raiz', raiz], /NO PUDE MEDIR: no pude leer el TAP/],
    ['el TAP está vacío', GUION, [tapVacio, '--raiz', raiz], /NO PUDE MEDIR: el TAP está vacío/],
    ['--tasa con JSON inválido', GUION, ['--tasa', registrosRotos], /NO PUDE MEDIR: no pude leer los registros/],
    ['--tasa con algo que no es una lista', GUION, ['--tasa', noEsLista], /NO PUDE MEDIR: los registros de .* no son una lista/],
    ['--tasa sin fichero', GUION, ['--tasa'], /NO PUDE MEDIR: no pude leer los registros/],
    ['el módulo puro NO ESTÁ', guionSolo, [rutaTap, '--raiz', raiz], /NO PUDE MEDIR: el guion reventó: Cannot find module/],
  ];
  for (const [caso, guion, args, dice] of ROTOS) {
    const r = correr(guion, args);
    assert.equal(r.salida, 0, `«${caso}» tiene que salir 0 y salió ${r.salida}: ${r.texto.slice(0, 300)}`);
    assert.match(r.texto, dice, `«${caso}» no dijo qué le pasó`);
    assert.equal(avisosDe(r.texto).filter((l) => l.startsWith('::warning title=señal de nombres · NO PUDE MEDIR::')).length, 1, `«${caso}» no dejó su aviso en el run`);
    assert.equal(r.texto.split(NL).filter((l) => /^\[señal de nombres v1\] medible=si /.test(l)).length, 0, `«${caso}» no puede salir como medido`);
  }

  // control del control: el MISMO guion, con todo en su sitio, SÍ mide. Si no, lo de arriba sería un guion que nunca mide.
  const sano = correr(GUION, [rutaTap, '--raiz', raiz]);
  assert.equal(sano.salida, 0);
  assert.equal(sano.texto.split(NL).filter((l) => /^\[señal de nombres v1\] medible=si /.test(l)).length, 1);
  assert.equal(sano.texto.split(NL).filter((l) => l.includes('NO PUDE MEDIR')).length, 0);
});

test('SCRUM-1339d · EL GUION calcula la tasa desde fuera: registros, o las LÍNEAS tal como salieron en cada run', () => {
  const raiz = temporal('scrum1339d-tasa-');
  const ruta = path.join(raiz, 'registros.json');
  const limpio = senalDeNombres({ fuentes: fuentesSeis, tap: tap(SEIS) });
  const roto = senalDeNombres({ fuentes: fuentesSeis, tap: tap(SEIS.slice(0, 3)) });
  // tres formas en la misma lista: la línea de la anotación, un registro ya leído, y un run sin anotación
  fs.writeFileSync(ruta, JSON.stringify([lineaDeRegistro(limpio), lineaDeRegistro(roto), registroDesdeLinea(lineaDeRegistro(roto)), 'este run no dejó línea']));
  const r = correr(GUION, ['--tasa', ruta]);
  assert.equal(r.salida, 0);
  assert.match(r.texto, /\[señal de nombres · tasa\] 2 de 3 runs medidos con nombres ausentes \(66\.7 %\) · población 4 runs · sin medir 1 · NO SE PUEDE DECIR/);
  // y con la lista VACÍA la línea sale igual, con su población
  fs.writeFileSync(ruta, '[]');
  assert.match(correr(GUION, ['--tasa', ruta]).texto, /\[señal de nombres · tasa\] 0 de 0 runs medidos con nombres ausentes \(sin tasa\) · población 0 runs/);
});
