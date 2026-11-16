export default async (s) => {
  const p = s.page;
  await p.getByRole('button', { name: /^Parte de trabajo$/ }).first().click();
  await p.waitForTimeout(2500);
  s.nota('URL tras pulsar: ' + p.url());
  await s.mide('abierto');
  const campos = await p.evaluate(() => [...document.querySelectorAll('input, select, textarea')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.x >= 0; }).map(e => `${e.id}|${e.name}|${e.type}|${e.labels && e.labels[0] ? e.labels[0].innerText.replace(/\s+/g, ' ') : ''}|${e.placeholder || ''}`));
  s.nota('campos: ' + campos.join(' ; '));
};
