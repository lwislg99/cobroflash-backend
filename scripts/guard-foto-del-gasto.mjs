// scripts/guard-foto-del-gasto.mjs — SCRUM-947 · LA FOTO DEL TICKET SE GUARDA.
//
// Uso:  npm run guard:foto-del-gasto
//
// ── QUÉ SE MIDE ──────────────────────────────────────────────────────────────────────────────
// El modal del gasto mandaba la foto tal cual, en base64, dentro del JSON. El servidor corta el
// cuerpo a 2 MB (`express.json({ limit: '2mb' })`, src/app.ts) y el base64 engorda un tercio, así
// que una foto de ~1,5 MB o más daba 413 y el gasto NO se guardaba. Medido en staging el
// 18-sep-2026 (sin sesión, sin crear nada): cuerpo de 1,90 MiB → 401; de 2,10 MiB → 413 en HTML.
//
// Se monta el modal REAL (`expensesView.js` + `api.js` + `modalHeader.js`), se mete una foto en el
// `<input type=file>`, se pulsa «Añadir gasto» DE VERDAD y se juzga el ESTADO después:
//   🔴 A · una foto de 3–5 MB (4000×3000, apaisada) SE GUARDA: una petición aceptada, JPEG que el
//          navegador abre, lado largo ≤ 2000 px, sin aviso de error y el modal cerrado.
//   🔴 B · lo mismo en VERTICAL (3000×4000): el lado largo es el alto.
//   🔴 C · lo guardado SE VE DESPUÉS: al reabrir el gasto guardado, su foto se pinta (naturalWidth > 0).
//   ✅ D · POSITIVO · una foto pequeña que ya cabía se manda EXACTAMENTE igual que hoy (mismo data-URI).
//   🔴 E · NEGATIVO · un fichero grande que el navegador no sabe abrir (p. ej. HEIC en Chrome de
//          escritorio) NO se manda, y el aviso firmado lo dice; el botón vuelve a estar disponible.
//
// 🔴 EL SERVIDOR NO ES DE MENTIRA EN LO QUE IMPORTA: el cuerpo lo lee `express.json({ limit: '2mb' })`,
// el MISMO parser y el MISMO límite que producción, y el 413 lo contesta el manejador por defecto de
// express, en HTML, como en staging. El panel lo recibe por el `apiRequest` real de `api.js`.
//
// ⚠️ LO QUE NO MIDE, declarado: la foto es SINTÉTICA (generada en el navegador); una foto real de
// móvil trae EXIF y la orientación no se prueba aquí. Queda como «no medido».
//
// ── POR QUÉ FUERA DE `npm test` ──────────────────────────────────────────────────────────────
// Decodificar y reducir una imagen sólo existe en un navegador (canvas, createImageBitmap).
//
// ── SUELO ────────────────────────────────────────────────────────────────────────────────────
// Si el modal no se pinta, la foto sintética no cae en 3–5 MB o el servidor no llega a ver ninguna
// petición en el caso POSITIVO, sale con 2 (NO SUPE MEDIR). Salidas: 0 de acuerdo, 1 hallazgo, 2 ciego.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from './_navegador.mjs';
import { levantarServidor } from './_servidor.mjs';

export const SALIDA_HALLAZGO = 1;
export const SALIDA_NO_SUPE_MEDIR = 2;

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(RAIZ, 'public');
let PUERTO = Number(process.env.FOTO_PUERTO || 0);

// El literal firmado (SCRUM-947, orquestador por delegación, 18-sep-2026). Si cambia, cambia aquí.
const AVISO_NO_SE_ABRE = 'No hemos podido abrir esta foto. Prueba con otra o haz una captura de pantalla del ticket.';
const LADO_MAXIMO = 2000;

const JS = ['/dashboard/js/api.js', '/dashboard/js/modalHeader.js', '/dashboard/js/expensesView.js'];
const CSS = ['/tokens.css', '/dashboard/css/styles.css'];

