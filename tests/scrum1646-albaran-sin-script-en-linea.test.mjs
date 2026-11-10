// tests/scrum1646-albaran-sin-script-en-linea.test.mjs — SCRUM-1646 (CSP paso 2, tramo albarán público)
//
// LA PÁGINA PÚBLICA DE FIRMA DEL PARTE TIENE QUE FUNCIONAR CON `script-src 'self'`.
//
// Hasta aquí llevaba tres `<script>` en línea (el lienzo, los campos del firmante y el de firmar) y un
// `onclick="location.reload()"` metido con `innerHTML` dentro de una cadena. Con la CSP del paso 1
// aplicada, el cliente no podría firmar: el botón no haría nada.
//
// ⚠️ POR QUÉ NO VALE UN NONCE (descripción del ticket): el XSS de SCRUM-1632c metía un trozo de la URL
// DENTRO de un `<script>` legítimo; con nonce, ese script lleva el nonce y la inyección corre igual. Lo
// que protege es que NINGÚN DATO viaje dentro de código: los datos van en un bloque
// `application/json` (no se ejecuta) y el código, sin un solo dato, en un fichero servido desde 'self'.
//
// Por la PUERTA: las páginas se piden al router de verdad (`dist`) con la base doblada, y el JS que
// cargan se pide al MISMO router por la `src` que pinta el HTML. ⛔ Sin red ni base.
process.env.WHATSAPP_DRY_RUN = '1';
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } from './_envio-doblado.mjs';
import { bancoDelParte, TOKEN_PARTE, CLIENTE_DEL_PARTE } from './_banco-firma-del-parte.mjs';
import { censoCsp, riesgosDelCodigo, elementosDe, navegadorDelParte, datosDe, textoDe } from './_navegador-del-parte.mjs';

const RUTA = '../dist/modules/jobs/app/routes/albaranPublic.routes.js';

/** Pide al router del parte una ruta GET cualquiera y devuelve estado, cabeceras y cuerpo. */
async function pedirAlRouter(ruta, query = {}) {
  const router = moduloDeDist(RUTA).default;
  const [camino] = ruta.split('?');
  const capa = router.stack.find((l) => l.route && l.route.methods.get && l.route.path === camino);
  if (!capa) return { status: 404, cabeceras: {}, cuerpo: '' };
  const r = { status: 200, cabeceras: {}, cuerpo: '' };
  const res = {
    status(s) { r.status = s; return res; },
    setHeader(k, v) { r.cabeceras[k.toLowerCase()] = v; return res; },
    type(t) { r.cabeceras['content-type'] = t; return res; },
    send(b) { r.cuerpo = String(b); return res; },
  };
  await capa.route.stack[capa.route.stack.length - 1].handle({ params: {}, query, headers: {}, ip: '127.0.0.1', socket: {} }, res);
  return r;
}

/** El texto de cada `<script src>` de la página, pedido al router por esa misma `src`. */
async function servidosDe(html) {
  const out = [];
  for (const s of elementosDe(html).filter((e) => e.tag === 'script' && e.attr('src'))) {
    const url = new URL(s.attr('src'), 'https://yaqu.app');
    assert.ok(url.pathname.startsWith('/albaran/'), `la página carga un JS que no sirve este router: ${s.attr('src')}`);
    const r = await pedirAlRouter(url.pathname.slice('/albaran'.length), Object.fromEntries(url.searchParams));
    assert.equal(r.status, 200, `CIEGO: la página carga ${s.attr('src')} y el router no lo sirve`);
    out.push(r.cuerpo);
  }
  return out;
}

