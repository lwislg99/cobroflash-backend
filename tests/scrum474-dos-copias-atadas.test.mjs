// tests/scrum474-dos-copias-atadas.test.mjs — SCRUM-474
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA PARTICIÓN `<metodo>:<pasarela>` ESTÁ ESCRITA DOS VECES, A PROPÓSITO, Y AQUÍ SE CUENTA.
//
// `partirMetodo` (`src/modules/billing/domain/metodoDeCobro.ts`) la implementa para el servidor.
// `metodoSinPasarela` (`public/dashboard/js/cobrosView.js`) la implementa otra vez para el
// navegador. **La copia es inevitable**: la regla dura 4 —vanilla, sin bundler— impide que la
// pantalla importe TypeScript compilado a `dist/` para el servidor.
//
// Lo que NO es inevitable es que nadie las cuente. Este fichero es el sitio donde constan, y las
// vigila por DOS mecanismos distintos porque uno solo no basta:
//
//   ① COMPORTAMIENTO — mismo corpus, mismo veredicto. Caza que una DERIVE de la otra.
//   ② TRINQUETE ESTRUCTURAL — cuántas implementaciones de la partición hay en el árbol. Caza que
//     nazca una TERCERA, y la nombra.
//
// 🔴 POR QUÉ HACEN FALTA LOS DOS. Un test de comportamiento **aprueba la bifurcación el día
// exacto en que se introduce**: ese día la copia nueva todavía coincide con las viejas, así que
// pasa en verde y solo salta meses después, cuando ya divergieron y alguien cobró de menos por
// el camino. Medido en SCRUM-361 (11-ago-2026): se reimplementó a mano una comparación y los
// CUATRO tests de comportamiento siguieron verdes; solo cayó el guard estructural.
//
// La salida buena —delegar en vez de copiar, «importar es leer, una divergencia imposible gana a
// una vigilada»— **aquí no existe**. Por eso: se copia, se cuenta, y se pone un trinquete.
//
// Alcance declarado: `docs/master/SCRUM-474.md`, apéndice §3.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(import.meta.url);
const DOC = 'docs/master/SCRUM-474.md';

// El NAVEGADOR: el fichero vanilla tal cual lo carga el dashboard.
const { metodoSinPasarela, COBROS_METODOS } =
  require_(path.join(RAIZ, 'public/dashboard/js/cobrosView.js'));
// El SERVIDOR: el módulo compilado, no su fuente. Se ejerce lo que corre.
const { metodoParaAgrupar, partirMetodo } =
  await import('../dist/modules/billing/domain/metodoDeCobro.js');
const { PAID_VIA } = await import('../dist/modules/billing/domain/paidVia.js');

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① COMPORTAMIENTO — las dos copias, mismo corpus, mismo veredicto
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Todas las cajas de la pantalla, aplanadas: la ÚNICA lista de qué valor cae en qué cubo. */
const CASAS = COBROS_METODOS.flatMap((m) => m.casa);

/**
 * El veredicto del NAVEGADOR, comparable con el del servidor.
 *
 * ⚠️ No se compara el CUBO contra el método: `bizum_auto` y `bizum_manual` comparten el cubo
 * «Bizum» por decisión de presentación de SCRUM-285 —filtrar por cuatro, leer los cinco— y eso
 * es un agrupamiento de rótulo, no una fusión de evidencia. Lo comparable es la PARTICIÓN: qué
 * base sale, y si esa base consta.
 */
function veredictoNavegador(valor) {
  const base = metodoSinPasarela(valor);
  if (!base) return null;
  return CASAS.indexOf(base) !== -1 ? base : null;
}

const veredictoServidor = (valor) => metodoParaAgrupar(valor);

/**
 * El corpus se DERIVA de `PAID_VIA`, no se escribe a mano.
 *
 * Si mañana el conjunto cerrado crece, el corpus crece con él y las dos copias tienen que seguir
 * coincidiendo sobre el valor nuevo. Una lista fija aquí sería la tercera copia del conjunto —
 * exactamente el defecto que `metodoDeCobro.ts` se escribió para no cometer.
 */
const HUERFANOS = ['bizum', 'bank', 'mp', 'desconocido', 'SCTinst']; // censo SCRUM-473 §2 y §5
const PASARELAS = ['stripe', 'mercadopago', 'Stripe', '', ':stripe'];

function corpus() {
  const out = [];
  for (const base of [...PAID_VIA, ...HUERFANOS]) {
    out.push(base, base.toUpperCase(), `  ${base} `);
    for (const p of PASARELAS) out.push(`${base}:${p}`);
  }
  // Degenerados y no-cadenas: lo que no es un método tampoco puede divergir.
  out.push('', '   ', ':', ':stripe', '::', 'card:', 'card::stripe',
    null, undefined, 42, {}, [], true);
  return out;
}

