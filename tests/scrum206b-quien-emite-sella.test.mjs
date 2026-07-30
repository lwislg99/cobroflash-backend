// SCRUM-206b · QUIEN EMITE, SELLA (guard estructural, sin gate: AST sobre `src/`, ni BD ni red).
//
// SCRUM-206 cerró una dirección: que nadie ENTREGUE un documento sin huella. Esta es la
// contraria, y es peor porque es MUDA — emitir y no sellar nunca. La factura queda con su
// número consumido, fuera de la cadena, y nada lo dice.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO, MEDIDO (no supuesto — la suposición era mía y era falsa)
//
// De los 7 sitios que crean factura (censados en SCRUM-203), DOS no sellaban:
//   · `quotes.routes.ts` — C1, el cliente final acepta el presupuesto. El camino más
//     transitado del producto.
//   · `jobs.routes.ts`   — C2, cobrar el resto.
//
// La creencia razonable era que el sellado PEREZOSO de `ensureInvoicePdf` los recogía al pedir
// el PDF. Es falsa: lo que sigue a la emisión en esos dos caminos es `sendInvoicePaymentRequest`,
// y ese servicio no toca el PDF ni el sellado — solo importa `ensureChargeReceiptToken`. Así que
// la factura quedaba fuera de la cadena hasta que alguien, algún día, abriese su PDF. Si nadie
// lo abría, no entraba nunca.
//
// Lo cazó cruzar dos listas a mano. Este guard existe para que el octavo camino no dependa de
// que alguien vuelva a cruzarlas.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// CÓMO
//
// Se sube desde cada `allocateInvoiceNumber()` por sus funciones ENVOLVENTES. Hay que subir
// porque el reparto real es `prisma.$transaction(async (tx) => { …allocate… })` y el sellado va
// FUERA de la transacción a propósito: `applyVeriFactu` lanza si recibe un cliente de
// transacción, porque sellar dentro de la tx de emisión bifurca la cadena (SCRUM-173/177).
// Mirar «la misma función» sin subir daría rojo en los cinco sitios buenos.
//
// AST y no `grep`: los nombres vigilados aparecen por fuerza en los comentarios que explican la
// regla —este fichero los nombra decenas de veces— y un guard de texto se cazaría a sí mismo.
// Es la trampa que mordió cuatro veces en este repo (SCRUM-176/168/3/193).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(RAIZ, 'src');

const EMBUDO = 'allocateInvoiceNumber';
const SELLADORA = 'applyVeriFactu';

/**
 * ÚNICA exención, declarada y COMPROBADA abajo en vez de supuesta.
 *
 * `emitInvoice` es el helper compartido: **recibe** la transacción, no la posee. Sellar ahí
 * sellaría dentro de la tx del llamador, que es exactamente lo que `applyVeriFactu` prohíbe.
 * Delega, y por eso sus llamadores se verifican uno a uno.
 */
const DELEGA = {
  'src/modules/invoicing/domain/invoicing.service.ts':
    'emitInvoice recibe la transacción y no la posee: sellar aquí sería sellar dentro de la tx '
    + 'del llamador. Delega, y sus DOS llamadores se comprueban en el test siguiente.',
};
const LLAMADORES_DE_EMIT = [
  'src/modules/jobs/app/routes/albaranes.routes.ts',
  'src/modules/jobs/domain/recapitulativa.service.ts',
];

const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');

function fuentesTs(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) fuentesTs(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

const esFuncion = (n) =>
  ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n);

const nombreLlamada = (n, sf) => {
  const c = n.expression;
  return ts.isPropertyAccessExpression(c) ? c.name.text : ts.isIdentifier(c) ? c.text : null;
};

