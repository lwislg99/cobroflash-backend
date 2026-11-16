// Partiendo del parte #13 ya con horas: re-dicta (la propuesta no persiste al recargar?) y añade.
export default async (s) => {
  const p = s.page;
  s.nota('al recargar, dictado conserva: «' + (await p.locator('#parte-dictado').inputValue()).slice(0, 60) + '»');
  s.nota('al recargar, propuesta visible: ' + (await p.getByRole('button', { name: /Añadir al parte/ }).count()));
  s.nota('al recargar, entrada: ' + (await p.locator('input[type=time]').nth(0).inputValue()) + ' desplazamiento: ' + (await p.locator('input[type=number]').nth(0).inputValue()));
  if (!(await p.getByRole('button', { name: /Añadir al parte/ }).count())) {
    await p.locator('#parte-dictado').fill('He cambiado los dos latiguillos del lavabo y la llave de escuadra, y he revisado el sifón que goteaba. Dos horas y media de trabajo yo solo. He puesto dos latiguillos de 40 centímetros, una llave de escuadra de media pulgada y un rollo de teflón.');
    await p.getByRole('button', { name: /Ordenar en líneas/ }).click();
    await p.getByRole('button', { name: /Añadir al parte/ }).waitFor({ timeout: 40000 });
  }
  // cantidades vacías de la propuesta: se rellenan en orden
  const vacias = p.locator('input[type=number]:visible, input[inputmode=decimal]:visible');
  const total = await vacias.count();
  const vals = [];
  for (let i = 0; i < total; i++) vals.push(await vacias.nth(i).inputValue());
  s.nota('numéricos visibles: ' + total + ' valores: ' + vals.join('|'));
  // los dos primeros numéricos son desplazamiento y km; el resto, las cantidades de la propuesta
  const relleno = ['1', '1', '2.5', null, '1', '1'];
  for (let i = 2, k = 0; i < total; i++, k++) {
    const v = await vacias.nth(i).inputValue();
    if (!v && relleno[k]) { await vacias.nth(i).fill(relleno[k]); }
  }
  await s.mide('cantidades');
  await p.getByRole('button', { name: /Añadir al parte/ }).click();
  await p.waitForTimeout(2500);
  await s.mide('anadido');
};
