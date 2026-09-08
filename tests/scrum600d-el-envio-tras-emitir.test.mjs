// tests/scrum600d-el-envio-tras-emitir.test.mjs — SCRUM-600d
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EMITIR Y ENVIAR ESTABAN PARTIDOS. ESTE FICHERO LO MIDE PULSANDO, NO LEYENDO.
//
// SCRUM-600c censó los dos fronts del documento y dejó 32 huecos. El primero —y el que más
// duele— no era una funcionalidad que faltara: era un `return`.
//
//     `openQuoteModal` (WhatsApp + email + PDF) se abre en `quotesView.js:4381`.
//     La rama de la factura hacía `return` en la `:4218`, en el MISMO manejador.
//
// 163 líneas antes. El profesional emitía una factura y se quedaba sin ninguna forma de
// mandársela al cliente: tenía que salir de la pantalla a buscarla.
//
// ── 🔴 POR QUÉ ESTE FICHERO MONTA Y PULSA ────────────────────────────────────────────────────
//
// Porque el defecto NO estaba en una puerta. El censo de SCRUM-600c enumeró las 29 puertas
// `if (!esDocumentoSuelto)` y **el envío no salía en ninguna**, porque no hay puerta: hay una
// salida anticipada. Y un barrido de la pantalla RECIÉN MONTADA tampoco lo ve, porque esto pasa
// DESPUÉS de pulsar «Emitir». Sólo se ve emitiendo y mirando a dónde te deja.
//
// ── LO QUE ESTE FICHERO NO MIDE, DICHO EN VOZ ALTA ───────────────────────────────────────────
// El mini-DOM no es un navegador: no calcula cajas ni estilos. Aquí se mide A DÓNDE VA el
// profesional y QUÉ PUEDE PULSAR cuando llega, no cómo se ve.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url'; // NUNCA `new URL().pathname`: no decodifica el espacio

import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const CLIENTE = '7';
const LINEA = Object.freeze({ concepto: 'Mano de obra', cantidad: '1', precio: '100' });
const ID_EMITIDO = 4242; // el id que devuelve el alta en este banco

const respirar = () => new Promise((r) => setTimeout(r, 80));

/**
 * El texto de un nodo, con el respaldo de `_html`.
 *
 * 🔴 EL RESPALDO NO ES ADORNO. El parser del banco sólo crea nodos a partir de `<etiqueta>`, así
 * que un `innerHTML` de TEXTO PLANO no deja hijos NI `textContent`. Sin esto, botones como
 * «⬇ Descargar PDF» son invisibles para el barrido — y un botón invisible para el instrumento se
 * lee igual que un botón que no existe. Medido en SCRUM-600c, donde escondió dos capacidades.
 */
const texto = (n) => {
  const t = String((n && n.textContent) || '');
  if (t) return t;
  return (n && n._html && !/</.test(n._html)) ? String(n._html) : '';
};

/** Lo que un profesional puede PULSAR en un contenedor. */
const pulsables = (raiz) => todos(raiz).filter((x) => x.tagName === 'BUTTON' || x.tagName === 'A');

/** De esos, los que MANDAN el documento a alguna parte. */
const deEnvio = (raiz) => pulsables(raiz)
  .filter((x) => /WhatsApp|email|PDF/i.test(texto(x)))
  .map((x) => texto(x).trim())
  .filter(Boolean);

// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL BANCO
// ═════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Un dashboard con la red servida, la navegación ESPIADA y el cliente configurable.
 *
 * ⚠️ `renderAppView` se envuelve DESPUÉS de cargar —`app.js` publica la suya al evaluarse— y NO
 * se encadena a la de verdad: encadenar montaría la vista de destino DENTRO de esta medición y
 * ya no se sabría qué parte del DOM es de quién. El destino se monta aparte, y con el id que
 * ESTA espía haya recogido (ver `montarLaFicha`).
 */
