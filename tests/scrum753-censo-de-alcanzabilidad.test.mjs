// tests/scrum753-censo-de-alcanzabilidad.test.mjs — SCRUM-753
//
// Sin gate: lee git y el árbol. Ni BD, ni red externa, ni navegador.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL CENSO DE ALCANZABILIDAD, Y LOS DOS NÚMEROS QUE LO JUSTIFICAN
//
//   · 4-sep-2026: un barrido por IDENTIFICADORES dio **27 ramas «con trabajo perdido»**. Con
//     `merge-base --is-ancestor` eran **13**, y doce llevaban muertas desde agosto.
//   · 5-sep-2026: **nueve de once** tickets de producto asignados ya estaban en `main`, y los
//     nueve figuraban en «Tareas por hacer».
//
// Lo que este fichero vigila NO es que el censo acierte hoy —eso caduca—: es que **sepa cambiar de
// respuesta**, que diga su motivo cuando no puede medir, y que sus dos costurones no se separen
// en silencio.
//
// ── 🔴 POR QUÉ EL BANCO ES SINTÉTICO ────────────────────────────────────────────────────────
// Un test que fija el estado actual convierte un defecto en un requisito. Si aquí escribiera
// «SCRUM-161 → FUERA», el día que alguien mergee 161 este fichero se pondría rojo EXIGIENDO que
// siga sin mergearse. Los casos se REPRODUCEN en `tests/_fixture-alcanzabilidad.mjs`.
//
// Lo que sí se mide sobre el árbol vivo es lo que no puede caducar hacia el lado cómodo: que el
// detector conteste las dos cosas, y que las reglas duplicadas sigan de acuerdo.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url'; // SCRUM-730: `pathname` no decodifica el espacio
import { execFileSync } from 'node:child_process';
import { ejecutableDe } from './_guard-texto.mjs';
import { mutacionesDeclaradas, censoDeDeclaraciones } from '../scripts/meta-guard-mutaciones.mjs';
import { numeroDeClave } from '../scripts/_censo-reparto.mjs';
import { numeroDeRama } from '../scripts/censo-tablero-vs-arbol.mjs';
import { repoAlcanzabilidad, CASOS, RAMAS_DEL_BANCO } from './_fixture-alcanzabilidad.mjs';
import { anclaEnElRepositorio } from './_ancla-en-el-repositorio.mjs'; // SCRUM-796
import {
  instantanea, poblacionDe, censar, resumenDe, motivosParaNoFiarse, titularConSalvedad,
  corroboracionDe, esAncestroDe, alcanzabilidadDe, ESTADOS, MOTIVOS, PREFIJO_ORIGIN,
} from '../scripts/_censo-alcanzabilidad.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REL_DERIVACION = 'scripts/_censo-alcanzabilidad.mjs';
const REL_CLI = 'scripts/censo-alcanzabilidad.mjs';
const YO = 'scrum753-censo-de-alcanzabilidad.test.mjs';

const fuenteDe = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

/** La instantánea del banco sintético, una vez. `traer: false`: aquí no hay remoto que traer. */
let bancoCache = null;
function banco() {
  if (!bancoCache) {
    const raiz = repoAlcanzabilidad();
    bancoCache = { raiz, inst: instantanea({ raiz, traer: false }) };
  }
  return bancoCache;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ① LOS TRES ESTADOS — Y EL TERCERO NO ES «NO ESTÁ»
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-753 · los TRES estados, cada caso reproducido en el banco', () => {
  const { inst } = banco();
  const censo = censar(inst, { numeros: CASOS.map((c) => c.n) });

  for (const caso of CASOS) {
    const f = censo.filas.find((x) => x.numero === caso.n);
    assert.ok(f, `🔴 el censo no ha devuelto fila para SCRUM-${caso.n}.`);
    assert.equal(f.estado, caso.espera,
      `🔴 SCRUM-${caso.n} (${caso.imita}) salió ${f.estado} y tenía que salir ${caso.espera}.`);
    assert.equal(f.motivo ?? null, caso.motivo ?? null,
      `🔴 SCRUM-${caso.n}: el motivo dice «${f.motivo}» y se esperaba «${caso.motivo}».`);
    if (caso.sinCorroborar !== undefined) {
      assert.equal(f.sinCorroborar, caso.sinCorroborar,
        `🔴 SCRUM-${caso.n}: la marca de «sin corroborar» no coincide.`);
    }
  }

  // 🔴 EL SUELO DEL PROPIO BANCO: si todos los casos dieran lo mismo, arriba pasaría igual y no se
  // habría probado ningún discriminador. Los tres estados tienen que APARECER.
  const vistos = new Set(censo.filas.map((f) => f.estado));
  assert.deepEqual([...vistos].sort(), [ESTADOS.DENTRO, ESTADOS.FUERA, ESTADOS.NO_MEDIBLE].sort(),
    `🔴 el banco sólo ha ejercitado ${[...vistos].join(', ')}. Un censo que no cambia de respuesta `
    + 'no ha medido nada.');
});

