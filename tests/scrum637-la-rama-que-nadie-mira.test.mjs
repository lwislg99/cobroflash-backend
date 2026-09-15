// tests/scrum637-la-rama-que-nadie-mira.test.mjs — SCRUM-637
//
// Sin gate y SIN RED: no hace `fetch`. Lee refs que este clon ya tiene y ejercita funciones puras.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 QUÉ IMPIDE ESTO
//
// LA VÍCTIMA, del propio ticket: el asesor dio durante dos días URLs de PR construidas a partir
// del número del ticket (`.../pull/new/scrum-614`) para ramas que se llaman
// `scrum-614-censo-rutas-sin-rol`. GitHub contestaba «There isn't anything to compare». Y del otro
// lado: «trece ramas de agosto con trabajo terminado que nadie sabe que están ahí».
//
// EL DEFECTO QUE VIGILA es el de los propios instrumentos. Los tres scripts de
// `scripts/verificacion-s5/` rotulados SCRUM-637 **no tenían NI UNA línea de test** el 8-sep-2026:
// ningún `tests/scrum637-*`, nada en `package.json`. Un instrumento de medición sin red no falla
// ruidosamente cuando se rompe: **empieza a devolver listas vacías o mal ordenadas, y una lista
// vacía se lee igual que «no hay nada pendiente»** — que es exactamente el estado que el ticket
// existe para hacer visible.
//
// Por eso aquí el suelo pesa tanto como los positivos: casi todos los modos de fallo de esta
// familia terminan en un cero silencioso, no en una excepción.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { instantanea, alcanzabilidadDe } from '../scripts/_censo-alcanzabilidad.mjs';
import { edadEnDias, urlDeCompare, ordenarPorEdad, suelo, INTOCABLES }
  from '../scripts/verificacion-s5/ramas-sin-mergear.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(RAIZ, 'scripts', 'verificacion-s5');
const PKG = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));

/** Los tres scripts que este ticket rotula. Si alguien añade un cuarto, que lo declare aquí. */
const SCRIPTS_637 = ['ramas-sin-mergear.mjs', 'ramas-borrables.mjs', 'enlace-ticket-rama.mjs'];

/**
 * La instantánea del árbol de hoy, SIN traer nada de la red.
 *
 * `traer: false` no es una optimización: `npm test` corre en CI y en veinticuatro worktrees, y un
 * `fetch` desde un test cambiaría el espacio de refs COMPARTIDO mientras otras sesiones miden
 * contra él. Se mide lo que este clon ya tiene, que para lo que se comprueba aquí basta.
 */
let INST = null;
function arbol() {
  if (!INST) INST = instantanea({ raiz: RAIZ, traer: false });
  return INST;
}

const git = (...args) => execFileSync('git', args,
  { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });

/**
 * LA POBLACIÓN QUE EL AUTO-BORRADO NO PUEDE ENCOGER · SCRUM-833.
 *
 * 🔴 COPIADA DE `scrum804-la-rama-viva.test.mjs`, Y A PROPÓSITO. Aquel guard tenía por sujetos
 * RAMAS VIVAS del remoto; el auto-borrado al mergear se llevó \~390 y, sin sujetos que interrogar,
 * se puso rojo con el sistema sano y frenó todos los PR durante dos días. Este fichero tenía la
 * MISMA forma en su control negativo. Dos formas distintas para el mismo problema es como nace la
 * próxima contradicción, así que aquí no se inventa una tercera: se usa la que ganó.
 *
 *     🔒 Si el borrado de una rama puede cambiar tu medición, no estabas midiendo el trabajo:
 *        estabas midiendo el envase.
 *
 * Un `git log --merges` es PERMANENTE: el commit de merge y su segundo padre siguen siendo
 * alcanzables desde `main` aunque la rama se borrara del remoto el mismo día. Sólo puede CRECER.
 *
 * Devuelve `{ merge, p2, rama }`. `p2` —el segundo padre— es la punta que tenía la rama al
 * mergearse: está dentro de `main` POR CONSTRUCCIÓN, y ésa es la respuesta conocida del árbitro.
 */
