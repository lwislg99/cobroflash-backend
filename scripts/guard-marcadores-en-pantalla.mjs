// scripts/guard-marcadores-en-pantalla.mjs — SCRUM-722
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// NINGÚN `[PENDIENTE microcopy oficial]` LLEGA AL DOM RENDERIZADO SIN QUE ALGUIEN LO SEPA.
//
// LA VÍCTIMA: el profesional que paga y lee corchetes. Desde SCRUM-667 cada merge sale a
// producción, así que un marcador dejó de ser una nota para el equipo.
//
// ── POR QUÉ HACÍA FALTA OTRO, HABIENDO TRES ────────────────────────────────────────────────
// El de albaranes estuvo TRES DÍAS a la vista y ninguno lo vio. No por descuido: es que ninguno
// mira eso. Medido, no supuesto:
//
//   · SCRUM-402 — trinquete sobre el FUENTE (`public/dashboard/js`, por AST). No prohíbe: CONGELA
//     un censo por fichero. `atajoNuevo.js: 1` está DENTRO de ese censo, así que el marcador de
//     albaranes estaba contado y permitido. El guard hizo exactamente lo que promete.
//   · SCRUM-667 — amplía el censo del FUENTE a `src/` y a otras superficies. Mismo eje: el fuente.
//   · SCRUM-720 — es el único que mira el DOM RENDERIZADO, y su propia `COBERTURA` declara que
//     sólo cubre `parteDetailView.js` y `jobAsignados.js`. Dos ficheros.
//
//   🔒 De ahí la lección, que vale más que el arreglo: **teníamos tres guards y ninguno cubría el
//   panel entero sobre lo pintado.** El fuente dice qué literales existen; sólo el DOM dice cuáles
//   se leen. Un marcador dentro de una constante compartida —como éste— no sube el censo del
//   fichero que lo pinta, porque no vive ahí.
//
// ── POR QUÉ ES UN TRINQUETE Y NO UNA PROHIBICIÓN ───────────────────────────────────────────
// La propiedad que se querría —«cero marcadores en pantalla»— HOY está violada en dos ranuras
// más (`exportView` y `quotesView`), reportadas al fundador y pendientes de su firma. Un guard
// que la exigiera nacería ROJO, y un guard que nace rojo lo apaga alguien en una hora. Se vigila
// lo que sí se sostiene desde hoy: **que el número no suba y que no aparezca una vista nueva**.
//
// ── LOS SUELOS, QUE SON LO QUE LO SEPARA DE UN COMENTARIO ───────────────────────────────────
//   ① Si una vista no se puede pintar, es CIEGO y el guard FALLA. «No he podido mirar» no es
//      «está limpio»: así se fabrica un verde que no vale.
//   ② CONTROL NEGATIVO EN CADA EJECUCIÓN: se inyecta un marcador falso en una vista y se
//      comprueba que el detector lo ve. Si el guard no puede volver a ponerse rojo, no es un
//      guard. No se confía en que el control se corriera una vez: se corre siempre.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

import { rutaDelNavegador, argsDeAislamiento } from './_navegador.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PANEL = path.join(RAIZ, 'public', 'dashboard');
const MARCADOR = '[PENDIENTE microcopy oficial]';

// ── LA UNIDAD, DECLARADA (lección de SCRUM-714: tres instrumentos dieron 1, 4, 13 y 14) ──────
// APARICIÓN = una ocurrencia del literal dentro de un NODO DE TEXTO del DOM ya pintado.
// El censo se lleva por VISTA, sumando sus tres estados. Es la unidad que congela el trinquete.
const CENSO = Object.freeze({
  // SCRUM-722 · 7-sep-2026. Medido con este mismo guard sobre `origin/main`.
  //
  // `exportView.js:87` y `:100` — VISIBLES en los tres estados (2 nodos × 3 = 6).
  export: 6,
  // `quotesView.js:890`, `:1363`, `:1398` — llegan al DOM pero OCULTAS en los tres estados: son
  // de la propuesta de pago, que sólo se despliega al elegir esa opción. Cuentan igual: que hoy
  // no se vean depende de un despliegue, no de que el texto esté aprobado.
  'quotes-new': 6,
  // `albaranes` SALIÓ el 7-sep: el fundador firmó «Nuevo albarán». La entrada se BORRA, no se
  // pone a 0 — el trinquete APRIETA (mismo criterio que SCRUM-402/424/405).
});

const ESTADOS = ['con-datos', 'sin-datos', 'error'];

