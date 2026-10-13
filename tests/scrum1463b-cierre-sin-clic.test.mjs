// SCRUM-1463b · CIERRES SIN CLIC: un ticket con el comentario de cierre escrito y el estado sin mover.
//
// Medido el 13-oct-2026 sobre Jira: SCRUM-1126 llevaba trece días «En curso» con su cierre comentado; la
// frase «CERRADO por el orquestador» abría 2 de los 14 comentarios de cierre de ese día; y la búsqueda,
// que no distingue mayúsculas, casó con SCRUM-1538 por una frase que hablaba de un PR. Los arranques de
// abajo son los LEÍDOS en esos tickets, no inventados.
//
// Sólo lo PURO y el guion lanzado sobre fotos fabricadas: aquí no se toca Jira ni la red.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  esDeCierre, arranqueDe, comentarioDeCierre, leerFotos, controlVe, filaDe, lineaDe, resumir, seccionCierres, consultas,
  FORMULAS, HORAS_DE_FOTO, NOTA_SIN_CORRER, SALIDA_NADA, SALIDA_CIEGO,
} from '../scripts/equipo/cierre-sin-clic.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GUION = path.join(RAIZ, 'scripts', 'equipo', 'cierre-sin-clic.mjs');
const AHORA = Date.parse('2026-10-13T15:00:00Z');

// El rojo, declarado: lo ejecuta `npm run meta:mutaciones`.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Un ticket ya cerrado vuelve a salir en la lista.
    fichero: 'scripts/equipo/cierre-sin-clic.mjs',
    de: "        if (f.status?.statusCategory?.key === 'done') { cerrados.add(num); abiertos.delete(num); continue; }",
    a: "        if (f.status?.statusCategory?.key === 'hecho') { cerrados.add(num); abiertos.delete(num); continue; }",
    cae: 'SCRUM-1463b · 🔴 CONTROL: un ticket CERRADO de verdad no sale, lleve el comentario de cierre que lleve',
  },
  {
    // El detector deja de mirar cómo EMPIEZA el comentario y casa la frase en cualquier sitio.
    fichero: 'scripts/equipo/cierre-sin-clic.mjs',
    de: '  return /^(?:CIERRE|CERRAD[OA])(?![\\p{L}\\p{N}])/u.test(arranqueDe(cuerpo));',
    a: '  return /(?:CIERRE|CERRAD[OA])/iu.test(String(cuerpo));',
    cae: 'SCRUM-1463b · una CITA no es un cierre: «cerrado por el orquestador durante el barrido» habla de un PR (SCRUM-1538)',
  },
  {
    // Un ticket cuyos comentarios nadie leyó pasa por «sólo lo cita».
    fichero: 'scripts/equipo/cierre-sin-clic.mjs',
    de: "  const tipo = info.cierre ? 'CIERRE' : info.cierre === null ? 'CITA' : 'SIN_LEER';",
    a: "  const tipo = info.cierre ? 'CIERRE' : 'CITA';",
    cae: 'SCRUM-1463b · 🔴 FAIL-CLOSED: sin los comentarios delante la fila es SIN LEER y es un aviso, nunca «sólo lo cita»',
  },
  {
    // Una foto caducada se sigue enseñando como si fuera de ahora.
    fichero: 'scripts/equipo/cierre-sin-clic.mjs',
    de: '  if (!(horas <= HORAS_DE_FOTO)) return ciega(',
    a: '  if (!(horas <= HORAS_DE_FOTO * 999)) return ciega(',
    cae: 'SCRUM-1463b · la sección del latido: una foto de más de 12 h es «no pude mirar», y un resultado ilegible también',
  },
];

