// SCRUM-246 · SIN LÍNEAS CON IMPORTE NO SE PIDE NÚMERO (sin gate: AST sobre `src/`).
//
// El defecto: `applyVeriFactu` se niega a sellar una factura sin líneas, y varios caminos
// escribían `lines: scaledLines.length > 0 ? scaledLines : undefined`. Una factura fiscal sin
// líneas nace imposible de sellar y —desde SCRUM-205— tampoco puede producir documento.
//
// LA DECISIÓN, Y ES TODA LA REGLA: se comprueba **ANTES** de `allocateInvoiceNumber`. Después
// solo habría dos salidas y las dos son malas: modificar una factura ya numerada (regla 29) o
// deshacerla, y deshacer es lo que crea el HUECO en la serie que hay que justificar ante
// Hacienda. Comprobando antes no hay nada que deshacer.
//
// POR ESTRUCTURA Y NO POR LISTA: el guard no conoce los nombres de los caminos. Busca **toda**
// llamada a `allocateInvoiceNumber` y exige que su función tenga la comprobación por delante.
// El séptimo camino que alguien añada mañana entra solo, sin que nadie se acuerde de añadirlo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(RAIZ, 'src');

const EMBUDO = 'allocateInvoiceNumber';
const PORTON = 'exigirLineasFacturables';

/**
 * ÚNICA exención, y se comprueba abajo en vez de suponerse.
 *
 * `emitInvoice` es el helper compartido: recibe la transacción y no la posee, y no ve las
 * líneas antes que su llamador. Delega, y por eso sus llamadores se verifican uno a uno.
 */
const DELEGA = {
  'src/modules/invoicing/domain/invoicing.service.ts':
    'emitInvoice es el helper compartido: sus DOS llamadores comprueban las líneas antes de '
    + 'llamarlo, y eso se verifica en el test siguiente.',
};
const LLAMADORES_DE_EMIT = [
  'src/modules/jobs/app/routes/albaranes.routes.ts',
  'src/modules/jobs/domain/recapitulativa.service.ts',
];

const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');
const fuentes = (d, out = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) fuentes(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
};
const esFuncion = (n) =>
  ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n);
const nombreDe = (n) => {
  const c = n.expression;
  return ts.isPropertyAccessExpression(c) ? c.name.text : ts.isIdentifier(c) ? c.text : null;
};

/** Posición de la primera llamada a `nombre` dentro de un nodo, o null. */
function posicionDe(nodo, nombre) {
  let pos = null;
  const v = (n) => {
    if (ts.isCallExpression(n) && nombreDe(n) === nombre) {
      const p = n.getStart();
      if (pos === null || p < pos) pos = p;
    }
    ts.forEachChild(n, v);
  };
  ts.forEachChild(nodo, v);
  return pos;
}

