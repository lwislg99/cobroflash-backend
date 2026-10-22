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
// ── SCRUM-962e · LA POBLACIÓN, LA VARA, LOS ESTADOS Y LA ETIQUETA, DECLARADOS ─────────────────
// S2 midió que este censo fallaba en las dos direcciones (SCRUM-962, tramos 962b y 962b (2)).
// Desde 962e (el porqué de cada pieza, en `_censo-distintos.mjs`):
//   ⒜ mide `POBLACION` = controles + campos de formulario, y lo dice. Los campos NO tienen vara
//     escrita en DESIGN.md: se cuentan aparte y no se suman a los cortos.
//   ⒝ abre los estados que sabe abrir (`ESTADOS`, con control de que se abrieron) y lo que no se
//     pinta en ninguno sale como SIN MIRAR, con su número y su pantalla.
//   ⒞ juzga con `minimoPara(ancho)` y separa los `btn-sm` exentos por §5.
//   ⒟ una casilla dentro de una `<label>` que la controla se mide por la etiqueta.
// Y siete sondas por superficie y anchura (`SONDAS_HTML`), una por avería, de clases que el
// selector podría dejar fuera. La cifra vieja se sigue imprimiendo al final, para comparar.
//
// SALIDAS: 0 censo completo · 2 no supe medir (sonda fallida, estado que no abre, o cero superficies).
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from './_navegador.mjs';
import { FUENTE_MEDIDOR, INTERACTIVOS, MINIMO_TACTIL, MINIMO_ESCRITORIO, CORTE_MOVIL } from './_medidor-de-toque.mjs';
import { serializar, paginaDeClientes } from './_pagina-panel.mjs';
import { cargarDashboard, pintarVista, todos } from '../tests/_banco-vistas.mjs';
import {
  cortosDistintos, distintosCon, sinMirar, veredicto, juzgarSondas,
  CONTROLES, CAMPOS, CASILLAS, POBLACION, ARBITRO_ETIQUETA, SONDAS_HTML,
} from './_censo-distintos.mjs';
import { datosDelCenso, ARGUMENTOS_DEL_CENSO, parametrosDe, avisoDeVistaSinPedir, avisoDeRutaSinContrato } from './_datos-del-censo.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(RAIZ, 'public');
const ANCHOS = [929, 390];
const MINIMO_SUPERFICIES = 10;

// ⒝ LOS ESTADOS QUE EL CENSO SABE ABRIR. El HTML se sirve serializado, sin JS: no se puede pulsar
// la pestaña, así que se reproduce lo que hace el producto al pulsarla. Configuración:
// `pintarNav` (settingsView.js) pone su panel en `flex` y los demás en `none`. S2 lo midió así y
// pulsando de verdad, y las dos medidas difieren en ≤0,5 px (SCRUM-962, tramo 962b ②).
// Cada estado abierto se COMPRUEBA (su panel se pinta y los demás no): si no, sale 2.
const ESTADOS = {
  renderSettingsView: { paneles: '.settings-panel[data-submenu]', clave: 'submenu', mostrar: 'flex' },
};

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

// ═══ ① CENSO DE SUPERFICIES ══════════════════════════════════════════════════════════════════
const VISTAS = vistasDelBanco();
const superficies = [];
const noMedidas = [];
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
}
// Clientes se monta con SU helper —el mismo que usa el guard— porque necesita una fila
// seleccionada para que la barra del móvil exista.
const cli = await paginaDeClientes(RAIZ);
if (cli.aviso) noMedidas.push(['renderCustomersView', 'el helper del guard no la pudo montar: ' + cli.aviso]);
else {
  const i = superficies.findIndex((s) => s.fn === 'renderCustomersView');
  const entrada = { fn: 'renderCustomersView', html: cli.html, viaHelper: true };
  if (i >= 0) superficies[i] = entrada; else superficies.push(entrada);
}