const com = (id, created, body, autor = 'Luis') => ({ id, created, body, author: { displayName: autor } });
const nodo = (num, { estado = 'En curso', cat = 'indeterminate', comentarios, updated = '2026-09-30T23:31:08.883+0200', asunto = 'CLIENTES · Pantalla' } = {}) => ({
  key: `SCRUM-${num}`,
  fields: { summary: asunto, updated, status: { name: estado, statusCategory: { key: cat } }, ...(comentarios ? { comment: { comments: comentarios, total: comentarios.length } } : {}) },
});
const busqueda = (nodos, masPaginas = false) => JSON.stringify({ issues: { totalCount: nodos.length, nodes: nodos, pageInfo: { hasNextPage: masPaginas } } });
const ficha = (n) => JSON.stringify({ issues: { nodes: [n] } });
const foto = (...textos) => textos.map((texto, i) => ({ nombre: `f${i}.json`, texto }));

const CIERRE_1126 = com('17592', '2026-09-29T19:41:12.000+0200', 'h3. CERRADO — la rama está en {{main}} (regla 42 cumplida)\n\nConstruido por _J2_ (equipo de Javier). Cierre del orquestador (A13).', 'Javier');
const CITA_1538 = com('19393', '2026-10-13T15:15:22.418+0200', '**Escribe la sesión jv-j1l (equipo de Javier), por encargo de su orquestador.**\n\n| #2286 | era CLEAN | VERDE VIEJO | cerrado por el orquestador durante el barrido |');
const hLimpio = (mas = {}) => ({ ciegos: [], registros: [], evidencias: [], commits: [], commitsAjenos: [], ramasEnMain: [], ramasVivas: [], cierresAjenos: [], citas: [], ...mas });
const EN_MAIN = hLimpio({ registros: [{ fichero: 'docs/master/SCRUM-1126.md' }], commits: [{ sha: '411e04c0e', fecha: '2026-09-29', asunto: 'SCRUM-1126: fusionar' }] });

test('SCRUM-1463b · es de cierre el comentario que EMPIEZA por CIERRE o CERRADO en mayúsculas: los arranques leídos el 13-oct', () => {
  const cierran = [
    '**CIERRE · 13-oct-2026, 13:40Z. Lo cierro yo, el orquestador (A13.4).** Sobre la entrega de S1 de hoy (c.19404).',
    '**CIERRE · 6-oct-2026 \\~12:50Z** (hora del `Date:` de GitHub). **COMPLETO y VISTO EN PRODUCCIÓN.**',
    '**CERRADO por el orquestador · 13-oct-2026, 14:42Z** (`Date:` de GitHub, leído en esta misma tanda).',
    '**CERRADO con la rama en main (regla 42): PR #2084 MERGEADO, merge** `425065aa`',
    CIERRE_1126.body,
    '\n\n✅ CERRADA · 1-oct',
  ];
  const noCierran = [
    '**CERRABLE.** Las cinco líneas de la aceptación, con dónde se ve cada una.',
    '**CERRABLE por la condición que puso c.18277**',
    'Cerrado por el orquestador del equipo de Javier.',
    'el cierre lo hace el orquestador',
    'CIERRES pendientes: tres',
    CITA_1538.body,
    '',
  ];
  for (const c of cierran) assert.equal(esDeCierre(c), true, `debía cerrar: «${arranqueDe(c).slice(0, 50)}»`);
  for (const c of noCierran) assert.equal(esDeCierre(c), false, `NO debía cerrar: «${arranqueDe(c).slice(0, 50)}»`);
  assert.equal(cierran.length + noCierran.length, 13);
});

