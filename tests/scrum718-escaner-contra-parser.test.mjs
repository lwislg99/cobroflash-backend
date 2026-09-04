// tests/scrum718-escaner-contra-parser.test.mjs — SCRUM-718
//
// LA VÍCTIMA: el guard que dice «he mirado todos los comentarios» y ha mirado la mitad.
//
// `ts.createScanner` a pelo NO sabe si un `/` abre una expresión regular o divide: para eso hace
// falta contexto sintáctico, que sólo tiene el parser. En cuanto se desorienta, **deja de ver
// comentarios hasta el final del fichero**. Medido sobre `src/` y `public/` (344 ficheros):
//
//     escáner a pelo   13.122 comentarios
//     parser completo  21.056 comentarios
//     pierde            7.934  (37,7 %), y se pierde en 147 de los 344 ficheros
//
// En `public/dashboard/js/jobDetailView.js` ve **32 de 895**: se desorienta al 18 % del fichero.
//
// ── LO QUE COSTABA DE VERDAD ────────────────────────────────────────────────────────────────
// De los tres guards que usaban el escáner a pelo, dos buscan la marca «aprobado por el fundador»
// en comentarios. Con el escáner veían **40 de las 56** marcas y **12 de las 13** citas a
// documentos. Una cita invisible es una cita que el guard no puede comprobar aunque esté rota.
//
// ⛔ `tests/scrum387-procedencia-aprobacion.test.mjs` NO se toca: carril ajeno (regla 9). Se mide
// y se reporta. El que se migra aquí es `scrum709`, que es mío.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '..');

/** EL ESCÁNER A PELO, tal como estaba escrito en los tres usuarios. */
function comentariosEscaner(codigo) {
  const esc = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, codigo);
  const out = [];
  let k;
  while ((k = esc.scan()) !== ts.SyntaxKind.EndOfFileToken) {
    if (k === ts.SyntaxKind.SingleLineCommentTrivia || k === ts.SyntaxKind.MultiLineCommentTrivia) {
      out.push(esc.getTokenText());
    }
  }
  return out;
}

