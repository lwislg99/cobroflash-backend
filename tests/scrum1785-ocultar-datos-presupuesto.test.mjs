// tests/scrum1785-ocultar-datos-presupuesto.test.mjs — SCRUM-1785 (sprint del fundador, 21-nov-2026)
//
// Orden del fundador (literal en el ticket): «En presupuesto cuando le das a ocultar datos, no
// funciona, al menos con el número. Tienes que arreglarlo y asegurar que funcione y que se quita
// tanto del pdf como de la preview».
//
// «Ocultar datos» es el bloque «Datos del cliente en el documento» del editor de presupuestos
// (`quotesView.js`, casillas Nombre · Teléfono · NIF · Email → `docFields`, A20.4). El viaje entero:
//
//   casilla desmarcada → POST /quote/create lleva `docFields` → `CreateQuoteSchema` lo conserva →
//   la fila → `paramsDePresupuestoParaPdf` → `generateQuotePdf` → el TEXTO del PDF no lo lleva.
//
// Aquí se mide ese viaje por EFECTO (cuerpo real del POST; texto extraído del PDF real), cada dato
// ocultable por separado, con su control positivo (sin ocultar, el dato SÍ sale).
//
// ── LA VISTA PREVIA («Así lo verá el cliente») NO ESTÁ AQUÍ, y no es un olvido ─────────────────
// Medido el 21-nov-2026 con el banco de vistas: la vista previa pinta «Tel: …» con la casilla
// Teléfono desmarcada (y el nombre con Nombre desmarcado), porque `renderPreview` no mira
// `dfChecks` y las casillas no la redibujan. `quotesView.js` es del carril S2 (equipo de Luis):
// la medición, el rojo y el arreglo literal propuesto están en `docs/master/SCRUM-1785.md` y en
// `docs/master/evidencias/scrum1785/vista-previa.mjs`. Un caso rojo aquí pararía el merge de todos.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { extraerTextoPdf } from './_texto-del-pdf.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { CreateQuoteSchema } = require(path.join(RAIZ, 'dist/core/validation/schemas.js'));
const { paramsDePresupuestoParaPdf } = await import('../dist/modules/quotes/domain/presupuestoParaPdf.js');

/**
 * LAS MUTACIONES QUE TUMBAN A ESTE GUARD (contrato de `scripts/meta-guard-mutaciones.mjs`).
 * Las dos imitan el defecto del ticket —«ignora ocultar el teléfono»— en cada mitad del viaje,
 * y NINGUNA toca `pdf.service.ts` (camino de emisión: ahí vive `generateInvoicePdf`).
 */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'src/modules/quotes/domain/presupuestoParaPdf.ts',
    de: 'docFields: (quote.docFields as any) ?? null,',
    a: 'docFields: { ...((quote.docFields as any) ?? {}), phone: true },',
    cae: 'SCRUM-1785 · 🔴 PDF: con «Teléfono» oculto, el teléfono del cliente NO sale',
  },
  {
    fichero: 'public/dashboard/js/quotesView.js',
    de: 'dfDefs.forEach(function (d) { out[d.key] = dfChecks[d.key].checked; });',
    a: 'dfDefs.forEach(function (d) { out[d.key] = d.key === "phone" ? true : dfChecks[d.key].checked; });',
    cae: 'SCRUM-1785 · 🔴 EDITOR: desmarcar «Teléfono» viaja al servidor como phone=false',
  },
  {
    // Ocultar el del cliente NO debe llevarse el del comercio (relevo jv-j1gm).
    fichero: 'src/modules/quotes/domain/presupuestoParaPdf.ts',
    de: 'whatsappPhone: merchant.whatsappPhone ?? null,',
    a: 'whatsappPhone: (quote.docFields as any)?.phone === false ? null : merchant.whatsappPhone ?? null,',
    cae: 'PDF: con «Teléfono» oculto sale el WhatsApp del COMERCIO en el bloque del emisor',
  },
];

