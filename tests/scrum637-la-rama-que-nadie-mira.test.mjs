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
  assert.ok(inst.ramas.length > 50,
    `🔴 CENSO CIEGO: sólo ${inst.ramas.length} refs de origin. Un clon superficial devuelve una\n`
    + '   lista corta SIN fallar (SCRUM-388), y sobre ella los controles de abajo pasarían solos.');
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

test('SCRUM-637 · 🔴 NEGATIVO: una rama que SÍ está en main NO aparece como sin mergear', () => {
  const inst = arbol();
  const alcanzable = alcanzabilidadDe(inst);
  const dentro = inst.ramas.filter((r) => alcanzable(r.nombre) === true);
  const fuera = inst.ramas.filter((r) => !INTOCABLES.has(r.nombre) && alcanzable(r.nombre) === false);

  assert.ok(dentro.length > 10,
    `🔴 CENSO CIEGO: sólo ${dentro.length} ramas dentro de main. Sin mergeadas, el control de abajo\n`
    + '   no distingue «filtra bien» de «no hay nada que filtrar».');
  assert.ok(fuera.length > 0,
    '🔴 CENSO CIEGO: cero ramas fuera de main (ver el suelo de arriba).');

  const nombresFuera = new Set(fuera.map((r) => r.nombre));
  const coladas = dentro.filter((r) => nombresFuera.has(r.nombre));
  assert.deepEqual(coladas.map((r) => r.nombre), [],
    '🔴 una rama YA MERGEADA aparece en la lista de pendientes. La lista dejaría de ser una lista\n'
    + '   de trabajo esperando y pasaría a ser ruido que nadie lee.');
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
