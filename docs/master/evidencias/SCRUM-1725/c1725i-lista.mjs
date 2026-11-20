// SCRUM-1725i · los FILTROS de la lista de Trabajos, antes (píldoras de cobro) y después (pestañas de
// estado + desplegable de cobro), en yaqu.app.
//
// Acción del banco H6 (`docs/master/evidencias/SCRUM-1686/banco-h6/paso2.mjs`):
//   ANTES    BANCO_OUT=<fuera del repo> [ROL=tecnico] node …/paso2.mjs <ancho> "#jobs" antes   <este fichero>
//   DESPUÉS  LOCAL_DIR=<raíz del árbol> BANCO_OUT=… [ROL=tecnico] node …/paso2.mjs <ancho> "#jobs" despues <este fichero>
//
// Con LOCAL_DIR sirve `js/jobsView.js` y `css/styles.css` del árbol ENCIMA de producción (datos reales de
// la cuenta QA, todo lo demás de yaqu.app) y recarga. Mismo mecanismo que `c1725g-lista.mjs`.
//
// NO ESCRIBE: lee, fotografía y, en el «después», pulsa las pestañas (filtran en el navegador, no piden
// nada al servidor) y vuelve a «Todos».
//
// Lo que mide:
//   · CONTENIDO bajo «Todos»: una línea `TARJETA` por fila, con el MISMO formato que `c1725g-lista.mjs`.
//     El antes y el después se comparan como CONJUNTOS: poner los filtros no puede ganar ni perder un
//     trabajo, un dato ni un botón.
//   · FILTROS: las píldoras de cobro (antes), y las pestañas con su contador y las opciones del
//     desplegable (después). Para quien no ve el cobro: ni píldoras ni desplegable.
//   · PESTAÑAS, una a una (después): se pulsa y se cuentan las filas. Tienen que ser las de su contador,
//     todas con la píldora de esa pestaña; «Cerrado» sin «Ver N cerrados»; y las cinco suman «Todos».
//   · DESBORDE horizontal y controles por debajo de 44 px (los cuenta `s.mide`).
// SUELO: sin filas, CIEGO. CONTROL POSITIVO: «Abrir parte» rellena (SCRUM-1700), como en `c1725g`.
// Con LOCAL_DIR, además: la hoja servida lleva el marcador de este ticket y la página lo APLICA.
import fs from 'node:fs';
import path from 'node:path';
// El banco de SCRUM-1658 (`abrir`, con `serviceWorkers: 'block'`): esta acción llama a `.route(` sobre
// yaqu.app, y sin service worker bloqueado lo interceptado puede no pasar por aquí (SCRUM-1233).
import * as banco from '../SCRUM-1658/banco/lib.mjs';

const SERVIDOS = [['js/jobsView.js', 'application/javascript'], ['css/styles.css', 'text/css']];
const MARCADOR = 'S4 · SCRUM-1725i';

