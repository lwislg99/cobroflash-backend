/* SCRUM-916c · LA REGLA 42 EN VIVO DE «+ AÑADIR LÍNEA» (la cura de SCRUM-916b, PR #3367), EN yaqu.app.
   Navegador real, cuenta de QA, parte en BORRADOR; dedo a 390 y ratón a 1280. Nada de `dispatchEvent`:
   se pulsa en el punto donde está el botón, y antes se comprueba que debajo de ese punto está él.

   ① escribir en la fila vacía → «+ Añadir línea» → lo escrito se guarda y hay fila nueva con el foco en su UNDS
   ② dos clics seguidos = dos filas vacías escribibles (y ninguna escritura)
   ③ nada se pierde: se teclea en una fila mientras otra viaja; se quita una línea con «×» y se completa
      otra mientras la «×» viaja → el servidor conserva lo correcto
   ④ SÓLO MIRAR: el cuadro del dictado sigue en su sitio y el parte firmado sigue sellado

   ESCRIBE en la cuenta de QA, y SÓLO una cosa: `PATCH /admin/partes/<borrador>` (las líneas). Cualquier
   otra petición que no sea GET/HEAD se CORTA y se apunta; el interceptor lleva su control positivo
   antes de tocar nada. Las líneas que pone llevan la marca «QA916c-<ancho>» y AL ACABAR LAS QUITA con
   la «×» de la pantalla: el parte tiene que volver a sus líneas de partida, con sus ids.

   En ③ el `PATCH` se RETIENE 1,5 s en el navegador antes de dejarlo salir (se declara en cada `PATCH`
   del informe, `retrasoMs`): la carrera depende de qué llega antes, y sin eso «tecleé mientras viajaba»
   sería una suposición sobre la red. El servidor no se toca; ① y ② van con la latencia que haya.

   La cookie se lee de su fichero (la deja `scripts/qa/sesion-panel.mjs login`) y no se imprime.

   Uso: node verificar-en-vivo.mjs <carpeta de salida> <id borrador> <id firmado> <ancho> <alto> <blob> [--limpiar-restos]
     <blob> = `git rev-parse origin/main:public/dashboard/js/parteDetailView.js` (se LEE, no se deduce)
   Sale 0 si todo se cumple · 1 si una aceptación NO se cumple · 2 si no supo mirar. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const [salida, borradorArg, firmadoArg, anchoArg, altoArg, blobEsperado, bandera] = process.argv.slice(2);
const borrador = Number(borradorArg), firmado = Number(firmadoArg);
const ancho = Number(anchoArg), alto = Number(altoArg);
const LIMPIAR_RESTOS = bandera === '--limpiar-restos';
if (!salida || !(borrador > 0) || !(firmado > 0) || !(ancho > 0) || !(alto > 0) || !/^[0-9a-f]{40}$/.test(blobEsperado || '')) {
  console.error('uso: <carpeta> <id borrador> <id firmado> <ancho> <alto> <blob de 40> [--limpiar-restos]'); process.exit(3);
}
const PW = process.env.PLAYWRIGHT_CORE || 'C:/Users/Admin/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core';
const NAVEGADORES = process.env.PLAYWRIGHT_NAVEGADORES || 'C:/Users/Admin/AppData/Local/ms-playwright';
const RUTA_SESION = 'C:/Users/Admin/.yaqu-qa-sesion.txt';
const BASE = 'https://yaqu.app';
const DEDO = ancho < 600;
const PERMITIDA = `PATCH /admin/partes/${borrador}`;
const RETRASO = 1500;
const MARCA = `QA916c-${ancho} `;
const A = MARCA + 'A purgado del circuito', B = MARCA + 'B limpieza de filtros';
const C = MARCA + 'C junta', D = MARCA + 'D codo', E = MARCA + 'E manguito';

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
  ventana: `${ancho}x${alto}`, puntero: DEDO ? 'dedo' : 'ratón', borrador, firmado,
  horaDelServidor: null, build: null, blob: null, control: null,
  cortadas: [], patch: [], pasos: [], comprobaciones: [],
};
let codigo = 0;
const comprueba = (id, que, ok, visto) => {
  informe.comprobaciones.push({ id, que, ok: !!ok, visto });
  if (!ok) { codigo = Math.max(codigo, 1); console.error(`🔴 ${id} · ${que} → ${JSON.stringify(visto)}`); }
};

const navegador = await chromium.launch({ executablePath: exe, headless: true });
try {
  const ctx = await navegador.newContext({
    viewport: { width: ancho, height: alto }, hasTouch: DEDO, isMobile: DEDO, serviceWorkers: 'block', locale: 'es-ES',
  });
  await ctx.addCookies([{ name: 'pf_session', value: galleta[1], domain: 'yaqu.app', path: '/', secure: true, httpOnly: true }]);
  let retrasoPatch = 0;
  await ctx.route('**/*', async (ruta) => {
    const r = ruta.request();
    if (r.method() === 'GET' || r.method() === 'HEAD') return ruta.continue();
    const u = new URL(r.url());
    const firma = `${r.method()} ${u.pathname}`;
    if (u.host === 'yaqu.app' && firma === PERMITIDA) {
      if (retrasoPatch) await dormir(retrasoPatch);
      return ruta.continue();
    }
    informe.cortadas.push(firma);
    return ruta.abort();
  });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(String((e && e.message) || e)));

  /* Lo que la PÁGINA pide a /admin/: cuántas hay en vuelo, cada PATCH con su lista, y las relecturas del parte. */
  let enVuelo = 0, patchEnVuelo = 0, respuestasPatch = 0, relecturas = 0;
  const deLaPeticion = new Map();
  const esAdmin = (r) => { try { const u = new URL(r.url()); return u.host === 'yaqu.app' && u.pathname.startsWith('/admin/'); } catch { return false; } };
  page.on('request', (r) => {
    if (!esAdmin(r)) return;
    enVuelo++;
    const ruta = new URL(r.url()).pathname;
    if (r.method() === 'GET' && ruta === `/admin/partes/${borrador}`) relecturas++;
    if (r.method() !== 'PATCH') return;
    patchEnVuelo++;
    let lineas = null;
    try { lineas = JSON.parse(r.postData() || '{}').lineas; } catch { /* se queda en null y se ve */ }
    const apunte = {
      n: informe.patch.length + 1, ruta, retrasoMs: retrasoPatch, estado: null,
      lineas: Array.isArray(lineas) ? lineas.map((l) => `${l.bloque} · ${l.unds} × ${l.descripcion}${l.id ? '' : ' (sin id)'}`) : null,
    };
    informe.patch.push(apunte);
    deLaPeticion.set(r, apunte);
  });
  const acaba = (r) => { if (!esAdmin(r)) return; enVuelo--; if (r.method() === 'PATCH') patchEnVuelo--; };
  page.on('requestfinished', acaba);
  page.on('requestfailed', acaba);
  page.on('response', (res) => { const a = deLaPeticion.get(res.request()); if (a) { a.estado = res.status(); respuestasPatch++; } });

  /** Sin peticiones en vuelo, y que siga sin haberlas 700 ms (una cadena PATCH → GET → PATCH pasa por cero). */
  const quieta = async (tope = 30000) => {
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
        x, y, ancho: Math.round(r.width), alto: Math.round(r.height),
        esEl: !!(debajo && (debajo === n || n.contains(debajo))),
        encima: debajo ? debajo.tagName.toLowerCase() + '.' + debajo.className : 'nada',
      };
    });
    if (!caja.esEl) throw new Error(`NO SUPE PULSAR: en el punto de ${nombre} (${Math.round(caja.x)},${Math.round(caja.y)}) hay otra cosa: ${caja.encima}`);
    if (DEDO) await page.touchscreen.tap(caja.x, caja.y);
    else { await page.mouse.move(caja.x, caja.y); await page.mouse.down(); await dormir(90); await page.mouse.up(); }
    if (esperar) await quieta();
    return caja;
  };
  const elAnadir = (b) => document.querySelector('.parte-anadir[data-bloque="' + b + '"]');
  const campoDeNueva = (q) => {
    const f = document.querySelectorAll('[data-parte-filas="' + q.bloque + '"] tr[data-parte-linea-nueva]')[q.i];
    return f ? f.querySelector(q.campo === 'unds' ? '.parte-linea-unds' : '.parte-linea-desc') : null;
  };
  const equisDeNueva = (q) => {
    const f = document.querySelectorAll('[data-parte-filas="' + q.bloque + '"] tr[data-parte-linea-nueva]')[q.i];
    return f ? f.querySelector('.parte-quitar-linea') : null;
  };
  const equisDeGuardada = (descripcion) => {
    for (const tr of document.querySelectorAll('tr[data-parte-linea]')) {
      const d = tr.querySelector('.parte-linea-desc');
      if (d && d.value === descripcion) return tr.querySelector('.parte-quitar-linea[data-indice]');
    }
    return null;
  };

  /** Lo que hay en pantalla AHORA: cada fila de cada bloque, dónde está el foco y cuántos clics llegaron. */
  const foto = () => page.evaluate(() => {
    const bloques = {};
    for (const tb of document.querySelectorAll('[data-parte-filas]')) {
      bloques[tb.getAttribute('data-parte-filas')] = Array.from(tb.querySelectorAll('tr')).map((tr) => {
        const u = tr.querySelector('.parte-linea-unds'), d = tr.querySelector('.parte-linea-desc');
        if (!u || !d) return null;
        const viaje = tr.getAttribute('data-nueva-guardando');
        return (tr.hasAttribute('data-parte-linea-nueva') ? 'POR ESCRIBIR ' : 'guardada ') + '«' + u.value + ' · ' + d.value + '»' + (viaje ? ' [' + viaje + ']' : '');
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
    const nuevas = Array.from(document.querySelectorAll('[data-parte-linea-nueva]'));
    return {
      bloques, foco,
      focoEnLaUltimaDeSuBloque: !!(fila && tb && tb.lastElementChild === fila),
      porEscribir: nuevas.length,
      porEscribirBloqueadas: nuevas.filter((f) => Array.from(f.querySelectorAll('input,textarea')).some((c) => c.disabled || c.readOnly)).length,
      clicsLlegados: window.__clics,
    };
  });
  const apunta = async (que) => { const f = await foto(); informe.pasos.push({ paso: que, ...f, patch: informe.patch.length, relecturas }); return f; };

  /** El parte, leído del servidor por fuera de la página (no cuenta como relectura suya ni pasa por el interceptor). */
  const servidor = async (id) => {
    const r = await ctx.request.get(`${BASE}/admin/partes/${id}`);
    if (!r.ok()) throw new Error(`NO SUPE MIRAR: GET /admin/partes/${id} → ${r.status()}`);
    const p = await r.json();
    return {
      estado: p.estado, firmasCompletas: p.firmasCompletas === true, contenidoHash: p.contenidoHash || null,
      lineas: (p.lineas || []).map((l) => ({ id: l.id, bloque: l.bloque, unds: l.unds, descripcion: l.descripcion })),
    };
  };
  const cara = (l) => `${l.bloque} · ${l.unds} × ${l.descripcion}`;
  const caras = (s) => s.lineas.map(cara);
  const enPantalla = (f) => Object.entries(f.bloques).flatMap(([b, filas]) => filas.filter((x) => x.startsWith('guardada ')).map((x) => b + ' ' + x));
  const delServidor = (s) => s.lineas.map((l) => `${l.bloque} guardada «${l.unds} · ${l.descripcion}»`);
  const captura = async (nombre, centrar) => {
    if (centrar) await page.evaluate((s) => { const n = document.querySelector(s); if (n) n.scrollIntoView({ block: 'center', behavior: 'instant' }); }, centrar);
    await dormir(250);
    await page.screenshot({ path: path.join(salida, `vivo-${ancho}-${nombre}.png`) });
  };
  const abrirParte = async (id, esperarA) => {
    await page.evaluate((n) => window.renderAppView('parte-detail', { parteId: n }), id);
    await page.locator(esperarA).first().waitFor({ state: 'visible', timeout: 30000 });
    await quieta();
  };
  /** Quita con la «×» de la pantalla toda línea guardada que lleve la marca de ESTE ancho. */
  const quitarLasMias = async () => {
    for (let vuelta = 0; vuelta < 12; vuelta++) {
      const mia = await page.evaluate((m) => {
        for (const tr of document.querySelectorAll('tr[data-parte-linea]')) {
          const d = tr.querySelector('.parte-linea-desc');
          if (d && d.value.indexOf(m) === 0) return d.value;
        }
        return null;
      }, MARCA);
      if (!mia) return;
      await pulsar('la «×» de «' + mia + '»', equisDeGuardada, mia);
    }
    throw new Error('NO SUPE LIMPIAR: tras 12 «×» siguen quedando líneas con la marca');
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
  informe.control = await page.evaluate(() => fetch('/__control-s4-916c-no-existe', { method: 'POST', body: '{}' }).then((r) => 'PASÓ ' + r.status).catch(() => 'cortada'));
  if (informe.control !== 'cortada' || !informe.cortadas.includes('POST /__control-s4-916c-no-existe')) throw new Error('NO SUPE MIRAR: el interceptor NO corta: ' + informe.control);

  await page.evaluate(() => {
    window.__clics = 0;
    document.addEventListener('click', (e) => { if (e.target && e.target.closest && e.target.closest('.parte-anadir')) window.__clics++; }, true);
  });
  let antes = await servidor(borrador);
  if (antes.estado !== 'borrador') throw new Error('NO SUPE MIRAR: el parte ' + borrador + ' no está en borrador (' + antes.estado + ')');
  await abrirParte(borrador, '.parte-anadir[data-bloque="mano_obra"]');
  if (antes.lineas.some((l) => String(l.descripcion).indexOf('QA916c-') === 0)) {
    if (!LIMPIAR_RESTOS) throw new Error('NO SUPE MIRAR: el parte trae líneas «QA916c-» de una pasada anterior; repetir con --limpiar-restos');
    // `quitarLasMias` mira la marca de ESTE ancho: aquí se barre con las dos, una detrás de otra.
    for (const m of ['QA916c-390 ', 'QA916c-1280 ']) {
      for (let v = 0; v < 12; v++) {
        const resto = await page.evaluate((mm) => { for (const tr of document.querySelectorAll('tr[data-parte-linea]')) { const d = tr.querySelector('.parte-linea-desc'); if (d && d.value.indexOf(mm) === 0) return d.value; } return null; }, m);
        if (!resto) break;
        await pulsar('la «×» del resto «' + resto + '»', equisDeGuardada, resto);
      }
    }
    informe.restosLimpiados = true;
    antes = await servidor(borrador);
    if (antes.lineas.some((l) => String(l.descripcion).indexOf('QA916c-') === 0)) throw new Error('NO SUPE LIMPIAR los restos de la pasada anterior');
  }
  informe.antes = { estado: antes.estado, lineas: caras(antes) };
  const patchDeLaLimpieza = informe.patch.length;
  const relecturasAlAbrir = relecturas;
  await apunta('0 · parte en borrador abierto');

  /* ── ① ESCRIBIR EN LA FILA VACÍA → «+ AÑADIR LÍNEA» ──────────────────────────────────────────── */
  await pulsar('«Añadir línea» (mano de obra)', elAnadir, 'mano_obra');
  let f = await apunta('1 · pulso «Añadir línea» (mano de obra)');
  comprueba('①.0', 'el primer clic abre una fila vacía con el foco en su UNDS',
    f.porEscribir === 1 && f.foco === 'UNDS de la fila por escribir (mano_obra)', { porEscribir: f.porEscribir, foco: f.foco });
  await page.keyboard.type('3');
  await page.keyboard.press('Tab');
  await page.keyboard.type(A);
  await apunta('2 · escribo «3» y la descripción A; el cursor sigue en la descripción');
  await pulsar('«Añadir línea» (mano de obra), con la fila escrita', elAnadir, 'mano_obra');
  f = await apunta('3 · pulso «Añadir línea» OTRA VEZ, con la fila escrita');
  let s = await servidor(borrador);
  const patchDeUno = informe.patch.slice(patchDeLaLimpieza);
  comprueba('①.1', 'el clic llega al botón (2 de 2)', f.clicsLlegados === 2, { clicsLlegados: f.clicsLlegados });
  comprueba('①.2', 'lo escrito SE GUARDA: está en el servidor y en pantalla como guardada, con un solo PATCH 200',
    caras(s).includes(`mano_obra · 3 × ${A}`) && f.bloques.mano_obra.includes(`guardada «3 · ${A}»`) && patchDeUno.length === 1 && patchDeUno[0].estado === 200,
    { enServidor: caras(s).includes(`mano_obra · 3 × ${A}`), enPantalla: f.bloques.mano_obra, patch: patchDeUno.map((p) => p.estado) });
  comprueba('①.3', 'aparece UNA fila nueva vacía',
    f.porEscribir === 1 && f.bloques.mano_obra[f.bloques.mano_obra.length - 1] === 'POR ESCRIBIR « · »', { porEscribir: f.porEscribir, ultima: f.bloques.mano_obra[f.bloques.mano_obra.length - 1] });
  comprueba('①.4', 'el foco queda en la UNDS de la fila nueva', f.foco === 'UNDS de la fila por escribir (mano_obra)' && f.focoEnLaUltimaDeSuBloque, { foco: f.foco });
  informe.relecturasTrasGuardarA = relecturas - relecturasAlAbrir;
  await captura('1-tras-anadir-con-fila-escrita', '.parte-anadir[data-bloque="mano_obra"]');
  // Lo que una persona hace a continuación: seguir tecleando. Tiene que caer en la fila nueva.
  await page.keyboard.type('1');
  await page.keyboard.press('Tab');
  await page.keyboard.type(B);
  await pulsar('«Añadir línea» (mano de obra), tercera vez', elAnadir, 'mano_obra');
  f = await apunta('4 · sigo tecleando «1», Tab, descripción B (sin tocar el ratón) y pulso «Añadir línea»');
  s = await servidor(borrador);
  comprueba('①.5', 'lo tecleado a continuación cae en la fila nueva, se guarda, y vuelve a haber fila vacía con el foco en su UNDS',
    caras(s).includes(`mano_obra · 1 × ${B}`) && caras(s).includes(`mano_obra · 3 × ${A}`) && f.porEscribir === 1 && f.foco === 'UNDS de la fila por escribir (mano_obra)',
    { servidor: caras(s), porEscribir: f.porEscribir, foco: f.foco });

  /* ── ② DOS CLICS SEGUIDOS = DOS FILAS VACÍAS ESCRIBIBLES ─────────────────────────────────────── */
  const patchAntesDeDos = informe.patch.length;
  await pulsar('«Añadir línea» (materiales)', elAnadir, 'materiales');
  await pulsar('«Añadir línea» (materiales), seguido', elAnadir, 'materiales');
  f = await apunta('5 · dos clics seguidos en «Añadir línea» (materiales)');
  const vaciasDeMateriales = f.bloques.materiales.filter((x) => x === 'POR ESCRIBIR « · »').length;
  comprueba('②.1', 'dos clics = DOS filas vacías en ese bloque (y la de mano de obra sigue: tres por escribir)',
    vaciasDeMateriales === 2 && f.porEscribir === 3, { vaciasDeMateriales, porEscribir: f.porEscribir });
  comprueba('②.2', 'ninguna escritura al servidor por añadir filas', informe.patch.length === patchAntesDeDos, { patchNuevos: informe.patch.length - patchAntesDeDos });
  comprueba('②.3', 'el foco está en la UNDS de la ÚLTIMA añadida y ninguna está bloqueada',
    f.foco === 'UNDS de la fila por escribir (materiales)' && f.focoEnLaUltimaDeSuBloque && f.porEscribirBloqueadas === 0, { foco: f.foco, bloqueadas: f.porEscribirBloqueadas });
  await captura('2-dos-clics-dos-filas', '.parte-anadir[data-bloque="materiales"]');
  // Una fila A MEDIAS en mano de obra (sólo la cantidad): tiene que sobrevivir a todo lo de ③.
  await pulsar('la UNDS de la fila vacía de mano de obra', campoDeNueva, { bloque: 'mano_obra', i: 0, campo: 'unds' });
  await page.keyboard.type('7');

  /* ── ③a TECLEAR EN UNA FILA MIENTRAS OTRA VIAJA ──────────────────────────────────────────────── */
  retrasoPatch = RETRASO;
  await pulsar('la UNDS de la 1.ª vacía de materiales', campoDeNueva, { bloque: 'materiales', i: 0, campo: 'unds' });
  await page.keyboard.type('2');
  await page.keyboard.press('Tab');
  await page.keyboard.type(C);
  let respuestasAntes = respuestasPatch;
  await pulsar('la UNDS de la 2.ª vacía de materiales', campoDeNueva, { bloque: 'materiales', i: 1, campo: 'unds' }, false);
  await page.keyboard.type('4');
  await page.keyboard.press('Tab');
  await page.keyboard.type(D);
  const viajabaC = patchEnVuelo === 1 && respuestasPatch === respuestasAntes;
  f = await apunta('6 · C completa y viajando (PATCH retenido); tecleo D en la otra fila');
  comprueba('③a.1', 'se tecleó D CON el PATCH de C fuera (medido: en vuelo y sin respuesta al acabar de teclear)',
    viajabaC && f.bloques.materiales.includes(`POR ESCRIBIR «2 · ${C}» [enviando]`), { patchEnVuelo, sinRespuesta: respuestasPatch === respuestasAntes, materiales: f.bloques.materiales });
  await quieta();
  f = await apunta('7 · llega la respuesta de C');
  s = await servidor(borrador);
  comprueba('③a.2', 'C queda guardada (servidor y pantalla) y lo tecleado en D sigue entero en su fila, con el cursor en ella',
    caras(s).includes(`materiales · 2 × ${C}`) && f.bloques.materiales.includes(`guardada «2 · ${C}»`) && f.bloques.materiales.includes(`POR ESCRIBIR «4 · ${D}»`) && f.foco === 'descripción de la fila por escribir (materiales)',
    { materiales: f.bloques.materiales, foco: f.foco });
  await page.keyboard.press('Tab');   // sale de la descripción de D: es su `change`
  await quieta();
  f = await apunta('8 · salgo de la fila D (Tab)');
  s = await servidor(borrador);
  const esperadoTrasD = informe.antes.lineas.concat([`mano_obra · 3 × ${A}`, `mano_obra · 1 × ${B}`, `materiales · 2 × ${C}`, `materiales · 4 × ${D}`]);
  comprueba('③a.3', 'el servidor tiene TODO: las de partida, A, B, C y D (comparado como conjunto)',
    caras(s).length === esperadoTrasD.length && esperadoTrasD.every((x) => caras(s).includes(x)), { servidor: caras(s) });
  comprueba('③a.4', 'la fila a medias de mano de obra («7») sigue en su sitio', f.bloques.mano_obra.includes('POR ESCRIBIR «7 · »'), { mano_obra: f.bloques.mano_obra });
  await captura('3a-tecleado-mientras-otra-viajaba', '.parte-anadir[data-bloque="materiales"]');

  /* ── ③b QUITAR UNA CON «×» Y COMPLETAR OTRA MIENTRAS LA «×» VIAJA ────────────────────────────── */
  await pulsar('«Añadir línea» (materiales)', elAnadir, 'materiales');
  await page.keyboard.type('5');
  await page.keyboard.press('Tab');
  respuestasAntes = respuestasPatch;
  const patchAntesDeLaEquis = informe.patch.length;
  await pulsar('la «×» de la línea C', equisDeGuardada, C, false);
  await pulsar('la descripción de la fila por escribir de materiales', campoDeNueva, { bloque: 'materiales', i: 0, campo: 'desc' }, false);
  await page.keyboard.type(E);
  await page.keyboard.press('Tab');
  const viajabaLaEquis = patchEnVuelo === 1 && respuestasPatch === respuestasAntes;
  f = await apunta('9 · «×» de C viajando (PATCH retenido); completo E y salgo de su fila');
  comprueba('③b.1', 'E se completó CON la «×» de C fuera, y espera su turno',
    viajabaLaEquis && f.bloques.materiales.includes(`POR ESCRIBIR «5 · ${E}» [espera]`), { patchEnVuelo, sinRespuesta: respuestasPatch === respuestasAntes, materiales: f.bloques.materiales });
  await quieta();
  f = await apunta('10 · llegan la «×» y, detrás, el guardado de E');
  s = await servidor(borrador);
  const deLaCarrera = informe.patch.slice(patchAntesDeLaEquis);
  const lleva = (p, d) => !!(p && p.lineas && p.lineas.some((x) => x.indexOf(d) !== -1));
  comprueba('③b.2', 'salen DOS PATCH 200: el de la «×» sin C, y el de E sin C, con D y con E (no devuelve la línea quitada)',
    deLaCarrera.length === 2 && deLaCarrera.every((p) => p.estado === 200) && !lleva(deLaCarrera[0], C) && !lleva(deLaCarrera[1], C) && lleva(deLaCarrera[1], D) && lleva(deLaCarrera[1], E),
    { patch: deLaCarrera.map((p) => ({ estado: p.estado, lineas: p.lineas })) });
  const esperadoTrasE = informe.antes.lineas.concat([`mano_obra · 3 × ${A}`, `mano_obra · 1 × ${B}`, `materiales · 4 × ${D}`, `materiales · 5 × ${E}`]);
  comprueba('③b.3', 'el servidor conserva lo correcto: C no está; las de partida, A, B, D y E sí (como conjunto)',
    caras(s).length === esperadoTrasE.length && esperadoTrasE.every((x) => caras(s).includes(x)) && !caras(s).some((x) => x.indexOf(C) !== -1), { servidor: caras(s) });
  comprueba('③b.4', 'las líneas de partida conservan su id', antes.lineas.every((l) => s.lineas.some((x) => x.id === l.id && cara(x) === cara(l))), { ids: antes.lineas.length });
  comprueba('③b.5', 'la pantalla enseña lo mismo que el servidor, línea a línea y en su orden por bloque',
    JSON.stringify(enPantalla(f).slice().sort()) === JSON.stringify(delServidor(s).slice().sort())
      && ['mano_obra', 'materiales'].every((b) => JSON.stringify(f.bloques[b].filter((x) => x.startsWith('guardada '))) === JSON.stringify(s.lineas.filter((l) => l.bloque === b).map((l) => `guardada «${l.unds} · ${l.descripcion}»`))),
    { pantalla: enPantalla(f) });
  comprueba('③b.6', 'la fila a medias de mano de obra («7») sobrevive al repintado de la «×»', f.bloques.mano_obra.includes('POR ESCRIBIR «7 · »'), { mano_obra: f.bloques.mano_obra });
  await captura('3b-quitada-una-y-completada-otra', '.parte-anadir[data-bloque="materiales"]');
  retrasoPatch = 0;

  /* ── ④ SÓLO MIRAR: el cuadro del dictado ─────────────────────────────────────────────────────── */
  const patchAntesDeMirar = informe.patch.length;
  informe.dictado = await page.evaluate(() => {
    const caja = document.querySelector('[data-parte-dictado]');
    const rotulo = document.querySelector('label[for="parte-dictado"]');
    const campo = document.querySelector('[data-dictado-texto]');
    const boton = document.querySelector('[data-dictado-ordenar]');
    const tablas = document.querySelector('[data-parte-filas]');
    const seVe = (n) => !!(n && n.offsetParent !== null && n.getBoundingClientRect().height > 0);
    return {
      rotulo: rotulo ? rotulo.textContent.trim() : null,
      pista: caja && caja.querySelector('.parte-pista') ? caja.querySelector('.parte-pista').textContent.trim() : null,
      boton: boton ? boton.textContent.trim() : null,
      seVen: { caja: seVe(caja), campo: seVe(campo), boton: seVe(boton) },
      campoVacio: campo ? campo.value === '' : null,
      antesDeLasLineas: !!(caja && tablas && (caja.compareDocumentPosition(tablas) & Node.DOCUMENT_POSITION_FOLLOWING)),
      microDelNavegador: !!(caja && caja.querySelector('.voice-mic-btn')),
    };
  });
  comprueba('④.1', 'el cuadro del dictado está, se ve (cuadro, campo y botón) y no se ha tocado',
    informe.dictado.seVen.caja && informe.dictado.seVen.campo && informe.dictado.seVen.boton && !!informe.dictado.rotulo && informe.dictado.campoVacio === true, informe.dictado);
  await captura('4-cuadro-del-dictado', '[data-parte-dictado]');
  const patchPorMirarElDictado = informe.patch.length - patchAntesDeMirar;

  /* ── RECOGER: se quitan las líneas de la prueba con la «×» de la pantalla ───────────────────── */
  await pulsar('la «×» de la fila a medias de mano de obra', equisDeNueva, { bloque: 'mano_obra', i: 0 });
  await quitarLasMias();
  f = await apunta('11 · quitadas las líneas de la prueba, una a una, con su «×»');
  s = await servidor(borrador);
  comprueba('③.fin', 'el parte vuelve EXACTAMENTE a sus líneas de partida (mismos ids, mismo orden, mismo contenido)',
    JSON.stringify(s.lineas) === JSON.stringify(antes.lineas), { servidor: caras(s), partida: informe.antes.lineas });
  informe.despues = { estado: s.estado, lineas: caras(s) };
  await captura('5-recogido', '.parte-anadir[data-bloque="mano_obra"]');

  /* ── ④ SÓLO MIRAR: el parte firmado ──────────────────────────────────────────────────────────── */
  const selladoAntes = await servidor(firmado);
  await abrirParte(firmado, 'tr[data-parte-linea]');
  informe.firmado = await page.evaluate(() => ({
    anadir: document.querySelectorAll('.parte-anadir').length,
    casillasDeLinea: document.querySelectorAll('.parte-linea-unds, .parte-linea-desc').length,
    equis: document.querySelectorAll('.parte-quitar-linea').length,
    porEscribir: document.querySelectorAll('[data-parte-linea-nueva]').length,
    lineasEnPantalla: document.querySelectorAll('tr[data-parte-linea]').length,
    cuadroDelDictado: !!document.querySelector('[data-dictado-texto]'),
  }));
  const selladoDespues = await servidor(firmado);
  informe.firmado.servidor = { estado: selladoDespues.estado, firmasCompletas: selladoDespues.firmasCompletas, lineas: selladoDespues.lineas.length, llevaHuella: !!selladoDespues.contenidoHash };
  comprueba('④.2', 'el parte firmado sigue sellado: sin «Añadir línea», sin casillas de línea, sin «×», y sus líneas a la vista',
    informe.firmado.anadir === 0 && informe.firmado.casillasDeLinea === 0 && informe.firmado.equis === 0 && informe.firmado.porEscribir === 0
      && informe.firmado.lineasEnPantalla === selladoDespues.lineas.length && selladoDespues.lineas.length > 0 && selladoDespues.estado === 'firmado',
    informe.firmado);
  const patchAlAbrirElFirmado = informe.patch.length;
  // Lo cortado se LISTA en el informe. El panel manda por su cuenta `POST /admin/entorno` al cargar
  // (app.js, `enviarEntornoDeLaApp`): también se corta, y no es de los partes. Lo que se exige es que
  // NADA de lo cortado apuntara a un parte: ni el dictado ni el firmado intentaron escribir.
  comprueba('④.3', 'mirar no ha escrito nada: ni un PATCH por mirar el dictado ni por abrir el firmado, ninguno fuera del borrador, ningún intento de escritura cortado contra un parte, y el firmado igual en el servidor',
    patchPorMirarElDictado === 0 && informe.patch.length === patchAlAbrirElFirmado
      && !informe.patch.some((p) => p.ruta !== `/admin/partes/${borrador}`)
      && !informe.cortadas.some((c) => /\/admin\/partes/.test(c)) && JSON.stringify(selladoAntes) === JSON.stringify(selladoDespues),
    { patchPorMirarElDictado, cortadas: informe.cortadas, firmadoIgual: JSON.stringify(selladoAntes) === JSON.stringify(selladoDespues) });
  await captura('4-parte-firmado-sellado', 'tr[data-parte-linea]');

  informe.erroresDePagina = errores;
  comprueba('fin', 'la página no ha dado ningún error de JavaScript en todo el recorrido', errores.length === 0, errores);
} catch (e) {
  informe.fallo = String((e && e.message) || e);
  codigo = Math.max(codigo, /^NO SUPE/.test(informe.fallo) ? 2 : 1);
  console.error('🔴 ' + informe.fallo);
} finally {
  await navegador.close();
}
informe.resumen = { comprobaciones: informe.comprobaciones.length, cumplen: informe.comprobaciones.filter((c) => c.ok).length, patch: informe.patch.length, salida: codigo };
fs.writeFileSync(path.join(salida, `vivo-${ancho}.json`), JSON.stringify(informe, null, 1) + '\n');
for (const c of informe.comprobaciones) console.log(`${c.ok ? '✔' : '✘'} ${c.id} · ${c.que}`);
console.log(`\n${informe.ventana} (${informe.puntero}) · build ${informe.build} · ${informe.resumen.cumplen}/${informe.resumen.comprobaciones} cumplen · PATCH ${informe.patch.length} · salida ${codigo}`);
process.exit(codigo);
