// tests/scrum1302d-textos-de-la-pagina-de-firma.test.mjs — SCRUM-1302d
//
// CUATRO TEXTOS DE LAS PÁGINAS QUE VE EL CLIENTE FINAL, firmados en SCRUM-1302 comentario 19428:
//
//   A · la opción marcada por el profesional dice «Recomendada», no «⭐ Más popular» (nadie mide
//       popularidad: lo único que hay es que el profesional la marcó).
//   B · cuando la petición de firma no vuelve, la página no dice «Error de conexión.»: dice que no
//       se ha podido confirmar que la firma llegara. En el presupuesto y en el parte.
//   C · el texto de reserva al aceptar el presupuesto dice qué no se pudo hacer. Y el del parte dice
//       lo MISMO, palabra por palabra (SCRUM-1302 comentario 19454; rama 1302e).
//   D · el parte firmado NO promete la copia por WhatsApp: el envío es de mejor esfuerzo.
//
// 🔴 Y LA CONDICIÓN CON LA QUE SE FIRMÓ LA B: el texto aconseja reintentar, así que reintentar sobre
// una firma que SÍ llegó no puede firmar otra vez. Para el presupuesto lo sujeta
// `scrum1276-decision-no-reabre` (casos 4-5 y 7); para el parte, los dos últimos tests de aquí.
//
// Por la PUERTA: las dos páginas se piden a sus rutas de verdad (`dist`) con la base doblada, y se
// mira el HTML que sale. ⛔ Sin red ni base.
process.env.WHATSAPP_DRY_RUN = '1';
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } from './_envio-doblado.mjs';
import { bancoDelParte, TRAZO_1, TRAZO_2, CLIENTE_DEL_PARTE } from './_banco-firma-del-parte.mjs';

const LANDING = '../dist/modules/system/app/routes/quoteDecisionLanding.routes.js';
const TOKEN = 'd'.repeat(32);

const TEXTO_A = 'Recomendada';
const TEXTO_B = 'No hemos podido confirmar que tu firma haya llegado. Comprueba tu conexión y vuelve a intentarlo.';
const TEXTO_C = 'No se ha podido firmar. Inténtalo de nuevo.';
/** Lo que había, literal. Sirve de control: cada sonda de aquí tiene que VERLOS cuando están. */
const VIEJOS = ['Más popular', 'Error de conexión.', 'Error al procesar.', 'Recibirás tu copia por WhatsApp.'];

// ── Las sondas: funciones puras sobre el HTML, para poder darles el texto viejo y ver que lo cazan ──
const viejosEn = (html) => VIEJOS.filter((v) => html.includes(v));
/** Las insignias de las tarjetas de opción, con la opción a la que pertenecen. */
const insigniasDe = (html) => [...html.matchAll(/data-tier-id="([^"]*)"[^>]*>\s*<div class="tier-badge"[^>]*>([^<]*)<\/div>/g)]
  .map((m) => ({ opcion: m[1], texto: m[2] }));
/**
 * El texto que pinta el `catch` de la petición de firma (la respuesta no volvió): el literal que
 * recibe `#sig-error` dentro del ÚLTIMO bloque `catch` de la página. Anclado en `sig-error` y no en
 * el primer `textContent`: ese bloque reescribe antes el rótulo del botón, y una sonda que se quedara
 * con él daría rojo por otra cosa (pasó al escribir este test).
 */
