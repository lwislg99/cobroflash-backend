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
// SCRUM-662: la POBLACIÓN (quiénes) se declara en un solo sitio, para que este guard y el de
// SCRUM-417 no puedan discrepar sobre ella.
import { contrastarScripts } from './_banco-vistas.mjs';
// SCRUM-670: y el EXTRACTOR también es uno solo. Este guard tenía el suyo «porque necesita el
// orden y la posición» — y con él veía 0 ante un `<script src="./js/x.js" defer>`, mientras el
// guard del shell lo veía y lo exigía en `sw.js`. El orden no se pierde: `scriptsDeLaPagina`
// devuelve la lista EN SU ORDEN, que es lo único que este guard necesitaba de verdad.
import { scriptsDeLaPagina, rutaDelDashboard, cegueraDelExtractor } from './_scripts-de-la-pagina.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const DIR_JS = path.join(RAIZ, 'public', 'dashboard', 'js');
const INDEX = path.join(RAIZ, 'public', 'dashboard', 'index.html');

// Suelo holgado: el total exacto ya lo impone `SCRIPTS_DEL_DASHBOARD` (SCRUM-662) y repetirlo
// aquí sería volver a tener dos sitios que pueden divergir.
const MINIMO = 45;

/**
 * Los scripts del index EN ORDEN de carga, con el nombre pelado (`api.js`).
 *
 * 🔴 SÓLO LOS CLÁSICOS, y es la premisa entera de este fichero: un `type="module"` **no comparte
 * ámbito global**, así que dos módulos pueden declarar el mismo nombre sin chocar. Meterlos aquí
 * convertiría este guard en un generador de rojos sobre código correcto — y un guard que acusa en
 * falso no se corrige: se desactiva. Hoy no hay ninguno, y `scrum670` lo vigila.
 */
function ordenDeCarga(raiz) {
  return scriptsDeLaPagina(fs.readFileSync(path.join(raiz, 'public/dashboard/index.html'), 'utf8'))
    .clasicos.map((s) => rutaDelDashboard(s).replace(/^js\//, ''));
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
  return ordenDeCarga(RAIZ).map((f) => ({ fichero: f, codigo: fs.readFileSync(path.join(DIR_JS, f), 'utf8') }));
}

// ── 1 · SUELO: que el detector tenga algo que mirar ──────────────────────────────────────
// Si la extracción del index deja de casar, la lista sale vacía y el guard pasaría en verde sin
// haber leído un solo fichero. Verde hueco.
test('guard-colisión · el orden de carga se lee del index y no está vacío', () => {
  // SCRUM-670 · antes que nada, que el extractor no esté ciego NI callándose una forma que no
  // sabe leer. Sin esto, lo de abajo compararía dos conjuntos vacíos y saldría verde.
  const ceguera = cegueraDelExtractor(
    scriptsDeLaPagina(fs.readFileSync(INDEX, 'utf8')), MINIMO, 'dashboard/index.html');
  assert.equal(ceguera, null, String(ceguera));

  const scripts = scriptsDelDashboard();
  // SCRUM-559: era `>= 25` sobre una población de 60 — 35 de holgura, más de la mitad. Medido:
  // quitar UNA etiqueta (60 → 59) dejaba este guard Y el de SCRUM-417 en verde, con ese fichero
  // fuera de la vigilancia de los dos. El recuento es EXACTO y su número vive en un solo sitio,
  // `_banco-vistas.mjs`, para que dos guards de la misma población no puedan divergir.
  // SCRUM-662: y ese sitio único ya no guarda una CUENTA sino la LISTA — una cuenta no distingue
  // «tu script» de «mi script», y por eso dos ramas llegaron a escribir el mismo número por
  // scripts distintos.
  const c = contrastarScripts(scripts);
  assert.deepEqual([...c.sobran, ...c.faltan], [],
    '🔴 EL ÍNDICE Y LA LISTA DECLARADA NO COINCIDEN.\n\n'
    + (c.sobran.length ? `  SOBRAN en el índice: ${c.sobran.join(', ')}\n` : '')
    + (c.faltan.length ? `  FALTAN en el índice: ${c.faltan.join(', ')}\n` : '')
    + '\n  Si has añadido un script, añádelo a `SCRIPTS_DEL_DASHBOARD` en `tests/_banco-vistas.mjs`'
    + '\n  en ese mismo commit. Si FALTAN, o la extracción del orden está rota, o hay scripts que'
    + '\n  este guard ya no mira — y «cero colisiones» dejaría de significar nada.');
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
