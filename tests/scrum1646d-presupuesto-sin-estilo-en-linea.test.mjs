// tests/scrum1646d-presupuesto-sin-estilo-en-linea.test.mjs — SCRUM-1646d (CSP paso 2, `style-src 'self'`)
//
// LA PÁGINA DONDE EL CLIENTE FIRMA EL PRESUPUESTO, SIN UN SOLO `<style>` NI `style=`.
//
// Con `style-src 'self'` aplicada (SCRUM-1637) el navegador no pinta un `<style>` en línea ni un
// `style=`, y esta página llevaba tres `<style>` (el de `renderPage`, el de las opciones y el del
// color de marca) y hasta ocho `style=` por cara. Medido en el HTML generado de main: «para firmar»
// 2-3 `<style>` y 5 `style=`; con opciones 2-3 y 8; el formulario de rechazo 1-2 y 7.
//
// Aquí se mira, por la PUERTA (las rutas reales de `dist`, base doblada):
//   1 · las siete caras, con y sin color de marca: 0 `<style>`, 0 `style=`, y sus hojas desde 'self'
//       EN EL ORDEN de la cascada de antes (fuente → base → marca → opciones);
//   2 · cada clase nueva del marcado tiene su regla en la hoja;
//   3 · las hojas: constantes (la de marca, función SÓLO del color), sin marcado; caché `immutable`
//       sólo con la huella buena;
//   4 · LA HOJA DE MARCA: el MISMO filtro de antes (`^#[0-9a-fA-F]{6}$`). Un color que no pasa no
//       enlaza hoja, y la ruta contesta 404 sin cuerpo a todo lo que no sean seis hexadecimales.
//
// «Cero cambios visibles» NO se mide aquí: lo miden las capturas con la CSP APLICADA
// (`docs/master/evidencias/SCRUM-1646d/`). Esto es el trinquete de que no vuelva el estilo en línea.
//
// ⛔ Sin red ni base. Control positivo en cada contador: ve lo que busca cuando está.
process.env.WHATSAPP_DRY_RUN = '1';
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } from './_envio-doblado.mjs';
import { hojasDeLaPagina } from './_scripts-de-la-pagina.mjs';
import {
  PRESUPUESTO_FIRMA_CSS, PRESUPUESTO_OPCIONES_CSS, HREF_PRESUPUESTO_FIRMA_CSS, HREF_PRESUPUESTO_OPCIONES_CSS,
  HUELLA_PRESUPUESTO_FIRMA_CSS, HUELLA_PRESUPUESTO_OPCIONES_CSS, HUELLA_PRESUPUESTO_MARCA_CSS, hrefDeLaHojaDeMarca,
} from '../dist/modules/system/app/routes/quoteDecisionEstilo.js';

// Las del meta-guard (`scripts/meta-guard-mutaciones.mjs`): cada una devuelve una pieza del arreglo
// a como estaba, y tiene que tumbar el caso que nombra.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El aviso «sin firma» vuelve a su `style=`.
    fichero: 'src/modules/system/app/routes/quoteDecisionLanding.routes.ts',
    de: '<div id="sig-error">',
    a: '<div id="sig-error" style="color:#dc2626;font-size:13px;margin-top:8px;display:none">',
    cae: 'SCRUM-1646d · las siete caras, con y sin marca: 0 <style>, 0 style= y sus hojas en el orden de la cascada',
  },
  {
    // La cara de firmar deja de enlazar la hoja de las opciones.
    fichero: 'src/modules/system/app/routes/quoteDecisionLanding.routes.ts',
    de: '`, brandColor, true);',
    a: '`, brandColor);',
    cae: 'SCRUM-1646d · las siete caras, con y sin marca: 0 <style>, 0 style= y sus hojas en el orden de la cascada',
  },
  {
    // El filtro del color de marca se afloja: cualquier cosa tras `#` llegaría al CSS.
    fichero: 'src/modules/system/app/routes/quoteDecisionEstilo.ts',
    de: 'export const COLOR_DE_MARCA_VALIDO = /^#[0-9a-fA-F]{6}$/;',
    a: 'export const COLOR_DE_MARCA_VALIDO = /^#.+$/;',
    cae: 'SCRUM-1646d · la hoja de marca: el MISMO filtro; lo que no son seis hexadecimales no enlaza ni se sirve',
  },
  {
    // `immutable` siempre, con huella buena o sin ella.
    fichero: 'src/modules/system/app/routes/quoteDecisionEstilo.ts',
    de: "return pedida === buena ? CACHE_CON_HUELLA : 'no-cache';",
    a: 'return CACHE_CON_HUELLA;',
    cae: 'SCRUM-1646d · las tres hojas: immutable SÓLO con la huella buena',
  },
];

