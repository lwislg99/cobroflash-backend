// Invitación a un buzón del propio fundador (alias +operario1): no sale a nadie de fuera.
export default async (s) => {
  const p = s.page;
  await p.getByRole('button', { name: /Añadir miembro/i }).first().click();
  await p.waitForTimeout(700);
  await p.locator('input[name=name]:visible').fill('Jorge Operario (QA)');
  await p.locator('input[name=email]:visible').fill(process.env.CORREO_OPERARIO_QA /* buzón propio del fundador; no se sube */);
  await p.locator('select[name=role]:visible').selectOption('tecnico');
  await p.getByRole('button', { name: /Enviar invitación/ }).click();
  await p.waitForTimeout(2500);
  await s.mide('enviada');
};
