// SCRUM-982 · LA NOTA DEL CLIENTE EN LA FICHA DEL TRABAJO, MEDIDA EN NAVEGADOR (Edge/Chrome real).
//
// Lo que pidió el orquestador (comentario 16065): «una nota larga, de varios párrafos, se lee entera
// y no rompe el rail a 360 px». Se mide sobre el DOM RENDERIZADO —tamaño real, cajas reales—, nunca
// sobre el CSS leído: una caja CSS no es lo que ocupa (A6).
//
// DOS ESTADOS, y por eso el instrumento se puede creer:
//   · DESPUÉS · la hoja de estilos del repo, tal cual.
//   · ANTES   · la MISMA hoja con las reglas de la nota QUITADAS (lo que se vería con sólo el cambio de
//               JS): es el CONTROL NEGATIVO. Si el instrumento no cae ahí, no ve el defecto y su verde
//               de DESPUÉS no vale nada («un cero de algo que no llegó a correr se lee igual que un
//               cero de algo que funciona», A21).
// La ficha la pinta el PRODUCTO (los mismos scripts de `dashboard/index.html`, en su orden); sólo se
// doblan las respuestas de `/admin/jobs/<id>`.
//
// Uso:  node docs/master/evidencias/scrum982/medir-nota-en-navegador.mjs   (desde la raíz del repo)
// Salidas: 0 = DESPUÉS pasa todo y ANTES cae · 1 = hallazgo o control ciego · 2/3 = no supe medir.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from '../../../../scripts/_navegador.mjs';
import { levantarBanco, pintarDetalle, JOB_A_MEDIAS } from '../../../../scripts/_detalle-917.mjs';
import { telefonoDePrueba } from '../../../../scripts/_telefonos-prueba.mjs'; // SCRUM-262

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ID_NOTA = 3982;          // ids que el banco no conoce: los sirve esta sonda, no el banco
const ID_SIN_NOTA = 3983;
const ANCHOS = [1280, 390, 360];

// La nota de prueba: varios párrafos, saltos dobles y una palabra larga (una URL) que es lo que
// ensancharía el rail si el texto no se partiera. 6 líneas «lógicas», 2 de ellas en blanco.
const NOTA = [
  'Timbre roto: llamar al móvil antes de subir.',
  '',
  'Perro suelto en el patio. Entrar por la puerta del garaje y esperar a que salga el dueño.',
  'Llaves de la azotea en la floristería de enfrente, preguntar por Marisol.',
  '',
  'https://maps.example.test/ruta/muy/larga/sin/espacios/que/no/se/puede/partir/por/una/palabra/0123456789',
].join('\n');
const LINEAS_LOGICAS = NOTA.split('\n').length;      // 6: se escribe a la vista, no se deduce del render
const COLA_DE_LA_NOTA = '0123456789';                // el último carácter visible que tiene que estar

const trabajo = (id, notes) => ({
  ...JOB_A_MEDIAS,
  id,
  customer: { id: 500 + id, name: 'Talleres Ortega SL', phone: telefonoDePrueba(982), email: null, notes },
});

let bien_ = 0; let mal_ = 0;
const log = [];
const salida = (s) => { log.push(s); console.log(s); };

/** Lo que se mide DENTRO de la página. Sin decidir nada: devuelve cajas y estilos calculados. */
async function medirNota(page) {
  return page.evaluate(() => {
    const lineas = [...document.querySelectorAll('.detail-rail-linea--nota')];
    const rail = document.querySelector('.detail-rail');
    const base = {
      lineasDeNota: lineas.length,
      rotuloEnPantalla: [...document.querySelectorAll('*')].some((n) => n.children.length === 0 && n.textContent.trim() === 'Nota del cliente'),
      vw: document.documentElement.clientWidth,
      scrollW: document.documentElement.scrollWidth,
      hayRail: !!rail,
    };
    if (!lineas.length || !rail) return base;
    const linea = lineas[0];
    const et = linea.querySelector('.detail-rail-etiqueta');
    const tx = [...linea.children].find((x) => x !== et);
    const caja = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height }; };
    const rango = document.createRange();
    rango.selectNodeContents(tx);
    const trozos = [...rango.getClientRects()];
    const csl = getComputedStyle(linea); const cst = getComputedStyle(tx);
    return {
      ...base,
      rail: { ...caja(rail), sw: rail.scrollWidth, cw: rail.clientWidth },
      linea: caja(linea), et: caja(et), tx: caja(tx),
      rotulo: et.textContent, texto: tx.textContent, textoPintado: tx.innerText,
      txScrollH: tx.scrollHeight, txClientH: tx.clientHeight,
      lineHeight: parseFloat(cst.lineHeight) || (parseFloat(cst.fontSize) * 1.2),
      finDelTexto: trozos.length ? Math.max(...trozos.map((r) => r.bottom)) : null,
      flexDirection: csl.flexDirection, whiteSpace: cst.whiteSpace, overflowWrap: cst.overflowWrap,
      overflowY: cst.overflowY, maxHeight: cst.maxHeight,
      enlaces: [...rail.querySelectorAll('a')].map((a) => { const b = a.getBoundingClientRect(); return { href: a.getAttribute('href'), h: b.height }; }),
    };
  });
}

