// tests/scrum364-cambiar-gremio.test.mjs — SCRUM-364 · el oficio se puede elegir después del alta.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO
//
// `trade` se captura en UN SOLO SITIO del producto —el paso 1 del asistente de alta— y no es
// editable en ninguna pantalla. Quien lo saltó se queda sin oficio para siempre: el asistente
// queda marcado como completado y no vuelve a salir nunca.
//
// El botón de rescate del estado vacío de Productos llamaba a `load-catalog` con `{}` → el
// servidor respondía 400 `trade_required` → la pantalla decía «No se pudo cargar el catálogo.
// Inténtalo de nuevo.», pidiéndole al usuario que repitiera algo que no iba a funcionar nunca.
//
// **Medido en producción el 5-ago-2026:** 8 de 13 merchants sin oficio; 4 son cuentas reales y 2
// tienen actividad — una de ellas de pago, con 31 presupuestos y 6 facturas desde mayo.
//
// ⚠️ EL SERVIDOR NO SE TOCA y no hacía falta: `load-catalog` ya acepta
// `req.body?.trade || merchant.trade`. Con oficio guardado, mandar `{}` YA funcionaba. Lo que
// faltaba no era el dato en la petición: era **poder elegirlo**.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const PRODUCTOS = 'public/dashboard/js/productsView.js';
const ALTA = 'public/dashboard/js/onboardingView.js';

const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
const ast = (rel) => ts.createSourceFile(rel, leer(rel), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const recorrer = (n, v) => { v(n); n.forEachChild((h) => recorrer(h, v)); };

/** Literales de cadena de un fichero, por AST — así los comentarios no cuentan. */
function literales(rel) {
  const sf = ast(rel);
  const out = [];
  recorrer(sf, (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.push(n.text);
    else if (ts.isTemplateExpression(n)) {
      out.push(n.head.text, ...n.templateSpans.map((s) => s.literal.text));
    }
  });
  return out;
}

/** La lista de oficios, DERIVADA del fichero que la declara. Nunca escrita aquí. */
function oficiosDeclarados() {
  const sf = ast(ALTA);
  let decl = null;
  recorrer(sf, (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'OB_TRADES') decl = n;
  });
  if (!decl || !decl.initializer || !ts.isArrayLiteralExpression(decl.initializer)) return [];
  return decl.initializer.elements.flatMap((el) => {
    if (!ts.isObjectLiteralExpression(el)) return [];
    const v = el.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText(sf) === 'value');
    return v && ts.isStringLiteral(v.initializer) ? [v.initializer.text] : [];
  });
}

// ── SUELO ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-364 · SUELO: los dos ficheros se parsean y la lista de oficios se deriva', () => {
  const oficios = oficiosDeclarados();
  assert.ok(oficios.length >= 5,
    `🔴 la derivación solo saca ${oficios.length} oficios de ${ALTA}; se midieron 7 el 5-ago-2026. ` +
    'Si no encuentra la lista, el guard de «no hay cuarta lista» de abajo daría verde sin mirar nada.');
  assert.ok(literales(PRODUCTOS).length > 50,
    `🔴 el analizador apenas ve literales en ${PRODUCTOS}: no lo está leyendo de verdad.`);
});

// ── EL RESCATE ───────────────────────────────────────────────────────────────────────────

test('SCRUM-364 · el estado vacío reacciona a `trade_required` en vez de morir', () => {
  // Antes: cualquier fallo caía al mismo `catch` y mostraba «Inténtalo de nuevo». Un 400 de
  // `trade_required` no se arregla reintentando — se arregla eligiendo oficio.
  assert.ok(literales(PRODUCTOS).includes('trade_required'),
    '🔴 la pantalla de Productos no distingue el caso «no tienes oficio». Sin eso vuelve a decirle\n' +
    '  al usuario que reintente algo que no puede funcionar: su oficio no existe y no hay ninguna\n' +
    '  otra pantalla donde ponerlo.');
});

