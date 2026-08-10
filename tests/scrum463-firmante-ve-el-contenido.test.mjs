// tests/scrum463-firmante-ve-el-contenido.test.mjs — SCRUM-463
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA PREGUNTA: ¿VE EL FIRMANTE LO QUE ESTÁ FIRMANDO?
//
// Todo el bloque H se apoya en que **el cliente firma en el móvil del profesional** (H0,
// SCRUM-355 §1). Un albarán firmado sirve para ganar la discusión de «yo no pedí eso»; si quien
// firma no vio las líneas, la firma **prueba mucho menos de lo que creemos** — y se la vendemos al
// profesional como su garantía.
//
// ⚠️ ESTO NO ES INTERFAZ. Es qué respalda una firma.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ SE EJERCITA Y NO SE LEE
//
// Que un componente exista no prueba que se pinte en ese camino: es «mencionar no es hacer»
// aplicado a píxeles. Así que la pantalla del panel se **carga de verdad** con el banco de
// SCRUM-417 y se mira **el DOM que sale**, no el fichero. La página pública se renderiza con su
// propio código y se lee **el HTML que devuelve**.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
// La herramienta de la casa para leer un fuente SIN comentarios (SCRUM-193).
import { leerFuente } from './_guard-texto.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── EL ALBARÁN DE PRUEBA ─────────────────────────────────────────────────────────────────
//
// Valores DISTINTIVOS a propósito: si la pantalla los pinta, se encuentran; y no pueden aparecer
// por casualidad en el marcado. La lección de SCRUM-452 —un valor que es subcadena de otro hace
// que el test mida una coincidencia en vez de un comportamiento.
const CONCEPTO = 'ZZCONCEPTO sustitucion de bajante';
const CANTIDAD = 4321;
const IMPORTE = 987654;
const CLIENTE = 'ZZCLIENTE comunidad alcala';

const ALBARAN = Object.freeze({
  id: 77, jobId: 7, numero: 'ALB-463-1', estado: 'emitido', version: 1,
  fecha: '2026-08-01T09:00:00.000Z', modoValoracion: 'VALORADO',
  lineas: [{ concepto: CONCEPTO, cantidad: CANTIDAD, unidad: 'm', precioUnitario: IMPORTE, tipoIva: 21 }],
  totales: { base: IMPORTE * CANTIDAD, cuota: 0, total: IMPORTE * CANTIDAD },
  notas: null, lugarEntrega: 'Nave 4', fechaEntrega: null,
  firmadoPorNombre: null, firmadoPorCalidad: null, firmadoAt: null,
  pdfUrl: '/admin/albaranes/77/pdf', facturado: false,
  customer: { id: 9, name: CLIENTE },
});

/** Todo el texto que la pantalla puso en el DOM, junto. Es lo que un firmante tendría delante. */
function textoVisible(contenedor) {
  return todos(contenedor)
    .map((n) => `${n.textContent || ''} ${n.innerHTML || ''}`)
    .join(' ')
    .replace(/\s+/g, ' ');
}

// ── SUELO · EL CENSO DE CAMINOS DE FIRMA ─────────────────────────────────────────────────

