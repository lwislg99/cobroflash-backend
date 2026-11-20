// SCRUM-1725j · banco de medida del lavado de la lista de Trabajos.
//
// Uso: node docs/master/evidencias/SCRUM-1725/c1725j-medir-filas.mjs [carpeta de capturas, FUERA del repo]
// Mismo fixture que `guard:lista-trabajos` (20 trabajos de muestra). A 1280 y a 390 dice, fila a fila,
// cuánto mide la fila y qué pieza de cada celda manda en esa altura; y, en conjunto, lo que el
// lavado promete: filas de escritorio de 61 a 69 px, acciones en un renglón, objetivos de 44 px,
// «Ver detalle» en una sola vertical y ninguna celda desbordada.
// Sale 0 si todo se cumple, 1 si algo no, 2 si no pudo mirar.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { servirListas, abrirNavegador, abrirVista } from '../../../../scripts/_banco-lista.mjs';
import { reglasDeDatos, trabajosDeMuestra } from '../../../../scripts/_trabajos-de-muestra.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const SALIDA = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (SALIDA && (!fs.existsSync(SALIDA) || SALIDA.startsWith(RAIZ))) { console.error('CIEGO: la carpeta de capturas no existe o está dentro del repo'); process.exit(2); }

// La muestra del guard no trae tarea, tipo ni dirección, y el tercer renglón es justo lo que hay
// que medir: se le añaden aquí, repartidos, con un caso largo de cada uno.
const TIPOS = [{ valor: 'T_MANT', rotulo: 'Mantenimiento' }, { valor: 'T_INST', rotulo: 'Instalación' }, { valor: 'T_REP', rotulo: 'Reparación o asistencia' }];
const TRABAJOS = trabajosDeMuestra(20).map((j, i) => ({
  ...j,
  queHayQueHacer: i % 4 === 0 ? 'Cambiar el termo y revisar la llave de paso de la cocina, que gotea desde el lunes y moja el mueble' : (i % 4 === 2 ? 'Revisión anual' : null),
  tipoIntervencion: i % 4 === 0 ? 'T_REP' : (i % 4 === 2 ? 'T_MANT' : null),
  direccion: i % 4 === 0 ? 'Avenida de la Constitución 148, portal 3, escalera izquierda, 4º B, 46009 Valencia' : (i % 4 === 1 ? 'Calle Mayor 14' : null),
}));
const { srv, puerto } = await servirListas(path.join(RAIZ, 'public'), [
  { ruta: '/trabajos20', fnVista: 'renderJobsView', datos: reglasDeDatos(TRABAJOS) },
]);
const { browser } = await abrirNavegador(puppeteer);
let rojos = 0;
let exigidas = 0;
const exige = (ok, texto) => { exigidas += 1; console.log(`${ok ? 'OK  ' : 'ROJO'} ${texto}`); if (!ok) rojos += 1; };

const medir = () => {
  const r = (e) => { const b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), an: Math.round(b.width), al: Math.round(b.height * 10) / 10, der: Math.round(b.right) }; };
  const pantalla = document.querySelector('.jobs-pantalla');
  const filas = [...document.querySelectorAll('#view-container tr.jobs-fila')].map((tr) => {
    const celdas = [...tr.children].map((td) => {
      const hijos = [...td.querySelectorAll('*')].filter((e) => e.getClientRects().length);
      const masAlto = hijos.reduce((m, e) => (e.getBoundingClientRect().height > (m ? m.getBoundingClientRect().height : 0) ? e : m), null);
      return { clase: td.className, al: r(td).al, manda: masAlto ? `${masAlto.tagName.toLowerCase()}.${String(masAlto.className).split(' ')[0]} ${r(masAlto).al}` : '(vacía)' };
    });
    const acc = tr.querySelector('.jobs-celda-acciones');
    const botones = acc ? [...acc.querySelectorAll('button')].filter((b) => b.getClientRects().length) : [];
    const detalle = botones.find((b) => b.textContent.trim() === 'Ver detalle');
    const resumen = tr.querySelector('.jobs-tecnicos-resumen');
    const cuerpo = tr.querySelector('.jobs-fila-cuerpo');
    const dir = tr.querySelector('.jobs-fila-direccion');
    return {
      al: r(tr).al, celdas,
      renglonesDeAcciones: new Set(botones.map((b) => Math.round(b.getBoundingClientRect().top))).size,
      botones: botones.map((b) => ({ t: b.textContent.trim().slice(0, 22), al: r(b).al, an: r(b).an })),
      detalleX: detalle ? r(detalle).x : null,
      resumen: resumen ? { ...r(resumen), texto: resumen.textContent.slice(0, 30) } : null,
      cuerpo: cuerpo ? r(cuerpo) : null,
      direccion: dir ? { an: r(dir).an, texto: dir.textContent.slice(0, 24) } : null,
      estado: tr.querySelector('.cell-status')?.textContent.trim(),
    };
  });
  return {
    testigo: pantalla ? getComputedStyle(pantalla).getPropertyValue('--jobs-lista').trim() : '',
    desborde: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    tarjeta: document.querySelector('.jobs-tarjeta') ? r(document.querySelector('.jobs-tarjeta')) : null,
    cabecera: document.querySelector('.jobs-cabecera') ? r(document.querySelector('.jobs-cabecera')) : null,
    nuevo: document.querySelector('#jobs-nuevo button') ? r(document.querySelector('#jobs-nuevo button')) : null,
    nuevoCaja: document.querySelector('#jobs-nuevo') ? { ...r(document.querySelector('#jobs-nuevo')), flex: getComputedStyle(document.querySelector('#jobs-nuevo')).flex, boton: getComputedStyle(document.querySelector('#jobs-nuevo button')).flex } : null,
    filas,
  };
};

