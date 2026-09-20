// SCRUM-917e · El DETALLE del Trabajo, medido en navegador contra el inventario del prototipo.
//
// Hermano de `guard-lista-trabajos-917.mjs` (917c, la lista). Las letras siguen la numeración de
// aquél a propósito: allí se usaron ⓪ A B C y G, y D/E/F quedaron LIBRES para el detalle.
//   D · la franja del dinero — SCRUM-917e (este corte)
//   E · la cabecera y «Lo que falta» — SCRUM-917f
//   F · «El trabajo» plegable — SCRUM-917g
// G · los 44 px y el scroll horizontal, en todos los cortes.
//
// 🔴 POR QUÉ EN NAVEGADOR Y NO SOBRE EL FUENTE: lo que este guard juzga es cuántas VECES aparece
// un importe en la pantalla pintada. En el fuente eso no se puede contar — el mismo importe sale
// de `fila()`, de un `innerHTML` con plantilla, de `progressBar()` en otro fichero y del rail en
// un tercero. Sólo el DOM resuelto sabe cuántas veces lo lee una persona.
//
// Salidas: 0 de acuerdo · 1 hallazgo · 2 no supe medir · 3 no arrancó el navegador.
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from './_navegador.mjs';
import { levantarBanco, pintarDetalle, CASOS, JOB_PAGADO, JOB_A_MEDIAS, JOB_SIN_PRESUPUESTO, JOB_COBRADO_DE_MAS } from './_detalle-917.mjs';

const ANCHOS = [1280, 390];
let bien_ = 0; let mal_ = 0; let suelo_ = 0;
const bien = (m) => { bien_++; console.log('   ✅ ' + m); };
const mal = (m) => { mal_++; console.log('   ❌ ' + m); };
const suelo = (m) => { suelo_++; console.log('   🟡 SUELO · ' + m); };
const titulo = (t) => {
  console.log('\n' + '═'.repeat(94));
  console.log(t);
  console.log('═'.repeat(94));
};

// 🔴 DOS TRAMPAS MEDIDAS HOY, las dos con forma de verde:
//  1. `Intl.NumberFormat('es-ES', currency)` no separa el número del € con un espacio normal, sino
//     con un ESPACIO FINO INSEPARABLE (U+202F; en otras versiones, U+00A0). Si el texto del DOM se
//     normaliza con `\s+ → ' '` y el patrón NO, no casan nunca y el censo dice **0 apariciones** —
//     que es exactamente lo que diría la pantalla ya arreglada. Aquí se normalizan LOS DOS LADOS.
//  2. `innerText` respeta `text-transform`, así que un rótulo escrito «Total aceptado» y pintado en
//     versalitas se lee «TOTAL ACEPTADO». Buscarlo tal cual da «ya no está» sobre una pantalla que
//     lo sigue enseñando. Lo que se compara con el DOM va sin distinguir mayúsculas.
// Las dos me dieron un verde falso en la primera pasada; las cazó que contradecían al PASO 0.
const normalizar = (s) => String(s).replace(/[   ]/g, ' ').replace(/\s+/g, ' ').trim();
const eur = (n) => normalizar(new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n));

// Lo que el inventario del prototipo dice que tiene que quedar, caso a caso. Se escribe aquí y no
// se deduce dentro del bucle: un esperado calculado con la misma cuenta que el sujeto no comprueba
// nada. (docs/prototipos/SCRUM-917/trabajos.html:458-465 es la franja literal.)
const ESPERADO = new Map([
  [JOB_PAGADO.id, {
    nombre: 'PAGADO (aceptado = cobrado = 590,00 €)',
    franja: true,
    rotulo: 'Cobrado del todo',          // no falta nada: no se dice «Te falta por cobrar 0,00 €»
    grande: eur(590),                    // con la deuda a cero, la cifra grande es el total
    aceptado: eur(590),
    cobrado: eur(590),
    // La franja dice 590 tres veces (grande + Aceptado + Cobrado) y NADIE MÁS puede decirlo.
    // Hoy son SIETE, medidas: docs/master/evidencias/SCRUM-917/salida-paso0-detalle.txt
    vecesAceptado: 3,
    aviso887: false,
  }],
  [JOB_A_MEDIAS.id, {
    nombre: 'A MEDIAS (aceptado 417,45 € · cobrado 100,00 €)',
    franja: true,
    rotulo: 'Te falta por cobrar',
    grande: eur(317.45),
    aceptado: eur(417.45),
    cobrado: eur(100),
    vecesAceptado: 1,                    // sólo el «Aceptado» de al lado; la grande es lo que falta
    aviso887: false,
  }],
  [JOB_SIN_PRESUPUESTO.id, {
    nombre: 'SIN PRESUPUESTO (no hay importe de referencia)',
    franja: false,                       // sin eje de cobro NO se afirma nada: SCRUM-363/651
    vecesAceptado: 0,
    aviso887: false,
  }],
  [JOB_COBRADO_DE_MAS.id, {
    nombre: 'COBRADO DE MÁS (aceptado 539,05 € · cobrado 628,60 €)',
    franja: true,
    rotulo: 'Cobrado del todo',
    grande: eur(539.05),
    aceptado: eur(539.05),
    cobrado: eur(628.60),
    vecesAceptado: 3,
    aviso887: true,                      // el literal de SCRUM-887 NO puede perderse por el camino
  }],
]);

