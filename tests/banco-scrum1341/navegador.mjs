// Medicion EN NAVEGADOR de SCRUM-1341: el bloque «Actividad del equipo» del Inicio del Tecnico,
// pintado de verdad.
//
// El test del ticket monta el Inicio en el banco de vistas, que no tiene hoja de estilos ni
// tamaños. Aqui se mide lo que solo existe en un navegador: que el bloque se VE, que la tabla cabe
// a 390 px sin barra horizontal aunque un nombre sea largo, que los numeros van a la derecha, los
// colores que el navegador calcula de verdad, y que dentro no hay ni un importe, ni un boton, ni
// un estilo en linea. Control: el panel del ADMIN, con la misma respuesta, si lleva importes y boton.
//
// Se lanza a mano (no esta en `guards:visuales`): node tests/banco-scrum1341/navegador.mjs
// Sale 0 si todo cumple, 1 si hay hallazgo, 2 si no supo medir.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from '../../scripts/_navegador.mjs';
import { levantarServidor } from '../../scripts/_servidor.mjs';

const RAIZ = path.resolve(import.meta.dirname, '../..');
const PUBLIC = path.join(RAIZ, 'public');
const CSS = ['/tokens.css', '/dashboard/css/styles.css'];
const ANCHOS = [390, 1280];
const TITULO = 'Actividad del equipo · este mes';
const LARGO = 'Instalaciones y Reformas Hermanos Martínez de la Fuente e Hijos SL';
// Lo que contestaria la ruta del ADMIN. Se le contesta TAMBIEN a la del Tecnico: el servidor no lo
// hace, pero el bloque tiene que pintar por lista cerrada aunque le llegue de mas.
const EQUIPO = {
  hasTeam: true,
  members: [
    { id: null, name: LARGO, role: 'owner', status: 'active', sent: 1, accepted: 1, collected: 300.29, acceptanceRate: 100, thisWeek: 1, isBest: false },
    { id: 11, name: 'Ana', role: 'tecnico', status: 'active', sent: 3, accepted: 2, collected: 9999.99, acceptanceRate: 67, thisWeek: 3, isBest: true },
    { id: 12, name: 'Blas', role: 'tecnico', status: 'active', sent: 4, accepted: 1, collected: 12.5, acceptanceRate: 25, thisWeek: 2, isBest: false },
    { id: 13, name: 'Caro', role: 'tecnico', status: 'active', sent: 1, accepted: 0, collected: 0, acceptanceRate: 0, thisWeek: 0, isBest: false },
  ],
  inactive: ['Caro'],
  sinAsignar: { label: 'Sin asignar', collected: 50.13 },
  totalCollected: 10362.91,
};

function paginaHtml(rol) {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
    + CSS.map((h) => '<link rel="stylesheet" href="' + h + '">').join('\n')
    + '\n</head><body>\n<div id="vista" class="view-container"></div>\n'
    + '<script>\n'
    + '  window.appUserRole = ' + JSON.stringify(rol) + ';\n'
    + '  window.__pedidas = [];\n'
    + '  window.apiRequest = async (ruta) => { window.__pedidas.push(ruta); return ' + JSON.stringify(EQUIPO) + '; };\n'
    + '<\/script>\n'
    + '<script src="/dashboard/js/homeView.js"><\/script>\n'
    + '</body></html>';
}

