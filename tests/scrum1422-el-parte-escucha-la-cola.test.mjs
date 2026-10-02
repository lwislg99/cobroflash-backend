// tests/scrum1422-el-parte-escucha-la-cola.test.mjs — SCRUM-1422
//
// LA FICHA ABIERTA DEL PARTE SE ENTERA DE QUE SU FIRMA HA SUBIDO.
//
// Medido el 2-oct-2026: `parteDetailView.js` no escuchaba a la cola (`alConfirmarseFirmas`,
// SCRUM-1373). Se firmaba sin red, volvía la señal, la cola subía la firma y AVISABA, y la ficha
// seguía ofreciendo firmar con el servidor ya firmado. No es el hueco de SCRUM-1420 (olvidar el
// aviso con el pad abierto): es no oírlo nunca. Aquí van los dos.
//
// Se ejecuta el código REAL (`renderParteDetailView`, `firmarParte`, `colaDeFirmas.js`,
// `almacenLocal.js`) sobre el banco del almacén. Lo único fingido es el PAD: uno que deja en el
// documento lo mismo que el real (`[data-sp-aviso]`) y cumple el contrato de cierre de
// `docs/master/SCRUM-1420.md` — `onClose({ confirmada })`, una vez y ya fuera del DOM.
//
// 🔴 Cada «no se repinta» lleva su SUELO al lado: la cola subió y avisó. Sin él, una pantalla
// quieta porque no pasó nada se leería igual que una que supo no repintarse.
//
// Lo que NO mide: un navegador, ni el pad real (lo mide `scrum1420-el-pad-avisa-al-cerrarse`).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { montarAlmacen, porQueEstariaCiego } from './_banco-almacen-local.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ID = 7;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const TRAZO = 'data:image/png;base64,' + 'A'.repeat(300);

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

/** Un servidor que se enciende y se apaga, que recuerda qué firmas tiene y cuenta las lecturas. */
function nuevaRed() {
  const e = { conRed: true, fallaLaLectura: false, firmoElCliente: false, firmoElTecnico: false, posts: [], lecturas: 0 };
  const responder = (status, data) => ({
    ok: status >= 200 && status < 300, status, statusText: String(status),
    headers: { get: () => 'application/json' },
    json: async () => data, blob: async () => ({}), text: async () => JSON.stringify(data),
  });
  e.fetch = async (url, opts) => {
    const u = String(url);
    const metodo = (opts && opts.method) || 'GET';
    if (!e.conRed) throw new TypeError('Failed to fetch');
    if (metodo === 'GET') {
      if (/\/admin\/partes\/\d+$/.test(u)) {
        e.lecturas += 1;
        if (e.fallaLaLectura) throw new TypeError('Failed to fetch');
        return responder(200, parteDelServidor(e));
      }
      return responder(200, {});
    }
    e.posts.push(u);
    if (new RegExp(`/admin/partes/${ID}/firmar$`).test(u)) e.firmoElCliente = true;
    if (new RegExp(`/admin/partes/${ID}/firmar-tecnico$`).test(u)) e.firmoElTecnico = true;
    return responder(200, { id: ID, estado: 'firmado' });
  };
  e.navigator = { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } };
  return e;
}

/**
 * El pad fingido. Deja en el documento el mismo nodo por el que la vista sabe que hay un pad
 * (`[data-sp-aviso]`) y, al cerrarse, lo quita y DESPUÉS llama a `onClose`, una sola vez.
 */
