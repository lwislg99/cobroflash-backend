export default async (s) => {
  const p = s.page;
  await p.getByRole('button', { name: /^Agendar$/ }).first().click();
  await p.waitForTimeout(900);
  await s.mide('modal');
  const campos = await p.evaluate(() => [...document.querySelectorAll('.modal-overlay input, .modal-overlay select, .modal-overlay textarea')].filter(e => e.getBoundingClientRect().width > 0).map(e => `${e.id}|${e.type}|${e.value}|${e.labels && e.labels[0] ? e.labels[0].innerText : ''}`));
  s.nota('campos: ' + campos.join(' ; '));
  const fecha = p.locator('.modal-overlay input[type=date]').first();
  const hora = p.locator('.modal-overlay input[type=time]').first();
  const dt = p.locator('.modal-overlay input[type=datetime-local]').first();
  if (await dt.count()) await dt.fill('2026-11-12T09:00');
  else { if (await fecha.count()) await fecha.fill('2026-11-12'); if (await hora.count()) await hora.fill('09:00'); }
  await s.mide('relleno');
  const ok = p.locator('.modal-overlay button.btn-primary').last();
  s.nota('botón: ' + (await ok.innerText()));
  await ok.click();
  await p.waitForTimeout(2000);
  await s.mide('hecho');
};