function ramasDeLaHistoriaDeMerges(sha) {
  const filas = [];
  for (const linea of git('log', '--merges', '--format=%H%x09%P%x09%s', sha).split('\n')) {
    const [merge, padres, ...resto] = linea.split('\t');
    if (!merge || !padres || resto.length === 0) continue;
    // Sólo los merges de PR traen el NOMBRE de la rama en el asunto. Los `Merge … into <rama>`
    // son la dirección contraria —main entrando en la rama— y no dicen qué se entregó.
    const m = /^Merge pull request #\d+ from [^/\s]+\/(\S+)$/.exec(resto.join('\t').trim());
    if (!m) continue;
    const p2 = String(padres).trim().split(/\s+/)[1];
    if (!p2) continue;
    filas.push({ merge, p2, rama: m[1] });
  }
  return filas;
}

// ═══ ① SUELO — sin esto, todo lo de abajo sería cierto sobre un conjunto vacío ════════════

test('SCRUM-637 · 🔴 SUELO: el módulo carga y sus cuatro decisiones se pueden EJECUTAR', () => {
  for (const [nombre, fn] of [['edadEnDias', edadEnDias], ['urlDeCompare', urlDeCompare],
    ['ordenarPorEdad', ordenarPorEdad], ['suelo', suelo]]) {
    assert.equal(typeof fn, 'function', `🔴 el módulo no publica \`${nombre}\`.`);
  }
  assert.ok(INTOCABLES.has('main'), '🔴 `main` ha dejado de ser intocable: se puede colar en la lista.');
});

test('SCRUM-637 · 🔴 SUELO: este clon VE las refs, o lo de abajo no mide nada', () => {
  const inst = arbol();
  assert.equal(inst.incapaz, null, `🔴 no se pudo resolver origin/main: ${inst.incapaz}`);

  // 🔴 AQUÍ HABÍA `inst.ramas.length > 50`, Y ERA EL TERCER MIEMBRO DE LA FAMILIA DE SCRUM-833.
  // Lo cazó el censo de este mismo ticket, dentro del fichero que venía a arreglar: con 97 refs
  // vivas quedaban 47 de margen, y el auto-borrado se lleva ramas cada día. Un número escrito a
  // mano no envejece mejor por estar en un suelo.
  //
  // Lo que se quería vigilar sigue siendo verdad y sigue vigilado: un clon SUPERFICIAL devuelve
  // una lista corta SIN fallar (SCRUM-388). Pero la señal buena de un clon superficial no es
  // «pocas refs» —eso también lo produce una limpieza legítima—: es que **no hay historia**. Y un
  // `git log --merges` vacío es exactamente eso, sin ninguna cifra que caduque.
  const merges = ramasDeLaHistoriaDeMerges(inst.sha);
  assert.ok(merges.length > 0,
    '🔴 CENSO CIEGO: cero merges de PR en la historia de `main`. O el clon es superficial —un\n'
    + '   `--depth` no trae merges— o el patrón del asunto dejó de casar. En los dos casos, los\n'
    + '   controles de abajo pasarían solos sobre una lista corta.');
});

// ═══ ② EL DATO QUE FALTABA: LA EDAD ══════════════════════════════════════════════════════

test('SCRUM-637 · ✅ la edad se calcula en días, y el reloj entra por parámetro', () => {
  const ahora = new Date('2026-09-08T12:00:00Z');
  assert.equal(edadEnDias('2026-09-01T12:00:00Z', ahora), 7, '🔴 una semana no da 7 días.');
  assert.equal(edadEnDias('2026-09-08T11:00:00Z', ahora), 0, '🔴 la de hoy no da 0.');
  assert.equal(edadEnDias('2026-07-10T12:00:00Z', ahora), 60);
});

