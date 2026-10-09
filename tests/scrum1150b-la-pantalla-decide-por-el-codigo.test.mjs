// tests/scrum1150b-la-pantalla-decide-por-el-codigo.test.mjs — SCRUM-1150, la mitad de la PANTALLA.
//
// Si «Crear revisión» falla, la pantalla pintaba `data.message` de cualquier respuesta. Uno de esos
// mensajes era el diagnóstico de un programador («DOS VIGENTES A LA VEZ: …», ocho líneas a 390 px).
// S1 ya hizo su mitad (#2330): un código por causa y sin `message` en los 409 de grupo.
//
// Firmado por el orquestador por delegación del fundador (SCRUM-1150, comentario 18740):
//   · LA CONDUCTA: la pantalla decide por el CÓDIGO y no pinta lo que venga en `message`. El único
//     `message` que pasa tal cual es el de `descuento_global_con_varios_iva`. Lo demás, al general.
//   · DOS LITERALES: `quote_sin_numero` y `quote_not_found`.
// `revisiones_dos_vigentes` tiene frase propuesta (c.19098) y SIN FIRMA: no se pinta; cae en el
// general. Cuando se firme, cambia UNA fila de `DECISION` y el caso que la fija.
//
// DOS MITADES:
//   ① EL VIAJE — ficha montada en el banco, clic, la respuesta pasa por el `apiRequest` REAL, y se
//      lee el aviso pintado. Incluye la PUERTA: un `message` de excepción con un código cualquiera
//      no llega a la pantalla.
//   ② LA ATADURA PANTALLA ↔ SERVIDOR, por AST y sobre los DOS árboles (`src/` y `public/`): los
//      códigos que la ruta puede contestar son exactamente los de `DECISION`, y los que la pantalla
//      nombra existen en el servidor. Un código nuevo en `src/` pone esto en rojo hasta que alguien
//      decida qué lee el profesional. El censo de S1 (`scrum1150-un-codigo-por-causa`) recorre
//      `src/` y no mira `public/`: esta mitad es la que faltaba.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { casosEscritos } from './_casos-escritos.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const GENERAL = 'No se ha podido crear la revisión. Vuelve a intentarlo.'; // SCRUM-688
const L2R = 'No se puede crear una revisión: este presupuesto tiene un descuento global y varios tipos de IVA. Duplícalo, pon el descuento en cada línea y envíaselo al cliente para que lo firme.'; // SCRUM-887
const DIAGNOSTICO = 'DOS VIGENTES A LA VEZ: 2004226.1 (revisión 1) y 2004226.1 (revisión 1). «Cuál está vigente» con dos respuestas no es una respuesta.';

/**
 * Qué lee el profesional por cada código que `POST /admin/quotes/:id/revisiones` puede contestar.
 * `texto: null` + `mensaje: true` = se pinta el `message` del servidor (sólo uno).
 */
const DECISION = [
  { codigo: 'quote_sin_numero', status: 409, lee: 'No se puede crear una revisión: este presupuesto no tiene número.', por: 'literal firmado en c.18740' },
  { codigo: 'quote_not_found', status: 404, lee: 'No se puede crear una revisión: este presupuesto ya no existe.', por: 'literal firmado en c.18740' },
  { codigo: 'descuento_global_con_varios_iva', status: 400, lee: L2R, por: 'el `message` del servidor, firmado en SCRUM-887', mensajeDelServidor: L2R },
  { codigo: 'revisiones_dos_vigentes', status: 409, lee: GENERAL, por: 'su frase (c.19098) NO está firmada: hasta entonces, el general' },
  { codigo: 'revisiones_sin_leer', status: 409, lee: GENERAL, por: 'reintentar es cierto (c.19085)' },
  { codigo: 'revision_no_posterior', status: 409, lee: GENERAL, por: 'fallo nuestro, sin frase propia (c.19085)' },
  { codigo: 'revisiones_sin_la_propia', status: 409, lee: GENERAL, por: 'no lo alcanza esta ruta; si llegara, el general (c.19085)' },
  { codigo: 'invalid_quote_id', status: 400, lee: GENERAL, por: 'general firmado (c.18736)' },
  { codigo: 'internal_error', status: 500, lee: GENERAL, por: 'general firmado (SCRUM-1215)' },
];

