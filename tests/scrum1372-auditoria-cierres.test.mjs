// SCRUM-1372 · LA CRIBA DE CIERRES — qué cierres no se pueden comprobar contra su aceptación.
//
// Una criba así puede fallar de dos maneras y las dos se han medido: GRITAR (la señal por palabras del
// piloto marcaba 28 de 41) y CALLAR (con tres formas literales marcó 0 de 61 habiendo seis). Y puede
// fallar de una tercera, que es la que este fichero vigila más: dar una cifra cuando NO PUDO MIRAR.
// Cada bloque tiene su rojo, su negativo y su ciego.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  cribarUno, pasada, validarFichero, elegirMuestra, senalC5, leerTablaA8, citasDeTest, rutasDelRepo, paqueteDe,
  puestoDe, esDeLuis, numeroDe, CANARIO, ESPERADO_DEL_CANARIO, TOPE, RESERVA_AZAR, TECHO_C5, NORMA_A8_DESDE,
} from '../scripts/auditoria-cierres.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(RAIZ, 'scripts', 'auditoria-cierres.mjs');
const AHORA = Date.parse('2026-10-01T16:00:00Z');
const DESDE = '2026-09-29';

/** Un repositorio fabricado: todo ticket tiene registro y commit salvo que se diga lo contrario. */
function repoDe({ sinRastro = [], ramas = {}, registros = {}, noExiste = [] } = {}) {
  return {
    mergesEnVentana: 40,
    tieneRegistro: (n) => n !== 0 && !sinRastro.includes(n),
    commits: (n) => (n !== 0 && !sinRastro.includes(n) ? [{ sha: 'a'.repeat(40), asunto: `SCRUM-${n}: algo` }] : []),
    registros: (n) => registros[n] || [],
    ramasFuera: (n) => ramas[n] || [],
    existe: (ruta) => !noExiste.includes(ruta),
  };
}
const cierre = (n, extra = {}) => ({
  clave: `SCRUM-${n}`, resuelto: '2026-09-30T10:00:00.000+0200', etiquetas: ['area-j1', 'equipo-javier'], resumen: `ticket ${n}`,
  aceptacion: ['Se ve X en la lista.'], comentarios: 1, ultimoComentario: 'Hecho y visto en yaqu.app.', ultimoComentarioCuando: '2026-09-30T10:00:00.000+0200', tablaA8: null, ...extra,
});
const fichero = (cierres, extra = {}) => ({ ventana: { desde: DESDE }, jql: 'x', bajado: new Date(AHORA - 36e5).toISOString(), total: cierres.length, cierres, ...extra });
const senales = (c, repo = repoDe()) => cribarUno(c, repo).senales;

// ───────────────────────────── las señales, una a una ─────────────────────────────

test('SCRUM-1372 · un cierre con registro, aceptación y visto en pantalla NO se marca (el negativo de todo lo demás)', () => {
  const r = cribarUno(cierre(100), repoDe());
  assert.equal(r.cribado, true);
  assert.deepEqual(r.senales, []);
  assert.equal(r.puesto, 'J1');
});

test('SCRUM-1372 · C1: sin registro NI commit; con uno de los dos, no', () => {
  assert.deepEqual(senales(cierre(101), repoDe({ sinRastro: [101] })), ['C1']);
  const soloCommit = { ...repoDe(), tieneRegistro: () => false };
  assert.deepEqual(senales(cierre(101), soloCommit), [], 'tiene commit en main: hay algo que mirar');
});