test('SCRUM-463 · SUELO: hay DOS caminos de firma, y los dos se encuentran', () => {
  // Si el censo devolviera cero, «ningún camino esconde el contenido» y «no supe encontrarlos»
  // serían el mismo verde. Y son dos superficies distintas: una sola comprobada es media respuesta.
  const panel = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/albaranDetailView.js'), 'utf8');
  const publica = fs.readFileSync(path.join(RAIZ, 'src/modules/jobs/app/routes/albaranPublic.routes.ts'), 'utf8');

  assert.match(panel, /\/admin\/albaranes\/\$\{alb\.id\}\/firmar/,
    '🔴 no se encuentra el camino de firma del PANEL (el móvil del profesional).');
  assert.match(publica, /router\.post\('\/:token\/firmar'/,
    '🔴 no se encuentra el camino de firma de la PÁGINA PÚBLICA (el móvil del cliente).');
});

// ── 🔴 CAMINO 1 · EL PANEL — el móvil del profesional, donde firma el cliente ─────────────

test('SCRUM-463 · 🔴 EL PANEL: la pantalla desde la que se firma NO pinta el contenido', async () => {
  // Se EJERCITA: se carga el dashboard entero y se pinta la vista de detalle del albarán, que es
  // la que lleva el botón «Firmar aquí mismo» (`albaranDetailView.js`).
  const banco = cargarDashboard(RAIZ);
  banco.ctx.apiRequest = async (ruta) => {
    if (/\/admin\/albaranes\/77$/.test(ruta)) return ALBARAN;
    if (/\/admin\/jobs\/7$/.test(ruta)) return { id: 7, titulo: 'Trabajo', customer: ALBARAN.customer };
    return {};
  };
  // ⚠️ El banco no resuelve `destinoEfectivo` (devuelve `undefined` y la vista revienta en
  // `cubos[destino].push`). Se le da esa pieza —que decide DÓNDE va cada BOTÓN— porque no es lo
  // que se mide aquí: lo que se mide es si el CONTENIDO del albarán llega al DOM. Suplir el
  // reparto de botones no puede fabricar unas líneas que la vista no pinte.
  banco.ctx.destinoEfectivo = () => 'secundaria';

  const r = await pintarVista(banco, 'renderAlbaranDetailView');

  // SUELO del propio ejercicio: si la vista revienta o no pinta nada, lo de abajo no mide nada.
  assert.equal(r.error, null,
    `🔴 la pantalla de detalle del albarán REVIENTA al abrirse: ${r.error && r.error.message}`);
  assert.ok(r.nodos > 1,
    `🔴 la vista no pintó nada (${r.nodos} nodo): no se puede afirmar qué enseña ni qué esconde.`);

  const texto = textoVisible(r.contenedor);

  // 🔴 LA MEDICIÓN. Cada campo por separado: «no ve el contenido» sin decir cuál no sirve para
  // decidir nada.
  const faltan = [];
  if (!texto.includes(CONCEPTO)) faltan.push('las LÍNEAS (el concepto)');
  if (!texto.includes(String(CANTIDAD))) faltan.push('la CANTIDAD');
  if (!texto.includes(String(IMPORTE))) faltan.push('el IMPORTE');
  if (!texto.includes(CLIENTE)) faltan.push('el CLIENTE');

  // ⚠️ ESTE TEST DOCUMENTA LO MEDIDO HOY, NO LO EXIGE. La decisión de qué se enseña y dónde es de
  // producto, y tocar la pantalla de firma roza el sellado (regla 38): SCRUM-463 midió y paró.
  // Si un día se arregla, este test caerá — y caerá diciendo que ya se ve, que es una buena noticia
  // y hay que venir a actualizarlo, no a silenciarlo.
  assert.deepEqual(
    faltan,
    ['las LÍNEAS (el concepto)', 'la CANTIDAD', 'el IMPORTE', 'el CLIENTE'],
    '🔴 LO QUE ENSEÑA LA PANTALLA DE FIRMA DEL PANEL HA CAMBIADO.\n\n' +
    `  Medido el 11-ago-2026: NO pintaba ninguno de los cuatro. Ahora faltan: ${faltan.join(', ') || '(ninguno)'}.\n\n` +
    '  · Si faltan MENOS, alguien lo ha arreglado: actualiza esta lista y avisa, es la buena.\n' +
    '  · Si faltan MÁS, se ha quitado algo de una pantalla desde la que se FIRMA.\n\n' +
    '  Recuerda para qué sirve: un albarán firmado gana la discusión de «yo no pedí eso». Si quien\n' +
    '  firma no vio las líneas, la firma prueba mucho menos de lo que le vendemos al profesional.');
});

test('SCRUM-463 · CONTROL NEGATIVO: el banco SÍ ve el contenido cuando una vista lo pinta', () => {
  // Sin esto, el test de arriba se cumpliría con un banco que no sabe leer texto — y «no lo pinta»
  // sería indistinguible de «no supe mirar», que es el defecto que esta casa persigue.
  const banco = cargarDashboard(RAIZ);
  const div = banco.mk('div');
  div.innerHTML = `<table><tr><td>${CONCEPTO}</td><td>${CANTIDAD}</td><td>${IMPORTE}</td></tr></table>` +
    `<p>${CLIENTE}</p>`;
  const texto = textoVisible(div);

  for (const [que, valor] of [['concepto', CONCEPTO], ['cantidad', CANTIDAD], ['importe', IMPORTE], ['cliente', CLIENTE]]) {
    assert.ok(texto.includes(String(valor)),
      `🔴 el banco NO ve «${que}» aunque esté pintado: entonces su «no lo pinta» no vale nada.`);
  }
});

// ── CAMINO 2 · LA PÁGINA PÚBLICA — el móvil del cliente ──────────────────────────────────

test('SCRUM-463 · LA PÚBLICA sí pinta las líneas y el cliente — pero NO el importe', () => {
  // Aquí no hace falta banco: la página se construye en el servidor y su marcado está en el
  // fuente. Lo que se mide es qué HAY en el HTML que se le manda al cliente.
  const publica = fs.readFileSync(path.join(RAIZ, 'src/modules/jobs/app/routes/albaranPublic.routes.ts'), 'utf8');

  // Lo que SÍ: la tabla de líneas y el nombre del cliente.
  assert.match(publica, /class="lines-table"/,
    '🔴 la página pública ha dejado de pintar la tabla de líneas: el cliente firmaría a ciegas.');
  assert.match(publica, /l\?\.concepto/, '🔴 la tabla ya no pinta el concepto de cada línea.');
  assert.match(publica, /l\?\.cantidad/, '🔴 la tabla ya no pinta la cantidad de cada línea.');
  assert.match(publica, /Hola, \$\{customerName\}/,
    '🔴 la página ya no saluda al cliente por su nombre: no consta a quién se le enseña.');

  // 🔴 Y lo que NO: ni precio unitario, ni totales, ni el modo de valoración. Un albarán VALORADO
  // se firma sin que el cliente vea un solo importe.
  for (const ausente of ['precioUnitario', 'calcAlbaranTotales', 'totales']) {
    assert.ok(!publica.includes(ausente),
      `🔴 la página pública ya menciona «${ausente}». Si ahora enseña importes, esta medición ha ` +
      'cambiado: actualízala en `docs/master/SCRUM-463.md` en vez de borrar el assert.');
  }
});

test('SCRUM-463 · SUELO de la medición pública: el fichero se lee y trae su marcado', () => {
  // Si el fichero cambiara de sitio o se leyera vacío, los `!includes` de arriba pasarían todos
  // por no encontrar nada — el verde hueco de siempre.
  const publica = fs.readFileSync(path.join(RAIZ, 'src/modules/jobs/app/routes/albaranPublic.routes.ts'), 'utf8');
  assert.ok(publica.length > 5000, `🔴 solo se han leído ${publica.length} caracteres de la página pública.`);
  assert.match(publica, /btn-sign/, '🔴 no se encuentra el botón de firmar: no estoy leyendo la página de firma.');
});

// ── EL REMATE: NO ES QUE NO LO PINTE, ES QUE NO LO LEE ────────────────────────────────────

test('SCRUM-463 · el detalle del albarán no lee NI UN campo del contenido — «mencionar no es hacer»', () => {
  // El ejercicio de arriba demuestra que el contenido no llega al DOM. Esto demuestra POR QUÉ: la
  // vista ni siquiera consulta esos campos. Es la otra mitad, y hace el diagnóstico accionable —
  // no es un fallo de pintado ni de datos que no llegan: la pantalla no sabe de ellos.
  //
  // ⚠️ `leerFuente` (SCRUM-193) quita los comentarios, y aquí importa: `concepto` aparece UNA vez
  // en el fichero y es dentro de un comentario. Contarla habría dicho que la vista lo usa.
  const enCodigo = leerFuente(path.join(RAIZ, 'public/dashboard/js/albaranDetailView.js'));

  const usados = ['concepto', 'cantidad', 'precioUnitario', 'lineas', 'totales']
    .filter((c) => new RegExp(`\b${c}\b`).test(enCodigo));

  assert.deepEqual(usados, [],
    `🔴 LA PANTALLA DE FIRMA DEL PANEL YA LEE ${usados.join(', ')}.\n\n` +
    '  Medido el 11-ago-2026: no leía ninguno. Si ahora los lee, puede que alguien lo haya\n' +
    '  arreglado —es la buena noticia— y esta medición hay que actualizarla en\n' +
    '  `docs/master/SCRUM-463.md` en vez de silenciar el assert.');

  // CONTROL POSITIVO dentro del mismo test: el lector NO devuelve vacío ni se come el código. Si
  // lo hiciera, «no usa ninguno» sería indistinguible de «no supe leer».
  assert.ok(enCodigo.length > 5000,
    `🔴 solo se han leído ${enCodigo.length} caracteres de la vista: el lector está ciego.`);
  assert.match(enCodigo, /renderAlbaranDetailView/,
    '🔴 el filtro se ha comido el código: no queda ni el nombre de la función que pinta la vista.');
});
