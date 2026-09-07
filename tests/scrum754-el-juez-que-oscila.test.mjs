// tests/scrum754-el-juez-que-oscila.test.mjs — SCRUM-754
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// UN JUEZ QUE OSCILA NO SE PUEDE MEDIR, Y ÉSTE OSCILABA
//
// ── EL HECHO, REPRODUCIDO ANTES DE TOCAR NADA (7-sep-2026, 07:09–07:19, este worktree) ──
//
// `npm run meta:mutaciones`, sobre el MISMO fichero y las MISMAS dos declaraciones de
// `scrum751`, daba CIEGAS en una pasada y VIVAS en las siguientes sin cambiar nada. En árbol
// quieto NO se reproduce (5 líneas base seguidas, las 5 en verde). Se reprodujo provocándolo:
// un agitador que crea y BORRA en bucle un `.mjs` **sin defecto** dentro de `tests/`.
//
//     ① árbol quieto ......................... VIVA · VIVA
//     ② árbol moviéndose ..................... CIEGA · CIEGA   ← la oscilación del ticket
//     ③ guard REALMENTE mudo, quieto ......... MUDA
//     ⑤ el MISMO mudo, con el árbol movido ... CIEGA           ← la agitación TAPA la mudez
//
// Y, con la línea base tomada EN QUIETO y la agitación entrando SÓLO en la pasada mutada, con
// una mutación que NO introduce el defecto —o sea, veredicto correcto MUDA—:
//
//     🔴🔴 VIVA · MUDA · VIVA · VIVA  →  TRES VERDES FALSOS DE CUATRO
//
// El meta-guard firmaba como VIVO a un guard que no cayó: el test declarado sí estaba entre los
// caídos, pero se había caído por un ENOENT del barrido, no por la mutación. Y con
// `colaterales 0`, así que ni la medición de SCRUM-784 lo insinuaba.
//
// ── POR QUÉ ES DEFECTO DEL JUEZ ─────────────────────────────────────────────────────────
// Porque **no podía decir sobre qué árbol emitía el veredicto**. Arreglar el barredor de
// `scrum751` —que no adoptó `_barrido-estable.mjs` de SCRUM-740— taparía este caso y dejaría
// la clase abierta: cualquier guard que lea el árbol tiene la misma exposición.
//
// ⛔ Y NO se arregla reintentando. Un instrumento que necesita varias pasadas para dar un
// veredicto estable no está arreglado: está tapado, y encima invita a repetir hasta que salga
// el número que se esperaba, que es la forma más eficaz de dejar de medir sin darse cuenta.
//
// ── LO QUE VIGILA ESTE GUARD ────────────────────────────────────────────────────────────
//   ① el observador VE el transitorio (y NO llama movimiento a una lectura);
//   ② PUERTA 0 — una línea base tomada sobre un árbol movido no se juzga;
//   ③ PUERTA 3 — va ANTES de `cayo()`, que es lo que impide el verde falso;
//   ④ el arranque exige CONTROL POSITIVO de la vigilancia y sale CIEGO si no lo tiene.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url'; // SCRUM-730
import ts from 'typescript';
import {
  FAMILIAS_VIGILADAS, porQueEsMovimiento, movimientosConfirmados, abrirVigilancia,
  controlPositivoDeVigilancia, MARGEN_MS, instanteDeReferencia,
} from '../scripts/_arbol-quieto.mjs';
import { aplicarUna } from '../scripts/meta-guard-mutaciones.mjs';
import { procesoVivo, restaurarDesdeMarca, marcarEnVuelo } from '../scripts/_marca-de-arbol.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const JUEZ = 'scripts/meta-guard-mutaciones.mjs';

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① EL OBSERVADOR · las dos mitades, porque una sola no distingue
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-754 · el observador VE el transitorio y NO llama movimiento a una lectura', () => {
  const ahora = Date.now();

  // ① lo que NO está: es el caso que fabricó los tres verdes falsos, y el que una huella
  //    antes/después no puede ver — en las dos fotos el fichero está ausente.
  assert.ok(porQueEsMovimiento(path.join(RAIZ, 'tests', 'no-existe-jamas-754.mjs'), ahora),
    '🔴 CIEGO al transitorio: un fichero que nació y murió mientras se medía no sale como '
    + 'movimiento, que es exactamente la avería de SCRUM-754.');

  // ② lo que se ESCRIBIÓ durante la medición.
  const stEscrito = () => ({ mtimeMs: ahora + 10 });
  assert.ok(porQueEsMovimiento('da-igual', ahora, stEscrito),
    '🔴 CIEGO a la escritura: un fichero tocado durante la medición no sale como movimiento.');

  // ③ 🔴 Y LA MITAD QUE IMPIDE APAGAR EL INSTRUMENTO POR EL OTRO LADO. Sin esto, un observador
  //    que gritara siempre pasaría ① y ②, y los 7 guards del censo (7-sep-2026) que importan de `dist/`
  //    —en Windows leer emite `change`— saldrían CIEGOS: el meta-guard quedaría inservible.
  const stLeido = () => ({ mtimeMs: ahora - 10_000 });
  assert.equal(porQueEsMovimiento('da-igual', ahora, stLeido), null,
    '🔴 FALSO POSITIVO: una LECTURA sale como movimiento. Con ese criterio saldrían CIEGOS los '
    + 'guards sanos que importan de `dist/`, y eso no es arreglar el juez: es apagarlo.');

  // ④ y el agregado no puede inventar población: sin candidatos no hay movimientos.
  assert.deepEqual(movimientosConfirmados([], ahora, RAIZ), [],
    '🔴 el agregado inventa movimientos sobre CERO candidatos.');
});

