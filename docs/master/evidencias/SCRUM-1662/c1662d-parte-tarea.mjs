// SCRUM-1662 (d) · ¿SE LEE «Qué hay que hacer» en la hoja del parte, y dónde cae?
// Acción para el banco H6 (`docs/master/evidencias/SCRUM-1686/banco-h6/paso2.mjs`), que abre yaqu.app:
//
//   $env:BANCO_OUT=<carpeta fuera del repo>
//   node docs/master/evidencias/SCRUM-1686/banco-h6/paso2.mjs 390 "#parte-detail/23" antes docs/master/evidencias/SCRUM-1662/c1662d-parte-tarea.mjs
//   $env:LOCAL_DIR=<raíz del árbol con el cambio>   →  lo mismo con nombre «despues»
//
// Sin LOCAL_DIR mide lo que sirve producción (el ANTES, o el DESPUÉS una vez desplegado: la regla 42).
// Con LOCAL_DIR sirve `parteDetailView.js` y `styles.css` de ese árbol encima de producción: solo cambia
// el front, los datos siguen siendo los de la cuenta QA. NO escribe nada (ni un clic): solo lee.
// FIRMADO=<id> mide además un parte firmado.
//
// Tres testigos, porque «no se ve la tarea» tiene tres causas distintas y solo una es de esta pieza:
//   · TESTIGO-CODIGO: el literal que la página tiene cargado (¿corre el front nuevo?);
//   · TESTIGO-DATO: qué manda el servidor en `queHayQueHacer` para ESE parte (¿hay tarea que pintar?);
//   · MEDIDA: lo que hay en el DOM y dónde.
import fs from 'node:fs';
import path from 'node:path';
// El contexto de esta acción lo abre el banco de SCRUM-1658 (`abrir`, con `serviceWorkers: 'block'`), a
// través de `paso2.mjs` → `rol.mjs`. Se importa AQUÍ, fijo, porque esta acción intercepta yaqu.app con
// `.route(` y `tests/scrum1233g-banco-bloquea-el-sw.test.mjs` busca por los imports quién abre el
// contexto: con un service worker vivo, la intercepción se la salta y el «después» mediría producción.
import { OUT } from '../SCRUM-1658/banco/lib.mjs';

const SERVIDOS = [
  ['js/parteDetailView.js', 'application/javascript; charset=utf-8'],
  ['css/styles.css', 'text/css; charset=utf-8'],
];

