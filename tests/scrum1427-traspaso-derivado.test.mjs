// SCRUM-1427 · el traspaso derivado: lo que una sesión dejó, sacado de su rastro.
// Transcripciones FABRICADAS: las de verdad viven fuera del repositorio.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { derivar, informe, buscar, esDelArnes, ramasDeGithub, MARCA } from '../scripts/traspaso-derivado.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(RAIZ, 'scripts', 'traspaso-derivado.mjs');
const hora = (n) => `2026-10-01T14:${String(n).padStart(2, '0')}:00.000Z`;
const dice = (n, texto) => JSON.stringify({ type: 'assistant', timestamp: hora(n), message: { model: 'modelo', content: [{ type: 'text', text: texto }] } });
const usa = (n, name, input) => JSON.stringify({ type: 'assistant', timestamp: hora(n), message: { model: 'modelo', content: [{ type: 'tool_use', name, input }] } });
const edita = (n, ruta) => usa(n, 'Edit', { file_path: ruta, old_string: 'a', new_string: 'b' });
const orden = (n, command) => usa(n, 'PowerShell', { command });
const arnes = (n, texto, error = 'rate_limit') => JSON.stringify({ type: 'assistant', timestamp: hora(n), isApiErrorMessage: true, error, message: { model: '<synthetic>', content: [{ type: 'text', text: texto }] } });
const recibe = (n, kind, texto) => JSON.stringify({ type: 'user', timestamp: hora(n), origin: { kind }, message: { role: 'user', content: texto } });
const tr = (...l) => l.join('\n');
const LIMITE = "You've hit your weekly limit · resets 12am";
const sesion = (transcripcion, extra = {}) => ({ nombre: 's0-fabricada', estado: 'blocked', intent: 'ERES LA SESIÓN 0. Haz el censo.', transcripcion, ...extra });
// SCRUM-1468 · una entrada `pr-link` de verdad no trae la rama: sólo número, repositorio y URL.
const enlace = (n, numero) => JSON.stringify({ type: 'pr-link', prNumber: numero, prRepository: 'o/r', prUrl: `https://x/pull/${numero}`, timestamp: hora(n) });
const RAMA_DEL_ARRANQUE = 'scrum-1082-flujo-crear-factura-competencia';
const RAMAS_DE_PR = new Map([
  [77, 'scrum-9-censo'],
  [1681, RAMA_DEL_ARRANQUE],
]);
const ramaDe = (n) => RAMAS_DE_PR.get(n);

// La sesión que importa: trabajó, comiteó, siguió editando, y el arnés la cortó por cuota.
const CORTADA = tr(
  recibe(0, 'human', 'ERES LA SESIÓN 0. Haz el censo.'),
  edita(1, 'D:\\wt-1\\scripts\\censo.mjs'),
  edita(1, 'D:\\wt-1\\docs\\antes-del-commit.md'),
  orden(2, 'git -C D:/wt-1 commit -m "censo"; git -C D:/wt-1 push origin HEAD:scrum-9-censo 2>$null'),
  JSON.stringify({ type: 'pr-link', prNumber: 77, prUrl: 'https://x/pull/77', timestamp: hora(3) }),
  usa(4, 'mcp__claude_ai_Atlassian_Rovo__addCommentToJiraIssue', { issueIdOrKey: 'SCRUM-9', commentBody: 'x' }),
  usa(4, 'mcp__claude_ai_Atlassian_Rovo__getJiraIssue', { issueIdOrKey: 'SCRUM-555' }),
  recibe(5, 'peer', 'Another Claude session sent a message:\n<cross-session-message from="uds:x" from-name="cobroflash-backend-57">Cierra y escribe el traspaso.'),
  edita(6, 'D:\\wt-1\\scripts\\censo.mjs'),
  edita(7, 'D:\\wt-1\\tests\\censo.test.mjs'),
  edita(7, 'C:\\Users\\x\\.claude\\projects\\p\\memory\\MEMORY.md'),
  dice(8, 'Empujado el censo. Me queda el test, que está a medias.'),
  usa(9, 'Read', { file_path: 'D:\\wt-1\\README.md' }),
  arnes(10, LIMITE),
  arnes(10, LIMITE),
);

