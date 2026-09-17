// scripts/guard-falta-en-otra-pestana.mjs — SCRUM-894 · «GUARDAR CAMBIOS» NO PUEDE CALLAR.
//
// Uso:  npm run guard:falta-en-otra-pestana
//
// ── QUÉ SE MIDE ──────────────────────────────────────────────────────────────────────────────
// Configuración tiene diez paneles colgando del MISMO form. Un campo obligatorio vacío de un panel
// OCULTO frena el envío, y el navegador no puede enfocar ni señalar un campo con `display:none`:
// deja «An invalid form control with name='taxId' is not focusable» en la consola y nada más.
// Medido en staging el 17-sep-2026 (main `018d1807`) a 390 y 360 px: NIF vacío, «Guardar cambios»
// desde Cobros → ni aviso, ni foco, ni petición al servidor.
//
// Se pulsa el botón DE VERDAD (clic de puppeteer) y se mira el DOM vivo:
//   · 🔴 lo que falta está en otra pestaña → se abre ESA pestaña, el campo queda enfocado y debajo
//     hay un aviso que nombra el campo y la pestaña, visible y sin salirse de la pantalla;
//   · POSITIVO: con todo puesto guarda igual que hoy (una llamada, sin aviso, sin cambiar de pestaña);
//   · NEGATIVO: si lo que falta se ve, el navegador avisa como hoy y aquí no se añade nada.
//
// ── POR QUÉ FUERA DE `npm test` ──────────────────────────────────────────────────────────────
// La validación de formularios solo existe en un navegador. Misma decisión que guard:vias-de-cobro;
// entra por guards:visuales. La red que SÍ corre siempre es tests/scrum894-falta-en-otra-pestana.test.mjs.
//
// ── SUELO ────────────────────────────────────────────────────────────────────────────────────
// Si la pantalla no llega a pintarse, falta una pestaña o el detector del aviso no sabe decir «no»
// y «sí», sale con 2 (NO SUPE MEDIR) en vez de dar verde. Salidas: 0 de acuerdo, 1 hallazgo, 2 ciego.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from './_navegador.mjs';
import { levantarServidor } from './_servidor.mjs';

export const SALIDA_HALLAZGO = 1;
export const SALIDA_NO_SUPE_MEDIR = 2;

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(RAIZ, 'public');
let PUERTO = Number(process.env.FALTA_PUERTO || 0);

const JS = [
  '/dashboard/js/settingsSubmenus.js',
  '/dashboard/js/puertaSerie.js',
  '/dashboard/js/settingsView.js',
];
const CSS = ['/tokens.css', '/dashboard/css/styles.css'];
const ANCHOS = [390, 360];

// Merchant con TODO lo obligatorio puesto. Cada caso vacía lo suyo en el DOM antes de pulsar.
const MERCHANT = {
  id: 1, name: 'QA 894', legalName: 'QA 894 SL', taxId: 'B12345674', address: 'Calle Falsa 1',
  whatsappPhone: '34000000001', defaultCurrency: 'EUR', invoiceSeriesPrefix: 'F', country: 'ES',
  iban: null, bizumPhone: null, connectStatus: 'none',
};

const CASOS = [
  { id: 'rojo · NIF vacío, Guardar desde Cobros', vaciar: ['taxId'], desde: 'cobro',
    espera: { pestana: 'empresa', foco: 'taxId', aviso: ['NIF/CIF', 'Empresa'], guardados: 0 } },
  { id: 'rojo · prefijo vacío, Guardar desde Cobros', vaciar: ['invoiceSeriesPrefix'], desde: 'cobro',
    espera: { pestana: 'facturacion', foco: 'invoiceSeriesPrefix', aviso: ['Prefijo de serie de facturas', 'Facturación'], guardados: 0 } },
  { id: 'rojo · NIF y prefijo vacíos: manda el primero del formulario', vaciar: ['taxId', 'invoiceSeriesPrefix'], desde: 'cobro',
    espera: { pestana: 'empresa', foco: 'taxId', aviso: ['NIF/CIF', 'Empresa'], guardados: 0 } },
  { id: 'positivo · todo puesto, Guardar desde Cobros', vaciar: [], desde: 'cobro',
    espera: { pestana: 'cobro', foco: null, aviso: null, guardados: 1 } },
  { id: 'negativo · nombre vacío desde Empresa (lo ve: avisa el navegador)', vaciar: ['name'], desde: 'empresa',
    espera: { pestana: 'empresa', foco: 'name', aviso: null, guardados: 0 } },
  { id: 'negativo · nombre (visible) y prefijo (oculto) vacíos desde Empresa', vaciar: ['name', 'invoiceSeriesPrefix'], desde: 'empresa',
    espera: { pestana: 'empresa', foco: 'name', aviso: null, guardados: 0 } },
];

