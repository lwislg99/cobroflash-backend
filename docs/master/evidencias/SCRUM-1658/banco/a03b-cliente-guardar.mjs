// Cliente de prueba SIN teléfono ni correo: nada se le puede enviar.
export default async (s) => {
  const p = s.page;
  await p.getByRole('button', { name: /Nuevo cliente|Añadir cliente|\+ Cliente/i }).first().click();
  await p.waitForTimeout(800);
  await p.locator('#forma-juridica-1-persona').check().catch(() => {});
  await p.locator('input[name=name]:visible').fill('Marta Prieto (PILOTO-1 QA)');
  await p.locator('input[name=billingAddress]:visible').fill('Calle Mayor 14, 3º B');
  await p.locator('input[name=billingCity]:visible').fill('Alcalá de Henares');
  await p.locator('input[name=billingPostalCode]:visible').fill('28801');
  await p.locator('input[name=billingProvince]:visible').fill('Madrid');
  await s.mide('relleno');
  const guardar = p.getByRole('button', { name: /^(Guardar|Crear cliente|Guardar cliente|Añadir)/i }).last();
  s.nota('botón guardar: ' + (await guardar.innerText()));
  await guardar.click();
  await p.waitForTimeout(1500);
  await s.mide('guardado');
};
