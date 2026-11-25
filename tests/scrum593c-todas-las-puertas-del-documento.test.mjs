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
// SCRUM-734 · el censo COMPARTIDO de las puertas del presupuesto (ver la nota de abajo).
import { censarPuertasDelPresupuesto } from './_puertas-del-presupuesto.mjs';

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

// ── 🔴 SCRUM-734 · ESTE CENSO SE QUEDÓ CIEGO, Y NO SE HA «ADAPTADO» PARA QUE SIGA EN VERDE ──
//
// Las tres puertas del presupuesto ya no arman un objeto literal: le piden la carga entera a
// `paramsDePresupuestoParaPdf`, que es el único sitio donde se decide qué lleva el documento. El
// lector de aquí abajo sólo sabía leer literales, así que este fichero cayó en rojo — y esa era
// LA SEÑAL CORRECTA: un censo cuyo modelo se rompe tiene que fallar, no seguir reportando.
//
// La propiedad que vigila —«las tres puertas llevan los dos textos»— sigue siendo cierta y sigue
// importando. Lo que cambia es cómo se comprueba: una puerta que delega lleva todo lo que el
// constructor produce. El censo compartido vive en `_puertas-del-presupuesto.mjs` porque los
// CUATRO tickets que preguntan esto (593c, 602, 731, 734) tenían el mismo supuesto escrito
// cuatro veces, y por eso se rompieron los cuatro el mismo día.
//
// El lector local (`llamadasCon`) se CONSERVA: la puerta del ALBARÁN sigue armando su literal y
// es quien lo mide. Borrarlo dejaría esa mitad sin censo.
const puertasPresupuesto = censarPuertasDelPresupuesto().map((p) => ({
  fichero: p.fichero,
  linea: Number(p.donde.split(':').pop()),
  props: p.props,
  // «el censo pudo leer sus claves»: delegando o con literal. `otra` es lo que NO se da por bueno.
  esObjeto: p.forma !== 'otra',
}));
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

// ── 23-nov-2026 · SCRUM-1787l · DECISIÓN DEL FUNDADOR (SCRUM-1787 c.22353, regla 41) ─────────────
// Hasta hoy este caso prohibía CUALQUIER `docHeaderText|docFooterText` en `src/lib/invoicing.ts`.
// El fundador ha decidido («1-Sí») que el PDF de factura PUEDE pintar las Observaciones CONGELADAS
// en la propia factura al emitir (`Invoice.docFooterText`, c.22345/c.22346): al regenerarse con el
// código de hoy lee la misma columna que se selló, y las emitidas antes del ALTER tienen NULL, así
// que su papel no cambia. Lo que SIGUE prohibido es que la emisión reciba textos leídos EN VIVO del
// presupuesto o del comercio (`Quote.docFooterText`, `docHeaderText`, cláusulas): ésos sí
// cambiarían el aspecto de facturas YA EMITIDAS en el siguiente despliegue (SCRUM-665).
//
// Cómo se distingue, por AST (SCRUM-203) y con la misma forma que el guard de la columna congelada
// gemela (`scrum1240d`, `merchantCriterioCaja`): en CADA llamada a `generateInvoicePdf` de la
// emisión, `docFooterText` se toma de la FACTURA (`inv.` / `invoice.`) y de nada más. El control
// positivo es `MUTACIONES_QUE_ME_TUMBAN`, al final: pasar el texto del presupuesto lo tumba.
const LLAMADORES_FACTURA = [
  ['src/lib/invoicing.ts', 1], // 23-nov-2026, SCRUM-665e: de 2 a 1 por decisión del fundador (SCRUM-665 c.22382, con c.21182 y c.22358): queda un generador único, `ensureInvoicePdf`
  // 23-nov-2026, SCRUM-665e: aquí estaba la fila de `invoicesAdmin.routes.ts` con 1 llamada, la de `regenerate-pdf`; la ruta se retiró (SCRUM-665 c.21182 punto 3; c.22382 y c.22358)
];
const PIE_CONGELADO = /^(inv|invoice)\.docFooterText( \?\? null)?$/;

