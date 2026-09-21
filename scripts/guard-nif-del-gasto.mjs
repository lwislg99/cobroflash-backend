// scripts/guard-nif-del-gasto.mjs — SCRUM-937b · EL NIF DEL GASTO NO SE TIRA EN SILENCIO (pantalla).
//
// Uso:  npm run guard:nif-del-gasto
//
// ── QUÉ SE MIDE ──────────────────────────────────────────────────────────────────────────────
// El NIF del proveedor vive en la FICHA del proveedor (SCRUM-324 E3). Un NIF tecleado sin proveedor
// no tiene dónde ir y el servidor lo descartaba sin decirlo. La mitad de servidor (SCRUM-937, #1499)
// ya lo dice: la respuesta de POST y PUT trae `destinoDelNif`. Falta la mitad de pantalla, con los
// textos firmados en SCRUM-937 comentario 15873:
//   🔴 A · sin proveedor elegido, el campo NIF es de SOLO LECTURA y debajo se ve, literal,
//          «Elige antes el proveedor: el NIF se guarda en su ficha.». Con un proveedor SIN NIF se
//          puede escribir y la ayuda no está; con un proveedor CON NIF se rellena y se bloquea (hoy).
//   🔴 B · si tras guardar la respuesta trae `destinoDelNif = 'sin_proveedor'`, se avisa, literal,
//          «Gasto guardado. El NIF no se ha guardado: para guardarlo, el gasto necesita un proveedor.»
//          — en el ALTA y en la EDICIÓN.
//   ✅ POSITIVO · proveedor sin NIF + NIF tecleado → se guarda en la ficha y NO hay aviso.
//
// Se pulsa y se teclea DE VERDAD sobre el modal REAL (`expensesView.js` + `api.js` +
// `modalHeader.js`), y se juzga el ESTADO: qué se puede escribir, qué se ve, qué recibió el servidor.
//
// 🔴 EL SERVIDOR NO INVENTA EL VEREDICTO: `destinoDelNif` lo calcula `queFueDelNif`, la función REAL
// compilada (`dist/`), con la ficha que queda tras guardar — como la ruta de verdad. La parte que
// imita es la de `guardarNifDelProveedor`: la ficha sólo se rellena si estaba vacía.
//
// ── POR QUÉ FUERA DE `npm test` ──────────────────────────────────────────────────────────────
// El banco de vistas no tiene `selectedOptions` ni `readOnly` que frene el teclado, ni pinta el aviso
// flotante: lo que se juzga (se puede escribir o no, se ve o no) sólo existe en un navegador.
//
// ── SUELO ────────────────────────────────────────────────────────────────────────────────────
// Si el modal no se pinta, la lista de proveedores no llega al selector o el servidor no recibe el
// guardado, sale con 2 (NO SUPE MEDIR). Salidas: 0 de acuerdo, 1 hallazgo, 2 ciego.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from './_navegador.mjs';
import { levantarServidor } from './_servidor.mjs';

export const SALIDA_HALLAZGO = 1;
export const SALIDA_NO_SUPE_MEDIR = 2;

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(RAIZ, 'public');
const SERVICIO = path.join(RAIZ, 'dist', 'modules', 'expenses', 'domain', 'expenses.service.js');
if (!fs.existsSync(SERVICIO)) {
  console.error('  🔴 NO SUPE MEDIR: falta dist/ (npm run build); sin él no hay veredicto real.');
  process.exit(SALIDA_NO_SUPE_MEDIR);
}
const { queFueDelNif } = await import(pathToFileURL(SERVICIO).href);
let PUERTO = Number(process.env.NIF_PUERTO || 0);

// Los literales firmados (SCRUM-937 comentario 15873). Si cambian, cambian aquí.
const AYUDA_A = 'Elige antes el proveedor: el NIF se guarda en su ficha.';
const AVISO_B = 'Gasto guardado. El NIF no se ha guardado: para guardarlo, el gasto necesita un proveedor.';
const NIF_FICHA = 'B12345674';
const NIF_TECLEADO = 'B87654321';

const JS = ['/dashboard/js/api.js', '/dashboard/js/modalHeader.js', '/dashboard/js/expensesView.js'];
const CSS = ['/tokens.css', '/dashboard/css/styles.css'];

