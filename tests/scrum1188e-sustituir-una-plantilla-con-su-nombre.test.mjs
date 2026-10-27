// SCRUM-1188e (parte C) · UNA PLANTILLA NO SE PODÍA EDITAR: SÓLO RENOMBRAR O BORRAR.
//
// Para subirle un precio había que usarla en un presupuesto nuevo, cambiar el precio, guardarla
// como plantilla NUEVA y borrar la vieja. Y guardar dos veces con el mismo nombre dejaba dos
// plantillas iguales de nombre (el `POST` no mira duplicados).
//
// Lo que se construye (Jira SCRUM-1188, c.18609): en la hoja «Guardar plantilla» que ya existe,
// si el nombre escrito es el de una plantilla que YA tiene, se pregunta y, si dice que sí, sale un
// `PUT /admin/templates/:id` con `currency`, `lines` y `paymentTerms` en vez de un `POST`.
//
// Se mide EL VIAJE con un servidor en memoria que aplica la MISMA regla que `templates.routes.ts`
// después de SCRUM-1188c: en el `PUT`, `name`/`currency`/`lines`/`tiers` ignoran `null`, y
// `paymentTerms` se escribe si la clave VIAJA (aunque sea `null`: la vacía).
//
// 🔴 El caso que decide: sustituir una plantilla 50/50 desde un presupuesto «Personalizado». Si el
// `PUT` no llevara `paymentTerms: null`, el 50/50 viejo se quedaría guardado debajo del aviso
// firmado que dice «guardada sin el plan de cobro».
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const respirar = () => new Promise((r) => setTimeout(r, 80));

const PREGUNTA = (nombre) => `Ya tienes una plantilla llamada "${nombre}". ¿Quieres sustituirla? Esta acción no se puede deshacer.`;
const ACTUALIZADA = (nombre) => `Plantilla "${nombre}" actualizada.`;
// Firmado en SCRUM-1188 c.17332 (parte A). Aquí sólo se comprueba que al SUSTITUIR sale el mismo.
const SIN_PLAN = (nombre) => `Plantilla "${nombre}" guardada sin el plan de cobro. Los tramos de un plan personalizado no se guardan en las plantillas: al usarla, elige el cobro en el presupuesto.`;

const texto = (n) => {
  const t = String((n && n.textContent) || '');
  if (t) return t;
  return (n && n._html && !/</.test(n._html)) ? String(n._html) : '';
};
const boton = (raiz, re) => todos(raiz).find((x) => x.tagName === 'BUTTON' && re.test(texto(x).trim()));
const hojas = (b) => todos(b.ctx.document.body).filter((x) => String(x.className || '').includes('modal-overlay'));

/** Pulsa como un navegador: oyentes de `addEventListener` Y el `onclick` de propiedad (ver scrum600g). */
async function pulsar(n) {
  n.disparar('click');
  if (typeof n.onclick === 'function') await n.onclick.call(n, { type: 'click', target: n, preventDefault() {} });
  await respirar();
}

/** Servidor de plantillas en memoria con la regla de `templates.routes.ts` (POST y PUT tras 1188c). */
function servidor() {
  const guardadas = [];
  const peticiones = [];
  const estado = { listaCaida: false, reloj: 0 };
  const responder = (status, cuerpo) => ({ ok: status < 400, status, headers: { get: () => 'application/json' }, json: async () => cuerpo, text: async () => JSON.stringify(cuerpo) });
  const fetch = async (url, opts) => {
    const u = String(url);
    const metodo = (opts && opts.method) || 'GET';
    peticiones.push({ metodo, url: u, cuerpo: opts && opts.body });
    const conId = u.match(/\/admin\/templates\/(\d+)$/);
    if (/\/admin\/templates$/.test(u) && metodo === 'POST') {
      const b = JSON.parse(opts.body);
      const fila = { id: guardadas.length + 1, name: b.name, currency: b.currency, lines: b.lines, tiers: b.tiers ?? null, paymentTerms: b.paymentTerms ?? null, updatedAt: ++estado.reloj };
      guardadas.push(fila);
      return responder(201, fila);
    }
    if (conId && metodo === 'PUT') {
      const fila = guardadas.find((g) => g.id === Number(conId[1]));
      if (!fila) return responder(404, { error: 'not_found' });
      const b = JSON.parse(opts.body);
      if (b.name != null) fila.name = String(b.name).trim();
      if (b.currency != null) fila.currency = String(b.currency).slice(0, 3).toUpperCase();
      if (b.lines != null) fila.lines = b.lines;
      if (b.tiers != null) fila.tiers = b.tiers;
      if (b.paymentTerms !== undefined) fila.paymentTerms = b.paymentTerms;
      fila.updatedAt = ++estado.reloj;
      return responder(200, fila);
    }
    if (/\/admin\/templates$/.test(u)) {
      if (estado.listaCaida) return responder(500, { error: 'internal_error' });
      // Como el servidor: de la más reciente a la más antigua.
      return responder(200, JSON.parse(JSON.stringify([...guardadas].sort((a, b) => b.updatedAt - a.updatedAt))));
    }
    if (/\/admin\/customers/.test(u)) return responder(200, []);
    if (/\/admin\/merchant/.test(u)) return responder(200, { id: 1, name: 'Taller', defaultCurrency: 'EUR', country: 'ES' });
    return responder(200, {});
  };
  const escrituras = () => peticiones.filter((p) => p.metodo !== 'GET' && /\/admin\/templates/.test(p.url));
  return { guardadas, peticiones, estado, fetch, escrituras };
}