function banco({ conTelefono = true, respuestaDelAlta } = {}) {
  const navegaciones = [];
  const peticiones = [];
  const alta = respuestaDelAlta !== undefined
    ? respuestaDelAlta
    : { ok: true, factura: { id: ID_EMITIDO, number: 'F-2026-0007', total: '121.00', currency: 'EUR' } };

  const telefono = conTelefono ? '34600111222' : null;
  const CLIENTE_FICHA = {
    id: Number(CLIENTE), name: 'Cliente de prueba', email: 'c@x.es',
    phone: telefono, mobile: telefono,
  };

  const red = {
    navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
    fetch: async (url, opts) => {
      const u = String(url);
      const metodo = (opts && opts.method) || 'GET';
      peticiones.push(`${metodo} ${u}`);
      let cuerpo = {};

      if (/\/admin\/customers/.test(u)) cuerpo = [CLIENTE_FICHA];
      else if (/\/admin\/merchant/.test(u)) cuerpo = { id: 1, name: 'Taller', defaultCurrency: 'EUR' };
      else if (/\/admin\/invoices$/.test(u) && metodo === 'POST') cuerpo = alta;
      // 🔴 LA FICHA SE DEVUELVE CON EL ID QUE VENGA EN LA URL, no con una constante. Si el front
      // pidiera OTRO documento, este banco no lo taparía: la ficha llegaría con el id equivocado
      // y el test lo vería. Con un id fijo, pedir el documento que no es saldría verde.
      else if (/\/admin\/invoices\/(\d+)/.test(u)) {
        const pedido = Number(u.match(/\/admin\/invoices\/(\d+)/)[1]);
        cuerpo = {
          id: pedido, number: 'F-2026-0007', total: '121.00', currency: 'EUR', status: 'pending',
          pdfUrl: `/pdf/${pedido}.pdf`, payToken: 'tok_abc', createdAt: '2026-09-08T10:00:00Z',
          lines: [{ concept: LINEA.concepto, qty: 1, price: 100, tax: 0.21 }],
          customer: CLIENTE_FICHA,
        };
      }
      // 🔴 EL PRESUPUESTO POSTEA A `/quote/create`, NO A `/admin/quotes`. Cuando este doble
      // estuvo mal apuntado, la pantalla decía «Respuesta inesperada al crear presupuesto.» y el
      // barrido daba CERO destinos en el presupuesto — que se habría leído como «el presupuesto
      // tampoco envía», que es falso. De ahí el SUELO de abajo.
      else if (/\/quote\/create/.test(u)) cuerpo = { id: 99, number: 'P-2026-0003', status: 'draft' };
      else if (/\/admin\/quotes\/\d+$/.test(u)) cuerpo = { id: 99, pdfUrl: '/pdf/99.pdf' };

      return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => cuerpo, text: async () => '' };
    },
  };

  const b = cargarDashboard(RAIZ, { red });
  b.ctx.appMerchantId = 1;
  b.ctx.renderAppView = function (vista, opciones) {
    navegaciones.push({ vista, opciones: opciones || null });
  };
  return { b, navegaciones, peticiones };
}

/** Teclea un documento y pulsa la acción primaria. `suelto` decide qué pantalla se monta. */
async function emitir({ suelto, conTelefono = true, respuestaDelAlta } = {}) {
  const { b, navegaciones, peticiones } = banco({ conTelefono, respuestaDelAlta });
  b.ctx.appDocumentoSuelto = suelto ? 'factura' : 'no';

  const r = await pintarVista(b, 'renderQuotesView', null, suelto || undefined);
  assert.equal(r.error, null, `🔴 SUELO: la pantalla no monta: ${r.error && r.error.message}`);
  const n = todos(r.contenedor);

  const sel = n.find((x) => x.tagName === 'SELECT' && x.name === 'customer_id');
  assert.ok(sel, '🔴 SUELO: no se encuentra el selector de cliente');
  sel.value = CLIENTE;
  sel.disparar('change');

  const conceptos = n.filter((x) => x.tagName === 'INPUT' && x.placeholder === 'Concepto / servicio');
  const numeros = n.filter((x) => x.tagName === 'INPUT' && x.type === 'number');
  assert.ok(conceptos.length >= 1 && numeros.length >= 2,
    `🔴 SUELO: no se encuentran los campos de la primera línea (conceptos=${conceptos.length}, números=${numeros.length})`);
  conceptos[0].value = LINEA.concepto;
  numeros[0].value = LINEA.cantidad;
  numeros[1].value = LINEA.precio;

  const primaria = n.find((x) => x.tagName === 'BUTTON' && /^(Emitir|Generar)/.test(texto(x)));
  assert.ok(primaria, '🔴 SUELO: la pantalla no tiene acción primaria');

  primaria.disparar('click');
  await respirar();

  return {
    banco: b,
    navegaciones,
    peticiones,
    contenedor: r.contenedor,
    hojas: todos(b.ctx.document.body).filter((x) => String(x.className || '').includes('modal-overlay')),
    // La superficie de envío INCLUYE la hoja: el presupuesto la abre en `document.body`.
    envio: [...new Set([...deEnvio(b.ctx.document.body), ...deEnvio(r.contenedor)])],
  };
}