test('SCRUM-1372 · 🔴 C2 compara CONTENIDO: una rama fuera que no cambia nada es un zombi, no un cierre con trabajo fuera', () => {
  const zombi = cribarUno(cierre(102), repoDe({ ramas: { 102: [{ rama: 'scrum-102-x', cambia: false, detalle: '' }] } }));
  assert.deepEqual(zombi.senales, [], 'SCRUM-1196: la criba por ancestría acusó a un cierre cuyo contenido ya estaba en main');
  assert.match(zombi.notas.join(' '), /rama zombi scrum-102-x/);
  const fuera = cribarUno(cierre(102), repoDe({ ramas: { 102: [{ rama: 'scrum-102-x', cambia: true, detalle: 'cambiaría 3 fichero(s)' }] } }));
  assert.deepEqual(fuera.senales, ['C2']);
  const ciego = cribarUno(cierre(102), repoDe({ ramas: { 102: [{ rama: 'scrum-102-x', cambia: null, detalle: 'fatal: bad object' }] } }));
  assert.equal(ciego.cribado, false, 'no pude comparar NO es «no hay trabajo fuera»');
});

test('SCRUM-1372 · C4: el registro cita un test que no existe en main', () => {
  const registros = { 103: ['A9: comprobación → `tests/scrum103-x.test.mjs` y también tests/scrum103-y.test.mjs.'] };
  assert.deepEqual(citasDeTest(registros[103][0]), ['tests/scrum103-x.test.mjs', 'tests/scrum103-y.test.mjs']);
  assert.deepEqual(senales(cierre(103), repoDe({ registros })), []);
  const r = cribarUno(cierre(103), repoDe({ registros, noExiste: ['tests/scrum103-y.test.mjs'] }));
  assert.deepEqual(r.senales, ['C4']);
  assert.match(r.notas.join(' '), /scrum103-y/);
});

test('SCRUM-1372 · 🔴 C5 ni grita ni calla: las formas REALES de «no lo vi» casan, y las que solo se le parecen no', () => {
  // Las seis que el 1-oct NO casaban con las tres formas del diseño (C5 marcó 0 de 61).
  for (const t of [
    '**Lo que NO se ha podido ver: los botones PINTADOS en yaqu.app.**', 'de esto no se ha visto nada', '🟡 NO visto**: la cuenta QA no tiene',
    'no se verificó en producción: no existe ningún Trabajo', 'No se ha visto en producción porque el fixture', 'NO VERIFICABLE en yaqu.app',
    'Sin verificar en pantalla.', 'Queda pendiente verificar en yaqu.app', 'falta verlo',
  ]) assert.ok(senalC5(t), `debería casar: ${t}`);
  // Las que hacían gritar a la primera versión (28 de 41), y un condicional que no es una confesión.
  for (const t of [
    'es independiente del resto', 'sube `PENDIENTE_MAX` a 12', 'lo que faltaba era el selector', 'VERIFICADO en yaqu.app', 'no se habría visto (SCRUM-1339)',
    'verificado por contenido', 'no puede volver en silencio', '',
  ]) assert.equal(senalC5(t), null, `NO debería casar: ${t}`);
  assert.deepEqual(senales(cierre(104, { ultimoComentario: 'Mergeado. No se ha visto en producción.' })), ['C5']);
});

test('SCRUM-1372 · C6: sin aceptación no se acusa, se cuenta aparte — y no entra en el azar', () => {
  const r = cribarUno(cierre(105, { aceptacion: [] }), repoDe());
  assert.deepEqual(r.senales, ['C6']);
  assert.equal(r.conAceptacion, false);
});

const TABLA = '| aceptación (literal) | dónde se ve |\n|---|---|\n| Se ve X en la lista. | `tests/scrum106-x.test.mjs` |\n| Se guarda Y. | https://yaqu.app/dashboard/#clientes: sale la columna |';
const DE_LUIS = { etiquetas: ['area-s2', 'equipo-luis'], resuelto: '2026-10-01T16:00:00.000+0200', aceptacion: ['Se ve X en la lista.', 'Se guarda Y.'] };

test('SCRUM-1372 · A8: la tabla se lee, y con sus filas y sus sitios en orden no marca', () => {
  const t = leerTablaA8(TABLA);
  assert.equal(t.filas.length, 2);
  assert.equal(t.filas[0].aceptacion, 'Se ve X en la lista.');
  assert.deepEqual(rutasDelRepo(t.filas[0].donde), ['tests/scrum106-x.test.mjs']);
  assert.equal(leerTablaA8('| a | b |\n|---|---|\n| 1 | 2 |'), null, 'una tabla cualquiera no es LA tabla');
  assert.deepEqual(senales(cierre(106, { ...DE_LUIS, tablaA8: TABLA })), []);
});

