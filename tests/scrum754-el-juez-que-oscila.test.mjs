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
import { execFileSync } from 'node:child_process'; // SCRUM-754c: la sonda va en subproceso
import {
  FAMILIAS_VIGILADAS, porQueEsMovimiento, movimientosConfirmados, abrirVigilancia,
  controlPositivoDeVigilancia, MARGEN_MS, instanteDeReferencia,
  huellaDelPerimetro, movimientosPorHuella, // SCRUM-754b
} from '../scripts/_arbol-quieto.mjs';
import { aplicarUna } from '../scripts/meta-guard-mutaciones.mjs';
import { veredictoDelCenso } from '../scripts/censo-guards-gateados.mjs'; // SCRUM-754c
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

// ═════════════════════════════════════════════════════════════════════════════════════════
// ⑥ SCRUM-754b · EL INSTRUMENTO YA NO DEPENDE DE LA PLATAFORMA
//
// EL HECHO: el hueco que este fichero dejó DECLARADO se cumplió palabra por palabra. En
// `ubuntu-latest` `fs.watch` recursivo se instala y NO ENTREGA, así que el control positivo salió
// rojo y `meta:mutaciones` salió CIEGO con exit 2. Con eso en `main`, el juez habría quedado
// apagado en TODA rama que pase por CI — y un CIEGO permanente se ignora igual que un rojo fijo.
//
// 🔴 CÓMO SE PRUEBA AQUÍ LO QUE PASA ALLÍ, Y POR QUÉ ESTO NO ES «PROBARLO SÓLO EN WINDOWS».
//
// La objeción es correcta y es la que manda: `fs.watch` tiene un backend por plataforma
// —ReadDirectoryChangesW aquí, inotify allí—, así que verlo funcionar en Windows no dice NADA de
// Linux. Por eso el arreglo NO es otro `fs.watch`: es una HUELLA de `readdir` + `stat`, que tiene
// UNA sola implementación en todas las plataformas. Ejercitarla aquí ejercita exactamente el
// mismo código que corre en `ubuntu-latest`.
//
// Y la condición de allí se reproduce EXACTAMENTE: se inyecta un `fs.watch` que se instala sin
// reventar y no llama al callback jamás — que es, literalmente, lo que hace el de Linux según el
// rojo del CI. Si el instrumento sigue discriminando con esa capa muda, lo que queda en pie es la
// que no depende de la plataforma.
//
// ⚠️ LO QUE ESTO NO ES: una ejecución en `ubuntu-latest`. No hay Linux en esta máquina —ni WSL, ni
// docker— y el CI sólo dispara con `pull_request`/`push` a `main`, que abre el fundador. Queda
// dicho: la prueba de que el backend de Linux se comporta como el mudo la da el rojo del CI que
// originó esto; lo que se prueba aquí es que con ese backend mudo el instrumento SIGUE contestando.
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Un `fs.watch` que se instala sin reventar y NO ENTREGA NADA: la condición de ubuntu-latest. */
const watchMudo = () => ({ close() {} });

test('SCRUM-754b · 🔴 con `fs.watch` MUDO (la condición de CI) el control positivo SIGUE pasando', async () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum754b-'));
  try {
    fs.mkdirSync(path.join(raiz, 'tests'));
    const r = await controlPositivoDeVigilancia(raiz, ['tests'], watchMudo);
    assert.equal(r.ok, true,
      '🔴 con la vigilancia en vivo muda el control positivo NO pasa, así que `meta:mutaciones` '
      + `seguiría saliendo CIEGO en TODA rama que pase por CI: ${r.motivo}`);
  } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
});

