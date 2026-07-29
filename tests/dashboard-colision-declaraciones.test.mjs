// GUARD · DOS SCRIPTS DEL DASHBOARD NO PUEDEN DECLARAR EL MISMO NOMBRE ARRIBA DEL TODO.
//
// NACE DE UNA REGRESIÓN REAL (SCRUM-210, arreglada en fix-copyrojo-colision). Al mover
// `copyRojo` a `api.js` quedó en `invoicesView.js` un puente `const copyRojo = window.copyRojo;`.
// Los scripts del dashboard son CLÁSICOS y comparten ámbito global: `api.js` declaraba
// `function copyRojo` (global var-scoped) y el `const` del otro script chocó con ella.
//
// LO QUE HACE ESTE FALLO PELIGROSO, y por qué merece guard propio:
//   · Es SyntaxError EN PARSEO, no en ejecución: no corre NI UNA LÍNEA del fichero. Se pierde
//     la vista entera, no una función.
//   · **El servidor no se entera.** No hay 500, no hay log, no hay test de backend que lo note.
//     La suite entera puede estar verde con una pantalla muerta en producción.
//   · No hace falta equivocarse mucho: basta mover una función a un fichero compartido, que es
//     exactamente lo que se pide hacer para no duplicar código.
//
// ⚠️ AST, no `grep`. El comentario de arriba contiene el literal prohibido; con búsqueda de
// texto este fichero se cazaría a sí mismo (SCRUM-176/168, `_guard-texto.mjs`). El árbol solo
// ve declaraciones reales.
//
// Se parsea EN EL ORDEN DEL `index.html`, no en orden alfabético: el choque depende de quién
// carga antes, así que el orden es parte del sujeto.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const DIR_JS = path.join(RAIZ, 'public', 'dashboard', 'js');
const INDEX = path.join(RAIZ, 'public', 'dashboard', 'index.html');

/** Los `<script src="./js/X.js">` del index, EN ORDEN de carga. */
function ordenDeCarga(html) {
  return [...html.matchAll(/<script src="\.\/js\/([^"]+)"><\/script>/g)].map((m) => m[1]);
}

/**
 * Declaraciones de NIVEL SUPERIOR de un script clásico, separadas por naturaleza:
 *  · léxicas (`const`/`let`/`class`) — chocan con cualquier otra del mismo nombre.
 *  · var-scoped (`var`/`function`) — se pueden repetir entre sí (la última gana), pero chocan
 *    con una léxica. Esa asimetría es la del motor, y es la que hizo caer `invoicesView.js`.
 */
function declaracionesDe(codigo, ruta) {
  const sf = ts.createSourceFile(ruta, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const lexicas = [];
  const varScoped = [];
  for (const st of sf.statements) {
    if (ts.isVariableStatement(st)) {
      const esLexica = (st.declarationList.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const)) !== 0;
      for (const d of st.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) (esLexica ? lexicas : varScoped).push(d.name.text);
      }
    } else if (ts.isFunctionDeclaration(st) && st.name) {
      varScoped.push(st.name.text);
    } else if (ts.isClassDeclaration(st) && st.name) {
      lexicas.push(st.name.text);
    }
  }
  return { lexicas, varScoped };
}

/** Recorre los scripts en orden y devuelve los choques que el motor lanzaría. */
export function choquesEntre(scripts) {
  const vistoLexico = new Map();
  const vistoVar = new Map();
  const choques = [];
  for (const { fichero, codigo } of scripts) {
    const { lexicas, varScoped } = declaracionesDe(codigo, fichero);
    for (const n of lexicas) {
      const previo = vistoLexico.get(n) ?? vistoVar.get(n);
      if (previo) choques.push(`${n}: declarado en ${previo}, re-declarado (léxico) en ${fichero}`);
      vistoLexico.set(n, fichero);
    }
    for (const n of varScoped) {
      // var/function repetidos entre sí NO son error; solo si ya hay una léxica con ese nombre.
      const previo = vistoLexico.get(n);
      if (previo) choques.push(`${n}: léxico en ${previo}, redeclarado (var/function) en ${fichero}`);
      vistoVar.set(n, fichero);
    }
  }
  return choques;
}