// Tokens SIN espacios e improbables: si aparecen en el papel no es coincidencia, y el salto de
// línea de pdfkit no los puede partir.
const CLIENTE = {
  id: 5, name: 'QA1785NOMBRE', phone: '600178511', mobile: '600178511',
  email: 'qa1785@correo.es', taxId: 'X1785000Z',
};
const DATOS = [
  { key: 'name', rotulo: 'Nombre', valor: CLIENTE.name },
  { key: 'phone', rotulo: 'Teléfono', valor: CLIENTE.phone },
  { key: 'taxId', rotulo: 'NIF', valor: CLIENTE.taxId },
  { key: 'email', rotulo: 'Email', valor: CLIENTE.email },
];
const CONCEPTO = 'Bajante1785';
const MERCHANT = { name: 'QA Fontaneria', legalName: 'QA SL', taxId: 'B00000000', country: 'ES' };

async function textoDelPdf(docFields) {
  const quote = {
    id: 17850, quoteNumber: 1785, currency: 'EUR', total: '121.00',
    lines: [{ concept: CONCEPTO, qty: 1, price: 100, tax: 0.21 }], docFields,
  };
  const { generateQuotePdf } = await import('../dist/lib/pdf.js');
  const { outPath } = await generateQuotePdf(paramsDePresupuestoParaPdf({ quote, merchant: MERCHANT, customer: CLIENTE }));
  let leido;
  try { leido = extraerTextoPdf(fs.readFileSync(outPath)); } finally { fs.rmSync(outPath, { force: true }); }
  // `ok:false` es «NO SUPE LEERLO», no «no dice nada»: un PDF ilegible daría todos los «no sale» en verde.
  assert.equal(leido.ok, true, `CIEGO: el lector no sabe leer este PDF (${leido.motivo})`);
  return leido.texto;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// ① EL PDF — de la fila al papel
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1785 · CONTROL POSITIVO del PDF: sin ocultar nada salen los cuatro datos y el concepto', async () => {
  const t = await textoDelPdf(null);
  assert.ok(t.includes(CONCEPTO), `SUELO: el lector no ve ni el concepto: no está leyendo el PDF (${t.length} car.)`);
  for (const d of DATOS) assert.ok(t.includes(d.valor), `SUELO: sin ocultar, ${d.rotulo} (${d.valor}) no sale: el resto no mediría nada`);
});

// Nombres LITERALES, uno por dato: un nombre construido lo tumba `scrum1415` (el catálogo de
// mutaciones y el `cae` casan por el nombre escrito).
const dato = (key) => DATOS.find((x) => x.key === key);
async function pdfOcultaUno(d) {
  const t = await textoDelPdf({ [d.key]: false });
  assert.ok(t.includes(CONCEPTO), 'SUELO: el PDF no se ha leído');
  assert.equal(t.includes(d.valor), false, `🔴 «${d.rotulo}» desmarcado y el PDF imprime ${d.valor}`);
  for (const o of DATOS.filter((x) => x.key !== d.key)) {
    assert.ok(t.includes(o.valor), `🔴 ocultar «${d.rotulo}» se lleva también ${o.rotulo}`);
  }
}
test('SCRUM-1785 · 🔴 PDF: con «Teléfono» oculto, el teléfono del cliente NO sale', () => pdfOcultaUno(dato('phone')));
test('SCRUM-1785 · 🔴 PDF: con «Nombre» oculto, ese dato NO sale y los otros tres sí', () => pdfOcultaUno(dato('name')));
test('SCRUM-1785 · 🔴 PDF: con «NIF» oculto, ese dato NO sale y los otros tres sí', () => pdfOcultaUno(dato('taxId')));
test('SCRUM-1785 · 🔴 PDF: con «Email» oculto, ese dato NO sale y los otros tres sí', () => pdfOcultaUno(dato('email')));

