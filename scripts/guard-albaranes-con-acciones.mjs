// scripts/guard-albaranes-con-acciones.mjs — SCRUM-831
//
// LA LISTA DE ALBARANES OFRECE EL SIGUIENTE PASO DE CADA FILA, MEDIDO EN NAVEGADOR.
//
// El censo de las cinco listas (8-sep-2026) midió que ésta era la ÚNICA con CERO acciones en la
// fila, la única que no se anunciaba pulsable, y la única con `.cell-actions` ocupada por un
// enlace a otra pantalla. Este guard vigila las tres cosas, y una cuarta que es la que de verdad
// puede volver: que la primaria salga del REGISTRO y no de una copia escrita aquí.
//
// Lo que se mide, con `page.setViewport` real y el producto pintándose de verdad:
//   ① cada estado ofrece SU primaria, con el rótulo aprobado de `ROTULOS_ALBARAN` — y `firmado`
//     con todo facturado NO ofrece nada, que es información y no un hueco.
//   ② `.cell-actions` contiene ACCIONES; el enlace al Trabajo vive en `.cell-trabajo`.
//   ③ la primaria NAVEGA al detalle y no ejecuta: 🔒 un acto irreversible no es nunca la acción
//     principal, y **emitir no tiene vuelta atrás** (`canTransitionAlbaran` sólo va hacia delante
//     y quema número de serie).
//   ④ SUELO: si los cinco casos dieran la misma respuesta, «cada estado ofrece la suya» sería
//     cierto por vacío — que es exactamente lo que pasaba antes, con cero en todos.
//
// Fuera de `npm test` porque la suite no arranca navegador. La red que SÍ corre siempre es
// `tests/scrum831-albaranes-con-acciones.test.mjs`.
//
// Salidas: 0 de acuerdo · 1 defecto · 2 NO SUPE MIRAR · 3 no arrancó el navegador.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { servirListas, abrirNavegador, abrirVista } from './_banco-lista.mjs';
import { reglasDeDatos, ALBARANES } from './_trabajos-de-muestra.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

let fallos = 0;
let ciego = 0;
const di = (s) => console.log(s);
const mal = (s) => { console.error(s); fallos += 1; };
const nosupe = (s) => { console.error(s); ciego += 1; };
const titulo = (s) => {
  di('\n══════════════════════════════════════════════════════════════════════════════════════');
  di(s);
  di('══════════════════════════════════════════════════════════════════════════════════════');
};

// Lo que cada fila ofrece, leído del DOM pintado.
const FILAS = `(() => {
  const filas = [...document.querySelectorAll('#view-container table.table tbody tr')]
    .filter((tr) => tr.children.length >= 3);
  if (!filas.length) return { error: 'sin filas de datos' };
  return {
    tabla: document.querySelector('#view-container table.table').className,
    columnas: [...document.querySelectorAll('#view-container table.table thead th')].map((th) => th.textContent.trim()),
    cursorFila: getComputedStyle(filas[0]).cursor,
    filas: filas.map((tr) => {
      const acciones = tr.querySelector('td.cell-actions');
      const trabajo = tr.querySelector('td.cell-trabajo');
      const pill = tr.querySelector('td.cell-status .status-pill');
      return {
        numero: (tr.querySelector('td.cell-id') || {}).textContent || '',
        estado: pill ? pill.textContent.trim() : null,
        // Lo que hay en la ranura de ACCIONES: sus botones y, por separado, si tiene enlaces.
        accion: acciones ? [...acciones.querySelectorAll('button')].map((b) => b.textContent.trim()) : null,
        enlacesEnAcciones: acciones ? acciones.querySelectorAll('a').length : null,
        trabajoEnSuCelda: trabajo ? (trabajo.textContent || '').trim().slice(0, 20) : null,
      };
    }),
  };
})()`;

const RUTAS = [{ ruta: '/albaranes', fnVista: 'renderAlbaranesView', datos: reglasDeDatos([]), api: () => ALBARANES }];
const { srv, puerto } = await servirListas(path.join(RAIZ, 'public'), RUTAS);
const { browser, quien } = await abrirNavegador(puppeteer);
di('navegador: ' + quien);
process.on('exit', () => { try { srv.close(); } catch { /* ya cerrado */ } });

const { page, errores } = await abrirVista(browser, puerto, '/albaranes', 1700);
const r = await page.evaluate(FILAS);

