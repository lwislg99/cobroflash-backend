// SCRUM-1725g · PASO 1: el patrón REAL de las listas hermanas (Presupuestos, Albaranes) y el de Trabajos,
// medidos con la misma vara en yaqu.app, antes de aplanar Trabajos.
//
// Acción del banco H6 (`docs/master/evidencias/SCRUM-1686/banco-h6/paso2.mjs`):
//   BANCO_OUT=<fuera del repo> node …/paso2.mjs <ancho> "#quotes|#albaranes|#jobs" patron-<pantalla> <este fichero>
//
// NO ESCRIBE: lee y fotografía. No pulsa ningún botón. No intercepta nada.
//
// Lo que mide, por cada <table> visible de la pantalla:
//   · las columnas de su cabecera, en orden;
//   · cuántos <tbody> tiene y cuántas filas que NO son de datos (cabeceras de grupo: una fila con una sola
//     celda que ocupa todas las columnas);
//   · por fila de datos: si lleva píldora de estado (`.status-pill`) y su texto, y sus botones visibles.
// SUELO: sin ninguna tabla con filas de datos, CIEGO.
// CONTROL POSITIVO (el instrumento VE una cabecera de grupo cuando la hay): si la pantalla es Trabajos y
// producción todavía agrupa, el recuento de filas de grupo NO puede ser 0. Lo comprueba quien lee la nota
// `GRUPOS`, porque tras este ticket ese número pasa a ser 0 a propósito.
const leer = () => {
  const limpio = (t) => String(t || '').replace(/\s+/g, ' ').trim();
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const tablas = [...document.querySelectorAll('#view-container table, main table')].filter(visible);
  return tablas.map((t) => {
    const columnas = [...t.querySelectorAll('thead th')].map((th) => limpio(th.textContent));
    const n = columnas.length;
    const filas = [...t.querySelectorAll('tbody tr')].filter(visible);
    const deGrupo = filas.filter((tr) => tr.children.length === 1 && tr.children[0].colSpan >= Math.max(2, n));
    const deDatos = filas.filter((tr) => !deGrupo.includes(tr));
    return {
      clase: t.className, columnas, cuerpos: t.querySelectorAll('tbody').length,
      grupos: deGrupo.map((tr) => limpio(tr.textContent)),
      filas: deDatos.map((tr) => ({
        texto: limpio(tr.innerText).slice(0, 110),
        pildoras: [...tr.querySelectorAll('.status-pill')].filter(visible).map((p) => `${limpio(p.textContent)}[${[...p.classList].filter((c) => c !== 'status-pill').join(' ')}]`),
        botones: [...tr.querySelectorAll('button, a.btn-ghost, a.btn-secondary')].filter(visible).map((b) => `${b.classList.contains('btn-primary') ? '■' : '□'}${limpio(b.textContent)}`),
        alto: Math.round(tr.getBoundingClientRect().height),
      })),
    };
  });
};

export default async (s) => {
  const p = s.page;
  await p.waitForTimeout(1500);
  const tablas = await p.evaluate(leer);
  const conDatos = tablas.filter((t) => t.filas.length);
  if (!conDatos.length) throw new Error('CIEGO: la pantalla no pinta ninguna tabla con filas de datos');
  for (const t of conDatos) {
    s.nota(`TABLA «${t.clase}» @${s.ancho}: columnas [${t.columnas.join(' | ')}] · ${t.cuerpos} tbody · ${t.filas.length} filas de datos`);
    s.nota(`GRUPOS (filas de cabecera dentro del cuerpo): ${t.grupos.length}${t.grupos.length ? ' → ' + t.grupos.join(' ‖ ') : ''}`);
    const conPildora = t.filas.filter((f) => f.pildoras.length).length;
    s.nota(`ESTADO EN LA FILA: ${conPildora} de ${t.filas.length} filas llevan píldora · valores: ${[...new Set(t.filas.flatMap((f) => f.pildoras))].join(' , ') || '—'}`);
    s.nota(`ALTO de fila: mín ${Math.min(...t.filas.map((f) => f.alto))} · máx ${Math.max(...t.filas.map((f) => f.alto))}`);
    for (const f of t.filas.slice(0, 12)) s.nota(`FILA ${f.texto} ⟶ ${f.pildoras.join(' ')} ⟶ ${f.botones.join(' · ')}`);
  }
  await s.mide('patron');
};
