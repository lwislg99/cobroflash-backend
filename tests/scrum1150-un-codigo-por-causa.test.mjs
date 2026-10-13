// tests/scrum1150-un-codigo-por-causa.test.mjs — SCRUM-1150 (la mitad del servidor)
//
// 🔴 `revisiones_ambiguas` ERA UN CÓDIGO CON VARIAS CAUSAS, Y ADEMÁS VIAJABA CON EL TEXTO DE LA EXCEPCIÓN.
//
// `POST /admin/quotes/:id/revisiones` contestaba `{ error: 'revisiones_ambiguas', message: err.message }`
// a todo lo que el dominio lanzara como `RevisionesAmbiguas` o `CensoDeRevisionesCiego`. Dos defectos:
//
//   · UN CÓDIGO, VARIAS CAUSAS. Cualquier frase que explique una es falsa para las otras, y por eso
//     el literal de ese código no se pudo firmar (SCRUM-1150, c.18740). Medido aquí: no eran dos
//     causas, son CUATRO sitios que lanzan — tres alcanzables desde esta ruta y uno sólo desde la
//     lectura (`vistaDeRevisiones`).
//   · EL `message` ERA EL DIAGNÓSTICO DE UN PROGRAMADOR («DOS VIGENTES A LA VEZ: …», «CENSO CIEGO ·
//     …»), ocho líneas a 390 px, y la pantalla lo pintaba tal cual.
//
// Ahora cada sitio que lanza lleva SU código (`motivo`), la ruta lo manda como `error`, NO manda
// `message`, y el texto de la excepción va al log, que es para quien es.
//
// ── EL BANCO ────────────────────────────────────────────────────────────────────────────────
// El handler de `dist/` de verdad con la base doblada (`_envio-doblado.mjs`): el doble contesta lo que
// cada caso declara en `base`, y apunta las escrituras. NO es la base, y se dice en el caso que lo
// aprovecha: una fila con la revisión ilegible no puede existir en Postgres (`revision Int` no nulo).
//
// ── LO QUE ESTE FICHERO NO DICE ─────────────────────────────────────────────────────────────
// Qué frase le toca a cada código: eso es microcopy y lleva firma. Y tampoco toca los motivos de
// `RevisionNoCreable` (`quote_not_found`, `quote_sin_numero`, `descuento_global_con_varios_iva`), que
// siguen viajando con su `message` hasta que la pantalla decida por el código.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Los CUATRO códigos, uno por sitio que lanza. Uno por línea. */
const CODIGOS = [
  'revisiones_dos_vigentes',
  'revisiones_sin_leer',
  'revision_no_posterior',
  'revisiones_sin_la_propia',
];
const CODIGO_VIEJO = 'revisiones_ambiguas';

// ── la base, por caso ───────────────────────────────────────────────────────────────────────
const NUMERO = 2004226;
const ABIERTA = Object.freeze({
  id: 7, merchantId: MERCHANT, quoteNumber: NUMERO, revision: 0, signatureUrl: null,
  customerId: 55, currency: 'EUR', total: '12.10', discountGlobalAmount: null,
  lines: [{ concept: 'Revisión de caldera', qty: 1, price: 10, tax: 0.21 }],
});
const base = { abierta: ABIERTA, hermanas: [], escrituras: [] };
inyectarBase({
  'quote.findFirst': (args) => (args?.where?.id === base.abierta?.id ? { ...base.abierta } : null),
  'quote.findMany': () => base.hermanas.map((h) => ({ ...h })),
  'quote.create': (args) => {
    base.escrituras.push(args);
    return { id: 99, quoteNumber: args.data.quoteNumber, revision: args.data.revision, status: args.data.status };
  },
});

const rutas = moduloDeDist('../dist/modules/system/app/routes/quotesAdmin.routes.js').default;
const dominio = moduloDeDist('../dist/modules/quotes/domain/revision.js');

/** `POST /admin/quotes/7/revisiones` con ese grupo en la base. Devuelve la respuesta, las escrituras y el log. */
async function crearRevision({ abierta = ABIERTA, hermanas }) {
  const capa = rutas.stack.find((l) => l.route && l.route.path === '/:id/revisiones' && l.route.methods.post);
  assert.ok(capa, '🔴 CIEGO: no encuentro POST /:id/revisiones en quotesAdmin.routes');
  const handler = capa.route.stack[capa.route.stack.length - 1].handle;
  base.abierta = abierta; base.hermanas = hermanas; base.escrituras = [];
  const r = { status: 200, body: undefined };
  const res = {
    status(s) { r.status = s; return res; },
    json(j) { r.body = j; return res; },
  };
  const log = [];
  const deVerdad = console.error; console.error = (...a) => { log.push(a.map(String).join(' ')); };
  try {
    await handler(reqDeSesion({ rol: 'admin', merchantId: MERCHANT, params: { id: '7' }, body: {}, query: {} }), res);
  } finally { console.error = deVerdad; }
  return { ...r, escrituras: base.escrituras.length, log: log.join('\n') };
}