titulo('① CADA ESTADO OFRECE SU SIGUIENTE PASO');
if (r.error) {
  nosupe('   🔴 NO SUPE MIRAR: ' + r.error + (errores.length ? ' · ' + errores.join(' | ') : ''));
} else {
  di(`   tabla: ${r.tabla}`);
  di(`   columnas: ${r.columnas.join(' | ')}`);
  di('');
  di('   nº'.padEnd(18) + 'estado'.padEnd(12) + 'acción en la fila');
  di('   ' + '─'.repeat(78));
  for (const f of r.filas) {
    di('   ' + String(f.numero).padEnd(15) + String(f.estado).padEnd(12)
      + (f.accion && f.accion.length ? f.accion.map((a) => `«${a}»`).join(' + ') : '(ninguna)'));
  }

  // El SUELO: los cinco casos tienen que dar al menos TRES respuestas distintas. Antes del ticket
  // daban una sola —ninguna— y «cada estado ofrece la suya» habría sido cierto por vacío.
  const respuestas = new Set(r.filas.map((f) => (f.accion || []).join('+')));
  if (respuestas.size < 3) {
    nosupe(`\n   🔴 NO SUPE MIRAR: los ${r.filas.length} casos dan ${respuestas.size} respuesta(s) distinta(s).\n`
      + '      Antes de este ticket daban UNA para todos —ninguna acción—, así que con menos de\n'
      + '      tres esto no distingue «la lista ya decide» de «sigue sin decidir nada».');
  } else {
    di(`\n   ✅ SUELO · ${r.filas.length} casos dan ${respuestas.size} respuestas distintas: hay algo que comparar`);
  }

  // ── 🔴 NINGÚN RÓTULO PUEDE SER UN IDENTIFICADOR NI UN MARCADOR ───────────────────────────
  //
  // La primera pasada de este guard salió VERDE con la fila `A-2026-0024` mostrando
  // «btnConvertirFactura» — el id crudo. Un guard que cuenta acciones y no mira QUÉ dicen deja
  // pasar una tubería interna a la pantalla, que es lo que esta casa persigue desde SCRUM-644.
  const sospechosos = [];
  for (const f of r.filas) {
    for (const a of f.accion || []) {
      if (/^btn[A-Z]/.test(a) || a.includes('PENDIENTE microcopy')) sospechosos.push(`${f.numero}: «${a}»`);
    }
  }
  if (sospechosos.length) {
    mal('   🔴 HAY ACCIONES SIN RÓTULO DE VERDAD:\n' + sospechosos.map((s) => '      ' + s).join('\n')
      + '\n      Un identificador o un marcador en pantalla no es un rótulo a medias: es una tubería\n'
      + '      interna asomando. Si falta la firma, NO se pinta el botón (regla 30).');
  } else {
    di('   ✅ ningún rótulo es un identificador ni un marcador');
  }

  // ── EL HUECO DECLARADO, para que no sea silencioso ───────────────────────────────────────
  //
  // `btnConvertirFactura` no tiene rótulo firmado, así que su fila se queda sin acción. Eso es
  // correcto HOY y no puede quedarse así para siempre: el guard lo NOMBRA en cada pasada.
  const convertible = r.filas.find((f) => String(f.numero).includes('0024'));
  if (!convertible) {
    nosupe('   🔴 NO SUPE MIRAR: falta el caso «firmado, sin precios, con presupuesto» en el fixture.');
  } else if (!convertible.accion || !convertible.accion.length) {
    di('   ⏳ HUECO DECLARADO · `btnConvertirFactura` sigue SIN RÓTULO FIRMADO, así que ese caso no\n'
      + '      pinta acción. Es lo correcto (regla 30), no una omisión. Texto propuesto en\n'
      + '      docs/master/SCRUM-831.md — el día que se firme, son dos líneas.');
  } else {
    di(`   ✅ \`btnConvertirFactura\` ya tiene rótulo firmado: «${convertible.accion.join(', ')}»`);
  }

  // Y el caso que se pierde con más facilidad: firmado + todo facturado → NINGUNA.
  const facturado = r.filas.find((f) => String(f.numero).includes('0025'));
  if (!facturado) {
    nosupe('   🔴 NO SUPE MIRAR: falta el caso «firmado y ya facturado» en el fixture.');
  } else if (facturado.accion && facturado.accion.length) {
    mal(`   🔴 un albarán firmado y YA FACTURADO ofrece «${facturado.accion.join(', ')}». No hay siguiente\n`
      + '      paso: la celda vacía SIGNIFICA «nada que hacer», y rellenarla inventa un paso.');
  } else {
    di('   ✅ firmado y ya facturado: ninguna acción, que es la respuesta correcta');
  }
}

