// tests/scrum694c-el-corte-a-pelo.test.mjs — SCRUM-694c
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LOS TRES DEL CORTE A PELO — y por qué los otros 39 NO se tocan
//
// SCRUM-694 dejó un trinquete en 56 y migró nueve; SCRUM-694b lo bajó a 42 migrando los nueve
// de `(^|[^:])//`. Quedaban 42, y la pregunta no es cuántos son: es **cuáles comparten la
// forma del defecto**, que es no aguantar una URL con `//`.
//
// ── MEDIDO EL 15-sep-2026, Y NO POR LOS FICHEROS QUE LEEN ───────────────────────────────
//
// Preguntar «¿hoy pierde algo en lo que lee?» depende de que yo sepa resolver qué lee cada uno,
// y en 21 de 42 no lo sabía: un cero por ahí sería cota inferior, no prueba. Así que se preguntó
// por la FORMA, pasándole a cada filtro LÍNEAS REALES del árbol con URL dentro:
//
//   | forma                | cuántos | ¿se come código detrás de una URL? |
//   |----------------------|---------|------------------------------------|
//   | `^\s*//.*$`          |   30    | NO — sólo borra la línea que EMPIEZA por `//` |
//   | `(^|\s)//.*$`        |    9    | NO — `https://` lleva `:` delante, no un espacio |
//   | 🔴 `//.*$` a pelo    |    3    | **SÍ, las cuatro formas de URL que hay en el árbol** |
//
// Los tres del corte a pelo son los que se migran aquí. Los otros 39 se DECLARAN, no se
// fuerzan: su filtro aguanta la URL, así que migrarlos sería otro ticket con otro motivo.
//
// ── 🔴 Y UNA DECLARACIÓN HEREDADA QUE NO SE SOSTENÍA ────────────────────────────────────
//
// SCRUM-694 declaró dos de estos tres como «no aplica: el scanner de TypeScript no parsea
// Prisma». Eso no se hereda: se mide. Medido sobre `prisma/schema.prisma` (1.634 líneas):
// `soloCodigo()` blanquea **852** líneas de comentario, y **0** blanqueos que no fueran
// comentario, y **0** comentarios supervivientes. Es seguro. La declaración era una suposición.
//
// (Y la otra razón que yo mismo di ayer para no migrar el tercero —que ningún `scripts/`
// importaba de `tests/`— también era falsa: lo hacen `_pagina-panel`, `_banco-lista`,
// `censo-internos-de-prisma`, `censo-objetivo-tactil-panel` y dos más.)
//
// ⚠️ El defecto NO está vivo hoy: medido, los tres pierden **0 líneas** de lo que leen ahora
// mismo. Eso es suerte del contenido, no del filtro: un `@default("https://…")` en el schema
// bastaría. Se migra por la forma, y se dice que hoy no sangra.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { soloCodigo } from './_solo-codigo.mjs';
import { paresDelSchema } from '../scripts/_pares-del-schema.mjs';
import { normalizarSchema } from '../scripts/_prisma-procedencia-guard.mjs';
import { defaultsDeLaTablaP } from '../scripts/censo-anclas-bloque-f.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

/**
 * EL CORTE QUE SE RETIRA, conservado como control: sin él, «la migración no es cosmética» sería
 * una afirmación sin prueba.
 *
 * ⚠️ SE CONSTRUYE, NO SE ESCRIBE COMO LITERAL, y no es un truco: es la misma técnica que usa el
 * trinquete de `scrum694-los-guards-migrados` para su `EL_CORTE`. El censo de SCRUM-700 recorre
 * los regex LITERALES del árbol buscando filtros que cieguen, y hace bien; un literal aquí le
 * subiría el tope en uno por cada ticket de esta familia que conserve su control, y un trinquete
 * que se sube «porque toca» deja de significar nada. Lo que ese censo persigue es un filtro que
 * un guard USE para mirar lo que vigila — esto no lo usa nadie para eso: sólo se le pasan las
 * líneas de laboratorio de aquí abajo.
 */