// ───────────────────────────── ① EL VIAJE ─────────────────────────────
const UNA = [
  { id: 1, revision: 0, numero: 'P7', status: 'sent', firmado: false, total: '100.00', createdAt: '2026-09-20T10:00:00.000Z', vigente: true },
];
const presupuesto = {
  id: 1, number: 7, quoteNumber: 7, revision: 0, numeroConRevision: 'P7', revisiones: UNA, vigenteId: 1,
  status: 'sent', total: '100.00', currency: 'EUR', payToken: 'tok1',
  lines: [{ concept: 'Punto de luz', qty: 2, price: 50, tax: 0.21 }],
  createdAt: '2026-09-20T10:00:00.000Z', updatedAt: '2026-09-20T10:00:00.000Z',
  customer: { id: 3, name: 'Ana Ruiz', phone: '34000000001', email: null, notes: null },
  merchant: { id: 7, name: 'QA 1150', legalName: null, taxId: null, address: null, whatsappPhone: null, defaultCurrency: 'EUR', logoUrl: null },
  charge: null, invoices: [],
  decision: { acceptedAt: null, rejectedAt: null, decisionChannel: null, decisionComment: null, rejectionReason: null, paymentTerms: 'FULL_UPFRONT', evidence: null },
  billingPlan: [], nextStage: null, hasCustomPlan: false,
  asignados: [], waDelivery: null, tags: null, internalNotes: null, signatureUrl: null, firmaConTrazo: false,
};
const respuesta = (status, cuerpo) => ({
  ok: status >= 200 && status < 300, status, statusText: status === 500 ? 'Internal Server Error' : 'Conflict',
  headers: { get: () => 'application/json' },
  json: async () => cuerpo,
  blob: async () => ({}), text: async () => JSON.stringify(cuerpo),
});
const attr = (n, a) => (n.getAttribute ? n.getAttribute(a) : null);
const pausa = () => new Promise((ok) => setTimeout(ok, 60));

/** Monta la ficha y devuelve cómo pulsar «Crear revisión» y cómo leer los avisos. `alPost(n)` contesta el POST nº n. */
async function ficha(alPost) {
  const posts = [];
  const banco = cargarDashboard(RAIZ, {
    datos: (url) => (/\/admin\/quotes\/1$/.test(String(url)) ? presupuesto : []),
    red: {
      fetch: async (url, opts) => {
        const u = String(url);
        const metodo = String((opts && opts.method) || 'GET').toUpperCase();
        if (metodo === 'POST' && /\/admin\/quotes\/\d+\/revisiones$/.test(u)) { posts.push(u); return alPost(posts.length); }
        return respuesta(200, /\/admin\/quotes\/1$/.test(u) ? presupuesto : []);
      },
    },
  });
  banco.ctx.appUserRole = 'admin';
  banco.ctx.renderAppView = () => {};
  const r = await pintarVista(banco, 'renderQuoteDetailView', 1);
  assert.equal(r.error, null, `🔴 la ficha revienta: ${r.error && r.error.message}`);
  const btn = todos(r.contenedor).filter((n) => attr(n, 'data-revision-crear') != null);
  assert.equal(btn.length, 1, 'CIEGO: el admin no ve «Crear revisión»; no hay viaje que medir');
  return {
    posts,
    pulsar: async () => { btn[0].click(); await pausa(); },
    avisos: () => todos(r.contenedor).filter((n) => attr(n, 'data-revision-error') === '1'),
  };
}

async function avisoTrasCrear(alPost) {
  const f = await ficha(alPost);
  await f.pulsar();
  assert.equal(f.posts.length, 1, 'CIEGO: el clic no llegó a hacer el POST');
  const a = f.avisos();
  assert.equal(a.length, 1, `CIEGO: se esperaba UN aviso de error tras el fallo; hay ${a.length}`);
  return a[0];
}

