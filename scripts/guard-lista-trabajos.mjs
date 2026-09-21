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
import fs from 'node:fs';
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
// ── SCRUM-979 · CLIENTES TAMPOCO SE COMPARA POR HASH A SECAS, por el mismo motivo que Albaranes ──
//
// SCRUM-979 le da A PROPÓSITO la columna «Última visita» y el filtro de 6/12/24 meses, así que su
// hash cambia. No se retira del control: se le exige que su diferencia con la base sea EXACTAMENTE
// la declarada — quitadas esas tres piezas, el HTML tiene que salir IDÉNTICO al de la base. Es más
// fuerte que el hash de antes: dice «cambió solo en lo que dijo».
const HERMANAS = [
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
    // SCRUM-917c · los técnicos ya no son columna (td.cell-tecnicos): viven en la línea del
    // cliente. Leer la celda vieja daba «» siempre, que parecía una respuesta y era un vacío.
    celda: (document.querySelector('${SEL_FILA} td.cell-client .jobs-fila-linea') || {}).textContent || null,
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

// ═══ ⑥ LAS HERMANAS, CONTRA EL PUNTO DE PARTIDA — Y EL COMPARADOR SE CALIBRA ANTES ══════
titulo('⑥ las hermanas: TRES idénticas por hash · Albaranes trae LO DECLARADO · y el comparador se calibra primero (SCRUM-843)');
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
    // ═══ SCRUM-843 · EL CONTROL POSITIVO NO PUEDE DEPENDER DE UN TICKET SIN MERGEAR ═══════════
    //
    // 🔴 QUÉ HABÍA AQUÍ, Y POR QUÉ CAMBIA. El control positivo era: «Trabajos —la lista que aquel
    // ticket cambiaba— tiene que salir DISTINTA del punto de partida». La intención es CORRECTA y
    // no se retira: sin ella, los tres «idéntico» de arriba podrían ser un verde por no haber
    // mirado. Lo que estaba mal era DE QUÉ DEPENDÍA.
    //
    // Porque eso sólo es cierto en la rama de aquel ticket, y sólo mientras no se ha mergeado. En
    // cuanto SCRUM-831 entró en `main`, el ancla se evaporó:
    //   · sobre `main`, `merge-base(HEAD, origin/main)` **es** HEAD → comparaba main consigo
    //     mismo, siempre idéntico;
    //   · sobre cualquier otra rama, la base ya trae el cambio dentro → también idéntico.
    // Medido el 9-sep-2026: salida 2 sobre `main`, y salida 2 en una rama que sólo tocaba un
    // fichero de `docs/`. Así que no era «main está rojo»: era TODO PR rojo. Un tapón común.
    //
    // Es la misma familia que ya nos mordió con los suelos —uno que depende de que el defecto
    // siga existiendo caduca el día que se arregla—, con una vuelta de tuerca: éste dependía de
    // que el trabajo siguiera SIN MERGEAR, o sea que caducaba con el éxito.
    //
    // 🔒 EL ANCLA NUEVA NO DEPENDE DE NINGÚN TICKET: LA FABRICA EL GUARD. Son dos preguntas, y
    // entre las dos cubren lo que cubría la vieja y algo más:
    //   Ⓐ ¿este comparador DISTINGUE contenidos? Dos rutas del MISMO servidor que pintan listas
    //     distintas tienen que dar huellas distintas. Caza un `huella` que lea el selector
    //     equivocado, que lea antes de pintar, o que devuelva siempre lo mismo.
    //   Ⓑ ¿son de verdad DOS árboles? El guard planta un centinela dentro de la copia de la base
    //     —un fichero que sólo existe ahí— y exige que el servidor de la base lo sirva y el de
    //     hoy NO. Caza el fallo que de verdad daba miedo: los dos servidores apuntando al mismo
    //     sitio, que hace que todo salga «idéntico» sin haber comparado nada.
    // Ninguna de las dos deja de ser cierta al mergear nada.

    // Ⓐ el comparador distingue contenidos.
    const calA = await huella(puertoMain, '/trabajos20');
    const calB = await huella(puertoMain, '/clientes');
    if (calA.sha === calB.sha) {
      nosupe('   🔴 NO SUPE MIRAR · calibración Ⓐ: dos listas DISTINTAS del mismo servidor dan la\n'
        + '      misma huella. El comparador no está leyendo lo que cree, así que los «idéntico»\n'
        + '      de arriba no valdrían nada.');
    } else {
      di(`   ✅ calibración Ⓐ · el comparador distingue contenidos · ${calA.sha} != ${calB.sha}`);
    }

    // Ⓑ los dos servidores son dos árboles. El centinela vive SÓLO en la copia temporal de la
    // base —nunca en el repositorio—, así que su ausencia en el de hoy es la prueba.
    const CENTINELA = '/_centinela-843.txt';
    const marca = 'ancla-que-no-caduca-' + partida.base.sha.slice(0, 12);
    fs.writeFileSync(path.join(partida.publico, CENTINELA.slice(1)), marca);
    const pide = async (pto, ruta) => {
      const r = await fetch(`http://127.0.0.1:${pto}${ruta}`);
      return { estado: r.status, cuerpo: r.ok ? (await r.text()).trim() : null };
    };
    const enLaBase = await pide(puertoMain, CENTINELA);
    const enHoy = await pide(puerto, CENTINELA);
    if (enLaBase.cuerpo !== marca) {
      nosupe(`   🔴 NO SUPE MIRAR · calibración Ⓑ: el servidor de la BASE no sirve el centinela `
        + `(estado ${enLaBase.estado}). No puedo afirmar que esté sirviendo el árbol de partida.`);
    } else if (enHoy.estado !== 404) {
      nosupe(`   🔴 NO SUPE MIRAR · calibración Ⓑ: el servidor de HOY también sirve el centinela `
        + `(estado ${enHoy.estado}), y ése sólo existe en la copia de la base. Los dos servidores\n`
        + '      están mirando el MISMO árbol: todo saldría «idéntico» sin haber comparado nada.');
    } else {
      di('   ✅ calibración Ⓑ · son dos árboles · la base sirve el centinela, hoy da 404');
    }

    // Trabajos: se DICE si cambió o no, y ninguna de las dos respuestas es un veredicto. En la
    // rama que la toca cambiará; en `main` y en las demás, no. Eso es información, no un fallo.
    const tA = await huella(puertoMain, '/trabajos20');
    const tB = await huella(puerto, '/trabajos20');
    di(tA.sha === tB.sha
      ? `   · Trabajos igual que en la base · ${tA.sha}`
      : `   · Trabajos cambia respecto a la base · ${tA.sha} -> ${tB.sha}`);

    // ── SCRUM-831 · a Albaranes se le exige que su cambio sea EL DECLARADO, no un hash ────────
    //
    // 🔴 SCRUM-843 · y ese examen se hace sobre el árbol de HOY, no contra la base. Las dos
    // propiedades —una acción en `.cell-actions` y el Trabajo en `.cell-trabajo`— son ABSOLUTAS:
    // o están en lo que se pinta hoy, o no están. Exigir ADEMÁS que difiera de la base era la
    // segunda copia del mismo defecto de arriba —y ni siquiera llegaba a ejecutarse, porque la
    // primera saltaba antes—. El examen NO se relaja: se le quita una condición que hablaba de
    // git y no de la pantalla, y se le añade el suelo que le faltaba.
    const b = await huella(puerto, '/albaranes');
    const filasAlb = (b._html.match(/<tr[\s>]/g) || []).length;
    const tieneAccion = /class="cell-actions"[^>]*>\s*<button/.test(b._html.replace(/\n/g, ''));
    const tieneTrabajo = /class="cell-trabajo"/.test(b._html);
    if (filasAlb < 2) {
      nosupe(`   🔴 NO SUPE MIRAR: Albaranes pintó ${filasAlb} <tr> (${b.largo} caracteres). Sin filas,\n`
        + '      «no tiene la acción» sería cierto por no haber pintado, que no es lo mismo.');
    } else if (!tieneTrabajo || !tieneAccion) {
      mal(`   🔴 Albaranes NO trae lo declarado · acción en la ranura: ${tieneAccion} · `
        + `Trabajo en su celda: ${tieneTrabajo}`);
    } else {
      di('   ✅ Albaranes trae LO DECLARADO: acción en `.cell-actions`, Trabajo en `.cell-trabajo`');
    }

    // ── SCRUM-979 · Clientes: su diferencia con la base es EXACTAMENTE la declarada ──────────
    // Las cuatro piezas, cada una por su marca y con las veces que TIENE que aparecer: una cada una
    // de las tres de la barra y la cabecera, y la celda de la fila UNA POR FILA. Si no cuadra, no se
    // sabe qué se ha quitado y el «idéntico» no valdría nada.
    const cA = await huella(puertoMain, '/clientes');
    const cB = await huella(puerto, '/clientes');
    const filasCli = (cA._html.match(/<tr[\s>]/g) || []).length;
    const filasDeDatos = (cB._html.match(/<td class="cell-title"[^>]*>/g) || []).length;
    const PIEZAS_979 = [
      ['el <th> de «Última visita»', /<th[^>]*data-columna="visita"[^>]*>[^<]*<\/th>/g, 1],
      ['el <select> del filtro', /<select[^>]*>(?:(?!<\/select>)[\s\S])*?Cualquier fecha de visita(?:(?!<\/select>)[\s\S])*?<\/select>/g, 1],
      ['su casilla en «Columnas»', /<label class="columnas-opcion"[^>]*>(?:(?!<\/label>)[\s\S])*?Última visita(?:(?!<\/label>)[\s\S])*?<\/label>/g, 1],
      ['la celda de cada fila', /<td class="(?:col-hide-mobile )?cell-visita"[^>]*>[^<]*<\/td>/g, filasDeDatos],
    ];
    // ── SCRUM-1032 · Clientes: teléfono y correo pasan a ENLACES (`tel:`, `wa.me`, `mailto:`) ────
    // Declaración EXACTA y MÍNIMA (autorizada por el orquestador, 21-sep-2026: es un cambio
    // deliberado de Clientes, no un guard silenciado). Cada pieza se DESHACE a su texto de antes,
    // con su forma completa —cada atributo escrito—, y las veces que TIENE que aparecer: una por
    // fila de cliente. Lo que queda tiene que salir IDÉNTICO a la base, así que un enlace que
    // cambie de forma, o cualquier otro cambio del HTML, sigue poniendo el guard en rojo.
    // El móvil no está aquí a propósito: las muestras no lo llevan, y si algún día lo llevan el guard
    // caerá pidiendo declararlo.
    const PIEZAS_1032 = [
      ['el teléfono de cada fila como enlace (y su «WhatsApp»)',
        /<td class="cell-date"><div class="contacto"><a class="contacto-link" href="tel:\+?\d+">([^<]*)<\/a>(?:<a class="contacto-link contacto-link--icono" href="https:\/\/wa\.me\/\d+" aria-label="WhatsApp" title="WhatsApp" target="_blank" rel="noopener">💬<\/a>)?<\/div><\/td>/g,
        filasDeDatos, '<td class="cell-date">$1</td>'],
      ['el correo de cada fila como enlace',
        /<a class="contacto-link" href="mailto:[^"]*">([^<]*)<\/a>/g,
        filasDeDatos, '$1'],
    ];
    const PIEZAS_DECLARADAS = [...PIEZAS_979, ...PIEZAS_1032];
    const cuentas = PIEZAS_DECLARADAS.map(([nombre, re, esperadas]) => [nombre, (cB._html.match(re) || []).length, esperadas]);
    // 🔴 SE DESHACEN LAS MISMAS PIEZAS EN LOS DOS LADOS. Antes sólo se quitaban de HOY y se comparaba con
    // la base «tal cual», y eso valía mientras la base NO trajera lo declarado. Desde que SCRUM-979 está
    // en `main` la base YA lleva sus cuatro piezas: quitárselas sólo a hoy daba SIEMPRE «ha cambiado
    // MÁS de lo declarado», aunque el único cambio fuera el declarado (medido con SCRUM-1032, que fue el
    // primero en cambiar Clientes después). Quitarlas de los dos lados exige lo mismo que antes —que
    // el resto sea idéntico— sin depender de si la base ya las trae; una pieza que la base no tiene no
    // se toca, porque su patrón no casa.
    const deshacer = (html) => PIEZAS_DECLARADAS.reduce((h, [, re, , sustituto = '']) => h.replace(re, sustituto), html);
    const sha = (html) => crypto.createHash('sha256').update(html).digest('hex').slice(0, 16);
    const shaSin = sha(deshacer(cB._html));
    const shaBaseSin = sha(deshacer(cA._html));
    if (filasCli < 2 || filasDeDatos < 1) {
      nosupe(`   🔴 NO SUPE MIRAR · Clientes: la base pintó ${filasCli} <tr> y hoy ${filasDeDatos} filas de cliente.`);
    } else if (cuentas.some(([, n, esperadas]) => n !== esperadas)) {
      mal('   🔴 Clientes NO trae lo declarado por SCRUM-979 y SCRUM-1032 · '
        + cuentas.map(([nombre, n, esperadas]) => `${nombre}: ${n} de ${esperadas}`).join(' · '));
    } else if (cA.sha === cB.sha) {
      // La base ya trae 979 y 1032: entonces lo que se exige es lo de siempre, que no haya cambiado nada.
      di(`   ✅ Clientes · ${cA.sha} · idéntico a la base (que ya trae SCRUM-979 y SCRUM-1032)`);
    } else if (shaSin !== shaBaseSin) {
      mal(`   🔴 Clientes ha cambiado MÁS de lo declarado por SCRUM-979 y SCRUM-1032 · base sin lo declarado ${shaBaseSin} ≠ hoy sin lo declarado ${shaSin}`);
    } else {
      di(`   ✅ Clientes trae LO DECLARADO (SCRUM-979 y SCRUM-1032) y nada más · sin esas piezas (${filasDeDatos} celdas de cada fila), idéntico a la base sin ellas ${shaBaseSin}`);
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
