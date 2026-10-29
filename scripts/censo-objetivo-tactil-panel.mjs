// scripts/censo-objetivo-tactil-panel.mjs — SCRUM-787
//
//   npm run censo:tactil-panel
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// CUÁNTOS OBJETIVOS DE TOQUE DEL PANEL NO LLEGAN A LOS 44 px DE AB6. **ESTO NO ARREGLA NADA.**
//
// SCRUM-782 añadió la lista de Clientes al guard de objetivo táctil y, en cuanto miró, encontró
// botones `.btn-sm` a 30,8–31,0 px que llevaban ahí desde siempre. `.btn-sm` está en TODA la
// aplicación, así que la pregunta que quedó abierta es **cuántos son en total** — y sin ese
// número no se puede decidir si se toca una clase compartida.
//
// ── POR QUÉ ES UN CENSO Y NO UN GUARD ───────────────────────────────────────────────────────
// Medir es barato; VIGILAR cuesta segundos en cada PR. Lo que cuestan juntos los guards de navegador
// lo CUENTA `npm run censo:guards-navegador`, a mano: no está en ningún workflow, así que no es
// vigilancia (SCRUM-1178). Este censo, en cambio, corre en CADA PR desde SCRUM-1179-C, en el job
// informativo de guards de navegador: cuenta y deja su número en el resumen, y NO bloquea nada.
// Qué superficies merecen entrar al guard lo decide el asesor.
//
// ── EL ÁRBITRO ES EL DEL GUARD, NO UNA COPIA ────────────────────────────────────────────────
// Se importa `FUENTE_MEDIDOR` de `_medidor-de-toque.mjs`, que instala `window.__areaDeToque` y
// mide con `elementsFromPoint` expandiendo desde el centro.
//
// 🔴 **LA CAJA CSS NO DECIDE, Y NO ES UN DETALLE DE ESTILO.** La caja miente siempre hacia el
// lado cómodo: en este mismo árbol hay un `BUTTON.detail-miga-link` cuya caja parece razonable y
// cuyo ÁREA DE TOQUE son 19,6 px. Un censo por caja habría dado un número más bonito y falso.
//
// ── LA POBLACIÓN SE DERIVA ──────────────────────────────────────────────────────────────────
// Las vistas son las que el banco PUBLICA (`render*View`), como en SCRUM-698. Una lista escrita a
// mano envejece y convertiría esto en «cuento lo que escribí».
//
// ── LO QUE NO SE PUEDE MEDIR SE DICE ────────────────────────────────────────────────────────
// Una vista que no monta, o que serializa un árbol ridículo, sale en `NO MEDIDAS` con su motivo.
// **No se cuenta como cero.** Un cero por no haber mirado es la peor cifra posible.
//
// ── Y CADA SUPERFICIE SE PRUEBA CON UNA SONDA ───────────────────────────────────────────────
// Un botón deliberadamente pequeño inyectado en CADA superficie y CADA anchura tiene que salir
// corto. La superficie que no lo caza **no está medida**, aunque devuelva cero. La sonda va en el
// HTML que se sirve, en memoria: **no se toca ningún fichero del árbol**.
//
// ── LO OCULTO NO ES «SIN PINTAR»: SE ABRE, Y LO QUE NO SE ABRE SE DICE (SCRUM-1593) ──────────
// Un interactivo sin caja era `sinPintar`, estuviera dentro de un panel con `display:none` o no. Los
// dos `select` de Facturación (Configuración) salían ahí, y miden 38,9 px de toque: cortos de verdad
// que el censo daba como «nada que tocar». Ahora:
//   ① cada `[role="tab"]` de la vista se PULSA en el banco, con el oyente del producto, y el estado
//     que deja se mide como una página más (misma identidad de elemento que la de montar);
//   ② lo que sigue oculto en todos los estados y anchuras sale como NO MEDIDO, con esa palabra, y
//     aparte queda `sinCaja`: visible y sin caja, que sí es «no hay nada que tocar».
// ⚠️ ① sólo sabe abrir PESTAÑAS. Pasos de asistente, desplegables y bloques que se abren con otro
// gesto siguen ocultos, y por eso cuentan en el «no medidos»: no está resuelto, está dicho.
//
// SALIDAS: 0 censo completo · 2 no supe medir (sonda fallida, o cero superficies).
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from './_navegador.mjs';
import { enlacesDelPanel, TIPOS_DE_FUENTE, esperarFuentes, cegueraDeLaFuente, decirFuente } from './_hojas-del-panel.mjs';
import { FUENTE_MEDIDOR, INTERACTIVOS, MINIMO_TACTIL } from './_medidor-de-toque.mjs';
import { serializar, paginaDeClientes } from './_pagina-panel.mjs';
import { cargarDashboard, pintarVista, todos } from '../tests/_banco-vistas.mjs';
import { cortosDistintos, noMedidosPorOcultos, cajaYToque, leerCajaYToque } from './_censo-distintos.mjs';
import { datosDelCenso, ARGUMENTOS_DEL_CENSO, parametrosDe, avisoDeVistaSinPedir, avisoDeRutaSinContrato } from './_datos-del-censo.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(RAIZ, 'public');
const ANCHOS = [929, 390];
const SONDA_TEXTO = '.';
// SCRUM-1593 · y una segunda, OCULTA: tiene que salir en `ocultos`, no medida ni «sin caja».
const SONDA_OCULTA_TEXTO = ':';
// SCRUM-1603c · y una tercera, TAPADA: caja de 40 px con los 10 de arriba cubiertos por un bloque que
// no es interactivo, así que su toque son 30. Es el control de que el censo imprime la CAJA y no el
// toque dos veces: tiene que salir con las dos cifras distintas, y cada una en su sitio.
const SONDA_TAPADA_TEXTO = ';';
const SONDA_TAPADA = { caja: 40, tocable: 30 };
const SONDA = '<button id="__sonda" style="width:12px;height:12px;padding:0;border:0">' + SONDA_TEXTO + '</button>'
  + '<div style="display:none"><button id="__sondaOculta">' + SONDA_OCULTA_TEXTO + '</button></div>'
  + '<div style="position:relative;width:120px;height:40px;margin:0">'
  + '<button id="__sondaTapada" style="display:block;box-sizing:border-box;width:120px;height:40px;min-height:0;padding:0;border:0;margin:0">' + SONDA_TAPADA_TEXTO + '</button>'
  + '<div style="position:absolute;left:0;top:0;width:120px;height:10px"></div></div>';
