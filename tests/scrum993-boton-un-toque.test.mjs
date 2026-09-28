// tests/scrum993-boton-un-toque.test.mjs — SCRUM-993
//
// «ENTREGAR Y ENVIAR A FIRMAR»: crear + emitir + enviar, encadenados desde la hoja de alta.
//
// ── LO QUE ESTE FICHERO VIGILA, Y POR QUÉ CON EL DASHBOARD ENTERO ───────────────────────────
// Igual que SCRUM-1038 (`tests/scrum1038-leer-el-ticket-gasto.test.mjs`): se monta la ficha del
// Trabajo REAL (`renderJobDetailView`) con `cargarDashboard`, se abre la hoja de alta de verdad
// (`openAlbCrearSheet`/`buildAlbEditor`) y se dispara el clic de verdad. `apiRequest` es el doble
// para poder AFIRMAR el orden de las tres llamadas, no para simular el DOM.
//
// ⚠️ EL PRIMER CLIC NO EJECUTA NADA — es la condición de la firma (SCRUM-993 comentario 17261/62):
// abre la confirmación, y solo el segundo botón («Continuar») dispara la cadena.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista } from './_banco-vistas.mjs';
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// SCRUM-262 · ningún teléfono de prueba puede ser un móvil de rango real: `telefonoDePrueba(1)`.
const TELEFONO_DE_PRUEBA = telefonoDePrueba(1);

// Con número por defecto: desde la 2ª vuelta (opción A del orquestador, 28-sep) el botón SOLO
// existe cuando el cliente tiene teléfono o móvil. El caso sin número tiene su propio test.
const JOB_BASE = {
  id: 42, status: 'en_curso', createdAt: '2026-09-01T09:00:00Z', titulo: 'Reparación caldera',
  customer: { id: 5, name: 'Cliente Uno', phone: TELEFONO_DE_PRUEBA, mobile: null },
  asignados: [], operario: null, albaranes: [], gastos: [], notes: '',
  quote: null, direccion: null, totalAceptado: 0, totalCobrado: 0,
};

/** Dispara TODOS los oyentes de `click` de un nodo y espera a que terminen (patrón de SCRUM-1038). */
async function pulsar(nodo) {
  const fns = (nodo._oyentes && nodo._oyentes.click) || [];
  assert.ok(fns.length > 0, `🔴 CIEGO: «${nodo.textContent}» no tiene ningún oyente de clic`);
  await Promise.all(fns.map((fn) => fn.call(nodo, { type: 'click', target: nodo, preventDefault() {}, stopPropagation() {} })));
}

/**
 * ¿Sigue el nodo con ese id MONTADO en el documento? No basta `getElementById(id) === null`: el
 * mini-DOM (`_banco-vistas.mjs`, `removeChild`) desregistra el id del nodo quitado pero NO los de su
 * subárbol, así que tras `overlay.remove()` el «continuar» de dentro seguía resolviéndose por id —
 * medido: el test salía ROJO con la hoja ya cerrada. Se sube por `_padre` hasta `body`, que es lo
 * que en el navegador decide si `getElementById` lo encuentra.
 */
function sigueMontado(doc, id) {
  let n = doc.getElementById(id);
  while (n) {
    if (n === doc.body) return true;
    n = n._padre;
  }
  return false;
}

function botonPorTexto(doc, texto) {
  return [...doc.querySelectorAll('button')].find((b) => String(b.textContent).trim() === texto) || null;
}

/**
 * Monta la ficha, abre la hoja de alta y rellena una línea. `envio` deja elegir si el paso de
 * WhatsApp sale bien o mal, sin repetir el montaje en cada test.
 */
/** Un error con la forma del de `apiRequest` para un no-2xx (`api.js`: `err.status`, `err.data`). */
function errorDeApi(status, data) {
  const e = new Error(data && data.message ? data.message : `API ${status}`);
  e.status = status;
  e.data = data;
  return e;
}

