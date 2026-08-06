// tests/scrum387-censo-reparto.test.mjs — SCRUM-387
//
// EL CENSO CRUZA `main` CONTRA JIRA, Y ESTE FICHERO COMPRUEBA QUE EL CRUCE CRUZA.
//
// El defecto que hay detrás costó tres reconstrucciones en un día: Jira no se transiciona al
// mergear, así que dice «por hacer» de cosas que llevan un día en `main` — y el reparto se hace
// desde Jira. `main` sabe qué está HECHO; Jira sabe qué hay que HACER; nadie las cruzaba.
//
// ── POR QUÉ EL SUELO ES LA PARTE SERIA ──────────────────────────────────────────────────────
// «Cero desfases» y «no supe leer el directorio» son **el mismo número con significados
// opuestos**. Este ticket existe literalmente porque un vacío se leyó al revés: un `ls-remote`
// sin resultados se tomó como «rama borrada = mergeada», cuando también podía significar «rama
// que nunca llegó». Un censo que no encuentra nada tiene que GRITAR, no tranquilizar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import {
  numeroDeEntrada, ticketsConEntrada, numeroDeClave,
  agruparRamas, cruzar, motivosParaNoFiarse, alarmasDeRama,
} from '../scripts/_censo-reparto.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-387 · SUELO: sin entradas, el censo NO dice «todo alineado» — dice que no ha mirado', () => {
  const motivos = motivosParaNoFiarse({
    entradas: new Map(),
    abiertos: [{ key: 'SCRUM-1' }],
    ramas: { total: 3 },
  });
  assert.ok(motivos.length > 0, 'con CERO entradas el censo se declara fiable: es el fallo exacto que este ticket cierra');
  assert.match(motivos.join(' '), /docs\/master/, 'el motivo tiene que decir DÓNDE no ha mirado');
});

test('SCRUM-387 · SUELO: sin tickets de Jira tampoco se informa', () => {
  const motivos = motivosParaNoFiarse({ entradas: new Map([[1, 'a']]), abiertos: [], ramas: { total: 3 } });
  assert.ok(motivos.length > 0, 'cero abiertos con 70+ en el tablero es un fallo de consulta, no un tablero limpio');
});

test('SCRUM-387 · SUELO: sin ramas tampoco — no se puede afirmar que no hay duplicados', () => {
  const motivos = motivosParaNoFiarse({ entradas: new Map([[1, 'a']]), abiertos: [{ key: 'SCRUM-1' }], ramas: { total: 0 } });
  assert.ok(motivos.length > 0);
});

test('SCRUM-387 · SUELO: con las tres fuentes pobladas, el censo SÍ se declara fiable', () => {
  // El hermano positivo. Sin él, los tres de arriba pasarían aunque `motivosParaNoFiarse`
  // devolviera siempre algo — y el censo no informaría nunca.
  const motivos = motivosParaNoFiarse({
    entradas: new Map([[304, 'docs/master/SCRUM-304.md']]),
    abiertos: [{ key: 'SCRUM-304' }],
    ramas: { total: 2 },
  });
  assert.deepEqual(motivos, []);
});

// ── LOS DOS CONTROLES QUE PIDE EL TICKET ─────────────────────────────────────────────────────

test('SCRUM-387 · CONTROL POSITIVO: cerrado en Jira + entrada en main = alineado, no desfase', () => {
  const entradas = new Map([[304, 'docs/master/SCRUM-304.md']]);
  const r = cruzar({ entradas, abiertos: [{ key: 'SCRUM-999', estado: 'Tareas por hacer' }] });
  assert.deepEqual(r.desfases, [], 'un ticket cerrado con su entrada NO puede salir como desfase');
  assert.deepEqual(r.enMainYCerrado.map((x) => x.clave), ['SCRUM-304']);
});

test('SCRUM-387 · CONTROL NEGATIVO: abierto en Jira + entrada en main sale NOMBRADO', () => {
  const entradas = new Map([[304, 'docs/master/SCRUM-304.md']]);
  const r = cruzar({ entradas, abiertos: [{ key: 'SCRUM-304', estado: 'Tareas por hacer' }] });
  assert.equal(r.desfases.length, 1);
  // NOMBRADO es el requisito, no contado: «hay 7 desfases» no sirve para repartir.
  assert.equal(r.desfases[0].clave, 'SCRUM-304');
  assert.equal(r.desfases[0].fichero, 'docs/master/SCRUM-304.md', 'el desfase tiene que decir dónde está la evidencia');
});

test('SCRUM-387 · abierto SIN entrada es cola normal, no alarma', () => {
  const r = cruzar({ entradas: new Map([[1, 'x']]), abiertos: [{ key: 'SCRUM-500' }] });
  assert.deepEqual(r.desfases, []);
  assert.deepEqual(r.abiertoSinEntrada.map((x) => x.clave), ['SCRUM-500']);
});

// ── ROJO POR EL MECANISMO ────────────────────────────────────────────────────────────────────

