// tests/scrum1262-la-baja-corta-todas-las-vias.test.mjs — SCRUM-1262 (regla 28, J3)
//
// ¿RECIBE UN CLIENTE QUE SE DIO DE BAJA? — preguntado a los OCHO senders, ejecutándolos.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LOS DOS DEFECTOS, QUE NO SON EL MISMO
//
//  ① COBERTURA. La baja sólo se miraba en 2 de los 8 senders (`Template` y `WindowFirst`). Por
//     los otros seis, un número dado de baja recibía.
//  ② FAIL-OPEN. Y el corte que sí existía dejaba pasar si la consulta reventaba («ante la duda
//     no bloquear»). Una comprobación que no puede responder no es un permiso.
//
// Cada uno tiene su caso, porque arreglar el ① no arregla el ②: un corte nuevo que llamara a la
// misma función heredaría el mismo agujero, en seis sitios más.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE SE DOBLA Y LO QUE NO (la técnica es la de `scrum590-el-movil-es-el-canal`)
//
//  · LA BASE: doble inyectado en `require.cache` ANTES de cargar nada de `dist/`.
//  · META: `WHATSAPP_DRY_RUN=1` + `globalThis.__waDryRunOutbox`. En dry-run los senders pasan
//    TODOS sus guards y sólo se saltan la llamada HTTP, así que «no está en el buzón» significa
//    «un guard lo cortó», que es justo lo que aquí se mide.
//  · NO se dobla ningún sender: son los ocho de `dist/integrations/whatsapp.js`, tal cual.
//
// ⛔ No sale un byte hacia Meta ni se toca ninguna base. Los números son del rango imposible.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs';
import { casosEscritos } from './_casos-escritos.mjs';

// ANTES de cargar `dist/`: `config` se congela al importarse.
process.env.WHATSAPP_DRY_RUN = '1';

const requiere = createRequire(import.meta.url);
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ts = requiere('typescript');

// El merchant NO es el 1: el 1 es el demo y `demoSendBlocked` lo corta por su cuenta (V0-2).
// Con el demo, ese bloqueo se confundiría con el que este fichero mide.
const MERCHANT = 4242;
const DE_BAJA = telefonoDePrueba(12620001); // pidió la baja
const DE_ALTA = telefonoDePrueba(12620002); // no la pidió

// ── EL DOBLE DE LA BASE ────────────────────────────────────────────────────────────────────
// UNO solo para todo el fichero, con el escenario mutable: `whatsapp.js` y `whatsappLog.service.js`
// importan los dos `prisma`, y recargar uno sin el otro dejaría el rastro escribiéndose en el
// doble de un escenario anterior.
const escenario = {
  /** Lo que devuelve la consulta de la baja: los clientes del merchant con `waOptOut = true`. */
  dadosDeBaja: [],
  /** Si es `true`, la consulta de la baja REVIENTA (base caída, tiempo agotado…). */
  laConsultaRevienta: false,
  consultasDeBaja: 0,
  /** Filas que el sender intentó dejar en WA-0b (`whatsAppMessage.create`). */
  rastro: [],
};

function dobleDeLaBase() {
  const porDefecto = (metodo) => {
    if (metodo === 'findMany') return [];
    if (metodo === 'count') return 0;
    if (metodo === 'findUnique' || metodo === 'findFirst') return null;
    return {};
  };
  const propias = {
    'customer.findMany': () => {
      escenario.consultasDeBaja += 1;
      if (escenario.laConsultaRevienta) throw new Error('P1001: la base no responde (doble de SCRUM-1262)');
      return escenario.dadosDeBaja;
    },
    'whatsAppMessage.create': (args) => { escenario.rastro.push(args.data); return {}; },
  };
  const modelo = (nombre) => new Proxy({}, {
    get: (_t, metodo) => async (args) => {
      const propia = propias[`${nombre}.${String(metodo)}`];
      return propia ? propia(args) : porDefecto(String(metodo));
    },
  });
  const cache = new Map();
  return new Proxy({}, {
    get: (_t, prop) => {
      const nombre = String(prop);
      if (nombre.startsWith('$')) return async () => undefined;
      if (!cache.has(nombre)) cache.set(nombre, modelo(nombre));
      return cache.get(nombre);
    },
  });
}

