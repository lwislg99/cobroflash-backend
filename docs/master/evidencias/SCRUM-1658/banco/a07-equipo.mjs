export default async (s) => {
  const p = s.page;
  await s.mide('vista');
  const b = p.getByRole('button', { name: /Invitar|Añadir|Nuevo miembro|Nuevo operario/i }).first();
  if (await b.count()) {
    s.nota('botón alta: ' + (await b.innerText()));
    await b.click(); await p.waitForTimeout(800);
    await s.mide('form');
    const campos = await p.evaluate(() => [...document.querySelectorAll('input, select, textarea')].filter(e => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().x >= 0).map(e => `${e.id}|${e.name}|${e.type}|${e.labels && e.labels[0] ? e.labels[0].innerText : ''}|${e.tagName === 'SELECT' ? [...e.options].map(o => o.value + '=' + o.text).join('/') : ''}`));
    s.nota('campos: ' + campos.join(' ; '));
  } else s.nota('sin botón de alta visible');
};