decir('═══ ① SUPERFICIES ═══');
// SCRUM-1560e · con los NOMBRES: esta línea es la que copia el resumen del CI, y con sólo el número
// la ficha del gasto pasó de 1 a 2 sin que nadie supiera cuál era la nueva.
const nombresNoMedidas = noMedidas.length ? ` (${noMedidas.map(([fn]) => fn).join(', ')})` : '';
decir(`vistas que publica el banco: ${VISTAS.length} · montadas y serializadas: ${superficies.length} · NO medidas: ${noMedidas.length}${nombresNoMedidas}`
  + ` · sin argumentos: ${sinPedir.length} · rutas SIN contrato: ${DC.sinContrato.size}`);
const hayClientes = superficies.some((s) => s.fn === 'renderCustomersView');
decir(`✅ CONTROL POSITIVO · ¿está la de Clientes, que ya está montada en el guard? ${hayClientes ? 'sí' : '🔴 NO'}`);
if (!hayClientes) noSupe('🔴 CIEGO: sin la superficie que ya sabemos montar, el resto del censo no se sostiene.');
if (superficies.length < MINIMO_SUPERFICIES) {
  noSupe(`🔴 CIEGO: sólo ${superficies.length} superficies. Con una población así, los números de abajo no dicen nada.`);
}
decir('\nNO MEDIDAS (no se cuentan como cero — se dicen):');
for (const [fn, motivo] of noMedidas) decir(`   ⚠️ ${fn} → ${motivo}`);

// SCRUM-1560e · INFORMA y no bloquea (orquestador, 17-oct): no cambia la salida.
decir(`\nVISTAS QUE NO PIDIERON NADA (SCRUM-1560e) · ${sinPedir.length}`);
for (const aviso of sinPedir) decir(`   🔴 ${aviso}`);

decir(`\nDATOS DE MUESTRA (SCRUM-1560) · rutas servidas con su contrato: ${DC.servidas.size} · SIN contrato: ${DC.sinContrato.size}`);
for (const [ruta, vistas] of DC.sinContrato) decir(`   🔴 ${avisoDeRutaSinContrato(ruta, vistas)}`);
if (DC.sinContrato.size) {
  noSupe('🔴 hay vistas que piden rutas sin contrato en `_datos-del-censo.mjs`: se han montado con `null`, no con lo que da el servidor.');
}