test('SCRUM-474 · SUELO: las dos copias se cargan y clasifican un valor simple', () => {
  assert.equal(typeof metodoSinPasarela, 'function',
    '🔴 el navegador no exporta `metodoSinPasarela`: lo de abajo no compararía nada.');
  assert.equal(typeof partirMetodo, 'function',
    '🔴 el servidor no exporta `partirMetodo`. ¿Se ha compilado `dist/`?');
  assert.ok(PAID_VIA.length >= 5, `🔴 PAID_VIA trae ${PAID_VIA.length} valores: no se ha leído bien.`);
  assert.ok(CASAS.length >= 5, `🔴 la pantalla declara ${CASAS.length} métodos: el corpus mediría de menos.`);
  // Control positivo del instrumento: si esto no clasifica, un verde de abajo sería vacío.
  assert.equal(veredictoServidor('transfer'), 'transfer');
  assert.equal(veredictoNavegador('transfer'), 'transfer');
});

test('SCRUM-474 · ① las DOS copias dan el MISMO veredicto en todo el corpus', () => {
  const casos = corpus();
  assert.ok(casos.length >= 60, `🔴 el corpus son ${casos.length} casos: se está midiendo de menos.`);

  const divergen = [];
  for (const v of casos) {
    const s = veredictoServidor(v);
    const n = veredictoNavegador(v);
    if (s !== n) divergen.push(`«${String(v)}» → servidor=${JSON.stringify(s)} navegador=${JSON.stringify(n)}`);
  }
  assert.deepEqual(divergen, [],
    '🔴 LAS DOS COPIAS DE LA PARTICIÓN HAN DIVERGIDO. `partirMetodo` (servidor) y ' +
    '`metodoSinPasarela` (navegador) tienen que decidir lo mismo sobre el mismo valor: si no, la ' +
    'pantalla de Cobros clasifica un cobro de una forma y el servidor de otra, sobre el MISMO ' +
    'dato. Se ha cambiado una y no la otra:\n  ' + divergen.join('\n  '));
});

test('SCRUM-474 · ① el conjunto cerrado y las cajas de la pantalla cubren lo mismo', () => {
  // Si `PAID_VIA` crece y la pantalla no, ese método nuevo cae en «Método no registrado»: un cobro
  // válido escondido detrás de un rótulo que dice que no consta cómo entró el dinero.
  const sinCaja = PAID_VIA.filter((v) => CASAS.indexOf(v) === -1);
  assert.deepEqual(sinCaja, [],
    `🔴 estos métodos son válidos y la pantalla no tiene caja para ellos: ${sinCaja.join(', ')}. ` +
    'El profesional filtraría y no los vería en ningún cubo con nombre.');
  const sinConjunto = CASAS.filter((v) => PAID_VIA.indexOf(v) === -1);
  assert.deepEqual(sinConjunto, [],
    `🔴 la pantalla filtra por métodos que no están en el conjunto cerrado: ${sinConjunto.join(', ')} ` +
    '(regla 22). O el conjunto se quedó corto, o la pantalla se inventó un método.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② TRINQUETE — cuántas implementaciones de la partición hay, y cuáles
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * 🔴 EL REGISTRO. Estas DOS son las copias deliberadas, y no hay más.
 *
 * Para añadir una tercera no basta con escribirla: hay que declararla aquí, y quien la declare
 * tiene que poder explicar por qué no delega en una de las dos que ya existen. Ese es el trinquete
 * — no impide copiar, impide copiar EN SILENCIO.
 */
const PARTICIONES_DECLARADAS = [
  { fichero: 'src/modules/billing/domain/metodoDeCobro.ts', funcion: 'partirMetodo' },
  { fichero: 'public/dashboard/js/cobrosView.js', funcion: 'metodoSinPasarela' },
];

const ES_FUNCION = (n) => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n)
  || ts.isArrowFunction(n) || ts.isMethodDeclaration(n);

/** ¿El cuerpo parte por el primer `:`? (`indexOf`/`split`/`lastIndexOf` con `':'` literal) */
function parteporDosPuntos(fn) {
  let si = false;
  (function rec(n) {
    if (si) return;
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
      && ['indexOf', 'split', 'lastIndexOf'].includes(n.expression.name.text)) {
      const a = n.arguments[0];
      if (a && ts.isStringLiteral(a) && a.text === ':') si = true;
    }
    ts.forEachChild(n, rec);
  })(fn);
  return si;
}

/** ¿Y se queda con la parte de DELANTE? (`slice`/`substring`/`substr`, o `[0]`) */
function tomaLaCabeza(fn) {
  let si = false;
  (function rec(n) {
    if (si) return;
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
      && ['slice', 'substring', 'substr'].includes(n.expression.name.text)) si = true;
    if (ts.isElementAccessExpression(n) && ts.isNumericLiteral(n.argumentExpression)
      && n.argumentExpression.text === '0') si = true;
    ts.forEachChild(n, rec);
  })(fn);
  return si;
}

function nombreDe(n) {
  if (n.name && ts.isIdentifier(n.name)) return n.name.text;
  const p = n.parent;
  if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text;
  if (p && ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)) return p.name.text;
  return '(anónima)';
}

