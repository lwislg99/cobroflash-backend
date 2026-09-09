// scripts/guard-lista-trabajos.mjs — SCRUM-816
//
// EL CANDADO DE LA LISTA DE TRABAJOS, MEDIDO EN NAVEGADOR Y **CORRIENDO**.
//
// 🔒 Una acción que modifica datos y se dispara con el mismo gesto con el que se navega es una
// acción que se va a disparar sin querer. Y el jefe no se entera hasta que el técnico se presenta
// en una obra que no era la suya. (SCRUM-727, literal.)
//
// SCRUM-816 mete un desplegable de técnicos DENTRO de la fila, o sea a un centímetro del gesto
// que navega. Por eso las dos direcciones se prueban por separado y las dos hacen falta:
//   ① el clic en el desplegable ASIGNA y NO navega;
//   ② el clic en la fila NAVEGA y NO asigna a nadie.
// Razonarlo no vale: un `stopPropagation` bien puesto y uno mal puesto se leen igual en el fuente
// (la lección de SCRUM-515). El árbitro es el DOM vivo después del clic.
//
// Y mide tres cosas más que el ticket exige y que sólo se ven en un navegador:
//   ③ que un guardado FALLIDO **revierta lo que se ve** — sin esto la pantalla afirmaría una
//     asignación que no existe, que es peor que no tener el control;
//   ④ el ANCHO y el scroll horizontal a 390, 1280 y 1700 px, con 20 Trabajos y con 1, y con el
//     desplegable ABIERTO (es el único estado en el que su popover puede salirse);
//   ⑤ que las otras CUATRO listas de la casa sigan **idénticas por hash** contra el PUNTO DE
//     PARTIDA de la rama. Si el `max-width` hubiera sido compartido, es aquí donde se vería.
//     🔴 Contra `merge-base`, NO contra la punta de `origin/main`: la punta se mueve con cada PR
//     ajeno y acusaría a una rama limpia el día que otra sesión toque `customersView.js`. Es la
//     avería que SCRUM-723 existe para impedir, y su guard cazó la primera versión de esto.
//
// Fuera de `npm test` por la misma decisión que el resto de guards de navegador: la suite no
// arranca navegador. La red que SÍ corre siempre es `tests/scrum816-la-lista-no-miente.test.mjs`.
//
// Salidas: 0 de acuerdo · 1 he encontrado un defecto · 2 NO SUPE MIRAR · 3 no arrancó el navegador.
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { servirListas, abrirNavegador, abrirVista, arbolDePartida } from './_banco-lista.mjs';
import { trabajosDeMuestra, reglasDeDatos, EQUIPO } from './_trabajos-de-muestra.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLICO = path.join(RAIZ, 'public');

let fallos = 0;
let ciego = 0;
const di = (s) => console.log(s);
const mal = (s) => { console.error(s); fallos += 1; };
const nosupe = (s) => { console.error(s); ciego += 1; };
const titulo = (s) => {
  di('\n══════════════════════════════════════════════════════════════════════════════');
  di(s);
  di('══════════════════════════════════════════════════════════════════════════════');
};

