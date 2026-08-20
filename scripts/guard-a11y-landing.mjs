// scripts/guard-a11y-landing.mjs — SCRUM-543 · la landing PUBLICADA, medida en el ÁRBOL DE
// ACCESIBILIDAD RENDERIZADO y en el ÁREA TOCABLE REAL (Edge via puppeteer-core).
//
// Uso:  npm run guard:a11y-landing
//
// ── LOS TRES DEFECTOS QUE VIGILA ─────────────────────────────────────────────
// ① TEXTO PEGADO. Un separador VISUAL vacío (`<span class="dot">`) o un `<br>` no aportan ni un
//    espacio al nombre accesible: se oía «Sin tarjetaListo en 5 minutos» y «Creas el
//    presupuestoDel catálogo». El sintetizador pronuncia «tarjetaListo» como una palabra.
//    🔴 Y el `<br>` es el caso instructivo: SEPARA A LA VISTA y NO en el árbol. `innerText` da
//    saltos de línea ahí, así que un guard que mirase `innerText` daría verde. El árbitro tiene
//    que ser el árbol.
// ② SECCIONES SIN NOMBRE. Una `<section>` sin nombre accesible sale como `generic`; con nombre,
//    como `region`. Sin regiones no se puede navegar por secciones, que es como se recorre una
//    página larga cuando no se ve. El nombre sale del ENCABEZADO QUE YA EXISTE (regla 30: aquí
//    no se escribe ni una palabra de copy).
// ③ TÁCTILES < 44 px (AB6). El logo medía 34 y es el que más se toca por error; «Ver planes →»,
//    24. 🔴 Y no se mide la CAJA sino QUÉ ELEMENTO RECIBE EL TOQUE (`elementsFromPoint`): el área
//    del enlace se amplía con un pseudo-elemento, así que su `getBoundingClientRect` sigue
//    diciendo 24 y estaría mintiendo hacia el lado cómodo.
//
// ── POR QUÉ FUERA DE `npm test` ──────────────────────────────────────────────
// Misma decisión que `guard:contraste`, `guard:caja-avisos`, `guard:aviso-bizum` y
// `guard:vias-de-cobro`: la suite no arranca navegador. La red que SÍ corre siempre es
// `tests/scrum543-landing-a11y.test.mjs`.
//
// ── LO QUE NO MIDE, Y SE DICE CON ESAS PALABRAS ──────────────────────────────
// Las secciones `#gremios` y `#comparativa` están EN PROPUESTA (`hidden` + su marca) y quedan
// FUERA a propósito: su copy no está aprobado y no se toca. Cuando se publiquen, entran aquí.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const PUBLIC = path.join(RAIZ, 'public');
const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PUERTO = Number(process.env.A11Y_LANDING_PUERTO || 4403);

const ANCHOS = [1280, 360];

/** ① Cada caso con lo que NO debe oírse (pegado) y lo que SÍ debe oírse (separado). */
const SEPARADORES = [
  { sel: '.note',     pegado: ['gratisSin', 'tarjetaListo'],   separado: ['gratis Sin', 'tarjeta Listo'] },
  { sel: '.try-step', pegado: ['1Creas', 'presupuestoDel'],    separado: ['1 Creas', 'presupuesto Del'] },
];

/** ② Las secciones PUBLICADAS y el encabezado con el que cada una debe anunciarse. */
const REGIONES = {
  'reg-hero': 'Del presupuesto al cobro',
  'reg-probar': 'Haz el recorrido completo',
  'reg-como': 'Tres pasos',
  'reg-todo': 'Seis herramientas',
  'reg-precios': 'Un solo plan',
  'reg-faq': 'Preguntas de compañeros',
  'reg-cta': 'Tu próxima cotización',
};

/** ③ Los táctiles, con el mínimo de AB6. */
const TACTILES = [
  { sel: 'header a.logo', nombre: 'el logo' },
  { sel: '#announce a',   nombre: '«Ver planes →»', destapar: '#announce' },
];
const MINIMO_TACTIL = 44;

const TIPOS = { '.css': 'text/css', '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };

const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const abs = path.join(PUBLIC, p);
  if (!abs.startsWith(PUBLIC) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
    res.writeHead(404); return res.end('no');
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(abs)] || 'application/octet-stream' });
  res.end(fs.readFileSync(abs));          // del DISCO en cada petición
});

/** Todo el texto que cuelga de un nodo del árbol de accesibilidad. */
function textoDelSubarbol(n) {
  let t = (n?.name || '') + ' ' + (n?.value || '');
  for (const h of n?.children || []) t += ' ' + textoDelSubarbol(h);
  return t.replace(/\s+/g, ' ').trim();
}
function aplanar(n, acc = []) { if (!n) return acc; acc.push(n); for (const h of n.children || []) aplanar(h, acc); return acc; }

/**
 * ⚠️ SE COMPARA SIN DISTINGUIR MAYÚSCULAS. El árbol devuelve el texto YA TRANSFORMADO por
 * `text-transform`, así que comparar con la caja del HTML da rojo permanente sin nada roto — y un
 * rojo permanente es el que el segundo que lo vea desactiva. (Medido en SCRUM-541.)
 */
const caja = (s) => s.toLocaleUpperCase('es');

const log = (...a) => console.log(...a);
let fallos = 0;

await new Promise((r) => srv.listen(PUERTO, r));
if (!fs.existsSync(EDGE)) {
  console.error(`🔴 NO SUPE MIRAR: no encuentro Edge en ${EDGE}. Define EDGE_PATH.`);
  srv.close(); process.exit(2);
}
const navegador = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });

