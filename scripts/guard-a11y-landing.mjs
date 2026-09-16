// scripts/guard-a11y-landing.mjs — SCRUM-543 · la landing PUBLICADA, medida en el ÁRBOL DE
// ACCESIBILIDAD RENDERIZADO y en el ÁREA TOCABLE REAL (Edge via puppeteer-core).
//
// Uso:  npm run guard:a11y-landing
//
// ── LOS TRES DEFECTOS QUE VIGILA ─────────────────────────────────────────────
// ① TEXTO PEGADO. Un separador VISUAL vacío (`<span class="dot">`) o un `<br>` no aportan ni un
//    espacio al nombre accesible: se oía «Sin tarjetaListo en 5 minutos» y «Creas el
//    presupuestoDel catálogo». El sintetizador pronuncia «tarjetaListo» como una palabra.
//    🔴 Y el `<br>` es el caso instructivo: SEPARA A LA VISTA y NO en el árbol. `innerText` da
//    saltos de línea ahí, así que un guard que mirase `innerText` daría verde. El árbitro tiene
//    que ser el árbol.
// ② SECCIONES SIN NOMBRE. Una `<section>` sin nombre accesible sale como `generic`; con nombre,
//    como `region`. Sin regiones no se puede navegar por secciones, que es como se recorre una
//    página larga cuando no se ve. El nombre sale del ENCABEZADO QUE YA EXISTE (regla 30: aquí
//    no se escribe ni una palabra de copy).
// ③ TÁCTILES < 44 px (AB6). El logo medía 34 y es el que más se toca por error; «Ver planes →»,
//    24. 🔴 Y no se mide la CAJA sino QUÉ ELEMENTO RECIBE EL TOQUE (`elementsFromPoint`): el área
//    del enlace se amplía con un pseudo-elemento, así que su `getBoundingClientRect` sigue
//    diciendo 24 y estaría mintiendo hacia el lado cómodo.
//
// ── POR QUÉ FUERA DE `npm test` ──────────────────────────────────────────────
// Misma decisión que `guard:contraste`, `guard:caja-avisos`, `guard:aviso-bizum` y
// `guard:vias-de-cobro`: la suite no arranca navegador. La red que SÍ corre siempre es
// `tests/scrum543-landing-a11y.test.mjs`.
//
// ── LO QUE NO MIDE, Y SE DICE CON ESAS PALABRAS ──────────────────────────────
// Las secciones `#gremios` y `#comparativa` están EN PROPUESTA (`hidden` + su marca) y quedan
// FUERA a propósito: su copy no está aprobado y no se toca. Cuando se publiquen, entran aquí.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
// SCRUM-562 · el área que recibe el toque se mide en UN solo sitio. Aquí vivía una copia
// con el idioma viejo (`elementsFromPoint(...).includes(el)`), que da por bueno lo que otro
// elemento tapa. El porqué, en la cabecera de `_medidor-de-toque.mjs`.
import { FUENTE_MEDIDOR, INTERACTIVOS, CORTE_MOVIL, MINIMO_TACTIL, MINIMO_ESCRITORIO, minimoPara } from './_medidor-de-toque.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const PUBLIC = path.join(RAIZ, 'public');
import { lanzarNavegador } from './_navegador.mjs';
import { levantarServidor } from './_servidor.mjs';
// SCRUM-522 · la ruta ya no se escribe aqui. Era una ruta de WINDOWS por defecto, identica en
// los nueve guards, y por eso ninguno podia correr en el runner de CI —Ubuntu— donde de verdad
// hacen falta. `rutaDelNavegador` busca en los sitios conocidos y, si no hay ninguno, PARA
// declarandose ciega en vez de devolver una ruta plausible. `EDGE_PATH` sigue mandando.
// SCRUM-620 (2/2) · PUERTO EFÍMERO POR DEFECTO. `0` le pide al sistema uno libre, y el que
// toca de verdad se lee del `levantarServidor`. Quita las colisiones de raíz: contra la pasada
// anterior del propio guard (sockets en TIME_WAIT, el caso de SCRUM-617) y contra los otros.
// ⚠️ `A11Y_LANDING_PUERTO` SIGUE MANDANDO: quien quiera fijarlo, lo fija — y si ese puerto está ocupado, el
// diagnóstico del commit anterior sigue diciéndolo con su código 4. El efímero es HIGIENE;
// no sustituye al diagnóstico, y por eso entró después y en un commit propio.
let PUERTO = Number(process.env.A11Y_LANDING_PUERTO || 0);

const ANCHOS = [1280, 360];

/** ① Cada caso con lo que NO debe oírse (pegado) y lo que SÍ debe oírse (separado). */
const SEPARADORES = [
  { sel: '.note',     pegado: ['gratisSin', 'tarjetaListo'],   separado: ['gratis Sin', 'tarjeta Listo'] },
  { sel: '.try-step', pegado: ['1Creas', 'presupuestoDel'],    separado: ['1 Creas', 'presupuesto Del'] },
];