const LANDING = '../dist/modules/system/app/routes/quoteDecisionLanding.routes.js';
const TOKEN = 'd'.repeat(32);
const FIJA = '2026-11-12T10:00:00.000Z';
const MARCA = '#C2410c';

let FILA = null;
inyectarBase({
  'quote.findUnique': ({ where }) => (where.decisionToken === TOKEN ? JSON.parse(JSON.stringify(FILA)) : null),
  'quote.findFirst': ({ where }) => (where.decisionToken === TOKEN ? JSON.parse(JSON.stringify(FILA)) : null),
  'quote.count': () => 0,
}, [LANDING]);
const { quoteDecisionLandingRouter } = moduloDeDist(LANDING);

const opcion = (id, label, precio, recommended) => ({
  id, label, description: '', recommended, total: (precio * 1.21).toFixed(2),
  lines: [{ concept: `Trabajo ${label}`, qty: 1, price: precio, tax: 0.21 }],
});
const TRES = [opcion('basica', 'Básica', 100, false), opcion('completa', 'Completa', 200, true), opcion('total', 'Total', 300, false)];

function fila(extra = {}, brandColor = null) {
  return {
    id: 1646, merchantId: MERCHANT, customerId: CLIENTE, status: 'sent', total: '121.00', currency: 'EUR',
    lines: [{ concept: 'Revisión', qty: 1, price: 100, tax: 0.21 }], quoteNumber: 1646, revision: 0, seriesYear: 2026,
    decisionToken: TOKEN, validUntil: '2099-01-31T10:00:00.000Z', paymentTerms: 'FULL_UPFRONT',
    tiers: null, discountGlobalAmount: null, acceptedAt: null, rejectedAt: null, rejectionReason: null, jobId: null,
    createdAt: FIJA, updatedAt: FIJA, signatureUrl: null,
    merchant: { id: MERCHANT, name: 'Fontanería 1646', legalName: null, taxId: null, country: 'ES', email: null,
      whatsappPhone: '+34000000000', defaultCurrency: 'EUR', flags: null, timezone: 'Europe/Madrid', brandColor,
      brandAccentColor: null, logoUrl: null, address: null, clausulasPresupuesto: null },
    customer: { id: CLIENTE, name: 'Cliente 1646' },
    Invoice: [],
    ...extra,
  };
}

const capaDe = (ruta, m = 'get') => quoteDecisionLandingRouter.stack.find((l) => l.route && [].concat(l.route.path).includes(ruta) && l.route.methods[m]);

async function pedir(ruta, { m = 'get', params = { token: TOKEN }, query = {}, body = {} } = {}) {
  const capa = capaDe(ruta, m);
  assert.ok(capa, `🔴 la landing del presupuesto no tiene ${m.toUpperCase()} ${ruta}`);
  let cuerpo = '', status = 200, terminado = false;
  const cab = {};
  const res = {
    status(s) { status = s; return res; }, setHeader(k, v) { cab[k.toLowerCase()] = v; return res; },
    redirect(u) { cuerpo = 'REDIRECT ' + u; return res; }, send(b) { cuerpo = String(b); return res; }, end() { terminado = true; return res; },
  };
  await capa.route.stack.at(-1).handle({ params, query, headers: {}, ip: '127.0.0.1', socket: {}, body }, res);
  return { status, cab, cuerpo, terminado };
}

