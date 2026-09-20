#!/usr/bin/env node
/**
 * SCRUM-915e1 · EL DOCUMENTO DE LA DERECHA SE CONSTRUYE MIENTRAS ESCRIBES, Y NO MIENTE.
 *
 * Guard de NAVEGADOR. Mide el árbol RENDERIZADO del editor de presupuestos, porque las tres cosas
 * que vigila son invisibles en el fuente:
 *
 *   ① el PIE del documento. Decía «Presupuesto válido durante 30 días salvo indicación en
 *      contrario.» fijo mientras el campo «Válido hasta» acepta cualquier fecha desde A16.2. El
 *      papel que ve el cliente prometía un mes aunque el profesional hubiera puesto una semana.
 *      Aquí se pone una fecha, se lee el pie, se pone OTRA y se vuelve a leer: un pie que no
 *      cambia con la fecha es el defecto, y un pie que dijera siempre la primera fecha también.
 *
 *   ② que el documento se rehaga MIENTRAS SE ESCRIBE. El rótulo nuevo lo promete
 *      («Se actualiza mientras escribes») y una promesa sin mecanismo es un texto que miente.
 *
 *   ③ que las filas del documento cuelguen de un `<tbody>` de verdad. El código creaba
 *      `createElement('linesBody')`, que no es una etiqueta de HTML, y `styles.css` lleva desde
 *      siempre una regla de cebra `.preview-lines-table tbody tr:nth-child(even)` que por eso NO
 *      HA PINTADO NUNCA. En el fuente las dos versiones se leen igual.
 *
 * Cada caso lleva su control: se mide una cosa que TIENE que cambiar y una que NO. Un lector que
 * devolviera siempre la misma cadena pasaría la mitad de las casillas y caería en la otra mitad.
 *
 * Salidas: 0 todo bien · 1 hallazgo · 2 no supe medir (ciego). Un ciego NUNCA sale como verde.
 *
 * Todo lo que corre DENTRO de la página va en cadenas dentro de `new Function` (censo SCRUM-258).
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from './_navegador.mjs';
import { levantarServidor } from './_servidor.mjs';

export const SALIDA_HALLAZGO = 1;
export const SALIDA_NO_SUPE_MEDIR = 2;

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let PUERTO = Number(process.env.GUARD915E1_PUERTO || 0);

// Teléfono en el rango imposible `34 0XX XXX XXX` (SCRUM-262): ningún abonado español empieza
// por 0, así que un dato de prueba nunca puede ser el número de alguien.
const CLIENTE = { id: 7, name: 'Comunidad Los Olivos', phone: '34000000001', email: 'olivos@correo.es' };
const MERCHANT = { id: 1, name: 'QA 915e1', defaultCurrency: 'EUR', country: 'ES', iban: 'ES9121000418450200051332' };

const me = () => ({
  id: 1, email: 'demo@yaqu.app', name: 'QA 915e1', plan: 'pro', role: 'admin',
  onboardingCompleted: true, subscriptionStatus: 'active', voiceEnabled: false,
  documentoSuelto: 'no',
});

function arrancarServidor() {
  const json = (res, o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  const srv = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (u === '/admin/me') return json(res, me());
    if (u === '/admin/merchant') return json(res, MERCHANT);
    if (u === '/admin/customers') return json(res, [CLIENTE]);
    if (u.startsWith('/admin/')) return json(res, { items: [], rows: [], data: [] });
    const rel = u.replace(/^\//, '');
    const f = path.join(RAIZ, 'public', rel);
    if (fs.existsSync(f) && fs.statSync(f).isFile()) {
      const ext = path.extname(f);
      const tipo = ext === '.css' ? 'text/css' : ext === '.js' ? 'application/javascript' : 'text/html';
      res.writeHead(200, { 'content-type': `${tipo}; charset=utf-8` });
      return res.end(fs.readFileSync(f));
    }
    res.writeHead(404); res.end('no');
  });
  return levantarServidor(srv, PUERTO).then((p) => { PUERTO = p; return srv; });
}

const PULSAR = new Function('texto', `
  var limpio = function (t) { return String(t || '').replace(/\\s+/g, ' ').trim(); };
  var bs = document.querySelectorAll('button');
  for (var j = 0; j < bs.length; j++) {
    var b = bs[j];
    if (limpio(b.textContent) === texto && b.checkVisibility()) {
      b.scrollIntoView({ block: 'center', behavior: 'instant' });
      b.click();
      return b.disabled ? 'estaba-deshabilitado' : 'pulsado';
    }
  }
  return 'no-encontrado';
`);

/**
 * Lo que el documento de la derecha DICE, leído del árbol renderizado.
 *
 * `rotulo`/`subrotulo` se leen por su CLASE y no por su texto: preguntar «¿existe un elemento que
 * diga X?» contesta que sí en cuanto alguien escriba X en cualquier parte de la pantalla. Se lee
 * el rótulo y se compara después, que es lo que distingue «pone lo que toca» de «pone algo».
 */
