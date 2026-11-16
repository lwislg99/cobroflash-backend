// Mide el relleno interior del modal de Agendar (jobs-modal) frente al de Trabajo nuevo (modal-body). Sólo abre y cierra: no guarda.
export default async (s) => {
  const p = s.page;
  const fila = p.locator('.view-container :is(tr, li, article, div)', { hasText: 'Trabajo de pruebas QA' }).filter({ has: p.getByRole('button', { name: /^Agendar$/ }) }).last();
  await fila.getByRole('button', { name: /^Agendar$/ }).click();
  await p.waitForTimeout(700);
  const med = await p.evaluate(() => {
    const m = document.querySelector('.modal-overlay .modal'); const t = m.querySelector('.jobs-modal-titulo') || m.firstElementChild;
    const bm = m.getBoundingClientRect(), bt = t.getBoundingClientRect(); const cs = getComputedStyle(m);
    return `modal ${Math.round(bm.width)}px padding «${cs.padding}» · título a ${Math.round(bt.x - bm.x)}px del borde`;
  });
  s.nota('Agendar: ' + med);
  await s.mide('agendar');
  await p.keyboard.press('Escape');
  await p.locator('.modal-overlay button', { hasText: 'Cancelar' }).click().catch(() => {});
  await p.waitForTimeout(400);
  await p.getByRole('button', { name: /Nuevo trabajo/ }).first().click();
  await p.waitForTimeout(700);
  const med2 = await p.evaluate(() => {
    const m = document.querySelector('.modal-overlay .modal'); const t = m.querySelector('label');
    const bm = m.getBoundingClientRect(), bt = t.getBoundingClientRect();
    return `modal ${Math.round(bm.width)}px · primera etiqueta a ${Math.round(bt.x - bm.x)}px del borde`;
  });
  s.nota('Trabajo nuevo: ' + med2);
};