/** Llamadas a `nombre` con la pila de funciones envolventes, de dentro hacia fuera. */
function llamadasConEnvolventes(nombre, ruta) {
  const sf = ts.createSourceFile(ruta, fs.readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out = [];
  const visitar = (n, pila) => {
    const p = esFuncion(n) ? [...pila, n] : pila;
    if (ts.isCallExpression(n) && nombreLlamada(n, sf) === nombre) {
      out.push({ pila: p, linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, sf });
    }
    ts.forEachChild(n, (h) => visitar(h, p));
  };
  ts.forEachChild(sf, (n) => visitar(n, []));
  return out;
}

/** ¿Alguna de las funciones envolventes contiene una llamada a `nombre`? */
function algunaEnvolventeLlama(pila, sf, nombre) {
  return pila.some((fn) => {
    let visto = false;
    const v = (n) => {
      if (ts.isCallExpression(n) && nombreLlamada(n, sf) === nombre) visto = true;
      ts.forEachChild(n, v);
    };
    ts.forEachChild(fn, v);
    return visto;
  });
}

function llamaEnElFichero(nombre, ruta) {
  const sf = ts.createSourceFile(ruta, fs.readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let visto = false;
  const v = (n) => {
    if (ts.isCallExpression(n) && nombreLlamada(n, sf) === nombre) visto = true;
    ts.forEachChild(n, v);
  };
  ts.forEachChild(sf, v);
  return visto;
}

const TODOS = fuentesTs(SRC);

test('SCRUM-206b · toda emisión sella (o delega, y se dice en quién)', () => {
  const huerfanas = [];
  let emisiones = 0;

  for (const p of TODOS) {
    const r = rel(p);
    for (const { pila, linea, sf } of llamadasConEnvolventes(EMBUDO, p)) {
      emisiones += 1;
      if (DELEGA[r]) continue;
      if (!algunaEnvolventeLlama(pila, sf, SELLADORA)) huerfanas.push(`${r}:${linea}`);
    }
  }

  // Suelo: cero emisiones se lee igual que «todo bien». SCRUM-203 midió 7.
  assert.ok(
    emisiones >= 7,
    `🔴 ESCÁNER CIEGO: veo ${emisiones} emisiones y SCRUM-203 midió 7. Si \`${EMBUDO}\` cambió de ` +
      'nombre, este guard dejó de vigilar los caminos que dice vigilar, y su verde no significa nada.',
  );

  assert.deepEqual(
    huerfanas,
    [],
    '🔴 HAY EMISIÓN QUE NO SELLA:\n' + huerfanas.map((s) => `    ${s}`).join('\n') +
      '\n\n  Ahí se consume un número de la serie y se crea la factura, y nadie la mete en la\n' +
      '  cadena. Queda emitida, numerada y FUERA — y con el portón de SCRUM-206 puesto, además\n' +
      '  sin poder producir documento. En silencio.\n\n' +
      `  No cuentes con que el PDF la selle de rebote: \`sendInvoicePaymentRequest\` no toca el PDF\n` +
      `  ni el sellado. Llama a \`${SELLADORA}()\` DESPUÉS del commit, con el cliente global.`,
  );
});

test('SCRUM-206b · los llamadores de `emitInvoice` sellan (la delegación no es un agujero)', () => {
  for (const r of LLAMADORES_DE_EMIT) {
    const abs = path.join(RAIZ, r);
    assert.ok(fs.existsSync(abs), `🔴 ESCÁNER CIEGO: no encuentro ${r} — ¿se movió el llamador?`);
    assert.ok(
      llamaEnElFichero(SELLADORA, abs),
      `🔴 ${r} llama a \`emitInvoice\` y NO sella.\n\n` +
        '  `emitInvoice` está exento PORQUE delega en sus llamadores. Si un llamador deja de\n' +
        '  sellar, la exención pasa de justificada a falsa y la emisión queda huérfana sin que\n' +
        '  nada lo diga — que es peor que no haber tenido exención.',
    );
  }
});

test('SCRUM-206b (autoprueba) · el escáner ve una emisión sin sellar, y no confunde la buena', () => {
  // Un guard que nunca se ha visto en rojo es decoración. Dos ficheros sintéticos: uno que
  // emite sin sellar (tiene que salir) y otro con el patrón correcto (no puede salir).
  const malo = path.join(RAIZ, 'tests', '__tmp-emite-sin-sellar.ts');
  const bueno = path.join(RAIZ, 'tests', '__tmp-emite-y-sella.ts');
  fs.writeFileSync(malo, [
    'export async function x(prisma: any) {',
    '  const inv = await prisma.$transaction(async (tx: any) => {',
    '    const n = await allocateInvoiceNumber(tx, 1, {} as any);',
    '    return tx.invoice.create({ data: { number: n } });',
    '  });',
    '  return inv;',
    '}',
  ].join('\n'));
  fs.writeFileSync(bueno, [
    'export async function y(prisma: any, taxId: string) {',
    '  const inv = await prisma.$transaction(async (tx: any) => {',
    '    const n = await allocateInvoiceNumber(tx, 1, {} as any);',
    '    return tx.invoice.create({ data: { number: n } });',
    '  });',
    '  await applyVeriFactu(inv, taxId, prisma);',
    '  return inv;',
    '}',
  ].join('\n'));

  try {
    const sinSellar = llamadasConEnvolventes(EMBUDO, malo);
    assert.equal(sinSellar.length, 1, '🔴 el escáner no ve la emisión sintética');
    assert.ok(
      !algunaEnvolventeLlama(sinSellar[0].pila, sinSellar[0].sf, SELLADORA),
      '🔴 el escáner cree que la emisión sin sellar sella',
    );

    const conSellado = llamadasConEnvolventes(EMBUDO, bueno);
    assert.equal(conSellado.length, 1);
    assert.ok(
      algunaEnvolventeLlama(conSellado[0].pila, conSellado[0].sf, SELLADORA),
      '🔴 FALSO POSITIVO: el sellado está en la función ENVOLVENTE (fuera de la transacción, que ' +
        'es donde debe estar) y el escáner no lo ve. Sin subir por las envolventes, este guard ' +
        'pondría rojo justo el patrón correcto.',
    );
  } finally {
    fs.rmSync(malo, { force: true });
    fs.rmSync(bueno, { force: true });
  }
});
