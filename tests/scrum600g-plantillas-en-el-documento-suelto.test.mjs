// tests/scrum600g-plantillas-en-el-documento-suelto.test.mjs — SCRUM-600 · Fase 1 (apéndice 600g)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LAS PLANTILLAS LLEGAN AL DOCUMENTO SUELTO, Y NADA MÁS LLEGA CON ELLAS
//
// Hasta SCRUM-600g, en la página del documento suelto no se pintaban «💾 Guardar como plantilla»
// ni «📋 Usar plantilla / Ver las N». El mecanismo no era el motivo —una plantilla sólo guarda
// LÍNEAS, que es lo único que el emisor admite—: lo eran dos frases de sus hojas, que nombraban el
// presupuesto y no tenían texto firmado para otro documento (regla 30). Firmadas por delegación
// (SCRUM-861), la parada se levanta. Este fichero impide que se levante de más o de menos.
//
// SE MONTA Y SE PULSA, NO SE LEE. Un fichero puede contener la frase correcta y pintar otra
// (SCRUM-515), y un botón puede existir en el fuente sin llegar a la pantalla.
//
//   ⓪ las dos frases constan APROBADAS, y por la firma delegada con su referencia
//   ① en el documento suelto están los dos botones, y con más de 3 plantillas se llega a «Ver las N»
//   ② la hoja «Usar plantilla» dice su frase firmada, y no dice «presupuesto»
//   ③ la hoja «Guardar como plantilla», ídem
//   ④ NEGATIVO: «3. Condiciones» y «4. Envío» siguen fuera; levantar esta parada no levanta las otras
//   ⑤ REGLA 38 POR MECANISMO: guardar llama a `/admin/templates` y NUNCA a `/admin/invoices`, con el
//      mismo cuerpo que desde el presupuesto. Y su control positivo: en este mismo banco, emitir SÍ
//      llama a `/admin/invoices`, así que el «nunca» no puede ser un banco sordo a esa ruta
//   ⑥ el presupuesto no cambia: sus dos hojas siguen diciendo lo suyo (y es el SUELO del lector)
//   ⑦ sin variante justificante: en modo justificante, las mismas dos frases
//   ⑧ fuente única: las frases viven en `rotulosDelDocumento`, no escritas a pelo en la vista
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url'; // NUNCA `new URL().pathname`: no decodifica el espacio

import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { aprobacionesDeMicrocopy, constaAprobado } from './_microcopy-aprobada.mjs';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VISTA = 'public/dashboard/js/quotesView.js';
const ROTULOS = 'public/dashboard/js/rotulosDelDocumento.js';
const FICHA = 'docs/microcopy/2026-09-15-SCRUM-600-plantillas-en-el-documento-suelto.md';
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

// Las dos frases firmadas. Se comparan por IDENTIDAD con lo que la pantalla pinta.
const HOJA_USAR = 'Elige una plantilla para cargar sus líneas en este documento.';
const HOJA_GUARDAR = 'Dale un nombre a esta plantilla para reutilizar sus líneas más adelante.';
// Las del presupuesto, que NO cambian.
const HOJA_USAR_PRESUPUESTO = 'Elige una plantilla para cargar sus líneas en el presupuesto actual.';
const HOJA_GUARDAR_PRESUPUESTO = 'Dale un nombre a esta plantilla para reutilizarla en futuros presupuestos.';

const CLIENTE = '7';
const LINEA = Object.freeze({ concepto: 'Mano de obra', cantidad: '2', precio: '50' });

// CUATRO plantillas, y no por capricho: con tres o menos, las fichas rápidas son la lista entera y
// «📋 Usar plantilla» se esconde (SCRUM-139 F6). Con cuatro, el botón pasa a «Ver las 4» y su hoja
// se puede abrir, que es justo lo que hay que medir.
const PLANTILLAS = [1, 2, 3, 4].map((i) => ({
  id: i,
  name: `Plantilla ${i}`,
  currency: 'EUR',
  lines: [{ concept: `Concepto ${i}`, qty: 1, price: 10 * i, tax: 0.21 }],
}));

const respirar = () => new Promise((r) => setTimeout(r, 80));

