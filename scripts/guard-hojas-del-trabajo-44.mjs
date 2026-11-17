// scripts/guard-hojas-del-trabajo-44.mjs — SCRUM-1745 · LA HOJA «EDITAR ALBARÁN» Y EL MODAL «AGENDAR»
// SE PUEDEN PULSAR CON EL PULGAR A 390.
//
// Uso:  npm run guard:hojas-del-trabajo-44
//
// ── QUÉ SE MIDE ──────────────────────────────────────────────────────────────────────────────
// Medido en yaqu.app (recorrido H6 de SCRUM-1686, fila 29; ampliado en SCRUM-1745 c.21958), a 390:
// en la hoja «Editar albarán» el campo Concepto medía 30 px de ancho para un texto de 144, los
// campos de la línea 34 px de alto y las casillas 13×13; en el modal «Agendar» los botones medían
// 30 px y la fecha 36. Todo por debajo de los 44 px de AB6 (DESIGN.md §5).
//
// Se monta lo REAL: los scripts del panel salen de `public/dashboard/index.html`, en su orden (todos
// menos `app.js`, que arranca la aplicación y pide sesión), con `tokens.css` y `styles.css`. La
// hoja se abre con `openAlbEditorSheet` y el modal con `window.abrirAgendarTrabajo`, que son quienes
// los abren en la ficha del trabajo. El ÁREA DE TOQUE la mide el medidor de la casa
// (`_medidor-de-toque.mjs`: lo que de verdad recibe el dedo, no la caja pintada).
//   🔴 A · a 390 y a 320, cada control de la hoja y del modal recibe el toque en 44 px de alto o más.
//   🔴 B · los controles estrechos (casillas, «?», «×», «✕») reciben además 44 px de ancho.
//   🔴 C · en la hoja, el Concepto de cada línea se lee entero (el texto de prueba cabe en el campo).
//   🔴 D · la hoja y el modal no son más anchos que la ventana (nada obliga a desplazar de lado).
//   ✅ E · POSITIVO · a 1280 nada cambia: cada caja mide lo mismo CON el bloque de SCRUM-1745 que
//          con la hoja de estilos sin él.
//   ✅ F · EL INSTRUMENTO VE: sin el bloque, a 390, hay controles cortos. Si no los hubiera, este
//          guard no sabría distinguir «arreglado» de «no miro» y sale 2.
//
// ⚠️ LO QUE NO MIDE, declarado: los 36 px de escritorio (son de `guard:objetivo-tactil` y del censo
// del panel), el teclado en pantalla, la hoja de dictado que abre «Dictar», ni un navegador que no
// sea Chromium. La hoja de ALTA («Crear albarán») usa el mismo editor dentro de otra hoja: aquí se
// mide la de «Editar».
//
// `HOJAS_CSS=<fichero>` mide contra OTRA hoja de estilos (la de producción descargada, para el rojo
// primero). `HOJAS_CAPTURAS=<carpeta>` deja una foto por caso. `HOJAS_CASO=<prefijo>` corre uno.
//
// ── SUELO ────────────────────────────────────────────────────────────────────────────────────
// Si la hoja no pinta sus líneas, sus casillas o sus botones, o el modal no trae su fecha y sus dos
// botones, el caso es CIEGO (2): una hoja a medio pintar tiene menos que medir y saldría «limpia».
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer-core';
import { veredictoDe } from './_hallazgos-y-ciegos.mjs';
import { lanzarNavegador } from './_navegador.mjs';
import { levantarServidor } from './_servidor.mjs';
import { FUENTE_MEDIDOR, INTERACTIVOS, MINIMO_TACTIL, CORTE_MOVIL } from './_medidor-de-toque.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(RAIZ, 'public');
let PUERTO = Number(process.env.HOJAS_PUERTO || 0);

const ABRE_BLOQUE = '/* ══ S4 · SCRUM-1745 ·';
const CIERRA_BLOQUE = '/* ══ fin S4 · SCRUM-1745 ══ */';
const CONCEPTO = '(prueba) Revisión de la caldera';

