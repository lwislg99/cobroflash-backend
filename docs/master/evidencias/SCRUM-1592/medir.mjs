// docs/master/evidencias/SCRUM-1592/medir.mjs — SCRUM-1592
//
// Mide EN NAVEGADOR (Edge vía puppeteer-core, el de la casa) el ÁREA QUE RECIBE EL TOQUE de los cuatro
// campos de Clientes que SCRUM-1584 destapó cortos a 390 px, a 320, 390 y 1280 px:
//   · la barra de la lista (`customersView.js`): el buscador y los dos `select` visibles (etiqueta y orden);
//   · la ficha 360 (`customerDetailView.js`): el campo de etiquetas dentro de `#c360-meta`.
// Las páginas las pinta el PRODUCTO con los mismos fixtures que `guard:objetivo-tactil`
// (`scripts/_pagina-panel.mjs`). No depende del medidor de SCRUM-1584: pasa su propio selector.
//
// Población DECLARADA: 3 en la barra (el `select` de visitas nace oculto sin visitas en el lote) y 1 en
// la ficha, por anchura. Si no cuadra → CIEGO.
//
// Controles:
//   · SEMILLA (positivo sembrado): un `<input class="input">` metido en la misma tarjeta pero FUERA del
//     alcance de la regla de SCRUM-1592. A 320 y 390 TIENE que salir corto; si no, CIEGO.
//   · `--sin-semilla`: no se siembra → TIENE que salir CIEGO (salida 2).
//   · `--antes`: sirve `styles.css` de `origin/main` (git show) en vez del del árbol: los cuatro TIENEN
//     que salir cortos a 320 y 390. Es la foto de antes.
//   · `CAPTURAS_EN=<dir>`: PNG de la barra y del bloque `#c360-meta` por anchura.
//   · `--fuente-corta` (SCRUM-1592b): inyecta `.input { font-size: 11px }` para que el alto NATURAL de `.input`
//     baje de 36, como en el Chromium de Linux de CI (34 de caja a 929 sin mínimo, contra 36 en Windows).
//     No imita la fuente de Linux: sólo la consecuencia. `line-height` no sirve (Chromium no lo aplica al
//     alto de un `input`: medido, la semilla salió CIEGA). En ese modo la semilla TIENE que salir corta
//     también en escritorio.
//
// Mínimo por anchura: el de la casa (`minimoPara`: 44 hasta el corte de móvil, 36 por encima).
// Salidas: 0 todos cumplen · 1 alguno corto · 2 CIEGO.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { abrirNavegador } from '../../../../scripts/_banco-lista.mjs';
import { FUENTE_MEDIDOR, minimoPara } from '../../../../scripts/_medidor-de-toque.mjs';
import { paginaDeClientes, paginaDeVista, DETALLE_360_DE_MUESTRA, ARGUMENTOS_DE_VISTA } from '../../../../scripts/_pagina-panel.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const PUBLICO = path.join(RAIZ, 'public');
const ANCHOS = [320, 390, 929, 1280];
const ANTES = process.argv.includes('--antes');
const SEMBRAR = !process.argv.includes('--sin-semilla');
const FUENTE_CORTA = process.argv.includes('--fuente-corta');
const SEL = 'a[href], button, [role="button"], summary, input:not([type="hidden"]), select, textarea';
const BARRA = '.data-card:has(> .barra-seleccion) .data-card-toolbar > .input:not([hidden])';
const META = '#c360-meta .input';

const CSS = ANTES
  ? execFileSync('git', ['show', 'origin/main:public/dashboard/css/styles.css'], { cwd: RAIZ, maxBuffer: 1 << 26 })
  : fs.readFileSync(path.join(PUBLICO, 'dashboard/css/styles.css'));

const envolver = (cuerpo) => `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/dashboard/css/styles.css">
</head><body><div class="view-container">${cuerpo}</div></body></html>`;

const clientes = await paginaDeClientes(RAIZ);
const ficha = await paginaDeVista(RAIZ, 'renderCustomer360View', {
  args: ARGUMENTOS_DE_VISTA.renderCustomer360View,
  datos: (url) => {
    const u = String(url || '');
    if (/\/admin\/customers\/\d+\/detail/.test(u)) return DETALLE_360_DE_MUESTRA;
    if (u.includes('/admin/merchant')) return { id: 1, name: 'Fontanería Soler' };
    return [];
  },
});
if (!clientes.html || !ficha.html) {
  console.log(`🔴 CIEGO: no se montó ${!clientes.html ? 'la lista (' + clientes.aviso + ')' : 'la ficha (' + ficha.aviso + ')'}`);
  process.exit(2);
}

const SUPERFICIES = [
  { ruta: '/__clientes', html: envolver(clientes.html), q: BARRA, esperados: 3, foto: '.data-card-toolbar', nombre: 'barra' },
  { ruta: '/__ficha', html: envolver(ficha.html), q: META, esperados: 1, foto: '#c360-meta', nombre: 'c360' },
];