/** El texto de un nodo, con el respaldo de `_html` para los `innerHTML` de texto plano (SCRUM-600c). */
const texto = (n) => {
  const t = String((n && n.textContent) || '');
  if (t) return t;
  return (n && n._html && !/</.test(n._html)) ? String(n._html) : '';
};
const boton = (raiz, re) => todos(raiz).find((x) => x.tagName === 'BUTTON' && re.test(texto(x).trim()));
const BOTON_USAR = /^📋 (Usar plantilla|Ver las \d+)$/;
const BOTON_GUARDAR = /^💾 Guardar como plantilla$/;
const hojas = (b) => todos(b.ctx.document.body).filter((x) => String(x.className || '').includes('modal-overlay'));
/** Todo lo que una hoja deja leer: el texto de cada nodo y el marcado con el que se escribió. */
const leerHoja = (hoja) => todos(hoja).map((n) => `${texto(n)}\n${String(n._html || '')}`).join('\n');
/** Las frases que pinta una hoja, una por nodo y recortadas, para comparar por identidad. */
const frasesDe = (hoja) => new Set(todos(hoja).map((n) => texto(n).trim()).filter(Boolean));

/**
 * Pulsa como un navegador: los oyentes de `addEventListener` Y el `onclick` de propiedad.
 *
 * El banco sólo dispara los primeros, y las hojas de plantillas cablean su botón con
 * `saveBtn.onclick = …`. Sin esto, «Guardar plantilla» no haría nada, y «nunca llama a la emisión»
 * saldría verde porque NO SE HABRÍA LLAMADO A NADA.
 */
async function pulsar(n) {
  n.disparar('click');
  if (typeof n.onclick === 'function') await n.onclick.call(n, { type: 'click', target: n, preventDefault() {} });
  await respirar();
}

/** Un dashboard con la red servida y un registro de TODO lo que sale por ella: método, ruta y cuerpo. */
function banco(documentoSuelto) {
  const peticiones = [];
  const red = {
    navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
    fetch: async (url, opts) => {
      const u = String(url);
      const metodo = (opts && opts.method) || 'GET';
      peticiones.push({ metodo, url: u, cuerpo: opts && opts.body });
      let cuerpo = {};
      if (/\/admin\/templates/.test(u)) cuerpo = metodo === 'GET' ? PLANTILLAS : { id: 99 };
      else if (/\/admin\/customers/.test(u)) cuerpo = [{ id: Number(CLIENTE), name: 'Cliente de prueba' }];
      else if (/\/admin\/merchant/.test(u)) cuerpo = { id: 1, name: 'Taller', defaultCurrency: 'EUR' };
      else if (/\/admin\/invoices$/.test(u) && metodo === 'POST') {
        cuerpo = { ok: true, factura: { id: 4242, number: 'F-2026-0007', total: '121.00', currency: 'EUR' } };
      }
      return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => cuerpo, text: async () => '' };
    },
  };
  const b = cargarDashboard(RAIZ, { red });
  b.ctx.appDocumentoSuelto = documentoSuelto || 'no';
  b.ctx.appMerchantId = 1;
  b.ctx.renderAppView = () => {}; // emitir navega a la ficha; aquí no se sigue
  return { b, peticiones };
}

/** 'factura' | 'justificante' monta la página del documento suelto; `null`, el presupuesto. */
async function montar(documentoSuelto = null) {
  const { b, peticiones } = banco(documentoSuelto);
  const r = documentoSuelto
    ? await pintarVista(b, 'renderDocumentoSueltoView')
    : await pintarVista(b, 'renderQuotesView', null, false);
  assert.equal(r.error, null, `🔴 SUELO: la pantalla no monta: ${r.error && r.error.message}`);
  await respirar(); // las fichas rápidas y «Ver las N» se pintan después de pedir las plantillas
  return { b, peticiones, contenedor: r.contenedor };
}

function teclearLinea(contenedor) {
  const n = todos(contenedor);
  const conceptos = n.filter((x) => x.tagName === 'INPUT' && x.placeholder === 'Concepto / servicio');
  const numeros = n.filter((x) => x.tagName === 'INPUT' && x.type === 'number');
  assert.ok(conceptos.length >= 1 && numeros.length >= 2,
    `🔴 SUELO: no se encuentran los campos de la primera línea (conceptos=${conceptos.length}, números=${numeros.length})`);
  conceptos[0].value = LINEA.concepto;
  numeros[0].value = LINEA.cantidad;
  numeros[1].value = LINEA.precio;
}

