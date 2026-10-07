// tests/scrum1392-un-hallazgo-visto-no-caduca.test.mjs — SCRUM-1392
//
// `recorrerCasos` sumaba lo que cada caso DEVOLVÍA. Un caso que apuntaba un hallazgo en una lista
// suya y después lanzaba no llegaba a devolverla: salía 2 («no supe medir») con el defecto ya visto.
// Visto ocurrir con navegador en `guard-duplicar-926` (docs/master/SCRUM-1392.md).
//
//   ① la pieza: lo apuntado en las listas que ENTREGA el recorrido sobrevive a un caso que lanza;
//   ② el positivo que puede tumbarlo: lanzar con las manos vacías sigue siendo un ciego, y sale 2;
//   ③ la línea del recorrido sale SIEMPRE, también con ceros;
//   ④ ningún guard lleva una lista de hallazgos en la mano — sin lista de excepciones;
//   ⑤ el banco con navegador está guardado y dice lo que se vio, antes y después.
//
// ⚠️ LÍMITE de ④, dicho aquí: el lector es `tests/_lista-en-la-mano.mjs` y no ve una lista que nace
// en una función y se apunta en otra, ni sigue imports (`LIMITES_DEL_CENSO`).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  veredictoDe, recorrerCasos, MARCA_RECORRIDO, SALIDA_HALLAZGO, SALIDA_NO_SUPE_MEDIR, SALIDA_VERDE,
} from '../scripts/_hallazgos-y-ciegos.mjs';
import { censoDeFuente, defectosDeFuente, LIMITES_DEL_CENSO } from './_lista-en-la-mano.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_SCRIPTS = path.join(RAIZ, 'scripts');
const callado = () => {};

// ── ① LA PIEZA ─────────────────────────────────────────────────────────────────────────────────

test('SCRUM-1392 · ① un caso que apunta en las listas ENTREGADAS y después lanza conserva lo que vio', async () => {
  const r = await recorrerCasos(['390 px'], async (caso, suyas) => {
    suyas.hallazgos.push(caso + ': la nota no cabe');
    throw new Error('Execution context was destroyed');
  }, String, callado);
  assert.deepEqual(r.hallazgos, ['390 px: la nota no cabe'], 'el hallazgo ya visto llega, aunque el caso reviente después');
  assert.deepEqual(r.ciegos, ['390 px: no se pudo medir — Execution context was destroyed'], 'y el ciego del lanzamiento se apunta igual');
  assert.deepEqual([r.lanzaron, r.lanzaronConHallazgos], [1, 1]);
  const v = veredictoDe(r);
  assert.equal(v.codigo, SALIDA_HALLAZGO, 'antes del arreglo esto salía con 2 y sin el hallazgo');
  assert.equal(v.estado, 'HALLAZGO Y CIEGO');
});

test('SCRUM-1392 · ② EL POSITIVO: lanzar con las manos vacías sigue siendo un ciego, y sale 2', async () => {
  // Si el arreglo convirtiera todo lanzamiento en hallazgo, este caso saldría con 1.
  const r = await recorrerCasos(['390 px'], async () => { throw new Error('Execution context was destroyed'); }, String, callado);
  assert.deepEqual(r.hallazgos, []);
  assert.equal(r.ciegos.length, 1);
  assert.deepEqual([r.lanzaron, r.lanzaronConHallazgos], [1, 0]);
  assert.equal(veredictoDe(r).codigo, SALIDA_NO_SUPE_MEDIR);
  // Y un ciego apuntado en las listas entregadas antes de lanzar no se vuelve hallazgo: son dos ciegos.
  const soloCiegos = await recorrerCasos(['a'], async (c, suyas) => { suyas.ciegos.push('a: la caja mide 0'); throw new Error('se cayó'); }, String, callado);
  assert.deepEqual([soloCiegos.hallazgos.length, soloCiegos.ciegos.length, soloCiegos.lanzaronConHallazgos], [0, 2, 0]);
  assert.equal(veredictoDe(soloCiegos).codigo, SALIDA_NO_SUPE_MEDIR);
});