const banco = await levantarBanco();
let nav;
try {
  nav = await lanzarNavegador(puppeteer, { headless: 'new' });
} catch (e) {
  console.log('🔴 no arrancó el navegador: ' + e.message);
  await banco.cerrar();
  process.exit(3);
}

// Control de discriminación: cuatro Trabajos distintos tienen que pintar cuatro pantallas
// distintas. 🔴 Va ANTES de leer ningún resultado, y existe porque hoy me tragué su ausencia: con
// un banco que contestaba lo mismo a todo, los tres casos salieron idénticos y los que no eran el
// primero dijeron «0 veces» de sus propios importes — que es EXACTAMENTE lo que diría una pantalla
// ya arreglada. Un instrumento que no distingue sus casos no está midiendo, está repitiendo.
const huellas = new Map();

for (const ancho of ANCHOS) {
  titulo(`⓪ SUELO y control de discriminación · a ${ancho} px`);
  const page = await nav.newPage();
  await page.setViewport({ width: ancho, height: ancho === 390 ? 844 : 900 });
  await page.goto(banco.base, { waitUntil: 'networkidle0' });

  const medidas = new Map();
  for (const caso of CASOS) {
    const t = await pintarDetalle(page, caso.id);
    if (!t.ok) { suelo(`el Trabajo ${caso.id} no se pintó (${t.por})`); continue; }

    const m = await page.evaluate((datos) => {
      const c = document.getElementById('view');
      // La MISMA normalización que usa el patrón, o el censo compara dos alfabetos distintos.
      const norm = (s) => String(s).replace(/[   ]/g, ' ').replace(/\s+/g, ' ').trim();
      const txt = (e) => (e ? norm(e.textContent) : null);
      const texto = norm(c.innerText);
      const cuenta = (s) => (s ? texto.split(s).length - 1 : 0);

      const franja = c.querySelector('.detail-dinero');
      const controles = [...c.querySelectorAll('button, a, input, select, textarea, [role="button"]')]
        .filter((e) => e.getClientRects().length);

      return {
        huella: texto,
        nodos: c.querySelectorAll('*').length,
        hayFranja: !!franja,
        franjas: c.querySelectorAll('.detail-dinero').length,
        rotulo: txt(c.querySelector('.detail-dinero__rotulo')),
        grande: txt(c.querySelector('.detail-dinero__grande')),
        lados: [...c.querySelectorAll('.detail-dinero__lado')].map((e) => txt(e)),
        vecesAceptado: cuenta(datos.aceptado),
        // Lo que el rediseño RETIRA, cada uno con su nombre para que el rojo diga cuál sigue vivo.
        // 🔴 SIN DISTINGUIR MAYÚSCULAS: `.detail-total-label` va en versalitas por CSS y `innerText`
        // respeta `text-transform`, así que el literal «Total aceptado» se lee «TOTAL ACEPTADO».
        titularViejo: /total aceptado/i.test(texto),
        barraConTexto: /cobrado\s+[\d.,]+\s*€\s+de\s+[\d.,]+\s*€/i.test(texto),
        railDinero: [...c.querySelectorAll('.detail-rail-bloque')].some((e) => /^dinero/i.test(txt(e) || '')),
        faltaCero: /te falta por cobrar 0,00/i.test(texto),
        // Lo que NO se puede perder.
        aviso887: /Has cobrado .* más de lo aceptado\./.test(texto),
        pequenos: controles.filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44);
        }).length,
        controles: controles.length,
        desborda: c.scrollWidth > c.clientWidth,
      };
    }, { aceptado: ESPERADO.get(caso.id).aceptado || '' });

    const clave = `${ancho}|${m.huella}`;
    if (huellas.has(clave)) {
      suelo(`el Trabajo ${caso.id} pinta LO MISMO que ${huellas.get(clave)}: el banco no distingue sus casos, no juzgo nada de él`);
      continue;
    }
    huellas.set(clave, `el Trabajo ${caso.id}`);
    medidas.set(caso.id, m);
  }

  if (medidas.size !== CASOS.length) {
    suelo(`sólo ${medidas.size} de ${CASOS.length} casos medibles a ${ancho} px`);
  } else {
    bien(`⓪ los ${CASOS.length} casos se pintan y son DISTINTOS entre sí a ${ancho} px`);
  }

  titulo(`D · el dinero se dice UNA vez: la franja (D.1-D.5) · lo que se retira (D.6-D.9) · lo que no se pierde (D.10) — a ${ancho} px`);
  for (const caso of CASOS) {
    const m = medidas.get(caso.id);
    const e = ESPERADO.get(caso.id);
    if (!m) continue;
    const q = `[${e.nombre}]`;

    // D.1 · hay UNA franja, y sólo cuando hay importe de referencia.
    if (m.hayFranja === e.franja && m.franjas <= 1) {
      bien(`D.1 ${q} franja ${e.franja ? 'presente y única' : 'ausente, como debe (sin eje de cobro no se afirma nada)'}`);
    } else {
      mal(`D.1 ${q} esperaba franja=${e.franja} y una sola; hay ${m.franjas}`);
    }

    if (e.franja) {
      // D.2 · el rótulo dice la verdad del caso.
      if (m.rotulo === e.rotulo) bien(`D.2 ${q} rótulo «${m.rotulo}»`);
      else mal(`D.2 ${q} rótulo «${m.rotulo}», esperaba «${e.rotulo}»`);

      // D.3 · la cifra grande es lo que falta (o el total si no falta nada).
      if (m.grande === e.grande) bien(`D.3 ${q} cifra grande «${m.grande}»`);
      else mal(`D.3 ${q} cifra grande «${m.grande}», esperaba «${e.grande}»`);

      // D.4 · al lado, Aceptado y Cobrado, una vez cada uno y en ese orden.
      const esperados = [`Aceptado ${e.aceptado}`, `Cobrado ${e.cobrado}`];
      if (JSON.stringify(m.lados) === JSON.stringify(esperados)) bien(`D.4 ${q} al lado: ${m.lados.join(' · ')}`);
      else mal(`D.4 ${q} al lado ${JSON.stringify(m.lados)}, esperaba ${JSON.stringify(esperados)}`);
    }

    // D.5 · EL CENSO, que es el ticket entero: cuántas veces se lee el importe aceptado.
    if (m.vecesAceptado === e.vecesAceptado) {
      bien(`D.5 ${q} «${e.aceptado || '—'}» se lee ${m.vecesAceptado} ${m.vecesAceptado === 1 ? 'vez' : 'veces'}`);
    } else {
      mal(`D.5 ${q} «${e.aceptado || '—'}» se lee ${m.vecesAceptado} veces, el inventario dice ${e.vecesAceptado}`);
    }

    // D.6-D.9 · lo que el rediseño retira porque ya lo dice la franja.
    if (!m.titularViejo) bien(`D.6 ${q} el titular «Total aceptado» ya no está`);
    else mal(`D.6 ${q} sigue el titular «Total aceptado» a 2,2 rem: la franja ya lo dice`);

    if (!m.barraConTexto) bien(`D.7 ${q} la barra no repite «Cobrado X de Y»`);
    else mal(`D.7 ${q} la barra sigue diciendo «Cobrado X de Y»: son dos cifras que la franja ya dio`);

    if (!m.railDinero) bien(`D.8 ${q} el rail ya no lleva bloque DINERO`);
    else mal(`D.8 ${q} el rail sigue con su bloque DINERO: la misma verdad dicha dos veces`);

    if (!m.faltaCero) bien(`D.9 ${q} no se dice «Te falta por cobrar 0,00 €»`);
    else mal(`D.9 ${q} sigue diciendo «Te falta por cobrar 0,00 €» en un Trabajo que no debe nada`);

    // D.10 · CONTROL DE NO-PÉRDIDA. El literal de SCRUM-887 está firmado y pintado desde antes de
    // este ticket. Si la franja nueva se lo come, el rojo tiene que ser ruidoso.
    if (m.aviso887 === e.aviso887) {
      bien(`D.10 ${q} el aviso firmado de SCRUM-887 ${e.aviso887 ? 'sigue en pantalla' : 'no se pinta, y no toca'}`);
    } else {
      mal(`D.10 ${q} el aviso de SCRUM-887 ${m.aviso887 ? 'aparece donde no toca' : '🔴 HA DESAPARECIDO'} (esperaba ${e.aviso887})`);
    }
  }

  titulo(`G · todo control a ≥ 44 px (G.2) y sin scroll horizontal (G.1) — a ${ancho} px`);
  for (const caso of CASOS) {
    const m = medidas.get(caso.id);
    if (!m) continue;
    const q = `[${ESPERADO.get(caso.id).nombre}]`;
    if (!m.desborda) bien(`G.1 ${q} sin scroll horizontal`);
    else mal(`G.1 ${q} la pantalla desborda a lo ancho`);
    if (m.pequenos === 0) bien(`G.2 ${q} 0 de ${m.controles} controles por debajo de 44 px`);
    else mal(`G.2 ${q} ${m.pequenos} de ${m.controles} controles por debajo de 44 px`);
  }

  await page.close();
}

await nav.close();
await banco.cerrar();

const total = bien_ + mal_;
console.log(`\npoblación: ${total} comprobaciones sobre ${CASOS.length} casos × ${ANCHOS.length} anchuras (${ANCHOS.join(', ')}) · ${suelo_} no medidas`);
if (suelo_) { console.log(`🟡 ${suelo_} cosas no supe medir: no doy veredicto.`); process.exit(2); }
if (mal_) { console.log(`❌ el detalle NO cuadra con su inventario: ${bien_} de ${total}.`); process.exit(1); }
console.log(`✅ el detalle cuadra con su inventario: ${bien_} de ${total}.`);
