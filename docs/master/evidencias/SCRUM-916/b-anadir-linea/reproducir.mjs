// docs/master/evidencias/SCRUM-916/b-anadir-linea/reproducir.mjs — SCRUM-916b (S4)
//
// «+ AÑADIR LÍNEA» DEL PARTE, PULSADO COMO LO PULSA UNA PERSONA: navegador real, ratón, dedo y teclado
// de verdad (nada de `dispatchEvent`). Apunta, paso a paso, qué líneas hay guardadas, si hay fila por
// escribir, dónde queda el foco y cuántos `PATCH` han salido; y mide lo mismo en el editor de
// presupuestos, que es el patrón que el fundador señaló como bueno.
//
// Uso:  node docs/master/evidencias/SCRUM-916/b-anadir-linea/reproducir.mjs [--solo-antes]
//   · «antes»  = el punto de partida de la rama (merge-base con main).
//   · «después» = el árbol de trabajo. Sin `--solo-antes` se le EXIGE el comportamiento objetivo.
// Fotos (fuera de git, A8): D:\MILLONARIO\cobroFlash\capturas\SCRUM-916\b-anadir-linea\ (o CAPTURAS_DIR)
// Secuencias medidas: `secuencia.json`, junto a este fichero.
//
// Sale con 1 si «después» no cumple el objetivo, con 2 si no supo mirar. Con `--solo-antes` sólo documenta.
//
// El servidor es de mentira y vive en la página: guarda las líneas del `PATCH` y las devuelve en el
// `GET`, con una latencia declarada (0 y 150 ms), porque el defecto depende de qué llega antes: el
// clic o el repintado.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { servirListas, abrirNavegador, arbolDePartida } from '../../../../../scripts/_banco-lista.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..', '..', '..', '..', '..');
const FOTOS = process.env.CAPTURAS_DIR || 'D:\\MILLONARIO\\cobroFlash\\capturas\\SCRUM-916\\b-anadir-linea';
const SOLO_ANTES = process.argv.includes('--solo-antes');
const LATENCIAS = [0, 150];

// Nombres de mentira; el parte es el del técnico (sin dinero).
const PARTE = {
  id: 12, numero: 'PT-2026-012', estado: 'borrador', jobId: 7, customerId: 3,
  clienteNombre: 'Comunidad Los Olivos', fecha: '2026-11-19T08:00:00.000Z', obra: 'Sala de calderas',
  referencia: '', entrada: '09:00', salida: '11:30', desplazamientos: 1, kilometros: 12,
  tecnicos: ['Israel'], tipo: 'averia', notas: '',
  queHayQueHacer: 'Cambiar la bomba de recirculación y dejar el circuito purgado.',
  lineas: [
    { id: 1, bloque: 'mano_obra', unds: 2, descripcion: 'Sustitución de la bomba de recirculación' },
    { id: 2, bloque: 'materiales', unds: 1, descripcion: 'Bomba de recirculación 25-60' },
  ],
  firmoElCliente: false, firmoElTecnico: false, firmasCompletas: false,
  puedeEditarContenido: { ok: true, motivo: null }, puedeEditarPrecios: { ok: true, motivo: null },
};
const NEGOCIO = { id: 1, name: 'Fontanería Soler', timezone: 'Europe/Madrid', defaultCurrency: 'EUR', clausulasPresupuesto: [] };
const CLIENTES = [{ id: 3, name: 'Comunidad Los Olivos', email: '', phone: '34000111222', mobile: null }];

const servidorDelParte = (latencia) => `(function () {
  var parte = ${JSON.stringify(PARTE)};
  var siguiente = 100;
  var tras = function (v) { return new Promise(function (r) { setTimeout(function () { r(JSON.parse(JSON.stringify(v))); }, ${latencia}); }); };
  return function (ruta, opciones) {
    if (/\\/admin\\/partes\\/12$/.test(ruta)) {
      if ((opciones.method || 'GET') === 'PATCH') {
        var c = JSON.parse(opciones.body || '{}');
        if (Array.isArray(c.lineas)) parte.lineas = c.lineas.map(function (l) { return Object.assign({}, l, { id: l.id || siguiente++ }); });
      }
      return tras(parte);
    }
    if (/\\/admin\\/merchant/.test(ruta)) return ${JSON.stringify(NEGOCIO)};
    return {};
  };
})()`;
const datosEditor = `(function (ruta) {
  if (/\\/admin\\/customers/.test(ruta)) return ${JSON.stringify(CLIENTES)};
  if (/\\/admin\\/merchant/.test(ruta)) return ${JSON.stringify(NEGOCIO)};
  if (/\\/admin\\/products/.test(ruta)) return [];
  return {};
})`;
const RUTAS = LATENCIAS.map((l) => ({ ruta: '/parte-' + l, fnVista: 'renderParteDetailView', datos: servidorDelParte(l), args: '[12]' }))
  .concat([{ ruta: '/editor', fnVista: 'renderQuotesView', datos: datosEditor, args: '[]' }]);

