// tests/scrum1426-parte-firma-guardada-en-el-movil.test.mjs — SCRUM-1426
//
// Se firma un parte sin red: la firma queda en la cola del móvil. Hasta hoy la ficha del parte se
// veía IGUAL que si nadie hubiera firmado — sin decir que hay una firma guardada, diciendo que
// «falta», y dejando firmar otra vez encima sin avisar. Es lo que SCRUM-1353 arregló en el albarán.
//
// FIRMADO (SCRUM-1426 comentario 18232):
//   · la caja del albarán TAL CUAL («Solo en este móvil» / «La firma está guardada solo en este
//     móvil. Si lo pierdes, se pierde.»), DENTRO de la caja de la firma a la que pertenece;
//   · la pregunta antes de reemplazar, con dos variantes (cliente / técnico);
//   · «Falta la firma del …» no sale mientras ESA firma esté guardada en el móvil.
//
// La cola guarda una entrada por documento Y tipo (`firma:parte:<id>`, `firma:parte-tecnico:<id>`).
// Vista, cola y almacén son los reales; el pad es fingido (el mismo de SCRUM-1422).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { montarAlmacen, porQueEstariaCiego } from './_banco-almacen-local.mjs';
import { todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ID = 7;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const TRAZO = 'data:image/png;base64,' + 'A'.repeat(300);
const FIRMA = { signatureData: 'data:image/png;base64,AAAA', firmadoPorNombre: 'X' };

const ETIQUETA = 'Solo en este móvil';
const DETALLE = 'La firma está guardada solo en este móvil. Si lo pierdes, se pierde.';
const PREGUNTA = {
  cliente: 'Ya hay una firma del cliente de este parte guardada en este móvil. Si firmas otra vez, la nueva sustituye a la anterior.',
  tecnico: 'Ya hay una firma del técnico de este parte guardada en este móvil. Si firmas otra vez, la nueva sustituye a la anterior.',
};
const TIPO = { cliente: 'parte', tecnico: 'parte-tecnico' };
const SELECTOR = { cliente: '[data-parte-firmar]', tecnico: '[data-parte-firmar-tecnico]' };

const parteDelServidor = (e) => ({
  id: ID, numero: 'PT-2026-001', clienteNombre: 'Comunidad Los Olivos',
  fecha: '2026-09-16T08:00:00.000Z', obra: 'C/ Mayor 3', referencia: null,
  entrada: null, salida: null, desplazamientos: null, kilometros: null, tecnicos: [],
  tipo: 'reparacion_asistencia', notas: null, estado: e.firmoElCliente || e.firmoElTecnico ? 'firmado' : 'borrador',
  lineas: [{ bloque: 'mano_obra', unds: 2, descripcion: 'Revisión de caldera' }],
  firmoElCliente: e.firmoElCliente, firmadoPorNombre: e.firmoElCliente ? 'Ana Ruiz' : null,
  firmoElTecnico: e.firmoElTecnico, firmadoTecnicoNombre: e.firmoElTecnico ? 'Ana Ruiz' : null,
  puedeEditarContenido: { ok: true, motivo: null },
  puedeEditarPrecios: { ok: true, motivo: null },
});

function nuevaRed() {
  const e = { conRed: true, firmoElCliente: false, firmoElTecnico: false };
  const responder = (status, data) => ({
    ok: status >= 200 && status < 300, status, statusText: String(status),
    headers: { get: () => 'application/json' },
    json: async () => data, blob: async () => ({}), text: async () => JSON.stringify(data),
  });
  e.fetch = async (url, opts) => {
    const u = String(url);
    const metodo = (opts && opts.method) || 'GET';
    if (!e.conRed) throw new TypeError('Failed to fetch');
    if (metodo === 'GET') return responder(200, /\/admin\/partes\/\d+$/.test(u) ? parteDelServidor(e) : {});
    if (new RegExp(`/admin/partes/${ID}/firmar$`).test(u)) e.firmoElCliente = true;
    if (new RegExp(`/admin/partes/${ID}/firmar-tecnico$`).test(u)) e.firmoElTecnico = true;
    return responder(200, { id: ID, estado: 'firmado' });
  };
  e.navigator = { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } };
  return e;
}

