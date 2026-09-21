// scripts/guard-965-un-solo-presupuesto.mjs — SCRUM-965 · PULSAR DOS VECES NO PUEDE CREAR DOS PRESUPUESTOS.
//
// Uso:  npm run guard:un-solo-presupuesto
//
// ── EL DEFECTO, Y POR QUÉ TIENE TICKET PROPIO ───────────────────────────────────────────────────
// El editor deja el botón «Generar presupuesto» ARMADO después de haber generado. Cerrar la hoja con
// «Seguir editando» y volver a pulsarlo crea OTRO presupuesto, con OTRO número, idéntico al primero.
// El profesional quería uno y tiene dos, y los dos consumen numeración.
//
// Salió del PASO 0 del rediseño (SCRUM-915) pero NO es una fila del rediseño: es un defecto vivo en
// la pantalla de hoy, así que se arregla suelto y no espera a que lleguen los siete cortes.
//
// ── QUÉ SE MIDE: LOS POST DE VERDAD ─────────────────────────────────────────────────────────────
// 🔴 No se mira si el botón «parece» deshabilitado ni qué clase lleva: se CUENTAN las peticiones que
// llegan al servidor. Un botón puede verse gris y disparar igual, y una clase la pone el mismo
// código que se está juzgando. Lo que no miente es cuántos documentos se han pedido.
//
// ── POBLACIÓN: 2 casos, y el segundo es el control positivo ─────────────────────────────────────
//   🔴 A · PRESUPUESTO (1280 px) — recorrido completo, «Generar presupuesto», «Seguir editando»
//          para cerrar la hoja, y «Generar presupuesto» OTRA VEZ sin tocar nada del formulario.
//          Tiene que haber UN `POST /quote/create`, y el profesional tiene que seguir llegando a su
//          presupuesto: la hoja vuelve a salir CON EL MISMO NÚMERO.
//   ✅ B · JUSTIFICANTE (1280 px) — la misma doble pulsación sobre «Emitir justificante».
//          Tiene que haber UN `POST /admin/invoices`. **Hoy ya sale verde**, y por eso es el control
//          positivo: el documento suelto navega a su ficha al emitir, así que el botón no se queda
//          armado. Si este caso saliera rojo, el que está mal es el instrumento — y si saliera
//          verde el A sin arreglo ninguno, también. Un guard que sólo sabe decir «mal» no es un
//          guard.
//          ⚠️ Y aquí importa el doble: un justificante emitido NO se edita ni se borra (regla 29),
//          así que emitir dos es peor que presupuestar dos. Se mide aunque hoy esté sano.
//
// ── SUELO ───────────────────────────────────────────────────────────────────────────────────────
// Si el editor no pinta, si el recorrido no llega al último paso, o si el PRIMER documento no llega
// a crearse, sale con 2 (NO SUPE MEDIR). «0 documentos creados» no es «no duplica»: es que no se
// pulsó nada. Un rojo sin población no es un hallazgo.
//
// ── POR QUÉ FUERA DE `npm test` ─────────────────────────────────────────────────────────────────
// Hace falta el CSS resuelto y un navegador que pulse de verdad: el segundo clic sólo existe después
// de cerrar una hoja que se monta en tiempo de render. La red que corre siempre es
// `tests/scrum965-un-solo-documento.test.mjs`, que vigila el MECANISMO sobre el fuente.
//
// Todo lo que corre DENTRO de la página va en cadenas dentro de `new Function` (censo SCRUM-258).
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
let PUERTO = Number(process.env.GUARD965_PUERTO || 0);

// El teléfono va en el rango imposible `34 0XX XXX XXX` (SCRUM-262): ningún abonado español
// empieza por 0, así que un dato de prueba nunca puede ser el número de alguien.
const CLIENTE = { id: 7, name: 'Comunidad Los Olivos', phone: '34000000001', email: 'olivos@correo.es' };
const MERCHANT = { id: 1, name: 'QA 965', defaultCurrency: 'EUR', country: 'ES', iban: 'ES9121000418450200051332' };
let modoSuelto = 'no';

/** El contador que decide. Se reinicia por caso y se declara en el informe. */
let pedidos = { presupuestos: 0, facturas: 0 };

const me = () => ({
  id: 1, email: 'demo@yaqu.app', name: 'QA 965', plan: 'pro', role: 'admin',
  onboardingCompleted: true, subscriptionStatus: 'active', voiceEnabled: false,
  documentoSuelto: modoSuelto,
});