const leer = () => {
  const limpio = (t) => String(t || '').replace(/\s+/g, ' ').trim();
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const tabla = document.querySelector('table.table--trabajos');
  const filas = [];
  for (const tr of (tabla ? tabla.querySelectorAll('tbody tr') : [])) {
    if (!tr.classList.contains('jobs-fila') || !visible(tr)) continue;
    const celda = tr.querySelector('.jobs-celda-acciones');
    const botones = [...(celda ? celda.querySelectorAll('button, summary, a') : [])].filter(visible).map((b) => {
      const r = b.getBoundingClientRect();
      return { rotulo: limpio(b.textContent), rellena: b.classList.contains('btn-primary'), x: Math.round(r.left), y: Math.round(r.top), alto: Math.round(r.height) };
    }).sort((a, b) => (Math.abs(a.y - b.y) > 6 ? a.y - b.y : a.x - b.x));
    const de = (sel) => { const e = tr.querySelector(sel); return e && visible(e) ? limpio(e.textContent) : ''; };
    filas.push({
      cliente: de('.jobs-fila-cliente'), tipo: de('.jobs-fila-tipo'), tarea: de('.jobs-fila-tarea'),
      trabajo: de('.jobs-fila-trabajo'), tecnicos: de('.jobs-fila-tecnicos'), direccion: de('.jobs-fila-direccion'),
      importe: de('td.cell-amount'), fecha: de('td.cell-date'), pildora: de('td.cell-status .status-pill'), botones,
    });
  }
  const abrir = tabla && tabla.querySelector('tr.jobs-grupo-abrir');
  const raiz = document.scrollingElement || document.documentElement;
  const tira = document.querySelector('#jobs-filter .data-card-tabs');
  const caja = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), der: Math.round(r.right), alto: Math.round(r.height) }; };
  return {
    abrir: abrir && visible(abrir) ? limpio(abrir.textContent) : '',
    vacio: limpio((document.querySelector('.jobs-vacio-filtro') || {}).textContent),
    cifras: [...document.querySelectorAll('.jobs-cifra')].map((c) => limpio(c.innerText)),
    pildorasDeCobro: [...document.querySelectorAll('#jobs-filter > button')].map((b) => limpio(b.textContent)),
    pestanas: [...document.querySelectorAll('#jobs-filter .data-card-tab')].map((b) => ({
      rotulo: limpio(b.firstChild && b.firstChild.textContent), n: Number(limpio((b.querySelector('.badge') || {}).textContent)),
      pulsada: b.getAttribute('aria-pressed') === 'true', ...caja(b),
    })),
    tira: tira ? { ...caja(tira), ancho: tira.clientWidth, anchoDeScroll: tira.scrollWidth } : null,
    opcionesDeCobro: [...document.querySelectorAll('#jobs-filter select.jobs-filtro-cobro option')].map((o) => limpio(o.textContent)),
    barra: [...document.querySelectorAll('#jobs-filter .jobs-barra select, #jobs-filter .jobs-barra input')].filter(visible).map((c) => `${c.id || c.className} ${caja(c).alto}px`),
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
  if (!m.filas.length) throw new Error('CIEGO: la lista no pinta ninguna fila (table.table--trabajos tr.jobs-fila)');
  const veCobro = await p.evaluate(() => window.appUserRole === 'admin');
  const corto = (b) => `${b.rellena ? '■' : '□'}${b.rotulo}`;
  s.nota(`PAGINA @${s.ancho}: ancho ${m.pagina.ancho} · ancho de scroll ${m.pagina.anchoDeScroll} · desborde ${m.pagina.anchoDeScroll - m.pagina.ancho} · alto ${m.pagina.alto}`);
  for (const c of m.cifras) s.nota(`CIFRA ${c}`);
  s.nota(`FILTROS-ANTES (píldoras de cobro) ${m.pildorasDeCobro.join(' ‖ ') || '—'}`);
  s.nota(`PESTAÑAS ${m.pestanas.map((t) => `${t.pulsada ? '▣' : '□'}${t.rotulo} ${t.n} (alto ${t.alto})`).join(' ‖ ') || '—'}`);
  if (m.tira) s.nota(`TIRA @${s.ancho}: pide ${m.tira.anchoDeScroll} px en ${m.tira.ancho} · ${m.tira.anchoDeScroll > m.tira.ancho ? 'desplaza' : 'cabe'}`);
  s.nota(`COBRO (desplegable) ${m.opcionesDeCobro.join(' ‖ ') || '—'}`);
  s.nota(`BARRA ${m.barra.join(' ‖ ') || '—'}`);
  // CONTENIDO bajo «Todos»: una línea por fila, para comparar antes/después como conjuntos.
  for (const t of m.filas) s.nota(`TARJETA ${t.cliente} | tipo=${t.tipo} | tarea=${t.tarea} | trabajo=${t.trabajo} | tec=${t.tecnicos} | dir=${t.direccion} | importe=${t.importe} | fecha=${t.fecha} → ${t.botones.map(corto).join(' · ')}`);
  s.nota(`TESTIGO @${s.ancho}: ${m.filas.length} filas bajo «Todos» · pie «${m.abrir}» · ve el cobro: ${veCobro ? 'sí' : 'no'}`);
  await s.mide('lista');
  const todas = m.filas.flatMap((t) => t.botones);
  if (!todas.some((b) => b.rotulo === 'Abrir parte' && b.rellena)) throw new Error('CIEGO: ninguna fila trae «Abrir parte» rellena (control positivo de SCRUM-1700): el instrumento no ve el relleno o la cuenta no tiene trabajos EN CURSO');
  if (m.pagina.anchoDeScroll > m.pagina.ancho) throw new Error(`ROJO: la página desborda ${m.pagina.anchoDeScroll - m.pagina.ancho} px a lo ancho`);
  if (!local) return;

  const aplicado = await p.evaluate(() => getComputedStyle(document.querySelector('.jobs-pantalla')).getPropertyValue('--jobs-filtros').trim());
  if (aplicado !== '1725i') throw new Error(`CIEGO: con LOCAL_DIR la página no aplica el bloque de esta rama (testigo «--jobs-filtros» = «${aplicado}»)`);
  const rotulos = m.pestanas.map((t) => t.rotulo).join(' | ');
  if (rotulos !== 'Todos | Sin agendar | Agendado | En curso | Terminado | Cerrado') throw new Error(`ROJO: las pestañas son «${rotulos}»`);
  if (m.pildorasDeCobro.length) throw new Error(`ROJO: siguen ${m.pildorasDeCobro.length} píldoras de cobro sueltas`);
  if (veCobro && m.opcionesDeCobro.length !== 4) throw new Error(`ROJO: el admin ve ${m.opcionesDeCobro.length} opciones de cobro, no 4`);
  if (veCobro && !/^Cobro: todos \(\d+\)$/.test(m.opcionesDeCobro[0])) throw new Error(`ROJO: la primera opción es «${m.opcionesDeCobro[0]}», no «Cobro: todos (N)»`);
  if (!veCobro && m.opcionesDeCobro.length) throw new Error(`ROJO: quien no ve el cobro tiene ${m.opcionesDeCobro.length} opciones de cobro`);
  const [todos, ...cinco] = m.pestanas;
  const suma = cinco.reduce((a, t) => a + t.n, 0);
  if (suma !== todos.n) throw new Error(`ROJO: las cinco pestañas suman ${suma} y «Todos» dice ${todos.n}`);
  const cerrados = cinco[4].n;
  if (m.filas.length !== todos.n - cerrados) throw new Error(`ROJO: bajo «Todos» hay ${m.filas.length} filas y tendría que haber ${todos.n - cerrados} (los ${cerrados} cerrados, plegados)`);
  if (cerrados && !/^Ver \d+ cerrado/.test(m.abrir)) throw new Error(`ROJO: bajo «Todos» los cerrados no van plegados (pie «${m.abrir}»)`);

  // Las pestañas, una a una. Se pulsan con el ratón (o el dedo), no con `el.click()` en la página.
  const pestana = (i) => p.locator('#jobs-filter .data-card-tab').nth(i);
  for (let i = 1; i <= 5; i++) {
    await pestana(i).click();
    await p.waitForTimeout(150);
    const v = await p.evaluate(leer);
    const t = v.pestanas[i];
    const ajenas = v.filas.filter((f) => f.pildora.toLowerCase() !== t.rotulo.toLowerCase()).length;
    s.nota(`PESTAÑA «${t.rotulo}» @${s.ancho}: contador ${t.n} · filas ${v.filas.length} · de otro estado ${ajenas} · pulsada ${t.pulsada} · entera en la tira ${t.x >= v.tira.x && t.der <= v.tira.der} · pie «${v.abrir}» · vacío «${v.vacio}»`);
    if (v.filas.length !== t.n) throw new Error(`ROJO: la pestaña «${t.rotulo}» dice ${t.n} y enseña ${v.filas.length} filas`);
    if (ajenas) throw new Error(`ROJO: la pestaña «${t.rotulo}» enseña ${ajenas} fila(s) de otro estado`);
    if (!t.pulsada || v.pestanas.filter((x) => x.pulsada).length !== 1) throw new Error(`ROJO: tras pulsar «${t.rotulo}» no es ella la única pulsada`);
    if (t.x < v.tira.x || t.der > v.tira.der) throw new Error(`ROJO: «${t.rotulo}» pulsada no queda entera a la vista (x ${t.x}-${t.der} en ${v.tira.x}-${v.tira.der})`);
    if (v.abrir) throw new Error(`ROJO: en la pestaña «${t.rotulo}» asoma «${v.abrir}»`);
    if (!t.n && v.vacio !== 'No hay trabajos con ese filtro.') throw new Error(`ROJO: la pestaña «${t.rotulo}», vacía, dice «${v.vacio}»`);
    if (v.pagina.anchoDeScroll > v.pagina.ancho) throw new Error(`ROJO: con la pestaña «${t.rotulo}» la página desborda ${v.pagina.anchoDeScroll - v.pagina.ancho} px`);
    if (i === 5) await s.mide('cerrado');
  }
  await pestana(0).click();
  await p.waitForTimeout(150);
  const fin = await p.evaluate(leer);
  const clave = (x) => JSON.stringify(x.filas.map((f) => [f.cliente, f.tarea, f.importe, f.fecha, f.pildora]));
  if (clave(fin) !== clave(m) || fin.abrir !== m.abrir) throw new Error('ROJO: al volver a «Todos» la lista no es la de entrada');
  s.nota(`VUELTA A «Todos» @${s.ancho}: ${fin.filas.length} filas, las mismas y en el mismo orden · pie «${fin.abrir}»`);
};
