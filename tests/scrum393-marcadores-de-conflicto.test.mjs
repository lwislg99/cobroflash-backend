// SCRUM-393 · NINGÚN MARCADOR DE CONFLICTO LLEGA A UN FICHERO PUBLICADO.
//
// Sin gate: lee el árbol y ya. Ni BD, ni red, ni navegador.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// DE DÓNDE SALE ESTE GUARD
//
// Resolviendo el conflicto de SCRUM-292 con SCRUM-386, `npm test` dio **exit 0 con dos marcadores
// vivos** en `public/dashboard/js/jobDetailView.js`. Ningún guard los vio. La suite entera puede
// pasar sobre un árbol en conflicto.
//
// ⚠️ Y EN `public/` EL JAVASCRIPT NO SE COMPILA. Un `<<<<<<<` en `src/` lo caza TypeScript al
// construir, y el fallo aparece en CI. En `public/` llega **al navegador del profesional** y rompe
// la pantalla en ejecución. Toda la disciplina de merge de la casa se apoya en «después de
// resolver, se vuelven a correr los rojos» — y esa regla **no protege de esto**, porque el verde
// llega igual con el conflicto dentro.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL FALSO POSITIVO QUE MATARÍA ESTE GUARD
//
// `=======` aparece **legítimamente** en Markdown: es el subrayado de un encabezado setext. Y en
// documentación que hable de conflictos — la entrada de este mismo ticket lo hace.
//
// Por eso NO se busca la cadena suelta: se exige la **forma completa** de un marcador de git —
// siete caracteres al PRINCIPIO de línea, un espacio, y algo detrás (la rama o el commit). Un guard
// que salta con documentación normal se acaba silenciando, y un guard silenciado no protege nada.
//
// ⚠️ AUTO-REFERENCIA: este fichero habla de marcadores, así que un guard de texto se cazaría a sí
// mismo. Los patrones se **componen en tiempo de ejecución** (`'<'.repeat(7)`), de modo que la
// forma completa no aparece escrita en ninguna parte del repo. Eso evita un ALLOWLIST — y una
// excepción que hay que mantener es una excepción que alguien acaba ampliando.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Los marcadores, COMPUESTOS. Ver la nota de auto-referencia de arriba.
const ABRE = '<'.repeat(7);
const CIERRA = '>'.repeat(7);
const SEPARA = '='.repeat(7);
/** `<<<<<<< rama` o `>>>>>>> rama` al principio de línea. La cadena suelta NO basta. */
const RX_MARCADOR = new RegExp(`^(${ABRE}|${CIERRA}) \\S`);

// ── EL ALCANCE, DERIVADO ────────────────────────────────────────────────────────────────
//
// No hay lista de directorios. Se recorre la raíz del repo y se entra en todo lo versionable
// EXCEPTO lo que no lo es. Una lista a mano deja fuera el próximo directorio que alguien cree — y
// el próximo directorio es exactamente donde nadie mira.
const FUERA = new Set(['.git', 'node_modules', 'dist', 'coverage', '.playwright-mcp', 'uploads']);
const EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.json', '.md', '.html', '.css', '.yml', '.yaml', '.sh', '.prisma', '.sql', '.txt']);

