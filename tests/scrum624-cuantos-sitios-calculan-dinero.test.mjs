// tests/scrum624-cuantos-sitios-calculan-dinero.test.mjs — SCRUM-624
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// CUÁNTOS SITIOS CALCULAN DINERO, Y CUÁNTAS CONVENCIONES DE REDONDEO CONVIVEN
//
// 🔴 ESTE FICHERO NO CAMBIA NINGÚN CÁLCULO. Mide, y pone un trinquete para que lo medido no
// empeore mientras se decide. SCRUM-624 es «medir y proponer»; la propuesta vive en
// `docs/master/SCRUM-624.md`.
//
// ── LA PREGUNTA QUE LO ABRE ─────────────────────────────────────────────────────────────
//
// El PDF de la factura no imprime el `total` guardado: lo RECALCULA de las líneas
// (`pdf.service.ts:411`, pintado en `:513`). Mientras los dos números coincidan da igual; el
// ticket llevaba abierto desde el 24-ago la pregunta de si hay algún camino REAL por el que se
// separen. Lo hay, y son dos:
//
//   ① el REDONDEO. Tres líneas de 9,99 € al 21 % dan 36,27 por la convención escrita (céntimo
//      por línea, `albaranAFactura.ts:275`) y 36,26 por la del PDF (float acumulado, sin
//      redondear hasta `fmt`). Un céntimo.
//   ② los DECIMALES DEL PRECIO. `price` es `z.number().nonnegative()` en
//      `core/validation/schemas.ts:16`: **nada limita a dos decimales**. Medido en staging, la
//      única factura divergente de siete tiene una línea con `price: 30.003`.
//
// ── POR QUÉ UN CENSO Y NO UNA LISTA ─────────────────────────────────────────────────────
//
// Porque una lista escrita a mano no avisa de lo que le falta. Y por AST, no por texto: la
// familia de defectos que ha mordido tres veces en dos días es la del substring —`data-view="parte`
// cazando `partes-oficina`, `MARCADOR_MICROCOPY` casando dentro de `PV_MARCADOR_MICROCOPY`—.
// Aquí se compara por IDENTIDAD de nodo: `Math.round` es `Math` + `round`, no la cadena.
//
// 🔴 Y LLEVA SU PROPIA LECCIÓN: la primera versión de este censo exigía que la expresión tocara
// un nombre de dinero, y por eso NO veía `round2(n)` en `finalInvoice.service.ts:57` — el helper
// es genérico y su parámetro se llama `n`. Devolvía 119 sitios y 4 ficheros con mezcla; contando
// todo redondeo con factor 100, son 202 y 12. Un censo que exige demasiado devuelve un número
// más bajo en vez de declararse ciego.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function ficherosDeCodigo() {
  const salida = [];
  const anda = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) anda(p);
      else if (/\.(ts|js)$/.test(e.name)) salida.push(p);
    }
  };
  anda(path.join(RAIZ, 'src'));
  anda(path.join(RAIZ, 'public'));
  return salida;
}

/**
 * Las tres formas de REDONDEAR que conviven, cada una reconocida por su forma en el AST:
 *   · `Math.round(x * 100)`        → céntimos enteros
 *   · `Math.round(x * 100) / 100`  → decimal a dos
 *   · `x.toFixed(2)`               → texto con dos decimales
 */