try {
  log('Guard de accesibilidad de la landing PUBLICADA (SCRUM-543)');
  log('Árbitros: el árbol de accesibilidad y el área que RECIBE EL TOQUE.\n');

  for (const ancho of ANCHOS) {
    const page = await navegador.newPage();
    await page.setViewport({ width: ancho, height: 900 });
    await page.goto(`http://127.0.0.1:${PUERTO}/`, { waitUntil: 'load' });
    // La barra de anuncio nace oculta (se enciende por JS con las plazas). Se destapa AQUÍ, en la
    // página cargada, nunca en el fichero.
    await page.evaluate(() => document.querySelector('#announce')?.removeAttribute('hidden'));

    log(`── ${ancho}px`);

    // ── SUELO: ¿se puede leer el árbol y está la página que creo? ─────────────
    const raiz = await page.accessibility.snapshot({ interestingOnly: false });
    const nodos = aplanar(raiz);
    if (!raiz || nodos.length < 20) {
      console.error(`   🔴 NO SUPE MIRAR: el árbol de accesibilidad vino con ${nodos.length} nodos.`);
      fallos++; await page.close(); continue;
    }

    // ── ① SEPARADORES ────────────────────────────────────────────────────────
    for (const caso of SEPARADORES) {
      const nodo = await page.$(caso.sel);
      if (!nodo) { console.error(`   🔴 NO SUPE MIRAR: no encuentro ${caso.sel}`); fallos++; continue; }
      const t = textoDelSubarbol(await page.accessibility.snapshot({ root: nodo, interestingOnly: false }));
      if (!t) { console.error(`   🔴 NO SUPE MIRAR: ${caso.sel} no aparece en el árbol`); fallos++; continue; }
      let mal = 0;
      for (const p of caso.pegado) {
        if (caja(t).includes(caja(p))) { console.error(`   ✖ ${caso.sel} se oye PEGADO: «…${p}…»`); fallos++; mal++; }
      }
      // CONTROL POSITIVO: no basta con que no esté lo pegado — tiene que estar lo separado. Si el
      // nodo se quedara vacío, «no está lo pegado» sería verdad y el guard daría verde.
      for (const s of caso.separado) {
        if (!caja(t).includes(caja(s))) { console.error(`   ✖ ${caso.sel} NO trae «${s}»: ¿ha cambiado el texto?`); fallos++; mal++; }
      }
      if (!mal) log(`   ✔ ${caso.sel} suena separado: «${t.slice(0, 62)}»`);
    }

    // ── ② REGIONES ───────────────────────────────────────────────────────────
    // Una <section> con nombre sale como `region`; sin nombre, como `generic`. Se mide el ROL.
    const regiones = nodos.filter((n) => n.role === 'region').map((n) => (n.name || '').trim());
    const faltan = [];
    for (const [id, esperado] of Object.entries(REGIONES)) {
      if (!regiones.some((r) => caja(r).includes(caja(esperado)))) faltan.push(`${id} («${esperado}…»)`);
    }
    if (faltan.length) {
      console.error(`   ✖ secciones que NO llegan como región con nombre: ${faltan.join(', ')}`);
      fallos++;
    } else {
      log(`   ✔ ${regiones.length} regiones con nombre, las ${Object.keys(REGIONES).length} publicadas entre ellas`);
    }

    // ── ③ TÁCTILES ───────────────────────────────────────────────────────────
    for (const t of TACTILES) {
      const medida = await page.evaluate((sel, min) => {
        const el = document.querySelector(sel);
        if (!el) return { error: 'NO EXISTE' };
        const r = el.getBoundingClientRect();
        if (!r.height) return { error: 'no se está pintando' };
        const cx = r.left + r.width / 2;
        const toca = (y) => document.elementsFromPoint(cx, y).includes(el);
        // CONTROL POSITIVO del detector: en el centro TIENE que tocar. Si no, no está midiendo
        // el elemento que cree y su «cumple» no valdría nada.
        if (!toca(r.top + r.height / 2)) return { error: 'el detector no alcanza el elemento ni en su centro' };
        // CONTROL NEGATIVO: 400 px por debajo NO puede tocarlo.
        if (toca(r.top + r.height / 2 + 400)) return { error: 'el detector dice que toca a 400px: no sabe decir que no' };
        let top = r.top, bottom = r.bottom;
        while (top > r.top - 60 && toca(top - 0.5)) top -= 0.5;
        while (bottom < r.bottom + 60 && toca(bottom + 0.5)) bottom += 0.5;
        return { caja: +r.height.toFixed(1), tocable: +(bottom - top).toFixed(1), cumple: (bottom - top) >= min };
      }, t.sel, MINIMO_TACTIL);

      if (medida.error) { console.error(`   🔴 NO SUPE MIRAR ${t.nombre}: ${medida.error}`); fallos++; continue; }
      if (!medida.cumple) {
        console.error(`   ✖ ${t.nombre}: área tocable ${medida.tocable}px < ${MINIMO_TACTIL} (AB6)`);
        fallos++;
      } else {
        log(`   ✔ ${t.nombre}: ${medida.tocable}px tocables (caja ${medida.caja}px)`);
      }
    }
    log('');
    await page.close();
  }
} finally {
  await navegador.close();
  srv.close();
}

if (fallos) {
  console.error(`\n🔴 ${fallos} problema(s) de accesibilidad en la landing publicada.`);
  process.exit(1);
}
console.log('✓ En los dos anchos: nada suena pegado, las 7 regiones tienen nombre y los táctiles llegan a 44.');