test('SCRUM-637 · 🔴 una fecha ilegible da `null`, NUNCA 0', () => {
  // Un 0 diría «es de hoy», que es lo contrario de «no lo sé», y ordenaría la lista al revés:
  // la rama cuya fecha no se pudo leer se iría con las nuevas y dejaría de mirarse.
  for (const malo of ['', null, undefined, 'ayer', '2026-13-45', {}]) {
    assert.equal(edadEnDias(malo, new Date()), null,
      `🔴 \`${JSON.stringify(malo)}\` no da null: se está inventando una edad.`);
  }
});

test('SCRUM-637 · 🔴 lo VIEJO va primero y lo que no tiene fecha va al FINAL', () => {
  const filas = [
    { rama: 'nueva', dias: 1 }, { rama: 'sin-fecha', dias: null },
    { rama: 'vieja', dias: 60 }, { rama: 'media', dias: 30 },
  ];
  assert.deepEqual(ordenarPorEdad(filas).map((f) => f.rama), ['vieja', 'media', 'nueva', 'sin-fecha'],
    '🔴 el orden no pone lo más olvidado arriba. La lista existe para que lo viejo se vea.');
});

test('SCRUM-637 · el orden es ESTABLE: dos corridas seguidas dan la misma lista', () => {
  // Sin desempate por nombre, dos ramas del mismo día se alternarían entre corridas y la lista
  // parecería cambiar sin que nada hubiera cambiado.
  const filas = [{ rama: 'b', dias: 5 }, { rama: 'a', dias: 5 }, { rama: 'c', dias: 5 }];
  assert.deepEqual(ordenarPorEdad(filas).map((f) => f.rama), ['a', 'b', 'c']);
  assert.deepEqual(ordenarPorEdad(ordenarPorEdad(filas)).map((f) => f.rama), ['a', 'b', 'c']);
});

// ═══ ③ LA URL NO SE CONSTRUYE CON EL NÚMERO: SE DERIVA ═══════════════════════════════════

test('SCRUM-637 · 🔴 EL DEFECTO DEL TICKET: la URL lleva el NOMBRE REAL, no el número', () => {
  const url = urlDeCompare('https://github.com/lwislg99/cobroflash-backend.git', 'scrum-614-censo-rutas-sin-rol');
  assert.ok(url.includes('scrum-614-censo-rutas-sin-rol'),
    '🔴 la URL no lleva el nombre real de la rama.');
  assert.ok(!/compare\/main\.\.\.scrum-614(\?|$)/.test(url),
    '🔴 la URL se ha construido con el número del ticket. Eso es literalmente el defecto que abrió\n'
    + '   SCRUM-637: dos días dando `pull/new/scrum-614` para una rama que se llama de otra forma,\n'
    + '   con GitHub contestando «There isn\'t anything to compare».');
});

test('SCRUM-637 · la URL se deriva del remoto REAL, en sus dos formas', () => {
  const esperada = 'https://github.com/lwislg99/cobroflash-backend/compare/main...x?expand=1';
  assert.equal(urlDeCompare('https://github.com/lwislg99/cobroflash-backend.git', 'x'), esperada);
  assert.equal(urlDeCompare('git@github.com:lwislg99/cobroflash-backend.git', 'x'), esperada,
    '🔴 un remoto por SSH no da la misma URL: quien lo tenga así vería enlaces distintos.');
});

test('SCRUM-637 · 🔴 un remoto que no se reconoce da `null`, no una URL inventada', () => {
  // Media línea de menos es mejor que un enlace que no abre — que es el defecto original.
  for (const malo of ['', null, 'https://gitlab.com/x/y', 'no-es-una-url']) {
    assert.equal(urlDeCompare(malo, 'x'), null, `🔴 \`${JSON.stringify(malo)}\` produce una URL.`);
  }
  assert.equal(urlDeCompare('https://github.com/a/b', ''), null, '🔴 sin rama no puede haber URL.');
});

// ═══ ④ EL SUELO: UNA LISTA VACÍA ES CEGUERA, NO BUENAS NOTICIAS ══════════════════════════

