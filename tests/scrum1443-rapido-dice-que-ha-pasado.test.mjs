// SCRUM-1443 · PRESUPUESTO RÁPIDO: cuando algo falla, se dice QUÉ ha pasado, no «API 500: …».
//
// Firma: SCRUM-1443 comentario 18307 (6-oct-2026), que SUSTITUYE a la del comentario 18284 de ese
// mismo día (inconstruible: «La cotización está guardadO»). Los textos van en voz activa y con la
// palabra del país:
//   · falla al crear          → «No hemos podido crear tu {quote}. Vuelve a intentarlo.»
//   · guardado, envío incierto → «Hemos guardado tu {quote}, pero no sabemos si el WhatsApp ha
//                                 salido. Pregúntale a tu cliente antes de volver a enviarlo.»
//   · el gemelo de SCRUM-1198 («sin teléfono»): «…El presupuesto se ha guardado.» pasa a
//     «…Hemos guardado tu {quote}.»
//
// 🔴 LO QUE DECIDE ENTRE LOS DOS TEXTOS es si el presupuesto de ESTE intento quedó guardado. No vale
// `qqState.creado`: recuerda el del intento ANTERIOR (medido por S4, comentario 18296). El caso que
// lo demuestra está abajo: primer intento guardado, se cambia una línea, y el segundo falla al crear.
//
// Lo que NO mide: el servidor de verdad. La red es de mentira y contesta lo que cada caso le pide.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const respuesta = (status, cuerpo) => ({
  ok: status < 400, status, statusText: String(status),
  headers: { get: () => 'application/json' },
  json: async () => cuerpo, text: async () => JSON.stringify(cuerpo), blob: async () => ({}),
});
const vueltas = async (n = 60) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };

const NO_CREADO = (q) => `No hemos podido crear tu ${q}. Vuelve a intentarlo.`;
const GUARDADO_ENVIO_INCIERTO = (q) => `Hemos guardado tu ${q}, pero no sabemos si el WhatsApp ha salido. Pregúntale a tu cliente antes de volver a enviarlo.`;
// Comentario 18313 (6-oct-2026): el tercer texto, y el gemelo sin pronombre que apunte al documento.
const SIN_TELEFONO = (q) => `No hemos podido enviar el WhatsApp porque este cliente no tiene teléfono. Hemos guardado tu ${q}.`;
const TELEFONO_NO_VALIDO = (q) => `Hemos guardado tu ${q}, pero el teléfono de este cliente no es válido, así que el WhatsApp no ha salido. Corrige el teléfono y vuelve a enviarlo.`;

/** `contesta.{cliente,crear,enviar}`: función que devuelve la respuesta (o lanza, si no hay red). */
function montar(locale) {
  const hecho = { altasDeCliente: 0, presupuestos: [], envios: [], avisos: [] };
  const contesta = { cliente: null, crear: null, enviar: null };
  const fetch = async (url, opts = {}) => {
    const metodo = String(opts.method || 'GET').toUpperCase();
    const u = String(url);
    if (metodo === 'GET') return respuesta(200, []);
    if (/\/admin\/customers$/.test(u)) {
      hecho.altasDeCliente++;
      return contesta.cliente ? contesta.cliente() : respuesta(201, { id: 901, name: 'x', phone: '34000001443' });
    }
    if (/\/quote\/create$/.test(u)) {
      if (contesta.crear) return contesta.crear();
      hecho.presupuestos.push(JSON.parse(opts.body));
      return respuesta(201, { id: 500 + hecho.presupuestos.length, status: 'draft' });
    }
    const m = u.match(/\/admin\/quotes\/(\d+)\/send-whatsapp$/);
    if (m) {
      hecho.envios.push(Number(m[1]));
      return contesta.enviar ? contesta.enviar() : respuesta(200, { ok: true, sent: true });
    }
    return respuesta(200, {});
  };
  const { ctx } = cargarDashboard(RAIZ, { red: { fetch } });
  ctx.appMerchantId = 46;
  if (locale) ctx.appLocale = locale;
  let alAbrir = () => {};
  ctx.renderAppView = (vista, datos) => { alAbrir(vista, datos && datos.quoteId); };
  ctx.showToast = (texto) => { hecho.avisos.push(String(texto)); };
  const $ = (id) => ctx.document.getElementById(id);
  ctx.openQuickQuoteModal();
  assert.ok($('qq-send'), '🔴 CIEGO: el modal del presupuesto rápido no se pintó');
  const estado = () => vm.runInContext('qqState', ctx);
  const rellenar = (precio = 50) => {
    const e = estado();
    e.customerName = 'Cliente de pruebas';
    if (!e.customerId) e.customerId = null;
    if ($('qq-customer-phone')) $('qq-customer-phone').value = '34000001443';
    e.products = [{ concept: 'Punto de luz', qty: 1, price: precio }];
  };
  const pulsar = async () => { await ctx.submitQuickQuote(); await vueltas(); };
  const enElModal = () => { const a = $('qq-alert'); return a && a.style.display !== 'none' ? String(a.textContent) : ''; };
  return { hecho, contesta, rellenar, pulsar, enElModal, $, alAbrirVista: (fn) => { alAbrir = fn; } };
}

