// tests/scrum1412-tanda-por-tramos.test.mjs — SCRUM-1412
//
// Lo que se vio USANDO `tanda:dirigida`, cada cosa con su caso y su control:
//   ① «2 fail» y un solo nombre: un caído ANIDADO se cuenta y no se nombraba;
//   ② un test que en esta máquina no puede medir salía como un rojo más;
//   ③ una línea por lote al terminar;
//   ④ `--tramo i/n`: el veredicto EXIGE los n tramos del mismo árbol — si falta uno, CIEGO;
//   ⑤ ninguna estimación de tiempo que no salga de una duración medida.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { temporal, borrarTemporal } from './_temporal.mjs';
import {
  caidosDelTap, sinNombrar, CONDICIONES, leerCiegosDeclarados, partirCaidos, veredictoDeLaDirigida,
  duracion, lineaDeLote, parsearTramo, tramoDe, tramosPropuestos, huellaDeLaPasada, dirDeLaPasada,
  guardarTramo, leerTramos, olvidarPasada, resumenDeTramos, lineasDelResumen, FICHEROS_POR_TRAMO,
} from '../scripts/_tanda-por-tramos.mjs';
import { cuentasDelTap, leerArgumentos } from '../scripts/tests-que-cubren.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DECLARADOS = path.join(RAIZ, 'scripts', '_ciegos-por-entorno-declarados.json');

// El rojo, declarado: lo ejecuta `npm run meta:mutaciones`.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Vuelta al defecto: sólo los `not ok` de primer nivel.
    fichero: 'scripts/_tanda-por-tramos.mjs',
    de: 'matchAll(/^[ \\t]*not ok \\d+ - (.*)$/gm)',
    a: 'matchAll(/^not ok \\d+ - (.*)$/gm)',
    cae: 'SCRUM-1412 · ① un caído ANIDADO se nombra: «2 fail» ya no sale con un solo nombre',
  },
  {
    // La discrepancia, otra vez muda.
    fichero: 'scripts/_tanda-por-tramos.mjs',
    de: '  return Math.max(0, fail - caidos.length);',
    a: '  return 0;',
    cae: 'SCRUM-1412 · ① 🔴 si el TAP cuenta más caídos de los que sé nombrar, se DICE cuántos, y es rojo',
  },
  {
    // Un ciego por entorno sin medir la condición: taparía el rojo en la máquina donde SÍ se mide.
    fichero: 'scripts/_tanda-por-tramos.mjs',
    de: '    if (d && CONDICIONES[d.condicion](entorno)) porEntorno.push(',
    a: '    if (d) porEntorno.push(',
    cae: 'SCRUM-1412 · ② 🔴 con la condición SIN cumplirse, el mismo caído es un rojo normal',
  },
  {
    // Un resumen que no exige los n tramos: lo visto pasaría por verde.
    fichero: 'scripts/_tanda-por-tramos.mjs',
    de: '  const ciego = faltan.length > 0 || total.ciegos.length > 0;',
    a: '  const ciego = total.ciegos.length > 0;',
    cae: 'SCRUM-1412 · ④ 🔴 si falta un tramo, la pasada es CIEGA aunque lo visto esté en verde',
  },
  {
    // La huella sin el árbol: tramos de dos árboles distintos se sumarían.
    fichero: 'scripts/_tanda-por-tramos.mjs',
    de: 'update(JSON.stringify({ elegidos, n, arbol }))',
    a: 'update(JSON.stringify({ elegidos, n }))',
    cae: 'SCRUM-1412 · ④ 🔴 si el árbol cambia entre tramos, lo visto antes NO cuenta: faltan tramos',
  },
];

// Un TAP como el que escribe `node --test` (medido el 2-oct-2026): el hijo que cae, sangrado; el
// padre, de primer nivel, cae por `subtestsFailed`; `# fail` cuenta los DOS.
const TAP_ANIDADO = [
  'TAP version 13',
  '# Subtest: padre',
  '    # Subtest: hijo que cae',
  '    not ok 1 - hijo que cae',
  '      ---',
  "      failureType: 'testCodeFailure'",
  '      ...',
  '    1..1',
  'not ok 1 - padre',
  '  ---',
  "  failureType: 'subtestsFailed'",
  '  ...',
  '# Subtest: suelto',
  'ok 2 - suelto',
  '1..2',
  '# tests 3',
  '# pass 1',
  '# fail 2',
].join('\n');