test('SCRUM-593c · 🔴 la FACTURA solo recibe el pie CONGELADO en ella, nunca los textos vivos (regla 29 · SCRUM-665 · c.22353)', () => {
  const ruta = path.join(RAIZ, 'src/lib/invoicing.ts');
  const src = fs.readFileSync(ruta, 'utf8');
  assert.equal(/docHeaderText/.test(src), false,
    '🔴 el camino de emisión de la factura ha recibido la CABECERA del documento. Ésa no se congela '
    + 'en la factura: `ensureInvoicePdf` REGENERA el PDF con el código de hoy —el fs de Railway es '
    + 'efímero—, así que esto cambiaría el aspecto de facturas YA EMITIDAS en el siguiente '
    + 'despliegue. Es la regla 29, y está fichado aparte como SCRUM-665.');
  // SUELO del control: que el fichero es el que creemos y sí se puede leer.
  assert.match(src, /ensureInvoicePdf/,
    '🔴 no encuentro `ensureInvoicePdf` en el fichero: el control de arriba no estaba mirando nada.');

  let vistas = 0;
  const malas = [];
  for (const [rel, esperadas] of LLAMADORES_FACTURA) {
    const llamadas = [];
    const sf = ts.createSourceFile(rel, fs.readFileSync(path.join(RAIZ, rel), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const visita = (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'generateInvoicePdf') llamadas.push(n);
      ts.forEachChild(n, visita);
    };
    visita(sf);
    assert.equal(llamadas.length, esperadas,
      `🔴 CIEGO: ${rel} llama ${llamadas.length} vez/veces a generateInvoicePdf y esperaba ${esperadas}.`);
    for (const c of llamadas) {
      const donde = `${rel}:${sf.getLineAndCharacterOfPosition(c.getStart(sf)).line + 1}`;
      const obj = c.arguments[0];
      assert.ok(obj && ts.isObjectLiteralExpression(obj), `🔴 CIEGO: ${donde} no pasa un objeto literal.`);
      for (const p of obj.properties) {
        const nombre = p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : null;
        if (nombre === 'docHeaderText') malas.push(`${donde} pasa docHeaderText`);
        if (nombre !== 'docFooterText') continue;
        const v = ts.isPropertyAssignment(p) ? p.initializer.getText(sf) : `(${ts.SyntaxKind[p.kind]})`;
        if (!PIE_CONGELADO.test(v)) malas.push(`${donde} pasa docFooterText: «${v}»`);
      }
      vistas += 1;
    }
  }
  assert.equal(vistas, 1, `🔴 CIEGO: he juzgado ${vistas} llamadas a generateInvoicePdf y es 1.`); // 23-nov-2026, SCRUM-665e: de 3 a 1, el total de la tabla de arriba (SCRUM-665 c.22382, con c.21182 y c.22358)
  assert.deepEqual(malas, [],
    '🔴 la emisión recibe un texto que NO es el congelado en la factura. Solo vale '
    + '`inv.docFooterText` / `invoice.docFooterText` (la columna sellada al emitir, c.22353): el '
    + 'texto del presupuesto o del comercio, leído en vivo, cambiaría el papel de facturas ya '
    + 'emitidas al regenerarlas (regla 29 · SCRUM-665).');
});

// El catálogo de la casa (scripts/meta-guard-mutaciones.mjs → aplicarUna). Control positivo de la
// decisión c.22353: si alguien pasa el texto del presupuesto en vez del congelado, cae.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'src/lib/invoicing.ts',
    de: '      docFooterText: inv.docFooterText ?? null, // SCRUM-1787l: las Observaciones congeladas al emitir\n',
    a: '      docFooterText: (inv as any).quote?.docFooterText ?? null, // SCRUM-1787l: las Observaciones congeladas al emitir\n',
    cae: 'SCRUM-593c · 🔴 la FACTURA solo recibe el pie CONGELADO en ella',
  },
];
