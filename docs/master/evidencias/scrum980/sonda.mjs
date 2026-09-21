// Sonda de SCRUM-980 (pestana «Trabajos» de la ficha 360), en Edge, DESPUES de pulsar.
// Uso: node sonda.mjs <raiz-del-worktree> [puerto]
// Contra el servidor local (servidor.mjs) y su banco desechable. Lee siembra.json y secreto.txt.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

const raiz = process.argv[2];
const puerto = process.argv[3] || '3980';
const aqui = process.env.SONDA_TMP; // directorio de trabajo FUERA del arbol: aqui van el secreto y la siembra, nunca al repo
if (!aqui) { console.error('falta SONDA_TMP'); process.exit(2); }
const S = JSON.parse(fs.readFileSync(path.join(aqui, 'siembra.json'), 'utf8'));
const secreto = fs.readFileSync(path.join(aqui, 'secreto.txt'), 'utf8').trim();
const BASE = 'http://localhost:' + puerto;
if (!/^http:\/\/localhost:/.test(BASE)) { console.error('no es local'); process.exit(2); }

const req = createRequire(path.join(raiz, 'package.json'));
const pmod = await import(pathToFileURL(req.resolve('puppeteer-core')).href);
const puppeteer = pmod.default || pmod;
const { lanzarNavegador } = await import(pathToFileURL(path.join(raiz, 'scripts/_navegador.mjs')).href);

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const filas = [];
let rojos = 0;
const marca = (ok, texto, dato) => { if (!ok) rojos++; filas.push((ok ? '✔ ' : '🔴 ') + texto + (dato === undefined ? '' : '  → ' + JSON.stringify(dato))); };

