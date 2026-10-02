// SCRUM-1418 · las sesiones que se pararon y no volvieron: ¿entregaron, o se lo llevaron?
// Transcripciones y repositorio FABRICADOS: los de verdad no van al repositorio.
import test from 'node:test';
import assert from 'node:assert/strict';
import { entregaDe, censoDeRamas, medir, suerteDe, arbolDe, RUIDO_DEL_ARNES, MINUTOS_DE_VIVA } from '../scripts/sesiones-que-no-volvieron.mjs';

const T0 = Date.parse('2026-09-29T08:00:00Z');
const ev = (n, state) => JSON.stringify({ at: new Date(T0 + n * 60e3).toISOString(), state, detail: '', text: '' });
const usa = (name, input) => JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'x' }, { type: 'tool_use', name, input }] } });
const MEM = 'C:\\Users\\x\\.claude\\projects\\p\\memory\\';
const TRASPASO = usa('Write', { file_path: `${MEM}project_s1_traspaso.md`, content: '…' });
const CODIGO = usa('Edit', { file_path: 'D:\\repo\\src\\a.ts', old_string: 'a', new_string: 'b' });
const INDICE = usa('Edit', { file_path: `${MEM}MEMORY.md`, old_string: 'a', new_string: 'b' });
const orden = (command) => usa('PowerShell', { command });
const tr = (...l) => l.join('\n');

test('SCRUM-1418 · 🔴 los cuatro cubos: entregó al cerrar, entregó y siguió, no entregó, y NO SUPE aparte', () => {
  assert.equal(entregaDe(tr(CODIGO, TRASPASO)).cubo, 'ENTREGÓ AL CERRAR');
  assert.equal(entregaDe(tr(CODIGO, TRASPASO, INDICE)).cubo, 'ENTREGÓ AL CERRAR', 'tocar el índice de la memoria después es parte de entregar');
  assert.deepEqual([entregaDe(tr(TRASPASO, CODIGO, CODIGO)).cubo, entregaDe(tr(TRASPASO, CODIGO, CODIGO)).despues], ['ENTREGÓ Y SIGUIÓ', 2]);
  assert.equal(entregaDe(tr(TRASPASO, orden('git -C D:/wt commit -m "x"'))).cubo, 'ENTREGÓ Y SIGUIÓ', 'un commit después del traspaso también cuenta');
  assert.equal(entregaDe(tr(TRASPASO, CODIGO, TRASPASO)).cubo, 'ENTREGÓ AL CERRAR', 'cuenta desde el ÚLTIMO traspaso');
  assert.equal(entregaDe(tr(CODIGO, orden('git push origin HEAD:x'))).cubo, 'NO ENTREGÓ');
  assert.deepEqual([entregaDe(null).cubo, entregaDe('').cubo, entregaDe(tr(TRASPASO, '{"type":"assist')).cubo], ['NO SUPE', 'NO SUPE', 'NO SUPE']);
  assert.match(entregaDe(tr(TRASPASO, '{"type":"assist')).motivo, /cortada/, 'una transcripción cortada no se da por entregada aunque tenga su traspaso');
});

test('SCRUM-1418 · 🔴 LEER el traspaso, o nombrarlo en una orden o en el texto, NO es escribirlo', () => {
  const lee = usa('Read', { file_path: `${MEM}project_s1_traspaso.md` });
  const dice = JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'He actualizado project_s1_traspaso.md' }] } });
  const delUsuario = JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_use', name: 'Write', input: { file_path: `${MEM}project_s1_traspaso.md` } }] } });
  assert.equal(entregaDe(tr(lee, dice, delUsuario, orden('cat project_s1_traspaso.md'))).cubo, 'NO ENTREGÓ');
  // Y un fichero que solo se le parece no es un traspaso.
  assert.equal(entregaDe(usa('Write', { file_path: 'D:\\repo\\docs\\equipo\\traspaso\\notas.txt' })).cubo, 'NO ENTREGÓ');
  assert.equal(entregaDe(usa('Write', { file_path: `${MEM}project_s3-25a_traspaso.md` })).cubo, 'ENTREGÓ AL CERRAR', 'los traspasos con sufijo de sesión también lo son');
});

