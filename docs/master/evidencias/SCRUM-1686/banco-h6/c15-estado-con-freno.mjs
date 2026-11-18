// Tramo 6.2 (17-nov) · UN estado por pasada. Variante de `a15-estados.mjs` (banco de SCRUM-1658) CON FRENO:
//   · mide la ficha del trabajo: estado, primaria y todos los botones a la vista;
//   · sólo pulsa si PULSAR=<rótulo exacto> coincide con la primaria que HAY; si no coincide, NO pulsa y lo dice;
//   · nunca pulsa lo que sale de la cuenta o no tiene vuelta: cerrar, facturar, cobrar, enviar, borrar, anular.
// Sin PULSAR sólo mira.
const FRENO = /cerrar|factur|cobr|enviar|whatsapp|pagar|borrar|eliminar|anular/i;
export default async (s) => {
  const p = s.page;
  const foto = async () => p.evaluate(() => {
    const raiz = document.querySelector('#view-container, .view-container, main') || document.body;
    const vis = (e) => { const b = e.getBoundingClientRect(); const c = getComputedStyle(e); return b.width > 0 && b.height > 0 && c.visibility !== 'hidden' && c.display !== 'none'; };
    const bot = [...raiz.querySelectorAll('button, a.btn-primary, a.btn-secondary')].filter(vis)
      .map((e) => `${/btn-primary/.test(e.className) ? 'PRIMARIA' : /btn-secondary/.test(e.className) ? 'secundaria' : 'otro'} «${(e.innerText || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40)}» ${Math.round(e.getBoundingClientRect().height)}px${e.disabled ? ' APAGADO' : ''}`);
    const estado = [...raiz.querySelectorAll('.badge, .pill, [class*="estado"], [class*="status"]')].filter(vis).map((e) => e.innerText.trim()).filter(Boolean).slice(0, 4);
    return { estado, bot };
  });
  const antes = await foto();
  const primarias = antes.bot.filter((b) => b.startsWith('PRIMARIA'));
  s.nota(`estado(s) a la vista: ${antes.estado.join(' | ') || '(ninguno)'}`);
  s.nota(`primarias (${primarias.length}): ${primarias.join(' ; ') || '(sin primaria)'}`);
  s.nota(`botones (${antes.bot.length}): ${antes.bot.join(' ; ')}`);
  await s.mide('ficha');
  const pedir = process.env.PULSAR || '';
  if (!pedir) { s.nota('sin PULSAR: sólo se ha mirado'); return; }
  if (FRENO.test(pedir)) { s.nota(`FRENO: «${pedir}» no se pulsa en este banco`); return; }
  // NO_PRIMARIA=1: el botón pedido es una secundaria (p. ej. «✅ Marcar terminado»); se busca por su rótulo EXACTO.
  const prim = process.env.NO_PRIMARIA === '1'
    ? p.locator('.view-container button:visible').filter({ hasText: new RegExp('^\\s*' + pedir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$') }).first()
    : p.locator('.view-container button.btn-primary:visible').first();
  const txt = (await prim.count()) ? (await prim.innerText()).trim() : '';
  if (txt !== pedir) { s.nota(`NO PULSO: la primaria es «${txt}» y se pidió «${pedir}»`); throw new Error('la primaria no es la pedida'); }
  await prim.click();
  await p.waitForTimeout(1500);
  const modal = p.locator('.modal-overlay:visible');
  if (await modal.count()) {
    await s.mide('modal');
    s.nota('modal: ' + (await modal.first().innerText()).replace(/\s+/g, ' ').slice(0, 500));
    const campos = await p.evaluate(() => [...document.querySelectorAll('.modal-overlay input, .modal-overlay select, .modal-overlay textarea')]
      .filter((e) => e.getBoundingClientRect().width > 0).map((e) => `${e.id}|${e.tagName.toLowerCase()}|${e.type || ''}|valor=${String(e.value).slice(0, 30)}`));
    s.nota('campos del modal: ' + (campos.join(' ; ') || '(ninguno)'));
    const ok = modal.first().locator('button.btn-primary').last();
    const okTxt = (await ok.count()) ? (await ok.innerText()).trim() : '';
    if (!okTxt) { s.nota('el modal no tiene primaria: no confirmo'); return; }
    if (FRENO.test(okTxt) || process.env.CONFIRMAR !== okTxt) { s.nota(`NO CONFIRMO el modal: su primaria es «${okTxt}» y CONFIRMAR=«${process.env.CONFIRMAR || ''}»`); return; }
    await ok.click();
    await p.waitForTimeout(2200);
    s.nota('confirmado el modal con «' + okTxt + '»');
  }
  await p.waitForTimeout(900);
  const despues = await foto();
  s.nota(`DESPUÉS · estado(s): ${despues.estado.join(' | ') || '(ninguno)'} · primarias: ${despues.bot.filter((b) => b.startsWith('PRIMARIA')).join(' ; ') || '(sin primaria)'} · URL ${p.url()}`);
  await s.mide('despues');
};