const VENTANAS = [
  { id: '390×844', width: 390, height: 844, movil: true },
  { id: '320×568', width: 320, height: 568, movil: true },
  { id: '1280×800', width: 1280, height: 800, movil: false },
];

const linea = (n, conPrecio) => ({
  concepto: n === 0 ? CONCEPTO : `(prueba) Latiguillo de 40 cm, ${n}`,
  cantidad: 2,
  unidad: 'ud',
  precioUnitario: conPrecio ? 12.5 : null,
  tipoIva: conPrecio ? 21 : null,
});
const albaran = (estado, modo) => ({
  id: 54,
  numero: 'AB260009',
  estado,
  version: 1,
  modoValoracion: modo,
  ocultarPreciosEnDocumento: false,
  lugarEntrega: null,
  fechaEntrega: null,
  notas: null,
  docHeaderText: null,
  lineas: [linea(0, modo === 'VALORADO'), linea(1, modo === 'VALORADO')],
});

/** Las SUPERFICIES. `espera` es lo que tiene que haber pintado para que el caso se juzgue. */
const SUPERFICIES = [
  { id: 'Editar albarán · borrador con precios · oficina', tipo: 'hoja', rol: 'admin', alb: albaran('borrador', 'VALORADO'), espera: { conceptos: 2, casillas: 2, precios: 2 } },
  { id: 'Editar albarán · borrador sin precios · oficina', tipo: 'hoja', rol: 'admin', alb: albaran('borrador', 'SIN_VALORAR'), espera: { conceptos: 2, casillas: 1, precios: 0 } },
  { id: 'Editar albarán · emitido con precios · oficina', tipo: 'hoja', rol: 'admin', alb: albaran('emitido', 'VALORADO'), espera: { conceptos: 2, casillas: 1, precios: 2 } },
  { id: 'Editar albarán · borrador · técnico', tipo: 'hoja', rol: 'tecnico', alb: albaran('borrador', 'SIN_VALORAR'), espera: { conceptos: 2, casillas: 0, precios: 0 } },
  { id: 'Agendar · trabajo sin fecha', tipo: 'agendar', rol: 'admin', trabajo: { id: 85, status: 'pendiente', scheduledAt: null }, espera: { botones: ['Cancelar', 'Agendar'] } },
  { id: 'Reagendar · trabajo con fecha', tipo: 'agendar', rol: 'admin', trabajo: { id: 85, status: 'agendado', scheduledAt: '2026-11-18T09:00:00.000Z' }, espera: { botones: ['Cancelar', 'Reagendar'] } },
];
const CASOS = [];
for (const s of SUPERFICIES) for (const v of VENTANAS) CASOS.push({ ...s, id: `${s.id} · ${v.id}`, superficie: s.id, v });

function scriptsDelPanel() {
  const html = fs.readFileSync(path.join(PUBLIC, 'dashboard', 'index.html'), 'utf8');
  const fuera = [];
  const re = /<script[^>]*\ssrc="\.\/js\/([^"?]+)[^"]*"/g;
  let m;
  while ((m = re.exec(html))) if (m[1] !== 'app.js') fuera.push('/dashboard/js/' + m[1]);
  return fuera;
}

function paginaHtml(scripts, variante) {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
    + '<link rel="stylesheet" href="/tokens.css">\n'
    + '<link rel="stylesheet" href="/dashboard/css/styles.css?variante=' + variante + '">\n'
    + '</head><body>\n'
    + '<script>window.appLocale = { currency: "EUR" };'
    + 'window.fetch = function () { return Promise.resolve(new Response("{}", { status: 200, headers: { "content-type": "application/json" } })); };<\/script>\n'
    + scripts.map((s) => '<script src="' + s + '"><\/script>').join('\n')
    + '\n</body></html>';
}

