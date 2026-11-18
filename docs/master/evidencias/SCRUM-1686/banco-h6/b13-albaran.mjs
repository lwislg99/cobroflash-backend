// Tramo 5 · el albarán, desde la FICHA del trabajo. PASO=abrir (pulsa «+ Nuevo albarán» y apunta lo que la pantalla
// ofrece, sin crear) | crear (además pulsa el botón CREAR=«rótulo exacto» del modal y apunta dónde aterriza).
// No pulsa «Enviar…», «Emitir» ni nada que salga por WhatsApp o correo.
const volcado = (p) => p.evaluate(() => {
  const m = [...document.querySelectorAll('.modal-overlay, dialog[open]')].filter((e) => e.getBoundingClientRect().width > 0).pop();
  if (!m) return null;
  const vis = (e) => e.getBoundingClientRect().width > 0;
  return {
    texto: m.innerText.replace(/\n{2,}/g, '\n').slice(0, 1500),
    campos: [...m.querySelectorAll('input, select, textarea')].filter(vis).map((e) => `${e.tagName.toLowerCase()}[${e.type || ''}] «${e.labels && e.labels[0] ? e.labels[0].innerText.replace(/\s+/g, ' ').slice(0, 50) : (e.placeholder || e.name || '')}» = «${e.type === 'radio' || e.type === 'checkbox' ? (e.checked ? '✔' : '·') + e.value : (e.tagName === 'SELECT' ? [...e.options].map((o) => (o.selected ? '▶' : '') + o.text).join(' / ').slice(0, 200) : e.value)}» ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`),
    botones: [...m.querySelectorAll('button, a')].filter(vis).map((e) => `«${e.innerText.trim().replace(/\s+/g, ' ')}» ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}${e.disabled ? ' DISABLED' : ''}`),
  };
});
export default async (s) => {
  const p = s.page; const paso = process.env.PASO || 'abrir';
  const vistas = []; const pedidas = [];
  p.on('response', async (r) => {
    const q = r.request(); const ruta = new URL(r.url()).pathname;
    if (!/\/admin\//.test(ruta)) return;
    if (q.method() === 'GET') { pedidas.push(`GET ${ruta}${new URL(r.url()).search} → ${r.status()}`); return; }
    vistas.push(`${q.method()} ${ruta} → ${r.status()} · envía ${(q.postData() || '').slice(0, 300)}`);
  });
  await p.getByRole('button', { name: /^\+ Nuevo albarán$/ }).first().click();
  await p.waitForTimeout(1500);
  const v = await volcado(p);
  s.nota('tras «+ Nuevo albarán»: ' + (v ? 'MODAL' : `sin modal · URL ${p.url()}`));
  if (v) { s.nota('MODAL TEXTO: ' + v.texto.replace(/\n/g, ' ⏎ ')); for (const c of v.campos) s.nota('CAMPO ' + c); s.nota('BOTONES: ' + v.botones.join(' ')); }
  for (const g of pedidas) s.nota('PIDE ' + g);
  await s.mide('nuevo-abierto');
  if (paso !== 'crear') return;
  if (process.env.LINEA) { // LINEA="concepto|cantidad|unidad": la primera línea de la hoja, escrita a mano (el operario no ve precios)
    const [c, n, u] = process.env.LINEA.split('|');
    const m = p.locator('.modal-overlay:visible, dialog[open]').last();
    // por su pista: la «Unidad» no lleva atributo `type` y `input[type=text]` no la ve (16-nov)
    await m.locator('input[placeholder="Concepto"]').first().fill(c);
    await m.locator('input[placeholder="Cant."]').first().fill(n);
    await m.locator('input[placeholder^="Unidad"]').first().fill(u);
    const v1 = await volcado(p); for (const k of v1.campos.slice(0, 6)) s.nota('RELLENO ' + k);
    await s.mide('nuevo-relleno');
  }
  const t0 = Date.now();
  await p.locator('.modal-overlay button:visible, dialog[open] button:visible').filter({ hasText: new RegExp('^\\s*' + process.env.CREAR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$') }).last().click();
  await p.waitForTimeout(3500);
  for (const w of vistas) s.nota('ESCRITURA ' + w);
  s.nota(`aterriza en ${p.url()} a los ~${Math.round((Date.now() - t0) / 100) / 10} s`);
  const v2 = await volcado(p);
  if (v2) s.nota('SIGUE un modal: ' + v2.texto.replace(/\n/g, ' ⏎ ').slice(0, 400) + ' · ' + v2.botones.join(' '));
  await s.mide('creado');
};