/** ② Las secciones PUBLICADAS y el encabezado con el que cada una debe anunciarse. */
const REGIONES = {
  'reg-hero': 'Del presupuesto al cobro',
  'reg-probar': 'Haz el recorrido completo',
  'reg-como': 'Tres pasos',
  'reg-todo': 'Seis herramientas',
  'reg-precios': 'Un solo plan',
  'reg-faq': 'Preguntas de compañeros',
  'reg-cta': 'Tu próxima cotización',
};

/**
 * ③ Los táctiles. El mínimo NO se escribe aquí: sale de `minimoPara(ancho)`, en el medidor común.
 *
 * 🔴 SCRUM-865 · AQUÍ HABÍA UN `44` PROPIO, y eso hacía que DOS guards pidieran cosas distintas a la
 * MISMA página. SCRUM-711 alineó `guard-objetivo-tactil` con DESIGN.md —«≥44px en móvil; el
 * escritorio se queda en 36px a propósito»— y éste se quedó exigiendo 44 a 1280. Un número repetido
 * a mano es lo que dejó que divergieran, así que no se repite: se importa.
 */
const TACTILES = [
  { sel: 'header a.logo', nombre: 'el logo' },
  { sel: '#announce a',   nombre: '«Ver planes →»', destapar: '#announce' },
];

/**
 * 🔒 SCRUM-865 · LAS SONDAS DE UMBRAL. Los dos táctiles de esta landing cumplen de sobra (45 y 47 px),
 * así que un mínimo mal aplicado NO se notaría aquí: el guard seguiría verde con 44, con 36 o con 12.
 * Estas tres lo hacen notar, en cada pasada y en cada ancho:
 *     40 px a 360 → CAE   ·   30 px a 1280 → CAE   ·   37 px a 1280 → PASA
 * Se inyectan en la página cargada y se miden con el MISMO árbitro que el resto.
 */
const SONDAS_HTML = '<div id="__sondas-865">'
  + '<button id="__sonda-40" style="display:block;box-sizing:border-box;width:120px;height:40px;min-height:0;padding:0;border:0;margin:12px 0">40</button>'
  + '<button id="__sonda-30" style="display:block;box-sizing:border-box;width:120px;height:30px;min-height:0;padding:0;border:0;margin:12px 0">30</button>'
  + '<button id="__sonda-37" style="display:block;box-sizing:border-box;width:120px;height:37px;min-height:0;padding:0;border:0;margin:12px 0">37</button>'
  + '</div>';
/** Qué se le exige a cada sonda según el ancho: `debePasar` es el veredicto que TIENE que salir. */
const SONDAS_MOVIL = [
  { id: '__sonda-40', debePasar: false },
];
const SONDAS_ESCRITORIO = [
  { id: '__sonda-30', debePasar: false },
  { id: '__sonda-37', debePasar: true },
];
const TIPOS = { '.css': 'text/css', '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };

const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const abs = path.join(PUBLIC, p);
  if (!abs.startsWith(PUBLIC) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
    res.writeHead(404); return res.end('no');
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(abs)] || 'application/octet-stream' });
  res.end(fs.readFileSync(abs));          // del DISCO en cada petición
});

/**
 * 🔴 CÓMO SE MIDE «LO QUE SE OYE», Y POR QUÉ NO SE CONCATENA A MANO.
 *
 * Dos intentos de concatenar el árbol a mano fallaron, y los dos los cazó el rojo por el
 * mecanismo, no la lectura:
 *   ① uniendo padre e hijos CON un espacio → FALSO VERDE: con `interestingOnly:false` el árbol
 *      trae el genérico y su hijo de texto con el mismo contenido, y el espacio del `join`
 *      **creaba la separación que había que comprobar**. El guard medía su propio separador.
 *   ② uniendo sólo las hojas SIN separador → ROJO PERMANENTE: el `name` de cada hoja viene ya
 *      recortado, así que el espacio real se perdía y todo salía pegado, con el arreglo puesto.
 *
 * Lo que se oye lo decide el algoritmo **accname** del navegador, que es el que une los nodos. Se
 * le pide a él: se le pone al nodo un rol que EXIGE nombre por contenido, se lee ese nombre y se
 * le quita el rol. Se hace sobre la PÁGINA CARGADA, nunca sobre el fichero.
 */
async function loQueSeOye(page, sel) {
  await page.evaluate((s) => document.querySelector(s)?.setAttribute('role', 'button'), sel);
  const nodo = await page.$(sel);
  const snap = nodo ? await page.accessibility.snapshot({ root: nodo }) : null;
  await page.evaluate((s) => document.querySelector(s)?.removeAttribute('role'), sel);
  return (snap?.name || '').trim();
}