function censoDeRedondeos() {
  const porFichero = new Map();
  for (const f of ficherosDeCodigo()) {
    let sf;
    try {
      sf = ts.createSourceFile(path.basename(f), fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true);
    } catch { continue; }
    const rel = f.slice(RAIZ.length + 1).split(path.sep).join('/');
    const visitar = (n) => {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
        const objeto = n.expression.expression;
        const metodo = n.expression.name.text;          // identidad exacta, no substring
        if (metodo === 'round' && ts.isIdentifier(objeto) && objeto.text === 'Math'
            && n.arguments[0] && /\*\s*100\b/.test(n.arguments[0].getText(sf))) {
          const p = n.parent;
          const dividido = p && ts.isBinaryExpression(p)
            && p.operatorToken.kind === ts.SyntaxKind.SlashToken
            && p.right.getText(sf).trim() === '100';
          if (!porFichero.has(rel)) porFichero.set(rel, new Set());
          porFichero.get(rel).add(dividido ? 'redondeoA2' : 'centimosEnteros');
        }
        if (metodo === 'toFixed' && n.arguments.length === 1
            && n.arguments[0].getText(sf).trim() === '2') {
          if (!porFichero.has(rel)) porFichero.set(rel, new Set());
          porFichero.get(rel).add('toFixed2');
        }
      }
      ts.forEachChild(n, visitar);
    };
    visitar(sf);
  }
  return porFichero;
}

const CENSO = censoDeRedondeos();
const MEZCLAN = [...CENSO].filter(([, c]) => c.size >= 2).map(([f]) => f).sort();

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO · un cero de un censo ciego es el mismo número que un cero de verdad
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-624 · SUELO: el censo ve el árbol y encuentra redondeos', () => {
  assert.ok(ficherosDeCodigo().length > 200,
    `🔴 sólo ${ficherosDeCodigo().length} ficheros: el censo no está recorriendo el árbol.`);
  assert.ok(CENSO.size > 20,
    `🔴 sólo ${CENSO.size} ficheros con redondeo. Sabemos de al menos cuatro por lectura: el `
    + 'detector ha dejado de ver.');
});

test('SCRUM-624 · 🔴 CONTROL POSITIVO: caza los sitios que YA conozco por lectura', () => {
  // Sin esto el censo podría estar contando otra cosa. Los cuatro se leyeron a mano, y uno de
  // ellos —`finalInvoice`— es justo el que la primera versión del censo NO veía.
  const CONOCIDOS = [
    ['src/modules/invoicing/domain/finalInvoice.service.ts', 'redondeoA2'],
    ['src/modules/jobs/domain/albaranAFactura.ts', 'centimosEnteros'],
    ['src/modules/jobs/domain/albaran.service.ts', 'centimosEnteros'],
    ['src/modules/invoicing/domain/vat.service.ts', 'redondeoA2'],
  ];
  for (const [f, conv] of CONOCIDOS) {
    assert.ok(CENSO.has(f), `🔴 el censo NO VE ${f}, y su redondeo está leído a mano.`);
    assert.ok(CENSO.get(f).has(conv),
      `🔴 el censo ve ${f} pero no reconoce su convención «${conv}»: [${[...CENSO.get(f)]}]`);
  }
});

