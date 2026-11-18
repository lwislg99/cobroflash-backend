// Tramo 6.2 (17-nov) · ADMIN crea el trabajo DESECHABLE de los estados de oficina, en la cuenta QA de producción.
// Variante de `b04-crear-trabajo.mjs` (banco H6): otro texto de tarea, para encontrarlo en la lista por su marca.
export const MARCA = '(prueba) Estados de oficina 6.2 del 17-nov';
export default async (s) => {
  const p = s.page;
  await p.getByRole('button', { name: /Nuevo trabajo/ }).first().click();
  await p.waitForTimeout(900);
  await p.locator('#tn-cliente').selectOption({ label: 'Marta Prieto (PILOTO-1 QA)' });
  await p.waitForTimeout(300);
  await p.locator('#tn-tipo').selectOption({ index: 1 });
  await p.locator('#tn-direccion').fill('Calle de la Prueba 14, 2.º B');
  await p.locator('#tn-descripcion').fill(MARCA + ': revisar la caldera. Trabajo desechable, se puede cerrar.');
  const resp = p.waitForResponse((r) => r.url().endsWith('/admin/jobs') && r.request().method() === 'POST', { timeout: 15000 });
  await p.locator('#tn-crear').click();
  const r = await resp;
  let j = null; try { j = await r.json(); } catch { /* no es JSON */ }
  s.nota(`POST /admin/jobs → ${r.status()} · id=${j && j.id} · status=${j && j.status}`);
  await p.waitForTimeout(2500);
  s.nota('tras crear, URL: ' + p.url());
  await s.mide('creado');
};
