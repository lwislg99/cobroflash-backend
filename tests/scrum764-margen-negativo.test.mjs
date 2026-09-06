// tests/scrum764-margen-negativo.test.mjs — SCRUM-764
//
// Sin gate: aritmética sin DOM, AST sobre la vista y lectura del CSS. Ni BD, ni red, ni navegador.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL MARGEN NEGATIVO SE VE.
//
// `margenDesde(150, 100)` devuelve **−50** y la ficha del catálogo lo enseñaba con la misma tinta
// que un 30 %. Medido en navegador ANTES de tocar nada, con los tres artículos abiertos por su
// botón «Editar» y leyendo el estilo calculado:
//
//     Termo 80 L      70/100   margen  30   color rgb(15,28,23)  fondo rgb(255,255,255)
//     Caldera de gas 150/100   margen −50   color rgb(15,28,23)  fondo rgb(255,255,255)   ← igual
//     Detector       300/1000  margen  70   color rgb(15,28,23)  fondo rgb(255,255,255)
//
// …y el texto visible de la ficha era la MISMA cadena en los tres. El profesional firma un
// presupuesto perdiendo dinero y se entera al facturar.
//
// ── 🔴 QUÉ SE DECIDIÓ, Y POR QUÉ NO ES «RECHAZARLO» ────────────────────────────────────────
// SE AVISA, NO SE IMPIDE. Vender por debajo del coste es una decisión legítima —una oferta
// gancho, un trabajo que se quiere ganar— y rechazarlo dejaría catálogos reales sin poder
// guardarse, que es el mismo motivo por el que el coste NO es obligatorio (SCRUM-609 midió 8 de 8
// productos sin coste). Es un ÁMBAR: se avisa y se sigue, no se bloquea.
//
// Y EL TRATAMIENTO NO SE ESTRENA AQUÍ: `quotesDetailView.js` ya pinta en rojo el margen negativo
// del trabajo (`data.margin >= 0 ? var(--brand) : var(--red-600)`, con `--red-50` de fondo). Esto
// pone al catálogo de acuerdo con una decisión que ya está en producción — por eso no hace falta
// ni un texto nuevo (regla 30): sólo color.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const M = require(path.join(RAIZ, 'public/dashboard/js/margenCatalogo.js'));
const VISTA = path.join(RAIZ, 'public/dashboard/js/productsView.js');
const CSS = path.join(RAIZ, 'public/dashboard/css/styles.css');
const CLASE = 'catalogo-margen--bajo-coste';

// ═══ ① EL QUE DECIDE ═════════════════════════════════════════════════════════════════════

test('SCRUM-764 · 🔴 EL QUE DECIDE: el caso del ticket, 150/100, sale marcado como bajo coste', () => {
  const m = M.margenDesde(150, 100);
  assert.equal(m, -50,
    `🔴 el margen de coste 150 y precio 100 ha salido ${m} y tiene que ser −50. Si esto cambia, `
    + 'ha cambiado la fórmula y este ticket entero mide otra cosa.');
  assert.equal(M.bajoCoste(m), true,
    '🔴 un margen de −50 % NO se está marcando como venta por debajo del coste. Es EXACTAMENTE el '
    + 'caso del ticket: el precio final queda por debajo del coste y nada se lo dice al profesional.');
});

test('SCRUM-764 · 🔴 y cualquier margen negativo, no sólo el del ticket', () => {
  // Bordes DERIVADOS del criterio (`< 0`), no números escritos a mano: el que decide es el cero.
  for (const m of [-0.01, -1, -50, -99.99, -100, -1000]) {
    assert.equal(M.bajoCoste(m), true, `🔴 ${m} % no se marca, y es venta por debajo del coste.`);
  }
});

// ═══ ② EL CONTROL POSITIVO: lo normal sigue igual ════════════════════════════════════════