test('SCRUM-754b · 🔴 EL CASO QUE DECIDE: un fichero que NACE Y MUERE se denuncia SIN `fs.watch`', () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum754b-'));
  try {
    const dir = path.join(raiz, 'tests');
    fs.mkdirSync(dir);
    const { huella: antes } = huellaDelPerimetro(raiz, ['tests']);

    // Nace y muere DENTRO de la ventana: en las dos fotos está AUSENTE, que es exactamente lo que
    // una huella del CONTENIDO no podría ver — y lo que fabricó los tres verdes falsos.
    const f = path.join(dir, 'nace-y-muere.mjs');
    fs.writeFileSync(f, 'x');
    fs.rmSync(f);
    assert.equal(fs.existsSync(f), false, 'el caso exige que el fichero YA NO ESTÉ');

    const { huella: despues } = huellaDelPerimetro(raiz, ['tests']);
    const movidos = movimientosPorHuella(antes, despues, instanteDeReferencia(), raiz);
    assert.ok(movidos.length > 0,
      '🔴 EL TRANSITORIO NO SE DENUNCIA. Es la avería entera de SCRUM-754: el árbol se movió y el '
      + 'juez firmaría un veredicto sobre un árbol que no es el que midió.');
    assert.ok(movidos.some((m) => m.startsWith('tests/')),
      `🔴 se denuncia algo, pero no dice DÓNDE: ${JSON.stringify(movidos)}`);
  } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
});

test('SCRUM-754b · 🔴 LA OTRA MITAD: LEER no sale como movimiento (o el juez se apaga por el otro lado)', () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum754b-'));
  try {
    const dir = path.join(raiz, 'tests');
    fs.mkdirSync(dir);
    const leido = path.join(dir, 'solo-se-lee.mjs');
    fs.writeFileSync(leido, 'y');
    // Directorio y fichero, los dos claramente ANTERIORES: si no, el alta los mueve y el caso
    // mediría su propia preparación en vez de la lectura.
    const hace = new Date(Date.now() - 60_000);
    fs.utimesSync(leido, hace, hace);
    fs.utimesSync(dir, hace, hace);

    const { huella: antes } = huellaDelPerimetro(raiz, ['tests']);
    fs.readFileSync(leido);                         // sólo se LEE
    const { huella: despues } = huellaDelPerimetro(raiz, ['tests']);

    assert.deepEqual(movimientosPorHuella(antes, despues, instanteDeReferencia(), raiz), [],
      '🔴 FALSO POSITIVO: una LECTURA sale como movimiento. Con ese criterio saldrían CIEGOS los '
      + 'guards sanos que importan de `dist/`, y eso no es arreglar el juez: es apagarlo por el '
      + 'otro lado.');
  } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
});

test('SCRUM-754b · 🔴 SUELO: una huella que no ve NADA lanza, en vez de decir «no se movió»', () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum754b-'));
  try {
    assert.throws(() => huellaDelPerimetro(raiz, ['no-existe-esta-familia']), /HUELLA CIEGA/,
      '🔴 con el perímetro vacío la huella devuelve algo en vez de lanzar. Comparar dos huellas '
      + 'vacías da «el árbol no se movió», que es «no he mirado» con otra cara — el mismo error '
      + 'que este fichero existe para no repetir.');
  } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
});