// Las siete caras (las mismas de las capturas). `suelo`: lo que prueba que es ESA cara.
const GET = '/quote/:token';
const CARAS = [
  { cara: 'para firmar', ruta: GET, extra: {}, suelo: 'id="btn-accept"', opciones: true },
  { cara: 'con opciones', ruta: GET, extra: { tiers: TRES, total: '242.00' }, suelo: 'id="tier-cards"', opciones: true },
  { cara: 'aceptado', ruta: GET, extra: { status: 'accepted', acceptedAt: FIJA }, suelo: 'Ya aceptaste' },
  { cara: 'rechazado', ruta: GET, extra: { status: 'rejected', rejectedAt: FIJA }, suelo: 'Rechazaste' },
  { cara: 'caducado', ruta: GET, extra: { validUntil: '2026-01-31T10:00:00.000Z' }, suelo: 'caducó' },
  { cara: 'formulario de rechazo', ruta: '/quote/:token/reject', extra: {}, suelo: 'name="reason"' },
  // Sin red, el reenvío a la API falla y sale la cara de ERROR del POST: también es `renderPage`, sin color.
  { cara: 'rechazo enviado (su error, sin red)', ruta: '/quote/:token/reject', m: 'post', extra: {}, suelo: 'class="status-error"', sinMarca: true },
];

async function htmlDe({ ruta, m, extra }, brandColor) {
  FILA = fila(extra, brandColor);
  const r = await pedir(ruta, { m, body: { reason: 'price' } });
  return r.cuerpo;
}

// ── Los contadores: sobre las ETIQUETAS del HTML, no sobre el texto ────────────────────────────
const ETIQUETA = /<[a-zA-Z][^<>]*>/g;
const estilosEnLinea = (html) => html.match(/<style\b[^<>]*>/gi) || [];
const atributosStyle = (html) => (html.match(ETIQUETA) || []).filter((t) => /\sstyle\s*=/i.test(t));
// Las clases que puso SCRUM-1646d en el marcado: cada una tiene que tener regla en la hoja base.
const CLASES_NUEVAS = ['centrado', 'condiciones-wrap', 'btn-pedir-nuevo', 'enlace-rechazar', 'rechazo-titulo', 'rechazo-sub', 'rechazo-label', 'enlace-volver', 'oculto-hasta-elegir'];
const clasesDe = (html) => [...html.matchAll(/class="([^"]*)"/g)].flatMap((x) => x[1].split(/\s+/));

test('SCRUM-1646d · control positivo sembrado: los contadores ven un <style> y un style= fabricados', () => {
  const sembrado = '<div><style>p{color:red}</style><span style="color:#ef4444">x</span><p>style= en un texto no cuenta</p></div>';
  assert.equal(estilosEnLinea(sembrado).length, 1, 'el contador de <style> no ve el sembrado: está CIEGO');
  assert.equal(atributosStyle(sembrado).length, 1, 'el contador de style= no ve el sembrado: está CIEGO');
  assert.deepEqual(hojasDeLaPagina('<link rel="stylesheet" href="/a.css"/><link href="/b.css" rel="stylesheet">').locales, ['/a.css', '/b.css'],
    'el lector de hojas no ve lo sembrado: está CIEGO');
  assert.deepEqual(clasesDe('<a class="x centrado">'), ['x', 'centrado'], 'el extractor de clases está CIEGO');
});