let salida = 0;
const fallo = (codigo, texto) => { console.error('🔴 ' + texto); salida = Math.max(salida, codigo); };

/** La página, pintada, con dedo (móvil) o ratón (escritorio). */
async function abrir(browser, puerto, ruta, ancho, alto, dedo) {
  const page = await browser.newPage();
  await page.setViewport({ width: ancho, height: alto, hasTouch: dedo, isMobile: dedo });
  await page.goto(`http://127.0.0.1:${puerto}${ruta}`, { waitUntil: 'load' });
  await page.waitForFunction('window.__listo === true', { timeout: 20000 });
  // Cada clic que LLEGA a un «Añadir línea» se apunta: «el clic no llegó» tiene que poder medirse.
  await page.evaluate(() => {
    window.__clics = 0;
    document.addEventListener('click', (e) => {
      if (e.target && e.target.closest && e.target.closest('.parte-anadir, .quote-add-line')) window.__clics++;
    }, true);
  });
  return page;
}

/** Sin peticiones en vuelo, y que siga sin haberlas un momento después (una cadena PATCH→GET pasa por cero). */
async function quieta(page) {
  await page.waitForFunction(() => new Promise((ok) => {
    let quietas = 0;
    const mirar = () => { quietas = window.__enVuelo === 0 ? quietas + 1 : 0; if (quietas >= 6) ok(true); else setTimeout(mirar, 20); };
    mirar();
  }), { timeout: 8000 });
}

/** Pulsa como una persona: el dedo toca; el ratón baja, aguanta 90 ms y sube. */
async function pulsar(page, selector, dedo) {
  // El panel desplaza con suavidad: se pide el salto en seco y se espera un fotograma, o la caja que se
  // mide es la de ANTES de moverse y el dedo cae en otro sitio. Y se comprueba qué hay debajo del punto:
  // si no es el botón, el instrumento no ha pulsado nada y lo dice (no es «el botón no responde»).
  const caja = await page.evaluate(async (s) => {
    const n = document.querySelector(s);
    if (!n) return null;
    n.scrollIntoView({ block: 'center', behavior: 'instant' });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const r = n.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const debajo = document.elementFromPoint(x, y);
    return { x, y, esElBoton: !!(debajo && (debajo === n || n.contains(debajo))), encima: debajo ? debajo.tagName.toLowerCase() + '.' + debajo.className : 'nada' };
  }, selector);
  if (!caja) throw new Error('no encuentro ' + selector);
  if (!caja.esElBoton) throw new Error('NO SUPE PULSAR: en el punto de ' + selector + ' (' + Math.round(caja.x) + ',' + Math.round(caja.y) + ') hay otra cosa: ' + caja.encima);
  if (dedo) await page.touchscreen.tap(caja.x, caja.y);
  else { await page.mouse.move(caja.x, caja.y); await page.mouse.down(); await new Promise((r) => setTimeout(r, 90)); await page.mouse.up(); }
  await quieta(page);
}

const fotoDelParte = (page) => page.evaluate(() => {
  const bloques = {};
  for (const tb of document.querySelectorAll('[data-parte-filas]')) {
    const b = tb.getAttribute('data-parte-filas');
    bloques[b] = Array.from(tb.querySelectorAll('tr')).map((tr) => {
      const u = tr.querySelector('.parte-linea-unds'), d = tr.querySelector('.parte-linea-desc');
      if (!u || !d) return null;
      return (tr.hasAttribute('data-parte-linea-nueva') ? 'POR ESCRIBIR ' : 'guardada ') + '«' + u.value + ' · ' + d.value + '»';
    }).filter(Boolean);
  }
  const a = document.activeElement;
  const fila = a && a.closest ? a.closest('tr') : null;
  const tb = a && a.closest ? a.closest('[data-parte-filas]') : null;
  let foco = a && a !== document.body ? a.tagName.toLowerCase() : 'ninguno';
  if (a && a.classList && a.classList.contains('parte-linea-unds')) foco = 'UNDS';
  if (a && a.classList && a.classList.contains('parte-linea-desc')) foco = 'descripción';
  if (a && a.classList && a.classList.contains('parte-anadir')) foco = 'botón «Añadir línea»';
  if (fila && tb) foco += (fila.hasAttribute('data-parte-linea-nueva') ? ' de la fila por escribir' : ' de una guardada') + ' (' + tb.getAttribute('data-parte-filas') + ')';
  return {
    bloques, foco,
    porEscribir: document.querySelectorAll('[data-parte-linea-nueva]').length,
    enServidor: null,
    patch: window.__peticiones.filter((p) => p.metodo === 'PATCH').length,
    get: window.__peticiones.filter((p) => p.metodo === 'GET' && /partes/.test(p.ruta)).length,
    clicsLlegados: window.__clics,
    errores: window.__errores.slice(),
  };
});