test('SCRUM-637 · 🔴 SUELO: cero ramas fuera de main se declara CIEGO', () => {
  const r = suelo({ totalRefs: 553, sinMergear: 0 });
  assert.equal(r.ciego, true,
    '🔴 con CERO ramas sin mergear el instrumento se da por bueno. El 8-sep-2026 había 86: un cero\n'
    + '   ahí no es «ya no queda trabajo pendiente», es que dejó de ver.');
  assert.match(r.motivo, /86|cero|CERO/i, '🔴 el motivo no dice contra qué se compara.');
});

test('SCRUM-637 · 🔴 SUELO: cero refs leídas TAMBIÉN es ceguera (el clon superficial)', () => {
  assert.equal(suelo({ totalRefs: 0, sinMergear: 0 }).ciego, true,
    '🔴 sin refs se sigue adelante. Un clon de una sola rama devuelve una lista corta sin error.');
  assert.equal(suelo({ incapaz: 'no se puede resolver origin/main' }).ciego, true,
    '🔴 sin poder resolver `origin/main` no hay contra qué medir, y eso NO es «no hay trabajo fuera».');
});

test('SCRUM-637 · ✅ CONTROL NEGATIVO del suelo: con datos normales NO se declara ciego', () => {
  // Sin esto, un suelo que dijera «ciego» siempre pasaría los dos tests de arriba y dejaría el
  // instrumento inservible en verde.
  assert.equal(suelo({ totalRefs: 553, sinMergear: 86 }).ciego, false,
    '🔴 el suelo se declara ciego con datos buenos: el instrumento nunca daría una lista.');
});

// ═══ ⑤ CONTRA EL ÁRBOL DE VERDAD ═════════════════════════════════════════════════════════