function paginaHtml() {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
    + CSS.map((h) => '<link rel="stylesheet" href="' + h + '">').join('\n')
    + '\n</head><body>\n<div id="vista" class="view-container"></div>\n'
    + '<script>\n'
    + '  window.__merchant = ' + JSON.stringify(MERCHANT) + ';\n'
    + '  window.__guardados = [];\n'
    + '  window.getMerchantProfile = async () => window.__merchant;\n'
    + '  window.updateMerchantProfile = async (p) => { window.__guardados.push(p); return p; };\n'
    + '  window.apiRequest = async (ruta) => {\n'
    + '    if (ruta === "/admin/merchant") return window.__merchant;\n'
    + '    if (ruta === "/admin/connect/status") return { enabled: false };\n'
    + '    if (ruta === "/admin/referral") return { code: "X", redeemed: false };\n'
    + '    if (ruta === "/admin/metrics/whatsapp") return { rows: [] };\n'
    + '    return {};\n'
    + '  };\n'
    + '  window.appLocale = "es";\n'
    + '  window.appModoEmision = null;\n'
    + '  window.appPuertaSerieDisponible = false;\n'
    + '  window.appRetencionOpciones = null;\n'
    + '<\/script>\n'
    + JS.map((s) => '<script src="' + s + '"><\/script>').join('\n')
    + '\n</body></html>';
}