const PUERTA_1B = 'SCRUM-1321 · 🔴 PUERTA 1b: un ancla que casa DOS veces sale CIEGA nombrando las líneas, y NO se muta nada';
const OTRA_UNIDAD = { raiz: 'D:\\arbol\\repo', tmp: 'C:\\Users\\x\\AppData\\Local\\Temp' };
const MISMA_UNIDAD = { raiz: 'D:\\arbol\\repo', tmp: 'D:\\tmp' };
const tramo = (i, n, extra = {}) => ({ i, n, ficheros: 10, tests: 100, pass: 100, fail: 0, ms: 60000, tuyos: [], porEntorno: [], sinNombrar: 0, ciegos: [], ...extra });

test('SCRUM-1412 · ① un caído ANIDADO se nombra: «2 fail» ya no sale con un solo nombre', () => {
  assert.deepEqual(caidosDelTap(TAP_ANIDADO), ['hijo que cae', 'padre']);
  const c = cuentasDelTap(TAP_ANIDADO);
  assert.equal(c.fail, 2);
  assert.equal(c.caidos.length, c.fail, 'tantos nombres como caídos cuenta el TAP');
  assert.equal(sinNombrar(c.fail, c.caidos), 0);
  // Control: un `ok` no es un caído, y una línea de diagnóstico que DICE «not ok» tampoco.
  assert.deepEqual(caidosDelTap("ok 1 - va bien\n  error: 'salió not ok 3 - en el mensaje'\n"), []);
});

test('SCRUM-1412 · ① 🔴 si el TAP cuenta más caídos de los que sé nombrar, se DICE cuántos, y es rojo', () => {
  assert.equal(sinNombrar(2, ['uno']), 1);
  assert.equal(sinNombrar(null, []), null, 'sin recuento no se sabe: no es un cero');
  const v = veredictoDeLaDirigida({ fail: 2, caidos: ['uno'] }, [], MISMA_UNIDAD);
  assert.equal(v.sinNombrar, 1);
  assert.equal(v.salida, 1);
  assert.ok(v.lineas.some((l) => /NO SUPE NOMBRAR 1 de los 2 caídos/.test(l)), v.lineas.join('\n'));
  // Aunque el ÚNICO nombrado sea un ciego por entorno, el que falta por nombrar sigue siendo rojo.
  const w = veredictoDeLaDirigida({ fail: 2, caidos: [PUERTA_1B] }, leerCiegosDeclarados(DECLARADOS), OTRA_UNIDAD);
  assert.equal(w.salida, 1);
  // Control: con todos nombrados no hay aviso.
  const x = veredictoDeLaDirigida({ fail: 1, caidos: ['uno'] }, [], MISMA_UNIDAD);
  assert.ok(!x.lineas.some((l) => /NO SUPE NOMBRAR/.test(l)));
});

test('SCRUM-1412 · ② un caído declarado, con la condición MEDIDA en la máquina, sale aparte y no decide la salida', () => {
  const declarados = leerCiegosDeclarados(DECLARADOS);
  assert.ok(declarados.length >= 1, 'población: la lista de declarados no está vacía');
  const v = veredictoDeLaDirigida({ fail: 1, caidos: [PUERTA_1B] }, declarados, OTRA_UNIDAD);
  assert.deepEqual(v.tuyos, []);
  assert.equal(v.porEntorno.length, 1);
  assert.equal(v.salida, 0);
  assert.ok(v.lineas.some((l) => l.includes('ciego por entorno, no es tu cambio') && l.includes('PUERTA 1b')), v.lineas.join('\n'));
  assert.ok(v.lineas.some((l) => /De los 1 fail, 1 son ciegos por entorno/.test(l)), 'el recuento de fail NO se maquilla: se explica');
  // Un caído que NO está declarado, en la misma máquina, es tuyo.
  const w = veredictoDeLaDirigida({ fail: 2, caidos: [PUERTA_1B, 'otro que cae'] }, declarados, OTRA_UNIDAD);
  assert.deepEqual(w.tuyos, ['otro que cae']);
  assert.equal(w.salida, 1);
});