const DOCUMENTO = new Function(`
  var limpio = function (t) { return String(t || '').replace(/\\s+/g, ' ').trim(); };
  var ve = function (el) { return !!el && el.isConnected && el.checkVisibility(); };
  var caja = document.querySelector('.quote-preview');
  var tabla = caja ? caja.querySelector('.preview-lines-table') : null;
  var pie = caja ? caja.querySelector('.preview-footer') : null;
  var rot = document.querySelector('.quote-preview-title');
  var sub = document.querySelector('.quote-preview-subtitle');
  var filas = tabla ? tabla.querySelectorAll('tr') : [];
  var conceptos = [];
  for (var i = 0; i < filas.length; i++) {
    var td = filas[i].querySelector('td');
    if (td) conceptos.push(limpio(td.textContent));
  }
  return {
    hayDocumento: !!caja,
    documentoVisible: ve(caja),
    rotulo: rot ? limpio(rot.textContent) : null,
    rotuloVisible: ve(rot),
    subrotulo: sub ? limpio(sub.textContent) : null,
    subrotuloVisible: ve(sub),
    pie: pie ? limpio(pie.textContent) : null,
    pieVisible: ve(pie),
    // El cuerpo de la tabla: qué ETIQUETA es de verdad, no si «existe algo».
    cuerpos: (function () {
      if (!tabla) return [];
      var out = [];
      for (var k = 0; k < tabla.children.length; k++) out.push(tabla.children[k].tagName.toLowerCase());
      return out;
    })(),
    conceptos: conceptos,
    textoDelDocumento: caja ? limpio(caja.innerText).slice(0, 400) : null,
  };
`);

/** ¿La regla de cebra existe en la hoja de estilos? Sin ella, el `tbody` no prueba nada. */
const HAY_REGLA_DE_CEBRA = new Function(`
  var hojas = document.styleSheets;
  for (var i = 0; i < hojas.length; i++) {
    var reglas;
    try { reglas = hojas[i].cssRules; } catch (e) { continue; }
    if (!reglas) continue;
    for (var j = 0; j < reglas.length; j++) {
      var s = reglas[j].selectorText || '';
      if (s.indexOf('.preview-lines-table tbody') >= 0) return s;
    }
  }
  return null;
`);

/** Escribe una fecha en «Válido hasta» como la deja el selector del navegador, y avisa igual. */
const PONER_FECHA = new Function('dia', `
  var el = document.getElementById('quote-valid-until');
  if (!el) return 'sin-campo';
  el.value = dia;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return el.value === dia ? 'puesta' : 'no-se-quedo';
`);

const LEER_FECHA = new Function(`
  var el = document.getElementById('quote-valid-until');
  return el ? el.value : null;
`);

const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
const ddmmaaaa = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };

const hallazgos = [];
const ciegos = [];
const informe = [];

async function teclear(pag, selector, texto) {
  const el = await pag.$(selector);
  if (!el) return false;
  await el.evaluate((e) => { e.scrollIntoView({ block: 'center', behavior: 'instant' }); e.focus(); e.value = ''; });
  await pag.keyboard.type(texto);
  return true;
}