let fallos = 0;
const mal = (m) => { fallos++; console.error(m); };
const decir = (m) => console.log(m);

// ── El banco: el índice REAL del panel, con sus scripts, servido desde un fichero temporal ──
//
// Los scripts se DERIVAN de `index.html`: escribir la lista a mano aquí sería una segunda copia
// que se queda atrás el día que alguien añada una vista, y este guard dejaría de mirarla en
// silencio — que es justo el modo de fallo que viene a cerrar.
function construirBanco() {
  const indice = fs.readFileSync(path.join(PANEL, 'index.html'), 'utf8');
  const scripts = [...new Set([...indice.matchAll(/js\/([A-Za-z0-9]+\.js)/g)].map((m) => m[1]))]
    // El asistente de alta se planta encima de todo cuando cree que el merchant es nuevo, y aquí
    // taparía las vistas que se miden. Se excluye DECLARADO, no en silencio.
    .filter((f) => f !== 'onboardingView.js');
  if (scripts.length < 40) {
    mal(`🔴 CIEGO: sólo ${scripts.length} scripts derivados de index.html. El banco no es el panel.`);
    process.exit(1);
  }
  const url = (p) => pathToFileURL(path.join(PANEL, p)).href;
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<link rel="stylesheet" href="${pathToFileURL(path.join(RAIZ, 'public', 'tokens.css')).href}">
<link rel="stylesheet" href="${url('css/styles.css')}"></head><body><div id="v"></div>
<script>
// 🔴 VA ANTES DE LOS SCRIPTS Y ES LO QUE HACE QUE ESTO MIDA ALGO. Sin sesión, el arranque del
// panel hace location.href='login.html': el documento se sustituye, no queda ni un script y CADA
// vista sale «no existe render…». Ceguera total con cara de cero.
localStorage.setItem('token','guard');
window.fetch = function(){ return Promise.resolve(new Response(JSON.stringify({
  ok:true,id:7,name:'Negocio',role:'admin',plan:'pro',documentoSuelto:'factura',
  modoDocumentoSuelto:'factura',merchantId:7,version:'1'
}),{status:200,headers:{'content-type':'application/json'}})); };
</script>
${scripts.map((s) => `<script src="${url('js/' + s)}"></script>`).join('\n')}
</body></html>`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-722-'));
  const fichero = path.join(dir, 'banco.html');
  fs.writeFileSync(fichero, html, 'utf8');
  return { fichero, scripts: scripts.length };
}

// Las vistas y su función se DERIVAN del `switch` del router, no de una lista a mano aquí.
function vistasDelRouter() {
  const app = fs.readFileSync(path.join(PANEL, 'js', 'app.js'), 'utf8');
  const conArg = new Set(['quotes-detail', 'jobs-detail', 'customer-360', 'albaran-detail', 'parte-detail', 'invoice-detail']);
  const fuera = new Set(['home']); // se pinta en varios `case`; su render se mide en el suyo
  const vistas = [];
  for (const m of app.matchAll(/case '([a-z0-9-]+)':([\s\S]*?)break;/g)) {
    const fn = [...m[2].matchAll(/\b(render[A-Za-z0-9]+View)\s*\(/g)].map((x) => x[1])
      .filter((f) => f !== 'renderHomeView' || m[1] === 'home')[0];
    if (!fn || (fuera.has(m[1]) && vistas.length)) continue;
    vistas.push([m[1], fn, conArg.has(m[1]) ? 1 : null]);
  }
  // Estas dos no tienen `case` propio con render (el router las resuelve por otro camino), pero
  // son pantallas del panel y tienen marcadores en su fuente: se miden igual.
  vistas.push(['products', 'renderProductsView', null], ['providers', 'renderProvidersView', null]);
  return vistas;
}

const { fichero, scripts } = construirBanco();
const VISTAS = vistasDelRouter();
if (VISTAS.length < 15) {
  mal(`🔴 CIEGO: sólo ${VISTAS.length} vistas derivadas del router. No estoy mirando el panel.`);
  process.exit(1);
}
decir(`SCRUM-722 · marcadores en el DOM renderizado — ${VISTAS.length} vistas × ${ESTADOS.length} estados · ${scripts} scripts\n`);

const navegador = await puppeteer.launch({ executablePath: rutaDelNavegador(), headless: 'new', args: argsDeAislamiento() });
const page = await navegador.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.goto(pathToFileURL(fichero).href, { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 1200));

/** Pinta una vista en un estado y cuenta las apariciones en sus nodos de texto. */
async function medir(vista, fn, arg, estado, inyectar) {
  return page.evaluate(async (vista, fn, arg, estado, inyectar, MARCADOR) => {
    let cont = document.getElementById('v');
    if (!cont) { cont = document.createElement('div'); cont.id = 'v'; document.body.appendChild(cont); }
    cont.innerHTML = '';
    if (typeof window[fn] !== 'function') return { ciego: `no existe ${fn}` };

    window.appUserRole = 'admin';
    window.appDocumentoSuelto = 'factura';
    const rico = (ruta) => {
      if (/\/admin\/billing\/plans/.test(ruta)) {
        return { currentPlan: 'free', planExpiresAt: null, founding: { plazas: 0 },
          plans: [{ id: 'pro', name: 'Pro', price: 29, currency: 'EUR', features: ['a'], monthly: 29, annual: 290 }] };
      }
      if (/\/admin\/customers\/\d+/.test(ruta)) {
        return { customer: { id: 3, name: 'Cliente' }, quotes: [], invoices: [], stats: {}, events: [] };
      }
      if (/\/admin\/me|merchant/.test(ruta)) return { id: 7, name: 'Negocio', plan: 'pro', formaJuridica: 'SL' };
      const uno = (i) => ({
        id: i, numero: 'N-' + i, number: 'N-' + i, quoteNumber: 'PR-' + i, invoiceNumber: 'F-' + i,
        name: 'Cliente ' + i, titulo: 'Trabajo ' + i, descripcion: 'D', description: 'D',
        total: 1210, base: 1000, cuota: 210, amount: 1210, currency: 'EUR',
        status: 'pending', estado: 'pendiente', estadoCobro: 'Pendiente',
        createdAt: '2026-09-01T09:00:00.000Z', fecha: '2026-09-01T09:00:00.000Z',
        date: '2026-09-01T09:00:00.000Z', scheduledAt: '2026-09-03T09:00:00.000Z',
        customer: { id: 3, name: 'Cliente' }, customerId: 3,
        quote: { id: 1, number: 'PR-1', total: 1210, currency: 'EUR' },
        lineas: [], lines: [], items: [], asignados: [], albaranes: [], invoices: [],
        totalAceptado: 1210, totalCobrado: 0, importeReferencia: 1210, firmado: false, emitido: false,
      });
      return [uno(1), uno(2), uno(3)];
    };
    // «Sin datos» NO es «sin forma»: devolver `[]` a todo revienta tres vistas y las deja ciegas,
    // que parece limpio. Se conserva la forma y se vacían sus listas.
    const vaciar = (v) => {
      if (Array.isArray(v)) return [];
      if (v && typeof v === 'object') {
        const o = {};
        for (const k of Object.keys(v)) o[k] = Array.isArray(v[k]) ? [] : v[k];
        return o;
      }
      return v;
    };
    window.apiRequest = (ruta) => {
      if (estado === 'error') return Promise.reject(Object.assign(new Error('fallo'), { data: {} }));
      const limpia = String(ruta).split('?')[0];
      let v = rico(ruta);
      if (Array.isArray(v) && /\/\d+(\/[a-z-]+)?$/.test(limpia)) {
        v = { ...v[0] };
        // El albarán elige sus acciones por `alb.estado`, en minúscula: con otro valor,
        // `destinoEfectivo` devuelve un destino que no existe y la vista revienta antes de pintar.
        if (/\/admin\/albaranes\//.test(limpia)) v.estado = 'borrador';
      }
      return Promise.resolve(estado === 'sin-datos' ? vaciar(v) : v);
    };

    try {
      await (arg != null ? window[fn](cont, arg) : window[fn](cont));
    } catch (e) {
      const marco = (String((e && e.stack) || '').split(String.fromCharCode(10))[1] || '');
      return { ciego: String(e).slice(0, 60) + ' @' + marco.trim().replace(/^.*dashboard./, '').slice(0, 60) };
    }
    await new Promise((r) => setTimeout(r, 300));
    if (!cont.querySelectorAll('*').length) return { ciego: 'no pintó ningún nodo' };

    // EL CONTROL NEGATIVO: un marcador falso metido en el DOM ya pintado. Si el detector no lo
    // ve, el cero de todas las demás vistas no vale nada.
    if (inyectar) {
      const p = document.createElement('p');
      p.textContent = MARCADOR + ' inyectado por el control negativo';
      cont.appendChild(p);
    }

    const it = document.createNodeIterator(cont, NodeFilter.SHOW_TEXT);
    let apariciones = 0;
    const muestras = [];
    let n;
    while ((n = it.nextNode())) {
      const c = n.nodeValue.split(MARCADOR).length - 1;
      if (!c) continue;
      apariciones += c;
      if (muestras.length < 3) muestras.push(n.nodeValue.replace(/\s+/g, ' ').trim().slice(0, 60));
    }
    return { apariciones, muestras };
  }, vista, fn, arg, estado, inyectar, MARCADOR);
}

// ── ② CONTROL NEGATIVO, ANTES DE NADA: el detector tiene que saber ver uno ──────────────────
const prueba = await medir('customers', 'renderCustomersView', null, 'con-datos', true);
if (prueba.ciego) {
  mal(`🔴 CIEGO en el control negativo: ${prueba.ciego}`);
} else if (!prueba.apariciones) {
  mal('🔴 EL CONTROL NEGATIVO NO CAE: se ha metido un marcador en el DOM y el detector no lo ve.\n'
    + '   Entonces el cero de todas las vistas es «no he mirado», no «está limpio». Este guard\n'
    + '   no vale hasta que esto se ponga rojo.');
} else {
  decir(`  ✅ control negativo: el marcador inyectado se detecta (${prueba.apariciones})`);
}

// ── ① EL CENSO ──────────────────────────────────────────────────────────────────────────────
const porVista = {};
const ciegos = [];
for (const [vista, fn, arg] of VISTAS) {
  for (const estado of ESTADOS) {
    const r = await medir(vista, fn, arg, estado, false);
    if (r.ciego) { ciegos.push(`${vista} · ${estado} → ${r.ciego}`); continue; }
    if (!r.apariciones) continue;
    porVista[vista] = (porVista[vista] || 0) + r.apariciones;
    (porVista['__muestras_' + vista] ||= []).push(...r.muestras);
  }
}
await navegador.close();
fs.rmSync(path.dirname(fichero), { recursive: true, force: true });

if (ciegos.length) {
  mal(`\n🔴 ${ciegos.length} par(es) (vista,estado) CIEGOS. No es «limpio»: es que no he podido mirar,\n`
    + '   y un guard que no puede mirar no puede aprobar:\n     ' + ciegos.join('\n     '));
}

decir('');
const vistas = Object.keys(porVista).filter((k) => !k.startsWith('__'));
for (const v of vistas) {
  const techo = CENSO[v];
  const n = porVista[v];
  const muestra = (porVista['__muestras_' + v] || [])[0] || '';
  if (techo === undefined) {
    mal(`  🔴 VISTA NUEVA CON MARCADOR: \`${v}\` pinta ${n} y no estaba en el censo.\n`
      + `     «${muestra}»\n`
      + '     O se firma el texto y desaparece, o entra AQUÍ con su motivo y quién lo retira.');
  } else if (n > techo) {
    mal(`  🔴 SUBE: \`${v}\` pinta ${n} y su techo es ${techo}. El trinquete sólo baja.\n     «${muestra}»`);
  } else if (n < techo) {
    mal(`  🔴 BAJA Y NO SE HA APRETADO: \`${v}\` pinta ${n} y el censo dice ${techo}.\n`
      + '     Baja el número aquí (o borra la entrada si es 0): un techo por encima de la realidad\n'
      + '     es holgura para que vuelva a subir sin que nadie lo note.');
  } else {
    decir(`  · ${v}: ${n} (en su techo)`);
  }
}
for (const v of Object.keys(CENSO)) {
  if (!vistas.includes(v)) {
    mal(`  🔴 ENTRADA CADUCA: \`${v}\` ya no pinta ningún marcador. BÓRRALA del censo — no la pongas\n`
      + '     a 0: mientras esté, esa vista puede volver a subir hasta su techo sin caer.');
  }
}

decir('\n' + '─'.repeat(76));
if (fallos) {
  console.error(`🔴 SCRUM-722 · ${fallos} problema(s) con los marcadores en pantalla.`);
  process.exit(1);
}
decir('✅ ningún marcador NUEVO llega al DOM renderizado. Vigiladas las '
  + `${VISTAS.length} vistas del router en sus tres estados (con datos, sin datos y error), con el `
  + 'control negativo corrido en esta misma ejecución. Los que quedan están en el CENSO, '
  + 'reportados al fundador y pendientes de firma.');