// 🔴 REESCRITO EN SCRUM-833, Y POR DOS MOTIVOS DISTINTOS. El de fuera y el de dentro.
//
// ① EL DE FUERA — el que traía el ticket. Exigía `dentro.length > 10` sobre RAMAS VIVAS ya
//    mergeadas, y el auto-borrado se las lleva al mergear. Medido el 9-sep-2026: quedaban 17, o
//    sea SIETE de margen. Es la misma bomba que en SCRUM-804 explotó y frenó 26 PR dos días.
//    Ahora los sujetos salen de `git log --merges`, que sólo puede crecer.
//
// ② 🔴 EL DE DENTRO, QUE ERA PEOR Y NO ESTABA EN EL TICKET. El aserto que decía comprobar «una
//    rama ya mergeada no aparece como pendiente» era UNA TAUTOLOGÍA: cruzaba `dentro` (alcanzable
//    === true) con `fuera` (alcanzable === false), dos conjuntos complementarios por construcción.
//    Su intersección es vacía SIEMPRE, pase lo que pase con el código. Medido: 0, y no puede ser
//    otra cosa. Un control que no puede fallar no es un control: es un comentario que ocupa sitio
//    en el recuento de tests.
//
//    Se sustituye por lo único que sí distingue: contrastar la clasificación del censo contra un
//    ORÁCULO INDEPENDIENTE —`git merge-base --is-ancestor`, que no comparte código con
//    `alcanzabilidadDe`—. Comparar algo consigo mismo siempre da «de acuerdo».
test('SCRUM-637 · 🔴 NEGATIVO: una rama que SÍ está en main NO aparece como sin mergear', () => {
  const inst = arbol();
  const alcanzable = alcanzabilidadDe(inst);

  // 🔴 A GRANEL, con UN `rev-list`. La primera versión llamaba a `merge-base --is-ancestor` por
  // sujeto: 1.200 procesos y 366 s medidos. Un guard que tarda seis minutos se acaba sacando de
  // la tanda, y entonces da igual lo bien que mida. Copiado de SCRUM-804, que ya lo resolvió.
  const alcanzables = new Set(git('rev-list', inst.sha).split('\n').map((l) => l.trim()).filter(Boolean));
  const esAncestro = (objeto) => alcanzables.has(String(objeto).trim());

  // …y el atajo NO se cree a sí mismo: se contrasta contra el mandato de git en los DOS sentidos,
  // sobre una muestra. Si `rev-list` y `merge-base` discrepasen, todo lo de abajo sería humo.
  const mandato = (objeto) => {
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', objeto, inst.sha],
        { cwd: RAIZ, stdio: ['ignore', 'ignore', 'ignore'] });
      return true;
    } catch { return false; }
  };

  // ── SUELO ①: la población PERMANENTE. No la puede vaciar ningún borrado de ramas.
  const merges = ramasDeLaHistoriaDeMerges(inst.sha);
  assert.ok(merges.length > 0,
    '🔴 CIEGO: cero merges de PR en la historia de `main`. O este clon está superficial, o el\n'
    + '   patrón del asunto dejó de casar. Sin sujetos, lo de abajo no distingue nada.');

  // ── RESPUESTA CONOCIDA: el segundo padre de un merge de PR está dentro de `main` POR
  //    CONSTRUCCIÓN. Si el oráculo no lo dice, el oráculo está roto — y entonces que censo y
  //    oráculo «coincidan» no probaría nada: probaría que los dos callan igual.
  const traidores = merges.filter((m) => !esAncestro(m.p2)).map((m) => m.rama);
  assert.deepEqual(traidores, [],
    '🔴 EL ORÁCULO ESTÁ ROTO: el segundo padre de estos merges NO sale como ancestro de `main`,\n'
    + `   y por construcción tiene que serlo: ${traidores.slice(0, 5).join(', ')}.`);

  // ── SUELO ②: que haya ramas vivas de las dos clases, o el contraste de abajo mide sobre vacío.
  const vivas = inst.ramas.filter((r) => !INTOCABLES.has(r.nombre));
  const fuera = vivas.filter((r) => alcanzable(r.nombre) === false);
  assert.ok(vivas.length > 0 && fuera.length > 0,
    `🔴 CENSO CIEGO: ${vivas.length} ramas vivas y ${fuera.length} fuera de main.`);

  // ── SUELO ③: el atajo contra el mandato, en los DOS sentidos y sobre sujetos de las dos clases.
  const muestra = [...merges.slice(0, 3).map((m) => m.p2), ...fuera.slice(0, 3).map((r) => r.objeto)];
  const desacuerdo = muestra.filter((o) => esAncestro(o) !== mandato(o));
  assert.deepEqual(desacuerdo, [],
    '🔴 `rev-list` y `merge-base --is-ancestor` NO dicen lo mismo sobre estos objetos. El atajo a\n'
    + '   granel dejaría de ser un atajo y pasaría a ser otra respuesta.');

  // ── LO QUE DE VERDAD SE COMPRUEBA: para CADA rama viva, la clase que dice el censo y la que
  //    dice `git` coinciden. Esto SÍ puede fallar: basta con que `alcanzabilidadDe` se equivoque
  //    en una, y entonces una rama ya mergeada aparecería en la lista de pendientes.
  const discrepan = vivas
    .map((r) => ({ nombre: r.nombre, censo: alcanzable(r.nombre), git: esAncestro(r.objeto) }))
    .filter((x) => x.censo !== null && x.censo !== x.git);
  assert.deepEqual(discrepan, [],
    '🔴 el censo y `git merge-base --is-ancestor` NO dicen lo mismo de estas ramas. Si el censo\n'
    + '   dice «fuera» de una que SÍ está en main, esa rama aparece en la lista de pendientes y la\n'
    + '   lista deja de ser trabajo esperando para ser ruido que nadie lee.');
});

test('SCRUM-637 · 🔴 `main` NUNCA sale como rama pendiente', () => {
  const inst = arbol();
  const alcanzable = alcanzabilidadDe(inst);
  const fuera = inst.ramas.filter((r) => !INTOCABLES.has(r.nombre) && alcanzable(r.nombre) === false);
  for (const intocable of INTOCABLES) {
    assert.ok(!fuera.some((r) => r.nombre === intocable),
      `🔴 «${intocable}» sale como rama sin mergear.`);
  }
});