// ═══ ② MEDIR ═════════════════════════════════════════════════════════════════════════════════
const HOJAS = '<link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/dashboard/css/styles.css">';
const pagina = (cuerpo) => '<!doctype html><html lang="es"><head><meta charset="utf-8">' + HOJAS + '</head><body>' + cuerpo + '</body></html>';
const rutas = new Map();
for (const s of superficies) {
  rutas.set('/' + s.fn, pagina(s.html));
  rutas.set('/' + s.fn + '__sonda', pagina(s.html + SONDAS_HTML));
}
const TIPOS = { '.css': 'text/css; charset=utf-8' };
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
// SCRUM-962e · sobre `POBLACION` (⒜), con la clase de cada elemento, y la casilla envuelta medida
// por su etiqueta (⒟). `viejo` y `tocablePropio` guardan lo que medía el censo antes, para la cifra
// de comparación del final.
const MEDIR = `(async (SEL, CAMPOS, CASILLAS, ARB_ETQ, VIEJO) => {
  const nodos = [...document.querySelectorAll(SEL)];
  const medidos = [], sinPintar = [], noTocables = [];
  const nombreDe = (el) => {
    let c = '';
    if (el.className && typeof el.className === 'string') c = el.className.trim().split(/\\s+/).filter(Boolean).join('.');
    // 962e · el tipo del \`input\`: «INPUT» a secas no distingue una casilla de un color o una fecha.
    const t = el.tagName === 'INPUT' ? '[' + (el.getAttribute('type') || 'text') + ']' : '';
    return el.tagName + t + (c ? '.' + c : '');
  };
  const pinta = (x) => { const r = x.getBoundingClientRect(); return !!(r.width && r.height); };
  for (const [i, el] of nodos.entries()) {
    const clase = el.matches(CAMPOS) ? 'campo' : el.matches(CASILLAS) ? 'casilla' : 'control';
    // SCRUM-1559b · \`i\` es la identidad del elemento a los dos anchos (ver _censo-distintos.mjs).
    // ⒟ la etiqueta cuenta sólo si ENVUELVE a la casilla y la controla (\`label.control\`): una
    // etiqueta con \`for\` puesta en otro sitio es otro objetivo, no el mismo más grande.
    const lab = clase === 'casilla' ? el.closest('label') : null;
    const etq = lab && lab.control === el && pinta(lab) ? lab : null;
    const rotulo = el.textContent || (el.labels && el.labels[0] && el.labels[0].textContent) || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '';
    const ficha = { i, id: el.id || '', sel: nombreDe(el), clase, viejo: el.matches(VIEJO),
      texto: rotulo.replace(/\\s+/g, ' ').trim().slice(0, 34) || '(sin texto)' };
    if (!pinta(el) && !etq) { sinPintar.push(ficha); continue; }
    const propio = pinta(el) ? await window.__areaDeToque(el, SEL, { scroll: true }) : { error: 'la casilla no se pinta' };
    const deEtq = etq ? await window.__areaDeToque(etq, ARB_ETQ, { scroll: true }) : null;
    const buenos = [propio, deEtq].filter((m) => m && !m.error);
    if (!buenos.length) { noTocables.push({ ...ficha, motivo: propio.error || (deEtq && deEtq.error) }); continue; }
    const tocable = Math.max(...buenos.map((m) => m.tocable));
    medidos.push({ ...ficha, caja: propio.caja ?? (deEtq && deEtq.caja), tocable,
      tocablePropio: propio.error ? null : propio.tocable,
      viaEtiqueta: !!(deEtq && !deEtq.error && deEtq.tocable === tocable && deEtq.tocable > (propio.tocable || 0)) });
  }
  return { medidos, sinPintar, noTocables, total: nodos.length };
})`;
const EVAL = `${FUENTE_MEDIDOR};${MEDIR}(${[POBLACION, CAMPOS, CASILLAS, ARBITRO_ETIQUETA, INTERACTIVOS].map((s) => JSON.stringify(s)).join(', ')})`;

// ⒝ Abre el estado `clave` de una superficie y COMPRUEBA que se abrió. `null` lista las claves.
const ABRIR = (e) => `((clave) => {
  const ps = [...document.querySelectorAll(${JSON.stringify(e.paneles)})];
  if (clave == null) return ps.map((p) => p.dataset[${JSON.stringify(e.clave)}]);
  for (const p of ps) p.style.display = p.dataset[${JSON.stringify(e.clave)}] === clave ? ${JSON.stringify(e.mostrar)} : 'none';
  const pinta = (p) => { const r = p.getBoundingClientRect(); return !!(r.width && r.height); };
  const suyo = (p) => p.dataset[${JSON.stringify(e.clave)}] === clave;
  const abierto = ps.every((p) => (getComputedStyle(p).display !== 'none') === suyo(p)) && !ps.some((p) => !suyo(p) && pinta(p));
  // Abierto y sin altura = el panel está VACÍO con estos datos (no es lo mismo que no abrirlo).
  return { abierto, vacio: abierto && !ps.filter(suyo).some(pinta) };
})`;