async function prepararConHojaAbierta({ job = JOB_BASE, envio = { ok: true, sent: true }, emitir = { estado: 'emitido' }, conBoton = true } = {}) {
  const llamadas = [];
  const banco = cargarDashboard(RAIZ);
  banco.ctx.apiRequest = async (u, opts = {}) => {
    const url = String(u);
    const metodo = (opts && opts.method) || 'GET';
    if (/\/admin\/team/.test(url)) return [];
    if (/\/admin\/merchant/.test(url)) return { name: 'Epipe' };
    if (/\/admin\/partes/.test(url)) return { partes: [] };
    if (/gastos/.test(url)) return [];
    if (metodo === 'POST' && /\/admin\/jobs\/\d+\/albaranes$/.test(url)) {
      llamadas.push({ url, metodo, body: opts.body });
      return { id: 501, numero: 'ALB-2026-001', estado: 'borrador' };
    }
    if (metodo === 'POST' && /\/admin\/albaranes\/501\/emitir$/.test(url)) {
      llamadas.push({ url, metodo });
      if (emitir instanceof Error) throw emitir;
      return emitir;
    }
    if (metodo === 'POST' && /\/admin\/albaranes\/501\/enviar-para-firmar$/.test(url)) {
      llamadas.push({ url, metodo });
      if (envio instanceof Error) throw envio;
      return envio;
    }
    return job;
  };
  banco.ctx.appUserRole = 'admin';
  const r = await pintarVista(banco, 'renderJobDetailView');
  assert.equal(r.error, null, `🔴 SUELO: la ficha no monta (${r.error && r.error.message})`);

  const doc = banco.ctx.document;
  const newAlbBtn = botonPorTexto(doc, '+ Nuevo albarán');
  assert.ok(newAlbBtn, '🔴 CIEGO: no encuentro «+ Nuevo albarán»');
  await pulsar(newAlbBtn);

  const entregar = doc.getElementById('alb-entregar-firmar');
  if (conBoton) assert.ok(entregar, '🔴 CIEGO: la hoja de alta no abrió, o no lleva el botón «Entregar y enviar a firmar»');

  // Una línea con concepto y cantidad, para que `leerLineasDelFormulario` no la descarte. Los
  // `placeholder` se asignan como PROPIEDAD (`c.placeholder = 'Concepto'`), no con `setAttribute`,
  // así que el selector de atributo del banco no los ve (SCRUM-634): se toma por POSICIÓN dentro
  // de la última hoja abierta —`mkRow` pone concepto, cantidad, unidad, precio, iva, en ese orden.
  const overlays = doc.querySelectorAll('.modal-overlay');
  const overlay = overlays[overlays.length - 1];
  assert.ok(overlay, '🔴 CIEGO: no hay ninguna hoja (modal-overlay) abierta');
  const inputs = overlay.querySelectorAll('.input');
  const [concepto, cantidad] = inputs;
  assert.ok(concepto && cantidad, '🔴 CIEGO: no encuentro los campos de la línea del albarán');
  concepto.value = 'Sustituir termostato';
  cantidad.value = '1';

  return { banco, doc, llamadas, entregar };
}

test('SCRUM-993 · SUELO: la ficha monta y «+ Nuevo albarán» abre la hoja con el botón nuevo', async () => {
  const { doc } = await prepararConHojaAbierta();
  assert.ok(doc.getElementById('alb-entregar-firmar'), '🔴 no está el botón «Entregar y enviar a firmar»');
  assert.equal(doc.getElementById('alb-entregar-firmar').textContent, 'Entregar y enviar a firmar',
    '🔴 el rótulo no es el firmado (SCRUM-993 comentario 17261)');
});