const MINIMO_SUPERFICIES = 10;

let salida = 0;
const decir = (s) => console.log(s);
const noSupe = (s) => { console.error(s); salida = 2; };

// 🔴 SCRUM-1560 · LOS DATOS DE MUESTRA, CON LA FORMA QUE DA EL SERVIDOR. Aquí vivía un `DATOS` que
// servía ocho rutas y a las demás les devolvía `[]`: 28 rutas reales caían en ese relleno (varias
// son OBJETO en el servidor), seis recibían el dato de otra y cinco vistas de detalle se montaban
// sin id. Ahora cada ruta tiene contrato, con fichero:línea del servidor, en `_datos-del-censo.mjs`
// (el Trabajo, los Clientes y la 360 siguen siendo los MISMOS fixtures que usa el guard). Una ruta
// sin contrato recibe `null` y se dice abajo: con una respuesta inventada no hay pantalla medida.
const DC = datosDelCenso();
const DATOS = DC.datos;

const BANCO = cargarDashboard(RAIZ);
const vistasDelBanco = () => Object.keys(BANCO.ctx).filter((k) => /^render[A-Z].*View$/.test(k) && typeof BANCO.ctx[k] === 'function').sort();

// ═══ SCRUM-1593 · LAS PESTAÑAS, ABIERTAS COMO LAS ABRE EL PRODUCTO ═══════════════════════════
// Se pulsa cada `[role="tab"]` no seleccionado con el oyente que le puso la vista, y el estado que
// queda se serializa. La barra se vuelve a buscar tras cada clic: Configuración la REPINTA entera.
// Lo que no se pudo abrir no se mide ni se inventa: se apunta en `avisos` y su contenido sigue oculto,
// así que cae en el «no medidos» de abajo.
const rotuloDe = (n) => String(n.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30) || '(sin rótulo)';
const pestanasDe = (c) => todos(c).filter((x) => typeof x.getAttribute === 'function' && x.getAttribute('role') === 'tab');
async function abrirPestanas(fn, contenedor, htmlBase) {
  const estados = [];
  const avisos = [];
  const iniciales = pestanasDe(contenedor);
  for (const [k, t0] of iniciales.entries()) {
    if (t0.getAttribute('aria-selected') === 'true') continue;
    const t = pestanasDe(contenedor)[k];
    if (!t) { avisos.push(`${fn}: la pestaña ${k + 1} de ${iniciales.length} ya no está tras pulsar otra`); continue; }
    const rotulo = rotuloDe(t);
    const rechazos = [];
    const anota = (e) => rechazos.push(String((e && e.message) || e).slice(0, 70));
    process.on('unhandledRejection', anota);
    try {
      t.click();
      for (let j = 0; j < 10; j++) await new Promise((ok) => setImmediate(ok));
    } catch (e) {
      rechazos.push('reventó al pulsarla: ' + String(e.message).slice(0, 70));
    } finally {
      process.off('unhandledRejection', anota);
    }
    if (rechazos.length) { avisos.push(`${fn} · pestaña «${rotulo}»: ${rechazos.join(' · ')}`); continue; }
    const html = serializar(contenedor);
    if (html === htmlBase || estados.some((e) => e.html === html)) {
      avisos.push(`${fn} · pestaña «${rotulo}»: pulsarla no cambia nada en el banco`);
      continue;
    }
    estados.push({ estado: `pestaña «${rotulo}»`, html });
  }
  return { estados, avisos, pestanas: iniciales.length };
}

