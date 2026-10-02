// tests/scrum1325-una-tilde-no-rompe-lo-que-entiende.test.mjs — SCRUM-1325
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// POR EFECTO: lo que el bot ENTIENDE no depende de que el cliente ponga la tilde.
//
// Medido el 1-oct-2026 sobre e9e71cab, con el bot de verdad:
//   · el bot pregunta «¿Lo envío?», el cliente contesta «sí» —con su tilde— y la solicitud NO se
//     crea: le vuelve el recordatorio de los botones. «si», sin tilde, sí la creaba.
//   · «edítalo» y «cámbialo», la grafía correcta, no se entendían; «editalo» y «cambialo», sí.
//   · y al revés: «síntoma de humedad» ENVIABA la solicitud, porque el límite de palabra ve una
//     frontera falsa entre la «í» y la «n».
//   · donde alguien había enumerado la tilde a mano (`men[uú]`, `d[ií]as`) se entendía la tilde
//     de un solo carácter y no la combinatoria (letra + acento, dos caracteres).
//
// La causa común NO es `\b`: es comparar una expresión con letras contra texto de persona sin
// normalizar. Ni la bandera `u` ni la `v` lo arreglan (medido). El arreglo es UN idioma, el de
// SCRUM-1322: comparar sin tildes (`src/core/texto/sinTildes.ts`).
//
// Que no nazca otra la impide `tests/scrum1325b-expresiones-sobre-texto-de-persona.test.mjs`.
//
// 🔴 Ni BD, ni red, ni staging: el bot real (de `dist/`) con dobles en `require.cache`, el mismo
// harness que `tests/scrum1322-el-bot-entiende-lo-que-pide.test.mjs`.
// ⛔ Ningún texto del bot se fija aquí: se mira QUÉ PASA (sesión, solicitud creada, qué se manda).
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));
const R = (rel) => require_.resolve(`./dist/${rel}`);
const R_BOT = R('modules/whatsappBot/domain/botFlow.service.js');
const poner = (r, e) => { require_.cache[r] = { id: r, filename: r, loaded: true, exports: e }; };

// Ni el cliente ni el profesional llevan un móvil que pueda ser de alguien (SCRUM-262).
const CLIENTE = telefonoDePrueba(1);
const PROFESIONAL = telefonoDePrueba(2);

/**
 * Las dos formas en que llega una letra con tilde: UN carácter (lo normal en un móvil) o letra +
 * acento combinatorio. Se construyen aquí, no se teclean: escrita a mano, la combinatoria no se
 * distingue de la otra ni en el editor ni en un diff.
 */
const compuesta = (s) => s.normalize('NFC');
const combinatoria = (s) => s.normalize('NFD');
const lasDosFormas = (s) => {
  assert.notEqual(compuesta(s), combinatoria(s), `CIEGO: «${s}» no lleva tilde; sus dos formas son la misma cadena`);
  return [compuesta(s), combinatoria(s)];
};
/** Para el mensaje de un fallo: cuál de las dos formas era. */
const nombrar = (s) => (s === s.normalize('NFC') ? `«${s}»` : `«${s.normalize('NFC')}» (tilde combinatoria)`);

/**
 * Un cliente conocido, en el estado `estado` de la sesión del bot, escribe `texto`.
 * Devuelve lo que pasó: cómo queda la sesión, qué solicitudes se crearon y qué se le mandó.
 */
async function escribe(estado, texto, datos = {}) {
  let sesion = { id: 1, phone: CLIENTE, merchantId: 42, state: estado, data: { ...datos }, expiresAt: new Date(Date.now() + 3600e3) };
  const solicitudes = [];
  const mandado = [];      // por qué vía se le contesta: 'texto' | 'botones' | 'lista' | 'ubicacion'
  delete require_.cache[R_BOT];
  poner(R('core/db/prisma.js'), { prisma: {
    botSession: {
      findFirst: async () => sesion,
      update: async (a) => { sesion = { ...sesion, ...a.data }; return sesion; },
      create: async (a) => { sesion = { id: 2, ...a.data }; return sesion; },
    },
    customer: { findMany: async () => [{ id: 3, merchantId: 42, name: 'Ana' }] },
    merchant: { findUnique: async () => ({ id: 42, name: 'Fontanería Ruiz', legalName: null, whatsappPhone: PROFESIONAL }) },
    quoteRequest: { create: async (a) => { solicitudes.push(a.data); return { id: 77, ...a.data }; } },
  } });
  const via = (cual) => async () => { mandado.push(cual); return { ok: true }; };
  poner(R('integrations/whatsapp.js'), {
    sendWhatsAppText: via('texto'), sendWhatsAppButtons: via('botones'), sendWhatsAppList: via('lista'),
    sendWhatsAppLocationRequest: via('ubicacion'), sendWhatsAppCtaUrl: via('enlace'),
    downloadWhatsAppMedia: async () => null,
  });
  poner(R('integrations/whatsappNotifications.js'), { notifyMerchantAlert: async () => {} });
  poner(R('modules/system/customerEvents.service.js'), { recordCustomerEvent: () => {} });
  poner(R('modules/quoteRequests/domain/attachment.service.js'), { saveQuoteRequestPhoto: async () => {} });
  poner(R('lib/invoicing.js'), { ensureChargeReceiptToken: async () => 't' });
  poner(R('modules/quotes/domain/quoteToken.service.js'), { ensureQuoteDecisionToken: async () => 't' });

  const { handleBotMessage } = require_(R_BOT);
  const gestionado = await handleBotMessage(CLIENTE, { text: texto });
  assert.equal(gestionado, true, `CIEGO: el bot no gestionó ${nombrar(texto)}; lo de abajo no mediría nada`);
  return { estado: sesion.state, datos: sesion.data || {}, solicitudes, mandado };
}

