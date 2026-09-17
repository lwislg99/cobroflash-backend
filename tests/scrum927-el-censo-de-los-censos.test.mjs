// tests/scrum927-el-censo-de-los-censos.test.mjs — SCRUM-927
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⚠️ ESTO **NO ES UN TRINQUETE**, Y LA DISTINCIÓN ES EL ENCARGO ENTERO
//
// SCRUM-927 dice, por escrito: *mide y propone; no conviertas ningún censo en guard en este
// ticket*. Así que este fichero **no afirma nada sobre el árbol de verdad**: no exige que las
// mediciones dormidas bajen, ni que las excepciones aparcadas encojan. Si alguien mañana quiere
// ese trinquete, la propuesta con su criterio está en `docs/master/SCRUM-927.md` §4.
//
// Lo que sí hace es lo que esta casa le exige a cualquier instrumento (SCRUM-846): ponerle
// delante un CASO CONOCIDO, fabricado, cuya respuesta se sabe de antemano — en los dos sentidos.
// Sin eso, el 42% que publica el registro no se podría distinguir de un detector roto.
//
//     🔒 Un cero sin un caso conocido delante no se puede juzgar. Y un 42%, tampoco.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { temporal } from './_temporal.mjs';
import { analizaFuente, censarCensos, censarExcepciones, motivosParaNoFiarse } from '../scripts/_censo-de-censos.mjs';

const NL = '\n';

/** Un árbol de mentira que se borra solo (SCRUM-864c: nada de `mkdtempSync` suelto). */
function arbolDeMentira(ficheros) {
  const raiz = temporal('scrum927-');
  for (const [rel, texto] of Object.entries(ficheros)) {
    const abs = path.join(raiz, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, texto);
  }
  return raiz;
}

// ═══ ① ¿QUÉ ES UNA MEDICIÓN? · por lo que hace, no por cómo se llama ═════════════════════════

test('SCRUM-927 · 🔴 ① CASO CONOCIDO: distingue una medición de una herramienta, y no se guía por el nombre', () => {
  const mide = analizaFuente('cualquiera.mjs', [
    "import fs from 'node:fs';",
    "const f = fs.readdirSync('src');",
    'console.log(f.filter((x) => x.endsWith(".ts")).length);',
  ].join(NL));
  assert.equal(mide.mide, true, '🔴 no reconoce una medición evidente: lee el árbol y publica un recuento.');

  // 🔴 LA MITAD QUE IMPORTA: el nombre no decide. Éste se llama «censo» y NO mide.
  const nombreEnganoso = analizaFuente('censo-de-mentira.mjs', [
    "console.log('el censo dice hola');",
  ].join(NL));
  assert.equal(nombreEnganoso.mide, false,
    '🔴 cuenta como medición un fichero que sólo IMPRIME UN RÓTULO y se llama «censo». '
    + 'Si el detector se guía por el nombre, el número del registro no mide lo que dice.');

  // Y al revés: mide de verdad aunque no se llame así.
  const sinNombre = analizaFuente('trastos.mjs', [
    "import fs from 'node:fs';",
    "const t = fs.readFileSync('a.ts', 'utf8');",
    "console.log(t.split('\\n').length);",
  ].join(NL));
  assert.equal(sinNombre.mide, true, '🔴 no ve una medición porque el fichero no se llama «censo».');

  // Una HERRAMIENTA lee y agrega igual, pero su producto es un CAMBIO.
  const herramienta = analizaFuente('backup.mjs', [
    "import fs from 'node:fs';",
    "import { execFileSync } from 'node:child_process';",
    "const f = fs.readdirSync('.');",
    "execFileSync('pg_dump', ['-f', f[0]]);",
  ].join(NL));
  assert.equal(herramienta.mide, false,
    '🔴 cuenta un backup como «medición dormida». Las herramientas no se espera que corran solas: '
    + 'meterlas dentro infla el titular con ficheros que no son el defecto.');
});

// ═══ ② ¿LO EJECUTA ALGO? · alcanzabilidad, no mención ════════════════════════════════════════

