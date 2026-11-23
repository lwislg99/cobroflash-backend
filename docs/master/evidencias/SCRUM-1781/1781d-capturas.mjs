// docs/master/evidencias/SCRUM-1781/1781d-capturas.mjs — SCRUM-1781d · capturas de «Editar cliente».
//
// Uso:  node docs/master/evidencias/SCRUM-1781/1781d-capturas.mjs <carpeta> <etiqueta>
//       (etiqueta: «antes» o «despues»; deja 1781d-<etiqueta>-1280.png y 1781d-<etiqueta>-390.png)
//
// Monta el modal REAL de la ficha del cliente (`openEdit360Modal`, `customerDetailView.js`) con
// las hojas reales del panel, sobre un servidor de ficheros local de usar y tirar (127.0.0.1,
// puerto libre). No hay backend: `apiRequest` y `getCustomers` se sustituyen DESPUÉS de cargar
// los scripts, con un cliente fabricado (rango imposible `340…`, SCRUM-262).
//
// SUELO: sin letra web, sin modal o sin el campo Teléfono no hay nada que mirar → sale 2 (CIEGO),
// nunca 0. Imprime, además de la captura, qué selector y qué número enseña cada campo.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from '../../../../scripts/_navegador.mjs';
import { levantarServidor } from '../../../../scripts/_servidor.mjs';
import { enlacesDelPanel, TIPOS_DE_FUENTE, esperarFuentes } from '../../../../scripts/_hojas-del-panel.mjs';
import { telefonoDePrueba } from '../../../../scripts/_telefonos-prueba.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const PUBLIC = path.join(RAIZ, 'public');
const [CARPETA, ETIQUETA] = process.argv.slice(2);
if (!CARPETA || !ETIQUETA) { console.error('uso: <carpeta> <etiqueta>'); process.exit(2); }

const JS = ['api.js', 'modalHeader.js', 'switchFormaJuridica.js', 'prefijosPais.js', 'customerDetailView.js']
  .map((f) => '/dashboard/js/' + f);
const CLIENTE = {
  id: 7811, name: 'Fontanería Ejemplo', phone: telefonoDePrueba(10000002), mobile: '52' + telefonoDePrueba(10000002).slice(2),
  email: 'qa1781d@example.test', notes: '', waOptOut: false, taxId: null, legalName: null, companyId: null,
  contactKind: 'PERSONA', tipoDestinatario: null, billingPeriodicity: 'NINGUNA',
};

function paginaHtml() {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">\n' + enlacesDelPanel(PUBLIC)
    + '\n</head><body>\n<div id="vista" class="view-container"></div>\n'
    + JS.map((s) => '<script src="' + s + '"><\/script>').join('\n')
    + '\n<script>\n'
    + '  window.apiRequest = async function () { return {}; };\n'
    + '  window.getCustomers = async function () { return []; };\n'
    + '  window.renderCustomer360View = function () {};\n'
    + '<\/script>\n</body></html>';
}

let PUERTO = 0;
const srv = http.createServer((req, res) => {
  const ruta = req.url.split('?')[0];
  if (ruta === '/__1781d.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(paginaHtml());
  }
  try {
    const cuerpo = fs.readFileSync(path.join(PUBLIC, ruta.replace(/^\//, '')));
    const letra = TIPOS_DE_FUENTE[path.extname(ruta)];
    const tipo = letra || (ruta.endsWith('.css') ? 'text/css' : ruta.endsWith('.js') ? 'text/javascript' : 'text/plain') + '; charset=utf-8';
    res.writeHead(200, { 'content-type': tipo });
    res.end(cuerpo);
  } catch { res.writeHead(404); res.end(''); }
});
PUERTO = await levantarServidor(srv, 0);

const ABRIR = new Function('cliente', `
  openEdit360Modal(cliente, cliente.id, document.getElementById('vista'));
  var tel = document.getElementById('e360-phone');
  var mov = document.getElementById('e360-mobile');
  if (!tel || !mov) return { ciego: 'no se abrió el modal o falta Teléfono/Móvil' };
  var selDe = function (i) { var s = i.parentNode.querySelector('select.prefijo-pais'); return s ? s.value : null; };
  var rot = Array.from(document.querySelectorAll('.c360-editar-cuerpo label')).map(function (l) { return l.textContent.trim(); });
  return { telefono: [selDe(tel), tel.value], movil: [selDe(mov), mov.value], rotulos: rot.filter(function (t) { return /Tel|Móvil/.test(t); }) };
`);

let salida = 0;
let navegador;
try {
  navegador = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });
  for (const ancho of [1280, 390]) {
    const pag = await navegador.newPage();
    try {
      await pag.setViewport(ancho < 800 ? { width: ancho, height: 844, isMobile: true, hasTouch: true } : { width: ancho, height: 800 });
      await pag.goto(`http://127.0.0.1:${PUERTO}/__1781d.html`, { waitUntil: 'load' });
      const fuente = await esperarFuentes(pag);
      if (!(fuente.cargadas > 0)) { console.log(`${ancho}px · CIEGO: sin letra web`); salida = 2; continue; }
      const r = await pag.evaluate(ABRIR, CLIENTE);
      if (r.ciego) { console.log(`${ancho}px · CIEGO: ${r.ciego}`); salida = 2; continue; }
      await new Promise((ok) => setTimeout(ok, 400));
      fs.mkdirSync(CARPETA, { recursive: true });
      const fichero = path.join(CARPETA, `1781d-${ETIQUETA}-${ancho}.png`);
      await pag.screenshot({ path: fichero });
      console.log(`${ancho}px · ${JSON.stringify(r)} → ${fichero}`);
    } finally {
      await pag.close();
    }
  }
} catch (e) {
  console.log('CIEGO: ' + (e && e.stack || e));
  salida = 2;
} finally {
  if (navegador) await navegador.close();
  srv.close();
}
process.exit(salida);