const ES = { quote: 'Presupuesto', quoteVerb: 'presupuesto', currency: 'EUR' };
const MX = { quote: 'Cotización', quoteVerb: 'cotización', currency: 'MXN' };
const falla500 = () => respuesta(500, { ok: false, error: 'internal_error' });
const sinRed = () => { throw new TypeError('Failed to fetch'); };

test('SCRUM-1443 · SUELO: sin fallos el presupuesto se crea, se envía y el modal no dice nada', async () => {
  const m = montar(ES);
  m.rellenar();
  await m.pulsar();
  assert.equal(m.hecho.presupuestos.length, 1, '🔴 CIEGO: el clic no llegó a crear el presupuesto');
  assert.deepEqual(m.hecho.envios, [501], '🔴 CIEGO: el clic no llegó a enviar');
  assert.equal(m.$('qq-send'), null, '🔴 CIEGO: con todo bien el modal no se cierra');
});

// Comentario 18331 (6-oct-2026): cuando sale, se nombra lo que salió. Antes: «✓ Presupuesto
// enviado por WhatsApp», que con «Cotización» decía «Cotización enviado».
const enviado = (locale) => async () => {
  const m = montar(locale);
  m.rellenar();
  await m.pulsar();
  assert.deepEqual(m.hecho.envios, [501], '🔴 SUELO: el envío no llegó a salir');
  assert.deepEqual(m.hecho.avisos, ['✓ WhatsApp enviado al cliente']);
};
test('SCRUM-1443 · 🔴 cuando el envío sale se lee «✓ WhatsApp enviado al cliente» · «presupuesto»', enviado(ES));
test('SCRUM-1443 · 🔴 cuando el envío sale se lee «✓ WhatsApp enviado al cliente» · «cotización»', enviado(MX));

test('SCRUM-1443 · envío intentado que NO sale (200, `sent: false`): se lee la frase del servidor, tal cual', async () => {
  const m = montar(ES);
  m.contesta.enviar = () => respuesta(200, { ok: true, sent: false, error: 'daily_cap', message: 'Has alcanzado el tope diario de mensajes de WhatsApp.' });
  m.rellenar();
  await m.pulsar();
  assert.deepEqual(m.hecho.avisos, ['Has alcanzado el tope diario de mensajes de WhatsApp.']);
});

// Comentario 18333 (6-oct-2026): el respaldo. Hoy la ruta no lo provoca (con `sent: false` manda
// siempre frase); aquí se fabrica el 200 sin `message` para ver qué se leería.
const NO_HA_SALIDO = (q) => `Hemos guardado tu ${q}, pero el WhatsApp no ha salido. Envíalo desde aquí.`;
const respaldoSinFrase = (locale, palabra) => async () => {
  const m = montar(locale);
  const vistas = [];
  m.contesta.enviar = () => respuesta(200, { ok: true, sent: false });
  m.rellenar();
  m.alAbrirVista((v, id) => vistas.push([v, id]));
  await m.pulsar();
  assert.deepEqual(m.hecho.avisos, [NO_HA_SALIDO(palabra)]);
  await new Promise((r) => setTimeout(r, 500));
  assert.deepEqual(vistas, [['quotes-detail', 501]], '🔴 «Envíalo desde aquí» y no se abre la ficha del presupuesto: el «aquí» no existe');
};
test('SCRUM-1443 · 🔴 200 sin `sent` y sin frase: «Hemos guardado tu presupuesto, pero el WhatsApp no ha salido. Envíalo desde aquí.», y se abre la ficha', respaldoSinFrase(ES, 'presupuesto'));
test('SCRUM-1443 · 🔴 200 sin `sent` y sin frase, con «cotización»: mismo texto con su palabra, y se abre la ficha', respaldoSinFrase(MX, 'cotización'));