const rutaPrisma = requiere.resolve('../dist/core/db/prisma.js');
requiere.cache[rutaPrisma] = { id: rutaPrisma, filename: rutaPrisma, loaded: true, exports: { prisma: dobleDeLaBase() } };
const wa = requiere('../dist/integrations/whatsapp.js');
const { buildMerchantAlert } = requiere('../dist/integrations/whatsappTemplates.js');
const { SEND_FAILURE_MESSAGES } = requiere('../dist/lib/sendOutcome.js');

// ── LAS OCHO VÍAS ──────────────────────────────────────────────────────────────────────────
// Cada una con los argumentos MÍNIMOS para que llegue al final. `exencion` dice si su firma
// admite declararse respuesta a un entrante: `Template`, `WindowFirst` y `Document` no pueden
// (las dos primeras las inicia el negocio por definición; la tercera no tiene llamadores).
const plantilla = () => buildMerchantAlert({ customerName: 'Cliente', action: 'te ha escrito', detail: 'ref' });
const VIAS = [
  { nombre: 'sendWhatsAppTemplate', teniaCorte: true, exencion: false, args: () => plantilla() },
  { nombre: 'sendWhatsAppWindowFirst', teniaCorte: true, exencion: false,
    args: () => ({ windowText: 'hola', template: plantilla() }) },
  { nombre: 'sendWhatsAppText', teniaCorte: false, exencion: true, args: () => ({ text: 'hola' }) },
  { nombre: 'sendWhatsAppButtons', teniaCorte: false, exencion: true,
    args: () => ({ bodyText: 'hola', buttons: [{ id: 'a', title: 'A' }] }) },
  { nombre: 'sendWhatsAppList', teniaCorte: false, exencion: true,
    args: () => ({ bodyText: 'hola', buttonText: 'Ver', rows: [{ id: 'a', title: 'A' }] }) },
  { nombre: 'sendWhatsAppCtaUrl', teniaCorte: false, exencion: true,
    args: () => ({ bodyText: 'hola', buttonText: 'Abrir', url: 'https://example.invalid/x' }) },
  { nombre: 'sendWhatsAppDocument', teniaCorte: false, exencion: false,
    args: () => ({ link: 'https://example.invalid/x.pdf' }) },
  { nombre: 'sendWhatsAppLocationRequest', teniaCorte: false, exencion: true, args: () => ({ bodyText: 'hola' }) },
];
const SIN_CORTE_ANTES = VIAS.filter((v) => !v.teniaCorte);

/** Ejecuta un sender de verdad contra el escenario dado y devuelve lo que salió. */
async function enviar(via, { to, extra = {}, dadosDeBaja = [], laConsultaRevienta = false }) {
  Object.assign(escenario, { dadosDeBaja, laConsultaRevienta, consultasDeBaja: 0, rastro: [] });
  const buzon = [];
  globalThis.__waDryRunOutbox = buzon;
  try {
    const resultado = await wa[via.nombre]({ to, merchantId: MERCHANT, ...via.args(), ...extra });
    return { resultado, buzon, rastro: [...escenario.rastro], consultas: escenario.consultasDeBaja };
  } finally {
    delete globalThis.__waDryRunOutbox;
  }
}

const LA_BAJA = [{ phone: DE_BAJA, mobile: null }];

// ───────────────────────────────────────────────────────────────────────────────────────────
// PREMISA Y POBLACIÓN
// ───────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-1262 · POBLACIÓN: los senders de `whatsapp.ts` son exactamente los 8 de la tabla', () => {
  // Si mañana nace un noveno sender, este caso cae y obliga a meterlo en la tabla —y con él,
  // en los casos de abajo—. Sin esto, «las 8 vías cortan» seguiría verde con nueve.
  const exportados = Object.keys(wa).filter((k) => /^sendWhatsApp/.test(k)).sort();
  assert.deepEqual(exportados, VIAS.map((v) => v.nombre).sort(),
    '🔴 la lista de senders ha cambiado: la tabla VIAS de este test ya no es la población');
  assert.equal(VIAS.length, 8);
  assert.equal(SIN_CORTE_ANTES.length, 6, 'las vías que NO miraban la baja en el ticket eran 6');
  assert.notEqual(DE_BAJA, DE_ALTA, 'si los dos números fueran el mismo, todo el fichero pasaría en vacío');
});