test('SCRUM-1427 · 🔴 la sesión cortada por cuota: sus últimas palabras son las SUYAS, no las del arnés, y el corte se dice aparte', () => {
  const d = derivar(sesion(CORTADA));
  assert.equal(d.cubo, 'CON RASTRO');
  assert.equal(d.ultimasPalabras.texto, 'Empujado el censo. Me queda el test, que está a medias.');
  assert.equal(d.ultimasPalabras.cuando, hora(8));
  assert.deepEqual(d.corte, { motivo: 'rate_limit', cuando: hora(10) });
  // El positivo de la negación: el texto del arnés ESTÁ en la transcripción, y no sale como palabra suya.
  assert.ok(CORTADA.includes(LIMITE));
  const t = informe(d, null).lineas.join('\n');
  assert.ok(!t.includes('weekly limit'), 'el mensaje del arnés no puede salir como lo último que dijo la sesión');
  assert.match(t, /CÓMO SE CORTÓ: el arnés la paró — rate_limit/);
  assert.match(t, /SUS ÚLTIMAS PALABRAS \(2026-10-01T14:08:00\.000Z\): Empujado el censo/);
});

test('SCRUM-1427 · qué es del arnés lo dice un campo de la entrada, no su texto', () => {
  assert.equal(esDelArnes(JSON.parse(arnes(1, 'x'))), true);
  assert.equal(esDelArnes({ message: { model: '<synthetic>' } }), true);
  assert.equal(esDelArnes(JSON.parse(dice(1, LIMITE))), false, 'una sesión que CITA el mensaje del límite sigue hablando ella');
  assert.equal(derivar(sesion(tr(dice(1, LIMITE)))).ultimasPalabras.texto, LIMITE);
});

test('SCRUM-1427 · 🔴 lo que dejó: tickets donde ESCRIBIÓ, PR, órdenes de empujar y los ficheros de DESPUÉS de su último commit', () => {
  const d = derivar(sesion(CORTADA), { ramaDe });
  assert.deepEqual(d.jira, ['SCRUM-9'], 'leer un ticket no es escribir en él');
  assert.deepEqual(d.prs, [77]);
  assert.deepEqual(d.empujes, ['git -C D:/wt-1 push origin HEAD:scrum-9-censo 2>$null']);
  assert.deepEqual(d.trasElUltimoCommit, ['D:\\wt-1\\scripts\\censo.mjs', 'D:\\wt-1\\tests\\censo.test.mjs'], 'sin repetir, sin la memoria, y sin lo de antes del commit');
  assert.equal(d.commits, 1);
  assert.match(d.encargo, /Haz el censo/);
  // Sin ningún commit, «después del último» son todos, y se dice.
  const sinCommit = derivar(sesion(tr(edita(1, 'D:\\wt-1\\a.ts'), edita(2, 'D:\\wt-1\\b.ts'))));
  assert.equal(sinCommit.trasElUltimoCommit.length, 2);
  assert.match(informe(sinCommit, null).lineas.join('\n'), /no comiteó nunca: son todos los que escribió/);
});

test('SCRUM-1427 · el último mensaje que recibió: de quién (por su origen) y qué, y un resultado de herramienta no es un mensaje', () => {
  const d = derivar(sesion(CORTADA));
  assert.equal(d.ultimoRecibido.de, 'otra sesión (cobroflash-backend-57)');
  assert.equal(d.ultimoRecibido.texto, 'Cierra y escribe el traspaso.');
  const conResultado = tr(recibe(1, 'human', 'hazlo'), JSON.stringify({ type: 'user', timestamp: hora(2), origin: { kind: 'human' }, toolUseResult: {}, message: { content: 'salida de una orden' } }));
  assert.deepEqual([derivar(sesion(conResultado)).ultimoRecibido.de, derivar(sesion(conResultado)).ultimoRecibido.texto], ['una persona', 'hazlo']);
  assert.match(informe(derivar(sesion(tr(dice(1, 'hola')))), null).lineas.join('\n'), /EL ÚLTIMO MENSAJE QUE RECIBIÓ: ninguno/);
});