/** La hoja de estilos que se sirve: la del árbol (o `HOJAS_CSS`), entera o SIN el bloque de SCRUM-1745. */
function hojaDeEstilos() {
  const f = process.env.HOJAS_CSS ? path.resolve(process.env.HOJAS_CSS) : path.join(PUBLIC, 'dashboard', 'css', 'styles.css');
  const real = fs.readFileSync(f, 'utf8');
  const a = real.indexOf(ABRE_BLOQUE);
  const b = real.indexOf(CIERRA_BLOQUE);
  const tieneBloque = a >= 0 && b > a;
  const sin = tieneBloque ? real.slice(0, a) + real.slice(b + CIERRA_BLOQUE.length) : real;
  return { fichero: f, real, sin, tieneBloque };
}

function arrancarServidor(scripts, css) {
  const app = express();
  app.get('/dashboard/__hojas.html', (q, res) => res.type('html').send(paginaHtml(scripts, q.query.variante === 'sin' ? 'sin' : 'real')));
  app.get('/dashboard/css/styles.css', (q, res) => res.type('text/css').send(q.query.variante === 'sin' ? css.sin : css.real));
  app.use((req, res, next) => {
    const f = path.join(PUBLIC, req.path.replace(/^\//, ''));
    if (!f.startsWith(PUBLIC) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return next();
    res.type(f.endsWith('.css') ? 'text/css' : f.endsWith('.js') ? 'text/javascript' : 'text/plain').send(fs.readFileSync(f, 'utf8'));
  });
  const srv = http.createServer(app);
  return levantarServidor(srv, PUERTO).then((p) => { PUERTO = p; return srv; });
}

// ── LO QUE CORRE DENTRO DE LA PÁGINA (en cadenas: censo de SCRUM-258) ────────────────────────

/** Abre la hoja o el modal como los abre la ficha del trabajo. Devuelve null o por qué no se pudo. */
const ABRIR = new Function('caso', `
  window.appUserRole = caso.rol;
  try {
    if (caso.tipo === 'hoja') {
      if (typeof openAlbEditorSheet !== 'function') return 'no existe openAlbEditorSheet';
      openAlbEditorSheet(caso.alb, { cur: 'EUR', refresh: function () {}, setStatus: function () {}, direccionSugerida: null });
    } else {
      if (typeof window.abrirAgendarTrabajo !== 'function') return 'no existe window.abrirAgendarTrabajo';
      window.abrirAgendarTrabajo(caso.trabajo, function () {});
    }
  } catch (e) { return 'abrir lanzó: ' + (e && e.message ? e.message : String(e)); }
  return document.querySelector('.modal-overlay [role="dialog"], .modal-overlay[role="dialog"]') ? null : 'no hay diálogo en el DOM';
`);

/** El censo de lo que se puede pulsar dentro del diálogo, con su caja y su ÁREA de toque. */
const CENSAR = new Function('SEL', 'CONCEPTO', `
  return (async function () {
    var capa = document.querySelector('.modal-overlay');
    var tarjeta = capa.querySelector('.modal');
    var ancho = async function (el) {
      var r = el.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var toca = function (x) { var a = document.elementsFromPoint(x, cy)[0]; return !!a && a.closest(SEL) === el; };
      if (!toca(cx)) return null;
      var izq = cx, der = cx;
      while (izq > cx - 90 && toca(izq - 0.5)) izq -= 0.5;
      while (der < cx + 90 && toca(der + 0.5)) der += 0.5;
      return +(der - izq).toFixed(1);
    };
    var nombre = function (el) {
      var t = (el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.textContent || '').trim().replace(/\\s+/g, ' ');
      if (!t && el.id) { var l = document.querySelector('label[for="' + el.id + '"]'); if (l) t = l.textContent.trim(); }
      if (!t && el.closest('label')) t = el.closest('label').textContent.trim();
      var tipo = el.tagName === 'INPUT' ? 'input[' + el.type + ']' : el.tagName.toLowerCase();
      return tipo + ' «' + t.slice(0, 40) + '»';
    };
    var fuera = [];
    var todos = Array.prototype.slice.call(tarjeta.querySelectorAll(SEL));
    for (var i = 0; i < todos.length; i++) {
      var el = todos[i];
      var r0 = el.getBoundingClientRect();
      if (!r0.width || !r0.height) continue;
      var a = await window.__areaDeToque(el, SEL, { scroll: true });
      var r = el.getBoundingClientRect();
      var fila = { quien: nombre(el), w: +r.width.toFixed(1), h: +r.height.toFixed(1), tocable: a.tocable == null ? null : a.tocable, error: a.error || null, tocableAncho: null,
        tipo: el.tagName === 'INPUT' ? el.type : el.tagName.toLowerCase(), placeholder: el.getAttribute('placeholder') || '', texto: (el.textContent || '').trim() };
      if (!a.error && r.width < 44) fila.tocableAncho = await ancho(el);
      if (fila.placeholder === 'Concepto') { fila.valor = el.value; fila.cabe = el.scrollWidth <= el.clientWidth + 0.5; fila.verAncho = el.clientWidth; fila.pideAncho = el.scrollWidth; }
      fuera.push(fila);
    }
    var t = tarjeta.getBoundingClientRect();
    return { ventana: { w: window.innerWidth, h: window.innerHeight }, tarjeta: { x: +t.left.toFixed(1), w: +t.width.toFixed(1), der: +t.right.toFixed(1) },
      desbordaDeLado: document.documentElement.scrollWidth > window.innerWidth + 0.5 || tarjeta.scrollWidth > tarjeta.clientWidth + 0.5, controles: fuera };
  })();
`);

const px = (n) => (n == null ? '—' : String(Math.round(n * 10) / 10));

async function foto(pag, caso, variante) {
  const carpeta = process.env.HOJAS_CAPTURAS;
  if (!carpeta) return;
  fs.mkdirSync(carpeta, { recursive: true });
  const nombre = caso.id.normalize('NFD').replace(/[^\w×]+/g, '-').replace(/×/g, 'x').replace(/^-|-$/g, '').toLowerCase();
  await pag.screenshot({ path: path.join(carpeta, `${nombre}-${variante}.png`) });
}

const hallazgos = [];
const ciegos = [];
const filas = [];

const scripts = scriptsDelPanel();
if (scripts.length < 50 || !scripts.includes('/dashboard/js/jobDetailView.js') || !scripts.includes('/dashboard/js/jobAgendar.js')) {
  ciegos.push(`index.html da ${scripts.length} scripts y tienen que estar jobDetailView.js y jobAgendar.js: no monto el panel real`);
}
const css = hojaDeEstilos();
if (ciegos.length) {
  const v = veredictoDe({ hallazgos, ciegos });
  console.error(`\n  🔴 NO SUPE MEDIR: ${ciegos.join(' · ')}\n\n  ${v.linea}\n`);
  process.exit(v.codigo);
}

/** Monta un caso con una variante de la hoja de estilos y devuelve `{ fatal }` o el censo. */
async function medir(navegador, caso, variante) {
  const pag = await navegador.newPage();
  const errores = [];
  pag.on('pageerror', (e) => errores.push(String(e.message).slice(0, 120)));
  try {
    await pag.setViewport({ width: caso.v.width, height: caso.v.height, isMobile: caso.v.movil, hasTouch: caso.v.movil });
    await pag.goto(`http://127.0.0.1:${PUERTO}/dashboard/__hojas.html?variante=${variante}`, { waitUntil: 'load' });
    const fatal = await pag.evaluate(ABRIR, caso);
    if (fatal) return { fatal: fatal + (errores.length ? ' · errores de página: ' + errores.join(' | ') : '') };
    await pag.evaluate(FUENTE_MEDIDOR);
    const censo = await pag.evaluate(CENSAR, INTERACTIVOS, CONCEPTO);
    await pag.evaluate(() => { const m = document.querySelector('.modal-overlay .modal-body, .modal-overlay .modal'); if (m) m.scrollTop = 0; });
    await foto(pag, caso, variante);
    return { censo };
  } finally {
    await pag.close();
  }
}

/** ¿Pintó lo que tenía que pintar? Devuelve la lista de lo que falta (vacía = se puede juzgar). */
function loQueFalta(caso, c) {
  const falta = [];
  const de = (f) => c.controles.filter(f);
  if (c.ventana.w !== caso.v.width || c.ventana.h !== caso.v.height) falta.push(`la ventana es ${c.ventana.w}×${c.ventana.h}`);
  if (c.controles.some((x) => x.error)) falta.push('el medidor no alcanza: ' + c.controles.filter((x) => x.error).map((x) => `${x.quien} (${x.error})`).join(' · '));
  if (caso.tipo === 'hoja') {
    const conceptos = de((x) => x.placeholder === 'Concepto');
    if (conceptos.length !== caso.espera.conceptos) falta.push(`pinta ${conceptos.length} conceptos de ${caso.espera.conceptos}`);
    if (!conceptos.some((x) => x.valor === CONCEPTO)) falta.push('ningún concepto trae el texto de prueba');
    const casillas = de((x) => x.tipo === 'checkbox');
    if (casillas.length !== caso.espera.casillas) falta.push(`pinta ${casillas.length} casillas de ${caso.espera.casillas}`);
    const precios = de((x) => x.placeholder === 'Precio ud.');
    if (precios.length !== caso.espera.precios) falta.push(`pinta ${precios.length} campos de precio de ${caso.espera.precios}`);
    if (de((x) => x.tipo === 'button' && x.texto === '×').length !== 1) falta.push('no trae el «×» de la cabecera');
    if (de((x) => x.tipo === 'button' && x.texto === '✕').length !== caso.espera.conceptos) falta.push('no trae un «✕» por línea');
    if (!de((x) => x.tipo === 'button' && x.texto === 'Cancelar').length) falta.push('no trae «Cancelar»');
    if (!de((x) => x.tipo === 'textarea').length) falta.push('no trae las notas');
  } else {
    if (de((x) => x.tipo === 'datetime-local').length !== 1) falta.push('no trae la fecha');
    const botones = de((x) => x.tipo === 'button').map((x) => x.texto);
    if (botones.join('|') !== caso.espera.botones.join('|')) falta.push(`los botones son «${botones.join('», «')}» y se esperaban «${caso.espera.botones.join('», «')}»`);
  }
  return falta;
}

/** Los controles que no llegan, a un ancho de móvil. */
function cortos(c) {
  const mal = [];
  for (const x of c.controles) {
    if (x.tocable < MINIMO_TACTIL - 0.5) mal.push(`A · ${x.quien} recibe el toque en ${px(x.tocable)} px de alto (caja ${px(x.w)}×${px(x.h)}; mínimo ${MINIMO_TACTIL})`);
    if (x.tocableAncho != null && x.tocableAncho < MINIMO_TACTIL - 0.5) mal.push(`B · ${x.quien} recibe el toque en ${px(x.tocableAncho)} px de ancho (caja ${px(x.w)}×${px(x.h)}; mínimo ${MINIMO_TACTIL})`);
    if (x.placeholder === 'Concepto' && !x.cabe) mal.push(`C · el Concepto «${x.valor}» no se lee entero: el campo enseña ${px(x.verAncho)} px de ${px(x.pideAncho)}`);
  }
  if (c.tarjeta.x < -0.5 || c.tarjeta.der > c.ventana.w + 0.5 || c.desbordaDeLado) mal.push(`D · se sale de lado: la tarjeta va de x=${px(c.tarjeta.x)} a ${px(c.tarjeta.der)} en una ventana de ${c.ventana.w}`);
  return mal;
}

const huella = (c) => c.controles.map((x) => `${x.quien} ${x.w}×${x.h} toque ${x.tocable}`).join('\n');

const srv = await arrancarServidor(scripts, css);
let navegador;
let cortosSinBloque = 0;
let medidosSinBloque = 0;
try {
  navegador = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });
  for (const caso of CASOS) {
    if (process.env.HOJAS_CASO && !caso.id.startsWith(process.env.HOJAS_CASO)) continue;
    const real = await medir(navegador, caso, 'real');
    if (real.fatal) { ciegos.push(`${caso.id} → ${real.fatal}`); continue; }
    const falta = loQueFalta(caso, real.censo);
    if (falta.length) { ciegos.push(`${caso.id} → ${falta.join(' · ')}`); continue; }

    const mal = [];
    let nota = '';
    if (caso.v.width <= CORTE_MOVIL) {
      mal.push(...cortos(real.censo));
      // F · el instrumento ve: la misma superficie SIN el bloque.
      if (css.tieneBloque) {
        const sin = await medir(navegador, caso, 'sin');
        if (sin.fatal || loQueFalta(caso, sin.censo).length) ciegos.push(`${caso.id} → sin el bloque no se pudo montar: ${sin.fatal || loQueFalta(caso, sin.censo).join(' · ')}`);
        else { medidosSinBloque++; const n = cortos(sin.censo).length; cortosSinBloque += n; nota = ` · sin el bloque: ${n} cortos`; }
      }
    } else if (css.tieneBloque) {
      // E · a escritorio, nada cambia.
      const sin = await medir(navegador, caso, 'sin');
      if (sin.fatal) ciegos.push(`${caso.id} → sin el bloque no se pudo montar: ${sin.fatal}`);
      else if (huella(sin.censo) !== huella(real.censo)) {
        const a = huella(sin.censo).split('\n');
        const b = huella(real.censo).split('\n');
        const dif = b.filter((l, i) => l !== a[i]).slice(0, 4);
        mal.push(`E · a ${caso.v.id} el bloque de SCRUM-1745 CAMBIA el escritorio: ${dif.join(' | ')}`);
      } else nota = ' · idéntico sin el bloque';
    }
    const alturas = real.censo.controles.map((x) => px(x.tocable));
    filas.push({ id: caso.id, ok: !mal.length, resumen: `${real.censo.controles.length} controles · toque mínimo ${Math.min(...real.censo.controles.map((x) => x.tocable))} px (${alturas.join('/')})${nota}` });
    if (mal.length) hallazgos.push({ id: caso.id, mal });
  }
} finally {
  if (navegador) await navegador.close();
  srv.close();
}

console.log('');
console.log('  SCRUM-1745 · LA HOJA «EDITAR ALBARÁN» Y EL MODAL «AGENDAR», AL PULGAR (lo real, abierto como lo abre la ficha del trabajo)');
console.log(`  HOJA DE ESTILOS: ${path.relative(RAIZ, css.fichero) || css.fichero} · bloque de SCRUM-1745: ${css.tieneBloque ? 'sí' : 'NO ESTÁ'}`);
console.log(`  POBLACIÓN: ${CASOS.length} casos (${SUPERFICIES.length} superficies × ${VENTANAS.map((v) => v.id).join(', ')}) · medidos ${filas.length}`);
for (const f of filas) console.log(`   ${f.ok ? '✔' : '🔴'} ${f.id} · ${f.resumen}`);

if (!process.env.HOJAS_CASO && filas.length + ciegos.length < CASOS.length) ciegos.push(`se juzgaron ${filas.length} casos de ${CASOS.length}`);
// F · sin el bloque tiene que haber cortos; si no, no sé si miro.
if (css.tieneBloque && !process.env.HOJAS_CASO && !hallazgos.length && !ciegos.length && !(medidosSinBloque > 0 && cortosSinBloque > 0)) {
  ciegos.push(`F · sin el bloque de SCRUM-1745 salen ${cortosSinBloque} controles cortos en ${medidosSinBloque} casos de móvil: o la base ya da 44 (y el bloque y este control sobran) o no estoy midiendo`);
}
if (ciegos.length) {
  console.error('\n  🔴 NO SUPE MEDIR — esto NO es «cumple»:\n');
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
console.log(`\n  ✔ los ${CASOS.length} casos: a 390 y a 320 todo recibe el toque en ${MINIMO_TACTIL} px, el Concepto se lee entero y nada se sale de lado; a 1280 nada cambia (sin el bloque había ${cortosSinBloque} cortos en ${medidosSinBloque} casos de móvil).\n`);