/** Un repositorio fabricado. `enMain`, `enOrigin`: listas de sha; `fusion`: sha → resultado. */
function repoDe({ locales, remotas = {}, enMain = [], empujadas = [], fusion = {}, ciegas = [] }) {
  return {
    main: 'MAIN', locales: locales.map(([nombre, sha, fecha = '2026-09-01T00:00:00+02:00']) => ({ nombre, sha, fecha })),
    remota: (n) => remotas[n] || null,
    esAncestro: (a, b) => (ciegas.includes(a) ? undefined : b === 'MAIN' ? enMain.includes(a) : empujadas.includes(a)),
    fusion: (sha) => fusion[sha], commits: () => 2, ficheros: () => ['src/a.ts', 'tests/a.test.mjs'],
  };
}

test('SCRUM-1418 · 🔴 el censo de ramas: solo acusa a la que NO está en origin y cuyo CONTENIDO cambiaría main', () => {
  const c = censoDeRamas(repoDe({
    locales: [['en-main', 'a'], ['empujada', 'b'], ['zombi', 'c'], ['solo-local', 'd', '2026-08-01T00:00:00+02:00'], ['detras', 'e'], ['choca', 'f', '2026-07-01T00:00:00+02:00'], ['ciega', 'g'], ['fusion-ciega', 'h']],
    remotas: { empujada: 'B', detras: 'E' }, enMain: ['a'], empujadas: ['b'], ciegas: ['g'],
    fusion: { c: 'igual', d: 'cambia', e: 'cambia', f: 'choca' },
  }));
  assert.equal(c.total, 8);
  assert.deepEqual(c.cuenta, { 'en main': 1, 'en origin': 1, 'solo local, sin contenido nuevo': 1 });
  assert.deepEqual(c.fuera.map((r) => [r.nombre, r.detras, r.choca]), [['choca', false, true], ['solo-local', false, false], ['detras', true, false]], 'ordenadas por fecha, la más vieja primero');
  assert.deepEqual(c.ciegas, ['ciega', 'fusion-ciega'], 'lo que git no contesta NO cuenta como limpio ni como acusado');
});

const sesion = (id, nombre, linea, transcripcion) => ({ id, nombre, linea, transcripcion });
const PARADA = [ev(0, 'working'), ev(10, 'done')].join('\n');
const TRABAJOS = [
  sesion('a', 's1-si', PARADA, tr(CODIGO, TRASPASO)),
  sesion('b', 's1-no', PARADA, tr(CODIGO, orden('git -C D:/wt checkout -b scrum-9-solo-local'))),
  sesion('c', 's2-siguio', PARADA, tr(TRASPASO, CODIGO)),
  sesion('d', 's3-cortada', PARADA, null),
  sesion('e', 's4-viva', [ev(0, 'working'), ev(5, 'working')].join('\n'), CODIGO),
  sesion('f', 'cobroflash-backend-57', PARADA, TRASPASO),
  sesion('g', 's5-otra', PARADA, tr(TRASPASO, orden('git push origin HEAD:scrum-9-solo-local-b'))),
];
const REPO = repoDe({ locales: [['scrum-9-solo-local', 'd'], ['ci-prueba', 'x'], ['main', 'a']], enMain: ['a'], fusion: { d: 'cambia', x: 'choca' } });
const ARBOLES = [
  { ruta: 'D:/wt-1', rama: 'r1', sucios: ['.claude/settings.local.json'] },
  { ruta: 'D:/wt-2', rama: 'r2', sucios: ['.claude/settings.local.json', 'tests/nuevo.test.mjs', '.playwright-mcp/'] },
  { ruta: 'D:/wt-3', rama: 'r3', sucios: [] },
  { ruta: 'D:/wt-4', rama: 'r4', sucios: undefined },
];
const CONTROLES = { controlSi: 's1-si', controlNo: 's1-no' };

