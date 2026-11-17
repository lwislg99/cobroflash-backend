// SCRUM-1752 · ¿POR DÓNDE SE PARTE el rótulo «Desplazamientos (nº de viajes)»? ¿Y QUÉ DICE el aviso?
// Acción para el banco H6 (`docs/master/evidencias/SCRUM-1686/banco-h6/paso2.mjs`), que abre yaqu.app:
//
//   node docs/master/evidencias/SCRUM-1686/banco-h6/paso2.mjs 390 "#parte-detail/23" antes docs/master/evidencias/SCRUM-1752/c1752-parentesis.mjs
//   $env:LOCAL_DIR=<raíz del árbol con el cambio>   →  lo mismo con nombre «despues»
//
// Sin LOCAL_DIR mide lo que sirve producción. Con LOCAL_DIR sirve `parteDetailView.js` y `styles.css`
// de ese árbol encima de producción (mismo mecanismo que `SCRUM-1746/c1746-rotulo.mjs`): sólo cambia
// el front; los datos son los de la cuenta QA.
//
// QUÉ LEE:
//   · las LÍNEAS del rótulo tal y como las parte el navegador (carácter a carácter, por su caja);
//   · con AVISO=1, el aviso que sale al teclear «1e» en la casilla y salir de ella. «1e» no es un
//     número para la casilla (`badInput`): la vista NO manda nada y dice el aviso. No escribe.
//   · FIRMADO=<id> mide además el rótulo en un parte firmado (dato en vez de casilla).
//
// SUELO: sin el campo o sin el rótulo, CIEGO (código 1). Y el TESTIGO dice qué código corre de verdad.
import fs from 'node:fs';
import path from 'node:path';
// El contexto lo abre el banco de SCRUM-1658 (`abrir`, con `serviceWorkers: 'block'`) a través de
// `paso2.mjs` → `rol.mjs`. Se importa aquí, fijo, porque esta acción intercepta yaqu.app con `.route(`
// (`tests/scrum1233g-banco-bloquea-el-sw.test.mjs`).
import { OUT } from '../SCRUM-1658/banco/lib.mjs';

const SERVIDOS = [
  ['js/parteDetailView.js', 'application/javascript; charset=utf-8'],
  ['css/styles.css', 'text/css; charset=utf-8'],
];

const leerRotulo = () => {
  const campo = document.querySelector('[data-parte-campo="desplazamientos"], [data-parte-dato="desplazamientos"]');
  if (!campo) return { ciego: 'no encuentro el campo de desplazamientos' };
  const rot = campo.closest('.parte-campo').querySelector('.parte-campo-rotulo');
  const nodo = rot && rot.firstChild;
  if (!nodo || nodo.nodeType !== 3) return { ciego: 'el rótulo no es un texto a secas' };
  const r = document.createRange();
  const lineas = []; let alto = null; let actual = '';
  for (let i = 0; i < nodo.length; i++) {
    r.setStart(nodo, i); r.setEnd(nodo, i + 1);
    const caja = r.getClientRects()[0];
    if (caja && caja.width > 0) {
      const y = Math.round(caja.top);
      if (alto !== null && y > alto + 2) { lineas.push(actual.trim()); actual = ''; }
      alto = y;
    }
    actual += nodo.data[i];
  }
  lineas.push(actual.trim());
  const cs = getComputedStyle(rot);
  return {
    estado: campo.hasAttribute('data-parte-campo') ? 'casilla (borrador)' : 'dato (firmado)',
    texto: rot.textContent, lineas,
    anchoDelRotulo: Math.round(rot.getBoundingClientRect().width),
    textWrap: cs.textWrap || cs.getPropertyValue('text-wrap') || '(el navegador no lo conoce)',
    desbordeDeLaPagina: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
};

export default async (s, h) => {
  const p = s.page;
  const hash = '#' + String(p.url().split('#')[1] || '');
  const local = process.env.LOCAL_DIR;
  if (local) {
    for (const [f, tipo] of SERVIDOS) {
      const ruta = path.join(local, 'public', 'dashboard', f);
      const cuerpo = fs.readFileSync(ruta, 'utf8');
      await p.route((u) => u.pathname.endsWith('/dashboard/' + f), (r) => r.fulfill({ status: 200, contentType: tipo, body: cuerpo }));
      s.nota(`LOCAL ${f} ← ${ruta} (${cuerpo.length} caracteres)`);
    }
    // Ir al MISMO hash no recarga el documento (SCRUM-1746): sin `reload` se mediría producción.
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForTimeout(900);
  } else {
    s.nota('SIN LOCAL_DIR: se mide lo que sirve producción');
  }
  s.nota('TESTIGO desplazamientoEsCeroOMas = ' + JSON.stringify(await p.evaluate(() => (window.PARTE_TEXTOS || {}).desplazamientoEsCeroOMas)));
  let ciego = 0;
  for (const [nombre, destino] of [['borrador', hash], ['firmado', process.env.FIRMADO ? '#parte-detail/' + process.env.FIRMADO : null]]) {
    if (!destino) continue;
    if (destino !== hash) await h.ir(p, destino);
    const m = await p.evaluate(leerRotulo);
    if (m.ciego) ciego++;
    s.nota(`ROTULO ${nombre} ${destino} @${s.ancho}: ${JSON.stringify(m)}`);
    const par = p.locator('.parte-horas-par', { has: p.locator('[data-parte-campo="desplazamientos"], [data-parte-dato="desplazamientos"]') }).first();
    if (await par.count()) {
      await par.scrollIntoViewIfNeeded();
      await par.screenshot({ path: path.join(OUT, `par-${process.argv[4]}-${nombre}-${s.ancho}.png`) });
    }
    if (nombre === 'borrador' && process.env.AVISO === '1') {
      const casilla = p.locator('[data-parte-campo="desplazamientos"]').first();
      const antes = await casilla.inputValue();
      await casilla.click();
      await casilla.pressSequentially('1e');
      await p.keyboard.press('Tab');
      await p.waitForTimeout(900);
      const leerAvisos = () => p.evaluate(() => [...document.querySelectorAll('[data-parte-campo-no-guardado]')]
        .filter((e) => e.getBoundingClientRect().width > 0)
        .map((e) => `${e.getAttribute('data-parte-campo-no-guardado')}: ${e.textContent.trim()}`));
      let avisos = await leerAvisos();
      let como = 'al salir de la casilla';
      if (!avisos.length) {
        // Medido el 17-nov-2026: con la casilla VACÍA, Chromium no dispara `change` al salir («» → «»
        // para él) y la vista no llega a enterarse. Se despacha a mano para LEER el literal; que el
        // aviso no salga solo en ese caso es un hallazgo aparte, y se dice en la nota.
        const mala = await p.evaluate(() => {
          const c = document.querySelector('[data-parte-campo="desplazamientos"]');
          const b = !!(c.validity && c.validity.badInput);
          c.dispatchEvent(new Event('change', { bubbles: true }));
          return b;
        });
        await p.waitForTimeout(400);
        avisos = await leerAvisos();
        como = `con \`change\` despachado a mano (no salió solo; badInput=${mala})`;
      }
      s.nota(`AVISO tras teclear «1e» (la casilla tenía «${antes}») ${como}: ${JSON.stringify(avisos)}`);
      if (!avisos.length) ciego++;
      await par.screenshot({ path: path.join(OUT, `aviso-${process.argv[4]}-${s.ancho}.png`) });
    }
  }
  await s.mide('fin');
  if (ciego) throw new Error(`CIEGO: ${ciego} lectura(s) sin dato`);
};
