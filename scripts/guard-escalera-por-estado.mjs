// scripts/guard-escalera-por-estado.mjs — SCRUM-823
//
// LA MISMA ESCALERA EN LAS DOS PANTALLAS, ESTADO POR ESTADO Y CORRIENDO.
//
// 🔒 Una sola fuente alimentada con dos datos distintos no es una sola fuente — y una sola fuente
// que sólo UNA pantalla sabe ejecutar tampoco. SCRUM-823 le añade a `jobNextAction` un nivel que
// depende del estado del Trabajo, y esa escalera la usan la LISTA y el DETALLE. Si las dos dejan
// de decir —o de poder hacer— lo mismo, hemos vuelto al defecto que SCRUM-366 cerró.
//
// Lo que se mide, para cada uno de los CINCO estados reales de la FSM:
//   ① la LISTA y el DETALLE proponen EL MISMO rótulo. No «llaman a la misma función»: dicen lo
//     mismo, leído del DOM pintado.
//   ② «Agendar» se puede EJECUTAR en las dos: abre el modal de fecha, no navega y no deja el
//     botón colgado. Medido antes del ticket, el detalle se quedaba en «Enviando…» para siempre.
//   ③ un Trabajo CERRADO no propone nada en ninguna de las dos.
//
// Fuera de `npm test` porque la suite no arranca navegador (misma decisión que el resto de guards
// de navegador). La red que SÍ corre siempre es `tests/scrum823-la-escalera-mira-el-estado.test.mjs`.
//
// Salidas: 0 de acuerdo · 1 defecto · 2 NO SUPE MIRAR · 3 no arrancó el navegador.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { servirListas, abrirNavegador, abrirVista } from './_banco-lista.mjs';
import { trabajosDeMuestra, reglasDeDatos, EQUIPO } from './_trabajos-de-muestra.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ESTADOS = ['pendiente_agendar', 'agendado', 'en_curso', 'terminado', 'cerrado'];

let fallos = 0;
let ciego = 0;
const di = (s) => console.log(s);
const mal = (s) => { console.error(s); fallos += 1; };
const nosupe = (s) => { console.error(s); ciego += 1; };

/** Un Trabajo por estado, con la forma que manda `serializeJob` desde SCRUM-816. */
function trabajoEn(estado) {
  return {
    ...trabajosDeMuestra(1, { conDocumentos: false })[0],
    id: 1,
    status: estado,
    scheduledAt: estado === 'pendiente_agendar' ? null : '2026-09-10T09:30:00.000Z',
    // Sin resto: así el nivel del dinero no tapa lo que este guard viene a mirar. El caso CON
    // resto lo cubre la matriz de `tests/scrum823-…`, que no necesita navegador.
    remaining: null,
    albaranes: [],
    invoices: [],
    charge: null,
    entregaPendiente: null,
    customer: { id: 1, name: 'Carmen Ruiz', phone: null, email: null, taxId: null },
    asignados: [EQUIPO[0]],
  };
}

const datosDetalle = (job) => `(function (ruta) {
  var J = ${JSON.stringify(job)};
  if (/\\/admin\\/jobs\\/1\\/gastos/.test(ruta)) return [];
  if (/\\/admin\\/jobs\\/1/.test(ruta)) return J;
  if (/\\/admin\\/team/.test(ruta)) return ${JSON.stringify(EQUIPO)};
  if (/\\/admin\\/merchant/.test(ruta)) return { id: 1, name: 'Fontanería Soler' };
  return [];
})`;

const RUTAS = [];
for (const estado of ESTADOS) {
  const job = trabajoEn(estado);
  RUTAS.push({ ruta: `/lista-${estado}`, fnVista: 'renderJobsView', datos: reglasDeDatos([job]) });
  RUTAS.push({ ruta: `/detalle-${estado}`, fnVista: 'renderJobDetailView', datos: datosDetalle(job), args: '[1]' });
}

const { srv, puerto } = await servirListas(path.join(RAIZ, 'public'), RUTAS);
const { browser, quien } = await abrirNavegador(puppeteer);
di('navegador: ' + quien);
process.on('exit', () => { try { srv.close(); } catch { /* ya cerrado */ } });