/** Lo que lanza `f`, o `null`. */
function loQueLanza(f) {
  try { f(); } catch (e) { return e; }
  return null;
}

test('SCRUM-1150 · SUELO: con un grupo sano la ruta CREA la revisión (el banco llega hasta la escritura)', async () => {
  const r = await crearRevision({ hermanas: [{ id: 7, revision: 0, signatureUrl: null }] });
  assert.equal(r.status, 201, `🔴 CIEGO: el caso sano responde ${r.status} ${JSON.stringify(r.body)}`);
  assert.equal(r.escrituras, 1);
  assert.equal(r.body.revision, 1);
});

test('SCRUM-1150 · 🔴 dos vigentes → 409 `revisiones_dos_vigentes`, SIN `message`, sin escribir, y el diagnóstico al log', async () => {
  const r = await crearRevision({ hermanas: [
    { id: 7, revision: 0, signatureUrl: null },
    { id: 8, revision: 1, signatureUrl: null },
    { id: 9, revision: 1, signatureUrl: null },
  ] });
  assert.equal(r.status, 409);
  assert.deepEqual(r.body, { error: 'revisiones_dos_vigentes' },
    '🔴 la respuesta lleva algo más que su código: si es `message`, es el texto de una excepción camino de la pantalla.');
  assert.equal(r.escrituras, 0);
  assert.match(r.log, /revisiones_dos_vigentes/, '🔴 el log no dice qué causa fue');
  assert.match(r.log, /DOS VIGENTES A LA VEZ/, '🔴 el diagnóstico ya no llega a nadie: ni a la pantalla ni al log');
});

test('SCRUM-1150 · 🔴 el grupo no se ha leído → 409 `revisiones_sin_leer`, SIN `message`, sin escribir, y el diagnóstico al log', async () => {
  // En producción sólo pasa si el presupuesto se borra entre las dos consultas de la ruta.
  const r = await crearRevision({ hermanas: [] });
  assert.equal(r.status, 409);
  assert.deepEqual(r.body, { error: 'revisiones_sin_leer' });
  assert.equal(r.escrituras, 0);
  assert.match(r.log, /revisiones_sin_leer/);
  assert.match(r.log, /CENSO CIEGO/);
});

test('SCRUM-1150 · 🔴 la revisión nueva no es posterior → 409 `revision_no_posterior`, SIN `message`, sin escribir', async () => {
  // ⚠️ CASO FABRICADO, y se dice: una hermana con la revisión ilegible deja el «siguiente» en NaN.
  // En Postgres no puede existir (`revision Int` no nulo); el doble sí la deja pasar, y sirve para
  // ver que esta causa —un fallo NUESTRO al calcular el número— sale con su código y no con el de otra.
  const r = await crearRevision({ hermanas: [
    { id: 7, revision: 0, signatureUrl: null },
    { id: 8, revision: undefined, signatureUrl: null },
  ] });
  assert.equal(r.status, 409);
  assert.deepEqual(r.body, { error: 'revision_no_posterior' });
  assert.equal(r.escrituras, 0);
  assert.match(r.log, /revision_no_posterior/);
});

test('SCRUM-1150 · el cuarto sitio (`revisionesDe`, sólo lo alcanza la LECTURA) lleva también el suyo: `revisiones_sin_la_propia`', () => {
  const propia = { id: 9, numero: 'P2004226', revision: 0, firmado: false };
  const e = loQueLanza(() => dominio.revisionesDe(propia, []));
  assert.equal(e?.name, 'CensoDeRevisionesCiego', '🔴 CIEGO: el censo vacío ya no lanza');
  assert.equal(e.motivo, 'revisiones_sin_la_propia');
});