test('SCRUM-1646d · las siete caras, con y sin marca: 0 <style>, 0 style= y sus hojas en el orden de la cascada', async () => {
  const hrefMarca = hrefDeLaHojaDeMarca(MARCA);
  assert.ok(hrefMarca, 'CIEGO: el color de la muestra no pasa el filtro');
  let vistas = 0;
  for (const c of CARAS) {
    for (const marca of [null, MARCA]) {
      const html = await htmlDe(c, marca);
      const donde = `«${c.cara}»${marca ? ' con marca' : ''}`;
      assert.ok(html.includes(c.suelo), `suelo: ${donde} no pintó «${c.suelo}»: no es esa cara`);
      assert.deepEqual(estilosEnLinea(html), [], `${donde} lleva <style> en línea`);
      assert.deepEqual(atributosStyle(html), [], `${donde} lleva style= en el marcado`);
      const hojas = hojasDeLaPagina(html);
      assert.deepEqual(hojas.ilegibles, [], `${donde}: hojas que no se saben leer`);
      assert.deepEqual(hojas.remotas, [], `${donde}: hojas fuera de 'self'`);
      // El POST del rechazo no lleva color (nunca lo llevó): renderPage sin brandColor.
      const conMarca = marca && !c.sinMarca;
      assert.deepEqual(hojas.locales, [
        '/fonts/inter.css', HREF_PRESUPUESTO_FIRMA_CSS,
        ...(conMarca ? [hrefMarca] : []),
        ...(c.opciones ? [HREF_PRESUPUESTO_OPCIONES_CSS] : []),
      ], `${donde}: hojas distintas o en otro orden (la cascada de antes es fuente → base → marca → opciones)`);
      for (const k of clasesDe(html).filter((x) => CLASES_NUEVAS.includes(x))) {
        assert.ok(PRESUPUESTO_FIRMA_CSS.includes(`.${k} {`), `${donde}: la clase ${k} no tiene regla en la hoja`);
      }
      vistas++;
    }
  }
  assert.equal(vistas, 14, 'CIEGO: no se miraron las catorce');
});

test('SCRUM-1646d · lo que el guion enseña sigue oculto por la hoja, y sólo con opciones se oculta la firma', async () => {
  const uno = await htmlDe(CARAS[0], null);
  const tres = await htmlDe(CARAS[1], null);
  // La etiqueta se lee con hueco para atributos (SCRUM-553) y se juzga lo que lleva: ni style= ni otra clase.
  const envoltura = (h) => {
    const m = h.match(/<div id="btn-accept-wrapper"([^>]*)>/);
    return m ? m[1].trim() : null;
  };
  assert.equal(envoltura(uno), '', 'sin opciones la firma se ve de entrada (sin clase ni style=)');
  assert.equal(envoltura(tres), 'class="oculto-hasta-elegir"', 'con opciones la firma espera a que se elija');
  for (const regla of ['#tier-confirm { display:none }', '#sig-error { color:#dc2626;font-size:13px;margin-top:8px;display:none }',
    '#btn-accept-wrapper.oculto-hasta-elegir { display:none }', '#tier-cards { display:flex;flex-direction:column;gap:12px;margin-bottom:20px }']) {
    assert.ok(PRESUPUESTO_FIRMA_CSS.includes(regla), `falta en la hoja: ${regla}`);
  }
});

