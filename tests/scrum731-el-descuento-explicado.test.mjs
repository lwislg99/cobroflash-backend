// tests/scrum731-el-descuento-explicado.test.mjs — SCRUM-731
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// UN TOTAL QUE EL CLIENTE NO PUEDE RECONSTRUIR NO ES UN TOTAL: ES UN NÚMERO.
//
// Dos víctimas, y una mucho peor que la otra:
//
//   · EL CLIENTE FINAL recibía un presupuesto en PDF con el total YA REBAJADO y **sin ninguna
//     fila que explicara la diferencia**. Sumaba las líneas, le daba otra cosa, y lo firmaba.
//   · EL PROFESIONAL veía en el editor un campo de descuento global que debía estar oculto.
//
// Las dos salen de la misma familia de defecto: **algo que existe y no llega**. El dato existía
// (`Quote.discountGlobalAmount`), las filas existían (`pieDePresupuesto`, SCRUM-594) y el atributo
// existía (`hidden`); lo que fallaba era el último tramo.
//
// ── LO QUE ESTE FICHERO VIGILA, Y POR QUÉ ASÍ ────────────────────────────────────────────────
//
//   ① LAS PUERTAS. El mismo presupuesto se genera desde TRES sitios. Un test que llame a
//      `generateQuotePdf` directamente pasa lo que quiere y no mide nada: hay que mirar QUIÉN la
//      llama y CON QUÉ. Por AST, con SUELO — si el censo encuentra menos de tres, se declara
//      ciego, porque «no hay defecto» y «no supe mirar» son el mismo número.
//   ② EL PAPEL. Se genera un PDF DE VERDAD, con descuento, y se leen sus filas. Y el rojo NOMBRA
//      lo que falta y por cuánto, no dice «el test falla».
//   ③ EL `hidden`. Censo DERIVADO del árbol de los elementos que se apagan, y la regla global que
//      lo hace imposible en vez de vigilado.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { extraerTextoPdf } from './_texto-del-pdf.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

const { generateQuotePdf } = await import('../dist/modules/invoicing/infra/pdf/pdf.service.js');
const { pieDePresupuesto } = await import('../dist/modules/quotes/domain/presentacionIva.js');

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① LAS TRES PUERTAS
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Los ficheros que generan el PDF del presupuesto. Declarados: añadir uno sin mirar CANTA. */
const FUENTES = [
  'src/modules/quotes/app/routes/quotes.routes.ts',
  'src/modules/system/app/routes/quotesAdmin.routes.ts',
];

