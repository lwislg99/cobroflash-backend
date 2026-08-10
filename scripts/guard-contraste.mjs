// scripts/guard-contraste.mjs — SCRUM-368: guard de contraste WCAG AA, MEDIDO EN NAVEGADOR.
//
// Uso:  npm run guard:contraste
//
// ── POR QUÉ EN NAVEGADOR Y NO SOBRE EL CSS ───────────────────────────────────
// Se intentó primero con un censo estático del CSS y daba resultados FALSOS: `.sidebar-logo-text`
// salía en 1,00 (blanco sobre blanco) porque el analizador no sabía que ese texto vive dentro del
// sidebar oscuro, y componía mal los fondos `rgba()`. El fondo real de un texto depende de sus
// ancestros y de las transparencias apiladas, que es justo lo que el navegador ya resuelve.
// El navegador es el árbitro.
//
// ── LO QUE VIGILA ────────────────────────────────────────────────────────────
// Recorre todas las páginas HTML de `public/` (derivadas del árbol, no listadas a mano), mide
// cada nodo con texto propio y compara su ratio con el umbral AA que le toca: 4,5:1 normal,
// 3:1 para texto grande (>=24px, o >=18,66px con peso >=700).
//
// Falla si aparece un par color/fondo por debajo de AA que no esté en CONOCIDOS. No congela los
// que ya fallaban —eso sería aprobarlos—: los deja anotados con su motivo y su ticket, y avisa
// también si uno de ellos DESAPARECE, para que la lista no se pudra.
//
// ── LOS GRADIENTES NO SE APRUEBAN NI SE SUSPENDEN ────────────────────────────
// Un texto sobre un fondo con degradado no tiene UN ratio: tiene un rango, distinto en cada
// píxel. Inventarle un número sería peor que no darlo. Se listan aparte, como NO MEDIBLES por
// este guard, para que quien mire sepa que existen y por qué no llevan número.
//
// ── HUECO DECLARADO ──────────────────────────────────────────────────────────
// Las vistas del dashboard que se generan por JS con datos de sesión no se ven aquí: el guard
// carga HTML estático. No invalida el resultado, porque los colores que fallan son TOKENS
// COMPARTIDOS (--brand, --muted) y cualquier uso hereda su ratio por construcción; pero una
// combinación que solo exista dentro de una vista con datos no la cazaría este guard.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const PUBLIC = path.join(RAIZ, 'public');
const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PUERTO = Number(process.env.GUARD_PUERTO || 4399);

// Mínimo de nodos con texto para que la medición signifique algo. Si el guard mide menos que
// esto, algo se rompió al cargar (CSS que no llega, página en blanco) y un cero de fallos
// sería un cero de «no supe mirar». SUELO.
const SUELO_NODOS = 50;

/**
 * Pares por debajo de AA ya conocidos y REPORTADOS, con su motivo. No están aprobados:
 * están esperando una decisión que no es de CSS. Si alguno desaparece, el guard avisa para
 * que se borre de aquí (una excepción que sobrevive a su causa se convierte en permiso).
 */
