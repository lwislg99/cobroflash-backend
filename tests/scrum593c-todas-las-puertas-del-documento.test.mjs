// tests/scrum593c-todas-las-puertas-del-documento.test.mjs — SCRUM-593 (DOC-03) · fase ③
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL MISMO PRESUPUESTO SE GENERA POR TRES PUERTAS DISTINTAS, Y LAS TRES TIENEN QUE PINTAR LO MISMO
//
// `generateQuotePdf` se llama desde tres sitios: al CREAR el presupuesto, al REGENERARLO cuando el
// cliente lo acepta con firma, y desde el panel cuando alguien pide el PDF a demanda. Si una de
// las tres se olvida de pasar los dos textos, **aceptar un presupuesto le borra los bloques del
// papel** — sin tocar la base, sin error, y con la fila intacta. El profesional vería que su aviso
// desapareció justo cuando el cliente firmó.
//
// Ese defecto no lo caza un test de generación de PDF: ése llama a la función DIRECTAMENTE y pasa
// lo que quiere. Lo que hay que mirar es **quién la llama y con qué**.
//
// ── POR QUÉ AST Y NO `grep` ──────────────────────────────────────────────────────────────────
// Un `grep` de «docHeaderText» en el fichero diría que sí porque el campo aparece en OTRA llamada
// del mismo fichero, o en un comentario. Lo que hace falta es, por CADA llamada, qué propiedades
// lleva SU objeto. Eso es una pregunta de árbol, no de texto (SCRUM-203).
//
// ── SUELO ────────────────────────────────────────────────────────────────────────────────────
// Si el censo encuentra menos llamadas de las que sabe que hay, se declara CIEGO y falla. Un cero
// de un analizador roto se lee exactamente igual que «todas las puertas están bien».
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '..');

/** Los ficheros que generan un documento. Se declaran para que añadir uno sin mirar CANTE. */
const FUENTES_PRESUPUESTO = [
  'src/modules/quotes/app/routes/quotes.routes.ts',
  'src/modules/system/app/routes/quotesAdmin.routes.ts',
];
const FUENTES_ALBARAN = ['src/modules/jobs/domain/albaran.service.ts'];

/**
 * Cada llamada a `nombre(...)` de un fichero, con las propiedades de su objeto argumento.
 *
 * Se queda con las claves de PRIMER NIVEL del object literal: es exactamente el nivel al que
 * viven `docHeaderText` y `docFooterText` en la firma de las dos funciones.
 */
function llamadasCon(rutaRelativa, nombre) {
  const ruta = path.join(RAIZ, rutaRelativa);
  const sf = ts.createSourceFile(ruta, fs.readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const fuera = [];
  const visitar = (n) => {
    if (ts.isCallExpression(n)) {
      const e = n.expression;
      const llamado = ts.isIdentifier(e) ? e.text : (ts.isPropertyAccessExpression(e) ? e.name.text : null);
      if (llamado === nombre) {
        const arg = n.arguments[0];
        const props = new Set();
        if (arg && ts.isObjectLiteralExpression(arg)) {
          for (const p of arg.properties) {
            if (p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) props.add(p.name.text);
          }
        }
        fuera.push({
          fichero: rutaRelativa,
          linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
          props,
          esObjeto: !!(arg && ts.isObjectLiteralExpression(arg)),
        });
      }
    }
    ts.forEachChild(n, visitar);
  };
  ts.forEachChild(sf, visitar);
  return fuera;
}

const puertasPresupuesto = FUENTES_PRESUPUESTO.flatMap((f) => llamadasCon(f, 'generateQuotePdf'));
const puertasAlbaran = FUENTES_ALBARAN.flatMap((f) => llamadasCon(f, 'generateAlbaranPdf'));

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL SUELO, PRIMERO: si el censo no ve, todo lo de abajo es decorado
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-593c · 🔴 SUELO: el censo VE las tres puertas del presupuesto', () => {
  assert.ok(puertasPresupuesto.length >= 3,
    `🔴 CIEGO: sólo veo ${puertasPresupuesto.length} llamada(s) a generateQuotePdf y hay al menos 3 `
    + '(crear · aceptar con firma · panel). Si el analizador dejó de encontrarlas, sus verdes no '
    + 'significan nada. NO se baja este número para desatascar: se arregla el censo.');
  for (const p of puertasPresupuesto) {
    assert.equal(p.esObjeto, true,
      `🔴 la llamada de ${p.fichero}:${p.linea} no lleva un objeto literal: el censo no puede leer `
      + 'sus propiedades y estaría dándola por buena sin mirarla.');
  }
});