test('SCRUM-1785 · PDF: los cuatro ocultos a la vez — no sale ninguno', async () => {
  const t = await textoDelPdf({ name: false, phone: false, taxId: false, email: false });
  assert.ok(t.includes(CONCEPTO), 'SUELO: el PDF no se ha leído');
  for (const d of DATOS) assert.equal(t.includes(d.valor), false, `🔴 todo oculto y el PDF imprime ${d.rotulo}`);
});

// ── ①bis · EL OTRO NÚMERO DEL PAPEL: el WhatsApp DEL COMERCIO (relevo jv-j1gm) ────────────────
// Respuesta del fundador (SCRUM-1785 c.22271): el que no se oculta es «el del cliente, creo»; si el
// que sale es el del comercio, que vaya rotulado como WhatsApp de la empresa. Medido con
// `docs/master/evidencias/scrum1785/pdf-telefonos.mjs`: con «Teléfono» oculto el del cliente NO
// sale y el del comercio SÍ, en el bloque del emisor (antes de «Cliente:»). Este caso fija las DOS
// mitades: que ocultar no se lleve el del comercio es tan comportamiento como que quite el del
// cliente. El rótulo (hoy «WhatsApp <número>», sin nombre) espera la firma del fundador: aquí NO se
// fija su texto, sólo de quién es el número y en qué bloque cae.
const TEL_COMERCIO = '611178522';

