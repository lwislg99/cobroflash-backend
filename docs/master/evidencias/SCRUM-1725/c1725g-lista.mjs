// SCRUM-1725g · la LISTA de Trabajos, antes (con bloques por estado) y después (plana), en yaqu.app.
//
// Acción del banco H6 (`docs/master/evidencias/SCRUM-1686/banco-h6/paso2.mjs`):
//   ANTES    BANCO_OUT=<fuera del repo> [ROL=tecnico] node …/paso2.mjs <ancho> "#jobs" antes   <este fichero>
//   DESPUÉS  LOCAL_DIR=<raíz del árbol> BANCO_OUT=… [ROL=tecnico] node …/paso2.mjs <ancho> "#jobs" despues <este fichero>
//
// Con LOCAL_DIR sirve `js/jobsView.js` y `css/styles.css` del árbol ENCIMA de producción (datos reales de
// la cuenta QA, todo lo demás de yaqu.app) y recarga. Mismo mecanismo que `c1725e-lista.mjs`.
//
// NO ESCRIBE: lee y fotografía. No pulsa ningún botón (los cerrados siguen detrás de «Ver N cerrados»).
//
// Lo que mide. Sirve para las DOS formas del DOM, porque la fila (`tr.jobs-fila`) es la misma:
//   · CONTENIDO: una línea `TARJETA` por fila, con su texto y sus botones (rótulo + rellena o no). El antes
//     y el después se comparan como CONJUNTOS de esas líneas: la lista plana no puede ganar ni perder un
//     trabajo, un dato ni un botón. La píldora de estado NO entra en esa línea (es lo que se añade).
//   · ESTRUCTURA: cuántos `tbody`, cuántas filas de cabecera (`tr.jobs-grupo-titulo|salvedad`), las
//     columnas de la cabecera, y cuántas filas llevan píldora de estado.
//   · ORDEN: una línea `ORDEN` por fila, tal como se ven, con el rótulo de su grupo (antes) o su píldora
//     (después). La secuencia de clientes tiene que ser la misma.
//   · CIFRAS: el texto de las tarjetas «Para hoy» / «Por cobrar» y de los filtros.
//   · DESBORDE horizontal y controles por debajo de 44 px (los cuenta `s.mide`).
// SUELO: sin filas, CIEGO. CONTROL POSITIVO: la cuenta QA tiene trabajos EN CURSO y «Abrir parte» es
// rellena desde SCRUM-1700: si ninguna fila la trae rellena, el instrumento no ve el relleno → CIEGO.
// Con LOCAL_DIR, además: la hoja servida lleva el marcador de este ticket y la página lo APLICA (testigo
// calculado); si no, no se sirvió lo local → CIEGO. Y entonces la lista TIENE que ser plana: una cabecera
// de grupo, o una fila sin píldora, es ROJO.
import fs from 'node:fs';
import path from 'node:path';
// El banco de SCRUM-1658 (`abrir`, con `serviceWorkers: 'block'`): esta acción llama a `.route(` sobre
// yaqu.app, y sin service worker bloqueado lo interceptado puede no pasar por aquí (SCRUM-1233).
import * as banco from '../SCRUM-1658/banco/lib.mjs';

const SERVIDOS = [['js/jobsView.js', 'application/javascript'], ['css/styles.css', 'text/css']];
const MARCADOR = 'S4 · SCRUM-1725g';