test('SCRUM-1150 · cada causa lanza con SU código, medido en el dominio (no sólo por la ruta)', () => {
  const fila = (id, revision) => ({ id, numero: 'P2004226', revision, firmado: false });
  const lanzados = [
    loQueLanza(() => dominio.vigenteUnicaDe([fila(1, 0), fila(2, 1), fila(3, 1)])),
    loQueLanza(() => dominio.vigenteUnicaDe([])),
    loQueLanza(() => dominio.nuevaRevisionDe({ id: 2, merchantId: MERCHANT, quoteNumber: NUMERO, revision: 1 }, 1)),
    loQueLanza(() => dominio.revisionesDe(fila(9, 0), [])),
  ];
  assert.deepEqual(lanzados.map((e) => e?.motivo), CODIGOS);
  assert.deepEqual(lanzados.map((e) => e?.name),
    ['RevisionesAmbiguas', 'CensoDeRevisionesCiego', 'RevisionesAmbiguas', 'CensoDeRevisionesCiego'],
    'los nombres de clase NO cambian: `scrum655b` y la ruta deciden por ellos');
});

// ── EL CENSO: la otra mitad. Recorre `src/` ENTERO, por AST (no por texto: los comentarios que
//    explican esto nombran el código viejo). ─────────────────────────────────────────────────────
function fuentesDeSrc() {
  const salida = [];
  (function andar(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) andar(p);
      else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) salida.push(p);
    }
  }(path.join(RAIZ, 'src')));
  return salida;
}
const CLASES = new Set(['RevisionesAmbiguas', 'CensoDeRevisionesCiego']);

function censar() {
  const ficheros = fuentesDeSrc();
  const lanzamientos = [];   // { donde, clase, motivo }
  const viejo = [];          // dónde sigue el código viejo como LITERAL
  for (const f of ficheros) {
    const texto = fs.readFileSync(f, 'utf8');
    if (!texto.includes(CODIGO_VIEJO) && ![...CLASES].some((c) => texto.includes(c))) continue;
    const sf = ts.createSourceFile(f, texto, ts.ScriptTarget.ES2022, true);
    const rel = path.relative(RAIZ, f).split(path.sep).join('/');
    (function ver(n) {
      const linea = () => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
      if (ts.isStringLiteralLike(n) && n.text === CODIGO_VIEJO) viejo.push(`${rel}:${linea()}`);
      if (ts.isNewExpression(n) && ts.isIdentifier(n.expression) && CLASES.has(n.expression.text)) {
        const primero = n.arguments?.[0];
        lanzamientos.push({
          donde: `${rel}:${linea()}`,
          clase: n.expression.text,
          motivo: primero && ts.isStringLiteralLike(primero) ? primero.text : null,
        });
      }
      ts.forEachChild(n, ver);
    }(sf));
  }
  return { ficheros: ficheros.length, lanzamientos, viejo };
}

test('SCRUM-1150 · 🔴 CENSO de `src/`: cada sitio que lanza una de las dos clases lleva un código literal, y NINGUNO lo comparte', () => {
  const { ficheros, lanzamientos } = censar();
  assert.ok(ficheros > 200, `🔴 CIEGO: el censo sólo ha visto ${ficheros} ficheros de src/`);
  assert.equal(lanzamientos.length, 4,
    `🔴 los sitios que lanzan ya no son 4 (${lanzamientos.map((l) => l.donde).join(', ')}). Uno nuevo es una `
    + 'CAUSA nueva: dale su código, añádelo a CODIGOS y dilo en SCRUM-1150 para que alguien le escriba su frase.');
  const sinLiteral = lanzamientos.filter((l) => l.motivo === null).map((l) => l.donde);
  assert.deepEqual(sinLiteral, [], '🔴 un lanzamiento sin su código escrito como literal en el primer argumento');
  assert.deepEqual(lanzamientos.map((l) => l.motivo).sort(), [...CODIGOS].sort(),
    '🔴 dos sitios comparten código, o hay uno que este fichero no conoce: un código con dos causas no admite una frase cierta.');
});

test('SCRUM-1150 · 🔴 CENSO de `src/`: el código viejo `revisiones_ambiguas` no queda como literal en ningún sitio', () => {
  const { ficheros, viejo } = censar();
  assert.ok(ficheros > 200, `🔴 CIEGO: el censo sólo ha visto ${ficheros} ficheros de src/`);
  assert.deepEqual(viejo, []);
});

test('SCRUM-1150 · NO TOCADO: un motivo de `RevisionNoCreable` sigue saliendo con su código (`quote_sin_numero`, 409)', async () => {
  const r = await crearRevision({ abierta: { ...ABIERTA, quoteNumber: null }, hermanas: [] });
  assert.equal(r.status, 409);
  assert.equal(r.body.error, 'quote_sin_numero');
  assert.equal(r.escrituras, 0);
});