test('SCRUM-1392 · ① lo entregado no se cuenta dos veces, ni se pierde si el caso devuelve otras listas', async () => {
  // Devuelve las MISMAS listas que recibió: una vez.
  const mismas = await recorrerCasos(['a'], async (c, suyas) => { suyas.hallazgos.push('a: no cabe'); return suyas; }, String, callado);
  assert.deepEqual(mismas.hallazgos, ['a: no cabe']);
  // Devuelve la lista entregada dentro de un objeto nuevo (la forma de los guards de caja): una vez.
  const dentro = await recorrerCasos(['a'], async (c, suyas) => { suyas.hallazgos.push('a: no cabe'); return { hallazgos: suyas.hallazgos, ciegos: [] }; }, String, callado);
  assert.deepEqual(dentro.hallazgos, ['a: no cabe']);
  // Apunta en las entregadas y devuelve OTRAS: cuentan las dos.
  const otras = await recorrerCasos(['a'], async (c, suyas) => { suyas.hallazgos.push('a: entregado'); return { hallazgos: ['a: devuelto'], ciegos: [] }; }, String, callado);
  assert.deepEqual(otras.hallazgos.slice().sort(), ['a: devuelto', 'a: entregado']);
  // El caso que no usa lo entregado sigue como estaba (los seis guards con listas del módulo).
  const viejo = await recorrerCasos(['a', 'b'], async (c) => ({ hallazgos: c === 'b' ? ['b: no cabe'] : [], ciegos: [] }), String, callado);
  assert.deepEqual([viejo.hallazgos, viejo.ciegos, viejo.recorridos, viejo.lanzaron], [['b: no cabe'], [], 2, 0]);
});

test('SCRUM-1392 · ① EL LÍMITE que queda, medido: una lista que nace DENTRO del caso se sigue perdiendo', async () => {
  // La pieza no puede rescatar lo que no ve. Por eso existe ④: que ningún guard la lleve así.
  const r = await recorrerCasos(['390 px'], async (caso) => {
    const suyos = [];
    suyos.push(caso + ': la nota no cabe');
    throw new Error('Execution context was destroyed');
  }, String, callado);
  assert.deepEqual([r.hallazgos.length, r.lanzaron, r.lanzaronConHallazgos], [0, 1, 0]);
  assert.equal(veredictoDe(r).codigo, SALIDA_NO_SUPE_MEDIR);
});

// ── ③ LA LÍNEA ─────────────────────────────────────────────────────────────────────────────────

test('SCRUM-1392 · ③ la línea del recorrido sale SIEMPRE, una por recorrido, también con ceros', async () => {
  const dichas = [];
  const decir = (l) => dichas.push(l);
  const limpio = await recorrerCasos(['a', 'b'], async () => ({ hallazgos: [], ciegos: [] }), String, decir);
  assert.deepEqual(dichas, [MARCA_RECORRIDO + ' 2 casos recorridos · 0 lanzaron · 0 de ésos traían hallazgos en las listas del recorrido']);
  assert.equal(limpio.linea, dichas[0]);
  assert.equal(veredictoDe(limpio).codigo, SALIDA_VERDE);

  await recorrerCasos(['a', 'b', 'c'], async (c, suyas) => {
    if (c === 'a') { suyas.hallazgos.push('a: visto'); throw new Error('se cayó'); }
    if (c === 'b') throw new Error('se cayó');
    return suyas;
  }, String, decir);
  assert.equal(dichas[1], MARCA_RECORRIDO + ' 3 casos recorridos · 2 lanzaron · 1 de ésos traía hallazgos en las listas del recorrido');

  await recorrerCasos(['a'], async () => { throw new Error('se cayó'); }, String, decir);
  assert.equal(dichas[2], MARCA_RECORRIDO + ' 1 caso recorrido · 1 lanzó · 0 de ésos traían hallazgos en las listas del recorrido');

  // Cero casos: la línea sale igual, y el suelo de SCRUM-1327 sigue en pie.
  const vacio = await recorrerCasos([], async () => ({ hallazgos: [], ciegos: [] }), String, decir);
  assert.equal(dichas[3], MARCA_RECORRIDO + ' 0 casos recorridos · 0 lanzaron · 0 de ésos traían hallazgos en las listas del recorrido');
  assert.equal(veredictoDe(vacio).codigo, SALIDA_NO_SUPE_MEDIR);
  assert.equal(dichas.length, 4, 'una línea por recorrido, ni más ni menos');
});