/** Cada emisión, con la posición de su comprobación (si existe) en alguna envolvente. */
function emisiones() {
  const out = [];
  for (const p of fuentes(SRC)) {
    const arbol = ts.createSourceFile(p, fs.readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const r = rel(p);
    const visitar = (n, pila) => {
      const nueva = esFuncion(n) ? [...pila, n] : pila;
      if (ts.isCallExpression(n) && nombreDe(n) === EMBUDO) {
        const posEmbudo = n.getStart();
        // La comprobación más cercana que esté ANTES, en cualquier envolvente.
        let posPorton = null;
        for (const fn of nueva) {
          const q = posicionDe(fn, PORTON);
          if (q !== null && q < posEmbudo && (posPorton === null || q > posPorton)) posPorton = q;
        }
        out.push({
          fichero: r,
          linea: arbol.getLineAndCharacterOfPosition(posEmbudo).line + 1,
          protegida: posPorton !== null,
        });
      }
      ts.forEachChild(n, (h) => visitar(h, nueva));
    };
    ts.forEachChild(arbol, (n) => visitar(n, []));
  }
  return out;
}

test('SCRUM-246 · ninguna emisión pide número sin comprobar que hay algo que cobrar', () => {
  const todas = emisiones();

  // SUELO: cero emisiones se lee igual que «todas protegidas». SCRUM-203 midió 7 creaciones.
  assert.ok(
    todas.length >= 7,
    `🔴 ESCÁNER CIEGO: veo ${todas.length} llamadas a \`${EMBUDO}\` y los caminos de emisión son 7. ` +
      'Si el embudo cambió de nombre, este guard dejó de vigilar y su verde no significa nada.',
  );

  const desprotegidas = todas
    .filter((e) => !e.protegida && !DELEGA[e.fichero])
    .map((e) => `${e.fichero}:${e.linea}`);

  assert.deepEqual(
    desprotegidas, [],
    '🔴 HAY UNA EMISIÓN QUE PIDE NÚMERO SIN COMPROBAR LAS LÍNEAS:\n' +
      desprotegidas.map((s) => `    ${s}`).join('\n') +
      '\n\n  Una factura fiscal sin líneas con importe NO se puede sellar (`applyVeriFactu` la\n' +
      '  rechaza) y desde SCRUM-205 tampoco produce documento. Si el número ya se ha consumido\n' +
      `  cuando eso se descubre, las dos salidas son malas: modificar una factura numerada, o\n` +
      '  deshacerla y dejar un hueco en la serie que hay que justificar ante Hacienda.\n\n' +
      `  Llama a \`${PORTON}(lineas)\` ANTES del \`$transaction\`, no dentro y no después.`,
  );
});

test('SCRUM-246 · los llamadores de `emitInvoice` comprueban (la delegación no es un agujero)', () => {
  for (const r of LLAMADORES_DE_EMIT) {
    const abs = path.join(RAIZ, r);
    assert.ok(fs.existsSync(abs), `🔴 ESCÁNER CIEGO: no encuentro ${r}`);
    const arbol = ts.createSourceFile(abs, fs.readFileSync(abs, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    assert.ok(
      posicionDe(arbol, PORTON) !== null,
      `🔴 ${r} llama a \`emitInvoice\` y NO comprueba las líneas.\n\n` +
        '  `emitInvoice` está exento PORQUE delega: recibe la transacción y no ve las líneas antes\n' +
        '  que su llamador. Si un llamador deja de comprobar, la exención pasa de justificada a\n' +
        '  falsa y no hay nada que lo diga.',
    );
  }
});

// ── la regla en sí, ejercitada ────────────────────────────────────────────────────────────

test('SCRUM-246 · qué cuenta como «línea con importe»', async () => {
  const { hayLineasFacturables, exigirLineasFacturables, esErrorSinLineas, ERROR_SIN_LINEAS } =
    await import('../dist/modules/invoicing/domain/lineasFacturables.js');

  assert.equal(hayLineasFacturables(null), false, '🔴 null no tiene líneas');
  assert.equal(hayLineasFacturables([]), false, '🔴 una lista vacía no tiene líneas');
  assert.equal(hayLineasFacturables([{ qty: 1, price: 0 }]), false, '🔴 precio 0 no es importe');
  assert.equal(hayLineasFacturables([{ qty: 0, price: 100 }]), false, '🔴 cantidad 0 no es importe');
  assert.equal(hayLineasFacturables([{ qty: 1, price: 100 }]), true);

  // El caso que obliga a que sea «alguna» y no «todas»: una factura puede llevar un concepto a
  // 0 € (algo incluido) mientras el resto sí se cobra. Exigir que TODAS tengan importe
  // bloquearía facturas correctas.
  assert.equal(
    hayLineasFacturables([{ qty: 1, price: 0 }, { qty: 2, price: 50 }]), true,
    '🔴 una línea a 0 € junto a otras con importe NO invalida la factura',
  );

  // El fallback de `lib/invoicing.ts` con un cobro de 0 €: por eso ese camino tampoco es excepción.
  assert.equal(hayLineasFacturables([{ qty: 1, price: Number('0') }]), false);

  // LA RECTIFICATIVA, que es la razón de que la regla sea «distinto de cero» y no «mayor que».
  // Lo destapó el guard al llegar a `invoicesAdmin`: las líneas de una R1 son las de la original
  // con el precio NEGADO. Con `> 0` este guard habría bloqueado toda rectificativa — o sea, lo
  // único con lo que se corrige una factura ya emitida (regla 29).
  assert.equal(
    hayLineasFacturables([{ qty: 1, price: -100 }]), true,
    '🔴 una rectificativa mueve dinero en la otra dirección, pero lo mueve: es facturable',
  );

  let capturado = null;
  try { exigirLineasFacturables([]); } catch (e) { capturado = e; }
  assert.ok(capturado, '🔴 el portón NO lanzó sobre una lista vacía');
  assert.equal(capturado.code, ERROR_SIN_LINEAS);
  assert.ok(esErrorSinLineas(capturado));
  assert.ok(!esErrorSinLineas(new Error('otra_cosa')), '🔴 reconoce errores ajenos como suyos');
});

test('SCRUM-246 · el copy no le habla al fontanero en jerga (regla 30)', async () => {
  const { COPY_ADMIN_SIN_LINEAS, COPY_PUBLICO_SIN_LINEAS } =
    await import('../dist/modules/invoicing/domain/lineasFacturables.js');

  for (const [quien, copy] of [['admin', COPY_ADMIN_SIN_LINEAS], ['público', COPY_PUBLICO_SIN_LINEAS]]) {
    for (const jerga of ['línea', 'importe bruto', 'serie', 'numeración', 'VeriFactu', 'error', 'null']) {
      assert.ok(
        !copy.toLowerCase().includes(jerga.toLowerCase()),
        `🔴 el copy ${quien} dice «${jerga}». Lo lee un fontanero facturando, no un desarrollador.`,
      );
    }
  }
  // El público NO puede pedirle al cliente que repita: su aceptación ya valió.
  assert.ok(
    !/vuelve a intentarlo|inténtalo/i.test(COPY_PUBLICO_SIN_LINEAS),
    '🔴 el copy público le pide al cliente que repita algo que ya hizo bien.',
  );
});
