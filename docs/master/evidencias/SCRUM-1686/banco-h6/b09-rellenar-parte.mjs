// Tramos 3.2-3.5 · rellenar el parte con la pantalla de HOY (la de SCRUM-1722: «Ahora», «Ordenar en líneas»,
// «Añadir línea», plegables de «Datos del parte»). PASO=horas | dictado | anadir | linea | datos | releer.
// Cada escritura se apunta con su código y su cuerpo (recortado): luego se casa A MANO con TECNICO_ALLOWED.
// No pulsa nada que salga por WhatsApp o correo.
const DICTADO = process.env.DICTADO || 'He cambiado los dos latiguillos del lavabo y la llave de escuadra, y he revisado el sifón que goteaba. Dos horas y media de trabajo yo solo. He puesto dos latiguillos de 40 centímetros, una llave de escuadra de media pulgada y un rollo de teflón.';
const vigila = (s) => {
  const vistas = [];
  s.page.on('response', async (r) => {
    const q = r.request();
    if (q.method() === 'GET' || !/\/admin\//.test(r.url())) return;
    vistas.push(`${q.method()} ${new URL(r.url()).pathname} → ${r.status()} · envía ${(q.postData() || '').slice(0, 160)}`);
  });
  return vistas;
};
const campos = (p) => p.evaluate(() => [...document.querySelectorAll('input, textarea, select')]
  .filter((e) => e.getBoundingClientRect().width > 0 || e.closest('details'))
  .map((e) => `${e.tagName.toLowerCase()}[${e.type || ''}]#${e.id || '-'} «${(e.type === 'radio' || e.type === 'checkbox') ? (e.checked ? '✔' : '·') + e.value : e.value}»${e.disabled ? ' DISABLED' : ''}${e.readOnly ? ' READONLY' : ''}`));
export default async (s) => {
  const p = s.page; const paso = process.env.PASO; const vistas = vigila(s);
  const fin = async (sub) => { await p.waitForTimeout(900); for (const v of vistas) s.nota('ESCRITURA ' + v); await s.mide(sub); };
  if (paso === 'horas') {
    const t = p.locator('input[type=time]'); const n = p.locator('input[type=number]');
    s.nota(`antes: entrada=«${await t.nth(0).inputValue()}» salida=«${await t.nth(1).inputValue()}» despl=«${await n.nth(0).inputValue()}» km=«${await n.nth(1).inputValue()}»`);
    // Entrada: escrita en el campo. Salida: con su botón «Ahora» (la pantalla dice «la hora se elige, no se escribe»).
    await t.nth(0).fill(process.env.ENTRADA || '16:05'); await t.nth(0).blur(); await p.waitForTimeout(900);
    await p.getByRole('button', { name: /^Ahora$/ }).nth(1).click(); await p.waitForTimeout(900);
    await n.nth(0).fill('20'); await n.nth(0).blur(); await p.waitForTimeout(700);
    await n.nth(1).fill('12'); await n.nth(1).blur(); await p.waitForTimeout(900);
    s.nota(`después: entrada=«${await t.nth(0).inputValue()}» salida=«${await t.nth(1).inputValue()}» despl=«${await n.nth(0).inputValue()}» km=«${await n.nth(1).inputValue()}»`);
    const rot = await p.evaluate(() => [...document.querySelectorAll('.parte-campo')].map((c) => c.innerText.replace(/\s+/g, ' ').trim()).join(' | '));
    s.nota('rótulos de los campos de horas: ' + rot);
    return fin('horas');
  }
  if (paso === 'dictado') {
    const d = p.locator('textarea:visible').first();
    s.nota(`dictado antes: «${(await d.inputValue()).slice(0, 60)}» · id=${await d.getAttribute('id')} · placeholder=«${await d.getAttribute('placeholder')}»`);
    await d.fill(DICTADO); await d.blur(); await p.waitForTimeout(900);
    await s.mide('dictado');
    const t0 = Date.now();
    await p.getByRole('button', { name: /Ordenar en líneas/ }).click();
    await p.waitForTimeout(400);
    const durante = await p.evaluate(() => [...document.querySelectorAll('button')].filter((b) => /Orden/.test(b.innerText)).map((b) => `«${b.innerText.trim()}»${b.disabled ? ' DISABLED' : ''}`).join(' '));
    s.nota('mientras ordena, el botón dice: ' + durante);
    let salio = 'nada en 45 s';
    for (let i = 0; i < 90; i++) {
      await p.waitForTimeout(500);
      if (await p.getByRole('button', { name: /Añadir al parte/ }).count()) { salio = 'propuesta'; break; }
      const aviso = await p.locator('.alert:visible, .toast:visible, [role=alert]:visible').allInnerTexts();
      if (aviso.join('').trim()) { salio = 'aviso: ' + aviso.join(' / ').slice(0, 200); break; }
    }
    s.nota(`«Ordenar en líneas» → ${salio} a los ~${Math.round((Date.now() - t0) / 100) / 10} s`);
    for (const c of await campos(p)) s.nota('CAMPO ' + c);
    return fin('ordenado');
  }
  if (paso === 'anadir') {
    const hay = await p.getByRole('button', { name: /Añadir al parte/ }).count();
    const d = p.locator('textarea:visible').first();
    s.nota(`al entrar: propuesta visible=${hay} · dictado conserva «${(await d.inputValue()).slice(0, 50)}»`);
    if (!hay) {
      if (!(await d.inputValue())) await d.fill(DICTADO);
      await p.getByRole('button', { name: /Ordenar en líneas/ }).click();
      await p.getByRole('button', { name: /Añadir al parte/ }).waitFor({ timeout: 45000 });
    }
    // cantidades vacías de la propuesta: se rellenan (las dos primeras numéricas son desplazamiento y km)
    const nums = p.locator('input[type=number]:visible, input[inputmode=decimal]:visible');
    const total = await nums.count(); const antes = [];
    for (let i = 0; i < total; i++) antes.push(await nums.nth(i).inputValue());
    s.nota(`numéricos visibles: ${total} · valores: ${antes.join('|')}`);
    for (let i = 2; i < total; i++) if (!(await nums.nth(i).inputValue())) await nums.nth(i).fill('1');
    await s.mide('propuesta');
    await p.getByRole('button', { name: /Añadir al parte/ }).click();
    await p.waitForTimeout(2500);
    return fin('anadido');
  }
  if (paso === 'linea') {
    // «Añadir línea» a mano, en Materiales (el segundo): qué abre, qué pide, qué escribe.
    await p.getByRole('button', { name: /^Añadir línea$/ }).nth(Number(process.env.CUAL || 1)).click();
    await p.waitForTimeout(800);
    for (const c of await campos(p)) s.nota('CAMPO ' + c);
    await s.mide('linea-abierta');
    return fin('linea');
  }
  if (paso === 'datos') {
    const abre = async (t) => { await p.locator('summary', { hasText: t }).first().click(); await p.waitForTimeout(400); };
    await abre('Obra y referencia');
    const ref = p.locator('input[placeholder^="Tu referencia"]');
    await ref.fill('REF-QA-H6'); await ref.blur(); await p.waitForTimeout(900);
    await abre('Tipo de intervención');
    const radio = p.locator('input[type=radio][value=mantenimiento]');
    const caja = await radio.evaluate((e) => { const l = e.closest('label'); const b = (l || e).getBoundingClientRect(); return `${l ? 'label' : 'SIN label'} ${Math.round(b.width)}x${Math.round(b.height)}`; });
    s.nota('objetivo real del radio «mantenimiento»: ' + caja);
    await radio.check({ force: true }); await p.waitForTimeout(900);
    await abre('Notas');
    const notas = p.locator('input[placeholder^="Lo que haya que dejar"]');
    await notas.fill('(prueba) Nota del parte H6: el cliente pide que avisemos antes de volver.'); await notas.blur(); await p.waitForTimeout(1200);
    return fin('datos');
  }
  if (paso === 'recarga') {
    // ¿Sobrevive el dictado a una recarga EN EL MISMO navegador? (SCRUM-1675). Entre dos lanzamientos del banco
    // no se puede medir: cada uno nace con el almacén vacío, y su «» no dice nada.
    const d = p.locator('#parte-dictado');
    await d.fill('(prueba) dictado a medias que no he ordenado todavía'); await d.blur(); await p.waitForTimeout(1200);
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
    s.nota(`tras recargar en el mismo navegador, el dictado dice: «${await p.locator('#parte-dictado').inputValue()}»`);
    await p.locator('#parte-dictado').fill(''); await p.locator('#parte-dictado').blur(); await p.waitForTimeout(900);
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
    s.nota(`tras vaciarlo y recargar: «${await p.locator('#parte-dictado').inputValue()}»`);
    return fin('recarga');
  }
  if (paso === 'releer') {
    for (const c of await campos(p)) s.nota('CAMPO ' + c);
    const txt = await p.evaluate(() => document.body.innerText);
    const m = txt.match(/Datos del parte[\s\S]{0,400}/i);
    s.nota('bloque de datos: ' + (m ? m[0].replace(/\s+/g, ' ') : 'sin bloque'));
    return fin('releido');
  }
  throw new Error('PASO desconocido: ' + paso);
};
