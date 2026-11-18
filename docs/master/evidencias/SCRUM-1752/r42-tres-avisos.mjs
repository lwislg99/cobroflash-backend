// SCRUM-1752 · regla 42 · los avisos de Desplazamientos que pone la RUTA, vistos PINTADOS en yaqu.app.
//
//   BANCO_OUT=<fuera del repo> node docs/master/evidencias/SCRUM-1686/banco-h6/paso2.mjs 390 "#parte-detail/<borrador>" \
//     r42-avisos docs/master/evidencias/SCRUM-1752/r42-tres-avisos.mjs
//
// `c1752-parentesis.mjs` ya enseña «…es un número entero…» (lo tecleado no es un número). Faltaban los
// dos que sólo salen cuando la ruta RECHAZA el valor: `desplazamientos_negativo` y `desplazamientos_no_cabe`.
// Un rechazo NO guarda: al final se recarga y la casilla tiene que valer lo mismo que al entrar. Si no,
// código 1 (el banco habría escrito en el parte).
// SUELO: sin la casilla, o si algún valor no pinta aviso, CIEGO (código 1).
const VALORES = ['-1', '99999999999'];

export default async (s, h) => {
  const p = s.page;
  const hash = '#' + String(p.url().split('#')[1] || '');
  const casilla = p.locator('[data-parte-campo="desplazamientos"]').first();
  if (!(await casilla.count())) throw new Error('CIEGO: no hay casilla de desplazamientos en ' + hash);
  const alEntrar = await casilla.inputValue();
  s.nota(`AL ENTRAR ${hash} @${s.ancho}: la casilla vale «${alEntrar}»`);
  const leerAvisos = () => p.evaluate(() => [...document.querySelectorAll('[data-parte-campo-no-guardado]')]
    .filter((e) => e.getBoundingClientRect().width > 0)
    .map((e) => `${e.getAttribute('data-parte-campo-no-guardado')}: ${e.textContent.trim()}`));
  let ciego = 0;
  for (const v of VALORES) {
    await casilla.click();
    await casilla.fill('');
    await casilla.pressSequentially(v);
    await p.keyboard.press('Tab');
    await p.waitForTimeout(1500);
    const avisos = await leerAvisos();
    const medida = await p.evaluate(() => {
      const e = [...document.querySelectorAll('[data-parte-campo-no-guardado]')].find((x) => x.getBoundingClientRect().width > 0);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { ancho: Math.round(r.width), alto: Math.round(r.height), seSale: e.scrollWidth > e.clientWidth + 1, desbordeDeLaPagina: document.documentElement.scrollWidth - window.innerWidth };
    });
    s.nota(`AVISO tras teclear «${v}» y salir: ${JSON.stringify(avisos)} · ${JSON.stringify(medida)}`);
    if (!avisos.length) ciego++;
    await s.mide('valor' + VALORES.indexOf(v));
  }
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  const alSalir = await p.locator('[data-parte-campo="desplazamientos"]').first().inputValue();
  s.nota(`TRAS RECARGAR: la casilla vale «${alSalir}» (al entrar valía «${alEntrar}»)`);
  if (alSalir !== alEntrar) throw new Error(`EL BANCO HA ESCRITO: la casilla valía «${alEntrar}» y ahora «${alSalir}»`);
  if (ciego) throw new Error(`CIEGO: ${ciego} valor(es) no pintaron aviso`);
};
