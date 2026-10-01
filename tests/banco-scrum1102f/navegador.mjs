// Medicion EN NAVEGADOR de SCRUM-1102f: los dos selectores de Configuracion, pintados de verdad.
//
// El test del ticket monta la pantalla en el banco de vistas, que no tiene hoja de estilos ni
// tamaños. Aqui se mide lo que solo existe en un navegador: que los dos selectores se VEN en la
// pestaña Empresa, que miden 44 px o mas, que la pregunta cabe a 390 px, y que al elegir una opcion
// y pulsar «Guardar cambios» lo que se manda es lo elegido.
//
// Se lanza a mano (no esta en `guards:visuales`): node tests/banco-scrum1102f/navegador.mjs
// Sale 0 si todo cumple, 1 si hay hallazgo, 2 si no supo medir.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from '../../scripts/_navegador.mjs';
import { levantarServidor } from '../../scripts/_servidor.mjs';

const RAIZ = path.resolve(import.meta.dirname, '../..');
const PUBLIC = path.join(RAIZ, 'public');
const JS = ['/dashboard/js/settingsSubmenus.js', '/dashboard/js/puertaSerie.js', '/dashboard/js/settingsView.js'];
const CSS = ['/tokens.css', '/dashboard/css/styles.css'];
const ANCHOS = [390, 1280];
const MERCHANT = {
  id: 1, name: 'QA 1102', legalName: 'QA 1102 SL', taxId: 'B12345674', address: 'Calle Falsa 1',
  whatsappPhone: '34000000001', defaultCurrency: 'EUR', invoiceSeriesPrefix: 'F', country: 'ES',
  iban: null, bizumPhone: null, connectStatus: 'none',
  criterioCaja: null, llevaLibrosPorSii: true, domicilioFiscalForal: false,
};
const CAMPOS = [
  { clave: 'llevaLibrosPorSii', pregunta: '¿Llevas los libros de IVA por el SII?', alCargar: 'si', elegir: '', seManda: null },
  { clave: 'domicilioFiscalForal', pregunta: '¿Tienes el domicilio fiscal en el País Vasco o en Navarra?', alCargar: 'no', elegir: 'si', seManda: true },
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

const srv = http.createServer((req, res) => {
  const ruta = req.url.split('?')[0];
  if (ruta === '/__scrum1102f.html') {
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
const PUERTO = await levantarServidor(srv, 0);

/** Lo que se ve de un selector: caja, valor, opcion elegida y su rotulo. */
const MEDIR = new Function('clave', `
  var s = document.querySelector('form select[name="' + clave + '"]');
  if (!s) return null;
  var r = s.getBoundingClientRect();
  var l = document.querySelector('label[for="' + s.id + '"]');
  var rl = l ? l.getBoundingClientRect() : null;
  var panel = s.closest('.settings-panel');
  return {
    alto: Math.round(r.height * 10) / 10, ancho: Math.round(r.width),
    visible: r.height > 0 && r.width > 0 && getComputedStyle(s).visibility !== 'hidden',
    cabe: r.left >= 0 && r.right <= document.documentElement.clientWidth,
    pestana: panel ? panel.dataset.submenu : null,
    pestanaAbierta: panel ? getComputedStyle(panel).display !== 'none' : null,
    valor: s.value,
    elegida: s.options[s.selectedIndex] ? s.options[s.selectedIndex].textContent : null,
    opciones: Array.from(s.options).map(function (o) { return o.textContent; }),
    rotulo: l ? l.textContent : null,
    rotuloCabe: rl ? (rl.left >= 0 && rl.right <= document.documentElement.clientWidth && l.scrollWidth <= l.clientWidth) : null,
    desborda: document.documentElement.scrollWidth > document.documentElement.clientWidth
  };
`);

const hallazgos = [];
const ciegos = [];
const filas = [];
let navegador;
try {
  navegador = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });
  for (const ancho of ANCHOS) {
    const pag = await navegador.newPage();
    await pag.setViewport({ width: ancho, height: 844, isMobile: ancho < 700, hasTouch: ancho < 700 });
    await pag.goto(`http://127.0.0.1:${PUERTO}/__scrum1102f.html`, { waitUntil: 'load' });
    const fatal = await pag.evaluate(() => {
      try { renderSettingsView(document.getElementById('vista')); return null; } catch (e) { return String(e && e.message); }
    });
    if (fatal) { ciegos.push(`${ancho}px → renderSettingsView lanzó: ${fatal}`); continue; }
    await pag.waitForFunction(() => { const i = document.querySelector('input[name="name"]'); return !!i && i.value === 'QA 1102'; }, { timeout: 5000 });

    // CONTROL POSITIVO: el instrumento ve al hermano que ya existia, en la misma pestaña.
    const control = await pag.evaluate(MEDIR, 'criterioCaja');
    if (!control || !control.visible || control.pestana !== 'empresa') { ciegos.push(`${ancho}px → no veo el selector del criterio de caja: ${JSON.stringify(control)}`); continue; }
    filas.push(`${ancho}px · control criterioCaja: alto=${control.alto} pestaña=${control.pestana} abierta=${control.pestanaAbierta}`);

    for (const c of CAMPOS) {
      const m = await pag.evaluate(MEDIR, c.clave);
      if (!m) { hallazgos.push(`${ancho}px · ${c.clave}: el selector no existe en la pantalla`); continue; }
      filas.push(`${ancho}px · ${c.clave}: alto=${m.alto} ancho=${m.ancho} visible=${m.visible} cabe=${m.cabe} pestaña=${m.pestana} abierta=${m.pestanaAbierta} valor=«${m.valor}» elegida=«${m.elegida}» opciones=${JSON.stringify(m.opciones)} rotuloCabe=${m.rotuloCabe} desborda=${m.desborda}`);
      const falla = (cond, texto) => { if (!cond) hallazgos.push(`${ancho}px · ${c.clave}: ${texto}`); };
      falla(m.pestana === 'empresa' && m.pestanaAbierta && m.visible, 'no se ve en la pestaña Empresa al abrir Configuración');
      falla(m.alto >= 44, `mide ${m.alto} px de alto (AB6 pide 44)`);
      falla(m.cabe && m.rotuloCabe && !m.desborda, 'el selector o su pregunta no caben a este ancho');
      falla(m.rotulo === c.pregunta, `el rótulo es «${m.rotulo}»`);
      falla(m.valor === c.alCargar, `lo guardado se pinta como «${m.valor}» y era «${c.alCargar}»`);
      falla(JSON.stringify(m.opciones) === JSON.stringify(['No consta', 'Sí', 'No']), `las opciones son ${JSON.stringify(m.opciones)}`);
    }

    // EL ESTADO DESPUES DE PULSAR: se elige como lo haria una persona y se guarda.
    for (const c of CAMPOS) await pag.select(`form select[name="${c.clave}"]`, c.elegir);
    await pag.evaluate(() => {
      const b = Array.from(document.querySelectorAll('form button')).find((x) => x.textContent.trim() === 'Guardar cambios');
      if (!b) throw new Error('no encuentro «Guardar cambios»');
      b.click();
    });
    await pag.waitForFunction(() => window.__guardados.length > 0, { timeout: 5000 }).catch(() => {});
    const guardados = await pag.evaluate(() => window.__guardados);
    if (guardados.length !== 1) { hallazgos.push(`${ancho}px · pulsar «Guardar cambios» mandó ${guardados.length} guardados`); }
    else {
      for (const c of CAMPOS) {
        filas.push(`${ancho}px · tras guardar, ${c.clave} = ${JSON.stringify(guardados[0][c.clave])}`);
        if (guardados[0][c.clave] !== c.seManda) hallazgos.push(`${ancho}px · ${c.clave}: elegí «${c.elegir}» y se mandó ${JSON.stringify(guardados[0][c.clave])}`);
      }
      filas.push(`${ancho}px · tras guardar, criterioCaja = ${JSON.stringify(guardados[0].criterioCaja)} (no se tocó)`);
      if (guardados[0].criterioCaja !== null) hallazgos.push(`${ancho}px · el criterio de caja cambió sin tocarlo`);
    }
    await pag.close();
  }
} catch (e) {
  ciegos.push('el navegador no dejó medir: ' + (e && e.message));
} finally {
  if (navegador) await navegador.close();
  srv.close();
}

console.log(`POBLACION: ${ANCHOS.length} anchos × ${CAMPOS.length} selectores`);
console.log(filas.join('\n'));
if (ciegos.length) console.log('CIEGO:\n  ' + ciegos.join('\n  '));
if (hallazgos.length) console.log('HALLAZGOS:\n  ' + hallazgos.join('\n  '));
const salida = ciegos.length ? 2 : hallazgos.length ? 1 : 0;
console.log(`EXIT=${salida}`);
process.exit(salida);