// ── Las páginas que se sirven ──────────────────────────────────────────────────────────────
const RUTAS = [
  { ruta: '/trabajos20', fnVista: 'renderJobsView', datos: reglasDeDatos(trabajosDeMuestra(20)) },
  { ruta: '/trabajos1', fnVista: 'renderJobsView', datos: reglasDeDatos(trabajosDeMuestra(1)) },
  // La misma pantalla con el guardado ROTO: la otra mitad del candado.
  { ruta: '/trabajos-patch-roto', fnVista: 'renderJobsView', datos: reglasDeDatos(trabajosDeMuestra(20), { fallaElPatch: true }) },
  // SUELO del equipo vacío: con cero asignables no se pinta un desplegable que no lleva a nada.
  { ruta: '/trabajos-sin-equipo', fnVista: 'renderJobsView', datos: reglasDeDatos(trabajosDeMuestra(4)).replace('D.equipo', '[]') },
  // Las cuatro hermanas, para el control por hash.
  { ruta: '/clientes', fnVista: 'renderCustomersView', datos: reglasDeDatos([]) },
  { ruta: '/presupuestos', fnVista: 'renderQuotesListView', datos: reglasDeDatos([]) },
  { ruta: '/albaranes', fnVista: 'renderAlbaranesView', datos: reglasDeDatos([]) },
  { ruta: '/facturas', fnVista: 'renderInvoicesView', datos: reglasDeDatos([]) },
];
// ── ⚠️ SCRUM-831 · ALBARANES YA NO SE COMPARA POR HASH, Y SE DICE POR QUÉ ────────────────────
//
// Este control nació para responder UNA pregunta: ¿el tope de ancho que SCRUM-816 quitó de
// Trabajos se ha llevado por delante a alguna hermana? Se contestaba exigiendo que las cuatro
// salieran idénticas al punto de partida de la rama.
//
// SCRUM-831 cambia Albaranes A PROPÓSITO —le da la columna de acciones que no tenía—, así que su
// hash tiene que cambiar. Dejarlo como estaba lo pondría rojo para siempre, y un guard que grita
// sin motivo enseña a ignorar los rojos (SCRUM-822).
//
// 🔴 PERO NO SE RETIRA DEL CONTROL: se le cambia la PREGUNTA. A las otras tres se les sigue
// exigiendo el hash; a Albaranes se le exige que su cambio sea EXACTAMENTE el declarado —una
// acción en `.cell-actions` y el Trabajo en `.cell-trabajo`—, que es más fuerte que un hash: un
// hash sólo dice «cambió», esto dice «cambió en lo que dijo y en nada más que importe».
const HERMANAS = [
  { ruta: '/clientes', rotulo: 'Clientes' },
  { ruta: '/presupuestos', rotulo: 'Presupuestos' },
  { ruta: '/facturas', rotulo: 'Facturas' },
];

const { srv, puerto } = await servirListas(PUBLICO, RUTAS);
const { browser, quien } = await abrirNavegador(puppeteer);
di('navegador: ' + quien);
process.on('exit', () => { try { srv.close(); } catch { /* ya cerrado */ } });

const SEL_FILA = '#view-container tr.jobs-fila';
const SEL_RESUMEN = SEL_FILA + ' .jobs-tecnicos-resumen';
const SEL_CASILLA = SEL_FILA + ' .jobs-tecnicos-lista input[type="checkbox"]';

/** Lo que hay que saber de la primera fila ANTES de tocarla. */
const RETRATO = `(() => {
  const tr = document.querySelector('${SEL_FILA}');
  if (!tr) return null;
  const res = tr.querySelector('.jobs-tecnicos-resumen');
  const cbs = [...tr.querySelectorAll('.jobs-tecnicos-lista input[type="checkbox"]')];
  return {
    resumen: res ? res.textContent.trim() : null,
    marcadas: cbs.map((c) => c.checked),
    cuantasCasillas: cbs.length,
    peticiones: window.__peticiones.length,
    patches: window.__peticiones.filter((p) => p.metodo === 'PATCH').length,
    navegaciones: window.__navegaciones.length,
    avisos: window.__avisos.map((a) => a.texto),
  };
})()`;