test('SCRUM-1392 · ③ sin decirle a quién, la línea va a la salida del guard', async () => {
  const original = console.log;
  const vistas = [];
  console.log = (l) => vistas.push(String(l));
  try {
    await recorrerCasos(['a'], async () => ({ hallazgos: [], ciegos: [] }));
  } finally { console.log = original; }
  assert.deepEqual(vistas, [MARCA_RECORRIDO + ' 1 caso recorrido · 0 lanzaron · 0 de ésos traían hallazgos en las listas del recorrido']);
});

// ── ④ NINGÚN GUARD LLEVA LA LISTA EN LA MANO ───────────────────────────────────────────────────

const CABEZA = "import { recorrerCasos } from './_hallazgos-y-ciegos.mjs';\n";

test('SCRUM-1392 · ④ el lector VE una lista en la mano, y no ve una donde no la hay', () => {
  // La forma de los guards de caja: nace en el caso y se devuelve.
  const directa = CABEZA + 'await recorrerCasos(C, async (c) => { const suyos = []; suyos.push(c); return { hallazgos: suyos, ciegos: [] }; });';
  assert.equal(defectosDeFuente(directa).length, 1);
  assert.match(defectosDeFuente(directa)[0], /«suyos» nace dentro del caso/);
  // La forma de `guard-duplicar-926`: nace en una función que el caso llama, con awaits detrás, y vuelve dentro de un objeto.
  const enAyudante = CABEZA + 'const abrir = async (c) => { const errores = []; p.on("pageerror", (e) => errores.push(e)); await p.goto(c); return { p, errores }; };\n'
    + 'await recorrerCasos(C, async (c) => { const r = await abrir(c); informe[c] = r; return VACIO; });';
  const censo = censoDeFuente(enAyudante).llamadas[0].enLaMano;
  assert.equal(censo.length, 1);
  assert.deepEqual([censo[0].lista, censo[0].awaitsDespues.length], ['errores', 1]);
  assert.equal(defectosDeFuente(enAyudante).length, 1);
  // Con otro nombre de import y a través de un objeto de funciones (`MEDIR[pantalla]`).
  const porObjeto = "import { recorrerCasos as rc } from '../scripts/_hallazgos-y-ciegos.mjs';\n"
    + 'function informar(m) { const suyas = { hallazgos: [], ciegos: [] }; for (const c of m) suyas.hallazgos.push(c); return suyas; }\n'
    + 'const MEDIR = { listado: async (a) => informar(a) };\nawait rc(C, async (c) => MEDIR[c.pantalla](c));';
  assert.equal(defectosDeFuente(porObjeto).length, 1);
  assert.match(defectosDeFuente(porObjeto)[0], /«suyas\.hallazgos»/);

  // Los CEROS: la lista del módulo, la entregada, y un recorrido que sólo se nombra en un comentario.
  assert.deepEqual(defectosDeFuente(CABEZA + 'const hallazgos = [];\nawait recorrerCasos(C, async (c) => { hallazgos.push(c); await p.cerrar(); return VACIO; });'), []);
  assert.deepEqual(defectosDeFuente(CABEZA + 'await recorrerCasos(C, async (c, suyas) => { const suyos = suyas.hallazgos; suyos.push(c); return { hallazgos: suyos, ciegos: [] }; });'), []);
  assert.equal(censoDeFuente('// await recorrerCasos(C, async (c) => { const suyos = []; suyos.push(c); return { hallazgos: suyos }; });\nconst x = 1;').llamadas.length, 0);
  // Una lista de CIEGOS en la mano no es este defecto: si el caso lanza, el ciego sale igual.
  assert.deepEqual(defectosDeFuente(CABEZA + 'await recorrerCasos(C, async (c) => { const mios = []; mios.push(c); return { hallazgos: [], ciegos: mios }; });'), []);
  // Y un caso que no se sabe leer no es un caso limpio.
  assert.equal(defectosDeFuente(CABEZA + 'await recorrerCasos(C, fabrica());').length, 1);
  assert.match(defectosDeFuente(CABEZA + 'await recorrerCasos(C, fabrica());')[0], /no sé leer el caso/);
});