const textoSinRespuesta = (html) => {
  const bloques = html.split(/\bcatch\s*(?:\(_\)\s*)?\{/);
  if (bloques.length < 2) return null;
  const m = bloques[bloques.length - 1].match(/getElementById\('sig-error'\)(?:;\s*e)?\.textContent\s*=\s*'([^']*)'/);
  return m ? m[1] : null;
};
/** El texto de reserva del presupuesto cuando el servidor contesta un error sin mensaje ni código. */
const textoDeReserva = (html) => {
  const m = html.match(/getElementById\('sig-error'\)\.textContent = (data\.[^;]+);/);
  return m ? new Function('data', `return ${m[1]};`)({}) : null;
};
/** El texto de reserva del PARTE: lo que recibe el aviso cuando el servidor contesta un error sin `message`. */
const textoDeReservaDelParte = (html) => {
  const m = html.match(/e\.textContent\s*=\s*d\.message\s*\|\|\s*'([^']*)'/);
  return m ? m[1] : null;
};
/** Cualquier promesa de copia en la página: la palabra, no una frase concreta (D es una RETIRADA). */
const promesasDeCopia = (html) => html.match(/[^<>'"`]*\b(?:copia|recibir[áa]s)\b[^<>'"`]*/gi) ?? [];

async function paginaDelPresupuesto(extra = {}) {
  const fila = {
    id: 1302, merchantId: MERCHANT, customerId: CLIENTE, status: 'sent', total: '121.00', currency: 'EUR',
    lines: [{ concept: 'Revisión', qty: 1, price: 100, tax: 0.21 }], quoteNumber: 1302, revision: 0,
    decisionToken: TOKEN, validUntil: new Date(Date.now() + 10 * 86400000), paymentTerms: 'FULL_UPFRONT',
    tiers: null, discountGlobalAmount: null, acceptedAt: null, rejectedAt: null, rejectionReason: null, jobId: null,
    createdAt: new Date(), updatedAt: new Date(),
    merchant: { id: MERCHANT, name: 'Fontanería 1302', legalName: null, taxId: null, country: 'ES', email: null,
      whatsappPhone: null, defaultCurrency: 'EUR', flags: null, timezone: 'Europe/Madrid', brandColor: null,
      brandAccentColor: null, logoUrl: null, address: null, clausulasPresupuesto: null },
    customer: { id: CLIENTE, name: 'Cliente 1302' },
    Invoice: [],
    ...extra,
  };
  const copia = () => JSON.parse(JSON.stringify(fila));
  inyectarBase({ 'quote.findUnique': ({ where }) => (where.decisionToken === TOKEN ? copia() : null),
    'quote.findFirst': ({ where }) => (where.decisionToken === TOKEN ? copia() : null) }, [LANDING]);
  const { quoteDecisionLandingRouter } = moduloDeDist(LANDING);
  const capa = quoteDecisionLandingRouter.stack.find((l) => l.route && [].concat(l.route.path).includes('/quote/:token') && l.route.methods.get);
  assert.ok(capa, 'CIEGO: no encuentro GET /quote/:token en la landing del presupuesto');
  const h = capa.route.stack[capa.route.stack.length - 1].handle;
  let cuerpo = '';
  const res = { status() { return res; }, setHeader() { return res; }, redirect() { return res; }, send(b) { cuerpo = String(b); return res; } };
  await h({ params: { token: TOKEN }, query: {}, headers: {}, ip: '127.0.0.1', socket: {} }, res);
  return cuerpo;
}

const opcion = (id, label, precio, recommended) => ({
  id, label, description: '', recommended, total: (precio * 1.21).toFixed(2),
  lines: [{ concept: `Trabajo ${label}`, qty: 1, price: precio, tax: 0.21 }],
});
const TRES_OPCIONES = [opcion('basica', 'Básica', 100, false), opcion('completa', 'Completa', 200, true), opcion('total', 'Total', 300, false)];

// ── Control de las sondas: con el texto viejo delante, cada una lo ve ─────────────────────────────
test('SCRUM-1302d · control · las sondas ven el texto viejo cuando está', () => {
  const vieja = `<div class="tier-card tier-recommended" data-tier-id="completa">
      <div class="tier-badge" id="con-un-atributo-mas">⭐ Más popular</div></div>
    <p class="meta" id="otro">Gracias, Ana. Recibirás tu copia por WhatsApp.</p>
    <script>
      try { document.getElementById('sig-error').textContent = data.message || data.error || 'Error al procesar.'; }
      catch { btn.disabled = false; btn.textContent = 'Firmar y aceptar presupuesto'; document.getElementById('sig-error').textContent = 'Error de conexión.'; }
    </script>`;
  assert.deepEqual(viejosEn(vieja), VIEJOS);
  assert.deepEqual(insigniasDe(vieja), [{ opcion: 'completa', texto: '⭐ Más popular' }]);
  assert.equal(textoSinRespuesta(vieja), 'Error de conexión.');
  assert.equal(textoDeReserva(vieja), 'Error al procesar.');
  assert.equal(promesasDeCopia(vieja).length, 1);
  // La reserva del parte, con lo que el parte pintaba hasta el 13-oct: parecido a C y no igual.
  const parteViejo = "if(!r.ok){ btn.disabled=false; const e=document.getElementById('sig-error'); e.textContent=d.message||'No se pudo firmar. Inténtalo de nuevo.'; e.style.display='block'; }";
  assert.equal(textoDeReservaDelParte(parteViejo), 'No se pudo firmar. Inténtalo de nuevo.');
  // Y la del parte, que escribe el `catch` de otra manera.
  assert.equal(textoSinRespuesta("}catch(_){ btn.disabled=false; btn.textContent='Firmar el parte de trabajo';\n const e=document.getElementById('sig-error'); e.textContent='Error de conexión.'; e.style.display='block'; }"), 'Error de conexión.');
});

// ── A ────────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-1302d · A · sólo la opción marcada por el profesional lleva insignia, y dice «Recomendada»', async () => {
  const html = await paginaDelPresupuesto({ tiers: TRES_OPCIONES });
  assert.equal((html.match(/class="tier-card/g) || []).length, 3, 'CIEGO: la página no ha pintado las tres opciones');
  assert.deepEqual(insigniasDe(html), [{ opcion: 'completa', texto: TEXTO_A }]);
  assert.deepEqual(viejosEn(html), []);
});

test('SCRUM-1302d · A · sin ninguna opción marcada, ninguna insignia', async () => {
  const html = await paginaDelPresupuesto({ tiers: TRES_OPCIONES.map((t) => ({ ...t, recommended: false })) });
  assert.equal((html.match(/class="tier-card/g) || []).length, 3, 'CIEGO: la página no ha pintado las tres opciones');
  assert.deepEqual(insigniasDe(html), []);
  assert.ok(!html.includes(`>${TEXTO_A}<`), '🔴 «Recomendada» se pinta sin que el profesional haya marcado ninguna opción');
});

// ── B y C · presupuesto ──────────────────────────────────────────────────────────────────────────
test('SCRUM-1302d · B y C · presupuesto: lo que se lee si la respuesta no vuelve y si vuelve un error sin texto', async () => {
  for (const [caso, extra] of [['un precio', {}], ['tres opciones', { tiers: TRES_OPCIONES }]]) {
    const html = await paginaDelPresupuesto(extra);
    assert.deepEqual({ sinRespuesta: textoSinRespuesta(html), deReserva: textoDeReserva(html), viejos: viejosEn(html) },
      { sinRespuesta: TEXTO_B, deReserva: TEXTO_C, viejos: [] }, caso);
  }
});

// ── B y D · parte ────────────────────────────────────────────────────────────────────────────────
test('SCRUM-1302d · B · parte: lo que se lee si la respuesta de la firma no vuelve', async () => {
  const { cuerpo } = await bancoDelParte().pagina();
  assert.ok(cuerpo.includes('Firmar el parte de trabajo'), 'CIEGO: no es la página de firma del parte');
  assert.equal(textoSinRespuesta(cuerpo), TEXTO_B);
  assert.deepEqual(viejosEn(cuerpo), []);
});

test('SCRUM-1302e · C · parte: si el servidor contesta un error sin texto, se lee lo mismo que en el presupuesto', async () => {
  const { cuerpo } = await bancoDelParte().pagina();
  assert.ok(cuerpo.includes('Firmar el parte de trabajo'), 'CIEGO: no es la página de firma del parte');
  assert.equal(textoDeReservaDelParte(cuerpo), TEXTO_C);
  assert.equal(textoDeReservaDelParte(cuerpo), textoDeReserva(await paginaDelPresupuesto()), '🔴 parte y presupuesto ya no dicen lo mismo');
});

test('🔴 SCRUM-1302d · D · el parte firmado no promete ninguna copia: ni al acabar de firmar ni al volver al enlace', async () => {
  // Al acabar de firmar: lo que el guion de la página pone en lugar del formulario.
  const { cuerpo: deFirma } = await bancoDelParte().pagina();
  const exito = deFirma.match(/<h1[^>]*>¡Parte firmado!<\/h1><p class="meta"[^>]*>([^<]*)<\/p>/);
  assert.ok(exito, 'CIEGO: no encuentro la pantalla «¡Parte firmado!» en la página de firma');
  assert.equal(exito[1], `Gracias, ${CLIENTE_DEL_PARTE}.`);
  assert.deepEqual(promesasDeCopia(deFirma), [], '🔴 la página de firma del parte habla de una copia');
  assert.ok(!/whatsapp/i.test(deFirma.replace(/<style[\s\S]*?<\/style>/g, '')), '🔴 la página de firma del parte nombra WhatsApp');

  // Al volver al enlace de un parte ya firmado.
  const { cuerpo: yaFirmado } = await bancoDelParte({ estado: 'firmado' }).pagina();
  assert.ok(yaFirmado.includes('Este parte de trabajo ya está firmado.'), 'CIEGO: no es la página del parte ya firmado');
  assert.ok(yaFirmado.includes(`Gracias, ${CLIENTE_DEL_PARTE}.</div>`), 'después de «Gracias, {nombre}.» no va nada más');
  assert.deepEqual(promesasDeCopia(yaFirmado), [], '🔴 la página del parte ya firmado habla de una copia');
  assert.ok(!/whatsapp/i.test(yaFirmado.replace(/<style[\s\S]*?<\/style>/g, '')), '🔴 la página del parte ya firmado nombra WhatsApp');
});

// ── La condición de la B, en el parte: reintentar una firma que llegó no firma otra vez ───────────
test('🔴 SCRUM-1302d · B · parte: reintentar una firma que SÍ llegó contesta «ya está» y no escribe nada', async () => {
  const b = bancoDelParte();
  const r1 = await b.firmar();
  assert.deepEqual([r1.status, b.fila.estado, b.cuenta.escrituras, b.cuenta.copias], [200, 'firmado', 1, 1],
    'CONTROL: la primera firma tiene que entrar; si no, lo de abajo no mide nada');
  const sello = JSON.stringify(b.fila.evidenciaFirma);
  const cuando = String(b.fila.firmadoAt);

  const r2 = await b.firmar();
  assert.equal(r2.status, 200);
  assert.equal(r2.data.already, true);
  assert.deepEqual(b.cuenta, { escrituras: 1, pdf: 1, copias: 1 }, '🔴 el reintento ha vuelto a escribir, a hacer el PDF o a pedir la copia');
  assert.equal(JSON.stringify(b.fila.evidenciaFirma), sello, '🔴 el reintento ha cambiado el sello');
  assert.equal(String(b.fila.firmadoAt), cuando, '🔴 el reintento ha cambiado la fecha de firma');
});

test('🔴 SCRUM-1302d · B · parte: si el reintento trae otro trazo, otro nombre u otra versión, queda la primera firma', async () => {
  const b = bancoDelParte();
  await b.firmar();
  const r2 = await b.firmar({ signatureData: TRAZO_2, firmadoPorNombre: 'Otra Persona', firmadoPorCalidad: 'familiar_o_conviviente', version: 2 });
  assert.equal(r2.status, 200);
  assert.equal(b.cuenta.escrituras, 1);
  assert.equal(b.fila.signatureUrl, TRAZO_1, '🔴 el segundo trazo ha sustituido al primero');
  assert.equal(b.fila.firmadoPorNombre, 'Ana Prueba', '🔴 el segundo nombre ha sustituido al primero');
});
