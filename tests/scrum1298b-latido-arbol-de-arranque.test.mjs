// SCRUM-1298b · EL LATIDO DICE SI EL ÁRBOL DONDE ARRANCAN LAS SESIONES TRAE LO QUE `main` YA TRAE.
//
// El 9-oct-2026 el checkout compartido iba 2.582 commits por detrás y declaraba 1 de los 5 hooks de `main`:
// la cerradura de carril llevaba tres días mergeada y no corría en ninguna sesión. Se midió a mano cuatro
// veces y ningún instrumento lo decía.
//
// Aquí se comprueba lo que la sección puede hacer mal:
//   · callar cuando a quien arranca le falta un hook o una norma;
//   · avisar por el NÚMERO de commits, que sube solo cada tarde y no dice si falta algo;
//   · contar los hooks del commit y no los del DISCO, que es de donde se cargan;
//   · decir «al día» sin haber podido preguntar al remoto.
//
// 🔴 EL BANCO ES UN REPOSITORIO SINTÉTICO en el temporal, con su propio remoto desnudo: su `main` no es el de
// este repositorio, y el test no depende de cómo esté `main` de verdad.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { seccionArranque, medirArranque, ordenesDe, importadosPor } from '../scripts/equipo/arranque.mjs';
import { salidaDe, informe, SALIDA_OK, SALIDA_AVISO, SALIDA_CIEGO } from '../scripts/equipo/latido.mjs';
import { temporal } from './_temporal.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// El rojo, declarado: lo ejecuta `npm run meta:mutaciones`.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // La sección deja de avisar, falte lo que falte.
    fichero: 'scripts/equipo/arranque.mjs',
    de: '  if (faltan.length || m.distintas.length) {',
    a: '  if (faltan.length > 99 && m.distintas.length > 99) {',
    cae: 'SCRUM-1298b · 🔴 EL CASO: el árbol va por detrás y declara 1 de los 5 hooks de main → aviso, con los que faltan y la orden',
  },
  {
    // Los hooks que faltan dejan de contarse: sólo quedaría la comparación entre commits.
    fichero: 'scripts/equipo/arranque.mjs',
    de: '  const faltan = m.hooksDeMain.filter((o) => !m.hooksEnDisco.includes(o));',
    a: '  const faltan = [];',
    cae: 'SCRUM-1298b · 🔴 los hooks se cuentan EN DISCO: al día en commits y con un hook quitado del fichero, avisa',
  },
  {
    // Un main sin hooks legibles pasa por «los carga todos».
    fichero: 'scripts/equipo/arranque.mjs',
    de: 'm.hooksDeMain.length === 0) return ciega(',
    a: 'm.hooksDeMain.length === -1) return ciega(',
    cae: 'SCRUM-1298b · 🔴 FAIL-CLOSED: sin medida, con motivo o con cero hooks en main, la sección sale «no pude mirar» (salida 2)',
  },
  {
    // La punta deja de preguntarse al remoto con el nombre que se le da: cualquier remoto vale.
    fichero: 'scripts/equipo/arranque.mjs',
    de: "    if (!SHA.test(punta)) return { arbol, motivo: `el remoto no contestó la punta de ${rama}` };",
    a: "    if (!SHA.test(punta)) punta = git(arbol, ['rev-parse', 'HEAD']).trim();",
    cae: 'SCRUM-1298b · 🔴 FAIL-CLOSED: si el remoto no contesta la punta, NO se compara contra lo que haya en local',
  },
];

const HOOK = (orden, extra = {}) => ({ hooks: [{ type: 'command', command: orden }], ...extra });
const UNO = { hooks: { PreToolUse: [HOOK('bash .claude/hooks/guard.sh', { matcher: 'Bash' })] } };
const CINCO = {
  hooks: {
    SessionStart: [{ hooks: [{ type: 'command', command: 'node .claude/hooks/identidad.mjs' }, { type: 'command', command: 'node .claude/hooks/latido-arranque.mjs' }] }],
    PreToolUse: [HOOK('bash .claude/hooks/guard.sh', { matcher: 'Bash' }), HOOK('node .claude/hooks/carril.mjs', { matcher: 'Edit|Write' })],
    Stop: [HOOK('node .claude/hooks/latido-cierre.mjs')],
  },
};

