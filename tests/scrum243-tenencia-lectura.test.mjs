// SCRUM-243 · EL AISLAMIENTO ENTRE MERCHANTS EN LECTURA DEJA DE SER DISCIPLINA.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ AFIRMA ESTE FICHERO, Y QUÉ NO
//
// NO afirma que hoy haya una fuga. Afirma lo contrario, y con un número: **CERO** lecturas sin
// comprobación de merchant en rutas autenticadas. Lo que vigila es que ese cero SIGA siendo cero
// y que las 44 excepciones no crezcan en silencio.
//
// La regla 2 de CLAUDE.md —«toda query filtra por `req.merchantId`»— estaba escrita y no existía
// en ningún sitio que una máquina pudiera comprobar. Prohibición sin mecanismo, el patrón de la
// casa. Esto es el mecanismo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// GUARD Y NO MIDDLEWARE, y la medición lo decidió
//
// 69 ficheros distintos contienen lecturas de modelos con `merchantId`: no hay embudo, cada ruta
// consulta por su cuenta. Un middleware exigiría refactorizar los 69 o montar un cliente Prisma
// extendido con `AsyncLocalStorage` — arquitectura, no un ticket. Y la urgencia no lo pide,
// porque el número que la justificaría es cero.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE NO SE HA MEDIDO, dicho aquí y no en una nota al pie
//
//   1. No se resuelven variables ni llamadas más de un nivel: las 13 lecturas del cubo
//      INDIRECTO y las que se salvan por «su función menciona `merchantId`» están clasificadas
//      por INDICIO, no por prueba.
//   2. «La función menciona `merchantId`» no demuestra que lo use en ESA consulta.
//   3. De las 44 SIN RED se han leído unas pocas (las de `/pay`, `/recibo`, `/albaran` y los dos
//      `groupBy` de métricas). Las demás están clasificadas por CATEGORÍA, no verificadas una a
//      una. Están marcadas abajo.
//   4. No se cuentan lecturas anidadas vía `include`.
//
// Ninguna de las cuatro invalida el guard —el ratchet caza el crecimiento igual—, pero un censo
// que no declara sus límites se lee como si los hubiera cubierto.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { analizarArbol, analizarFuente, modelosConMerchant, montajes, esMontajeAutenticado } from './_tenencia-lectura.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── EL CENSO CONGELADO (30/31-jul-2026) ──────────────────────────────────────────────────
//
// Por FICHERO y cantidad, NO por `fichero:línea`: anclar a la línea pondría este guard en rojo
// cada vez que alguien añade un import diez líneas más arriba, y un guard que grita sin motivo
// se acaba puenteando igual que uno que no grita nunca (lección de SCRUM-182/203).
//
// «SIN RED» = la lectura no filtra por `merchantId` en su `where` Y su función no lo menciona en
// ningún sitio. O sea: no hay ni siquiera una comprobación aparte.
const CENSO_SIN_RED = [
  // ── Rutas PÚBLICAS por token OPACO (SCRUM-74): el token ES la autorización. VERIFICADAS
  //    leyendo el código las de payMp, receipt y albaranPublic (`receiptToken`, `firmaToken`).
  ['src/modules/billing/app/routes/payBank.routes.ts', 1],
  ['src/modules/billing/app/routes/payBizum.routes.ts', 1],
  ['src/modules/billing/app/routes/payCard.routes.ts', 1],
  ['src/modules/billing/app/routes/payInvoice.routes.ts', 2],
  ['src/modules/billing/app/routes/payMp.routes.ts', 2],
  ['src/modules/billing/app/routes/receipt.routes.ts', 9],
  ['src/modules/jobs/app/routes/albaranPublic.routes.ts', 1],
  ['src/modules/system/app/routes/quoteDecisionLanding.routes.ts', 2],
  ['src/modules/system/app/routes/customerPortal.routes.ts', 3],
  ['src/modules/quotes/domain/quoteToken.service.ts', 1],

  // ── `charges.routes.ts` YA NO ESTÁ EN ESTE CENSO, y bajar es para lo que sirve un censo.
  //    Tenía 1: el `findUnique({ where: { id } })` de `GET /:id`, que devolvía el cobro de
  //    CUALQUIER merchant. SCRUM-251 retiró su `GET /` (findMany sin `where`) y SCRUM-254 el
  //    `GET /:id`, así que el fichero cae a CERO y sale: **45 → 44**. Los dos se RETIRARON en
  //    vez de filtrarse porque no tenían llamadores reales — cero superficie es mejor que
  //    superficie filtrada, y el motivo quedó escrito junto a donde estaba cada consulta.

  // ── Herramienta de desarrollo.
  ['src/modules/system/app/routes/dev.routes.ts', 1],

  // ── Sesiones y miembros: se buscan por su propio identificador de sesión, no por merchant.
  ['src/modules/auth/domain/auth.service.ts', 2],
  // SCRUM-360 (H5 fase 2). DECISIÓN, no trámite: el `sessionId` NO viene del cliente — lo pone
  // `requireAuth` a partir de la cookie de quien llama, así que la fila leída es SIEMPRE la
  // sesión del propio llamante y no hay ninguna otra que pueda alcanzar. Filtrar además por
  // merchant no añadiría seguridad y sí sugeriría que el id es un parámetro de entrada, que es
  // justo la lectura equivocada. Misma categoría que la línea de arriba: se busca por su propio
  // identificador de sesión, no por merchant.
  ['src/modules/auth/domain/entornoApp.service.ts', 1],

  // ── Servicios y crons que reciben ids ya resueltos aguas arriba. [CATEGORÍA DECLARADA, NO
  //    VERIFICADA UNA A UNA — es el trabajo caro que este ticket deja explícitamente pendiente.]
  ['src/lib/invoicing.ts', 1],
  ['src/modules/jobs/domain/job.service.ts', 6],
  ['src/modules/billing/domain/invoiceReminder.service.ts', 2],
  ['src/modules/messaging/domain/email.service.ts', 2],
  ['src/modules/messaging/domain/whatsappLog.service.ts', 1],
  ['src/modules/whatsappBot/domain/botFlow.service.ts', 1],
  ['src/modules/whatsappBot/app/routes/whatsappIncoming.routes.ts', 2],
  ['src/modules/invoicing/app/routes/invoice.routes.ts', 1],
  ['src/modules/quotes/app/routes/quotes.routes.ts', 2],

  // ── 🔴 SCRUM-475 (fase 2B) · 44 → 45. SUBE, y es una DECISIÓN tomada a conciencia.
  //    El receptor del webhook de correo busca la fila de su envío por `provider_id`, y NO PUEDE
  //    filtrar por merchant porque no hay ninguno a mano: el aviso de entrega o de rebote lo manda
  //    el proveedor, no una sesión. No hay cookie, no hay `req.merchantId`, y no los habrá nunca.
  //
  //    Es la MISMA categoría que las rutas públicas por token opaco de arriba: `provider_id` lo
  //    generó el proveedor, es `@unique` en la tabla y no es adivinable ni enumerable. Quien no
  //    tenga ese identificador exacto no alcanza ninguna fila — y para llegar aquí ha tenido
  //    además que firmar el aviso con nuestro secreto (`verificarFirmaResend`, fail-closed).
  //
  //    ⚠️ Y lo que se hace con la fila está acotado: solo AVANZA su estado por el embudo, que es
  //    monótono. No se leen datos del merchant, no se devuelven —el receptor contesta `{ok:true}`
  //    y nada más— y si no hay fila NO SE CREA ninguna.
  ['src/modules/messaging/domain/registroDeEnvios.ts', 1],
];
const TOTAL_SIN_RED = CENSO_SIN_RED.reduce((t, [, n]) => t + n, 0);   // 45 (44 + el receptor de SCRUM-475 2B)
const MINIMO_QUE_FILTRAN = 196;

