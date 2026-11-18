// SCRUM-1746 · ¿CABE el rótulo «Desplazamientos (nº de viajes)» en el par de las horas del parte?
// Acción para el banco H6 (`docs/master/evidencias/SCRUM-1686/banco-h6/paso2.mjs`), que abre yaqu.app:
//
//   $env:BANCO_OUT=<carpeta fuera del repo>
//   node docs/master/evidencias/SCRUM-1686/banco-h6/paso2.mjs 390 "#parte-detail/23" antes docs/master/evidencias/SCRUM-1746/c1746-rotulo.mjs
//   $env:LOCAL_DIR=<raíz del árbol con el cambio>   →  lo mismo con nombre «despues»
//
// Sin LOCAL_DIR mide lo que sirve producción (el ANTES, o el DESPUÉS una vez desplegado). Con LOCAL_DIR
// sirve `parteDetailView.js` y `styles.css` de ese árbol encima de producción: solo cambia el front, los
// datos siguen siendo los de la cuenta QA. NO escribe nada (ni un clic): solo lee cajas.
// FIRMADO=<id> mide además un parte firmado (el dato en vez de la casilla).
import fs from 'node:fs';
import path from 'node:path';
// El contexto de esta acción lo abre el banco de SCRUM-1658 (`abrir`, con `serviceWorkers: 'block'`), a
// través de `paso2.mjs` → `rol.mjs`. Se importa AQUÍ, fijo, porque esta acción intercepta yaqu.app con
// `.route(` y `tests/scrum1233g-banco-bloquea-el-sw.test.mjs` busca por los imports quién abre el
// contexto: con un service worker vivo, la intercepción se la salta y el «después» mediría producción.
import { OUT } from '../SCRUM-1658/banco/lib.mjs';

const SERVIDOS = [
  ['js/parteDetailView.js', 'application/javascript; charset=utf-8'],
  ['css/styles.css', 'text/css; charset=utf-8'],
];

async function medir(p) {
  return p.evaluate(() => {
    const caja = (e) => { const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
    const campo = document.querySelector('[data-parte-campo="desplazamientos"], [data-parte-dato="desplazamientos"]');
    const km = document.querySelector('[data-parte-campo="kilometros"], [data-parte-dato="kilometros"]');
    if (!campo || !km) return { ciego: 'no encuentro el campo de desplazamientos o el de kilómetros' };
    const rot = campo.closest('.parte-campo').querySelector('.parte-campo-rotulo');
    const rotKm = km.closest('.parte-campo').querySelector('.parte-campo-rotulo');
    const cs = getComputedStyle(rot);
    const par = campo.closest('.parte-horas-par');
    return {
      estado: campo.hasAttribute('data-parte-campo') ? 'casilla (borrador)' : 'dato (firmado)',
      rotulo: rot.textContent, rotuloKm: rotKm.textContent,
      cajaRotulo: caja(rot), cajaRotuloKm: caja(rotKm),
      lineasDelRotulo: Math.round(rot.getBoundingClientRect().height / parseFloat(cs.lineHeight)),
      fuente: cs.fontSize + '/' + cs.lineHeight,
      rotuloDesbordaSuCaja: rot.scrollWidth > rot.clientWidth,
      cajaCampo: caja(campo), cajaKm: caja(km),
      camposAlineados: Math.round(campo.getBoundingClientRect().top) === Math.round(km.getBoundingClientRect().top),
      cajaPar: par ? caja(par) : null,
      desbordeHorizontalDeLaPagina: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

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
    // `h.ir` al MISMO hash no recarga el documento (es una navegación de ancla): sin `reload`, la página
    // sigue con el script de producción y la medida «después» sale idéntica a la de «antes». Medido el
    // 17-nov-2026: lo cazó el TESTIGO de abajo, no la medida.
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForTimeout(900);
  } else {
    s.nota('SIN LOCAL_DIR: se mide lo que sirve producción');
  }
  // Testigo de QUÉ código corre: el literal que tiene cargado la página, no el que se espera.
  s.nota('TESTIGO PARTE_TEXTOS.desplazamiento = ' + JSON.stringify(await p.evaluate(() => (window.PARTE_TEXTOS || {}).desplazamiento)));
  for (const [nombre, destino] of [['borrador', hash], ['firmado', process.env.FIRMADO ? '#parte-detail/' + process.env.FIRMADO : null]]) {
    if (!destino) continue;
    if (destino !== hash) await h.ir(p, destino);
    const m = await medir(p);
    s.nota(`MEDIDA ${nombre} ${destino} @${s.ancho}: ${JSON.stringify(m)}`);
    const par = p.locator('.parte-horas-par', { has: p.locator('[data-parte-campo="desplazamientos"], [data-parte-dato="desplazamientos"]') }).first();
    if (await par.count()) {
      await par.scrollIntoViewIfNeeded();
      await par.screenshot({ path: path.join(OUT,`par-${process.argv[4]}-${nombre}-${s.ancho}.png`) });
    }
  }
  await s.mide('fin');
};
