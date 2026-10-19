// docs/master/evidencias/SCRUM-1177/sonda-barra-en-navegador.mjs — SCRUM-1177b (S3, 18-oct-2026)
//
//   node docs/master/evidencias/SCRUM-1177/sonda-barra-en-navegador.mjs
//
// ¿LA BARRA DE SELECCIÓN DE CLIENTES SE VE DE VERDAD, A LAS ANCHURAS QUE IMPORTAN? SÓLO LEE.
//
// SCRUM-792 pasó el `display` de la barra al CSS, por anchura (`@media (max-width: 640px)`), y el banco
// de vistas no evalúa CSS: desde entonces nadie medía si la barra GANA la cascada (SCRUM-1177, cerrado
// con ese hueco dicho). Aquí la lista la pinta el PRODUCTO en un navegador de verdad
// (`scripts/_banco-lista.mjs`: los scripts del índice, en su orden; sólo se dobla `apiRequest`).
//
// Por anchura y por selección (0 y 1 marcado, pulsando la casilla de verdad) se mide la barra:
// `display`, su caja, y QUIÉN responde en su centro (`elementFromPoint`), que es lo que dice si gana.
// Lo esperado sale de la hoja: ≤640 px se ve SIEMPRE (allí no hay cabecera con «Seleccionar todos»);
// >640 px se oculta con 0 y se ve con 1.
//
// CONTROLES POSITIVOS, antes de creerse un «se ve»:
//   · el caso que NO se ve por diseño (>640 px con 0) tiene que salir NO visible;
//   · una barra ocultada a la fuerza por CSS tiene que salir NO visible;
//   · una barra TAPADA por una capa encima tiene que salir NO visible (el `display` sigue siendo flex:
//     sólo `elementFromPoint` lo caza, y es la diferencia entre «está» y «gana»).
// Si un control no cae, la sonda no sabe mirar: sale 2.
//
// SALIDAS: 0 todo como la hoja dice · 1 algún caso no es lo esperado (defecto) · 2 no supe mirar.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { servirListas, abrirNavegador, abrirVista } from '../../../../scripts/_banco-lista.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const PUBLICO = path.join(RAIZ, 'public');
const ANCHOS = [390, 640, 641, 929, 1280];
const CLIENTES = [
  { id: 1, name: 'Fincas Soler', phone: '34000000001', email: 'a@b.es', notes: '', createdAt: '2026-01-15T10:00:00Z' },
  { id: 2, name: 'Carmen Ruiz', phone: '34000000002', email: 'c@d.es', notes: '', createdAt: '2026-02-20T10:00:00Z' },
];
const DATOS = `(function () {
  var C = ${JSON.stringify(CLIENTES)};
  return function (ruta) {
    if (/\\/admin\\/customers\\/duplicados/.test(ruta)) return [];
    if (/\\/admin\\/customers/.test(ruta)) return C;
    if (/\\/admin\\/merchant/.test(ruta)) return { id: 1, name: 'X' };
    return [];
  };
})()`;

const esperado = (ancho, marcados) => (ancho <= 640 ? true : marcados > 0);

/** La barra, medida: display, caja y quién responde en su centro. `null` si no está en el DOM. */
const MEDIR = () => {
  const b = document.querySelector('#view-container .barra-seleccion');
  if (!b) return null;
  b.scrollIntoView({ block: 'center', behavior: 'instant' });
  const r = b.getBoundingClientRect();
  const display = getComputedStyle(b).display;
  const arriba = r.width && r.height ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
  return {
    display, ancho: Math.round(r.width), alto: Math.round(r.height),
    gana: !!arriba && (arriba === b || b.contains(arriba)),
    clase: b.className, texto: b.textContent.replace(/\s+/g, ' ').trim().slice(0, 40),
  };
};
const visible = (m) => !!m && m.display !== 'none' && m.ancho > 0 && m.alto > 0 && m.gana;

/**
 * La OTRA vía de «seleccionar todos»: la casilla de la cabecera de la tabla (fuera de la barra). Con 0
 * marcados y >640 px la barra se oculta A PROPÓSITO porque ésta la sustituye; si ésta tampoco se viera,
 * no quedaría ninguna vía, que es el defecto que SCRUM-792 midió a 390 px («0 vías alcanzables»).
 */
const CABECERA = () => {
  const c = [...document.querySelectorAll('#view-container thead input[type=checkbox]')][0];
  if (!c) return { esta: false, gana: false };
  c.scrollIntoView({ block: 'center', behavior: 'instant' });
  const r = c.getBoundingClientRect();
  const arriba = r.width && r.height ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
  const gana = !!arriba && (arriba === c || (c.closest('label') || c).contains(arriba) || (arriba.closest && arriba.closest('th') === c.closest('th')));
  return { esta: true, gana: getComputedStyle(c).display !== 'none' && r.width > 0 && r.height > 0 && gana };
};