test('SCRUM-1463b · 🔴 EL CASO: SCRUM-1126, «En curso» con su comentario de cierre del 29-sep y el trabajo en main → 13 días y LE FALTA EL CLIC', () => {
  const { abiertos, problemas } = leerFotos(foto(busqueda([nodo(1126, { comentarios: [com('17500', '2026-09-29T10:00:00.000+0200', 'lo coge J2'), CIERRE_1126] })])));
  assert.deepEqual(problemas, []);
  assert.equal(abiertos.size, 1);
  const info = abiertos.get(1126);
  assert.equal(info.cierre.id, '17592');
  assert.equal(info.cierre.despues, 0);
  const f = filaDe(1126, info, EN_MAIN, AHORA);
  assert.equal(f.tipo, 'CIERRE');
  assert.equal(f.dias, 13);
  assert.equal(f.trabajo, 'EN_MAIN');
  const linea = lineaDe(f);
  for (const trozo of ['SCRUM-1126 [En curso]', '13 días desde su comentario de cierre', 'c.17592', 'LE FALTA EL CLIC', '1 commit(s) suyos en main']) assert.ok(linea.includes(trozo), `falta «${trozo}» en: ${linea}`);
});

test('SCRUM-1463b · 🔴 CONTROL: un ticket CERRADO de verdad no sale, lleve el comentario de cierre que lleve', () => {
  const cerrado = nodo(997, { estado: 'Finalizada', cat: 'done', comentarios: [com('19443', '2026-10-13T16:47:44.000+0200', '**CERRADO por el orquestador · 13-oct-2026, 14:42Z**')] });
  const { abiertos, cerrados } = leerFotos(foto(busqueda([cerrado, nodo(1126, { comentarios: [CIERRE_1126] })])));
  assert.deepEqual([...abiertos.keys()], [1126], 'el cerrado no entra en la lista');
  assert.deepEqual([...cerrados], [997]);
  // Y el mismo comentario, con el ticket ABIERTO, sí sale: el control no pasa por estar ciego.
  const abierto = nodo(997, { comentarios: cerrado.fields.comment.comments });
  assert.equal(leerFotos(foto(busqueda([abierto]))).abiertos.get(997).cierre.id, '19443');
  // Una ficha posterior que lo trae en Done lo saca aunque la búsqueda lo trajera abierto.
  assert.equal(leerFotos(foto(busqueda([abierto]), ficha(cerrado))).abiertos.size, 0);
});

test('SCRUM-1463b · una CITA no es un cierre: «cerrado por el orquestador durante el barrido» habla de un PR (SCRUM-1538)', () => {
  assert.equal(comentarioDeCierre([CITA_1538]), null);
  const { abiertos } = leerFotos(foto(busqueda([nodo(1538, { estado: 'Tareas por hacer', cat: 'new', comentarios: [CITA_1538] })])));
  assert.equal(abiertos.get(1538).cierre, null);
  const f = filaDe(1538, abiertos.get(1538), null, AHORA);
  assert.equal(f.tipo, 'CITA');
  const r = resumir({ filas: [f], tomada: AHORA, ahora: AHORA });
  assert.deepEqual([r.poblacion.cierres, r.poblacion.sinLeer, r.poblacion.citas], [0, 0, 1]);
  assert.deepEqual(r.citas, [1538]);
});

test('SCRUM-1463b · 🔴 FAIL-CLOSED: sin los comentarios delante la fila es SIN LEER y es un aviso, nunca «sólo lo cita»', () => {
  const { abiertos } = leerFotos(foto(busqueda([nodo(1249)])));
  assert.equal(abiertos.get(1249).cierre, undefined);
  const f = filaDe(1249, abiertos.get(1249), hLimpio(), AHORA);
  assert.equal(f.tipo, 'SIN_LEER');
  assert.equal(f.dias, 12, 'sin comentario, los días son desde su último cambio en Jira');
  assert.match(lineaDe(f), /SIN LEER SUS COMENTARIOS.*12 días sin tocarse en Jira/);
  const r = resumir({ filas: [f], tomada: AHORA, ahora: AHORA });
  assert.equal(r.poblacion.sinLeer, 1);
  assert.equal(seccionCierres({ guardado: r, ahora: AHORA }).alertas.length, 1);
  // Su ficha, con los comentarios, lo resuelve; una ficha que trae 1 comentario de 4 NO lo ha leído.
  const conFicha = leerFotos(foto(busqueda([nodo(1249)]), ficha(nodo(1249, { comentarios: [CIERRE_1126] }))));
  assert.equal(conFicha.abiertos.get(1249).cierre.id, '17592');
  const aMedias = nodo(1249, { comentarios: [CITA_1538] }); aMedias.fields.comment.total = 4;
  const m = leerFotos(foto(busqueda([nodo(1249)]), ficha(aMedias)));
  assert.equal(m.abiertos.get(1249).cierre, undefined);
  assert.match(m.problemas.join(' '), /SCRUM-1249 trae 1 comentarios de 4/);
});