// ── SUELO, EN DOS MITADES ────────────────────────────────────────────────────────────────
//
// El guard duro es NEGATIVO («cero lecturas sin red en rutas autenticadas»), y un cero es a la
// vez la respuesta buena y la de un analizador que no miró nada. Ayer ese cero se comprobó con
// suelo antes de reportarlo, y aquí se fija: sin las dos mitades, este fichero podría pasar en
// verde con el árbol vacío o con el mapa de montajes roto.

test('SCRUM-243 · ① el analizador distingue los tres cubos y no se deja engañar', () => {
  const cm = new Set(['invoice', 'quote']);
  const uno = (codigo) => analizarFuente(codigo, 'x.ts', cm)[0];

  assert.equal(uno('await prisma.invoice.findMany({ where: { merchantId: 7 } });').cubo, 'filtra',
    '🔴 no reconoce el filtro más simple que existe');
  assert.equal(uno('await prisma.invoice.findMany({ where: { quote: { merchantId: 7 } } });').cubo, 'filtra',
    '🔴 no ve el filtro ANIDADO por relación, que es filtro igual');
  assert.equal(uno('await prisma.invoice.findMany({ where: whereRango(merchantId, r) });').cubo, 'indirecto',
    '🔴 un where por LLAMADA no es «no filtra»: es «no lo puedo afirmar». Contarlo como agujero ' +
    'infla el censo, y un número inflado en seguridad es tan inútil como uno corto.');
  assert.equal(uno('await prisma.invoice.findMany({ where: filtros });').cubo, 'indirecto',
    '🔴 un where por VARIABLE tampoco se puede afirmar desde el literal');
  assert.equal(uno('await prisma.invoice.findMany({ where: { id: 1 } });').cubo, 'sin-filtro');
  assert.equal(uno('await prisma.invoice.findMany({ take: 20 });').cubo, 'sin-filtro',
    '🔴 sin `where` ninguno es el caso más grave y tiene que caer en sin-filtro');

  // El `merchantId` que NO es un filtro: en el `data` de una escritura, en un `select`, o en un
  // comentario. Si alguno contara, el guard daría verde sobre consultas que no filtran nada.
  assert.equal(uno('await prisma.invoice.findMany({ where: { id: 1 }, select: { merchantId: true } });').cubo,
    'sin-filtro', '🔴 un `merchantId` en el SELECT se está tomando por un filtro');
  assert.equal(analizarFuente('// ojo: filtra por merchantId\nawait prisma.invoice.findMany({ where: { id: 1 } });', 'x.ts', cm)[0].cubo,
    'sin-filtro', '🔴 mira TEXTO y no nodos: un comentario le vale como filtro');

  // SIN RED mira la FUNCIÓN entera, no solo el where: una comprobación aparte cuenta como red.
  const conReja = analizarFuente(
    'async function f(req) { const inv = await prisma.invoice.findUnique({ where: { id: 1 } });' +
    ' if (inv.merchantId !== req.merchantId) throw new Error("ajeno"); }', 'x.ts', cm)[0];
  assert.equal(conReja.cubo, 'sin-filtro', 'el where sigue sin filtrar…');
  assert.equal(conReja.sinRed, false, '…pero NO está sin red: la función comprueba el merchant aparte');

  const sinReja = analizarFuente(
    'async function f() { await prisma.invoice.findUnique({ where: { id: 1 } }); }', 'x.ts', cm)[0];
  assert.equal(sinReja.sinRed, true, '🔴 esta no tiene ninguna comprobación y tiene que salir SIN RED');
});