// ═══ ① CENSO DE SUPERFICIES ══════════════════════════════════════════════════════════════════
const VISTAS = vistasDelBanco();
const superficies = [];
const noMedidas = [];
// SCRUM-1593 · los estados que deja cada pestaña pulsada, y las que no se dejaron abrir.
const estadosAbiertos = [];
const pestanasSinAbrir = [];
let pestanasVistas = 0;
// SCRUM-1560e · las que no llegaron al suelo SIN haber pedido nada: les faltan sus argumentos.
const sinPedir = [];
for (const fn of VISTAS) {
  let r;
  // SCRUM-795 · con los argumentos que el producto le pasa a la vista, si los necesita. La ficha
  // 360 montaba 2 nodos y salía en «NO MEDIDAS» por esto, no por estar vacía.
  // SCRUM-1560 · y las de detalle, con el id que les da `app.js`, no `NaN` ni `undefined`.
  DC.enVista(fn);
  try { r = await pintarVista(cargarDashboard(RAIZ, { datos: DATOS }), fn, ...(ARGUMENTOS_DEL_CENSO[fn] || [])); }
  catch (e) { noMedidas.push([fn, 'el banco no la pudo montar: ' + String(e.message).slice(0, 70)]); continue; }
  if (r.error) { noMedidas.push([fn, 'no monta: ' + String(r.error.message).slice(0, 70)]); continue; }
  let html;
  try { html = serializar(r.contenedor); }
  catch (e) { noMedidas.push([fn, 'no serializa: ' + String(e.message).slice(0, 70)]); continue; }
  const nodos = todos(r.contenedor).length;
  // Una vista con cuatro nodos no es una vista medida: es una vista que no llegó a pintarse.
  // SCRUM-1560e · y el motivo se dice entero: «no pidió nada» y «pidió y pintó poco» son dos
  // defectos distintos, con arreglos distintos, y antes salían con el mismo rótulo.
  if (nodos < 20) {
    const pedidas = DC.pedidasDe(fn);
    if (pedidas === 0) {
      sinPedir.push(avisoDeVistaSinPedir(fn, parametrosDe(BANCO.ctx[fn]), nodos));
      noMedidas.push([fn, 'no pidió nada al servidor: le faltan sus argumentos (abajo, en «VISTAS QUE NO PIDIERON NADA», qué añadir)']);
    } else {
      noMedidas.push([fn, `sólo ${nodos} nodos con ${pedidas} petición(es) servida(s): la vista es así de pequeña con estos datos, o el dato de su contrato no la llena`]);
    }
    continue;
  }
  superficies.push({ fn, html });
  const p = await abrirPestanas(fn, r.contenedor, html);
  pestanasVistas += p.pestanas;
  pestanasSinAbrir.push(...p.avisos);
  for (const e of p.estados) estadosAbiertos.push({ fn, ...e });
}
// Clientes se monta con SU helper —el mismo que usa el guard— porque necesita una fila
// seleccionada para que la barra del móvil exista.
const cli = await paginaDeClientes(RAIZ);
if (cli.aviso) noMedidas.push(['renderCustomersView', 'el helper del guard no la pudo montar: ' + cli.aviso]);
else {
  const i = superficies.findIndex((s) => s.fn === 'renderCustomersView');
  const entrada = { fn: 'renderCustomersView', html: cli.html, viaHelper: true };
  if (i >= 0) superficies[i] = entrada; else superficies.push(entrada);
  // SCRUM-1593 · sus pestañas, si las tuviera, eran de OTRO montaje: no comparten identidad con éste.
  for (let k = estadosAbiertos.length - 1; k >= 0; k--) if (estadosAbiertos[k].fn === 'renderCustomersView') estadosAbiertos.splice(k, 1);
}