test('SCRUM-1418 · 🔴 la medida entera: población, los cubos con nombre, las ramas, los árboles y el caso completo', () => {
  const r = medir({ trabajos: TRABAJOS, repo: REPO, arboles: ARBOLES, ...CONTROLES });
  const t = r.lineas.join('\n');
  assert.equal(r.codigo, 0, t);
  assert.match(t, /trabajos mirados: 7 · sesiones de puesto con línea de tiempo: 6 · fuera \(no es un puesto, o sin línea de tiempo\): 1/);
  assert.match(t, /se pararon y no volvieron: 5\. Las otras 1 acabaron su línea de tiempo en «working»/);
  assert.match(t, /\| ENTREGÓ AL CERRAR \| 2 \|\n\| ENTREGÓ Y SIGUIÓ \| 1 \|\n\| NO ENTREGÓ \| 1 \|\n\| NO SUPE \| 1 \|/);
  assert.match(t, /· s1-no · done · 2026-09-29 08:10/);
  assert.match(t, /· s3-cortada · sin transcripción/);
  assert.match(t, /ramas locales miradas: 3 · 1 en main · 0 en origin · 0 solo local, sin contenido nuevo · no se pudieron mirar: 0/);
  // La atribución es por NOMBRE ENTERO de la rama: `scrum-9-solo-local-b` no es `scrum-9-solo-local`.
  assert.match(t, /\| scrum-9-solo-local \| SCRUM-9 \| .* \| entra limpia y cambia main \| s1-no \|/);
  assert.match(t, /\| ci-prueba \| ninguno en el nombre \| .* \| CHOCA: hay que leerla \| sin sesión conocida \|/);
  assert.match(t, /EL CASO COMPLETO .*: s1-no → scrum-9-solo-local$/m);
  assert.match(t, /árboles de trabajo mirados: 4 · con cambios SIN COMITEAR que son trabajo: 1 · solo con ficheros del arnés .*: 1 · no se pudieron mirar: 1/);
  assert.match(t, /D:\/wt-2 \[r2\] · 1: tests\/nuevo\.test\.mjs/);
  assert.match(t, /⚠️ D:\/wt-4: no se pudo mirar \(NO cuenta como limpio\)/);
  assert.match(t, /no borra, no empuja y no rescata nada/);
  assert.equal(RUIDO_DEL_ARNES.length, 2, 'la lista del ruido es declarada y corta: lo que no esté en ella cuenta como trabajo');
});

test('SCRUM-1418 · 🔴 los controles prueban al lector: si uno no sale, o no está, la pasada NO VALE', () => {
  const alReves = medir({ trabajos: TRABAJOS, repo: REPO, arboles: ARBOLES, controlSi: 's1-no', controlNo: 's1-si' });
  assert.equal(alReves.codigo, 2);
  assert.match(alReves.lineas.join('\n'), /el control «s1-no» tenía que salir ENTREGÓ y sale NO ENTREGÓ: el lector no ve/);
  const falta = medir({ trabajos: TRABAJOS, repo: REPO, arboles: ARBOLES, controlSi: 's9-nadie', controlNo: 's1-no' });
  assert.equal(falta.codigo, 2);
  assert.match(falta.lineas.join('\n'), /«s9-nadie» no está entre los trabajos/);
  // El control del «no» con una sesión que sale NO SUPE: «no entregó» y «no pude mirar» no son lo mismo.
  const ciego = medir({ trabajos: TRABAJOS, repo: REPO, arboles: ARBOLES, controlSi: 's1-si', controlNo: 's3-cortada' });
  assert.equal(ciego.codigo, 2, 'un control que sale NO SUPE tampoco vale');
  assert.match(ciego.lineas.join('\n'), /«s3-cortada» tenía que salir NO ENTREGÓ y sale NO SUPE/);
  // Con un control caído no se imprime ni un cubo. El positivo: con los controles buenos, sí.
  assert.match(medir({ trabajos: TRABAJOS, repo: REPO, arboles: ARBOLES, ...CONTROLES }).lineas.join('\n'), /MITAD 1/);
  for (const r of [alReves, falta, ciego]) assert.doesNotMatch(r.lineas.join('\n'), /MITAD 1/);
});