// ───────────────────────────────────────────────────────────────────────────────────────────
// ① COBERTURA · un cliente dado de baja NO recibe, por ninguna vía
// ───────────────────────────────────────────────────────────────────────────────────────────
const cortaLaBaja = casosEscritos(VIAS, (via) => `SCRUM-1262 🔴 ① ${via.nombre}: a un número DADO DE BAJA no se le envía`, async (via) => {
  const { resultado, buzon, rastro } = await enviar(via, { to: DE_BAJA, dadosDeBaja: LA_BAJA });
  assert.equal(buzon.length, 0,
    `🔴 un cliente que pidió la baja RECIBE por ${via.nombre}: ${JSON.stringify(buzon)}`);
  assert.equal(resultado.ok, false, `el sender dice que envió: ${JSON.stringify(resultado)}`);
  assert.equal(resultado.reason, 'wa_opt_out', `el motivo debería ser la baja: ${JSON.stringify(resultado)}`);
  // J5: nunca fallo silencioso. El corte deja su fila en WA-0b con el motivo.
  assert.ok(rastro.some((f) => f.status === 'failed' && f.error === 'wa_opt_out'),
    `el corte no dejó rastro en WA-0b: ${JSON.stringify(rastro)}`);
});
test('SCRUM-1262 🔴 ① sendWhatsAppTemplate: a un número DADO DE BAJA no se le envía', cortaLaBaja(0));
test('SCRUM-1262 🔴 ① sendWhatsAppWindowFirst: a un número DADO DE BAJA no se le envía', cortaLaBaja(1));
test('SCRUM-1262 🔴 ① sendWhatsAppText: a un número DADO DE BAJA no se le envía', cortaLaBaja(2));
test('SCRUM-1262 🔴 ① sendWhatsAppButtons: a un número DADO DE BAJA no se le envía', cortaLaBaja(3));
test('SCRUM-1262 🔴 ① sendWhatsAppList: a un número DADO DE BAJA no se le envía', cortaLaBaja(4));
test('SCRUM-1262 🔴 ① sendWhatsAppCtaUrl: a un número DADO DE BAJA no se le envía', cortaLaBaja(5));
test('SCRUM-1262 🔴 ① sendWhatsAppDocument: a un número DADO DE BAJA no se le envía', cortaLaBaja(6));
test('SCRUM-1262 🔴 ① sendWhatsAppLocationRequest: a un número DADO DE BAJA no se le envía', cortaLaBaja(7));
cortaLaBaja.todos();

// ───────────────────────────────────────────────────────────────────────────────────────────
// ③ CONTROL POSITIVO · quien NO se dio de baja sigue recibiendo
// ───────────────────────────────────────────────────────────────────────────────────────────
// Sin esto, «no envía nunca» pasaría por arreglo. Y lleva el MISMO token que el negativo: en la
// base HAY un cliente de baja —el otro—, así que el corte se ejercita y decide que éste pasa.
const sigueRecibiendo = casosEscritos(VIAS, (via) => `SCRUM-1262 ✅ ③ ${via.nombre}: quien NO se dio de baja SIGUE recibiendo`, async (via) => {
  const { resultado, buzon, consultas } = await enviar(via, { to: DE_ALTA, dadosDeBaja: LA_BAJA });
  assert.equal(resultado.ok, true, `no se envió a quien no pidió la baja: ${JSON.stringify(resultado)}`);
  assert.equal(buzon.length, 1, `debía salir UN mensaje, salieron ${buzon.length}`);
  assert.equal(buzon[0].to, DE_ALTA);
  assert.ok(consultas >= 1, 'CIEGO: se envió sin haber preguntado por la baja');
});
test('SCRUM-1262 ✅ ③ sendWhatsAppTemplate: quien NO se dio de baja SIGUE recibiendo', sigueRecibiendo(0));
test('SCRUM-1262 ✅ ③ sendWhatsAppWindowFirst: quien NO se dio de baja SIGUE recibiendo', sigueRecibiendo(1));
test('SCRUM-1262 ✅ ③ sendWhatsAppText: quien NO se dio de baja SIGUE recibiendo', sigueRecibiendo(2));
test('SCRUM-1262 ✅ ③ sendWhatsAppButtons: quien NO se dio de baja SIGUE recibiendo', sigueRecibiendo(3));
test('SCRUM-1262 ✅ ③ sendWhatsAppList: quien NO se dio de baja SIGUE recibiendo', sigueRecibiendo(4));
test('SCRUM-1262 ✅ ③ sendWhatsAppCtaUrl: quien NO se dio de baja SIGUE recibiendo', sigueRecibiendo(5));
test('SCRUM-1262 ✅ ③ sendWhatsAppDocument: quien NO se dio de baja SIGUE recibiendo', sigueRecibiendo(6));
test('SCRUM-1262 ✅ ③ sendWhatsAppLocationRequest: quien NO se dio de baja SIGUE recibiendo', sigueRecibiendo(7));
sigueRecibiendo.todos();