const navegador = await lanzarNavegador(puppeteer, {});
const resultados = [];
const sondasFallidas = [];
const estadosFallidos = [];
const estadosVacios = [];
for (const ancho of ANCHOS) {
  for (const s of superficies) {
    const page = await navegador.newPage();
    await page.setViewport({ width: ancho, height: 900 });

    await page.goto(`http://127.0.0.1:${PUERTO}/${s.fn}__sonda`, { waitUntil: 'load' });
    for (const f of juzgarSondas(await page.evaluate(EVAL), ancho)) sondasFallidas.push(`${s.fn} @${ancho}px · ${f}`);

    await page.goto(`http://127.0.0.1:${PUERTO}/${s.fn}`, { waitUntil: 'load' });
    resultados.push({ fn: s.fn, ancho, estado: null, ...(await page.evaluate(EVAL)) });

    const e = ESTADOS[s.fn];
    if (e) {
      const claves = await page.evaluate(`${ABRIR(e)}(null)`);
      if (!claves.length) estadosFallidos.push(`${s.fn} @${ancho}px: no encuentra ningún «${e.paneles}»`);
      for (const clave of claves) {
        await page.goto(`http://127.0.0.1:${PUERTO}/${s.fn}`, { waitUntil: 'load' });
        const ab = await page.evaluate(`${ABRIR(e)}(${JSON.stringify(clave)})`);
        if (!ab.abierto) {
          estadosFallidos.push(`${s.fn}#${clave} @${ancho}px: al abrirlo su panel sigue oculto, o se ve otro`);
          continue;
        }
        if (ab.vacio) estadosVacios.push(`${s.fn}#${clave} @${ancho}px`);
        resultados.push({ fn: s.fn, ancho, estado: clave, ...(await page.evaluate(EVAL)) });
      }
    }
    await page.close();
  }
}
await navegador.close();
srv.close();
for (const r of resultados) for (const m of r.medidos) { m.veredicto = veredicto(m, r.ancho); m.cumple = m.veredicto === 'cumple'; }

decir('\n═══ ✅ LAS SONDAS (una por avería: ⒜ campo · ⒝ oculto · ⒞ 40 px y btn-sm · ⒟ casilla envuelta y suelta) ═══');
decir(`superficies × anchuras: ${superficies.length * ANCHOS.length} · sondas NO cazadas: ${sondasFallidas.length}`);
for (const s of sondasFallidas) decir('   🔴 NO SUPE MEDIR: ' + s);
if (sondasFallidas.length) {
  noSupe('🔴 hay sondas que no cazan su avería: los números de abajo no valen y el total está incompleto.');
}
const abiertos = resultados.filter((r) => r.estado).length;
decir(`estados abiertos además del montaje: ${abiertos} · que NO se abrieron: ${estadosFallidos.length}`);
for (const s of estadosFallidos) decir('   🔴 ESTADO NO ABIERTO: ' + s);
decir(`abiertos y VACÍOS con los datos de muestra (lo que pintarían con otros datos no está en la población): ${estadosVacios.length}`);
for (const s of estadosVacios) decir('   ⚠️ ' + s);
if (estadosFallidos.length) noSupe('🔴 un estado declarado en ESTADOS no se abre: lo de dentro no está medido.');

// ═══ ③ EL NÚMERO ═════════════════════════════════════════════════════════════════════════════
decir('\n═══ ③ POR PANTALLA, ANCHURA Y ESTADO ═══');
decir(`población: controles (${CONTROLES})`);
decir(`         + campos (${CAMPOS})`);
decir(`vara: ${MINIMO_TACTIL} px hasta ${CORTE_MOVIL} px de ancho, ${MINIMO_ESCRITORIO} por encima (DESIGN.md §5) · btn-sm exento · campos sin vara escrita`);
decir('pantalla'.padEnd(42) + 'ancho  medidos  cortos  exentos  campos  sinPintar  noTocables');
const cuenta = (r, v) => r.medidos.filter((m) => m.veredicto === v).length;
for (const r of resultados) {
  decir((r.fn + (r.estado ? '#' + r.estado : '')).padEnd(42) + String(r.ancho).padEnd(7) + String(r.medidos.length).padEnd(9)
    + String(cuenta(r, 'corto')).padEnd(8) + String(cuenta(r, 'exento')).padEnd(9) + String(cuenta(r, 'campo')).padEnd(8)
    + String(r.sinPintar.length).padEnd(11) + r.noTocables.length);
}