/**
 * Monta la ficha a la que la emisión acaba de mandar, **con el id que ella pidió**.
 *
 * 🔴 EL ID NO SE ESCRIBE A MANO. Se toma de la navegación observada. Si el front navegara con un
 * id equivocado —o sin él—, esto montaría el documento equivocado o fallaría, en vez de dar un
 * verde sobre una ficha que nadie pidió.
 */
async function montarLaFicha(navegacion, { conTelefono = true } = {}) {
  const id = navegacion && navegacion.opciones && navegacion.opciones.invoiceId;
  assert.ok(id, `🔴 la navegación no lleva \`invoiceId\`: ${JSON.stringify(navegacion)}`);
  const { b } = banco({ conTelefono });
  b.ctx.appDocumentoSuelto = 'factura';
  const r = await pintarVista(b, 'renderInvoiceDetailView', id);
  assert.equal(r.error, null, `🔴 la ficha del documento no monta: ${r.error && r.error.message}`);
  return { id, contenedor: r.contenedor, botones: pulsables(r.contenedor) };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SUELO · sin esto, «la factura no tenía envío» podría ser un fallo del instrumento
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-600d · 🔴 SUELO: el barrido VE envío donde lo hay, o no puede decir dónde no lo hay', async () => {
  const r = await emitir({ suelto: false });

  // El presupuesto SÍ tiene envío desde siempre. Si aquí saliera 0, el instrumento estaría ciego
  // y el «cero» de la factura no significaría nada — que es exactamente lo que pasó la primera
  // vez que se corrió esta medición, con el doble de red mal apuntado a `/admin/quotes`.
  assert.ok(r.envio.length >= 3,
    `🔴 CIEGO: tras generar un presupuesto el barrido sólo ve ${r.envio.length} salidas de envío `
    + `(${JSON.stringify(r.envio)}), y la hoja ofrece WhatsApp, email y PDF. Si el instrumento no `
    + 'las ve aquí, su «cero» en la factura no prueba nada.');

  assert.equal(r.hojas.length, 1,
    `🔴 CIEGO: el presupuesto tenía que abrir su hoja y se han visto ${r.hojas.length}.`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL DEFECTO · tras emitir, el profesional tiene que poder ENVIAR
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-600d · 🔴 tras emitir, el destino es la FICHA del documento, con su id', async () => {
  const r = await emitir({ suelto: true });

  assert.equal(r.navegaciones.length, 1,
    `🔴 tras emitir se esperaba UNA navegación y hubo ${r.navegaciones.length}: ${JSON.stringify(r.navegaciones)}`);

  const nav = r.navegaciones[0];
  assert.equal(nav.vista, 'invoice-detail',
    `🔴 TRAS EMITIR SE VA A «${nav.vista}» Y NO A LA FICHA DEL DOCUMENTO.\n`
    + '  Al listado no se puede enviar nada: el profesional emite y se queda sin forma de\n'
    + '  mandárselo al cliente. Ése es el ticket entero.');

  assert.equal(nav.opciones && nav.opciones.invoiceId, ID_EMITIDO,
    `🔴 la navegación no lleva el id del documento recién emitido: ${JSON.stringify(nav.opciones)}.\n`
    + '  Sin id, la ficha abre en «Sin documento seleccionado» y el destino no sirve de nada.');
});

test('SCRUM-600d · 🔴 EL CONTROL QUE DECIDE: en ese destino SÍ se puede enviar', async () => {
  // No basta con navegar bien: hay que MONTAR el destino y comprobar que ofrece el envío. Un
  // test que sólo mirase los argumentos de la navegación estaría comprobando mi propia edición
  // contra sí misma.
  const r = await emitir({ suelto: true });
  const ficha = await montarLaFicha(r.navegaciones[0]);

  assert.equal(ficha.id, ID_EMITIDO, '🔴 la ficha se ha montado con un id que no es el emitido');

  const envio = deEnvio(ficha.contenedor);
  assert.ok(envio.some((t) => /WhatsApp/i.test(t)),
    `🔴 la ficha del documento recién emitido NO ofrece WhatsApp. Salidas vistas: ${JSON.stringify(envio)}.\n`
    + '  Emitir y no poder mandar es el producto partido por la mitad.');
  assert.ok(envio.some((t) => /PDF/i.test(t)),
    `🔴 la ficha no ofrece el PDF. Salidas vistas: ${JSON.stringify(envio)}`);

  // Y el botón está VIVO: uno deshabilitado con un cliente que sí tiene teléfono sería un
  // destino igual de inútil que el listado.
  const wa = ficha.botones.find((x) => /Enviar por WhatsApp/i.test(texto(x)));
  assert.ok(wa && !wa.disabled,
    '🔴 el botón de WhatsApp llega DESHABILITADO con un cliente que sí tiene teléfono');
});