const decide = casosEscritos(DECISION, (d) => `SCRUM-1150b · 🔴 ${d.codigo} → se lee lo decidido para ese código, aunque el servidor mande un diagnóstico en message`, async (d) => {
  // El servidor de hoy manda `message` en unos códigos y no en otros. Aquí se le pone SIEMPRE uno:
  // el firmado donde toca, y un diagnóstico de programador en todos los demás. Es la puerta.
  const cuerpo = { error: d.codigo, message: d.mensajeDelServidor || DIAGNOSTICO };
  const aviso = await avisoTrasCrear(() => respuesta(d.status, cuerpo));
  assert.equal(aviso.textContent, d.lee, `🔴 con ${d.codigo} no se lee lo decidido (${d.por})`);
});
test('SCRUM-1150b · 🔴 quote_sin_numero → se lee lo decidido para ese código, aunque el servidor mande un diagnóstico en message', decide(0));
test('SCRUM-1150b · 🔴 quote_not_found → se lee lo decidido para ese código, aunque el servidor mande un diagnóstico en message', decide(1));
test('SCRUM-1150b · 🔴 descuento_global_con_varios_iva → se lee lo decidido para ese código, aunque el servidor mande un diagnóstico en message', decide(2));
test('SCRUM-1150b · 🔴 revisiones_dos_vigentes → se lee lo decidido para ese código, aunque el servidor mande un diagnóstico en message', decide(3));
test('SCRUM-1150b · 🔴 revisiones_sin_leer → se lee lo decidido para ese código, aunque el servidor mande un diagnóstico en message', decide(4));
test('SCRUM-1150b · 🔴 revision_no_posterior → se lee lo decidido para ese código, aunque el servidor mande un diagnóstico en message', decide(5));
test('SCRUM-1150b · 🔴 revisiones_sin_la_propia → se lee lo decidido para ese código, aunque el servidor mande un diagnóstico en message', decide(6));
test('SCRUM-1150b · 🔴 invalid_quote_id → se lee lo decidido para ese código, aunque el servidor mande un diagnóstico en message', decide(7));
test('SCRUM-1150b · 🔴 internal_error → se lee lo decidido para ese código, aunque el servidor mande un diagnóstico en message', decide(8));
decide.todos();

test('SCRUM-1150b · 🔴 LA PUERTA: un código que nadie conoce, con un mensaje de excepción dentro, cae en el general', async () => {
  const aviso = await avisoTrasCrear(() => respuesta(409, { error: 'un_codigo_que_nace_manana', message: DIAGNOSTICO }));
  assert.equal(aviso.textContent, GENERAL, '🔴 un mensaje de excepción nuevo ha llegado a la pantalla');
});

test('SCRUM-1150b · el código que trae su texto, SIN texto, cae en el general (no pinta un hueco)', async () => {
  const aviso = await avisoTrasCrear(() => respuesta(400, { error: 'descuento_global_con_varios_iva' }));
  assert.equal(aviso.textContent, GENERAL);
});

test('SCRUM-1150b · sin red y sin cuerpo: el general, no el texto del navegador', async () => {
  const aviso = await avisoTrasCrear(() => { throw new TypeError('Failed to fetch'); });
  assert.equal(aviso.textContent, GENERAL);
});

test('SCRUM-1150b · 🔴 el aviso lleva role="alert": aparece después de pulsar y un lector de pantalla tiene que oírlo', async () => {
  const aviso = await avisoTrasCrear(() => respuesta(500, { error: 'internal_error' }));
  assert.equal(attr(aviso, 'role'), 'alert');
});

