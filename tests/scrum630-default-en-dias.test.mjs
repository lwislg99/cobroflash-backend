// tests/scrum630-default-en-dias.test.mjs — SCRUM-630
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL VALOR POR DEFECTO DE «VÁLIDO HASTA» NO SUMABA 30 DÍAS DE CALENDARIO
//
//     new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
//
// El defecto salió midiendo otra cosa: al romper SCRUM-605 a propósito con aritmética en
// milisegundos, «31 de marzo + 30 días» dio **29 de abril** en vez del 30.
//
// 🔴 Y AL MEDIRLO AQUÍ RESULTÓ QUE MI EXPLICACIÓN DE ENTONCES ERA IMPRECISA. Conté que era «el
// cambio de hora de marzo». Medido sobre 2026 entero, a cuatro horas del día:
//
//     09:00 · 12:00 · 23:30   →    0 de 365 días difieren
//     00:30                   →  210 de 365 difieren
//
// O sea: lo que muerde NO es `86400000`, es **`toISOString()`, que formatea en UTC**. En Madrid
// (UTC+1/+2) una hora local temprana cae en el día ANTERIOR, y por eso el 31 de marzo a
// medianoche daba el 29 de abril. La aritmética en milisegundos, por sí sola, no cambia el día
// a horas normales: un salto de una hora sobre el mediodía sigue cayendo en el mismo día.
//
// Las dos costuras se arreglan igual —componentes de fecha locales— pero decirlo bien importa:
// quien lea «cambio de hora» buscaría el defecto dos días al año en vez de 210.
//
// 🔴 EL ARREGLO ES REUTILIZAR, NO REESCRIBIR. La primitiva ya existía (`fechaDeAtajo`, de
// SCRUM-605) con sus bordes probados. Escribir una segunda habría sido el defecto de familia de
// SCRUM-617/620/625/627/629: existe una primitiva y alguien no la usa.
// ─────────────────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

const front = {};
new Function('window', leer('public/dashboard/js/quoteAtajosVencimiento.js'))(front);
const A = front.QUOTE_ATAJOS_VENCIMIENTO;

/** La aritmética VIEJA, tal cual estaba, para poder comparar contra ella. */
function comoAntes(hoy, dias) {
  return new Date(hoy.getTime() + dias * 86400000).toISOString().slice(0, 10);
}

/**
 * Las sumas o restas de un múltiplo EXACTO de un día en milisegundos que hay en una fuente.
 *
 * 🔴 POR AST, NO POR TEXTO, y no es preferencia: la primera versión de este guard buscaba la
 * cadena «Date.now() + 30 * 86400000» y CAYÓ SOLA — mi propio comentario, el que explica por qué
 * esa suma está prohibida, la contiene. Es el guard de texto que se caza a sí mismo en la nota
 * que explica la prohibición. Con AST los comentarios quedan fuera POR CONSTRUCCIÓN.
 *
 * Y evalúa el NÚMERO en vez de buscarlo escrito: `86400000`, `86_400_000`, `24 * 60 * 60 * 1000`
 * y `24 * 3600 * 1000` son el mismo día, y un `grep` no lo sabe.
 */