test('SCRUM-1372 · 🔴 A8: faltan filas, un sitio que no existe o un NO HECHO marcan — y dicen cuál de las tres', () => {
  const corta = cribarUno(cierre(106, { ...DE_LUIS, aceptacion: ['a', 'b', 'c'], tablaA8: TABLA }), repoDe());
  assert.deepEqual(corta.senales, ['A8']);
  assert.match(corta.notas.join(' '), /2 filas para 3 líneas/);
  const rota = cribarUno(cierre(106, { ...DE_LUIS, tablaA8: TABLA }), repoDe({ noExiste: ['tests/scrum106-x.test.mjs'] }));
  assert.match(rota.notas.join(' '), /scrum106-x\.test\.mjs, que no existe en main/);
  const noHecho = cribarUno(cierre(106, { ...DE_LUIS, tablaA8: TABLA.replace('https://yaqu.app/dashboard/#clientes: sale la columna', 'NO HECHO → S2, SCRUM-999') }), repoDe());
  assert.match(noHecho.notas.join(' '), /1 fila\(s\) NO HECHO/);
  const ilegible = cribarUno(cierre(106, { ...DE_LUIS, tablaA8: 'aquí debería haber una tabla' }), repoDe());
  assert.equal(ilegible.cribado, false, 'dice que trae tabla y no se deja leer: no cribado, no «sin tabla»');
});

test('SCRUM-1372 · A8: la falta de tabla solo se le exige a quien le rige la norma, y desde que está viva', () => {
  assert.deepEqual(senales(cierre(107, DE_LUIS)), ['A8'], 'equipo de Luis, cerrado después: sin tabla marca');
  assert.deepEqual(senales(cierre(107, { ...DE_LUIS, resuelto: '2026-10-01T10:00:00.000+0200' })), [], 'cerrado ANTES de la norma');
  assert.deepEqual(senales(cierre(107, { ...DE_LUIS, etiquetas: ['area-j2', 'equipo-javier'] })), [], 'al equipo de Javier se le propuso, no se le impuso');
  assert.ok(Date.parse(NORMA_A8_DESDE) > Date.parse('2026-10-01T10:00:00.000+0200'));
  assert.equal(esDeLuis(['area-s4']), true);
  assert.equal(esDeLuis(['calidad']), false);
});

test('SCRUM-1372 · el puesto sale de la etiqueta de área, y sin ella no se inventa', () => {
  assert.equal(puestoDe(['equipo-luis', 'area-s2', 'area-s1']), 'S1');
  assert.equal(puestoDe(['bug']), 'sin-area');
  assert.equal(numeroDe('SCRUM-1277'), 1277);
  assert.equal(numeroDe('OTRO-1'), null);
});

// ───────────────────────────── fail-closed ─────────────────────────────

test('SCRUM-1372 · 🔴 un cierre que no se deja cribar se DICE, y basta uno para que la pasada no valga', () => {
  for (const malo of [{ ...cierre(108), aceptacion: undefined }, { ...cierre(108), ultimoComentario: null }, { ...cierre(108), error: 'Jira dio 500' }, { ...cierre(108), resuelto: 'ayer' }, { clave: 'X' }]) {
    assert.equal(cribarUno(malo, repoDe()).cribado, false);
  }
  const r = pasada({ datos: fichero([cierre(1), { ...cierre(2), error: 'no lo pude bajar' }]), repo: repoDe(), desde: DESDE, fecha: '2026-10-01', ahora: AHORA });
  assert.equal(r.codigo, 2);
  assert.match(r.lineas.join('\n'), /SCRUM-2: NO CRIBADO/);
  assert.match(r.lineas.join('\n'), /1 de 2 cierres no se pudieron cribar/);
});