const cortos = distintosCon(resultados, 'corto');
const exentos = distintosCon(resultados, 'exento');
const camposBajo = distintosCon(resultados, 'campo');
const sinVer = sinMirar(resultados);
const poblacion = new Map();
for (const r of resultados) {
  for (const m of [...r.medidos, ...r.noTocables, ...r.sinPintar]) poblacion.set(`${r.fn}|${m.i}`, m.clase);
}
const porClase = (c) => [...poblacion.values()].filter((x) => x === c).length;
const noTocablesDistintos = new Set();
const medidosDistintos = new Set();
for (const r of resultados) {
  for (const m of r.medidos) medidosDistintos.add(`${r.fn}|${m.i}`);
  for (const m of r.noTocables) noTocablesDistintos.add(`${r.fn}|${m.i}`);
}
for (const k of medidosDistintos) noTocablesDistintos.delete(k);
const porEtiqueta = new Map();
for (const r of resultados) {
  for (const m of r.medidos) {
    const k = `${r.fn}|${m.i}`;
    if (m.viaEtiqueta && (!porEtiqueta.has(k) || m.tocable < porEtiqueta.get(k).tocable)) porEtiqueta.set(k, { fn: r.fn, sel: m.sel, texto: m.texto, tocable: m.tocable, propio: m.tocablePropio });
  }
}
// A qué anchuras salió cada distinto con ese veredicto: un corto sólo en móvil no es uno de escritorio.
const anchosCon = (cual) => {
  const a = new Map();
  for (const r of resultados) for (const m of r.medidos) if (m.veredicto === cual) {
    const k = `${r.fn}|${m.i}`;
    if (!a.has(k)) a.set(k, new Set());
    a.get(k).add(r.ancho);
  }
  return a;
};

const lista = (titulo, mapa, cual) => {
  const anchos = anchosCon(cual);
  decir(`\n═══ ${titulo} · ${mapa.size} ═══`);
  for (const [k, v] of [...mapa.entries()].sort((a, b) => a[1].fn.localeCompare(b[1].fn) || a[1].tocable - b[1].tocable)) {
    const en = [...(anchos.get(k) || [])].sort((x, y) => x - y).join('+');
    decir(`   ${v.fn.padEnd(30)} ${String(v.tocable).padStart(5)} px @${en.padEnd(7)} ${v.sel.slice(0, 44).padEnd(44)} «${v.texto}»`);
  }
};
lista('CORTOS con la vara de DESIGN.md §5 (la lista que se arregla)', cortos, 'corto');
lista('CAMPOS bajo la vara de los botones (DESIGN.md no les da altura: NO son cortos hasta que se fije)', camposBajo, 'campo');
lista('EXENTOS por DESIGN.md §5 (btn-sm por debajo de la vara)', exentos, 'exento');
decir(`\n═══ CASILLAS medidas por su ETIQUETA envolvente (⒟: sola, la casilla mide lo de «propio») · ${porEtiqueta.size} ═══`);
for (const v of [...porEtiqueta.values()].sort((a, b) => a.fn.localeCompare(b.fn))) {
  decir(`   ${v.fn.padEnd(30)} ${String(v.tocable).padStart(5)} px (propio ${v.propio ?? '—'})  ${v.sel.slice(0, 36).padEnd(36)} «${v.texto}»`);
}

decir(`\n═══ SIN MIRAR (no se pintan en ningún estado abierto: NO son cero) · ${sinVer.size} ═══`);
const sinPorPantalla = new Map();
for (const v of sinVer.values()) sinPorPantalla.set(v.fn, (sinPorPantalla.get(v.fn) || 0) + 1);
for (const [fn, n] of [...sinPorPantalla.entries()].sort((a, b) => b[1] - a[1])) decir(`   ${String(n).padStart(4)}  ${fn}`);