let salida = 0;
const { srv, puerto } = await servirListas(PUBLICO, [{ ruta: '/c', fnVista: 'renderCustomersView', datos: DATOS }]);
const { browser, quien } = await abrirNavegador(puppeteer);
console.log(`navegador: ${quien} · ${CLIENTES.length} clientes de muestra · anchos ${ANCHOS.join(', ')}`);
try {
  console.log('\nancho  marcados  esperado  visible  display  caja      gana  clase');
  for (const ancho of ANCHOS) {
    const { page, errores } = await abrirVista(browser, puerto, '/c', ancho);
    if (errores && errores.length) { console.log(`🔴 NO SUPE MIRAR a ${ancho}: la vista dio errores: ${JSON.stringify(errores).slice(0, 200)}`); salida = 2; }
    for (const marcados of [0, 1]) {
      if (marcados === 1) {
        // La casilla de una FILA, pulsada de verdad: así el JS quita `--vacia` como en producción.
        const ok = await page.evaluate(() => {
          const c = [...document.querySelectorAll('#view-container td input[type=checkbox]')][0];
          if (!c) return false;
          c.scrollIntoView({ block: 'center', behavior: 'instant' });
          c.click();
          return c.checked;
        });
        if (!ok) { console.log(`🔴 NO SUPE MIRAR a ${ancho}: no hay casilla de fila que marcar`); salida = 2; continue; }
      }
      const m = await page.evaluate(MEDIR);
      const v = visible(m);
      const e = esperado(ancho, marcados);
      if (!m) { console.log(`🔴 NO SUPE MIRAR a ${ancho}: no hay barra en el DOM`); salida = 2; continue; }
      if (v !== e) salida = Math.max(salida, 1);
      // Con 0 marcados, ¿queda ALGUNA vía de «seleccionar todos» que se vea y gane?
      let vias = '';
      if (marcados === 0) {
        const cab = await page.evaluate(CABECERA);
        const n = (v ? 1 : 0) + (cab.gana ? 1 : 0);
        if (n === 0) salida = Math.max(salida, 1);
        vias = ` · vías con 0: ${n} (barra ${v ? 'sí' : 'no'}, cabecera ${cab.gana ? 'sí' : cab.esta ? 'no gana' : 'no está'})${n === 0 ? '  🔴 NINGUNA' : ''}`;
      }
      console.log(`${String(ancho).padEnd(7)}${String(marcados).padEnd(10)}${(e ? 'se ve' : 'oculta').padEnd(10)}${(v ? 'SÍ' : 'no').padEnd(9)}`
        + `${m.display.padEnd(9)}${`${m.ancho}×${m.alto}`.padEnd(10)}${(m.gana ? 'sí' : 'no').padEnd(6)}${m.clase}${v !== e ? '   🔴 NO ES LO ESPERADO' : ''}${vias}`);
    }
    await page.close();
  }

  console.log('\n═══ CONTROLES POSITIVOS (tienen que salir NO visibles) ═══');
  const control = async (nombre, ancho, preparar) => {
    const { page } = await abrirVista(browser, puerto, '/c', ancho);
    await page.evaluate(preparar);
    const m = await page.evaluate(MEDIR);
    const cae = !visible(m);
    console.log(`${cae ? '✅' : '🔴 NO CAZADO'} ${nombre} @${ancho}: display ${m && m.display} · caja ${m && `${m.ancho}×${m.alto}`} · gana ${m && m.gana}`);
    if (!cae) salida = 2;
    await page.close();
  };
  await control('ocultada a la fuerza por CSS', 390, () => {
    const s = document.createElement('style'); s.textContent = '.barra-seleccion { display: none !important; }'; document.head.appendChild(s);
  });
  await control('TAPADA por una capa encima (su display sigue siendo flex)', 390, () => {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:transparent';
    document.body.appendChild(d);
  });
  // Y la vía de la cabecera: oculta a la fuerza a 929 px con 0 marcados, el recuento de vías tiene que dar 0.
  {
    const { page } = await abrirVista(browser, puerto, '/c', 929);
    await page.evaluate(() => {
      const s = document.createElement('style'); s.textContent = 'thead input[type=checkbox] { display: none !important; }'; document.head.appendChild(s);
    });
    const n = (visible(await page.evaluate(MEDIR)) ? 1 : 0) + ((await page.evaluate(CABECERA)).gana ? 1 : 0);
    console.log(`${n === 0 ? '✅' : '🔴 NO CAZADO'} cabecera ocultada a la fuerza @929 con 0 marcados: vías ${n}`);
    if (n !== 0) salida = 2;
    await page.close();
  }
} finally {
  await browser.close();
  srv.close();
}
console.log(`\nEXIT=${salida}  (0 todo como la hoja dice · 1 algún caso no es lo esperado · 2 no supe mirar)`);
process.exit(salida);
