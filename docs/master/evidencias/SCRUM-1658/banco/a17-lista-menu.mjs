// En la lista: el «⋯» de la fila del trabajo #79. ACCION=terminar|cerrar|ninguna
export default async (s) => {
  const p = s.page;
  const fila = p.locator('.view-container :is(tr, .job-card, .jobs-fila, li, article, div)', { hasText: 'Marta Prieto (PILOTO-1 QA)' }).filter({ has: p.locator('button', { hasText: '⋯' }) }).last();
  await fila.scrollIntoViewIfNeeded();
  await fila.locator('button', { hasText: '⋯' }).first().click();
  await p.waitForTimeout(700);
  await s.mide('menu');
  const ops = await p.evaluate(() => [...document.querySelectorAll('button, a')].filter(e => { const b = e.getBoundingClientRect(); const z = getComputedStyle(e).zIndex; return b.width > 0 && b.x >= 0 && e.closest('[role=menu], .menu, .dropdown, .popover, .jobs-menu, .menu-acciones, .sheet, .action-sheet'); }).map(e => e.innerText.trim()));
  s.nota('opciones ⋯: ' + ops.join(' | '));
  const acc = process.env.ACCION || 'ninguna';
  if (acc === 'ninguna') return;
  const re = acc === 'terminar' ? /Terminar|terminado/i : /Cerrar/i;
  const b = p.locator('button:visible, a:visible, [role=menuitem]:visible').filter({ hasText: re }).last();
  s.nota('pulso: «' + (await b.innerText()).trim() + '»');
  await b.click(); await p.waitForTimeout(1200);
  await s.mide(acc);
  const m = p.locator('.modal-overlay:visible');
  if (await m.count()) {
    s.nota('modal: ' + (await m.innerText()).replace(/\s+/g, ' ').slice(0, 500));
    const ok = m.locator('button').filter({ hasText: /^Cerrar trabajo$|^Confirmar$|^Marcar/ }).last();
    s.nota('confirmo con «' + (await ok.innerText()).trim() + '»');
    await ok.click(); await p.waitForTimeout(2000);
    await s.mide(acc + '-hecho');
  }
};