/** Las funciones de un fuente que implementan la partición. */
function particionesDe(ruta, texto) {
  const sf = ts.createSourceFile(ruta, texto, ts.ScriptTarget.Latest, true);
  const out = [];
  (function rec(n) {
    if (ES_FUNCION(n) && n.body && parteporDosPuntos(n) && tomaLaCabeza(n)) {
      out.push({ funcion: nombreDe(n), linea: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1 });
    }
    ts.forEachChild(n, rec);
  })(sf);
  return out;
}

function fuentesDelProducto(dir, exts, out = []) {
  const abs = path.join(RAIZ, dir);
  if (!fs.existsSync(abs)) return out;
  (function rec(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') rec(p); }
      else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
    }
  })(abs);
  return out;
}

test('SCRUM-474 · ② SUELO: el detector de particiones VE y DISCRIMINA', () => {
  // 🔴 Sin esto, «no hay una tercera copia» y «el detector está ciego» dan el MISMO verde.
  const conParticion = particionesDe('sintetico.js',
    'function copiaNueva(v) { var i = v.indexOf(":"); return v.slice(0, i); }');
  assert.equal(conParticion.length, 1,
    '🔴 el detector no ve una partición escrita delante de sus narices: el trinquete de abajo no ' +
    'mide nada y una tercera copia entraría sin que salte nadie.');
  assert.equal(conParticion[0].funcion, 'copiaNueva');

  // Y la otra mitad: que no marque cualquier cosa que toque cadenas.
  const sinParticion = particionesDe('sintetico2.js',
    'function nada(v) { return v.trim().toLowerCase().slice(0, 3) + v.indexOf("-"); }');
  assert.deepEqual(sinParticion, [],
    '🔴 el detector marca funciones que NO parten por `:`. Un trinquete que salta con todo se ' +
    'acaba silenciando, y entonces no protege de nada.');
});

test('SCRUM-474 · ② 🔴 TRINQUETE: no hay una TERCERA implementación de la partición', () => {
  const fuentes = [
    ...fuentesDelProducto('src', ['.ts']),
    ...fuentesDelProducto('public', ['.js']),
    ...fuentesDelProducto('scripts', ['.mjs', '.js']),
  ];
  assert.ok(fuentes.length >= 200,
    `🔴 solo se han barrido ${fuentes.length} ficheros: el censo está mirando de menos.`);

  const encontradas = [];
  for (const f of fuentes) {
    const rel = path.relative(RAIZ, f).replace(/\\/g, '/');
    for (const p of particionesDe(f, fs.readFileSync(f, 'utf8'))) {
      encontradas.push({ fichero: rel, funcion: p.funcion, linea: p.linea });
    }
  }

  // Las declaradas tienen que seguir estando: si una desaparece, el registro miente.
  for (const d of PARTICIONES_DECLARADAS) {
    assert.ok(encontradas.some((e) => e.fichero === d.fichero && e.funcion === d.funcion),
      `🔴 la copia declarada \`${d.funcion}\` ya no está en ${d.fichero}. O se ha movido —y el ` +
      `registro de este test hay que moverlo con ella— o ha dejado de partir por «:», y entonces ` +
      'las dos copias ya no hacen lo mismo.');
  }

  const nuevas = encontradas.filter(
    (e) => !PARTICIONES_DECLARADAS.some((d) => d.fichero === e.fichero && d.funcion === e.funcion));
  assert.deepEqual(nuevas.map((n) => `${n.fichero}:${n.linea} ${n.funcion}()`), [],
    '🔴 HAY UNA IMPLEMENTACIÓN NUEVA DE LA PARTICIÓN `<metodo>:<pasarela>`, Y NADIE LA HA CONTADO.\n' +
    '  Ya existen DOS copias deliberadas —`partirMetodo` en el servidor y `metodoSinPasarela` en ' +
    'el navegador— y están así porque la regla 4 impide que el navegador importe de `src/`. Una ' +
    'TERCERA no tiene esa excusa: casi siempre puede llamar a una de las dos.\n' +
    '  Antes de declararla en `PARTICIONES_DECLARADAS`, hay que poder decir por qué no delega. ' +
    `Está documentado en ${DOC} §3.\n  Nueva(s):`);
});

test('SCRUM-474 · ② el documento declara el MISMO número de copias que se miden', () => {
  // Una copia «declarada en un sitio que alguien lea» solo sirve si el sitio no deriva. Sin esto,
  // el documento diría «dos» tres copias después.
  const doc = fs.readFileSync(path.join(RAIZ, DOC), 'utf8');
  assert.match(doc, new RegExp(`COPIAS_DE_LA_PARTICION\\s*=\\s*${PARTICIONES_DECLARADAS.length}\\b`),
    `🔴 ${DOC} no declara COPIAS_DE_LA_PARTICION = ${PARTICIONES_DECLARADAS.length}, que es lo ` +
    'que este test vigila. El documento y el trinquete tienen que decir el mismo número, o el ' +
    'documento se queda contando copias viejas.');
  for (const d of PARTICIONES_DECLARADAS) {
    assert.ok(doc.includes(d.funcion),
      `🔴 ${DOC} no nombra \`${d.funcion}\`, que es una de las copias declaradas.`);
  }
});
