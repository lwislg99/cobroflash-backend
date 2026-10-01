// tests/scrum775-suelo-que-no-dispara.test.mjs — SCRUM-775
//
// Sin gate: lee el árbol y git. Ni BD, ni red externa, ni navegador.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// UNA PROTECCIÓN QUE EXISTE, SE LEE BIEN Y NO PROTEGE
//
// `scripts/censo-tablero-vs-arbol.mjs` preguntaba `suelo.ok === false` sobre el valor que devuelve
// `comprobarSuelo`, que es un **ARRAY**. `undefined === false` es siempre falso: **esa mitad del
// suelo no pudo dispararse jamás**. De las dos condiciones sólo vivía la de «cero tickets».
//
// PROVOCADO ANTES DE ARREGLAR NADA, sobre un clon de la fixture de la casa con `docs/master/`
// encogido de 28 entradas a 3 y el historial intacto (111 commits, por encima del mínimo de 100):
//
//     comprobarSuelo(...)  →  ["docs/master/ solo tiene 3 entradas SCRUM-*.md"]   (1 problema)
//     el CLI               →  exit 0, informe completo de 3 tickets, stderr VACÍO
//
// El censo encogió un 89 %, su propio suelo lo vio, y el CLI informó igual. Es el defecto que ese
// fichero existe para cazar —«no supe mirar» leído como «no hay desfase»— cometido por él mismo.
//
// ── ¿ERA UN FALSO VERDE VIVO? ────────────────────────────────────────────────────────────────
// Medido el 6-sep-2026 en el árbol mantenido: NO. 3866 commits y 407 entradas de máster, los dos
// por encima de sus mínimos, así que `comprobarSuelo` devuelve `[]`.
// Y el CLI no corre en CI ni está declarado en `package.json`, así que arreglarlo no pone rojo
// ningún job que hoy esté verde. **Pero sí hay un entorno real donde saltaría**: un clon
// superficial —lo que produce `actions/checkout` por defecto—, donde `origin/main` no resuelve y
// el suelo devuelve 1 problema. Medido en un clon `--depth 1 --single-branch`.
//
// ── LO QUE ESTE FICHERO FIJA ────────────────────────────────────────────────────────────────
//   ① que el suelo SALTE cuando el censo encoge, y que NO estorbe cuando el árbol está sano;
//   ② que las dos bocas del CLI —humana y `--json`— pasen por el mismo suelo;
//   ③ el censo de suelos no conectados, con su control positivo sobre los DOS casos conocidos.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';   // SCRUM-730
import { execFileSync, spawnSync } from 'node:child_process';
import { ejecutableDe } from './_guard-texto.mjs';
import { comprobarSuelo } from './_censo-tickets.mjs';
import { repoFixture, temporalDeFixtureGit, gitDeFixture } from './_censo-fixture.mjs';
import {
  censar, ficherosDe, motivosParaNoFiarse, DEL_ARRAY, formaDeSpawnSync, declaracionVisible,
} from '../scripts/_censo-suelos.mjs';
import ts from 'typescript';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(RAIZ, 'scripts', 'censo-tablero-vs-arbol.mjs');
const DECLARADOS_JSON = path.join('scripts', '_suelos-sin-leer-declarados.json');

// El árbol real se lee y se censa UNA vez por proceso: cuesta ~4 s y lo usan cuatro tests. Lo
// añadió SCRUM-1179-B para que la mitad que cierra no pagase censos repetidos.
let cacheReal = null;
const ficherosReales = () => (cacheReal ??= { ficheros: ficherosDe(RAIZ) }).ficheros;
const censoReal = () => (ficherosReales(), cacheReal.censo ??= censar(cacheReal.ficheros));

/**
 * Un árbol donde el censo ENCOGE: historial sano y `docs/master/` por debajo del mínimo.
 *
 * Se DERIVA de `repoFixture()` (SCRUM-388) y se CLONA en vez de usarse directamente: aquella está
 * cacheada por proceso y la comparten los bancos de SCRUM-388 y SCRUM-738; borrarle entradas les
 * cambiaría el mundo a ellos.
 */