// ═══ ⓪ SUELO ════════════════════════════════════════════════════════════════════════════════
titulo('⓪ SUELO · ¿hay pantalla que medir, y hay desplegable que pulsar?');
{
  const { page, errores } = await abrirVista(browser, puerto, '/trabajos20', 1280);
  const r = await page.evaluate(`(() => ({
    filas: document.querySelectorAll('${SEL_FILA}').length,
    resumenes: document.querySelectorAll('${SEL_RESUMEN}').length,
    casillas: document.querySelectorAll('${SEL_CASILLA}').length,
    celdas: [...document.querySelectorAll('${SEL_FILA}')].slice(0, 1).map((tr) => [...tr.children].map((td) => td.className)),
  }))()`);
  if (errores.length) nosupe('   🔴 la vista dejó errores en consola: ' + errores.join(' | '));
  di(`   filas pintadas: ${r.filas}  ·  desplegables: ${r.resumenes}  ·  casillas: ${r.casillas}`);
  di(`   celdas de la fila: ${(r.celdas[0] || []).join(' | ')}`);
  if (r.filas < 10) nosupe(`   🔴 NO SUPE MIRAR: ${r.filas} filas. Con menos de 10 el censo de abajo no dice nada.`);
  if (r.resumenes !== r.filas) {
    nosupe(`   🔴 NO SUPE MIRAR: ${r.resumenes} desplegables para ${r.filas} filas. Si no hay control, «no navegó» sería cierto por vacío.`);
  }
  if (r.casillas !== r.filas * EQUIPO.length) {
    nosupe(`   🔴 NO SUPE MIRAR: ${r.casillas} casillas y esperaba ${r.filas * EQUIPO.length} (${EQUIPO.length} por fila).`);
  }
  await page.close();
}

// ═══ ① EL CLIC EN EL DESPLEGABLE ASIGNA Y NO NAVEGA ═════════════════════════════════════════
titulo('① 🔒 el clic en el DESPLEGABLE asigna y NO navega');
{
  const { page } = await abrirVista(browser, puerto, '/trabajos20', 1280);
  const antes = await page.evaluate(RETRATO);
  di(`   antes · resumen: «${antes.resumen}»  ·  PATCH: ${antes.patches}  ·  navegaciones: ${antes.navegaciones}`);

  await page.click(SEL_RESUMEN);                 // abrir: primer gesto sobre el control
  const trasAbrir = await page.evaluate(RETRATO);
  if (trasAbrir.navegaciones !== 0) {
    mal('   🔴 ABRIR EL DESPLEGABLE NAVEGÓ. El gesto de mirar quién está asignado se lleva al jefe a otra pantalla.');
  } else {
    di('   ✅ abrir el desplegable no navegó');
  }

  await page.click(SEL_CASILLA);                 // marcar: el gesto que ESCRIBE
  await page.waitForFunction(`window.__peticiones.filter((p) => p.metodo === 'PATCH').length > ${antes.patches}`, { timeout: 5000 })
    .catch(() => { mal('   🔴 marcar una casilla NO guardó: no salió ni un PATCH.'); });
  const despues = await page.evaluate(RETRATO);
  const patch = await page.evaluate("window.__peticiones.filter((p) => p.metodo === 'PATCH').slice(-1)[0] || null");

  if (despues.navegaciones !== 0) {
    mal(`   🔴 MARCAR UNA CASILLA NAVEGÓ (${despues.navegaciones}). Es exactamente el candado: asignar y navegar con el mismo gesto.`);
  } else {
    di('   ✅ marcar una casilla no navegó');
  }
  if (!patch || !/\/admin\/jobs\/\d+$/.test(patch.ruta) || !/assignedUserIds/.test(String(patch.cuerpo))) {
    mal(`   🔴 el PATCH no es el de asignar: ${JSON.stringify(patch)}`);
  } else {
    di(`   ✅ guardó · PATCH ${patch.ruta} ${patch.cuerpo}`);
  }
  const nuevos = despues.avisos.filter((t) => !antes.avisos.includes(t));
  if (!nuevos.some((t) => t.startsWith('✓'))) {
    mal(`   🔴 NO LO DIJO: ningún aviso de confirmación tras guardar. Avisos vistos: ${JSON.stringify(nuevos)}`);
  } else {
    di(`   ✅ lo dice · «${nuevos.find((t) => t.startsWith('✓'))}»`);
  }
  if (despues.resumen === antes.resumen) {
    mal(`   🔴 el resumen no cambió: sigue diciendo «${despues.resumen}» después de asignar.`);
  } else {
    di(`   ✅ el resumen pasó de «${antes.resumen}» a «${despues.resumen}»`);
  }
  await page.close();
}

