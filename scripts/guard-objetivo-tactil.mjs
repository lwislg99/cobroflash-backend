// scripts/guard-objetivo-tactil.mjs — SCRUM-542
//
// Mide EN NAVEGADOR (Edge vía puppeteer-core) el ÁREA QUE RECIBE EL TOQUE de cada objetivo
// interactivo de la landing, a 1280 y a 360 px, contra los 44 px de AB6.
//
// ── POR QUÉ ESTE GUARD NO SE PARECE AL DE SCRUM-543 ──────────────────────────────────────────
// `guard-a11y-landing.mjs` vigila DOS táctiles escritos a mano (el logo y «Ver planes →»). Sirve
// para lo que nació. Pero una lista a mano sólo protege lo que alguien se acordó de apuntar: el
// enlace que se añada mañana no está en ella y su 17 px pasa sin que nadie lo vea.
// Aquí el censo es DERIVADO del DOM: se pregunta al navegador qué hay que se pueda pulsar.
//
// ── LAS TRES COSAS QUE HACEN QUE ESTA MEDICIÓN VALGA ──────────────────────────────────────────
//
// ① HACE SCROLL, Y ESO NO ES UN DETALLE.
//    `elementsFromPoint` SÓLO VE EL VIEWPORT. Sin llevar cada elemento a la vista, todo lo que
//    esté bajo el pliegue —el pie, que es justo donde están los peores— devuelve «no se alcanza»
//    y el censo sale con cero defectos. Es el modo de fallo REAL que se midió en este ticket:
//    el primer censo dio «0 táctiles a 360 px» y era CEGUERA, NO LIMPIEZA.
//    Por eso el arranque trae un CONTROL del propio scroll (§ `controlDelScroll`): comprueba que
//    sin scroll el pie NO se alcanza y con scroll SÍ. Si las dos respuestas fueran iguales, el
//    scroll no estaría haciendo nada y este guard no sabría lo que cree saber.
//
// ② EL ÁRBITRO ES «QUÉ ACTIVARÍA EL DEDO AQUÍ», NO «ESTÁ EL ELEMENTO EN LA PILA».
//    El idioma de la casa era `elementsFromPoint(x,y).includes(el)`. Eso da por bueno un
//    elemento TAPADO por otro: sigue en la pila, pero el toque se lo lleva el de encima. Con
//    áreas ampliadas por pseudo-elemento —que es como la casa arregla los táctiles en línea— dos
//    enlaces seguidos se solapan, y con `.includes` los dos parecen cumplir mientras uno de los
//    dos es INALCANZABLE.
//    Aquí se mira el elemento de ENCIMA y se le pregunta a qué interactivo pertenece:
//        elementsFromPoint(x,y)[0].closest(INTERACTIVOS) === el
//    Eso acierta con los hijos (el `<span class="ar">→</span>` de dentro de un enlace pertenece a
//    su enlace) y deja de mentir con los solapes.
//
// ③ LA CAJA CSS NO DECIDE. `min-height:44px` puede estar puesto y el área real ser otra: un
//    enlace en línea con `display:inline` ignora el alto, y un `::after` ampliado lo cambia sin
//    tocar la caja. Se mide expandiendo desde el centro hasta que el punto deja de pertenecer al
//    elemento. Verificar que el fichero cambió no es verificar que el comportamiento cambió.
//
// ── SUELO ────────────────────────────────────────────────────────────────────────────────────
// Un cero aquí PARECE una respuesta. Por eso: si el censo no encuentra táctiles, o si falta
// alguno de los CONOCIDOS declarados abajo, el guard NO dice «todo bien»: dice que no supo mirar.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
// SCRUM-562 · el árbitro y el afinado viven en UN solo sitio, con su porqué. Aquí estaban
// en línea, y una copia en línea es lo que dejó que este guard y el de SCRUM-543 midieran
// distinto durante dos días.
import { FUENTE_MEDIDOR, INTERACTIVOS, MINIMO_TACTIL } from './_medidor-de-toque.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(RAIZ, 'public');
import { lanzarNavegador } from './_navegador.mjs';
// SCRUM-522 · la ruta ya no se escribe aqui. Era una ruta de WINDOWS por defecto, identica en
// los nueve guards, y por eso ninguno podia correr en el runner de CI —Ubuntu— donde de verdad
// hacen falta. `rutaDelNavegador` busca en los sitios conocidos y, si no hay ninguno, PARA
// declarandose ciega en vez de devolver una ruta plausible. `EDGE_PATH` sigue mandando.
const PUERTO = 4472;