// 🔴 EL GRUPO «CERRADOS» NACE PLEGADO, y sin desplegarlo no hay fila que medir. La primera
// versión de este guard decía «NO SUPE MIRAR · cerrado: sin filas» en ① y, peor, en ③ daba
// «✅ sin acción principal» — un VERDE por no haber fila, no por no haber botón. Lo cazó su propio
// suelo. Se pulsa el «Ver N cerrados» del producto antes de mirar, con el mecanismo del producto.
const DESPLEGAR = `(() => {
  const b = document.querySelector('#view-container .jobs-grupo-abrir button');
  if (b) b.click();
  return !!b;
})()`;

// El rótulo del primario de cada pantalla. `null` = no hay primario, que es una respuesta.
const PRIMARIO_LISTA = `(() => {
  const tr = document.querySelector('#view-container tr.jobs-fila');
  if (!tr) return { error: 'sin filas que medir ni siquiera tras desplegar los grupos' };
  const b = tr.querySelector('.jobs-acciones > button.btn-primary');
  return { rotulo: b ? b.textContent.trim() : null, nodos: document.querySelectorAll('#view-container *').length };
})()`;
const PRIMARIO_DETALLE = `(() => {
  const n = document.querySelectorAll('#view-container *').length;
  if (n < 20) return { error: 'la ficha no monta (' + n + ' nodos)' };
  // El CTA del héroe vive en la cabecera del patrón; el resto de primarias de la pantalla (como
  // «Consolidar seleccionados») no son la siguiente acción y no se comparan.
  const b = document.querySelector('#view-container .detail-head button.btn-primary')
    || document.querySelector('#view-container [data-accion="cta"] button.btn-primary');
  return { rotulo: b ? b.textContent.trim() : null, nodos: n };
})()`;

di('\n══════════════════════════════════════════════════════════════════════════════════════');
di('① LA LISTA Y EL DETALLE DICEN LO MISMO, ESTADO POR ESTADO');
di('══════════════════════════════════════════════════════════════════════════════════════');
di('estado'.padEnd(20) + 'LISTA'.padEnd(24) + 'DETALLE');
di('─'.repeat(86));

let vistos = new Set();
for (const estado of ESTADOS) {
  const a = await abrirVista(browser, puerto, `/lista-${estado}`, 1280);
  await a.page.evaluate(DESPLEGAR);
  const rl = await a.page.evaluate(PRIMARIO_LISTA);
  await a.page.close();
  const b = await abrirVista(browser, puerto, `/detalle-${estado}`, 1280);
  const rd = await b.page.evaluate(PRIMARIO_DETALLE);
  await b.page.close();

  if (rl.error || rd.error) {
    nosupe(`   🔴 NO SUPE MIRAR · ${estado}: ${rl.error || ''} ${rd.error || ''}`);
    continue;
  }
  const txt = (v) => (v === null ? '(ninguna)' : `«${v}»`);
  const igual = rl.rotulo === rd.rotulo;
  di(estado.padEnd(20) + txt(rl.rotulo).padEnd(24) + txt(rd.rotulo) + (igual ? '' : '   🔴 DISTINTAS'));
  if (!igual) {
    mal(`   🔴 ${estado}: la lista propone ${txt(rl.rotulo)} y el detalle ${txt(rd.rotulo)}.\n`
      + '      Es el defecto que SCRUM-366 cerró, otra vez: dos pantallas diciendo cosas distintas\n'
      + '      del mismo Trabajo.');
  }
  vistos.add(String(rl.rotulo));
}

// SUELO: si los cinco estados dieran lo mismo, «coinciden» sería cierto por vacío — que es
// exactamente lo que pasaba ANTES del ticket, cuando la escalera no miraba el estado.
if (vistos.size < 3) {
  nosupe(`\n   🔴 NO SUPE MIRAR: los cinco estados dan ${vistos.size} rótulo(s) distinto(s).\n`
    + '      Antes del ticket daban UNO para los cinco. Con menos de tres, «las dos pantallas\n'
    + '      coinciden» no prueba nada: coincidirían aunque la escalera no mirase el estado.');
} else {
  di(`\n   ✅ SUELO · los cinco estados dan ${vistos.size} rótulos distintos: hay algo que comparar`);
}