// ── El instrumento, primero: con lo que la CSP bloquea delante, lo ve ────────────────────────────
test('SCRUM-1646 · control · el censo ve cada cosa que la CSP bloquearía, y no confunde datos con código', () => {
  const sucia = `<!doctype html><html><body>
    <!-- <script>esto es un comentario</script> -->
    <div class="card" data-x='a>b'>
      <button id="b" onclick="hola()">x</button>
      <script>document.querySelector('.card').innerHTML='<button onclick="location.reload()">r</button>';</script>
      <script type="application/json" id="d">{"t":"\\u003c/script><script>alert(1)\\u003c/script>"}</script>
      <script src="/albaran/js/firma.js?v=1"></script>
      <script>eval('1'); setTimeout('2', 0); new Function('3'); el.insertAdjacentHTML('beforeend', 'x'); document.write('y');</script>
    </div></body></html>`;
  const c = censoCsp(sucia);
  assert.equal(c.scripts.length, 4, 'el comentario no es un <script>, y los cuatro de verdad sí');
  assert.equal(c.enLinea, 2, 'el de datos y el de src NO son en línea; los otros dos sí');
  assert.deepEqual(c.manejadores, ['<button onclick>']);
  assert.deepEqual(c.enCodigo.map((s) => s.split(' ')[0]),
    ['innerHTML', 'eval', 'setTimeout(\'…\')', 'Function', 'insertAdjacentHTML()', 'write()']);
  // Un JS sin nada de eso, limpio.
  assert.deepEqual(riesgosDelCodigo('var a=document.createElement("b"); a.textContent="<i onclick=x>"; setTimeout(function(){},0);'), []);
});

// ── 1 · aceptación 1 del ticket: 0 `on*=` y 0 `<script>` sin `src`, en las tres caras de la página ──
async function caraLimpia(cara, estado, señal) {
  const { status, cuerpo } = await bancoDelParte({ estado }).pagina();
  assert.equal(status, 200);
  assert.ok(cuerpo.includes(señal), `CIEGO: no es la página «${cara}»`);
  const c = censoCsp(cuerpo, await servidosDe(cuerpo));
  assert.deepEqual({ enLinea: c.enLinea, manejadores: c.manejadores, enCodigo: c.enCodigo },
    { enLinea: 0, manejadores: [], enCodigo: [] },
    `🔴 con la CSP aplicada, esto no correría en el móvil del cliente:\n${JSON.stringify(c, (k, v) => (k === 'scripts' ? undefined : v), 2)}`);
}
test('🔴 SCRUM-1646 · la página del parte «para firmar» no lleva nada que la CSP bloquee',
  () => caraLimpia('para firmar', 'emitido', 'Firmar el parte de trabajo'));
test('🔴 SCRUM-1646 · la página del parte «ya firmado» no lleva nada que la CSP bloquee',
  () => caraLimpia('ya firmado', 'firmado', 'Este parte de trabajo ya está firmado.'));
test('🔴 SCRUM-1646 · la página del parte «aún no listo» no lleva nada que la CSP bloquee',
  () => caraLimpia('aún no listo', 'borrador', 'aún no está listo para firmar'));

// ── 2 · el JS que se carga: desde 'self', con huella, y sin un solo dato dentro ─────────────────
test('SCRUM-1646 · el guion se sirve desde el propio servidor, con huella, y la huella cuadra', async () => {
  const { cuerpo } = await bancoDelParte().pagina();
  const srcs = elementosDe(cuerpo).filter((e) => e.tag === 'script' && e.attr('src')).map((e) => e.attr('src'));
  assert.equal(srcs.length, 1, `CIEGO: la página de firma tendría que cargar UN guion y carga ${srcs.length}`);
  const url = new URL(srcs[0], 'https://yaqu.app');
  assert.equal(url.origin + url.pathname, 'https://yaqu.app/albaran/js/firma.js', 'ruta relativa a este mismo servidor');
  const v = url.searchParams.get('v');
  assert.match(v || '', /^[0-9a-f]{10}$/, 'la src lleva la huella del contenido');

  const conHuella = await pedirAlRouter('/js/firma.js', { v });
  assert.equal(conHuella.status, 200);
  assert.match(conHuella.cabeceras['content-type'] || '', /javascript/);
  assert.match(conHuella.cabeceras['cache-control'] || '', /immutable/, 'con la huella buena, la URL no puede cambiar de contenido');
  // Y sin huella, o con una vieja, NO se promete nada: un deploy nuevo no puede servirse viejo.
  for (const q of [{}, { v: '0000000000' }]) {
    const r = await pedirAlRouter('/js/firma.js', q);
    assert.equal(r.cuerpo, conHuella.cuerpo);
    assert.doesNotMatch(r.cabeceras['cache-control'] || '', /immutable|max-age=[1-9]/, `sin la huella buena no se cachea (${JSON.stringify(q)})`);
  }
  // Ni el token ni el nombre del cliente viajan dentro del código: van en los datos.
  assert.ok(!conHuella.cuerpo.includes(TOKEN_PARTE), '🔴 el token del parte está dentro del JS');
  assert.ok(!conHuella.cuerpo.includes(CLIENTE_DEL_PARTE), '🔴 el nombre del cliente está dentro del JS');
});

