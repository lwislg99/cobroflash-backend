export default async (s) => {
  const p = s.page;
  const b = p.getByRole('button', { name: /Nuevo cliente|Añadir cliente|\+ Cliente/i }).first();
  await b.click();
  await p.waitForTimeout(800);
  await s.mide('form');
  const campos = await p.evaluate(() => [...document.querySelectorAll('.modal input, .modal select, .modal textarea, form input, form textarea')].filter(e => e.getBoundingClientRect().width > 0).map(e => `${e.id}|${e.name}|${e.type}|${(e.labels && e.labels[0] ? e.labels[0].innerText : '')}|${e.placeholder}`));
  console.log(campos.join('\n'));
};