/** Cada entrada con su nombre: un fallo dice QUÉ frase, no «alguna de N». */
async function cadaUna(entradas, estado, datos, comprobar, porQue) {
  const mal = [];
  for (const e of entradas) {
    const r = await escribe(estado, e, datos);
    const fallo = comprobar(r);
    if (fallo) mal.push(`${nombrar(e)} → ${fallo}`);
  }
  assert.deepEqual(mal, [], `🔴 ${porQue} (población ${entradas.length})`);
}

const PENDIENTE = { description: 'se me ha roto un grifo', zone: 'Chamberí', lastAction: 'request' };

// ── 1 · «¿Lo envío?» — «sí» ────────────────────────────────────────────────────────────────────

const seEnvia = (r) => (r.solicitudes.length === 1 && r.estado === 'done'
  ? null : `solicitudes=${r.solicitudes.length}, sesión en «${r.estado}»`);
const noSeToca = (r) => (r.solicitudes.length === 0 && r.estado === 'confirming_request' && r.mandado.join() === 'botones'
  ? null : `solicitudes=${r.solicitudes.length}, sesión en «${r.estado}», mandado=${r.mandado.join('+')}`);

test('🔴 SCRUM-1325 · el bot pregunta «¿Lo envío?», el cliente contesta «sí» CON TILDE, y la solicitud se crea', async () => {
  await cadaUna([...lasDosFormas('sí'), ...lasDosFormas('Sí'), ...lasDosFormas('SÍ'), compuesta('sí.'), compuesta('sí, envíalo'),
    ...lasDosFormas('envía'), ...lasDosFormas('envíalo'), ...lasDosFormas('Envíala')],
  'confirming_request', PENDIENTE, seEnvia, 'una tilde hace que la confirmación no se entienda y la solicitud se pierde');
});

test('SCRUM-1325 · positivo: sin tilde se sigue entendiendo lo mismo', async () => {
  await cadaUna(['si', 'Si', 'SI', 'si.', 'si, envialo', 'envia', 'envialo', 'enviala', 'vale', 'ok', 'okay', 'correcto',
    'confirmo', 'adelante', 'dale', 'perfecto'],
  'confirming_request', PENDIENTE, seEnvia, 'una confirmación sin tilde deja de entenderse');
});

test('🔴 SCRUM-1325 · negativo: lo que no es una confirmación NO envía la solicitud, lleve tilde o no', async () => {
  // «síntoma»: con el límite de palabra sobre texto sin normalizar, la «í» hacía de frontera y
  // «sí» casaba DENTRO de la palabra. Las demás son el control de que no «casa todo».
  await cadaUna([...lasDosFormas('síntoma de humedad'), 'sintoma de humedad', 'silla rota', 'mañana te digo',
    ...lasDosFormas('envíos no, gracias a ti'), 'valencia', 'okupas'],
  'confirming_request', PENDIENTE, noSeToca, 'un mensaje que no confirma nada envía la solicitud o mueve la sesión');
});

// ── 2 · «✏️ Reescribir» — «edítalo» ────────────────────────────────────────────────────────────

const seReescribe = (r) => (r.solicitudes.length === 0 && r.estado === 'asking_description' && r.datos.description === undefined
  ? null : `solicitudes=${r.solicitudes.length}, sesión en «${r.estado}»`);

