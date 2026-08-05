// scripts/guard-contraste.mjs — SCRUM-368: guard de contraste WCAG AA, MEDIDO EN NAVEGADOR.
//
// Uso:  npm run guard:contraste
//
// ── POR QUÉ EN NAVEGADOR Y NO SOBRE EL CSS ───────────────────────────────────
// Se intentó primero con un censo estático del CSS y daba resultados FALSOS: `.sidebar-logo-text`
// salía en 1,00 (blanco sobre blanco) porque el analizador no sabía que ese texto vive dentro del
// sidebar oscuro, y componía mal los fondos `rgba()`. El fondo real de un texto depende de sus
// ancestros y de las transparencias apiladas, que es justo lo que el navegador ya resuelve.
// El navegador es el árbitro.
//
// ── LO QUE VIGILA ────────────────────────────────────────────────────────────
// Recorre todas las páginas HTML de `public/` (derivadas del árbol, no listadas a mano), mide
// cada nodo con texto propio y compara su ratio con el umbral AA que le toca: 4,5:1 normal,
// 3:1 para texto grande (>=24px, o >=18,66px con peso >=700).
//
// Falla si aparece un par color/fondo por debajo de AA que no esté en CONOCIDOS. No congela los
// que ya fallaban —eso sería aprobarlos—: los deja anotados con su motivo y su ticket, y avisa
// también si uno de ellos DESAPARECE, para que la lista no se pudra.
//
// ── LOS GRADIENTES NO SE APRUEBAN NI SE SUSPENDEN ────────────────────────────
// Un texto sobre un fondo con degradado no tiene UN ratio: tiene un rango, distinto en cada
// píxel. Inventarle un número sería peor que no darlo. Se listan aparte, como NO MEDIBLES por
// este guard, para que quien mire sepa que existen y por qué no llevan número.
//
// ── HUECO DECLARADO ──────────────────────────────────────────────────────────
// Las vistas del dashboard que se generan por JS con datos de sesión no se ven aquí: el guard
// carga HTML estático. No invalida el resultado, porque los colores que fallan son TOKENS
// COMPARTIDOS (--brand, --muted) y cualquier uso hereda su ratio por construcción; pero una
// combinación que solo exista dentro de una vista con datos no la cazaría este guard.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const PUBLIC = path.join(RAIZ, 'public');
const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PUERTO = Number(process.env.GUARD_PUERTO || 4399);

// Mínimo de nodos con texto para que la medición signifique algo. Si el guard mide menos que
// esto, algo se rompió al cargar (CSS que no llega, página en blanco) y un cero de fallos
// sería un cero de «no supe mirar». SUELO.
const SUELO_NODOS = 50;

/**
 * Pares por debajo de AA ya conocidos y REPORTADOS, con su motivo. No están aprobados:
 * están esperando una decisión que no es de CSS. Si alguno desaparece, el guard avisa para
 * que se borre de aquí (una excepción que sobrevive a su causa se convierte en permiso).
 */
const CONOCIDOS = [
  {
    texto: 'rgb(255, 255, 255)', fondo: 'rgb(22,163,74)', ratio: 3.3,
    motivo: 'SCRUM-368 · texto blanco sobre el verde de marca en el botón primario. Subirlo a ' +
      '4,5:1 exige mover el verde (identidad, regla 30) o el tamaño del texto de todo el ' +
      'producto. Decisión del fundador, pendiente. Medido: no existe verde MÁS CLARO que cumpla.',
  },
  {
    texto: 'rgb(107, 114, 128)', fondo: 'rgb(2,6,23)', ratio: 4.17,
    motivo: 'SCRUM-368 · gris de Tailwind sobre el tema oscuro de admin.html. Superficie interna ' +
      'del fundador, no la ve ningún cliente. Reportado, sin arreglar (regla 9).',
  },
  {
    texto: 'rgb(106, 116, 110)', fondo: 'rgb(234,246,238)', ratio: 4.36,
    motivo: 'SCRUM-368 · --muted sobre el verde claro de una sección del landing (#eaf6ee), que ' +
      'no es un token sino un fondo local. El ajuste de --muted se calculó contra --bg y ' +
      '--surface. Reportado, sin arreglar (regla 9).',
  },
  {
    texto: 'rgb(255, 255, 255)', fondo: 'rgb(72,158,146)', ratio: 3.21,
    motivo: 'SCRUM-368 · avatar del mockup de WhatsApp del landing: decorativo, imita la UI de ' +
      'otra app. Reportado, sin arreglar (regla 9).',
  },
  {
    texto: 'rgb(138, 154, 146)', fondo: 'rgb(234,227,220)', ratio: 2.32,
    motivo: 'SCRUM-368 · marca de tiempo dentro del mockup de burbuja de WhatsApp del landing: ' +
      'decorativo, imita la UI de otra app. Reportado, sin arreglar (regla 9).',
  },
];

