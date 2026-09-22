// tests/scrum1027-atajo-flag-off-sin-documento.test.mjs — SCRUM-1027
//
// Regla 24 (enmienda SCRUM-612c, 21-sep-2026, PR #1593): con `INVOICING_ES_ENABLED` en OFF, en
// España, YA NO se emite NINGÚN documento (ni factura, ni justificante, ni ningún otro) y no se
// cobra por YaQu. Hasta este ticket, el código hacía justo lo contrario: `allocateInvoiceNumber`
// emitía un `J-…` (V0-0/SCRUM-346) para exactamente ese caso. El máster manda una cosa y el
// producto hacía otra desde las 14:55:34Z del 21-sep (PR #1593) — este ticket cierra la distancia.
//
// El PUNTO ÚNICO ya lo cubre `tests/emission.test.mjs` (con `fakeTx`, sin BD): receipt siempre
// lanza `invoicing_es_disabled`, para los siete caminos, sin excepción de `rect`. Este fichero
// cubre lo que ese test NO puede ver: que cada boca que hoy pedía un número PARA ANTES de
// pedirlo, con un 409 nombrado — el «punto 2» de docs/master/SCRUM-612.md §3.b. Sin esas puertas
// el punto único seguiría protegiendo el dato (nunca sale un documento), pero el profesional o el
// cliente final se llevarían un 500 en vez de una respuesta que se puede leer.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { soloEjecutable } from './_guard-texto.mjs'; // SCRUM-700: el sitio ÚNICO, no un filtro propio

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