test('SCRUM-1785 · PDF: con «Teléfono» oculto sale el WhatsApp del COMERCIO en el bloque del emisor, y el del cliente no', async () => {
  const quote = {
    id: 17852, quoteNumber: 1785, currency: 'EUR', total: '121.00',
    lines: [{ concept: CONCEPTO, qty: 1, price: 100, tax: 0.21 }], docFields: { phone: false },
  };
  const { generateQuotePdf } = await import('../dist/lib/pdf.js');
  const { outPath } = await generateQuotePdf(paramsDePresupuestoParaPdf({
    quote, merchant: { ...MERCHANT, whatsappPhone: TEL_COMERCIO }, customer: CLIENTE,
  }));
  let leido;
  try { leido = extraerTextoPdf(fs.readFileSync(outPath)); } finally { fs.rmSync(outPath, { force: true }); }
  assert.equal(leido.ok, true, `CIEGO: el lector no sabe leer este PDF (${leido.motivo})`);
  const t = leido.texto;
  assert.ok(t.includes(CONCEPTO), 'SUELO: el PDF no se ha leído');
  assert.equal(t.includes(CLIENTE.phone), false, '🔴 «Teléfono» oculto y el PDF imprime el del cliente');
  const iCom = t.indexOf(TEL_COMERCIO);
  const iCli = t.indexOf('Cliente:');
  assert.ok(iCom >= 0, '🔴 ocultar el teléfono del cliente se ha llevado el WhatsApp del comercio');
  assert.ok(iCli > iCom, `🔴 el WhatsApp del comercio no cae en el bloque del emisor (pos ${iCom}, «Cliente:» en ${iCli})`);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// ② EL EDITOR — de la casilla al cuerpo del POST, y del POST al esquema del servidor
// ═══════════════════════════════════════════════════════════════════════════════════════════

const respirar = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const texto = (n) => String(n.textContent || '');

function banco() {
  const posts = [];
  const red = {
    navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
    fetch: async (url, opts) => {
      const u = String(url);
      const metodo = (opts && opts.method) || 'GET';
      let cuerpo = {};
      if (/\/admin\/customers/.test(u)) cuerpo = [CLIENTE];
      else if (/\/admin\/merchant$/.test(u)) cuerpo = { id: 1, name: 'Taller', defaultCurrency: 'EUR', clausulasPresupuesto: [] };
      else if (/\/quote\/create/.test(u) && metodo === 'POST') {
        posts.push(JSON.parse(String(opts.body)));
        cuerpo = { id: 99, number: 'P-2026-0003', status: 'draft' };
      } else if (/\/admin\/quotes\/\d+$/.test(u)) cuerpo = { id: 99, pdfUrl: '/pdf/99.pdf' };
      return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => cuerpo, text: async () => '' };
    },
  };
  const b = cargarDashboard(RAIZ, { red });
  b.ctx.appMerchantId = 1;
  b.ctx.renderAppView = () => {};
  return { b, posts };
}

/** La casilla de un dato, buscada por su rótulo DENTRO del bloque de datos del cliente. */
function casillaDe(contenedor, rotulo) {
  const lbl = todos(contenedor).find((x) => x.tagName === 'LABEL'
    && todos(x).some((h) => texto(h).trim() === rotulo)
    && todos(x).some((h) => h.tagName === 'INPUT' && h.type === 'checkbox'));
  return lbl ? todos(lbl).find((h) => h.tagName === 'INPUT' && h.type === 'checkbox') : null;
}

async function generarCon(ocultos) {
  const { b, posts } = banco();
  const r = await pintarVista(b, 'renderQuotesView', { name: 'x', currency: 'EUR', lines: [{ concept: CONCEPTO, qty: 1, price: 80 }] });
  assert.equal(r.error, null, `SUELO: la vista no monta: ${r.error && r.error.message}`);
  await respirar();
  const n = todos(r.contenedor);
  const sel = n.find((x) => x.tagName === 'SELECT' && x.name === 'customer_id');
  assert.ok(sel, 'SUELO: no se encuentra el selector de cliente');
  sel.value = String(CLIENTE.id);
  sel.disparar('change');
  for (const d of DATOS) assert.ok(casillaDe(r.contenedor, d.rotulo), `SUELO: no encuentro la casilla «${d.rotulo}»`);
  for (const key of ocultos) {
    const chk = casillaDe(r.contenedor, DATOS.find((d) => d.key === key).rotulo);
    chk.checked = false;
    chk.disparar('change');
  }
  const primaria = todos(r.contenedor).find((x) => x.tagName === 'BUTTON' && /^Generar/.test(texto(x)));
  assert.ok(primaria, 'SUELO: la pantalla no tiene «Generar»');
  primaria.disparar('click');
  await respirar(20);
  assert.equal(posts.length, 1, 'SUELO: «Generar» no ha llegado al POST /quote/create');
  return posts[0];
}

test('SCRUM-1785 · CONTROL: con todo marcado (lo de siempre) `docFields` NO viaja — la fila se queda en NULL', async () => {
  const post = await generarCon([]);
  assert.equal(post.docFields, undefined);
});

test('SCRUM-1785 · 🔴 EDITOR: desmarcar «Teléfono» viaja al servidor como phone=false', async () => {
  const post = await generarCon(['phone']);
  assert.ok(post.docFields, '🔴 el cuerpo del POST no lleva `docFields`');
  assert.equal(post.docFields.phone, false, '🔴 «Teléfono» desmarcado y el POST dice phone≠false');
  const leido = CreateQuoteSchema.safeParse(post);
  assert.ok(leido.success, `🔴 el servidor rechaza el cuerpo del editor: ${leido.error && leido.error.message}`);
  assert.equal(leido.data.docFields.phone, false, '🔴 el esquema del servidor pierde phone=false');
});

async function editorOcultaUno(d) {
  const post = await generarCon([d.key]);
  const leido = CreateQuoteSchema.safeParse(post);
  assert.ok(leido.success, `🔴 el servidor rechaza el cuerpo: ${leido.error && leido.error.message}`);
  for (const o of DATOS) assert.equal(leido.data.docFields[o.key], o.key !== d.key, `🔴 ${o.key} viaja mal`);
}
test('SCRUM-1785 · EDITOR: desmarcar «Nombre» viaja como name=false y sólo ése', () => editorOcultaUno(dato('name')));
test('SCRUM-1785 · EDITOR: desmarcar «NIF» viaja como taxId=false y sólo ése', () => editorOcultaUno(dato('taxId')));
test('SCRUM-1785 · EDITOR: desmarcar «Email» viaja como email=false y sólo ése', () => editorOcultaUno(dato('email')));
