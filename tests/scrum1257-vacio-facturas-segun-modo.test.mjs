// tests/scrum1257-vacio-facturas-segun-modo.test.mjs — SCRUM-1257
//
// EL VACÍO DE FACTURAS PROMETÍA UN DOCUMENTO QUE NO SALE. Decía «Aquí verás tus cobros» y «Cuando un
// cliente acepte un presupuesto, el documento de cobro se genera solo y aparece aquí.». Para un
// merchant español con `INVOICING_ES_ENABLED` apagado (modo `receipt`) es falso: al aceptar no se
// intenta emitir nada (gate de SCRUM-1027 en `quotes.routes.ts`). Cambiar la palabra no lo arreglaba:
// «la factura se genera sola» sería igual de falso y además un claim fiscal (regla 7).
//
// El arreglo es por CONSTRUCCIÓN: el vacío mira `window.appModoEmision` y en `receipt` dice que no se
// emiten documentos. Textos firmados por delegación en SCRUM-1257 comentario 17444 (P1-P7).
//
// 🔴 Se comprueba la CONDICIÓN, no solo que los textos estén en el fichero: publicar P1/P2 sin ella
// dejaría el mensaje de `receipt` saliendo en modo fiscal, que sería un defecto nuevo.
//
// ⛔ Fuera de alcance, a propósito: la rama muerta «justificante» de `rotulosDelDocumento` (grupo A,
// SCRUM-825) y los rótulos que solo ven los documentos `J-` antiguos (grupo D, SCRUM-1252). Por eso
// P6 y P7 conservan el texto viejo en su rama `J-`: renombrarla sería llamar factura a algo que no lo es.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { constaAprobado } from './_microcopy-aprobada.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const JS = (f) => path.join(RAIZ, 'public/dashboard/js', f);

const P1 = 'Aún no se emiten documentos';
const P2 = 'Por ahora, YaQu no genera facturas desde tu cuenta.';
const P3 = 'Aquí verás tus facturas';
const P4 = 'Cuando un cliente acepte un presupuesto, sus facturas aparecerán aquí.';
const P5 = 'Complétalos antes de emitir tu primera factura';
const P6 = '🧾 Ver factura';
const P7 = 'Presupuesto firmado + evidencia de aceptación + factura + registro de mensajes, listo para responder al banco';

const VIEJOS = {
  'invoicesView.js': ['Aquí verás tus cobros', 'Cuando un cliente acepte un presupuesto, el documento de cobro se genera solo y aparece aquí.'],
  'settingsView.js': ['Sin ellos, el documento tras el pago es un justificante de cobro'],
};