test('SCRUM-1427 · 🔴 los TRES cubos no se confunden: sin transcripción NO es «no hizo nada»', () => {
  const nada = derivar(sesion(tr(recibe(0, 'human', 'mira esto'), usa(1, 'Read', { file_path: 'D:\\wt-1\\a.ts' }), dice(2, 'Mirado. No hay nada que cambiar.'))));
  assert.equal(nada.cubo, 'NO HIZO NADA QUE MUTE');
  assert.equal(informe(nada, null).codigo, 0);
  const sin = derivar(sesion(null));
  assert.equal(sin.cubo, 'NO SUPE');
  const t = informe(sin, null);
  assert.equal(t.codigo, 2);
  assert.match(t.lineas.join('\n'), /no hay transcripción .* Esto NO dice que no hiciera nada/);
  assert.match(t.lineas.join('\n'), /EL ENCARGO con el que arrancó: ERES LA SESIÓN 0/, 'lo que sí se sabe, se dice');
  assert.ok(!t.lineas.join('\n').includes('NO HIZO NADA'), 'una carpeta borrada no sale como «no hizo nada»');
  assert.equal(derivar(sesion('')).cubo, 'NO SUPE');
  // Cortada a mitad de línea: NO SUPE, pero lo que se leyó se imprime, marcado como incompleto.
  const rota = derivar(sesion(tr(edita(1, 'D:\\wt-1\\a.ts'), '{"type":"assist')));
  assert.equal(rota.cubo, 'NO SUPE');
  const tRota = informe(rota, null);
  assert.equal(tRota.codigo, 2);
  assert.match(tRota.lineas.join('\n'), /1 línea\(s\) de la transcripción no se dejan leer.*SOLO lo que se pudo leer/);
  assert.match(tRota.lineas.join('\n'), /D:\/wt-1\/a\.ts/);
});

test('SCRUM-1427 · una sesión que murió sin decir una palabra: se DICE, no se rellena con el arnés', () => {
  const d = derivar(sesion(tr(edita(1, 'D:\\wt-1\\a.ts'), arnes(2, LIMITE))));
  assert.equal(d.ultimasPalabras, null);
  assert.match(informe(d, null).lineas.join('\n'), /SUS ÚLTIMAS PALABRAS: murió sin decir nada/);
  // Y si habló DESPUÉS de un error del arnés, es que siguió: ese corte ya no es cómo acabó.
  const siguio = derivar(sesion(tr(arnes(1, 'error', 'overloaded'), dice(2, 'Sigo.'))));
  assert.equal(siguio.corte, null);
  assert.match(informe(siguio, null).lineas.join('\n'), /no consta un corte del arnés al final/);
});

test('SCRUM-1427 · 🔴 la MARCA va la primera siempre, también cuando no se supo, y dice que no sustituye al traspaso escrito', () => {
  for (const s of [sesion(CORTADA), sesion(null), sesion(tr(dice(1, 'hola')))]) {
    const l = informe(derivar(s), null).lineas;
    assert.equal(l[0], MARCA);
    assert.match(l[1], /No sustituye al traspaso que escribe la sesión/);
  }
  assert.match(MARCA, /NO LO ESCRIBIÓ LA SESIÓN/);
  assert.match(MARCA, /no por qué ni qué iba a hacer/);
});

test('SCRUM-1427 · cada fichero de después del commit dice si HOY sigue sin comitear, y «no se miró» no es «está limpio»', () => {
  const d = derivar(sesion(CORTADA));
  const arboles = [{ ruta: 'D:/wt-1', rama: 'scrum-9-censo', sucios: ['tests/censo.test.mjs', '.claude/settings.local.json'] }];
  const t = informe(d, arboles).lineas.join('\n');
  assert.match(t, /D:\/wt-1\/tests\/censo\.test\.mjs — 🔴 HOY SIGUE SIN COMITEAR en D:\/wt-1 \[scrum-9-censo\]/);
  assert.match(t, /D:\/wt-1\/scripts\/censo\.mjs — hoy no figura como cambio sin comitear en D:\/wt-1/);
  assert.match(informe(d, null).lineas.join('\n'), /censo\.mjs — árboles no mirados/);
  assert.match(informe(d, [{ ruta: 'D:/wt-1', rama: 'r', sucios: undefined }]).lineas.join('\n'), /censo\.mjs — su árbol no se pudo mirar/);
  assert.match(informe(d, [{ ruta: 'D:/otro', rama: 'r', sucios: [] }]).lineas.join('\n'), /censo\.mjs — fuera de todo árbol de trabajo que git conozca/);
});

