// docs/master/evidencias/SCRUM-1824/reproducir.mjs — SCRUM-1824 (S4)
//
// LA CARRERA DEL DICTADO: «Añadir al parte» viajando, y el técnico que sigue apuntando a mano.
// Navegador real, dedo, ratón y teclado de verdad (nada de `dispatchEvent`); el molde es el banco de
// SCRUM-916b (`../SCRUM-916/b-anadir-linea/reproducir.mjs`): `PATCH` retenido + escribir en paralelo.
//
// Uso:  node docs/master/evidencias/SCRUM-1824/reproducir.mjs [--solo-antes]
//   · «antes»   = el punto de partida de la rama (merge-base con main).
//   · «después» = el árbol de trabajo. Sin `--solo-antes` se le EXIGE el objetivo.
// Fotos (fuera de git, A8): D:\MILLONARIO\cobroFlash\capturas\SCRUM-1824\ (o CAPTURAS_DIR)
// Secuencias medidas: `secuencia.json`, junto a este fichero.
//
// Sale con 1 si «después» no cumple, con 2 si no supo mirar. Con `--solo-antes` sólo documenta.
//
// El servidor es de mentira y vive en la página. Guarda las líneas de cada `PATCH` (la lista ENTERA,
// como el de verdad) y las devuelve en el `GET`. Dos maneras de hacer viajar el `PATCH` del dictado:
//   · RETÉN: el `PATCH` se queda fuera hasta que el banco lo suelta. Determinista.
//   · RED LENTA: sin retén, el servidor tarda 1200 ms en todo. Lo que decide es el reloj.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { servirListas, abrirNavegador, arbolDePartida } from '../../../../scripts/_banco-lista.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..', '..', '..', '..');
const FOTOS = process.env.CAPTURAS_DIR || 'D:\\MILLONARIO\\cobroFlash\\capturas\\SCRUM-1824';
const SOLO_ANTES = process.argv.includes('--solo-antes');
const RED_LENTA = 1200;

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
const PROPUESTA = {
  propuesta: {
    vacia: false, sinBloque: [], datosRetirados: [],
    mano_obra: [{ unds: 1, descripcion: 'Purgado del circuito' }],
    materiales: [{ unds: 2, descripcion: 'Racores de tres cuartos' }],
  },
  avisos: {},
};
const DICTADO = 'He purgado el circuito y he puesto dos racores de tres cuartos';

// Lo que tiene que haber al final, como CONJUNTO (A3: se comparan conjuntos, no cuentas).
const INICIALES = ['mano_obra · 2 · Sustitución de la bomba de recirculación', 'materiales · 1 · Bomba de recirculación 25-60'];
const DICTADAS = ['mano_obra · 1 · Purgado del circuito', 'materiales · 2 · Racores de tres cuartos'];
const MANUAL = 'mano_obra · 3 · Limpieza de filtros';

const servidorDelParte = (latencia) => `(function () {
  var parte = ${JSON.stringify(PARTE)};
  var siguiente = 100;
  var copia = function (v) { return JSON.parse(JSON.stringify(v)); };
  var tras = function (fn) { return new Promise(function (r) { setTimeout(function () { r(fn()); }, ${latencia}); }); };
  window.__servidor = function () { return copia(parte.lineas); };
  window.__retenElSiguientePatch = false;
  window.__soltar = null;
  return function (ruta, opciones) {
    var metodo = opciones.method || 'GET';
    if (/\\/admin\\/partes\\/12\\/dictado$/.test(ruta)) return tras(function () { return ${JSON.stringify(PROPUESTA)}; });
    if (/\\/admin\\/partes\\/12$/.test(ruta)) {
      if (metodo === 'PATCH') {
        var c = JSON.parse(opciones.body || '{}');
        var aplicar = function () {
          if (Array.isArray(c.lineas)) parte.lineas = c.lineas.map(function (l) { return Object.assign({}, l, { id: l.id || siguiente++ }); });
          return copia(parte);
        };
        if (window.__retenElSiguientePatch) {
          window.__retenElSiguientePatch = false;
          return new Promise(function (r) { window.__soltar = function () { window.__soltar = null; r(aplicar()); }; });
        }
        return tras(aplicar);
      }
      return tras(function () { return copia(parte); });
    }
    if (/\\/admin\\/merchant/.test(ruta)) return ${JSON.stringify(NEGOCIO)};
    return {};
  };
})()`;
const RUTAS = [0, 150, RED_LENTA].map((l) => ({ ruta: '/parte-' + l, fnVista: 'renderParteDetailView', datos: servidorDelParte(l), args: '[12]' }));

