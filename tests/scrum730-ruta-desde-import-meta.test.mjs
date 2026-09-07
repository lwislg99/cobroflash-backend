// tests/scrum730-ruta-desde-import-meta.test.mjs — SCRUM-730
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// UNA RUTA CON UN ESPACIO NO ES UN CASO RARO: ES DONDE TRABAJA LA GENTE.
//
// `scrum176b:117` resolvía su propia ruta así:
//
//     path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
//
// `pathname` devuelve la ruta PERCENT-CODIFICADA. En `C:\Users\Javier Pereira\…` el espacio
// llega como `%20`, así que se buscaba un directorio llamado `Javier%20Pereira`, que no existe,
// y el `readFileSync` moría con ENOENT.
//
// 🔴 LO CARO NO ERA EL MINUTO. En CI la ruta del runner no lleva espacios, así que pasaba en
// VERDE: el instrumento se comportaba distinto según dónde corriera, y fallaba justo en las seis
// copias de trabajo de esta máquina. Seis sesiones entregando con `fail 1` NORMALIZAN UN ROJO
// AJENO en la tanda — y a una sesión acostumbrada a decir «ese fallo no es mío» se le cuela un
// fallo propio dentro de la misma frase.
//
// Y había una segunda cara, que sólo se vio al arreglarlo: mientras moría en el ENOENT, ese test
// NO VIGILABA NADA. Su control —que la lista de banderas exentas no crezca sola— no llegaba a
// ejecutarse en ninguna ruta con espacio. El arreglo no sólo apaga un rojo: DEVUELVE la
// detección. Comprobado rompiendo la lista a propósito y viéndolo caer.
//
// ── LO QUE VIGILA ESTE FICHERO ──────────────────────────────────────────────────────────────
// Que nadie vuelva a construir una ruta de sistema a partir de `import.meta.url` sin decodificar.
// El idioma correcto —y el que usa el resto de la casa— es `fileURLToPath()`.
//
// 🔴 SE CUENTA POR LO QUE EL CÓDIGO HACE, NO POR EL NOMBRE. El censo es por AST: busca el ACCESO
// a `.pathname` sobre un `new URL(...)` que lleve dentro `import.meta.url`, y la manipulación
// TEXTUAL de esa URL (`.replace`, `.slice`, `.substring`). Contar por subcadena habría dado dos
// errores en direcciones opuestas: un `.pathname` de una URL de red es legítimo y saldría como
// falso positivo, y un `new URL(...)` guardado en una variable no lleva el texto al lado.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.dirname(fileURLToPath(import.meta.url)) + path.sep + '..';

/**
 * Dónde mira el censo. Es el código DE LA CASA.
 *
 * `.claude/skills/` y `.agents/` quedan FUERA a propósito y se dice: son skills de terceros
 * (`impeccable` es de Anthropic), no las escribe nadie de aquí y no se pueden arreglar desde este
 * repositorio. Meterlas subiría el número sin que nadie pudiera bajarlo — un censo con deuda que
 * no es tuya deja de leerse.
 */
const CARPETAS = ['tests', 'scripts', 'src', 'public', '.claude/hooks'];
const EXTS = new Set(['.mjs', '.js', '.ts', '.cjs']);

function ficheros(dir, acc = []) {
  const abs = path.join(RAIZ, dir);
  if (!fs.existsSync(abs)) return acc;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = dir + '/' + e.name;
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git') continue;
      ficheros(rel, acc);
    } else if (EXTS.has(path.extname(e.name))) {
      acc.push(rel);
    }
  }
  return acc;
}

/** ¿Este nodo es `import.meta.url`? */
function esImportMetaUrl(n) {
  return ts.isPropertyAccessExpression(n)
    && n.name.text === 'url'
    && ts.isMetaProperty(n.expression)
    && n.expression.name.text === 'meta';
}

/** ¿En algún sitio de este subárbol aparece `import.meta.url`? */
function llevaImportMetaUrl(n) {
  if (esImportMetaUrl(n)) return true;
  let si = false;
  ts.forEachChild(n, (h) => { if (!si && llevaImportMetaUrl(h)) si = true; });
  return si;
}

/**
 * Los sitios que convierten `import.meta.url` en ruta SIN decodificar. Devuelve `{linea, idioma}`.
 *
 * Dos formas, y las dos por lo que HACEN:
 *   · `.pathname` sobre un `new URL(...)` que lleva `import.meta.url` dentro.
 *   · un método de texto (`replace`/`slice`/`substring`/`split`) aplicado DIRECTAMENTE sobre
 *     `import.meta.url`: recortar la URL a mano deja el percent-encoding igual que `pathname`.
 */