async function montar(srv, { acepta = true } = {}) {
  const red = { navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } }, fetch: srv.fetch };
  const b = cargarDashboard(RAIZ, { red });
  b.ctx.appDocumentoSuelto = 'no';
  b.ctx.appMerchantId = 1;
  b.ctx.renderAppView = () => {};
  const preguntas = [];
  b.ctx.confirm = (t) => { preguntas.push(String(t)); return acepta; };
  const r = await pintarVista(b, 'renderQuotesView', null, false);
  assert.equal(r.error, null, `🔴 SUELO: el editor no monta: ${r.error && r.error.message}`);
  await respirar(); // las fichas rápidas se pintan después de pedir las plantillas
  const condiciones = todos(r.contenedor).find((x) => x.tagName === 'SELECT' && x.name === 'payment_terms');
  assert.ok(condiciones, '🔴 SUELO: el editor no monta el selector de condiciones de pago');
  return { b, contenedor: r.contenedor, condiciones, preguntas };
}

const conceptos = (contenedor) => todos(contenedor).filter((x) => x.tagName === 'INPUT' && x.placeholder === 'Concepto / servicio');

function teclearLinea(contenedor, precio) {
  const c = conceptos(contenedor);
  const numeros = todos(contenedor).filter((x) => x.tagName === 'INPUT' && x.type === 'number');
  assert.ok(c.length >= 1 && numeros.length >= 2, '🔴 SUELO: no se encuentran los campos de la primera línea');
  c[0].value = 'Revisión de caldera';
  numeros[0].value = '1';
  numeros[1].value = String(precio);
}

function elegir(select, valor) {
  select.value = valor;
  select.disparar('change');
}

/** Abre la hoja, escribe el nombre y pulsa «Guardar plantilla». Devuelve la hoja (puede seguir abierta). */
async function guardarComoPlantilla(m, nombre, precio) {
  teclearLinea(m.contenedor, precio);
  const mas = todos(m.contenedor).find((x) => x.tagName === 'BUTTON' && x._attrs && x._attrs['aria-label'] === 'Más acciones');
  assert.ok(mas, '🔴 SUELO: no está el menú «⋯» donde vive «Guardar como plantilla»');
  mas.disparar('click');
  const menu = todos(m.b.ctx.document.body).find((x) => x._attrs && x._attrs.role === 'menu');
  const guardar = menu && boton(menu, /^💾 Guardar como plantilla$/);
  assert.ok(guardar, '🔴 SUELO: no está «💾 Guardar como plantilla»');
  await pulsar(guardar);
  const hoja = hojas(m.b).at(-1);
  assert.ok(hoja, '🔴 SUELO: «Guardar como plantilla» no abre su hoja');
  hoja.querySelector('#tpl-name-input').value = nombre;
  await pulsar(hoja.querySelector('#save-tpl-btn'));
  return hoja;
}

function alertaVisible(m) {
  const cajas = todos(m.contenedor).filter((x) => /(^|\s)alert(\s|$)/.test(String(x.className || '')) && x.style && x.style.display === 'block');
  assert.equal(cajas.length, 1, '🔴 SUELO: tras guardar no queda UNA alerta a la vista');
  return { texto: texto(cajas[0]).trim(), clase: String(cajas[0].className) };
}

/** Deja en el servidor la plantilla «Caldera» a 90 con la condición dada, guardada desde el editor. */
async function sembrarCaldera(srv, condicion = 'FIFTY_FIFTY') {
  const m = await montar(srv);
  elegir(m.condiciones, condicion);
  await guardarComoPlantilla(m, 'Caldera', 90);
  assert.equal(srv.guardadas.length, 1, '🔴 SUELO: la plantilla de partida no llegó al servidor');
  assert.equal(srv.guardadas[0].lines[0].price, 90, '🔴 SUELO: la plantilla de partida no lleva el precio tecleado');
  assert.equal(srv.guardadas[0].paymentTerms, condicion, '🔴 SUELO: la plantilla de partida no lleva su condición');
  assert.deepEqual(m.preguntas, [], '🔴 un nombre que NO existe todavía no pregunta nada');
  srv.peticiones.length = 0;
}