// ═══ ② EL CLIC EN LA FILA NAVEGA Y NO ASIGNA ════════════════════════════════════════════════
titulo('② 🔒 el clic en la FILA navega y NO asigna a nadie');
{
  const { page } = await abrirVista(browser, puerto, '/trabajos20', 1280);
  const antes = await page.evaluate(RETRATO);
  await page.click(SEL_FILA + ' td.cell-client');
  const despues = await page.evaluate(RETRATO);
  const nav = await page.evaluate('window.__navegaciones');

  if (despues.navegaciones !== antes.navegaciones + 1 || nav[0]?.vista !== 'jobs-detail') {
    mal(`   🔴 el clic en la fila NO abrió el Trabajo: ${JSON.stringify(nav)}`);
  } else {
    di(`   ✅ navegó · ${nav[0].vista} ${JSON.stringify(nav[0].params)}`);
  }
  if (despues.patches !== antes.patches) {
    mal(`   🔴 EL CLIC EN LA FILA ESCRIBIÓ (${despues.patches - antes.patches} PATCH). El jefe asignaría un técnico creyendo que sólo abría el Trabajo.`);
  } else {
    di('   ✅ no escribió: cero PATCH');
  }
  if (JSON.stringify(despues.marcadas) !== JSON.stringify(antes.marcadas)) {
    mal('   🔴 el clic en la fila cambió las casillas del desplegable.');
  } else {
    di('   ✅ las casillas siguen como estaban');
  }
  await page.close();
}

// ═══ ③ SI EL GUARDADO FALLA, LO QUE SE VE VUELVE ATRÁS ══════════════════════════════════════
titulo('③ 🔴 guardado FALLIDO → lo dice y REVIERTE lo que se ve');
{
  const { page } = await abrirVista(browser, puerto, '/trabajos-patch-roto', 1280);
  const antes = await page.evaluate(RETRATO);
  await page.click(SEL_RESUMEN);
  await page.click(SEL_CASILLA);
  await page.waitForFunction(`window.__avisos.length > ${antes.avisos.length}`, { timeout: 5000 })
    .catch(() => { mal('   🔴 el fallo no dijo NADA: ningún aviso.'); });
  const despues = await page.evaluate(RETRATO);
  const nuevos = despues.avisos.filter((t) => !antes.avisos.includes(t));

  if (!nuevos.some((t) => /No se pudo guardar/.test(t))) {
    mal(`   🔴 no avisó del fallo. Avisos nuevos: ${JSON.stringify(nuevos)}`);
  } else {
    di(`   ✅ lo dice · «${nuevos.find((t) => /No se pudo guardar/.test(t))}»`);
  }
  if (JSON.stringify(despues.marcadas) !== JSON.stringify(antes.marcadas)) {
    mal(`   🔴 NO REVIRTIÓ LA CASILLA: antes ${JSON.stringify(antes.marcadas)}, ahora ${JSON.stringify(despues.marcadas)}.\n`
      + '      Un desplegable que se queda con el nombre puesto y no lo ha guardado es peor que no tenerlo.');
  } else {
    di('   ✅ la casilla volvió a su sitio');
  }
  if (despues.resumen !== antes.resumen) {
    mal(`   🔴 NO REVIRTIÓ EL RESUMEN: antes «${antes.resumen}», ahora «${despues.resumen}». La pantalla afirma una asignación que no existe.`);
  } else {
    di(`   ✅ el resumen volvió a «${despues.resumen}»`);
  }
  await page.close();
}