export function sumasDeDiasEnMs(fuente, ruta = 'x.js') {
  const sf = ts.createSourceFile(ruta, fuente, ts.ScriptTarget.Latest, true);
  const valor = (n) => {
    if (ts.isNumericLiteral(n)) return Number(n.text.replace(/_/g, ''));
    if (ts.isParenthesizedExpression(n)) return valor(n.expression);
    if (ts.isBinaryExpression(n)) {
      const a = valor(n.left); const b = valor(n.right);
      if (a === null || b === null) return null;
      if (n.operatorToken.kind === ts.SyntaxKind.AsteriskToken) return a * b;
      return null;
    }
    return null;
  };
  const fuera = [];
  (function rec(n) {
    if (ts.isBinaryExpression(n)
        && (n.operatorToken.kind === ts.SyntaxKind.PlusToken || n.operatorToken.kind === ts.SyntaxKind.MinusToken)) {
      for (const lado of [n.left, n.right]) {
        const v = valor(lado);
        if (v !== null && v !== 0 && Math.abs(v) % 86400000 === 0) {
          fuera.push(n.getText(sf).replace(/\s+/g, ' ').slice(0, 70));
        }
      }
    }
    n.forEachChild(rec);
  })(sf);
  return fuera;
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// SUELO
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-630 · SUELO: tengo la primitiva y sé reproducir el cálculo viejo', () => {
  assert.equal(typeof A?.fechaDeAtajo, 'function', '🔴 CIEGO: no tengo `fechaDeAtajo`');
  const hoy = new Date(2026, 5, 10, 12, 0, 0);
  assert.equal(comoAntes(hoy, 30), A.fechaDeAtajo(30, hoy),
    '🔴 mi reproducción del cálculo viejo no coincide con el nuevo ni en un día normal: entonces '
    + 'no estoy comparando lo que creo y nada de lo de abajo vale.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL ANTES Y EL DESPUÉS, en el caso que destapó el defecto
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-630 · 🔴 31 de marzo a medianoche + 30: antes 29-abr, ahora 30-abr', () => {
  const hoy = new Date(2026, 2, 31, 0, 0, 0);
  assert.equal(comoAntes(hoy, 30), '2026-04-29',
    '🔴 el cálculo viejo ya no da 29-abr: este test dejó de medir el defecto que dice medir');
  assert.equal(A.fechaDeAtajo(30, hoy), '2026-04-30',
    '🔴 el cálculo nuevo NO da 30-abr: el arreglo no arregla');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ✅ EL CONTROL NEGATIVO, QUE ES EL QUE DECIDE
// ─────────────────────────────────────────────────────────────────────────────────────────
const HORAS_NORMALES = [[9, 0], [12, 0], [23, 30]];

test('SCRUM-630 · ✅ a hora normal, el arreglo NO mueve NI UNA fecha en todo el año', () => {
  for (const [hh, mm] of HORAS_NORMALES) {
    const distintos = [];
    for (let d = new Date(2026, 0, 1); d.getFullYear() === 2026; d.setDate(d.getDate() + 1)) {
      const hoy = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm, 0);
      const antes = comoAntes(hoy, 30);
      const ahora = A.fechaDeAtajo(30, hoy);
      if (antes !== ahora) distintos.push(`${hoy.toDateString()}: ${antes} -> ${ahora}`);
    }
    assert.deepEqual(distintos, [],
      `🔴 A LAS ${hh}:${String(mm).padStart(2, '0')} EL ARREGLO MUEVE FECHAS: ${distintos.slice(0, 5).join(' · ')}.\n`
      + '  Eso no es arreglar un defecto: es cambiar el comportamiento del producto. Quien no toque '
      + 'nada tiene que seguir viendo exactamente la misma fecha que veía.');
  }
});

test('SCRUM-630 · 🔴 y de MADRUGADA sí difieren — 210 de 365, que es el defecto', () => {
  let dif = 0; let total = 0;
  for (let d = new Date(2026, 0, 1); d.getFullYear() === 2026; d.setDate(d.getDate() + 1)) {
    const hoy = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 30, 0);
    total++;
    if (comoAntes(hoy, 30) !== A.fechaDeAtajo(30, hoy)) dif++;
  }
  assert.equal(total, 365, '🔴 el barrido no ha recorrido el año entero');
  assert.equal(dif, 210,
    `🔴 a las 00:30 difieren ${dif} días de ${total}, y estaban medidos 210. Si BAJA a 0, o el `
    + 'defecto se arregló por otro sitio o estoy comparando la misma función consigo misma — y '
    + 'entonces el control negativo de arriba no significaría nada.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS BORDES DE SCRUM-605, que el valor por defecto también tiene que respetar
// ─────────────────────────────────────────────────────────────────────────────────────────
for (const b of [
  { que: '31 de enero + 30 (febrero de 28)', hoy: [2026, 0, 31], dias: 30, esperada: '2026-03-02' },
  { que: '31 de enero + 30 en BISIESTO', hoy: [2024, 0, 31], dias: 30, esperada: '2024-03-01' },
  { que: 'cambio de AÑO', hoy: [2026, 11, 15], dias: 30, esperada: '2027-01-14' },
  { que: '31 de diciembre + 7', hoy: [2026, 11, 31], dias: 7, esperada: '2027-01-07' },
]) {
  test(`SCRUM-630 · el valor por defecto respeta el borde: ${b.que}`, () => {
    const hoy = new Date(b.hoy[0], b.hoy[1], b.hoy[2]);
    assert.equal(A.fechaDeAtajo(b.dias, hoy), b.esperada,
      `🔴 sale ${A.fechaDeAtajo(b.dias, hoy)} y debería ${b.esperada}`);
  });
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// LA VISTA · usa la primitiva, y el orden de carga que lo hace posible está VIGILADO
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-630 · 🔴 el valor por defecto sale de la primitiva, no de una segunda aritmética', () => {
  const vista = leer('public/dashboard/js/quotesView.js');
  assert.equal(vista.split('atajosVencDefecto.fechaDeAtajo(30)').length - 1, 1,
    '🔴 el valor por defecto ya no sale de `fechaDeAtajo`: si alguien ha escrito una segunda '
    + 'aritmética, el defecto de familia ha vuelto (617/620/625/627/629).');

  const sumas = sumasDeDiasEnMs(vista, 'quotesView.js');
  assert.equal(sumas.length, 1,
    `🔴 en \`quotesView.js\` hay ${sumas.length} sumas de días en milisegundos y debe quedar UNA: `
    + `la del \`min\`, que este ticket no toca. Si sube, ha vuelto la aritmética vieja: ${JSON.stringify(sumas)}`);
});

test('SCRUM-630 · CONTROL del detector: sabe VER una suma de días y sabe NO verla', () => {
  // Sin esto, un detector que devolviera siempre `[]` pasaría el test de arriba.
  assert.equal(sumasDeDiasEnMs('const x = Date.now() + 30 * 86400000;').length, 1, '🔴 no ve la forma literal');
  assert.equal(sumasDeDiasEnMs('const x = Date.now() + 7 * 24 * 60 * 60 * 1000;').length, 1, '🔴 no ve la forma factorizada');
  assert.equal(sumasDeDiasEnMs('const x = Date.now() - 14 * 86_400_000;').length, 1, '🔴 no ve la forma con guiones bajos');
  assert.equal(sumasDeDiasEnMs('// Date.now() + 30 * 86400000 en un comentario\nconst x = 1;').length, 0,
    '🔴 cuenta un comentario: es el guard de texto que se caza a sí mismo, otra vez');
  assert.equal(sumasDeDiasEnMs('const x = Date.now() + 3600000;').length, 0, '🔴 cuenta una hora como si fuera un día');
});

test('SCRUM-630 · 🔴 la primitiva se CARGA ANTES que la vista que la usa', () => {
  const html = leer('public/dashboard/index.html');
  const iPrim = html.indexOf('js/quoteAtajosVencimiento.js');
  const iVista = html.indexOf('js/quotesView.js');
  assert.ok(iPrim !== -1, '🔴 la primitiva ya no se carga en el index');
  assert.ok(iVista !== -1, '🔴 la vista ya no se carga en el index');
  assert.ok(iPrim < iVista,
    '🔴 `quoteAtajosVencimiento.js` ha pasado a cargarse DESPUÉS de `quotesView.js`. La vista '
    + 'depende de ella para el valor por defecto: en ese orden el campo saldría VACÍO. La '
    + 'dependencia era implícita y por eso se fija aquí.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ EL `min` NO SE HA TOCADO, y tiene el MISMO defecto.
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-630 · CARACTERIZACIÓN: el `min` sigue con la aritmética vieja (no se tocó)', () => {
  const vista = leer('public/dashboard/js/quotesView.js');
  assert.equal(vista.split('validInput.min = new Date(Date.now() + 86400000).toISOString().slice(0, 10);').length - 1, 1,
    'CARACTERIZACIÓN: el `min` del campo sigue sumando 24 h en milisegundos y formateando en UTC '
    + '— el MISMO defecto que este ticket arregla en el valor por defecto. NO se tocó porque el '
    + 'encargo lo prohíbe expresamente. Si esto falla es que alguien lo cambió: bien, pero que '
    + 'conste con su decisión.');
});
