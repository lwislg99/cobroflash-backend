/* SCRUM-1824b · LA REGLA 42 EN VIVO DE «AÑADIR AL PARTE» (la cura de SCRUM-1824, PR #3415), EN yaqu.app.
   Navegador real, cuenta de QA, parte en BORRADOR. Nada de `dispatchEvent`: se pulsa en el punto donde
   está el botón, y antes se comprueba que debajo de ese punto está él. El molde es el guion en vivo de
   SCRUM-916c (`../../SCRUM-916/r42-vivo/verificar-en-vivo.mjs`); las secuencias, las del banco
   (`../reproducir.mjs`):

   CONTROL · primero la fila a mano, después lo dictado (nada viajando)
   ①       · fila a mano mientras viaja lo dictado (`PATCH` RETENIDO en el navegador hasta soltarlo)
   ① bis   · lo mismo sin retén: todo lo de /admin/ sale 1200 ms tarde (decide el reloj)
   ②       · cantidad de una línea guardada corregida mientras viaja (`PATCH` retenido)

   El DICTADO ES EL DE VERDAD: `POST /admin/partes/<borrador>/dictado` llega al servidor y contesta lo
   que conteste. Por eso lo dictado no se sabe de antemano: se LEE de la propuesta en pantalla antes de
   confirmarla, y eso es lo que tiene que quedar en el servidor.

   ESCRIBE en la cuenta de QA, y SÓLO en un parte: `PATCH /admin/partes/<borrador>` (las líneas). El
   `POST …/dictado` pasa (no guarda nada: propone). Cualquier otra petición que no sea GET/HEAD se CORTA
   y se apunta; el interceptor lleva su control positivo antes de tocar nada. AL ACABAR CADA SECUENCIA
   RECOGE con la pantalla (la «×» y la casilla): el parte vuelve a sus líneas de partida, con sus ids.
   Si el guion se cae a medias, lo último que hace es dejar el parte como estaba con un `PATCH` de la
   lista de partida, y lo DICE (`restauradoPorFuera`).

   El retén y el retraso viven en el navegador: el servidor no se toca. Cada `PATCH` del informe declara
   cómo viajó (`viaje`).

   La cookie se lee de su fichero (la deja `scripts/qa/sesion-panel.mjs login`) y no se imprime.

   Uso: node verificar-en-vivo.mjs <carpeta de salida> <id borrador> <ancho> <alto> <blob>
     <blob> = `git rev-parse origin/main:public/dashboard/js/parteDetailView.js` (se LEE, no se deduce)
   Sale 0 si todo se cumple · 1 si una aceptación NO se cumple · 2 si no supo mirar. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const [salida, borradorArg, anchoArg, altoArg, blobEsperado] = process.argv.slice(2);
const borrador = Number(borradorArg), ancho = Number(anchoArg), alto = Number(altoArg);
if (!salida || !(borrador > 0) || !(ancho > 0) || !(alto > 0) || !/^[0-9a-f]{40}$/.test(blobEsperado || '')) {
  console.error('uso: <carpeta> <id borrador> <ancho> <alto> <blob de 40>'); process.exit(3);
}
const PW = process.env.PLAYWRIGHT_CORE || 'C:/Users/Admin/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core';
const NAVEGADORES = process.env.PLAYWRIGHT_NAVEGADORES || 'C:/Users/Admin/AppData/Local/ms-playwright';
const RUTA_SESION = 'C:/Users/Admin/.yaqu-qa-sesion.txt';
const BASE = 'https://yaqu.app';
const DEDO = ancho < 600;
const RUTA_PARTE = `/admin/partes/${borrador}`;
const PATCH_DEL_PARTE = `PATCH ${RUTA_PARTE}`;
const POST_DEL_DICTADO = `POST ${RUTA_PARTE}/dictado`;
const RED_LENTA = 1200;
const MARCA = `QA1824-${ancho} `;
const MANUAL = { bloque: 'mano_obra', unds: 3, descripcion: MARCA + 'limpieza de filtros' };
const DICTADO = 'He purgado el circuito y he puesto dos racores de tres cuartos';

const ciego = (m) => { console.error('CIEGO: ' + m); process.exit(2); };
if (!fs.existsSync(RUTA_SESION)) ciego('no hay sesión guardada');
const galleta = fs.readFileSync(RUTA_SESION, 'utf8').match(/pf_session=([^;,\s]+)/);
if (!galleta) ciego('el fichero de sesión no lleva pf_session');
if (!fs.existsSync(NAVEGADORES)) ciego('no encuentro ' + NAVEGADORES);
const exe = fs.readdirSync(NAVEGADORES).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()
  .map((d) => fs.readdirSync(path.join(NAVEGADORES, d)).map((s) => path.join(NAVEGADORES, d, s, 'chrome.exe')).find((p) => fs.existsSync(p)))
  .find(Boolean);
if (!exe) ciego('no encuentro chrome.exe en ' + NAVEGADORES);

const { chromium } = createRequire(import.meta.url)(PW);
fs.mkdirSync(salida, { recursive: true });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const informe = {
  ventana: `${ancho}x${alto}`, puntero: DEDO ? 'dedo' : 'ratón', borrador, dictado: DICTADO,
  horaDelServidor: null, build: null, blob: null, control: null,
  cortadas: [], patch: [], secuencias: [], comprobaciones: [],
};
let codigo = 0;
const comprueba = (id, que, ok, visto) => {
  informe.comprobaciones.push({ id, que, ok: !!ok, visto });
  if (!ok) { codigo = Math.max(codigo, 1); console.error(`🔴 ${id} · ${que} → ${JSON.stringify(visto)}`); }
};

const cara = (l) => `${l.bloque} · ${Number(l.unds)} × ${String(l.descripcion).trim()}`;
const iguales = (a, b) => JSON.stringify(a.slice().sort()) === JSON.stringify(b.slice().sort());

const navegador = await chromium.launch({ executablePath: exe, headless: true });
let ctx = null, page = null, antes = null;
try {
  ctx = await navegador.newContext({
    viewport: { width: ancho, height: alto }, hasTouch: DEDO, isMobile: DEDO, serviceWorkers: 'block', locale: 'es-ES',
  });
  await ctx.addCookies([{ name: 'pf_session', value: galleta[1], domain: 'yaqu.app', path: '/', secure: true, httpOnly: true }]);

  /* El viaje: `reten` deja el SIGUIENTE `PATCH` del parte parado hasta `soltar()`; `latencia` retrasa TODO lo de /admin/. */
  let reten = false, soltar = null, latencia = 0;
  // `enlatar` contesta el SIGUIENTE `POST …/dictado` desde el navegador, con la propuesta del banco y
  // los avisos que el servidor de verdad mandó en su última respuesta (no se reteclea ningún texto).
  let enlatar = false, avisosDelServidor = {}, origenDeLaPropuesta = null;
  const ENLATADA = {
    mano_obra: [{ unds: 1, descripcion: 'Purgado del circuito' }], materiales: [{ unds: 2, descripcion: 'Racores de tres cuartos' }],
    sinBloque: [], cantidadesRetiradas: [], datosRetirados: [], vacia: false,
  };
  const viajeDe = new Map();
  await ctx.route('**/*', async (ruta) => {
    const r = ruta.request();
    const u = new URL(r.url());
    const esAdmin = u.host === 'yaqu.app' && u.pathname.startsWith('/admin/');
    if (r.method() === 'GET' || r.method() === 'HEAD') {
      if (esAdmin && latencia) await dormir(latencia);
      return ruta.continue();
    }
    const firma = `${r.method()} ${u.pathname}`;
    if (u.host === 'yaqu.app' && firma === PATCH_DEL_PARTE) {
      if (reten) {
        reten = false;
        const t0 = Date.now();
        await new Promise((ok) => { soltar = ok; });
        soltar = null;
        viajeDe.set(r, `retenido ${Date.now() - t0} ms`);
      } else if (latencia) { viajeDe.set(r, `retraso ${latencia} ms`); await dormir(latencia); }
      return ruta.continue();
    }
    if (u.host === 'yaqu.app' && firma === POST_DEL_DICTADO) {
      if (latencia) await dormir(latencia);
      if (enlatar) {
        enlatar = false;
        return ruta.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ propuesta: ENLATADA, avisos: avisosDelServidor }) });
      }
      return ruta.continue();
    }
    informe.cortadas.push(firma);
    return ruta.abort();
  });
  page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(String((e && e.message) || e)));

  /* Lo que la PÁGINA pide a /admin/: cuántas hay en vuelo, cada PATCH con su lista, y las relecturas del parte. */
  let enVuelo = 0, respuestasPatch = 0, relecturas = 0, propuestaDelServidor = null;
  const deLaPeticion = new Map();
  const esAdmin = (r) => { try { const u = new URL(r.url()); return u.host === 'yaqu.app' && u.pathname.startsWith('/admin/'); } catch { return false; } };
  page.on('request', (r) => {
    if (!esAdmin(r)) return;
    enVuelo++;
    const ruta = new URL(r.url()).pathname;
    if (r.method() === 'GET' && ruta === RUTA_PARTE) relecturas++;
    if (r.method() !== 'PATCH') return;
    let lineas = null;
    try { lineas = JSON.parse(r.postData() || '{}').lineas; } catch { /* se queda en null y se ve */ }
    const apunte = {
      n: informe.patch.length + 1, ruta, viaje: 'sin retraso', estado: null,
      lineas: Array.isArray(lineas) ? lineas.map((l) => cara(l) + (l.id ? '' : ' (sin id)')) : null,
    };
    informe.patch.push(apunte);
    deLaPeticion.set(r, apunte);
  });
  const acaba = (r) => { if (esAdmin(r)) enVuelo--; };
  page.on('requestfinished', acaba);
  page.on('requestfailed', acaba);
  page.on('response', async (res) => {
    const a = deLaPeticion.get(res.request());
    if (a) { a.estado = res.status(); a.viaje = viajeDe.get(res.request()) || a.viaje; respuestasPatch++; }
    if (res.request().method() === 'POST' && new URL(res.url()).pathname === RUTA_PARTE + '/dictado') {
      try { propuestaDelServidor = { estado: res.status(), cuerpo: await res.json() }; } catch { propuestaDelServidor = { estado: res.status(), cuerpo: null }; }
      if (propuestaDelServidor.cuerpo && propuestaDelServidor.cuerpo.avisos && !res.fromServiceWorker() && origenDeLaPropuesta === 'el servidor de verdad') avisosDelServidor = propuestaDelServidor.cuerpo.avisos;
    }
  });

  /** Sin peticiones en vuelo, y que siga sin haberlas 700 ms (una cadena PATCH → GET → PATCH pasa por cero). */
  const quieta = async (tope = 45000) => {
    await dormir(150);
    const t0 = Date.now();
    let desde = null;
    for (;;) {
      if (enVuelo === 0) { if (desde === null) desde = Date.now(); if (Date.now() - desde >= 700) return; } else desde = null;
      if (Date.now() - t0 > tope) throw new Error('NO SUPE MIRAR: la página no se queda quieta (' + enVuelo + ' en vuelo)');
      await dormir(40);
    }
  };

  /** Pulsa como una persona: el dedo toca; el ratón baja, aguanta 90 ms y sube. `buscar` corre en la página. */
  const pulsar = async (nombre, buscar, arg, esperar = true) => {
    const asa = (await page.evaluateHandle(buscar, arg)).asElement();
    if (!asa) throw new Error('NO SUPE PULSAR: no encuentro ' + nombre);
    const caja = await asa.evaluate(async (n) => {
      n.scrollIntoView({ block: 'center', behavior: 'instant' });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const r = n.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const debajo = document.elementFromPoint(x, y);
      return {
        x, y, esEl: !!(debajo && (debajo === n || n.contains(debajo))),
        encima: debajo ? debajo.tagName.toLowerCase() + '.' + debajo.className : 'nada',
      };
    });
    if (!caja.esEl) throw new Error(`NO SUPE PULSAR: en el punto de ${nombre} (${Math.round(caja.x)},${Math.round(caja.y)}) hay otra cosa: ${caja.encima}`);
    if (DEDO) await page.touchscreen.tap(caja.x, caja.y);
    else { await page.mouse.move(caja.x, caja.y); await page.mouse.down(); await dormir(90); await page.mouse.up(); }
    if (esperar) await quieta(); else await dormir(60);
  };
  const elDe = (s) => document.querySelector(s);
  const equisDeGuardada = (descripcion) => {
    for (const tr of document.querySelectorAll('tr[data-parte-linea]')) {
      const d = tr.querySelector('.parte-linea-desc');
      if (d && d.value === descripcion) return tr.querySelector('.parte-quitar-linea[data-indice]');
    }
    return null;
  };

  /** Lo que hay en pantalla AHORA. */
  const foto = () => page.evaluate(() => {
    const guardadas = {}, porEscribir = [];
    for (const tb of document.querySelectorAll('[data-parte-filas]')) {
      const b = tb.getAttribute('data-parte-filas');
      guardadas[b] = [];
      for (const tr of tb.querySelectorAll('tr')) {
        const u = tr.querySelector('.parte-linea-unds'), d = tr.querySelector('.parte-linea-desc');
        if (!u || !d) continue;
        const txt = b + ' · ' + Number(u.value) + ' × ' + String(d.value).trim();
        if (tr.hasAttribute('data-parte-linea-nueva')) porEscribir.push(b + ' · «' + u.value + '» × «' + d.value + '»'); else guardadas[b].push(txt);
      }
    }
    const propuesta = Array.from(document.querySelectorAll('[data-propuesta="1"]')).map((li) => ({
      bloque: li.getAttribute('data-bloque'),
      unds: (li.querySelector('[data-propuesta-unds="1"]') || {}).value,
      descripcion: (li.querySelector('[data-propuesta-desc="1"]') || {}).value,
    }));
    const confirmar = document.querySelector('[data-propuesta-confirmar]');
    const aviso = document.querySelector('[data-dictado-aviso]');
    const cuadro = document.querySelector('[data-dictado-texto]');
    return {
      guardadas, porEscribir, propuesta,
      confirmar: confirmar ? (confirmar.disabled ? 'bloqueado' : 'libre') : 'no está',
      aviso: aviso ? aviso.textContent.trim() : '',
      cuadroDelDictado: cuadro ? cuadro.value : null,
    };
  });
  const enPantalla = (f) => Object.values(f.guardadas).flat();

  /** El parte, leído del servidor por fuera de la página (no cuenta como relectura suya ni pasa por el interceptor). */
  const servidor = async () => {
    const r = await ctx.request.get(BASE + RUTA_PARTE);
    if (!r.ok()) throw new Error(`NO SUPE MIRAR: GET ${RUTA_PARTE} → ${r.status()}`);
    const p = await r.json();
    return { estado: p.estado, lineas: (p.lineas || []).map((l) => ({ id: l.id, bloque: l.bloque, unds: l.unds, descripcion: l.descripcion })) };
  };
  const caras = (s) => s.lineas.map(cara);
  const porBloque = (s) => { const o = {}; for (const l of s.lineas) (o[l.bloque] = o[l.bloque] || []).push(cara(l)); return o; };
  const captura = async (nombre) => {
    await page.evaluate(() => { const n = document.querySelector('.parte-anadir[data-bloque="mano_obra"]'); if (n) n.scrollIntoView({ block: 'center', behavior: 'instant' }); });
    await dormir(250);
    await page.screenshot({ path: path.join(salida, `vivo-${ancho}-${nombre}.png`) });
  };
  const abrirParte = async () => {
    await page.evaluate((n) => window.renderAppView('parte-detail', { parteId: n }), borrador);
    await page.locator('.parte-anadir[data-bloque="mano_obra"]').first().waitFor({ state: 'visible', timeout: 30000 });
    await quieta();
  };

  /** Dicta, ordena (el servidor de verdad) y deja la propuesta en pantalla. Devuelve lo PROPUESTO, leído de la pantalla. */
  const cantidadesPuestasAMano = [];
  informe.cantidadesPuestasAMano = cantidadesPuestasAMano;
  const dictarYOrdenar = async () => {
    propuestaDelServidor = null;
    await pulsar('el cuadro del dictado', elDe, '#parte-dictado');
    await page.keyboard.type(DICTADO);
    await pulsar('«Ordenar en líneas»', elDe, '[data-dictado-ordenar]');
    // El dictado de verdad puede contestar «vacía» (medido el 25-nov: 4 propuestas con líneas y, a los
    // dos minutos, `sin_lineas_reconocidas` para el MISMO texto). Se reintenta como lo haría el técnico
    // y, si sigue vacía, la propuesta se ENLATA en el navegador y se DICE en la secuencia: lo que este
    // guion mide es la carrera de los `PATCH`, y esos van siempre contra el servidor de verdad.
    origenDeLaPropuesta = 'el servidor de verdad';
    for (let intento = 1; intento <= 3 && !(await foto()).propuesta.length; intento++) {
      if (intento === 3) { enlatar = true; origenDeLaPropuesta = 'ENLATADA en el navegador (el dictado de verdad contestó vacía 3 veces: ' + ((propuestaDelServidor && propuestaDelServidor.cuerpo && propuestaDelServidor.cuerpo.propuesta && propuestaDelServidor.cuerpo.propuesta.motivo) || 'sin motivo') + ')'; }
      else await dormir(latencia ? 2000 : 20000);
      await pulsar('«Ordenar en líneas», otra vez', elDe, '[data-dictado-ordenar]');
    }
    // Lo que hace el técnico al ver el aviso de su línea: a la que vino SIN cantidad le pone «1».
    // Una línea propuesta sin cantidad no se confirma (`lineasConfirmadas`, por diseño), y eso pasa
    // igual sin carrera: sin este paso el guion mediría esa regla, no la de SCRUM-1824.
    const propuesto = (await foto()).propuesta;
    for (let i = 0; i < propuesto.length; i++) {
      if (String(propuesto[i].unds || '') !== '') continue;
      await pulsar('la cantidad vacía de la línea propuesta ' + (i + 1), (n) => document.querySelectorAll('[data-propuesta-unds="1"]')[n], i, false);
      await page.keyboard.type('1');
      cantidadesPuestasAMano.push(`${propuesto[i].bloque} · ${propuesto[i].descripcion}`);
    }
    const f = await foto();
    const sinColocar = f.propuesta.filter((p) => p.bloque !== 'mano_obra' && p.bloque !== 'materiales');
    if (!f.propuesta.length || f.confirmar !== 'libre' || sinColocar.length) {
      throw new Error('NO SUPE MIRAR: el dictado de verdad no dejó una propuesta confirmable: ' + JSON.stringify({
        estado: propuestaDelServidor && propuestaDelServidor.estado, propuesta: f.propuesta, confirmar: f.confirmar, aviso: f.aviso,
        cuerpo: propuestaDelServidor && propuestaDelServidor.cuerpo,
        enElHueco: await page.evaluate(() => { const h = document.querySelector('[data-dictado-propuesta]'); return h ? h.textContent.trim().slice(0, 300) : null; }),
      }));
    }
    return f.propuesta.map(cara);
  };
  /** Añade una fila a mano y la deja COMPLETA y con el cursor fuera (que es cuando se guarda). */
  const filaAMano = async (esperar) => {
    await pulsar('«Añadir línea» (mano de obra)', elDe, '.parte-anadir[data-bloque="mano_obra"]', esperar);
    await page.keyboard.type(String(MANUAL.unds));
    await page.keyboard.press('Tab');
    await page.keyboard.type(MANUAL.descripcion);
    await page.keyboard.press('Tab');
  };
  /** Espera a que el `PATCH` de «Añadir al parte» esté parado en el retén. */
  const esperarAlReten = async () => {
    for (let i = 0; i < 100; i++) { if (typeof soltar === 'function') return; await dormir(50); }
    throw new Error('NO SUPE MIRAR: «Añadir al parte» no mandó ningún PATCH que retener');
  };

  /** RECOGER con la pantalla: la cantidad de la primera línea a su valor, y fuera todo lo que no era de partida. */
  const recoger = async () => {
    reten = false; latencia = 0;
    if (typeof soltar === 'function') soltar();
    await quieta();
    await abrirParte();
    let s = await servidor();
    const primera = antes.lineas[0];
    const laMisma = s.lineas.find((l) => l.id === primera.id);
    if (laMisma && Number(laMisma.unds) !== Number(primera.unds)) {
      await pulsar('la cantidad de la primera línea', elDe, '[data-linea-unds="0"]', false);
      await page.keyboard.press('Control+A');
      await page.keyboard.type(String(primera.unds));
      await page.keyboard.press('Tab');
      await quieta();
    }
    const dePartida = antes.lineas.map((l) => String(l.descripcion));
    for (let vuelta = 0; vuelta < 12; vuelta++) {
      const sobra = await page.evaluate((buenas) => {
        for (const tr of document.querySelectorAll('tr[data-parte-linea]')) {
          const d = tr.querySelector('.parte-linea-desc');
          if (d && buenas.indexOf(d.value) < 0) return d.value;
        }
        return null;
      }, dePartida);
      if (!sobra) break;
      await pulsar('la «×» de «' + sobra + '»', equisDeGuardada, sobra);
    }
    s = await servidor();
    return { ok: JSON.stringify(s.lineas) === JSON.stringify(antes.lineas), lineas: caras(s) };
  };

  /* ── ENTRAR, Y SABER QUÉ SE ESTÁ MIRANDO ─────────────────────────────────────────────────────── */
  const version = await ctx.request.get(BASE + '/version');
  informe.horaDelServidor = version.headers().date || null;
  informe.build = (await version.json().catch(() => ({}))).version || 'no-leído';
  await page.goto(BASE + '/dashboard/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.renderAppView === 'function' && typeof window.renderParteDetailView === 'function', null, { timeout: 30000 });
  // El fichero que ESTA página ha cargado, con el id que le daría git: tiene que ser el de `main`.
  informe.blob = await page.evaluate(async (esperado) => {
    const cargado = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /\/parteDetailView\.js(\?|$)/.test(n));
    if (!cargado) return { esperado, cargado: null, id: null };
    const bytes = new Uint8Array(await (await fetch(cargado)).arrayBuffer());
    const cabecera = new TextEncoder().encode('blob ' + bytes.length + '\0');
    const todo = new Uint8Array(cabecera.length + bytes.length);
    todo.set(cabecera, 0); todo.set(bytes, cabecera.length);
    const id = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1', todo))).map((b) => b.toString(16).padStart(2, '0')).join('');
    return { esperado, cargado: new URL(cargado).pathname + new URL(cargado).search, id, bytes: bytes.length };
  }, blobEsperado);
  if (informe.blob.id !== blobEsperado) throw new Error(`NO SUPE MIRAR: la página no lleva el parteDetailView.js de main (${informe.blob.id} ≠ ${blobEsperado})`);

  /* CONTROL POSITIVO del interceptor, antes de tocar nada. */
  informe.control = await page.evaluate(() => fetch('/__control-s4-1824b-no-existe', { method: 'POST', body: '{}' }).then((r) => 'PASÓ ' + r.status).catch(() => 'cortada'));
  if (informe.control !== 'cortada' || !informe.cortadas.includes('POST /__control-s4-1824b-no-existe')) throw new Error('NO SUPE MIRAR: el interceptor NO corta: ' + informe.control);

  const partida = await servidor();
  if (partida.estado !== 'borrador') throw new Error('NO SUPE MIRAR: el parte ' + borrador + ' no está en borrador (' + partida.estado + ')');
  if (partida.lineas.length < 1) throw new Error('NO SUPE MIRAR: el parte no trae líneas de partida (la secuencia ② corrige la primera)');
  if (partida.lineas.some((l) => String(l.descripcion).indexOf('QA1824-') === 0)) throw new Error('NO SUPE MIRAR: el parte trae líneas «QA1824-» de una pasada anterior');
  antes = partida;
  informe.antes = { estado: antes.estado, lineas: caras(antes) };

  /**
   * Una secuencia entera: abre el parte, la corre, espera a que no viaje nada, mira servidor y pantalla,
   * comprueba y RECOGE. `correr` devuelve lo que tiene que haber quedado (`esperado`) y cómo se dio la carrera.
   */
  const secuencia = async (id, titulo, correr) => {
    const apunte = { id, titulo, pasos: [] };
    informe.secuencias.push(apunte);
    const patchAlEmpezar = informe.patch.length;
    await abrirParte();
    const f0 = await foto();
    if (f0.cuadroDelDictado !== '' || f0.propuesta.length) throw new Error('NO SUPE MIRAR: el dictado no arranca vacío en ' + id);
    const apunta = async (que, extra) => { apunte.pasos.push({ paso: que, ...(await foto()), patchPedidos: informe.patch.length - patchAlEmpezar, ...(extra || {}) }); };
    const r = await correr(apunta);
    await quieta();
    const f = await foto();
    const s = await servidor();
    const misPatch = informe.patch.slice(patchAlEmpezar);
    apunte.dictadas = r.dictadas; apunte.esperado = r.esperado; apunte.propuesta = origenDeLaPropuesta; apunte.servidor = caras(s); apunte.pantalla = enPantalla(f);
    apunte.carrera = r.carrera || null;
    apunte.relecturasTrasAnadirAlParte = r.relecturasAlConfirmar == null ? null : relecturas - r.relecturasAlConfirmar;
    apunte.patch = misPatch.map((p) => `${p.viaje} → ${p.estado} · ${p.lineas ? p.lineas.length : '?'} líneas`);
    if (r.carrera) comprueba(id + '.1', 'la carrera SE DIO: lo de a mano se hizo con el PATCH de lo dictado todavía de viaje', r.carrera.seDio, r.carrera);
    const faltan = r.esperado.filter((x) => !caras(s).includes(x));
    comprueba(id + '.2', `el servidor conserva TODO: ${r.esperado.length} líneas (las de partida, las ${r.dictadas.length} dictadas${r.conManual ? ' y la de a mano' : ''})`,
      iguales(caras(s), r.esperado), { servidor: caras(s), faltan, dictadasPerdidas: r.dictadas.filter((x) => !caras(s).includes(x)) });
    comprueba(id + '.3', 'la pantalla enseña lo mismo que el servidor, bloque a bloque y en su orden',
      ['mano_obra', 'materiales'].every((b) => JSON.stringify(f.guardadas[b] || []) === JSON.stringify(porBloque(s)[b] || [])), { pantalla: f.guardadas, servidor: porBloque(s) });
    comprueba(id + '.4', 'no queda nada a medias: la propuesta se ha ido, el cuadro del dictado está vacío, ninguna fila por escribir con algo dentro y todos los PATCH dieron 200',
      f.propuesta.length === 0 && f.cuadroDelDictado === '' && !f.porEscribir.some((x) => !/«» × «»$/.test(x)) && misPatch.length > 0 && misPatch.every((p) => p.estado === 200),
      { propuesta: f.propuesta.length, cuadro: f.cuadroDelDictado, porEscribir: f.porEscribir, patch: misPatch.map((p) => p.estado), aviso: f.aviso });
    await captura(id.replace(/[^a-z0-9]/gi, '') + '-final');
    const rec = await recoger();
    apunte.recogido = rec;
    comprueba(id + '.fin', 'recogido con la pantalla: el parte vuelve EXACTAMENTE a sus líneas de partida (mismos ids, orden y contenido)', rec.ok, rec.lineas);
    if (!rec.ok) throw new Error('NO SUPE RECOGER tras ' + id + ': se para aquí para no medir sobre un parte sucio');
  };

  /* ── CONTROL · primero la fila a mano, después lo dictado (nada viajando) ─────────────────────── */
  await secuencia('C', 'CONTROL · primero la fila a mano, después lo dictado (nada viajando)', async (apunta) => {
    await filaAMano(true);
    await quieta();
    // Que sea un CONTROL de verdad: la fila a mano tiene que estar ya en el servidor antes de dictar.
    if (!caras(await servidor()).includes(cara(MANUAL))) throw new Error('NO SUPE MIRAR: en el control, la fila a mano no llegó al servidor antes de dictar');
    await apunta('1 · fila a mano completa y guardada');
    const dictadas = await dictarYOrdenar();
    const relecturasAlConfirmar = relecturas;
    await pulsar('«Añadir al parte»', elDe, '[data-propuesta-confirmar]');
    await apunta('2 · dicto, ordeno y «Añadir al parte» (nada viajando)');
    return { dictadas, conManual: true, relecturasAlConfirmar, esperado: caras(antes).concat(dictadas, [cara(MANUAL)]) };
  });

  /* ── ① · fila a mano mientras viaja lo dictado (PATCH retenido) ───────────────────────────────── */
  await secuencia('1', '① fila a mano mientras viaja lo dictado (PATCH retenido)', async (apunta) => {
    const dictadas = await dictarYOrdenar();
    await apunta('1 · dicto y «Ordenar en líneas»: la propuesta está en pantalla');
    const respuestasAlConfirmar = respuestasPatch, relecturasAlConfirmar = relecturas;
    reten = true;
    await pulsar('«Añadir al parte»', elDe, '[data-propuesta-confirmar]', false);
    await esperarAlReten();
    await apunta('2 · «Añadir al parte»: su PATCH viaja (retenido)');
    await filaAMano(false);
    await dormir(400);
    const carrera = { retenidoAlAcabarLaFila: typeof soltar === 'function', respuestasDePatchMientras: respuestasPatch - respuestasAlConfirmar };
    carrera.seDio = carrera.retenidoAlAcabarLaFila && carrera.respuestasDePatchMientras === 0;
    await apunta('3 · mientras viaja: «Añadir línea», «3», la descripción, y salgo de la casilla', carrera);
    if (typeof soltar === 'function') soltar();
    await quieta();
    await apunta('4 · suelto el PATCH del dictado y espero a que no viaje nada');
    return { dictadas, conManual: true, carrera, relecturasAlConfirmar, esperado: caras(antes).concat(dictadas, [cara(MANUAL)]) };
  });

  /* ── ① bis · lo mismo sin retén, red a 1200 ms ────────────────────────────────────────────────── */
  await secuencia('1bis', `① bis · lo mismo sin retén: /admin/ sale ${RED_LENTA} ms tarde`, async (apunta) => {
    latencia = RED_LENTA;
    const dictadas = await dictarYOrdenar();
    await apunta('1 · dicto y «Ordenar en líneas» (todo con retraso)');
    const respuestasAlConfirmar = respuestasPatch, relecturasAlConfirmar = relecturas;
    const t0 = Date.now();
    await pulsar('«Añadir al parte»', elDe, '[data-propuesta-confirmar]', false);
    await filaAMano(false);
    const carrera = { msHastaAcabarLaFila: Date.now() - t0, retrasoMs: RED_LENTA, respuestasDePatchMientras: respuestasPatch - respuestasAlConfirmar };
    carrera.seDio = carrera.respuestasDePatchMientras === 0 && carrera.msHastaAcabarLaFila < RED_LENTA;
    await apunta('2 · «Añadir al parte» y, sin esperar, «Añadir línea», «3», la descripción, y salgo', carrera);
    await quieta();
    latencia = 0;
    await apunta('3 · llega todo y espero a que no viaje nada');
    return { dictadas, conManual: true, carrera, relecturasAlConfirmar, esperado: caras(antes).concat(dictadas, [cara(MANUAL)]) };
  });

  /* ── ② · cantidad de una línea guardada corregida mientras viaja ──────────────────────────────── */
  await secuencia('2', '② cantidad de una línea guardada corregida mientras viaja (PATCH retenido)', async (apunta) => {
    const primera = antes.lineas[0];
    const nuevaCantidad = Number(primera.unds) + 2;
    const dictadas = await dictarYOrdenar();
    const respuestasAlConfirmar = respuestasPatch, relecturasAlConfirmar = relecturas;
    reten = true;
    await pulsar('«Añadir al parte»', elDe, '[data-propuesta-confirmar]', false);
    await esperarAlReten();
    await apunta('1 · «Añadir al parte»: su PATCH viaja (retenido)');
    await pulsar('la cantidad de la primera línea guardada', elDe, '[data-linea-unds="0"]', false);
    await page.keyboard.press('Control+A');
    await page.keyboard.type(String(nuevaCantidad));
    await page.keyboard.press('Tab');
    await dormir(400);
    const carrera = { retenidoAlSalirDeLaCasilla: typeof soltar === 'function', respuestasDePatchMientras: respuestasPatch - respuestasAlConfirmar, de: Number(primera.unds), a: nuevaCantidad };
    carrera.seDio = carrera.retenidoAlSalirDeLaCasilla && carrera.respuestasDePatchMientras === 0;
    await apunta(`2 · mientras viaja: corrijo la cantidad de la primera línea guardada (${primera.unds} → ${nuevaCantidad}) y salgo`, carrera);
    if (typeof soltar === 'function') soltar();
    await quieta();
    await apunta('3 · suelto el PATCH del dictado y espero a que no viaje nada');
    const corregidas = antes.lineas.map((l, i) => cara(i === 0 ? { ...l, unds: nuevaCantidad } : l));
    return { dictadas, conManual: false, carrera, relecturasAlConfirmar, esperado: corregidas.concat(dictadas) };
  });

  const fin = await servidor();
  informe.despues = { estado: fin.estado, lineas: caras(fin), igualQueLaPartida: JSON.stringify(fin.lineas) === JSON.stringify(antes.lineas) };
  // Lo cortado se LISTA. El panel manda por su cuenta `POST /admin/entorno` al cargar: también se corta.
  comprueba('fin.1', 'nada de lo cortado apuntaba a un parte, y ningún PATCH salió fuera del borrador',
    !informe.cortadas.some((c) => /\/admin\/partes/.test(c)) && !informe.patch.some((p) => p.ruta !== RUTA_PARTE), { cortadas: informe.cortadas });
  informe.erroresDePagina = errores;
  comprueba('fin.2', 'la página no ha dado ningún error de JavaScript en todo el recorrido', errores.length === 0, errores);
} catch (e) {
  informe.fallo = String((e && e.message) || e);
  codigo = Math.max(codigo, /^NO SUPE/.test(informe.fallo) ? 2 : 1);
  console.error('🔴 ' + informe.fallo);
} finally {
  // Red de seguridad: si el parte no quedó como estaba, se deja como estaba con la lista de partida, y se DICE.
  try {
    if (ctx && antes) {
      const r = await ctx.request.get(BASE + RUTA_PARTE);
      const ahora = r.ok() ? ((await r.json()).lineas || []).map((l) => ({ id: l.id, bloque: l.bloque, unds: l.unds, descripcion: l.descripcion })) : null;
      if (!ahora || JSON.stringify(ahora) !== JSON.stringify(antes.lineas)) {
        const p = await ctx.request.patch(BASE + RUTA_PARTE, { data: { lineas: antes.lineas } });
        const r2 = await ctx.request.get(BASE + RUTA_PARTE);
        const tras = r2.ok() ? ((await r2.json()).lineas || []).map((l) => ({ id: l.id, bloque: l.bloque, unds: l.unds, descripcion: l.descripcion })) : null;
        informe.restauradoPorFuera = { estadoDelPatch: p.status(), quedoComoEstaba: !!tras && JSON.stringify(tras) === JSON.stringify(antes.lineas), lineas: tras && tras.map(cara) };
        console.error('⚠️ el parte NO quedó como estaba; restaurado por fuera: ' + JSON.stringify(informe.restauradoPorFuera));
        codigo = Math.max(codigo, 1);
      }
    }
  } catch (e2) { informe.restauradoPorFuera = { error: String((e2 && e2.message) || e2) }; codigo = Math.max(codigo, 2); }
  await navegador.close();
}
informe.resumen = { comprobaciones: informe.comprobaciones.length, cumplen: informe.comprobaciones.filter((c) => c.ok).length, patch: informe.patch.length, salida: codigo };
fs.writeFileSync(path.join(salida, `vivo-${ancho}.json`), JSON.stringify(informe, null, 1) + '\n');
for (const c of informe.comprobaciones) console.log(`${c.ok ? '✔' : '✘'} ${c.id} · ${c.que}`);
for (const s of informe.secuencias) console.log(`\n── ${s.titulo}\n   propuesta de: ${s.propuesta}\n   dictadas: ${JSON.stringify(s.dictadas)}\n   servidor: ${JSON.stringify(s.servidor)}\n   carrera: ${JSON.stringify(s.carrera)} · relecturas tras «Añadir al parte»: ${s.relecturasTrasAnadirAlParte}\n   PATCH: ${JSON.stringify(s.patch)}`);
console.log(`\n${informe.ventana} (${informe.puntero}) · build ${informe.build} · ${informe.resumen.cumplen}/${informe.resumen.comprobaciones} cumplen · PATCH ${informe.patch.length} · salida ${codigo}`);
process.exit(codigo);