test('SCRUM-754b · el escrito DURANTE se denuncia con su NOMBRE (no sólo su directorio)', () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum754b-'));
  try {
    const dir = path.join(raiz, 'tests');
    fs.mkdirSync(dir);
    const f = path.join(dir, 'se-escribe.mjs');
    fs.writeFileSync(f, 'antes');
    const hace = new Date(Date.now() - 60_000);
    fs.utimesSync(f, hace, hace);
    fs.utimesSync(dir, hace, hace);

    const { huella: antes } = huellaDelPerimetro(raiz, ['tests']);
    fs.writeFileSync(f, 'DESPUES');               // se modifica, no se crea ni se borra
    const { huella: despues } = huellaDelPerimetro(raiz, ['tests']);

    const movidos = movimientosPorHuella(antes, despues, instanteDeReferencia(), raiz);
    assert.ok(movidos.some((m) => m.includes('se-escribe.mjs')),
      `🔴 un fichero escrito durante la medición no sale nombrado: ${JSON.stringify(movidos)}`);
  } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ⑦ SCRUM-754c · UN TEST SALTADO NO ES UN TEST APROBADO
//
// EL DEFECTO, medido con sonda propia sobre `node:test` (Node 24, 8-sep-2026):
//
//   test('…', { skip: 'sin QA_DB_TEST=1' }, …)   →  test:pass   con `data.skip` puesto
//   test('…', () => { … })            (pasa)     →  test:pass   sin `skip`
//
// El bucle de eventos miraba SÓLO `ev.type`, así que un test que NO SE EJECUTÓ entraba en
// `pasados`. Y los tests gateados por `QA_DB_TEST` no corren en el job del meta-guard, que corre
// SIN BASE POR DISEÑO: PUERTA 1 veía su test «en verde», abría, se mutaba, el test seguía sin
// correr, seguía «pasando», y el veredicto salía **MUDO** donde tenía que salir **CIEGO**.
//
// «No pude mirar» y «miré y no cayó» son OPUESTOS, y salían por la misma puerta.
//
// ⚠️ EL OTRO CASO, medido en la misma sonda y NO tocado a propósito: `t.skip()` DENTRO del cuerpo
// no detiene la ejecución, así que si lo que sigue lanza sale `test:fail` (con `skip` puesto
// también). Un fallo es un fallo: tratar ahí el `skip` como ceguera se tragaría rojos de verdad.
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * Clasifica un fichero por el camino REAL, en un SUBPROCESO limpio.
 *
 * 🔴 No se llama a `correr()` aquí dentro, y no es manía: MEDIDO, un `run()` de `node:test`
 * ANIDADO dentro de un test que ya corre NO entrega los eventos por test — `saltados` y
 * `pasados` llegan vacíos. Un caso que se conformara con eso mediría el vacío y saldría verde.
 */
function sonda(rutaFixture) {
  // 🔴 SE LE LIMPIA `NODE_TEST_CONTEXT` AL HIJO, y esto costó un rojo: `node --test` lo pone en
  // el entorno, el subproceso lo HEREDA, y con esa variable puesta `run()` se cree dentro de un
  // test y deja de entregar los eventos por test — la sonda devolvía `saltados: []` desde dentro
  // del test y lo correcto desde una terminal. Un caso que se hubiera conformado con ese vacío
  // habría salido verde midiendo nada.
  const entorno = { ...process.env };
  delete entorno.NODE_TEST_CONTEXT;
  const salida = execFileSync(process.execPath, [path.join(RAIZ, 'tests', '_sonda-saltados.mjs'), rutaFixture],
    { cwd: RAIZ, encoding: 'utf8', env: entorno });
  const linea = salida.trim().split(/\r?\n/).filter((l) => l.startsWith('{')).pop();
  assert.ok(linea, `🔴 la sonda no ha devuelto JSON. Salida:
${salida}`);
  return JSON.parse(linea);
}

/**
 * 🔴 UN ANCLA QUE NO PUEDE EXISTIR EN EL FUENTE, y esto costó SIETE CIEGAS.
 *
 * La primera versión de los casos de 754c pasaba el ancla como LITERAL. Ese literal quedaba
 * escrito EN ESTE MISMO FICHERO, así que `aplicarUna` lo encontraba, pasaba la puerta del ancla
 * y **mutaba de verdad el test del repositorio**. Lo restauraba —`git status` salía limpio— pero
 * le movía el `mtime`, y la pasada completa del meta-guard sacó `ciegas 7`: las siete de este
 * guard, todas con «lo escribieron mientras medía».
 *
 * O sea: el caso que probaba el instrumento estaba moviendo el árbol que el instrumento vigila.
 * Lo cazó él solo, que es exactamente para lo que existe.
 *
 * Construida en ejecución, la cadena no aparece en el fuente y `aplicarUna` se para en la puerta
 * del ancla SIN escribir nada.
 *
 * ⚠️ El caso de PUERTA 0 (arriba) SÍ puede usar un literal: allí el árbol sale movido y
 * `aplicarUna` devuelve antes de mirar el ancla. Se deja como está para no tocar lo que ya vigila.
 */
function anclaImposible() {
  return ['ANCLA', 'QUE', 'NO', 'EXISTE', process.pid, Math.random().toString(36).slice(2)].join('-');
}

/** Escribe un fichero de test FUERA del árbol: crearlo dentro movería el árbol (SCRUM-754). */
function fixture(cuerpo) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum754c-'));
  const abs = path.join(dir, 'fixture.test.mjs');
  fs.writeFileSync(abs, cuerpo);
  return { dir, abs, borrar: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

const TODOS_SALTADOS = `import test from 'node:test';
import assert from 'node:assert/strict';
const ENABLED = process.env.QA_DB_TEST === '1';
test('el unico test de este guard', { skip: !ENABLED && 'sin QA_DB_TEST=1' }, () => {
  assert.equal(1, 2);
});
`;

const CORRE_DE_VERDAD = `import test from 'node:test';
import assert from 'node:assert/strict';
test('el unico test de este guard', () => { assert.equal(1, 1); });
`;

test('SCRUM-754c · 🔴 EL CONTROL QUE DECIDE: un fichero con TODOS sus tests saltados sale CIEGO', async () => {
  const f = fixture(TODOS_SALTADOS);
  try {
    const limpia = sonda(f.abs);

    // ① La clasificación, medida contra `node:test` de verdad — no contra una idea de él.
    assert.deepEqual(limpia.pasados, [],
      '🔴 un test SALTADO ha entrado en `pasados`. Es el defecto entero: `node:test` lo emite '
      + `como \`test:pass\` con \`skip\` puesto. Pasados: ${JSON.stringify(limpia.pasados)}`);
    assert.equal(limpia.saltados.length, 1,
      `🔴 el saltado no se ha registrado como tal: ${JSON.stringify(limpia.saltados)}`);
    assert.match(limpia.saltados[0].motivo, /QA_DB_TEST/,
      '🔴 se registra que se saltó pero no POR QUÉ: sin el motivo nadie puede arreglarlo.');

    // ② Y el veredicto: CIEGO, y NOMBRANDO que fue un salto.
    const mut = {
      fichero: 'tests/scrum754-el-juez-que-oscila.test.mjs', // existe: la primera puerta no aplica
      de: anclaImposible(), // 🔴 NO literal: ver `anclaImposible`. Un literal se mutaría a sí mismo.
      a: 'da igual',
      cae: 'el unico test de este guard',
    };
    const r = await aplicarUna(mut, 'fixture.test.mjs', limpia);
    assert.equal(r.ok, false);
    assert.match(String(r.ciego), /SALTADO/,
      '🔴 el veredicto NO dice que el test estaba saltado. Antes de SCRUM-754c esto salía MUDO: '
      + 'acusaba al guard de no vigilar cuando en realidad nadie había mirado.');
    assert.match(String(r.ciego), /QA_DB_TEST/,
      '🔴 dice que se saltó y no dice por qué gate: sin eso no se puede ir a mirar.');

    // 🔴 Y NO puede salir el mensaje genérico de PUERTA 1, que acusa de TRES cosas que aquí no
    // son ninguna. Una falsa acusación manda a alguien a buscar lo que no está roto.
    assert.doesNotMatch(String(r.ciego), /el fichero no llegó a ejecutarse/,
      '🔴 sale el CIEGO genérico de PUERTA 1 en vez del de SALTADO: acusa de que el fichero no '
      + 'cargó, de que el test ya fallaba o de que el nombre caducó, y no es ninguna de las tres.');
  } finally { f.borrar(); }
});

test('SCRUM-754c · ✅ NEGATIVO: un guard que CORRE de verdad y no cae SIGUE saliendo MUDO', async () => {
  const f = fixture(CORRE_DE_VERDAD);
  try {
    const limpia = sonda(f.abs);

    // Sin esto, lo de abajo no significa nada: si TODO saliera CIEGO, el instrumento estaría
    // apagado por el otro lado — que es el riesgo que este mismo fichero ya identificó en 754b.
    assert.deepEqual(limpia.saltados, [],
      '🔴 un test que CORRE se está contando como saltado. Con ese criterio todo saldría CIEGO '
      + 'y el meta-guard quedaría apagado por el otro lado.');
    assert.equal(limpia.pasados.length, 1,
      `🔴 un test que corre y pasa no aparece en \`pasados\`: ${JSON.stringify(limpia)}`);

    const mut = {
      fichero: 'tests/scrum754-el-juez-que-oscila.test.mjs',
      de: anclaImposible(), // 🔴 NO literal: ver `anclaImposible`.
      a: 'da igual',
      cae: 'el unico test de este guard',
    };
    const r = await aplicarUna(mut, 'fixture.test.mjs', limpia);
    assert.doesNotMatch(String(r.ciego ?? ''), /SALTADO/,
      '🔴 un guard cuyo test SÍ corrió sale como saltado. La puerta nueva dispara sobre sanos.');
  } finally { f.borrar(); }
});

test('SCRUM-754c · 🔴 SUELO del censo: el árbol TIENE guards con todos sus tests gateados', () => {
  // Medido el 8-sep-2026 ejecutando los 721 ficheros de `tests/`: 48 tienen TODOS sus tests
  // gateados. El número exacto NO se congela aquí —se mueve con cada ticket que añade un test
  // gateado— y por eso el suelo es de EXISTENCIA, no de cantidad: lo que no puede pasar es que
  // el censo devuelva CERO, porque entonces no está mirando.
  //
  // El recuento vive en `npm run censo:gateados`, que los EJECUTA. Aquí sólo se comprueba que la
  // clasificación sobre la que se apoya distingue de verdad, con un caso de cada.
  const clasifica = (ev) => (ev.type === 'test:pass' && ev.data.skip ? 'saltado' : ev.type === 'test:pass' ? 'real' : 'caido');
  assert.equal(clasifica({ type: 'test:pass', data: { skip: 'sin QA_DB_TEST=1' } }), 'saltado');
  assert.equal(clasifica({ type: 'test:pass', data: {} }), 'real');
  assert.equal(clasifica({ type: 'test:fail', data: {} }), 'caido');
});

// ── EL CENSO · su suelo y su trinquete ───────────────────────────────────────────────────
//
// El recuento real lo da `npm run censo:gateados`, que EJECUTA la carpeta `tests/` entera y por
// eso no cabe aquí. Lo que se prueba en la tanda normal es el VEREDICTO: que un cero se declare
// ciego y que un expuesto se ponga rojo. Sin esto, el censo podría devolver cualquier cosa y
// nadie lo sabría hasta que alguien lo corriera a mano.

test('SCRUM-754c · 🔴 SUELO del censo: CERO gateados es CIEGO, no verde', () => {
  const todosCorren = new Map([['a.test.mjs', { reales: 3, saltados: 0 }]]);
  const v = veredictoDelCenso(todosCorren, new Set());
  assert.equal(v.ok, false,
    '🔴 el censo da por bueno un CERO. El árbol tiene tests gateados por `QA_DB_TEST`, '
    + '`LIBRO_PG_URL`, `A55_DB_TEST` y `BOT_SUITE_TEST`: un cero es «no he sabido ver los saltos», '
    + 'que es justo el defecto que este censo vigila.');
  assert.match(String(v.ciego), /CERO/);

  // Y sin ni un fichero, con más razón.
  const vacio = veredictoDelCenso(new Map(), new Set());
  assert.equal(vacio.ok, false, '🔴 un censo que no ve NI UN fichero se da por bueno');
  assert.match(String(vacio.ciego), /NI UN fichero/);
});

test('SCRUM-754c · 🔴 EL TRINQUETE: un guard gateado que ADEMÁS declara mutaciones sale EXPUESTO', () => {
  const porFichero = new Map([
    ['sano.test.mjs', { reales: 5, saltados: 0 }],
    ['gateado-sin-declarar.test.mjs', { reales: 0, saltados: 2 }],
    ['gateado-y-declarado.test.mjs', { reales: 0, saltados: 1 }],
  ]);

  // Hoy: hay gateados, pero ninguno declara. Medido el 8-sep-2026 sobre el árbol: 48 y 0.
  const hoy = veredictoDelCenso(porFichero, new Set(['sano.test.mjs']));
  assert.equal(hoy.ok, true);
  assert.equal(hoy.gateados.length, 2, '🔴 no se están contando los gateados');
  assert.deepEqual(hoy.expuestos, [],
    '🔴 se acusa de veredicto hueco a un guard que no declara mutaciones: sobre ése no se emite '
    + 'ningún veredicto, así que no hay nada hueco.');

  // 🔴 Y el día que alguien declare una mutación en un guard gateado, esto TIENE que hablar.
  const manana = veredictoDelCenso(porFichero, new Set(['gateado-y-declarado.test.mjs']));
  assert.equal(manana.expuestos.length, 1,
    '🔴 un guard cuyos tests NO CORREN y que ADEMÁS declara mutaciones no sale señalado. Es el '
    + 'único caso en el que el veredicto hueco se emite de verdad, y el censo se lo pierde.');
  assert.equal(manana.expuestos[0].fichero, 'gateado-y-declarado.test.mjs');
});