async function abrirHojaUsar(m) {
  const ver = boton(m.contenedor, BOTON_USAR);
  assert.ok(ver, '🔴 no hay «📋 Usar plantilla» en esta pantalla: sin el botón no hay hoja que leer');
  await pulsar(ver);
  const hoja = hojas(m.b).at(-1);
  assert.ok(hoja, '🔴 «📋 Usar plantilla» no abre ninguna hoja');
  return hoja;
}

async function abrirHojaGuardar(m) {
  teclearLinea(m.contenedor); // sin una línea con concepto y precio, la hoja no se abre (avisa y vuelve)
  const guardar = boton(m.contenedor, BOTON_GUARDAR);
  assert.ok(guardar, '🔴 no hay «💾 Guardar como plantilla» en esta pantalla');
  await pulsar(guardar);
  const hoja = hojas(m.b).at(-1);
  assert.ok(hoja, '🔴 «💾 Guardar como plantilla» no abre ninguna hoja');
  return hoja;
}

const muestra = (hoja) => [...frasesDe(hoja)].join(' | ').slice(0, 400);

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⓪ LA FIRMA · sin ella, estas dos frases serían microcopy inventada
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-600g · ⓪ las dos frases constan APROBADAS, por la firma delegada y con su referencia', () => {
  const ficha = aprobacionesDeMicrocopy().find((a) => a.ruta === FICHA);
  assert.ok(ficha, `🔴 no existe la ficha ${FICHA}. Sin ella, las dos frases son microcopy sin firmar (regla 30).`);
  assert.equal(ficha.firmante, 'orquestador',
    '🔴 la ficha no la firma el orquestador por delegación. Nadie escribe «Aprobado por el fundador» si no es él.');
  assert.deepEqual(ficha.delegacion, { referencia: 'SCRUM-600 comentario 15357' },
    '🔴 la firma delegada no cita el comentario de Jira donde se aprobó (SCRUM-861).');
  assert.equal(ficha.aprobada, true, '🔴 la firma no cuenta como aprobación: ¿se ha retirado la delegación?');
  for (const frase of [HOJA_USAR, HOJA_GUARDAR]) {
    assert.ok(constaAprobado(frase).includes(FICHA), `🔴 «${frase}» no consta aprobada en ${FICHA}`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ①–③ LO QUE SE LEVANTA
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-600g · ① en el documento suelto están los DOS botones, y con cuatro plantillas se llega a «Ver las 4»', async () => {
  const { contenedor } = await montar('factura');
  const ver = boton(contenedor, BOTON_USAR);
  assert.ok(ver, '🔴 la factura suelta NO tiene «📋 Usar plantilla»: la parada de plantillas sigue puesta.');
  assert.equal(texto(ver).trim(), '📋 Ver las 4',
    '🔴 con cuatro plantillas el botón tiene que ofrecer «Ver las 4»: las fichas rápidas sólo enseñan tres.');
  assert.notEqual(ver.hidden, true, '🔴 «Ver las 4» está en la página pero ESCONDIDO: no se llega a la cuarta plantilla.');
  assert.ok(boton(contenedor, BOTON_GUARDAR),
    '🔴 la factura suelta NO tiene «💾 Guardar como plantilla». Dejar «Usar» sin «Guardar» es media función.');
});

test('SCRUM-600g · ② la hoja «Usar plantilla» dice su frase firmada, y no dice «presupuesto»', async () => {
  const m = await montar('factura');
  const hoja = await abrirHojaUsar(m);
  assert.ok(frasesDe(hoja).has(HOJA_USAR),
    `🔴 la hoja no dice la frase firmada, «${HOJA_USAR}».\n  la hoja dice: ${muestra(hoja)}`);
  assert.ok(!/presupuest/i.test(leerHoja(hoja)),
    '🔴 la hoja habla del PRESUPUESTO dentro de una factura. Es exactamente la frase que tenía la parada puesta.');
  const usar = todos(hoja).filter((x) => x.tagName === 'BUTTON' && /Usar →/.test(leerHoja(x)));
  assert.equal(usar.length, PLANTILLAS.length,
    `🔴 la hoja no lista las ${PLANTILLAS.length} plantillas (lista ${usar.length}): se llega al botón, pero no a la cuarta.`);
});

