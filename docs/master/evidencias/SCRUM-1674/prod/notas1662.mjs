// SCRUM-1662 · solo LEE: abre la ficha del trabajo 81 (creado por verificar.mjs) y despliega «Notas internas».
import { abrir, ir, foto } from '../../SCRUM-1658/banco/lib.mjs';
const s = await abrir(390, 844);
try {
  await ir(s.page, '#jobs');
  await s.page.waitForTimeout(1200);
  await s.page.evaluate(() => window.renderAppView('jobs-detail', { jobId: 81 }));
  await s.page.waitForTimeout(2500);
  const linea = s.page.locator('summary, button').filter({ hasText: 'Notas internas' }).first();
  await linea.click();
  await s.page.waitForTimeout(800);
  const r = await s.page.evaluate(() => {
    const campos = [...document.querySelectorAll('textarea, input[type=text]')].map((el) => ({ name: el.name || el.id || '', value: el.value }));
    const conDesc = campos.filter((c) => c.value.includes('SCRUM-1662'));
    return { campos: conDesc, total: campos.length };
  });
  console.log(JSON.stringify(r));
  await linea.scrollIntoViewIfNeeded();
  console.log(await foto(s, 'c1662-notas-desplegadas', false));
} finally { await s.browser.close(); }