const srv = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const s = SUPERFICIES.find((x) => x.ruta === p);
  if (s) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(s.html); }
  if (p === '/dashboard/css/styles.css') { res.writeHead(200, { 'Content-Type': 'text/css' }); return res.end(CSS); }
  const abs = path.join(PUBLICO, p);
  if (!abs.startsWith(PUBLICO) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': p.endsWith('.css') ? 'text/css' : 'application/octet-stream' });
  res.end(fs.readFileSync(abs));
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const puerto = srv.address().port;

// La semilla va en el mismo contenedor, pero envuelta en un <div>: ni es hija directa de la barra ni
// cuelga de `#c360-meta`, así que la regla no la alcanza.
const SEMBRAR_JS = (foto) => `(() => { const c = document.querySelector(${JSON.stringify(foto)}); const d = document.createElement('div');
  const i = document.createElement('input'); i.type = 'text'; i.className = 'input'; i.id = '__semilla'; d.appendChild(i);
  c.parentNode.insertBefore(d, c.nextSibling); })()`;

const MEDIR = `(async (Q, SEL) => {
  const out = [];
  for (const el of document.querySelectorAll(Q)) {
    const m = await window.__areaDeToque(el, SEL, { scroll: true });
    out.push({ que: el.tagName + (el.tagName === 'SELECT' ? ' «' + (el.options[0] || {}).text + '»' : ''), alto: Math.round(el.getBoundingClientRect().height * 10) / 10, ...m });
  }
  const s = document.getElementById('__semilla');
  return { reales: out, semilla: s ? await window.__areaDeToque(s, SEL, { scroll: true }) : null };
})`;

const { browser, quien } = await abrirNavegador(puppeteer);
let cortos = 0, ciego = 0;
console.log(`navegador: ${quien} · CSS ${ANTES ? 'de origin/main (ANTES)' : 'del árbol'} · semilla ${SEMBRAR ? 'sí' : 'NO'} · fuente ${FUENTE_CORTA ? 'CORTA (.input a 11px)' : 'la del sistema'} · población declarada 4 por anchura`);
for (const s of SUPERFICIES) {
  for (const ancho of ANCHOS) {
    const MIN = minimoPara(ancho);
    const page = await browser.newPage();
    await page.setViewport({ width: ancho, height: 900 });
    await page.goto(`http://127.0.0.1:${puerto}${s.ruta}`, { waitUntil: 'load' });
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; }' });
    if (FUENTE_CORTA) await page.addStyleTag({ content: '.input { font-size: 11px; }' });
    if (process.env.CAPTURAS_EN) {
      const el = await page.$(s.foto);
      await el.evaluate((e) => e.scrollIntoView({ block: 'center' }));
      await page.mouse.move(1, 1);
      fs.writeFileSync(path.join(process.env.CAPTURAS_EN, `${ANTES ? 'antes' : 'despues'}${FUENTE_CORTA ? '-fuente-corta' : ''}-${s.nombre}-${ancho}.png`), await el.screenshot());
    }
    await page.evaluate(FUENTE_MEDIDOR);
    if (SEMBRAR) await page.evaluate(SEMBRAR_JS(s.foto));
    const r = await page.evaluate(`${MEDIR}(${JSON.stringify(s.q)}, ${JSON.stringify(SEL)})`);
    await page.close();
    const cab = `${s.nombre} @${ancho}px (mínimo ${MIN})`;
    if (r.reales.length !== s.esperados) { ciego++; console.log(`🔴 CIEGO ${cab}: población ${r.reales.length}, declarada ${s.esperados}`); continue; }
    const sem = r.semilla;
    if (ancho < 768 || FUENTE_CORTA) {
      if (!sem || sem.error || !(sem.tocable < MIN)) {
        ciego++; console.log(`🔴 CIEGO ${cab}: la semilla ${sem ? `salió ${sem.error || sem.tocable + ' px'}` : 'no está'} — los verdes de aquí no valen`);
      } else console.log(`✅ semilla ${cab}: ${sem.tocable} px (corta, como debe)`);
    }
    for (const m of r.reales) {
      const ok = !m.error && m.tocable >= MIN;
      if (m.error) ciego++; else if (!ok) cortos++;
      console.log(`   ${m.error ? '🔴 NO MEDIDO' : ok ? '✅' : '❌ CORTO'} ${cab} ${m.que} · alto ${m.alto} · caja ${m.caja} · toque ${m.tocable ?? '-'}${m.error ? ' · ' + m.error : ''}`);
    }
  }
}
await browser.close();
srv.close();
console.log(`\nRESUMEN · mediciones declaradas ${4 * ANCHOS.length} · cortas ${cortos} · ciegas ${ciego}`);
process.exit(ciego ? 2 : cortos ? 1 : 0);