test('SCRUM-753 · 🔴 CONTROL POSITIVO: un ticket que NO está en `main`, y el censo lo DICE', () => {
  const { inst } = banco();
  // 9502 tiene dos commits que no están en la punta medida. Si esto no sale FUERA, el censo no
  // sabe decir que no — y un barrido que sólo sabe decir «sí» es el que dio 27 por 13.
  const [f] = censar(inst, { numeros: [9502] }).filas;
  assert.equal(f.estado, ESTADOS.FUERA,
    '🔴 EL CENSO NO SABE DECIR QUE NO. Con un ticket cuya rama tiene commits fuera de la punta '
    + `medida, ha contestado ${f.estado}.`);
  const vivas = f.ramas.filter((r) => r.clase === 'viva');
  assert.equal(vivas.length, 1, '🔴 no ha visto la rama viva.');
  assert.equal(vivas[0].adelanto, 2,
    `🔴 dice ${vivas[0].adelanto} commits fuera de main y son 2: el «cuánto» también se mide.`);
});

test('SCRUM-753 · 🔴 el NO_MEDIBLE lleva SIEMPRE su motivo, y los motivos se distinguen', () => {
  const { inst } = banco();
  const censo = censar(inst, { numeros: CASOS.map((c) => c.n) });
  const noMedibles = censo.filas.filter((f) => f.estado === ESTADOS.NO_MEDIBLE);

  for (const f of noMedibles) {
    assert.ok(f.motivo, `🔴 ${f.ticket} sale NO_MEDIBLE sin motivo. Cada uno se acciona distinto: `
      + 'sin motivo, los tres se leen como «no está».');
    assert.ok(f.porque && f.porque.length > 40,
      `🔴 ${f.ticket} no explica por qué no se pudo medir.`);
  }

  // Los CUATRO motivos, ejercitados. Uno solo repetido no probaría que se distinguen.
  assert.deepEqual(new Set(noMedibles.map((f) => f.motivo)),
    new Set([MOTIVOS.SIN_RAMA, MOTIVOS.SIN_RAMA_NI_ENTRADA, MOTIVOS.NUMERO_COMPARTIDO,
      MOTIVOS.OBJETO_AUSENTE]),
    '🔴 el banco no ha ejercitado los cuatro motivos de NO_MEDIBLE.');
});