test('SCRUM-1412 · ② 🔴 con la condición SIN cumplirse, el mismo caído es un rojo normal', () => {
  const v = veredictoDeLaDirigida({ fail: 1, caidos: [PUERTA_1B] }, leerCiegosDeclarados(DECLARADOS), MISMA_UNIDAD);
  assert.deepEqual(v.tuyos, [PUERTA_1B]);
  assert.deepEqual(v.porEntorno, []);
  assert.equal(v.salida, 1);
  // En Linux no hay unidades: la condición no se cumple nunca, y en el CI el test cuenta siempre.
  assert.equal(CONDICIONES['temporal-en-otra-unidad']({ raiz: '/home/runner/work/repo', tmp: '/tmp' }), false);
  assert.equal(CONDICIONES['temporal-en-otra-unidad'](OTRA_UNIDAD), true);
  assert.equal(CONDICIONES['temporal-en-otra-unidad']({ raiz: 'd:\\a', tmp: 'D:\\b' }), false, 'la letra de la unidad no distingue mayúsculas');
});

test('SCRUM-1412 · ② el nombre declarado es el de un test que EXISTE hoy, y por nombre EXACTO', () => {
  const declarados = leerCiegosDeclarados(DECLARADOS);
  for (const d of declarados) {
    const prefijo = /^SCRUM-(\d+[a-z]?)/.exec(d.test);
    assert.ok(prefijo, `«${d.test}» no empieza por su ticket`);
    const ficheros = fs.readdirSync(path.join(RAIZ, 'tests')).filter((f) => f.startsWith(`scrum${prefijo[1]}-`) && f.endsWith('.test.mjs'));
    assert.ok(ficheros.some((f) => fs.readFileSync(path.join(RAIZ, 'tests', f), 'utf8').includes(`test('${d.test}'`)),
      `🔴 «${d.test}» está declarado ciego por entorno y ningún test se llama así: la declaración caducó y ya no tapa nada… ni avisa.`);
  }
  // Un prefijo no es un nombre: un caído que EMPIEZA igual no se cuela.
  const { tuyos } = partirCaidos([`${PUERTA_1B} (otro)`], declarados, OTRA_UNIDAD);
  assert.equal(tuyos.length, 1);
});

test('SCRUM-1412 · ② una declaración con una condición que no sé medir LANZA: no es un ciego, es un error', () => {
  const dir = temporal('scrum1412-');
  try {
    const f = path.join(dir, 'declarados.json');
    fs.writeFileSync(f, JSON.stringify([{ test: 'x', condicion: 'luna-llena', motivo: 'm' }]));
    assert.throws(() => leerCiegosDeclarados(f), /condición «luna-llena» desconocida/);
    fs.writeFileSync(f, JSON.stringify([{ test: 'x', condicion: 'temporal-en-otra-unidad' }]));
    assert.throws(() => leerCiegosDeclarados(f), /«test» y «motivo»/);
  } finally { borrarTemporal(dir); }
});

test('SCRUM-1412 · ③ la línea de cada lote: cuál, cuántos ficheros, tests, fail y lo que TARDÓ', () => {
  assert.equal(lineaDeLote({ i: 3, n: 9, ficheros: 48, tests: 512, fail: 0, ms: 100000 }), 'lote 3/9 · 48 ficheros · 512 tests · 0 fail · 1m40s');
  assert.equal(lineaDeLote({ i: 1, n: 1, ficheros: 5, tests: null, fail: null, ms: 4000 }), 'lote 1/1 · 5 ficheros · SIN RECUENTO · 4s',
    'un lote que no dejó recuento lo DICE: no sale «0 fail»');
  assert.equal(duracion(59400), '59s');
  assert.equal(duracion(605000), '10m05s');
});