test('SCRUM-364 · se decide por el CÓDIGO del error, no por el texto del mensaje', () => {
  // `api.js` deja el código del servidor en `err.code` precisamente para esto, y su propio
  // comentario dice que ramificar por texto es lo que nunca hay que hacer.
  const codigo = leer(PRODUCTOS).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.match(codigo, /\.code\s*===\s*'trade_required'/,
    '🔴 el caso «sin oficio» no se reconoce por `err.code`. Si se reconoce por el texto del\n' +
    '  mensaje, cambiar una palabra del servidor rompe el rescate en silencio.');
});

test('SCRUM-364 · el oficio elegido se GUARDA, no solo se manda en la petición', () => {
  const codigo = leer(PRODUCTOS).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.match(codigo, /updateMerchantProfile\(\s*\{\s*trade/,
    '🔴 el oficio no se persiste. Mandarlo solo en el cuerpo de `load-catalog` carga el catálogo\n' +
    '  una vez y deja al usuario igual de roto en cuanto cierre la pantalla — el mismo defecto\n' +
    '  con más pasos.');
});

// ── LA CUARTA LISTA QUE NO SE ESCRIBE ────────────────────────────────────────────────────

test('SCRUM-364 · Productos NO escribe su propia lista de oficios', () => {
  // El censo de SCRUM-310 encontró TRES listas del mismo gremio a mano en el producto. Ésta
  // habría sido la cuarta. La lista se publica desde donde ya vivía y se consume.
  const oficios = oficiosDeclarados();
  const enProductos = literales(PRODUCTOS);
  const copiados = oficios.filter((o) => enProductos.includes(o));

  assert.deepEqual(copiados, [],
    `🔴 ${PRODUCTOS} escribe valores de oficio a mano: ${copiados.join(', ')}.\n\n` +
    '  Sería la CUARTA lista del mismo gremio en el producto. Cuando alguien añada un oficio\n' +
    '  nuevo, esta se quedará vieja y nadie se enterará hasta que un usuario no lo encuentre.\n' +
    '  Se consume `window.OB_TRADES`, que publica onboardingView.js.');
  assert.match(leer(PRODUCTOS), /window\.OB_TRADES/,
    '🔴 y tampoco la consume: entonces el selector no tiene de dónde sacar los oficios.');
});

test('SCRUM-364 · la lista se publica explícitamente, sin depender del ámbito de los scripts', () => {
  // `OB_TRADES` es un `const` de nivel superior y hoy no lo usa ningún otro fichero: no hay
  // precedente en el panel de que eso cruce ficheros. El que sí lo tiene es una `function` de
  // `api.js`. Publicarlo convierte una suposición sobre ámbitos en un contrato.
  assert.match(leer(ALTA), /window\.OB_TRADES\s*=\s*OB_TRADES/,
    `🔴 ${ALTA} ya no publica la lista. Productos dejará de encontrarla y el rescate mostrará el\n` +
    '  error genérico — sin que ningún test del asistente se entere, porque él la usa en su ámbito.');
});

// ── MICROCOPY APROBADA ───────────────────────────────────────────────────────────────────

test('SCRUM-364 · la microcopy aprobada está literal, y dice lo que el servidor ya garantiza', () => {
  // Aprobada por el fundador el 5-ago-2026. Va ANTES de cargar: el servidor NUNCA sustituye el
  // catálogo —con ≥2 productos devuelve `already_has_products` y no borra nada—, así que lo que
  // faltaba no era una protección, era DECIRLO.
  // Se busca por SUBCADENA, no por igualdad: los rótulos viven dentro de trozos de `innerHTML`,
  // así que un literal de este fichero casi nunca es exactamente el texto que ve el usuario.
  const t = literales(PRODUCTOS);
  assert.ok(t.some((s) => s.includes('>Tu oficio<')),
    '🔴 falta la etiqueta aprobada del campo: «Tu oficio».');
  assert.ok(
    t.some((s) => s.includes('Cargamos los conceptos de tu oficio.'))
    && t.some((s) => s.includes('Lo que ya tengas en tu catálogo se queda como está.')),
    '🔴 falta el aviso aprobado. Sin él, cargar un catálogo parece que puede pisar lo que el\n' +
    '  usuario ya tiene — y el silencio sobre eso es justo el defecto que este ticket cierra.');
});
