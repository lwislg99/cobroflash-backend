// Avanza el trabajo por su acción principal, midiendo cada estado. Para en «Cerrar» (irreversible) y lo pide aparte.
export default async (s) => {
  const p = s.page;
  for (let paso = 0; paso < 4; paso++) {
    const estado = await p.evaluate(() => { const e = document.querySelector('.detail-card .badge, .badge, .pill'); return e ? e.innerText.trim() : '?'; });
    const prim = p.locator('.view-container button.btn-primary:visible').first();
    const txt = (await prim.count()) ? (await prim.innerText()).trim() : '(sin primaria)';
    s.nota(`paso ${paso}: estado «${estado}» · primaria «${txt}»`);
    await s.mide('estado' + paso);
    if (!(await prim.count()) || /cerrar/i.test(txt)) break;
    await prim.click();
    await p.waitForTimeout(1200);
    const modal = p.locator('.modal-overlay:visible');
    if (await modal.count()) {
      await s.mide('modal' + paso);
      s.nota('modal: ' + (await modal.innerText()).replace(/\s+/g, ' ').slice(0, 400));
      const ok = modal.locator('button.btn-primary').last();
      if (await ok.count()) { s.nota('confirmo modal con «' + (await ok.innerText()).trim() + '»'); await ok.click(); await p.waitForTimeout(1800); }
      else break;
    }
    await p.waitForTimeout(800);
  }
  // el menú ⋯ de la ficha
  const mas = p.locator('.view-container button:visible', { hasText: '⋯' }).first();
  if (await mas.count()) { await mas.click(); await p.waitForTimeout(600); await s.mide('menu'); s.nota('menú ⋯: ' + (await p.evaluate(() => [...document.querySelectorAll('[role=menu] button, .menu button, .dropdown button, .popover button')].filter(e => e.getBoundingClientRect().width > 0).map(e => e.innerText.trim()).join(' | ')))); }
};