/**
 * 🔴 LO QUE ESCRIBE EL INSTRUMENTO NO ES «EL ÁRBOL MOVIÉNDOSE»: ES LA MEDICIÓN.
 *
 * Lo destapó la PRIMERA pasada completa con las puertas puestas (7-sep-2026, 07:48→08:07):
 * `vivas 144 · mudas 0 · ciegas 4`, y las CUATRO eran `scrum765` acusando a
 * `scripts/meta-guard-mutaciones.mjs` de haberse escrito «mientras medía». Lo había escrito el
 * propio meta-guard un milisegundo antes; los subprocesos de ese guard lo IMPORTAN, y en Windows
 * leer emite `change`, así que la pieza entraba como candidato y el corte del `mtime` la daba por
 * movida. Un instrumento que se autodenuncia sale CIEGO siempre, y eso es apagarlo.
 *
 * ⛔ Y NO se arregla con una lista de rutas exentas: eso taparía que OTRO tocara ese mismo
 * fichero, que es más grave que cualquier movimiento. Se arregla por BYTES.
 */
test('SCRUM-754 · una pieza MÍA intacta no es movimiento; la MÍA cambiada sí, y con otro nombre', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum754-propias-'));
  try {
    const pieza = path.join(dir, 'mutada.mjs');
    fs.writeFileSync(pieza, 'export const x = 1; // mutacion\n');
    const mios = fs.readFileSync(pieza);
    const desde = Date.now() - 5_000; // su `mtime` cae DENTRO de la ventana, como en el caso real

    // ① intacta: es mi mutación, no es el árbol moviéndose.
    assert.deepEqual(movimientosConfirmados([pieza], desde, dir, undefined, new Map([[pieza, mios]])), [],
      '🔴 el instrumento se denuncia a sí mismo: la pieza que ACABA de escribir para medir sale '
      + 'como movimiento, y entonces todo lo que mida saldrá CIEGO.');

    // ② 🔴 CONTROL EN EL OTRO SENTIDO, y sin él lo de arriba sería una lista blanca: si la pieza
    //    ya NO tiene mis bytes, alguien más la ha tocado — y eso es MÁS grave, no menos.
    fs.writeFileSync(pieza, 'export const x = 2; // me la han cambiado por debajo\n');
    const dicho = movimientosConfirmados([pieza], desde, dir, undefined, new Map([[pieza, mios]]));
    assert.equal(dicho.length, 1,
      '🔴 alguien ha cambiado la pieza que yo estaba usando de mutación y el instrumento se calla. '
      + 'Eso ya no es exención: es una lista blanca por ruta, que es lo que NO se quería.');
    assert.match(dicho[0], /YA NO TIENE MIS BYTES/,
      '🔴 lo dice, pero no dice QUÉ ha pasado: sin el motivo nadie sabe si mirar el árbol o el reloj.');

    // ③ y sin `propias`, el mismo candidato SÍ es movimiento: la exención viene de los bytes, no
    //    de que el agregado haya dejado de mirar.
    assert.equal(movimientosConfirmados([pieza], desde, dir).length, 1,
      '🔴 sin `propias` tampoco lo ve: entonces no es que exente lo mío, es que está ciego.');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * 🔴 EL MARGEN LLEVA SUELO **Y TOPE**, y los dos hacen falta.
 *
 * Medido el 7-sep-2026 en esta máquina: `Date.now()` da milisegundos enteros y `mtimeMs` trae
 * fracción, así que con margen CERO **151 de 200** escrituras hechas ANTES del arranque salían
 * como «lo escribieron mientras medía» (desfase de hasta +1,76 ms), y la granularidad del sistema
 * de ficheros llega a 4,0 ms entre marcas distintas. Un margen por debajo de eso devuelve el
 * instrumento al CIEGO perpetuo.
 *
 * Y el TOPE, que es la mitad que se olvida: el margen es tiempo en el que NO se vigila. Subirlo
 * «por si acaso» es la forma barata de que deje de aparecer un rojo molesto, y a partir de cierto
 * punto se traga movimientos reales — el guard más corto del censo dura 0,3 s.
 */
test('SCRUM-754 · SUELO Y TOPE del margen: ni ciego perpetuo ni ventana que se traga la pasada', () => {
  assert.ok(MARGEN_MS >= 10,
    `🔴 SUELO: el margen es ${MARGEN_MS} ms y el desfase medido llega a 1,76 ms más 4,0 ms de `
    + 'granularidad del FS. Por debajo de eso, una escritura ANTERIOR al arranque cuenta como '
    + 'movimiento: medido, 151 falsos positivos de 200 con margen 0. Todo saldría CIEGO.');
  assert.ok(MARGEN_MS <= 100,
    `🔴 TOPE: el margen es ${MARGEN_MS} ms, y el margen es tiempo SIN VIGILAR. El guard más corto `
    + 'del censo dura 0,3 s: un margen que crece deja de ver movimientos reales, y subirlo es la '
    + 'forma barata de que un rojo incómodo deje de salir.');
  assert.ok(instanteDeReferencia(1000) > 1000,
    '🔴 la referencia no va por delante del reloj: el margen no se está aplicando.');
});

test('SCRUM-754 · SUELO: el perímetro vigilado no puede encoger en silencio', () => {
  // Escritos A MANO. Si alguien retira una familia del perímetro, el diff lo tiene que decir en
  // voz alta: un movimiento en una familia sin vigilar no lo ve nadie, y el veredicto no lo sabe.
  for (const fam of ['tests', 'scripts', 'src', 'public', 'prisma', 'docs', 'dist']) {
    assert.ok(FAMILIAS_VIGILADAS.includes(fam),
      `🔴 \`${fam}/\` ha salido del perímetro: un movimiento ahí sería invisible y los veredictos `
      + 'seguirían saliendo como si el árbol hubiera estado quieto.');
  }
  // `dist/` entra por SCRUM-763: allí quedó DECLARADO que `npm test` empieza por `npm run build`,
  // así que una suite corriendo al lado recompila el árbol a mitad de medición.
  assert.ok(FAMILIAS_VIGILADAS.includes('dist'),
    '🔴 sin `dist/` vigilado vuelve el hueco declarado en SCRUM-763.');
});

/**
 * 🔴 POR QUÉ ESTE CASO CORRE SOBRE UNA RAÍZ DE MENTIRA, Y NO ES UNA COMODIDAD.
 *
 * La primera versión lo corría sobre `RAIZ`, y **el meta-guard lo cazó a él**: el control positivo
 * crea y borra su sonda DENTRO de `tests/`, así que cuando `meta:mutaciones` mide este guard,
 * PUERTA 0 ve moverse el árbol y saca las cuatro declaraciones CIEGAS. Medido el 7-sep-2026:
 * `linea base: 7✔/0✖ · movidos 1 → tests/.quietud-sonda-…`, y las 4 en CIEGA.
 *
 * **Y ESO NO ES UN FALLO DE PUERTA 0: ES PUERTA 0 FUNCIONANDO.** Un guard que escribe dentro del
 * perímetro mientras se le mide no se puede medir, y el instrumento tiene razón al decirlo. Lo
 * que sobraba era el SITIO. Así que aquí se prueba el MECANISMO —que `fs.watch` recursivo
 * discrimina en esta plataforma— sobre una raíz temporal, y la prueba sobre el árbol REAL la
 * hace el propio juez en su arranque, que es el único momento en que no está midiendo a nadie.
 *
 * ⚠️ LÍMITE DECLARADO: esto mide el sistema de ficheros de `tmpdir`, no el del repositorio. Si
 * algún día el repo viviera en una unidad de red y `tmpdir` no, este verde no cubriría ese caso;
 * el arranque del juez sí, porque corre sobre `RAIZ`.
 */
test('SCRUM-754 · CONTROL POSITIVO: la vigilancia discrimina de verdad en esta plataforma', async () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum754-'));
  try {
    fs.mkdirSync(path.join(raiz, 'tests'));
    const r = await controlPositivoDeVigilancia(raiz, ['tests']);
    assert.equal(r.ok, true,
      `🔴 el control positivo de la vigilancia NO pasa en esta plataforma: ${r.motivo}\n`
      + '  Sin él, `fs.watch` podría estar instalado y no entregar nada, y las dos puertas de '
      + 'abajo serían decoración: un vigilante mudo dentro del arreglo de un juez mudo.');

    // 🔴 Y NO deja restos: la sonda lleva punto delante para que ningún barredor de la casa la
    // vea, pero si se quedara en disco ensuciaría el árbol que dice proteger.
    const restos = fs.readdirSync(path.join(raiz, 'tests')).filter((f) => f.startsWith('.quietud-'));
    assert.deepEqual(restos, [], '🔴 el control positivo deja su sonda en el árbol.');
  } finally {
    fs.rmSync(raiz, { recursive: true, force: true });
  }
});

test('SCRUM-754 · abrir la vigilancia DECLARA lo que no ha podido vigilar', () => {
  const revienta = () => { const e = new Error('no en esta plataforma'); e.code = 'ERR_FEATURE_UNAVAILABLE_ON_PLATFORM'; throw e; };
  const v = abrirVigilancia(RAIZ, ['tests', 'src'], revienta);
  v.cerrar();
  assert.equal(v.sinVigilar.length, 2,
    '🔴 una familia que NO se ha podido vigilar desaparece en silencio. Entonces «árbol quieto» '
    + 'significa «no he mirado», y es lo mismo con otra cara.');
  assert.ok(v.sinVigilar.every((s) => s.includes('ERR_FEATURE_UNAVAILABLE_ON_PLATFORM')),
    '🔴 se declara que no se pudo, pero no POR QUÉ: sin el motivo nadie puede arreglarlo.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② PUERTA 0 · una línea base tomada sobre un árbol movido NO se juzga
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-754 · PUERTA 0: la línea base movida sale CIEGA NOMBRANDO el movimiento', async () => {
  const mut = {
    fichero: 'tests/scrum754-el-juez-que-oscila.test.mjs', // existe: la primera puerta no aplica
    de: 'da igual, no se llega a mutar',
    a: 'da igual',
    cae: 'un test que no se busca en esta comprobacion',
  };
  const movida = { pasados: [], caidos: [], errores: {}, movidos: ['tests/x.mjs — apareció y desapareció mientras medía'] };
  const r = await aplicarUna(mut, 'scrum754-el-juez-que-oscila.test.mjs', movida);

  assert.equal(r.ok, false);
  assert.match(String(r.ciego), /SE MOVIÓ BAJO MIS PIES/,
    '🔴 con la línea base tomada sobre un árbol que se movía, el veredicto NO nombra el '
    + 'movimiento. Medido: entonces sale el CIEGO de PUERTA 1, que acusa a TRES INOCENTES —«el '
    + 'fichero no llegó a ejecutarse, o ese test ya fallaba, o el nombre caducó»— y ninguno era.');
  assert.match(String(r.ciego), /tests\/x\.mjs/,
    '🔴 dice que el árbol se movió y no dice QUÉ se movió: sin el fichero nadie puede ir a mirar.');

  // 🔴 CONTROL NEGATIVO, y sin él lo de arriba no significa nada: un instrumento que dijera
  // siempre «se movió» pasaría el aserto anterior sin haber medido nada.
  const quieta = { pasados: [], caidos: [], errores: {}, movidos: [] };
  const r2 = await aplicarUna(mut, 'scrum754-el-juez-que-oscila.test.mjs', quieta);
  assert.doesNotMatch(String(r2.ciego), /SE MOVIÓ BAJO MIS PIES/,
    '🔴 PUERTA 0 dispara con el árbol QUIETO: entonces no distingue, y todo saldría CIEGO.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ PUERTA 3 · va ANTES de `cayo()`, y ES EL ORDEN lo que impide el verde falso
//
// 🔴 SE LEE POR AST Y POR IDENTIDAD, no por texto (la lección de SCRUM-745): el fichero
// escribe la palabra `movidos` en comentarios y en PUERTA 0, así que un `includes` seguiría
// verde sobre la avería. Lo que se exige es ESTRUCTURA: que el `if` que consulta `movidos` en
// la pasada mutada TENGA un `else` y que la llamada a `cayo()` viva DENTRO de ese `else`.
// ═════════════════════════════════════════════════════════════════════════════════════════

/** El nodo de la función `aplicarUna` del juez, leído sin ejecutar nada. */
function funcionDelJuez(nombre) {
  const codigo = fs.readFileSync(path.join(RAIZ, JUEZ), 'utf8');
  const sf = ts.createSourceFile(JUEZ, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let encontrada = null;
  const v = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name && n.name.text === nombre) encontrada = n;
    ts.forEachChild(n, v);
  };
  v(sf);
  return { sf, fn: encontrada };
}

/** Todas las llamadas a un identificador dentro de un nodo, por AST. */
function llamadasA(nodo, identificador) {
  const out = [];
  const v = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === identificador) out.push(n);
    ts.forEachChild(n, v);
  };
  v(nodo);
  return out;
}

test('SCRUM-754 · PUERTA 3 se consulta ANTES que `cayo()`, y `cayo()` vive en su `else`', () => {
  const { sf, fn } = funcionDelJuez('aplicarUna');
  // SUELO / control positivo del lector: si no encuentro la función ni las llamadas, esto no es
  // un verde — es que no he sabido mirar, y decirlo es obligatorio.
  assert.ok(fn, `🔴 CIEGO: no encuentro \`aplicarUna\` en \`${JUEZ}\`. El lector está roto, no el juez.`);
  const cayos = llamadasA(fn, 'cayo');
  assert.ok(cayos.length >= 1, '🔴 CIEGO: no encuentro ninguna llamada a `cayo()` que ordenar.');

  // El `if` de PUERTA 3: consulta `movidos` de la pasada MUTADA y tiene rama `else`.
  const candidatos = [];
  const v = (n) => {
    if (ts.isIfStatement(n) && n.elseStatement) {
      const cond = n.expression.getText(sf);
      if (/\bmovidos\b/.test(cond)) candidatos.push(n);
    }
    ts.forEachChild(n, v);
  };
  v(fn);

  assert.equal(candidatos.length, 1,
    '🔴 no hay exactamente UNA puerta que consulte `movidos` con `else` dentro de `aplicarUna`. '
    + 'Si son cero, el veredicto de la pasada mutada ya no pregunta si el árbol se movió: medido '
    + 'el 7-sep-2026, así salían TRES VERDES FALSOS de cuatro.');

  const puerta = candidatos[0];
  const dentroDelElse = llamadasA(puerta.elseStatement, 'cayo');
  assert.ok(dentroDelElse.length >= 1,
    '🔴 `cayo()` NO cuelga del `else` de la puerta. Entonces el veredicto se decide antes de '
    + 'preguntar sobre qué árbol se ha medido, que es la avería entera de SCRUM-754.');

  // Y ninguna llamada a `cayo()` posterior puede vivir FUERA de la puerta: si escapa, hay un
  // camino que vuelve a decidir sin preguntar. (Dentro de la puerta sí puede haber otra: el
  // mensaje del CIEGO dice qué habría salido sin ella, y eso es diagnóstico, no veredicto.)
  const escapadas = cayos.filter((c) => c.getStart() > puerta.getStart() && c.getEnd() > puerta.getEnd());
  assert.deepEqual(escapadas.map((c) => c.getText(sf)), [],
    '🔴 hay una llamada a `cayo()` DESPUÉS de la puerta y fuera de ella: el orden es lo único '
    + 'que impide el verde falso, y ese camino se lo salta.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ④ LA OTRA PASADA VIVA · no se le repara la marca a quien está midiendo
//
// 🔴 Lo destapó PUERTA 3 en la primera pasada completa, y se DISCRIMINÓ antes de tocar nada
// (7-sep-2026): con la mutación de `scrum765` puesta —la puerta abre siempre—, la sonda de ese
// guard importa el meta-guard y le ejecuta el bloque principal DENTRO del test; ese meta-guard
// anidado encontraba la marca de la pasada de FUERA y le devolvía la mutación a sus bytes
// originales en pleno vuelo. Las dos mitades, medidas:
//
//     marca en disco: SÍ → 🔴 la mutación VUELVE A LOS BYTES ORIGINALES a mitad de medición
//     marca en disco: NO →    la mutación SIGUE PUESTA — nadie la toca
//
// Y era invisible: quien restauraba lo hacía con los bytes BUENOS, así que `git status` callaba.
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Un banco con su marca puesta y el fichero mutado, para poder preguntarle al restaurador. */
function bancoConMarca(pid) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum754-marca-'));
  const abs = path.join(dir, 'pieza.mjs');
  const ORIGINAL = Buffer.from('export const x = 1;\n');
  fs.writeFileSync(abs, ORIGINAL);
  const marca = path.join(dir, '.marca');
  marcarEnVuelo([{ ruta: 'pieza.mjs', abs, ORIGINAL }], marca);
  if (pid !== undefined) {
    const man = path.join(marca, 'en-vuelo.json');
    const datos = JSON.parse(fs.readFileSync(man, 'utf8'));
    datos.pid = pid;
    fs.writeFileSync(man, JSON.stringify(datos));
  }
  fs.writeFileSync(abs, 'export const x = 2; // MUTADO y en vuelo\n'); // la mutación, puesta
  return { dir, abs, marca, sigueMutado: () => fs.readFileSync(abs).toString().includes('MUTADO') };
}

test('SCRUM-754 · una marca de OTRA pasada VIVA no se repara: sería quitarle la mutación', () => {
  const b = bancoConMarca(process.pid + 1); // otro proceso…
  try {
    const r = restaurarDesdeMarca(b.marca, () => true); // …y vivo
    assert.equal(r.enVuelo, true,
      '🔴 el restaurador trata una pasada VIVA como si fuera «una pasada anterior». Reproducido: '
      + 'así es como el meta-guard anidado le devolvía la mutación al de fuera en pleno vuelo, y '
      + 'el de fuera emitía su veredicto sobre un árbol ya restaurado.');
    assert.deepEqual(r.reparadas, [], '🔴 dice que está en vuelo y aun así ha reparado.');
    assert.ok(b.sigueMutado(),
      '🔴 LE HA QUITADO LA MUTACIÓN A QUIEN ESTABA MIDIENDO. Es exactamente el sabotaje que este '
      + 'caso existe para impedir.');
    assert.ok(r.piezas.includes('pieza.mjs'),
      '🔴 se niega a reparar y no dice QUÉ hay puesto: sin la lista nadie puede decidir si esperar.');
  } finally { fs.rmSync(b.dir, { recursive: true, force: true }); }
});

test('SCRUM-754 · CONTROL POSITIVO: una marca HUÉRFANA se sigue reparando (SCRUM-808 intacto)', () => {
  // ① dueño MUERTO → se repara. Sin esto, lo de arriba sería «he apagado el restaurador».
  const b = bancoConMarca(process.pid + 1);
  try {
    const r = restaurarDesdeMarca(b.marca, () => false);
    assert.deepEqual(r.reparadas, ['pieza.mjs'],
      '🔴 una marca de una pasada MUERTA ya no se repara: eso devuelve el árbol sucio de SCRUM-808, '
      + 'que es el defecto contrario y no menos grave.');
    assert.equal(b.sigueMutado(), false, '🔴 dice que reparó y el fichero sigue mutado.');
  } finally { fs.rmSync(b.dir, { recursive: true, force: true }); }

  // ② y la marca PROPIA se repara aunque el proceso esté vivo: es la del banco de SCRUM-808,
  //    que la fabrica y la repara dentro del mismo proceso. La regla es «OTRA pasada viva».
  const mia = bancoConMarca(undefined); // `marcarEnVuelo` pone MI pid
  try {
    const r = restaurarDesdeMarca(mia.marca, () => true);
    assert.deepEqual(r.reparadas, ['pieza.mjs'],
      '🔴 mi propia marca se trata como ajena: eso rompe el banco de SCRUM-808 y no arregla nada.');
  } finally { fs.rmSync(mia.dir, { recursive: true, force: true }); }
});

test('SCRUM-754 · `procesoVivo` distingue, y no dice que sí a todo', () => {
  assert.equal(procesoVivo(process.pid), true, '🔴 no reconoce vivo al proceso que lo pregunta.');
  const esrch = () => { const e = new Error('no existe'); e.code = 'ESRCH'; throw e; };
  const eperm = () => { const e = new Error('no es mío'); e.code = 'EPERM'; throw e; };
  assert.equal(procesoVivo(4242, esrch), false, '🔴 ESRCH es «no existe»: contarlo vivo dejaría '
    + 'marcas huérfanas sin reparar para siempre.');
  assert.equal(procesoVivo(4242, eperm), true, '🔴 EPERM es «existe y no es mío»: contarlo muerto '
    + 'le quitaría la mutación a un proceso de otro usuario que está midiendo.');
  assert.equal(procesoVivo(0), false, '🔴 un pid inválido no puede salir vivo.');
  assert.equal(procesoVivo(undefined), false, '🔴 una marca sin pid no puede salir viva.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ⑤ EL ARRANQUE · sin control positivo de la vigilancia no se emite ningún veredicto
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-754 · el arranque EXIGE el control positivo de la vigilancia y sale CIEGO sin él', () => {
  const codigo = fs.readFileSync(path.join(RAIZ, JUEZ), 'utf8');
  const sf = ts.createSourceFile(JUEZ, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

  const llamadas = llamadasA(sf, 'controlPositivoDeVigilancia');
  assert.ok(llamadas.length >= 1,
    '🔴 el juez no llama al control positivo de la vigilancia. Entonces `fs.watch` podría estar '
    + 'instalado y no entregar NADA, y las dos puertas serían decoración: un vigilante mudo '
    + 'dentro del arreglo de un juez mudo.');

  // Y no basta con llamarlo: hay que SALIR CIEGO cuando dice que no. Se busca por AST el `if`
  // que consulta `vigilancia.ok` y se exige que dentro haya un `process.exit(SALIDA_CIEGO)`.
  let salida = null;
  const v = (n) => {
    if (ts.isIfStatement(n) && /vigilancia\s*\.\s*ok/.test(n.expression.getText(sf))) {
      const dentro = [];
      const w = (m) => {
        if (ts.isCallExpression(m) && m.expression.getText(sf) === 'process.exit') {
          dentro.push(m.arguments[0]?.getText(sf) || '');
        }
        ts.forEachChild(m, w);
      };
      w(n.thenStatement);
      if (dentro.length) salida = dentro[0];
    }
    ts.forEachChild(n, v);
  };
  v(sf);

  assert.equal(salida, 'SALIDA_CIEGO',
    '🔴 el juez consulta el control positivo y NO sale CIEGO cuando falla. Un instrumento que se '
    + 'entera de que no puede vigilar y sigue emitiendo veredictos es peor que uno que no vigila: '
    + 'los emite con la misma cara de siempre.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LAS MUTACIONES QUE ME TUMBAN (SCRUM-745) · las ejecuta `npm run meta:mutaciones`
//
// Las cuatro imitan la avería REAL, cada una por un sitio distinto. Ninguna toca `cayo()`,
// `murioElFichero()` ni `MUERTE_CUENTA_COMO`: lo que este ticket cambia es el ORDEN en el que
// se les pregunta, no lo que contestan.
// ═════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/_arbol-quieto.mjs',
    de: "    return 'apareció y desapareció mientras medía (o lo borraron)';",
    a: '    return null; // SCRUM-754 mutacion A: ciego al transitorio, que es la averia original',
    cae: 'el observador VE el transitorio y NO llama movimiento a una lectura',
  },
  {
    fichero: 'scripts/_arbol-quieto.mjs',
    de: '  if (s.mtimeMs >= desdeMs) return \'lo escribieron mientras medía\';',
    a: "  return 'SCRUM-754 mutacion B: grita siempre, y asi el instrumento queda apagado del otro lado';",
    cae: 'el observador VE el transitorio y NO llama movimiento a una lectura',
  },
  {
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '  if (limpia?.movidos?.length) {',
    a: '  if (false) { // SCRUM-754 mutacion C: la linea base movida vuelve a juzgarse igual',
    cae: 'PUERTA 0: la línea base movida sale CIEGA NOMBRANDO el movimiento',
  },
  {
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '    if (tras.movidos?.length) {',
    a: '    if (false) { // SCRUM-754 mutacion D: el veredicto vuelve a decidirse antes de preguntar',
    cae: 'PUERTA 3 se consulta ANTES que `cayo()`',
  },
  {
    fichero: 'scripts/_arbol-quieto.mjs',
    de: '      if (ahora && Buffer.compare(ahora, mios) === 0) continue; // es mi mutación, intacta',
    a: '      continue; // SCRUM-754 mutacion E: exime POR RUTA, y asi otro puede tocar mi pieza en silencio',
    cae: 'la MÍA cambiada sí, y con otro nombre',
  },
  {
    fichero: 'scripts/_arbol-quieto.mjs',
    de: 'export const MARGEN_MS = 25;',
    a: 'export const MARGEN_MS = 0; // SCRUM-754 mutacion F: sin margen, 151 falsos positivos de 200',
    cae: 'SUELO Y TOPE del margen',
  },
  {
    fichero: 'scripts/_marca-de-arbol.mjs',
    de: '  if (datos.pid !== process.pid && vivo(datos.pid)) {',
    a: '  if (false) { // SCRUM-754 mutacion G: vuelve a repararle la marca a quien esta midiendo',
    cae: 'una marca de OTRA pasada VIVA no se repara',
  },
];