test('SCRUM-1646d · las hojas: constantes, sin marcado, y la base y la de opciones tal como las pide la página', async () => {
  const base = await pedir('/quote/css/firma.css', { params: {}, query: { v: HUELLA_PRESUPUESTO_FIRMA_CSS } });
  const ops = await pedir('/quote/css/opciones.css', { params: {}, query: { v: HUELLA_PRESUPUESTO_OPCIONES_CSS } });
  for (const [n, r, cuerpo] of [['base', base, PRESUPUESTO_FIRMA_CSS], ['opciones', ops, PRESUPUESTO_OPCIONES_CSS]]) {
    assert.equal(r.status, 200, `la hoja ${n} no contesta 200`);
    assert.match(r.cab['content-type'] || '', /^text\/css/, `la hoja ${n} no va como text/css`);
    assert.equal(r.cuerpo, cuerpo, `la hoja ${n} servida no es la constante`);
    assert.ok(!/[<>]|\$\{/.test(cuerpo.replace(/\s>\s/g, '')), `la hoja ${n} lleva marcado o plantilla`);
  }
  // Suelo: lo que la página pintaba arriba de todo y lo que pintaba la tarjeta de opciones.
  assert.ok(PRESUPUESTO_FIRMA_CSS.includes('.btn-accept { width: 100%;'), 'la hoja base no trae las reglas de antes');
  assert.ok(PRESUPUESTO_OPCIONES_CSS.includes('.tier-card { border: 2px solid #e7e9e5;'), 'la hoja de opciones no trae las reglas de antes');
});

test('SCRUM-1646d · la hoja de marca: el MISMO filtro; lo que no son seis hexadecimales no enlaza ni se sirve', async () => {
  // Control: un color bueno se enlaza y se sirve, con el color TAL CUAL (mayúsculas incluidas).
  const r = await pedir('/quote/css/marca/:color', { params: { color: 'C2410c' }, query: { v: HUELLA_PRESUPUESTO_MARCA_CSS } });
  assert.equal(r.status, 200, 'un color válido no se sirve');
  assert.match(r.cab['content-type'] || '', /^text\/css/);
  assert.equal((r.cuerpo.match(/#C2410c/g) || []).length, 6, 'la hoja de marca no lleva el color en sus seis reglas');
  assert.ok(r.cuerpo.includes('a { color: #C2410c; }'), 'la hoja de marca no es la de antes');
  assert.ok(!/btn-accept/.test(r.cuerpo), 'P1-1: el color de marca NUNCA va en el botón de aceptar');
  // Lo que no pasa: ni enlace en la página ni CSS en la ruta.
  for (const malo of ['red', '#fff', '#12345g', '#1234567', '12345', 'zzzzzz', '000000;}a{x', '000000 ', '']) {
    assert.equal(hrefDeLaHojaDeMarca(malo), null, `«${malo}» como brandColor enlazaría una hoja`);
    const enRuta = malo.replace(/^#/, '');
    const s = await pedir('/quote/css/marca/:color', { params: { color: enRuta } });
    assert.equal(s.status, 404, `«${enRuta}» en la ruta no contesta 404`);
    assert.equal(s.cuerpo, '', `«${enRuta}» en la ruta devuelve cuerpo`);
  }
  const conMalo = await htmlDe(CARAS[0], 'red;}a{color:red');
  assert.ok(!hojasDeLaPagina(conMalo).locales.some((h) => h.includes('/marca/')), 'un brandColor inválido enlaza hoja de marca');
});

test('SCRUM-1646d · las tres hojas: immutable SÓLO con la huella buena', async () => {
  const casos = [
    ['/quote/css/firma.css', {}, HUELLA_PRESUPUESTO_FIRMA_CSS],
    ['/quote/css/opciones.css', {}, HUELLA_PRESUPUESTO_OPCIONES_CSS],
    ['/quote/css/marca/:color', { color: '16a34a' }, HUELLA_PRESUPUESTO_MARCA_CSS],
  ];
  for (const [ruta, params, huella] of casos) {
    assert.match(huella, /^[0-9a-f]{10}$/, `${ruta}: la huella no tiene la forma de las demás`);
    const buena = await pedir(ruta, { params, query: { v: huella } });
    assert.match(buena.cab['cache-control'] || '', /immutable/, `${ruta}: con la huella buena no es immutable`);
    for (const q of [{}, { v: 'otra' }]) {
      const mala = await pedir(ruta, { params, query: q });
      assert.equal(mala.cab['cache-control'], 'no-cache', `${ruta} ${JSON.stringify(q)}: sin la huella buena se cachea`);
    }
  }
});
