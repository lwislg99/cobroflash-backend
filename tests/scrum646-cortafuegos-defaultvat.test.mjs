// tests/scrum646-cortafuegos-defaultvat.test.mjs — SCRUM-646
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL CORTAFUEGOS: `defaultVat` NO VUELVE A ESCRIBIRSE EN LA BASE.
//
// LA VÍCTIMA, y no es hipotética: un profesional daba de alta su catálogo por gremio —desde el
// onboarding, con la casilla MARCADA POR DEFECTO (`onboardingView.js:284`), o desde el botón del
// catálogo—. Nadie le preguntaba por el IVA. `getLocale(merchant.country).defaultVat` ESCRIBÍA un
// tipo impositivo en cada producto que nacía. No se lo proponía en pantalla: lo grababa. A partir
// de ahí ese número viajaba solo: a la línea, al documento, al PDF y al importe que el cliente
// firma.
//
// Y dependía del PAÍS: 0,21 · 0,16 (MX) · 0,18 (PE/CL) · 0,19 (CO). Canarias es `ES`, así que a
// un canario —que repercute IGIC— le ponía 21.
//
// ── POR QUÉ ESTE GUARD Y NO OTRO ─────────────────────────────────────────────────────────
// 🔴 NO HEREDA SU LISTA DE QUIEN EMITE EL VALOR. Un trinquete que se alimentara de `locales.ts`
// —preguntándole qué campos tiene, o qué ficheros lo importan— no saltaría jamás: cambiaría con
// aquello que vigila. La única excepción está ESCRITA AQUÍ, a mano, y es el módulo que DEFINE la
// tabla. La duplicación es el precio y se paga.
//
// 🔴 ANCLADO POR AST, NO POR TEXTO. Un guard de texto se caza a sí mismo en la prosa que explica
// la prohibición — este fichero nombra `defaultVat` catorce veces. El detector mira nodos
// `PropertyAccessExpression`, así que los comentarios no existen para él.
//
// ── EL HUECO QUE DECLARO ─────────────────────────────────────────────────────────────────
// Esto vigila el NOMBRE. Si alguien copia el número `0.21` a mano en un `create`, este guard no
// lo ve. No se puede vigilar «un tipo impositivo» sin vigilar cualquier número, y eso no es un
// guard: es ruido.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(import.meta.url);
const ts = require_('typescript');

/**
 * EL ÚNICO SITIO QUE PUEDE NOMBRAR `defaultVat`: el módulo que DEFINE la tabla de locales.
 *
 * Escrito a mano y no derivado de nada. Quien lo amplíe está tomando la decisión de volver a
 * derivar un tipo impositivo del país, y tiene que hacerlo a conciencia y con su motivo.
 */
const PUEDE_NOMBRARLO = Object.freeze({
  'src/core/i18n/locales.ts':
    'DEFINE la tabla de locales y la expone al front (`getLocaleJson`). Es el emisor, no un '
    + 'consumidor: aquí el valor no se escribe en ninguna base.',
});

const CAMPO = 'defaultVat';

function ficherosTs(dir) {
  const out = [];
  (function rec(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { rec(p); continue; }
      if (p.endsWith('.ts')) out.push(p);
    }
  })(dir);
  return out;
}

/**
 * Los accesos a `.<campo>` de un fuente, POR AST. Devuelve `{ linea, simbolo }`.
 *
 * PURA y con el fuente inyectable: así el control positivo puede darle un fichero de mentira sin
 * tocar el disco, y el detector se puede probar a sí mismo.
 */