test('SCRUM-1412 · ④ los tramos parten la selección sin solapes ni huecos', () => {
  const elegidos = Array.from({ length: 228 }, (_, k) => `tests/t${String(k).padStart(3, '0')}.test.mjs`);
  for (const n of [1, 3, 4, 7, 228]) {
    const juntos = [];
    for (let i = 1; i <= n; i++) juntos.push(...tramoDe(elegidos, i, n));
    assert.deepEqual(juntos, elegidos, `n=${n}: la unión de los tramos es la selección, en su orden`);
  }
  assert.equal(tramoDe(elegidos, 1, 4).length, 57);
  assert.throws(() => tramoDe(elegidos, 1, 229), /no hay 229 tramos en 228 ficheros/);
  assert.equal(tramosPropuestos(426), Math.ceil(426 / FICHEROS_POR_TRAMO));
  assert.deepEqual(parsearTramo('2/4'), { i: 2, n: 4 });
  for (const malo of ['0/4', '5/4', '2', '2/', 'a/b', '', undefined, '2/4/6']) assert.equal(parsearTramo(malo), null, `«${malo}»`);
});

test('SCRUM-1412 · ④ los argumentos: `--tramo i/n` y `--resumen-de n` no se confunden con ficheros', () => {
  const a = leerArgumentos(['--lanzar', '--tramo', '2/4']);
  assert.deepEqual(a.tramo, { i: 2, n: 4 });
  assert.deepEqual(a.dados, [], '🔴 «2/4» se ha leído como un fichero tocado');
  assert.ok(a.banderas.has('--lanzar'));
  assert.equal(a.error, null);
  assert.deepEqual(leerArgumentos(['--tramo=3/3']).tramo, { i: 3, n: 3 });
  assert.equal(leerArgumentos(['--resumen-de', '4']).resumenDe, 4);
  assert.deepEqual(leerArgumentos(['.\\src\\a.ts', '--porque']).dados, ['src/a.ts']);
  // Un valor mal formado es un error: no se cae en silencio a la pasada ENTERA.
  for (const malos of [['--lanzar', '--tramo', '5/4'], ['--lanzar', '--tramo'], ['--resumen-de', 'x'], ['--tramo=']]) {
    assert.ok(leerArgumentos(malos).error, JSON.stringify(malos));
  }
});

test('SCRUM-1412 · ④ con los n tramos vistos y limpios, la pasada es VERDE y suma lo medido', () => {
  const r = resumenDeTramos([tramo(1, 3), tramo(2, 3), tramo(3, 3)], 3);
  assert.equal(r.veredicto, 'VERDE');
  assert.deepEqual(r.faltan, []);
  assert.equal(r.total.tests, 300);
  assert.equal(r.total.ms, 180000);
  assert.match(lineasDelResumen(r).join('\n'), /vistos 3 de 3 \(1, 2, 3\) · 30 ficheros · 300 tests · 300 pass · 0 fail · 3m00s medidos/);
});

test('SCRUM-1412 · ④ 🔴 si falta un tramo, la pasada es CIEGA aunque lo visto esté en verde', () => {
  const r = resumenDeTramos([tramo(1, 4), tramo(2, 4), tramo(4, 4)], 4);
  assert.equal(r.veredicto, 'CIEGO');
  assert.deepEqual(r.faltan, [3]);
  const texto = lineasDelResumen(r).join('\n');
  assert.match(texto, /CIEGO: faltan los tramos 3 de 4/);
  assert.match(texto, /VEREDICTO DE LA PASADA: CIEGO/);
  assert.doesNotMatch(texto, /VERDE/);
  assert.equal(resumenDeTramos([], 4).veredicto, 'CIEGO', 'sin ningún tramo visto tampoco hay verde');
  // Un tramo de OTRA partición (2/5) no rellena el hueco de la de 4.
  assert.deepEqual(resumenDeTramos([tramo(1, 4), tramo(2, 5)], 4).faltan, [2, 3, 4]);
});