/** El pad fingido de SCRUM-1422: deja `[data-sp-aviso]` y, al cerrarse, lo quita y llama a `onClose`. */
function padFingido(b) {
  const pad = { opts: null, abierto: false, nodo: null, aperturas: 0 };
  pad.abrir = (opts) => {
    pad.opts = opts; pad.abierto = true; pad.aperturas += 1;
    pad.nodo = b.ctx.document.createElement('p');
    pad.nodo.setAttribute('data-sp-aviso', '');
    b.ctx.document.body.appendChild(pad.nodo);
    return { close: () => pad.cerrar(false) };
  };
  pad.cerrar = (confirmada) => {
    if (!pad.abierto) return;
    pad.abierto = false;
    pad.nodo.remove();
    if (typeof pad.opts.onClose === 'function') pad.opts.onClose({ confirmada: !!confirmada });
  };
  pad.confirmar = async () => {
    try { await pad.opts.onConfirm(TRAZO, { firmadoPorNombre: 'Ana Ruiz' }); } catch (e) { return (e && e.message) || ''; }
    pad.cerrar(true);
    return null;
  };
  return pad;
}

function montar() {
  const red = nuevaRed();
  const b = montarAlmacen(RAIZ, { dashboard: { red } });
  const ciego = porQueEstariaCiego(b, RAIZ);
  assert.equal(ciego, null, `🔴 BANCO CIEGO: ${ciego}`);
  for (const n of ['renderParteDetailView', 'encolarFirma', 'leerFirmasPendientes', 'drenarAlAbrir', 'pintarEstadoDeFirma']) {
    assert.equal(typeof b.ctx[n], 'function', `🔴 BANCO CIEGO: el dashboard no publica \`${n}\``);
  }
  const avisos = { acepta: true, preguntas: [] };
  b.ctx.confirm = (texto) => { avisos.preguntas.push(String(texto)); return avisos.acepta; };
  return { b, red, pad: padFingido(b), avisos };
}

async function abrirFicha(b, pad) {
  const cont = b.mk('div');
  assert.equal(await b.ctx.renderParteDetailView(cont, ID, { abrirPad: pad.abrir }), true, '🔴 SUELO: la ficha del parte no se ha pintado');
  return cont;
}

const texto = (n) => todos(n).filter((x) => x.tagName === '#text' || !x.hijos?.length)
  .map((x) => x.textContent || '').join(' ').replace(/\s+/g, ' ').trim();
const conAtributo = (n, nombre, valor) => todos(n).filter((x) => x.getAttribute && x.getAttribute(nombre) === valor);

/** Lo que la ficha dice de cada firma: si hay caja de «guardada» y con qué texto, si dice «falta», si ofrece firmar. */
function loQueDice(cont) {
  const de = (quien) => {
    const cajas = conAtributo(cont, 'data-parte-caja-firma', quien);
    assert.equal(cajas.length, 1, `🔴 SUELO: la ficha no tiene UNA caja para la firma del ${quien}`);
    const guardada = conAtributo(cajas[0], 'data-parte-firma-guardada', quien);
    return {
      guardada: guardada.map(texto),
      falta: conAtributo(cajas[0], 'data-parte-falta-firma', quien).length,
      ofreceFirmar: !!cont.querySelector(SELECTOR[quien]),
    };
  };
  return {
    cliente: de('cliente'), tecnico: de('tecnico'),
    // Ninguna caja de «guardada» fuera de la caja de su firma: ahí el literal dejaría de estar firmado.
    cajasEnTotal: todos(cont).filter((x) => x.getAttribute && x.getAttribute('data-parte-firma-guardada')).length,
  };
}
const GUARDADA = [`${ETIQUETA} ${DETALLE}`];

async function pulsarFirmar(cont, quien) {
  const boton = cont.querySelector(SELECTOR[quien]);
  assert.ok(boton, `🔴 SUELO: la ficha no ofrece firmar (${quien})`);
  boton.click();
  await esperar(30);
}

// ═══ ACEPTACIÓN 1 · la caja, dentro de la caja de SU firma ══════════════════════════════════════

test('SCRUM-1426 · firma del CLIENTE en la cola: la caja sale en la del cliente, y ahí no dice «falta»', async () => {
  const { b, pad } = montar();
  await b.ctx.encolarFirma(ID, FIRMA, TIPO.cliente);
  const d = loQueDice(await abrirFicha(b, pad));
  assert.deepEqual(d.cliente.guardada, GUARDADA, '🔴 la ficha no dice que la firma del cliente está guardada en este móvil');
  assert.equal(d.cliente.falta, 0, '🔴 dice «Falta la firma del cliente» de una firma que está en el móvil');
  assert.equal(d.cliente.ofreceFirmar, true, 'se puede volver a firmar: un cliente que firmó mal tiene que poder repetir');
  assert.deepEqual(d.tecnico.guardada, [], '🔴 la caja ha salido también en la firma del técnico');
  assert.equal(d.tecnico.falta, 1, 'la del técnico sigue faltando, y se dice');
  assert.equal(d.cajasEnTotal, 1);
});

