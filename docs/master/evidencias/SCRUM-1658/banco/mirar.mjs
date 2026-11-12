// node mirar.mjs <hash> <nombre> [anchos=390,1280]  — sólo navega y mide (GET).
import { abrir, ir, foto, inventario, desbordes, pequenos, guardar } from './lib.mjs';
const [hash, nombre, anchosArg = '390,1280'] = process.argv.slice(2);
for (const w of anchosArg.split(',').map(Number)) {
  const s = await abrir(w, w < 600 ? 844 : 800);
  await ir(s.page, hash);
  await foto(s, nombre);
  const inv = await inventario(s.page, '.view-container, main, #app');
  const des = await desbordes(s.page);
  const peq = await pequenos(s.page);
  const texto = await s.page.evaluate(() => (document.querySelector('.view-container, main') || document.body).innerText.slice(0, 4000));
  guardar(`${nombre}-${w}.txt`, [`URL ${s.page.url()}`, '--- TEXTO', texto, '--- PULSABLES', ...inv, '--- DESBORDES', ...des, '--- <44px', ...peq, '--- LOG', ...s.log].join('\n'));
  console.log(`${w}: ${inv.length} pulsables · ${des.length} desbordes · ${peq.length} <44 · ${s.log.length} log`);
  await s.browser.close();
}