// ═══ ④ VARIOS TÉCNICOS, Y CON CERO LO DICE ══════════════════════════════════════════════════
titulo('④ aguanta VARIOS técnicos · con cero dice «Sin asignar» · sin equipo, no hay adorno');
{
  const { page } = await abrirVista(browser, puerto, '/trabajos20', 1280);
  await page.click(SEL_RESUMEN);
  // Se marcan TODAS las casillas de la primera fila: un Trabajo puede llevar tres.
  const marcadas = await page.evaluate(`(async () => {
    const tr = document.querySelector('${SEL_FILA}');
    const cbs = [...tr.querySelectorAll('.jobs-tecnicos-lista input[type="checkbox"]')];
    for (const c of cbs) { if (!c.checked) { c.click(); await new Promise((r) => setTimeout(r, 30)); } }
    await new Promise((r) => setTimeout(r, 120));
    return tr.querySelector('.jobs-tecnicos-resumen').textContent.trim();
  })()`);
  const esperado = EQUIPO.map((m) => m.name).join(', ');
  if (marcadas !== esperado) mal(`   🔴 con los cuatro marcados el resumen dice «${marcadas}» y debería decir «${esperado}»`);
  else di(`   ✅ cuatro técnicos en una fila · «${marcadas}»`);

  const vacio = await page.evaluate(`(async () => {
    const tr = document.querySelector('${SEL_FILA}');
    const cbs = [...tr.querySelectorAll('.jobs-tecnicos-lista input[type="checkbox"]')];
    for (const c of cbs) { if (c.checked) { c.click(); await new Promise((r) => setTimeout(r, 30)); } }
    await new Promise((r) => setTimeout(r, 120));
    return tr.querySelector('.jobs-tecnicos-resumen').textContent.trim();
  })()`);
  if (vacio !== 'Sin asignar') mal(`   🔴 con cero marcados el resumen dice «${vacio}» y debería decir «Sin asignar»`);
  else di('   ✅ con cero · «Sin asignar»');
  await page.close();
}
{
  const { page } = await abrirVista(browser, puerto, '/trabajos-sin-equipo', 1280);
  const r = await page.evaluate(`(() => ({
    filas: document.querySelectorAll('${SEL_FILA}').length,
    desplegables: document.querySelectorAll('${SEL_RESUMEN}').length,
    celda: (document.querySelector('${SEL_FILA} td.cell-tecnicos') || {}).textContent || null,
  }))()`);
  if (r.filas < 1) nosupe('   🔴 NO SUPE MIRAR: la pantalla sin equipo no pintó filas.');
  else if (r.desplegables !== 0) mal(`   🔴 con CERO técnicos asignables se pintaron ${r.desplegables} desplegables. Un control sin opciones promete lo que no puede dar.`);
  else di(`   ✅ sin equipo no hay desplegable · la celda dice «${(r.celda || '').trim()}»`);
  await page.close();
}