/** AB6 y la definición de «pulsable» salen del medidor único: aquí no se redeclaran. */
const MINIMO = MINIMO_TACTIL;
const ANCHOS = [1280, 360];

/**
 * Secciones que NACEN TAPADAS y que hay que destapar PARA MEDIR.
 *
 * ⚠️ Se destapa EN EL DOM DE UNA PESTAÑA DE USAR Y TIRAR. `public/index.html` no se toca: el
 *    `hidden` sigue en el fichero y en producción. Es el mismo recurso que ya usa
 *    `guard-a11y-landing.mjs` con su campo `destapar`.
 * ⚠️ Y se destapa PORQUE SI NO, NO SE MIDE. Un táctil de 17 px dentro de una sección tapada no
 *    es un táctil correcto: es un defecto con fecha de estreno. El día que la sección se
 *    publique ya nadie va a volver a mirar.
 */
const DESTAPAR = [
  {
    sel: '#announce',
    motivo: 'la barra de anuncio nace `hidden` y su CSS la deja `visibility:hidden`: ocupa sitio '
      + 'pero no recibe toque. Sin destapar, «Ver planes →» no se mide.',
  },
  {
    sel: '#gremios',
    motivo: 'sección en propuesta (SCRUM-555). Sus seis `a.p-link` son enlaces REALES a '
      + '/register.html: el día que se publique son táctiles de verdad, y hoy son los únicos '
      + '`.p-link` que un dedo puede pulsar.',
  },
];

/**
 * SUELO CON NOMBRES. No basta con «encontré alguno»: estos tienen que aparecer MEDIDOS.
 * Si uno falta, o el scroll dejó de funcionar, o alguien retiró algo — en ambos casos el verde
 * de los demás no significa nada y hay que decirlo.
 */
const CONOCIDOS = {
  1280: [
    { nombre: 'el logo', busca: (m) => m.sel === 'A.logo' },
    { nombre: 'los 3 enlaces del nav', busca: (m) => m.sel.startsWith('A.t'), cuantos: 3 },
    { nombre: '«Volver a empezar»', busca: (m) => m.sel === 'BUTTON.try-reset' },
    { nombre: 'los 5 del pie', busca: (m) => m.seccion === 'footer', cuantos: 5 },
    { nombre: '«Ver planes →» (destapado)', busca: (m) => m.seccion === 'announce' },
    { nombre: 'los 6 a.p-link de #gremios (destapado)', busca: (m) => m.seccion === 'gremios', cuantos: 6 },
  ],
  360: [
    { nombre: 'el logo', busca: (m) => m.sel === 'A.logo' },
    { nombre: '«Volver a empezar»', busca: (m) => m.sel === 'BUTTON.try-reset' },
    { nombre: 'los 5 del pie', busca: (m) => m.seccion === 'footer', cuantos: 5 },
  ],
};

/**
 * EXCEPCIONES DECLARADAS. Un elemento aquí NO cumple 44 px y se sabe por qué.
 * Cada una lleva motivo y quién la retira. Sin eso, no es una excepción: es un umbral bajado.
 */
const EXCEPCIONES = [];

const TIPOS = { '.css': 'text/css', '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const abs = path.join(PUBLIC, p);
  if (!abs.startsWith(PUBLIC) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(abs)] || 'application/octet-stream' });
  res.end(fs.readFileSync(abs));                 // del DISCO en cada petición
});

let fallos = 0;
const decir = (s) => console.log(s);
const mal = (s) => { console.error(s); fallos += 1; };

await new Promise((r) => srv.listen(PUERTO, r));
// SCRUM-617 · el arranque pasa por el módulo común: es el ÚNICO sitio donde se decide cómo
// arranca el navegador. Antes cada guard lo escribía a mano y el flag de aislamiento se
// propagó por COPIA de uno a otro — por eso el más antiguo (contraste) se quedó sin él. Y aquí
// está lo que arregla este ticket: si no levanta, `lanzarNavegador` PARA con código 3 («no
// pude arrancarlo»), que no es 2 («no lo encuentro») ni 1 («he encontrado un defecto»).
// La comprobación de existencia que había aquí SALE: segunda copia del suelo; el módulo común
// ya para con 2 si no hay navegador.
process.on('exit', () => { try { srv.close(); } catch { /* ya cerrado */ } });
const navegador = await lanzarNavegador(puppeteer, { headless: 'new' });

