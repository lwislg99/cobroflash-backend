// Trabajo #79 (cliente 86 SIN teléfono ni correo: «Enviar para firmar» no puede salir, el servidor da 409).
const textoMenu = (p) => p.evaluate(() => [...document.querySelectorAll('button, a')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.x >= 0 && e.closest('[role=menu], .menu, .dropdown, .popover, .acciones-menu, .more-menu, .sheet'); }).map(e => e.innerText.trim()).join(' | '));
export default async (s) => {
  const p = s.page;
  const env = p.getByRole('button', { name: /^Enviar para firmar$/ }).first();
  await env.click();
  await p.waitForTimeout(1500);
  await s.mide('enviar-sin-telefono');
  const toast = await p.evaluate(() => [...document.querySelectorAll('.toast, [role=status], [role=alert], .alert')].filter(e => e.getBoundingClientRect().width > 0).map(e => e.innerText.trim()).join(' || '));
  s.nota('aviso tras Enviar sin teléfono: «' + toast + '»');
  const mas = p.locator('button:visible', { hasText: '⋯' }).first();
  s.nota('hay ⋯ en la ficha: ' + (await mas.count()));
  if (await mas.count()) {
    await mas.click(); await p.waitForTimeout(600);
    await s.mide('menu');
    s.nota('menú ⋯: ' + (await textoMenu(p)));
  }
  const term = p.getByRole('button', { name: /Terminar|Marcar como terminado|Dar por terminado/ }).first();
  if (await term.count()) {
    s.nota('terminar: «' + (await term.innerText()).trim() + '»');
    await term.click(); await p.waitForTimeout(1200);
    await s.mide('terminar');
    const m = p.locator('.modal-overlay:visible');
    if (await m.count()) { s.nota('modal terminar: ' + (await m.innerText()).replace(/\s+/g, ' ').slice(0, 500)); }
  }
};