test('SCRUM-1463b · «olvidé el clic» no es «se cerró antes de tiempo»: lo separa dónde está su trabajo', () => {
  const info = { estado: 'En curso', cierre: comentarioDeCierre([CIERRE_1126]) };
  const viva = [{ nombre: 'scrum-1126b-resto', fecha: '2026-10-02', adelanto: 3 }];
  const casos = [
    [EN_MAIN, 'EN_MAIN'],
    [hLimpio({ commits: EN_MAIN.commits, ramasVivas: viva }), 'EN_MAIN_Y_RAMA'],
    [hLimpio({ ramasVivas: viva }), 'SOLO_RAMA'],
    [hLimpio(), 'SIN_RASTRO'],
    [hLimpio({ ciegos: ['no se pudo traer origin'] }), 'CIEGO'],
    [null, 'CIEGO'],
  ];
  for (const [h, esperado] of casos) assert.equal(filaDe(1126, info, h, AHORA).trabajo, esperado);
  assert.match(lineaDe(filaDe(1126, info, casos[2][0], AHORA)), /SE CERRÓ ANTES DE TIEMPO.*rama viva scrum-1126b-resto \(3 commit\(s\) fuera\)/);
  // Un commit suyo en main FECHADO después del cierre se dice: el ticket siguió vivo.
  const tras = hLimpio({ commits: [...EN_MAIN.commits, { sha: '03b8cdc7d', fecha: '2026-09-30', asunto: 'SCRUM-1126: textos' }] });
  assert.match(filaDe(1126, info, tras, AHORA).detalle, /1 de esos commits son POSTERIORES al comentario de cierre/);
  assert.doesNotMatch(filaDe(1126, info, EN_MAIN, AHORA).detalle, /POSTERIORES/);
});

test('SCRUM-1463b · se queda con el ÚLTIMO cierre y cuenta lo que se escribió después (SCRUM-1288 se cerró, se reabrió y se cerró)', () => {
  const c = comentarioDeCierre([
    com('19095', '2026-10-09T12:58:31.000+0200', '**CIERRE · 9-oct-2026, 11:00Z. Lo cierro yo, el orquestador (A13.4).**'),
    com('19067', '2026-10-09T10:00:00.000+0200', '**CIERRE · 9-oct-2026, 08:00Z.**'),
    com('19070', '2026-10-09T10:30:00.000+0200', 'REABIERTO: falta un correo'),
    com('19200', '2026-10-10T09:00:00.000+0200', 'un apunte posterior'),
  ]);
  assert.equal(c.id, '19095');
  assert.equal(c.despues, 1);
  assert.equal(comentarioDeCierre([]), null);
});