// ═══ ⑤ EL ANCHO Y EL SCROLL HORIZONTAL ══════════════════════════════════════════════════════
titulo('⑤ ancho y scroll horizontal · page.setViewport REAL · 390 y 1280, con 20 y con 1');
for (const ancho of [390, 1280, 1700]) {
  for (const [ruta, rotulo] of [['/trabajos20', '20 trabajos'], ['/trabajos1', '1 trabajo']]) {
    const { page } = await abrirVista(browser, puerto, ruta, ancho, ancho === 390 ? 844 : 900);
    const m = await page.evaluate(`(() => {
      const t = document.querySelector('#view-container table.table');
      return {
        vp: window.innerWidth,
        doc: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        tabla: t ? +t.getBoundingClientRect().width.toFixed(1) : null,
        pantalla: (() => { const p = document.querySelector('.jobs-pantalla'); return p ? +p.getBoundingClientRect().width.toFixed(1) : null; })(),
      };
    })()`);
    // 🔴 El árbitro es `scrollWidth`, NO la barra: `html { overflow-x: clip }` esconde la barra
    // pero no encoge el contenido, así que mirar si «se ve scroll» daría verde con la página rota.
    const desborda = m.doc > m.vp + 0.5 || m.body > m.vp + 0.5;
    const aprovecha = m.tabla != null && m.vp >= 1280 ? Math.round((m.tabla / m.vp) * 100) : null;
    di(`   ${ancho} px · ${rotulo} · tabla ${m.tabla} px${aprovecha != null ? ` (${aprovecha}% de la ventana)` : ''} · scroll horizontal: ${desborda ? '🔴 SÍ' : 'no'}`);
    if (desborda) mal(`      🔴 la página scrollea en horizontal a ${ancho} px (doc ${m.doc}, body ${m.body}).`);
    if (m.tabla == null) nosupe(`      🔴 NO SUPE MIRAR: no encontré la tabla a ${ancho} px.`);

    // 🔴 Y CON EL DESPLEGABLE ABIERTO. El popover es `position: absolute` y mide hasta 280 px:
    // medir sólo con todo cerrado dejaría fuera el único estado en el que puede salirse — y a
    // 390 px la celda de técnicos empieza cerca del borde.
    const abierto = await page.evaluate(`(() => {
      const d = document.querySelector('${SEL_FILA} details.jobs-tecnicos-menu');
      if (!d) return null;
      d.open = true;
      const l = d.querySelector('.jobs-tecnicos-lista');
      return {
        doc: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        vp: window.innerWidth,
        derecha: l ? +l.getBoundingClientRect().right.toFixed(1) : null,
      };
    })()`);
    if (abierto === null) {
      nosupe(`      🔴 NO SUPE MIRAR: no hay desplegable que abrir a ${ancho} px.`);
    } else if (abierto.doc > abierto.vp + 0.5 || abierto.body > abierto.vp + 0.5 || (abierto.derecha != null && abierto.derecha > abierto.vp + 0.5)) {
      mal(`      🔴 con el desplegable ABIERTO se sale a ${ancho} px (doc ${abierto.doc}, body ${abierto.body}, borde derecho ${abierto.derecha}).`);
    } else {
      di(`      · con el desplegable abierto: borde derecho ${abierto.derecha} px de ${abierto.vp} · no se sale`);
    }
    await page.close();
  }
}