function scriptsDelDashboard() {
  const orden = ordenDeCarga(fs.readFileSync(INDEX, 'utf8'));
  return orden.map((f) => ({ fichero: f, codigo: fs.readFileSync(path.join(DIR_JS, f), 'utf8') }));
}

// ── 1 · SUELO: que el detector tenga algo que mirar ──────────────────────────────────────
// Si la regex del index deja de casar (cambia el formato del <script>), la lista sale vacía y
// el guard pasaría en verde sin haber leído un solo fichero. Verde hueco.
test('guard-colisión · el orden de carga se lee del index y no está vacío', () => {
  const scripts = scriptsDelDashboard();
  assert.ok(scripts.length >= 25,
    `🔴 solo se leyeron ${scripts.length} scripts del index: la extracción del orden está rota`);
  assert.equal(scripts[0].fichero, 'api.js', 'api.js debe seguir cargando primero');
});

// ── 2 · QUE EL DETECTOR DETECTA (probado sobre fuentes sintéticas, no sobre el repo) ──────
// Sin esto, «0 choques» no dice si el repo está limpio o si el detector está ciego.
test('guard-colisión · detecta const-tras-function (el caso que rompió invoicesView)', () => {
  const c = choquesEntre([
    { fichero: 'a.js', codigo: 'function saludo() {}' },
    { fichero: 'b.js', codigo: 'const saludo = window.saludo;' },
  ]);
  assert.equal(c.length, 1);
  assert.match(c[0], /saludo.*a\.js.*b\.js/);
});

test('guard-colisión · detecta const-tras-const, y NO marca function-tras-function', () => {
  assert.equal(choquesEntre([
    { fichero: 'a.js', codigo: 'const CONFIG = 1;' },
    { fichero: 'b.js', codigo: 'const CONFIG = 2;' },
  ]).length, 1);

  // Dos `function` con el mismo nombre son legales entre scripts clásicos: la última gana.
  // Marcarlas sería un rojo permanente sobre código que funciona.
  assert.deepEqual(choquesEntre([
    { fichero: 'a.js', codigo: 'function fmt() {}' },
    { fichero: 'b.js', codigo: 'function fmt() {}' },
  ]), []);
});

test('guard-colisión · un nombre dentro de un COMENTARIO no cuenta', () => {
  assert.deepEqual(choquesEntre([
    { fichero: 'a.js', codigo: 'const x = 1;' },
    { fichero: 'b.js', codigo: '// ojo: no declares const x aquí\nconst y = 2;' },
  ]), []);
});

test('guard-colisión · lo anidado no cuenta: solo el nivel superior comparte ámbito', () => {
  assert.deepEqual(choquesEntre([
    { fichero: 'a.js', codigo: 'const dup = 1;' },
    { fichero: 'b.js', codigo: 'function f() { const dup = 2; }' },
  ]), []);
});

// ── 3 · EL GUARD ─────────────────────────────────────────────────────────────────────────
test('guard-colisión · ningún par de scripts del dashboard choca al declarar', () => {
  const choques = choquesEntre(scriptsDelDashboard());
  assert.deepEqual(
    choques, [],
    '🔴 dos scripts del dashboard declaran el mismo nombre en el nivel superior:\n   '
    + choques.join('\n   ')
    + '\n\n   Eso es SyntaxError EN PARSEO: el segundo fichero NO se ejecuta entero y su pantalla'
    + '\n   desaparece, sin 500 ni log en el servidor. Pasó con `copyRojo` (SCRUM-210).'
    + '\n   Arreglo: no hace falta puente — si el símbolo ya es global, se usa directamente.',
  );
});