test('SCRUM-1463b · la foto declara su población: sin una búsqueda entera no hay respuesta', () => {
  assert.match(leerFotos(foto(ficha(nodo(1126, { comentarios: [CIERRE_1126] })))).problemas.join(' '), /no hay ninguna BÚSQUEDA/);
  assert.match(leerFotos(foto(busqueda([nodo(1126)], true))).problemas.join(' '), /faltan páginas/);
  assert.deepEqual(leerFotos(foto(busqueda([nodo(1126)], true), busqueda([nodo(1249)], false))).problemas, []);
  assert.match(leerFotos(foto('{roto')).problemas.join(' '), /no es JSON válido/);
  // El TSV de quien ya leyó el ticket: con comentario, sin ninguno (-), sin leer, y uno ya cerrado.
  const tsv = ['# clave\testado\tid\tfecha\tlínea', 'SCRUM-1126\tEn curso\t17592\t2026-09-29T19:41:12+0200\tCERRADO — la rama está en main', 'SCRUM-1538\tTareas por hacer\t-', 'SCRUM-1249\tEn curso', 'SCRUM-997\tFinalizada\t19443\t2026-10-13T16:47:44+0200\tCERRADO por el orquestador'].join('\n');
  const t = leerFotos([{ nombre: 'a.tsv', texto: tsv }]);
  assert.deepEqual(t.problemas, []);
  assert.deepEqual([...t.abiertos.keys()].sort((a, b) => a - b), [1126, 1249, 1538]);
  assert.equal(t.abiertos.get(1126).cierre.aMano, true);
  assert.equal(t.abiertos.get(1538).cierre, null);
  assert.equal(t.abiertos.get(1249).cierre, undefined);
  assert.match(leerFotos([{ nombre: 'b.tsv', texto: 'SCRUM-1126\tEn curso\t17592\tayer\tCERRADO' }]).problemas.join(' '), /sin una fecha que se entienda/);
});

test('SCRUM-1463b · el control ve o no ve, y las búsquedas llevan las fórmulas medidas', () => {
  assert.deepEqual(controlVe(JSON.stringify({ issues: { totalCount: 61, nodes: [] } })), { ve: true, cuantos: 61 });
  assert.equal(controlVe(JSON.stringify({ issues: { totalCount: 0, nodes: [] } })).ve, false);
  assert.equal(controlVe(busqueda([nodo(997, { cat: 'done' })]).replace('"totalCount":1,', '')).cuantos, 1);
  assert.equal(controlVe('nada').ve, false);
  const c = consultas();
  assert.match(c.abiertos, /statusCategory != Done/);
  assert.match(c.control, /statusCategory = Done/);
  assert.equal(FORMULAS.length, 4);
  for (const f of FORMULAS) { assert.ok(c.abiertos.includes(`comment ~ "\\"${f}\\""`)); assert.ok(c.control.includes(f)); }
});

test('SCRUM-1463b · la sección del latido: una foto de más de 12 h es «no pude mirar», y un resultado ilegible también', () => {
  const fila = filaDe(1126, { estado: 'En curso', cierre: comentarioDeCierre([CIERRE_1126]) }, EN_MAIN, AHORA);
  const guardado = resumir({ filas: [fila], cerrados: 2, control: { ve: true, cuantos: 61 }, tomada: AHORA - 3600000, main: 'abc', ahora: AHORA });
  const fresca = seccionCierres({ guardado, ahora: AHORA });
  assert.equal(fresca.pudo, true);
  assert.equal(fresca.alertas.length, 1);
  assert.match(fresca.alertas[0].linea, /SCRUM-1126.*LE FALTA EL CLIC/);
  assert.match(fresca.poblacion, /1 ticket abierto casa .*foto de hace 1\.0 h.*NO cierra nada/);
  const vieja = seccionCierres({ guardado, ahora: AHORA + (HORAS_DE_FOTO + 0.5) * 3600000 });
  assert.equal(vieja.pudo, false);
  assert.match(vieja.motivo, /hace 13\.5 h \(vale 12\).*1 cierre sin clic.*ya no es una afirmación/);
  assert.equal(seccionCierres({ guardado, ahora: AHORA + (HORAS_DE_FOTO - 1) * 3600000 - 60000 }).pudo, true, 'a las 11 h 59 min todavía vale');
  for (const roto of [undefined, {}, { ...guardado, tomada: 'ayer' }, { ...guardado, cierres: null }]) assert.equal(seccionCierres({ guardado: roto, ahora: AHORA }).pudo, false);
  // Sin nada que atender: sección en verde CON su población. Y donde nunca se corrió, no hay sección: va la nota.
  const limpio = seccionCierres({ guardado: resumir({ filas: [], control: { ve: true, cuantos: 61 }, tomada: AHORA, ahora: AHORA }), ahora: AHORA });
  assert.deepEqual([limpio.pudo, limpio.alertas.length], [true, 0]);
  assert.equal(seccionCierres({ guardado: null, ahora: AHORA }), null);
  assert.match(NOTA_SIN_CORRER, /NO sabe/);
});