test('SCRUM-764 · ✅ POSITIVO: un margen normal NO se marca, y el cero tampoco', () => {
  for (const m of [30, 70, 0.01, 1, 99.99, 100]) {
    assert.equal(M.bajoCoste(m), false,
      `🔴 ${m} % se está marcando como bajo coste y no lo es. Un aviso que sale siempre no avisa.`);
  }
  // 🔴 EL CERO ES EL BORDE Y VA APARTE: vender AL coste no es vender por debajo. Marcarlo sería
  // teñir de rojo el caso de quien trabaja a precio de coste a propósito.
  assert.equal(M.bajoCoste(0), false,
    '🔴 margen 0 se marca como bajo coste. Vender al coste exacto no es perder dinero.');
  // Y el caso de siempre del módulo, intacto.
  assert.equal(M.margenDesde(300, 1000), 70, '🔴 se ha movido la convención de SCRUM-609.');
});

test('SCRUM-764 · 🔴 «no se sabe» NO es «va mal»: sin coste no hay rojo', () => {
  // SCRUM-609 midió 8 de 8 productos de desarrollo SIN coste. Si lo ilegible se marcara, un
  // catálogo entero saldría en rojo diciendo algo que nadie ha calculado.
  for (const v of [null, undefined, '', '   ', 'abc', NaN, {}, []]) {
    assert.equal(M.bajoCoste(v), false,
      `🔴 ${JSON.stringify(String(v))} se marca como bajo coste, y no es un margen: es la ausencia `
      + 'de uno. `margenDesde` devuelve `null` justo para no inventarse un número.');
  }
  assert.equal(M.bajoCoste(M.margenDesde(null, 500)), false,
    '🔴 un artículo SIN COSTE sale marcado. No se sabe su margen, así que no puede ir mal.');
});

// ═══ ③ EL CONTROL NEGATIVO: el techo del imposible POR ARRIBA sigue vivo ══════════════════

test('SCRUM-764 · ✅ NEGATIVO: añadir el suelo por abajo NO ha roto el techo por arriba', () => {
  // El guard que ya existía: un margen ≥ 100 % no tiene precio que lo cumpla (el denominador
  // 1 − m/100 es cero o negativo), así que `precioDesde` devuelve `null` en vez de un infinito
  // disfrazado. Los bordes salen del criterio, no de una lista.
  //
  // 🔴 HALLAZGO MEDIDO, Y SE DEJA ESCRITO PORQUE SI NO EL SIGUIENTE TROPIEZA IGUAL: el techo está
  // guardado DOS VECES, y las dos guardas son **MUTUAMENTE REDUNDANTES** — cada una basta sola:
  //
  //     if (m >= 100) return null;        ← para m ≥ 100
  //     var denom = 1 - (m / 100);
  //     if (denom <= 0) return null;      ← para m ≥ 100 también, porque ahí denom ≤ 0
  //
  // O sea que NINGUNA MUTACIÓN DE UNA SOLA LÍNEA puede tumbar el techo, y las dos se probaron:
  // romper `m >= 100` sale muda, y romper `denom <= 0` TAMBIÉN. No es que este test no mire —es
  // que el comportamiento no cambia—, y por eso la mutación declarada abajo quita LAS DOS a la
  // vez, que es la única forma de que el defecto exista de verdad.
  //
  // No se ha tocado el módulo: quitar una de las dos es un cambio que nadie ha pedido y la
  // duplicidad no hace daño. Queda dicho para que no se lea como cobertura de más.
  assert.equal(M.precioDesde(150, 100), null, '🔴 el techo de 100 % ha dejado de parar.');
  assert.equal(M.precioDesde(150, 100.01), null, '🔴 justo por encima del techo ya no para.');
  assert.equal(M.precioDesde(150, 120), null, '🔴 un margen imposible del 120 % devuelve precio.');
  // Y justo por DEBAJO del techo sigue calculando: un techo que lo para todo no es un techo.
  assert.equal(M.precioDesde(150, 60), 375,
    '🔴 un margen posible ha dejado de dar precio: el techo se ha comido los casos buenos.');
  assert.equal(M.precioDesde(150, 99.99), 1500000,
    '🔴 justo por debajo del techo tiene que seguir habiendo precio.');
});

// ═══ ④ EL CABLEADO EN LA VISTA, POR AST ══════════════════════════════════════════════════