// ───────────────────────────────────────────────────────────────────────────────────────────
// ④ FAIL-CLOSED · con la consulta de la baja reventando, NO se envía
// ───────────────────────────────────────────────────────────────────────────────────────────
const cierraSiRevienta = casosEscritos(VIAS, (via) => `SCRUM-1262 🔴 ④ ${via.nombre}: si la consulta de la baja REVIENTA, no se envía`, async (via) => {
  // El destino es quien NO se dio de baja: así el único motivo posible para no enviar es que
  // no se ha podido comprobar. Con el de baja, este caso pasaría por el motivo equivocado.
  const { resultado, buzon, consultas } = await enviar(via, { to: DE_ALTA, laConsultaRevienta: true });
  assert.ok(consultas >= 1, 'CIEGO: la consulta no llegó a hacerse, así que no ha reventado nada');
  assert.equal(buzon.length, 0,
    `🔴 el corte falla ABIERTO en ${via.nombre}: no pudo comprobar la baja y envió igual`);
  assert.equal(resultado.ok, false, `el sender dice que envió: ${JSON.stringify(resultado)}`);
  // No se sabe si se dio de baja: decir `wa_opt_out` sería afirmarle al profesional algo falso
  // («Este cliente se dio de baja…»). El motivo es otro, y NO tiene texto propio: los
  // llamadores lo llevan al genérico ya firmado de «no se pudo enviar».
  assert.equal(resultado.reason, wa.MOTIVO_BAJA_NO_COMPROBABLE);
  assert.notEqual(resultado.reason, 'wa_opt_out');
  assert.ok(!(resultado.reason in SEND_FAILURE_MESSAGES),
    'el motivo nuevo no puede traer un texto nuevo al profesional (regla 39)');
});
test('SCRUM-1262 🔴 ④ sendWhatsAppTemplate: si la consulta de la baja REVIENTA, no se envía', cierraSiRevienta(0));
test('SCRUM-1262 🔴 ④ sendWhatsAppWindowFirst: si la consulta de la baja REVIENTA, no se envía', cierraSiRevienta(1));
test('SCRUM-1262 🔴 ④ sendWhatsAppText: si la consulta de la baja REVIENTA, no se envía', cierraSiRevienta(2));
test('SCRUM-1262 🔴 ④ sendWhatsAppButtons: si la consulta de la baja REVIENTA, no se envía', cierraSiRevienta(3));
test('SCRUM-1262 🔴 ④ sendWhatsAppList: si la consulta de la baja REVIENTA, no se envía', cierraSiRevienta(4));
test('SCRUM-1262 🔴 ④ sendWhatsAppCtaUrl: si la consulta de la baja REVIENTA, no se envía', cierraSiRevienta(5));
test('SCRUM-1262 🔴 ④ sendWhatsAppDocument: si la consulta de la baja REVIENTA, no se envía', cierraSiRevienta(6));
test('SCRUM-1262 🔴 ④ sendWhatsAppLocationRequest: si la consulta de la baja REVIENTA, no se envía', cierraSiRevienta(7));
cierraSiRevienta.todos();