test('SCRUM-624 · CONTROL NEGATIVO: un `toFixed(0)` o un `round` sin factor 100 no cuentan', () => {
  // El censo mide REDONDEO DE DINERO. Si contara cualquier `Math.round`, su número no diría nada.
  const sf = ts.createSourceFile('x.ts',
    'const a = Math.round(x); const b = y.toFixed(0); const c = Math.round(z * 10);',
    ts.ScriptTarget.Latest, true);
  let vistos = 0;
  const visitar = (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const m = n.expression.name.text;
      const o = n.expression.expression;
      if (m === 'round' && ts.isIdentifier(o) && o.text === 'Math'
          && n.arguments[0] && /\*\s*100\b/.test(n.arguments[0].getText(sf))) vistos++;
      if (m === 'toFixed' && n.arguments[0] && n.arguments[0].getText(sf).trim() === '2') vistos++;
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  assert.equal(vistos, 0, '🔴 el censo cuenta redondeos que no son de dinero: su número no mide nada.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LO MEDIDO, FIJADO — para que la propuesta se discuta sobre números que no se mueven
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * Medido el 3-sep-2026. BAJA cuando se unifique una convención; si SUBE, entra una nueva mezcla.
 *
 * 12 → 13 el 3-sep-2026 por SCRUM-594 (DOC-04), y el motivo se escribe aquí porque subir este
 * número sin decir por qué es exactamente lo que el trinquete existe para impedir:
 * `quotes/domain/presentacionIva.ts` pasa a tener las dos formas **a propósito y separadas**:
 *   · `redondear2` (`Math.round(x*100)/100`) para PRESENTAR importes — la que ya usaba
 *     `calcVatBreakdown`, de quien este pie consume las cifras;
 *   · céntimos enteros SÓLO para repartir el descuento global entre tipos, donde la regla no es
 *     una convención fiscal sino conservación aritmética: la suma de los repartos tiene que ser
 *     EXACTAMENTE el importe que el cliente firmó, y en coma flotante no lo es.
 * No se unifica ninguna de las dos ni se toca `calcVatBreakdown`: cuál debe mandar está en la
 * asesoría con SCRUM-619, 623 y 624.
 */
const TOPE_FICHEROS_QUE_MEZCLAN = 13;

test('SCRUM-624 · 🔴 no entra NINGÚN fichero nuevo que mezcle formas de redondear', () => {
  assert.ok(MEZCLAN.length <= TOPE_FICHEROS_QUE_MEZCLAN,
    '🔴 hay ' + MEZCLAN.length + ' ficheros mezclando dos o más formas de redondear, y el tope es '
    + TOPE_FICHEROS_QUE_MEZCLAN + '. Descuento + IVA + redondeo es donde nacen los céntimos que '
    + 'no cuadran, y este ticket está abierto justo por eso.\n  ' + MEZCLAN.join('\n  '));
});

test('SCRUM-624 · 🔴 LA DIVERGENCIA, con números concretos y no «aproximadamente»', () => {
  // El caso que contesta la pregunta abierta del ticket. Las dos funciones son copia literal de
  // lo que hace el árbol, y se fijan aquí para que la propuesta no discuta sobre una impresión.
  const LINEAS = [
    { qty: 1, price: 9.99, tax: 0.21 }, { qty: 1, price: 9.99, tax: 0.21 }, { qty: 1, price: 9.99, tax: 0.21 },
  ];
  // A · la convención ESCRITA (albaranAFactura.ts:275): céntimo POR LÍNEA.
  let cents = 0;
  for (const l of LINEAS) {
    const b = Math.round(l.qty * l.price * 100);
    cents += b + Math.round(b * l.tax);
  }
  // B · lo que IMPRIME el PDF de factura (pdf.service.ts:399-411): float, sin redondear.
  let sub = 0; let vat = 0;
  for (const l of LINEAS) { sub += l.qty * l.price; vat += l.qty * l.price * l.tax; }

  assert.equal((cents / 100).toFixed(2), '36.27', '🔴 la convención por línea ha cambiado de resultado');
  assert.equal((sub + vat).toFixed(2), '36.26', '🔴 el cálculo del PDF ha cambiado de resultado');
  assert.notEqual((cents / 100).toFixed(2), (sub + vat).toFixed(2),
    '🔴 las dos convenciones han dejado de divergir. Si es a propósito, este ticket ha avanzado y '
    + 'hay que actualizar `docs/master/SCRUM-624.md`; si no, alguien ha cambiado un cálculo de dinero.');
});

test('SCRUM-624 · 🔴 y el OTRO camino: nada limita los decimales del precio', () => {
  // La factura divergente de staging no lo era por el IVA: su línea lleva `price: 30.003`. Si el
  // esquema limitara a dos decimales, ese camino no existiría.
  const esquema = fs.readFileSync(path.join(RAIZ, 'src/core/validation/schemas.ts'), 'utf8');
  const m = esquema.match(/^\s*price:\s*(.+)$/m);
  assert.ok(m, '🔴 no encuentro la validación de `price`: este guard mediría sobre nada.');
  assert.equal(/multipleOf|step|decimal|toFixed/.test(m[1]), false,
    '🔴 el precio HA PASADO a limitar decimales. Es un cambio en el camino de emisión y cambia lo '
    + `que se puede guardar: revísalo contra este ticket. Línea: ${m[1].trim()}`);
});
