// Tramo 4 · firmas del parte con los rótulos de HOY («Firma aquí, técnico» / «Firma aquí, cliente»; el banco de
// SCRUM-1658 buscaba «Firma del técnico» / «Firmar aquí mismo»). FIRMA=tecnico|cliente · HACER=1 para firmar.
// Sin HACER sólo abre, apunta campos y botones, y deja dicho si «Confirmar» está apagado antes del trazo.
// No pulsa «Enviar para firmar» ni nada que salga por WhatsApp o correo.
async function trazo(p, canvas) {
  const b = await canvas.boundingBox();
  const y0 = b.y + b.height * 0.6;
  await p.mouse.move(b.x + b.width * 0.15, y0);
  await p.mouse.down();
  for (let i = 0; i <= 24; i++) await p.mouse.move(b.x + b.width * (0.15 + 0.7 * i / 24), y0 - Math.sin(i / 3) * b.height * 0.25, { steps: 2 });
  await p.mouse.up();
}
const editables = (p) => p.evaluate(() => {
  const v = [...document.querySelectorAll('input, textarea, select')].filter((e) => e.getBoundingClientRect().width > 0 || e.closest('details'));
  return `campos=${v.length} · editables=${v.filter((e) => !e.disabled && !e.readOnly).length} · botones: ${[...document.querySelectorAll('main button, .view-container button')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => `«${e.innerText.trim().replace(/\s+/g, ' ').slice(0, 40)}»${e.disabled ? ' DISABLED' : ''}`).join(' ')}`;
});
export default async (s, h) => {
  const p = s.page; const cual = process.env.FIRMA || 'tecnico';
  const vistas = [];
  p.on('response', async (r) => {
    const q = r.request(); if (q.method() === 'GET' || !/\/admin\//.test(r.url())) return;
    const cuerpo = (q.postData() || '').replace(/"(firma|imagen|png|dataUrl|signature)[^"]*":"[^"]{40,}"/gi, '"$1":"<trazo>"').slice(0, 200);
    vistas.push(`${q.method()} ${new URL(r.url()).pathname} → ${r.status()} · envía ${cuerpo}`);
  });
  s.nota('antes de abrir: ' + await editables(p));
  await p.getByRole('button', { name: cual === 'tecnico' ? /Firma aquí, técnico/ : /Firma aquí, cliente/ }).first().click();
  await p.waitForTimeout(1000);
  const raiz = '.modal-overlay, dialog[open], .sheet, .firma-pad, .parte-firma-pad';
  const campos = await p.evaluate((q) => [...document.querySelectorAll(q)].flatMap((m) => [...m.querySelectorAll('input, select, textarea, canvas')]).filter((e) => e.getBoundingClientRect().width > 0)
    .map((e) => `${e.tagName}|${e.id}|${e.type || ''}|${e.labels && e.labels[0] ? e.labels[0].innerText.replace(/\s+/g, ' ') : ''}|${e.placeholder || ''}|«${e.type === 'radio' || e.type === 'checkbox' ? (e.checked ? '✔' : '·') : (e.value || '')}»|${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`), raiz);
  s.nota('campos del pad: ' + (campos.join(' ; ') || '(mi selector no ve el pad: leer PULSABLES)'));
  const botones = await p.evaluate((q) => [...document.querySelectorAll(q)].flatMap((m) => [...m.querySelectorAll('button')]).filter((e) => e.getBoundingClientRect().width > 0)
    .map((e) => `«${e.innerText.trim()}» ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}${e.disabled ? ' DISABLED' : ''}`), raiz);
  s.nota('botones del pad: ' + botones.join(' '));
  // El pad, medido en la VENTANA (la captura de página entera lo descoloca): ¿cabe?, ¿se desplaza?, ¿se alcanza «Confirmar»?
  const pad = await p.evaluate(() => {
    const c = [...document.querySelectorAll('canvas')].find((e) => e.getBoundingClientRect().width > 0);
    if (!c) return 'NO HAY canvas visible';
    const r = (e) => { const b = e.getBoundingClientRect(); return `${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)} (acaba en y=${Math.round(b.bottom)})`; };
    const cadena = []; let fijo = null; let rueda = null;
    for (let e = c.parentElement; e && e !== document.body; e = e.parentElement) {
      const cs = getComputedStyle(e);
      cadena.push(`${e.tagName.toLowerCase()}.${String(e.className).split(' ').join('.')}`);
      if (!rueda && /auto|scroll/.test(cs.overflowY)) rueda = `${e.tagName.toLowerCase()}.${e.className} overflow-y=${cs.overflowY} scrollH=${e.scrollHeight} clientH=${e.clientHeight}`;
      if (cs.position === 'fixed') { fijo = e; break; }
    }
    const ok = [...document.querySelectorAll('button')].find((b) => /Confirmar firma/.test(b.innerText) && b.getBoundingClientRect().width > 0);
    return `ventana=${innerWidth}x${innerHeight} · canvas ${r(c)} · «Confirmar» ${ok ? r(ok) : 'NO ESTÁ'} · contenedor fijo ${fijo ? r(fijo) : 'NINGUNO'} · se desplaza: ${rueda || 'NADA con overflow-y auto/scroll'} · cadena: ${cadena.join(' < ')}`;
  });
  s.nota('PAD ' + pad);
  await p.screenshot({ path: `${h.OUT}/${process.env.NOMBRE_VENTANA || 'pad'}-${cual}-ventana-${p.viewportSize().width}.png` });
  await s.mide(`firma-${cual}-abierta`);
  if (process.env.HACER !== '1') return;
  const nombre = p.getByLabel(/Nombre de quien firma/);
  if (await nombre.count()) { s.nota(`nombre propuesto: «${await nombre.first().inputValue()}»`); if (!(await nombre.first().inputValue())) await nombre.first().fill(cual === 'tecnico' ? 'Operario QA' : 'Marta Prieto (PILOTO-1 QA)'); }
  const propio = p.getByLabel(/El propio cliente/);
  if (cual === 'cliente' && await propio.count()) await propio.first().check({ force: true });
  const ok = p.getByRole('button', { name: /Confirmar firma/ });
  s.nota('«Confirmar firma» antes del trazo: ' + (await ok.count() ? `disabled=${await ok.first().isDisabled()}` : 'NO HAY botón con ese nombre'));
  const canvas = p.locator('canvas:visible').last();
  await canvas.scrollIntoViewIfNeeded();
  await trazo(p, canvas);
  await p.waitForTimeout(500);
  await s.mide(`firma-${cual}-trazada`);
  s.nota(`confirmo con «${await ok.first().innerText()}» disabled=${await ok.first().isDisabled()}`);
  await ok.first().click();
  await p.waitForTimeout(3000);
  for (const v of vistas) s.nota('ESCRITURA ' + v);
  s.nota('después de firmar: ' + await editables(p));
  s.nota('URL tras firmar: ' + p.url());
  await s.mide(`firma-${cual}-hecha`);
};