function arrancarServidor() {
  const srv = http.createServer((req, res) => {
    const ruta = req.url.split('?')[0];
    if (ruta === '/medicion.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(paginaHtml());
    }
    try {
      const cuerpo = fs.readFileSync(path.join(PUBLIC, ruta.replace(/^\//, '')), 'utf8');
      const tipo = ruta.endsWith('.css') ? 'text/css' : ruta.endsWith('.js') ? 'text/javascript' : 'text/plain';
      res.writeHead(200, { 'content-type': tipo + '; charset=utf-8' });
      res.end(cuerpo);
    } catch { res.writeHead(404); res.end(''); }
  });
  return levantarServidor(srv, PUERTO).then((p) => { PUERTO = p; return srv; });
}

/** Lee el estado de la pantalla. `null` en `ciego` si falta algo sin lo que no se puede juzgar. */
function leerEstado() {
  const activa = Array.from(document.querySelectorAll('.settings-panel'))
    .filter((p) => p.style.display !== 'none').map((p) => p.dataset.submenu);
  const avisos = Array.from(document.querySelectorAll('[data-aviso-falta]')).map((a) => {
    const r = a.getBoundingClientRect();
    return {
      campo: a.dataset.avisoFalta, texto: a.textContent,
      visible: r.height > 0 && r.top >= 0 && r.bottom <= innerHeight,
      cabe: a.scrollWidth <= a.clientWidth && r.left >= 0 && r.right <= innerWidth,
    };
  });
  const el = document.activeElement;
  return {
    activa, avisos,
    foco: el && el !== document.body ? (el.name || el.id || el.tagName) : null,
    guardados: window.__guardados.length,
    guardadoTaxId: window.__guardados.length ? window.__guardados[0].taxId : null,
  };
}

const hallazgos = [];
const ciegos = [];
const filas = [];

const srv = await arrancarServidor();
let navegador;
try {
  navegador = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });
  for (const ancho of ANCHOS) {
    for (const caso of CASOS) {
      const etiqueta = `${ancho}px · ${caso.id}`;
      const pag = await navegador.newPage();
      try {
        await pag.setViewport({ width: ancho, height: 844, isMobile: true, hasTouch: true });
        await pag.goto(`http://127.0.0.1:${PUERTO}/medicion.html`, { waitUntil: 'load' });
        const fatal = await pag.evaluate(() => {
          try { renderSettingsView(document.getElementById('vista')); return null; }
          catch (e) { return 'renderSettingsView lanzó: ' + (e && e.message ? e.message : String(e)); }
        });
        if (fatal) { ciegos.push(`${etiqueta} → ${fatal}`); continue; }
        const cargado = await pag.waitForFunction(
          () => { const i = document.querySelector('input[name="name"]'); return i && i.value === 'QA 894'; },
          { timeout: 5000 },
        ).then(() => true, () => false);
        if (!cargado) { ciegos.push(`${etiqueta} → los datos del merchant no llegaron a pintarse`); continue; }

        const prep = await pag.evaluate((vaciar, desde) => {
          for (const n of vaciar) {
            const i = document.querySelector('form [name="' + n + '"]');
            if (!i) return 'no existe el campo ' + n;
            i.value = '';
          }
          const tab = document.querySelector('.settings-nav button[data-submenu="' + desde + '"]');
          if (!tab) return 'no existe la pestaña ' + desde;
          tab.click();
          // Control del detector: antes de pulsar no puede haber aviso, y un aviso sembrado tiene
          // que verse. Si no sabe decir las dos cosas, no se juzga nada con él.
          if (document.querySelectorAll('[data-aviso-falta]').length) return 'hay aviso ANTES de pulsar';
          const s = document.createElement('p');
          s.dataset.avisoFalta = 'senuelo';
          s.textContent = 'SENUELO';
          document.querySelector('.settings-panel[data-submenu="' + desde + '"]').prepend(s);
          const ve = document.querySelectorAll('[data-aviso-falta]').length === 1;
          s.remove();
          return ve ? null : 'el detector del aviso no ve un aviso sembrado';
        }, caso.vaciar, caso.desde);
        if (prep) { ciegos.push(`${etiqueta} → ${prep}`); continue; }

        const boton = await pag.$('form button[type="submit"]');
        if (!boton) { ciegos.push(`${etiqueta} → no hay botón «Guardar cambios»`); continue; }
        await pag.evaluate((b) => b.scrollIntoView({ block: 'center', behavior: 'instant' }), boton);
        await boton.click();
        await new Promise((ok) => setTimeout(ok, 400));
        const r = await pag.evaluate(leerEstado);

        const e = caso.espera;
        const mal = [];
        if (r.activa.length !== 1 || r.activa[0] !== e.pestana) mal.push(`pestaña abierta ${JSON.stringify(r.activa)}, se esperaba «${e.pestana}»`);
        if (e.foco !== null && r.foco !== e.foco) mal.push(`foco en ${r.foco}, se esperaba ${e.foco}`);
        if (r.guardados !== e.guardados) mal.push(`${r.guardados} guardado(s), se esperaba ${e.guardados}`);
        if (e.guardados === 1 && r.guardadoTaxId !== MERCHANT.taxId) mal.push(`guardó taxId=${r.guardadoTaxId}`);
        if (e.aviso === null) {
          if (r.avisos.length) mal.push(`aviso que hoy no existe: «${r.avisos[0].texto}»`);
        } else if (r.avisos.length !== 1) {
          mal.push(`${r.avisos.length} avisos, se esperaba 1 que nombre ${e.aviso.join(' y ')}`);
        } else {
          const a = r.avisos[0];
          for (const t of e.aviso) if (!a.texto.includes(t)) mal.push(`el aviso «${a.texto}» no nombra «${t}»`);
          if (!a.visible) mal.push('el aviso queda fuera de la pantalla');
          if (!a.cabe) mal.push('el aviso se sale de su caja o del ancho de pantalla');
        }

        // El aviso se va al escribir en el campo: si no, se queda diciendo que falta algo que ya está.
        if (!mal.length && e.aviso !== null) {
          await pag.type(`form [name="${e.foco}"]`, 'X');
          const quedan = await pag.evaluate(() => ({
            avisos: document.querySelectorAll('[data-aviso-falta]').length,
            marcas: document.querySelectorAll('form .input-error').length,
          }));
          if (quedan.avisos || quedan.marcas) mal.push(`al escribir siguen ${quedan.avisos} aviso(s) y ${quedan.marcas} marca(s) de error`);
        }

        filas.push({ etiqueta, ok: !mal.length, r });
        if (mal.length) hallazgos.push({ etiqueta, mal });
      } finally {
        await pag.close();
      }
    }
  }
} finally {
  if (navegador) await navegador.close();
  srv.close();
}

console.log('');
console.log('  SCRUM-894 · «GUARDAR CAMBIOS» CON LO QUE FALTA EN OTRA PESTAÑA, EN EL DOM VIVO');
console.log('  ' + '─'.repeat(100));
for (const f of filas) {
  const a = f.r.avisos[0];
  console.log(`  ${f.ok ? '✔' : '🔴'} ${f.etiqueta}   pestaña:${f.r.activa.join(',')} foco:${f.r.foco} guardados:${f.r.guardados}${a ? ` aviso:«${a.texto}»` : ''}`);
}
console.log('  ' + '─'.repeat(100));

if (ciegos.length) {
  console.error('\n  🔴 NO SUPE MEDIR — esto NO es «avisa bien»:\n');
  for (const c of ciegos) console.error('     · ' + c);
  process.exit(SALIDA_NO_SUPE_MEDIR);
}
if (hallazgos.length) {
  console.error(`\n  🔴 ${hallazgos.length} DE ${ANCHOS.length * CASOS.length} CASOS NO SE COMPORTAN COMO DEBEN:\n`);
  for (const h of hallazgos) {
    console.error(`     [${h.etiqueta}]`);
    for (const m of h.mal) console.error('       · ' + m);
  }
  console.error('\n  Un «Guardar» que no guarda y calla hace que el profesional deje de fiarse del resto.');
  process.exit(SALIDA_HALLAZGO);
}
console.log(`\n  ✔ los ${ANCHOS.length * CASOS.length} casos: lo que falta en otra pestaña se nombra y se abre; lo demás, como hoy.\n`);