test('SCRUM-764 · 🔴 la vista PINTA el margen en los tres sitios donde el campo cambia', () => {
  // Por AST y no por `grep`: lo que cuenta son las LLAMADAS, y los comentarios de este mismo
  // fichero escriben el nombre varias veces.
  const codigo = fs.readFileSync(VISTA, 'utf8');
  const sf = ts.createSourceFile('productsView.js', codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const llamadas = [];
  const v = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'pintarMargen') {
      llamadas.push(sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1);
    }
    ts.forEachChild(n, v);
  };
  v(sf);
  assert.ok(llamadas.length >= 3,
    `🔴 sólo hay ${llamadas.length} llamada(s) a \`pintarMargen\` y hacen falta TRES, porque el `
    + 'campo cambia en tres sitios y en los tres puede quedarse mintiendo:\n'
    + '  · al ABRIR la ficha — el valor lo escribe la vista, no el teclado: sin esto un artículo '
    + 'que ya está bajo coste se abre en negro;\n'
    + '  · en `aplicar` del autocompletado — y SIEMPRE, no sólo al escribir, o un margen que pasa '
    + 'a positivo se queda rojo para siempre;\n'
    + '  · al LIMPIAR el alta — vaciar el campo no le quita la clase, y el alta siguiente nacería '
    + `avisando de un margen que ya no hay.\n  Están en las líneas: ${llamadas.join(', ')}.`);
});

test('SCRUM-764 · 🔴 la regla de «bajo coste» la decide el MÓDULO, no la vista', () => {
  // Si la vista comparara `< 0` por su cuenta, habría dos sitios decidiendo lo mismo y podrían
  // decidirlo distinto — que es justo lo que este ticket censó antes de tocar nada.
  const codigo = fs.readFileSync(VISTA, 'utf8');
  const sf = ts.createSourceFile('productsView.js', codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let usaElModulo = false;
  const v = (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
      && n.expression.name.text === 'bajoCoste') usaElModulo = true;
    ts.forEachChild(n, v);
  };
  v(sf);
  assert.ok(usaElModulo,
    '🔴 la vista ya no llama a `margenCatalogo.bajoCoste`: la regla se ha copiado a la pantalla. '
    + 'La aritmética y su criterio viven en UN sitio, con su test y sin DOM (SCRUM-609).');
});

// ═══ ⑤ EL COLOR: QUE LLEGUE A AA, MEDIDO SOBRE LOS TOKENS DE VERDAD ══════════════════════

/** Contraste WCAG entre dos `#rrggbb`. */
function contraste(a, b) {
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lin = (c) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const l1 = L(hex(a)); const l2 = L(hex(b));
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
/** El valor de un token, LEÍDO de `tokens.css`. Nada de hexadecimales escritos aquí. */
function token(nombre) {
  const css = fs.readFileSync(path.join(RAIZ, 'public/tokens.css'), 'utf8');
  const m = new RegExp(`--${nombre}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  return m && m[1];
}
/** AA para texto normal. No es una preferencia: es el número de AB6. */
const AA_TEXTO_NORMAL = 4.5;

test('SCRUM-764 · 🔴 EL QUE ME CAZÓ A MÍ: el rojo del campo llega a AA', () => {
  // 🔴 ESTE TEST EXISTE PORQUE EL PRIMER INTENTO NO PASABA. Puse `--danger` (#dc2626) sobre
  // `--danger-bg`, que es lo que hace `quotesDetailView`, y medido en navegador dio **4,41**
  // contra los 4,5 de AA. Allí funciona porque su cifra es texto GRANDE (AA pide 3,0); aquí es
  // un `<input>` de 15 px. `--danger-ink` da 7,6 sobre el mismo fondo.
  const tinta = token('danger-ink');
  const fondo = token('danger-bg');
  assert.ok(tinta && fondo,
    `🔴 CIEGO: no encuentro los tokens en \`tokens.css\` (tinta=${tinta}, fondo=${fondo}). `
    + 'Sin leerlos, este test mediría números escritos aquí y no los que se pintan.');

  // SUELO DEL MEDIDOR: si su aritmética estuviera mal, cualquier veredicto suyo daría igual.
  assert.equal(Math.round(contraste('#000000', '#ffffff')), 21,
    '🔴 el medidor de contraste no da 21 para negro sobre blanco: no vale para juzgar nada.');

  const r = contraste(tinta, fondo);
  assert.ok(r >= AA_TEXTO_NORMAL,
    `🔴 el margen en rojo se pinta ${tinta} sobre ${fondo} y da ${r.toFixed(2)} de contraste, `
    + `por debajo de los ${AA_TEXTO_NORMAL} de AA para texto normal (AB6). Un aviso que no se lee `
    + 'no avisa.');

  // Y el CONTROL NEGATIVO del propio umbral: el que NO pasaba tiene que seguir sin pasar, o este
  // test estaría dando por bueno cualquier rojo.
  const flojo = contraste(token('danger'), fondo);
  assert.ok(flojo < AA_TEXTO_NORMAL,
    `🔴 \`--danger\` sobre \`--danger-bg\` ahora da ${flojo.toFixed(2)}, que ya pasa AA. Si los `
    + 'tokens han cambiado, este test ha dejado de vigilar lo que vigilaba: vuelve a medirlo.');
});