test('SCRUM-593c · 🔴 SUELO: el censo VE la puerta del albarán', () => {
  assert.ok(puertasAlbaran.length >= 1, `🔴 CIEGO: ${puertasAlbaran.length} llamadas a generateAlbaranPdf.`);
  for (const p of puertasAlbaran) assert.equal(p.esObjeto, true, `🔴 ${p.fichero}:${p.linea} sin objeto literal.`);
});

test('SCRUM-593c · 🔴 CONTROL NEGATIVO: el censo sabe decir que NO', () => {
  // Sin esto, «todas llevan el campo» también saldría si el lector devolviera siempre todo.
  for (const p of puertasPresupuesto) {
    assert.equal(p.props.has('CampoQueNoExisteEnNingunaLlamada'), false,
      `🔴 ${p.fichero}:${p.linea} dice llevar una propiedad inventada: el lector no distingue.`);
  }
  // Y el positivo del mismo lector: `currency` está en las tres de verdad.
  for (const p of puertasPresupuesto) {
    assert.equal(p.props.has('currency'), true,
      `🔴 ${p.fichero}:${p.linea} no ve \`currency\`, que sí está. El lector no lee.`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LO QUE SE VIGILA
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-593c · 🔴 LAS TRES puertas del presupuesto pasan los DOS textos', () => {
  const mancas = puertasPresupuesto.filter((p) => !p.props.has('docHeaderText') || !p.props.has('docFooterText'));
  assert.deepEqual(mancas.map((p) => `${p.fichero}:${p.linea}`), [],
    '🔴 hay puertas que generan el MISMO documento sin los dos textos libres. Un PDF que cambia '
    + 'según por qué puerta se pidió no es el documento: aceptar un presupuesto le borraría los '
    + 'bloques del papel, con la fila intacta y sin un solo error.');
});

test('SCRUM-593c · 🔴 el albarán pasa la CABECERA y NO un segundo pie', () => {
  for (const p of puertasAlbaran) {
    assert.equal(p.props.has('docHeaderText'), true,
      `🔴 ${p.fichero}:${p.linea} no pasa el texto de cabecera del albarán.`);
    assert.equal(p.props.has('docFooterText'), false,
      `🔴 ${p.fichero}:${p.linea} pasa un \`docFooterText\` al albarán. El pie de ese documento es `
      + '`notas`, que ya existe y ya se imprime: un segundo campo daría dos sitios para lo mismo.');
    assert.equal(p.props.has('notas'), true,
      '🔴 ha dejado de pasar `notas`: ése ES el pie del albarán, y sin él el bloque desaparece.');
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LA FACTURA SIGUE FUERA — y eso también se vigila, porque la tentación es «ya que estamos»
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-593c · 🔴 la FACTURA no ha recibido los bloques (regla 29 · SCRUM-665)', () => {
  const ruta = path.join(RAIZ, 'src/lib/invoicing.ts');
  const src = fs.readFileSync(ruta, 'utf8');
  assert.equal(/docHeaderText|docFooterText/.test(src), false,
    '🔴 el camino de emisión de la factura ha recibido los textos del documento. `ensureInvoicePdf` '
    + 'REGENERA el PDF con el código de hoy —el fs de Railway es efímero—, así que esto cambiaría '
    + 'el aspecto de facturas YA EMITIDAS en el siguiente despliegue. Es la regla 29, y está '
    + 'fichado aparte como SCRUM-665.');
  // SUELO del control: que el fichero es el que creemos y sí se puede leer.
  assert.match(src, /ensureInvoicePdf/,
    '🔴 no encuentro `ensureInvoicePdf` en el fichero: el control de arriba no estaba mirando nada.');
});