test('SCRUM-753 · 🔴🔴 lo que el censo NO PUEDE VER: sin rama y sin entrada no entra en la población', () => {
  const { inst } = banco();
  const p = poblacionDe(inst);

  // 9504 no tiene ni rama ni entrada. La prueba del hallazgo es que NO esté en la población…
  assert.equal(p.numeros.includes(9504), false,
    '🔴 9504 no tiene ni rama ni entrada y sin embargo está en la población: el derivador se lo '
    + 'está inventando de algún sitio.');
  assert.equal(censar(inst).filas.some((f) => f.numero === 9504), false,
    '🔴 el barrido sin argumentos ha listado un ticket sin evidencia. Si pudiera verlos, este '
    + 'instrumento sería otro.');

  // …y que SÍ conteste cuando se le NOMBRA, con el motivo que lo explica.
  const [f] = censar(inst, { numeros: [9504] }).filas;
  assert.equal(f.estado, ESTADOS.NO_MEDIBLE);
  assert.equal(f.motivo, MOTIVOS.SIN_RAMA_NI_ENTRADA,
    '🔴 a un ticket sin rama y sin entrada hay que contestarle «no está en la población», no «no '
    + 'está en main». Son cosas opuestas.');

  // Y la población DECLARA su punto ciego. Se comprueba el DATO, no la prosa del fichero: la
  // primera versión de un guard hermano miraba la frase en el fuente y seguía verde con el valor
  // vaciado (SCRUM-738).
  assert.match(p.ciego, /asignables/i,
    '🔴 la población ha dejado de declarar que su punto ciego son los tickets asignables. Sin esa '
    + 'declaración, la lista se lee como si fuera todo el trabajo que hay.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ② EL SUELO — «no supe mirar» y «no hay» no pueden dar el mismo resultado
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-753 · SUELO: si NINGÚN ticket del lote tiene rama, el censo NO informa', () => {
  const { inst } = banco();
  // 9503 y 9504 no tienen rama: población vacía para la alcanzabilidad.
  const censo = censar(inst, { numeros: [9503, 9504] });
  const motivos = motivosParaNoFiarse(inst, censo.filas);
  assert.ok(motivos.length >= 1,
    '🔴 el suelo NO ha saltado con un lote entero sin ramas. Eso saldría como «no está en main» '
    + 'sobre algo que no se ha podido preguntar.');
  assert.ok(motivos.some((m) => /NINGÚN ticket del lote/.test(m)),
    `🔴 el suelo saltó por otra cosa: ${motivos.join(' | ')}`);

  // 🔴 Y EL CONTROL NEGATIVO DEL SUELO: con un lote que SÍ tiene ramas no puede saltar, o sería un
  // guard que se desactiva en una tarde por estorbar a lo normal.
  const bueno = censar(inst, { numeros: [9501, 9502] });
  assert.deepEqual(motivosParaNoFiarse(inst, bueno.filas), [],
    '🔴 el suelo salta con un lote medible: un suelo que grita siempre se acaba apagando.');
});

test('SCRUM-753 · SUELO: sin refs de origin no se informa de nada (y el CLI sale con 2)', () => {
  const inst = { ...banco().inst, ramas: [] };
  const motivos = motivosParaNoFiarse(inst, []);
  assert.ok(motivos.some((m) => /CERO ramas/.test(m)),
    '🔴 con cero refs el censo no declara que no puede medir.');

  // El código de salida está escrito en el CLI y es lo que lee un humano con prisa.
  const cli = fuenteDe(REL_CLI);
  assert.match(cli, /SALIDA_NO_SUPE_MEDIR\s*=\s*2/,
    '🔴 el CLI ya no declara el código 2 para «no supe medir».');
  const codigo = ejecutableDe(cli, { donde: REL_CLI, ancla: 'motivosParaNoFiarse' });
  assert.match(codigo, /process\.exit\(SALIDA_NO_SUPE_MEDIR\)/,
    '🔴 el CLI ya no sale con 2 cuando el suelo salta: imprimiría un censo vacío con código 0.');
});

test('SCRUM-753 · el clon capado NO se lee como «no hay ramas»', () => {
  const inst = { ...banco().inst, refspec: '+refs/heads/main:refs/remotes/origin/main' };
  const motivos = motivosParaNoFiarse(inst, []);
  assert.ok(motivos.some((m) => /UNA sola rama/.test(m)),
    '🔴 con un refspec de una sola rama el censo se cree que ha visto el remoto entero. Medido en '
    + 'SCRUM-388: `for-each-ref` no falla, devuelve una lista corta. Miente en voz baja.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ③ LA INSTANTÁNEA — el desajuste 454/453, explicado y cerrado por construcción
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-753 · 🔴 la población NO vuelve a preguntarle a git: sale de la MISMA instantánea', () => {
  const { inst } = banco();

  // La prueba es que `poblacionDe` funcione con una instantánea cuyo `raiz` NO EXISTE. Si tocara
  // git o el disco, reventaría. Es lo que impide que vuelva el 454 con 453 filas: allí `censar()`
  // leía las refs una vez para las filas y otra para la población, con el censo entero en medio y
  // dieciséis worktrees compartiendo el espacio de refs.
  const falsa = { ...inst, raiz: path.join(inst.raiz, 'no-existe-este-directorio') };
  const p = poblacionDe(falsa);
  assert.equal(p.ticketsCensados, poblacionDe(inst).ticketsCensados,
    '🔴 la población cambia según el `raiz`: está leyendo el disco en vez de la instantánea.');

  // Y el invariante que allí se rompió: el recuento y las filas son EL MISMO conjunto.
  const censo = censar(inst);
  assert.equal(censo.poblacion.ticketsCensados, censo.filas.length,
    `🔴 ${censo.poblacion.ticketsCensados} censados y ${censo.filas.length} filas. Es exactamente `
    + 'el desajuste del 5-sep-2026: dos lecturas del mismo árbol en dos momentos distintos.');
});

test('SCRUM-753 · la instantánea CONGELA el sha, y el censo lo publica', () => {
  const { inst } = banco();
  assert.match(inst.sha, /^[0-9a-f]{40}$/, '🔴 el sha medido no es un sha completo.');
  assert.ok(inst.hora, '🔴 la instantánea no lleva hora. Todo recuento lleva su árbol y su hora.');

  // El CLI mide contra el OBJETO, no contra el nombre del ref. Un `--is-ancestor` sobre un nombre
  // es exacto sobre lo que hubiera en ese microsegundo: respuesta exacta, pregunta indeterminada.
  const codigo = ejecutableDe(fuenteDe(REL_DERIVACION),
    { donde: REL_DERIVACION, ancla: ['instantanea', 'merge-base'] });

  // Los DOS clasificadores preguntan por el OBJETO congelado, y se comprueba uno a uno. El nombre
  // `origin/main` sólo puede aparecer como valor por defecto del parámetro `ref`, que es lo que se
  // resuelve UNA vez con `rev-parse`; a partir de ahí el nombre no vuelve a usarse.
  assert.match(codigo, /--merged=\$\{inst\.sha\}/,
    '🔴 el clasificador a granel ya no pregunta por el sha congelado.');
  assert.match(codigo, /'--is-ancestor', objeto, inst\.sha/,
    '🔴 el árbitro ya no compara contra el sha congelado.');
  assert.equal(/--is-ancestor'[^;]*inst\.ref|--merged=\$\{inst\.ref\}/.test(codigo), false,
    '🔴 hay una comparación contra el NOMBRE del ref. Los worktrees comparten refs: ese nombre se '
    + 'mueve solo mientras corremos (R10), así que la respuesta sería exacta y la pregunta '
    + 'indeterminada — la peor combinación, porque el resultado parece autoritativo.');
  assert.equal(codigo.split('rev-parse').length - 1, 1,
    '🔴 el nombre del ref se resuelve más de una vez: dos `rev-parse` pueden dar dos shas '
    + 'distintos, y ahí vuelve el desajuste entre el recuento y las filas.');
});

test('SCRUM-753 · 🔴 `origin/HEAD` no se cuenta como una rama (respuesta conocida: `ls-remote`)', () => {
  // ─────────────────────────────────────────────────────────────────────────────────────────
  // 🔴 ESTE TEST SE MIDIÓ CONTRA EL REPO REAL Y EN CI NO SE EJECUTABA. Reproducido el 6-sep-2026
  // en un clon con el checkout POR DEFECTO de `actions/checkout` (superficial, una sola rama):
  //
  //     Error: Command failed: git rev-parse origin/main^{commit}
  //     fatal: ambiguous argument 'origin/main^{commit}': unknown revision or path not in the
  //     working tree.                                                        (status 128)
  //
  // En ese clon `origin/main` NO EXISTE, así que `instantanea()` moría antes de llegar a ningún
  // assert. El meta-guard lo cazó y dijo CIEGO —correctamente—, y mientras tanto **el defecto que
  // este test protege estaba sin vigilar en CI aunque el código estuviera arreglado**.
  //
  // Ahora el escenario lo CONSTRUYE el test: un repositorio con su `refs/remotes/origin/HEAD` de
  // verdad y una lista de ramas escrita a mano. No depende del estado de las refs de la máquina,
  // así que se ejecuta igual aquí y en un runner limpio. La capacidad del árbol REAL de contestar
  // ya no es asunto de este test: es asunto del suelo, y lo mide el test del árbol vivo.
  // ─────────────────────────────────────────────────────────────────────────────────────────
  const { raiz, inst } = banco();

  // ① CONTROL POSITIVO DEL ESCENARIO: la trampa TIENE que estar. Sin un `refs/remotes/origin/HEAD`
  //    en el banco, lo de abajo pasaría en verde sobre un repositorio que no tiene qué morder.
  const refsCompletas = execFileSync('git', ['for-each-ref', '--format=%(refname)', PREFIJO_ORIGIN],
    { cwd: raiz, encoding: 'utf8' }).split('\n').map((s) => s.trim()).filter(Boolean);
  assert.ok(refsCompletas.includes(`${PREFIJO_ORIGIN}HEAD`),
    '🔴 el banco no tiene `refs/remotes/origin/HEAD`: no hay trampa que morder y este test no '
    + 'probaría nada.');

  // ② Y LA TRAMPA, ENSEÑADA: git NO abrevia esa ref a `origin/HEAD`, la abrevia a `origin`. Ése
  //    es el motivo entero por el que un filtro por nombre corto la dejaba pasar.
  const cortas = execFileSync('git', ['for-each-ref', '--format=%(refname:short)', PREFIJO_ORIGIN],
    { cwd: raiz, encoding: 'utf8' }).split('\n').map((s) => s.trim()).filter(Boolean);
  assert.ok(cortas.includes('origin'),
    '🔴 git ya no abrevia `refs/remotes/origin/HEAD` a `origin`. Si eso cambió, el comentario del '
    + 'instrumento describe un mundo que no existe y hay que volver a medirlo.');
  assert.equal(cortas.includes('origin/HEAD'), false,
    '🔴 `origin/HEAD` aparece como nombre corto: la premisa del arreglo ha cambiado.');

  // ③ LA RESPUESTA CONOCIDA, escrita a mano en el banco — no derivada del propio censo.
  assert.equal(refsCompletas.length, RAMAS_DEL_BANCO.length + 1,
    `🔴 el banco tiene ${refsCompletas.length} refs y se esperaban ${RAMAS_DEL_BANCO.length} ramas `
    + '+ la HEAD simbólica. El escenario cambió y la respuesta conocida está sin actualizar.');
  assert.deepEqual([...inst.ramas.map((r) => r.nombre)].sort(), [...RAMAS_DEL_BANCO].sort(),
    `🔴 el censo lee ${inst.ramas.length} ramas y el banco tiene ${RAMAS_DEL_BANCO.length}. Git `
    + 'abrevia `refs/remotes/origin/HEAD` a `origin` —no a `origin/HEAD`—, así que un filtro por '
    + 'el nombre corto lo deja pasar como si fuera una rama, y sale siempre DENTRO.');
  assert.equal(inst.ramas.some((r) => r.nombre === 'origin' || r.nombre === 'HEAD'), false,
    '🔴 el puntero simbólico se ha colado en la lista de ramas.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ④ LOS COSTURONES — dos reglas para la misma pregunta, reconciliadas sobre el árbol VIVO
// ═════════════════════════════════════════════════════════════════════════════════════════════

/**
 * 🔴 EL CORPUS GARANTIZADO de nombres de rama, para que este guard no dependa de que el árbol
 * traiga refs. Son las formas que de verdad aparecen en este repo, incluidas las que ya han
 * mordido a alguien: la letra de fase, el sufijo de reintento y el nombre sin ticket.
 *
 * Existe porque medir sólo sobre las refs del árbol dejaba el guard SIN EJECUTAR en un checkout
 * de una sola rama — donde hay una ref, y un acuerdo sobre una ref no es un acuerdo.
 */
const CORPUS_DE_NOMBRES = [
  'scrum-753-censo-de-alcanzabilidad',
  'scrum-684b-albaran-sin-presupuesto',
  'scrum-388-censo-contra-main-rebasada-2',
  'scrum-72-lo-que-sea',
  'scrum-727-constancia',
  'scrum-1727-inventado',
  'codeowners-zona-roja-v2',
  'censo-marcadores-microcopy',
  'main',
];

test('SCRUM-753 · 🔴 las DOS reglas rama→ticket siguen de acuerdo (SCRUM-387 vs SCRUM-738)', () => {
  // El árbol vivo SUMA, no decide: donde hay 500 refs se comparan las 500, y donde el checkout
  // trae una sola (CI) el corpus garantiza que el guard sigue midiendo algo de verdad.
  let delArbol = [];
  try {
    delArbol = instantanea({ raiz: RAIZ, traer: false }).ramas.map((r) => r.nombre);
  } catch {
    delArbol = [];   // un árbol que no puede contestar no invalida el corpus
  }
  const nombres = [...new Set([...CORPUS_DE_NOMBRES, ...delArbol])];
  assert.ok(nombres.length >= CORPUS_DE_NOMBRES.length,
    '🔴 CIEGO: ni siquiera el corpus garantizado ha llegado hasta aquí.');

  // Control positivo del comparador: casos de RESPUESTA CONOCIDA. Sin esto, un cero de abajo
  // podría ser «coinciden» o «el comparador no compara».
  assert.equal(numeroDeRama('scrum-684b-albaran'), 684, '🔴 el comparador no lee la letra de fase.');
  assert.equal(numeroDeClave('SCRUM-684b-albaran'), 684, '🔴 el comparador no lee la letra de fase.');
  assert.equal(numeroDeRama('codeowners-zona-roja-v2'), null, '🔴 el comparador inventa números.');

  const desacuerdos = nombres
    .map((n) => ({ rama: n, a: numeroDeClave(n.replace(/^scrum-/i, 'SCRUM-')), b: numeroDeRama(n) }))
    .filter((x) => x.a !== x.b);
  assert.deepEqual(desacuerdos, [],
    '🔴 `agruparRamas` (que AGRUPA, con `numeroDeClave`) y la población (que ENUMERA, con '
    + '`numeroDeRama`) ya no dicen lo mismo. Mientras coincidan, el censo tiene una sola regla; en '
    + 'cuanto discrepen, un ticket se parte en dos sin que nadie lo vea. Decide cuál vale y déjala '
    + 'sola.');
});

test('SCRUM-753 · 🔴 el clasificador a granel dice LO MISMO que `merge-base --is-ancestor`', () => {
  // En producción se pregunta con `--merged`/`--no-merged` (0,30 s) y no rama a rama (52,6 s,
  // medido sobre 491 refs). Es el mismo criterio preguntado de otra forma, y esto lo comprueba en
  // vez de darlo por hecho.
  const { inst, raiz } = banco();
  const granel = alcanzabilidadDe(inst);
  const arbitro = esAncestroDe(inst);
  let dentro = 0; let fuera = 0; let nulos = 0;
  for (const r of inst.ramas) {
    const a = granel(r.nombre, r.objeto);
    const b = arbitro(r.nombre, r.objeto);
    assert.equal(a, b,
      `🔴 discrepan en «${r.nombre}»: a granel dice ${a} y el árbitro ${b}.`);
    if (a === true) dentro += 1; else if (a === false) fuera += 1; else nulos += 1;
  }
  // 🔴 SUELO DEL PROPIO CONTROL: si el banco sólo tuviera respuestas de un tipo, el bucle de arriba
  // pasaría comparando siempre lo mismo. Los TRES valores tienen que haber salido.
  assert.ok(dentro > 0 && fuera > 0 && nulos > 0,
    `🔴 el banco no ejercita los tres valores (dentro ${dentro} · fuera ${fuera} · nulos ${nulos}): `
    + 'la comparación de arriba no prueba que sepan discrepar.');
  assert.ok(fs.existsSync(path.join(raiz, '.git')), '🔴 el banco no es un repositorio.');
});

test('SCRUM-753 · sobre el ÁRBOL VIVO el detector contesta las DOS cosas, o se DECLARA CIEGO', () => {
  // ─────────────────────────────────────────────────────────────────────────────────────────
  // 🔴 LA PROPIEDAD SE REFORMULÓ PORQUE LA ANTERIOR NO SE PODÍA SOSTENER EN CI, y descubrirlo
  // costó ver el rojo: en un checkout de una sola rama `instantanea()` moría con status 128
  // (`origin/main` no existe) y este test no llegaba a ejecutarse.
  //
  // «El detector contesta las dos cosas» sólo es exigible donde hay refs que clasificar. Lo que SÍ
  // vale en los dos entornos es la regla de la casa: **o contesta, o dice que no puede** — nunca
  // una respuesta a medias en silencio. Y las DOS ramas de la disyuntiva se ejercitan aquí, para
  // que no pase en verde por no haber entrado en ninguna.
  // ─────────────────────────────────────────────────────────────────────────────────────────

  // ── ① EL CASO INCAPAZ, PROVOCADO. No se espera a que CI lo produzca ────────────────────────
  const capado = { ...banco().inst, refspec: '+refs/heads/main:refs/remotes/origin/main' };
  assert.ok(motivosParaNoFiarse(capado, null).length >= 1,
    '🔴 con un clon de una sola rama el censo no se declara incapaz.');
  const sinRef = { ...banco().inst, sha: null, incapaz: 'no se puede resolver «origin/main»' };
  const motivosSinRef = motivosParaNoFiarse(sinRef, null);
  assert.ok(motivosSinRef.some((m) => /no se puede resolver/.test(m)),
    '🔴 una instantánea SIN referencia resuelta no aparece en el suelo. Entonces el CLI la censaría '
    + 'contra un sha nulo y moriría con una traza de git en vez de salir con 2.');

  // ── ② EL ÁRBOL REAL: una cosa o la otra, y las dos son un resultado válido ─────────────────
  let inst = null;
  try {
    inst = instantanea({ raiz: RAIZ, traer: false });
  } catch (e) {
    assert.fail('🔴 `instantanea()` LANZÓ en vez de declararse ciega: ' + String(e.message).split('\n')[0]
      + '\n   Esa es la diferencia entre «no supe medir» y una traza que nadie sabe qué hacer con ella.');
  }
  const motivos = motivosParaNoFiarse(inst, null);
  if (motivos.length) {
    // Éste es el camino que toma un runner con checkout por defecto. Es un resultado, no un fallo:
    // lo que se exige es que lo DIGA y que no haya inventado un sha.
    assert.equal(inst.sha === null || inst.ramas.length <= 1, true,
      `🔴 el censo se declara incapaz (${motivos[0]}) pero trae ${inst.ramas.length} ramas y un sha. `
      + 'O puede medir o no puede: las dos cosas a la vez es lo que hace ilegible un informe.');
    return;
  }

  // El árbol SÍ puede contestar: entonces el detector no puede estar atascado en una sola respuesta.
  const clasificar = alcanzabilidadDe(inst);
  let dentro = 0; let fuera = 0;
  for (const r of inst.ramas) {
    const v = clasificar(r.nombre, r.objeto);
    if (v === true) dentro += 1; else if (v === false) fuera += 1;
  }
  assert.ok(dentro > 0,
    '🔴 NINGUNA rama del árbol es alcanzable desde `main`, y el suelo dice que el árbol SÍ se puede '
    + 'medir. Eso no es un hallazgo, es un fallo de medición.');
  assert.ok(fuera > 0,
    '🔴 TODAS las ramas del árbol salen alcanzables. Con ramas de trabajo abiertas eso es un '
    + 'detector que sólo sabe decir que sí — exactamente lo que este ticket viene a impedir.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⑤ EL TITULAR NO SE IMPRIME SOLO
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-753 · 🔴 el titular agregado sale SIEMPRE con su salvedad, del mismo valor', () => {
  const { inst } = banco();
  const texto = titularConSalvedad(resumenDe(censar(inst, { numeros: CASOS.map((c) => c.n) }).filas));

  assert.match(texto, /\d+ DENTRO/, '🔴 el titular ya no lleva el recuento.');
  assert.match(texto, /NO SON TICKETS HECHOS/,
    '🔴 el número ha quedado SIN la salvedad. «452 de 453 con trabajo en main» no significa 452 '
    + 'hechos, y esa frase suelta es la que hace que se den nueve tickets por cerrados.');
  assert.match(texto, /NO ESTÁN EN LA\s+POBLACIÓN/,
    '🔴 el titular ya no dice que lo que falta no es cero, sino invisible.');

  // 🔴 Y QUE NO SE PUEDAN SEPARAR: van en el MISMO valor de retorno, no en dos `console.log` que
  // alguien pueda copiar a medias.
  const lineas = texto.split('\n');
  assert.ok(lineas.length >= 3,
    '🔴 el titular ha dejado de traer sus dos salvedades pegadas al número.');

  // El CLI no puede imprimir el recuento por su cuenta: el único camino a la salida es esta función.
  const codigo = ejecutableDe(fuenteDe(REL_CLI), { donde: REL_CLI, ancla: 'titularConSalvedad' });
  const impresiones = [...codigo.matchAll(/console\.log\(([^\n]*)\)/g)].map((m) => m[1]);
  const conRecuento = impresiones.filter((l) => /resumen\.(DENTRO|FUERA|NO_MEDIBLE|total)/.test(l));
  assert.deepEqual(conRecuento, [],
    `🔴 el CLI imprime el recuento agregado sin pasar por \`titularConSalvedad\`: ${conRecuento.join(' | ')}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⑥ LO QUE HAY QUE LLEVAR ESCRITO DENTRO — y se comprueba en el fichero, no de palabra
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-753 · 🔴 el instrumento DECLARA lo que es y lo que no puede ver', () => {
  // ⚠️ EXCEPCIÓN DECLARADA a la regla de `_guard-texto.mjs`: aquí se mira el fichero ENTERO,
  // comentarios incluidos, porque lo que se protege ES la prosa. Media docena de frases son la
  // mitad del ticket: sin ellas la salida se lee como un veredicto sobre lo que está hecho.
  const derivacion = fuenteDe(REL_DERIVACION);
  const cli = fuenteDe(REL_CLI);

  const exigidas = [
    [/DECIDE QUÉ \*\*NO\*\* ASIGNAR|DECIDE QUÉ NO ASIGNAR/,
      'que el censo decide qué NO asignar'],
    [/no distingue «se construyó» de «se construyó LO QUE PEDÍAS»|se construyó LO QUE PEDÍAS/,
      'que ninguna señal distingue construir de construir lo pedido'],
    [/ALCANCE INVERTIDO/i, 'el caso medido del ticket entero con el alcance invertido'],
    [/NO PUEDE VER LO ASIGNABLE/i, 'que el censo no puede ver lo asignable'],
    [/sin rama y sin entrada/i, 'la regla de población que produce el punto ciego'],
    [/PROPONE, NUNCA ACTÚA/i, 'que propone y no actúa'],
  ];
  for (const [re, que] of exigidas) {
    assert.ok(re.test(derivacion) || re.test(cli),
      `🔴 el instrumento ha dejado de declarar ${que}. Está escrito en el ticket que eso va DENTRO `
      + 'de la salida, no en la conversación que lo encargó.');
  }

  // El titular es un VALOR, no una frase suelta del CLI: se comprueba el dato.
  assert.match(titularConSalvedad(resumenDe([])), /NO SON TICKETS HECHOS/,
    '🔴 la salvedad ha dejado de viajar con el número.');
});

test('SCRUM-753 · el `fetch` es PROCEDIMIENTO EJECUTADO, no una recomendación', () => {
  const codigo = ejecutableDe(fuenteDe(REL_DERIVACION),
    { donde: REL_DERIVACION, ancla: 'instantanea' });
  assert.match(codigo, /'fetch'/,
    '🔴 la instantánea ya no trae los refs. Sin fetch propio se mide contra lo que dejó la última '
    + 'sesión que pasó por aquí — y los worktrees comparten el espacio de refs (R10).');
  assert.match(codigo, /refs\/heads\/\*:refs\/remotes\/origin\/\*/,
    '🔴 el fetch ya no pide TODAS las ramas.');
  // Y se mide sobre las refs YA TRAÍDAS, no con `ls-remote` contra la red.
  assert.match(codigo, /for-each-ref/, '🔴 ya no se leen las refs locales de origin.');
  assert.equal(/ls-remote/.test(codigo), false,
    '🔴 el censo consulta el remoto en vivo. El ticket pide medir las refs YA TRAÍDAS: con '
    + '`ls-remote` los shas pueden no estar en local y todo saldría indeterminado.');
});

test('SCRUM-753 · ESTO PROPONE: ni escribe, ni sale a la red, ni llama al tablero', () => {
  for (const rel of [REL_DERIVACION, REL_CLI]) {
    const codigo = ejecutableDe(fuenteDe(rel), { donde: rel, ancla: 'export' });
    assert.equal(/writeFileSync|appendFileSync|rmSync|unlinkSync/.test(codigo), false,
      `🔴 «${rel}» escribe en disco. Este censo imprime y nada más.`);
    const sinCadenas = codigo.replace(/'[^'\n]*'|"[^"\n]*"|`[^`]*`/g, "''");
    assert.equal(/\bjira\w*\s*\(|atlassian/i.test(sinCadenas), false,
      `🔴 «${rel}» LLAMA al tablero desde el código.`);
    assert.equal(/\bpush\b.*origin|--delete/.test(sinCadenas), false,
      `🔴 «${rel}» toca el remoto. Esto no borra ramas ni empuja nada.`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⑦ 🔴 EL META-GUARD: que el LECTOR OFICIAL me vea, y que mis mutaciones salgan DE ÉL
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-753 · 🔴 el LECTOR OFICIAL de `meta:mutaciones` VE mis declaraciones', () => {
  // No se cuentan a mano ni se leen con un `grep` propio: se le PREGUNTA AL LECTOR que las va a
  // ejecutar. Medido el 6-sep-2026: un `grep` de la constante daba 9 ficheros y el lector 8 — el
  // noveno sólo la NOMBRA en un comentario. Quien tiene razón es el lector, y por eso decide él.
  const censo = censoDeDeclaraciones(path.join(RAIZ, 'tests'));
  const mio = censo.find((g) => g.guard === YO);
  assert.ok(mio,
    `🔴 el lector oficial NO VE este fichero. \`npm run meta:mutaciones\` no ejecutaría ninguna de `
    + 'mis mutaciones y este guard pasaría en verde sin haberse demostrado nunca.');
  assert.ok(mio.mutaciones.length >= 2,
    `🔴 sólo ${mio.mutaciones.length} mutación(es) legibles por el lector.`);

  // Cada ancla tiene que EXISTIR hoy en el fichero que dice mutar; si no, la declaración caducó y
  // el meta-guard saldría CIEGO en vez de rojo — y un ciego no acusa a nadie.
  for (const m of mio.mutaciones) {
    const abs = path.join(RAIZ, m.fichero);
    assert.ok(fs.existsSync(abs), `🔴 la mutación apunta a «${m.fichero}», que no existe.`);
    // 🔴 SCRUM-796 · CONTRA EL FUENTE DEL REPOSITORIO, no contra el fichero de la copia de
    // trabajo. `meta:mutaciones` sustituye el ancla en ese fichero y LUEGO corre este guard, así
    // que leerlo del disco hacía caer este aserto por definición: era 27 de los 36 arrastres.
    const anc = anclaEnElRepositorio(m, RAIZ);
    assert.ok(anc.medible, `🔴 CIEGO: no puedo comprobar el ancla de «${m.cae}» — ${anc.motivo}`);
    assert.ok(anc.viva,
      `🔴 el ancla de la mutación «${m.cae}» ya no está en «${m.fichero}» (${anc.origen}): la `
      + 'declaración caducó.');
    assert.notEqual(m.de, m.a, '🔴 una mutación que no cambia nada no probaría nada.');
    // El nombre del test que debe caer tiene que ser el de un test DE ESTE fichero.
    assert.ok(fuenteDe(`tests/${YO}`).includes(m.cae),
      `🔴 la mutación dice que caerá «${m.cae}», y aquí no hay ningún test con ese nombre.`);
  }

  // Control negativo del propio lector, con respuesta conocida: una declaración a medias no cuenta.
  assert.deepEqual(mutacionesDeclaradas("export const MUTACIONES_QUE_ME_TUMBAN = [{ fichero: 'x', de: 'a', a: 'b' }];"), [],
    '🔴 el lector acepta una declaración sin `cae`: parecería cobertura y no ejecutaría nada.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LAS MUTACIONES QUE ME TUMBAN — las ejecuta `npm run meta:mutaciones`
//
// 🔴 SE DECLARAN CONTRA LA DERIVACIÓN, no contra este fichero: la única mutación que caza a un
// guard es la que imita el defecto que ese guard promete cazar, y los defectos de este ticket
// viven en el instrumento.
// ═════════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // ① El defecto original del barrido del 4-sep: dar por «dentro» lo que sólo LLEVA EL NÚMERO.
    // Si el clasificador contesta que sí a todo, nadie vuelve a ver una rama con trabajo vivo.
    fichero: 'scripts/_censo-alcanzabilidad.mjs',
    de: '    if (dentro.has(refname)) return true;',
    a: '    return true;',
    cae: 'SCRUM-753 · 🔴 CONTROL POSITIVO: un ticket que NO está en `main`, y el censo lo DICE',
  },
  {
    // ② El tercer estado aplanado contra el segundo: «no se ha podido medir» convertido en «no
    // está». Es el error que hizo que nueve tickets mergeados figuraran como pendientes.
    fichero: 'scripts/_censo-alcanzabilidad.mjs',
    de: '      const motivo = tieneEntrada ? MOTIVOS.SIN_RAMA : MOTIVOS.SIN_RAMA_NI_ENTRADA;',
    a: '      const motivo = MOTIVOS.SIN_RAMA;',
    cae: 'SCRUM-753 · 🔴 el NO_MEDIBLE lleva SIEMPRE su motivo, y los motivos se distinguen',
  },
  {
    // ③ El titular separado de su salvedad: el número desnudo, que es el que se pega en un informe.
    //
    // ⚠️ SE QUEDA CON LA PRIMERA LÍNEA, y esto es una mutación CORREGIDA. La primera versión
    // rompía el literal de la salvedad y dejaba el fichero sin compilar: entonces el fichero de
    // test no llegaba a cargar, no se imprimía ninguna línea `✖ <nombre>`, y el meta-guard dictaba
    // MUDO sobre un guard sano. Es exactamente el rótulo que SCRUM-748 vino a arreglar, sólo que
    // entrando por la puerta de la MUTACIÓN en vez de por la de la línea base. Una mutación tiene
    // que dejar el árbol EJECUTABLE y sólo cambiar lo que el guard promete vigilar.
    fichero: 'scripts/_censo-alcanzabilidad.mjs',
    de: '  ].join(',
    a: '  ].slice(0, 1).join(',
    cae: 'SCRUM-753 · 🔴 el titular agregado sale SIEMPRE con su salvedad, del mismo valor',
  },
  {
    // ④ La vuelta del 454/453: que la población se lea del disco en vez de la instantánea.
    fichero: 'scripts/_censo-alcanzabilidad.mjs',
    de: '  for (const f of inst.entradas) { const n = numeroDeEntrada(f); if (n) deEntradas.add(n); }',
    a: '  for (const f of fs.readdirSync(path.join(inst.raiz, \'docs\', \'master\'))) { const n = numeroDeEntrada(f); if (n) deEntradas.add(n); }',
    cae: 'SCRUM-753 · 🔴 la población NO vuelve a preguntarle a git: sale de la MISMA instantánea',
  },
  {
    // ⑤ El puntero simbólico colado como rama: el 492 donde el remoto tiene 491.
    //
    // ⚠️ MUTACIÓN CORREGIDA, y el error fue instructivo. La primera versión filtraba por
    // `r.nombre !== 'HEAD'` — que es lo que HABÍA antes— pero con el refname COMPLETO ese filtro
    // funciona igual de bien, así que no imitaba nada y el guard no caía. El defecto real no era
    // el filtro solo: era filtrar por el nombre que uno CREE que produce git. Aquí se reproduce
    // esa creencia: `origin/HEAD`, que git no devuelve nunca porque lo abrevia a `origin`.
    fichero: 'scripts/_censo-alcanzabilidad.mjs',
    de: `    .filter((r) => r.refname !== \`\${PREFIJO}HEAD\`);`,
    a: "    .filter((r) => r.nombre !== 'origin/HEAD');",
    cae: 'SCRUM-753 · 🔴 `origin/HEAD` no se cuenta como una rama (respuesta conocida: `ls-remote`)',
  },
];