function paginaHtml() {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
    + CSS.map((h) => '<link rel="stylesheet" href="' + h + '">').join('\n')
    + '\n</head><body>\n'
    + '<script>window.appLocale = { currency: "EUR" };<\/script>\n'
    + JS.map((s) => '<script src="' + s + '"><\/script>').join('\n')
    + '\n</body></html>';
}

let proveedores = [];
let recibidos = [];
function reiniciar() {
  proveedores = [
    { id: 1, name: 'Ferretería Sin NIF', taxId: null },
    { id: 2, name: 'Almacenes Con NIF', taxId: NIF_FICHA },
  ];
  recibidos = [];
}

function guardar(req, res, metodo) {
  const b = req.body || {};
  const providerId = b.providerId ? Number(b.providerId) : null;
  const nif = b.nifProveedor ? String(b.nifProveedor).trim() : '';
  const ficha = providerId ? proveedores.find((p) => p.id === providerId) : null;
  if (ficha && nif && !ficha.taxId) ficha.taxId = nif;   // guardarNifDelProveedor: sólo si estaba vacía
  const destinoDelNif = queFueDelNif({ nifTecleado: nif || null, providerId, nifDeLaFicha: ficha ? ficha.taxId : null });
  recibidos.push({ metodo, providerId, nifProveedor: b.nifProveedor ?? null, destinoDelNif });
  res.status(metodo === 'POST' ? 201 : 200).json({ ok: true, item: { id: 77, ...b }, destinoDelNif });
}