const leer = () => {
  const limpio = (t) => String(t || '').replace(/\s+/g, ' ').trim();
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const tabla = document.querySelector('table.table--trabajos');
  if (!tabla) return null;
  let grupo = '';
  const filas = [];
  for (const tr of tabla.querySelectorAll('tbody tr')) {
    if (tr.classList.contains('jobs-grupo-titulo')) { grupo = limpio(tr.textContent); continue; }
    if (!tr.classList.contains('jobs-fila') || !visible(tr)) continue;
    const celda = tr.querySelector('.jobs-celda-acciones');
    const botones = [...(celda ? celda.querySelectorAll('button, summary, a') : [])].filter(visible).map((b) => {
      const r = b.getBoundingClientRect();
      return { rotulo: limpio(b.textContent), rellena: b.classList.contains('btn-primary'), x: Math.round(r.left), y: Math.round(r.top), alto: Math.round(r.height) };
    }).sort((a, b) => (Math.abs(a.y - b.y) > 6 ? a.y - b.y : a.x - b.x));
    const de = (sel) => { const e = tr.querySelector(sel); return e && visible(e) ? limpio(e.textContent) : ''; };
    const r = tr.getBoundingClientRect();
    filas.push({
      grupo, cliente: de('.jobs-fila-cliente'), tipo: de('.jobs-fila-tipo'), tarea: de('.jobs-fila-tarea'),
      trabajo: de('.jobs-fila-trabajo'), tecnicos: de('.jobs-fila-tecnicos'), direccion: de('.jobs-fila-direccion'),
      importe: de('td.cell-amount'), fecha: de('td.cell-date'), pildora: de('td.cell-status .status-pill'),
      alto: Math.round(r.height), ancho: Math.round(r.width), botones,
    });
  }
  const abrir = tabla.querySelector('tr.jobs-grupo-abrir');
  const raiz = document.scrollingElement || document.documentElement;
  return {
    columnas: [...tabla.querySelectorAll('thead th')].map((th) => limpio(th.textContent)),
    cuerpos: tabla.querySelectorAll('tbody').length,
    cabeceras: [...tabla.querySelectorAll('tr.jobs-grupo-titulo, tr.jobs-grupo-salvedad')].map((tr) => limpio(tr.textContent)),
    abrir: abrir && visible(abrir) ? limpio(abrir.textContent) : '',
    cifras: [...document.querySelectorAll('.jobs-cifra')].map((c) => limpio(c.innerText)),
    filtros: [...document.querySelectorAll('.jobs-filtros > button')].map((b) => limpio(b.textContent)),
    filas,
    pagina: { ancho: window.innerWidth, anchoDeScroll: raiz.scrollWidth, alto: raiz.scrollHeight },
  };
};

