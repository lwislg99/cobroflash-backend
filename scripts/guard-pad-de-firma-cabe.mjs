// scripts/guard-pad-de-firma-cabe.mjs — SCRUM-1742 · EL PAD DE FIRMA DEL PARTE CABE EN EL MÓVIL.
//
// Uso:  npm run guard:pad-de-firma-cabe
//
// ── QUÉ SE MIDE ──────────────────────────────────────────────────────────────────────────────
// Medido en yaqu.app el 16-nov-2026 (recorrido H6 de SCRUM-1686, filas 14 a 16), a 390×844: el pad
// del técnico medía 901 px y el del cliente 1.195; el recuadro del cliente EMPEZABA en y=925, fuera
// de la ventana, y «Confirmar firma» quedaba cortado o fuera. El pad se desplazaba, pero el dedo
// sobre el recuadro dibuja, no desplaza. «Borrar», «Cancelar» y «Confirmar firma» medían 30 px.
//
// Se monta lo REAL (`parteDetailView.js` + `signaturePad.js` + `styles.css`) y el pad se abre por
// `window.firmarParte`, que es quien lo abre en la pantalla: título, pista, ayudas, resumen y
// firmante salen del llamador de verdad. La microcopy sale de `dist/` (`albaranFirmante.js`), como
// la sirve `/admin/me`: sin ella el pad no pinta el nombre ni las calidades y mediría MENOS.
//   🔴 A · el recuadro, ENTERO dentro de la ventana, sin desplazar nada.
//   🔴 B · «Confirmar firma», ENTERO dentro de la ventana, sin desplazar nada.
//   🔴 C · los tres botones del pie miden 44 px de alto o más.
//   🔴 D · la tarjeta no es más alta ni más ancha que la ventana.
//   🔴 E · lo de arriba se ALCANZA: el campo del nombre se puede traer a la vista, y al hacerlo el
//          recuadro y «Confirmar firma» no se van.
//   🔴 F · al empezar el trazo, el resumen de lo que se firma está a la vista encima del recuadro
//          (SCRUM-466: «el albarán arriba y el recuadro debajo, a la vez»).
//   ✅ G · POSITIVO · con nombre y trazo, «Confirmar firma» se enciende: el recuadro sigue recogiendo
//          tinta donde está.
//   🔴 H · el nombre del TÉCNICO nace propuesto cuando el parte tiene UN técnico, y vacío si tiene
//          dos o ninguno; el del CLIENTE nace vacío siempre (SCRUM-300).
//
// ⚠️ LO QUE NO MIDE, declarado: el móvil APAISADO (la tarjeta tiene un suelo de alto y ahí se
// desplaza entera, como antes), el teclado en pantalla, ni un navegador que no sea Chromium.
//
// ── SUELO ────────────────────────────────────────────────────────────────────────────────────
// Si el pad no se pinta, no trae el campo del nombre, las calidades del cliente o las líneas del
// resumen, el caso es CIEGO (2): un pad a medio pintar es más corto y cabría «solo».
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer-core';
import { veredictoDe } from './_hallazgos-y-ciegos.mjs';
import { lanzarNavegador } from './_navegador.mjs';
import { levantarServidor } from './_servidor.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(RAIZ, 'public');
let PUERTO = Number(process.env.PAD_PUERTO || 0);
const ALTO_MINIMO = 44;

const JS = ['/dashboard/js/api.js', '/dashboard/js/signaturePad.js', '/dashboard/js/parteDetailView.js'];
const CSS = ['/tokens.css', '/dashboard/css/styles.css'];

const VENTANAS = [
  { id: '390×844', width: 390, height: 844, movil: true },
  { id: '390×664', width: 390, height: 664, movil: true },
  { id: '320×568', width: 320, height: 568, movil: true },
  { id: '1280×800', width: 1280, height: 800, movil: false },
];
const UNO = ['Operario QA'];
const CASOS = [];
for (const v of VENTANAS) {
  for (const quien of ['tecnico', 'cliente']) CASOS.push({ id: `${quien} · ${v.id} · 6 líneas`, quien, v, lineas: 6, tecnicos: UNO });
}
CASOS.push({ id: 'cliente · 390×844 · 20 líneas', quien: 'cliente', v: VENTANAS[0], lineas: 20, tecnicos: UNO });
CASOS.push({ id: 'tecnico · 390×844 · DOS técnicos en el parte', quien: 'tecnico', v: VENTANAS[0], lineas: 6, tecnicos: ['Operario QA', 'Otra Operaria QA'] });
CASOS.push({ id: 'tecnico · 390×844 · NINGÚN técnico en el parte', quien: 'tecnico', v: VENTANAS[0], lineas: 6, tecnicos: [] });

