// ¿QUIÉN ensancha la hoja del parte? Se prueba de verdad, sin deducir: se mide el ancho de `.view-container`,
// se aplica UN cambio en el DOM vivo (no se guarda nada), se vuelve a medir y se deshace. El que lo devuelve a
// la ventana es el culpable. Y la cadena de antepasados, para ver qué caja crece a `min-content`.
export default async (s) => {
  const p = s.page;
  const r = await p.evaluate(() => {
    const vc = document.querySelector('.view-container');
    const ancho = () => Math.round(vc.getBoundingClientRect().width);
    const out = { base: ancho(), pruebas: [], cadena: [] };
    const probar = (nombre, hacer, deshacer) => { hacer(); out.pruebas.push(`${nombre} → ${ancho()}`); deshacer(); };
    const res = [...document.querySelectorAll('.parte-plegable-resumen')];
    out.resumenes = res.map((e) => `«${e.textContent.slice(0, 50)}» ancho=${Math.round(e.getBoundingClientRect().width)} scrollW=${e.scrollWidth}`);
    res.forEach((e, i) => { const t = e.textContent; probar(`resumen ${i} vacío`, () => { e.textContent = ''; }, () => { e.textContent = t; }); });
    probar('TODOS los resúmenes con white-space:normal', () => res.forEach((e) => { e.style.whiteSpace = 'normal'; }), () => res.forEach((e) => { e.style.whiteSpace = ''; }));
    const cab = [...document.querySelectorAll('.parte-plegable-cabeza')];
    probar('cabezas con min-width:0 + overflow:hidden', () => cab.forEach((e) => { e.style.minWidth = '0'; e.style.overflow = 'hidden'; }), () => cab.forEach((e) => { e.style.minWidth = ''; e.style.overflow = ''; }));
    const pl = [...document.querySelectorAll('.parte-plegable')];
    probar('plegables con min-width:0', () => pl.forEach((e) => { e.style.minWidth = '0'; }), () => pl.forEach((e) => { e.style.minWidth = ''; }));
    const cuerpos = [...document.querySelectorAll('.parte-plegable-cuerpo')];
    probar('cuerpos de plegable display:none', () => cuerpos.forEach((e) => { e.style.display = 'none'; }), () => cuerpos.forEach((e) => { e.style.display = ''; }));
    const km = [...document.querySelectorAll('.parte-campo-con-unidad input')];
    probar('input de km con min-width:0', () => km.forEach((e) => { e.style.minWidth = '0'; }), () => km.forEach((e) => { e.style.minWidth = ''; }));
    const dd = document.querySelector('.parte-datos-del-parte');
    if (dd) {
      probar('bloque «Datos del parte» display:none', () => { dd.style.display = 'none'; }, () => { dd.style.display = ''; });
      out.datos = `.parte-datos-del-parte display=${getComputedStyle(dd).display} columnas=${getComputedStyle(dd).gridTemplateColumns} ancho=${Math.round(dd.getBoundingClientRect().width)} · padre=${dd.parentElement.className.slice(0, 50)} display=${getComputedStyle(dd.parentElement).display}`;
    }
    for (let e = document.querySelector('.parte-plegable'); e && e !== document.documentElement; e = e.parentElement) {
      const c = getComputedStyle(e);
      out.cadena.push(`${e.tagName.toLowerCase()}.${String(e.className).slice(0, 44)} ancho=${Math.round(e.getBoundingClientRect().width)} display=${c.display} min-width=${c.minWidth} overflow-x=${c.overflowX}${c.display.includes('grid') ? ' columnas=' + c.gridTemplateColumns : ''}${c.display.includes('flex') ? ' flex-dir=' + c.flexDirection : ''}`);
    }
    return out;
  });
  s.nota('ancho base de .view-container: ' + r.base);
  s.nota('resúmenes:\n    ' + (r.resumenes || []).join('\n    '));
  s.nota('pruebas (cambio → ancho de la hoja):\n    ' + r.pruebas.join('\n    '));
  s.nota('datos: ' + r.datos);
  s.nota('cadena de antepasados:\n    ' + r.cadena.join('\n    '));
};