export default async (s, h) => {
  if (h !== banco) throw new Error('CIEGO: esta acción no corre sobre el banco de SCRUM-1658 (el que bloquea el service worker); no intercepto sin él');
  const p = s.page;
  const local = process.env.LOCAL_DIR;
  if (local) {
    for (const [f, tipo] of SERVIDOS) {
      const ruta = path.join(local, 'public', 'dashboard', f);
      const cuerpo = fs.readFileSync(ruta, 'utf8');
      if (f.endsWith('.css') && !cuerpo.includes(MARCADOR)) throw new Error(`CIEGO: ${ruta} no lleva el bloque «${MARCADOR}»: no es la hoja de esta rama`);
      await p.route((u) => u.pathname.endsWith('/dashboard/' + f), (r) => r.fulfill({ status: 200, contentType: tipo, body: cuerpo }));
      s.nota(`LOCAL ${f} ← ${ruta} (${cuerpo.length} caracteres)`);
    }
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForTimeout(1200);
  } else {
    s.nota('SIN LOCAL_DIR: se mide lo que sirve producción');
  }
  const m = await p.evaluate(leer);
  if (!m || !m.filas.length) throw new Error('CIEGO: la lista no pinta ninguna fila (table.table--trabajos tr.jobs-fila)');
  const corto = (b) => `${b.rellena ? '■' : '□'}${b.rotulo}`;
  s.nota(`PAGINA @${s.ancho}: ancho ${m.pagina.ancho} · ancho de scroll ${m.pagina.anchoDeScroll} · desborde ${m.pagina.anchoDeScroll - m.pagina.ancho} · alto ${m.pagina.alto}`);
  s.nota(`ESTRUCTURA @${s.ancho}: columnas [${m.columnas.join(' | ')}] · ${m.cuerpos} tbody · ${m.cabeceras.length} filas de cabecera de grupo · ${m.filas.length} filas de trabajo · pie «${m.abrir}»`);
  for (const c of m.cabeceras) s.nota(`CABECERA-DE-GRUPO «${c}»`);
  for (const c of m.cifras) s.nota(`CIFRA ${c}`);
  s.nota(`FILTROS ${m.filtros.join(' ‖ ')}`);
  // CONTENIDO: una línea por fila, sin grupo ni píldora, para comparar antes/después como conjuntos.
  for (const t of m.filas) s.nota(`TARJETA ${t.cliente} | tipo=${t.tipo} | tarea=${t.tarea} | trabajo=${t.trabajo} | tec=${t.tecnicos} | dir=${t.direccion} | importe=${t.importe} | fecha=${t.fecha} → ${t.botones.map(corto).join(' · ')}`);
  m.filas.forEach((t, i) => s.nota(`ORDEN ${String(i + 1).padStart(2, '0')} ${t.cliente} · ${t.fecha || 'sin fecha'} · grupo=«${t.grupo.replace(/ · \d+.*$/, '')}» · píldora=«${t.pildora}» · alto ${t.alto}`));
  const todas = m.filas.flatMap((t) => t.botones);
  const dobles = m.filas.filter((t) => t.botones.filter((b) => b.rellena).length > 1);
  const noPrimera = m.filas.filter((t) => t.botones.some((b) => b.rellena) && !t.botones[0].rellena);
  const sinPildora = m.filas.filter((t) => !t.pildora);
  s.nota(`TESTIGO @${s.ancho}: ${m.filas.length} filas · con píldora ${m.filas.length - sinPildora.length} · con tipo ${m.filas.filter((t) => t.tipo).length} · con tarea ${m.filas.filter((t) => t.tarea).length} · con dirección ${m.filas.filter((t) => t.direccion).length}`
    + ` · rellenas ${todas.filter((b) => b.rellena).length} · filas con DOS rellenas ${dobles.length} · rellena NO primera ${noPrimera.length} · botones de fila <44 px ${todas.filter((b) => b.alto < 44).length}`);
  await s.mide('lista');
  if (!todas.some((b) => b.rotulo === 'Abrir parte' && b.rellena)) throw new Error('CIEGO: ninguna fila trae «Abrir parte» rellena (control positivo de SCRUM-1700): el instrumento no ve el relleno o la cuenta no tiene trabajos EN CURSO');
  if (local) {
    const aplicado = await p.evaluate(() => getComputedStyle(document.querySelector('.jobs-pantalla')).getPropertyValue('--jobs-lavado').trim());
    if (aplicado !== '1725g') throw new Error(`CIEGO: con LOCAL_DIR la página no aplica el bloque de esta rama (testigo «--jobs-lavado» = «${aplicado}»)`);
    if (m.cabeceras.length) throw new Error(`ROJO: la lista sigue pintando ${m.cabeceras.length} fila(s) de cabecera de grupo`);
    if (m.cuerpos !== 1) throw new Error(`ROJO: la tabla tiene ${m.cuerpos} tbody y la lista plana lleva 1`);
    if (sinPildora.length) throw new Error(`ROJO: ${sinPildora.length} fila(s) sin píldora de estado`);
  }
  if (m.pagina.anchoDeScroll > m.pagina.ancho) throw new Error(`ROJO: la página desborda ${m.pagina.anchoDeScroll - m.pagina.ancho} px a lo ancho`);
  if (dobles.length) throw new Error(`ROJO: ${dobles.length} fila(s) con DOS rellenas (SCRUM-1739 c.22030)`);
  if (noPrimera.length) throw new Error(`ROJO: ${noPrimera.length} fila(s) cuya rellena no va primera (SCRUM-1739)`);
};