test('SCRUM-243 · ② el análisis recorrió el árbol REAL y leyó el mapa de montajes', () => {
  const modelos = modelosConMerchant(RAIZ);
  assert.ok(modelos.size >= 21,
    `🔴 solo ${modelos.size} modelos con merchantId; el 30-jul había 21. Si el schema se lee mal, ` +
    'todo lo de abajo mide sobre un conjunto vacío y pasa en verde sin haber mirado.');

  const mont = montajes(RAIZ);
  const autenticados = [...mont.values()].filter(esMontajeAutenticado).length;
  assert.ok(mont.size >= 40, `🔴 solo ${mont.size} routers con montaje detectado (el 30-jul: 43)`);
  assert.ok(autenticados >= 20,
    `🔴 solo ${autenticados} montajes AUTENTICADOS detectados (el 30-jul: 22). Si esto llegara a 0, ` +
    'el guard duro de abajo daría CERO por construcción: no porque no haya fugas, sino porque no ' +
    'reconocería una ruta autenticada aunque la tuviera delante.');

  const todas = analizarArbol(RAIZ);
  assert.ok(todas.length >= 300,
    `🔴 solo ${todas.length} lecturas encontradas; el 30-jul había 325 sobre modelos con merchantId`);
  assert.ok(todas.filter((h) => h.cubo === 'filtra').length >= MINIMO_QUE_FILTRAN,
    `🔴 solo ${todas.filter((h) => h.cubo === 'filtra').length} lecturas filtran por merchantId, y el ` +
    `30-jul filtraban ${MINIMO_QUE_FILTRAN}. Que BAJE no significa que se hayan borrado consultas: ` +
    'significa que alguna dejó de filtrar, o que el analizador dejó de reconocer el filtro.');
});

