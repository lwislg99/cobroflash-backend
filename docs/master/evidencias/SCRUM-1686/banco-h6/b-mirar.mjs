// Medida a secas de la pantalla del hash, con tres añadidos que el recorrido pide en cada una:
//   BUSCAR="a||b"  → cuántas veces sale cada cadena en el TEXTO visible y en el DOM entero (innerHTML):
//                    lo que no debe ver el operario no puede estar ni escondido.
//   CAJAS="sel||sel" → caja (x, ancho, alto, márgenes al borde de la ventana) del primer elemento visible de cada selector.
//   ABRIR="texto"  → pulsa antes el primer botón/summary/enlace visible con ese texto exacto (p. ej. un «⋯»).
export default async (s) => {
  const p = s.page;
  if (process.env.ABRIR) {
    const re = new RegExp('^\\s*' + process.env.ABRIR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$');
    const b = p.locator('button:visible, summary:visible, a:visible').filter({ hasText: re }).first();
    s.nota(`ABRIR «${process.env.ABRIR}»: ${await b.count()} candidato(s)`);
    await b.click(); await p.waitForTimeout(900);
  }
  await s.mide(process.env.SUB || '');
  if (process.env.BUSCAR) {
    for (const q of process.env.BUSCAR.split('||')) {
      const r = await p.evaluate((t) => {
        const n = (h) => h.split(t).length - 1;
        // `innerHTML` NO lleva el `.value` de un textarea rellenado por JS: sin mirar los campos, la nota del
        // admin daba dom=0 y el cero del operario no probaba nada (control positivo, 16-nov).
        const campos = [...document.querySelectorAll('textarea, input')].map((e) => e.value || '').join('\n');
        return { texto: n(document.body.innerText), dom: n(document.documentElement.innerHTML), campos: n(campos) };
      }, q);
      s.nota(`BUSCAR «${q.slice(0, 40)}»: texto=${r.texto} · dom=${r.dom} · campos=${r.campos}`);
    }
  }
  if (process.env.CAJAS) {
    for (const sel of process.env.CAJAS.split('||')) {
      const r = await p.evaluate((q) => {
        const W = document.documentElement.clientWidth;
        const el = [...document.querySelectorAll(q)].find((e) => e.getBoundingClientRect().width > 0);
        if (!el) return null;
        const b = el.getBoundingClientRect(); const cs = getComputedStyle(el);
        return `x=${Math.round(b.x)} ancho=${Math.round(b.width)} alto=${Math.round(b.height)} margen-izq=${Math.round(b.x)} margen-dcha=${Math.round(W - b.right)} · fuente=${cs.fontSize}/${cs.fontWeight} · white-space=${cs.whiteSpace} · scrollW=${el.scrollWidth} clientW=${el.clientWidth} · n=${document.querySelectorAll(q).length}`;
      }, sel);
      s.nota(`CAJA ${sel}: ${r || 'NO ESTÁ (0 visibles)'}`);
    }
  }
  await s.mide((process.env.SUB || '') + 'fin'); // segunda escritura: lleva las NOTAS
};