function padFingido(b) {
  const pad = { opts: null, abierto: false, nodo: null, cierres: 0 };
  pad.abrir = (opts) => {
    pad.opts = opts;
    pad.abierto = true;
    pad.nodo = b.ctx.document.createElement('p');
    pad.nodo.setAttribute('data-sp-aviso', '');
    b.ctx.document.body.appendChild(pad.nodo);
    return { close: () => pad.cerrar(false) };
  };
  pad.cerrar = (confirmada) => {
    if (!pad.abierto) return;
    pad.abierto = false;
    pad.nodo.remove();
    pad.cierres += 1;
    if (typeof pad.opts.onClose === 'function') pad.opts.onClose({ confirmada: !!confirmada });
  };
  /** «Confirmar firma»: como el real, sólo se cierra si `onConfirm` termina bien. Devuelve el aviso. */
  pad.confirmar = async () => {
    try {
      await pad.opts.onConfirm(TRAZO, { firmadoPorNombre: 'Ana Ruiz' });
    } catch (e) {
      return (e && e.message) || '';
    }
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
  for (const n of ['renderParteDetailView', 'firmarParte', 'drenarAlAbrir', 'alConfirmarseFirmas', 'encolarFirma', 'leerFirmasPendientes']) {
    assert.equal(typeof b.ctx[n], 'function', `🔴 BANCO CIEGO: el dashboard no publica \`${n}\``);
  }
  return { b, red, pad: padFingido(b) };
}

const SELECTOR = { cliente: '[data-parte-firmar]', tecnico: '[data-parte-firmar-tecnico]' };
const HECHA = { cliente: '[data-parte-firmar-hecha]', tecnico: '[data-parte-firmar-tecnico-hecha]' };
const ofreceFirmar = (cont, quien) => !!cont.querySelector(SELECTOR[quien]);
const diceFirmado = (cont, quien) => !!cont.querySelector(HECHA[quien]);

/** Abre la ficha como `app.js`, con el pad fingido en el sitio del real. */
async function abrirFicha(b, pad) {
  const cont = b.mk('div');
  const pintada = await b.ctx.renderParteDetailView(cont, ID, { abrirPad: pad.abrir });
  assert.equal(pintada, true, '🔴 SUELO: la ficha del parte no se ha pintado');
  return cont;
}

/** Pulsa el botón de firmar de la ficha y confirma en el pad SIN red: el pad se queda abierto. */
async function firmarSinRed(b, red, pad, cont, quien) {
  red.conRed = false;
  const boton = cont.querySelector(SELECTOR[quien]);
  assert.ok(boton, `🔴 SUELO: la ficha no ofrece firmar (${quien})`);
  boton.click();
  await esperar(20);
  assert.equal(pad.abierto, true, '🔴 SUELO: el pad no se ha abierto');
  const aviso = await pad.confirmar();
  assert.ok(aviso, '🔴 SUELO: sin red el pad tenía que quedarse abierto con su aviso');
  assert.equal(pad.abierto, true, '🔴 SUELO: sin red el pad se ha cerrado');
  const cola = await b.ctx.leerFirmasPendientes();
  assert.equal(cola.firmas.length, 1, '🔴 SUELO: la firma no ha quedado en la cola');
}

/** Vuelve la red y se vacía la cola. Devuelve lo que la cola AVISÓ (el suelo de cada test). */
async function vuelveLaRed(b, red) {
  const avisado = [];
  const dejar = b.ctx.alConfirmarseFirmas((l) => { avisado.push(...l.map((c) => `${c.tipo}:${c.documentoId}`)); });
  red.conRed = true;
  await b.ctx.drenarAlAbrir();
  await esperar(120);
  dejar();
  return avisado;
}

// ═══ ACEPTACIÓN 1 · pad cerrado, la firma sube: la ficha se pone al día sola ════════════════════

for (const [quien, tipo] of [['cliente', 'parte'], ['tecnico', 'parte-tecnico']]) {
  test(`SCRUM-1422 · ficha abierta + firma del ${quien} en la cola + vuelve la red: deja de ofrecer firmar y dice que firmó`, async () => {
    const { b, red, pad } = montar();
    const cont = await abrirFicha(b, pad);
    await firmarSinRed(b, red, pad, cont, quien);
    pad.cerrar(false); // «Cancelar», aún sin red: no ha llegado ningún aviso
    assert.equal(ofreceFirmar(cont, quien), true, 'suelo: antes de volver la red la ficha ofrece firmar');
    const lecturas = red.lecturas;

    assert.deepEqual(await vuelveLaRed(b, red), [`${tipo}:${ID}`], 'suelo: la cola subió y avisó de ESTE parte');
    assert.equal(red.lecturas, lecturas + 1, 'la ficha se vuelve a pedir UNA vez');
    assert.equal(ofreceFirmar(cont, quien), false, '🔴 la ficha sigue ofreciendo firmar lo que el servidor ya tiene');
    assert.equal(diceFirmado(cont, quien), true, 'y dice que ya firmó');
  });
}

// ═══ ACEPTACIÓN 2 · con el pad abierto no se repinta; al cerrarlo, sí ═══════════════════════════

test('SCRUM-1422 · con el pad ABIERTO no se repinta; al cerrarlo la ficha se pone al día', async () => {
  const { b, red, pad } = montar();
  const cont = await abrirFicha(b, pad);
  await firmarSinRed(b, red, pad, cont, 'cliente');
  const lecturas = red.lecturas;

  assert.deepEqual(await vuelveLaRed(b, red), [`parte:${ID}`], 'suelo: la cola subió y avisó de ESTE parte');
  assert.equal(pad.abierto, true, 'el pad sigue abierto');
  assert.equal(red.lecturas, lecturas, 'con el pad abierto la ficha no se ha vuelto a pedir');
  assert.equal(ofreceFirmar(cont, 'cliente'), true, 'y debajo sigue lo que había');

  pad.cerrar(false);
  await esperar(120);
  assert.equal(pad.cierres, 1, 'suelo: el pad se ha cerrado y ha avisado');
  assert.equal(red.lecturas, lecturas + 1, 'al cerrarse el pad la ficha se pide UNA vez');
  assert.equal(ofreceFirmar(cont, 'cliente'), false, '🔴 tras cerrar el pad la ficha sigue ofreciendo firmar');
  assert.equal(diceFirmado(cont, 'cliente'), true);
});

test('SCRUM-1422 · el pad se cierra sin que haya llegado ningún aviso: ni una lectura de más', async () => {
  const { b, red, pad } = montar();
  const cont = await abrirFicha(b, pad);
  await firmarSinRed(b, red, pad, cont, 'cliente');
  red.conRed = true; // hay red: si la ficha se pidiera, se vería. Nadie ha vaciado la cola.
  const lecturas = red.lecturas;
  pad.cerrar(false);
  await esperar(120);
  assert.equal(pad.cierres, 1, 'suelo: el pad se ha cerrado y ha avisado');
  assert.equal(red.lecturas, lecturas, 'nadie ha vuelto a pedir la ficha');
  assert.equal(ofreceFirmar(cont, 'cliente'), true);
});

test('SCRUM-1422 · control: firmar CON red lee la ficha UNA vez (el cierre del pad no añade otra)', async () => {
  const { b, red, pad } = montar();
  const cont = await abrirFicha(b, pad);
  const lecturas = red.lecturas;
  cont.querySelector(SELECTOR.cliente).click();
  await esperar(20);
  assert.equal(await pad.confirmar(), null, 'suelo: con red el pad se cierra sin aviso');
  await esperar(120);
  assert.equal(red.lecturas, lecturas + 1, 'una lectura: la de después de firmar');
  assert.equal(diceFirmado(cont, 'cliente'), true);
});

// ═══ ACEPTACIÓN 3 · el aviso de OTRO documento no repinta ═══════════════════════════════════════

test('SCRUM-1422 · el aviso de OTRO documento no repinta: ni otro parte, ni un albarán con el mismo número, ni la otra firma ya hecha', async () => {
  const { b, red, pad } = montar();
  red.firmoElTecnico = true; // el técnico YA firmó: su recuadro no espera nada de la cola
  const cont = await abrirFicha(b, pad);
  assert.equal(ofreceFirmar(cont, 'cliente'), true, 'suelo: falta la firma del cliente');
  const lecturas = red.lecturas;
  red.conRed = false;
  const firma = { signatureData: 'data:image/png;base64,AAAA', firmadoPorNombre: 'X' };
  await b.ctx.encolarFirma(ID + 1, firma, 'parte');
  await b.ctx.encolarFirma(ID, firma, 'albaran');
  const avisado = await vuelveLaRed(b, red);
  assert.deepEqual([...avisado].sort(), [`albaran:${ID}`, `parte:${ID + 1}`], 'suelo: las dos subieron y de las dos se avisó');
  assert.equal(red.lecturas, lecturas, 'la ficha no se ha vuelto a pedir');
  assert.equal(ofreceFirmar(cont, 'cliente'), true, 'y sigue como estaba');
});

// ═══ ACEPTACIÓN 4 · una ficha que ya no está en pantalla ════════════════════════════════════════

test('SCRUM-1422 · una ficha que ya no está en pantalla no se repinta', async () => {
  const { b, red, pad } = montar();
  const cont = await abrirFicha(b, pad);
  await firmarSinRed(b, red, pad, cont, 'cliente');
  pad.cerrar(false);
  cont.innerHTML = ''; // se navegó a otra pantalla: el contenedor es el mismo, la ficha no está
  const lecturas = red.lecturas;
  assert.deepEqual(await vuelveLaRed(b, red), [`parte:${ID}`], 'suelo: la cola subió y avisó de ESTE parte');
  assert.equal(red.lecturas, lecturas, 'nadie ha vuelto a pedir la ficha');
  assert.equal(cont.querySelector('[data-parte-firmas]'), null, 'ni la ha pintado encima de lo que haya ahora');
});

test('SCRUM-1422 · reabrir la ficha no deja dos escuchas: un aviso, una lectura', async () => {
  const { b, red, pad } = montar();
  const cont = await abrirFicha(b, pad);
  await firmarSinRed(b, red, pad, cont, 'cliente');
  pad.cerrar(false);
  red.conRed = true;
  assert.equal(await b.ctx.renderParteDetailView(cont, ID, { abrirPad: pad.abrir }), true, 'suelo: la ficha se reabre');
  const lecturas = red.lecturas;
  assert.deepEqual(await vuelveLaRed(b, red), [`parte:${ID}`], 'suelo: la cola subió y avisó de ESTE parte');
  assert.equal(red.lecturas, lecturas + 1, 'una sola lectura: la ficha vieja ya no escucha');
});

// ═══ ACEPTACIÓN 5 · si la lectura falla ═════════════════════════════════════════════════════════

test('SCRUM-1422 · si al ponerse al día la lectura falla, la ficha se queda como estaba y no se pierde ninguna promesa', async () => {
  const { b, red, pad } = montar();
  const cont = await abrirFicha(b, pad);
  await firmarSinRed(b, red, pad, cont, 'cliente');
  pad.cerrar(false);
  const perdidas = [];
  const alPerderse = (e) => perdidas.push(e);
  process.on('unhandledRejection', alPerderse);
  try {
    red.fallaLaLectura = true;
    const lecturas = red.lecturas;
    assert.deepEqual(await vuelveLaRed(b, red), [`parte:${ID}`], 'suelo: la cola subió y avisó de ESTE parte');
    await esperar(50);
    assert.equal(red.lecturas, lecturas + 1, 'suelo: la ficha se intentó leer (y falló)');
  } finally {
    process.off('unhandledRejection', alPerderse);
  }
  assert.deepEqual(perdidas, [], '🔴 la lectura fallida ha dejado una promesa rechazada sin dueño');
  assert.equal(cont.querySelector('[data-parte-error]'), null, '🔴 la ficha se ha tapado con «no se pudo cargar»: el técnico no ha hecho nada');
  assert.ok(cont.querySelector('[data-parte-firmas]'), 'la ficha sigue en pantalla');
});