/** Cada llamada a `nombre(...)`, con las claves de primer nivel de su objeto argumento. */
function llamadasCon(rel, nombre) {
  const ruta = path.join(RAIZ, rel);
  const sf = ts.createSourceFile(ruta, fs.readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const fuera = [];
  const visitar = (n) => {
    if (ts.isCallExpression(n)) {
      const e = n.expression;
      const llamado = ts.isIdentifier(e) ? e.text : (ts.isPropertyAccessExpression(e) ? e.name.text : null);
      if (llamado === nombre) {
        const props = new Set();
        const arg = n.arguments[0];
        if (arg && ts.isObjectLiteralExpression(arg)) {
          for (const p of arg.properties) {
            if (p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) props.add(p.name.text);
          }
        }
        fuera.push({ donde: `${rel}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`, props });
      }
    }
    n.forEachChild(visitar);
  };
  visitar(sf);
  return fuera;
}

const PUERTAS = FUENTES.flatMap((f) => llamadasCon(f, 'generateQuotePdf'));

test('SCRUM-731 · SUELO: el censo encuentra LAS TRES puertas del PDF del presupuesto', () => {
  assert.equal(PUERTAS.length, 3,
    `🔴 el censo ha encontrado ${PUERTAS.length} llamadas a \`generateQuotePdf\` y sabe que hay 3 `
    + '(crear · regenerar con firma · GET /admin/quotes/:id/pdf). Menos de tres es un analizador '
    + 'ciego, y su verde se lee exactamente igual que «todas las puertas están bien».');
  for (const p of PUERTAS) {
    assert.ok(p.props.size >= 8,
      `🔴 SUELO: la puerta ${p.donde} sólo trae ${p.props.size} claves. El analizador no está `
      + 'leyendo el objeto de verdad.');
  }
});

/**
 * 🔴 LOS CAMPOS QUE EXPLICAN EL TOTAL. No es «todo lo que se pasa»: es lo que, faltando, deja al
 * cliente con un número que no puede reconstruir sumando lo que tiene delante.
 *
 * Hoy es UNO. Si mañana hay otro (un recargo, una retención), se añade aquí y las tres puertas
 * tienen que traerlo — que es lo contrario de descubrirlo cuando un cliente pregunte.
 */
const EXPLICAN_EL_TOTAL = ['discountGlobalAmount'];

test('SCRUM-731 · las TRES puertas pasan lo que explica el total', () => {
  for (const campo of EXPLICAN_EL_TOTAL) {
    const sin = PUERTAS.filter((p) => !p.props.has(campo)).map((p) => p.donde);
    assert.deepEqual(sin, [],
      `🔴 estas puertas NO pasan \`${campo}\`: ${sin.join(', ')}. El mismo presupuesto sale con las `
      + 'filas del descuento o sin ellas según por dónde se pida — y la que las pierde es la que '
      + 'SOBRESCRIBE `quote.pdfUrl`, o sea la que acaba en manos del cliente.');
  }
});

/**
 * CUARENTENA DECLARADA · lo que HOY falta en alguna puerta y NO se arregla en este carril.
 *
 * Va escrito aquí y no en un comentario suelto porque un hueco sin sitio donde declararse es un
 * hueco que nadie vuelve a mirar. La lista **no puede crecer**: si mañana falta un campo más, el
 * test cae y hay que decidir si se arregla o si se declara, pero no puede pasar en silencio.
 *
 * 🔴 `modoIva` es el más grave de los tres y tiene VÍCTIMA HOY: el profesional elige «IVA no
 * incluido» y el PDF que se sirve por esa puerta imprime el desglose igual. Va reportado como
 * hallazgo; es un ticket del asesor, no de este carril.
 */
const HUECOS_DECLARADOS = Object.freeze({
  'src/modules/system/app/routes/quotesAdmin.routes.ts': ['modoIva', 'clausulas', 'clausulasExcluidas'],
  'src/modules/quotes/app/routes/quotes.routes.ts': ['signatureData', 'signedAt', 'tiers'],
});

test('SCRUM-731 · los huecos de las puertas son EXACTAMENTE los declarados', () => {
  const todas = [...new Set(PUERTAS.flatMap((p) => [...p.props]))].sort();
  assert.ok(todas.length >= 15, `🔴 SUELO: sólo ${todas.length} claves distintas entre las tres puertas.`);

  const faltan = new Set();
  for (const p of PUERTAS) for (const k of todas) if (!p.props.has(k)) faltan.add(k);

  const declarados = new Set(Object.values(HUECOS_DECLARADOS).flat());
  const nuevos = [...faltan].filter((k) => !declarados.has(k)).sort();
  assert.deepEqual(nuevos, [],
    `🔴 HAY HUECOS NUEVOS entre las puertas del documento: ${nuevos.join(', ')}. Un campo que una `
    + 'puerta pasa y otra no hace que el MISMO presupuesto salga distinto según por dónde se pida. '
    + 'Decide si se arregla o si se declara en `HUECOS_DECLARADOS`, pero no puede pasar callando.');

  const yaNoFaltan = [...declarados].filter((k) => !faltan.has(k)).sort();
  assert.deepEqual(yaNoFaltan, [],
    `🔴 estos huecos ya NO existen y siguen declarados: ${yaNoFaltan.join(', ')}. Una cuarentena que `
    + 'sobrevive a su causa deja de ser una nota y pasa a ser un permiso.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② EL PAPEL — un PDF de verdad, y un rojo que NOMBRA lo que falta
// ═════════════════════════════════════════════════════════════════════════════════════════

const CASO = {
  merchantId: 731, merchant: { name: 'Taller' }, customer: { name: 'Cliente' },
  currency: 'EUR', qrData: 'x',
  lines: [{ concept: 'Mano de obra', qty: 1, price: 300, tax: 0.21 }],
};

/** El texto del PDF, o un fallo que dice que NO SUPE LEERLO — que no es «no dice nada». */
async function textoDelPdf(params) {
  const { outPath } = await generateQuotePdf(params);
  const r = extraerTextoPdf(fs.readFileSync(outPath));
  assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF: ${r.motivo}. Un texto vacío pasaría por «el `
    + 'documento no dice nada», que es justo el falso verde de este ticket.');
  return r.texto;
}

test('SCRUM-731 · 🔴 con descuento global, el papel LO EXPLICA — y el rojo dice CUÁNTO falta', async () => {
  const DESCUENTO = 50;
  // El total guardado es el REBAJADO: 300 − 50 = 250, +21 % = 302,50.
  const texto = await textoDelPdf({ ...CASO, quoteId: 7311, total: '302.50', discountGlobalAmount: DESCUENTO });

  // Las filas las decide el DOMINIO; aquí se comprueba que llegan al papel, no se recalculan.
  const pie = pieDePresupuesto({
    lineas: CASO.lines, modo: 'sumar', nombreImpuesto: 'IVA', descuentoGlobal: DESCUENTO,
  });
  assert.ok(pie.filas.length >= 3,
    `🔴 SUELO: el dominio sólo produce ${pie.filas.length} filas con descuento; no hay nada que buscar.`);

  const euros = (n) => Math.abs(n).toFixed(2).replace('.', ',');
  for (const fila of pie.filas) {
    const rotulo = fila.etiqueta.replace(':', '');
    assert.ok(texto.includes(rotulo),
      `🔴 FALTA LA FILA «${rotulo}» en el PDF. Con un descuento global de ${euros(DESCUENTO)} € el `
      + 'documento sale con el total ya rebajado y sin decir de dónde viene la diferencia: el '
      + 'cliente suma sus líneas, le da otra cosa, y lo firma igual.');
    assert.ok(texto.includes(euros(fila.importe)),
      `🔴 FALTA EL IMPORTE de «${rotulo}» (${euros(fila.importe)} €) en el PDF. El rótulo sin su `
      + 'número no explica nada.');
  }

  // Y el total sigue siendo el guardado: esto no recalcula, sólo explica.
  assert.ok(texto.includes('302,50'), '🔴 el total impreso ha dejado de ser el guardado');
});

test('SCRUM-731 · CONTROL NEGATIVO: sin descuento, ni una fila de más', async () => {
  const texto = await textoDelPdf({ ...CASO, quoteId: 7312, total: '363.00' });
  assert.ok(texto.includes('363,00'), '🔴 SUELO: el documento ni siquiera trae su total');
  for (const rotulo of ['Suma de líneas', 'Descuento:', 'Descuento global']) {
    assert.equal(texto.includes(rotulo), false,
      `🔴 aparece «${rotulo}» en un presupuesto SIN descuento. El documento de un profesional que `
      + 'no ha rebajado nada no puede hablar de rebajas.');
  }
});

test('SCRUM-731 · la puerta que SOBRESCRIBE `quote.pdfUrl` es la que lo pasa', () => {
  const src = leer('src/modules/system/app/routes/quotesAdmin.routes.ts');
  // Que la clave esté no basta: tiene que estar en ESE endpoint, el que reescribe `pdfUrl`.
  const i = src.indexOf("router.get('/:id/pdf'");
  assert.ok(i > 0, '🔴 SUELO: no encuentro `GET /:id/pdf`; no estoy mirando lo que digo.');
  const fin = src.indexOf('router.', i + 10);
  const bloque = src.slice(i, fin > 0 ? fin : undefined);
  assert.match(bloque, /discountGlobalAmount/,
    '🔴 el endpoint que regenera el PDF y sobrescribe `quote.pdfUrl` no pasa el descuento global.');
  assert.match(bloque, /prisma\.quote\.update\([^)]*pdfUrl/s,
    '🔴 este endpoint ya NO sobrescribe `pdfUrl`. Si eso cambió, la premisa del ticket cambió con '
    + 'ello y hay que volver a medir cuál es la puerta que llega al cliente.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ EL `hidden` — imposible, no vigilado
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Los elementos que se apagan con `hidden`, DERIVADOS del árbol. No es una lista a mano. */
function censoDeApagados(rel) {
  const ruta = path.join(RAIZ, rel);
  const sf = ts.createSourceFile(ruta, fs.readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const base = (e) => { let n = e; while (n && ts.isPropertyAccessExpression(n)) n = n.expression; return n && ts.isIdentifier(n) ? n.text : null; };
  const apagan = new Set(); const clases = new Map();
  const visitar = (n) => {
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isPropertyAccessExpression(n.left) && ts.isIdentifier(n.left.name)) {
      const v = base(n.left.expression);
      if (v && n.left.name.text === 'hidden') apagan.add(v);
      if (v && n.left.name.text === 'className' && ts.isStringLiteral(n.right)) clases.set(v, n.right.text);
    }
    n.forEachChild(visitar);
  };
  visitar(sf);
  return [...apagan].sort().map((v) => ({ variable: v, clase: clases.get(v) ?? null }));
}

test('SCRUM-731 · SUELO: el censo VE los elementos que el editor apaga con `hidden`', () => {
  const censo = censoDeApagados('public/dashboard/js/quotesView.js');
  assert.ok(censo.length >= 5,
    `🔴 el censo sólo encuentra ${censo.length} elementos que se apagan con \`hidden\` en el editor `
    + 'de presupuesto, y se midieron SEIS. Un extractor ciego devuelve pocos, no cero.');
  const conClase = censo.filter((c) => c.clase && c.clase.trim() !== '');
  assert.ok(conClase.length >= 5,
    `🔴 sólo ${conClase.length} traen su clase. Sin clase no se puede saber qué \`display\` les gana.`);
});

test('SCRUM-731 · 🔴 la regla que apaga es GLOBAL: el defecto es imposible, no vigilado', () => {
  const css = leer('public/dashboard/css/styles.css');
  assert.match(css, /^\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/m,
    '🔴 falta la regla global `[hidden] { display: none !important; }`. Sin ella, CUALQUIER clase '
    + 'de autor que declare `display` gana al atributo del navegador y `el.hidden = true` deja de '
    + 'ocultar — medido: cinco de los seis elementos del editor seguían visibles.');

  // Y el `!important` no es adorno: sin él, `.quote-conceptos { display: flex }` le gana.
  assert.match(css, /\.quote-conceptos\s*\{[^}]*display:\s*flex/,
    '🔴 SUELO: ya no existe la clase con la que se midió el defecto; esta prueba no demuestra nada.');
});

test('SCRUM-731 · TRINQUETE: las reglas `.clase[hidden]` no pueden crecer', () => {
  const css = leer('public/dashboard/css/styles.css');

  // 🔴 LOS COMENTARIOS SE QUITAN ANTES DE MIRAR, y no es una precaución teórica: la primera
  // versión de este trinquete SE CAZÓ A SÍ MISMA. El comentario que explica por qué existe la
  // regla global escribe `[hidden]` varias veces en prosa, y el extractor contó esas como
  // selectores — dio rojo enseñando un trozo de frase («…con la misma especificidad o más le
  // gana») en el sitio donde debía ir un selector. Es exactamente el defecto que avisa
  // `cerebro-yaqu`: «un guard de TEXTO se caza a sí mismo en el comentario que explica la
  // prohibición».
  const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(sinComentarios.includes('[hidden] { display: none !important; }'),
    '🔴 SUELO: al quitar los comentarios se ha ido también la regla global. El extractor está '
    + 'mirando otra cosa y lo de abajo no mediría nada.');

  // Sólo las que llevan un selector DELANTE (las por clase). La global no cuenta: su selector
  // EMPIEZA por `[hidden]` y es justo la que hace innecesarias a las demás.
  const porClase = [...sinComentarios.matchAll(/^\s*([^\s{][^{]*?)\[hidden\]\s*\{/gm)]
    .map((m) => m[1].trim() + '[hidden]');
  assert.deepEqual(porClase.sort(), ['.aviso-duplicado[hidden]', '.quote-direccion-obra[hidden]'],
    `🔴 las reglas \`[hidden]\` POR CLASE han cambiado: ${porClase.join(', ')}. Las dos que hay son `
    + 'anteriores a la regla global y se conservan por historia. Una tercera significaría que '
    + 'alguien volvió a arreglar el síntoma en vez de fiarse de la global, que ya las cubre todas.');
});