function accesosA(campo, texto, nombre = 'x.ts') {
  const sf = ts.createSourceFile(nombre, texto, ts.ScriptTarget.Latest, true);
  const out = [];
  const simboloDe = (n) => {
    let p = n.parent;
    while (p) {
      if ((ts.isFunctionDeclaration(p) || ts.isMethodDeclaration(p)) && p.name) return p.name.getText(sf);
      if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text;
      p = p.parent;
    }
    return '(nivel superior)';
  };
  (function visitar(n) {
    if ((ts.isPropertyAccessExpression(n) || ts.isPropertyAssignment(n)
      || ts.isShorthandPropertyAssignment(n) || ts.isBindingElement(n))
      && n.name && ts.isIdentifier(n.name) && n.name.text === campo) {
      out.push({
        linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
        simbolo: simboloDe(n),
        texto: n.getText(sf).replace(/\s+/g, ' ').slice(0, 70),
      });
    }
    ts.forEachChild(n, visitar);
  }(sf));
  return out;
}

test('SCRUM-646 · SUELO: el detector VE, y no lo confunde un comentario', () => {
  // Sin esto, un detector que devolviera siempre [] dejaría el trinquete verde para siempre.
  const conAcceso = accesosA(CAMPO, 'const v = getLocale(c).defaultVat;\n');
  assert.equal(conAcceso.length, 1, '🔴 el detector NO ve un acceso que está delante.');

  // 🔴 Y LA PRUEBA DE QUE ES AST Y NO TEXTO: la misma cadena, en un comentario y en un literal,
  // NO cuenta. Es lo que impide que este guard se cace a sí mismo en su propia cabecera.
  assert.deepEqual(accesosA(CAMPO, '// aquí NO se puede usar defaultVat nunca\n'), []);
  assert.deepEqual(accesosA(CAMPO, 'const s = "defaultVat";\n'), []);

  // Control negativo del detector: no encuentra lo que no está.
  assert.deepEqual(accesosA(CAMPO, 'const v = getLocale(c).currency;\n'), []);
});

test('SCRUM-646 · 🔴 EL TRINQUETE: nadie fuera del emisor nombra `defaultVat`', () => {
  const ficheros = ficherosTs(path.join(RAIZ, 'src'));

  // SUELO: si el barrido no ve ficheros, su verde no significa nada.
  assert.ok(ficheros.length > 100,
    `🔴 CIEGO: sólo veo ${ficheros.length} ficheros .ts en src/. El barrido no está midiendo.`);

  const ofensores = [];
  let vistosEnElEmisor = 0;
  for (const f of ficheros) {
    const rel = path.relative(RAIZ, f).split(path.sep).join('/');
    const accesos = accesosA(CAMPO, fs.readFileSync(f, 'utf8'), rel);
    if (!accesos.length) continue;
    if (PUEDE_NOMBRARLO[rel]) { vistosEnElEmisor += accesos.length; continue; }
    for (const a of accesos) ofensores.push(`${rel}:${a.linea}  ·  en \`${a.simbolo}\`  ·  ${a.texto}`);
  }

  // 🔴 SUELO DEL SUELO: el emisor TIENE que aparecer. Si el barrido no lo encuentra ahí, es que
  // no está mirando dentro de los ficheros y su lista de ofensores vacía no vale nada.
  assert.ok(vistosEnElEmisor > 0,
    '🔴 CIEGO: no encuentro `defaultVat` ni siquiera en el módulo que lo define. El barrido no '
    + 'está leyendo los fuentes, así que «cero ofensores» no significa «no hay».');

  assert.deepEqual(ofensores, [],
    '🔴 ALGUIEN VUELVE A DERIVAR EL TIPO DE IVA DEL PAÍS:\n\n'
    + ofensores.map((o) => '   · ' + o).join('\n')
    + '\n\n  `defaultVat` está indexado por PAÍS. Canarias es `ES` y repercute IGIC; y la tabla\n'
    + '  trae además 0,16 · 0,18 · 0,19, que no son tipos españoles. Escribir eso en la base graba\n'
    + '  un impuesto que el profesional NO ha visto ni elegido, y desde ahí viaja a la línea, al\n'
    + '  documento, al PDF y al importe que su cliente firma.\n\n'
    + '  El tipo lo elige quien crea la línea. Si de verdad hace falta leerlo aquí, decláralo en\n'
    + '  PUEDE_NOMBRARLO con su motivo — y entonces es una decisión, no un descuido.');
});