function ficheros(dir, acc = []) {
  let entradas;
  try { entradas = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entradas) {
    if (FUERA.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { ficheros(full, acc); continue; }
    if (EXT.has(path.extname(e.name).toLowerCase())) acc.push(full);
  }
  return acc;
}

/** Las líneas con forma de marcador en un texto. Devuelve `{ n, linea }`. */
function marcadoresEn(texto) {
  const out = [];
  const lineas = texto.split(/\r?\n/);
  for (let i = 0; i < lineas.length; i += 1) {
    if (RX_MARCADOR.test(lineas[i])) out.push({ n: i + 1, linea: lineas[i].slice(0, 60) });
  }
  return out;
}

const TODOS = ficheros(RAIZ);

// ── EL SUELO ────────────────────────────────────────────────────────────────────────────

test('SCRUM-393 · SUELO: el escáner encuentra ficheros que revisar', () => {
  assert.ok(
    TODOS.length >= 200,
    `🔴 ESCÁNER CIEGO: solo ${TODOS.length} ficheros. «Ningún marcador» y «no supe mirar» son el ` +
      'mismo verde y significan lo contrario.',
  );
  // Y que la derivación entra de verdad en los sitios que importan, sin que estén escritos como
  // lista: se comprueba que hay ficheros bajo cada uno.
  for (const zona of ['public', 'src', 'tests', 'docs', 'scripts']) {
    const n = TODOS.filter((f) => path.relative(RAIZ, f).replace(/\\/g, '/').startsWith(zona + '/')).length;
    assert.ok(n > 0, `🔴 ESCÁNER CIEGO: la derivación no ve ningún fichero en \`${zona}/\``);
  }
  // El caso que motivó el ticket: `public/` no se compila, así que es donde un marcador llega al
  // navegador. Si dejara de barrerse, el guard perdería su motivo.
  assert.ok(
    TODOS.some((f) => f.endsWith(path.join('public', 'dashboard', 'js', 'jobDetailView.js'))),
    '🔴 ESCÁNER CIEGO: no se barre el fichero exacto donde ocurrió el caso que originó este guard.',
  );
});

// ── EL GUARD ────────────────────────────────────────────────────────────────────────────

test('SCRUM-393 · ningún fichero del repo contiene un marcador de conflicto', () => {
  const sucios = [];
  for (const f of TODOS) {
    let txt;
    try { txt = fs.readFileSync(f, 'utf8'); } catch { continue; }
    for (const m of marcadoresEn(txt)) {
      sucios.push(`${path.relative(RAIZ, f).replace(/\\/g, '/')}:${m.n}  ${m.linea}`);
    }
  }
  assert.deepEqual(
    sucios, [],
    '🔴 HAY MARCADORES DE CONFLICTO EN EL ÁRBOL:\n\n' + sucios.map((s) => '    ' + s).join('\n') +
      '\n\n  Un merge quedó a medias. En `src/` esto lo cazaría el compilador; en `public/` NO se\n' +
      '  compila nada, así que llegaría al navegador del profesional y rompería la pantalla en\n' +
      '  ejecución — no en CI, donde todavía se puede arreglar barato.',
  );
});

// ── LOS CONTROLES ───────────────────────────────────────────────────────────────────────

test('SCRUM-393 · CONTROL NEGATIVO: un marcador real se detecta, con su línea', () => {
  const conflicto = [
    'const a = 1;',
    `${ABRE} HEAD`,
    'const b = 2;',
    SEPARA,
    'const b = 3;',
    `${CIERRA} origin/main`,
    'const c = 4;',
  ].join('\n');

  const hallados = marcadoresEn(conflicto);
  assert.equal(hallados.length, 2, `🔴 se detectan ${hallados.length} marcadores y hay 2 (apertura y cierre)`);
  assert.deepEqual(hallados.map((h) => h.n), [2, 6], '🔴 las líneas no se nombran bien');
});

test('SCRUM-393 · CONTROL POSITIVO ①: el árbol de hoy pasa', () => {
  // Si el guard saltara con el repo limpio, sería ruido desde el primer día — y el ruido se aprende
  // a ignorar justo antes de que el aviso importe.
  const sucios = TODOS.filter((f) => {
    try { return marcadoresEn(fs.readFileSync(f, 'utf8')).length > 0; } catch { return false; }
  });
  assert.deepEqual(sucios, [], '🔴 el guard salta con el árbol limpio');
});

test('SCRUM-393 · CONTROL POSITIVO ②: un Markdown normal NO hace saltar el guard', () => {
  // ⚠️ EL FALSO POSITIVO QUE MATARÍA ESTE GUARD. `=======` es el subrayado de un encabezado setext
  // en Markdown, y aparece también en cualquier documento que HABLE de conflictos —como la entrada
  // de este ticket—. Buscar la cadena suelta habría hecho saltar el guard con documentación normal,
  // y un guard que salta con documentación normal se acaba silenciando.
  const legitimo = [
    'Título con subrayado setext',
    SEPARA,
    '',
    'Un párrafo que menciona los marcadores de conflicto de git en línea:',
    `\`${ABRE}\`, \`${SEPARA}\` y \`${CIERRA}\`.`,
    '',
    '```',
    'Y hasta en un bloque de código, mientras no abran línea con su rama detrás.',
    '```',
    '',
    SEPARA + '==',   // una regla horizontal más larga
    `${ABRE}sin espacio ni rama`,
  ].join('\n');

  assert.deepEqual(
    marcadoresEn(legitimo), [],
    '🔴 el guard salta con Markdown legítimo: subrayado setext, marcadores citados en línea o una ' +
      'regla horizontal. Con eso, el primer documento que hable de merges lo silencia.',
  );

  // Y el contraste, para que lo de arriba no pase por no detectar nunca: la MISMA cadena, pero con
  // la forma completa de marcador, sí salta.
  assert.equal(
    marcadoresEn(`${ABRE} HEAD`).length, 1,
    '🔴 ESCÁNER CIEGO: la forma completa tampoco se detecta — entonces el control de arriba pasaba ' +
      'porque el detector no detecta nada, no porque discrimine.',
  );
});

test('SCRUM-393 · la forma exigida es la COMPLETA, no la cadena suelta', () => {
  // Tabla explícita de lo que sí y lo que no, para que el criterio esté escrito y no deducido.
  const saltan = [`${ABRE} HEAD`, `${CIERRA} origin/main`, `${ABRE} rama/con-barra`, `${CIERRA} 12adc4a`];
  const noSaltan = [
    SEPARA,                          // subrayado setext
    `${SEPARA}==`,                   // regla horizontal
    `  ${ABRE} HEAD`,                // sangrado: no abre línea
    `texto ${ABRE} HEAD`,            // en medio de una frase
    `${ABRE}`,                       // sin espacio ni rama
    `${ABRE} `,                      // espacio pero nada detrás
    '<<<<<< HEAD',                   // seis, no siete
  ];
  for (const s of saltan) assert.equal(marcadoresEn(s).length, 1, `🔴 NO salta con «${s}» y debería`);
  for (const s of noSaltan) assert.equal(marcadoresEn(s).length, 0, `🔴 salta con «${s}» y no debería`);
});