// ── EL GUARD DURO ────────────────────────────────────────────────────────────────────────

test('SCRUM-243 · NINGUNA lectura sin comprobación de merchant en ruta AUTENTICADA', () => {
  const fugas = analizarArbol(RAIZ)
    .filter((h) => h.sinRed && h.autenticada === true)
    .map((h) => `${h.ruta}:${h.linea}  ${h.modelo}.${h.metodo}`);

  assert.deepEqual(fugas, [],
    '🔴 UNA RUTA AUTENTICADA LEE SIN COMPROBAR EL MERCHANT:\n    ' + fugas.join('\n    ') +
    '\n\n  Eso significa que un profesional con sesión puede pedir un id que no es suyo y llevarse\n' +
    '  el dato de otro. No es un fallo de estilo: es que los datos de un cliente salgan por la\n' +
    '  puerta del cliente de al lado.\n\n' +
    '  El arreglo es filtrar por `req.merchantId` en el `where` (regla 2 de CLAUDE.md), o —si la\n' +
    '  consulta es legítimamente global— comprobarlo aparte en la misma función y dejar escrito\n' +
    '  por qué. Relajar este guard no es una opción.');
});

// ── EL RATCHET ───────────────────────────────────────────────────────────────────────────

test('SCRUM-243 · las 44 excepciones SIN RED no crecen en silencio', () => {
  const sinRed = analizarArbol(RAIZ).filter((h) => h.sinRed);
  const actual = new Map();
  for (const h of sinRed) actual.set(h.ruta, (actual.get(h.ruta) || 0) + 1);
  const censo = new Map(CENSO_SIN_RED);

  const nuevas = [...actual].filter(([f]) => !censo.has(f)).map(([f, n]) => `${f} (×${n}) — FICHERO NUEVO`);
  const crecidas = [...actual]
    .filter(([f, n]) => censo.has(f) && n > censo.get(f))
    .map(([f, n]) => `${f} (censo ${censo.get(f)} → ahora ${n})`);

  assert.deepEqual([...nuevas, ...crecidas], [],
    '🔴 HAN APARECIDO LECTURAS SIN NINGUNA COMPROBACIÓN DE MERCHANT:\n    ' +
    [...nuevas, ...crecidas].join('\n    ') +
    '\n\n  El censo es de 44 en 21 ficheros (eran 45 en 22 hasta que SCRUM-254 vació charges.routes.ts), y cada uno está ahí con su motivo\n' +
    '  escrito arriba. Una nueva no es automáticamente un fallo — puede ser otra ruta pública por\n' +
    '  token— pero SÍ es una decisión que alguien tiene que tomar a conciencia y dejar escrita,\n' +
    '  en vez de que entre sin que nadie la vea.\n\n' +
    '  Si es legítima: añádela al censo CON SU MOTIVO. Si no: filtra por `merchantId`.',
  );

  // Que BAJE es buena noticia y no rompe nada, pero el total se fija para que el ratchet no se
  // pueda satisfacer borrando entradas del censo en vez de arreglando consultas.
  assert.ok(sinRed.length <= TOTAL_SIN_RED,
    `🔴 hay ${sinRed.length} lecturas sin red y el censo declara ${TOTAL_SIN_RED}`);
});