const CONOCIDOS = [
  {
    texto: 'rgb(255, 255, 255)', fondo: 'rgb(22,163,74)', ratio: 3.3, nodos: 2,
    // ⚠ EL MOTIVO DE ESTA EXCEPCIÓN CAMBIÓ, y el anterior ya no aplica. Decía «el botón primario,
    // decisión del fundador pendiente»: eso se resolvió — el primario grande cumple por texto
    // grande (A1) y el pequeño usa --brand-tint-ink. Vigilar el motivo viejo sería vigilar un
    // motivo muerto, así que se reescribe con el que queda.
    motivo: 'MOTIVO: los 2 nodos que quedan con este par son MOCKUPS del landing que imitan la ' +
      'interfaz del cliente final —`.send-btn` («Enviar por WhatsApp») y `.tnum-b` (el número de ' +
      'paso)—, no botones del producto. Dibujan cómo se ve YaQu por dentro, con el verde de ' +
      'marca a tamaño pequeño porque así se ve en la pantalla que imitan. ' +
      'Los botones REALES ya cumplen: el primario grande por la vía de texto grande (A1) y el ' +
      'pequeño con --brand-tint-ink (5,48:1). Reportado, sin arreglar (regla 9).',
  },
  {
    texto: 'rgb(107, 114, 128)', fondo: 'rgb(2,6,23)', ratio: 4.17, nodos: 8,
    motivo: 'MOTIVO: admin.html es la consola interna del fundador —no tiene ruta desde el ' +
      'producto y ningún cliente llega a ella—, y usa una paleta oscura de Tailwind que no es ' +
      'la nuestra. Arreglarlo obligaría a mantener un segundo sistema de color para una sola ' +
      'página de uso propio. Reportado, sin arreglar (regla 9). Si algún día admin.html se ' +
      'abre a merchants, esto DEJA de ser aceptable y hay que quitarlo de esta lista.',
  },
  {
    texto: 'rgb(255, 255, 255)', fondo: 'rgb(72,158,146)', ratio: 3.21, nodos: 1,
    motivo: 'MOTIVO: IMITACIÓN DELIBERADA DE UNA INTERFAZ AJENA, NO ES NUESTRA PALETA. Es el ' +
      'avatar del mockup de WhatsApp del landing, que existe para que el visitante reconozca ' +
      'WhatsApp de un vistazo. Ese teal es el de WhatsApp, no un color de YaQu. ' +
      '⚠ NO LO "ARREGLES": si se cambia, el mockup deja de parecerse a WhatsApp y pierde su ' +
      'única razón de estar ahí. Reportado, sin arreglar (regla 9).',
  },
  {
    texto: 'rgb(138, 154, 146)', fondo: 'rgb(234,227,220)', ratio: 2.32, nodos: 1,
    motivo: 'MOTIVO: IMITACIÓN DELIBERADA DE UNA INTERFAZ AJENA, NO ES NUESTRA PALETA. Es la ' +
      'marca de hora dentro de una burbuja de mensaje de WhatsApp del landing: gris claro sobre ' +
      'el beige del fondo de chat, ambos copiados de WhatsApp. ' +
      '⚠ NO LO "ARREGLES": subir el contraste haría que la burbuja dejara de leerse como una ' +
      'burbuja de WhatsApp. Reportado, sin arreglar (regla 9).',
  },
];

/**
 * Pares que cumplen AA **por la vía de texto grande** (SC 1.4.3: umbral 3:1 en vez de 4,5:1
 * si el texto es >=24px, o >=18,66px con peso >=700).
 *
 * ── POR QUÉ ESTOS NO BASTA CON MEDIRLES EL RATIO ─────────────────────────────
 * Su aprobado depende de DOS cosas, no de una: del color Y de la tipografía. Un par que pasa
 * con 3,30 sobre un umbral de 3,0 tiene 0,30 de margen, y ese margen se lo da la letra. Si
 * alguien baja la fuente a 16px o quita el bold, el umbral vuelve a 4,5 y el botón deja de
 * cumplir — pero el COLOR no ha cambiado, así que un guard que solo mire el ratio contra «el
 * umbral que le toque» puede seguir en verde o fallar sin decir por qué.
 *
 * REGLA GENERAL, porque volverá a hacer falta: un aprobado que depende de un tamaño de letra
 * hay que vigilarlo JUNTO con ese tamaño de letra. Si no, el guard comprueba la mitad de la
 * razón por la que pasa.
 */
const POR_TEXTO_GRANDE = [
  {
    texto: 'rgb(22, 163, 74)', fondo: 'rgb(246,247,245)', ratio: 3.07,
    pagina: '/precios.html',
    motivo: 'El «Qu» del logotipo en precios.html: verde de marca sobre el lienzo, 20px con peso ' +
      '800. Con texto normal necesitaría 4,5:1 y solo llega a 3,07 — cumple porque es texto ' +
      'grande y grueso (SC 1.4.3). Si alguien baja ese tamaño o le quita el peso, deja de cumplir ' +
      'SIN QUE EL COLOR HAYA CAMBIADO. Por eso se vigila la tipografía junto al ratio.',
  },
];