test('SCRUM-1418 · 🔴 fail-closed: sin sesiones, sin git o sin árboles, se DICE y no cuenta como limpio', () => {
  assert.equal(medir({ trabajos: [TRABAJOS[5]], repo: REPO, arboles: ARBOLES, ...CONTROLES }).codigo, 2);
  const sinGit = medir({ trabajos: TRABAJOS, repo: { incapaz: 'fatal: not a git repository' }, arboles: ARBOLES, ...CONTROLES });
  assert.equal(sinGit.codigo, 2);
  assert.match(sinGit.lineas.join('\n'), /git no se deja leer: fatal: not a git repository\. La mitad 1 de arriba sí vale; la 2 no está medida/);
  assert.match(sinGit.lineas.join('\n'), /\| NO ENTREGÓ \| 1 \|/, 'la mitad 1 se imprime igual');
  const sinArboles = medir({ trabajos: TRABAJOS, repo: REPO, arboles: null, ...CONTROLES });
  assert.equal(sinArboles.codigo, 0);
  assert.match(sinArboles.lineas.join('\n'), /árboles de trabajo: NO MEDIDOS en esta pasada .* No cuentan como limpios/);
  const conCiega = medir({ trabajos: TRABAJOS, repo: repoDe({ locales: [['rota', 'g']], ciegas: ['g'] }), arboles: [], ...CONTROLES });
  assert.match(conCiega.lineas.join('\n'), /⚠️ sin mirar \(NO cuentan como limpias\): rota/);
});

// ───────────────────────────── mitad 3: las que acabaron en «working» ─────────────────────────────

test('SCRUM-1418 · 🔴 qué fue de una sesión que acabó en «working»: viva, muerta, acabó o NO SUPE, por el estado de su state.json', () => {
  const ahora = T0 + 600 * 60e3;
  const hace = (min) => ({ ultimo: ahora - min * 60e3 });
  assert.equal(suerteDe({ estado: 'working', ...hace(MINUTOS_DE_VIVA) }, ahora), 'VIVA');
  assert.equal(suerteDe({ estado: 'working', ...hace(MINUTOS_DE_VIVA + 1) }, ahora), 'MUERTA', 'dice «working» y lleva callada más del umbral');
  assert.equal(suerteDe({ estado: 'stopped', ...hace(1) }, ahora), 'MUERTA');
  assert.equal(suerteDe({ estado: 'failed', ...hace(1) }, ahora), 'MUERTA');
  assert.equal(suerteDe({ estado: 'done', ...hace(5000) }, ahora), 'ACABÓ');
  for (const raro of [undefined, null, '', 'blocked', 'otro']) assert.equal(suerteDe({ estado: raro, ...hace(1) }, ahora), 'NO SUPE', String(raro));
});

test('SCRUM-1418 · una ruta pertenece al árbol MÁS PROFUNDO que la contiene, y a ninguno si no está dentro', () => {
  const arboles = [{ ruta: 'D:/repo' }, { ruta: 'D:/repo/.claude/worktrees/x' }, { ruta: 'D:/wt-1' }];
  assert.equal(arbolDe('D:\\repo\\.claude\\worktrees\\x\\src\\a.ts', arboles).ruta, 'D:/repo/.claude/worktrees/x');
  assert.equal(arbolDe('d:/REPO/src/a.ts', arboles).ruta, 'D:/repo');
  assert.equal(arbolDe('D:/wt-10/src/a.ts', arboles), null, '`wt-10` no está dentro de `wt-1`: un prefijo no es una carpeta');
  assert.equal(arbolDe('C:/otra/cosa.ts', arboles), null);
});

