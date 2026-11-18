// Tramo 6.2 (17-nov) · desde la ficha del trabajo EN CURSO, la primaria «+ Nuevo albarán»: una línea de prueba, SIN precios,
// y «Crear albarán». Queda en BORRADOR (no se emite aquí). Sólo corre si la primaria de la ficha es la esperada.
export default async (s) => {
  const p = s.page;
  const prim = p.locator('.view-container button.btn-primary:visible').first();
  const txt = (await prim.count()) ? (await prim.innerText()).trim() : '';
  if (txt !== '+ Nuevo albarán') throw new Error(`la primaria es «${txt}», no «+ Nuevo albarán»`);
  await prim.click();
  await p.waitForTimeout(1200);
  const modal = p.locator('.modal-overlay:visible').first();
  // 17-nov: `input[type=text]` primero NO es el concepto (cayó en «Lugar de entrega» y el servidor dio 400). Por su placeholder.
  await modal.getByPlaceholder('Concepto').first().fill('(prueba) Revisión de la caldera');
  await modal.locator('input[type=number]').first().fill('1');
  s.nota('concepto escrito: «' + (await modal.getByPlaceholder('Concepto').first().inputValue()) + '»');
  await s.mide('hoja-rellena');
  const resp = p.waitForResponse((r) => /\/albaranes$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST', { timeout: 15000 });
  await modal.locator('button.btn-primary', { hasText: 'Crear albarán' }).click();
  const r = await resp;
  let j = null; try { j = await r.json(); } catch { /* no es JSON */ }
  const a = j && (j.albaran || j);
  s.nota(`POST /admin/albaranes → ${r.status()} · id=${a && a.id} · número=${a && (a.numero || a.number)} · estado=${a && (a.estado || a.status)}`);
  await p.waitForTimeout(2500);
  s.nota('tras crear, URL: ' + p.url());
  await s.mide('creado');
};