test('SCRUM-1372 · 🔴 fichero vacío, de otra ventana, a medio bajar, repetido, viejo o sin fecha: sale 2, nunca una cifra', () => {
  const v = (datos, desde = DESDE) => validarFichero(datos, { desde, ahora: AHORA });
  assert.equal(v(fichero([cierre(1)])).ok, true);
  assert.match(v(fichero([])).motivo, /CERO cierres/);
  assert.match(v(null).motivo, /no trae una lista/);
  assert.match(v(fichero([cierre(1)]), '2026-09-30').motivo, /es de la ventana «2026-09-29» y se pidió «2026-09-30»/);
  assert.match(v(fichero([cierre(1)], { total: 61 })).motivo, /Jira dijo 61 cierres y el fichero trae 1/);
  assert.match(v(fichero([cierre(1), cierre(1)])).motivo, /claves repetidas: SCRUM-1/);
  assert.match(v(fichero([cierre(1, { resuelto: '2026-09-28T23:00:00.000+0200' })])).motivo, /ANTES de la ventana/);
  assert.match(v(fichero([cierre(1)], { bajado: new Date(AHORA - 30 * 36e5).toISOString() })).motivo, /hace 30\.0 h/);
  assert.match(v(fichero([cierre(1)], { bajado: undefined })).motivo, /no dice cuándo se bajó/);
  for (const datos of [fichero([]), fichero([cierre(1)], { total: 9 })]) {
    assert.equal(pasada({ datos, repo: repoDe(), desde: DESDE, fecha: '2026-10-01', ahora: AHORA }).codigo, 2);
  }
});

test('SCRUM-1372 · 🔴 el canario: salta con la criba sana; sin él, o con una criba que no ve, la pasada no vale', () => {
  const datos = fichero([cierre(1)]);
  const base = { datos, desde: DESDE, fecha: '2026-10-01', ahora: AHORA };
  assert.deepEqual(cribarUno(CANARIO, repoDe()).senales.filter((s) => ESPERADO_DEL_CANARIO.includes(s)), ESPERADO_DEL_CANARIO);
  assert.equal(pasada({ ...base, repo: repoDe() }).codigo, 0);
  const sin = pasada({ ...base, repo: repoDe(), conCanario: false });
  assert.equal(sin.codigo, 2);
  assert.match(sin.lineas.join('\n'), /pasada sin canario/);
  // Una criba que cree que todo tiene rastro (el modo de fallo de un `git log` que devuelve de más) no ve el C1 del canario.
  const ciega = pasada({ ...base, repo: { ...repoDe(), tieneRegistro: () => true } });
  assert.equal(ciega.codigo, 2);
  assert.match(ciega.lineas.join('\n'), /el canario NO saltó \(le faltan C1\)/);
  assert.equal(pasada({ ...base, repo: { incapaz: 'no se puede resolver «origin/main»' } }).codigo, 2);
});

test('SCRUM-1372 · 🔴 el techo: si C5 marca más de un tercio, no señala, grita — y la pasada sale 2 sin cifra', () => {
  const ruidosos = [1, 2, 3, 4, 5, 6].map((n) => cierre(n, n <= 3 ? { ultimoComentario: 'Sin verificar.' } : {}));
  const r = pasada({ datos: fichero(ruidosos), repo: repoDe(), desde: DESDE, fecha: '2026-10-01', ahora: AHORA });
  assert.equal(r.codigo, 2);
  assert.match(r.lineas.join('\n'), /C5 marca 3 de 6, más de un tercio/);
  assert.ok(TECHO_C5 < 0.5);
  const callados = pasada({ datos: fichero([cierre(1), cierre(2)]), repo: repoDe(), desde: DESDE, fecha: '2026-10-01', ahora: AHORA });
  assert.match(callados.lineas.join('\n'), /C5 no marcó ninguno/, 'cero también se dice: puede ser que lo dijeran de otra forma');
});