/** El código que corre DENTRO de la página. Va como cadena para poder inyectarlo dos veces. */
const MEDIDOR = `(async (INTERACTIVOS, MIN, DESTAPAR_SELS, CON_SCROLL) => {
  const espera = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  const destapados = [];
  for (const s of DESTAPAR_SELS) {
    const n = document.querySelector(s);
    if (!n) { destapados.push({ sel: s, ok: false }); continue; }
    n.removeAttribute('hidden');
    n.style.visibility = 'visible';
    n.style.display = '';
    destapados.push({ sel: s, ok: true });
  }
  await espera();

  const nombreDe = (el) => {
    let c = '';
    if (el.className && typeof el.className === 'string') c = el.className.trim().split(/\\s+/).filter(Boolean).join('.');
    return el.tagName + (c ? '.' + c : '');
  };
  const porQueNo = (el, x, y) => {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden') return 'visibility:hidden';
    if (cs.display === 'none') return 'display:none';
    if (cs.pointerEvents === 'none') return 'pointer-events:none';
    if (Number(cs.opacity) === 0) return 'opacity:0';
    let p = el.parentElement;
    while (p) {
      const pc = getComputedStyle(p);
      const quien = '<' + p.tagName.toLowerCase() + (p.id ? '#' + p.id : '') + '>';
      if (pc.visibility === 'hidden') return 'un ancestro ' + quien + ' tiene visibility:hidden';
      if (pc.display === 'none') return 'un ancestro ' + quien + ' tiene display:none';
      if (Number(pc.opacity) === 0) return 'un ancestro ' + quien + ' tiene opacity:0';
      p = p.parentElement;
    }
    const arriba = document.elementsFromPoint(x, y)[0];
    if (!arriba) return 'no hay nada en ese punto: el elemento cae fuera del viewport';
    return 'lo tapa ' + nombreDe(arriba);
  };

  const todos = [...document.querySelectorAll(INTERACTIVOS)];
  const medidos = [], sinPintar = [], noTocables = [];

  for (const el of todos) {
    const r0 = el.getBoundingClientRect();
    const ficha = () => ({
      sel: nombreDe(el),
      texto: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 40) || '(sin texto)',
      seccion: (() => { const s = el.closest('section, footer, nav, header, div[id]'); return s ? (s.id || s.tagName.toLowerCase()) : '(suelto)'; })(),
    });
    if (!r0.width || !r0.height) { sinPintar.push({ ...ficha(), motivo: 'caja de 0×0' }); continue; }

    // 🔴 EL SCROLL, el árbitro y el afinado, los tres, viven en _medidor-de-toque.mjs.
    //    (Sin acentos graves: esto va DENTRO de un literal de plantilla y los cerraría.)
    const m = await window.__areaDeToque(el, INTERACTIVOS, { scroll: CON_SCROLL });
    const r = el.getBoundingClientRect();
    if (m.error) {
      const cx = r.left + r.width / 2;
      // El medidor dice QUE no se pudo; el porqué lo averigua este guard, que es quien lo reporta.
      const motivo = m.error.includes('no lo alcanza') ? porQueNo(el, cx, r.top + r.height / 2) : m.error;
      noTocables.push({ ...ficha(), caja: m.caja ?? +r.height.toFixed(1), motivo });
      continue;
    }
    medidos.push({ ...ficha(), caja: m.caja, tocable: m.tocable, cumple: m.tocable >= MIN });
  }
  return { medidos, sinPintar, noTocables, total: todos.length, destapados };
})`;