titulo('② LA RANURA DE ACCIONES CONTIENE ACCIONES, Y EL TRABAJO TIENE LA SUYA');
if (!r.error) {
  const conEnlaceEnAcciones = r.filas.filter((f) => f.enlacesEnAcciones > 0);
  if (conEnlaceEnAcciones.length) {
    // (Sin acentos graves dentro del mensaje: anidados cierran la plantilla y el texto sale otro.)
    mal('   🔴 ' + conEnlaceEnAcciones.length + ' fila(s) tienen un ENLACE dentro de la ranura de ACCIONES.\n'
      + '      Esa ranura es de las acciones; una navegación a otra pantalla no es una acción sobre\n'
      + '      este documento. Es justo lo que midió el censo de las cinco listas.');
  } else {
    di('   ✅ `.cell-actions` no contiene ningún enlace de navegación');
  }
  const sinTrabajo = r.filas.filter((f) => !f.trabajoEnSuCelda);
  if (sinTrabajo.length === r.filas.length) {
    mal('   🔴 el enlace al Trabajo ha DESAPARECIDO. Sacarlo de la ranura de acciones no era quitarlo:\n'
      + '      saber que tres albaranes sin firmar son del mismo Trabajo cambia lo que haces.');
  } else {
    di(`   ✅ el Trabajo sigue en la fila, en su propia celda · «${r.filas[0].trabajoEnSuCelda}»`);
  }
  if (!r.columnas.includes('Acciones')) {
    mal('   🔴 la tabla no declara la columna «Acciones».');
  } else {
    di('   ✅ la cabecera declara «Acciones» (el mismo rótulo que Trabajos y Presupuestos)');
  }
}

titulo('③ LA PRIMARIA NAVEGA, NO EJECUTA — emitir no tiene vuelta atrás');
{
  const antes = await page.evaluate('({ navs: window.__navegaciones.length, escrituras: window.__peticiones.filter((p) => p.metodo !== "GET").length })');
  const hay = await page.evaluate(`(() => {
    const b = document.querySelector('#view-container table.table tbody tr td.cell-actions button');
    if (!b) return null;
    b.click();
    return b.textContent.trim();
  })()`);
  if (!hay) {
    nosupe('   🔴 NO SUPE MIRAR: no hay ninguna acción que pulsar en la primera fila.');
  } else {
    await new Promise((r2) => setTimeout(r2, 400));
    const d = await page.evaluate('({ navs: window.__navegaciones, escrituras: window.__peticiones.filter((p) => p.metodo !== "GET") })');
    const navego = d.navs.length > antes.navs && d.navs[d.navs.length - 1].vista === 'albaran-detail';
    const escribio = d.escrituras.length > antes.escrituras;
    di(`   pulsado «${hay}» · navegó a: ${d.navs.length ? d.navs[d.navs.length - 1].vista : '(ninguna)'} · escrituras: ${d.escrituras.length}`);
    if (!navego) mal('   🔴 la primaria no lleva al detalle del albarán, que es donde vive su ejecutor.');
    if (escribio) {
      mal('   🔴 LA PRIMARIA ESCRIBE DESDE LA LISTA. Emitir no tiene vuelta atrás —la FSM sólo va hacia\n'
        + '      delante y quema número de serie—, así que no puede dispararse con un clic en una fila.');
    }
    if (navego && !escribio) di('   ✅ dice qué toca y lleva hasta donde se hace; no escribe nada');
  }
}

titulo('④ LA FILA NO SE ANUNCIA PULSABLE — y es una decisión, no un olvido');
if (!r.error) {
  // El censo dijo que en Albaranes el 80% es ACTUAR sobre el documento, no abrirlo. Con acciones
  // en la fila, hacerla pulsable entera pondría un gesto de navegar pegado a los botones — el
  // candado de SCRUM-727 — sin beneficio medido. El número ya abre el detalle y SÍ se anuncia.
  di(`   cursor de la fila: ${r.cursorFila}`);
  if (r.cursorFila === 'pointer') {
    mal('   🔴 la fila entera se anuncia pulsable. Con acciones dentro, eso pone el gesto de navegar\n'
      + '      pegado al de actuar: es el candado de SCRUM-727, y aquí no hay beneficio que lo pague.');
  } else {
    di('   ✅ no se anuncia pulsable: el número abre el detalle y ése sí se anuncia');
  }
}

await browser.close();
srv.close();
di('');
if (ciego) { console.error(`🔴 NO SUPE MIRAR en ${ciego} sitio(s): un silencio así no es un verde.`); process.exit(2); }
if (fallos) { console.error(`🔴 ${fallos} defecto(s).`); process.exit(1); }
di('✅ cada estado ofrece su siguiente paso, la ranura de acciones es de las acciones, y la primaria lleva sin escribir.');