const B = String.fromCharCode(92);
const RE_CORTE_A_PELO = new RegExp(B + '/' + B + '/.*$');
const corteAPelo = (t) => String(t).split('\n').map((l) => l.replace(RE_CORTE_A_PELO, '')).join('\n');

const MIGRADOS = [
  ['scripts/_pares-del-schema.mjs', 'paresDelSchema'],
  ['scripts/_prisma-procedencia-guard.mjs', 'normalizarSchema'],
  ['scripts/censo-anclas-bloque-f.mjs', 'FLAG_DEFAULTS'],
];

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-694c · SUELO: los TRES usan el mecanismo y conservan su aguja', () => {
  for (const [rel, aguja] of MIGRADOS) {
    const codigo = soloCodigo(leer(rel), path.basename(rel));
    assert.ok(codigo.includes('_solo-codigo.mjs'),
      `🔴 ${rel} ha vuelto a filtrar comentarios por su cuenta. Y se mira sobre el CÓDIGO: `
      + 'nombrar el mecanismo en un comentario no es importarlo.');
    assert.ok(leer(rel).includes(aguja),
      `🔴 ${rel} ya no nombra «${aguja}»: se habría vaciado el guard al migrarlo, que es peor `
      + 'que el filtro malo — un guard vacío da verde siempre.');
  }
});