test('SCRUM-993 · 🔴 EL PRIMER CLIC NO EJECUTA NADA: abre la confirmación, no llama a ningún endpoint', async () => {
  const { doc, llamadas, entregar } = await prepararConHojaAbierta();
  await pulsar(entregar);
  assert.deepEqual(llamadas, [], '🔴 el primer clic ya ha llamado a algo: tiene que abrir la confirmación, no ejecutar');
  const confirmBox = doc.getElementById('alb-confirmar-entrega');
  assert.equal(confirmBox.hidden, false, '🔴 la confirmación sigue oculta tras pulsar «Entregar y enviar a firmar»');
});

test('SCRUM-993 · con número, el texto de la confirmación es el firmado y nombra el canal', async () => {
  const { doc, entregar } = await prepararConHojaAbierta();
  await pulsar(entregar);
  // Solo el <p>, NO `confirmBox` entero: éste también contiene los botones («Entregar y enviar a
  // firmar»/«Cancelar»), que se concatenarían en `textContent` y falsearían la comparación.
  assert.equal(
    doc.getElementById('alb-confirmar-entrega').querySelector('p').textContent.trim(),
    'Esto emite el albarán —los datos del cliente quedan fijos en el documento— y lo envía a firmar por WhatsApp.',
    '🔴 con teléfono, el texto tiene que nombrar el canal (comentario 17263)',
  );
});

// ═══ 2ª VUELTA (orquestador, 28-sep, opción A) · medido en SCRUM-993 com. 17325 ═══════════════

test('SCRUM-993 · 🔴 SIN NÚMERO NO SE OFRECE: sin teléfono ni móvil la hoja no lleva el botón (y «Crear albarán» sí)', async () => {
  const { doc } = await prepararConHojaAbierta({
    job: { ...JOB_BASE, customer: { id: 5, name: 'Cliente Uno', phone: null, mobile: null } },
    conBoton: false,
  });
  assert.ok(doc.getElementById('alb-entregar-firmar') === null,
    '🔴 sin número el botón sigue ofreciéndose: emitiría (congela al cliente) y el envío fallaría siempre (409 customer_missing_phone)');
  assert.ok(doc.getElementById('alb-confirmar-entrega') === null, '🔴 sin botón no debe quedar una confirmación montada');
  assert.ok(botonPorTexto(doc, 'Crear albarán'), '🔴 CONTROL: la hoja de alta tiene que seguir ofreciendo «Crear albarán»');
});

test('SCRUM-993 · 🔴 un 409 del ENVÍO (lanza en apiRequest) cierra la hoja con el aviso de fallo, sin dejar «continuar» vivo', async () => {
  const { doc, llamadas, entregar } = await prepararConHojaAbierta({
    envio: errorDeApi(409, { ok: false, error: 'customer_missing_phone', message: 'Este cliente no tiene WhatsApp guardado.' }),
  });
  await pulsar(entregar);
  assert.ok(sigueMontado(doc, 'alb-confirmar-continuar'), '🔴 CIEGO: «continuar» no consta montado ANTES de pulsarlo');
  await pulsar(doc.getElementById('alb-confirmar-continuar'));

  assert.equal(llamadas.length, 3, '🔴 se esperaban las tres llamadas (crear/emitir/enviar)');
  assert.ok(!sigueMontado(doc, 'alb-confirmar-continuar'),
    '🔴 la hoja sigue abierta con «continuar»: un segundo clic crearía y EMITIRÍA otro albarán');
  const mensajes = [...(doc.getElementById('yaqu-toasts')?.children || [])].map((t) => t.dataset.msg);
  assert.ok(mensajes.includes('Albarán emitido — el envío por WhatsApp falló, reenvíalo desde el trabajo.'),
    `🔴 el 409 del envío no dice que el albarán YA se emitió. Toasts: ${JSON.stringify(mensajes)}`);
  assert.ok(!mensajes.includes('✓ Albarán entregado y enviado a firmar.'), '🔴 éxito pintado con el envío caído');
});