decir('═══ ① SUPERFICIES ═══');
// SCRUM-1560e · con los NOMBRES: esta línea es la que copia el resumen del CI, y con sólo el número
// la ficha del gasto pasó de 1 a 2 sin que nadie supiera cuál era la nueva.
const nombresNoMedidas = noMedidas.length ? ` (${noMedidas.map(([fn]) => fn).join(', ')})` : '';
decir(`vistas que publica el banco: ${VISTAS.length} · montadas y serializadas: ${superficies.length} · NO medidas: ${noMedidas.length}${nombresNoMedidas}`
  + ` · sin argumentos: ${sinPedir.length} · rutas SIN contrato: ${DC.sinContrato.size}`
  + ` · pestañas abiertas: ${estadosAbiertos.length} de ${pestanasVistas} (${new Set(estadosAbiertos.map((e) => e.fn)).size} pantalla(s))`);
const hayClientes = superficies.some((s) => s.fn === 'renderCustomersView');
decir(`✅ CONTROL POSITIVO · ¿está la de Clientes, que ya está montada en el guard? ${hayClientes ? 'sí' : '🔴 NO'}`);
if (!hayClientes) noSupe('🔴 CIEGO: sin la superficie que ya sabemos montar, el resto del censo no se sostiene.');
// SCRUM-1593 · Configuración tiene sus submenús como pestañas: si no se abre NINGUNO, el abridor no
// funciona y el «no medidos» de abajo estaría contando lo que el censo dice saber abrir.
const configAbierta = estadosAbiertos.filter((e) => e.fn === 'renderSettingsView').length;
decir(`✅ CONTROL POSITIVO · ¿se abren las pestañas de Configuración? ${configAbierta ? `sí, ${configAbierta}` : '🔴 NO'}`);
if (!configAbierta) noSupe('🔴 CIEGO: el censo no abre ni las pestañas de Configuración; lo que cuente como oculto no es de fiar.');
if (superficies.length < MINIMO_SUPERFICIES) {
  noSupe(`🔴 CIEGO: sólo ${superficies.length} superficies. Con una población así, los números de abajo no dicen nada.`);
}
decir('\nNO MEDIDAS (no se cuentan como cero — se dicen):');
for (const [fn, motivo] of noMedidas) decir(`   ⚠️ ${fn} → ${motivo}`);

decir(`\nPESTAÑAS QUE NO SE DEJARON ABRIR (SCRUM-1593; su contenido sigue oculto y cuenta como NO MEDIDO) · ${pestanasSinAbrir.length}`);
for (const aviso of pestanasSinAbrir) decir(`   ⚠️ ${aviso}`);

// SCRUM-1560e · INFORMA y no bloquea (orquestador, 17-oct): no cambia la salida.
decir(`\nVISTAS QUE NO PIDIERON NADA (SCRUM-1560e) · ${sinPedir.length}`);
for (const aviso of sinPedir) decir(`   🔴 ${aviso}`);