test('SCRUM-1427 · el comando de verdad: una sesión, ninguna, dos con el mismo nombre, y sin nombre', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-1427-'));
  try {
    const pon = (id, nombre, transcripcion) => {
      fs.mkdirSync(path.join(tmp, id));
      const f = path.join(tmp, `${id}.jsonl`); if (transcripcion != null) fs.writeFileSync(f, transcripcion);
      fs.writeFileSync(path.join(tmp, id, 'state.json'), JSON.stringify({ state: 'stopped', intent: 'el encargo', respawnFlags: ['-n', nombre], linkScanPath: f }));
    };
    pon('j1', 's1-una', CORTADA); pon('j2', 's2-doble', CORTADA); pon('j3', 's2-doble', CORTADA); pon('j4', 's3-sin-rastro', null);
    assert.deepEqual(buscar(tmp, 's2-doble').map((x) => x.id), ['j2', 'j3']);
    assert.equal(buscar(tmp, 's3-sin-rastro')[0].transcripcion, null);
    // `--sin-github`: un test no pregunta nada a la red (SCRUM-1468).
    const corre = (...a) => spawnSync(process.execPath, [SCRIPT, ...a, '--jobs', tmp, '--sin-arboles', '--sin-github'], { encoding: 'utf8' });
    const una = corre('s1-una');
    assert.equal(una.status, 0, una.stdout + una.stderr);
    assert.match(una.stdout, /sesión: s1-una · estado en su state\.json: stopped · CON RASTRO/);
    assert.equal(una.stdout.split('\n')[0], MARCA);
    // Empujó con nombre y no se preguntó de qué rama es el #77: no se le atribuye, y se dice por qué.
    assert.match(una.stdout, /PR EMPUJADOS POR ESTA SESIÓN \(0\): ninguno/);
    assert.match(una.stdout, /PR DE LOS QUE NO SUPE DE QUIÉN SON \(1\):\n {3}· #77 — no se preguntó a GitHub de qué rama es \(--sin-github\)/);
    assert.deepEqual([corre('s9-nadie').status, corre('s2-doble').status, corre('s3-sin-rastro').status, corre().status], [2, 2, 2, 2]);
    assert.match(corre('s9-nadie').stdout, /no hay ninguna sesión llamada «s9-nadie».*eso NO dice que no hiciera nada/);
    assert.match(corre('s2-doble').stdout, /hay 2 sesiones llamadas «s2-doble» \(j2, j3\)\. No elijo una por ti/);
    assert.match(corre('s3-sin-rastro').stdout, /NO SUPE/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// SCRUM-1468 · un PR es de quien EMPUJÓ su rama, no de quien lo lleva enlazado en la transcripción.
// Medido el 6-oct-2026: 22 sesiones llevaban el #1681 (el de la rama del checkout compartido) y
// ninguna empujó esa rama; su `pr-link` aparece tras un `git push` de OTRA rama lanzado desde allí.
// ─────────────────────────────────────────────────────────────────────────────────────────
const SOLO_ENLAZA = tr(recibe(0, 'human', 'mira esto'), usa(1, 'Read', { file_path: 'D:\\wt-1\\a.ts' }), enlace(2, 1681), dice(3, 'Mirado. No hay nada que cambiar.'));

test('SCRUM-1468 · 🔴 un PR sólo ENLAZADO no se le atribuye a la sesión ni la hace pasar por «con rastro»', () => {
  // Sin preguntar nada a nadie: quien no empujó ninguna rama no puede haber empujado la de ese PR.
  const d = derivar(sesion(SOLO_ENLAZA));
  assert.equal(d.cubo, 'NO HIZO NADA QUE MUTE', 'un enlace no es una mutación');
  assert.deepEqual(d.prs, []);
  assert.deepEqual(d.prsEnlazados, [1681], 'el enlace no se pierde: sale aparte');
  assert.deepEqual(d.prsSinSaber, []);
  const t = informe(d, null).lineas.join('\n');
  assert.match(t, /PR EMPUJADOS POR ESTA SESIÓN \(0\): ninguno/);
  assert.match(t, /PR ENLAZADOS, NO EMPUJADOS POR ESTA SESIÓN \(1\): #1681/);
  assert.match(t, /PR DE LOS QUE NO SUPE DE QUIÉN SON \(0\): ninguno/);
});

test('SCRUM-1468 · control positivo: la que SÍ empujó su rama sigue saliendo con su PR, y el del arranque va aparte', () => {
  const d = derivar(sesion(tr(CORTADA, enlace(11, 1681))), { ramaDe });
  assert.deepEqual(d.ramas, ['scrum-9-censo']);
  assert.deepEqual(d.prs, [77]);
  assert.deepEqual(d.prsEnlazados, [1681]);
  assert.deepEqual(d.prsSinSaber, []);
  assert.equal(d.cubo, 'CON RASTRO');
  const t = informe(d, null).lineas.join('\n');
  assert.match(t, /PR EMPUJADOS POR ESTA SESIÓN \(1\): #77/);
  assert.match(t, /PR ENLAZADOS, NO EMPUJADOS POR ESTA SESIÓN \(1\): #1681/);
  assert.match(t, /RAMAS QUE EMPUJÓ CON NOMBRE \(1\): scrum-9-censo/);
});

test('SCRUM-1468 · si no se puede decidir qué rama empujó, se dice «no supe», no se atribuye ni se descarta', () => {
  // Un `git push` a secas: `ramasEmpujadas` no inventa la rama. Pudo ser la de cualquiera de los dos PR.
  const aSecas = derivar(sesion(tr(edita(1, 'D:\\wt-1\\a.ts'), orden(2, 'git -C D:/wt-1 push'), enlace(3, 77), enlace(3, 1681))), { ramaDe });
  assert.deepEqual([aSecas.prs, aSecas.prsEnlazados], [[], []]);
  assert.deepEqual(aSecas.prsSinSaber.map((p) => p.numero), [77, 1681]);
  assert.equal(aSecas.empujesSinRama, 1);
  assert.match(informe(aSecas, null).lineas.join('\n'), /#1681 — su rama \(scrum-1082-flujo-crear-factura-competencia\) no está entre las que empujó con nombre, pero hay 1 orden\(es\) de empujar sin nombre de rama/);
  // Empujó con nombre, pero nadie dijo de qué rama es cada PR: tampoco se atribuye.
  const sinPreguntar = derivar(sesion(tr(CORTADA, enlace(11, 1681))));
  assert.deepEqual([sinPreguntar.prs, sinPreguntar.prsEnlazados], [[], []]);
  assert.deepEqual(sinPreguntar.prsSinSaber.map((p) => p.numero), [77, 1681]);
  assert.match(informe(sinPreguntar, null).lineas.join('\n'), /#77 — no se preguntó a GitHub de qué rama es/);
  // GitHub contestó de uno y del otro no: cada PR con lo suyo.
  const aMedias = derivar(sesion(tr(CORTADA, enlace(11, 1681), enlace(11, 500))), { ramaDe });
  assert.deepEqual([aMedias.prs, aMedias.prsEnlazados, aMedias.prsSinSaber], [[77], [1681], [{ numero: 500, motivo: 'GitHub no dijo de qué rama es' }]]);
});

test('SCRUM-1468 · de qué rama es un PR se le pregunta a GitHub UNA vez, y un fallo no se lee como «no es suyo»', () => {
  const pedidas = [];
  const contesta = (salida) => (args) => { pedidas.push(args); return salida; };
  const m = ramasDeGithub([77, 1681, 500], 'o/r', contesta(JSON.stringify({ data: { repository: { p77: { headRefName: 'scrum-9-censo' }, p1681: { headRefName: RAMA_DEL_ARRANQUE }, p500: null } } })));
  assert.equal(pedidas.length, 1, 'una sola llamada para todos');
  assert.match(pedidas[0].join(' '), /p77: pullRequest\(number: 77\)/);
  assert.deepEqual([m.get(77), m.get(1681), m.get(500)], ['scrum-9-censo', RAMA_DEL_ARRANQUE, undefined]);
  assert.equal(ramasDeGithub([77], 'o/r', () => { throw new Error('sin red'); }), null, 'no pudo preguntar: null, no un mapa vacío');
  assert.equal(ramasDeGithub([77], 'o/r', () => 'esto no es JSON'), null);
  assert.equal(ramasDeGithub([77], 'sin-barra', contesta('{}')), null, 'sin repositorio reconocible no se pregunta');
  assert.equal(ramasDeGithub([], 'o/r', () => { throw new Error('no debería llamar'); }).size, 0, 'sin PR que preguntar no se llama a nadie');
});
