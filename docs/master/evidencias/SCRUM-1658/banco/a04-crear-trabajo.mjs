export default async (s) => {
  const p = s.page;
  await p.getByRole('button', { name: /Nuevo trabajo/ }).first().click();
  await p.waitForTimeout(900);
  const opciones = await p.locator('#tn-cliente option').allInnerTexts();
  s.nota('clientes en el desplegable: ' + opciones.length + ' · primero preseleccionado: ' + opciones[0]);
  s.nota('tipos: ' + (await p.locator('#tn-tipo option').allInnerTexts()).join(' / '));
  await p.locator('#tn-cliente').selectOption({ label: 'Marta Prieto (PILOTO-1 QA)' });
  await p.waitForTimeout(300);
  s.nota('dirección tras elegir cliente (¿se rellena sola?): «' + (await p.locator('#tn-direccion').inputValue()) + '»');
  await p.locator('#tn-tipo').selectOption({ index: 1 });
  await p.locator('#tn-direccion').fill('Calle Mayor 14, 3º B, 28801 Alcalá de Henares');
  await p.locator('#tn-descripcion').fill('Fuga en el baño: cambiar latiguillos y llave de escuadra del lavabo, revisar sifón. Avisa la vecina de abajo de mancha en el techo.');
  await s.mide('relleno');
  await p.locator('#tn-crear').click();
  await p.waitForTimeout(2500);
  s.nota('tras crear, URL: ' + p.url());
  await s.mide('creado');
};