test('SCRUM-993 · 🔴 el aviso de ÉXITO solo sale con `sent === true` (condición de su firma)', async () => {
  const { doc, entregar } = await prepararConHojaAbierta({ envio: { ok: true, sent: true } });
  await pulsar(entregar);
  await pulsar(doc.getElementById('alb-confirmar-continuar'));
  const mensajes = [...(doc.getElementById('yaqu-toasts')?.children || [])].map((t) => t.dataset.msg);
  assert.ok(mensajes.includes('✓ Albarán entregado y enviado a firmar.'), `🔴 falta el aviso de éxito. Toasts: ${JSON.stringify(mensajes)}`);

  // Una respuesta 2xx que NO dice `sent: true` no es un envío confirmado.
  const otra = await prepararConHojaAbierta({ envio: { ok: true } });
  await pulsar(otra.entregar);
  await pulsar(otra.doc.getElementById('alb-confirmar-continuar'));
  const m2 = [...(otra.doc.getElementById('yaqu-toasts')?.children || [])].map((t) => t.dataset.msg);
  assert.ok(!m2.includes('✓ Albarán entregado y enviado a firmar.'), `🔴 éxito pintado sin \`sent: true\`. Toasts: ${JSON.stringify(m2)}`);
});

test('SCRUM-993 · 🔴 si falla EMITIR tras crear, la hoja se cierra: no se puede volver a crear otro', async () => {
  const { doc, llamadas, entregar } = await prepararConHojaAbierta({
    emitir: errorDeApi(409, { error: 'x', message: 'Error del servidor al emitir.' }),
  });
  await pulsar(entregar);
  assert.ok(sigueMontado(doc, 'alb-confirmar-continuar'), '🔴 CIEGO: «continuar» no consta montado ANTES de pulsarlo');
  await pulsar(doc.getElementById('alb-confirmar-continuar'));

  assert.equal(llamadas.length, 2, '🔴 con emitir caído no debe intentarse el envío');
  assert.ok(!sigueMontado(doc, 'alb-confirmar-continuar'),
    '🔴 la hoja sigue abierta con «continuar» tras crear: el siguiente clic crearía un segundo albarán');
  // Texto firmado en SCRUM-993 comentario 17337: dice que el borrador YA EXISTE. Y nunca el
  // `message` crudo del servidor (SCRUM-644).
  const mensajes = [...(doc.getElementById('yaqu-toasts')?.children || [])].map((t) => t.dataset.msg);
  assert.ok(mensajes.includes('No se pudo completar la entrega. El albarán queda en borrador en este trabajo.'),
    `🔴 el fallo de emitir no dice que el borrador ya existe. Toasts: ${JSON.stringify(mensajes)}`);
  assert.ok(!mensajes.includes('Error del servidor al emitir.'), '🔴 se pintó el `message` crudo del servidor');
});

test('SCRUM-993 · 🔴 «Continuar» encadena las TRES llamadas, EN ORDEN, con un solo alta', async () => {
  const { doc, llamadas, entregar } = await prepararConHojaAbierta({
    job: { ...JOB_BASE, customer: { id: 5, name: 'Cliente Uno', phone: TELEFONO_DE_PRUEBA, mobile: null } },
  });
  await pulsar(entregar);
  const continuar = doc.getElementById('alb-confirmar-continuar');
  assert.ok(continuar, '🔴 CIEGO: no hay botón de continuar en la confirmación');
  await pulsar(continuar);

  assert.equal(llamadas.length, 3, `🔴 se esperaban 3 llamadas (crear/emitir/enviar); hubo ${llamadas.length}`);
  assert.match(llamadas[0].url, /\/admin\/jobs\/42\/albaranes$/, '🔴 la primera llamada no es la creación');
  assert.equal(llamadas[0].metodo, 'POST');
  assert.match(llamadas[1].url, /\/admin\/albaranes\/501\/emitir$/, '🔴 la segunda llamada no es emitir');
  assert.match(llamadas[2].url, /\/admin\/albaranes\/501\/enviar-para-firmar$/, '🔴 la tercera llamada no es enviar a firmar');

  const cuerpo = JSON.parse(llamadas[0].body);
  assert.equal(cuerpo.lineas.length, 1, '🔴 la línea rellenada no viajó en el cuerpo de creación');
  assert.equal(cuerpo.lineas[0].concepto, 'Sustituir termostato');
});