/**
 * CALIBRACIÓN del medidor, con dos casos sintéticos de respuesta CONOCIDA — el mismo patrón que
 * los casos reales: un `<b>`, un `<span>` vacío y texto. Con espacio tiene que dar «uno dos»; sin
 * espacio, «unodos». Si el navegador dejara de distinguirlos, el guard no da veredicto.
 */
async function calibrar(page) {
  await page.evaluate(() => {
    const con = document.createElement('div'); con.id = 'cal-con'; con.setAttribute('role', 'button');
    con.innerHTML = '<b>uno</b><span></span> dos';
    const sin = document.createElement('div'); sin.id = 'cal-sin'; sin.setAttribute('role', 'button');
    sin.innerHTML = '<b>uno</b><span></span>dos';
    document.body.append(con, sin);
  });
  const leer = async (id) => {
    const n = await page.$(id);
    return ((await page.accessibility.snapshot({ root: n }))?.name || '').trim();
  };
  const con = await leer('#cal-con'), sin = await leer('#cal-sin');
  await page.evaluate(() => { document.querySelector('#cal-con')?.remove(); document.querySelector('#cal-sin')?.remove(); });
  return { ok: con === 'uno dos' && sin === 'unodos', con, sin };
}
function aplanar(n, acc = []) { if (!n) return acc; acc.push(n); for (const h of n.children || []) aplanar(h, acc); return acc; }

/**
 * ⚠️ SE COMPARA SIN DISTINGUIR MAYÚSCULAS. El árbol devuelve el texto YA TRANSFORMADO por
 * `text-transform`, así que comparar con la caja del HTML da rojo permanente sin nada roto — y un
 * rojo permanente es el que el segundo que lo vea desactiva. (Medido en SCRUM-541.)
 */
const caja = (s) => s.toLocaleUpperCase('es');

const log = (...a) => console.log(...a);
let fallos = 0;

// SCRUM-620 · el servidor se levanta por el módulo común: el ÚNICO sitio donde se decide
// qué pasa si NO se puede. Antes cada guard hacía su propio `listen` sin tratar el error, y un
// puerto ocupado subía como excepción → exit 1 → la puerta lo pintaba `rojo(1)`, o sea «he
// encontrado un defecto». Ahora para con 4 y lo dice.
PUERTO = await levantarServidor(srv, PUERTO);
// SCRUM-617 · el arranque pasa por el módulo común: el ÚNICO sitio donde se decide cómo arranca
// el navegador. Si no levanta, PARA con 3 («no pude arrancarlo»), que no es 2 («no lo encuentro»)
// ni 1 («he encontrado un defecto»). La comprobación de existencia que había aquí SALE: era una
// segunda copia del suelo, y dos sitios comprobando lo mismo divergen.
process.on('exit', () => { try { srv.close(); } catch { /* ya cerrado */ } });
const navegador = await lanzarNavegador(puppeteer, { headless: 'new' });