let salida = 0;
const fallo = (codigo, texto) => { console.error('🔴 ' + texto); salida = Math.max(salida, codigo); };
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

async function abrir(browser, puerto, ruta, modo) {
  const page = await browser.newPage();
  await page.setViewport({ width: modo.ancho, height: modo.alto, hasTouch: modo.dedo, isMobile: modo.dedo });
  await page.goto(`http://127.0.0.1:${puerto}${ruta}`, { waitUntil: 'load' });
  await page.waitForFunction('window.__listo === true', { timeout: 20000 });
  return page;
}

/** Sin peticiones en vuelo, y que siga sin haberlas un momento después (una cadena PATCH→GET pasa por cero). */
async function quieta(page) {
  await page.waitForFunction(() => new Promise((ok) => {
    let quietas = 0;
    const mirar = () => { quietas = window.__enVuelo === 0 ? quietas + 1 : 0; if (quietas >= 6) ok(true); else setTimeout(mirar, 20); };
    mirar();
  }), { timeout: 12000 });
}

/** Pulsa como una persona. `esperar: false` cuando lo pulsado deja una petición RETENIDA: no habrá quietud. */
async function pulsar(page, selector, dedo, esperar = true) {
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
  if (!caja.esElBoton) throw new Error('NO SUPE PULSAR: en el punto de ' + selector + ' hay otra cosa: ' + caja.encima);
  if (dedo) await page.touchscreen.tap(caja.x, caja.y);
  else { await page.mouse.move(caja.x, caja.y); await page.mouse.down(); await pausa(90); await page.mouse.up(); }
  if (esperar) await quieta(page); else await pausa(60);
}

const foto = (page) => page.evaluate(() => {
  const pantalla = [];
  let porEscribir = 0;
  for (const tb of document.querySelectorAll('[data-parte-filas]')) {
    const b = tb.getAttribute('data-parte-filas');
    for (const tr of tb.querySelectorAll('tr')) {
      const u = tr.querySelector('.parte-linea-unds'), d = tr.querySelector('.parte-linea-desc');
      if (!u || !d) continue;
      const nueva = tr.hasAttribute('data-parte-linea-nueva');
      if (nueva) porEscribir++;
      pantalla.push((nueva ? 'POR ESCRIBIR ' : '') + b + ' · ' + u.value + ' · ' + d.value);
    }
  }
  let borrador = null;
  try { borrador = window.localStorage.getItem('yaqu_parte_dictado_12'); } catch (e) { borrador = 'SIN ALMACÉN'; }
  return {
    servidor: window.__servidor().map((l) => l.bloque + ' · ' + l.unds + ' · ' + l.descripcion),
    pantalla, porEscribir,
    propuestaEnPantalla: document.querySelectorAll('[data-propuesta="1"]').length,
    borradorDelDictadoEnElMovil: borrador ? 'sí' : 'no',
    patch: window.__peticiones.filter((p) => p.metodo === 'PATCH').map((p) => (JSON.parse(p.cuerpo || '{}').lineas || []).length + ' líneas'),
    relecturas: window.__peticiones.filter((p) => p.metodo === 'GET' && /partes\/12$/.test(p.ruta)).length,
    retenido: typeof window.__soltar === 'function',
    errores: window.__errores.slice(),
  };
});

const ANADIR = (bloque) => `.parte-anadir[data-bloque="${bloque}"]`;

/** Dicta, ordena y deja la propuesta en pantalla. */
async function dictarYOrdenar(page, modo) {
  await pulsar(page, '#parte-dictado', modo.dedo);
  await page.keyboard.type(DICTADO);
  await pulsar(page, '[data-dictado-ordenar]', modo.dedo);
}
/** Añade una fila a mano y la deja COMPLETA y con el cursor fuera (que es cuando se guarda). */
async function filaAMano(page, modo, esperar) {
  await pulsar(page, ANADIR('mano_obra'), modo.dedo, esperar);
  await page.keyboard.type('3');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Limpieza de filtros');
  await page.keyboard.press('Tab');
}

/**
 * CONTROL (el orden que NO corre): la fila a mano se guarda, y DESPUÉS se añade lo dictado.
 * Tiene que dar las cinco en «antes» y en «después»: si no, el banco no sabe ver cinco líneas.
 */