const VIVA_Y_MUERTAS = [ev(0, 'working'), ev(5, 'working')].join('\n');
const escribe = (ruta) => usa('Edit', { file_path: ruta, old_string: 'a', new_string: 'b' });
const MITAD3 = [
  ...TRABAJOS.filter((t) => t.nombre !== 's4-viva'),
  { ...sesion('m1', 's2-muerta-con-arbol', VIVA_Y_MUERTAS, escribe('D:\\wt-2\\tests\\nuevo.test.mjs')), estado: 'stopped' },
  { ...sesion('m2', 's3-muerta-con-rama', VIVA_Y_MUERTAS, orden('git -C D:/wt-9 commit -m x; git checkout -b scrum-9-solo-local')), estado: 'failed' },
  { ...sesion('m3', 's4-muerta-limpia', VIVA_Y_MUERTAS, escribe('D:\\wt-3\\src\\a.ts')), estado: 'stopped' },
  { ...sesion('m4', 's5-muerta-entrego', VIVA_Y_MUERTAS, tr(escribe('D:\\wt-2\\x.ts'), TRASPASO)), estado: 'stopped' },
  { ...sesion('m5', 's1-acabo', VIVA_Y_MUERTAS, escribe('D:\\wt-1\\.claude\\settings.local.json')), estado: 'done' },
  { ...sesion('m6', 's2-viva', [ev(0, 'working'), ev(599, 'working')].join('\n'), escribe('D:\\wt-2\\y.ts')), estado: 'working' },
  { ...sesion('m7', 's3-sin-estado', VIVA_Y_MUERTAS, CODIGO), estado: undefined },
  // Escribió en el MISMO árbol sucio, pero otro fichero: lo que hoy está sin comitear no es lo suyo.
  { ...sesion('m8', 's4-muerta-otro-fichero', VIVA_Y_MUERTAS, escribe('D:\\wt-2\\src\\otro.ts')), estado: 'stopped' },
];

test('SCRUM-1418 · 🔴 la mitad 3 entera: los cuatro cubos, y de las muertas o acabadas que no entregaron, cuáles dejaron algo en el disco', () => {
  const r = medir({ trabajos: MITAD3, repo: REPO, arboles: ARBOLES, ...CONTROLES, ahora: T0 + 600 * 60e3 });
  const t = r.lineas.join('\n');
  assert.equal(r.codigo, 0, t);
  assert.match(t, /MITAD 3 · LAS QUE ACABARON SU LÍNEA DE TIEMPO EN «WORKING» \(8\)/);
  assert.match(t, /\| VIVA \| 1 \| 0 \| 0 \| 1 \| 0 \|/);
  assert.match(t, /\| ACABÓ \| 1 \| 0 \| 0 \| 1 \| 0 \|/);
  assert.match(t, /\| MUERTA \| 5 \| 1 \| 0 \| 4 \| 0 \|/);
  assert.match(t, /\| NO SUPE \| 1 \| 0 \| 0 \| 1 \| 0 \|/);
  assert.match(t, /NO SUPE qué fue de: s3-sin-estado \(estado: ninguno\)/);
  assert.match(t, /muertas o acabadas que NO entregaron al cerrar: 5\. De ellas, con algo en el disco que no está en origin: 2$/m);
  assert.match(t, /· s2-muerta-con-arbol · MUERTA · NO ENTREGÓ · ficheros que escribió y siguen sin comitear: D:\/wt-2 → tests\/nuevo\.test\.mjs$/m);
  assert.match(t, /· s3-muerta-con-rama · MUERTA · NO ENTREGÓ · nombra ramas que no están en origin: scrum-9-solo-local$/m);
  // Los negativos, con nombre: la que escribió en un árbol limpio, la que entregó al cerrar, la que solo
  // tocó un fichero del arnés, la viva y la que no se sabe qué fue de ella NO salen en la lista.
  const lista = r.datos.conAlgo.join('\n');
  assert.match(lista, /s2-muerta-con-arbol/);
  for (const n of ['s4-muerta-limpia', 's4-muerta-otro-fichero', 's5-muerta-entrego', 's1-acabo', 's2-viva', 's3-sin-estado']) assert.ok(!lista.includes(n), n);
  assert.match(t, /otra sesión pudo tocarlo después/);
});

test('SCRUM-1418 · la mitad 3 sin árboles medidos lo DICE, y cruza solo con las ramas', () => {
  const r = medir({ trabajos: MITAD3, repo: REPO, arboles: null, ...CONTROLES, ahora: T0 + 600 * 60e3 });
  assert.match(r.lineas.join('\n'), /con algo en el disco que no está en origin: 1 \(⚠️ los árboles NO se midieron: solo se cruzó con las ramas\)/);
});