test('SCRUM-764 · 🔴 y la clase existe en el CSS con esa tinta', () => {
  const css = fs.readFileSync(CSS, 'utf8');
  const bloque = new RegExp(`\\.field input\\.${CLASE}\\s*\\{([^}]*)\\}`).exec(css);
  assert.ok(bloque, `🔴 no existe la regla \`.field input.${CLASE}\` en \`styles.css\`: la vista `
    + 'pone una clase que no pinta nada, o sea que el margen negativo sigue sin verse.');
  assert.match(bloque[1], /color:\s*var\(--danger-ink\)/,
    `🔴 la regla ya no usa \`--danger-ink\`. Es el token que llega a AA: con \`--danger\` el `
    + 'contraste baja a 4,41 y el aviso deja de leerse.');
  // El foco tiene que seguir viéndose: AB6 pide anillo de foco visible.
  assert.match(css, new RegExp(`\\.field input\\.${CLASE}:focus`),
    '🔴 falta la regla de :focus. Sin ella el campo que avisa es justo el que pierde el anillo de '
    + 'foco, porque su `border-color` en rojo gana al del foco.');
});

/** 🔴 LAS MUTACIONES QUE TIENEN QUE TUMBARME (contrato de SCRUM-745). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // ① El defecto original, exacto: el margen negativo deja de marcarse.
    fichero: 'public/dashboard/js/margenCatalogo.js',
    de: '    return Number(margen) < 0;',
    a: '    return false;',
    cae: 'EL QUE DECIDE: el caso del ticket, 150/100, sale marcado como bajo coste',
  },
  {
    // ② El aviso que sale siempre: marcar también lo normal, que es no avisar de nada.
    fichero: 'public/dashboard/js/margenCatalogo.js',
    de: '    if (!hayNumero(margen)) return false;\n    return Number(margen) < 0;',
    a: '    return true;',
    cae: 'POSITIVO: un margen normal NO se marca, y el cero tampoco',
  },
  {
    // ③ El techo por arriba, roto: es el control negativo que el encargo pedía por su nombre.
    //
    // 🔴 QUITA LAS DOS GUARDAS A LA VEZ, Y ESO SE DECIDIÓ MIDIENDO. Las dos mutaciones de UNA
    // línea se ejecutaron y las dos salieron **MUDAS**: `m >= 100` y `denom <= 0` guardan lo
    // mismo, así que romper cualquiera de ellas por separado no cambia el comportamiento.
    // Declarar una de ésas habría metido en el contrato una mutación incazable, y su mudez
    // habría acusado a este test de no mirar cuando lo que no cambiaba era el producto.
    fichero: 'public/dashboard/js/margenCatalogo.js',
    de: '    if (m >= 100) return null;\n    var denom = 1 - (m / 100);\n    if (denom <= 0) return null;',
    a: '    var denom = 1 - (m / 100);',
    cae: 'NEGATIVO: añadir el suelo por abajo NO ha roto el techo por arriba',
  },
  {
    // ④ El rojo que no se lee: volver al token que medía 4,41.
    fichero: 'public/dashboard/css/styles.css',
    de: '  color: var(--danger-ink);\n  border-color: var(--red-600);',
    a: '  color: var(--red-600);\n  border-color: var(--red-600);',
    cae: 'y la clase existe en el CSS con esa tinta',
  },
];