async function control(browser, puerto, modo) {
  const page = await abrir(browser, puerto, '/parte-150', modo);
  const pasos = [];
  const apunta = async (que) => { pasos.push({ paso: que, ...(await foto(page)) }); };
  await filaAMano(page, modo, true);
  await quieta(page);
  await apunta('1 · fila a mano completa y guardada');
  await dictarYOrdenar(page, modo);
  await pulsar(page, '[data-propuesta-confirmar]', modo.dedo);
  await apunta('2 · dicto, ordeno y «Añadir al parte» (nada viajando)');
  await page.close();
  return pasos;
}

/** ① LA LECTURA DE LA ANTECESORA: lo dictado viaja y, mientras, se completa una fila a mano. */
async function filaManualMientrasViaja(browser, puerto, etiqueta, modo, conReten) {
  const page = await abrir(browser, puerto, conReten ? '/parte-150' : '/parte-' + RED_LENTA, modo);
  const pasos = [];
  const apunta = async (que) => { pasos.push({ paso: que, ...(await foto(page)) }); };
  await dictarYOrdenar(page, modo);
  await apunta('1 · dicto y «Ordenar en líneas»: la propuesta está en pantalla');
  if (conReten) await page.evaluate(() => { window.__retenElSiguientePatch = true; });
  await pulsar(page, '[data-propuesta-confirmar]', modo.dedo, false);
  await apunta('2 · «Añadir al parte»: su PATCH viaja' + (conReten ? ' (retenido)' : ` (red a ${RED_LENTA} ms)`));
  await filaAMano(page, modo, false);
  await apunta('3 · mientras viaja: «Añadir línea», «3», «Limpieza de filtros», y salgo de la casilla');
  if (conReten) await page.evaluate(() => { window.__soltar(); });
  await quieta(page);
  await apunta('4 · ' + (conReten ? 'suelto el PATCH del dictado' : 'llega todo') + ' y espero a que no viaje nada');
  await page.screenshot({ path: path.join(FOTOS, `${etiqueta}-fila-manual-${conReten ? 'reten' : 'red-lenta'}-${modo.ancho}.png`), fullPage: true });
  await page.close();
  return pasos;
}

/** ② LA MISMA FAMILIA, OTRO BOTÓN: lo dictado viaja y se corrige la cantidad de una línea YA guardada. */
async function casillaGuardadaMientrasViaja(browser, puerto, etiqueta, modo) {
  const page = await abrir(browser, puerto, '/parte-150', modo);
  const pasos = [];
  const apunta = async (que) => { pasos.push({ paso: que, ...(await foto(page)) }); };
  await dictarYOrdenar(page, modo);
  await page.evaluate(() => { window.__retenElSiguientePatch = true; });
  await pulsar(page, '[data-propuesta-confirmar]', modo.dedo, false);
  await apunta('1 · «Añadir al parte»: su PATCH viaja (retenido)');
  await pulsar(page, '[data-linea-unds="0"]', modo.dedo, false);
  await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
  await page.keyboard.type('4');
  await page.keyboard.press('Tab');
  await apunta('2 · mientras viaja: corrijo la cantidad de la primera línea guardada (2 → 4) y salgo');
  await page.evaluate(() => { window.__soltar(); });
  await quieta(page);
  await apunta('3 · suelto el PATCH del dictado y espero a que no viaje nada');
  await page.screenshot({ path: path.join(FOTOS, `${etiqueta}-casilla-guardada-${modo.ancho}.png`), fullPage: true });
  await page.close();
  return pasos;
}

const pinta = (titulo, pasos) => {
  console.log('\n── ' + titulo);
  for (const p of pasos) {
    console.log(`  ${p.paso}\n      SERVIDOR (${p.servidor.length}): ${p.servidor.join(' | ')}\n      PANTALLA (${p.pantalla.length}): ${p.pantalla.join(' | ')}` +
      `\n      PATCH enviados: [${p.patch.join(', ')}] · relecturas ${p.relecturas} · propuesta en pantalla: ${p.propuestaEnPantalla} · borrador del dictado en el móvil: ${p.borradorDelDictadoEnElMovil}` +
      (p.retenido ? ' · HAY UN PATCH RETENIDO' : '') + (p.errores.length ? ` · ERRORES: ${p.errores.join(' | ')}` : ''));
  }
};