di('\n══════════════════════════════════════════════════════════════════════════════════════');
di('② «Agendar» SE PUEDE EJECUTAR EN LAS DOS — y no navega, y no deja el botón colgado');
di('══════════════════════════════════════════════════════════════════════════════════════');
for (const [ruta, quienEs, sel] of [
  [`/lista-pendiente_agendar`, 'LISTA', '#view-container tr.jobs-fila .jobs-acciones > button.btn-primary'],
  [`/detalle-pendiente_agendar`, 'DETALLE', '#view-container .detail-head button.btn-primary'],
]) {
  const { page } = await abrirVista(browser, puerto, ruta, 1280);
  const antes = await page.evaluate(`(() => {
    const b = document.querySelector('${sel}');
    return b ? { rotulo: b.textContent.trim() } : null;
  })()`);
  if (!antes) {
    nosupe(`   🔴 NO SUPE MIRAR · ${quienEs}: no encuentro el primario que pulsar.`);
    await page.close();
    continue;
  }
  if (antes.rotulo !== 'Agendar') {
    mal(`   🔴 ${quienEs}: el primario de un Trabajo sin fecha dice «${antes.rotulo}».`);
    await page.close();
    continue;
  }
  await page.click(sel);
  await new Promise((r) => setTimeout(r, 500));
  const despues = await page.evaluate(`(() => {
    const b = document.querySelector('${sel}');
    return {
      rotulo: b ? b.textContent.trim() : '(desapareció)',
      deshabilitado: b ? b.disabled : null,
      modal: !!document.querySelector('.modal-overlay'),
      campoFecha: !!document.querySelector('#jobs-agendar-fecha'),
      navegaciones: window.__navegaciones.length,
      escrituras: window.__peticiones.filter((p) => p.metodo !== 'GET').length,
    };
  })()`);
  const bien = despues.modal && despues.campoFecha && despues.navegaciones === 0
    && despues.deshabilitado === false && despues.rotulo === 'Agendar';
  di(`   ${quienEs}: modal ${despues.modal ? '✅' : '🔴'} · campo de fecha ${despues.campoFecha ? '✅' : '🔴'} · `
    + `navegó ${despues.navegaciones === 0 ? 'no ✅' : '🔴 SÍ'} · botón «${despues.rotulo}»`
    + `${despues.deshabilitado ? ' 🔴 DESHABILITADO' : ' ✅'} · escrituras ${despues.escrituras}`);
  if (!bien) {
    mal(`   🔴 ${quienEs} no ejecuta «Agendar» como debe. Un nivel de la escalera sin ejecutor deja\n`
      + '      el botón en «Enviando…» para siempre: medido en Edge antes de este ticket.');
  }
  await page.close();
}

di('\n══════════════════════════════════════════════════════════════════════════════════════');
di('③ UN TRABAJO CERRADO NO PROPONE NADA — en ninguna de las dos');
di('══════════════════════════════════════════════════════════════════════════════════════');
for (const [ruta, quienEs, sel] of [
  ['/lista-cerrado', 'LISTA', '#view-container tr.jobs-fila .jobs-acciones > button.btn-primary'],
  ['/detalle-cerrado', 'DETALLE', '#view-container .detail-head button.btn-primary'],
]) {
  const { page } = await abrirVista(browser, puerto, ruta, 1280);
  await page.evaluate(DESPLEGAR);
  const r = await page.evaluate(`(() => {
    const b = document.querySelector('${sel}');
    return { hay: !!b, rotulo: b ? b.textContent.trim() : null, nodos: document.querySelectorAll('#view-container *').length };
  })()`);
  if (r.nodos < 20) nosupe(`   🔴 NO SUPE MIRAR · ${quienEs}: la pantalla no monta (${r.nodos} nodos).`);
  else if (r.hay) mal(`   🔴 ${quienEs}: un Trabajo CERRADO propone «${r.rotulo}». Cerrar es irreversible.`);
  else di(`   ✅ ${quienEs}: sin acción principal (${r.nodos} nodos pintados, o sea la pantalla está ahí)`);
  await page.close();
}

await browser.close();
srv.close();
di('');
if (ciego) { console.error(`🔴 NO SUPE MIRAR en ${ciego} sitio(s): un silencio así no es un verde.`); process.exit(2); }
if (fallos) { console.error(`🔴 ${fallos} defecto(s).`); process.exit(1); }
di('✅ las dos pantallas dicen y hacen lo mismo en los cinco estados.');