let cacheEncogido = null;
function arbolEncogido() {
  if (cacheEncogido && fs.existsSync(cacheEncogido)) return cacheEncogido;
  const base = repoFixture();
  // SCRUM-1281: en la raíz propia de la familia y con el git que marca la firma del intermitente.
  const raiz = temporalDeFixtureGit('suelo-');
  fs.rmSync(raiz, { recursive: true, force: true });
  gitDeFixture(['clone', '--quiet', base, raiz]);
  execFileSync('git', ['config', 'remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*'],
    { cwd: raiz, stdio: 'ignore' });
  const dir = path.join(raiz, 'docs', 'master');
  const entradas = fs.readdirSync(dir).filter((f) => /^SCRUM-\d+\.md$/.test(f));
  for (const f of entradas.slice(3)) fs.rmSync(path.join(dir, f));
  cacheEncogido = raiz;
  return raiz;
}

const correrCli = (cwd, args = []) =>
  spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', timeout: 600000 });

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ① EL SUELO SALTA CUANDO EL CENSO ENCOGE — y no estorba cuando no
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-775 · 🔴 el banco reproduce el encogimiento, y el suelo lo VE', () => {
  const enc = arbolEncogido();
  const entradas = fs.readdirSync(path.join(enc, 'docs', 'master')).filter((f) => /^SCRUM-\d+\.md$/.test(f));
  assert.equal(entradas.length, 3,
    `🔴 el banco no está encogido: tiene ${entradas.length} entradas y el caso pide 3.`);
  const commits = Number(execFileSync('git', ['rev-list', '--count', 'HEAD'],
    { cwd: enc, encoding: 'utf8' }).trim());
  assert.ok(commits >= 100,
    `🔴 el banco tiene ${commits} commits: por debajo de 100 saltaría la OTRA mitad del suelo y `
    + 'este caso probaría lo que no es.');

  // El instrumento SÍ tiene algo que decir. Sin esto, el exit del CLI no probaría nada.
  const problemas = comprobarSuelo({ raiz: enc });
  assert.equal(problemas.length, 1,
    `🔴 el suelo no ve el encogimiento: devuelve ${JSON.stringify(problemas)}`);
  assert.match(problemas[0], /docs\/master\/ solo tiene 3 entradas/);

  // 🔴 Y LA FORMA DEL DEFECTO, congelada: es un ARRAY, así que `.ok` no existe y jamás existió.
  assert.ok(Array.isArray(problemas), '🔴 `comprobarSuelo` ha dejado de devolver un array.');
  assert.equal(problemas.ok, undefined,
    '🔴 ahora tiene `.ok`. Si eso cambia, la comparación vieja dejaría de ser dead code y este '
    + 'fichero está describiendo un mundo que ya no existe.');

  // CONTROL NEGATIVO: el mismo suelo sobre el árbol de verdad no inventa problemas.
  assert.deepEqual(comprobarSuelo({ raiz: RAIZ }), [],
    '🔴 el suelo salta en el árbol sano: un guard que grita siempre se apaga en una tarde.');
});

test('SCRUM-775 · 🔴 EL QUE DECIDE: con el censo encogido el CLI sale con 2 y DICE por qué', () => {
  const r = correrCli(arbolEncogido());
  assert.equal(r.status, 2,
    `🔴 el CLI ha salido con ${r.status} sobre un árbol que su propio suelo declara no fiable. `
    + 'Antes de SCRUM-775 salía con 0, informe completo y stderr vacío.');
  assert.match(r.stderr, /CENSO VACÍO O SIN CAPACIDAD DE MEDIR/);
  assert.match(r.stderr, /docs\/master\/ solo tiene 3 entradas/,
    '🔴 el suelo salta sin decir POR QUÉ. Un suelo mudo obliga a reproducirlo para entenderlo.');
  // Y no se propone nada: el informe se corta antes de la lista.
  assert.equal(/PROPUESTA · tienen trabajo suyo/.test(r.stdout), false,
    '🔴 el CLI ha impreso su propuesta sobre un árbol que no puede medir.');
});