test('SCRUM-1426 · firma del TÉCNICO en la cola: la caja sale en la del técnico, y ahí no dice «falta»', async () => {
  const { b, pad } = montar();
  await b.ctx.encolarFirma(ID, FIRMA, TIPO.tecnico);
  const d = loQueDice(await abrirFicha(b, pad));
  assert.deepEqual(d.tecnico.guardada, GUARDADA, '🔴 la ficha no dice que la firma del técnico está guardada en este móvil');
  assert.equal(d.tecnico.falta, 0, '🔴 dice «Falta la firma del técnico» de una firma que está en el móvil');
  assert.deepEqual(d.cliente.guardada, [], '🔴 la caja ha salido también en la firma del cliente');
  assert.equal(d.cliente.falta, 1, 'la del cliente sigue faltando, y se dice');
  assert.equal(d.cajasEnTotal, 1);
});

test('SCRUM-1426 · las DOS en la cola: una caja en cada una', async () => {
  const { b, pad } = montar();
  await b.ctx.encolarFirma(ID, FIRMA, TIPO.cliente);
  await b.ctx.encolarFirma(ID, FIRMA, TIPO.tecnico);
  const d = loQueDice(await abrirFicha(b, pad));
  assert.deepEqual(d.cliente.guardada, GUARDADA);
  assert.deepEqual(d.tecnico.guardada, GUARDADA);
  assert.equal(d.cliente.falta + d.tecnico.falta, 0);
  assert.equal(d.cajasEnTotal, 2);
});

// ═══ ACEPTACIÓN 2 y 3 · los controles: sin nada, y con lo de OTRO documento ═════════════════════

test('SCRUM-1426 · control: con la cola vacía la ficha se pinta como siempre', async () => {
  const { b, pad } = montar();
  const d = loQueDice(await abrirFicha(b, pad));
  assert.equal(d.cajasEnTotal, 0, '🔴 la caja sale sin ninguna firma guardada');
  assert.equal(d.cliente.falta, 1);
  assert.equal(d.tecnico.falta, 1);
});

test('SCRUM-1426 · la firma de OTRO parte, o de un albarán con el mismo número, no pinta la caja', async () => {
  const { b, pad } = montar();
  await b.ctx.encolarFirma(ID + 1, FIRMA, TIPO.cliente);
  await b.ctx.encolarFirma(ID + 1, FIRMA, TIPO.tecnico);
  await b.ctx.encolarFirma(ID, FIRMA, 'albaran');
  assert.equal((await b.ctx.leerFirmasPendientes()).firmas.length, 3, '🔴 SUELO: las tres firmas ajenas no están en la cola');
  const d = loQueDice(await abrirFicha(b, pad));
  assert.equal(d.cajasEnTotal, 0, '🔴 la ficha da por suya una firma de otro documento');
  assert.equal(d.cliente.falta, 1);
  assert.equal(d.tecnico.falta, 1);
});

// ═══ ACEPTACIÓN 4 · la pregunta antes de reemplazar, en el clic ═════════════════════════════════

test('SCRUM-1426 · firmar otra vez la del CLIENTE: pregunta con su texto; si dice que no, ni pad ni cola tocada', async () => {
  const { b, pad, avisos } = montar();
  await b.ctx.encolarFirma(ID, FIRMA, TIPO.cliente);
  const cont = await abrirFicha(b, pad);
  avisos.acepta = false;
  await pulsarFirmar(cont, 'cliente');
  assert.deepEqual(avisos.preguntas, [PREGUNTA.cliente], '🔴 no pregunta antes de reemplazar la firma guardada del cliente');
  assert.equal(pad.aperturas, 0, '🔴 dijo que no y el pad se abrió');
  assert.equal((await b.ctx.leerFirmasPendientes()).firmas.length, 1, 'la firma guardada sigue ahí');
  avisos.acepta = true;
  await pulsarFirmar(cont, 'cliente');
  assert.equal(avisos.preguntas.length, 2, 'aceptando también se pregunta antes');
  assert.equal(pad.aperturas, 1, '🔴 dijo que sí y el pad no se abrió');
});

test('SCRUM-1426 · firmar otra vez la del TÉCNICO: pregunta con el texto del técnico', async () => {
  const { b, pad, avisos } = montar();
  await b.ctx.encolarFirma(ID, FIRMA, TIPO.tecnico);
  const cont = await abrirFicha(b, pad);
  avisos.acepta = false;
  await pulsarFirmar(cont, 'tecnico');
  assert.deepEqual(avisos.preguntas, [PREGUNTA.tecnico], '🔴 no pregunta, o pregunta por la firma que no es');
  assert.equal(pad.aperturas, 0);
});