function parteDe(caso) {
  const lineas = [];
  for (let i = 0; i < caso.lineas; i++) {
    lineas.push({ id: i + 1, bloque: i % 2 ? 'materiales' : 'mano_obra', unds: i % 2 ? 2 : 2.5, descripcion: i % 2 ? `(prueba) Latiguillo de 40 cm, ${i}` : `(prueba) Horas de trabajo en la cocina, ${i}` });
  }
  return { id: 22, clienteNombre: 'Clienta de Prueba (QA)', fecha: '2026-11-16T10:00:00Z', obra: 'Calle de la Prueba 14, 2.º B', tecnicos: caso.tecnicos, lineas };
}

async function microcopy() {
  const f = path.join(RAIZ, 'dist', 'modules', 'jobs', 'domain', 'albaranFirmante.js');
  if (!fs.existsSync(f)) return null;
  const m = await import('file://' + f.replace(/\\/g, '/'));
  const x = m.ALBARAN_ROTULOS ? m : m.default;
  return { rotulos: x.ALBARAN_ROTULOS, ayudas: x.ALBARAN_AYUDAS, parteAyudas: x.PARTE_AYUDAS, opciones: x.firmanteCalidadOpciones() };
}

function paginaHtml(mc) {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
    + CSS.map((h) => '<link rel="stylesheet" href="' + h + '">').join('\n')
    + '\n</head><body>\n'
    + '<script>window.appLocale = { currency: "EUR" };'
    + 'window.appAlbaranRotulos = ' + JSON.stringify(mc.rotulos) + ';'
    + 'window.appAlbaranAyudas = ' + JSON.stringify(mc.ayudas) + ';'
    + 'window.appParteAyudas = ' + JSON.stringify(mc.parteAyudas) + ';'
    + 'window.appAlbaranFirmanteOpciones = ' + JSON.stringify(mc.opciones) + ';'
    + 'window.firmarConRedDeSeguridad = function () { return Promise.resolve({ rechazada: true }); };<\/script>\n'
    + JS.map((s) => '<script src="' + s + '"><\/script>').join('\n')
    + '\n</body></html>';
}