/** EL PARSER COMPLETO: tiene contexto, así que sabe distinguir una regex de una división. */
function comentariosParser(nombre, codigo) {
  const sf = ts.createSourceFile(nombre, codigo, ts.ScriptTarget.Latest, true);
  const r = new Map();
  const anota = (x) => { if (x) for (const y of x) r.set(y.pos + ':' + y.end, codigo.slice(y.pos, y.end)); };
  (function w(n) {
    anota(ts.getLeadingCommentRanges(codigo, n.getFullStart()));
    anota(ts.getTrailingCommentRanges(codigo, n.getEnd()));
    ts.forEachChild(n, w);
  })(sf);
  return [...r.values()];
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// EL PARSER, CONTRA EL HECHO — no contra el escáner al que sustituye
// ═══════════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 LA TRAMPA GEMELA: si el parser tuviera su PROPIO defecto, comparar «antes vs ahora» diría
// «de acuerdo» EN EL ERROR. Estas sondas se construyen desde el comportamiento que se quiere.

const SONDAS = Object.freeze([
  ['comentario de línea suelto', '// AGUJA\nconst a = 1;', true],
  ['comentario AL FINAL de una línea con código', 'const a = 1; // AGUJA', true],
  ['bloque multilínea', 'const a = 1;\n/* AGUJA\n   sigue */\nconst b = 2;', true],
  ['comentario tras una regex con barras', 'const re = /https:\\/\\//;\n// AGUJA\nconst b = 2;', true],
  ['comentario tras una división', 'const x = a / b;\n// AGUJA\nconst z = 1;', true],
  ['un // dentro de una cadena NO es comentario', 'const s = "no soy AGUJA //";\nconst b = 2;', false],
  ['un /* dentro de una cadena NO abre bloque', 'const s = "/* AGUJA */";\nconst b = 2;', false],
  ['una URL en una plantilla NO es comentario', 'const u = `https://x/AGUJA`;\nconst b = 2;', false],
  ['comentario al final del fichero', 'const a = 1;\n// AGUJA', true],
]);

test('SCRUM-718 · 🔴 el PARSER es correcto CONTRA EL HECHO, sonda a sonda', () => {
  const fallos = [];
  for (const [nombre, codigo, debeVerse] of SONDAS) {
    const visto = comentariosParser('sonda.ts', codigo).some((c) => c.includes('AGUJA'));
    if (visto !== debeVerse) fallos.push(`${nombre} → ${visto ? 'lo ve' : 'no lo ve'}`);
  }
  assert.deepEqual(fallos, [],
    '🔴 EL PARSER falla contra el hecho, así que migrar a él no arregla nada:\n    ' + fallos.join('\n    '));
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CASO QUE DISCRIMINA — y no cabe en una sonda pequeña
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-718 · 🔴 sobre un fichero REAL, el escáner ve muchos MENOS que el parser', () => {
  // Las nueve sondas de arriba las pasan LOS DOS mecanismos —comprobado—, así que no sirven para
  // probar que el cambio hacía falta. El desvío no se reproduce en un fragmento: necesita un
  // fichero de verdad, con su tamaño y su mezcla de barras. Éste es el caso, y es del árbol.
  const rel = 'public/dashboard/js/jobDetailView.js';
  const codigo = fs.readFileSync(path.join(RAIZ, rel), 'utf8');

  const conEscaner = comentariosEscaner(codigo).length;
  const conParser = comentariosParser('jobDetailView.js', codigo).length;

  // SUELO: si el parser viera poco, «el escáner ve menos» podría ser ruido de dos números chicos.
  assert.ok(conParser > 500,
    `🔴 CIEGO: el parser sólo ve ${conParser} comentarios en ${rel}, y había 895 medidos.`);

  assert.ok(conEscaner < conParser / 2,
    `🔴 EL CASO YA NO DISCRIMINA: escáner ${conEscaner} · parser ${conParser}. Si los dos ven lo `
    + 'mismo, esta prueba pasaría con los dos mecanismos y no probaría ninguno — y entonces habría '
    + 'que buscar otro fichero donde el escáner sí se desoriente, no borrar el control.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// EL CENSO DE USUARIOS — por AST, con su control positivo
// ═══════════════════════════════════════════════════════════════════════════════════════════

/** Quién llama a `ts.createScanner`. Por AST: un `grep` casaría la prosa que lo explica. */
function usuariosDelEscaner() {
  const out = [];
  for (const d of ['tests', 'scripts', 'src']) {
    const dir = path.join(RAIZ, d);
    if (!fs.existsSync(dir)) continue;
    (function andar(x) {
      for (const e of fs.readdirSync(x, { withFileTypes: true })) {
        const p = path.join(x, e.name);
        if (e.isDirectory()) { if (e.name !== 'node_modules') andar(p); continue; }
        if (!/\.(mjs|js|ts)$/.test(e.name)) continue;
        const codigo = fs.readFileSync(p, 'utf8');
        if (!codigo.includes('createScanner')) continue;
        let sf;
        try { sf = ts.createSourceFile(e.name, codigo, ts.ScriptTarget.Latest, true); } catch { continue; }
        let llamadas = 0;
        (function walk(n) {
          if (ts.isCallExpression(n) && /(^|\.)createScanner$/.test(n.expression.getText(sf))) llamadas++;
          ts.forEachChild(n, walk);
        })(sf);
        if (llamadas > 0) out.push(path.relative(RAIZ, p).split(path.sep).join('/'));
      }
    })(dir);
  }
  return out.sort();
}

// Medido el 4-sep-2026. `scrum387` es carril ajeno y se queda; `_solo-codigo` ya usa además el
// parser completo; `scrum709` se migró en este ticket y por eso YA NO está en la lista.
const USUARIOS_HOY = Object.freeze([
  'tests/_solo-codigo.mjs',
  'tests/scrum387-procedencia-aprobacion.test.mjs',
  'tests/scrum718-escaner-contra-parser.test.mjs',   // este fichero, que lo usa para CONTRASTAR
]);

test('SCRUM-718 · 🔴 SUELO + CONTROL POSITIVO: el censo encuentra a los que sabemos que están', () => {
  const hallados = usuariosDelEscaner();
  assert.ok(hallados.length > 0,
    '🔴 CIEGO: cero usuarios de `ts.createScanner`, y sabemos que hay al menos dos. El barrido está '
    + 'roto; no es que no haya usuarios.');
  assert.ok(hallados.includes('tests/scrum387-procedencia-aprobacion.test.mjs'),
    `🔴 BARRIDO ROTO: no encuentra scrum387, que sabemos que usa el escáner. Halló: ${hallados.join(', ')}`);
});

test('SCRUM-718 · el censo de usuarios no crece sin decirlo', () => {
  const hallados = usuariosDelEscaner();
  const nuevos = hallados.filter((h) => !USUARIOS_HOY.includes(h));
  assert.deepEqual(nuevos, [],
    `🔴 HAY USUARIOS NUEVOS de \`ts.createScanner\` a pelo: ${JSON.stringify(nuevos)}.\n`
    + '    Sin contexto no sabe si un `/` abre regex o divide, y pierde el 37,7 % de los comentarios '
    + 'del árbol. Se usa `ts.createSourceFile` + `getLeadingCommentRanges`, como este fichero.');

  const perdidos = USUARIOS_HOY.filter((u) => !hallados.includes(u));
  assert.deepEqual(perdidos, [],
    `✅ han bajado, que es la dirección buena: ${JSON.stringify(perdidos)} ya no usa el escáner. `
    + 'Actualiza `USUARIOS_HOY` en este mismo commit y anota cuál se migró.');
});
