// Tramo 6.2/6.3 (17-nov) · SÓLO MIRA: la tarjeta del trabajo desechable en la lista (por su marca) y sus botones.
// 17-nov: la tarjeta NO pinta la tarea (con la marca de la tarea salió CIEGO, 0 elementos). Se busca por la dirección,
// que sólo lleva este trabajo. MARCA_LISTA la cambia.
const MARCA = process.env.MARCA_LISTA || 'Calle de la Prueba 14';
export default async (s) => {
  const p = s.page;
  const r = await p.evaluate((marca) => {
    const vis = (e) => { const b = e.getBoundingClientRect(); const c = getComputedStyle(e); return b.width > 0 && b.height > 0 && c.visibility !== 'hidden' && c.display !== 'none'; };
    const con = [...document.querySelectorAll('#view-container *, .view-container *')].filter((e) => vis(e) && e.innerText && e.innerText.includes(marca));
    if (!con.length) return { hay: 0 };
    // La tarjeta: el antepasado más pequeño que contiene la marca Y algún botón.
    let t = con[con.length - 1];
    while (t && !t.querySelector('button')) t = t.parentElement;
    const grupos = [...document.querySelectorAll('h2, h3, .jobs-grupo-titulo, [class*="grupo"] > header')].filter(vis).map((e) => e.innerText.trim().replace(/\s+/g, ' ').slice(0, 40));
    return {
      hay: con.length, clase: t ? String(t.className).slice(0, 80) : null,
      texto: t ? t.innerText.replace(/\s+/g, ' ').slice(0, 300) : null,
      bot: t ? [...t.querySelectorAll('button')].filter(vis).map((e) => `${/btn-primary/.test(e.className) ? 'PRIMARIA' : /btn-secondary/.test(e.className) ? 'secundaria' : 'otro'} «${(e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 40)}» ${Math.round(e.getBoundingClientRect().height)}px`) : [],
      grupos,
    };
  }, MARCA);
  s.nota(`elementos con la marca: ${r.hay}`);
  if (!r.hay) throw new Error('CIEGO: la tarjeta del trabajo no está en la lista');
  s.nota(`tarjeta .${r.clase} · «${r.texto}»`);
  s.nota(`botones de la tarjeta (${r.bot.length}): ${r.bot.join(' ; ')}`);
  s.nota(`cabeceras a la vista: ${r.grupos.join(' | ')}`);
  await s.mide('lista');
};