// ── falla al CREAR: nada se ha guardado ───────────────────────────────────────────────────────
const noCreado = (cual, como) => async () => {
  const m = montar(ES);
  m.contesta[cual] = como;
  m.rellenar();
  await m.pulsar();
  assert.equal(m.enElModal(), NO_CREADO('presupuesto'));
  assert.equal(m.hecho.envios.length, 0, 'sin presupuesto no hay envío');
  assert.equal(m.$('qq-send').disabled, false, '🔴 el botón no se rehabilita: no se puede reintentar');
};
test('SCRUM-1443 · 🔴 el alta del PRESUPUESTO contesta 500: «No hemos podido crear tu presupuesto…»', noCreado('crear', falla500));
test('SCRUM-1443 · 🔴 el alta del PRESUPUESTO se queda sin red: «No hemos podido crear tu presupuesto…»', noCreado('crear', sinRed));
test('SCRUM-1443 · 🔴 el alta del CLIENTE contesta 500: tampoco hay presupuesto, mismo texto', noCreado('cliente', falla500));

test('SCRUM-1443 · si el servidor manda una frase al fallar el alta, se lee la del servidor', async () => {
  const m = montar(ES);
  m.contesta.crear = () => respuesta(409, { error: 'limite', message: 'Has llegado al límite de tu plan.' });
  m.rellenar();
  await m.pulsar();
  assert.equal(m.enElModal(), 'Has llegado al límite de tu plan.');
});

// ── guardado, y del envío no se sabe ──────────────────────────────────────────────────────────
const guardadoIncierto = (como) => async () => {
  const m = montar(ES);
  m.contesta.enviar = como;
  m.rellenar();
  await m.pulsar();
  assert.equal(m.hecho.presupuestos.length, 1, '🔴 SUELO: el presupuesto no llegó a guardarse; este caso mediría otra cosa');
  assert.equal(m.enElModal(), GUARDADO_ENVIO_INCIERTO('presupuesto'));
  assert.deepEqual(m.hecho.avisos, [], 'no se avisa fuera: el modal sigue abierto');
  assert.equal(m.$('qq-send').disabled, false);
};
test('SCRUM-1443 · 🔴 el ENVÍO contesta 500 con el presupuesto guardado: «Hemos guardado tu presupuesto, pero no sabemos…»', guardadoIncierto(falla500));
test('SCRUM-1443 · 🔴 el ENVÍO se queda sin red con el presupuesto guardado: «Hemos guardado tu presupuesto, pero no sabemos…»', guardadoIncierto(sinRed));

test('SCRUM-1443 · 🔴 EL CASO DE S4: guardado en el primer intento, se cambia una línea y el segundo falla AL CREAR → no dice «hemos guardado»', async () => {
  const m = montar(ES);
  m.contesta.enviar = falla500;
  m.rellenar(50);
  await m.pulsar();
  assert.equal(m.enElModal(), GUARDADO_ENVIO_INCIERTO('presupuesto'), '🔴 SUELO: el primer intento no dejó el presupuesto guardado');
  // Otra línea = otro presupuesto (SCRUM-1371 lo vuelve a crear), y esta vez el alta falla.
  m.rellenar(75);
  m.contesta.crear = falla500;
  await m.pulsar();
  assert.equal(m.hecho.presupuestos.length, 1, 'el segundo presupuesto no llegó a crearse');
  assert.equal(m.enElModal(), NO_CREADO('presupuesto'),
    '🔴 se dice «hemos guardado tu presupuesto» de un presupuesto que NO es el que se acaba de pedir');
});

test('SCRUM-1443 · CONTROL: reintentar con LO MISMO tras un envío fallido no vuelve a crear, y sigue diciendo «hemos guardado»', async () => {
  const m = montar(ES);
  m.contesta.enviar = falla500;
  m.rellenar();
  await m.pulsar();
  await m.pulsar();
  assert.equal(m.hecho.presupuestos.length, 1);
  assert.deepEqual(m.hecho.envios, [501, 501]);
  assert.equal(m.enElModal(), GUARDADO_ENVIO_INCIERTO('presupuesto'));
});

// ── nada de tripa a la vista ──────────────────────────────────────────────────────────────────
const sinTripa = (cual, como) => async () => {
  const m = montar(ES);
  m.contesta[cual] = como;
  m.rellenar();
  await m.pulsar();
  assert.ok(m.enElModal(), '🔴 SUELO: el fallo no pinta nada en el modal');
  assert.doesNotMatch(m.enElModal(), /API \d{3}|internal_error|Failed to fetch|fallo de red|cotización/,
    '🔴 se lee un código interno, el inglés del navegador o la palabra de otro país');
};
test('SCRUM-1443 · 🔴 ni «API 500» ni «Failed to fetch» ni «cotización» en España · alta que contesta 500', sinTripa('crear', falla500));
test('SCRUM-1443 · 🔴 ni «API 500» ni «Failed to fetch» ni «cotización» en España · alta sin red', sinTripa('crear', sinRed));
test('SCRUM-1443 · 🔴 ni «API 500» ni «Failed to fetch» ni «cotización» en España · envío que contesta 500', sinTripa('enviar', falla500));
test('SCRUM-1443 · 🔴 ni «API 500» ni «Failed to fetch» ni «cotización» en España · envío sin red', sinTripa('enviar', sinRed));