test('SCRUM-1426 · con la del técnico guardada, firmar la del CLIENTE no pregunta nada', async () => {
  const { b, pad, avisos } = montar();
  await b.ctx.encolarFirma(ID, FIRMA, TIPO.tecnico);
  const cont = await abrirFicha(b, pad);
  await pulsarFirmar(cont, 'cliente');
  assert.deepEqual(avisos.preguntas, [], '🔴 pregunta por una firma que no se va a sustituir');
  assert.equal(pad.aperturas, 1, 'y el pad se abre');
});

test('SCRUM-1426 · se pregunta EN EL CLIC: firmar sin red, cerrar el pad y volver a pulsar ya pregunta', async () => {
  const { b, red, pad, avisos } = montar();
  const cont = await abrirFicha(b, pad);
  red.conRed = false;
  await pulsarFirmar(cont, 'cliente');
  assert.deepEqual(avisos.preguntas, [], 'suelo: la primera firma, con la cola vacía, no pregunta');
  assert.ok(await pad.confirmar(), '🔴 SUELO: sin red el pad tenía que quedarse abierto con su aviso');
  assert.equal((await b.ctx.leerFirmasPendientes()).firmas.length, 1, '🔴 SUELO: la firma no ha quedado en la cola');
  pad.cerrar(false);
  await esperar(30);
  // Sin reabrir la ficha: la caja aparece al cerrarse el pad.
  const d = loQueDice(cont);
  assert.deepEqual(d.cliente.guardada, GUARDADA, '🔴 cerrado el pad, la ficha no dice que la firma está guardada');
  assert.equal(d.cliente.falta, 0);
  avisos.acepta = false;
  await pulsarFirmar(cont, 'cliente');
  assert.deepEqual(avisos.preguntas, [PREGUNTA.cliente]);
});

// ═══ ACEPTACIÓN 5 · si no se puede leer el almacén, no se afirma nada ═══════════════════════════

test('SCRUM-1426 · almacén ilegible: ni caja ni pregunta, y «falta» se sigue diciendo', async () => {
  const { b, pad, avisos } = montar();
  await b.ctx.encolarFirma(ID, FIRMA, TIPO.cliente);
  const leer = b.ctx.leerFirmasPendientes;
  assert.equal((await leer()).firmas.length, 1, '🔴 SUELO: la firma no está en la cola; el «no hay caja» de abajo no probaría nada');
  b.ctx.leerFirmasPendientes = async () => ({ estado: 'NO_DISPONIBLE', firmas: [] });
  const cont = await abrirFicha(b, pad);
  const d = loQueDice(cont);
  assert.equal(d.cajasEnTotal, 0, '🔴 sin poder leer el almacén se afirma que hay una firma guardada');
  assert.equal(d.cliente.falta, 1, '🔴 sin poder leer el almacén se calla que falta la firma');
  await pulsarFirmar(cont, 'cliente');
  assert.deepEqual(avisos.preguntas, []);
  assert.equal(pad.aperturas, 1, 'y firmar sigue pudiéndose');
});

test('SCRUM-1426 · almacén que LANZA al leer: la ficha se pinta igual, sin caja', async () => {
  const { b, pad } = montar();
  b.ctx.leerFirmasPendientes = async () => { throw new Error('IndexedDB cerrada'); };
  const d = loQueDice(await abrirFicha(b, pad));
  assert.equal(d.cajasEnTotal, 0);
  assert.equal(d.cliente.falta + d.tecnico.falta, 2);
});

// ═══ ACEPTACIÓN 6 · cuando la firma sube, la caja se va ═════════════════════════════════════════

test('SCRUM-1426 · la firma sube (SCRUM-1422): la caja desaparece y la ficha dice que firmó', async () => {
  const { b, red, pad } = montar();
  red.conRed = false;
  await b.ctx.encolarFirma(ID, FIRMA, TIPO.cliente);
  red.conRed = true;
  const cont = await abrirFicha(b, pad);
  assert.deepEqual(loQueDice(cont).cliente.guardada, GUARDADA, '🔴 SUELO: la caja no estaba antes de subir');
  await b.ctx.drenarAlAbrir();
  await esperar(120);
  assert.equal((await b.ctx.leerFirmasPendientes()).firmas.length, 0, '🔴 SUELO: la cola no se ha vaciado');
  const d = loQueDice(cont);
  assert.equal(d.cajasEnTotal, 0, '🔴 la firma ya subió y la ficha sigue diciendo «Solo en este móvil»');
  assert.equal(d.cliente.ofreceFirmar, false);
  assert.ok(cont.querySelector('[data-parte-firmar-hecha]'), 'y dice que el cliente ya firmó');
});