let salida = 2;
try {
  for (const ancho of [1280, 390]) {
    const { page } = await abrirVista(browser, puerto, '/trabajos20', ancho);
    // El vocabulario de tipos llega en producción por `/admin/me`; el banco lo pone y repinta.
    await page.evaluate(async (tipos) => { window.appTiposIntervencion = tipos; await window.renderJobsView(document.getElementById('view-container')); }, TIPOS);
    await page.waitForSelector('#view-container tr.jobs-fila .jobs-fila-tipo', { timeout: 5000 });
    const m = await page.evaluate(medir);
    const conDireccion = m.filas.filter((f) => f.direccion);
    if (!conDireccion.length) { console.error(`CIEGO (${ancho}): ninguna fila trae dirección; el tercer renglón no se puede medir`); process.exit(2); }
    console.log(`\n── ${ancho} px · ${m.filas.length} filas · testigo «${m.testigo}» · tarjeta ${JSON.stringify(m.tarjeta)}`);
    if (m.testigo !== '1725j' || !m.filas.length) { console.error(`CIEGO (${ancho}): no pinta el bloque de esta rama o no hay filas`); process.exit(2); }
    m.filas.forEach((f, i) => console.log(`fila ${String(i + 1).padStart(2)} · ${f.estado} · alto ${f.al} · ${f.celdas.map((c) => `${c.clase.replace('cell-', '')} ${c.al} [${c.manda}]`).join(' · ')}`
      + ` · acciones: ${f.botones.map((b) => `«${b.t}» ${b.an}×${b.al}`).join(' ')}${f.direccion ? ` · dirección ${f.direccion.an} px` : ''}${f.resumen ? ` · técnicos ${f.resumen.an}×${f.resumen.al}` : ''}`));
    const altos = m.filas.map((f) => f.al);
    exige(m.desborde <= 0, `${ancho} la página no desborda a lo ancho (${m.desborde} px)`);
    exige(m.filas.every((f) => f.botones.every((b) => b.al >= 44)), `${ancho} todos los botones de las filas miden ≥44 px de alto`);
    exige(m.filas.every((f) => !f.resumen || f.resumen.al >= 44), `${ancho} el desplegable de técnicos mide ≥44 px de alto`);
    if (ancho >= 641) {
      exige(Math.min(...altos) >= 61 && Math.max(...altos) <= 69, `${ancho} las filas miden de 61 a 69 px (de ${Math.min(...altos)} a ${Math.max(...altos)})`);
      exige(m.filas.every((f) => f.renglonesDeAcciones === 1), `${ancho} las acciones van en UN renglón en todas las filas (${[...new Set(m.filas.map((f) => f.renglonesDeAcciones))].join('/')})`);
      exige(new Set(m.filas.map((f) => f.detalleX)).size === 1, `${ancho} «Ver detalle» cae en la misma vertical en todas las filas (x: ${[...new Set(m.filas.map((f) => f.detalleX))].join('/')})`);
      exige(m.filas.every((f) => !f.resumen || f.resumen.x >= f.cuerpo.x + f.cuerpo.an / 2), `${ancho} el desplegable de técnicos queda en la mitad derecha de la celda`);
      exige(conDireccion.every((f) => f.direccion.an >= 60), `${ancho} la dirección conserva al menos 60 px en las ${conDireccion.length} filas que la traen (mínimo ${Math.min(...conDireccion.map((f) => f.direccion.an))})`);
    } else {
      exige(m.nuevo && m.tarjeta && m.nuevo.an >= m.tarjeta.an - 2, `${ancho} «Nuevo trabajo» va a todo el ancho (${m.nuevo && m.nuevo.an} de ${m.tarjeta && m.tarjeta.an}; su caja, ${JSON.stringify(m.nuevoCaja)})`);
    }
    if (SALIDA) await page.screenshot({ path: path.join(SALIDA, `lavado-${ancho}.png`), clip: { x: 0, y: 0, width: ancho, height: ancho < 600 ? 1400 : 900 } });
    await page.close();
  }
  // El veredicto no tiene lado por defecto (censo de SCRUM-622): «verde» se gana con exigencias.
  if (!exigidas) { console.error('CIEGO: no se llegó a exigir nada'); salida = 2; }
  else if (rojos) { console.log(`\nROJO: ${rojos} en rojo de ${exigidas} exigencias · población: 20 trabajos de muestra a 1280 y 390`); salida = 1; }
  else { console.log(`\nVERDE: 0 en rojo de ${exigidas} exigencias · población: 20 trabajos de muestra a 1280 y 390`); salida = 0; }
} finally {
  await browser.close();
  srv.close();
}
process.exit(salida);
