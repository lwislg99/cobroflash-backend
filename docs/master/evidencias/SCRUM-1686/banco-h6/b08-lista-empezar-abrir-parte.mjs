// Tramo 3.1 · desde la LISTA, en la tarjeta del sujeto (CLIENTE=…): PASO=menu (abre «⋯» y apunta lo que ofrece),
// PASO=empezar («▶ Empezar») o PASO=parte («Abrir parte» → ¿dónde aterriza y con qué nace el parte?).
// Cada escritura se apunta con su código: sale con la cookie de admin y se casa luego con TECNICO_ALLOWED.
const CLIENTE = process.env.CLIENTE || 'Marta Prieto (PILOTO-1 QA)';
const tarjeta = (p, re) => p.locator('tr, article, li, div').filter({ hasText: CLIENTE }).filter({ has: p.locator('button', { hasText: re }) }).last();
export default async (s) => {
  const p = s.page; const paso = process.env.PASO;
  if (paso === 'menu') {
    const t = tarjeta(p, /⋯/);
    await t.scrollIntoViewIfNeeded();
    const antes = await p.evaluate(() => [...document.querySelectorAll('button, a, [role=menuitem]')].filter((e) => e.getBoundingClientRect().width > 0).length);
    await t.locator('button', { hasText: '⋯' }).first().click();
    await p.waitForTimeout(700);
    const ops = await p.evaluate(() => [...document.querySelectorAll('[role=menu] *, .menu-flotante *, .dropdown-menu *, .job-menu *, .popover *, .sheet *')]
      .filter((e) => (e.tagName === 'BUTTON' || e.tagName === 'A') && e.getBoundingClientRect().width > 0)
      .map((e) => `«${e.innerText.trim()}» ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}${e.disabled ? ' DISABLED' : ''}`));
    const despues = await p.evaluate(() => [...document.querySelectorAll('button, a, [role=menuitem]')].filter((e) => e.getBoundingClientRect().width > 0).length);
    s.nota(`«⋯» de ${CLIENTE}: pulsables antes=${antes} después=${despues} · opciones: ${ops.join(' | ') || '(mi selector no las ve: leer PULSABLES)'}`);
    await s.mide('menu');
    return;
  }
  if (paso === 'empezar') {
    const t = tarjeta(p, /Empezar/);
    await t.scrollIntoViewIfNeeded();
    const resp = p.waitForResponse((r) => /\/admin\/jobs\/\d+/.test(r.url()) && r.request().method() !== 'GET', { timeout: 15000 }).catch(() => null);
    await t.locator('button', { hasText: /Empezar/ }).first().click();
    await p.waitForTimeout(800);
    const modal = await p.locator('.modal-overlay:visible').count();
    s.nota('tras «▶ Empezar»: modal visible=' + modal);
    const r = await resp;
    s.nota(r ? `${r.request().method()} ${new URL(r.url()).pathname} → ${r.status()} · cuerpo enviado: ${(r.request().postData() || '').slice(0, 120)}` : 'NINGUNA escritura en 15 s');
    await p.waitForTimeout(1500);
    await s.mide('empezado');
    return;
  }
  if (paso === 'parte') {
    const t = tarjeta(p, /^Abrir parte$/);
    await t.scrollIntoViewIfNeeded();
    const resp = p.waitForResponse((r) => r.url().endsWith('/admin/partes') && r.request().method() === 'POST', { timeout: 15000 }).catch(() => null);
    const t0 = Date.now();
    await t.locator('button', { hasText: /^Abrir parte$/ }).first().click();
    const r = await resp;
    let j = null; try { j = r && await r.json(); } catch { /* no es JSON */ }
    s.nota(r ? `POST /admin/partes → ${r.status()} · cuerpo enviado: ${(r.request().postData() || '').slice(0, 120)} · parte id=${j && (j.id || (j.parte && j.parte.id))} · claves=${j ? Object.keys(j.parte || j).join(',') : ''}` : 'NINGÚN POST /admin/partes en 15 s');
    if (j) { const q = j.parte || j; s.nota(`el parte nace con: obra=${JSON.stringify(q.obra)} · tipo=${JSON.stringify(q.tipo)} · notas=${JSON.stringify(q.notas)} · numero=${JSON.stringify(q.numero)} · estado=${JSON.stringify(q.estado)}`); }
    await p.waitForTimeout(2500);
    s.nota(`aterriza en ${p.url()} a los ~${Math.round((Date.now() - t0) / 100) / 10} s`);
    await s.mide('parte-abierto');
  }
};