/** Deja el editor abierto en el paso Cliente, con el cliente ya elegido. */
async function abrirEditor(pag, etiqueta) {
  await pag.goto(`http://127.0.0.1:${PUERTO}/dashboard/index.html#quotes-new`, { waitUntil: 'networkidle0' });
  const pintado = await pag.waitForSelector('.quote-line .quote-line__concept input', { timeout: 10000 }).then(() => true, () => false);
  if (!pintado) { ciegos.push(`${etiqueta} -> el editor no se pintó`); return false; }
  const conClientes = await pag.waitForFunction(
    new Function(`var s = document.querySelector('select[name="customer_id"]'); return !!s && s.querySelector('option[value="${CLIENTE.id}"]');`),
    { timeout: 10000 },
  ).then(() => true, () => false);
  if (!conClientes) { ciegos.push(`${etiqueta} -> la lista de clientes no llegó al selector`); return false; }
  await espera(250);
  await pag.select('select[name="customer_id"]', String(CLIENTE.id));
  await espera(200);
  if (await pag.evaluate(PULSAR, 'Continuar') !== 'pulsado') { ciegos.push(`${etiqueta} -> «Continuar» no llevó a Conceptos`); return false; }
  await espera(300);
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LOS CASOS. La población se deriva de esta lista, no se escribe a mano.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

const CASOS = [
  {
    clave: 'rotulo',
    titulo: 'A · el rótulo del documento dice lo que es, y promete lo que el resto cumple',
    async correr(pag, etiqueta) {
      if (!await abrirEditor(pag, etiqueta)) return;
      const d = await pag.evaluate(DOCUMENTO);
      if (!d.hayDocumento) { ciegos.push(`${etiqueta} -> no encontré «.quote-preview»`); return; }
      informe.push(`${etiqueta} · rótulo=«${d.rotulo}» (visible=${d.rotuloVisible}) · segunda línea=«${d.subrotulo}» (visible=${d.subrotuloVisible})`);
      if (d.rotulo !== 'Así lo verá el cliente') {
        hallazgos.push(`${etiqueta} -> el rótulo del documento es «${d.rotulo}»; el texto firmado (com. 15868) es «Así lo verá el cliente»`);
      }
      if (!d.rotuloVisible) hallazgos.push(`${etiqueta} -> el rótulo existe pero no se ve`);
      if (d.subrotulo !== 'Se actualiza mientras escribes') {
        hallazgos.push(`${etiqueta} -> la segunda línea es «${d.subrotulo}»; el texto firmado es «Se actualiza mientras escribes»`);
      }
      if (d.subrotulo && !d.subrotuloVisible) hallazgos.push(`${etiqueta} -> la segunda línea existe pero no se ve`);
    },
  },
  {
    clave: 'hueco',
    titulo: 'B · el documento vacío describe lo que va a pasar, no da instrucciones (control positivo del lector)',
    async correr(pag, etiqueta) {
      if (!await abrirEditor(pag, etiqueta)) return;
      const d = await pag.evaluate(DOCUMENTO);
      if (!d.hayDocumento) { ciegos.push(`${etiqueta} -> no encontré «.quote-preview»`); return; }
      if (d.conceptos.length !== 1) {
        // SUELO: si el documento ya trae filas, no estoy midiendo el hueco.
        ciegos.push(`${etiqueta} -> esperaba UNA fila de hueco y encontré ${d.conceptos.length}: ${JSON.stringify(d.conceptos)}`);
        return;
      }
      informe.push(`${etiqueta} · hueco=«${d.conceptos[0]}»`);
      if (d.conceptos[0] !== 'Aquí aparecerán los conceptos que añadas.') {
        hallazgos.push(`${etiqueta} -> el hueco dice «${d.conceptos[0]}»; el texto firmado es «Aquí aparecerán los conceptos que añadas.»`);
      }
    },
  },
  {
    clave: 'vivo',
    titulo: 'C · se construye MIENTRAS escribes (con su control negativo: lo que no se teclea no sale)',
    async correr(pag, etiqueta) {
      if (!await abrirEditor(pag, etiqueta)) return;
      if (!await teclear(pag, '.quote-line .quote-line__concept input', 'Sustituir grifo monomando')
        || !await teclear(pag, '.quote-line .quote-line__qty input', '2')
        || !await teclear(pag, '.quote-line .quote-line__price input', '45')) {
        ciegos.push(`${etiqueta} -> no encontré concepto, cantidad o precio de la primera línea`); return;
      }
      // SIN salir del campo y SIN pulsar nada: el rótulo promete «mientras escribes».
      await espera(400);
      const d = await pag.evaluate(DOCUMENTO);
      informe.push(`${etiqueta} · conceptos en el documento tras teclear=${JSON.stringify(d.conceptos)}`);
      if (!d.conceptos.some((c) => c.indexOf('Sustituir grifo monomando') >= 0)) {
        hallazgos.push(`${etiqueta} -> tecleado el concepto, el documento sigue sin él: ${JSON.stringify(d.conceptos)}`);
        return;
      }
      // CONTROL NEGATIVO: un concepto que NADIE ha escrito no puede estar. Sin esto, un lector que
      // devolviera todo el texto de la pantalla pasaría la casilla de arriba sin mirar el documento.
      if (d.conceptos.some((c) => c.indexOf('Pintar la fachada') >= 0)) {
        ciegos.push(`${etiqueta} -> el lector ve un concepto que nadie escribió: no está leyendo el documento`);
      }
    },
  },
  {
    clave: 'pie',
    titulo: 'D · EL PIE DICE LA FECHA DE VERDAD, y la sigue cuando cambia (el defecto que abre el ticket)',
    async correr(pag, etiqueta) {
      if (!await abrirEditor(pag, etiqueta)) return;
      if (!await teclear(pag, '.quote-line .quote-line__concept input', 'Mano de obra (hora)')
        || !await teclear(pag, '.quote-line .quote-line__qty input', '6')
        || !await teclear(pag, '.quote-line .quote-line__price input', '38')) {
        ciegos.push(`${etiqueta} -> no encontré los campos de la primera línea`); return;
      }
      await pag.evaluate(new Function('if (document.activeElement && document.activeElement.blur) document.activeElement.blur();'));
      await espera(300);
      await pag.evaluate(PULSAR, 'Continuar'); // Conceptos -> Condiciones
      await espera(400);

      const porDefecto = await pag.evaluate(LEER_FECHA);
      if (!porDefecto) { ciegos.push(`${etiqueta} -> no encontré el campo «Válido hasta» (#quote-valid-until)`); return; }

      // ── D.1 · el pie, con la fecha que el editor trae de fábrica ────────────────────────────
      const d0 = await pag.evaluate(DOCUMENTO);
      if (!d0.pie) { hallazgos.push(`${etiqueta} -> el documento no tiene pie: no dice hasta cuándo vale`); return; }
      informe.push(`${etiqueta} · fecha de fábrica=${porDefecto} · pie=«${d0.pie}»`);
      const esperado0 = `Presupuesto válido hasta el ${ddmmaaaa(porDefecto)}.`;
      if (d0.pie !== esperado0) {
        hallazgos.push(`${etiqueta} -> con la fecha de fábrica el pie dice «${d0.pie}» y tenía que decir «${esperado0}»`);
      }
      if (!d0.pieVisible) hallazgos.push(`${etiqueta} -> el pie existe pero no se ve`);

      // ── D.2 · se cambia la fecha: el pie tiene que IRSE DETRÁS ──────────────────────────────
      // Dos fechas distintas, y ninguna de ellas a 30 días: si el pie se quedara con la coletilla
      // fija, o con la primera fecha, las dos casillas caen y dicen con qué se quedó.
      for (const [etapa, dia] of [['D.2', '2026-10-02'], ['D.3', '2026-11-20']]) {
        const puesta = await pag.evaluate(PONER_FECHA, dia);
        if (puesta !== 'puesta') { ciegos.push(`${etiqueta} ${etapa} -> no pude poner la fecha (${puesta})`); return; }
        await espera(400);
        const d = await pag.evaluate(DOCUMENTO);
        const esperado = `Presupuesto válido hasta el ${ddmmaaaa(dia)}.`;
        informe.push(`${etiqueta} ${etapa} · «Válido hasta»=${dia} · pie=«${d.pie}»`);
        if (d.pie !== esperado) {
          hallazgos.push(`${etiqueta} ${etapa} -> puesto ${dia} en «Válido hasta», el pie del papel del cliente dice «${d.pie}» y tenía que decir «${esperado}»`);
        }
      }
    },
  },
  {
    clave: 'tbody',
    titulo: 'E · las filas del documento cuelgan de un <tbody> de verdad (y la cebra tiene a quién casar)',
    async correr(pag, etiqueta) {
      if (!await abrirEditor(pag, etiqueta)) return;
      // CONTROL POSITIVO DEL INSTRUMENTO: si la regla de cebra no existiera en el CSS, esta
      // casilla no probaría nada — sería un `tbody` que a nadie le importa.
      const selector = await pag.evaluate(HAY_REGLA_DE_CEBRA);
      if (!selector) {
        ciegos.push(`${etiqueta} -> no hay ninguna regla «.preview-lines-table tbody …» en el CSS: sin ella esta casilla no mide nada`);
        return;
      }
      informe.push(`${etiqueta} · la regla que espera un tbody existe: «${selector}»`);
      const d = await pag.evaluate(DOCUMENTO);
      informe.push(`${etiqueta} · hijos de la tabla del documento=${JSON.stringify(d.cuerpos)}`);
      if (!d.cuerpos.includes('tbody')) {
        hallazgos.push(`${etiqueta} -> la tabla del documento no tiene «tbody»: sus hijos son ${JSON.stringify(d.cuerpos)}, así que «${selector}» no casa con nada`);
      }
    },
  },
];

async function main() {
  const srv = await arrancarServidor();
  let navegador = null;
  try {
    navegador = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });
    for (const c of CASOS) {
      const contexto = await navegador.createBrowserContext();
      const pag = await contexto.newPage();
      const errores = [];
      pag.on('pageerror', (e) => errores.push(String(e.message || e)));
      try {
        await pag.setViewport({ width: 1280, height: 900 });
        await c.correr(pag, c.clave);
        // Un error de JS en la página puede dejar media pantalla sin pintar y las casillas de
        // arriba contestando «no está» por un motivo que no es el que se mide.
        if (errores.length) ciegos.push(`${c.clave} -> la página lanzó ${errores.length} error(es): ${errores[0]}`);
      } finally {
        await pag.close().catch(() => {});
        await contexto.close().catch(() => {});
      }
    }
  } finally {
    if (navegador) await navegador.close().catch(() => {});
    srv.close();
  }

  const ancho = '═'.repeat(96);
  console.log(`\n  SCRUM-915e1 · EL DOCUMENTO DE LA DERECHA SE CONSTRUYE MIENTRAS ESCRIBES, Y NO MIENTE`);
  console.log(`  POBLACIÓN: ${CASOS.length} casos, ${CASOS.length} corridos · ${CASOS.map((c) => c.titulo.split(' · ')[0]).join(' · ')}`);
  informe.forEach((l) => console.log(`   · ${l}`));

  if (ciegos.length) {
    console.log(`\n  ⬜ NO SUPE MEDIR ${ciegos.length}:`);
    ciegos.forEach((l) => console.log(`   ⬜ ${l}`));
    console.log(`\n  Un ciego no es un verde: no se ha juzgado nada.\n${ancho}`);
    process.exit(SALIDA_NO_SUPE_MEDIR);
  }
  if (hallazgos.length) {
    console.log(`\n  🔴 HALLAZGOS ${hallazgos.length}:`);
    hallazgos.forEach((l) => console.log(`   🔴 ${l}`));
    console.log(`\n${ancho}`);
    process.exit(SALIDA_HALLAZGO);
  }
  console.log(`\n  ✔ en los ${CASOS.length} casos: el documento dice lo que es, se rehace mientras se escribe y su pie`);
  console.log(`    lleva la fecha que el profesional ha puesto — la misma que se guarda.\n`);
}

main().catch((e) => { console.error('⬜ el guard no llegó a medir:', e); process.exit(SALIDA_NO_SUPE_MEDIR); });
