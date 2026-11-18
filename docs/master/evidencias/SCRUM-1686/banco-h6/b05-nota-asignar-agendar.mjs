// Tramo 1.4-1.5 · ADMIN, en la ficha de T: escribe una NOTA interna, lo asigna a «Operario QA» y lo agenda para HOY.
// PASO=nota|asignar|agendar (uno por pasada: si uno falla, los otros no se pierden). Cada paso apunta lo que la
// pantalla ofrece ANTES de tocar, para no suponer el DOM.
const visibles = (p, sel) => p.evaluate((q) => [...document.querySelectorAll(q)].filter((e) => e.getBoundingClientRect().width > 0)
  .map((e) => `${e.tagName.toLowerCase()}#${e.id}.${String(e.className).slice(0, 40)}|${(e.innerText || e.value || '').replace(/\s+/g, ' ').slice(0, 70)}`), sel);
export const NOTA = 'NOTA-PRIVADA-QA (prueba H6 16-nov): el cliente paga tarde, no fiar.';
export default async (s) => {
  const p = s.page; const paso = process.env.PASO;
  if (paso === 'nota') {
    await p.locator('summary:visible, button:visible').filter({ hasText: /Notas internas/ }).first().click();
    await p.waitForTimeout(600);
    s.nota('textareas visibles: ' + (await visibles(p, 'textarea')).join(' ; '));
    const ta = p.locator('textarea:visible').last();
    const resp = p.waitForResponse((r) => /\/admin\/jobs\/\d+$/.test(r.url()) && r.request().method() === 'PATCH', { timeout: 15000 });
    await ta.fill(NOTA);
    await ta.blur();
    const r = await resp;
    s.nota(`PATCH {notes} → ${r.status()}`);
    await p.waitForTimeout(800);
    await s.mide('nota');
  } else if (paso === 'asignar') {
    await p.locator('summary:visible, button:visible').filter({ hasText: /Quién lo ejecuta/ }).first().click();
    await p.waitForTimeout(700);
    s.nota('selects visibles: ' + (await visibles(p, 'select')).join(' ; '));
    s.nota('botones dentro del plegable abierto: ' + (await visibles(p, 'details[open] button, details[open] label, details[open] input')).join(' ; ').slice(0, 900));
    await s.mide('quien-abierto');
    const sel = p.locator('details[open] select:visible').first();
    const resp = p.waitForResponse((r) => /\/admin\/jobs\/\d+/.test(r.url()) && r.request().method() !== 'GET', { timeout: 15000 });
    if (await sel.count()) await sel.selectOption({ label: 'Operario QA' });
    else await p.locator('details[open] :is(label, button, li, [role=option]):visible').filter({ hasText: /^\s*Operario QA\s*$/ }).first().click();
    const r = await resp;
    s.nota(`${r.request().method()} ${new URL(r.url()).pathname} → ${r.status()} · cuerpo enviado: ${(r.request().postData() || '').slice(0, 120)}`);
    await p.waitForTimeout(1200);
    await s.mide('asignado');
  } else if (paso === 'agendar') {
    await p.getByRole('button', { name: /^Agendar$/ }).first().click();
    await p.waitForTimeout(900);
    s.nota('campos: ' + (await visibles(p, '.modal-overlay input, .modal-overlay select, .modal-overlay textarea')).join(' ; '));
    await s.mide('modal');
    const hoy = process.env.FECHA; // AAAA-MM-DD, la da quien lanza (hora de GitHub, no el reloj local)
    const dt = p.locator('.modal-overlay input[type=datetime-local]:visible').first();
    if (await dt.count()) await dt.fill(`${hoy}T18:30`);
    else { await p.locator('.modal-overlay input[type=date]:visible').first().fill(hoy); const h = p.locator('.modal-overlay input[type=time]:visible').first(); if (await h.count()) await h.fill('18:30'); }
    const ok = p.locator('.modal-overlay button.btn-primary:visible').last();
    s.nota('botón: ' + (await ok.innerText()));
    const resp = p.waitForResponse((r) => /\/admin\/jobs\/\d+/.test(r.url()) && r.request().method() !== 'GET', { timeout: 15000 });
    await ok.click();
    const r = await resp;
    s.nota(`${r.request().method()} ${new URL(r.url()).pathname} → ${r.status()} · cuerpo enviado: ${(r.request().postData() || '').slice(0, 160)}`);
    await p.waitForTimeout(1500);
    await s.mide('agendado');
  }
};