test('SCRUM-1392 · ④ ningún guard de scripts/ lleva una lista de hallazgos en la mano', () => {
  const guards = fs.readdirSync(DIR_SCRIPTS).filter((f) => f.endsWith('.mjs'));
  let llamadas = 0;
  const conRecorrido = [];
  const defectos = [];
  for (const f of guards) {
    const fuente = fs.readFileSync(path.join(DIR_SCRIPTS, f), 'utf8');
    const censo = censoDeFuente(fuente, f);
    if (!censo.llamadas.length) continue;
    conRecorrido.push(f);
    llamadas += censo.llamadas.length;
    for (const d of defectosDeFuente(fuente, f)) defectos.push(f + ' · ' + d);
  }
  // SUELO: «0 defectos» sobre ningún recorrido no es una medición. Los cuatro que se arreglaron
  // aquí tienen que seguir recorriendo: si dejaran de hacerlo, este test dejaría de mirarlos.
  for (const f of ['guard-duplicar-926.mjs', 'guard-caja-datos-del-cliente.mjs', 'guard-caja-documento-suelto.mjs', 'guard-portal-en-la-ficha.mjs']) {
    assert.ok(conRecorrido.includes(f), f + ' ya no recorre con `recorrerCasos`: este test ha dejado de mirarlo');
  }
  assert.ok(llamadas >= conRecorrido.length && conRecorrido.length >= 4);
  assert.deepEqual(defectos, [], `POBLACIÓN: ${guards.length} ficheros de scripts/ · ${conRecorrido.length} recorren · ${llamadas} recorridos.`
    + '\n   Una lista de hallazgos que nace dentro del caso se pierde si el caso lanza después de apuntar.'
    + '\n   Se arregla apuntando en las listas que entrega `recorrerCasos` (su segundo argumento) o en una del módulo. No hay lista de excepciones.');
  assert.ok(LIMITES_DEL_CENSO.length >= 3, 'el lector dice lo que no ve');
});

// ── ⑤ EL BANCO CON NAVEGADOR, GUARDADO ─────────────────────────────────────────────────────────

test('SCRUM-1392 · ⑤ el banco con navegador está guardado: antes el error visto se perdía, después sale', () => {
  const dir = path.join(RAIZ, 'docs', 'master', 'evidencias', 'scrum1392');
  const leer = (etiqueta) => JSON.parse(fs.readFileSync(path.join(dir, etiqueta + '-resumen.json'), 'utf8'));
  const fila = (resumen, id) => resumen.filas.find((f) => f.id === id);
  const antes = leer('antes');
  const despues = leer('despues');
  assert.notEqual(antes.sha, despues.sha, 'antes y después son dos SHA');
  for (const r of [antes, despues]) {
    assert.equal(r.pasadas, 7);
    assert.equal(r.validas, 7, 'una pasada no válida no cuenta ni de verde ni de rojo');
    // Los controles, iguales en los dos: limpio 0 · el error sin lanzar 1 y nombrado · lanzar sin error 2.
    assert.equal(fila(r, 'duplicar-926-limpio').codigo, 0);
    assert.deepEqual([fila(r, 'duplicar-926-error-visto').codigo, fila(r, 'duplicar-926-error-visto').nombraElErrorVisto], [1, true]);
    assert.deepEqual([fila(r, 'duplicar-926-lanza-sin-nada').codigo, fila(r, 'duplicar-926-lanza-sin-nada').nombraLaLecturaRota], [2, true]);
    for (const g of ['caja-datos-del-cliente', 'caja-documento-suelto', 'portal-en-la-ficha']) assert.equal(fila(r, g + '-limpio').codigo, 0);
  }
  const clave = 'duplicar-926-error-visto-y-lanza';
  assert.deepEqual([fila(antes, clave).codigo, fila(antes, clave).nombraElErrorVisto], [2, false], 'el defecto, visto: sale 2 y el error de página no se nombra');
  assert.deepEqual([fila(despues, clave).codigo, fila(despues, clave).nombraElErrorVisto], [1, true], 'después: el error visto cuenta, y sale 1');
  assert.equal(fila(despues, clave).nombraLaLecturaRota, true, 'y el ciego del lanzamiento se sigue diciendo');
});
