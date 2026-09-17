// tests/scrum839d-union-solo-en-el-registro.test.mjs — SCRUM-839d · fase 2, pieza A
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// `merge=union` SOLO EN EL REGISTRO, Y EL JOB QUE LO APLICA NO EMPUJA NUNCA SOBRE CÓDIGO
//
// Dos cosas, las dos EJECUTADAS y ninguna leída como texto suelto:
//
//   ① EL GUARD DE `.gitattributes`. `union` en `docs/master/*.md` suma las dos entradas de
//     registro que chocan. En código sería un desastre SILENCIOSO: dos versiones de una función
//     pegadas, sin marcadores, y el merge «limpio». Así que se mira por las dos mitades:
//       · la DECLARACIÓN — ninguna línea pone `merge=union` a otro patrón;
//       · el EFECTO —`git check-attr` sobre todo el árbol y sobre rutas que todavía no existen—,
//         que caza lo que la declaración no ve (una macro `[attr]`, un patrón más ancho).
//
//   ② LA DECISIÓN de `scripts/conflicto-de-registro.mjs`, contra repositorios git DE VERDAD:
//     POSITIVO (el #1318, fabricado), NEGATIVOS (un fichero fuera y no se empuja; código sigue en
//     conflicto) y el SUELO (sin lista de ficheros, «no pude mirar»).
//
// El rojo de cada uno está DECLARADO abajo (MUTACIONES_QUE_ME_TUMBAN) y lo ejecuta
// `npm run meta:mutaciones`: una prohibición cuyo rojo no se ha visto es una frase.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { RUTA_DE_REGISTRO, decidir, gitReal, mezclar } from '../scripts/conflicto-de-registro.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El defecto que viene a impedir: `union` extendido a código.
    fichero: '.gitattributes',
    de: 'docs/master/*.md merge=union',
    a: 'docs/master/*.md merge=union\nsrc/**/*.ts merge=union',
    cae: '🔴 DECLARACIÓN: ninguna línea pone merge=union fuera de docs/master/*.md',
  },
  {
    // Por la puerta de atrás: una macro. La declaración no la ve; el EFECTO, sí.
    fichero: '.gitattributes',
    de: 'docs/master/*.md merge=union',
    a: 'docs/master/*.md merge=union\n[attr]registro merge=union\n*.json registro',
    cae: '🔴 EFECTO: git no aplica union a ninguna ruta fuera de docs/master/*.md',
  },
  {
    // La cerradura 1 apagada. La 2 seguiría parando el push, así que el test exige LA CAUSA.
    fichero: 'scripts/conflicto-de-registro.mjs',
    de: 'const fuera = visto.ficheros.filter((f) => !RUTA_DE_REGISTRO.test(f));',
    a: 'const fuera = [];',
    cae: '🔴 NEGATIVO: un solo fichero fuera de docs/master y no se empuja',
  },
  {
    fichero: 'scripts/conflicto-de-registro.mjs',
    de: 'export const RUTA_DE_REGISTRO = /^docs\\/master\\/[^/]+\\.md$/;',
    a: 'export const RUTA_DE_REGISTRO = /^docs\\/master\\/.+\\.md$/;',
    cae: '🔴 NEGATIVO: un subdirectorio de docs/master no es registro',
  },
  {
    // El suelo apagado: una salida 1 sin lista se tomaría por «conflicto de nada que esté fuera».
    fichero: 'scripts/conflicto-de-registro.mjs',
    de: "if (!ficheros.length || ficheros.some((f) => !f)) {",
    a: 'if (false) {',
    cae: '🔴 SUELO: salida 1 sin lista de ficheros es «no pude mirar», no conflicto',
  },
  {
    // La trampa medida: leer los atributos del árbol de trabajo en vez de fijarlos.
    fichero: 'scripts/conflicto-de-registro.mjs',
    de: "const visto = mezclar(git, { cabeza, main, fuente: arbolVacio });",
    a: 'const visto = mezclar(git, { cabeza, main, fuente: main });',
    cae: '🔴 POSITIVO: el #1318 fabricado — choque solo de registro → merge limpio y se empuja',
  },
];

const sinComentario = (l) => l.trim().replace(/\s+/g, ' ');

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① EL GUARD DE `.gitattributes`
// ═════════════════════════════════════════════════════════════════════════════════════════