const srv = http.createServer((req, res) => {
  const ruta = req.url.split('?')[0];
  const m = /^\/__scrum1341-(tecnico|admin)\.html$/.exec(ruta);
  if (m) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(paginaHtml(m[1]));
  }
  try {
    const cuerpo = fs.readFileSync(path.join(PUBLIC, ruta.replace(/^\//, '')), 'utf8');
    const tipo = ruta.endsWith('.css') ? 'text/css' : ruta.endsWith('.js') ? 'text/javascript' : 'text/plain';
    res.writeHead(200, { 'content-type': tipo + '; charset=utf-8' });
    res.end(cuerpo);
  } catch { res.writeHead(404); res.end(''); }
});
const PUERTO = await levantarServidor(srv, 0);

/** Lo que se ve del bloque del equipo que haya en la pagina (el del Tecnico o el del admin). */
const MEDIR = new Function(`
  var vista = document.getElementById('vista');
  var tabla = vista.querySelector('table');
  if (!tabla) return null;
  var bloque = vista.firstElementChild;
  var caja = tabla.closest('.table-scroll');
  var titulo = bloque.querySelector('.equipo-actividad-titulo');
  var est = function (n) { return n ? getComputedStyle(n) : null; };
  var filas = Array.from(tabla.querySelectorAll('tbody tr'));
  var celdaLarga = filas[0] ? filas[0].children[0] : null;
  var deClase = function (c) { var n = tabla.querySelector('td.' + c); return n ? est(n).color : null; };
  return {
    clase: bloque.className,
    visible: bloque.getBoundingClientRect().height > 0,
    titulo: titulo ? titulo.textContent : null,
    tituloColor: titulo ? est(titulo).color : null,
    tituloTamano: titulo ? est(titulo).fontSize : null,
    cabeceras: Array.from(tabla.querySelectorAll('thead th')).map(function (th) { return th.textContent.trim(); }),
    filas: filas.map(function (tr) { return Array.from(tr.children).map(function (td) { return td.innerText.replace(/\\s+/g, ' ').trim(); }); }),
    alineacion: Array.from(tabla.querySelectorAll('tbody tr:first-child td')).map(function (td) { return est(td).textAlign; }),
    tablaAncho: Math.round(tabla.getBoundingClientRect().width),
    cajaAncho: caja ? caja.clientWidth : null,
    barraHorizontal: caja ? caja.scrollWidth > caja.clientWidth : null,
    paginaDesborda: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    nombreLargoCabe: celdaLarga ? celdaLarga.scrollWidth <= celdaLarga.clientWidth : null,
    rolColor: est(tabla.querySelector('.equipo-actividad-rol')) ? est(tabla.querySelector('.equipo-actividad-rol')).color : null,
    tasaAlta: deClase('equipo-actividad-tasa-alta'),
    tasaMedia: deClase('equipo-actividad-tasa-media'),
    tasaBaja: deClase('equipo-actividad-tasa-baja'),
    botones: bloque.querySelectorAll('button').length,
    conEstiloEnLinea: bloque.querySelectorAll('[style]').length + (bloque.hasAttribute('style') ? 1 : 0),
    texto: bloque.innerText,
    pedidas: window.__pedidas
  };
`);

const hallazgos = [];
const ciegos = [];
const filas = [];
let navegador;
try {
  navegador = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });
  for (const ancho of ANCHOS) {
    const medidas = {};
    for (const rol of ['admin', 'tecnico']) {
      const pag = await navegador.newPage();
      await pag.setViewport({ width: ancho, height: 844, isMobile: ancho < 700, hasTouch: ancho < 700 });
      await pag.goto(`http://127.0.0.1:${PUERTO}/__scrum1341-${rol}.html`, { waitUntil: 'load' });
      const fatal = await pag.evaluate(async () => {
        try { await renderTeamPerformance(document.getElementById('vista')); return null; } catch (e) { return String(e && e.message); }
      });
      if (fatal) { ciegos.push(`${ancho}px · ${rol} → renderTeamPerformance lanzó: ${fatal}`); await pag.close(); continue; }
      medidas[rol] = await pag.evaluate(MEDIR);
      await pag.close();
    }
    const { admin, tecnico: t } = medidas;

    // CONTROL POSITIVO: con la MISMA respuesta, el panel del admin lleva lo que al Tecnico no se le pinta.
    if (!admin || admin.cabeceras.length !== 4 || !/€/.test(admin.texto) || admin.botones !== 1 || !/Mejor del mes/.test(admin.texto) || !/Sin actividad esta semana/.test(admin.texto)) {
      ciegos.push(`${ancho}px → no veo en el panel del admin las cuatro columnas, el importe, el botón, la estrella y el aviso: ${JSON.stringify(admin && { cabeceras: admin.cabeceras, botones: admin.botones })}`);
      continue;
    }
    filas.push(`${ancho}px · control ADMIN: cabeceras=${JSON.stringify(admin.cabeceras)} botones=${admin.botones} con «€»=${/€/.test(admin.texto)} pide=${JSON.stringify(admin.pedidas)}`);

    if (!t) { hallazgos.push(`${ancho}px · al Técnico no se le pinta ningún bloque del equipo`); continue; }
    filas.push(`${ancho}px · TÉCNICO: clase=«${t.clase}» visible=${t.visible} título=«${t.titulo}» (${t.tituloTamano}, ${t.tituloColor}) cabeceras=${JSON.stringify(t.cabeceras)}`);
    filas.push(`${ancho}px · TÉCNICO: filas=${JSON.stringify(t.filas)}`);
    filas.push(`${ancho}px · TÉCNICO: tabla=${t.tablaAncho}px en caja de ${t.cajaAncho}px · barra horizontal=${t.barraHorizontal} · la página desborda=${t.paginaDesborda} · el nombre largo cabe=${t.nombreLargoCabe} · alineación=${JSON.stringify(t.alineacion)}`);
    filas.push(`${ancho}px · TÉCNICO: color del rol=${t.rolColor} · % alto=${t.tasaAlta} · % medio=${t.tasaMedia} · % bajo=${t.tasaBaja} · botones=${t.botones} · nodos con estilo en línea=${t.conEstiloEnLinea} · pide=${JSON.stringify(t.pedidas)}`);
    const falla = (cond, texto) => { if (!cond) hallazgos.push(`${ancho}px · ${texto}`); };
    falla(t.clase === 'equipo-actividad' && t.visible, 'el bloque del Técnico no se ve');
    falla(t.titulo === TITULO, `el título es «${t.titulo}»`);
    falla(JSON.stringify(t.cabeceras) === JSON.stringify(['Miembro', 'Cotizaciones', 'Aceptación']), `las cabeceras son ${JSON.stringify(t.cabeceras)}`);
    falla(JSON.stringify(t.filas) === JSON.stringify([[LARGO + ' Propietario', '1', '100%'], ['Ana Operario', '3', '67%'], ['Blas Operario', '4', '25%'], ['Caro Operario', '1', '0%']]), `las filas son ${JSON.stringify(t.filas)}`);
    falla(JSON.stringify(t.alineacion) === JSON.stringify(['left', 'right', 'right']) || JSON.stringify(t.alineacion) === JSON.stringify(['start', 'right', 'right']), `la alineación es ${JSON.stringify(t.alineacion)}`);
    falla(t.barraHorizontal === false && t.paginaDesborda === false && t.nombreLargoCabe === true, 'la tabla o el nombre largo no caben a este ancho');
    falla(t.tituloColor === 'rgb(75, 85, 79)' && t.rolColor === 'rgb(75, 85, 79)', `título y rol no van en --neutral-600: ${t.tituloColor} y ${t.rolColor}`);
    falla(t.tasaAlta === 'rgb(21, 128, 61)' && t.tasaMedia === 'rgb(75, 85, 79)' && t.tasaBaja === 'rgb(220, 38, 38)', `los tres tonos del % son ${t.tasaAlta}, ${t.tasaMedia}, ${t.tasaBaja}`);
    falla(t.botones === 0, `el bloque lleva ${t.botones} botón(es)`);
    falla(t.conEstiloEnLinea === 0, `el bloque lleva ${t.conEstiloEnLinea} nodo(s) con estilo en línea`);
    const prohibido = ['€', 'Cobrado', 'Mejor del mes', '⭐', 'Sin asignar', 'Sin actividad', 'Ver equipo', '9.999', '9999', '300,29', '50,13'].filter((x) => t.texto.indexOf(x) >= 0);
    falla(prohibido.length === 0, `el bloque del Técnico pinta: ${prohibido.join(' · ')}`);
    falla(JSON.stringify(t.pedidas) === JSON.stringify(['/admin/metrics/actividad-equipo']), `el bloque del Técnico pide ${JSON.stringify(t.pedidas)}`);
  }
} catch (e) {
  ciegos.push('el navegador no dejó medir: ' + (e && e.message));
} finally {
  if (navegador) await navegador.close();
  srv.close();
}

console.log(`POBLACION: ${ANCHOS.length} anchos × 2 roles (admin de control, Técnico medido)`);
console.log(filas.join('\n'));
if (ciegos.length) console.log('CIEGO:\n  ' + ciegos.join('\n  '));
if (hallazgos.length) console.log('HALLAZGOS:\n  ' + hallazgos.join('\n  '));
const salida = ciegos.length ? 2 : hallazgos.length ? 1 : 0;
console.log(`EXIT=${salida}`);
process.exit(salida);