async function medir(p) {
  return p.evaluate(() => {
    const caja = (e) => { const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
    const cabecera = document.querySelector('header.parte-cabecera');
    if (!cabecera) return { ciego: 'no encuentro `header.parte-cabecera`: esta pantalla no es la hoja de un parte' };
    const hoja = cabecera.parentElement;
    const hijas = [...hoja.children].map((e) => e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(/\s+/)[0] : ''));
    const bloques = [...document.querySelectorAll('[data-parte-tarea]')];
    const base = {
      hijasDeLaHoja: hijas,
      bloques: bloques.length,
      vecesElRotuloEnLaHoja: [...hoja.querySelectorAll('*')].filter((e) => e.children.length === 0 && e.textContent.trim() === 'Qué hay que hacer').length,
      desbordeHorizontalDeLaPagina: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
    if (bloques.length !== 1) return base;
    const b = bloques[0];
    const titulo = b.querySelector('.parte-tarea-titulo');
    const texto = b.querySelector('.detail-tarea');
    const csB = getComputedStyle(b); const csT = getComputedStyle(titulo); const csP = getComputedStyle(texto);
    const firmas = hoja.querySelector(':scope > .parte-firmas');
    const siguiente = b.nextElementSibling;
    return {
      ...base,
      vaTrasLaCabecera: b.previousElementSibling === cabecera,
      rotulo: titulo.textContent,
      tarea: texto.textContent.slice(0, 200), caracteresDeLaTarea: texto.textContent.length,
      cajaCabecera: caja(cabecera), cajaBloque: caja(b), cajaTitulo: caja(titulo), cajaTexto: caja(texto),
      siguiente: siguiente ? siguiente.tagName.toLowerCase() + '.' + String(siguiente.className).split(/\s+/)[0] : null,
      cajaSiguiente: siguiente ? caja(siguiente) : null,
      cajaFirmas: firmas ? caja(firmas) : null,
      tarjeta: { fondo: csB.backgroundColor, borde: csB.borderTopWidth + ' ' + csB.borderTopColor, radio: csB.borderTopLeftRadius, relleno: csB.paddingTop, sombra: csB.boxShadow },
      fuenteTitulo: csT.fontSize + '/' + csT.lineHeight + ' ' + csT.fontWeight + ' ' + csT.color,
      fuenteTexto: csP.fontSize + '/' + csP.lineHeight + ' ' + csP.fontWeight + ' ' + csP.color + ' ws=' + csP.whiteSpace,
      textoDesbordaSuCaja: texto.scrollWidth > texto.clientWidth,
      interactivosDentro: b.querySelectorAll('input, textarea, select, button, a, [contenteditable], [tabindex]').length,
    };
  });
}

export default async (s, h) => {
  const p = s.page;
  const hash = '#' + String(p.url().split('#')[1] || '');
  const local = process.env.LOCAL_DIR;
  if (local) {
    for (const [f, tipo] of SERVIDOS) {
      const ruta = path.join(local, 'public', 'dashboard', f);
      const cuerpo = fs.readFileSync(ruta, 'utf8');
      await p.route((u) => u.pathname.endsWith('/dashboard/' + f), (r) => r.fulfill({ status: 200, contentType: tipo, body: cuerpo }));
      s.nota(`LOCAL ${f} ← ${ruta} (${cuerpo.length} caracteres)`);
    }
  } else {
    s.nota('SIN LOCAL_DIR: se mide lo que sirve producción');
  }
  // TESTIGO-DATO: se escucha lo que el servidor contesta a `GET /admin/partes/:id`. Solo se apunta el
  // TIPO y el tamaño de `queHayQueHacer`, no su contenido (la tarea es texto de un cliente).
  const datos = [];
  p.on('response', async (r) => {
    const m = new URL(r.url()).pathname.match(/\/admin\/partes\/(\d+)$/);
    if (!m || r.request().method() !== 'GET') return;
    try {
      const j = await r.json();
      const v = j ? j.queHayQueHacer : undefined;
      datos.push(`parte ${m[1]} · HTTP ${r.status()} · queHayQueHacer: ${v === undefined ? 'SIN LA CLAVE' : (v === null ? 'null' : typeof v + ' de ' + String(v).length + ' caracteres')} · estado=${j && j.estado} · jobId=${j && j.jobId}`);
    } catch (e) { datos.push(`parte ${m[1]} · HTTP ${r.status()} · cuerpo ilegible: ${String(e).slice(0, 80)}`); }
  });
  // `h.ir` al MISMO hash no recarga el documento (es una navegación de ancla): sin `reload`, la página
  // sigue con el script que ya tenía. Se recarga SIEMPRE: así, además, el GET del parte pasa por el
  // escucha de arriba también cuando se mide producción.
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  s.nota('TESTIGO-CODIGO PARTE_TEXTOS.queHayQueHacer = ' + JSON.stringify(await p.evaluate(() => (window.PARTE_TEXTOS || {}).queHayQueHacer)));
  for (const [nombre, destino] of [['borrador', hash], ['firmado', process.env.FIRMADO ? '#parte-detail/' + process.env.FIRMADO : null]]) {
    if (!destino) continue;
    if (destino !== hash) { await h.ir(p, destino); await p.waitForTimeout(900); }
    const m = await medir(p);
    s.nota(`MEDIDA ${nombre} ${destino} @${s.ancho}: ${JSON.stringify(m)}`);
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.screenshot({ path: path.join(OUT, `hoja-${process.argv[4]}-${nombre}-${s.ancho}.png`) });
  }
  s.nota('TESTIGO-DATO ' + (datos.length ? datos.join(' | ') : 'CIEGO: no se vio ningún GET /admin/partes/:id'));
  await s.mide('fin');
};
