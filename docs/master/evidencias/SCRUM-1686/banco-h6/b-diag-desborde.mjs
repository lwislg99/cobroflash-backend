// ¿El desborde es REAL o es de la emulación? Dice el ancho de la ventana, del documento y de la hoja, si la
// página se puede desplazar en horizontal (se intenta de verdad: scrollTo) y QUIÉN empuja: la cadena de cajas
// más anchas que la ventana, de fuera adentro, con su `min-content`.
export default async (s) => {
  const p = s.page;
  const r = await p.evaluate(async () => {
    const W = document.documentElement.clientWidth;
    const vv = window.visualViewport;
    window.scrollTo(300, 0); await new Promise((f) => setTimeout(f, 200));
    const sx = window.scrollX; window.scrollTo(0, 0);
    const cs = (e) => getComputedStyle(e);
    const anchos = [...document.querySelectorAll('.view-container, .view-container *')].filter((e) => {
      const b = e.getBoundingClientRect(); return b.width > 0 && b.right > W + 1;
    });
    // los más profundos que se salen: los que no tienen ningún hijo que también se salga
    const hojas = anchos.filter((e) => ![...e.children].some((c) => anchos.includes(c)));
    const minContent = (e) => { const o = e.style.width; e.style.width = 'min-content'; const w = Math.round(e.getBoundingClientRect().width); e.style.width = o; return w; };
    return {
      ventana: `innerWidth=${window.innerWidth} clientWidth=${W} visualViewport=${vv ? Math.round(vv.width) + ' escala=' + vv.scale.toFixed(3) : 'n/d'}`,
      documento: `html.scrollWidth=${document.documentElement.scrollWidth} body.scrollWidth=${document.body.scrollWidth} · overflow-x html=${cs(document.documentElement).overflowX} body=${cs(document.body).overflowX}`,
      desplaza: `scrollTo(300,0) → scrollX=${sx}`,
      seSalen: anchos.length,
      hojas: hojas.slice(0, 14).map((e) => { const b = e.getBoundingClientRect(); return `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 34)} x=${Math.round(b.x)} ancho=${Math.round(b.width)} right=${Math.round(b.right)} display=${cs(e).display} min-content=${minContent(e)} «${(e.innerText || e.value || e.type || '').replace(/\s+/g, ' ').slice(0, 24)}»`; }),
      par: [...document.querySelectorAll('.parte-horas-par')].map((e) => `par ancho=${Math.round(e.getBoundingClientRect().width)} columnas=${cs(e).gridTemplateColumns} · hijos: ${[...e.children].map((c) => Math.round(c.getBoundingClientRect().width) + '(min ' + minContent(c) + ')').join(' + ')}`),
      padre: (() => { const e = document.querySelector('.parte-horas'); if (!e) return 'sin .parte-horas'; const b = e.getBoundingClientRect(); return `.parte-horas ancho=${Math.round(b.width)} padding=${cs(e).paddingLeft}/${cs(e).paddingRight} · su padre ${e.parentElement.className.slice(0, 40)} ancho=${Math.round(e.parentElement.getBoundingClientRect().width)} display=${cs(e.parentElement).display} columnas=${cs(e.parentElement).gridTemplateColumns}`; })(),
    };
  });
  for (const [k, v] of Object.entries(r)) s.nota(`${k}: ${Array.isArray(v) ? '\n    ' + v.join('\n    ') : v}`);
  await s.mide('diag');
};
