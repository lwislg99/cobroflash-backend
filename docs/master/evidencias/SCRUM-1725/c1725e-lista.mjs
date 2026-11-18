// SCRUM-1725e · la LISTA de Trabajos, antes y después del lavado de cara, en la página real de yaqu.app.
//
// Acción del banco H6 (`docs/master/evidencias/SCRUM-1686/banco-h6/paso2.mjs`):
//   ANTES    BANCO_OUT=<fuera del repo> [ROL=tecnico] node …/paso2.mjs <ancho> "#jobs" antes   <este fichero>
//   DESPUÉS  LOCAL_DIR=<raíz del árbol> BANCO_OUT=… [ROL=tecnico] node …/paso2.mjs <ancho> "#jobs" despues <este fichero>
//
// Con LOCAL_DIR sirve `js/jobsView.js` y `css/styles.css` del árbol ENCIMA de producción (datos reales de
// la cuenta QA, todo lo demás de yaqu.app) y recarga. Mismo mecanismo que `SCRUM-1739/c1739-primaria.mjs`.
//
// NO ESCRIBE: lee y fotografía. No pulsa ningún botón.
//
// Lo que mide (lo que el lavado de cara NO puede cambiar, y lo que sí):
//   · CONTENIDO: por grupo su rótulo, y por tarjeta su texto entero y sus botones (rótulo + rellena o no),
//     en el orden en que se VEN. El antes y el después se comparan como CONJUNTOS de líneas `TARJETA`.
//   · ROPA: caja de cada pieza de la cabecera (título, botón, cifras, filtros), de cada rótulo de grupo y
//     de cada tarjeta; fondo, borde, radio y sombra CALCULADOS de la tarjeta y del rótulo de grupo.
//   · DESBORDE horizontal de la página y controles por debajo de 44 px (los cuenta `s.mide`).
// SUELO: sin tarjetas, CIEGO. CONTROL POSITIVO: la cuenta QA tiene trabajos EN CURSO y «Abrir parte» es
// rellena desde SCRUM-1700: si ninguna tarjeta la trae rellena, el instrumento no ve el relleno → CIEGO.
// Con LOCAL_DIR, además: la hoja servida debe llevar el marcador del bloque de este ticket, y la página
// debe APLICARLO (testigo calculado); si no, no se sirvió lo local → CIEGO.
import fs from 'node:fs';
import path from 'node:path';
// QUIÉN ABRE EL CONTEXTO DE ESTA ACCIÓN: el banco de SCRUM-1658 (`abrir`, con `serviceWorkers: 'block'`).
// Esta acción llama a `.route(` sobre yaqu.app y no abre navegador: sin service worker bloqueado, lo
// interceptado puede no pasar por aquí y la petición sale a producción (SCRUM-1233). Se importa el MISMO
// módulo que importa `paso2.mjs`, y abajo se comprueba que es el que nos han pasado.
import * as banco from '../SCRUM-1658/banco/lib.mjs';

const SERVIDOS = [['js/jobsView.js', 'application/javascript'], ['css/styles.css', 'text/css']];
const MARCADOR = 'S4 · SCRUM-1725e';