test('SCRUM-927 · 🔴 ② CASO CONOCIDO: un fichero que te NOMBRA no te EJECUTA', () => {
  const raiz = arbolDeMentira({
    'package.json': JSON.stringify({ scripts: { test: 'node --test tests/*.test.mjs' } }),
    // La que SÍ se ejecuta: un test la importa.
    'scripts/_vivo.mjs': "import fs from 'node:fs';\nexport const v = () => fs.readdirSync('.').length;",
    'tests/algo.test.mjs': "import { v } from '../scripts/_vivo.mjs';\nv();",
    // La que NO: otro fichero la NOMBRA en un comentario, que es lo que pasaba de verdad.
    'scripts/_dormido.mjs': "import fs from 'node:fs';\nconsole.log(fs.readdirSync('.').length);",
    'tests/otro.test.mjs': "// aquí se explica por qué existe scripts/_dormido.mjs y no se usa\nconst x = 1;",
  });
  const c = censarCensos(raiz);
  const de = (f) => c.filas.find((x) => x.fichero === f);

  assert.equal(de('scripts/_vivo.mjs')?.ejecutadoPor, 'TANDA',
    '🔴 no ve la arista real: un test lo IMPORTA y aun así sale sin ejecutar.');
  assert.equal(de('scripts/_dormido.mjs')?.ejecutadoPor, null,
    '🔴 CUENTA UNA MENCIÓN COMO EJECUCIÓN. Es el defecto que este ticket mide, cometido por el '
    + 'instrumento que lo mide: pasó de verdad, y lo cazó el control positivo sobre `censo-mkdtemp.mjs`.');

  // Y una cadena muerta entera sigue muerta: A lanza a B, pero a A no lo lanza nadie.
  const raiz2 = arbolDeMentira({
    'package.json': '{}',
    'scripts/_a.mjs': "import { spawnSync } from 'node:child_process';\nimport fs from 'node:fs';\nfs.readdirSync('.');\nspawnSync('node', ['scripts/_b.mjs']);",
    'scripts/_b.mjs': "import fs from 'node:fs';\nconsole.log(fs.readdirSync('.').length);",
  });
  const c2 = censarCensos(raiz2);
  assert.equal(c2.filas.find((x) => x.fichero === 'scripts/_b.mjs')?.ejecutadoPor, null,
    '🔴 da por vivo a `_b` porque `_a` lo lanza — pero a `_a` no lo lanza nadie. Una cadena '
    + 'muerta entera no resucita por tener eslabones.');
});

// ═══ ③ EXCEPCIONES: vigilada, sólo avisa, aparcada ═══════════════════════════════════════════

test('SCRUM-927 · 🔴 ③ CASO CONOCIDO: separa la excepción VIGILADA de la que SÓLO AVISA y de la APARCADA', () => {
  const raiz = arbolDeMentira({
    'package.json': '{}',
    'tests/vigilada.test.mjs': [
      "import assert from 'node:assert/strict';",
      "const EXCLUIDOS_CONOCIDOS = ['a', 'b'];",
      'assert.equal(EXCLUIDOS_CONOCIDOS.length, 2);',
    ].join(NL),
    'tests/avisa.test.mjs': [
      "const IGNORA_CONOCIDOS = ['a', 'b', 'c'];",
      'console.log(IGNORA_CONOCIDOS.length);',
    ].join(NL),
    'tests/aparcada.test.mjs': [
      "const EXCLUIDAS_SIEMPRE = ['a', 'b', 'c', 'd'];",
      "const todo = ['a', 'z'];",
      'const r = todo.filter((x) => !EXCLUIDAS_SIEMPRE.includes(x));',
      'r.length;',
    ].join(NL),
  });
  const e = censarExcepciones(raiz);
  const clase = (n) => {
    const l = e.listas.find((x) => x.nombre === n);
    if (!l) return 'NO LA VE';
    return l.vigilada ? 'VIGILADA' : l.soloAvisa ? 'SOLO_AVISA' : 'APARCADA';
  };
  assert.equal(clase('EXCLUIDOS_CONOCIDOS'), 'VIGILADA', '🔴 no reconoce una lista con `assert` encima.');
  assert.equal(clase('IGNORA_CONOCIDOS'), 'SOLO_AVISA',
    '🔴 confunde un `console.log` con una vigilancia. Es LA distinción de este ticket: un aviso '
    + 'dentro de una tanda de 7.390 tests no lo lee nadie. Contar no es avisar.');
  assert.equal(clase('EXCLUIDAS_SIEMPRE'), 'APARCADA', '🔴 no ve una lista que sólo sirve para excluir.');
});

// ═══ ④ EL SUELO ══════════════════════════════════════════════════════════════════════════════

test('SCRUM-927 · ④ SUELO: sobre un árbol sin nada que medir, el censo dice CIEGO en vez de «está limpio»', () => {
  const vacio = arbolDeMentira({ 'package.json': '{}' });
  const c = censarCensos(vacio);
  assert.ok(motivosParaNoFiarse(c).length > 0,
    '🔴 un árbol sin una sola medición devuelve «0 dormidas» sin avisar de que no ha mirado nada. '
    + 'Cero no es «está limpio»: es «no he mirado».');
});