test('SCRUM-1188e · 🔴 guardar con el nombre de una plantilla que ya tiene la SUSTITUYE (PUT), previa pregunta, y no crea otra', async () => {
  const srv = servidor();
  await sembrarCaldera(srv);
  const m = await montar(srv);
  elegir(m.condiciones, 'MANUAL');
  await guardarComoPlantilla(m, 'Caldera', 120);

  assert.deepEqual(m.preguntas, [PREGUNTA('Caldera')], '🔴 no se pregunta antes de sustituir, o se pregunta con otro texto');
  const esc = srv.escrituras();
  assert.equal(esc.length, 1, `🔴 se esperaba UNA escritura y hay ${esc.length}: ${esc.map((e) => e.metodo).join(', ')}`);
  assert.equal(esc[0].metodo, 'PUT', '🔴 con un nombre que ya existe se sigue creando otra plantilla (POST)');
  assert.match(esc[0].url, /\/admin\/templates\/1$/, '🔴 el PUT no va a la plantilla que lleva ese nombre');
  const cuerpo = JSON.parse(esc[0].cuerpo);
  assert.deepEqual(Object.keys(cuerpo).sort(), ['currency', 'lines', 'paymentTerms'],
    '🔴 el cuerpo del PUT no es {currency, lines, paymentTerms}: `name` no viaja (no se renombra) y `tiers` tampoco (no se toca)');

  assert.equal(srv.guardadas.length, 1, '🔴 han quedado dos plantillas con el mismo nombre');
  assert.equal(srv.guardadas[0].lines[0].price, 120, '🔴 la plantilla conserva el precio viejo');
  assert.equal(srv.guardadas[0].paymentTerms, 'MANUAL', '🔴 la plantilla conserva la condición de cobro vieja');
  assert.equal(srv.guardadas[0].name, 'Caldera');

  const a = alertaVisible(m);
  assert.equal(a.texto, ACTUALIZADA('Caldera'), '🔴 tras sustituir no sale el texto de «actualizada»');
  assert.match(a.clase, /success/);
  assert.equal(hojas(m.b).length, 0, '🔴 la hoja sigue abierta después de sustituir');
});

test('SCRUM-1188e · 🔴 si dice que NO, no se escribe nada y la hoja sigue abierta para cambiar el nombre', async () => {
  const srv = servidor();
  await sembrarCaldera(srv);
  const m = await montar(srv, { acepta: false });
  const hoja = await guardarComoPlantilla(m, 'Caldera', 120);

  assert.deepEqual(m.preguntas, [PREGUNTA('Caldera')]);
  assert.deepEqual(srv.escrituras(), [], '🔴 dijo que no y aun así se escribió en el servidor');
  assert.equal(srv.guardadas[0].lines[0].price, 90, '🔴 dijo que no y la plantilla ha cambiado');
  assert.equal(hojas(m.b).length, 1, '🔴 dijo que no y la hoja se cerró: pierde el nombre escrito');
  const btn = hoja.querySelector('#save-tpl-btn');
  assert.equal(btn.disabled, false, '🔴 el botón se queda desactivado: no puede volver a intentarlo con otro nombre');
  assert.equal(texto(btn).trim(), 'Guardar plantilla', '🔴 el botón se queda en «Guardando…»');
  assert.equal(hoja.querySelector('#tpl-name-input').value, 'Caldera', 'el nombre escrito sigue ahí');
});

test('SCRUM-1188e · 🔴 sustituir una 50/50 desde «Personalizado» VACÍA su cobro (paymentTerms:null viaja) y sale el aviso firmado', async () => {
  const srv = servidor();
  await sembrarCaldera(srv, 'FIFTY_FIFTY');
  const m = await montar(srv);
  elegir(m.condiciones, 'CUSTOM');
  await guardarComoPlantilla(m, 'Caldera', 120);

  const esc = srv.escrituras();
  assert.equal(esc.length, 1);
  assert.equal(esc[0].metodo, 'PUT');
  const cuerpo = JSON.parse(esc[0].cuerpo);
  assert.ok(Object.prototype.hasOwnProperty.call(cuerpo, 'paymentTerms') && cuerpo.paymentTerms === null,
    '🔴 `paymentTerms` no viaja a null: el servidor no tocaría el cobro guardado');
  assert.equal(srv.guardadas[0].paymentTerms, null,
    '🔴 la plantilla conserva el 50/50 viejo mientras el aviso dice «guardada sin el plan de cobro»');
  const a = alertaVisible(m);
  assert.equal(a.texto, SIN_PLAN('Caldera'), '🔴 al sustituir desde un plan personalizado no sale el aviso firmado (c.17332)');
  assert.doesNotMatch(a.clase, /success/, 'no es un éxito a secas: algo NO se guardó');
});