test('SCRUM-1463b · el guion LANZADO: cero abiertos sin control es CIEGO; con control es «ninguno»; y no escribe su resultado si no se le deja', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1463b-'));
  try {
    const escribir = (n, t) => { const f = path.join(dir, n); fs.writeFileSync(f, t); return f; };
    const vacia = escribir('vacia.json', busqueda([]));
    const control = escribir('control.json', JSON.stringify({ issues: { totalCount: 61, nodes: [] } }));
    const controlCiego = escribir('ciego.json', JSON.stringify({ issues: { totalCount: 0, nodes: [] } }));
    const citas = escribir('citas.tsv', 'SCRUM-1538\tTareas por hacer\t-\n');
    const destino = path.join(dir, 'guardado.json');
    const lanzar = (...args) => spawnSync(process.execPath, [GUION, ...args], { encoding: 'utf8', timeout: 60000 });

    const sinControl = lanzar('--jira', vacia, '--no-guardar');
    assert.equal(sinControl.status, SALIDA_CIEGO, sinControl.stdout + sinControl.stderr);
    assert.match(sinControl.stdout, /CIEGO[\s\S]*no sé si no hay ninguno o si la búsqueda no vio nada[\s\S]*NO quiere decir que no haya ninguno/);

    const conControlCiego = lanzar('--jira', vacia, '--control', controlCiego, '--no-guardar');
    assert.equal(conControlCiego.status, SALIDA_CIEGO);
    assert.match(conControlCiego.stdout, /el control \(ciego\.json\) no ve nada/);

    const ninguno = lanzar('--jira', vacia, '--control', control, '--guardar-en', destino);
    assert.equal(ninguno.status, SALIDA_NADA, ninguno.stdout + ninguno.stderr);
    assert.match(ninguno.stdout, /POBLACIÓN · 0 tickets abiertos[\s\S]*control: 61 cerrados[\s\S]*✅ CON COMENTARIO DE CIERRE Y SIN CERRAR · 0/);
    assert.equal(JSON.parse(fs.readFileSync(destino, 'utf8')).poblacion.control, 61, 'lo guardado es lo que leerá el latido');

    const soloCitas = lanzar('--jira', citas, '--no-guardar');
    assert.equal(soloCitas.status, SALIDA_NADA, soloCitas.stdout + soloCitas.stderr);
    assert.match(soloCitas.stdout, /SÓLO LO CITAN[^\n]*SCRUM-1538/);
    assert.doesNotMatch(soloCitas.stdout, /guardado para el latido/);

    const vieja = lanzar('--jira', citas, '--tomada', '2026-01-01T00:00:00Z', '--no-guardar');
    assert.equal(vieja.status, SALIDA_CIEGO);
    assert.match(vieja.stdout, /pasa de 12 h/);

    assert.equal(lanzar().status, SALIDA_CIEGO, 'sin argumentos no contesta «nada»');
    assert.match(lanzar('consultas').stdout, /statusCategory != Done[\s\S]*NO cierra nada/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('SCRUM-1463b · ⛔ lista y calla: el guion no sabe cerrar ni escribir en Jira', () => {
  const fuente = fs.readFileSync(GUION, 'utf8');
  for (const verbo of ['transitionJiraIssue', 'addCommentToJiraIssue', 'editJiraIssue', 'child_process', 'fetch(']) assert.equal(fuente.includes(verbo), false, `el guion nombra «${verbo}»`);
});
