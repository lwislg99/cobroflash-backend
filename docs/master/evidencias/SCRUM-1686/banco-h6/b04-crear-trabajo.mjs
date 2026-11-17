// Tramo 1.2 · ADMIN crea el sujeto «T» en la cuenta QA de producción (dato de prueba, autorizado: se queda,
// nombrado «(prueba)»). La TAREA lleva lo que rompe una pantalla: dos párrafos, un salto de línea y una palabra
// de 60 caracteres sin espacios. Variante de `a04-crear-trabajo.mjs` del banco de SCRUM-1658.
export const PALABRA_LARGA = 'Referenciadelfabricantesinespaciosparaverquenosesaledelatarjeta'.slice(0, 60);
export const TAREA = `(prueba) Recorrido H6 del 16-nov: cambiar el termostato de la caldera y purgar los radiadores del salón.\n\nSegundo párrafo: la llave de paso está en el patio. ${PALABRA_LARGA}`;
export default async (s) => {
  const p = s.page;
  await p.getByRole('button', { name: /Nuevo trabajo/ }).first().click();
  await p.waitForTimeout(900);
  await s.mide('modal');
  const campos = await p.evaluate(() => [...document.querySelectorAll('.modal-overlay input, .modal-overlay select, .modal-overlay textarea')]
    .filter((e) => e.getBoundingClientRect().width > 0)
    .map((e) => `${e.id}|${e.tagName.toLowerCase()}|${e.labels && e.labels[0] ? e.labels[0].innerText.replace(/\s+/g, ' ') : ''}|ph=${e.placeholder || ''}`));
  s.nota('campos del modal: ' + campos.join(' ; '));
  s.nota('tipos: ' + (await p.locator('#tn-tipo option').allInnerTexts()).join(' / '));
  if (process.env.HACER !== '1') return;
  await p.locator('#tn-cliente').selectOption({ label: 'Marta Prieto (PILOTO-1 QA)' });
  await p.waitForTimeout(300);
  await p.locator('#tn-tipo').selectOption({ index: 1 });
  s.nota('tipo elegido: ' + (await p.locator('#tn-tipo').evaluate((e) => e.options[e.selectedIndex].text)));
  await p.locator('#tn-direccion').fill('Calle Mayor 14, 3º B, 28801 Alcalá de Henares');
  await p.locator('#tn-descripcion').fill(TAREA);
  await s.mide('relleno');
  const resp = p.waitForResponse((r) => r.url().endsWith('/admin/jobs') && r.request().method() === 'POST', { timeout: 15000 });
  await p.locator('#tn-crear').click();
  const r = await resp;
  let j = null; try { j = await r.json(); } catch { /* no es JSON */ }
  s.nota(`POST /admin/jobs → ${r.status()} · id=${j && j.id} · queHayQueHacer igual a lo escrito=${j && j.queHayQueHacer === TAREA} · notes=${JSON.stringify(j && j.notes)} · tipoIntervencion en la respuesta=${j && 'tipoIntervencion' in j} · operarioId=${j && j.operarioId}`);
  await p.waitForTimeout(2500);
  s.nota('tras crear, URL: ' + p.url());
  await s.mide('creado');
};