const ANADIR = (bloque) => `.parte-anadir[data-bloque="${bloque}"]`;

/**
 * LA SECUENCIA DEL FUNDADOR: «tienes que escribirlo, añadir línea y luego le das otra vez y ya te añade otra».
 * Añadir → escribir cantidad y descripción → «Añadir línea» (con el cursor aún en la descripción) → otra vez.
 */
async function secuenciaDelFundador(browser, puerto, etiqueta, latencia, ancho, alto, dedo) {
  const page = await abrir(browser, puerto, '/parte-' + latencia, ancho, alto, dedo);
  const pasos = [];
  const apunta = async (que) => { const f = await fotoDelParte(page); pasos.push({ paso: que, ...f }); return f; };
  await apunta('0 · parte abierto');
  await pulsar(page, ANADIR('mano_obra'), dedo);
  await apunta('1 · pulso «Añadir línea» (mano de obra)');
  await page.keyboard.type('3');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Purgado del circuito');
  await apunta('2 · escribo «3» y «Purgado del circuito»; el cursor sigue en la descripción');
  await pulsar(page, ANADIR('mano_obra'), dedo);
  await apunta('3 · pulso «Añadir línea» OTRA VEZ, con la fila escrita');
  await page.screenshot({ path: path.join(FOTOS, `${etiqueta}-tras-anadir-con-fila-escrita-${ancho}-latencia${latencia}.png`) });
  // Lo que una persona hace a continuación: seguir tecleando. ¿Dónde cae?
  await page.keyboard.type('1');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Limpieza de filtros');
  await quieta(page);
  await apunta('4 · sigo tecleando «1», Tab, «Limpieza de filtros» (sin tocar el ratón)');
  await pulsar(page, ANADIR('mano_obra'), dedo);
  await apunta('5 · pulso «Añadir línea» una vez más');
  await page.close();
  return pasos;
}

/** FILA A MEDIAS: sólo la cantidad, y «Añadir línea». ¿Se pierde lo tecleado? ¿Aparece otra? */
async function secuenciaAMedias(browser, puerto, latencia, ancho, alto, dedo) {
  const page = await abrir(browser, puerto, '/parte-' + latencia, ancho, alto, dedo);
  const pasos = [];
  const apunta = async (que) => { const f = await fotoDelParte(page); pasos.push({ paso: que, ...f }); return f; };
  await pulsar(page, ANADIR('mano_obra'), dedo);
  await page.keyboard.type('4');
  await apunta('1 · «Añadir línea» y escribo sólo la cantidad «4»');
  await pulsar(page, ANADIR('mano_obra'), dedo);
  await apunta('2 · pulso «Añadir línea» con la fila a medias');
  await pulsar(page, ANADIR('materiales'), dedo);
  await apunta('3 · pulso «Añadir línea» del OTRO bloque (materiales)');
  await page.close();
  return pasos;
}