test('SCRUM-1150b · 🔴 dos fallos seguidos dejan UN aviso, el del último, no uno debajo de otro', async () => {
  const f = await ficha((n) => (n === 1
    ? respuesta(409, { error: 'quote_sin_numero' })
    : respuesta(404, { error: 'quote_not_found' })));
  await f.pulsar();
  assert.equal(f.avisos().length, 1, 'CIEGO: el primer fallo no pinta su aviso');
  await f.pulsar();
  assert.equal(f.posts.length, 2, 'CIEGO: el segundo clic no llegó a hacer el POST (¿el botón se quedó desactivado?)');
  const a = f.avisos();
  assert.equal(a.length, 1, `🔴 tras dos fallos hay ${a.length} avisos colgados`);
  assert.equal(a[0].textContent, DECISION[1].lee, '🔴 el aviso que queda no es el del último intento');
});

// ───────────────────── ② LA ATADURA PANTALLA ↔ SERVIDOR (AST, dos árboles) ─────────────────────
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
const arbol = (rel) => ts.createSourceFile(rel, leer(rel), ts.ScriptTarget.ES2022, true, rel.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
function recorrer(nodo, visita) { visita(nodo); ts.forEachChild(nodo, (h) => recorrer(h, visita)); }

/** El valor de `export const NOMBRE = '…'` en un fichero de `src/`. */
function constanteDeTexto(rel, nombre) {
  let valor = null;
  recorrer(arbol(rel), (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === nombre && n.initializer && ts.isStringLiteralLike(n.initializer)) valor = n.initializer.text;
  });
  assert.notEqual(valor, null, `CIEGO: no encuentro la constante ${nombre} en ${rel}`);
  return valor;
}

/** Los códigos que `POST /admin/quotes/:id/revisiones` puede poner en `error`, leídos del código. */
function codigosDelServidor() {
  const codigos = new Set();
  const fuentes = [];
  // a) `new RevisionNoCreable(<motivo>, …)`, donde se lance.
  const QA = 'src/modules/system/quoteAdmin.ts';
  let lanzamientos = 0;
  recorrer(arbol(QA), (n) => {
    if (!ts.isNewExpression(n) || !ts.isIdentifier(n.expression) || n.expression.text !== 'RevisionNoCreable') return;
    lanzamientos += 1;
    const a = n.arguments && n.arguments[0];
    if (a && ts.isStringLiteralLike(a)) codigos.add(a.text);
    else if (a && ts.isIdentifier(a) && a.text === 'ERROR_DESCUENTO_GLOBAL_VARIOS_IVA') codigos.add(constanteDeTexto('src/modules/quotes/domain/descuentoGlobalConVariosIva.ts', a.text));
    else assert.fail(`CIEGO: un RevisionNoCreable de ${QA} lleva un motivo que no sé leer`);
  });
  assert.ok(lanzamientos >= 3, `CIEGO: sólo veo ${lanzamientos} «new RevisionNoCreable» en ${QA} (había 3)`);
  fuentes.push(`${lanzamientos} lanzamientos en ${QA}`);
  // b) los dos tipos cerrados de motivo de `revision.ts` (lo que la ruta manda como `error` en sus 409).
  const REV = 'src/modules/quotes/domain/revision.ts';
  const tipos = new Map();
  recorrer(arbol(REV), (n) => {
    if (!ts.isTypeAliasDeclaration(n) || !/^MotivoDe(RevisionesAmbiguas|CensoCiego)$/.test(n.name.text)) return;
    const literales = [];
    recorrer(n.type, (h) => { if (ts.isLiteralTypeNode(h) && ts.isStringLiteralLike(h.literal)) literales.push(h.literal.text); });
    tipos.set(n.name.text, literales);
  });
  assert.deepEqual([...tipos.keys()].sort(), ['MotivoDeCensoCiego', 'MotivoDeRevisionesAmbiguas'], `CIEGO: no encuentro los dos tipos de motivo en ${REV}`);
  for (const [, lits] of tipos) { assert.ok(lits.length >= 1, 'CIEGO: un tipo de motivo sin literales'); lits.forEach((l) => codigos.add(l)); }
  fuentes.push(`${[...tipos.values()].flat().length} motivos en ${REV}`);
  // c) los literales que la propia ruta escribe en `res.status(…).json({ error: '…' })`.
  const RUTA = 'src/modules/system/app/routes/quotesAdmin.routes.ts';
  let rutas = 0;
  recorrer(arbol(RUTA), (n) => {
    if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression) || n.expression.name.text !== 'post') return;
    const a0 = n.arguments[0];
    if (!a0 || !ts.isStringLiteralLike(a0) || a0.text !== '/:id/revisiones') return;
    rutas += 1;
    recorrer(n, (h) => {
      if (ts.isPropertyAssignment(h) && ts.isIdentifier(h.name) && h.name.text === 'error' && ts.isStringLiteralLike(h.initializer)) codigos.add(h.initializer.text);
    });
  });
  assert.equal(rutas, 1, `CIEGO: esperaba UNA ruta POST '/:id/revisiones' en ${RUTA} y veo ${rutas}`);
  fuentes.push(`1 ruta en ${RUTA}`);
  return { codigos: [...codigos].sort(), fuentes };
}