/** Comprobaciones sobre UNA medida. Devuelve la lista de [ok, mensaje]. */
function juzgar(m, ancho) {
  const r = [];
  const c = (ok, msg) => r.push([!!ok, msg]);
  c(m.hayRail, 'la ficha pinta el rail');
  c(m.lineasDeNota === 1, `hay exactamente UNA línea de nota (hay ${m.lineasDeNota})`);
  if (m.lineasDeNota !== 1 || !m.rail) return r;
  c(m.rotulo === 'Nota del cliente', `el rótulo es el firmado («${m.rotulo}»)`);
  c(m.texto === NOTA, 'el texto pintado es la nota tal cual, sin recortar');
  c(m.flexDirection === 'column', `la etiqueta va en columna con el texto (flex-direction: ${m.flexDirection})`);
  c(m.et.b <= m.tx.t + 0.5, `la etiqueta va ENCIMA del texto (etiqueta.bottom ${m.et.b.toFixed(1)} ≤ texto.top ${m.tx.t.toFixed(1)})`);
  c(m.tx.l >= m.rail.l - 0.5 && m.tx.r <= m.rail.r + 0.5, `el texto cabe DENTRO del rail (${m.tx.l.toFixed(0)}–${m.tx.r.toFixed(0)} en ${m.rail.l.toFixed(0)}–${m.rail.r.toFixed(0)})`);
  c(m.rail.sw <= m.rail.cw + 0.5, `el rail no desborda (scrollWidth ${m.rail.sw} ≤ clientWidth ${m.rail.cw})`);
  c(m.scrollW <= m.vw + 0.5, `la página no tiene scroll horizontal a ${ancho} px (scrollWidth ${m.scrollW} ≤ ${m.vw})`);
  // Los saltos se respetan: la caja tiene sitio para las 6 líneas lógicas (las 2 en blanco también).
  c(m.tx.h >= LINEAS_LOGICAS * m.lineHeight - 1, `respeta los saltos: alto ${m.tx.h.toFixed(0)} ≥ ${LINEAS_LOGICAS} líneas × ${m.lineHeight.toFixed(1)} px`);
  // Entera: nada la recorta ni por CSS ni por caja.
  c(m.txScrollH <= m.txClientH + 1, `no hay contenido escondido (scrollHeight ${m.txScrollH} ≤ clientHeight ${m.txClientH})`);
  c(m.finDelTexto !== null && m.finDelTexto <= m.tx.b + 1, 'la última línea de texto cae dentro de su caja');
  c(m.maxHeight === 'none' && m.overflowY === 'visible', `sin max-height ni overflow (max-height ${m.maxHeight}, overflow-y ${m.overflowY})`);
  c(String(m.textoPintado).includes(COLA_DE_LA_NOTA), 'lo que se PINTA (innerText) llega hasta el último carácter de la nota');
  // No se rompe lo que ya había: el teléfono y el WhatsApp siguen siendo un blanco de 44 px.
  const tel = m.enlaces.filter((e) => /^(tel:|https:\/\/wa\.me)/.test(e.href || ''));
  c(tel.length === 2, `siguen los dos enlaces (teléfono y WhatsApp): ${tel.length}`);
  c(tel.every((e) => e.h >= 44 - 0.5), `los enlaces del rail miden ≥ 44 px (${tel.map((e) => e.h.toFixed(0)).join(', ')})`);
  return r;
}

