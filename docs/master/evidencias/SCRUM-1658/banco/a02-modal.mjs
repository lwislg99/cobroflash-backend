export default async (s) => {
  const p = s.page;
  await p.getByRole('button', { name: /Nuevo trabajo/ }).first().click();
  await p.waitForTimeout(800);
  await s.mide('abierto');
};
