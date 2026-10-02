// tests/scrum1388-facturas-recibidas-literales-firmados.test.mjs — SCRUM-1388
//
// «Facturas recibidas» pintaba, cuando la carga fallaba, DOS cosas: el cartel con su texto (todavía
// con la marca de pendiente) y, debajo, un párrafo con el `err.message` tal cual. Medido en Edge el
// 2-oct-2026 sobre `origin/main` d2ed6c8a, con la puerta `requireRole('admin')` real: el profesional
// leía «API 403: forbidden» (sonda y salida en `docs/evidencias/scrum1388/`).
//
// LO QUE ESTE FICHERO FIJA
//
// ① Los CUATRO literales que firmó el fundador el 1-oct-2026, carácter a carácter, y su ficha.
// ② EL VIAJE: con el `apiRequest` REAL contra un 403, una red caída, un 500 y un 200 sin `miradas`,
//    la pantalla enseña el cartel —y se VE— con las palabras firmadas, y ninguna tripa.
// ③ Los tres estados se leen DISTINTOS: vacío de verdad · descuadre · error de carga. El que
//    importa es que el vacío y el descuadre no se confundan.
// ④ En el fichero no queda ni una marca de pendiente, y el recuento sale SIEMPRE, también con cero.
// ⑤ Lo que el ticket prohíbe tocar sigue diciendo lo que decía.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos, reglasQueOcultan } from './_banco-vistas.mjs';
import { aprobacionesDeMicrocopy } from './_microcopy-aprobada.mjs';
import { ranurasDe, MARCA } from './_ranuras-con-marcador.mjs';
import { casosEscritos } from './_casos-escritos.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const JS = path.join(RAIZ, 'public/dashboard/js');
const VISTA = path.join(JS, 'facturasRecibidasView.js');
const respirar = (ms = 0) => new Promise((r) => setTimeout(r, ms));

// Copiados de la descripción de SCRUM-1388 (tabla «Texto firmado»), no de la pantalla.
const FIRMADO = Object.freeze({
  titulo: 'Facturas recibidas',
  error: 'No hemos podido cargar tus facturas recibidas. Vuelve a intentarlo.',
  vacioDeVerdad: 'Todavía no tienes facturas recibidas en este periodo.',
  descuadre: 'Hemos revisado {N} gastos y no ha salido ninguna factura. No lo tomes como que no compraste: puede que no hayamos sabido leer alguno.',
});
const DESCUADRE_DE_UNO = 'Hemos revisado 1 gasto y no ha salido ninguna factura. No lo tomes como que no compraste: puede que no hayamos sabido leer alguno.';

/** Lo que NO puede leer un profesional: el texto de un error tal como lo compone el código. */
const TRIPA = /API \d{3}|forbidden|Failed to fetch|internal_error|respuesta_incompleta/;

const respuesta = (status, cuerpo) => ({
  ok: status >= 200 && status < 300, status, statusText: status === 403 ? 'Forbidden' : 'Internal Server Error',
  headers: { get: () => 'application/json' },
  json: async () => cuerpo,
  blob: async () => ({}), text: async () => JSON.stringify(cuerpo),
});
const libro = (o = {}) => ({ filas: [], miradas: 0, avisos: [], desde: null, hasta: null, ...o });

/** Monta la pantalla con el `apiRequest` REAL; `alPedir` contesta a la carga del libro. */
async function montar(alPedir) {
  const banco = cargarDashboard(RAIZ, {
    red: {
      fetch: async (url) => (/\/admin\/libros\/recibidas\.json\?/.test(String(url)) ? alPedir() : respuesta(200, {})),
    },
  });
  const r = await pintarVista(banco, 'renderFacturasRecibidasView');
  assert.equal(r.error, null, `SUELO: la pantalla revienta: ${r.error && r.error.message}`);
  await respirar(40);
  const nodos = todos(r.contenedor);
  // Lo que se LEE: el texto de cada nodo hoja. Dos pantallas se confunden si esta lista es la misma.
  const leido = nodos.filter((n) => !n.hijos.length).map((n) => String(n.textContent || '')).filter(Boolean);
  const tiene = (n, clase) => String(n.className || '').split(/\s+/).includes(clase);
  return {
    banco, nodos, leido,
    COPY: banco.ctx.FACTURAS_RECIBIDAS_COPY,
    carteles: (tono) => nodos.filter((n) => tiene(n, 'alert') && tiene(n, tono)),
    tablas: nodos.filter((n) => n.tagName === 'TABLE').length,
  };
}