decir(`\nDATOS DE MUESTRA (SCRUM-1560) · rutas servidas con su contrato: ${DC.servidas.size} · SIN contrato: ${DC.sinContrato.size}`);
for (const [ruta, vistas] of DC.sinContrato) decir(`   🔴 ${avisoDeRutaSinContrato(ruta, vistas)}`);
if (DC.sinContrato.size) {
  noSupe('🔴 hay vistas que piden rutas sin contrato en `_datos-del-censo.mjs`: se han montado con `null`, no con lo que da el servidor.');
}

// ═══ ② MEDIR ═════════════════════════════════════════════════════════════════════════════════
// SCRUM-1603 · las hojas salen DEL ÍNDICE, con `/fonts/inter.css`: sin ella se medía con la fuente de
// reserva y no con la de la app (el campo `.input`, 36 px en el banco y 34 en producción).
const HOJAS = enlacesDelPanel(PUBLIC);
const pagina = (cuerpo) => '<!doctype html><html lang="es"><head><meta charset="utf-8">' + HOJAS + '</head><body>' + cuerpo + '</body></html>';
// SCRUM-1593 · cada estado abierto es una página más, con su sonda, igual que la de montar.
const paginas = [
  ...superficies.map((s) => ({ fn: s.fn, estado: null, ruta: s.fn, html: s.html })),
  ...estadosAbiertos.map((e, k) => ({ fn: e.fn, estado: e.estado, ruta: `${e.fn}~${k}`, html: e.html })),
];
const rutas = new Map();
for (const s of paginas) {
  rutas.set('/' + s.ruta, pagina(s.html));
  rutas.set('/' + s.ruta + '__sonda', pagina(s.html + SONDA));
}
const TIPOS = { '.css': 'text/css; charset=utf-8', ...TIPOS_DE_FUENTE };
const srv = http.createServer((rq, res) => {
  const u = rq.url.split('?')[0];
  if (rutas.has(u)) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(rutas.get(u)); }
  const d = path.join(PUBLIC, u.replace(/^\/+/, ''));
  if (!d.startsWith(PUBLIC) || !fs.existsSync(d)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(d)] || 'application/octet-stream' });
  return res.end(fs.readFileSync(d));
});
const PUERTO = await new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv.address().port)));

// El recorrido: mismo criterio que el guard —censo derivado del DOM, con scroll, y el área de
// toque como árbitro—, escrito una vez aquí en vez de copiar el medidor.
const MEDIR = `(async (SEL, MIN) => {
  const nodos = [...document.querySelectorAll(SEL)];
  // SCRUM-1593 · sin caja, dos cosas que no se mezclan: OCULTO (él o un antepasado con display:none:
  // no se ha podido mirar) y SIN CAJA estando visible (no hay nada que tocar).
  const medidos = [], ocultos = [], sinCaja = [], noTocables = [];
  const oculto = (el) => {
    if (typeof el.checkVisibility === 'function') return !el.checkVisibility();
    for (let n = el; n; n = n.parentElement) if (getComputedStyle(n).display === 'none') return true;
    return false;
  };
  const nombreDe = (el) => {
    let c = '';
    if (el.className && typeof el.className === 'string') c = el.className.trim().split(/\\s+/).filter(Boolean).join('.');
    return el.tagName + (c ? '.' + c : '');
  };
  for (const [i, el] of nodos.entries()) {
    const r0 = el.getBoundingClientRect();
    // SCRUM-1559b · \`i\` es la identidad del elemento a los dos anchos (ver _censo-distintos.mjs).
    const ficha = { i, sel: nombreDe(el), texto: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 34) || '(sin texto)' };
    if (!r0.width || !r0.height) { (oculto(el) ? ocultos : sinCaja).push(ficha); continue; }
    const m = await window.__areaDeToque(el, SEL, { scroll: true });
    if (m.error) { noTocables.push({ ...ficha, motivo: m.error }); continue; }
    medidos.push({ ...ficha, caja: m.caja, tocable: m.tocable, cumple: m.tocable >= MIN });
  }
  return { medidos, ocultos, sinCaja, noTocables, total: nodos.length };
})`;
const EVAL = `${FUENTE_MEDIDOR};${MEDIR}(${JSON.stringify(INTERACTIVOS)}, ${MINIMO_TACTIL})`;

