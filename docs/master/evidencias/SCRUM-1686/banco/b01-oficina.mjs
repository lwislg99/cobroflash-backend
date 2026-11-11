// SCRUM-1686 · anomalía a · «Partes por valorar»: lista, y la lista con un parte abierto. SOLO navega y pulsa una fila (GET).
// BANCO_OUT=<carpeta> node b01-oficina.mjs
import { abrir, ir, foto, guardar } from '../../SCRUM-1658/banco/lib.mjs';
for (const w of [390, 1280]) {
  const s = await abrir(w, w < 600 ? 844 : 800);
  await ir(s.page, '#partes-oficina');
  await foto(s, 'a-oficina-lista');
  const t0 = await s.page.evaluate(() => document.querySelector('.view-container, main').innerText);
  const fila = s.page.locator('#po-lista > button.customers-card').first();
  let t1 = '(sin filas)';
  if (await fila.count()) {
    await fila.click();
    await s.page.waitForTimeout(1500);
    await foto(s, 'a-oficina-abierto');
    t1 = await s.page.evaluate(() => document.querySelector('.view-container, main').innerText);
  }
  guardar(`a-oficina-${w}.txt`, ['--- LISTA', t0.slice(0, 2500), '--- TRAS PULSAR LA PRIMERA FILA', t1.slice(0, 3000), '--- LOG', ...s.log].join('\n'));
  await s.browser.close();
}
console.log('ok');