// ── 3 · y SIGUE FUNCIONANDO: el mismo recorrido de antes, ejecutando el guion servido ──────────────
async function abrir(responder, estado = 'emitido') {
  const { cuerpo } = await bancoDelParte({ estado }).pagina();
  const [js] = await servidosDe(cuerpo);
  return { cuerpo, nav: navegadorDelParte(cuerpo, js, responder) };
}

test('SCRUM-1646 · firmar manda lo mismo que antes: trazo, versión pintada y los tres datos del firmante', async () => {
  const { nav } = await abrir(async () => ({ ok: true, json: async () => ({ ok: true }) }));
  await nav.firmar();
  assert.equal(nav.peticiones.length, 0, 'sin trazo no sale nada');
  assert.equal(nav.el('sig-error').textContent, 'Dibuja tu firma para continuar.');
  await nav.trazar();
  await nav.firmar();
  assert.equal(nav.peticiones.length, 1);
  const [p] = nav.peticiones;
  assert.equal(p.url, `/albaran/${TOKEN_PARTE}/firmar`);
  assert.equal(p.init.method, 'POST');
  assert.deepEqual(p.cuerpo, {
    signatureData: 'data:image/png;base64,SONDA1646', version: 3,
    firmadoPorNombre: CLIENTE_DEL_PARTE, firmadoPorCalidad: '', firmadoPorCalidadOtro: '',
  });
  const caja = nav.card().children[0];
  assert.equal(caja.children.find((n) => n.tagName === 'H1')?.textContent, '¡Parte firmado!');
  assert.equal(caja.children.find((n) => n.className === 'meta')?.textContent, `Gracias, ${CLIENTE_DEL_PARTE}.`);
});

test('SCRUM-1646 · con el portal en la respuesta, se pinta su enlace; con uno que no es http(s), no', async () => {
  for (const [portalUrl, sale] of [['https://yaqu.app/cliente/abc', true], ['javascript:alert(1)', false]]) {
    const { nav } = await abrir(async () => ({ ok: true, json: async () => ({ ok: true, portalUrl }) }));
    await nav.trazar(); await nav.firmar();
    const a = nav.card().children[0].children.find((n) => n.tagName === 'A');
    assert.equal(Boolean(a), sale, portalUrl);
    if (a) { assert.equal(a.href, portalUrl); assert.equal(a.textContent, 'Abrir mi portal de cliente'); }
  }
});

test('🔴 SCRUM-1646 · «el parte cambió»: el botón recarga por addEventListener, sin onclick', async () => {
  const { nav } = await abrir(async () => ({ ok: false, json: async () => ({ error: 'albaran_cambiado' }) }));
  await nav.trazar(); await nav.firmar();
  const aviso = nav.card().children[0];
  assert.equal(aviso.className, 'status-aviso');
  const boton = aviso.children.find((n) => n.tagName === 'BUTTON');
  assert.ok(boton, 'CIEGO: no hay botón en el aviso');
  assert.equal(boton.textContent, 'Ver la versión actual');
  assert.ok(!('onclick' in boton) || boton.onclick == null, 'nada de onclick');
  assert.equal(nav.recargas(), 0);
  await boton.disparar('click');
  assert.equal(nav.recargas(), 1, '🔴 el botón «Ver la versión actual» no recarga');
});