// ───────────────────────────────────────────────────────────────────────────────────────────
// LA EXENCIÓN · contestar a quien acaba de escribir no es escribirle
// ───────────────────────────────────────────────────────────────────────────────────────────
const FILAS_DE_RESPUESTA_DECLARADA = VIAS.filter((v) => v.exencion);
const respuestaDeclarada = casosEscritos(FILAS_DE_RESPUESTA_DECLARADA, (via) => `SCRUM-1262 ✅ ${via.nombre}: la RESPUESTA DECLARADA a un entrante sale aunque esté de baja`, async (via) => {
  const extra = { exentoDeLaBaja: 'respuesta-a-entrante' };
  const { resultado, buzon } = await enviar(via, { to: DE_BAJA, dadosDeBaja: LA_BAJA, extra });
  assert.equal(resultado.ok, true, `el bot dejó sin contestar a quien le escribió: ${JSON.stringify(resultado)}`);
  assert.equal(buzon.length, 1);
  // Y no depende de la base: quien escribe recibe respuesta aunque la consulta esté caída.
  const caida = await enviar(via, { to: DE_BAJA, laConsultaRevienta: true, extra });
  assert.equal(caida.resultado.ok, true);
  assert.equal(caida.consultas, 0, 'una respuesta declarada no necesita preguntar por la baja');
});
test('SCRUM-1262 ✅ sendWhatsAppText: la RESPUESTA DECLARADA a un entrante sale aunque esté de baja', respuestaDeclarada(0));
test('SCRUM-1262 ✅ sendWhatsAppButtons: la RESPUESTA DECLARADA a un entrante sale aunque esté de baja', respuestaDeclarada(1));
test('SCRUM-1262 ✅ sendWhatsAppList: la RESPUESTA DECLARADA a un entrante sale aunque esté de baja', respuestaDeclarada(2));
test('SCRUM-1262 ✅ sendWhatsAppCtaUrl: la RESPUESTA DECLARADA a un entrante sale aunque esté de baja', respuestaDeclarada(3));
test('SCRUM-1262 ✅ sendWhatsAppLocationRequest: la RESPUESTA DECLARADA a un entrante sale aunque esté de baja', respuestaDeclarada(4));
respuestaDeclarada.todos();

test('SCRUM-1262 🔴 la exención NO se hereda del freno del demo: `exentoDelDemo` no levanta la baja', async () => {
  // Son dos políticas distintas —una protege una cuenta pública, la otra un consentimiento— y
  // quien declare una no puede estar declarando la otra sin escribirlo.
  const texto = VIAS.find((v) => v.nombre === 'sendWhatsAppText');
  const { resultado, buzon } = await enviar(texto, {
    to: DE_BAJA, dadosDeBaja: LA_BAJA, extra: { exentoDelDemo: 'respuesta-a-entrante' },
  });
  assert.equal(buzon.length, 0, '🔴 la exención del demo se está leyendo como exención de la baja');
  assert.equal(resultado.reason, 'wa_opt_out');
});

test('SCRUM-1262 🔴 las vías que inicia el negocio NO pueden declararse respuesta', async () => {
  // Y no pueden ni intentarlo: el parámetro no está en su firma, así que pasarlo no hace nada.
  for (const via of VIAS.filter((v) => !v.exencion)) {
    const { buzon } = await enviar(via, {
      to: DE_BAJA, dadosDeBaja: LA_BAJA, extra: { exentoDeLaBaja: 'respuesta-a-entrante' },
    });
    assert.equal(buzon.length, 0, `🔴 ${via.nombre} se acoge a la exención de respuesta y envía a un dado de baja`);
  }
});

test('SCRUM-1262 ✅ la CONFIRMACIÓN de la propia baja sigue saliendo (va sin merchant)', async () => {
  // `handleOptOutRequest` marca la baja y DESPUÉS confirma («Hecho ✅…») con
  // `sinMerchant: 'multi-merchant'`. La baja es por merchant: sin merchant no hay contra qué
  // preguntarla. Un corte ciego dejaría al cliente dándose de baja sin recibir la confirmación.
  const texto = VIAS.find((v) => v.nombre === 'sendWhatsAppText');
  const { resultado, buzon, consultas } = await enviar(texto, {
    to: DE_BAJA, dadosDeBaja: LA_BAJA, extra: { merchantId: undefined, sinMerchant: 'multi-merchant' },
  });
  assert.equal(resultado.ok, true, `la confirmación de la baja no salió: ${JSON.stringify(resultado)}`);
  assert.equal(buzon.length, 1);
  assert.equal(consultas, 0);
});

// ───────────────────────────────────────────────────────────────────────────────────────────
// QUIÉN DECLARA LA EXENCIÓN — por AST, sobre el árbol real
// ───────────────────────────────────────────────────────────────────────────────────────────
const BOT = [
  'src/modules/whatsappBot/domain/botFlow.service.ts',
  'src/modules/whatsappBot/app/routes/whatsappIncoming.routes.ts',
];