const leer = () => {
  const caja = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top + window.scrollY), ancho: Math.round(r.width), alto: Math.round(r.height) };
  };
  const ropa = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { fondo: cs.backgroundColor, borde: `${cs.borderTopWidth} ${cs.borderTopColor}`, radio: cs.borderTopLeftRadius, sombra: cs.boxShadow, letra: `${cs.fontSize}/${cs.fontWeight}`, color: cs.color };
  };
  const limpio = (t) => String(t || '').replace(/\s+/g, ' ').trim();
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const cabecera = {
    titulo: caja(document.querySelector('.jobs-cabecera')),
    tituloRopa: ropa(document.querySelector('.jobs-cabecera')),
    h2: ropa(document.querySelector('.jobs-cabecera h2')),
    nuevo: caja(document.querySelector('.jobs-nuevo')),
    cifras: caja(document.querySelector('.jobs-cifras')),
    filtros: caja(document.querySelector('.jobs-filtros')),
    lista: caja(document.querySelector('.jobs-lista')),
    card: ropa(document.querySelector('.jobs-card')),
  };
  const grupos = [];
  for (const tbody of document.querySelectorAll('tbody.jobs-grupo')) {
    const t = tbody.querySelector('tr.jobs-grupo-titulo');
    const abrir = tbody.querySelector('tr.jobs-grupo-abrir');
    const filas = [...tbody.querySelectorAll('tr.jobs-fila')].filter(visible);
    grupos.push({
      rotulo: t ? limpio(t.textContent) : '?',
      titulo: caja(t), tituloRopa: ropa(t), tituloLetra: ropa(t && t.querySelector('td')),
      abrir: abrir ? { texto: limpio(abrir.textContent), caja: caja(abrir), ropa: ropa(abrir) } : null,
      tarjetas: filas.map((tr) => {
        const celda = tr.querySelector('.jobs-celda-acciones');
        const botones = [...(celda ? celda.querySelectorAll('button, summary, a') : [])].filter(visible).map((b) => {
          const r = b.getBoundingClientRect();
          return { rotulo: limpio(b.textContent), rellena: b.classList.contains('btn-primary'), fondo: getComputedStyle(b).backgroundColor, x: Math.round(r.left), y: Math.round(r.top), alto: Math.round(r.height) };
        }).sort((a, b) => (Math.abs(a.y - b.y) > 6 ? a.y - b.y : a.x - b.x));
        const de = (sel) => { const e = tr.querySelector(sel); return e && visible(e) ? limpio(e.textContent) : ''; };
        return {
          cliente: de('.jobs-fila-cliente'), tipo: de('.jobs-fila-tipo'), tarea: de('.jobs-fila-tarea'),
          direccion: de('.jobs-fila-direccion'), importe: de('td.cell-amount'), fecha: de('td.cell-date'),
          texto: limpio(tr.innerText), caja: caja(tr), ropa: ropa(tr), botones,
        };
      }),
    });
  }
  const raiz = document.scrollingElement || document.documentElement;
  return { cabecera, grupos, pagina: { ancho: window.innerWidth, anchoDeScroll: raiz.scrollWidth, alto: raiz.scrollHeight } };
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
  const tarjetas = m.grupos.flatMap((g) => g.tarjetas.map((t) => ({ ...t, grupo: g.rotulo })));
  if (!tarjetas.length) throw new Error('CIEGO: la lista no pinta ninguna tarjeta (tbody.jobs-grupo tr.jobs-fila)');
  const corto = (b) => `${b.rellena ? '■' : '□'}${b.rotulo}`;
  const c = (x) => (x ? `${x.ancho}x${x.alto}@(${x.x},${x.y})` : '—');
  s.nota(`PAGINA @${s.ancho}: ancho ${m.pagina.ancho} · ancho de scroll ${m.pagina.anchoDeScroll} · desborde ${m.pagina.anchoDeScroll - m.pagina.ancho} · alto ${m.pagina.alto}`);
  s.nota(`CABECERA título ${c(m.cabecera.titulo)} · nuevo ${c(m.cabecera.nuevo)} · cifras ${c(m.cabecera.cifras)} · filtros ${c(m.cabecera.filtros)} · lista ${c(m.cabecera.lista)}`);
  s.nota(`ROPA título ${JSON.stringify(m.cabecera.tituloRopa)} · h2 ${JSON.stringify(m.cabecera.h2)} · contenedor de la lista ${JSON.stringify(m.cabecera.card)}`);
  for (const g of m.grupos) {
    s.nota(`GRUPO «${g.rotulo}» ${c(g.titulo)} letra ${g.tituloLetra ? g.tituloLetra.letra : '—'} fondo ${g.tituloRopa ? g.tituloRopa.fondo : '—'} borde ${g.tituloRopa ? g.tituloRopa.borde : '—'} · ${g.tarjetas.length} tarjetas${g.abrir ? ` · ABRIR «${g.abrir.texto}» ${c(g.abrir.caja)} fondo ${g.abrir.ropa.fondo} borde ${g.abrir.ropa.borde}` : ''}`);
  }
  // CONTENIDO: una línea por tarjeta, sin cajas ni estilos, para comparar antes/después como conjuntos.
  for (const t of tarjetas) s.nota(`TARJETA [${t.grupo.replace(/ · \d+.*$/, '')}] ${t.cliente} | tipo=${t.tipo} | tarea=${t.tarea} | dir=${t.direccion} | importe=${t.importe} | fecha=${t.fecha} → ${t.botones.map(corto).join(' · ')}`);
  for (const t of tarjetas.slice(0, 3)) s.nota(`ROPA-TARJETA ${t.cliente}: ${c(t.caja)} ${JSON.stringify(t.ropa)}`);
  const todas = tarjetas.flatMap((t) => t.botones);
  const dobles = tarjetas.filter((t) => t.botones.filter((b) => b.rellena).length > 1);
  const noPrimera = tarjetas.filter((t) => t.botones.some((b) => b.rellena) && !t.botones[0].rellena);
  const bajos = todas.filter((b) => b.alto < 44);
  const conTipo = tarjetas.filter((t) => t.tipo).length;
  const conTarea = tarjetas.filter((t) => t.tarea).length;
  const conDir = tarjetas.filter((t) => t.direccion).length;
  s.nota(`TESTIGO @${s.ancho}: ${m.grupos.length} grupos · ${tarjetas.length} tarjetas · con tipo ${conTipo} · con tarea ${conTarea} · con dirección ${conDir}`
    + ` · rellenas ${todas.filter((b) => b.rellena).length} · tarjetas con DOS rellenas ${dobles.length} · rellena NO primera ${noPrimera.length} · botones de tarjeta <44 px ${bajos.length}`);
  await s.mide('lista');
  if (!todas.some((b) => b.rotulo === 'Abrir parte' && b.rellena)) throw new Error('CIEGO: ninguna tarjeta trae «Abrir parte» rellena (control positivo de SCRUM-1700): el instrumento no ve el relleno o la cuenta no tiene trabajos EN CURSO');
  if (local) {
    const aplicado = await p.evaluate(() => getComputedStyle(document.querySelector('.jobs-pantalla')).getPropertyValue('--jobs-lavado').trim());
    if (aplicado !== '1725e') throw new Error(`CIEGO: con LOCAL_DIR la página no aplica el bloque de esta rama (testigo «--jobs-lavado» = «${aplicado}»)`);
  }
  if (m.pagina.anchoDeScroll > m.pagina.ancho) throw new Error(`ROJO: la página desborda ${m.pagina.anchoDeScroll - m.pagina.ancho} px a lo ancho`);
  if (dobles.length) throw new Error(`ROJO: ${dobles.length} tarjeta(s) con DOS rellenas (SCRUM-1739 c.22030)`);
  if (noPrimera.length) throw new Error(`ROJO: ${noPrimera.length} tarjeta(s) cuya rellena no va primera (SCRUM-1739)`);
};