function arbol(fuente, nombre = 'x.js') {
  return ts.createSourceFile(nombre, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
}

/** Todos los `cond ? a : b` cuyas dos ramas son literales, con el texto de su condición. */
function ternarios(sf) {
  const out = [];
  const lit = (n) => (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null;
  const quita = (n) => (ts.isParenthesizedExpression(n) ? quita(n.expression) : n);
  (function v(n) {
    if (ts.isConditionalExpression(n)) {
      const si = lit(quita(n.whenTrue));
      const no = lit(quita(n.whenFalse));
      if (si !== null && no !== null) out.push({ cond: quita(n.condition).getText(sf), si, no });
    }
    ts.forEachChild(n, v);
  })(sf);
  return out;
}

/** El inicializador de `const <nombre> = …`, en texto. */
function inicializador(sf, nombre) {
  let t = null;
  (function v(n) {
    if (ts.isVariableDeclaration(n) && n.name.getText(sf) === nombre && n.initializer) t = n.initializer.getText(sf);
    ts.forEachChild(n, v);
  })(sf);
  return t;
}

/** El ternario que elige entre `si` y `no`; su condición resuelta a su inicializador si es un nombre. */
function eleccion(fichero, si, no) {
  const sf = arbol(fs.readFileSync(JS(fichero), 'utf8'), fichero);
  const t = ternarios(sf).filter((x) => x.si === si && x.no === no);
  assert.equal(t.length, 1, `🔴 ${fichero}: esperaba UN ternario «${si}» / «${no}» y hay ${t.length}`);
  return /^[A-Za-z_$][\w$]*$/.test(t[0].cond) ? (inicializador(sf, t[0].cond) ?? t[0].cond) : t[0].cond;
}

const RECEIPT = /^window\.appModoEmision\s*===\s*'receipt'$/;

test('SCRUM-1257 · control: el buscador de ternarios ve uno sintético, y resuelve su condición', () => {
  const sf = arbol("const sinEmision = window.appModoEmision === 'receipt';\nconst t = sinEmision ? 'A' : 'B';");
  assert.deepEqual(ternarios(sf), [{ cond: 'sinEmision', si: 'A', no: 'B' }]);
  assert.match(inicializador(sf, 'sinEmision'), RECEIPT);
  // Y un ternario con otra condición NO casa el patrón de `receipt`.
  assert.doesNotMatch("window.appModoEmision === 'fiscal'", RECEIPT);
});

test('SCRUM-1257 · P1/P3 · el título del vacío de Facturas depende del modo', () => {
  assert.match(eleccion('invoicesView.js', P1, P3), RECEIPT);
});

test('SCRUM-1257 · P2/P4 · el cuerpo del vacío de Facturas depende del modo', () => {
  assert.match(eleccion('invoicesView.js', P2, P4), RECEIPT);
});

test('SCRUM-1257 · P5 · la fila «Datos fiscales» ya no promete un justificante', () => {
  const src = fs.readFileSync(JS('settingsView.js'), 'utf8');
  assert.ok(src.includes(`koText: '${P5}'`), '🔴 la fila «Datos fiscales» no pinta P5');
});

test('SCRUM-1257 · P6 · «Ver factura» solo si el documento es de tipo factura', () => {
  assert.equal(eleccion('quotesDetailView.js', P6, '🧾 Ver justificante'), "tipoDeFactura(paidInvCta) === 'factura'");
});

test('SCRUM-1257 · P7 · el paquete de la reclamación dice «factura», salvo en un J- antiguo', () => {
  const vieja = 'Presupuesto firmado + evidencia de aceptación + justificante + registro de mensajes, listo para responder al banco';
  // La condición es `isReceipt`, resuelta a su definición: el MISMO criterio `J-` que ya decide el
  // título y el chip de la ficha. No hay un segundo criterio.
  assert.equal(eleccion('invoiceDetailView.js', vieja, P7),
    "invoice.type === 'JUST' || String(invoice.number || '').startsWith('J-')");
});

/** Los literales de un fichero (no sus comentarios: el código cita ahí el texto viejo, con su motivo). */
function literales(fichero) {
  const sf = arbol(fs.readFileSync(JS(fichero), 'utf8'), fichero);
  const out = new Set();
  (function v(n) {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.add(n.text);
    ts.forEachChild(n, v);
  })(sf);
  return out;
}

test('SCRUM-1257 · los textos que prometían el documento ya no se pintan', () => {
  for (const [f, textos] of Object.entries(VIEJOS)) {
    const lits = literales(f);
    for (const t of textos) assert.ok(!lits.has(t), `🔴 ${f} sigue pintando «${t}»`);
  }
  // Control positivo: la misma comprobación SÍ encuentra un literal que sigue en el fichero.
  assert.ok(literales('invoicesView.js').has('Nada con estos filtros'));
});

test('SCRUM-1257 · los siete literales constan aprobados en el registro de SCRUM-1257', () => {
  for (const t of [P1, P2, P3, P4, P5, P6, P7]) {
    const donde = constaAprobado(t);
    assert.ok(donde.some((r) => /-SCRUM-1257-/.test(r)),
      `🔴 «${t.slice(0, 40)}…» no consta en el registro de SCRUM-1257 (consta en: ${donde.join(', ') || 'ninguno'})`);
  }
});