test('SCRUM-1646 · el firmante: «Otro» abre su campo y cambiar de calidad borra el nombre PRECARGADO', async () => {
  const { nav } = await abrir(async () => ({ ok: true, json: async () => ({}) }));
  const sel = nav.el('firmante-calidad');
  const nom = nav.el('firmante-nombre');
  assert.equal(nom.value, CLIENTE_DEL_PARTE, 'CIEGO: el nombre no viene precargado');
  sel.value = 'otro'; await sel.disparar('change');
  assert.equal(nav.el('firmante-otro-wrap').style.display, '');
  assert.equal(nom.value, '', '🔴 SCRUM-300: el nombre precargado sigue ahí declarando a otra persona');
  // Lo tecleado a mano NO se toca.
  nom.value = 'Juan Vecino'; await nom.disparar('input');
  sel.value = 'familiar_o_conviviente'; await sel.disparar('change');
  assert.equal(nom.value, 'Juan Vecino');
  assert.equal(nav.el('firmante-otro-wrap').style.display, 'none');
});

// ── 4 · un dato hostil no sale del bloque de datos ───────────────────────────────────────────────
test('🔴 SCRUM-1646 · un nombre de cliente con «</script>» se queda en los datos, intacto', async () => {
  const HOSTIL = '</script><script>alert(1646)</script><!--';
  const TOKEN = 'e'.repeat(32);
  inyectarBase({
    'albaran.findUnique': ({ where }) => (where.firmaToken === TOKEN ? {
      id: 1646, merchantId: MERCHANT, jobId: 77, numero: 'PT-1646', estado: 'emitido', version: 1, firmaToken: TOKEN,
      lineas: [{ concepto: 'Revisión', cantidad: 1, unidad: 'ud' }], modoValoracion: 'SIN_VALORAR', ocultarPreciosEnDocumento: false,
    } : null),
    'job.findUnique': () => ({ id: 77, customerId: CLIENTE, titulo: 'Obra', direccion: null }),
    'customer.findUnique': () => ({ id: CLIENTE, name: HOSTIL }),
    'merchant.findUnique': () => ({ id: MERCHANT, name: 'Fontanería & Hijos <3', legalName: null, country: 'ES', logoUrl: null, email: null }),
  }, [RUTA]);
  const capa = moduloDeDist(RUTA).default.stack.find((l) => l.route?.path === '/:token' && l.route.methods.get);
  let cuerpo = '';
  const res = { status() { return res; }, setHeader() { return res; }, send(b) { cuerpo = String(b); return res; } };
  await capa.route.stack.at(-1).handle({ params: { token: TOKEN }, headers: {}, ip: '127.0.0.1', socket: {} }, res);
  assert.ok(cuerpo.includes('PT-1646'), 'CIEGO: no es la página de este parte');
  const c = censoCsp(cuerpo, await servidosDe(cuerpo));
  assert.deepEqual([c.enLinea, c.manejadores, c.enCodigo], [0, [], []], '🔴 el nombre hostil ha creado código en la página');
  assert.equal(c.scripts.length, 2, '🔴 el nombre hostil ha abierto o cerrado un <script>');
  const datos = datosDe(cuerpo);
  assert.equal(datos.textos.firmadoGracias, `Gracias, ${HOSTIL}.`, 'el nombre llega entero a la pantalla de gracias, como texto');
  assert.ok(datos.textos.portalLinea.endsWith('con Fontanería & Hijos <3.'));
  // Y la pantalla de gracias lo pone como TEXTO: ni un nodo nace de él.
  const [js] = await servidosDe(cuerpo);
  const nav = navegadorDelParte(cuerpo, js, async () => ({ ok: true, json: async () => ({}) }));
  await nav.trazar(); await nav.firmar();
  assert.equal(textoDe(nav.card().children[0].children.find((n) => n.className === 'meta')), `Gracias, ${HOSTIL}.`);
});