test('SCRUM-1188e · «mismo nombre» no cuenta mayúsculas ni espacios de los bordes, y los textos llevan el nombre GUARDADO', async () => {
  const srv = servidor();
  await sembrarCaldera(srv);
  const m = await montar(srv);
  await guardarComoPlantilla(m, '  caldera ', 120);

  assert.deepEqual(m.preguntas, [PREGUNTA('Caldera')], '🔴 «caldera» y «Caldera» se tratan como dos plantillas, o la pregunta lleva el nombre tecleado');
  assert.equal(srv.guardadas.length, 1);
  assert.equal(srv.guardadas[0].name, 'Caldera', '🔴 sustituir ha renombrado la plantilla');
  assert.equal(alertaVisible(m).texto, ACTUALIZADA('Caldera'));
});

test('SCRUM-1188e · CONTROL: con un nombre que no tiene, se crea como siempre (POST), sin preguntar', async () => {
  const srv = servidor();
  await sembrarCaldera(srv);
  const m = await montar(srv);
  await guardarComoPlantilla(m, 'Caldera de gasoil', 120);

  assert.deepEqual(m.preguntas, [], '🔴 se pregunta por sustituir con un nombre que no existe');
  const esc = srv.escrituras();
  assert.deepEqual(esc.map((e) => e.metodo), ['POST']);
  assert.equal(srv.guardadas.length, 2);
  assert.equal(srv.guardadas[0].lines[0].price, 90, '🔴 crear otra ha tocado la que ya había');
  assert.match(alertaVisible(m).texto, /^Plantilla "Caldera de gasoil" guardada\. /);
});

test('SCRUM-1188e · 🔴 si la lista de plantillas no se puede leer NO se guarda a ciegas: ni POST ni PUT, y lo dice en la hoja', async () => {
  const srv = servidor();
  await sembrarCaldera(srv);
  const m = await montar(srv);
  srv.estado.listaCaida = true; // a partir de aquí el GET de la lista da 500
  const hoja = await guardarComoPlantilla(m, 'Caldera', 120);

  assert.deepEqual(srv.escrituras(), [], '🔴 sin poder mirar si el nombre existe, se ha escrito igual: «no pude mirar» se leyó como «no hay»');
  assert.deepEqual(m.preguntas, []);
  assert.equal(hojas(m.b).length, 1, 'la hoja sigue abierta');
  const aviso = hoja.querySelector('#save-tpl-alert');
  assert.equal(texto(aviso).trim(), 'Error al guardar la plantilla.');
  assert.match(String(aviso.className), /error/);
  assert.equal(hoja.querySelector('#save-tpl-btn').disabled, false, 'puede reintentar');
});

test('SCRUM-1188e · 🔴 tras sustituir, la ficha rápida de esa plantilla carga el precio NUEVO, no el de cuando se abrió el editor', async () => {
  const srv = servidor();
  await sembrarCaldera(srv);
  const m = await montar(srv);
  await guardarComoPlantilla(m, 'Caldera', 120);
  assert.equal(srv.guardadas[0].lines[0].price, 120, '🔴 SUELO: la sustitución no llegó al servidor');
  await respirar(); // las fichas se vuelven a pedir

  const ficha = todos(m.contenedor).find((x) => x.tagName === 'BUTTON'
    && String(x.className || '').includes('quote-plantilla-chip')
    && todos(x).some((h) => texto(h).trim() === 'Caldera'));
  assert.ok(ficha, '🔴 tras sustituir, la plantilla ya no sale como ficha rápida');
  const antes = conceptos(m.contenedor).length;
  await pulsar(ficha);
  assert.equal(conceptos(m.contenedor).length, antes + 1, '🔴 SUELO: la ficha no ha añadido su línea');
  // La línea añadida es la última: su precio es el segundo número de esa fila (cantidad, precio).
  const filas = todos(m.contenedor).filter((x) => String(x.className || '').split(/\s+/).includes('quote-line'));
  const ultima = filas.at(-1);
  assert.ok(ultima, '🔴 SUELO: no se encuentra la fila de la línea añadida');
  const precio = ultima.querySelector('.quote-line__price input');
  assert.ok(precio, '🔴 SUELO: la línea añadida no tiene campo de precio');
  assert.equal(Number(String(precio.value).replace(',', '.')), 120,
    '🔴 la ficha rápida sigue cargando el precio VIEJO de la plantilla recién sustituida');
});