try {
  log('Guard de accesibilidad de la landing PUBLICADA (SCRUM-543)');
  log('Árbitros: el árbol de accesibilidad y el área que RECIBE EL TOQUE.\n');

  for (const ancho of ANCHOS) {
    const page = await navegador.newPage();
    await page.setViewport({ width: ancho, height: 900 });
    const MIN = minimoPara(ancho);
    await page.goto(`http://127.0.0.1:${PUERTO}/`, { waitUntil: 'load' });
    // La barra de anuncio nace oculta (se enciende por JS con las plazas). Se destapa AQUÍ, en la
    // página cargada, nunca en el fichero.
    await page.evaluate(() => document.querySelector('#announce')?.removeAttribute('hidden'));

    log(`── ${ancho}px`);

    // ── SUELO: ¿se puede leer el árbol y está la página que creo? ─────────────
    const raiz = await page.accessibility.snapshot({ interestingOnly: false });
    const nodos = aplanar(raiz);
    if (!raiz || nodos.length < 20) {
      console.error(`   🔴 NO SUPE MIRAR: el árbol de accesibilidad vino con ${nodos.length} nodos.`);
      fallos++; await page.close(); continue;
    }

    // ── ① SEPARADORES ────────────────────────────────────────────────────────
    const cal = await calibrar(page);
    if (!cal.ok) {
      console.error(`   🔴 NO SUPE MIRAR: la calibración falla — con espacio dio «${cal.con}» y sin espacio «${cal.sin}»; se esperaba «uno dos» y «unodos».`);
      fallos++; await page.close(); continue;
    }
    log(`   calibración OK: «${cal.con}» vs «${cal.sin}» — el medidor distingue las dos`);
    for (const caso of SEPARADORES) {
      const t = await loQueSeOye(page, caso.sel);
      if (!t) { console.error(`   🔴 NO SUPE MIRAR: ${caso.sel} no da nombre accesible`); fallos++; continue; }
      let mal = 0;
      for (const p of caso.pegado) {
        if (caja(t).includes(caja(p))) { console.error(`   ✖ ${caso.sel} se oye PEGADO: «…${p}…»`); fallos++; mal++; }
      }
      // CONTROL POSITIVO: no basta con que no esté lo pegado — tiene que estar lo separado. Si el
      // nodo se quedara vacío, «no está lo pegado» sería verdad y el guard daría verde.
      for (const s of caso.separado) {
        if (!caja(t).includes(caja(s))) { console.error(`   ✖ ${caso.sel} NO trae «${s}»: ¿ha cambiado el texto?`); fallos++; mal++; }
      }
      if (!mal) log(`   ✔ ${caso.sel} suena separado: «${t.slice(0, 62)}»`);
    }

    // ── ② REGIONES ───────────────────────────────────────────────────────────
    // Una <section> con nombre sale como `region`; sin nombre, como `generic`. Se mide el ROL.
    const regiones = nodos.filter((n) => n.role === 'region').map((n) => (n.name || '').trim());
    const faltan = [];
    for (const [id, esperado] of Object.entries(REGIONES)) {
      if (!regiones.some((r) => caja(r).includes(caja(esperado)))) faltan.push(`${id} («${esperado}…»)`);
    }
    if (faltan.length) {
      console.error(`   ✖ secciones que NO llegan como región con nombre: ${faltan.join(', ')}`);
      fallos++;
    } else {
      log(`   ✔ ${regiones.length} regiones con nombre, las ${Object.keys(REGIONES).length} publicadas entre ellas`);
    }

    // ── ③ TÁCTILES ───────────────────────────────────────────────────────────
    await page.evaluate(FUENTE_MEDIDOR);   // instala window.__areaDeToque
    for (const t of TACTILES) {
      const medida = await page.evaluate(async (sel, sel2, min) => {
        const m = await window.__areaDeToque(document.querySelector(sel), sel2, { scroll: true });
        return m.error ? m : { ...m, cumple: m.tocable >= min };
      }, t.sel, INTERACTIVOS, MIN);

      if (medida.error) { console.error(`   🔴 NO SUPE MIRAR ${t.nombre}: ${medida.error}`); fallos++; continue; }
      if (!medida.cumple) {
        console.error(`   ✖ ${t.nombre}: área tocable ${medida.tocable}px < ${MIN} (AB6/DESIGN.md)`);
        fallos++;
      } else {
        log(`   ✔ ${t.nombre}: ${medida.tocable}px tocables (caja ${medida.caja}px)`);
      }
    }

    // ── ④ LAS SONDAS DE UMBRAL ───────────────────────────────────────────────
    await page.evaluate((html) => {
      const caja = document.createElement('div');
      caja.innerHTML = html;
      document.body.appendChild(caja);
    }, SONDAS_HTML);
    for (const sonda of (ancho <= CORTE_MOVIL ? SONDAS_MOVIL : SONDAS_ESCRITORIO)) {
      const m = await page.evaluate(async (sel, sel2, min) => {
        const r = await window.__areaDeToque(document.querySelector(sel), sel2, { scroll: true });
        return r.error ? r : { ...r, cumple: r.tocable >= min };
      }, `#${sonda.id}`, INTERACTIVOS, MIN);
      if (m.error) {
        console.error(`   🔴 NO SUPE MIRAR la sonda ${sonda.id}: ${m.error}`);
        fallos++;
      } else if (m.cumple !== sonda.debePasar) {
        console.error(`   ✖ UMBRAL MAL APLICADO @${ancho}px: «${sonda.id}» mide ${m.tocable}px contra un `
          + `mínimo de ${MIN} y ${m.cumple ? 'PASA' : 'CAE'}. Con los dos táctiles de esta página por `
          + 'encima de 44, sin esta sonda el mínimo podría estar mal y el guard seguiría verde.');
        fallos++;
      } else {
        log(`   ✔ umbral ${sonda.id}: ${m.tocable}px ${m.cumple ? 'pasa' : 'cae'} contra ${MIN}`);
      }
    }
    log('');
    await page.close();
  }
} finally {
  await navegador.close();
  srv.close();
}

if (fallos) {
  console.error(`\n🔴 ${fallos} problema(s) de accesibilidad en la landing publicada.`);
  process.exit(1);
}
console.log(`✓ En los dos anchos: nada suena pegado, las 7 regiones tienen nombre y los táctiles llegan a su `
  + `mínimo — ${MINIMO_TACTIL} px en móvil, ${MINIMO_ESCRITORIO} en escritorio, como dice DESIGN.md.`);