function arrancarServidor() {
  const json = (res, o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  const srv = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (req.method === 'POST' && /\/quote\/create/.test(u)) {
      pedidos.presupuestos += 1;
      // Cada creación devuelve un número DISTINTO: así, si el editor creara dos, la segunda hoja
      // enseñaría otro número y el guard puede decir CUÁL vio, no sólo que hubo dos.
      const id = 100 + pedidos.presupuestos;
      return json(res, { ok: true, id, number: id, status: 'draft', total: 0 });
    }
    if (req.method === 'POST' && /\/admin\/invoices$/.test(u)) {
      pedidos.facturas += 1;
      const id = 200 + pedidos.facturas;
      return json(res, { ok: true, factura: { id, number: id, total: 0, currency: 'EUR' } });
    }
    if (/^\/admin\/quotes\/\d+/.test(u)) {
      return json(res, { id: 101, quoteNumber: 101, status: 'draft', total: 0, currency: 'EUR', pdfUrl: '/x.pdf' });
    }
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

/** Pulsa el botón VISIBLE con ese texto exacto, en TODA la página (la hoja vive fuera del editor). */
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

/** Pulsa el botón visible con ese texto DENTRO del bloque cuyo título se da (hay varios «Cambiar»). */
const PULSAR_EN_BLOQUE = new Function('texto', 'enBloque', `
  var limpio = function (t) { return String(t || '').replace(/\\s+/g, ' ').trim(); };
  var raiz = document.querySelector('.quotes-left-card');
  if (!raiz) return 'sin-editor';
  var ambito = null;
  var ts = raiz.querySelectorAll('.quote-block-title');
  for (var i = 0; i < ts.length; i++) if (limpio(ts[i].textContent) === enBloque) ambito = ts[i].parentElement;
  if (!ambito) return 'sin-bloque';
  var bs = ambito.querySelectorAll('button');
  for (var j = 0; j < bs.length; j++) {
    if (limpio(bs[j].textContent) === texto && bs[j].checkVisibility()) {
      bs[j].scrollIntoView({ block: 'center', behavior: 'instant' });
      bs[j].click();
      return bs[j].disabled ? 'estaba-deshabilitado' : 'pulsado';
    }
  }
  return 'no-encontrado';
`);

const ESTADO = new Function(`
  var limpio = function (t) { return String(t || '').replace(/\\s+/g, ' ').trim(); };
  var ve = function (el) { return !!el && el.isConnected && el.checkVisibility(); };
  var hojas = Array.prototype.slice.call(document.querySelectorAll('.modal-overlay')).filter(ve);
  var texto = hojas.map(function (h) { return limpio(h.innerText); }).join(' || ');
  var m = texto.match(/Presupuesto #(\\d+)/);
  return {
    hojaAbierta: hojas.length > 0,
    numeroEnLaHoja: m ? m[1] : null,
    textoDeLaHoja: texto.slice(0, 140),
    vista: (location.hash || '').replace('#', ''),
    primario: (function () {
      var b = document.querySelector('.quote-block-actions .btn-primary');
      return b ? { texto: limpio(b.textContent), disabled: b.disabled, visible: ve(b) } : null;
    })(),
  };
`);

const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function teclear(pag, selector, texto) {
  const el = await pag.$(selector);
  if (!el) return false;
  await el.evaluate((e) => { e.scrollIntoView({ block: 'center', behavior: 'instant' }); e.focus(); e.value = ''; });
  await pag.keyboard.type(texto);
  return true;
}

const hallazgos = [];
const ciegos = [];
const informe = [];

/** Recorre el editor hasta el último paso, con cliente y una línea válida. */
async function llegarAlUltimoPaso(pag, etiqueta, suelto) {
  const ruta = suelto ? 'invoices-new' : 'quotes-new';
  await pag.goto(`http://127.0.0.1:${PUERTO}/dashboard/index.html#${ruta}`, { waitUntil: 'networkidle0' });
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

  if (!await teclear(pag, '.quote-line .quote-line__concept input', 'Mano de obra (hora)')
    || !await teclear(pag, '.quote-line .quote-line__qty input', '6')
    || !await teclear(pag, '.quote-line .quote-line__price input', '38')) {
    ciegos.push(`${etiqueta} -> no encontré concepto, cantidad o precio de la primera línea`); return false;
  }
  await pag.evaluate(new Function('if (document.activeElement && document.activeElement.blur) document.activeElement.blur();'));
  await espera(350);

  // Presupuesto: Conceptos -> Condiciones -> Revisar. Justificante: Conceptos -> Revisar.
  await pag.evaluate(PULSAR, 'Continuar');
  await espera(300);
  if (!suelto) { await pag.evaluate(PULSAR, 'Continuar'); await espera(300); }

  const e = await pag.evaluate(ESTADO);
  if (!e.primario || !e.primario.visible) {
    ciegos.push(`${etiqueta} -> no llegué al último paso: la acción primaria no está a la vista (${JSON.stringify(e.primario)})`);
    return false;
  }
  return true;
}

async function caso(navegador, { suelto, etiqueta, rotulo, cierre, contador, limite, modificar = null }) {
  const contexto = await navegador.createBrowserContext();
  const pag = await contexto.newPage();
  const errores = [];
  pag.on('pageerror', (e) => errores.push(String(e.message || e)));
  const mal = [];
  try {
    modoSuelto = suelto ? 'justificante' : 'no';
    pedidos = { presupuestos: 0, facturas: 0 };
    await pag.setViewport({ width: 1280, height: 900 });
    if (!await llegarAlUltimoPaso(pag, etiqueta, suelto)) return;

    // ── Primer clic ──────────────────────────────────────────────────────────────────────────
    const r1 = await pag.evaluate(PULSAR, rotulo);
    await espera(1200);
    const e1 = await pag.evaluate(ESTADO);
    const tras1 = pedidos[contador];
    if (tras1 !== 1) {
      // SUELO: sin un primer documento no hay nada que duplicar, y un «0 duplicados» sería un cero
      // de algo que no llegó a correr.
      ciegos.push(`${etiqueta} -> el PRIMER «${rotulo}» (${r1}) dejó ${tras1} documento(s) creado(s); esperaba 1. Sin eso no puedo juzgar el segundo clic`);
      return;
    }
    const primerNumero = e1.numeroEnLaHoja;
    informe.push(`${etiqueta} · 1.er clic: 1 documento (${contador}), hoja abierta=${e1.hojaAbierta}, nº=${primerNumero || '—'}, vista=${e1.vista}`);

    // ── Cerrar la hoja como lo haría el profesional, y volver a pulsar ───────────────────────
    if (cierre) {
      const rc = await pag.evaluate(PULSAR, cierre);
      await espera(600);
      if (rc === 'no-encontrado') informe.push(`${etiqueta} · «${cierre}» no estaba: se sigue sin cerrar la hoja`);
    }
    // El caso C cambia el presupuesto entre los dos clics: ahí el segundo documento es lo CORRECTO.
    if (modificar) {
      const hecho = await modificar(pag);
      if (!hecho) { ciegos.push(`${etiqueta} -> no pude cambiar el presupuesto entre los dos clics`); return; }
      informe.push(`${etiqueta} · entre los dos clics se cambió el precio de la línea`);
    }

    const r2 = await pag.evaluate(PULSAR, rotulo);
    await espera(1200);
    const e2 = await pag.evaluate(ESTADO);
    const tras2 = pedidos[contador];

    informe.push(`${etiqueta} · 2.º clic (${r2}): ${tras2} documento(s) en total, hoja abierta=${e2.hojaAbierta}, nº=${e2.numeroEnLaHoja || '—'}`);

    if (tras2 > limite) {
      mal.push(`pulsar «${rotulo}» dos veces sin tocar nada creó ${tras2} documentos (nº ${primerNumero} y ${e2.numeroEnLaHoja}); tiene que crear ${limite}`);
    }
    // 🔴 LA OTRA MITAD. Un arreglo que impida SIEMPRE el segundo documento es un defecto nuevo: si
    // el profesional cambia el presupuesto y vuelve a pulsar, quiere otro y tiene derecho a él.
    if (tras2 < limite) {
      mal.push(`tras cambiar el presupuesto, el segundo «${rotulo}» dejó ${tras2} documento(s) y tenían que ser ${limite}: el arreglo se ha pasado y ya no deja crear uno distinto`);
    }

    // Que no duplique no puede costar que el profesional PIERDA su documento: tras el segundo
    // clic tiene que seguir llegando a él, y al MISMO, no a otro.
    if (tras2 === limite && !suelto) {
      if (!e2.hojaAbierta) {
        mal.push(`no duplica, pero tras el segundo «${rotulo}» no hay forma de llegar al presupuesto: la hoja no está abierta`);
      } else if (!modificar && e2.numeroEnLaHoja && primerNumero && e2.numeroEnLaHoja !== primerNumero) {
        mal.push(`la hoja del segundo clic enseña el nº ${e2.numeroEnLaHoja} y el primero fue el ${primerNumero}: no es el mismo presupuesto`);
      } else if (modificar && e2.numeroEnLaHoja && e2.numeroEnLaHoja === primerNumero) {
        mal.push(`se cambió el presupuesto y la hoja sigue enseñando el nº ${primerNumero}: el segundo documento no es el que se está mirando`);
      }
    }

    if (errores.length) mal.push(`errores de página: ${errores.join(' | ')}`);
  } finally {
    if (mal.length) hallazgos.push({ etiqueta, mal });
    await contexto.close();
  }
}

// 🔴 LA POBLACIÓN SALE DE ESTA LISTA, NO DE UN NÚMERO ESCRITO ABAJO. La primera versión anunciaba
// «2 casos» en la cabecera y en el veredicto; al añadir el C siguió diciendo 2 y el guard estuvo
// mintiendo sobre su propio alcance mientras salía verde. Un instrumento que no deriva su población
// puede quedarse corto sin que nadie lo note.
const CASOS = [
  {
    suelto: false, etiqueta: 'A · presupuesto 1280px', rotulo: 'Generar presupuesto',
    cierre: 'Seguir editando', contador: 'presupuestos', limite: 1,
  },
  {
    suelto: true, etiqueta: 'B · justificante 1280px (control positivo)', rotulo: 'Emitir justificante',
    cierre: null, contador: 'facturas', limite: 1,
  },
  {
    suelto: false, etiqueta: 'C · presupuesto CAMBIADO 1280px (control negativo)', rotulo: 'Generar presupuesto',
    cierre: 'Seguir editando', contador: 'presupuestos', limite: 2,
    // Se vuelve a Conceptos como lo haría el profesional —«Cambiar» en el paso cerrado—, se cambia
    // el precio y se vuelve al último paso. NO se toca el DOM por dentro: si el camino de vuelta
    // se rompiera, este caso lo diría.
    modificar: async (pag) => {
      if (await pag.evaluate(PULSAR_EN_BLOQUE, 'Cambiar', 'Conceptos') !== 'pulsado') return false;
      await espera(400);
      if (!await teclear(pag, '.quote-line .quote-line__price input', '52')) return false;
      await pag.evaluate(new Function('if (document.activeElement && document.activeElement.blur) document.activeElement.blur();'));
      await espera(400);
      await pag.evaluate(PULSAR, 'Continuar');
      await espera(300);
      await pag.evaluate(PULSAR, 'Continuar');
      await espera(300);
      const e = await pag.evaluate(ESTADO);
      return !!(e.primario && e.primario.visible);
    },
  },
];

const srv = await arrancarServidor();
let navegador;
let corridos = 0;
try {
  navegador = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });
  for (const c of CASOS) { await caso(navegador, c); corridos += 1; }
} finally {
  if (navegador) await navegador.close();
  srv.close();
}