test('SCRUM-993 · 🔴 CONDICIÓN DE LA FIRMA: si el envío falla, el aviso dice que YA SE EMITIÓ', async () => {
  const { doc, llamadas, entregar } = await prepararConHojaAbierta({ envio: { ok: true, sent: false } });
  await pulsar(entregar);
  await pulsar(doc.getElementById('alb-confirmar-continuar'));

  // Las tres llamadas SÍ salieron — el fallo es del envío, no de la cadena.
  assert.equal(llamadas.length, 3, '🔴 un envío fallido no debería impedir que se intenten las tres llamadas');
  // `showToast` (api.js) crea `#yaqu-toasts` y guarda el texto EXACTO en `dataset.msg` — más fiable
  // que leer `textContent` (que un `setTimeout` de cierre podría vaciar antes de que este assert corra).
  const pila = doc.getElementById('yaqu-toasts');
  assert.ok(pila, '🔴 CIEGO: no hay ningún toast — el aviso de fallo no se disparó');
  const mensajes = [...pila.children].map((t) => t.dataset.msg);
  assert.ok(
    mensajes.includes('Albarán emitido — el envío por WhatsApp falló, reenvíalo desde el trabajo.'),
    `🔴 el aviso de fallo no dice que el albarán YA se emitió (SCRUM-993 comentario 17263, SCRUM-841). Toasts: ${JSON.stringify(mensajes)}`,
  );
});

test('SCRUM-993 · «Cancelar» de la confirmación vuelve a «Guardar»/«Entregar…» sin llamar a nada', async () => {
  const { doc, llamadas, entregar } = await prepararConHojaAbierta();
  await pulsar(entregar);
  const cancelar = doc.getElementById('alb-confirmar-cancelar');
  assert.ok(cancelar, '🔴 CIEGO: no hay botón de cancelar en la confirmación');
  await pulsar(cancelar);
  assert.deepEqual(llamadas, [], '🔴 cancelar la confirmación no debería llamar a nada');
  assert.equal(doc.getElementById('alb-confirmar-entrega').hidden, true, '🔴 la confirmación sigue visible tras cancelar');
  // `entregar` no tiene `hidden` propio: lo esconde su fila (`saveRow`, el padre) con
  // `style.display` (ver el comentario del propio código: `hidden` perdería contra ese estilo en
  // línea preexistente). Se comprueba el padre, no el botón.
  assert.equal(doc.getElementById('alb-entregar-firmar').parentNode.style.display, 'flex',
    '🔴 la fila de «Guardar»/«Entregar…» no vuelve a verse tras cancelar');
});

// ═══ CONTROL: «Guardar» sigue haciendo EXACTAMENTE lo de antes (condición del orquestador) ═══

test('SCRUM-993 · CONTROL: «Guardar» sigue creando UN albarán y NO emite ni envía nada', async () => {
  const { doc, llamadas } = await prepararConHojaAbierta();
  const guardar = botonPorTexto(doc, 'Crear albarán');
  assert.ok(guardar, '🔴 CIEGO: no encuentro el botón «Crear albarán» de la hoja de alta');
  await pulsar(guardar);

  assert.equal(llamadas.length, 1, `🔴 «Guardar» tiene que hacer UNA sola llamada (crear); hizo ${llamadas.length}`);
  assert.match(llamadas[0].url, /\/admin\/jobs\/42\/albaranes$/, '🔴 la llamada de Guardar no es la de creación');
  const cuerpo = JSON.parse(llamadas[0].body);
  assert.equal(cuerpo.lineas.length, 1, '🔴 «Guardar» ya no manda la línea rellenada: cambió de conducta');
});