test('SCRUM-646 · 🔴 CONTROL POSITIVO: el trinquete CAZA la escritura prohibida', () => {
  // La prueba en rojo, hecha por el propio guard y sin tocar el disco: se le da un fuente de
  // mentira con la lectura prohibida y se comprueba que la ve Y que sabe NOMBRARLA.
  const falso = [
    'import { getLocale } from "../../core/i18n/locales";',
    'export async function altaDeCatalogo(prisma: any, merchant: any) {',
    '  const vat = getLocale(merchant.country).defaultVat;',
    '  await prisma.product.create({ data: { name: "x", vat } });',
    '}',
  ].join('\n');

  const cazados = accesosA(CAMPO, falso, 'src/modules/inventado/alta.ts');
  assert.equal(cazados.length, 1, '🔴 el trinquete NO caza la escritura prohibida: es decorativo.');
  assert.equal(cazados[0].simbolo, 'vat',
    '🔴 lo caza pero no sabe decir DÓNDE. Un rojo que no nombra el símbolo no sirve dentro de '
    + 'tres meses, que es cuando saltará.');
  assert.match(cazados[0].texto, /defaultVat/);
});

test('SCRUM-646 · CONTROL NEGATIVO: la tabla de locales NO se ha tocado', () => {
  // Quitar el cableado del IVA no es borrar la tabla: moneda, idioma y los rótulos del documento
  // siguen saliendo de ahí, y son consumidores legítimos.
  const locales = fs.readFileSync(path.join(RAIZ, 'src/core/i18n/locales.ts'), 'utf8');
  for (const campo of ['currency', 'dateLocale', 'quote', 'vatName', 'defaultVat']) {
    assert.match(locales, new RegExp('\\b' + campo + '\\b'),
      `🔴 ha desaparecido \`${campo}\` de la tabla de locales. Este ticket retira el CABLEADO del `
      + 'IVA, no la tabla.');
  }
  // Y sus consumidores legítimos siguen ahí.
  assert.equal(accesosA('currency', locales, 'locales.ts').length > 0, true);
});

test('SCRUM-646 · el alta de catálogo ya no pasa ningún tipo', () => {
  const rutas = fs.readFileSync(path.join(RAIZ, 'src/modules/products/app/routes/products.routes.ts'), 'utf8');
  const sf = ts.createSourceFile('products.routes.ts', rutas, ts.ScriptTarget.Latest, true);

  // Por AST: dentro de `POST /load-catalog` no puede quedar ninguna propiedad `vat`/`tax`.
  let dentro = false;
  const encontrados = [];
  (function visitar(n) {
    if (ts.isCallExpression(n) && /router\.post/.test(n.expression.getText(sf))
        && /load-catalog/.test(n.arguments[0] ? n.arguments[0].getText(sf) : '')) {
      dentro = true;
      (function buscar(x) {
        if ((ts.isPropertyAssignment(x) || ts.isShorthandPropertyAssignment(x))
            && ts.isIdentifier(x.name) && (x.name.text === 'vat' || x.name.text === 'tax')) {
          encontrados.push(x.getText(sf).replace(/\s+/g, ' ').slice(0, 50));
        }
        ts.forEachChild(x, buscar);
      }(n));
    }
    ts.forEachChild(n, visitar);
  }(sf));

  assert.equal(dentro, true, '🔴 CIEGO: no encuentro la ruta `load-catalog`. El guard no mide nada.');
  assert.deepEqual(encontrados, [],
    '🔴 el alta de catálogo vuelve a escribir un tipo impositivo:\n' + encontrados.join('\n')
    + '\n  Los productos y las plantillas nacen SIN tipo; lo elige quien crea la línea.');
});