// ───────────────────────────── la población y la muestra ─────────────────────────────

const MEZCLA = [
  cierre(10), cierre(11), cierre(12, { etiquetas: ['area-s2', 'equipo-luis'] }), cierre(13, { etiquetas: ['area-s2', 'equipo-luis'] }),
  cierre(14, { etiquetas: ['area-j4'] }), cierre(15, { etiquetas: ['area-s5'] }), cierre(16, { etiquetas: [] }),
  cierre(20, { aceptacion: [] }), cierre(21, { ultimoComentario: 'No se ha visto en producción.' }), cierre(22),
];
const REPO_MEZCLA = repoDe({ sinRastro: [22] });

test('SCRUM-1372 · la pasada declara su POBLACIÓN antes de cualquier veredicto, y «no marcado» no es «aprobado»', () => {
  const r = pasada({ datos: fichero(MEZCLA), repo: REPO_MEZCLA, desde: DESDE, fecha: '2026-10-01', ahora: AHORA });
  const t = r.lineas.join('\n');
  assert.equal(r.codigo, 1);
  assert.match(t, /cierres en la ventana: 10 · cribados: 10 · merges en main en la ventana: 40/);
  assert.match(t, /marcados: 2 \(C1 1 · C2 0 · C4 0 · C5 1 · A8 0\) · sin aceptación \(C6\): 1/);
  assert.match(t, /C3 \(despliegue\): NO CONSTRUIDA/, 'lo que no se mira se dice en cada pasada');
  assert.match(t, /sin aceptación escrita \(1\): .* NO están aprobados → 20/);
  assert.match(t, /Marcado no es culpable/);
  const limpia = pasada({ datos: fichero([cierre(10)]), repo: repoDe(), desde: DESDE, fecha: '2026-10-01', ahora: AHORA });
  assert.equal(limpia.codigo, 0);
  assert.match(limpia.lineas.join('\n'), /No marcado NO es aprobado/);
});

test('SCRUM-1372 · 🔴 la misma fecha da la MISMA muestra; otra fecha, otra; y nunca se lee al azar a un marcado ni a uno sin aceptación', () => {
  const cribados = MEZCLA.map((c) => cribarUno(c, REPO_MEZCLA));
  const a = elegirMuestra(cribados, { fecha: '2026-10-01' });
  const b = elegirMuestra([...cribados].reverse(), { fecha: '2026-10-01' });
  assert.deepEqual(a.azar.map((c) => c.clave), b.azar.map((c) => c.clave), 'no depende del orden en que llegaron');
  const otras = ['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'].map((f) => elegirMuestra(cribados, { fecha: f }).azar.map((c) => c.clave).join());
  assert.ok(otras.some((o) => o !== a.azar.map((c) => c.clave).join()), 'cuatro fechas distintas dan todas la misma muestra: la semilla no entra');
  assert.deepEqual(a.seguros.map((c) => c.clave), ['SCRUM-22']);
  assert.deepEqual(a.c5.map((c) => c.clave), ['SCRUM-21']);
  for (const c of a.azar) { assert.deepEqual(c.senales, []); assert.equal(c.conAceptacion, true); }
  assert.equal(new Set(a.azar.map((c) => c.puesto)).size, a.azar.length, 'uno por puesto, no dos del mismo');
  assert.equal(a.azar.length, 5, 'cinco puestos con algún cierre limpio (J1, S2, J4, S5, sin-area) y cinco huecos');
});