// ═══ ⑥ LA RED DE LOS TRES INSTRUMENTOS ═══════════════════════════════════════════════════

test('SCRUM-637 · 🔴 los tres instrumentos EXISTEN y son código válido', async () => {
  for (const s of SCRIPTS_637) {
    const ruta = path.join(DIR, s);
    assert.ok(fs.existsSync(ruta), `🔴 falta \`scripts/verificacion-s5/${s}\`.`);
    const src = fs.readFileSync(ruta, 'utf8');
    assert.ok(src.includes('SCRUM-637'),
      `🔴 \`${s}\` ya no se declara de SCRUM-637: si cambió de dueño, esta red deja de cubrirlo.`);
  }
  // Importar el nuevo EJECUTA su módulo: si tuviera un error de sintaxis o disparara su `main()`
  // al importarse, este test lo caza. Los otros dos son scripts de ejecución y no se importan.
  const m = await import('../scripts/verificacion-s5/ramas-sin-mergear.mjs');
  assert.equal(typeof m.suelo, 'function');
});

test('SCRUM-637 · 🔴 los tres son ALCANZABLES desde `package.json`', () => {
  // Un instrumento que sólo se sabe invocar copiando una ruta de un comentario es un instrumento
  // que se deja de usar. Y sin entrada en `package.json` tampoco aparece en ningún censo.
  const comandos = Object.values(PKG.scripts || {}).join(' ');
  for (const s of SCRIPTS_637) {
    assert.ok(comandos.includes(s),
      `🔴 \`${s}\` no lo invoca ningún script de \`package.json\`: no hay forma declarada de correrlo.`);
  }
});

test('SCRUM-637 · ✅ POSITIVO: `ramas-borrables.mjs` SIGUE listando las mergeadas como antes', () => {
  // Este ticket añade la lista que faltaba; no puede llevarse por delante la que ya existía. Se
  // comprueba SIN ejecutarlo —su `--ejecutar` borra ramas de verdad— sobre los dos rasgos que
  // definen lo que hace: que deriva `borrables` de las mergeadas y que sigue teniendo su freno.
  const src = fs.readFileSync(path.join(DIR, 'ramas-borrables.mjs'), 'utf8');
  assert.match(src, /mergeadas\.has\(r\)/,
    '🔴 `ramas-borrables.mjs` ya no deriva su lista de las mergeadas.');
  assert.match(src, /for \(const r of borrables\) console\.log/,
    '🔴 ya no imprime las borrables POR NOMBRE, que es lo único que hoy sí se ve bien.');
  assert.match(src, /--ejecutar/,
    '🔴 ha desaparecido el freno `--ejecutar`: el script borraría ramas sin que nadie lo pida.');
});

test('SCRUM-637 · 🔴 y el nuevo NO duplica el censo de SCRUM-804: no mira tickets', () => {
  // La frontera del encargo, fijada: 804 da un veredicto POR TICKET cruzando ramas, entradas de
  // `docs/master/` y números; esto es una lista POR RAMA. El día que alguien le meta aquí lógica
  // de tickets, son dos censos del mismo árbol — y el que diverge en silencio es el que miente.
  const src = fs.readFileSync(path.join(DIR, 'ramas-sin-mergear.mjs'), 'utf8');
  const codigo = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.ok(!/docs.?master|numeroDeRama|poblacionDe|censar\(/.test(codigo),
    '🔴 el listado por rama ha empezado a cruzar tickets o `docs/master/`. Eso ya lo hace el censo\n'
    + '   de SCRUM-804: si esto pasa a contestar lo mismo, sobra uno de los dos.');
  // ✅ CONTROL POSITIVO del filtro: si quitar comentarios se llevara el fichero, lo de arriba
  // pasaría sobre un vacío.
  assert.ok(/alcanzabilidadDe/.test(codigo),
    '🔴 al quitar comentarios se ha perdido el código: el assert anterior medía sobre nada.');
});