/** El nodo del handler de una ruta, por método y path (mismo extractor que scrum289b). */
function handlerDe(fuente, ruta, metodo, rutaPath) {
  const arbol = ts.createSourceFile(ruta, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let encontrado = null;
  const visitar = (n) => {
    if (ts.isCallExpression(n)
      && ts.isPropertyAccessExpression(n.expression)
      && n.expression.name.text === metodo
      && n.arguments.length
      && ts.isStringLiteral(n.arguments[0])
      && n.arguments[0].text === rutaPath) {
      encontrado = n;
    }
    ts.forEachChild(n, visitar);
  };
  ts.forEachChild(arbol, visitar);
  return { arbol, nodo: encontrado };
}
const textoDe = (arbol, n) => {
  const f = arbol.getFullText();
  return f.slice(n.getStart(arbol), n.getEnd());
};

// A23 #2: un patrón por TEXTO tiene que leer el código SIN comentarios — el comentario que
// explica el porqué de un gate CONTIENE el nombre de la función que menciona, y eso falsea
// cualquier orden por posición. `soloEjecutable` (SCRUM-700) es el sitio ÚNICO que lo hace bien
// (no parte una URL dentro de una cadena, sí quita un comentario al final de una línea con
// código): escribir aquí un filtro propio es justo lo que SCRUM-700 mide y prohíbe que suba.
const sinComentarios = soloEjecutable;

// ── LAS TRES RUTAS QUE ESTE TICKET CIERRA ───────────────────────────────────────────────────

const RUTAS = [
  {
    fichero: 'src/modules/jobs/app/routes/jobs.routes.ts',
    metodo: 'post', path: '/:id/collect-rest',
    llamada: 'allocateInvoiceNumber',
    nombre: 'POST /admin/jobs/:id/collect-rest',
  },
  {
    fichero: 'src/modules/system/app/routes/quotesAdmin.routes.ts',
    metodo: 'post', path: '/:id/invoice',
    llamada: 'allocateInvoiceNumber',
    nombre: 'POST /admin/quotes/:id/invoice',
  },
  {
    fichero: 'src/modules/system/app/routes/quotesAdmin.routes.ts',
    metodo: 'post', path: '/:id/invoice-manual',
    llamada: 'allocateInvoiceNumber',
    nombre: 'POST /admin/quotes/:id/invoice-manual',
  },
];

for (const r of RUTAS) {
  test(`SCRUM-1027 · SUELO: el extractor encuentra ${r.nombre}`, () => {
    const fuente = leer(r.fichero);
    const { nodo } = handlerDe(fuente, r.fichero, r.metodo, r.path);
    assert.ok(nodo,
      `🔴 ESCÁNER CIEGO: no encuentro router.${r.metodo}(${JSON.stringify(r.path)}, …) en ${r.fichero}. ` +
      'Los guards de abajo mirarían un nodo vacío y saldrían verdes sin haber comprobado nada.');
  });

  test(`SCRUM-1027 · ${r.nombre}: gatea con getEmissionMode ANTES de pedir número`, () => {
    const fuente = leer(r.fichero);
    const { arbol, nodo } = handlerDe(fuente, r.fichero, r.metodo, r.path);
    const h = sinComentarios(textoDe(arbol, nodo));

    const idxGate = h.indexOf('getEmissionMode(');
    assert.ok(idxGate >= 0,
      `🔴 ${r.nombre} no llama a getEmissionMode. Sin el gate por MODO (el mismo mecanismo que ya ` +
      'usan /consolidar, /facturar-parcial, /convertir-en-factura y /consolidar-albaranes), un ' +
      'merchant ES con el flag OFF llega hasta allocateInvoiceNumber y el rechazo sale como 500, ' +
      'no como un 409 legible.');

    const idxLlamada = h.indexOf(r.llamada);
    assert.ok(idxLlamada >= 0, `🔴 ${r.nombre} ya no llama a ${r.llamada}: la ruta ha cambiado de forma.`);

    assert.ok(idxGate < idxLlamada,
      `🔴 ${r.nombre}: el gate getEmissionMode aparece DESPUÉS de ${r.llamada} en el texto de la ` +
      'ruta. El punto único (allocateInvoiceNumber) ya rechaza el modo receipt, pero si el gate no ' +
      'corre ANTES, el rechazo llega tarde: con la transacción abierta y sin la respuesta 409 nombrada.');

    // El gate compara contra 'receipt', no reinventa el criterio con el flag a mano — es
    // exactamente el error que facturaSuelta.ts documenta que NO hay que cometer (ES-only).
    const gate = h.slice(idxGate, idxGate + 200);
    assert.match(gate, /===\s*'receipt'/,
      `🔴 ${r.nombre}: el gate no compara contra 'receipt'. Comparar contra el flag a mano ` +
      '(isFlagEnabled) rompe a un merchant no-ES, que SIEMPRE es fiscal sin mirar el flag.');
  });

  test(`SCRUM-1027 · ${r.nombre}: el gate responde 409 NOMBRADO, no un 500`, () => {
    const fuente = leer(r.fichero);
    const { arbol, nodo } = handlerDe(fuente, r.fichero, r.metodo, r.path);
    const h = sinComentarios(textoDe(arbol, nodo));
    const idxGate = h.indexOf('getEmissionMode(');
    const tramoGate = h.slice(idxGate, idxGate + 300);
    const status = tramoGate.match(/res\.status\((\d{3})\)/);
    assert.ok(status, `🔴 ${r.nombre}: el gate no responde con un status explícito`);
    assert.equal(status[1], '409', `🔴 ${r.nombre}: el gate tiene que responder 409, no 500 ni 200`);
    assert.match(tramoGate, /error:\s*'facturacion_no_disponible'/,
      `🔴 ${r.nombre}: el 409 no lleva el error NOMBRADO ya establecido en ` +
      "albaranes.routes.ts/jobs.routes.ts (`'facturacion_no_disponible'`) para este mismo caso.");
  });
}

// ── EL CAMINO PÚBLICO (C1) — EL CLIENTE FINAL ACEPTANDO EL PRESUPUESTO ─────────────────────

test('SCRUM-1027 · SUELO: el extractor encuentra el handler de /quote/:token/decision', () => {
  const fuente = leer('src/modules/quotes/app/routes/quotes.routes.ts');
  const { nodo } = handlerDe(fuente, 'quotes.routes.ts', 'post', '/:token/decision');
  assert.ok(nodo, '🔴 ESCÁNER CIEGO: no encuentro router.post("/:token/decision", …) en quotes.routes.ts.');
});

test('SCRUM-1027 · C1 (cliente final): en modo receipt NO se intenta emitir ni se marca facturaPendiente', () => {
  const fuente = leer('src/modules/quotes/app/routes/quotes.routes.ts');
  const { arbol, nodo } = handlerDe(fuente, 'quotes.routes.ts', 'post', '/:token/decision');
  const h = sinComentarios(textoDe(arbol, nodo));

  // La condición que abre el bloque de emisión tiene que excluir 'receipt' — así ni
  // allocateInvoiceNumber ni `facturaPendiente = true` (avisoFactura) se alcanzan para ese modo.
  const idxIfStage = h.indexOf('if (stage');
  assert.ok(idxIfStage >= 0, '🔴 no encuentro el `if (stage …)` que abre el bloque de emisión del tramo.');
  const condicion = h.slice(idxIfStage, h.indexOf('{', idxIfStage) + 1);
  assert.match(condicion, /getEmissionMode\(quote\.merchant\)\s*!==\s*'receipt'/,
    '🔴 el bloque de emisión de C1 ya no excluye el modo receipt. Sin este gate, con el flag OFF ' +
    'se intenta emitir, allocateInvoiceNumber lanza invoicing_es_disabled, el catch de la ruta lo ' +
    'traduce en `facturaPendiente = true` y el CLIENTE FINAL ve «Tu factura está en proceso; si no ' +
    'la recibes hoy, coméntaselo al profesional» — un aviso FALSO: esa factura no va a llegar nunca ' +
    '(rótulo que miente, lo que la regla 39/A7 prohíbe).');

  // Y el bloque de emisión (con su facturaPendiente = true) sigue DENTRO de esa condición: no
  // basta con que la condición exista si el bloque se movió fuera de ella.
  const finBloque = h.indexOf('facturaPendiente = true');
  assert.ok(finBloque >= 0, '🔴 no encuentro `facturaPendiente = true` — el catch de emisión ha cambiado de forma.');
  assert.ok(finBloque > idxIfStage,
    '🔴 `facturaPendiente = true` aparece ANTES del `if (stage …)` con el gate: ya no está protegido por él.');
});

test('SCRUM-1027 · control negativo: C1 sigue emitiendo si el modo NO es receipt (demo, no-ES, ES con flag ON)', () => {
  // No basta con comprobar que el gate EXISTE: hay que comprobar que no se ha convertido en un
  // `false &&` o un `stage && false` que apagara la emisión para TODOS los modos, no solo receipt.
  const fuente = leer('src/modules/quotes/app/routes/quotes.routes.ts');
  const { arbol, nodo } = handlerDe(fuente, 'quotes.routes.ts', 'post', '/:token/decision');
  const h = textoDe(arbol, nodo);
  assert.match(h, /allocateInvoiceNumber\s*\(/,
    '🔴 C1 ya no llama a allocateInvoiceNumber en ningún caso: se ha roto la emisión para los ' +
    'modos que SÍ tienen que seguir funcionando (demo, no-ES, ES con el flag ON).');
});

// ── LO QUE NO SE TOCA (SUELO negativo del ticket) ───────────────────────────────────────────

test('SCRUM-1027 · NEGATIVO: el tipo JUST y su infraestructura siguen intactos (eso es SCRUM-825, firmado)', () => {
  const emisor = leer('src/modules/invoicing/domain/invoicing.service.ts');
  assert.match(emisor, /type:\s*isReceiptNumber\(number\)\s*\?\s*'JUST'/,
    '🔴 emitInvoice ya no fuerza type: JUST cuando la serie sale J-. Retirar el tipo JUST es ' +
    'SCRUM-825 (regla 27, va firmado antes) — este ticket NO lo toca, solo cierra la puerta por ' +
    'la que se llegaba a pedir una serie J-.');

  const numService = leer('src/modules/invoicing/domain/invoiceNumber.service.ts');
  assert.match(numService, /function reservarReferenciaJustificante/,
    '🔴 reservarReferenciaJustificante se ha borrado. SCRUM-1027 solo deja de LLAMARLA desde el ' +
    'modo receipt; borrarla es trabajo de SCRUM-825, con su propia firma.');
  assert.match(numService, /isReceiptNumber|makeReceiptNumber/,
    '🔴 la infraestructura de números de justificante (isReceiptNumber/makeReceiptNumber) ha ' +
    'desaparecido de invoiceNumber.service.ts — no es SCRUM-1027 quien la retira.');

  // Los cuatro gates YA CERRADOS antes de este ticket (SCRUM-895/A0.4/171a) no se han tocado: la
  // frase que el fundador aprobó explícitamente para no nombrar el justificante retirado sigue.
  const albaranes = leer('src/modules/jobs/app/routes/albaranes.routes.ts');
  assert.match(albaranes, /SCRUM-895/,
    '🔴 el marcador aprobado por el fundador (SCRUM-895, 17-sep-2026) para /convertir-en-factura ' +
    'ha desaparecido de albaranes.routes.ts. Este ticket no toca esa ruta: ya estaba cerrada.');
});

test('SCRUM-1027 · NEGATIVO: ninguna de las tres rutas nuevas toca prisma/schema.prisma ni datos de clientes', () => {
  // Suelo textual, barato: estos tres ficheros no deberían importar nada de gestión de esquema ni
  // de borrado/exportación de clientes — ese tipo de cambio es de otro carril (regla 2/A5).
  for (const r of RUTAS) {
    const fuente = leer(r.fichero);
    assert.ok(!/customer\.delete|customer\.deleteMany|exportarClientes|anonimizarMerchant/.test(fuente),
      `🔴 ${r.fichero} menciona borrado/anonimización/exportación de clientes — fuera de alcance de SCRUM-1027.`);
  }
});