/**
 * Un remoto desnudo, el árbol PRINCIPAL (donde arrancan las sesiones) clonado de él, y otro clon con el que
 * `main` avanza en el remoto sin que el principal se entere.
 */
function banco() {
  const base = temporal('scrum1298b-');
  const remoto = path.join(base, 'remoto.git'), principal = path.join(base, 'principal'), otro = path.join(base, 'otro');
  const g = (cwd, ...a) => execFileSync('git', ['-C', cwd, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const preparar = (d) => { g(d, 'config', 'user.email', 'banco@yaqu.test'); g(d, 'config', 'user.name', 'Banco'); g(d, 'config', 'commit.gpgsign', 'false'); g(d, 'config', 'core.autocrlf', 'false'); };
  // La ruta se da SIEMPRE relativa a la carpeta temporal del banco («principal/…», «otro/…»): así lo que se
  // escribe cuelga de `base` a la vista, y no de un parámetro que el censo de temporales (SCRUM-824) no puede seguir.
  const escribir = (rel, texto) => { const f = path.join(base, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, texto); };
  fs.mkdirSync(remoto);
  g(remoto, 'init', '-q', '--bare', '-b', 'main');
  // `core.autocrlf` apagado DESDE el clon: con el `true` de esta máquina el segundo clon saca CRLF, y su
  // siguiente commit cambiaría de fin de línea ficheros que nadie ha tocado (saldrían como piezas distintas).
  const clonar = (destino) => execFileSync('git', ['clone', '-q', '-c', 'core.autocrlf=false', remoto, destino], { stdio: ['ignore', 'pipe', 'pipe'] });
  clonar(principal);
  preparar(principal);
  g(principal, 'checkout', '-q', '-B', 'main');
  escribir('principal/CLAUDE.md', '# normas\n\n@docs/normas-siempre.md\n');
  escribir('principal/docs/normas-siempre.md', 'A1\n');
  escribir('principal/.claude/settings.json', JSON.stringify(UNO, null, 2));
  escribir('principal/src/app.txt', 'v1\n');
  g(principal, 'add', '-A'); g(principal, 'commit', '-q', '-m', 'base'); g(principal, 'push', '-q', 'origin', 'main');
  clonar(otro);
  preparar(otro);
  /** `main` avanza en el remoto: el principal NO trae nada. */
  const avanza = (cambios, mensaje) => {
    g(otro, 'pull', '-q', '--ff-only', 'origin', 'main');
    for (const [rel, texto] of Object.entries(cambios)) escribir(`otro/${rel}`, texto);
    g(otro, 'add', '-A'); g(otro, 'commit', '-q', '-m', mensaje); g(otro, 'push', '-q', 'origin', 'main');
  };
  return { base, remoto, principal, otro, g, escribir, avanza };
}

test('SCRUM-1298b · 🔴 EL CASO: el árbol va por detrás y declara 1 de los 5 hooks de main → aviso, con los que faltan y la orden', () => {
  const b = banco();
  b.avanza({ '.claude/settings.json': JSON.stringify(CINCO, null, 2), '.claude/hooks/carril.mjs': '// cerradura\n' }, 'los hooks');
  b.avanza({ 'docs/normas-siempre.md': 'A1\nA2\n', 'src/app.txt': 'v2\n' }, 'una norma y código');
  const m = medirArranque({ raiz: b.principal });
  assert.equal(m.motivo, undefined, `🔴 no supo medir: ${m.motivo}`);
  assert.equal(m.arbol, path.resolve(b.principal));
  assert.equal(m.rama, 'main');
  assert.equal(m.detras, 2);
  assert.equal(m.delante, 0);
  assert.equal(m.hooksDeMain.length, 5);
  assert.equal(m.hooksEnDisco.length, 1);
  // Las piezas de arranque: el settings, el hook nuevo y la norma que CLAUDE.md importa. El código NO es una pieza.
  assert.deepEqual(m.distintas, ['.claude/hooks/carril.mjs', '.claude/settings.json', 'docs/normas-siempre.md']);
  const s = seccionArranque(m);
  assert.equal(s.pudo, true);
  assert.equal(s.alertas.length, 1, '🔴 con 4 hooks sin cargar y 3 piezas viejas la sección NO avisa');
  const linea = s.alertas[0].linea;
  assert.match(linea, /4 hook\(s\) que no corren para nadie/);
  assert.match(linea, /node \.claude\/hooks\/carril\.mjs/);
  assert.match(linea, /3 pieza\(s\) de arranque/);
  assert.match(linea, /va 2 commit\(s\) por detrás/);
  assert.match(linea, /equipo PARADO/);
  assert.match(linea, /merge --ff-only/, '🔴 en `main` y sin commits propios, la orden es la de una línea');
  assert.match(s.poblacion, /carga 1 de 5 hooks de main/);
  assert.equal(salidaDe([s]), SALIDA_AVISO);
  assert.match(informe([s], { ahora: Date.parse('2026-10-09T11:00:00Z') }), /🔴 ARRANQUE · /);

  // Y LA ORDEN QUE DA, CORRIDA, LO APAGA: el verde de al lado del rojo.
  b.g(b.principal, 'merge', '-q', '--ff-only', 'origin/main');
  const d = medirArranque({ raiz: b.principal });
  assert.equal(d.detras, 0);
  assert.equal(d.hooksEnDisco.length, 5);
  assert.deepEqual(d.distintas, []);
  const sd = seccionArranque(d);
  assert.deepEqual(sd.alertas, [], '🔴 al día y con los 5 hooks, la sección sigue avisando');
  assert.match(sd.poblacion, /0 commit\(s\) por detrás .* carga 5 de 5 hooks de main · 0 pieza\(s\)/);
  assert.equal(salidaDe([sd]), SALIDA_OK);
});

test('SCRUM-1298b · el umbral NO es el número de commits: por detrás pero sin ninguna pieza de arranque distinta, no avisa', () => {
  const b = banco();
  b.avanza({ 'src/app.txt': 'v2\n' }, 'sólo código');
  b.avanza({ 'src/otro.txt': 'x\n' }, 'más código');
  b.avanza({ 'docs/otra-cosa.md': 'no la importa CLAUDE.md\n' }, 'un doc que no se carga al arrancar');
  const m = medirArranque({ raiz: b.principal });
  assert.equal(m.detras, 3);
  assert.deepEqual(m.distintas, []);
  const s = seccionArranque(m);
  assert.deepEqual(s.alertas, [], '🔴 avisa por ir 3 commits por detrás sin que a quien arranca le falte nada');
  assert.match(s.poblacion, /3 commit\(s\) por detrás/, '🔴 los commits por detrás tienen que verse siempre, aunque no avisen');
  assert.equal(salidaDe([s]), SALIDA_OK);
});

test('SCRUM-1298b · 🔴 los hooks se cuentan EN DISCO: al día en commits y con un hook quitado del fichero, avisa', () => {
  const b = banco();
  b.avanza({ '.claude/settings.json': JSON.stringify(CINCO, null, 2) }, 'los hooks');
  b.g(b.principal, 'pull', '-q', '--ff-only', 'origin', 'main');
  const sinStop = JSON.parse(JSON.stringify(CINCO)); delete sinStop.hooks.Stop;
  b.escribir('principal/.claude/settings.json', JSON.stringify(sinStop, null, 2));
  const m = medirArranque({ raiz: b.principal });
  assert.equal(m.detras, 0);
  assert.deepEqual(m.distintas, [], 'entre commits no hay diferencia: el fichero está cambiado sólo en disco');
  const s = seccionArranque(m);
  assert.equal(s.alertas.length, 1, '🔴 el fichero que se CARGA tiene 4 hooks de 5 y la sección dice que está todo');
  assert.match(s.alertas[0].linea, /1 hook\(s\) que no corren para nadie \(Stop · \* · node \.claude\/hooks\/latido-cierre\.mjs\)/);
  assert.match(s.poblacion, /carga 4 de 5 hooks de main/);
  // Sin el fichero en disco no hay ceguera: hay cero hooks, y eso es un aviso.
  fs.unlinkSync(path.join(b.principal, '.claude', 'settings.json'));
  const sin = seccionArranque(medirArranque({ raiz: b.principal }));
  assert.equal(sin.pudo, true);
  assert.match(sin.poblacion, /carga 0 de 5 hooks de main/);
  assert.equal(sin.alertas.length, 1);
});

test('SCRUM-1298b · se mide el árbol PRINCIPAL aunque el latido corra desde otro árbol del mismo repositorio', () => {
  const b = banco();
  const mesa = path.join(b.base, 'mesa');
  b.g(b.principal, 'worktree', 'add', '-q', '--detach', mesa);
  b.avanza({ '.claude/settings.json': JSON.stringify(CINCO, null, 2) }, 'los hooks');
  const m = medirArranque({ raiz: mesa });
  assert.equal(m.arbol, path.resolve(b.principal), '🔴 ha medido el árbol desde el que corre, no aquél donde arrancan las sesiones');
  assert.equal(m.detras, 1);
  // Un principal en otra rama y con un commit propio: la orden de una línea ya no vale, y no se da.
  b.g(b.principal, 'checkout', '-q', '-b', 'scrum-de-alguien');
  b.escribir('principal/src/mio.txt', 'x\n'); b.g(b.principal, 'add', '-A'); b.g(b.principal, 'commit', '-q', '-m', 'propio');
  const r = medirArranque({ raiz: mesa });
  assert.equal(r.rama, 'scrum-de-alguien');
  assert.equal(r.delante, 1);
  const s = seccionArranque(r);
  assert.match(s.poblacion, /rama `scrum-de-alguien`.* y 1 por delante/);
  assert.doesNotMatch(s.alertas[0].linea, /merge --ff-only/, '🔴 da la orden de una línea a un árbol que no está en `main` o tiene commits propios');
  assert.match(s.alertas[0].linea, /docs\/master\/SCRUM-1298\.md/);
});

test('SCRUM-1298b · 🔴 FAIL-CLOSED: si el remoto no contesta la punta, NO se compara contra lo que haya en local', () => {
  const b = banco();
  b.avanza({ '.claude/settings.json': JSON.stringify(CINCO, null, 2) }, 'los hooks');
  // Un remoto que no existe: git falla.
  const sinRemoto = medirArranque({ raiz: b.principal, remoto: 'no-existe' });
  assert.match(String(sinRemoto.motivo), /no pude preguntar al remoto/);
  const s1 = seccionArranque(sinRemoto);
  assert.equal(s1.pudo, false);
  assert.equal(salidaDe([s1]), SALIDA_CIEGO);
  // Un remoto que contesta VACÍO (la rama no está): no hay punta, y no se inventa una con el HEAD local.
  const sinRama = medirArranque({ raiz: b.principal, rama: 'rama-que-no-hay' });
  assert.match(String(sinRama.motivo), /el remoto no contestó la punta/, `🔴 sin punta ha seguido midiendo: ${JSON.stringify(sinRama)}`);
  assert.equal(sinRama.detras, undefined, '🔴 da un «por detrás» sin tener contra qué contarlo');
  assert.equal(seccionArranque(sinRama).pudo, false);
  // Fuera de un repositorio: lo dice.
  const fuera = seccionArranque(medirArranque({ raiz: b.base }));
  assert.equal(fuera.pudo, false);
  assert.match(fuera.motivo, /NO SÉ si/);
});

test('SCRUM-1298b · 🔴 FAIL-CLOSED: sin medida, con motivo o con cero hooks en main, la sección sale «no pude mirar» (salida 2)', () => {
  for (const m of [undefined, null, { motivo: 'git reventó' }, { arbol: 'X', motivo: 'sin red' }]) {
    const s = seccionArranque(m);
    assert.equal(s.pudo, false, `🔴 con ${JSON.stringify(m)} la sección dice que pudo mirar`);
    assert.equal(s.nombre, 'ARRANQUE');
    assert.deepEqual(s.alertas, []);
    assert.equal(salidaDe([s]), SALIDA_CIEGO);
  }
  const base = { arbol: 'X', rama: 'main', head: 'a'.repeat(40), punta: 'a'.repeat(40), detras: 0, delante: 0, hooksEnDisco: [], distintas: [] };
  // Cero de cero NO es «los carga todos».
  assert.equal(seccionArranque({ ...base, hooksDeMain: [] }).pudo, false, '🔴 con main sin hooks legibles dice «carga 0 de 0» y sale verde');
  assert.equal(seccionArranque({ ...base, hooksDeMain: undefined }).pudo, false);
  // Y el control: con los mismos datos y un hook en main que el disco sí tiene, pudo y no avisa.
  const bien = seccionArranque({ ...base, hooksDeMain: ['Stop · * · node x.mjs'], hooksEnDisco: ['Stop · * · node x.mjs'] });
  assert.equal(bien.pudo, true);
  assert.deepEqual(bien.alertas, []);
});

test('SCRUM-1298b · las dos lecturas: los hooks de un settings.json y lo que CLAUDE.md importa', () => {
  assert.deepEqual(ordenesDe(CINCO), [
    'PreToolUse · Bash · bash .claude/hooks/guard.sh',
    'PreToolUse · Edit|Write · node .claude/hooks/carril.mjs',
    'SessionStart · * · node .claude/hooks/identidad.mjs',
    'SessionStart · * · node .claude/hooks/latido-arranque.mjs',
    'Stop · * · node .claude/hooks/latido-cierre.mjs',
  ]);
  assert.deepEqual(ordenesDe({}), []);
  assert.deepEqual(ordenesDe(null), []);
  assert.deepEqual(ordenesDe({ hooks: { Stop: 'roto' } }), []);
  // Sólo el renglón que ES un import; un `@` en mitad de una frase o un correo no lo son.
  assert.deepEqual(importadosPor('# título\r\n@docs/equipo/00-normas-siempre.md\r\n\r\nescribe a alguien@yaqu.app · lee @docs/otro.md si quieres\n  @docs/dos.md  \n'), ['docs/equipo/00-normas-siempre.md', 'docs/dos.md']);
  assert.deepEqual(importadosPor(undefined), []);
});

test('SCRUM-1298b · ESCRITO NO ES CORRIENDO: el latido mide el arranque y mete la sección en su veredicto', () => {
  const fuente = fs.readFileSync(path.join(RAIZ, 'scripts', 'equipo', 'latido.mjs'), 'utf8');
  assert.match(fuente, /import \{ seccionArranque, medirArranque \} from '\.\/arranque\.mjs';/);
  assert.match(fuente, /const sArr = seccionArranque\(intentar\(\(\) => medirArranque\(\{ raiz \}\)\)\);/, '🔴 el latido no mide el arranque (o lo mide sin `intentar`: un fallo suyo tumbaría la pasada entera)');
  const lista = /const secciones = \[([^\]]+)\];/.exec(fuente);
  assert.ok(lista, '🔴 no encuentro la lista de secciones del latido');
  assert.ok(lista[1].split(',').map((x) => x.trim()).includes('sArr'), '🔴 la sección ARRANQUE se calcula y NO entra en el veredicto');
});