const CASOS = [
  { id: 'A · foto de 3–5 MB apaisada', foto: { ancho: 4000, alto: 3000 }, espera: 'reducida' },
  { id: 'B · foto de 3–5 MB vertical', foto: { ancho: 3000, alto: 4000 }, espera: 'reducida' },
  { id: 'D · POSITIVO · foto pequeña que ya cabía', foto: { ancho: 800, alto: 600, pequena: true }, espera: 'intacta' },
  { id: 'E · NEGATIVO · fichero grande que no se abre', foto: { roto: true }, espera: 'aviso' },
];

function paginaHtml() {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
    + CSS.map((h) => '<link rel="stylesheet" href="' + h + '">').join('\n')
    + '\n</head><body>\n'
    + '<script>window.appLocale = { currency: "EUR" };<\/script>\n'
    + JS.map((s) => '<script src="' + s + '"><\/script>').join('\n')
    + '\n</body></html>';
}

let recibidos = [];
function arrancarServidor() {
  const app = express();
  // 🔴 El MISMO parser y el MISMO límite que `src/app.ts`: esto es lo que se juzga.
  app.use(express.json({ limit: '2mb' }));
  app.get('/__foto-del-gasto.html', (_q, res) => res.type('html').send(paginaHtml()));
  app.get('/admin/providers', (_q, res) => res.json([]));
  app.get('/admin/jobs', (_q, res) => res.json([]));
  app.post('/admin/expenses', (req, res) => {
    const g = { id: 900 + recibidos.length, ...req.body };
    recibidos.push(g);
    res.status(201).json(g);
  });
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

/** Abre el modal de alta como lo abre la ficha del Trabajo (onSaved propio: no hay lista que recargar). */
const ABRIR = new Function(`
  try {
    window.__guardadoOk = 0;
    openExpenseModal(null, { onSaved: async function () { window.__guardadoOk++; } });
  } catch (e) { return 'openExpenseModal lanzó: ' + (e && e.message ? e.message : String(e)); }
  return document.getElementById('exp-receipt') ? null : 'el modal no tiene el campo de la foto';
`);

/**
 * Fabrica la foto EN EL NAVEGADOR y la mete en el campo, como la metería el selector de ficheros.
 * La grande lleva ruido a bloques para que el JPEG pese lo que pesa una foto de móvil (3–5 MB);
 * si no cae ahí, el caso es ciego. Devuelve { bytes, tipo, dataUri? } o { error }.
 */
const PONER_FOTO = new Function('f', `
  return (async function () {
    var input = document.getElementById('exp-receipt');
    var file;
    if (f.roto) {
      var basura = new Uint8Array(2600000);
      var s = 7; for (var i = 0; i < basura.length; i++) { s = (s * 1103515245 + 12345) >>> 0; basura[i] = s >>> 24; }
      file = new File([basura], 'ticket.heic', { type: 'image/heic' });
    } else {
      var c = document.createElement('canvas'); c.width = f.ancho; c.height = f.alto;
      var x = c.getContext('2d');
      var g = x.createLinearGradient(0, 0, f.ancho, f.alto); g.addColorStop(0, '#d8cfc0'); g.addColorStop(1, '#8a7f70');
      x.fillStyle = g; x.fillRect(0, 0, f.ancho, f.alto);
      var s2 = 11, paso = f.pequena ? 8 : 3;
      for (var yy = 0; yy < f.alto; yy += paso) for (var xx = 0; xx < f.ancho; xx += paso) {
        s2 = (s2 * 1103515245 + 12345) >>> 0;
        var v = (s2 >>> 24) - 128;
        x.fillStyle = 'rgba(' + (v > 0 ? '255,255,255,' : '0,0,0,') + (Math.abs(v) / 900).toFixed(3) + ')';
        x.fillRect(xx, yy, paso, paso);
      }
      x.fillStyle = '#222'; x.font = Math.round(f.ancho / 20) + 'px sans-serif';
      x.fillText('TICKET 947 · 42,00 EUR', f.ancho / 10, f.alto / 2);
      var blob = await new Promise(function (ok) { c.toBlob(ok, 'image/jpeg', 0.92); });
      file = new File([blob], 'IMG_0947.jpg', { type: 'image/jpeg' });
    }
    var dt = new DataTransfer(); dt.items.add(file); input.files = dt.files;
    var dataUri = await new Promise(function (ok) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.readAsDataURL(file); });
    return { bytes: file.size, tipo: file.type, dataUri: dataUri };
  })().catch(function (e) { return { error: 'no se pudo fabricar la foto: ' + e.message }; });
`);

const SIN_ANIMACIONES = new Function(`
  return document.getAnimations().every(function (a) { return a.playState !== 'running'; });
`);

/** Terminó el guardado: el modal se cerró, o el botón volvió a estar disponible. */
const BOTON_LIBRE = new Function(`
  var b = document.getElementById('exp-save');
  return !b || !b.disabled;
`);

const RELLENAR = new Function(`
  document.getElementById('exp-concept').value = 'Ticket ferretería';
  document.getElementById('exp-amount').value = '42';
`);

const ESTADO = new Function(`
  var err = document.getElementById('exp-error');
  var btn = document.getElementById('exp-save');
  return {
    modalAbierto: !!document.getElementById('exp-modal'),
    error: err && err.checkVisibility() ? err.textContent : null,
    botonDisponible: btn ? !btn.disabled : null,
    guardadoOk: window.__guardadoOk
  };
`);

/** Decodifica lo que llegó al servidor, en el navegador: ¿es una imagen que se abre, y de qué tamaño? */
const DECODIFICAR = new Function('uri', `
  return new Promise(function (ok) {
    var im = new Image();
    im.onload = function () { ok({ ancho: im.naturalWidth, alto: im.naturalHeight }); };
    im.onerror = function () { ok({ error: 'no se abre' }); };
    im.src = uri;
  });
`);

/** C · reabre el gasto GUARDADO (lo que devolvió el servidor) y mira si su foto se pinta. */
const REABRIR_Y_VER = new Function('gasto', `
  return new Promise(function (ok) {
    openExpenseModal(gasto, { onSaved: async function () {} });
    var img = document.querySelector('#exp-receipt-section img');
    if (!img) return ok({ error: 'al reabrir no hay <img> de la foto' });
    var fin = function () {
      var r = img.getBoundingClientRect();
      ok({ naturalWidth: img.naturalWidth, alto: r.height, visible: img.checkVisibility() });
      document.getElementById('exp-modal') && document.getElementById('exp-modal').remove();
    };
    if (img.complete) fin(); else { img.onload = fin; img.onerror = fin; }
  });
`);

const hallazgos = [];
const ciegos = [];
const filas = [];
const MB = (n) => (n / 1048576).toFixed(2) + ' MiB';

const srv = await arrancarServidor();
let navegador;
try {
  navegador = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });
  for (const caso of CASOS) {
    if (process.env.FOTO_CASO && !caso.id.startsWith(process.env.FOTO_CASO)) continue;
    recibidos = [];
    const pag = await navegador.newPage();
    const errores = [];
    pag.on('pageerror', (e) => errores.push(String(e.message).slice(0, 120)));
    try {
      await pag.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await pag.goto(`http://127.0.0.1:${PUERTO}/__foto-del-gasto.html`, { waitUntil: 'load' });
      const fatal = await pag.evaluate(ABRIR);
      if (fatal) { ciegos.push(`${caso.id} → ${fatal}`); continue; }
      const foto = await pag.evaluate(PONER_FOTO, caso.foto);
      if (foto.error) { ciegos.push(`${caso.id} → ${foto.error}`); continue; }
      if (!caso.foto.roto && !caso.foto.pequena && (foto.bytes < 3e6 || foto.bytes > 5.2e6)) {
        ciegos.push(`${caso.id} → la foto sintética pesa ${MB(foto.bytes)}: no es una foto de móvil de 3–5 MB`);
        continue;
      }
      if (caso.foto.pequena && foto.dataUri.length > 1.4e6) { ciegos.push(`${caso.id} → la foto «pequeña» no cabe hoy`); continue; }
      await pag.evaluate(RELLENAR);
      const boton = await pag.$('#exp-save');
      if (!boton) { ciegos.push(`${caso.id} → no hay botón «Añadir gasto»`); continue; }
      await boton.evaluate((b) => b.scrollIntoView({ block: 'center', behavior: 'instant' }));
      // El modal entra con animación: pulsar a mitad da «not clickable» de vez en cuando (medido:
      // 1 de 3 pasadas del caso D). Se espera a que no quede ninguna en curso.
      await pag.waitForFunction(SIN_ANIMACIONES, { timeout: 5000 }).catch(() => {});
      const clic = await boton.click().then(() => null, (e) => e.message);
      if (clic) {
        const caja = await boton.evaluate((b) => {
          const r = b.getBoundingClientRect();
          return `caja ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}×${Math.round(r.height)} · visible ${b.checkVisibility()}`;
        }).catch((e) => 'sin caja: ' + e.message);
        ciegos.push(`${caso.id} → no se pudo pulsar «Añadir gasto» (${caja}): ${clic}`);
        continue;
      }
      await pag.waitForFunction(BOTON_LIBRE, { timeout: 30000 }).catch(() => {});
      await new Promise((ok) => setTimeout(ok, 300));
      const est = await pag.evaluate(ESTADO);
      const mal = [];
      const g = recibidos[0];
      const resumen = { foto: MB(foto.bytes), recibidos: recibidos.length, error: est.error };

      if (caso.espera === 'aviso') {
        if (recibidos.length) mal.push(`se mandó al servidor (${recibidos.length} gasto) un fichero que no se puede abrir`);
        if (est.error !== AVISO_NO_SE_ABRE) mal.push(`el aviso es «${est.error}» y tiene que ser el firmado: «${AVISO_NO_SE_ABRE}»`);
        if (!est.botonDisponible) mal.push('el botón se queda deshabilitado: no se puede volver a intentar');
      } else {
        if (recibidos.length !== 1) mal.push(`el servidor aceptó ${recibidos.length} gastos; se esperaba 1 (aviso en pantalla: «${est.error}»)`);
        if (est.error) mal.push(`hay aviso de error en pantalla: «${est.error}»`);
        if (est.modalAbierto) mal.push('el modal sigue abierto: el gasto no se dio por guardado');
        if (g) {
          const uri = String(g.receiptData || '');
          resumen.enviado = MB(uri.length);
          if (caso.espera === 'intacta') {
            if (uri !== foto.dataUri) mal.push(`la foto pequeña NO se mandó tal cual (${MB(uri.length)} frente a ${MB(foto.dataUri.length)})`);
          } else {
            if (!uri.startsWith('data:image/jpeg;base64,')) mal.push(`lo guardado no es un JPEG en data-URI (${uri.slice(0, 30)}…)`);
            const d = await pag.evaluate(DECODIFICAR, uri);
            if (d.error) mal.push('lo guardado no se abre como imagen');
            else {
              resumen.px = `${d.ancho}×${d.alto}`;
              if (Math.max(d.ancho, d.alto) > LADO_MAXIMO) mal.push(`lado largo ${Math.max(d.ancho, d.alto)} px > ${LADO_MAXIMO}`);
              if ((caso.foto.alto > caso.foto.ancho) !== (d.alto > d.ancho)) mal.push(`cambió la orientación: ${d.ancho}×${d.alto}`);
            }
            // C · el ESTADO después: el gasto guardado, reabierto, enseña su foto.
            const v = await pag.evaluate(REABRIR_Y_VER, g);
            if (v.error) mal.push('C · ' + v.error);
            else if (!(v.naturalWidth > 0) || !v.visible || !(v.alto > 0)) mal.push(`C · al reabrir, la foto no se ve (naturalWidth ${v.naturalWidth}, alto ${v.alto})`);
          }
        }
      }
      if (errores.length) mal.push('errores de página: ' + errores.join(' | '));
      filas.push({ id: caso.id, ok: !mal.length, resumen });
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
console.log('  SCRUM-947 · LA FOTO DEL TICKET SE GUARDA (modal real, servidor con el límite de 2 MB de producción)');
console.log(`  POBLACIÓN: ${CASOS.length} casos a 390 px`);
for (const f of filas) console.log(`   ${f.ok ? '✔' : '🔴'} ${f.id} · ${JSON.stringify(f.resumen)}`);

if (ciegos.length) {
  console.error('\n  🔴 NO SUPE MEDIR — esto NO es «se guarda»:\n');
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
console.log(`\n  ✔ los ${CASOS.length} casos: la foto grande se reduce y se guarda, la pequeña va igual que hoy, y lo que no se abre se dice.\n`);