// La cifra VIEJA, con lo que medía antes (población INTERACTIVOS, el <input> solo, 44 a las dos
// anchuras y sólo el montaje), para que el salto se pueda leer. Va al final: el resumen del CI copia
// de «EL NÚMERO» hasta la línea «SIN .btn-sm».
const viejos = cortosDistintos(resultados.filter((r) => !r.estado).map((r) => ({
  ...r, medidos: r.medidos.filter((m) => m.viejo && m.tocablePropio != null)
    .map((m) => ({ ...m, tocable: m.tocablePropio, cumple: m.tocablePropio >= MINIMO_TACTIL })),
})));
const mediciones = resultados.filter((r) => !r.estado)
  .reduce((t, r) => t + r.medidos.filter((m) => m.viejo && m.tocablePropio != null && m.tocablePropio < MINIMO_TACTIL).length, 0);
const esSm = (sel) => sel.includes('btn-sm');
const smDistintos = [...viejos.values()].filter((v) => esSm(v.sel)).length;

decir('\n═══ EL NÚMERO ═══');
decir(`   población: ${poblacion.size} elementos distintos en ${new Set(resultados.map((r) => r.fn)).size} pantallas (controles ${porClase('control')} · casillas ${porClase('casilla')} · campos ${porClase('campo')})`);
decir(`   CORTOS con la vara de DESIGN.md §5: ${cortos.size}`);
decir(`   exentos por §5 (btn-sm bajo la vara): ${exentos.size}`);
decir(`   campos bajo la vara, SIN vara escrita en DESIGN.md: ${camposBajo.size}`);
decir(`   casillas medidas por su etiqueta envolvente: ${porEtiqueta.size}`);
decir(`   SIN MIRAR (no pintados en ningún estado): ${sinVer.size} · no tocables: ${noTocablesDistintos.size}`);
decir(`   — la cifra VIEJA, para comparar (INTERACTIVOS, sólo el <input>, ${MINIMO_TACTIL} a las dos anchuras, sólo el montaje):`);
decir(`   elementos DISTINTOS por debajo de ${MINIMO_TACTIL} px: ${viejos.size}`);
decir(`   mediciones (pantalla × anchura × elemento): ${mediciones}`);
decir(`   de los distintos, con .btn-sm: ${smDistintos} (${viejos.size ? (100 * smDistintos / viejos.size).toFixed(1) : '—'} %)`);
decir(`   de los distintos, SIN .btn-sm: ${viejos.size - smDistintos}`);

// ═══ ✅ CONTROL POSITIVO FINAL: reproducir lo que el guard imprime para Clientes ══════════════
decir('\n═══ ✅ CONTROL POSITIVO · Clientes, contra lo que imprime el guard ═══');
for (const ancho of ANCHOS) {
  const r = resultados.find((x) => x.fn === 'renderCustomersView' && x.ancho === ancho && !x.estado);
  if (!r) { noSupe(`   🔴 no he medido Clientes a ${ancho}px`); continue; }
  // Con la población y la vara del guard (las viejas), que es contra lo que se compara.
  const comoElGuard = r.medidos.filter((m) => m.viejo && m.tocablePropio != null);
  const cortosGuard = comoElGuard.filter((m) => m.tocablePropio < MINIMO_TACTIL);
  decir(`   @${ancho}px → medidos ${comoElGuard.length} · cortos ${cortosGuard.length} · no tocables ${r.noTocables.filter((m) => m.viejo).length}`);
  for (const c of cortosGuard) decir(`        ${c.sel.padEnd(34)} ${String(c.tocablePropio).padEnd(6)} «${c.texto}»`);
}
decir('   (el guard imprime, hoy: 929 → 20 medidos / 11 cortos / 6 no tocables · 390 → 19 / 2 / 6)');

process.exit(salida);