const navegador = await lanzarNavegador(puppeteer, {});
const resultados = [];
const sondasFallidas = [];
// SCRUM-1603c · cómo salió impresa la sonda tapada, y en cuántas páginas.
const tapadasLeidas = new Map();
// SCRUM-1603 · navegar y ESPERAR la fuente (font-display: swap pinta primero con la de reserva). Una
// página cuyas caras no cargan no está medida con la fuente de la app: se apunta y el censo lo dice.
const fuentesVistas = new Map();
const fuentesRotas = [];
const ir = async (page, ruta) => {
  await page.goto(`http://127.0.0.1:${PUERTO}${ruta}`, { waitUntil: 'load' });
  const f = await esperarFuentes(page);
  const ceguera = cegueraDeLaFuente(f, ruta);
  if (ceguera) fuentesRotas.push(ceguera);
  fuentesVistas.set(decirFuente(f), (fuentesVistas.get(decirFuente(f)) || 0) + 1);
  return f;
};
for (const ancho of ANCHOS) {
  for (const s of paginas) {
    const page = await navegador.newPage();
    await page.setViewport({ width: ancho, height: 900 });
    const nombre = s.fn + (s.estado ? ' · ' + s.estado : '');

    await ir(page, `/${s.ruta}__sonda`);
    const rs = await page.evaluate(EVAL);
    const sonda = rs.medidos.find((m) => m.sel === 'BUTTON' && m.texto === SONDA_TEXTO);
    if (!sonda || sonda.cumple !== false) {
      sondasFallidas.push(`${nombre} @${ancho}px (${sonda ? 'medida pero NO marcada corta' : 'ni siquiera medida'})`);
    }
    // SCRUM-1593 · la oculta tiene que salir en `ocultos`: si sale en `sinCaja`, el censo vuelve a
    // decir «no hay nada» de lo que no ha podido mirar.
    const esOculta = (m) => m.sel === 'BUTTON' && m.texto === SONDA_OCULTA_TEXTO;
    if (!rs.ocultos.some(esOculta) || rs.sinCaja.some(esOculta) || rs.medidos.some(esOculta)) {
      sondasFallidas.push(`${nombre} @${ancho}px (la sonda OCULTA no sale como oculta)`);
    }
    // SCRUM-1603c · la tapada se lee de la LÍNEA impresa, no del objeto: lo que se controla es lo que sale.
    const tapada = rs.medidos.find((m) => m.sel === 'BUTTON' && m.texto === SONDA_TAPADA_TEXTO);
    const leida = tapada ? leerCajaYToque(cajaYToque(tapada)) : null;
    if (!leida || Math.abs(leida.caja - SONDA_TAPADA.caja) > 1 || Math.abs(leida.tocable - SONDA_TAPADA.tocable) > 1) {
      sondasFallidas.push(`${nombre} @${ancho}px (la sonda TAPADA sale «${tapada ? cajaYToque(tapada) : 'ni siquiera medida'}» y no «${cajaYToque(SONDA_TAPADA)}»)`);
    } else {
      tapadasLeidas.set(cajaYToque(tapada), (tapadasLeidas.get(cajaYToque(tapada)) || 0) + 1);
    }

    await ir(page, `/${s.ruta}`);
    resultados.push({ fn: s.fn, pantalla: s.fn, estado: s.estado, ancho, ...(await page.evaluate(EVAL)) });
    await page.close();
  }
}

// SCRUM-1593 · un estado es el MISMO DOM que el de montar, así que su `i` es el mismo nodo. Si el
// recuento de interactivos cambia, ya no lo es: ese estado se cuenta con identidad propia, y se dice.
const identidadPropia = [];
for (const r of resultados.filter((x) => x.estado)) {
  const base = resultados.find((x) => x.fn === r.fn && !x.estado && x.ancho === r.ancho);
  if (!base || base.total !== r.total) {
    identidadPropia.push(`${r.fn} · ${r.estado} @${r.ancho}px: ${r.total} interactivos frente a ${base ? base.total : '—'} al montar`);
    r.fn = `${r.fn} · ${r.estado}`;
  }
}
await navegador.close();
srv.close();