// ═══ ⑥ LAS OTRAS CUATRO LISTAS, IDÉNTICAS POR HASH CONTRA origin/main ═══════════════════════
titulo('⑥ las hermanas: TRES idénticas por hash · Albaranes cambia en LO DECLARADO (SCRUM-831)');
{
  // 🔴 CONTRA `merge-base`, NO CONTRA LA PUNTA DE `origin/main`. El porqué está en
  // `arbolDePartida`: la punta se mueve con cada PR ajeno y acusaría a una rama limpia.
  const partida = arbolDePartida(RAIZ, 'hermanas');
  if (!partida.base) {
    nosupe('   🔴 NO SUPE MIRAR: no pude resolver el punto de partida de la rama (`merge-base`).\n'
      + '      No se cae hacia `origin/main`: ese respaldo silencioso es el defecto de SCRUM-723.');
  } else if (partida.ficheros.length < 50) {
    nosupe(`   🔴 NO SUPE MIRAR: la base dio ${partida.ficheros.length} ficheros de public/. Con tan pocos, «idénticas» sería cierto por vacío.`);
  } else {
    di(`   base de la rama: ${partida.base.sha} (vía ${partida.base.ref}) · ${partida.ficheros.length} ficheros`);

    const { srv: srvMain, puerto: puertoMain } = await servirListas(partida.publico, RUTAS);
    const huella = async (p, ruta) => {
      const { page } = await abrirVista(browser, p, ruta, 1280);
      const html = await page.evaluate("document.querySelector('#view-container').innerHTML");
      await page.close();
      return {
        sha: crypto.createHash('sha256').update(html).digest('hex').slice(0, 16),
        largo: html.length,
        // 🔴 EL SUELO NO ES EL TAMAÑO, ES QUE HAYA LISTA. Una pantalla de error mide 555
        // caracteres y comparada consigo misma sale «idéntica»: un verde por no haber mirado.
        // Quien compara exige que la pantalla haya pintado FILAS, y por eso se devuelve el HTML.
        _html: html,
      };
    };
    for (const h of HERMANAS) {
      const a = await huella(puertoMain, h.ruta);
      const b = await huella(puerto, h.ruta);
      const filasA = (a._html.match(/<tr[\s>]/g) || []).length;
      if (filasA < 2) {
        nosupe(`   🔴 NO SUPE MIRAR · ${h.rotulo}: la pantalla de origin/main pintó ${filasA} <tr> (${a.largo} caracteres).\n`
          + '      Dos pantallas de error también salen idénticas: eso no es un control, es un vacío.');
      } else if (a.sha !== b.sha) {
        mal(`   🔴 ${h.rotulo} HA CAMBIADO · origin/main ${a.sha} (${a.largo}) ≠ hoy ${b.sha} (${b.largo})`);
      } else {
        di(`   ✅ ${h.rotulo} · ${a.sha} · ${a.largo} caracteres, idéntico`);
      }
    }
    // CONTROL POSITIVO: la que SÍ se ha tocado tiene que salir DISTINTA. Si saliera igual, el
    // comparador estaría mirando otra cosa y los cuatro verdes de arriba no significarían nada.
    const tA = await huella(puertoMain, '/trabajos20');
    const tB = await huella(puerto, '/trabajos20');
    if (tA.sha === tB.sha) {
      nosupe('   🔴 NO SUPE MIRAR: Trabajos sale IDÉNTICA a origin/main. Este ticket la cambia entera,\n'
        + '      así que el comparador no está leyendo lo que cree. Los cuatro verdes de arriba no valen.');
    } else {
      di(`   ✅ control positivo · Trabajos SÍ cambia · ${tA.sha} → ${tB.sha}`);
      // SCRUM-831 · a Albaranes se le exige que su cambio sea EL DECLARADO, no un hash. Ver el
      // porqué junto a `HERMANAS`.
      const a = await huella(puertoMain, '/albaranes');
      const b = await huella(puerto, '/albaranes');
      const tieneAccion = /class="cell-actions"[^>]*>\s*<button/.test(b._html.replace(/\n/g, ''));
      const tieneTrabajo = /class="cell-trabajo"/.test(b._html);
      const antesTeniaEnlaceEnAcciones = /class="cell-actions"[^>]*>\s*<a/.test(a._html.replace(/\n/g, ''));
      if (a.sha === b.sha) {
        nosupe('   🔴 NO SUPE MIRAR: Albaranes sale IDÉNTICA al punto de partida, y SCRUM-831 la cambia.\n'
          + '      El comparador no está leyendo lo que cree.');
      } else if (!tieneTrabajo || !tieneAccion) {
        mal(`   🔴 Albaranes cambió, pero NO en lo declarado · acción en la ranura: ${tieneAccion} · `
          + `Trabajo en su celda: ${tieneTrabajo}`);
      } else {
        di('   ✅ Albaranes cambia EN LO DECLARADO: acción en `.cell-actions`, Trabajo en `.cell-trabajo`'
          + (antesTeniaEnlaceEnAcciones ? ' (antes había un enlace en la ranura de acciones)' : ''));
      }
    }
    srvMain.close();
  }
  partida.limpiar();
}

await browser.close();
srv.close();

di('');
if (ciego) { console.error(`🔴 NO SUPE MIRAR en ${ciego} sitio(s): un silencio así no es un verde.`); process.exit(2); }
if (fallos) { console.error(`🔴 ${fallos} defecto(s).`); process.exit(1); }
di('✅ el candado aguanta en las dos direcciones, el fallo revierte, no hay scroll horizontal, y las hermanas están donde deben.');