// ── El medidor, que corre DENTRO de la página ───────────────────────────────
// Esta función NO se ejecuta en Node: se serializa y corre en el navegador. Sus globales
// (`document`, `getComputedStyle`) se sacan de `globalThis` en vez de usarse sueltos, para que
// el analizador de SCRUM-258 —que barre estos scripts buscando nombres no declarados— no tenga
// que distinguir runtimes. Es un `ReferenceError` menos que un humano tenga que descartar a mano.
function medirEnPagina() {
  const { document, getComputedStyle } = globalThis;
  const rgb = (s) => { const m = String(s).match(/[\d.]+/g);
    return m ? { r: +m[0], g: +m[1], b: +m[2], a: m[3] === undefined ? 1 : +m[3] } : null; };
  const comp = (f, b) => f.a >= 1 ? f : {
    r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 };
  const lum = ({ r, g, b }) => { const f = (c) => { const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (t, b) => { const c = comp(t, b); const l1 = lum(c), l2 = lum(b);
    const [x, y] = l1 > l2 ? [l1, l2] : [l2, l1]; return (x + 0.05) / (y + 0.05); };

  // Fondo EFECTIVO: sube por ancestros apilando capas y componiendo, como pinta el navegador.
  const fondoEfectivo = (el) => {
    const capas = []; let n = el, gradiente = false;
    while (n && n.nodeType === 1) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') gradiente = true;
      const c = rgb(cs.backgroundColor);
      if (c && c.a > 0) { capas.push(c); if (c.a >= 1) break; }
      n = n.parentElement;
    }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = capas.length - 1; i >= 0; i--) base = comp(capas[i], base);
    return { color: base, gradiente };
  };

  const filas = [];
  for (const el of document.querySelectorAll('*')) {
    const txt = [...el.childNodes].filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim()).join('').trim();
    if (!txt) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
    if (!el.getClientRects().length) continue;
    // texto pintado con degradado (background-clip:text): no tiene un color plano que medir
    if (cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)') continue;
    const fg = rgb(cs.color);
    if (!fg || fg.a === 0) continue;
    const { color: bg, gradiente } = fondoEfectivo(el);
    const px = parseFloat(cs.fontSize), peso = parseInt(cs.fontWeight, 10) || 400;
    const grande = px >= 24 || (px >= 18.66 && peso >= 700);
    filas.push({
      clase: (typeof el.className === 'string' && el.className.trim())
        ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : el.tagName.toLowerCase(),
      muestra: txt.slice(0, 30),
      texto: cs.color,
      fondo: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`,
      px, peso, umbral: grande ? 3 : 4.5,
      ratio: +ratio(fg, bg).toFixed(2),
      gradiente,
    });
  }
  return filas;
}

// ── Servidor estático mínimo sobre public/ ──────────────────────────────────
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

function servir() {
  return new Promise((listo) => {
    const s = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://x');
      let f = path.join(PUBLIC, decodeURIComponent(url.pathname));
      if (url.pathname.endsWith('/')) f = path.join(f, 'index.html');
      fs.readFile(f, (err, buf) => {
        if (err) { res.writeHead(404); res.end('404'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream',
          'Cache-Control': 'no-store' });
        res.end(buf);
      });
    });
    s.listen(PUERTO, () => listo(s));
  });
}

/** Páginas: DERIVADAS del árbol, no escritas a mano. Una página nueva entra sola. */
function paginasDelProducto() {
  const out = [];
  const bajar = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) bajar(p);
      else if (e.name.endsWith('.html')) out.push('/' + path.relative(PUBLIC, p).replace(/\\/g, '/'));
    }
  };
  bajar(PUBLIC);
  return out.sort();
}

// ── Principal ───────────────────────────────────────────────────────────────
const servidor = await servir();
let navegador;
try {
  navegador = await puppeteer.launch({
    executablePath: EDGE, headless: true,
    args: ['--disable-gpu', '--hide-scrollbars', '--no-first-run'],
  });
} catch (e) {
  servidor.close();
  console.error('✖ No se pudo lanzar el navegador. Este guard MIDE, y sin navegador no mide.');
  console.error('  Ajusta EDGE_PATH si Edge está en otra ruta. Detalle: ' + e.message);
  process.exit(1);
}

const paginas = paginasDelProducto();
let nodos = 0;
const bajoAA = [];
const gradientes = [];

for (const ruta of paginas) {
  const page = await navegador.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  try {
    await page.goto(`http://127.0.0.1:${PUERTO}${ruta}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise((r) => setTimeout(r, 600));
    const filas = await page.evaluate(medirEnPagina);
    nodos += filas.length;
    for (const f of filas) {
      if (f.ratio >= f.umbral) continue;
      if (f.gradiente) { gradientes.push({ ...f, pagina: ruta }); continue; }
      bajoAA.push({ ...f, pagina: ruta });
    }
  } catch (e) {
    console.error(`✖ ${ruta}: no se pudo medir — ${e.message}`);
    await page.close(); await navegador.close(); servidor.close();
    process.exit(1);
  }
  await page.close();
}
await navegador.close();
servidor.close();

console.log(`páginas medidas: ${paginas.length}  ·  nodos con texto: ${nodos}`);

// ── SUELO ───────────────────────────────────────────────────────────────────
if (nodos < SUELO_NODOS) {
  console.error(`\n✖ SUELO: solo ${nodos} nodos con texto (mínimo ${SUELO_NODOS}).`);
  console.error('  Cero fallos aquí no significa «todo cumple», significa «no supe mirar».');
  process.exit(1);
}

// ── GRADIENTES: se declaran, no se juzgan ───────────────────────────────────
if (gradientes.length) {
  console.log(`\nNO MEDIBLES por este guard: ${gradientes.length} nodos sobre fondo con degradado.`);
  console.log('  Un degradado no tiene UN ratio, tiene un rango distinto en cada píxel. Ni se');
  console.log('  aprueban ni se suspenden: se listan para que se sepa que existen.');
  const vistos = new Set();
  for (const g of gradientes) {
    const k = g.pagina + '|' + g.clase + '|' + g.texto;
    if (vistos.has(k)) continue; vistos.add(k);
    console.log(`   ${g.pagina}  .${g.clase}  ${g.texto}  ${g.px}px/${g.peso}  «${g.muestra}»`);
  }
}

// ── Comparación con lo conocido ─────────────────────────────────────────────
const clave = (f) => `${f.texto}|${f.fondo}`;
const conocidos = new Map(CONOCIDOS.map((c) => [`${c.texto}|${c.fondo}`, c]));

const nuevos = new Map();
const vistosConocidos = new Set();
for (const f of bajoAA) {
  const k = clave(f);
  if (conocidos.has(k)) { vistosConocidos.add(k); continue; }
  if (!nuevos.has(k)) nuevos.set(k, { ...f, veces: 0, paginas: new Set(), clases: new Set() });
  const v = nuevos.get(k); v.veces++; v.paginas.add(f.pagina); v.clases.add(f.clase);
}

console.log(`\npares por debajo de AA: ${nuevos.size} nuevos · ${vistosConocidos.size}/${CONOCIDOS.length} conocidos presentes`);

let fallo = false;

if (nuevos.size) {
  fallo = true;
  console.error('\n✖ PARES NUEVOS por debajo de WCAG AA:');
  for (const v of [...nuevos.values()].sort((a, b) => a.ratio - b.ratio)) {
    console.error(`\n   ratio ${v.ratio} (umbral ${v.umbral})   ${v.texto}  sobre  ${v.fondo}`);
    console.error(`   páginas: ${[...v.paginas].join(', ')}`);
    console.error(`   clases:  ${[...v.clases].join(', ')}`);
    console.error(`   ejemplo: «${v.muestra}»  ${v.px}px/${v.peso}`);
  }
}

const desaparecidos = CONOCIDOS.filter((c) => !vistosConocidos.has(`${c.texto}|${c.fondo}`));
if (desaparecidos.length) {
  fallo = true;
  console.error('\n✖ EXCEPCIONES QUE YA NO OCURREN — bórralas de CONOCIDOS:');
  for (const d of desaparecidos) console.error(`   ${d.texto} sobre ${d.fondo} (era ${d.ratio})`);
  console.error('  Una excepción que sobrevive a su causa deja de ser una nota y pasa a ser un permiso.');
}

if (fallo) process.exit(1);
console.log('\n✔ ningún par nuevo por debajo de AA');