test('SCRUM-694c · SUELO: el corte a pelo NO ha vuelto a ninguno de los tres', () => {
  const CORTE = String.fromCharCode(92) + '/' + String.fromCharCode(92) + '/.*$';
  const reincidentes = MIGRADOS.map(([rel]) => rel)
    .filter((rel) => soloCodigo(leer(rel), path.basename(rel)).includes(CORTE));
  assert.deepEqual(reincidentes, [], '🔴 ha vuelto el corte a pelo a: ' + reincidentes.join(', '));
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CASO REAL — el FICHERO de verdad que cada uno lee, con la violación detrás de una URL
//
// No se toca `prisma/schema.prisma` en disco (está prohibido, y no hace falta): los dos guards
// de Prisma exponen su función PURA sobre texto, así que se les da el schema REAL leído del
// árbol con la línea añadida en memoria. El fichero no se toca; la superficie es la de verdad.
// ═════════════════════════════════════════════════════════════════════════════════════════

/** La forma exacta del caso: un regex de URL, y detrás —en la MISMA línea— lo que hay que ver. */
// (Aquí vivía un `trasUnaUrl()` que fabricaba la línea. Se retira: los casos de abajo usan
// LÍNEAS REALES del árbol, que es lo que este ticket exige — un caso que «se parezca» no vale.)

test('SCRUM-694c · 🔴 el corte a pelo se come la línea entera tras un regex de URL', () => {
  // El control de todo lo de abajo: si el filtro que se retira NO cegara, migrar no arreglaría
  // nada. Se comprueba con las CUATRO formas de URL que existen en el árbol.
  const casos = [
    ["if (!/^https?:\\/\\//i.test(v)) v = 'https://' + v;", "v = 'https://' + v;",
     'public/dashboard/js/settingsView.js'],
    ["const DOC = 'https://yaqu.app/ayuda'; const X = 1;", 'const X = 1;', 'una URL en cadena'],
    ['const u = `https://wa.me/${tel}`; const Y = 2;', 'const Y = 2;', 'una URL en plantilla'],
    ["const cdn = '//cdn.ejemplo.com/x.js'; const Z = 3;", 'const Z = 3;', 'una URL sin protocolo'],
  ];
  for (const [linea, aguja, donde] of casos) {
    assert.equal(corteAPelo(linea).includes(aguja), false,
      `🔴 CONTROL ROTO (${donde}): el corte a pelo ya NO se come «${aguja}». Si no cegaba, esta `
      + 'migración no arregla lo que dice arreglar. Vuelve a medir.');
    assert.equal(soloCodigo(linea, 'x.js').includes(aguja), true,
      `🔴 el mecanismo TAMBIÉN se come «${aguja}» (${donde}): entonces no es un arreglo.`);
  }
});

test('SCRUM-694c · 🔴 `paresDelSchema` VE una columna escondida detrás de una URL', () => {
  // El schema REAL del árbol, con UNA línea añadida en memoria: un campo cuyo `@default` es una
  // URL, y detrás —misma línea— el `@map` que declara la columna. Con el corte a pelo, la línea
  // muere en `@default("https:` y la columna desaparece del censo SIN QUE NADA LO DIGA.
  const schema = leer('prisma/schema.prisma');
  const MODELO = 'model Merchant {';
  const i = schema.indexOf(MODELO);
  assert.ok(i > 0, '🔴 no encuentro `model Merchant` en el schema real: re-medir.');

  const LINEA = '\n  webhookUrl String @default("https://yaqu.app/hook") @map("webhook_url")\n';
  const conUrl = schema.slice(0, i + MODELO.length) + LINEA + schema.slice(i + MODELO.length);

  // ⚠️ El par va por NOMBRE DE TABLA (`@@map`), no por nombre de modelo — me equivoqué al
  // escribirlo y lo cazó este mismo test. La tabla se DERIVA del propio censo buscando una
  // columna que ya existe en ese modelo, en vez de escribir «merchants» a mano: si mañana
  // cambia el `@@map`, esto sigue preguntando por el sitio correcto.
  const censo = paresDelSchema(conUrl).pares;
  const tabla = [...new Set(censo.filter((p) => p[1] === 'trade').map((p) => p[0]))];
  assert.equal(tabla.length, 1,
    `🔴 no puedo derivar la tabla de \`model Merchant\` (salen ${tabla.length}). Sin eso, lo de `
    + 'abajo preguntaría por un sitio inventado.');

  assert.ok(censo.some((p) => p[0] === tabla[0] && p[1] === 'webhook_url'),
    '🔴 el censo NO ve la columna que va detrás de la URL. Es exactamente el defecto: una '
    + 'columna que existe en el schema y que el censo declara ausente, en verde.');

  // Y el control, para que esto no pase por casualidad: el corte a pelo SÍ la perdía.
  const cegado = corteAPelo(conUrl);
  assert.equal(cegado.includes('webhook_url'), false,
    '🔴 CONTROL ROTO: el corte a pelo ya no se comía esa línea. Re-medir antes de seguir.');
});

test('SCRUM-694c · 🔴 `normalizarSchema` CONSERVA lo que va detrás de una URL', () => {
  // Este guard compara dos schemas para decir si el cliente de Prisma salió de ESTE fichero.
  // Si la normalización se come medio renglón en los dos lados por igual, dos schemas
  // DISTINTOS salen iguales — y el guard da verde sobre un cliente que no corresponde.
  const schema = leer('prisma/schema.prisma');
  const LINEA = '  webhookUrl String @default("https://yaqu.app/hook") @map("webhook_url")\n';

  const a = normalizarSchema(schema + '\n' + LINEA);
  assert.ok(a.includes('webhook_url'),
    '🔴 la normalización pierde el `@map` que va detrás de la URL: dos schemas que sólo se '
    + 'diferencien ahí saldrían IGUALES, y el guard de procedencia daría verde sin razón.');

  // El control: con el corte a pelo, esa línea quedaba en `webhookUrl String @default("https:`
  // — y entonces una línea con OTRO `@map` detrás de la misma URL sería indistinguible.
  const otra = '  webhookUrl String @default("https://yaqu.app/hook") @map("otra_columna")\n';
  assert.notEqual(a, normalizarSchema(schema + '\n' + otra),
    '🔴 dos schemas con `@map` distinto salen IGUALES tras normalizar.');
  assert.equal(
    corteAPelo(LINEA).trim() === corteAPelo(otra).trim(), true,
    '🔴 CONTROL ROTO: el corte a pelo ya no hacía indistinguibles esas dos líneas.');
});

test('SCRUM-694c · el censo de anclas SIGUE leyendo la tabla tras migrar', () => {
  // ⚠️ AQUÍ NO HAY ROJO A NIVEL DE URL, Y SE DICE EN VEZ DE FABRICARLO.
  //
  // `censo-anclas-bloque-f` lee `FLAG_DEFAULTS` de `src/core/flags.ts`, que es una tabla de
  // BOOLEANOS: `NOMBRE: true,`. En una tabla así una URL no cabe en el código — sólo en el
  // comentario de al lado, y ahí el corte a pelo acertaba por casualidad. Escribir un caso que
  // «se pareciera» a los otros dos sería justo el caso sintético que este ticket prohíbe.
  //
  // Se migra por la FORMA —comparte el corte que no aguanta una URL— y lo que lo sujeta es el
  // trinquete de arriba (que el corte no vuelva) más el control de forma. Lo que SÍ se fija
  // aquí es que la migración no lo ha roto: se entra por su función real, con la tabla real.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum694c-'));
  try {
    fs.mkdirSync(path.join(tmp, 'src', 'core'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'src', 'core', 'flags.ts'), leer('src/core/flags.ts'));

    const r = defaultsDeLaTablaP(tmp);
    assert.equal(r.ok, true, `🔴 la tabla ya no se lee: ${r.motivo}`);
    const flags = Object.keys(r.tabla || {});
    assert.ok(flags.length > 3,
      `🔴 sólo salen ${flags.length} flags de la tabla real. Un censo que lee casi nada no se `
      + 'distingue de uno que no lee: su cero valdría lo mismo con tabla y sin ella.');

    // Y que de verdad QUITA los comentarios, que es para lo que existe el filtro: una línea
    // comentada que mencione un flag no puede contar como declaración.
    assert.ok(!Object.keys(r.tabla).some((k) => k.startsWith('//')),
      '🔴 han entrado comentarios en la tabla de flags.');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LOS 39 QUE QUEDAN — declarados con su motivo, no forzados
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-694c · 🔴 los 39 que quedan AGUANTAN la URL — por eso no se migran', () => {
  // Esto es la declaración, ejecutada. Si algún día una de esas dos formas dejara de aguantar
  // una URL, este test cae y la declaración deja de valer — que es la diferencia entre declarar
  // y prometer.
  const A_EMPIEZA = (l) => l.replace(/^\s*\/\/.*$/, '');
  const C_TRAS_ESPACIO = (l) => l.replace(/(^|\s)\/\/.*$/, '$1');
  const URLS = [
    ["if (!/^https?:\\/\\//i.test(v)) v = 'https://' + v;", "v = 'https://' + v;"],
    ["const DOC = 'https://yaqu.app/ayuda'; const X = 1;", 'const X = 1;'],
    ['const u = `https://wa.me/${tel}`; const Y = 2;', 'const Y = 2;'],
    ["const cdn = '//cdn.ejemplo.com/x.js'; const Z = 3;", 'const Z = 3;'],
  ];
  for (const [nombre, f] of [['^\\s*//', A_EMPIEZA], ['(^|\\s)//', C_TRAS_ESPACIO]]) {
    for (const [linea, aguja] of URLS) {
      assert.ok(f(linea).includes(aguja),
        `🔴 la forma \`${nombre}\` YA NO aguanta una URL («${aguja}»). Entonces los guards que `
        + 'la usan tienen el mismo defecto que los tres migrados aquí, y la declaración de que '
        + 'no hace falta migrarlos deja de sostenerse.');
    }
  }
});