/** EL PATRÓN DE PRESUPUESTOS: tres pulsaciones seguidas de «+ Añadir línea», escribiendo entre medias. */
async function patronDePresupuestos(browser, puerto, ancho, alto, dedo) {
  const page = await abrir(browser, puerto, '/editor', ancho, alto, dedo);
  const mira = () => page.evaluate(() => {
    const filas = Array.from(document.querySelectorAll('#view-container [role="listitem"]'));
    const conceptos = filas.map((f) => f.querySelector('input[placeholder="Concepto / servicio"]')).filter(Boolean);
    const a = document.activeElement;
    const i = conceptos.indexOf(a);
    const boton = document.querySelector('.quote-add-line');
    return {
      filas: conceptos.map((c) => c.value),
      foco: i >= 0 ? 'concepto de la fila ' + (i + 1) + ' de ' + conceptos.length : (a && a !== document.body ? a.tagName.toLowerCase() : 'ninguno'),
      escrituras: window.__peticiones.filter((p) => p.metodo !== 'GET').length,
      botonALaVista: !!(boton && boton.offsetParent !== null),
      clicsLlegados: window.__clics,
    };
  });
  const pasos = [];
  let f = await mira();
  pasos.push({ paso: '0 · editor abierto', ...f });
  if (!f.botonALaVista) {
    // El asistente abre en su primer paso (Cliente) y pliega «Conceptos». Se abre con el «Cambiar» de
    // SU paso, que es el camino de una persona; llegar aquí no es lo que se mide.
    await page.select('select[name="customer_id"]', String(CLIENTES[0].id));
    const llegue = await page.evaluate(() => {
      // «Continuar» del paso abierto: el único botón suyo, a la vista y habilitado, que no es «Cambiar».
      const abierto = document.querySelector('.quote-paso.is-abierto');
      const seguir = abierto && Array.from(abierto.querySelectorAll('button'))
        .find((b) => b.offsetParent !== null && !b.disabled && !b.classList.contains('quote-paso__cambiar') && /continuar/i.test(b.textContent || ''));
      if (seguir) seguir.click();
      const boton = document.querySelector('.quote-add-line');
      return !!(boton && boton.offsetParent !== null);
    });
    if (!llegue) { await page.close(); return null; }
  }
  // La línea que el editor trae lista para escribir: se toca su concepto, como haría una persona.
  await pulsar(page, '#view-container [role="listitem"] input[placeholder="Concepto / servicio"]', dedo);
  pasos.push({ paso: '0b · paso «Conceptos» abierto; toco el concepto de la línea que trae', ...(await mira()) });
  // Marca los nodos de las filas: si un clic repintara la lista, la marca desaparecería.
  await page.evaluate(() => { document.querySelectorAll('#view-container [role="listitem"]').forEach((n) => { n.__marca = true; }); });
  for (let n = 1; n <= 3; n++) {
    await page.keyboard.type('Concepto ' + n);   // escribe donde esté el foco
    await pulsar(page, '.quote-add-line', dedo);
    f = await mira();
    f.filasQueSobreviven = await page.evaluate(() => Array.from(document.querySelectorAll('#view-container [role="listitem"]')).filter((x) => x.__marca).length);
    await page.evaluate(() => { document.querySelectorAll('#view-container [role="listitem"]').forEach((x) => { x.__marca = true; }); });
    pasos.push({ paso: `${n} · tecleo «Concepto ${n}» y pulso «+ Añadir línea»`, ...f });
  }
  await page.close();
  return pasos;
}

const pinta = (titulo, pasos) => {
  console.log('\n── ' + titulo);
  for (const p of pasos) {
    if (p.bloques) {
      console.log(`  ${p.paso}\n      mano de obra: ${p.bloques.mano_obra.join(' | ') || '—'}\n      materiales:   ${p.bloques.materiales.join(' | ') || '—'}` +
        `\n      foco: ${p.foco} · PATCH ${p.patch} · relecturas ${p.get} · clics que llegaron al botón: ${p.clicsLlegados}` + (p.errores.length ? ` · ERRORES: ${p.errores.join(' | ')}` : ''));
    } else {
      console.log(`  ${p.paso}\n      filas: ${JSON.stringify(p.filas)} · foco: ${p.foco} · escrituras al servidor: ${p.escrituras} · clics: ${p.clicsLlegados}` +
        (p.filasQueSobreviven !== undefined ? ` · nodos de fila que siguen siendo los mismos: ${p.filasQueSobreviven}` : ''));
    }
  }
};