console.log('');
console.log('  SCRUM-965 · PULSAR DOS VECES NO CREA DOS DOCUMENTOS (peticiones contadas en el servidor)');
console.log(`  POBLACIÓN: ${CASOS.length} casos, ${corridos} corridos — ${CASOS.map((c) => c.etiqueta).join(' · ')}`);
for (const l of informe) console.log('   · ' + l);
if (corridos !== CASOS.length) ciegos.push(`sólo llegué a correr ${corridos} de ${CASOS.length} casos`);

if (ciegos.length) {
  console.error('\n  🔴 NO SUPE MEDIR — esto NO es «no duplica»:\n');
  for (const c of ciegos) console.error('     · ' + c);
  console.log('\nEXIT=' + SALIDA_NO_SUPE_MEDIR);
  process.exit(SALIDA_NO_SUPE_MEDIR);
}
if (hallazgos.length) {
  console.error(`\n  🔴 EN ${hallazgos.length} DE ${CASOS.length} CASOS EL NÚMERO DE DOCUMENTOS NO ES EL QUE TIENE QUE SER:\n`);
  for (const h of hallazgos) {
    console.error(`     [${h.etiqueta}]`);
    for (const x of h.mal) console.error('       · ' + x);
  }
  console.log('\nEXIT=' + SALIDA_HALLAZGO);
  process.exit(SALIDA_HALLAZGO);
}
console.log(`\n  ✔ en los ${CASOS.length} casos: se crea EXACTAMENTE el documento que toca —uno si no ha cambiado nada, otro si ha cambiado— y el profesional sigue llegando al suyo.\n`);
console.log('EXIT=0');