/** Los códigos que la PANTALLA nombra para decidir: las claves de su tabla y el que trae su texto. */
function codigosDeLaPantalla() {
  const REL = 'public/dashboard/js/quoteRevisiones.js';
  let claves = null; let conTexto = null; const textos = {};
  recorrer(arbol(REL), (n) => {
    if (!ts.isVariableDeclaration(n) || !ts.isIdentifier(n.name) || !n.initializer) return;
    if (n.name.text === 'TEXTO_POR_CODIGO' && ts.isObjectLiteralExpression(n.initializer)) {
      claves = n.initializer.properties.map((p) => {
        assert.ok(ts.isPropertyAssignment(p) && ts.isStringLiteralLike(p.initializer), 'CIEGO: una fila de TEXTO_POR_CODIGO no es `clave: literal`');
        textos[p.name.text] = p.initializer.text;
        return p.name.text;
      });
    }
    if (n.name.text === 'CODIGO_QUE_TRAE_SU_TEXTO' && ts.isStringLiteralLike(n.initializer)) conTexto = n.initializer.text;
  });
  assert.ok(claves && claves.length >= 1 && conTexto, `CIEGO: no encuentro TEXTO_POR_CODIGO o CODIGO_QUE_TRAE_SU_TEXTO en ${REL}`);
  return { claves, conTexto, textos };
}

test('SCRUM-1150b · 🔴 ATADURA: los códigos que la ruta puede contestar son EXACTAMENTE los decididos aquí', () => {
  const s = codigosDelServidor();
  console.log(`  servidor: ${s.codigos.length} códigos (${s.fuentes.join(' · ')})`);
  assert.deepEqual(s.codigos, DECISION.map((d) => d.codigo).sort(),
    '🔴 el servidor contesta un código que esta pantalla no ha decidido (o ha dejado de contestar uno). '
    + 'Un código NUEVO cae en el general: decide si eso es cierto para él y añade su fila a DECISION.');
});

test('SCRUM-1150b · 🔴 ATADURA: todo código que la pantalla nombra existe en el servidor, y sus textos son los firmados', () => {
  const s = codigosDelServidor();
  const p = codigosDeLaPantalla();
  const nombrados = [...p.claves, p.conTexto];
  console.log(`  pantalla: ${nombrados.length} códigos nombrados (${nombrados.join(', ')})`);
  for (const c of nombrados) assert.ok(s.codigos.includes(c), `🔴 la pantalla decide por «${c}», que el servidor no contesta: esa fila no se pinta nunca`);
  assert.equal(new Set(nombrados).size, nombrados.length, '🔴 un código está dos veces: como literal y como «trae su texto»');
  // Los literales de la tabla, letra por letra contra lo firmado (c.18740).
  const conLiteral = DECISION.filter((d) => d.lee !== GENERAL && !d.mensajeDelServidor);
  assert.deepEqual(p.textos, Object.fromEntries(conLiteral.map((d) => [d.codigo, d.lee])),
    '🔴 la tabla de la pantalla no es la firmada: sobra o falta un código con literal propio, o cambió una letra');
  assert.equal(p.conTexto, DECISION.find((d) => d.mensajeDelServidor).codigo);
});