/** EL OBJETIVO, exigido a «después»: un clic, una fila nueva vacía con el foco en su UNDS, y nada perdido. */
function exigir(clave, pasos) {
  const p3 = pasos[3], p4 = pasos[4], p5 = pasos[5];
  const mano = (p) => p.bloques.mano_obra;
  if (p3.clicsLlegados !== 2) fallo(1, `${clave}: el segundo clic no llegó al botón (${p3.clicsLlegados} de 2).`);
  if (!mano(p3).some((l) => /3 · Purgado del circuito/.test(l))) fallo(1, `${clave}: lo escrito se ha perdido tras pulsar «Añadir línea».`);
  if (p3.porEscribir !== 1 || !mano(p3).some((l) => l === 'POR ESCRIBIR « · »')) fallo(1, `${clave}: tras UN clic con la fila escrita no hay una fila nueva vacía (hay ${p3.porEscribir} por escribir).`);
  if (p3.foco !== 'UNDS de la fila por escribir (mano_obra)') fallo(1, `${clave}: el foco no queda en la UNDS de la fila nueva, sino en «${p3.foco}».`);
  if (!mano(p4).some((l) => /1 · Limpieza de filtros/.test(l))) fallo(1, `${clave}: lo tecleado a continuación no cae en la fila nueva.`);
  if (!mano(p5).some((l) => /guardada «1 · Limpieza de filtros»/.test(l)) || !mano(p5).some((l) => /guardada «3 · Purgado del circuito»/.test(l))) fallo(1, `${clave}: tras la tercera pulsación no están guardadas las dos líneas escritas.`);
  if (p5.porEscribir !== 1 || p5.foco !== 'UNDS de la fila por escribir (mano_obra)') fallo(1, `${clave}: la tercera pulsación no deja otra fila vacía con el foco en su UNDS.`);
  if (p5.errores.length) fallo(1, `${clave}: errores en la página: ${p5.errores.join(' | ')}`);
}

const partida = arbolDePartida(RAIZ, 'antes-916b');
if (!partida.publico) {
  console.error('🔴 NO SUPE MIRAR: no se pudo resolver el punto de partida de la rama (merge-base).');
  process.exit(2);
}
fs.mkdirSync(FOTOS, { recursive: true });
const { browser } = await abrirNavegador(puppeteer);
const antes = await servirListas(partida.publico, RUTAS);
const despues = SOLO_ANTES ? null : await servirListas(path.join(RAIZ, 'public'), RUTAS);
const medido = {};
const MODOS = [{ nombre: '390 con el dedo', ancho: 390, alto: 844, dedo: true }, { nombre: '1280 con el ratón', ancho: 1280, alto: 900, dedo: false }];

try {
  for (const [etiqueta, srv] of [['antes', antes], ['despues', despues]]) {
    if (!srv) continue;
    for (const modo of MODOS) {
      for (const latencia of LATENCIAS) {
        const clave = `${etiqueta} · ${modo.nombre} · servidor a ${latencia} ms`;
        const pasos = await secuenciaDelFundador(browser, srv.puerto, etiqueta, latencia, modo.ancho, modo.alto, modo.dedo);
        medido[clave + ' · la secuencia del fundador'] = pasos;
        pinta(clave + ' · LA SECUENCIA DEL FUNDADOR', pasos);
        if (pasos[1].porEscribir !== 1) fallo(2, `NO SUPE MIRAR: ${clave}: el primer «Añadir línea» no abre fila; lo demás no mide nada.`);
        else if (etiqueta === 'despues') exigir(clave, pasos);
      }
      const medias = await secuenciaAMedias(browser, srv.puerto, 150, modo.ancho, modo.alto, modo.dedo);
      medido[`${etiqueta} · ${modo.nombre} · fila a medias`] = medias;
      pinta(`${etiqueta} · ${modo.nombre} · FILA A MEDIAS (servidor a 150 ms)`, medias);
      if (etiqueta === 'despues' && !medias.every((p) => p.bloques.mano_obra.some((l) => /POR ESCRIBIR «4 · »/.test(l)))) {
        fallo(1, `${etiqueta} · ${modo.nombre}: la cantidad a medias («4») se pierde al pulsar «Añadir línea».`);
      }
    }
  }
  for (const modo of MODOS) {
    const pasos = await patronDePresupuestos(browser, antes.puerto, modo.ancho, modo.alto, modo.dedo);
    if (!pasos) { fallo(2, `NO SUPE MIRAR: presupuestos a ${modo.nombre}: no llego a «+ Añadir línea».`); continue; }
    medido[`presupuestos · ${modo.nombre}`] = pasos;
    pinta(`PRESUPUESTOS · ${modo.nombre} · el patrón que se espeja`, pasos);
  }
} finally {
  await browser.close();
  antes.cerrar && antes.cerrar();
  despues && despues.cerrar && despues.cerrar();
  partida.limpiar();
}

// Una secuencia por línea: el fichero se lee en un diff.
fs.writeFileSync(path.join(AQUI, 'secuencia.json'),
  '{\n' + Object.entries(medido).map(([k, v]) => ` ${JSON.stringify(k)}: [\n` + v.map((p) => '  ' + JSON.stringify(p)).join(',\n') + '\n ]').join(',\n') + '\n}\n');
console.log(`\nSecuencias: ${Object.keys(medido).length} · fotos en ${FOTOS}`);
process.exit(salida);