// ── El medidor, que corre DENTRO de la página ───────────────────────────────
// Esta función NO se ejecuta en Node: se serializa y corre en el navegador. Sus globales
// (`document`, `getComputedStyle`) se sacan de `globalThis` en vez de usarse sueltos, para que
// el analizador de SCRUM-258 —que barre estos scripts buscando nombres no declarados— no tenga
// que distinguir runtimes. Es un `ReferenceError` menos que un humano tenga que descartar a mano.
function medirEnPagina() {
  const { document, getComputedStyle } = globalThis;
  const rgb = (s) => { const m = String(s).match(/[\d.]+/g);
    return m ? { r: +m[0], g: +m[1], b: +m[2], a: m[3] === undefined ? 1 : +m[3] } : null; };
  const comp = (f, b) => f.a >= 1 ? f : {
    r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 };
  const lum = ({ r, g, b }) => { const f = (c) => { const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (t, b) => { const c = comp(t, b); const l1 = lum(c), l2 = lum(b);
    const [x, y] = l1 > l2 ? [l1, l2] : [l2, l1]; return (x + 0.05) / (y + 0.05); };

  // Fondo EFECTIVO: sube por ancestros apilando capas y componiendo, como pinta el navegador.
  const fondoEfectivo = (el) => {
    const capas = []; let n = el, gradiente = false;
    while (n && n.nodeType === 1) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') gradiente = true;
      const c = rgb(cs.backgroundColor);
      if (c && c.a > 0) { capas.push(c); if (c.a >= 1) break; }
      n = n.parentElement;
    }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = capas.length - 1; i >= 0; i--) base = comp(capas[i], base);
    return { color: base, gradiente };
  };

  const filas = [];
  for (const el of document.querySelectorAll('*')) {
    const txt = [...el.childNodes].filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim()).join('').trim();
    if (!txt) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
    if (!el.getClientRects().length) continue;
    // texto pintado con degradado (background-clip:text): no tiene un color plano que medir
    if (cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)') continue;
    const fg = rgb(cs.color);
    if (!fg || fg.a === 0) continue;
    const { color: bg, gradiente } = fondoEfectivo(el);
    const px = parseFloat(cs.fontSize), peso = parseInt(cs.fontWeight, 10) || 400;
    const grande = px >= 24 || (px >= 18.66 && peso >= 700);
    // ¿Es texto de un componente de interfaz INACTIVO? Se mira el ESTADO REAL del DOM —no el
    // selector ni una lista— para que la exención sea «este nodo, porque está inactivo» y no
    // «este nodo, porque lo pusimos en la lista». El día que se habilite, deja de ser inactivo
    // y vuelve al censo solo.
    const inactivo = !!(el.disabled || el.closest('[disabled], fieldset:disabled, [aria-disabled="true"]'));
    filas.push({
      inactivo,
      clase: (typeof el.className === 'string' && el.className.trim())
        ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : el.tagName.toLowerCase(),
      muestra: txt.slice(0, 30),
      texto: cs.color,
      fondo: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`,
      px, peso, umbral: grande ? 3 : 4.5,
      ratio: +ratio(fg, bg).toFixed(2),
      gradiente,
    });
  }
  return filas;
}

// ── Servidor estático mínimo sobre public/ ──────────────────────────────────
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

function servir() {
  return new Promise((listo) => {
    const s = http.createServer((req, res) => {
      // SCRUM-414 - sin `try` esto subia al manejador de excepciones no capturadas, que VUELCA EL
      // OBJETO del error: la via exacta por la que se publico una credencial de produccion. Aqui lo
      // que viaja es una ruta local, pero la regla es del HECHO, no del contenido: un `new URL`
      // cuyo error puede alcanzarse es un `new URL` que algun dia imprime su entrada.
      let url;
      try {
        url = new URL(req.url, 'http://x');
      } catch {
        res.writeHead(400); res.end('400'); return;
      }
      let f = path.join(PUBLIC, decodeURIComponent(url.pathname));
      if (url.pathname.endsWith('/')) f = path.join(f, 'index.html');
      fs.readFile(f, (err, buf) => {
        if (err) { res.writeHead(404); res.end('404'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream',
          'Cache-Control': 'no-store' });
        res.end(buf);
      });
    });
    s.listen(PUERTO, () => listo(s));
  });
}

/** Páginas: DERIVADAS del árbol, no escritas a mano. Una página nueva entra sola. */
function paginasDelProducto() {
  const out = [];
  const bajar = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) bajar(p);
      else if (e.name.endsWith('.html')) out.push('/' + path.relative(PUBLIC, p).replace(/\\/g, '/'));
    }
  };
  bajar(PUBLIC);
  return out.sort();
}

// ── Principal ───────────────────────────────────────────────────────────────
const servidor = await servir();
let navegador;
try {
  navegador = await puppeteer.launch({
    executablePath: EDGE, headless: true,
    args: ['--disable-gpu', '--hide-scrollbars', '--no-first-run'],
  });
} catch (e) {
  servidor.close();
  console.error('✖ No se pudo lanzar el navegador. Este guard MIDE, y sin navegador no mide.');
  console.error('  Ajusta EDGE_PATH si Edge está en otra ruta. Detalle: ' + e.message);
  process.exit(1);
}

const paginas = paginasDelProducto();
let nodos = 0;
const todos = [];
const bajoAA = [];
const gradientes = [];
const inactivos = [];

for (const ruta of paginas) {
  const page = await navegador.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  try {
    await page.goto(`http://127.0.0.1:${PUERTO}${ruta}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise((r) => setTimeout(r, 600));
    const filas = await page.evaluate(medirEnPagina);
    nodos += filas.length;
    for (const f of filas) {
      todos.push({ ...f, pagina: ruta });   // TODOS, no solo los que fallan: los que pasan por
      if (f.ratio >= f.umbral) continue;    // la vía de texto grande hay que poder revisarlos
      // EXENCIÓN NORMATIVA, no de conveniencia. WCAG 2.1 SC 1.4.3, excepción «Incidental»:
      //   «Text or images of text that are part of an inactive user interface component […]
      //    have no contrast requirement.»
      // y el Understanding lo dice sin rodeos: «User Interface Components that are not available
      // for user interaction (e.g., a disabled control in HTML) are not required to meet contrast
      // requirements.» Verificado en w3.org, no citado de memoria.
      if (f.inactivo) { inactivos.push({ ...f, pagina: ruta }); continue; }
      if (f.gradiente) { gradientes.push({ ...f, pagina: ruta }); continue; }
      bajoAA.push({ ...f, pagina: ruta });
    }
  } catch (e) {
    console.error(`✖ ${ruta}: no se pudo medir — ${e.message}`);
    await page.close(); await navegador.close(); servidor.close();
    process.exit(1);
  }
  await page.close();
}
await navegador.close();
servidor.close();

console.log(`páginas medidas: ${paginas.length}  ·  nodos con texto: ${nodos}`);

// ── SUELO ───────────────────────────────────────────────────────────────────
if (nodos < SUELO_NODOS) {
  console.error(`\n✖ SUELO: solo ${nodos} nodos con texto (mínimo ${SUELO_NODOS}).`);
  console.error('  Cero fallos aquí no significa «todo cumple», significa «no supe mirar».');
  process.exit(1);
}

// ── EXENTOS POR COMPONENTE INACTIVO: se declaran, con la cita ───────────────
if (inactivos.length) {
  console.log(`\nEXENTOS por WCAG 2.1 SC 1.4.3 («Incidental»): ${inactivos.length} nodos de ` +
    'componentes de interfaz INACTIVOS.');
  console.log('  «Text […] that are part of an inactive user interface component […] have no');
  console.log('   contrast requirement.» — la exención se mide sobre el ESTADO del DOM, no sobre');
  console.log('   una lista: el día que el control se habilite, vuelve al censo solo.');
  for (const i of inactivos) {
    console.log(`   ${i.pagina}  .${i.clase}  ratio ${i.ratio} (umbral ${i.umbral})  «${i.muestra}»`);
  }
}

// ── GRADIENTES: se declaran, no se juzgan ───────────────────────────────────
if (gradientes.length) {
  console.log(`\nNO MEDIBLES por este guard: ${gradientes.length} nodos sobre fondo con degradado.`);
  console.log('  Un degradado no tiene UN ratio, tiene un rango distinto en cada píxel. Ni se');
  console.log('  aprueban ni se suspenden: se listan para que se sepa que existen.');
  const vistos = new Set();
  for (const g of gradientes) {
    const k = g.pagina + '|' + g.clase + '|' + g.texto;
    if (vistos.has(k)) continue; vistos.add(k);
    console.log(`   ${g.pagina}  .${g.clase}  ${g.texto}  ${g.px}px/${g.peso}  «${g.muestra}»`);
  }
}

// ── LOS QUE PASAN POR LA VÍA DE TEXTO GRANDE: se afirman las DOS mitades ────
// No basta con que el ratio supere su umbral: hay que comprobar TAMBIÉN la tipografía que le
// da derecho a ese umbral más bajo. Si no, el guard comprueba la mitad de la razón por la que
// pasa, y una bajada de fuente lo tumbaría sin que nadie supiera por qué.
const MIN_PX_GRANDE = 18.66;
const MIN_PESO_GRANDE = 700;
const fallosTipografia = [];

for (const esperado of POR_TEXTO_GRANDE) {
  const nodos = todos.filter((f) => f.texto === esperado.texto && f.fondo === esperado.fondo
    && (!esperado.clase || (f.clase || '').includes(esperado.clase)));
  if (!nodos.length) {
    fallosTipografia.push({ ...esperado, problema: 'YA NO APARECE — bórralo de POR_TEXTO_GRANDE' });
    continue;
  }
  for (const n of nodos) {
    const grandeDeVerdad = n.px >= 24 || (n.px >= MIN_PX_GRANDE && n.peso >= MIN_PESO_GRANDE);
    if (!grandeDeVerdad) {
      fallosTipografia.push({ ...esperado, nodo: n,
        problema: `la TIPOGRAFÍA ya no da derecho al umbral de 3:1 (mide ${n.px}px/${n.peso})` });
    } else if (n.ratio < 3) {
      fallosTipografia.push({ ...esperado, nodo: n,
        problema: `el COLOR bajó de 3:1 (ratio ${n.ratio})` });
    }
  }
}

// ── Comparación con lo conocido ─────────────────────────────────────────────
const clave = (f) => `${f.texto}|${f.fondo}`;
const conocidos = new Map(CONOCIDOS.map((c) => [`${c.texto}|${c.fondo}`, c]));

const nuevos = new Map();
const vistosConocidos = new Set();
// Cuántos nodos aporta cada par conocido. Sin esto, un nodo NUEVO con un par que ya está en la
// lista entra sin que nada avise: la excepción se escribió para unos nodos concretos y acabaría
// amparando a cualquiera que reutilizara esos dos colores. Lo descubrió la prueba de la exención
// por componente inactivo: al habilitar el botón, volvía al censo y el guard seguía en VERDE.
const nodosPorConocido = new Map();
for (const f of bajoAA) {
  const k = clave(f);
  if (conocidos.has(k)) {
    vistosConocidos.add(k);
    if (!nodosPorConocido.has(k)) nodosPorConocido.set(k, { veces: 0, paginas: new Set(), clases: new Set(), muestras: [] });
    const c = nodosPorConocido.get(k);
    c.veces++; c.paginas.add(f.pagina); c.clases.add(f.clase);
    if (c.muestras.length < 4) c.muestras.push(`${f.pagina} .${f.clase} «${f.muestra}»`);
    continue;
  }
  if (!nuevos.has(k)) nuevos.set(k, { ...f, veces: 0, paginas: new Set(), clases: new Set() });
  const v = nuevos.get(k); v.veces++; v.paginas.add(f.pagina); v.clases.add(f.clase);
}

console.log(`\npares por debajo de AA: ${nuevos.size} nuevos · ${vistosConocidos.size}/${CONOCIDOS.length} conocidos presentes`);

let fallo = false;

// ── Los que pasan por la vía de texto grande: se dice CUÁL de las dos mitades cayó ──
if (POR_TEXTO_GRANDE.length) {
  console.log(`\npares que cumplen por la VÍA DE TEXTO GRANDE: ${POR_TEXTO_GRANDE.length} vigilados ` +
    `(ratio ≥ 3,0 Y ≥${MIN_PX_GRANDE}px Y peso ≥${MIN_PESO_GRANDE})`);
}
if (fallosTipografia.length) {
  fallo = true;
  console.error('\n✖ UN PAR QUE PASABA POR LA VÍA DE TEXTO GRANDE HA DEJADO DE PASAR:');
  for (const f of fallosTipografia) {
    console.error(`\n   ${f.texto} sobre ${f.fondo}${f.clase ? `  (.${f.clase})` : ''}`);
    console.error(`   ${f.problema}`);
    if (f.nodo) console.error(`   página: ${f.nodo.pagina}  ·  «${f.nodo.muestra}»  ${f.nodo.px}px/${f.nodo.peso}  ratio ${f.nodo.ratio}`);
    console.error('   ESTE PAR PASA POR LA VÍA DE TEXTO GRANDE: su aprobado depende del COLOR *y* de');
    console.error('   la TIPOGRAFÍA. Si cambias el tamaño o el peso de la letra, deja de pasar aunque');
    console.error('   el color siga igual. Para volver al verde: recupera la tipografía, o sube el');
    console.error('   contraste hasta 4,5:1, que es el umbral sin la vía de texto grande.');
  }
}

if (nuevos.size) {
  fallo = true;
  console.error('\n✖ PARES NUEVOS por debajo de WCAG AA:');
  for (const v of [...nuevos.values()].sort((a, b) => a.ratio - b.ratio)) {
    console.error(`\n   ratio ${v.ratio} (umbral ${v.umbral})   ${v.texto}  sobre  ${v.fondo}`);
    console.error(`   páginas: ${[...v.paginas].join(', ')}`);
    console.error(`   clases:  ${[...v.clases].join(', ')}`);
    console.error(`   ejemplo: «${v.muestra}»  ${v.px}px/${v.peso}`);
  }
}

// Un par conocido que gana nodos NO es el mismo par conocido: la excepción se escribió para los
// que había, no para los que vengan.
for (const c of CONOCIDOS) {
  const k = `${c.texto}|${c.fondo}`;
  const visto = nodosPorConocido.get(k);
  if (!visto || c.nodos === undefined) continue;
  if (visto.veces > c.nodos) {
    fallo = true;
    console.error(`\n✖ UN PAR CONOCIDO HA GANADO NODOS: ${c.texto} sobre ${c.fondo}`);
    console.error(`   esperados ${c.nodos}, medidos ${visto.veces}`);
    console.error(`   páginas: ${[...visto.paginas].join(', ')}`);
    console.error(`   clases:  ${[...visto.clases].join(', ')}`);
    console.error(`   ejemplos: ${visto.muestras.join(' · ')}`);
    console.error('   La excepción se escribió para los nodos que había, no para los que vengan.');
    console.error('   Si el nodo nuevo es legítimo, sube el contador; si no, arréglalo.');
  } else if (visto.veces < c.nodos) {
    fallo = true;
    console.error(`\n✖ UN PAR CONOCIDO HA PERDIDO NODOS: ${c.texto} sobre ${c.fondo}`);
    console.error(`   esperados ${c.nodos}, medidos ${visto.veces} — baja el contador y anota la mejora.`);
  }
}

const desaparecidos = CONOCIDOS.filter((c) => !vistosConocidos.has(`${c.texto}|${c.fondo}`));
if (desaparecidos.length) {
  fallo = true;
  console.error('\n✖ EXCEPCIONES QUE YA NO OCURREN — bórralas de CONOCIDOS:');
  for (const d of desaparecidos) console.error(`   ${d.texto} sobre ${d.fondo} (era ${d.ratio})`);
  console.error('  Una excepción que sobrevive a su causa deja de ser una nota y pasa a ser un permiso.');
}

if (fallo) process.exit(1);
console.log('\n✔ ningún par nuevo por debajo de AA');