/** `merge` de cada ruta según git, con los atributos del árbol y SIN los de la máquina. */
function atributoMerge(cwd, rutas) {
  const r = spawnSync('git', ['-c', 'core.attributesFile=',
    'check-attr', '-z', '--stdin', 'merge'], { cwd, input: rutas.join('\0'), encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024 });
  assert.equal(r.status, 0, `🔴 CIEGO: git check-attr no responde (${r.stderr})`);
  const t = r.stdout.split('\0');
  const out = new Map();
  for (let i = 0; i + 2 < t.length; i += 3) out.set(t[i], t[i + 2]);
  return out;
}

/** Rutas que HOY no existen y MAÑANA pueden: un patrón ancho no se ve mirando solo el árbol. */
const RUTAS_CENTINELA = [
  'src/modules/quotes/nuevo.ts',
  'tests/nuevo.test.mjs',
  'scripts/nuevo.mjs',
  'public/nuevo.js',
  'prisma/schema.prisma',
  'package.json',
  'docs/YAQU_MASTER.md',
  'docs/BUGS.md',
  'docs/master/sub/SCRUM-1.md',
  'docs/master/SCRUM-1.txt',
  'README.md',
];

test('🔴 DECLARACIÓN: ninguna línea pone merge=union fuera de docs/master/*.md', () => {
  const lineas = fs.readFileSync(path.join(RAIZ, '.gitattributes'), 'utf8').split(/\r?\n/)
    .map(sinComentario).filter((l) => l && !l.startsWith('#'));
  assert.ok(lineas.length > 20, `🔴 CIEGO: solo ${lineas.length} reglas en .gitattributes`);

  const conUnion = lineas.filter((l) => l.split(' ').slice(1).includes('merge=union'));
  assert.deepEqual(conUnion, ['docs/master/*.md merge=union'],
    '🔴 `merge=union` aparece en otra regla de `.gitattributes`:\n  ' + conUnion.join('\n  ') + '\n\n'
    + '  union pega las dos versiones SIN marcadores de conflicto. En código eso es un merge «limpio»\n'
    + '  con dos implementaciones a la vez. Solo el registro (docs/master/*.md) lo admite.');
});