test('SCRUM-1412 · ④ un rojo visto es ROJO aunque falten tramos; un lote sin medir deja la pasada CIEGA', () => {
  const rojo = resumenDeTramos([tramo(1, 2, { fail: 1, pass: 99, tuyos: ['el que cae'] })], 2);
  assert.equal(rojo.veredicto, 'ROJO');
  assert.match(lineasDelResumen(rojo).join('\n'), /not ok · el que cae/);
  const sinNombre = resumenDeTramos([tramo(1, 1, { fail: 2, sinNombrar: 1 })], 1);
  assert.equal(sinNombre.veredicto, 'ROJO');
  const ciego = resumenDeTramos([tramo(1, 2), tramo(2, 2, { ciegos: ['lote 1: sin recuento'] })], 2);
  assert.equal(ciego.veredicto, 'CIEGO');
  // Los ciegos por entorno se enseñan y NO deciden.
  const entorno = resumenDeTramos([tramo(1, 1, { fail: 1, porEntorno: [{ test: PUERTA_1B }] })], 1);
  assert.equal(entorno.veredicto, 'VERDE');
  assert.match(lineasDelResumen(entorno).join('\n'), /ciego por entorno, no es tu cambio · SCRUM-1321/);
});

test('SCRUM-1412 · ④ 🔴 si el árbol cambia entre tramos, lo visto antes NO cuenta: faltan tramos', () => {
  const base = temporal('scrum1412-');
  try {
    const elegidos = ['tests/a.test.mjs', 'tests/b.test.mjs'];
    const antes = dirDeLaPasada(base, huellaDeLaPasada({ elegidos, n: 2, arbol: 'arbol-uno' }));
    guardarTramo(antes, tramo(1, 2));
    assert.deepEqual(resumenDeTramos(leerTramos(antes), 2).faltan, [2], 'control: sobre el MISMO árbol, el tramo 1 sí está visto');
    // Se edita un fichero: otro árbol, otra pasada.
    const despues = dirDeLaPasada(base, huellaDeLaPasada({ elegidos, n: 2, arbol: 'arbol-dos' }));
    assert.notEqual(despues, antes);
    guardarTramo(despues, tramo(2, 2));
    const r = resumenDeTramos(leerTramos(despues), 2);
    assert.deepEqual(r.faltan, [1]);
    assert.equal(r.veredicto, 'CIEGO');
    // Y otra SELECCIÓN u otro número de tramos tampoco comparten registro.
    assert.notEqual(huellaDeLaPasada({ elegidos: ['tests/a.test.mjs'], n: 2, arbol: 'arbol-uno' }), huellaDeLaPasada({ elegidos, n: 2, arbol: 'arbol-uno' }));
    assert.notEqual(huellaDeLaPasada({ elegidos, n: 3, arbol: 'arbol-uno' }), huellaDeLaPasada({ elegidos, n: 2, arbol: 'arbol-uno' }));
    // Repetir un tramo lo SUSTITUYE, no lo suma dos veces.
    guardarTramo(antes, tramo(1, 2, { tests: 7, pass: 7 }));
    assert.equal(resumenDeTramos(leerTramos(antes), 2).total.tests, 7);
    olvidarPasada(antes);
    assert.deepEqual(leerTramos(antes), []);
  } finally { borrarTemporal(base); }
});

test('SCRUM-1412 · ⑤ ninguna salida lleva una estimación: sólo lo que ya se midió', () => {
  const incompleta = lineasDelResumen(resumenDeTramos([tramo(1, 4)], 4)).join('\n');
  const completa = lineasDelResumen(resumenDeTramos([tramo(1, 1)], 1)).join('\n');
  const lote = lineaDeLote({ i: 1, n: 4, ficheros: 57, tests: 561, fail: 1, ms: 107000 });
  for (const salida of [incompleta, completa, lote]) {
    assert.doesNotMatch(salida, /estimad|quedan? (unos|aprox)|faltan? (unos|aprox)|ETA|~\s*\d/i, salida);
  }
  assert.match(incompleta, /1m00s medidos/, 'el tiempo que sale es el medido, y lo dice');
});