decir('\n═══ ✅ LA SONDA ═══');
decir(`páginas × anchuras: ${paginas.length * ANCHOS.length} (${superficies.length} superficies + ${estadosAbiertos.length} pestañas abiertas) · sondas NO cazadas: ${sondasFallidas.length}`);
for (const s of sondasFallidas) decir('   🔴 SUPERFICIE NO MEDIDA: ' + s);
// SCRUM-1603c · la caja y el toque salen distintos donde deben diferir; si no, no se imprime la caja.
for (const [linea, n] of tapadasLeidas) decir(`✅ CONTROL POSITIVO · sonda tapada (se espera ${cajaYToque(SONDA_TAPADA)}): ${linea} · en ${n} página(s)`);
if (sondasFallidas.length) {
  noSupe('🔴 hay superficies que no cazan un objetivo de 12 px: sus ceros no valen y el total está incompleto.');
}
// SCRUM-1603 · con qué fuente se ha medido, y en cuántas páginas.
for (const [linea, n] of fuentesVistas) decir(`${linea} · en ${n} página(s)`);
for (const s of fuentesRotas) decir('   ' + s);
if (fuentesRotas.length || !fuentesVistas.size) {
  noSupe('🔴 hay páginas que no se midieron con la fuente que declaran: sus cifras no son las de la app.');
}

// ═══ ③ EL NÚMERO ═════════════════════════════════════════════════════════════════════════════
decir('\n═══ ③ POR PANTALLA Y ANCHURA ═══');
// SCRUM-1593 · `ocultos` = no se han podido mirar en ESTA página; `sinCaja` = visibles sin caja.
decir('pantalla'.padEnd(30) + 'ancho  medidos  cortos  ocultos  sinCaja  noTocables');
for (const r of resultados) {
  const nombre = r.estado ? ('  · ' + r.pantalla.replace(/^render|View$/g, '') + ' ' + r.estado.replace(/^pestaña /, '')).slice(0, 29) : r.pantalla;
  decir(nombre.padEnd(30) + String(r.ancho).padEnd(7) + String(r.medidos.length).padEnd(9)
    + String(r.medidos.filter((m) => !m.cumple).length).padEnd(8)
    + String(r.ocultos.length).padEnd(9) + String(r.sinCaja.length).padEnd(9) + r.noTocables.length);
}
for (const s of identidadPropia) decir(`   ⚠️ identidad propia (cambia el recuento al abrir la pestaña): ${s}`);

// SCRUM-1593 · lo que sólo se ve abriendo una pestaña: cortos de un estado que al montar no se midieron.
decir('\n═══ ③ CORTOS QUE SÓLO SE VEN ABRIENDO UNA PESTAÑA (SCRUM-1593) ═══');
let soloAbriendo = 0;
for (const r of resultados.filter((x) => x.estado)) {
  const base = resultados.find((x) => x.fn === r.fn && !x.estado && x.ancho === r.ancho);
  const yaMedidos = new Set(base ? base.medidos.map((m) => m.i) : []);
  for (const c of r.medidos.filter((m) => !m.cumple && !yaMedidos.has(m.i))) {
    soloAbriendo += 1;
    decir(`   ${r.pantalla} · ${r.estado} @${r.ancho}px  ${c.sel.padEnd(28)} ${cajaYToque(c)}  «${c.texto}»`);
  }
}
decir(`   mediciones así: ${soloAbriendo}`);

// Un elemento es el MISMO aunque se mida a dos anchuras: pantalla + su posición en el DOM servido.
// 🔴 SCRUM-1559b · era pantalla + selector + texto, y los tres «💬» de Clientes contaban UNO.
const distintos = cortosDistintos(resultados);
const mediciones = resultados.reduce((t, r) => t + r.medidos.filter((m) => !m.cumple).length, 0);
const esSm = (sel) => sel.includes('btn-sm');
const smDistintos = [...distintos.values()].filter((v) => esSm(v.sel)).length;

