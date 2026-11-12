export default async (s) => {
  const p = s.page;
  const t = p.locator('input[type=time]');
  await t.nth(0).fill('09:10');
  await t.nth(0).blur();
  await p.waitForTimeout(600);
  await t.nth(1).fill('11:40');
  await t.nth(1).blur();
  await p.waitForTimeout(600);
  const n = p.locator('input[type=number]');
  await n.nth(0).fill('20'); await n.nth(0).blur();
  await n.nth(1).fill('12'); await n.nth(1).blur();
  await p.waitForTimeout(800);
  const dict = 'He cambiado los dos latiguillos del lavabo y la llave de escuadra, y he revisado el sifón que goteaba. Dos horas y media de trabajo yo solo. He puesto dos latiguillos de 40 centímetros, una llave de escuadra de media pulgada y un rollo de teflón.';
  await p.locator('#parte-dictado').fill(dict);
  await p.locator('#parte-dictado').blur();
  await p.waitForTimeout(800);
  await s.mide('dictado');
  const t0 = Date.now();
  await p.getByRole('button', { name: /Ordenar en líneas/ }).click();
  // espera a que aparezca algo en las tablas o un aviso
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(500);
    const vacias = await p.getByText('Todavía no has apuntado nada.').count();
    const aviso = await p.locator('.alert:visible, .toast:visible, [role=alert]:visible, [role=status]:visible').count();
    if (vacias < 2 || aviso) break;
  }
  s.nota('Ordenar en líneas tardó ~' + Math.round((Date.now() - t0) / 1000) + ' s');
  await p.waitForTimeout(1000);
  await s.mide('ordenado');
  // vista en el viewport, sin fullPage, de la zona de líneas
  await p.getByText('Mano de obra').first().scrollIntoViewIfNeeded();
  await p.screenshot({ path: process.env.CLAUDE_JOB_DIR + '/tmp/capturas/09-parte-lineas-vista-390.png' });
};