const mismas = (a, b) => a.length === b.length && [...a].sort().join('\n') === [...b].sort().join('\n');
const faltan = (tiene, quiere) => quiere.filter((x) => !tiene.includes(x));

/** EL OBJETIVO: en el servidor y en la pantalla, TODO lo que el técnico apuntó. Ni una menos, ni una de más. */
function exigir(clave, ultimo, esperadas) {
  if (!mismas(ultimo.servidor, esperadas)) fallo(1, `${clave}: en el SERVIDOR faltan [${faltan(ultimo.servidor, esperadas).join(' | ') || '—'}] y sobran [${faltan(esperadas, ultimo.servidor).join(' | ') || '—'}].`);
  if (!mismas(ultimo.pantalla, esperadas)) fallo(1, `${clave}: la PANTALLA no enseña lo guardado: faltan [${faltan(ultimo.pantalla, esperadas).join(' | ') || '—'}] y sobran [${faltan(esperadas, ultimo.pantalla).join(' | ') || '—'}].`);
  if (ultimo.porEscribir !== 0) fallo(1, `${clave}: quedan ${ultimo.porEscribir} filas por escribir que estaban completas.`);
  if (ultimo.propuestaEnPantalla !== 0 || ultimo.borradorDelDictadoEnElMovil !== 'no') fallo(1, `${clave}: lo dictado ya está en el parte y su propuesta sigue (en pantalla ${ultimo.propuestaEnPantalla}, en el móvil: ${ultimo.borradorDelDictadoEnElMovil}); añadirla otra vez la duplicaría.`);
  if (ultimo.errores.length) fallo(1, `${clave}: errores en la página: ${ultimo.errores.join(' | ')}`);
}

const partida = arbolDePartida(RAIZ, 'antes-1824');
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
const TODAS = INICIALES.concat(DICTADAS, [MANUAL]);
const CON_LA_CORREGIDA = ['mano_obra · 4 · Sustitución de la bomba de recirculación', INICIALES[1]].concat(DICTADAS);

try {
  for (const [etiqueta, srv] of [['antes', antes], ['despues', despues]]) {
    if (!srv) continue;
    for (const modo of MODOS) {
      const base = `${etiqueta} · ${modo.nombre}`;
      const anota = (nombre, pasos) => { medido[`${base} · ${nombre}`] = pasos; pinta(`${base} · ${nombre}`, pasos); return pasos[pasos.length - 1]; };

      const c = anota('CONTROL: primero la fila a mano, después lo dictado', await control(browser, srv.puerto, modo));
      if (!mismas(c.servidor, TODAS) || !mismas(c.pantalla, TODAS)) {
        fallo(2, `NO SUPE MIRAR: ${base}: el control (sin carrera) no da las cinco líneas; lo demás no mide nada.`);
        continue;
      }
      const r1 = anota('① fila a mano mientras viaja lo dictado (PATCH retenido)', await filaManualMientrasViaja(browser, srv.puerto, etiqueta, modo, true));
      const r2 = anota(`① bis · lo mismo SIN retén, con la red a ${RED_LENTA} ms`, await filaManualMientrasViaja(browser, srv.puerto, etiqueta, modo, false));
      const r3 = anota('② cantidad de una línea guardada, corregida mientras viaja lo dictado', await casillaGuardadaMientrasViaja(browser, srv.puerto, etiqueta, modo));
      if (etiqueta === 'despues') {
        exigir(`${base} · ① retén`, r1, TODAS);
        exigir(`${base} · ① red lenta`, r2, TODAS);
        exigir(`${base} · ② casilla guardada`, r3, CON_LA_CORREGIDA);
      }
    }
  }
} catch (e) {
  fallo(2, 'NO SUPE MIRAR: ' + (e && e.message ? e.message : e));
} finally {
  await browser.close();
  antes.srv && antes.srv.close();
  despues && despues.srv && despues.srv.close();
  partida.limpiar();
}

// Una secuencia por línea: el fichero se lee en un diff.
fs.writeFileSync(path.join(AQUI, 'secuencia.json'),
  '{\n' + Object.entries(medido).map(([k, v]) => ` ${JSON.stringify(k)}: [\n` + v.map((p) => '  ' + JSON.stringify(p)).join(',\n') + '\n ]').join(',\n') + '\n}\n');
console.log(`\nSecuencias: ${Object.keys(medido).length} · fotos en ${FOTOS} · salida ${salida}`);
process.exit(salida);