test('🔴 EFECTO: git no aplica union a ninguna ruta fuera de docs/master/*.md', () => {
  const rastreados = execFileSync('git', ['ls-files', '-z'], { cwd: RAIZ, encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean);
  assert.ok(rastreados.length > 1000, `🔴 CIEGO: git ls-files solo ve ${rastreados.length} ficheros`);

  const attrs = atributoMerge(RAIZ, [...rastreados, ...RUTAS_CENTINELA]);
  // SUELO: el instrumento VE la regla donde tiene que estar. Sin esto, un check-attr que devolviera
  // siempre «unspecified» dejaría el resto en verde eterno.
  assert.equal(attrs.get('docs/master/SCRUM-839.md'), 'union',
    '🔴 docs/master/SCRUM-839.md no sale con merge=union: o la regla se ha ido, o el instrumento no ve');
  assert.equal(attrs.get('docs/master/sub/SCRUM-1.md'), 'unspecified',
    '🔴 la regla alcanza subdirectorios de docs/master: el job solo sabe resolver el primer nivel');

  const fuera = [...attrs].filter(([ruta, v]) => v === 'union' && !RUTA_DE_REGISTRO.test(ruta));
  assert.deepEqual(fuera, [],
    '🔴 git mezcla con union rutas fuera del registro:\n  '
    + fuera.map(([r]) => r).slice(0, 20).join('\n  '));
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② LA DECISIÓN, CONTRA REPOSITORIOS DE VERDAD
// ═════════════════════════════════════════════════════════════════════════════════════════

const REGLA = 'docs/master/*.md merge=union\n';

/** Un repositorio con `main` y una rama `pr` que parten de la misma base. */
function repo({ base, enPr, enMain, attrsMain = REGLA, attrsPr = '', infoAttributes = '' }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum839d-'));
  const g = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: 'pipe' }).trim();
  const escribir = (ficheros) => {
    for (const [f, txt] of Object.entries(ficheros)) {
      fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
      fs.writeFileSync(path.join(dir, f), txt);
    }
    g('add', '-A');
  };
  g('init', '-q', '-b', 'main');
  g('config', 'core.autocrlf', 'false');
  g('config', 'user.email', 'scrum839d@test');
  g('config', 'user.name', 'scrum839d');
  escribir(base);
  g('commit', '-qm', 'base');
  if (infoAttributes) {
    fs.mkdirSync(path.join(dir, '.git', 'info'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.git', 'info', 'attributes'), infoAttributes);
  }
  g('checkout', '-qb', 'pr');
  escribir({ ...enPr, ...(attrsPr ? { '.gitattributes': attrsPr } : {}) });
  g('commit', '-qm', 'pr');
  g('checkout', '-q', 'main');
  escribir({ ...enMain, ...(attrsMain ? { '.gitattributes': attrsMain } : {}) });
  g('commit', '-qm', 'main');
  return { dir, g, cabeza: g('rev-parse', 'pr'), main: g('rev-parse', 'main') };
}

function conRepo(opts, fn) {
  const r = repo(opts);
  try { return fn(r); } finally { fs.rmSync(r.dir, { recursive: true, force: true }); }
}

// SCRUM-839e: la decisión solo mira PR que ya estaban armados. Todo lo de este fichero va sobre uno
// armado; el caso sin armar y su suelo viven en `tests/scrum839e-solo-pr-armados.test.mjs`.
const ARMADO = { number: 1318, autoMergeRequest: { enabledAt: '2026-09-16T05:58:00Z', mergeMethod: 'MERGE' } };

const decide = (r) => decidir(gitReal(r.dir), { pr: ARMADO, cabeza: r.cabeza, main: r.main, mensaje: 'merge de prueba' });

const REGISTRO = { 'docs/master/SCRUM-609.md': '# SCRUM-609\n\nentrada común\n', 'src/a.ts': 'export const a = 1;\n' };

test('🔴 POSITIVO: el #1318 fabricado — choque solo de registro → merge limpio y se empuja', () => {
  conRepo({
    base: REGISTRO,
    enPr: { 'docs/master/SCRUM-609.md': '# SCRUM-609\n\nentrada común\n\n## la del PR\n' },
    enMain: { 'docs/master/SCRUM-609.md': '# SCRUM-609\n\nentrada común\n\n## la de main\n' },
  }, (r) => {
    // CONTROL: de verdad es un conflicto para quien no aplica atributos (GitHub).
    const sinAttrs = mezclar(gitReal(r.dir), {
      cabeza: r.cabeza, main: r.main,
      fuente: execFileSync('git', ['hash-object', '-t', 'tree', '-w', '--stdin'], { cwd: r.dir, input: '', encoding: 'utf8' }).trim(),
    });
    assert.equal(sinAttrs.estado, 'CONFLICTO', '🔴 el caso fabricado no choca: no prueba nada');

    const v = decide(r);
    assert.equal(v.accion, 'EMPUJAR', JSON.stringify(v));
    assert.deepEqual(v.ficheros, ['docs/master/SCRUM-609.md']);
    // El commit: hijo de la cabeza del PR (así el push es fast-forward) y de main.
    assert.equal(r.g('rev-parse', `${v.commit}^1`), r.cabeza);
    assert.equal(r.g('rev-parse', `${v.commit}^2`), r.main);
    const texto = r.g('show', `${v.commit}:docs/master/SCRUM-609.md`);
    assert.match(texto, /la del PR/);
    assert.match(texto, /la de main/);
    assert.doesNotMatch(texto, /^(<<<<<<<|>>>>>>>|=======)/m);
    // El merge no dejó nada en ninguna rama: empujar es cosa del workflow.
    assert.equal(r.g('rev-parse', 'pr'), r.cabeza);
  });
});

test('🔴 la rama del PR sin la regla (anterior a ella) se resuelve igual: manda la de main', () => {
  // La trampa medida: merge-tree lee los atributos del árbol de trabajo. Aquí el árbol sacado es
  // el de `pr`, que NO tiene la regla.
  conRepo({
    // La base ya trae un `.gitattributes` SIN la regla y el PR no lo toca: si lo tocaran los dos
    // lados, el choque estaría en `.gitattributes`, que no es registro (me pasó escribiéndolo).
    base: { ...REGISTRO, '.gitattributes': '* text=auto\n' },
    enPr: { 'docs/master/SCRUM-609.md': 'entrada común\nPR\n' },
    enMain: { 'docs/master/SCRUM-609.md': 'entrada común\nMAIN\n' },
  }, (r) => {
    r.g('checkout', '-q', 'pr');
    // CONTROL: el árbol sacado de verdad no trae la regla.
    assert.doesNotMatch(fs.readFileSync(path.join(r.dir, '.gitattributes'), 'utf8'), /union/);
    assert.equal(decide(r).accion, 'EMPUJAR');
  });
});

test('🔴 NEGATIVO: un solo fichero fuera de docs/master y no se empuja', () => {
  conRepo({
    base: REGISTRO,
    enPr: { 'docs/master/SCRUM-609.md': 'PR\n', 'src/a.ts': 'export const a = 2;\n' },
    enMain: { 'docs/master/SCRUM-609.md': 'MAIN\n', 'src/a.ts': 'export const a = 3;\n' },
  }, (r) => {
    const v = decide(r);
    assert.equal(v.accion, 'NO-EMPUJA', JSON.stringify(v));
    assert.equal(v.causa, 'FUERA-DE-REGISTRO');
    assert.deepEqual(v.fuera, ['src/a.ts']);
    assert.equal(v.commit, undefined);
  });
});

test('🔴 NEGATIVO: un conflicto de código sigue en conflicto', () => {
  conRepo({
    base: REGISTRO,
    enPr: { 'src/a.ts': 'export const a = 2;\n' },
    enMain: { 'src/a.ts': 'export const a = 3;\n' },
  }, (r) => {
    const v = decide(r);
    assert.equal(v.accion, 'NO-EMPUJA');
    assert.deepEqual(v.fuera, ['src/a.ts']);
  });
});

test('🔴 NEGATIVO: un subdirectorio de docs/master no es registro', () => {
  conRepo({
    base: { 'docs/master/sub/SCRUM-1.md': 'x\n' },
    enPr: { 'docs/master/sub/SCRUM-1.md': 'PR\n' },
    enMain: { 'docs/master/sub/SCRUM-1.md': 'MAIN\n' },
  }, (r) => {
    const v = decide(r);
    assert.equal(v.accion, 'NO-EMPUJA');
    assert.deepEqual(v.fuera, ['docs/master/sub/SCRUM-1.md']);
  });
});

test('🔴 NEGATIVO: YAQU_MASTER.md y BUGS.md no son registro', () => {
  conRepo({
    base: { 'docs/YAQU_MASTER.md': 'x\n', 'docs/BUGS.md': 'x\n' },
    enPr: { 'docs/YAQU_MASTER.md': 'PR\n', 'docs/BUGS.md': 'PR\n' },
    enMain: { 'docs/YAQU_MASTER.md': 'MAIN\n', 'docs/BUGS.md': 'MAIN\n' },
  }, (r) => {
    const v = decide(r);
    assert.equal(v.accion, 'NO-EMPUJA');
    assert.deepEqual([...v.fuera].sort(), ['docs/BUGS.md', 'docs/YAQU_MASTER.md']);
  });
});

test('🔴 CERRADURA 2 sola: si main no trae la regla, un choque de registro no se empuja', () => {
  conRepo({
    base: REGISTRO,
    enPr: { 'docs/master/SCRUM-609.md': 'PR\n' },
    enMain: { 'docs/master/SCRUM-609.md': 'MAIN\n' },
    attrsMain: '* text=auto\n',
  }, (r) => {
    const v = decide(r);
    assert.equal(v.accion, 'NO-EMPUJA', JSON.stringify(v));
    assert.equal(v.causa, 'UNION-NO-RESUELVE');
  });
});

test('🔴 borrar en un lado y editar en otro no lo arregla union: no se empuja', () => {
  conRepo({
    base: REGISTRO,
    enPr: { 'docs/master/SCRUM-609.md': 'editado en el PR\n' },
    enMain: {},
  }, (r) => {
    fs.rmSync(path.join(r.dir, 'docs/master/SCRUM-609.md'));
    r.g('commit', '-qam', 'borrado en main');
    const v = decidir(gitReal(r.dir), { pr: ARMADO, cabeza: r.cabeza, main: r.g('rev-parse', 'main'), mensaje: 'm' });
    assert.equal(v.accion, 'NO-EMPUJA', JSON.stringify(v));
    assert.equal(v.causa, 'UNION-NO-RESUELVE');
  });
});

test('sin conflicto no hay nada que hacer', () => {
  conRepo({
    base: REGISTRO,
    enPr: { 'docs/master/SCRUM-1.md': 'nuevo\n' },
    enMain: { 'docs/master/SCRUM-2.md': 'otro\n' },
  }, (r) => {
    assert.equal(decide(r).accion, 'NADA');
  });
});

test('🔴 SUELO: salida 1 sin lista de ficheros es «no pude mirar», no conflicto', () => {
  const arbol = 'a'.repeat(40);
  const falso = (merge) => (args) => {
    if (args.includes('hash-object')) return { status: 0, stdout: arbol + '\n', stderr: '' };
    if (args.includes('rev-parse')) return { status: 0, stdout: path.join(os.tmpdir(), 'scrum839d-no-existe') + '\n', stderr: '' };
    return merge;
  };
  const d = (merge) => decidir(falso(merge), { pr: ARMADO, cabeza: 'c', main: 'm', mensaje: 'x' });

  // Lo medido: una ref inexistente da salida 1 y NADA por stdout.
  assert.equal(d({ status: 1, stdout: '', stderr: 'not something we can merge' }).accion, 'NO-PUDE-MIRAR');
  // Un árbol, salida 1, y ni un fichero.
  assert.equal(d({ status: 1, stdout: arbol + '\0', stderr: '' }).accion, 'NO-PUDE-MIRAR');
  // git que no conoce la opción, o que no está.
  assert.equal(d({ status: 129, stdout: '', stderr: 'unknown option' }).accion, 'NO-PUDE-MIRAR');
  assert.equal(d({ status: null, stdout: '', stderr: '' }).accion, 'NO-PUDE-MIRAR');
  // CONTROL: el mismo falso con una lista SÍ se cree el conflicto — el suelo no lo rechaza todo.
  assert.equal(d({ status: 1, stdout: `${arbol}\0src/a.ts\0`, stderr: '' }).causa, 'FUERA-DE-REGISTRO');
});

test('🔴 SUELO: con la ref de la cabeza inexistente, de verdad, «no pude mirar»', () => {
  conRepo({ base: REGISTRO, enPr: { 'x.md': '1\n' }, enMain: { 'y.md': '2\n' } }, (r) => {
    const v = decidir(gitReal(r.dir), { pr: ARMADO, cabeza: 'b'.repeat(40), main: r.main, mensaje: 'm' });
    assert.equal(v.accion, 'NO-PUDE-MIRAR', JSON.stringify(v));
  });
});

test('🔴 SUELO: unos atributos locales con driver de merge invalidan la medida', () => {
  conRepo({
    base: REGISTRO,
    enPr: { 'src/a.ts': 'export const a = 2;\n' },
    enMain: { 'src/a.ts': 'export const a = 3;\n' },
    infoAttributes: '* merge=union\n',
  }, (r) => {
    assert.equal(decide(r).accion, 'NO-PUDE-MIRAR');
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ EL WORKFLOW: lo que no puede hacer nunca
// ═════════════════════════════════════════════════════════════════════════════════════════

test('🔴 el workflow empuja sin forzar y solo con el veredicto EMPUJAR', () => {
  const wf = fs.readFileSync(path.join(RAIZ, '.github/workflows/conflicto-de-registro.yml'), 'utf8')
    .split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  const pushes = wf.split('\n').filter((l) => /\bgit\s+push\b/.test(l));
  assert.equal(pushes.length, 1, `🔴 se esperaba UN git push y hay ${pushes.length}`);
  assert.doesNotMatch(pushes[0], /--force|\s-f\b|\s\+|:\+|--mirror|--delete/,
    '🔴 el push del job fuerza o borra: sobre la rama de otra persona eso destruye trabajo');
  assert.match(wf, /conflicto-de-registro\.mjs/, '🔴 el workflow no llama a la decisión');
  assert.match(wf, /create-github-app-token/,
    '🔴 sin la llave de la App el push no dispara CI (medido #1212) y el PR queda enterrado');
});