test('SCRUM-600g · ③ la hoja «Guardar como plantilla» dice su frase firmada, y no dice «presupuesto»', async () => {
  const hoja = await abrirHojaGuardar(await montar('factura'));
  assert.ok(frasesDe(hoja).has(HOJA_GUARDAR),
    `🔴 la hoja no dice la frase firmada, «${HOJA_GUARDAR}».\n  la hoja dice: ${muestra(hoja)}`);
  assert.ok(!/presupuest/i.test(leerHoja(hoja)),
    '🔴 la hoja habla de PRESUPUESTOS dentro de una factura. Es exactamente la frase que tenía la parada puesta.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ④ LO QUE NO SE LEVANTA
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-600g · ④ NEGATIVO: «3. Condiciones» y «4. Envío» siguen FUERA del documento suelto', async () => {
  // SCRUM-915d · los dos bloques se llaman ahora «Condiciones» (paso) y «Ajustes del documento» (su fila).
  const bloques = (c) => ['Condiciones', 'Ajustes del documento'].filter((t) => todos(c).some((n) => texto(n).trim() === t));

  // SUELO: en el presupuesto están los dos. Sin esto, un «no están» podría ser un lector ciego.
  const presupuesto = await montar(null);
  assert.deepEqual(bloques(presupuesto.contenedor), ['Condiciones', 'Ajustes del documento'],
    '🔴 SUELO: el lector no encuentra los bloques 3 y 4 ni en el presupuesto, así que no sabe mirar.');

  for (const modo of ['factura', 'justificante']) {
    const { contenedor } = await montar(modo);
    assert.deepEqual(bloques(contenedor), [],
      `🔴 en modo ${modo} se cuela un bloque que el emisor no guarda. Los campos de «3. Condiciones» no ` +
      'existen en `Invoice` (600e) y los de «4. Envío» tampoco; además, «4. Envío» tiene trabajo vivo en ' +
      'scrum-820b. Levantar la parada de plantillas no levanta éstas.');
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⑤ REGLA 38 · pulsando, no leyendo
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-600g · ⑤ REGLA 38: guardar una plantilla llama a `/admin/templates` y NUNCA a `/admin/invoices`', async () => {
  const aEmision = (ps) => ps.filter((p) => /\/admin\/invoices/.test(p.url));

  // CONTROL POSITIVO, antes que nada: en ESTE banco, emitir sí llega a `/admin/invoices`. Sin él,
  // el «nunca» de abajo podría deberse a un banco que no oye esa ruta.
  const control = await montar('factura');
  const sel = todos(control.contenedor).find((x) => x.tagName === 'SELECT' && x.name === 'customer_id');
  assert.ok(sel, '🔴 SUELO: no se encuentra el selector de cliente');
  sel.value = CLIENTE;
  sel.disparar('change');
  teclearLinea(control.contenedor);
  const emitir = boton(control.contenedor, /^Emitir factura$/);
  assert.ok(emitir, '🔴 SUELO: la factura suelta no tiene «Emitir factura»');
  await pulsar(emitir);
  assert.ok(aEmision(control.peticiones).some((p) => p.metodo === 'POST'),
    '🔴 SUELO: emitir no llega a `/admin/invoices` en este banco, así que un «nunca» no probaría nada.\n  ' +
    control.peticiones.map((p) => `${p.metodo} ${p.url}`).join('\n  '));

  // Y el flujo de plantillas entero: montar, abrir la hoja, poner nombre y guardar.
  const cuerpos = {};
  for (const modo of ['factura', null]) {
    const m = await montar(modo);
    const hoja = await abrirHojaGuardar(m);
    const nombre = hoja.querySelector('#tpl-name-input');
    const ok = hoja.querySelector('#save-tpl-btn');
    assert.ok(nombre && ok, '🔴 SUELO: la hoja de guardar no tiene su campo de nombre o su botón');
    nombre.value = 'Revisión estándar';
    await pulsar(ok);

    const donde = modo || 'presupuesto';
    const guardadas = m.peticiones.filter((p) => p.metodo === 'POST' && /\/admin\/templates$/.test(p.url));
    assert.equal(guardadas.length, 1, `🔴 en ${donde}, guardar no hace UN POST a \`/admin/templates\` (hace ${guardadas.length}).`);
    assert.deepEqual(aEmision(m.peticiones), [],
      `🔴 REGLA 38: en ${donde}, el flujo de plantillas ha tocado la EMISIÓN. Una plantilla guarda líneas; ` +
      'jamás emite, y en el diff eso no se distinguiría de tocar el sellado.\n  ' +
      aEmision(m.peticiones).map((p) => `${p.metodo} ${p.url}`).join('\n  '));
    cuerpos[donde] = JSON.parse(guardadas[0].cuerpo);
  }

  // La plantilla que se guarda desde la factura tiene la MISMA forma que desde el presupuesto: la
  // comprobación que el plan pedía ANTES de la primera línea, dejada aquí para que no caduque.
  assert.deepEqual(cuerpos.factura, cuerpos.presupuesto,
    '🔴 la factura guarda la plantilla con OTRA forma que el presupuesto; `/admin/templates` sólo conoce una.');
  assert.equal(cuerpos.factura.name, 'Revisión estándar');
  assert.deepEqual(cuerpos.factura.lines.map(({ concept, qty, price }) => ({ concept, qty, price })),
    [{ concept: LINEA.concepto, qty: 2, price: 50 }], '🔴 la plantilla no guarda la línea tecleada');
  assert.equal(typeof cuerpos.factura.lines[0].tax, 'number', '🔴 la línea guardada no lleva su IVA');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⑥–⑧ LO QUE NO CAMBIA
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-600g · ⑥ el PRESUPUESTO no cambia: sus dos hojas siguen diciendo lo suyo', async () => {
  // Es también el SUELO del lector de hojas: si aquí no encuentra la frase, las de ② y ③ no dicen nada.
  const usar = await abrirHojaUsar(await montar(null));
  assert.ok(frasesDe(usar).has(HOJA_USAR_PRESUPUESTO),
    `🔴 la hoja «Usar plantilla» del PRESUPUESTO ha cambiado de frase.\n  dice: ${muestra(usar)}`);
  const guardar = await abrirHojaGuardar(await montar(null));
  assert.ok(frasesDe(guardar).has(HOJA_GUARDAR_PRESUPUESTO),
    `🔴 la hoja «Guardar como plantilla» del PRESUPUESTO ha cambiado de frase.\n  dice: ${muestra(guardar)}`);
});

test('SCRUM-600g · ⑦ sin variante justificante: en modo justificante, las MISMAS dos frases', async () => {
  const usar = await abrirHojaUsar(await montar('justificante'));
  assert.ok(frasesDe(usar).has(HOJA_USAR),
    `🔴 en modo justificante la hoja «Usar plantilla» no dice la frase firmada.\n  dice: ${muestra(usar)}`);
  const guardar = await abrirHojaGuardar(await montar('justificante'));
  assert.ok(frasesDe(guardar).has(HOJA_GUARDAR),
    `🔴 en modo justificante la hoja «Guardar como plantilla» no dice la frase firmada.\n  dice: ${muestra(guardar)}`);
});

test('SCRUM-600g · ⑧ fuente única: las frases viven en `rotulosDelDocumento`, no a pelo en la vista', () => {
  const vista = soloEjecutable(leer(VISTA));
  // SUELO: el lector conserva los literales del código. Si no viera éste, un «no está» no diría nada.
  assert.ok(vista.includes(HOJA_USAR_PRESUPUESTO), '🔴 SUELO: el lector de la vista no ve sus literales');
  for (const frase of [HOJA_USAR, HOJA_GUARDAR]) {
    assert.ok(!vista.includes(frase),
      `🔴 «${frase}» está escrita a pelo en ${VISTA}. El día que la frase cambie en la fuente habrá dos ` +
      'textos y sólo uno se moverá (SCRUM-776).');
  }
  // Y la fuente las da en los dos modos. Se EJECUTA, no se lee (SCRUM-776).
  for (const modo of ['factura', 'justificante']) {
    const ventana = { appDocumentoSuelto: modo };
    // eslint-disable-next-line no-new-func
    new Function('window', leer(ROTULOS))(ventana);
    const r = ventana.rotulosDelDocumento;
    assert.equal(typeof r.hojaUsarPlantilla, 'function', `🔴 falta \`hojaUsarPlantilla\` en ${ROTULOS}`);
    assert.equal(typeof r.hojaGuardarPlantilla, 'function', `🔴 falta \`hojaGuardarPlantilla\` en ${ROTULOS}`);
    assert.equal(r.hojaUsarPlantilla(), HOJA_USAR, `🔴 en modo ${modo}, \`hojaUsarPlantilla()\` no da la frase firmada`);
    assert.equal(r.hojaGuardarPlantilla(), HOJA_GUARDAR, `🔴 en modo ${modo}, \`hojaGuardarPlantilla()\` no da la frase firmada`);
  }
});