test('SCRUM-1372 · el tope: los C1/C2 van todos, los C5 no se comen la reserva del azar, y lo que queda fuera se DICE', () => {
  const muchos = [
    ...[30, 31, 32, 33, 34].map((n) => cierre(n, { ultimoComentario: 'Sin verificar.' })),
    ...[40, 41, 42, 43, 44, 45, 46, 47, 48].map((n, i) => cierre(n, { etiquetas: [`area-j${i + 1}`] })),
    ...[50, 51, 52, 53, 54, 55, 56, 57].map((n) => cierre(n)),
  ];
  const repo = repoDe({ sinRastro: [50, 51, 52, 53, 54, 55, 56, 57] });
  const m = elegirMuestra(muchos.map((c) => cribarUno(c, repo)), { fecha: '2026-10-01' });
  assert.equal(m.seguros.length, 8, 'ocho sin rastro: van los ocho aunque el tope sea seis');
  assert.equal(m.c5.length, TOPE - RESERVA_AZAR);
  assert.deepEqual(m.c5FueraDeTope.map((c) => c.clave), ['SCRUM-33', 'SCRUM-34']);
  assert.equal(m.azar.length, RESERVA_AZAR);
  assert.equal(m.puestosSinLeer.length, 9 - RESERVA_AZAR);
  const t = pasada({ datos: fichero(muchos), repo, desde: DESDE, fecha: '2026-10-01', ahora: AHORA }).lineas.join('\n');
  assert.match(t, /2 más quedan FUERA del tope: SCRUM-33, SCRUM-34/);
  assert.match(t, /puestos sin lectura esta pasada/);
});

test('SCRUM-1372 · 🔴 el paquete de lectura lleva la aceptación literal y NO lleva el comentario de entrega', () => {
  const c = cierre(60, { aceptacion: ['La lista enseña el NIF.', 'El CSV lo exporta.'], ultimoComentario: 'HECHO, 15/15 verde, visto en pantalla. SECRETO-DE-LA-ENTREGA' });
  const p = paqueteDe(c, cribarUno(c, repoDe()));
  assert.match(p, /1\. La lista enseña el NIF\./);
  assert.match(p, /2\. El CSV lo exporta\./);
  assert.match(p, /SCRUM-60: algo/);
  assert.doesNotMatch(p, /SECRETO-DE-LA-ENTREGA|15\/15/, 'quien lee «hecho, 15/15» tiende a confirmarlo');
  assert.match(p, /NO trae el comentario de entrega, a propósito/);
});

// ───────────────────────────── de punta a punta, sin red ─────────────────────────────

test('SCRUM-1372 · el comando de verdad: fichero vacío, de otra ventana, ilegible o sin canario sale 2 y lo dice', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1372-'));
  try {
    const escribir = (nombre, contenido) => { const r = path.join(dir, nombre); fs.writeFileSync(r, typeof contenido === 'string' ? contenido : JSON.stringify(contenido)); return r; };
    const ahora = Date.now();
    const bueno = { ventana: { desde: DESDE }, jql: 'x', bajado: new Date(ahora).toISOString(), total: 1, cierres: [cierre(1)] };
    const correr = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', cwd: dir });
    const casos = [
      [[escribir('vacio.json', { ...bueno, total: 0, cierres: [] }), '--desde', DESDE], /CERO cierres/],
      [[escribir('otra.json', bueno), '--desde', '2026-09-30'], /se pidió «2026-09-30»/],
      [[escribir('roto.json', '{ esto no es json'), '--desde', DESDE], /no trae una lista/],
      [[escribir('sincanario.json', bueno), '--desde', DESDE, '--sin-canario'], /pasada sin canario/],
      [[path.join(dir, 'no-existe.json'), '--desde', DESDE], /no trae una lista/],
    ];
    for (const [args, patron] of casos) {
      const r = correr(...args);
      assert.equal(r.status, 2, `${args.join(' ')}\n${r.stdout}\n${r.stderr}`);
      assert.match(r.stdout, patron);
      assert.match(r.stdout, /NO quiere decir que los cierres estén bien/);
    }
    assert.equal(correr().status, 2, 'sin argumentos: uso, y 2');
    // Con un fichero BUENO y fuera de un repositorio, git no se deja leer: 2, no una cifra sobre nada.
    const fuera = correr(escribir('bueno.json', bueno), '--desde', DESDE);
    assert.equal(fuera.status, 2, fuera.stdout + fuera.stderr);
    assert.match(fuera.stdout, /git no se deja leer/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