test('🔴 SCRUM-1325 · «edítalo» y «cámbialo», con su tilde, reinician la solicitud igual que sin ella', async () => {
  await cadaUna([...lasDosFormas('edítalo'), ...lasDosFormas('cámbialo'), ...lasDosFormas('Edítalo'), ...lasDosFormas('CÁMBIALO')],
    'confirming_request', PENDIENTE, seReescribe, 'la grafía correcta no se entiende y la incorrecta sí');
  await cadaUna(['editalo', 'cambialo', 'editar', 'cambiar', 'corrige', 'corregir', 'no'],
    'confirming_request', PENDIENTE, seReescribe, 'positivo: sin tilde deja de entenderse');
});

// ── 3 · «cancelar» en mitad de la captación ────────────────────────────────────────────────────

const seCancela = (r) => (r.estado === 'menu' && r.solicitudes.length === 0 && r.mandado.includes('lista')
  ? null : `sesión en «${r.estado}», mandado=${r.mandado.join('+')}`);

test('🔴 SCRUM-1325 · salir de la captación se entiende con la tilde en cualquiera de sus dos formas', async () => {
  for (const estado of ['asking_description', 'asking_zone', 'confirming_request']) {
    await cadaUna([...lasDosFormas('déjalo'), ...lasDosFormas('olvídalo'), ...lasDosFormas('atrás'), ...lasDosFormas('menú'),
      ...lasDosFormas('MENÚ'), ...lasDosFormas('Atrás.')],
    estado, PENDIENTE, seCancela, `en «${estado}», una tilde hace que «cancelar» no se entienda`);
    await cadaUna(['dejalo', 'olvidalo', 'atras', 'menu', 'cancelar', 'salir', 'nada', 'volver'],
      estado, PENDIENTE, seCancela, `positivo en «${estado}»: sin tilde deja de entenderse`);
  }
});

// ── 4 · un saludo no es una descripción, ni una zona ───────────────────────────────────────────

const sigueEn = (estado) => (r) => (r.estado === estado && r.solicitudes.length === 0 ? null : `sesión en «${r.estado}»`);
const pasaA = (estado) => (r) => (r.estado === estado ? null : `sesión en «${r.estado}»`);

test('🔴 SCRUM-1325 · «buenos días» y «sí» no se guardan como descripción ni como zona por llevar tilde', async () => {
  const saludos = [...lasDosFormas('buenos días'), ...lasDosFormas('Buenos días!'), ...lasDosFormas('sí')];
  await cadaUna(saludos, 'asking_description', {}, sigueEn('asking_description'), 'un saludo con tilde se guarda como descripción');
  await cadaUna(saludos, 'asking_zone', { description: 'un grifo' }, sigueEn('asking_zone'), 'un saludo con tilde se guarda como zona');
  // El emoji compuesto lleva un selector de variación (U+FE0F), que es una MARCA: quitar las tildes
  // se lo lleva también. Se construye por código para que conste que va dentro, y es el control de
  // que quitar marcas no rompe lo que ya se entendía con emojis.
  const manoLevantada = String.fromCodePoint(0x1F64B, 0x200D, 0x2642, 0xFE0F);
  assert.match(manoLevantada, /\p{M}/u, 'CIEGO: el emoji de control no lleva ninguna marca');
  await cadaUna(['buenos dias', 'Buenos dias!', 'si', 'hola', 'gracias', 'hola 👋', `hola ${manoLevantada}`], 'asking_description', {},
    sigueEn('asking_description'), 'positivo: un saludo sin tilde se guarda como descripción');
});

test('SCRUM-1325 · control: una descripción y una zona de verdad, con sus tildes, SÍ pasan', async () => {
  // Sin esto, «un saludo no pasa» podría ser «no pasa nada».
  await cadaUna(['se me ha roto un grifo', ...lasDosFormas('la caldera no enciende desde el miércoles'), ...lasDosFormas('sí, tengo una gotera')],
    'asking_description', {}, pasaA('asking_zone'), 'una descripción de verdad no se acepta');
  await cadaUna(['Chamberí', ...lasDosFormas('Alcalá de Henares'), 'a domicilio', 'cualquiera',
    // La respuesta «sin zona concreta». Hoy pasa también por el otro camino (tiene 2 letras o más
    // y no es un saludo): la expresión que la nombra es REDUNDANTE y no admite rojo por efecto.
    // Se deja medido que la respuesta se acepta; que su expresión esté bien escrita lo mira el guard.
    'no se', 'no lo se', ...lasDosFormas('no sé'), ...lasDosFormas('no lo sé'), ...lasDosFormas('No sé, por el centro')],
  'asking_zone', { description: 'un grifo' }, pasaA('confirming_request'), 'una zona de verdad no se acepta');
});

