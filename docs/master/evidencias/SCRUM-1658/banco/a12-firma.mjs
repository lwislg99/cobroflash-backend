// node paso.mjs 390 "#parte-detail/13" 12-firma-tecnico a12-firma.mjs   (FIRMA=tecnico|cliente, HACER=1 para firmar)
async function trazo(p, canvas) {
  const b = await canvas.boundingBox();
  const y0 = b.y + b.height * 0.6;
  await p.mouse.move(b.x + b.width * 0.15, y0);
  await p.mouse.down();
  for (let i = 0; i <= 24; i++) {
    const x = b.x + b.width * (0.15 + 0.7 * i / 24);
    const y = y0 - Math.sin(i / 3) * b.height * 0.25;
    await p.mouse.move(x, y, { steps: 2 });
  }
  await p.mouse.up();
}
export default async (s) => {
  const p = s.page;
  const cual = process.env.FIRMA || 'tecnico';
  const boton = cual === 'tecnico' ? p.getByRole('button', { name: /^Firma del técnico$/ }) : p.getByRole('button', { name: /^Firmar aquí mismo$/ });
  await boton.first().click();
  await p.waitForTimeout(900);
  await s.mide('abierta');
  const campos = await p.evaluate(() => [...document.querySelectorAll('.modal-overlay input, .modal-overlay select, .modal-overlay textarea, .modal-overlay canvas, dialog input, dialog canvas')].filter(e => e.getBoundingClientRect().width > 0).map(e => `${e.tagName}|${e.id}|${e.type || ''}|${e.labels && e.labels[0] ? e.labels[0].innerText.replace(/\s+/g, ' ') : ''}|${e.placeholder || ''}|${e.tagName === 'SELECT' ? [...e.options].map(o => o.text).join('/') : ''}|${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`));
  s.nota('campos: ' + campos.join(' ; '));
  const botones = await p.evaluate(() => [...document.querySelectorAll('.modal-overlay button, dialog button')].filter(e => e.getBoundingClientRect().width > 0).map(e => `«${e.innerText.trim()}»${e.disabled ? ' DISABLED' : ''}`));
  s.nota('botones: ' + botones.join(' '));
  if (process.env.HACER !== '1') return;
  const nombre = p.getByLabel('Nombre de quien firma');
  if (await nombre.count() && !(await nombre.inputValue())) await nombre.fill(cual === 'tecnico' ? 'Jorge Operario (QA)' : 'Marta Prieto (PILOTO-1 QA)');
  if (cual === 'cliente') await p.getByLabel('El propio cliente').check();
  const canvas = p.locator('canvas:visible').last();
  await canvas.scrollIntoViewIfNeeded();
  s.nota('Confirmar antes del trazo, disabled=' + (await p.getByRole('button', { name: 'Confirmar firma' }).isDisabled()));
  await trazo(p, canvas);
  await p.waitForTimeout(400);
  await s.mide('trazada');
  const ok = p.getByRole('button', { name: 'Confirmar firma' });
  s.nota('confirmo con: «' + (await ok.innerText()) + '» disabled=' + (await ok.isDisabled()));
  await ok.click();
  await p.waitForTimeout(2500);
  await s.mide('firmada');
};