const nav = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });
const anchos = [1280, 390, 360];
const informe = {};
try {
  for (const w of anchos) {
    const ctx = await nav.createBrowserContext();
    const pag = await ctx.newPage();
    const inf = (informe[w] = {});
    const consola = [];
    pag.on('pageerror', (e) => consola.push('pageerror: ' + e.message));
    pag.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) consola.push('console.error: ' + m.text()); });
    // Las respuestas >= 400, CON su URL: «Failed to load resource» a secas no dice de quién es.
    const fallos = (inf.fallos = []);
    pag.on('response', (r) => { if (r.status() >= 400) fallos.push(r.status() + ' ' + r.request().method() + ' ' + r.url().replace(BASE, '')); });
    await pag.setViewport({ width: w, height: w === 1280 ? 900 : 800 });
    // Pulsar como un usuario: el control al CENTRO de la ventana (no pegado al borde, donde la barra
    // inferior del móvil lo tapa) y, ANTES de pulsar, comprobar que el punto donde se pulsa ES el
    // control y no otra cosa encima. Devuelve si era tocable; si NO lo era, deja en `inf.taparon` QUIEN
    // hay encima (nodeName, clase, id y su caja) y la caja del control, para no adivinar (SCRUM-980b).
    inf.taparon = [];
    // ⚠️ `html { scroll-behavior: smooth }` (styles.css): con `scrollIntoView` a secas la caja se mide A MEDIO
    // DESPLAZAMIENTO. Medido el 21-sep (tercera y cuarta pasada): «Ver más» «no tocable» con el punto FUERA de la
    // ventana (elementFromPoint = null, y=1924 en una ventana de 800), y a 360 el clic cayo en el «?» de la guía
    // mientras el control aun subia. Era la SONDA, no la pantalla: `behavior: 'instant'` y dos fotogramas de espera.
    const pulsar = async (sel) => {
      await pag.$eval(sel, (el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await pag.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const medida = await pag.$eval(sel, (el) => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const e = document.elementFromPoint(cx, cy);
        const caja = (n) => { const b = n.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)].join(','); };
        const cs = e ? getComputedStyle(e) : null;
        return {
          tocable: !!e && (e === el || el.contains(e)),
          control: { nodo: el.nodeName, clase: el.className, caja: caja(el), visible: el.offsetParent !== null },
          centro: [Math.round(cx), Math.round(cy)],
          ventana: [window.innerWidth, window.innerHeight],
          scrollY: Math.round(window.scrollY),
          docAlto: document.documentElement.scrollHeight,
          encima: e ? { nodo: e.nodeName, clase: e.className, id: e.id, caja: caja(e), position: cs.position, zIndex: cs.zIndex, texto: (e.textContent || '').trim().slice(0, 40) } : null,
        };
      });
      if (!medida.tocable) inf.taparon.push({ sel, ...medida });
      await pag.click(sel);
      return medida.tocable;
    };
    await pag.goto(BASE + '/login.html', { waitUntil: 'load' });
    const login = await pag.evaluate(async (s) => (await fetch('/auth/test-login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'qa-980b@example.test', secret: s }) })).status, secreto);
    marca(login === 200, `[${w}] login de QA`, login);
    if (login !== 200) continue;

    // ── La ficha con trabajos ─────────────────────────────────────────────────────────────
    await pag.goto(BASE + '/dashboard/#customer-360/' + S.clienteId, { waitUntil: 'networkidle2' });
    await pag.waitForSelector('#btn-edit-360', { timeout: 20000 });
    await pag.waitForFunction(() => document.querySelector('button[data-key="jobs"]'), { timeout: 10000 });

    inf.antes = await pag.evaluate(() => {
      const tabs = [...document.querySelectorAll('button[data-key]')].map((b) => {
        const r = b.getBoundingClientRect();
        return { key: b.dataset.key, texto: b.textContent, derecha: Math.round(r.right), ancho: Math.round(r.width) };
      });
      const prox = document.querySelector('.historial-proxima');
      const cs = prox ? getComputedStyle(prox) : null;
      return {
        tabs,
        proxima: prox ? prox.textContent : null,
        proximaEstilo: cs ? { fs: cs.fontSize, fw: cs.fontWeight, mt: cs.marginTop } : null,
        anchoDoc: document.documentElement.scrollWidth,
        ventana: window.innerWidth,
      };
    });
    marca(!!inf.antes.proxima && /^Próxima visita: /.test(inf.antes.proxima), `[${w}] la cabecera pinta «Próxima visita»`, inf.antes.proxima);
    marca(inf.antes.proximaEstilo && inf.antes.proximaEstilo.fs === '13px' && inf.antes.proximaEstilo.fw === '600' && inf.antes.proximaEstilo.mt === '6px', `[${w}] «Próxima visita» con el estilo de la hoja (13px, 600, 6px)`, inf.antes.proximaEstilo);
    const tJobs = inf.antes.tabs.find((t) => t.key === 'jobs');
    marca(!!tJobs && tJobs.texto === 'Trabajos (20+)', `[${w}] la pestaña dice «Trabajos (20+)» (hay segunda página)`, tJobs && tJobs.texto);
    marca(inf.antes.tabs.length === 3, `[${w}] las tres pestañas (SUELO: las de siempre siguen)`, inf.antes.tabs.map((t) => t.texto));
    marca(inf.antes.tabs.every((t) => t.derecha <= inf.antes.ventana), `[${w}] ninguna pestaña se sale de la ventana`, inf.antes.tabs.map((t) => t.derecha));
    marca(inf.antes.anchoDoc <= inf.antes.ventana, `[${w}] sin scroll horizontal antes de pulsar`, { anchoDoc: inf.antes.anchoDoc, ventana: inf.antes.ventana });

    // ── PULSAR la pestaña y medir el ESTADO ───────────────────────────────────────────────
    marca(await pulsar('button[data-key="jobs"]'), `[${w}] la pestaña «Trabajos» es tocable en su centro (nada encima)`);
    const hayFilas = await pag.waitForSelector('tr[data-trabajo]', { timeout: 10000 }).then(() => true, () => false);
    if (!hayFilas) {
      // Diagnostico en vez de caerse: que ve el usuario tras pulsar, y si un SEGUNDO clic si abre la pestana
      // (si solo abre el segundo, el primero se perdio: carrera de la sonda o defecto real, y se separa por esto).
      const estado = () => pag.evaluate(() => ({
        hash: location.hash,
        tabs: [...document.querySelectorAll('button[data-key]')].map((b) => ({ key: b.dataset.key, texto: b.textContent, aria: b.getAttribute('aria-selected'), clase: b.className, style: b.getAttribute('style') })),
        filas: document.querySelectorAll('tr[data-trabajo]').length,
        cuerpo: document.body.innerText.slice(0, 300),
        cargando: [...document.querySelectorAll('*')].filter((n) => /cargando|loading/i.test(n.className + ' ' + n.textContent) && n.children.length === 0).map((n) => n.textContent.trim().slice(0, 30)).slice(0, 3),
      }));
      inf.sinFilas = { trasPrimerClic: await estado() };
      const tocable2 = await pulsar('button[data-key="jobs"]');
      const hay2 = await pag.waitForSelector('tr[data-trabajo]', { timeout: 10000 }).then(() => true, () => false);
      inf.sinFilas.segundoClic = { tocable: tocable2, hayFilas: hay2, estado: await estado() };
      marca(false, `[${w}] al pulsar la pestana «Trabajos» NO aparecen filas (primer clic); segundo clic → ${hay2 ? 'SI abre' : 'tampoco abre'}`, inf.sinFilas);
      if (!hay2) { await pag.screenshot({ path: path.join(aqui, `sonda980b-${w}-sinfilas.png`) }).catch(() => {}); await ctx.close(); continue; }
    }
    inf.pestana = await pag.evaluate(() => {
      const filas = [...document.querySelectorAll('tr[data-trabajo]')];
      const f0 = filas[0];
      const celdas = f0 ? [...f0.children].map((td) => td.textContent.trim()) : [];
      const pill = f0 && f0.querySelector('.status-pill');
      const fecha = f0 && f0.children[0];
      const docs = f0 && f0.querySelector('.historial-docs');
      const fotos = f0 && f0.querySelector('.historial-fotos');
      const mas = document.querySelector('.historial-ver-mas');
      const sueltos = document.querySelector('.historial-sueltos');
      const lista = document.querySelector('.historial-sueltos-lista');
      const cd = docs ? getComputedStyle(docs) : null;
      const cm = mas ? getComputedStyle(mas) : null;
      const cs = sueltos ? getComputedStyle(sueltos) : null;
      const cl = lista ? getComputedStyle(lista) : null;
      const scroll = document.querySelector('.table-scroll');
      const th = [...document.querySelectorAll('thead th')].map((x) => x.textContent);
      const marg = (c) => c && [c.marginTop, c.marginRight, c.marginBottom, c.marginLeft].join(' ');
      return {
        n: filas.length,
        th,
        primeraFila: celdas,
        pill: pill && { texto: pill.textContent, clase: pill.className },
        colorFecha: fecha && getComputedStyle(fecha).color,
        colorMuted: (() => { const t = document.createElement('span'); t.style.color = 'var(--muted)'; document.body.appendChild(t); const c = getComputedStyle(t).color; t.remove(); return c; })(),
        docs: cd && { display: cd.display, gap: cd.columnGap, botones: [...docs.querySelectorAll('button')].map((b) => b.textContent.trim()) },
        fotos: fotos && { texto: fotos.textContent.trim(), aria: fotos.getAttribute('aria-label') },
        verMas: cm && { texto: mas.textContent, margen: marg(cm) },
        sueltos: cs && { texto: sueltos.textContent, tag: sueltos.tagName, fs: cs.fontSize, fw: cs.fontWeight, margen: marg(cs) },
        sueltosLista: cl && { display: cl.display, margen: marg(cl), botones: [...lista.querySelectorAll('button')].map((b) => b.textContent.trim()) },
        tabTitulo: document.querySelector('button[data-key="jobs"]').textContent,
        anchoDoc: document.documentElement.scrollWidth,
        ventana: window.innerWidth,
        carril: scroll ? { scrollWidth: scroll.scrollWidth, clientWidth: scroll.clientWidth } : null,
      };
    });
    const P = inf.pestana;
    marca(P.n === 20, `[${w}] al pulsar: 20 filas (primera página)`, P.n);
    marca(JSON.stringify(P.th) === JSON.stringify(['Fecha', 'Trabajo', 'Estado', 'Documentos']), `[${w}] columnas Fecha · Trabajo · Estado · Documentos`, P.th);
    marca(P.primeraFila[1] === 'Trabajo 01' && /Terminado/.test(P.primeraFila[2]) && /PT-2026-001/.test(P.primeraFila[3]) && /ALB-2026-001/.test(P.primeraFila[3]), `[${w}] la primera fila: título, estado (Terminado) y sus dos documentos`, P.primeraFila);
    marca(P.fotos && /📷 3/.test(P.fotos.texto) && P.fotos.aria === '3 fotos', `[${w}] el albarán enseña «📷 3» y su nombre accesible «3 fotos»`, P.fotos);
    marca(P.docs && P.docs.display === 'flex' && P.docs.gap === '6px', `[${w}] .historial-docs: flex con hueco de 6px (el estilo que llevaba en línea)`, P.docs && { display: P.docs.display, gap: P.docs.gap });
    marca(!!P.colorFecha && !!P.colorMuted && P.colorFecha === P.colorMuted, `[${w}] la celda de fecha lleva el color --muted (como con el estilo en línea)`, { color: P.colorFecha, muted: P.colorMuted });
    marca(P.verMas && P.verMas.texto === 'Ver más trabajos' && P.verMas.margen === '12px 16px 12px 16px', `[${w}] «Ver más trabajos» con margen 12px 16px`, P.verMas);
    marca(P.sueltos && P.sueltos.texto === 'Partes sin trabajo' && P.sueltos.fs === '13px' && P.sueltos.fw === '700' && P.sueltos.margen === '16px 16px 8px 16px', `[${w}] «Partes sin trabajo» (13px, 700, margen 16 16 8)`, P.sueltos);
    marca(P.sueltosLista && P.sueltosLista.display === 'flex' && P.sueltosLista.margen === '0px 16px 16px 16px' && P.sueltosLista.botones.join() === 'PT-2026-099', `[${w}] la lista de partes sueltos: flex, margen 0 16 16 y PT-2026-099`, P.sueltosLista);
    marca(P.anchoDoc <= P.ventana, `[${w}] sin scroll horizontal DESPUÉS de pulsar`, { anchoDoc: P.anchoDoc, ventana: P.ventana, carril: P.carril });

    // ── «Ver más trabajos»: 20 → 24, y el botón se va ─────────────────────────────────────
    marca(await pulsar('.historial-ver-mas'), `[${w}] «Ver más trabajos» es tocable en su centro (nada encima)`);
    await pag.waitForFunction(() => document.querySelectorAll('tr[data-trabajo]').length === 24, { timeout: 10000 }).catch(() => {});
    inf.verMas = await pag.evaluate(() => ({
      n: document.querySelectorAll('tr[data-trabajo]').length,
      tab: document.querySelector('button[data-key="jobs"]').textContent,
      boton: !!document.querySelector('.historial-ver-mas'),
      largo: (document.querySelector('tr[data-trabajo] .cell-title') || {}).textContent,
      ultimo: [...document.querySelectorAll('tr[data-trabajo]')].pop().children[1].textContent.trim(),
      anchoDoc: document.documentElement.scrollWidth,
      ventana: window.innerWidth,
    }));
    marca(inf.verMas.n === 24 && inf.verMas.tab === 'Trabajos (24)' && inf.verMas.boton === false, `[${w}] «Ver más»: 24 filas, «Trabajos (24)» y el botón desaparece`, inf.verMas);
    marca(inf.verMas.anchoDoc <= inf.verMas.ventana, `[${w}] sin scroll horizontal con el título largo`, { anchoDoc: inf.verMas.anchoDoc, ventana: inf.verMas.ventana });

    // ── Los enlaces: parte y trabajo, y RECARGAR estando en la ficha del parte ─────────────
    const botonParte = await pag.evaluateHandle(() => [...document.querySelectorAll('tr[data-trabajo] .historial-docs button')].find((b) => /PT-2026-001/.test(b.textContent)));
    await botonParte.asElement().click();
    await pag.waitForFunction(() => /#parte-detail\//.test(location.hash), { timeout: 10000 }).catch(() => {});
    inf.parte = { hash: await pag.evaluate(() => location.hash) };
    marca(inf.parte.hash === '#parte-detail/' + S.parteId, `[${w}] el enlace del parte abre SU parte`, inf.parte.hash);
    await pag.reload({ waitUntil: 'networkidle2' });
    await esperar(800);
    inf.parte.trasRecargar = await pag.evaluate(() => ({ hash: location.hash, cuerpo: document.body.innerText.includes('PT-2026-001'), aviso: document.body.innerText.includes('Ese parte ya no existe') }));
    marca(inf.parte.trasRecargar.hash === '#parte-detail/' + S.parteId && inf.parte.trasRecargar.cuerpo && !inf.parte.trasRecargar.aviso, `[${w}] recargar en la ficha del parte NO la pierde (DETALLES)`, inf.parte.trasRecargar);

    // Un parte que no existe → el aviso firmado y vuelta a Trabajos.
    await pag.goto(BASE + '/dashboard/#parte-detail/999999', { waitUntil: 'networkidle2' });
    await pag.reload({ waitUntil: 'networkidle2' });
    await esperar(1200);
    inf.inexistente = await pag.evaluate(() => ({ hash: location.hash, aviso: document.body.innerText.includes('Ese parte ya no existe.') }));
    marca(inf.inexistente.aviso, `[${w}] un parte que no existe → «Ese parte ya no existe.»`, inf.inexistente);

    // ── El cliente SIN trabajos: «Sin trabajos» con su estilo ─────────────────────────────
    await pag.goto(BASE + '/dashboard/#customer-360/' + S.vacioId, { waitUntil: 'networkidle2' });
    await pag.reload({ waitUntil: 'networkidle2' });
    await pag.waitForSelector('button[data-key="jobs"]', { timeout: 15000 });
    await esperar(600);
    marca(await pulsar('button[data-key="jobs"]'), `[${w}] (cliente sin trabajos) la pestaña «Trabajos» es tocable en su centro`);
    const hayVacio = await pag.waitForSelector('td.historial-vacio', { timeout: 6000 }).then(() => true, () => false);
    if (!hayVacio) {
      inf.vacioDiagnostico = await pag.evaluate(() => ({
        hash: location.hash, tab: (document.querySelector('button[data-key="jobs"]') || {}).textContent,
        cuerpo: document.body.innerText.slice(0, 400), colorTab: (document.querySelector('button[data-key="jobs"]') || { style: {} }).style.color,
        filas: document.querySelectorAll('tbody tr').length, celdas: [...document.querySelectorAll('tbody td')].slice(0, 6).map((t) => t.className + '|' + t.textContent.trim().slice(0, 30)),
      }));
    }
    marca(hayVacio, `[${w}] al pulsar «Trabajos (0)» aparece la celda del vacío`, inf.vacioDiagnostico);
    if (!hayVacio) { await ctx.close(); continue; }
    inf.vacio = await pag.evaluate(() => {
      const td = document.querySelector('td.historial-vacio');
      const c = getComputedStyle(td);
      return {
        texto: td.textContent, tab: document.querySelector('button[data-key="jobs"]').textContent,
        pad: c.paddingTop + ' ' + c.paddingRight + ' ' + c.paddingBottom + ' ' + c.paddingLeft, align: c.textAlign, color: c.color,
        proxima: !!document.querySelector('.historial-proxima'), colspan: td.colSpan,
        anchoDoc: document.documentElement.scrollWidth, ventana: window.innerWidth,
      };
    });
    marca(inf.vacio.texto === 'Sin trabajos' && inf.vacio.tab === 'Trabajos (0)' && inf.vacio.pad === '24px 24px 24px 24px' && inf.vacio.align === 'center', `[${w}] sin trabajos: «Sin trabajos», «Trabajos (0)», padding 24 y centrado (lo que decía el estilo en línea)`, inf.vacio);
    marca(inf.vacio.proxima === false, `[${w}] sin próxima visita la línea NO se pinta (ausente no es cero)`, inf.vacio.proxima);
    marca(inf.vacio.anchoDoc <= inf.vacio.ventana, `[${w}] sin scroll horizontal en el vacío`, { anchoDoc: inf.vacio.anchoDoc, ventana: inf.vacio.ventana });

    marca(consola.length === 0, `[${w}] sin errores de página ni de consola (salvo los de red, que van abajo con su URL)`, consola);
    // Los >= 400 esperados: el parte 999999 que se pide A PROPÓSITO. Cualquier otro se lista y se mira.
    // Declarados: el 401 de `/admin/me` (la página de login pregunta por la sesión ANTES de entrar) y el
    // `favicon.ico` que el banco no sirve. Ninguno es de esta pantalla.
    const inesperados = fallos.filter((f) => !/\/admin\/partes\/999999$/.test(f) && f !== '401 GET /admin/me' && f !== '404 GET /favicon.ico');
    marca(inesperados.length === 0, `[${w}] ninguna respuesta >= 400 aparte de las declaradas (parte 999999 pedido a propósito, /admin/me antes del login, favicon)`, inesperados);
    await pag.screenshot({ path: path.join(aqui, `sonda980b-${w}.png`) }).catch(() => {});
    await ctx.close();
  }
} catch (e) {
  marca(false, 'la sonda se cayó', e.message);
} finally {
  await nav.close();
}
console.log(JSON.stringify(informe, null, 1));
console.log('\n── VEREDICTO ──');
for (const f of filas) console.log(f);
console.log(`\nPOBLACION anchos=${anchos.length} · comprobaciones=${filas.length} · rojos=${rojos}`);
console.log('EXIT=' + (rojos ? 1 : 0));
process.exit(rojos ? 1 : 0);