for (const ancho of ANCHOS) {
  const page = await navegador.newPage();
  await page.setViewport({ width: ancho, height: 900 });
  await page.goto(`http://127.0.0.1:${PUERTO}/`, { waitUntil: 'load' });

  decir('\n════════════════════════════════════════════════════════════════════════════');
  decir(`ANCHO ${ancho} px`);
  decir('════════════════════════════════════════════════════════════════════════════');

  // ── ⓪ CONTROL DEL SCROLL: ¿está el scroll haciendo algo, o me lo estoy creyendo? ─────────
  const sinScroll = await page.evaluate(`${FUENTE_MEDIDOR};${MEDIDOR}(${JSON.stringify(INTERACTIVOS)}, ${MINIMO}, ${JSON.stringify(DESTAPAR.map((d) => d.sel))}, false)`);
  await page.goto(`http://127.0.0.1:${PUERTO}/`, { waitUntil: 'load' });   // página limpia
  const r = await page.evaluate(`${FUENTE_MEDIDOR};${MEDIDOR}(${JSON.stringify(INTERACTIVOS)}, ${MINIMO}, ${JSON.stringify(DESTAPAR.map((d) => d.sel))}, true)`);

  const pieSin = sinScroll.medidos.filter((m) => m.seccion === 'footer').length;
  const pieCon = r.medidos.filter((m) => m.seccion === 'footer').length;
  decir(`⓪ control del scroll · enlaces del pie medidos SIN scroll: ${pieSin}  ·  CON scroll: ${pieCon}`);
  if (pieCon === 0) {
    mal('   🔴 NO SUPE MIRAR: ni con scroll aparece el pie. El cero de abajo sería ceguera.');
  } else if (pieSin >= pieCon) {
    mal('   🔴 EL CONTROL NO DISCRIMINA: sin scroll se mide lo mismo. O el scroll no hace falta '
      + '(y este guard cree saber algo que no sabe), o el medidor no está usándolo.');
  } else {
    decir(`   ✅ el scroll es lo que hace visible el pie (+${pieCon - pieSin}). Sin él, este censo mentiría.`);
  }

  for (const d of DESTAPAR) {
    const hecho = r.destapados.find((x) => x.sel === d.sel);
    if (!hecho || !hecho.ok) {
      mal(`   🔴 NO SUPE MIRAR: el destapar declarado \`${d.sel}\` ya no existe en la página. `
        + 'O la sección se retiró (actualiza DESTAPAR y di por qué) o el censo está ciego ahí.');
    }
  }

  decir(`\n① censo derivado · interactivos en el DOM: ${r.total}  ·  medidos: ${r.medidos.length}`
    + `  ·  sin pintar: ${r.sinPintar.length}  ·  presentes pero no tocables: ${r.noTocables.length}`);

  // ── ① SUELO ────────────────────────────────────────────────────────────────────────────
  if (r.medidos.length === 0) {
    mal('   🔴 CIEGO: cero táctiles medidos. Eso no es «no hay defectos», es «no supe mirar».');
    await page.close();
    continue;
  }
  for (const c of CONOCIDOS[ancho] || []) {
    const n = r.medidos.filter(c.busca).length;
    const esperados = c.cuantos || 1;
    if (n < esperados) mal(`   🔴 CIEGO: falta(n) ${c.nombre} — esperaba ${esperados}, medí ${n}. El verde del resto no vale.`);
  }

  // ── ② LOS QUE NO SE PUDIERON MEDIR, CON SU MOTIVO ──────────────────────────────────────
  if (r.noTocables.length) {
    decir('\n② presentes pero NO tocables (no son «pequeños»: es que ahí el dedo no los activa):');
    for (const m of r.noTocables) decir(`   · [${m.seccion}] ${m.sel} «${m.texto}» — caja ${m.caja}px — ${m.motivo}`);
  }

  // ── ③ EL VEREDICTO ─────────────────────────────────────────────────────────────────────
  const cortos = r.medidos.filter((m) => !m.cumple);
  const excusados = cortos.filter((m) => EXCEPCIONES.some((e) => e.sel === m.sel));
  const culpables = cortos.filter((m) => !EXCEPCIONES.some((e) => e.sel === m.sel));

  decir(`\n③ contra AB6 (${MINIMO} px) · cumplen: ${r.medidos.length - cortos.length}`
    + `  ·  se quedan cortos: ${cortos.length}  ·  de ésos, excusados con motivo: ${excusados.length}`);
  for (const m of culpables) {
    mal(`   ✖ ${m.tocable}px < ${MINIMO} · [${m.seccion}] ${m.sel} «${m.texto}» (caja CSS ${m.caja}px)`);
  }
  for (const m of excusados) {
    const e = EXCEPCIONES.find((x) => x.sel === m.sel);
    decir(`   ⚠️ EXCEPCIÓN ${m.tocable}px · ${m.sel} — ${e.motivo}`);
  }
  if (!culpables.length) decir('   ✅ todo lo que se puede pulsar llega a 44 px.');

  await page.close();
}

await navegador.close();
srv.close();

decir('\n' + '─'.repeat(76));
if (fallos) {
  console.error(`🔴 SCRUM-542 · ${fallos} problema(s). AB6 no se baja: si algún caso no puede llegar a `
    + `${MINIMO} px, va a EXCEPCIONES con su motivo y quién la retira.`);
  process.exit(1);
}
decir('✅ SCRUM-542 · objetivos de toque: todos llegan a los 44 px de AB6, en 1280 y en 360.');