export function rutasSinDecodificar(codigo, nombre) {
  const sf = ts.createSourceFile(nombre, codigo, ts.ScriptTarget.Latest, true,
    /\.ts$/.test(nombre) ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  const out = [];
  const linea = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

  const v = (n) => {
    if (ts.isPropertyAccessExpression(n)) {
      const base = n.expression;
      if (n.name.text === 'pathname' && ts.isNewExpression(base)
          && ts.isIdentifier(base.expression) && base.expression.text === 'URL'
          && (base.arguments || []).some(llevaImportMetaUrl)) {
        out.push({ linea: linea(n), idioma: 'new URL(import.meta.url).pathname' });
      }
      if (['replace', 'slice', 'substring', 'substr', 'split'].includes(n.name.text)
          && esImportMetaUrl(base)) {
        out.push({ linea: linea(n), idioma: 'import.meta.url.' + n.name.text + '(…)' });
      }
    }
    ts.forEachChild(n, v);
  };
  v(sf);
  return out;
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO · el detector tiene que saber encontrar, y tiene que saber decir que NO
// ═════════════════════════════════════════════════════════════════════════════════════════

// 🔴 El suelo NO puede depender del defecto que este ticket arregla: en cuanto se arregla,
// desaparece del árbol y el suelo se quedaría sin caso. Así que se le da al detector el código
// EXACTO que tenía `scrum176b:117` antes del arreglo, escrito aquí, y tiene que cazarlo.
const DEFECTO_ORIGINAL =
  "const AQUI = path.dirname(new URL(import.meta.url).pathname.replace(/^\\/([A-Za-z]:)/, '$1'));";

test('SCRUM-730 · SUELO: el detector caza el defecto original de `scrum176b:117`', () => {
  const h = rutasSinDecodificar(DEFECTO_ORIGINAL, 'suelo.mjs');
  assert.equal(h.length, 1,
    '🔴 CIEGO: el detector NO encuentra el defecto que motivó el ticket. Cualquier «0 sitios» de '
    + 'abajo significaría «no supe mirar», que se lee igual que «no hay ninguno».');
  assert.equal(h[0].idioma, 'new URL(import.meta.url).pathname');

  // Y la otra forma: recortar la URL a mano deja el `%20` igual de crudo.
  const aMano = "const p = import.meta.url.replace('file:///', '');";
  assert.equal(rutasSinDecodificar(aMano, 'suelo2.mjs').length, 1,
    '🔴 el detector no ve la manipulación textual de la URL.');
});

test('SCRUM-730 · 🔴 CONTROL NEGATIVO: el idioma CORRECTO no se acusa', () => {
  // Si esto saltara, el guard obligaría a «arreglar» lo que ya está bien, y alguien lo apagaría.
  const bueno = [
    "const AQUI = path.dirname(fileURLToPath(import.meta.url));",
    "const RAIZ = fileURLToPath(new URL('..', import.meta.url));",
    // `.pathname` de una URL que NO es `import.meta.url` es legítimo: aquí se mide una de red.
    "const ruta = new URL('https://yaqu.app/a b').pathname;",
    // Pasar la URL entera a `fs` es correcto: Node la decodifica él.
    "fs.readFileSync(new URL('./x.json', import.meta.url), 'utf8');",
    // Y comparar la URL como TEXTO no construye ninguna ruta.
    "if (process.argv[1] === fileURLToPath(import.meta.url)) main();",
  ].join('\n');
  const h = rutasSinDecodificar(bueno, 'bueno.mjs');
  assert.deepEqual(h, [],
    '🔴 FALSO POSITIVO: el detector acusa al idioma correcto.\n'
    + h.map((x) => `   · línea ${x.linea}: ${x.idioma}`).join('\n'));
});

test('SCRUM-730 · SUELO: el censo mira un corpus de verdad', () => {
  const todos = CARPETAS.flatMap((c) => ficheros(c));
  // Un barrido que se quede sin ficheros daría «cero defectos» por no haber mirado nada.
  assert.ok(todos.length >= 300,
    `🔴 CIEGO: sólo veo ${todos.length} ficheros en ${CARPETAS.join(', ')}. El barrido dejó de `
    + 'encontrar el corpus y su verde no significaría nada.');

  // Y el corpus contiene de verdad el fichero del que nació esto.
  assert.ok(todos.includes('tests/scrum176b-force-por-identidad.test.mjs'),
    '🔴 CIEGO: el barrido no llega al fichero que motivó el ticket.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL CENSO · y el trinquete
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * CENSO MEDIDO el 4-sep-2026 sobre `origin/main` = ac282d5553f17072ab2281244e5a3d853fdd176a.
 *
 * 🔴 SON DOS, NO UNO — y por eso el censo se hace y no se hereda. La medición de partida decía
 * «361 usan `fileURLToPath` y éste es el único que no». Al contarlo por AST aparece un SEGUNDO
 * sitio con el MISMO idioma.
 *
 * POBLACIÓN, contada y no estimada: 1.194 ficheros — `tests/` 731, `src/` 266, `scripts/` 113,
 * `public/` 83 y `.claude/hooks/` 1.
 *
 * ⚠️ LA DIFERENCIA ENTRE LOS DOS ES QUE UNO MUERDE Y EL OTRO NO, y hay que decirla porque explica
 * por qué sólo uno se arregla aquí:
 *
 *   · `scrum176b:117` construía la ruta ENTERA y luego leía un fichero: el `%20` del DIRECTORIO
 *     («Javier Pereira») viajaba dentro y el `readFileSync` moría. Ése es el de este ticket.
 *   · `scrum409:86` se queda con el `path.basename(…)`, o sea el NOMBRE del fichero. El `%20`
 *     está en el directorio, así que el basename sale limpio y hoy NO falla — comprobado: ese
 *     test pasa en verde en este árbol, y NO está gateado. Es un defecto LATENTE: muerde el día
 *     que alguien lo use para una ruta completa, o si un fichero de `tests/` llega a tener un
 *     espacio o un acento en su nombre.
 *
 * NO SE ARREGLA AQUÍ, y es una decisión de carril, no una omisión: `scrum409-fixtures-…` es un
 * fichero de FIXTURES, territorio de otra sesión (S1, SCRUM-684). Un hallazgo de otro carril se
 * reporta, no se arregla (regla 9). Queda censado con su número para que el trinquete siga
 * apretando sobre lo NUEVO y este sitio no se pierda de vista.
 */
const CENSO_ESPERADO = Object.freeze({
  'tests/scrum409-fixtures-sin-merchant-demo.test.mjs': 1,
});

function censoActual() {
  const out = {};
  for (const f of CARPETAS.flatMap((c) => ficheros(c))) {
    // El propio censo se nombra a sí mismo en el suelo: se excluye, o se caza en su ejemplo.
    if (f.endsWith('scrum730-ruta-desde-import-meta.test.mjs')) continue;
    const h = rutasSinDecodificar(fs.readFileSync(path.join(RAIZ, f), 'utf8'), f);
    if (h.length) out[f] = h;
  }
  return out;
}

test('SCRUM-730 · 🔴 nadie construye una ruta desde `import.meta.url` sin decodificar', () => {
  const actual = censoActual();

  const nuevos = Object.keys(actual).filter((f) => !(f in CENSO_ESPERADO));
  assert.deepEqual(nuevos, [],
    '🔴 UNA RUTA CONSTRUIDA A MANO DESDE `import.meta.url`:\n'
    + nuevos.map((f) => `   · ${f}\n` + actual[f].map((x) => `       línea ${x.linea}: ${x.idioma}`).join('\n')).join('\n')
    + '\n\n  `pathname` NO decodifica: en una copia de trabajo cuya ruta lleve un espacio —o una\n'
    + '  eñe, o un acento— el `%20` sobrevive y el fichero «no existe». En CI pasa en verde,\n'
    + '  porque la ruta del runner no lleva espacios: el fallo sale sólo donde trabaja la gente.\n'
    + '  Se resuelve con `fileURLToPath(import.meta.url)`, que es lo que usa el resto de la casa.\n'
    + '  NO se relaja lo que el test exija: se cambia CÓMO RESUELVE SU RUTA.');

  // 🔴 Y EL TRINQUETE APRIETA DENTRO DE CADA FICHERO CENSADO: si el declarado gana un sitio más,
  // cae igual. Sin esto, el fichero eximido sería una puerta abierta a añadir más del mismo
  // idioma sin que saltara nada — una excepción que sobrevive a su causa deja de ser una nota y
  // pasa a ser un permiso (SCRUM-368).
  for (const [f, n] of Object.entries(CENSO_ESPERADO)) {
    const hoy = (actual[f] || []).length;
    assert.equal(hoy, n,
      `🔴 \`${f}\` declaraba ${n} sitio(s) y ahora tiene ${hoy}.\n`
      + (hoy > n
        ? '  Ha entrado otro. Se arregla con `fileURLToPath`, no se sube el número.'
        : '  Si se ha ARREGLADO, quita la entrada del censo en el mismo commit — un censo que\n'
          + '  sobra deja de leerse.'));
  }
});

test('SCRUM-730 · el fichero que lo motivó usa el idioma bueno', () => {
  // Control de identidad, no de nombre: se mira lo que hace el código de ESE fichero.
  const f = 'tests/scrum176b-force-por-identidad.test.mjs';
  const src = fs.readFileSync(path.join(RAIZ, f), 'utf8');
  assert.deepEqual(rutasSinDecodificar(src, f), [],
    `🔴 ${f} ha vuelto a resolver su ruta a mano.`);
  assert.match(src, /fileURLToPath\(import\.meta\.url\)/,
    `🔴 ${f} ya no usa \`fileURLToPath\`: el arreglo se ha ido.`);
});