// ── 5 · «menú» fuera de flujo enseña el menú, no cuenta como texto perdido ─────────────────────

const ensenaElMenu = (r) => (r.estado === 'menu' && Number(r.datos.offMenuCount || 0) === 0 && r.mandado.join() === 'lista'
  ? null : `offMenuCount=${r.datos.offMenuCount}, mandado=${r.mandado.join('+')}`);
const cuentaComoFueraDeFlujo = (r) => (Number(r.datos.offMenuCount || 0) === 1 ? null : `offMenuCount=${r.datos.offMenuCount}`);

test('🔴 SCRUM-1325 · «menú» y «buenos días» piden el menú; no gastan el aviso de «texto fuera de flujo»', async () => {
  // El coste de no entenderlo no es cosmético: la SEGUNDA vez el bot pasa a humano y calla 24 h.
  await cadaUna([...lasDosFormas('menú'), ...lasDosFormas('Menú'), ...lasDosFormas('buenos días'), ...lasDosFormas('Buenos días 👋')],
    'menu', { offMenuCount: 0 }, ensenaElMenu, 'un saludo con tilde se cuenta como texto fuera de flujo');
  await cadaUna(['menu', 'Menu', 'buenos dias', 'hola', 'hola 👋', 'opciones', 'inicio'],
    'menu', { offMenuCount: 0 }, ensenaElMenu, 'positivo: un saludo sin tilde deja de pedir el menú');
  await cadaUna([...lasDosFormas('qué precio tiene'), 'menudo susto', 'holanda'],
    'menu', { offMenuCount: 0 }, cuentaComoFueraDeFlujo, 'negativo: un texto que no es un saludo pide el menú');
});

// ── 6 · fuera del bot: las semillas de mantenimiento, sobre el concepto que escribe el profesional ──

function sugerir(gremio, concepto) {
  const R_MANT = R('modules/maintenance/domain/maintenance.service.js');
  delete require_.cache[R_MANT];
  poner(R('core/db/prisma.js'), { prisma: {} });
  poner(R('integrations/whatsapp.js'), { sendWhatsAppButtons: async () => ({ ok: true }), sendWhatsAppText: async () => ({ ok: true }) });
  poner(R('modules/quotes/domain/sendQuote.service.js'), { sendQuoteWhatsAppToCustomer: async () => ({}) });
  poner(R('modules/system/customerEvents.service.js'), { recordCustomerEvent: () => {}, existeEventoDePlan: async () => false });
  poner(R('modules/quotes/domain/quoteNumber.service.js'), { allocateQuoteNumber: async () => 'P-1' });
  const { suggestMaintenance } = require_(R_MANT);
  return suggestMaintenance(gremio, [{ concept: concepto }]);
}

test('🔴 SCRUM-1325 · una línea de «bombín» o de «baño» propone el mantenimiento con la tilde en cualquier forma', () => {
  const mal = [];
  const propone = (gremio, concepto) => { if (!sugerir(gremio, concepto)) mal.push(`${gremio}: ${nombrar(concepto)} no propone nada`); };
  const noPropone = (gremio, concepto) => { if (sugerir(gremio, concepto)) mal.push(`${gremio}: ${nombrar(concepto)} propone un mantenimiento`); };

  for (const c of [...lasDosFormas('Cambio de bombín'), ...lasDosFormas('BOMBÍN de seguridad'), 'Cambio de bombin', 'cerradura nueva']) propone('cerrajero', c);
  for (const c of [...lasDosFormas('Reforma de baño'), ...lasDosFormas('BAÑO completo'), ...lasDosFormas('Alicatado de baños'),
    ...lasDosFormas('Climatización'), 'cocina', 'obra menor']) propone(c.normalize('NFC').startsWith('Clima') ? 'climatizacion' : 'reformista', c);
  // El concepto que se devuelve es el que escribió el profesional, con sus tildes: lo normalizado
  // sirve para COMPARAR, no para enseñarlo.
  assert.equal(sugerir('reformista', 'Reforma de baño')?.matchedConcept, 'Reforma de baño');

  // 🔴 Lo que cuesta el idioma, sujeto: sin tildes la eñe es una «n», y «bano» está dentro de
  // «urbano». Por eso el patrón va anclado al principio de la palabra.
  for (const c of ['Estudio urbano', 'Mobiliario urbano', 'Pastor de rebaño', ...lasDosFormas('Informe técnico')]) noPropone('reformista', c);
  for (const c of ['Estudio urbano', ...lasDosFormas('Revisión de la instalación')]) noPropone('cerrajero', c);
  assert.deepEqual(mal, [], '🔴 las semillas de mantenimiento no entienden lo mismo con tilde que sin ella');
});