/** Todas las declaraciones `exentoDeLaBaja: …` de un fichero, con el destino de su llamada. */
function declaracionesEn(rel) {
  const ruta = path.join(RAIZ, rel);
  const src = ts.createSourceFile(ruta, fs.readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true);
  const halladas = [];
  const visitar = (n) => {
    if (ts.isObjectLiteralExpression(n)) {
      const exento = n.properties.find((p) => p.name?.getText?.(src) === 'exentoDeLaBaja');
      if (exento) {
        const to = n.properties.find((p) => p.name?.getText?.(src) === 'to');
        halladas.push({
          donde: `${rel}:${src.getLineAndCharacterOfPosition(n.getStart(src)).line + 1}`,
          destino: to && ts.isPropertyAssignment(to) ? to.initializer.getText(src) : '(sin to)',
          // DECLARAR es escribir el motivo (un literal). Pasar el valor que te dieron es REENVIAR.
          declara: ts.isPropertyAssignment(exento) && ts.isStringLiteral(exento.initializer),
        });
      }
    }
    ts.forEachChild(n, visitar);
  };
  visitar(src);
  return halladas;
}

function ficherosDeSrc(dir = path.join(RAIZ, 'src'), acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, e.name);
    if (e.isDirectory()) ficherosDeSrc(ruta, acc);
    else if (e.name.endsWith('.ts')) acc.push(path.relative(RAIZ, ruta).split(path.sep).join('/'));
  }
  return acc;
}

test('SCRUM-1262 · la exención SÓLO la declara quien procesa el entrante, y hacia quien escribió', () => {
  const todos = ficherosDeSrc();
  assert.ok(todos.length > 100, `CIEGO: sólo ${todos.length} ficheros en src/; el barrido no está mirando`);
  const halladas = todos.flatMap(declaracionesEn);
  const quita = ({ donde, destino }) => ({ donde, destino });
  const declaraciones = halladas.filter((h) => h.declara).map(quita);

  // Lo que NO es un literal es la propia puerta pasándole al corte lo que su llamador declaró.
  // Eso sólo puede ocurrir en `whatsapp.ts`: en cualquier otro sitio sería una exención que
  // viaja por una variable, y este barrido dejaría de ver quién la decide.
  const reenvios = halladas.filter((h) => !h.declara).map(quita);
  assert.equal(reenvios.length, 5, `los senders que admiten la exención son 5, y la reenvían ${reenvios.length}`);
  assert.deepEqual(reenvios.filter((r) => !r.donde.startsWith('src/integrations/whatsapp.ts:')), [],
    '🔴 la exención de la baja viaja por una variable fuera de `whatsapp.ts`: ya no se ve quién la declara');

  // SUELO: si no encontrara ninguna, lo de abajo pasaría por vacuidad.
  assert.ok(declaraciones.length >= 30,
    `CIEGO: sólo ${declaraciones.length} declaraciones de la exención; el bot contesta en más de 30 sitios`);

  const fueraDelBot = declaraciones.filter((d) => !BOT.some((b) => d.donde.startsWith(`${b}:`)));
  assert.deepEqual(fueraDelBot, [],
    '🔴 hay una exención de la baja FUERA del bot. Sólo quien procesa el entrante sabe que está contestando');

  const aUnTercero = declaraciones.filter((d) => !/^(from|phone)$/.test(d.destino));
  assert.deepEqual(aUnTercero, [],
    '🔴 hay una exención de la baja cuyo destino NO es quien escribió. Mandarle algo a un tercero no es responder');
});

test('SCRUM-1262 · los 8 senders pasan por el corte, y la decisión vive en UN sitio', () => {
  const ruta = path.join(RAIZ, 'src/integrations/whatsapp.ts');
  const src = ts.createSourceFile(ruta, fs.readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true);
  const llamaA = (nodo, nombre) => {
    let n = 0;
    const visitar = (x) => {
      if (ts.isCallExpression(x) && x.expression.getText(src) === nombre) n += 1;
      ts.forEachChild(x, visitar);
    };
    visitar(nodo);
    return n;
  };
  const senders = src.statements.filter((s) => ts.isFunctionDeclaration(s) && /^sendWhatsApp/.test(s.name?.text || ''));
  assert.equal(senders.length, 8, `CIEGO: el AST ve ${senders.length} senders y son 8`);
  const sinCorte = senders.filter((s) => llamaA(s, 'corteDeLaBaja') === 0).map((s) => s.name.text);
  assert.deepEqual(sinCorte, [], '🔴 hay un sender que no pasa por el corte de la baja');
  // La consulta la hace UNA función y la llama UNA: nadie más decide qué pasa cuando revienta.
  assert.equal(llamaA(src, 'isWaOptedOut'), 1,
    '🔴 `isWaOptedOut` se llama desde más de un sitio: el fail-closed ya no se decide en un único punto');
});