// ── la palabra del país ───────────────────────────────────────────────────────────────────────
test('SCRUM-1443 · 🔴 con la palabra «cotización» los tres textos la llevan, y ninguno dice «presupuesto»', async () => {
  const a = montar(MX);
  a.contesta.crear = falla500;
  a.rellenar();
  await a.pulsar();
  assert.equal(a.enElModal(), NO_CREADO('cotización'));

  const b = montar(MX);
  b.contesta.enviar = falla500;
  b.rellenar();
  await b.pulsar();
  assert.equal(b.enElModal(), GUARDADO_ENVIO_INCIERTO('cotización'));

  const c = montar(MX);
  c.contesta.enviar = () => respuesta(400, { ok: false, error: 'customer_missing_phone' });
  c.rellenar();
  await c.pulsar();
  assert.deepEqual(c.hecho.avisos, [SIN_TELEFONO('cotización')]);

  const d = montar(MX);
  d.contesta.enviar = () => respuesta(400, { ok: false, error: 'invalid_phone_format' });
  d.rellenar();
  await d.pulsar();
  assert.deepEqual(d.hecho.avisos, [TELEFONO_NO_VALIDO('cotización')]);
});

// ── teléfono no válido: SÍ se sabe que no ha salido ──────────────────────────────────────────
test('SCRUM-1443 · 🔴 teléfono NO VÁLIDO: el modal se cierra, se dice fuera que no ha salido y se abre el presupuesto', async () => {
  const m = montar(ES);
  const vistas = [];
  m.contesta.enviar = () => respuesta(400, { ok: false, error: 'invalid_phone_format' });
  m.rellenar();
  m.alAbrirVista((v, id) => vistas.push([v, id]));
  await m.pulsar();
  assert.equal(m.$('qq-send'), null, '🔴 el modal sigue abierto: reintentar sin corregir el teléfono da el mismo no');
  assert.deepEqual(m.hecho.avisos, [TELEFONO_NO_VALIDO('presupuesto')]);
  assert.doesNotMatch(m.hecho.avisos.join(' '), /invalid_phone_format|API \d{3}|no sabemos/);
  await new Promise((r) => setTimeout(r, 500));
  assert.deepEqual(vistas, [['quotes-detail', 501]], '🔴 no se abre el presupuesto que se ha guardado');
  assert.deepEqual(m.hecho.envios, [501], 'un solo intento de envío');
});

test('SCRUM-1443 · sin `appLocale` (arranque a medias) la palabra es «presupuesto»', async () => {
  const m = montar(null);
  m.contesta.crear = falla500;
  m.rellenar();
  await m.pulsar();
  assert.equal(m.enElModal(), NO_CREADO('presupuesto'));
});

// ── lo que NO entra, dicho con un test ────────────────────────────────────────────────────────
test('SCRUM-1443 · DEFECTO ABIERTO: con `not_found` el servidor dice que NO se intentó enviar; no se le pone «no sabemos si ha salido»', async () => {
  // La ruta lo contesta como precondición (igual que `invalid_id`): el envío no se intentó, así que
  // SÍ se sabe que no salió. El texto firmado dice «no sabemos», y aplicarlo aquí sería usar una
  // firma fuera de su caso. No tiene texto propio: se queda como estaba, y se lee el código.
  const m = montar(ES);
  m.contesta.enviar = () => respuesta(404, { ok: false, error: 'not_found' });
  m.rellenar();
  await m.pulsar();
  assert.ok(m.enElModal(), 'algo se pinta');
  assert.notEqual(m.enElModal(), GUARDADO_ENVIO_INCIERTO('presupuesto'));
  assert.notEqual(m.enElModal(), NO_CREADO('presupuesto'), '🔴 se dice «no hemos podido crear» de un presupuesto que SÍ está guardado');
});

test('SCRUM-1443 · CONTROL: el aviso de aprobación pendiente sigue saliendo tal cual', async () => {
  const m = montar(ES);
  m.contesta.enviar = () => respuesta(409, { ok: false, error: 'pending_approval' });
  m.rellenar();
  await m.pulsar();
  assert.equal(m.enElModal(), '📋 Enviado a un administrador para aprobación');
});