// ¿SE VE UN CARTEL? El panel oculta un `.alert` de dos maneras, y las dos se LEEN de la hoja, no
// se copian aquí: vacío (`.alert:empty`) o sin tono (`.alert:not(.success)…`). El matcher del banco
// no resuelve `:not()` ni `:empty` y contesta «ciego» (`ocultoPorCss` da `null`, medido), así que se
// resuelven aquí esas dos y SOLO esas dos: si aparece una tercera regla que oculte un `.alert`,
// `seVe` lanza en vez de contestar. Medido además en Edge: `docs/evidencias/scrum1388/`.
const OCULTAN_UN_ALERT = reglasQueOcultan(RAIZ).filter((r) => /(^|[\s>+~,])\.alert\b/.test(r.selector)).map((r) => r.selector);
const SIN_TONO = OCULTAN_UN_ALERT.find((s) => s.startsWith('.alert:not('));
const TONOS = SIN_TONO ? [...SIN_TONO.matchAll(/:not\(\.([\w-]+)\)/g)].map((m) => m[1]) : [];
function seVe(n) {
  const conocidas = ['.alert:empty', SIN_TONO].filter(Boolean).sort();
  assert.deepEqual([...OCULTAN_UN_ALERT].sort(), conocidas,
    'CIEGO: las reglas que ocultan un `.alert` ya no son las dos que este test sabe resolver');
  assert.ok(TONOS.length >= 3, `CIEGO: solo leo ${TONOS.length} tonos en la regla que oculta el cartel sin tono`);
  const clases = String(n.className || '').split(/\s+/);
  return String(n.textContent || '') !== '' && TONOS.some((t) => clases.includes(t));
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ① LOS CUATRO LITERALES
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1388 · 🔴 los CUATRO literales son los firmados, carácter a carácter', async () => {
  const { COPY } = await montar(() => respuesta(200, libro()));
  assert.equal(typeof COPY, 'object', 'SUELO: la vista no publica `FACTURAS_RECIBIDAS_COPY`');
  assert.equal(COPY.titulo, FIRMADO.titulo);
  assert.equal(COPY.error, FIRMADO.error);
  assert.equal(COPY.vacioDeVerdad, FIRMADO.vacioDeVerdad);
  assert.equal(COPY.descuadre(40), FIRMADO.descuadre.replace('{N}', '40'));
  assert.equal(COPY.descuadre(2), FIRMADO.descuadre.replace('{N}', '2'));
});

test('SCRUM-1388 · el singular del descuadre se conserva: con 1 mirado va «1 gasto»', async () => {
  const { COPY } = await montar(() => respuesta(200, libro()));
  assert.equal(COPY.descuadre(1), DESCUADRE_DE_UNO);
});