function arrancarServidor(mc) {
  const app = express();
  app.get('/__pad-de-firma.html', (_q, res) => res.type('html').send(paginaHtml(mc)));
  app.use((req, res, next) => {
    const f = path.join(PUBLIC, req.path.replace(/^\//, ''));
    if (!f.startsWith(PUBLIC) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return next();
    res.type(f.endsWith('.css') ? 'text/css' : f.endsWith('.js') ? 'text/javascript' : 'text/plain').send(fs.readFileSync(f, 'utf8'));
  });
  const srv = http.createServer(app);
  return levantarServidor(srv, PUERTO).then((p) => { PUERTO = p; return srv; });
}

// ── LO QUE CORRE DENTRO DE LA PÁGINA (en cadenas: censo de SCRUM-258) ────────────────────────

/** Abre el pad como lo abre el parte. Devuelve null o por qué no se pudo. */
const ABRIR = new Function('parte', 'quien', `
  if (typeof window.firmarParte !== 'function') return 'no existe window.firmarParte';
  var r;
  try { r = window.firmarParte(parte, {}, quien); } catch (e) { return 'firmarParte lanzó: ' + (e && e.message ? e.message : String(e)); }
  if (r === false) return 'firmarParte devolvió false: no abrió el pad';
  return document.querySelector('[role="dialog"] canvas') ? null : 'no hay pad con recuadro en el DOM';
`);

/** La foto del pad en la VENTANA, sin tocar nada. */
const MEDIR = new Function(`
  var d = document.querySelector('[role="dialog"]');
  var caja = function (e) { if (!e) return null; var b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, fin: b.bottom, der: b.right }; };
  var botones = Array.prototype.slice.call(d.querySelectorAll('button')).filter(function (b) { return /^(Borrar|Cancelar|Confirmar firma)$/.test(b.textContent.trim()); });
  var ok = botones.filter(function (b) { return b.textContent.trim() === 'Confirmar firma'; })[0];
  var nombre = d.querySelector('#sp-nombre');
  var resumen = d.querySelector('[data-firma-albaran]');
  return {
    ventana: { w: window.innerWidth, h: window.innerHeight },
    tarjeta: caja(d), recuadro: caja(d.querySelector('canvas')), confirmar: caja(ok),
    botones: botones.map(function (b) { return { texto: b.textContent.trim(), h: b.getBoundingClientRect().height }; }),
    okApagado: ok ? ok.disabled : null,
    nombre: nombre ? { valor: nombre.value, caja: caja(nombre) } : null,
    radios: d.querySelectorAll('input[type="radio"]').length,
    filasDelResumen: resumen ? resumen.querySelectorAll('tr').length : -1,
    resumen: caja(resumen),
  };
`);

const NOMBRE_A_LA_VISTA = new Function(`
  var n = document.querySelector('[role="dialog"] #sp-nombre');
  n.scrollIntoView({ block: 'nearest', behavior: 'instant' });
`);

const PONER_NOMBRE = new Function('texto', `
  var n = document.querySelector('[role="dialog"] #sp-nombre');
  n.value = texto;
  n.dispatchEvent(new Event('input', { bubbles: true }));
`);

const dentro = (c, v) => !!c && c.y >= -0.5 && c.fin <= v.h + 0.5 && c.x >= -0.5 && c.der <= v.w + 0.5;
const px = (n) => Math.round(n);
const dice = (c) => (c ? `y=${px(c.y)}–${px(c.fin)}` : 'NO ESTÁ');

const hallazgos = [];
const ciegos = [];
const filas = [];

const mc = await microcopy();
if (!mc || !mc.rotulos || !mc.rotulos.firmadoPorNombre || !mc.opciones.length) {
  console.error('\n  🔴 NO SUPE MEDIR: no hay microcopy del firmante en dist/ (¿falta `npm run build`?). Sin ella el pad se pinta sin nombre ni calidades y mediría menos.\n');
  const v = veredictoDe({ hallazgos: 0, ciegos: 1 });
  console.error('  ' + v.linea + '\n');
  process.exit(v.codigo);
}

const srv = await arrancarServidor(mc);
let navegador;
try {
  navegador = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });
  for (const caso of CASOS) {
    if (process.env.PAD_CASO && !caso.id.startsWith(process.env.PAD_CASO)) continue;
    const pag = await navegador.newPage();
    const errores = [];
    pag.on('pageerror', (e) => errores.push(String(e.message).slice(0, 120)));
    try {
      await pag.setViewport({ width: caso.v.width, height: caso.v.height, isMobile: caso.v.movil, hasTouch: caso.v.movil });
      await pag.goto(`http://127.0.0.1:${PUERTO}/__pad-de-firma.html`, { waitUntil: 'load' });
      const fatal = await pag.evaluate(ABRIR, parteDe(caso), caso.quien);
      if (fatal) { ciegos.push(`${caso.id} → ${fatal}`); continue; }
      const m = await pag.evaluate(MEDIR);

      // SUELO: el pad entero, o no se juzga.
      const falta = [];
      if (!m.nombre) falta.push('no pinta el campo del nombre');
      if (caso.quien === 'cliente' && m.radios !== mc.opciones.length) falta.push(`pinta ${m.radios} calidades de ${mc.opciones.length}`);
      if (caso.quien === 'tecnico' && m.radios !== 0) falta.push(`el pad del técnico pinta ${m.radios} calidades`);
      if (m.filasDelResumen !== caso.lineas) falta.push(`el resumen trae ${m.filasDelResumen} filas de ${caso.lineas}`);
      if (m.botones.length !== 3) falta.push(`el pie trae ${m.botones.length} botones de 3`);
      if (m.ventana.w !== caso.v.width || m.ventana.h !== caso.v.height) falta.push(`la ventana es ${m.ventana.w}×${m.ventana.h}`);
      if (falta.length) { ciegos.push(`${caso.id} → ${falta.join(' · ')}`); continue; }

      const mal = [];
      const V = m.ventana;
      if (!dentro(m.recuadro, V)) mal.push(`A · el recuadro no cabe en la ventana: ${dice(m.recuadro)} de ${V.h}`);
      if (!dentro(m.confirmar, V)) mal.push(`B · «Confirmar firma» no cabe en la ventana: ${dice(m.confirmar)} de ${V.h}`);
      for (const b of m.botones) if (b.h < ALTO_MINIMO - 0.5) mal.push(`C · «${b.texto}» mide ${px(b.h)} px de alto (mínimo ${ALTO_MINIMO})`);
      if (m.tarjeta.h > V.h + 0.5 || m.tarjeta.w > V.w + 0.5) mal.push(`D · la tarjeta mide ${px(m.tarjeta.w)}×${px(m.tarjeta.h)} en una ventana de ${V.w}×${V.h}`);

      // H · qué nombre nace puesto.
      const propuesto = caso.quien === 'tecnico' && caso.tecnicos.length === 1 ? caso.tecnicos[0] : '';
      if (m.nombre.valor !== propuesto) mal.push(`H · el nombre nace «${m.nombre.valor}» y tiene que nacer «${propuesto}»`);
      if (m.okApagado !== true) mal.push('«Confirmar firma» nace encendido, sin trazo');

      // E · lo de arriba se alcanza sin perder lo de abajo.
      await pag.evaluate(NOMBRE_A_LA_VISTA);
      const e = await pag.evaluate(MEDIR);
      if (!dentro(e.nombre.caja, V)) mal.push(`E · el campo del nombre no se puede traer a la vista: ${dice(e.nombre.caja)}`);
      else if (!dentro(e.recuadro, V) || !dentro(e.confirmar, V)) mal.push(`E · con el nombre a la vista se van el recuadro (${dice(e.recuadro)}) o «Confirmar firma» (${dice(e.confirmar)})`);

      // F y G · el trazo, con el ratón de verdad sobre el recuadro donde esté.
      if (!e.nombre.valor) await pag.evaluate(PONER_NOMBRE, 'Persona de Prueba');
      const lienzo = await pag.$('[role="dialog"] canvas');
      await lienzo.evaluate((c) => c.scrollIntoView({ block: 'nearest', behavior: 'instant' }));
      const c = await lienzo.boundingBox();
      await pag.mouse.move(c.x + c.width * 0.2, c.y + c.height * 0.6);
      await pag.mouse.down();
      for (let i = 1; i <= 12; i++) await pag.mouse.move(c.x + c.width * (0.2 + 0.05 * i), c.y + c.height * (0.6 - 0.02 * i));
      const f = await pag.evaluate(MEDIR);
      await pag.mouse.up();
      const g = await pag.evaluate(MEDIR);
      const aLaVista = f.resumen ? Math.min(f.resumen.fin, f.recuadro.y) - Math.max(f.resumen.y, 0) : 0;
      if (!(aLaVista >= 60) || f.resumen.fin > f.recuadro.y + 0.5 || !dentro(f.recuadro, V)) {
        mal.push(`F · mientras se firma, el resumen no está a la vista encima del recuadro: resumen ${dice(f.resumen)}, recuadro ${dice(f.recuadro)} (${px(aLaVista)} px visibles; mínimo 60)`);
      }
      if (g.okApagado !== false) mal.push('G · con nombre y trazo, «Confirmar firma» sigue apagado: el recuadro no recoge la tinta');

      if (errores.length) mal.push('errores de página: ' + errores.join(' | '));
      filas.push({ id: caso.id, ok: !mal.length, resumen: `tarjeta ${px(m.tarjeta.h)} px · recuadro ${dice(m.recuadro)} · «Confirmar» ${dice(m.confirmar)} · botones ${m.botones.map((b) => px(b.h)).join('/')} px · nombre «${m.nombre.valor}»` });
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
console.log('  SCRUM-1742 · EL PAD DE FIRMA DEL PARTE CABE EN EL MÓVIL (pad real, abierto por window.firmarParte)');
console.log(`  POBLACIÓN: ${CASOS.length} casos (técnico y cliente × ${VENTANAS.map((v) => v.id).join(', ')}; más 20 líneas, dos técnicos y ninguno) · medidos ${filas.length}`);
for (const f of filas) console.log(`   ${f.ok ? '✔' : '🔴'} ${f.id} · ${f.resumen}`);

if (!process.env.PAD_CASO && filas.length + ciegos.length !== CASOS.length) ciegos.push(`se juzgaron ${filas.length + ciegos.length} casos de ${CASOS.length}`);
if (ciegos.length) {
  console.error('\n  🔴 NO SUPE MEDIR — esto NO es «cabe»:\n');
  for (const c of ciegos) console.error('     · ' + c);
}
if (hallazgos.length) {
  console.error(`\n  🔴 ${hallazgos.length} DE ${CASOS.length} CASOS NO SE COMPORTAN COMO DEBEN:\n`);
  for (const h of hallazgos) {
    console.error(`     [${h.id}]`);
    for (const m of h.mal) console.error('       · ' + m);
  }
}
const veredictoFinal = veredictoDe({ hallazgos, ciegos });
if (veredictoFinal.codigo !== 0) {
  console.error('\n  ' + veredictoFinal.linea + '\n');
  process.exit(veredictoFinal.codigo);
}
console.log(`\n  ✔ los ${CASOS.length} casos: recuadro y «Confirmar firma» a la vista, botones de ${ALTO_MINIMO} px, lo de arriba se alcanza y el resumen acompaña al trazo.\n`);