async function medirEstado(nav, banco, etiqueta, sinReglasDeNota) {
  const css = fs.readFileSync(path.join(AQUI, '../../../../public/dashboard/css/styles.css'), 'utf8');
  // Quitar las reglas de la nota: son las tres líneas que empiezan por `.detail-rail-linea--nota`.
  const quitado = css.split('\n').filter((l) => !l.startsWith('.detail-rail-linea--nota'));
  const cuantas = css.split('\n').length - quitado.length;
  if (sinReglasDeNota && cuantas !== 3) throw new Error(`INSTRUMENTO: esperaba quitar 3 reglas de la nota y quité ${cuantas}`);
  if (!sinReglasDeNota && cuantas !== 3) throw new Error(`INSTRUMENTO: la hoja del repo no lleva las 3 reglas de la nota (${cuantas})`);
  const cssServido = sinReglasDeNota ? quitado.join('\n') : css;

  const resultados = [];
  for (const ancho of ANCHOS) {
    const page = await nav.newPage();
    await page.setViewport({ width: ancho, height: ancho >= 1000 ? 900 : 844 });
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const u = new URL(req.url());
      if (u.pathname.endsWith('/dashboard/css/styles.css')) return req.respond({ status: 200, contentType: 'text/css; charset=utf-8', body: cssServido });
      const m = u.pathname.match(/^\/admin\/jobs\/(\d+)$/);
      if (m && Number(m[1]) === ID_NOTA) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(trabajo(ID_NOTA, NOTA)) });
      if (m && Number(m[1]) === ID_SIN_NOTA) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(trabajo(ID_SIN_NOTA, null)) });
      return req.continue();
    });
    await page.goto(banco.base, { waitUntil: 'networkidle0' });

    // ── con nota ──
    const p = await pintarDetalle(page, ID_NOTA);
    if (!p.ok) throw new Error(`SUELO: la ficha no se pintó a ${ancho} px (${p.por})`);
    // El banco contesta `/admin/merchant` sin `onboardingCompleted`, así que el panel abre el asistente
    // de bienvenida ENCIMA de la ficha (lo cazó la primera captura: un modal tapando el rail). Un
    // profesional ya dado de alta no lo ve; aquí se quita para medir y fotografiar la ficha.
    await page.evaluate(() => { const b = document.getElementById('onboarding-backdrop'); if (b) b.remove(); });
    const m = await medirNota(page);
    const veredicto = juzgar(m, ancho);
    const rail = await page.$('.detail-rail');
    if (rail) await rail.screenshot({ path: path.join(AQUI, `nota-${etiqueta}-${ancho}.png`) });

    // ── sin nota (control) ──
    const q = await pintarDetalle(page, ID_SIN_NOTA);
    if (!q.ok) throw new Error(`SUELO: la ficha sin nota no se pintó a ${ancho} px (${q.por})`);
    const s = await medirNota(page);
    const ctl = [
      [s.hayRail, 'SUELO del control: sin nota la ficha SÍ pinta el rail'],
      [s.lineasDeNota === 0, `sin nota NO hay línea de nota (hay ${s.lineasDeNota})`],
      [s.rotuloEnPantalla === false, 'sin nota NO aparece el rótulo «Nota del cliente» en pantalla'],
    ];
    resultados.push({ ancho, medida: m, juicio: [...veredicto, ...ctl] });
    await page.close();
  }
  return resultados;
}

// ═══ ARRANQUE ═══════════════════════════════════════════════════════════════════════════
const banco = await levantarBanco();
let nav;
try { nav = await lanzarNavegador(puppeteer, { headless: 'new' }); } catch (e) {
  salida('🔴 no arrancó el navegador: ' + e.message); await banco.cerrar(); process.exit(3);
}
let caidasDespues = 0; let caidasAntes = 0; let total = 0;
const antesPorAncho = new Map(); // ancho → nº de comprobaciones que caen SIN las reglas de la nota
try {
  for (const [nombre, sinReglas] of [['despues', false], ['antes', true]]) {
    salida(`\n${'═'.repeat(94)}\n${nombre.toUpperCase()} · ${sinReglas ? 'hoja SIN las reglas de la nota (CONTROL NEGATIVO: el instrumento tiene que caer)' : 'hoja del repo'}\n${'═'.repeat(94)}`);
    const rs = await medirEstado(nav, banco, nombre, sinReglas);
    for (const { ancho, juicio } of rs) {
      salida(`\n· a ${ancho} px`);
      let caen = 0;
      for (const [ok, msg] of juicio) {
        total++;
        if (ok) { bien_++; salida('   ✅ ' + msg); } else { mal_++; caen++; if (sinReglas) caidasAntes++; else caidasDespues++; salida('   ❌ ' + msg); }
      }
      if (sinReglas) antesPorAncho.set(ancho, caen);
    }
  }
} catch (e) {
  salida('🔴 NO SUPE MEDIR: ' + e.message);
  await nav.close(); await banco.cerrar(); process.exit(2);
}
await nav.close();
await banco.cerrar();

salida(`\npoblación: ${total} comprobaciones · 2 estados (despues, antes) × ${ANCHOS.length} anchuras (${ANCHOS.join(', ')}) · nota de ${LINEAS_LOGICAS} líneas`);
salida(`DESPUÉS: ${caidasDespues} caídas (tiene que ser 0) · ANTES (control negativo): ${caidasAntes} caídas, por anchura ${JSON.stringify([...antesPorAncho])} (tiene que ser ≥ 1 en CADA una)`);
const controlCiego = ANCHOS.some((a) => !(antesPorAncho.get(a) >= 1));
if (controlCiego) salida('🔴 CONTROL CIEGO: sin las reglas de la nota el instrumento no cae en cada anchura; su verde de DESPUÉS no vale.');
const ok = caidasDespues === 0 && !controlCiego;
salida(ok ? 'RESULTADO: ✅ la nota se lee entera y el rail aguanta' : 'RESULTADO: ❌');
process.exit(ok ? 0 : 1);