function arrancarServidor() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.get('/__nif-del-gasto.html', (_q, res) => res.type('html').send(paginaHtml()));
  app.get('/admin/providers', (_q, res) => res.json(proveedores));
  app.get('/admin/jobs', (_q, res) => res.json([]));
  app.post('/admin/expenses', (req, res) => guardar(req, res, 'POST'));
  app.put('/admin/expenses/:id', (req, res) => guardar(req, res, 'PUT'));
  app.use((req, res, next) => {
    const f = path.join(PUBLIC, req.path.replace(/^\//, ''));
    if (!f.startsWith(PUBLIC) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return next();
    const tipo = f.endsWith('.css') ? 'text/css' : f.endsWith('.js') ? 'text/javascript' : 'text/plain';
    res.type(tipo).send(fs.readFileSync(f, 'utf8'));
  });
  const srv = http.createServer(app);
  return levantarServidor(srv, PUERTO).then((p) => { PUERTO = p; return srv; });
}

// ── LO QUE CORRE DENTRO DE LA PÁGINA (en cadenas: censo de SCRUM-258) ────────────────────────

const ABRIR = new Function('gasto', `
  try { openExpenseModal(gasto, { onSaved: async function () {} }); }
  catch (e) { return 'openExpenseModal lanzó: ' + (e && e.message ? e.message : String(e)); }
  return document.getElementById('exp-provider-nif') ? null : 'el modal no tiene el campo NIF';
`);

const PROVEEDORES_CARGADOS = new Function(`
  var s = document.getElementById('exp-providerid');
  return !!s && s.options.length >= 3;
`);

const SIN_ANIMACIONES = new Function(`
  return document.getAnimations().every(function (a) { return a.playState !== 'running'; });
`);

const MODAL_CERRADO = new Function(`return !document.getElementById('exp-modal');`);

/** El estado del campo NIF: se puede escribir o no, qué vale, y qué ayuda se VE debajo. */
const ESTADO_NIF = new Function('ayuda', `
  var i = document.getElementById('exp-provider-nif');
  var campo = i.closest('.field');
  var vistos = Array.from(campo.querySelectorAll('p, small, span, div'))
    .filter(function (n) { return n.checkVisibility() && n.textContent.trim() === ayuda; });
  return { soloLectura: i.readOnly, valor: i.value, ayudaVisible: vistos.length > 0 };
`);

const ELEGIR = new Function('valor', `
  var s = document.getElementById('exp-providerid');
  s.value = valor;
  s.dispatchEvent(new Event('change', { bubbles: true }));
  return s.value === valor ? null : 'no existe la opción ' + valor;
`);

const RELLENAR = new Function(`
  document.getElementById('exp-concept').value = 'Ticket ferretería';
  document.getElementById('exp-amount').value = '42';
`);

const AVISOS = new Function(`
  return Array.from(document.querySelectorAll('.yaqu-toast'))
    .filter(function (t) { return t.checkVisibility(); })
    .map(function (t) { return { texto: t.textContent.trim(), kind: t.dataset.kind }; });
`);

const hallazgos = [];
const ciegos = [];
const filas = [];

async function abrirModal(pag, gasto) {
  await pag.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await pag.goto(`http://127.0.0.1:${PUERTO}/__nif-del-gasto.html`, { waitUntil: 'load' });
  const fatal = await pag.evaluate(ABRIR, gasto);
  if (fatal) return fatal;
  const ok = await pag.waitForFunction(PROVEEDORES_CARGADOS, { timeout: 5000 }).then(() => true, () => false);
  if (!ok) return 'la lista de proveedores no llegó al selector';
  await pag.waitForFunction(SIN_ANIMACIONES, { timeout: 5000 }).catch(() => {});
  return null;
}

/** Teclea en el NIF como el profesional (si es de solo lectura, el navegador no deja). */
async function teclear(pag, texto) {
  await pag.click('#exp-provider-nif', { clickCount: 3 }).catch(() => {});
  await pag.type('#exp-provider-nif', texto);
}

async function pulsarGuardar(pag) {
  const b = await pag.$('#exp-save');
  if (!b) return 'no hay botón de guardar';
  await b.evaluate((x) => x.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const e = await b.click().then(() => null, (err) => err.message);
  if (e) return 'no se pudo pulsar guardar: ' + e;
  const cerrado = await pag.waitForFunction(MODAL_CERRADO, { timeout: 5000 }).then(() => true, () => false);
  if (!cerrado) return 'el modal no se cerró tras guardar';
  await new Promise((ok) => setTimeout(ok, 300));
  return null;
}

const GASTO_EDITABLE = { id: 77, concept: 'Tubos', amount: 18, date: '2026-09-18T00:00:00.000Z', category: 'materiales', providerId: null, provider: null };

const CASOS = [
  {
    id: 'A · el campo NIF según el proveedor elegido', gasto: null,
    async correr(pag, mal) {
      let e = await pag.evaluate(ESTADO_NIF, AYUDA_A);
      if (!e.soloLectura) mal.push('sin proveedor, el NIF se puede escribir');
      if (!e.ayudaVisible) mal.push(`sin proveedor, no se ve «${AYUDA_A}»`);
      await teclear(pag, NIF_TECLEADO);
      e = await pag.evaluate(ESTADO_NIF, AYUDA_A);
      if (e.valor) mal.push(`sin proveedor, teclear dejó «${e.valor}» en el NIF`);

      await pag.evaluate(ELEGIR, '1');
      e = await pag.evaluate(ESTADO_NIF, AYUDA_A);
      if (e.soloLectura) mal.push('con un proveedor SIN NIF, el NIF no se puede escribir');
      if (e.ayudaVisible) mal.push('con un proveedor elegido, la ayuda sigue a la vista');

      await pag.evaluate(ELEGIR, '2');
      e = await pag.evaluate(ESTADO_NIF, AYUDA_A);
      if (!e.soloLectura || e.valor !== NIF_FICHA) mal.push(`con un proveedor CON NIF, el campo no se rellena y bloquea (valor «${e.valor}», solo lectura ${e.soloLectura})`);
      if (e.ayudaVisible) mal.push('con un proveedor con NIF, la ayuda sigue a la vista');

      await pag.evaluate(ELEGIR, '');
      e = await pag.evaluate(ESTADO_NIF, AYUDA_A);
      if (!e.soloLectura || !e.ayudaVisible) mal.push('al volver a «Sin proveedor», el NIF no vuelve a bloquearse con su ayuda');
      if (e.valor === NIF_FICHA) mal.push('al volver a «Sin proveedor», se queda el NIF de la ficha del proveedor anterior');
      return { estado: e };
    },
  },
  {
    id: 'B · alta: NIF tecleado y proveedor quitado → aviso tras guardar', gasto: null, guarda: true,
    async correr(pag, mal) {
      await pag.evaluate(ELEGIR, '1');
      await teclear(pag, NIF_TECLEADO);
      await pag.evaluate(ELEGIR, '');
      await pag.evaluate(RELLENAR);
      const g = await pulsarGuardar(pag);
      if (g) return { ciego: g };
      const r = recibidos[0];
      if (!r || r.destinoDelNif !== 'sin_proveedor') return { ciego: `el servidor no produjo «sin_proveedor» (${JSON.stringify(r)}): el caso no mide B` };
      const avisos = await pag.evaluate(AVISOS);
      if (!avisos.some((a) => a.texto === AVISO_B)) mal.push(`no se ve «${AVISO_B}» (avisos: ${JSON.stringify(avisos)})`);
      return { recibido: r, avisos };
    },
  },
  {
    id: 'B · edición: lo mismo por PUT', gasto: GASTO_EDITABLE, guarda: true,
    async correr(pag, mal) {
      await pag.evaluate(ELEGIR, '1');
      await teclear(pag, NIF_TECLEADO);
      await pag.evaluate(ELEGIR, '');
      const g = await pulsarGuardar(pag);
      if (g) return { ciego: g };
      const r = recibidos[0];
      if (!r || r.metodo !== 'PUT' || r.destinoDelNif !== 'sin_proveedor') return { ciego: `el servidor no produjo «sin_proveedor» por PUT (${JSON.stringify(r)})` };
      const avisos = await pag.evaluate(AVISOS);
      if (!avisos.some((a) => a.texto === AVISO_B)) mal.push(`no se ve «${AVISO_B}» (avisos: ${JSON.stringify(avisos)})`);
      return { recibido: r, avisos };
    },
  },
  {
    id: 'POSITIVO · proveedor sin NIF + NIF tecleado → a la ficha, sin aviso', gasto: null, guarda: true,
    async correr(pag, mal) {
      await pag.evaluate(ELEGIR, '1');
      await teclear(pag, NIF_TECLEADO);
      await pag.evaluate(RELLENAR);
      const g = await pulsarGuardar(pag);
      if (g) return { ciego: g };
      const r = recibidos[0];
      if (!r || r.destinoDelNif !== 'en_la_ficha') return { ciego: `el servidor no produjo «en_la_ficha» (${JSON.stringify(r)})` };
      const avisos = await pag.evaluate(AVISOS);
      if (avisos.some((a) => a.texto === AVISO_B)) mal.push('sale el aviso de NIF no guardado cuando SÍ se guardó');
      return { recibido: r, avisos };
    },
  },
];

const srv = await arrancarServidor();
let navegador;
try {
  navegador = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });
  for (const caso of CASOS) {
    reiniciar();
    const pag = await navegador.newPage();
    const errores = [];
    pag.on('pageerror', (e) => errores.push(String(e.message).slice(0, 120)));
    try {
      const fatal = await abrirModal(pag, caso.gasto);
      if (fatal) { ciegos.push(`${caso.id} → ${fatal}`); continue; }
      const mal = [];
      const r = await caso.correr(pag, mal);
      if (r && r.ciego) { ciegos.push(`${caso.id} → ${r.ciego}`); continue; }
      if (errores.length) mal.push('errores de página: ' + errores.join(' | '));
      filas.push({ id: caso.id, ok: !mal.length, r });
      if (mal.length) hallazgos.push({ id: caso.id, mal });
    } finally {
      await pag.close();
    }
  }
} finally {
  if (navegador) await navegador.close();
  srv.close();
}

console.log('');
console.log('  SCRUM-937b · EL NIF DEL GASTO EN EL MODAL (modal real, veredicto real de queFueDelNif)');
console.log(`  POBLACIÓN: ${CASOS.length} casos a 390 px`);
for (const f of filas) console.log(`   ${f.ok ? '✔' : '🔴'} ${f.id}`);

if (ciegos.length) {
  console.error('\n  🔴 NO SUPE MEDIR — esto NO es «está bien»:\n');
  for (const c of ciegos) console.error('     · ' + c);
  process.exit(SALIDA_NO_SUPE_MEDIR);
}
if (hallazgos.length) {
  console.error(`\n  🔴 ${hallazgos.length} DE ${CASOS.length} CASOS NO SE COMPORTAN COMO DEBEN:\n`);
  for (const h of hallazgos) {
    console.error(`     [${h.id}]`);
    for (const m of h.mal) console.error('       · ' + m);
  }
  process.exit(SALIDA_HALLAZGO);
}
console.log(`\n  ✔ los ${CASOS.length} casos: el NIF sólo se escribe con proveedor, y si se pierde se dice.\n`);