test('SCRUM-1388 · los cuatro constan en SU ficha, y la firma es del fundador', () => {
  const ficha = aprobacionesDeMicrocopy().find((a) => a.ticket === 'SCRUM-1388' && a.ranura === 'facturas-recibidas');
  assert.ok(ficha, '🔴 no hay ficha `docs/microcopy/…-SCRUM-1388-facturas-recibidas.md`');
  assert.equal(ficha.firmante, 'fundador', `🔴 la ficha no lleva la firma del fundador (firma: ${ficha.firmante})`);
  assert.equal(ficha.aprobada, true);
  for (const [ranura, texto] of Object.entries(FIRMADO)) {
    assert.ok(ficha.literales.includes(texto), `🔴 «${ranura}» no está en la ficha tal como se firmó: ${texto}`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ② EL VIAJE — la carga falla de cuatro maneras, con el `apiRequest` REAL
// ═══════════════════════════════════════════════════════════════════════════════════════════════

const FALLOS = [
  // El cuerpo es el que contesta `requireRole('admin')` (src/core/http/authMiddleware.ts).
  { id: 'un 403 de la puerta de rol', pedir: () => respuesta(403, { error: 'forbidden', required_role: 'admin' }), crudo: 'API 403: forbidden' },
  { id: 'la red caída', pedir: () => { throw new TypeError('Failed to fetch'); }, crudo: 'Failed to fetch' },
  { id: 'un 500 sin frase', pedir: () => respuesta(500, { error: 'internal_error' }), crudo: 'API 500: internal_error' },
  // Aquí `apiRequest` NO falla: el 200 llega y es la vista la que decide que no vale.
  { id: 'un 200 sin `miradas`', pedir: () => respuesta(200, { filas: [] }), crudo: null },
];

const caso2 = casosEscritos(FALLOS, (fallo) => `SCRUM-1388 · 🔴 con ${fallo.id} se VE el cartel, con las palabras firmadas y sin tripa`, async (fallo) => {
  const p = await montar(fallo.pedir);

  // CONTROL POSITIVO de la negación de abajo: la tripa EXISTE y el patrón la ve. Es lo que el
  // `apiRequest` real le entrega a la vista; si un día deja de componerlo, esto lo dice.
  if (fallo.crudo) {
    const err = await p.banco.ctx.apiRequest('/admin/libros/recibidas.json?x=1').then(() => null, (e) => e);
    assert.ok(err, 'CIEGO: la carga no falla; no hay viaje que medir');
    assert.equal(err.message, fallo.crudo, 'el `apiRequest` real ya no compone este mensaje: revisa el caso');
    assert.match(err.message, TRIPA);
  }

  // El cartel sigue APARECIENDO: si desaparece, el fallo se lee como un periodo vacío.
  const rojos = p.carteles('error');
  assert.equal(rojos.length, 1, `🔴 con la carga rota hay ${rojos.length} carteles de error`);
  assert.equal(rojos[0].textContent, FIRMADO.error, '🔴 el cartel no dice el texto firmado');
  assert.equal(seVe(rojos[0]), true, '🔴 el cartel está en el DOM y el CSS lo oculta');

  const leido = p.leido.join(' ‖ ');
  assert.match(leido, /No hemos podido cargar tus facturas recibidas/);
  assert.doesNotMatch(leido, TRIPA, `🔴 la tripa del sistema en pantalla: ${leido}`);
  assert.equal(p.tablas, 0, '🔴 tabla pintada con la carga rota: se lee como «no compraste nada»');
  assert.ok(!p.leido.includes(FIRMADO.vacioDeVerdad), '🔴 con la carga rota la pantalla afirma que no tienes facturas recibidas');
});
test('SCRUM-1388 · 🔴 con un 403 de la puerta de rol se VE el cartel, con las palabras firmadas y sin tripa', caso2(0));
test('SCRUM-1388 · 🔴 con la red caída se VE el cartel, con las palabras firmadas y sin tripa', caso2(1));
test('SCRUM-1388 · 🔴 con un 500 sin frase se VE el cartel, con las palabras firmadas y sin tripa', caso2(2));
test('SCRUM-1388 · 🔴 con un 200 sin `miradas` se VE el cartel, con las palabras firmadas y sin tripa', caso2(3));
caso2.todos();

test('SCRUM-1388 · CONTROL del instrumento de «se ve»: sin tono o vacío, un cartel NO se ve', async () => {
  const { banco } = await montar(() => respuesta(200, libro()));
  const hacer = (clase, texto) => { const n = banco.mk('div'); n.className = clase; n.textContent = texto; return n; };
  assert.equal(seVe(hacer('alert fr-alert', 'algo')), false, 'CIEGO: da por visible un `.alert` sin tono');
  assert.equal(seVe(hacer('alert error fr-alert', '')), false, 'CIEGO: da por visible un `.alert` vacío');
  assert.equal(seVe(hacer('alert error fr-alert', 'algo')), true, 'el instrumento no da por visible ninguno: tampoco vale');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ③ LOS TRES ESTADOS SE LEEN DISTINTOS
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1388 · 🔴 vacío de verdad, descuadre y error de carga NO se confunden', async () => {
  const vacio = await montar(() => respuesta(200, libro({ miradas: 0 })));
  const descuadre = await montar(() => respuesta(200, libro({ miradas: 3 })));
  const error = await montar(() => respuesta(403, { error: 'forbidden', required_role: 'admin' }));
  const del3 = FIRMADO.descuadre.replace('{N}', '3');

  // El vacío de verdad dice que no hay, y NO avisa de nada.
  assert.ok(vacio.leido.includes(FIRMADO.vacioDeVerdad), '🔴 con cero gastos mirados no lo dice');
  assert.ok(!vacio.leido.includes(del3) && vacio.carteles('warning').length === 0,
    '🔴 un periodo legítimamente vacío se presenta como un descuadre');

  // El descuadre avisa, se ve, y NO dice «no tienes».
  const avisos = descuadre.carteles('warning').filter((n) => n.textContent === del3);
  assert.equal(avisos.length, 1, `🔴 con 3 gastos mirados y 0 filas no sale el aviso firmado: ${descuadre.leido.join(' ‖ ')}`);
  assert.equal(seVe(avisos[0]), true, '🔴 el aviso de descuadre está en el DOM y el CSS lo oculta');
  assert.ok(!descuadre.leido.includes(FIRMADO.vacioDeVerdad), '🔴 el descuadre se funde con «no tienes»: el asesor leería «no compró nada»');

  // El error no dice ni lo uno ni lo otro.
  assert.ok(error.leido.includes(FIRMADO.error));
  assert.ok(!error.leido.includes(FIRMADO.vacioDeVerdad) && !error.leido.includes(del3));

  // Y como CONJUNTOS: las tres pantallas no pueden leerse igual, dos a dos.
  const firma = (p) => JSON.stringify(p.leido);
  assert.equal(new Set([firma(vacio), firma(descuadre), firma(error)]).size, 3,
    '🔴 dos de los tres estados se leen exactamente igual');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ④ NI UNA MARCA DE PENDIENTE — y el recuento sale siempre
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1388 · 🔴 en la pantalla no queda ninguna marca de pendiente, ni en el fichero ni en lo pintado', async (t) => {
  // CONTROL POSITIVO: el mismo lector ve las de un fichero que SÍ las tiene.
  assert.ok(ranurasDe(path.join(JS, 'productsView.js')).length > 0,
    'CIEGO: el lector de marcas no ve ninguna en productsView.js, que las tiene');

  const fuente = fs.readFileSync(VISTA, 'utf8');
  const enElFichero = ranurasDe(VISTA).length + (fuente.split(MARCA).length - 1);
  t.diagnostic(`marcas de pendiente en facturasRecibidasView.js: ${enElFichero}`);
  assert.equal(enElFichero, 0, '🔴 el fichero vuelve a llevar la marca de pendiente');

  let pintadas = 0;
  const estados = [
    () => respuesta(200, libro({ miradas: 0 })),
    () => respuesta(200, libro({ miradas: 3 })),
    () => respuesta(403, { error: 'forbidden', required_role: 'admin' }),
    () => respuesta(200, libro({ miradas: 1, filas: [{ fechaApunte: '2026-08-11', nombreProveedor: 'P', nifProveedor: 'B1', base: 100, cuota: 21, total: 121, moneda: 'EUR' }] })),
  ];
  for (const e of estados) {
    const p = await montar(e);
    assert.ok(p.leido.includes(FIRMADO.titulo), 'SUELO: la pantalla no pinta ni su título');
    pintadas += p.leido.reduce((n, x) => n + (x.split(MARCA).length - 1), 0);
  }
  t.diagnostic(`marcas de pendiente pintadas en ${estados.length} estados: ${pintadas}`);
  assert.equal(pintadas, 0, '🔴 la pantalla pinta la marca de pendiente');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ⑤ LO QUE EL TICKET PROHÍBE TOCAR
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1388 · lo que no se firmó no se ha tocado: menú, «Cargando…», columnas y periodo', async () => {
  const { COPY } = await montar(() => respuesta(200, libro()));
  const intactas = {
    menu: 'Facturas recibidas', cargando: 'Cargando…',
    colFecha: 'Fecha', colProveedor: 'Proveedor', colNif: 'NIF', colBase: 'Base', colIva: 'IVA', colTotal: 'Total',
    filaTotal: 'Total', etiquetaAnio: 'Año', etiquetaTrimestre: 'Trimestre', consultar: 'Consultar',
  };
  for (const [ranura, texto] of Object.entries(intactas)) assert.equal(COPY[ranura], texto, `🔴 «${ranura}» ha cambiado`);
  assert.equal(COPY.recuento(1), '1 factura recibida');
  assert.equal(COPY.recuento(4), '4 facturas recibidas');
});