test('SCRUM-387 · ROJO POR EL MECANISMO: quitar una entrada cambia el censo NOMBRANDO el ticket', () => {
  const abiertos = [{ key: 'SCRUM-304', estado: 'Tareas por hacer' }];
  const con = cruzar({ entradas: ticketsConEntrada(['docs/master/SCRUM-304.md']), abiertos });
  const sin = cruzar({ entradas: ticketsConEntrada([]), abiertos });

  assert.deepEqual(con.desfases.map((x) => x.clave), ['SCRUM-304'], 'con la entrada, sale como desfase');
  assert.deepEqual(sin.desfases, [], 'sin la entrada, deja de ser desfase');
  // Y lo importante: no desaparece del censo, CAMBIA DE CUBO. Un ticket que se esfuma del informe
  // al borrarle la entrada sería un censo que se puede silenciar borrando ficheros.
  assert.deepEqual(sin.abiertoSinEntrada.map((x) => x.clave), ['SCRUM-304']);
});

// ── LO QUE DERIVA, DERIVADO DE VERDAD ────────────────────────────────────────────────────────

test('SCRUM-387 · el número sale del NOMBRE del fichero, y lo que no es entrada se ignora', () => {
  assert.equal(numeroDeEntrada('docs/master/SCRUM-304.md'), 304);
  assert.equal(numeroDeEntrada('docs/master/README.md'), null, 'el README no es un ticket');
  assert.equal(numeroDeEntrada('docs/master/SCRUM-304-borrador.md'), null, 'un nombre que no es exacto no cuenta como entrada');
  assert.equal(numeroDeClave('SCRUM-304'), 304);
  assert.equal(numeroDeClave('scrum-304-albaranes-tabla'), 304);
  assert.equal(numeroDeClave('main'), null);
});

// ── ALARMAS DE RAMA ──────────────────────────────────────────────────────────────────────────

test('SCRUM-387 · dos ramas SIN MERGEAR con el mismo número es alarma, y sale con sus nombres', () => {
  const ramas = agruparRamas([
    'aaa\trefs/heads/scrum-300-campos-albaran',
    'bbb\trefs/heads/scrum-300-firmado-por',
    'ccc\trefs/heads/scrum-311-censo',
  ], () => false); // ninguna mergeada
  const alarmas = alarmasDeRama(ramas);
  assert.equal(alarmas.length, 1);
  assert.equal(alarmas[0].clave, 'SCRUM-300');
  assert.deepEqual(alarmas[0].ramas, ['scrum-300-campos-albaran', 'scrum-300-firmado-por']);
});

test('SCRUM-387 · una rama YA MERGEADA no cuenta como trabajo en paralelo', () => {
  // Medido en el árbol real: 99 de 143 ramas ya están en main. Contarlas convertía 7 alarmas
  // útiles en 21 inútiles, y una alarma que casi siempre es falsa deja de leerse.
  const filas = ['aaa\trefs/heads/scrum-300-uno', 'bbb\trefs/heads/scrum-300-dos'];
  const todasMergeadas = agruparRamas(filas, () => true);
  assert.deepEqual(alarmasDeRama(todasMergeadas), [], 'dos ramas ya en main no son dos personas construyendo');
  const unaViva = agruparRamas(filas, (sha) => sha === 'aaa');
  assert.deepEqual(alarmasDeRama(unaViva), [], 'con una sola viva tampoco hay paralelismo');
});

test('SCRUM-387 · lo INDETERMINADO no se cuenta como mergeado', () => {
  // No saber no es lo mismo que descartar. Si `merge-base` no puede responder, la rama sigue
  // pesando en la alarma: es justo la lectura al revés que originó este ticket.
  const ramas = agruparRamas(['aaa\trefs/heads/scrum-300-uno', 'bbb\trefs/heads/scrum-300-dos'], () => null);
  assert.equal(ramas.indeterminadas, 2);
  assert.equal(ramas.enMain, 0);
  assert.equal(alarmasDeRama(ramas).length, 1, 'dos ramas de estado desconocido siguen siendo una alarma');
});

// ── CONTRA EL ÁRBOL DE VERDAD ────────────────────────────────────────────────────────────────

test('SCRUM-387 · contra `main` de verdad: hay entradas y el suelo no salta', () => {
  const ficheros = execFileSync('git', ['ls-tree', 'origin/main', '--name-only', 'docs/master/'],
    { cwd: RAIZ, encoding: 'utf8' }).split('\n').map((s) => s.trim()).filter(Boolean);
  const entradas = ticketsConEntrada(ficheros);
  assert.ok(entradas.size >= 60,
    `solo ${entradas.size} entradas derivadas de origin/main: o el trinquete de SCRUM-273 ha dejado de cumplirse, o este test está leyendo otro sitio`);
  assert.ok(entradas.has(304), 'SCRUM-304 tiene entrada en main — si no se ve, el derivador no está mirando donde cree');
});