decir('\n═══ ③ POR CLASE (elementos DISTINTOS, sin duplicar por anchura) ═══');
const porClase = new Map();
for (const v of distintos.values()) {
  if (!porClase.has(v.sel)) porClase.set(v.sel, { n: 0, min: Infinity, max: 0, cajaMin: Infinity, cajaMax: 0, pant: new Set(), ej: new Set() });
  const e = porClase.get(v.sel);
  e.n += 1; e.min = Math.min(e.min, v.tocable); e.max = Math.max(e.max, v.tocable);
  e.cajaMin = Math.min(e.cajaMin, v.caja); e.cajaMax = Math.max(e.cajaMax, v.caja);
  e.pant.add(v.fn); if (e.ej.size < 3) e.ej.add(v.texto);
}
for (const [sel, e] of [...porClase.entries()].sort((a, b) => b[1].n - a[1].n)) {
  decir(`   ${String(e.n).padStart(3)}  ${sel.padEnd(42)} toque ${e.min.toFixed(1)}–${e.max.toFixed(1)} px · caja ${e.cajaMin.toFixed(1)}–${e.cajaMax.toFixed(1)} px · ${e.pant.size} pantalla(s) · p.ej. ${[...e.ej].join(' / ')}`);
}

// SCRUM-1593 · los que NINGÚN estado ni anchura dejó mirar. No son cero cortos: son sin medir.
const noMedidosOcultos = noMedidosPorOcultos(resultados);
decir(`\n═══ NO MEDIDOS POR ESTAR OCULTOS (SCRUM-1593) · ${noMedidosOcultos.size} ═══`);
decir('   ocultos en todos los estados que el censo sabe abrir (sólo pestañas) y a las dos anchuras:');
const ocultosPorPantalla = new Map();
for (const v of noMedidosOcultos.values()) {
  if (!ocultosPorPantalla.has(v.fn)) ocultosPorPantalla.set(v.fn, new Map());
  const porSel = ocultosPorPantalla.get(v.fn);
  porSel.set(v.sel, (porSel.get(v.sel) || 0) + 1);
}
for (const [fn, porSel] of [...ocultosPorPantalla.entries()].sort((a, b) => b[1].size - a[1].size)) {
  decir(`   ${fn}: ${[...porSel.entries()].map(([sel, n]) => `${n}× ${sel}`).join(' · ')}`);
}

decir('\n═══ EL NÚMERO ═══');
decir(`   elementos DISTINTOS por debajo de ${MINIMO_TACTIL} px: ${distintos.size}`);
decir(`   interactivos NO MEDIDOS por estar ocultos (ni abriendo pestañas se ven): ${noMedidosOcultos.size}, en ${ocultosPorPantalla.size} pantalla(s)`);
decir(`   mediciones (pantalla × anchura × elemento): ${mediciones}`);
decir(`   de los distintos, con .btn-sm: ${smDistintos} (${distintos.size ? (100 * smDistintos / distintos.size).toFixed(1) : '—'} %)`);
decir(`   de los distintos, SIN .btn-sm: ${distintos.size - smDistintos}`);

// ═══ ✅ CONTROL POSITIVO FINAL: reproducir lo que el guard imprime para Clientes ══════════════
decir('\n═══ ✅ CONTROL POSITIVO · Clientes, contra lo que imprime el guard ═══');
for (const ancho of ANCHOS) {
  const r = resultados.find((x) => x.fn === 'renderCustomersView' && !x.estado && x.ancho === ancho);
  if (!r) { noSupe(`   🔴 no he medido Clientes a ${ancho}px`); continue; }
  const cortos = r.medidos.filter((m) => !m.cumple);
  decir(`   @${ancho}px → medidos ${r.medidos.length} · cortos ${cortos.length} · no tocables ${r.noTocables.length}`);
  // SCRUM-1603c · con la CAJA: la aceptación de 1603 pide la caja de `.input`, y aquí sólo salía el toque.
  for (const c of cortos) decir(`        ${c.sel.padEnd(34)} ${cajaYToque(c).padEnd(22)} «${c.texto}»`);
}
decir('   (el guard imprime, hoy: 929 → 20 medidos / 11 cortos / 6 no tocables · 390 → 19 / 2 / 6)');

process.exit(salida);