test('SCRUM-600d · 🔴 RESPALDO: si el alta no trae id, se vuelve al listado — nunca a una ficha vacía', async () => {
  // Un destino que depende de un campo tiene que decir qué hace cuando ese campo no viene. Sin
  // esto, un cambio de forma en la respuesta dejaría al profesional en «Sin documento
  // seleccionado» DESPUÉS de haber emitido de verdad: parecería que no se ha emitido.
  const r = await emitir({ suelto: true, respuestaDelAlta: { ok: true } });

  assert.equal(r.navegaciones.length, 1, `🔴 se esperaba una navegación: ${JSON.stringify(r.navegaciones)}`);
  assert.equal(r.navegaciones[0].vista, 'invoices',
    `🔴 sin id, el destino tiene que ser el listado y ha sido «${r.navegaciones[0].vista}».`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ✅ POSITIVO · el presupuesto es EL MISMO MANEJADOR. Si se toca mal, se rompe lo que funciona
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-600d · ✅ POSITIVO: el envío del PRESUPUESTO sigue EXACTAMENTE igual', async () => {
  const r = await emitir({ suelto: false });

  // ① sigue abriendo su hoja, y no navega a ninguna parte
  assert.equal(r.hojas.length, 1, '🔴 el presupuesto ha dejado de abrir su hoja tras generarse');
  assert.deepEqual(r.navegaciones, [],
    `🔴 el presupuesto ha empezado a NAVEGAR tras generarse: ${JSON.stringify(r.navegaciones)}.\n`
    + '  Su flujo es la hoja, no un cambio de pantalla. Esto sería el arreglo de la factura\n'
    + '  desbordándose sobre el camino que ya funcionaba.');

  // ② las CUATRO salidas siguen ahí, nombradas. Un `length >= 3` dejaría pasar que se pierda
  //    justo la de email sin que nadie se entere.
  for (const esperada of [/Enviar por WhatsApp/i, /Enviar por email/i, /Descargar PDF/i, /Abrir PDF/i]) {
    assert.ok(r.envio.some((t) => esperada.test(t)),
      `🔴 la hoja del presupuesto ha perdido una salida (${esperada}). Quedan: ${JSON.stringify(r.envio)}`);
  }

  // ③ y sigue pidiendo el detalle para el PDF: es la petición que alimenta su visor
  assert.ok(r.peticiones.some((p) => /GET \/admin\/quotes\/99$/.test(p)),
    `🔴 el presupuesto ha dejado de pedir su detalle: ${JSON.stringify(r.peticiones)}`);
});

test('SCRUM-600d · ✅ POSITIVO: la factura sigue emitiendo por donde emitía', async () => {
  // El arreglo toca lo que pasa DESPUÉS del 201. Que el 201 siga pidiéndose igual es lo que
  // separa «he cambiado el destino» de «he tocado la emisión» (regla 38).
  const r = await emitir({ suelto: true });
  assert.ok(r.peticiones.some((p) => p === 'POST /admin/invoices'),
    `🔴 la factura ha dejado de darse de alta en /admin/invoices: ${JSON.stringify(r.peticiones)}`);
  assert.equal(r.peticiones.filter((p) => p === 'POST /admin/invoices').length, 1,
    `🔴 el alta se ha pedido más de una vez: ${JSON.stringify(r.peticiones)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ✅ NEGATIVO · sin teléfono
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-600d · ✅ NEGATIVO: sin teléfono, el WhatsApp del destino avisa y no miente', async () => {
  const r = await emitir({ suelto: true, conTelefono: false });
  const ficha = await montarLaFicha(r.navegaciones[0], { conTelefono: false });

  const wa = ficha.botones.find((x) => /Enviar por WhatsApp/i.test(texto(x)));
  assert.ok(wa, '🔴 el botón de WhatsApp ha desaparecido de la ficha cuando el cliente no tiene teléfono');

  // 🔴 SE COMPRUEBA QUE AVISA, NO CÓMO. El botón sigue estando —esconderlo dejaría al
  // profesional sin saber por qué no puede enviar— y está deshabilitado CON MOTIVO ESCRITO.
  assert.equal(wa.disabled, true,
    '🔴 sin teléfono el botón de WhatsApp queda PULSABLE: el profesional lo intenta y no pasa nada');
  assert.match(String(wa.title || ''), /tel[ée]fono/i,
    `🔴 el botón está deshabilitado y NO dice por qué (title=${JSON.stringify(wa.title)}). Un control `
    + 'apagado sin motivo es peor que uno que falla: no se puede arreglar lo que no se explica.');

  // ⚠️ DIVERGENCIA MEDIDA Y DECLARADA, no un descuido. El PRESUPUESTO hace lo contrario: su botón
  // se pulsa y es el SERVIDOR quien contesta el motivo (`quotesView.js:296`,
  // `customer_missing_phone`). Las dos conductas están COPIADAS de código que ya existe; ninguna
  // es inventada. Se elige la de la ficha porque es la que ese profesional ya ve en TODAS sus
  // demás facturas, y dos pantallas de factura que se comportan distinto ante el mismo cliente
  // sería un defecto nuevo. Cambiar a la del presupuesto obliga a reutilizar `openQuoteModal`, y
  // eso son CINCO textos nuevos (regla 30) — el motivo largo está en `quotesView.js`.
});

test('SCRUM-600d · ✅ NEGATIVO: sin teléfono se sigue emitiendo y se sigue llegando a la ficha', async () => {
  // El aviso es del ENVÍO, no de la emisión: una factura a un cliente sin WhatsApp se emite
  // igual. Si esto cayera, el arreglo habría convertido «no puedo enviar» en «no puedo emitir».
  const r = await emitir({ suelto: true, conTelefono: false });
  assert.ok(r.peticiones.some((p) => p === 'POST /admin/invoices'),
    '🔴 sin teléfono la factura ni siquiera se emite');
  assert.equal(r.navegaciones[0] && r.navegaciones[0].vista, 'invoice-detail',
    `🔴 sin teléfono el destino cambia: ${JSON.stringify(r.navegaciones)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⛔ REGLA 30 · este ticket no estrena NI UN RÓTULO
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-600d · ⛔ el destino no estrena microcopy: todo lo que dice ya estaba aprobado', async () => {
  // El arreglo consiste en LLEGAR a una pantalla que ya existe, no en escribir una nueva. Este
  // control lo sujeta: si alguien resolviera el envío inventando textos, la ficha empezaría a
  // decir cosas que su propia pantalla no dice hoy.
  const r = await emitir({ suelto: true });
  const ficha = await montarLaFicha(r.navegaciones[0]);

  // Los rótulos del destino son los que la ficha ya pinta cuando se llega a ella por el listado,
  // que es como se llegaba hasta hoy. Se comprueban los del envío, que son los que este ticket
  // pone en juego.
  const envio = deEnvio(ficha.contenedor).sort();
  assert.deepEqual(envio, ['Descargar PDF', 'Enviar por WhatsApp'],
    `🔴 las salidas de envío de la ficha han cambiado: ${JSON.stringify(envio)}.\n`
    + '  Si aquí aparece algo nuevo, es microcopy que nadie ha firmado (regla 30).');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LAS MUTACIONES QUE ME TUMBAN
// ═════════════════════════════════════════════════════════════════════════════════════════════

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Vuelve el defecto exacto de antes del ticket: se emite y se cae al listado, sin envío.
    fichero: 'public/dashboard/js/quotesView.js',
    de: '          if (idEmitido) window.renderAppView("invoice-detail", { invoiceId: idEmitido });',
    a: '          if (idEmitido) window.renderAppView("invoices");',
    cae: 'tras emitir, el destino es la FICHA del documento, con su id',
  },
  {
    // Navega a la ficha SIN el id: la pantalla abre en «Sin documento seleccionado». Es el
    // fallo que más se parece a que funcione, porque la navegación es la correcta.
    fichero: 'public/dashboard/js/quotesView.js',
    de: '          if (idEmitido) window.renderAppView("invoice-detail", { invoiceId: idEmitido });',
    a: '          if (idEmitido) window.renderAppView("invoice-detail");',
    cae: 'tras emitir, el destino es la FICHA del documento, con su id',
  },
  {
    // Se carga el respaldo: sin id, a la ficha vacía. Emitida de verdad y pantalla en blanco.
    fichero: 'public/dashboard/js/quotesView.js',
    de: '          else window.renderAppView("invoices");',
    a: '          else window.renderAppView("invoice-detail");',
    cae: 'RESPALDO: si el alta no trae id, se vuelve al listado — nunca a una ficha vacía',
  },
];