test('SCRUM-775 · ✅ POSITIVO: con el censo SIN encoger el CLI sigue saliendo con 0', () => {
  // El banco SANO, tal cual lo deja `repoFixture()`. Si tras el arreglo saltara también aquí, el
  // suelo se habría roto por el otro lado y sería peor que antes.
  const r = correrCli(repoFixture());
  assert.equal(r.status, 0,
    `🔴 el CLI sale con ${r.status} sobre un árbol SANO. El arreglo ha convertido el suelo en un `
    + `guard que salta siempre.\n${r.stderr}`);
  assert.equal(r.stderr.trim(), '',
    `🔴 el CLI se queja sobre un árbol sano: ${r.stderr}`);
  assert.match(r.stdout, /PROPUESTA · tienen trabajo suyo/,
    '🔴 el CLI ya no informa en el caso normal.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ② LAS DOS BOCAS PASAN POR EL MISMO SUELO
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-775 · 🔴 `--json` también pasa por el suelo: un programa puede distinguir «no supe medir»', () => {
  // La ruta `--json` salía con 0 SIEMPRE y ANTES del suelo. Su cabecera dice «para otro programa»,
  // y ese programa no tenía forma de distinguir «medido» de «no supe medir» sin parsear prosa.
  const malo = correrCli(arbolEncogido(), ['--json']);
  assert.equal(malo.status, 2,
    `🔴 \`--json\` ha salido con ${malo.status} sobre un árbol no fiable.`);
  const j = JSON.parse(malo.stdout);
  assert.equal(j.fiable, false, '🔴 el JSON no declara que no es fiable.');
  assert.ok(Array.isArray(j.suelo) && j.suelo.length === 1,
    `🔴 el JSON no lleva los motivos del suelo: ${JSON.stringify(j.suelo)}`);

  const bueno = correrCli(repoFixture(), ['--json']);
  assert.equal(bueno.status, 0, `🔴 \`--json\` sale con ${bueno.status} sobre un árbol sano.`);
  const k = JSON.parse(bueno.stdout);
  assert.equal(k.fiable, true, '🔴 el JSON dice que un árbol sano no es fiable.');
  assert.deepEqual(k.suelo, [], '🔴 el JSON inventa motivos sobre un árbol sano.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ③ EL CENSO DE SUELOS NO CONECTADOS
// ═════════════════════════════════════════════════════════════════════════════════════════════

/**
 * EL CASO ROTO, REPRODUCIDO — y no leído de `origin/main`, que es una referencia MÓVIL.
 *
 * 🔴 La primera versión hacía `git cat-file -p origin/main:scripts/censo-tablero-vs-arbol.mjs`
 * para leer el fichero de verdad antes del arreglo. Lo tumbó el censo de SCRUM-723, con razón y
 * por dos motivos que se refuerzan:
 *
 *   ① es una referencia que se mueve sola, y **el día que este ticket entre en `main` el caso
 *      roto deja de estar ahí**: el control se apagaría solo, en silencio y con aspecto de verde;
 *   ② en un clon superficial `origin/main` ni siquiera resuelve — la lección de SCRUM-753.
 *
 * Así que el caso se CONGELA aquí, con la forma exacta que tenía: `comprobarSuelo` construyendo y
 * devolviendo un array, y el guard preguntándole por `.ok`. Verificado contra el fichero real de
 * `origin/main` = `16bd95731883a6c84ceb57820a493c8fe1500f6d` el 6-sep-2026: el censo lo marcaba
 * `scripts/censo-tablero-vs-arbol.mjs:136 · suelo.ok · comprobarSuelo devuelve un ARRAY`, que es
 * exactamente lo que exige este test sobre la reproducción.
 */
const ROTO_CONGELADO = `
export function comprobarSuelo({ raiz = process.cwd(), ref = 'origin/main' } = {}) {
  const problemas = [];
  if (ref) problemas.push('el historial devolvió pocos commits');
  return problemas;
}
const suelo = comprobarSuelo({ raiz: RAIZ });
if (p.ticketsCensados === 0 || (suelo && suelo.ok === false)) {
  console.error('CENSO VACÍO O SIN CAPACIDAD DE MEDIR');
  process.exit(2);
}
`;

test('SCRUM-775 · 🔴 CONTROL POSITIVO: el censo caza los DOS casos conocidos, el roto y el bueno', () => {
  const corpus = [
    { rel: 'scripts/censo-tablero-vs-arbol.mjs', txt: ROTO_CONGELADO },
    { rel: 'scripts/frontera-dist.mjs', txt: fs.readFileSync(path.join(RAIZ, 'scripts/frontera-dist.mjs'), 'utf8') },
  ];
  const c = censar(corpus);

  // ── EL ROTO: tiene que salir NO CONECTADO, y con su motivo ──
  const roto136 = c.noConectados.filter((x) => x.donde.startsWith('scripts/censo-tablero-vs-arbol.mjs'));
  assert.equal(roto136.length, 1,
    `🔴 el censo NO caza el caso roto conocido. Encontró ${c.noConectados.length} no conectados: `
    + JSON.stringify(c.noConectados));
  assert.equal(roto136[0].prop, 'ok');
  assert.equal(roto136[0].fn, 'comprobarSuelo');
  assert.match(roto136[0].devuelve, /ARRAY/);

  // ── EL BUENO (SCRUM-763): tiene que salir CONECTADO ──
  const buenos = c.conectados.filter((x) => x.donde.startsWith('scripts/frontera-dist.mjs'));
  assert.ok(buenos.some((x) => x.prop === 'poblacion' && x.fn === 'censoDeLaFrontera'),
    '🔴 el censo NO reconoce como conectado el suelo que SCRUM-763 sí enchufó. Un censo que sólo '
    + 'encuentra el roto no distingue «no hay más» de «no sé mirar»: sería un detector que sólo '
    + `sabe decir que sí. Conectados vistos ahí: ${JSON.stringify(buenos)}`);
});

test('SCRUM-775 · 🔴 un ARRAY sí tiene `.length`: el censo no acusa a guards sanos', () => {
  // Esto es un defecto PROPIO corregido midiendo la primera salida: el censo marcaba como NO
  // CONECTADOS cinco guards perfectamente buenos (`ocultos.length`, `exportados.includes`…)
  // porque su productor devolvía un array y `length` no estaba entre las propiedades declaradas.
  assert.ok(DEL_ARRAY.has('length'), '🔴 `length` ya no cuenta como propiedad de array.');
  assert.ok(DEL_ARRAY.has('includes'), '🔴 `includes` ya no cuenta como propiedad de array.');
  assert.equal(DEL_ARRAY.has('ok'), false,
    '🔴 `.ok` cuenta como propiedad heredada: entonces el caso roto saldría conectado y este '
    + 'censo no serviría para nada.');

  const sano = [{
    rel: 'scripts/x.mjs',
    txt: 'export function lista() { const out = []; return out; }\n'
       + 'const l = lista();\nif (l.length === 0) { process.exit(2); }\n',
  }];
  assert.deepEqual(censar(sano).noConectados, [],
    '🔴 el censo acusa a un guard que lee `.length` de un array. Es la avería contraria, y la que '
    + 'hace que un censo se desactive en una tarde.');
  assert.equal(censar(sano).conectados.length, 1, '🔴 y tampoco lo reconoce como conectado.');
});

test('SCRUM-775 · el censo declara lo que NO sabe leer, y nunca lo cuenta como conectado', () => {
  const opaco = [{
    rel: 'scripts/y.mjs',
    txt: 'export function raro(x) { return x ? algo() : otro(); }\n'
       + 'const r = raro(1);\nif (r.ok === false) { process.exit(2); }\n',
  }];
  const c = censar(opaco);
  assert.equal(c.conectados.length, 0, '🔴 ha dado por conectado algo que no ha sabido leer.');
  assert.equal(c.noConectados.length, 0, '🔴 ha dictaminado sobre algo que no ha sabido leer.');
  assert.equal(c.ciegos.length, 1, `🔴 no se ha declarado ciego: ${JSON.stringify(c)}`);
  assert.match(c.ciegos[0].porque, /no sé leer los `return`/);

});

test('SCRUM-775 · SUELO del propio censo: cero sobre población vacía NO es un cero', () => {
  const vacio = censar([]);
  const motivos = motivosParaNoFiarse(vacio);
  assert.ok(motivos.length >= 2,
    `🔴 con CERO ficheros el censo no se declara ciego: ${JSON.stringify(motivos)}`);
  assert.ok(motivos.some((m) => /CERO guards/.test(m)),
    '🔴 no dice que no ha reconocido ni un guard.');

  // CONTROL NEGATIVO: sobre el árbol real el suelo NO salta.
  const real = censoReal();
  assert.deepEqual(motivosParaNoFiarse(real), [],
    '🔴 el suelo del censo salta sobre el árbol real: no se podría informar de nada.');
  assert.ok(real.guards > 20,
    `🔴 sólo ${real.guards} guards reconocidos en todo el árbol: el detector no está viendo.`);
  assert.ok(real.conectados.length > 10,
    `🔴 sólo ${real.conectados.length} conectados: si no reconoce suelos buenos, su lista de rotos `
    + 'no significa nada.');
});

test('SCRUM-775 · el arreglo está puesto: `censo-tablero-vs-arbol.mjs` ya no pregunta por `.ok`', () => {
  // ⚠️ SOBRE CÓDIGO EJECUTABLE, y esto me cazó a mí: la primera versión miraba el fichero entero y
  // salió ROJA contra mi PROPIO COMENTARIO, que cita la comparación prohibida para explicar por
  // qué está prohibida. Es el defecto que documenta `_guard-texto.mjs`, cometido otra vez —
  // «cuanto mejor documentas la regla, más te bloquea el mecanismo que la defiende».
  const codigo = ejecutableDe(fs.readFileSync(CLI, 'utf8'),
    { donde: 'scripts/censo-tablero-vs-arbol.mjs', ancla: 'comprobarSuelo' });
  assert.equal(/suelo\s*&&\s*suelo\.ok === false/.test(codigo), false,
    '🔴 ha vuelto la comparación que no puede ser cierta.');
  assert.match(codigo, /suelo\.length > 0/,
    '🔴 el suelo ya no se pregunta por longitud.');

  // Y el censo lo ve CONECTADO — que es lo que cierra el círculo: el instrumento de este ticket
  // reconoce como bueno el arreglo de este ticket.
  const c = censoReal();
  assert.deepEqual(
    c.noConectados.filter((x) => x.donde.startsWith('scripts/censo-tablero-vs-arbol.mjs')), [],
    '🔴 el censo sigue viendo un suelo no conectado en el fichero que este ticket arregla.');
  assert.ok(
    c.conectados.some((x) => x.donde.startsWith('scripts/censo-tablero-vs-arbol.mjs') && x.fn === 'comprobarSuelo'),
    '🔴 el censo NO ve el suelo arreglado. Si al sacar la condición a una variable el guard se '
    + 'vuelve invisible, este censo se queda ciego justo en el caso que lo motivó.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-1179 (parte B, 2 de 4) — LA MITAD QUE CIERRA
//
// Lo de arriba solo exige «conectado» para UN fichero. Un suelo NUEVO escrito sin conectar salía
// en `npm run censo:suelos` con código 1, y nada corría ese comando. Y un suelo nuevo que el censo
// no sabe leer caía en «NO SÉ LEER» sin que nadie lo mirase: la familia «no pude mirar = no hay
// nada». Aquí, sobre el árbol real:
//   · NO CONECTADOS tiene que ser CERO (hoy lo es): cualquiera nuevo → rojo.
//   · NO SÉ LEER se compara con scripts/_suelos-sin-leer-declarados.json en las dos direcciones.
//     La clave es FICHERO · FUNCIÓN PRODUCTORA · variable.propiedad, con su cuenta (un fichero
//     puede leer dos veces lo mismo), nunca la línea.
// Fail-closed: si el censo no se fía de sí mismo (motivosParaNoFiarse), no se compara nada.
// ═════════════════════════════════════════════════════════════════════════════════════════════

const claveSinLeer = (x) => `${x.donde.replace(/:\d+$/, '')} · ${x.fn} · ${x.variable}.${x.prop}`;

function compararSuelos(c, declarados) {
  const motivos = motivosParaNoFiarse(c);
  if (motivos.length) throw new Error(`🔴 CIEGO: el censo de suelos no se fía de sí mismo: ${motivos.join(' · ')}`);
  const vistos = new Map();
  for (const x of c.ciegos) vistos.set(claveSinLeer(x), (vistos.get(claveSinLeer(x)) || 0) + 1);
  const nuevas = [];
  const sobran = [];
  for (const [k, n] of vistos) {
    const d = declarados.ciegos[k]?.cuantos || 0;
    if (n > d) nuevas.push(`${k} (${n} vistos, ${d} declarados)`);
  }
  for (const [k, v] of Object.entries(declarados.ciegos)) {
    const n = vistos.get(k) || 0;
    if (n < v.cuantos) sobran.push(`${k} (${n} vistos, ${v.cuantos} declarados)`);
  }
  return { noConectados: c.noConectados.map((x) => `${x.donde} · ${x.fn} · ${x.variable}.${x.prop}`), nuevas, sobran };
}

function leerDeclaradosSuelos() {
  const j = JSON.parse(fs.readFileSync(path.join(RAIZ, DECLARADOS_JSON), 'utf8'));
  assert.ok(j && typeof j.ciegos === 'object' && Array.isArray(j.retiradas),
    `🔴 ${DECLARADOS_JSON} no tiene la forma {ciegos: {}, retiradas: []}.`);
  return j;
}

test('SCRUM-1179-B · trinquete: cero NO CONECTADOS y los NO SÉ LEER == lo declarado', () => {
  const { noConectados, nuevas, sobran } = compararSuelos(censoReal(), leerDeclaradosSuelos());
  assert.deepEqual(noConectados, [],
    `🔴 SUELO NO CONECTADO: ${noConectados.join(', ')}.\n`
    + '  Ese guard lee una propiedad que su productor no fabrica nunca: su condición no puede ser\n'
    + '  cierta. Se arregla el guard (regla 41). Detalle: `npm run censo:suelos`.');
  assert.deepEqual(nuevas, [],
    `🔴 NUEVO suelo que el censo NO SABE LEER: ${nuevas.join(', ')}.\n`
    + '  Nadie puede decir si ese guard puede saltar. Escríbelo legible (que el productor esté en\n'
    + '  la población y devuelva algo que se pueda leer) o decláralo en «ciegos» de\n'
    + `  ${DECLARADOS_JSON} con su motivo. Detalle: \`node scripts/censo-suelos.mjs --ciegos\`.`);
  assert.deepEqual(sobran, [],
    `🔴 SOBRA (declarado sin leer y ya no sale así): ${sobran.join(', ')}.\n`
    + `  Si mejoró, baja su cuenta o muévelo a «retiradas» de ${DECLARADOS_JSON} con su motivo.`);
});

test('SCRUM-1179-B · cada declarado lleva cuenta y motivo; cada retirada, id y motivo', () => {
  const d = leerDeclaradosSuelos();
  for (const [k, v] of Object.entries(d.ciegos)) {
    assert.ok(v && v.motivo && Number.isInteger(v.cuantos) && v.cuantos > 0, `declarado cojo: ${k}`);
  }
  for (const r of d.retiradas) assert.ok(r && r.id && r.motivo, `retirada sin id o sin motivo: ${JSON.stringify(r)}`);
});

test('SCRUM-1179-B · control POSITIVO: el roto real de SCRUM-775 y un guard opaco, metidos en el árbol real, salen', () => {
  // El árbol real con dos defectos inyectados EN MEMORIA (nada toca el disco): el fichero de
  // SCRUM-775 tal como estaba roto, y un guard nuevo cuyo productor no se puede leer.
  // Y dos guards de HOY desconectados a propósito, uno de cada clase que el censo aprendió a leer
  // en SCRUM-1179-B (sin esto, el «0 no conectados» del árbol real sería un cero sin probar):
  // un productor con `return null` en un camino, y un `spawnSync`.
  const DESCONECTA = new Map([
    ['scripts/censo-etiquetas-del-documento.mjs', ['if (p.host === PROD_HOST)', 'if (p.hostQueNoExiste === PROD_HOST)']],
    ['scripts/guards-entrada.mjs', ['if (r.status !== 0) {', 'if (r.estadoQueNoExiste !== 0) {']],
  ]);
  const ficheros = ficherosReales()
    .map((f) => (f.rel === 'scripts/censo-tablero-vs-arbol.mjs' ? { ...f, txt: ROTO_CONGELADO } : f))
    .map((f) => {
      const d = DESCONECTA.get(f.rel);
      if (!d) return f;
      assert.ok(f.txt.includes(d[0]), `la sonda del control ya no encuentra \`${d[0]}\` en ${f.rel}: actualízala`);
      return { ...f, txt: f.txt.replace(d[0], d[1]) };
    })
    .concat([{ rel: 'scripts/y1179.mjs',
      txt: 'export function raro(x) { return x ? algo() : otro(); }\n'
         + 'const r = raro(1);\nif (r.ok === false) { process.exit(2); }\n' }]);
  const { noConectados, nuevas } = compararSuelos(censar(ficheros), leerDeclaradosSuelos());
  assert.ok(noConectados.some((x) => x.startsWith('scripts/censo-tablero-vs-arbol.mjs')),
    `🔴 el trinquete NO acusa el suelo roto real de SCRUM-775. Acusó: ${noConectados.join(', ') || '(nada)'}`);
  for (const [rel, [, a]] of DESCONECTA) {
    const prop = /\.(\w+QueNoExiste)/.exec(a)[1];
    assert.ok(noConectados.some((x) => x.startsWith(rel) && x.endsWith(`.${prop}`)),
      `🔴 desconecté a propósito un guard de ${rel} (\`.${prop}\`) y el censo NO lo acusa. Acusó: ${noConectados.join(', ') || '(nada)'}`);
  }
  assert.equal(noConectados.length, 1 + DESCONECTA.size,
    `🔴 se inyectaron ${1 + DESCONECTA.size} defectos y acusa ${noConectados.length}: ${noConectados.join(', ')}`);
  assert.ok(nuevas.some((x) => x.startsWith('scripts/y1179.mjs · raro · r.ok')),
    `🔴 un guard nuevo que el censo no sabe leer pasa sin que nadie lo diga. Nuevas: ${nuevas.join(', ') || '(nada)'}`);
});

// Lo que el censo aprendió a leer en SCRUM-1179-B, porque 57 de los 75 NO SÉ LEER eran corteza
// del censo y no de los guards. Cada capacidad con lo que TIENE que acusar y lo que NO.
test('SCRUM-1179-B · `return null` en un camino no ciega: se leen los otros, y el roto se acusa', () => {
  const prod = 'export function f(x) { if (!x) return null; if (x > 9) return; return { ok: true }; }\n';
  const sano = censar([{ rel: 'scripts/a.mjs', txt: prod + 'const r = f(1);\nif (!r.ok) { process.exit(2); }\n' }]);
  assert.equal(sano.conectados.length, 1, `🔴 no ve conectado \`r.ok\`: ${JSON.stringify(sano)}`);
  const roto = censar([{ rel: 'scripts/a.mjs', txt: prod + 'const r = f(1);\nif (r.fallo) { process.exit(2); }\n' }]);
  assert.equal(roto.noConectados.length, 1, `🔴 no acusa \`r.fallo\`, que f no fabrica: ${JSON.stringify(roto)}`);
  const soloNull = censar([{ rel: 'scripts/a.mjs', txt: 'export function f() { return null; }\nconst r = f();\nif (r.ok) { process.exit(2); }\n' }]);
  assert.equal(soloNull.ciegos.length, 1, '🔴 una función que SÓLO devuelve null no se puede leer: tiene que salir ciega');
});

test('SCRUM-1179-B · la forma de `spawnSync` se DERIVA ejecutándolo, y un `.ok` sobre ella se acusa', () => {
  const forma = formaDeSpawnSync();
  assert.ok(forma && forma.includes('status') && forma.includes('error'),
    `🔴 la forma derivada de spawnSync no trae status y error: ${JSON.stringify(forma)}`);
  const cab = "import { spawnSync } from 'node:child_process';\nconst r = spawnSync('x', []);\n";
  const sano = censar([{ rel: 'scripts/b.mjs', txt: cab + 'if (r.status !== 0) { process.exit(1); }\n' }]);
  assert.equal(sano.conectados.length, 1, `🔴 \`r.status\` de spawnSync no sale conectado: ${JSON.stringify(sano)}`);
  const roto = censar([{ rel: 'scripts/b.mjs', txt: cab + 'if (!r.ok) { process.exit(1); }\n' }]);
  assert.equal(roto.noConectados.length, 1, `🔴 \`r.ok\` sobre spawnSync no se acusa: ${JSON.stringify(roto)}`);
});

test('SCRUM-1179-B · la variable se resuelve en SU ámbito: dos `r` en dos funciones no se pisan', () => {
  // El caso real de `turno-staging.mjs`: sin esto, el `r.ok` de la segunda función se atribuía
  // al spawnSync de la primera y salía un «no conectado» falso.
  const txt = "import { spawnSync } from 'node:child_process';\n"
    + "function rama() { const r = spawnSync('git', []); return r.stdout; }\n"
    + 'async function turno() { const r = await pedir(); if (!r.ok) { process.exit(2); } }\n';
  const c = censar([{ rel: 'scripts/c.mjs', txt }]);
  assert.deepEqual(c.noConectados, [], `🔴 el \`r\` de turno() se ha atribuido al spawnSync de rama(): ${JSON.stringify(c.noConectados)}`);
  const id = ts.forEachChild(ts.createSourceFile('d.mjs', 'const a = f();\nfunction g(a) { return a.x; }\n', ts.ScriptTarget.Latest, true),
    function busca(n) { return (ts.isPropertyAccessExpression(n) && n.expression) || ts.forEachChild(n, busca); });
  assert.equal(id && id.text, 'a', 'la sonda del test no encontró `a.x`');
  assert.equal(declaracionVisible(id), null, '🔴 un parámetro se ha resuelto a la variable de fuera');
});

test('SCRUM-1179-B · fail-closed: un censo sobre población vacía sale CIEGO, no «cero hallazgos»', () => {
  assert.throws(() => compararSuelos(censar([]), leerDeclaradosSuelos()), /CIEGO/);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LAS MUTACIONES QUE ME TUMBAN — las ejecuta `npm run meta:mutaciones`
// ═════════════════════════════════════════════════════════════════════════════════════════════
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL ANCLA SE ACORTÓ EL 8-SEP-2026, Y ÉSTA ES LA RAZÓN — que va aquí para que dentro de dos
// semanas nadie tenga que reconstruirla.
//
//   ANTES:  '  const noSeFia = p.ticketsCensados === 0 || suelo.length > 0;'   ← la LÍNEA ENTERA
//   AHORA:  'suelo.length > 0'                                                 ← sólo la DECISIÓN
//
// QUÉ LA MOVIÓ: SCRUM-804 añadió un tercer término a esa misma expresión —`|| esCiego(rastro
// .resumen)`, la dimensión de rama viva—. La línea dejó de ser idéntica, el `includes(mut.de)`
// del meta-guard no la encontró y el job salió **CIEGO con exit 2**. Ni rojo ni verde: «no supe
// mirar», que es lo que este instrumento tiene que decir y dijo.
//
// POR QUÉ ESTE TROZO Y NO OTRO. El defecto que SCRUM-775 vigila es EXACTAMENTE éste: preguntar
// `suelo.ok === false` sobre un ARRAY, que nunca es cierto, en vez de `suelo.length > 0`. Anclar
// a la línea entera ataba la declaración a los VECINOS de esa decisión, y los vecinos cambian:
// cualquiera que añada un término a `noSeFia` —que es lo normal, es la puerta del suelo— vuelve
// a caducarla. `suelo.length > 0` es la decisión misma, y no cambia mientras el guard tenga
// sentido. Medido: aparece **una sola vez** en el fichero, así que el `replace` (que sustituye la
// PRIMERA aparición) no puede acertarle a otro sitio.
//
// ⛔ Y NO SE HA RELAJADO NADA. Las dos mutaciones siguen produciendo el MISMO código que antes en
// la parte que importa, y los términos que SCRUM-804 añadió se conservan — o sea que ① sigue
// dejando pasar un árbol encogido y ② sigue tumbando uno sano. Es la lección de SCRUM-636 y la
// que volvió a morder hoy en SCRUM-632: una cita por posición caduca; una cita por contenido
// estable, no.
// ═════════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // ① El defecto original, reconstruido: el suelo vuelve a preguntar por una propiedad que el
    // array nunca tiene. El CLI vuelve a salir con 0 sobre un árbol encogido.
    fichero: 'scripts/censo-tablero-vs-arbol.mjs',
    de: 'suelo.length > 0',
    a: '(suelo && suelo.ok === false)',
    cae: 'SCRUM-775 · 🔴 EL QUE DECIDE: con el censo encogido el CLI sale con 2 y DICE por qué',
  },
  {
    // ② La avería CONTRARIA: un suelo que salta siempre. `[]` es truthy, así que preguntar por el
    // array sin más pondría rojo también el árbol sano — y un guard que grita siempre se apaga.
    fichero: 'scripts/censo-tablero-vs-arbol.mjs',
    de: 'suelo.length > 0',
    a: 'Boolean(suelo)',
    cae: 'SCRUM-775 · ✅ POSITIVO: con el censo SIN encoger el CLI sigue saliendo con 0',
  },
  {
    // ③ El censo de suelos, ciego a los productores que devuelven un array: dejaría de cazar el
    // caso conocido y su «0 no conectados» pasaría a no significar nada.
    fichero: 'scripts/_censo-suelos.mjs',
    de: '                const heredadas = info.devuelveArray ? DEL_ARRAY : DEL_OBJETO;',
    a: '                const heredadas = new Set([...DEL_ARRAY, \'ok\']);',
    cae: 'SCRUM-775 · 🔴 CONTROL POSITIVO: el censo caza los DOS casos conocidos, el roto y el bueno',
  },
];
