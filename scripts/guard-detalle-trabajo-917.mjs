// SCRUM-917e · El DETALLE del Trabajo, medido en navegador contra el inventario del prototipo.
//
// Hermano de `guard-lista-trabajos-917.mjs` (917c, la lista). Las letras siguen la numeración de
// aquél a propósito: allí se usaron ⓪ A B C y G, y D/E/F quedaron LIBRES para el detalle.
//   D · la franja del dinero — SCRUM-917e (este corte)
//   E · la cabecera y «Lo que falta» — SCRUM-917f
//   F · «El trabajo» plegable — SCRUM-917g (este corte, más abajo: lleva sus propios casos)
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
import {
  levantarBanco, pintarDetalle, CASOS, JOB_PAGADO, JOB_A_MEDIAS, JOB_SIN_PRESUPUESTO, JOB_COBRADO_DE_MAS,
  JOB_CON_EQUIPO, JOB_UN_GASTO,
} from './_detalle-917.mjs';

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
    // La franja dice 590 tres veces (grande + Aceptado + Cobrado). La cuarta es el HUECO
    // («590,00 € facturados sin cobrar»), y ésa la quita el corte E — el prototipo lo dice con
    // todas las letras: «Lo que falta» NO repite la cifra que la franja acaba de decir
    // (trabajos.html:423-426). Hoy son SIETE, medidas en el PASO 0.
    vecesAceptado: 4,
    metaFinalE: 3,
    aviso887: false,
  }],
  [JOB_A_MEDIAS.id, {
    nombre: 'A MEDIAS (aceptado 417,45 € · cobrado 100,00 €)',
    franja: true,
    rotulo: 'Te falta por cobrar',
    grande: eur(317.45),
    aceptado: eur(417.45),
    cobrado: eur(100),
    // El «Aceptado» de al lado (la grande es lo que falta, 317,45 €) + el hueco «417,45 €
    // aceptados y sin facturar», que se va en E.
    vecesAceptado: 2,
    metaFinalE: 1,
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

// 🔴 ALLOWLIST VISIBLE · la deuda de 44 px que el detalle YA tenía antes de SCRUM-917e.
// Medida hoy sobre el árbol SIN TOCAR (PASO 0), no heredada de ningún documento. No la arregla
// este corte; está aquí para que no pueda empeorar y para que no baje sin que alguien lo diga.
// Reportada al orquestador el 20-sep-2026 como hallazgo aparte (A23 #1).
// Un número por línea, que dos tickets no choquen en la misma línea física (A23 #15).
// SCRUM-917h (21-sep-2026) · 8 → 7 en los tres casos con presupuesto: sale el enlace de fecha del
// rail («1 sept», 35,8×44 en Windows), que ahora lleva `min-width: 44px`. No es la deuda que
// «baja sola»: medía 8 en Windows y 7 en el runner de Linux sobre el MISMO árbol, porque su ancho
// dependía de la fuente. Arreglado el ancho, las dos máquinas dicen 7. El caso sin presupuesto no
// tiene ese enlace y sigue en 6.
// MERGE 917g × SCRUM-962 (22-sep-2026) — la cifra se REGENERA, no se elige de ningún lado
// ([[feedback_cifra_derivada_en_merge]]): 917g quita la casilla «Incluir precios en el parte» de
// esta barra (com. 16142) justo en el control que SCRUM-962 había arreglado con `min-height:44px`
// en `valoradoLabel`; con la casilla fuera, ese control ya no existe y no puede seguir sumando a
// la deuda. Los otros arreglos de SCRUM-962 (miga `.detail-miga-link`, «Abrir en mapa»
// `.detail-rail-enlace--suelto`, los `.btn-sm` de la barra vía `.job-toolbar-btn-44`) siguen en
// pie sin tocar por este corte. Números medidos sobre el árbol YA fusionado, no deducidos:
const DEUDA_44PX = new Map([
  [JOB_PAGADO.id, 0],
  [JOB_A_MEDIAS.id, 0],
  [JOB_SIN_PRESUPUESTO.id, 0],
  [JOB_COBRADO_DE_MAS.id, 0],
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
        // Lo que se comprueba NO es «el bloque DINERO ya no existe» —eso saldría verde solo, porque
        // estos cuatro Trabajos no tienen justificantes y el bloque se devuelve `null` cuando se
        // queda sin líneas—, sino la afirmación de verdad: el rail ya no repite las cifras de la
        // franja. Un aserto que se cumple por la forma del fixture no comprueba nada (A23 #13).
        railRepiteCifras: [...c.querySelectorAll('.detail-rail-linea')]
          .map((e) => txt(e) || '')
          .filter((t) => /^(Cobrado|Pendiente)\b/.test(t)),
        faltaCero: /te falta por cobrar 0,00/i.test(texto),
        // Lo que NO se puede perder.
        aviso887: /Has cobrado .* más de lo aceptado\./.test(texto),
        pequenos: controles.filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44);
        }).length,
        // Los pequeños CON NOMBRE y tamaño: el rojo de abajo pide «di CUÁL», y un instrumento que
        // sólo sabe dar la cuenta no puede contestarlo. Medido 21-sep-2026: en el runner de CI
        // salían 7 y en Windows 8 sobre el MISMO árbol, y sin nombres no había forma de saber cuál.
        listaPequenos: controles.filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44);
        }).map((e) => {
          const r = e.getBoundingClientRect();
          const nombre = norm(e.textContent || e.getAttribute('aria-label') || '').slice(0, 30);
          return `${e.tagName.toLowerCase()}«${nombre}» ${r.width.toFixed(1)}×${r.height.toFixed(1)}`;
        }),
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
    // ⚠️ El número de aquí es el de ESTE corte, no el del rediseño terminado, y la diferencia se
    // dice en voz alta en vez de esconderse: lo que falta por bajar es el importe que todavía
    // repite el HUECO, y eso lo quita el corte E. Dejar sólo el objetivo final habría hecho un
    // guard que no puede estar verde nunca; dejar sólo el de hoy habría perdido la meta.
    if (m.vecesAceptado === e.vecesAceptado) {
      const pend = e.metaFinalE != null && e.metaFinalE !== e.vecesAceptado
        ? ` (E lo bajará a ${e.metaFinalE}: el hueco no debe repetir la cifra de la franja)` : '';
      bien(`D.5 ${q} «${e.aceptado || '—'}» se lee ${m.vecesAceptado} ${m.vecesAceptado === 1 ? 'vez' : 'veces'}${pend}`);
    } else {
      mal(`D.5 ${q} «${e.aceptado || '—'}» se lee ${m.vecesAceptado} veces, este corte exige ${e.vecesAceptado}`);
    }

    // D.6-D.9 · lo que el rediseño retira porque ya lo dice la franja.
    if (!m.titularViejo) bien(`D.6 ${q} el titular «Total aceptado» ya no está`);
    else mal(`D.6 ${q} sigue el titular «Total aceptado» a 2,2 rem: la franja ya lo dice`);

    if (!m.barraConTexto) bien(`D.7 ${q} la barra no repite «Cobrado X de Y»`);
    else mal(`D.7 ${q} la barra sigue diciendo «Cobrado X de Y»: son dos cifras que la franja ya dio`);

    if (!m.railRepiteCifras.length) bien(`D.8 ${q} el rail no repite ninguna cifra de la franja`);
    else mal(`D.8 ${q} el rail repite cifras que la franja ya dio: ${m.railRepiteCifras.join(' · ')}`);

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

    // G.2 · 🔴 DEUDA HEREDADA, DECLARADA, Y CON TRINQUETE — no un verde.
    // El detalle YA incumplía los 44 px de AB6 antes de este ticket: el PASO 0 de hoy, sobre el
    // árbol sin tocar, midió los MISMOS 8 de 14 (6 de 9 en el caso pobre). Ver
    // `docs/master/evidencias/SCRUM-917/salida-paso0-detalle.txt`.
    // Este corte no lo arregla y no finge lo contrario: una excepción silenciosa convierte un
    // fallo en una característica (A23 #14), así que va en una ALLOWLIST visible, con su número.
    // Las DOS mitades (A23 #7), porque un trinquete con una sola no sirve:
    //   · no SUBE  → si alguien mete un control pequeño más, rojo;
    //   · no BAJA en silencio → si baja, también rojo, porque una mejora que nadie ha hecho es un
    //     instrumento roto hasta que se demuestre lo contrario, y aquí bajaría solo si el guard
    //     dejara de ver controles.
    const techo = DEUDA_44PX.get(caso.id);
    if (m.pequenos !== techo) console.log(`      pequeños ${q}: ${m.listaPequenos.join(' · ')}`);
    if (m.pequenos === 0) {
      bien(`G.2 ${q} 0 de ${m.controles} controles por debajo de 44 px`);
    } else if (m.pequenos === techo) {
      bien(`G.2 ${q} ${m.pequenos} de ${m.controles} por debajo de 44 px — DEUDA HEREDADA declarada, ni sube ni baja`);
    } else if (m.pequenos > techo) {
      mal(`G.2 ${q} ${m.pequenos} de ${m.controles} por debajo de 44 px: SUBE desde ${techo}. Este corte ha metido controles pequeños nuevos`);
    } else {
      mal(`G.2 ${q} ${m.pequenos} de ${m.controles} por debajo de 44 px: BAJA desde ${techo} sin que nadie lo haya arreglado. Di CUÁL y por qué, y baja el número a mano`);
    }
  }

  await page.close();
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// F · «EL TRABAJO» PLEGABLE — SCRUM-917g
//
// Cinco secciones sueltas (Tipo · Datos · Quién ejecuta · Notas · Gastos, cada una con su cabecera y
// todas bajo el pliegue a 390 px: `salida-paso0-detalle-f.txt`) pasan a cinco LÍNEAS de una tarjeta,
// cerradas, cada una con su valor a la derecha. Lo que se juzga es lo que dice cada línea CERRADA
// —que es una decisión, no un adorno— y lo que hay dentro al ABRIRLA: una captura bonita no prueba
// que el botón funcione (A6), así que aquí se pulsa y se mide el estado de después.
//
// 🔴 CINCO CASOS, no cuatro, y por una razón: «No tienes equipo», «Sin asignar» y «no se pudo leer
// el equipo» son tres cosas DISTINTAS que se ven iguales en un banco que sólo sirve un equipo. El
// primer banco de este guard contestaba `[]` para «sin equipo» y la pantalla tomaba el camino del
// error: ningún caso llegaba a medir la línea que decía medir. Por eso hay un banco por situación, y
// el control de discriminación de abajo exige que se pinten cosas distintas ANTES de juzgar nada.
const LINEAS_F = [
  ['tipo', 'Tipo de trabajo'],
  ['datos', 'Nombre y dirección'],
  ['quien', 'Quién lo ejecuta'],
  ['notas', 'Notas internas'],
  ['gastos', 'Gastos de este trabajo'],
];
const T_TIPO_UNICO = 'Una obra o reforma de varios días';
const T_TIPO_SUELTAS = 'Varios avisos o visitas sueltas';
const T_MARCADOR_NOMBRE = 'Por ejemplo: cambio de cuadro en el 3º B';
const T_AYUDA_NOMBRE = 'El nombre es lo que verás en la lista. Si lo dejas vacío, se usa el del cliente.';
const T_MARCADOR_NOTAS = 'Lo que necesites recordar de este trabajo.';

// Lo que tiene que decir cada línea CERRADA y lo que tiene que haber DENTRO al abrirla. Escrito aquí
// y no deducido del sujeto: un esperado calculado con la misma cuenta que la pantalla no comprueba
// nada (A23 #13).
const CASOS_DE_F = [
  {
    etiqueta: 'SIN EQUIPO · sin nombre · 0 gastos', banco: 'solo', job: JOB_PAGADO,
    cerrada: { tipo: T_TIPO_UNICO, datos: 'Sin nombre', quien: 'No tienes equipo', notas: 'Solo tú las ves', gastos: 'Sin gastos' },
    dentro: { quien: { botonAlta: true, nota: 'Todavía no has dado de alta a nadie en tu equipo' }, gastos: { filas: 0, vacio: 'Todavía no hay gastos en este trabajo.' } },
    sheet: true,
  },
  {
    etiqueta: 'CON EQUIPO · nombre propio · 2 técnicos · 2 gastos', banco: 'equipo', job: JOB_CON_EQUIPO,
    cerrada: { tipo: T_TIPO_SUELTAS, datos: 'Cambio de cuadro en el 3º B', quien: 'Javier P. y Lucía M.', notas: 'Solo tú las ves', gastos: '2 gastos' },
    dentro: { quien: { casillas: ['Javier P.', 'Lucía M.'] }, gastos: { filas: 2 } },
  },
  {
    etiqueta: 'CON EQUIPO · nadie asignado · 1 gasto', banco: 'equipo', job: JOB_UN_GASTO,
    cerrada: { tipo: T_TIPO_SUELTAS, datos: 'Sin nombre', quien: 'Sin asignar', notas: 'Solo tú las ves', gastos: '1 gasto' },
    dentro: { quien: { casillas: ['Javier P.', 'Lucía M.'] }, gastos: { filas: 1 } },
  },
  {
    etiqueta: 'TÉCNICO · sólo lectura', banco: 'tecnico', job: JOB_CON_EQUIPO, tecnico: true,
    cerrada: { tipo: T_TIPO_SUELTAS, datos: 'Cambio de cuadro en el 3º B', quien: 'Javier P. y Lucía M.', notas: 'Solo tú las ves', gastos: '2 gastos' },
    dentro: { quien: { casillas: [], nota: 'Solo un administrador puede cambiar quién ejecuta este trabajo' }, gastos: { filas: 2 } },
  },
  {
    etiqueta: 'EQUIPO ILEGIBLE (la lista llegó vacía)', banco: 'ciego', job: JOB_PAGADO,
    // Sin selector que abrir la línea NO es un control: dice su valor —ninguno, no se sabe— y no se abre.
    cerrada: { tipo: T_TIPO_UNICO, datos: 'Sin nombre', quien: '', notas: 'Solo tú las ves', gastos: 'Sin gastos' },
    dentro: { quien: { fija: true }, gastos: { filas: 0, vacio: 'Todavía no hay gastos en este trabajo.' } },
  },
];

const bancosF = {
  solo: banco, // el de arriba: `[propietario]`, un negocio de una sola persona
  equipo: await levantarBanco({ conEquipo: true }),
  tecnico: await levantarBanco({ conEquipo: true, rol: 'tecnico' }),
  ciego: await levantarBanco({ equipoCiego: true }),
};

const huellasF = new Map();
for (const ancho of ANCHOS) {
  titulo(`F · «El trabajo» plegable: tarjeta única (F.1) · cerradas (F.2) · lo que dice cada línea (F.3) · 44 px y sin desbordar (F.4) · lo que se retira (F.5) · la casilla de precios (F.6) · al ABRIR (F.7) — a ${ancho} px`);
  for (const caso of CASOS_DE_F) {
    const q = `[${caso.etiqueta}]`;
    const page = await nav.newPage();
    await page.setViewport({ width: ancho, height: ancho === 390 ? 844 : 900 });
    await page.goto(bancosF[caso.banco].base, { waitUntil: 'networkidle0' });
    const t = await pintarDetalle(page, caso.job.id);
    if (!t.ok) { suelo(`F ${q} el Trabajo ${caso.job.id} no se pintó (${t.por})`); await page.close(); continue; }
    // Lo que se ve con todas las líneas CERRADAS. Devuelve datos; quien lo llama juzga.
    // ⚠️ El cuerpo va EN LA LLAMADA y no como función con nombre que se pasa a `page.evaluate`: el censo de
    // identificadores sin declarar (SCRUM-258) reconoce un cuerpo de navegador por estar DENTRO de una
    // llamada `.evaluate(…)`. Pasado por nombre, `document` y `KeyboardEvent` parecían nombres inexistentes
    // y el censo subía de 2 a 4. Lo mismo vale para las otras dos medidas de este bloque.
    const m = await page.evaluate(() => {
      const c = document.getElementById('view');
      const norm = (s) => String(s).replace(/[   ]/g, ' ').replace(/\s+/g, ' ').trim();
      const tarjetas = [...c.querySelectorAll('.detail-trabajo')];
      const tarjeta = tarjetas[0] || null;
      const tit = tarjeta ? tarjeta.querySelector('.detail-section-title') : null;
      const lineas = [...c.querySelectorAll('details.detail-plega')].map((d) => {
        const cab = d.querySelector('summary');
        return {
          clave: d.dataset.linea,
          rotulo: cab ? norm(cab.querySelector('.detail-plega-rotulo').textContent) : null,
          valor: cab ? norm(cab.querySelector('.detail-plega-valor').textContent) : null,
          abierta: d.open,
          alto: cab ? Math.round(cab.getBoundingClientRect().height * 10) / 10 : 0,
          fija: d.classList.contains('detail-plega--fija'),
          enLaTarjeta: !!(tarjeta && tarjeta.contains(d)),
        };
      });
      const titulosSueltos = [...c.querySelectorAll('.detail-section-title')].map((e) => norm(e.textContent))
        .filter((t) => ['Tipo de trabajo', 'Datos', 'Gastos de este trabajo', 'Notas internas'].includes(t));
      const preciosEn = (raiz) => [...raiz.querySelectorAll('label')].filter((l) => /Incluir precios en el parte/.test(l.textContent)).length;
      const barra = c.querySelector('.job-doc-toolbar');
      return {
        tarjetas: tarjetas.length,
        titulo: tit ? norm(tit.textContent) : null,
        lineas,
        titulosSueltos,
        tituloAsignadosDuplicado: c.querySelectorAll('.job-asignados-titulo').length,
        cambiarTipo: [...c.querySelectorAll('button')].filter((b) => norm(b.textContent) === 'Cambiar').length,
        preciosEnBarra: barra ? preciosEn(barra) : -1,
        preciosEnPantalla: preciosEn(c),
        desbordaTarjeta: tarjeta ? tarjeta.scrollWidth > tarjeta.clientWidth : null,
      };
    });

    // ⓪ control de discriminación: dos casos SIN el mismo perfil no pueden pintar lo mismo. El
    // técnico comparte trabajo con el caso «con equipo» a propósito (mide otro rol), así que sólo
    // cuenta contra los que no son él.
    if (!caso.tecnico) {
      const clave = `${ancho}|${m.lineas.map((l) => l.valor).join('|')}`;
      if (huellasF.has(clave)) {
        suelo(`F ${q} pinta LO MISMO que ${huellasF.get(clave)}: el banco no distingue sus casos, no juzgo nada de él`);
        await page.close();
        continue;
      }
      huellasF.set(clave, caso.etiqueta);
    }

    // F.1 · UNA tarjeta «El trabajo» con las cinco líneas, en el orden del prototipo.
    const orden = m.lineas.map((l) => l.rotulo);
    const ordenEsperado = LINEAS_F.map(([, r]) => r);
    if (m.tarjetas === 1 && m.titulo === 'El trabajo' && JSON.stringify(orden) === JSON.stringify(ordenEsperado) && m.lineas.every((l) => l.enLaTarjeta)) {
      bien(`F.1 ${q} una tarjeta «El trabajo» con sus cinco líneas en orden`);
    } else {
      mal(`F.1 ${q} tarjetas=${m.tarjetas} título=«${m.titulo}» líneas=${JSON.stringify(orden)} (esperaba UNA tarjeta «El trabajo» y ${JSON.stringify(ordenEsperado)})`);
    }

    // F.2 · TODAS cerradas: abrirlas es decisión de quien mira.
    const abiertas = m.lineas.filter((l) => l.abierta).map((l) => l.rotulo);
    if (!abiertas.length && m.lineas.length === LINEAS_F.length) bien(`F.2 ${q} las cinco líneas se pintan cerradas`);
    else mal(`F.2 ${q} líneas abiertas al cargar: ${JSON.stringify(abiertas)} (de ${m.lineas.length})`);

    // F.3 · lo que dice cada línea CERRADA. Es el corazón del corte: el valor a la derecha existe para
    // que no haga falta abrirla.
    for (const [clave, rotulo] of LINEAS_F) {
      const l = m.lineas.find((x) => x.clave === clave);
      const esperado = caso.cerrada[clave];
      if (l && l.valor === esperado) bien(`F.3 ${q} «${rotulo}» dice «${l.valor}»${esperado === '' ? ' (nada: no se sabe)' : ''}`);
      else mal(`F.3 ${q} «${rotulo}» dice «${l ? l.valor : '—'}», esperaba «${esperado}»`);
    }

    // F.4 · cada encabezado es una zona de toque de ≥ 44 px (AB6) y la tarjeta no desborda.
    const bajas = m.lineas.filter((l) => l.alto < 44).map((l) => `${l.rotulo} ${l.alto}`);
    if (!bajas.length && m.lineas.length) bien(`F.4 ${q} las cinco cabeceras miden ≥ 44 px (${m.lineas.map((l) => l.alto).join(' · ')})`);
    else mal(`F.4 ${q} cabeceras por debajo de 44 px: ${bajas.join(' · ') || 'no hay líneas que medir'}`);
    if (m.desbordaTarjeta === false) bien(`F.4 ${q} la tarjeta no desborda a lo ancho`);
    else mal(`F.4 ${q} la tarjeta desborda a lo ancho (scrollWidth > clientWidth)`);

    // F.5 · lo que se RETIRA: ni cabeceras sueltas, ni «Cambiar» del tipo, ni el rótulo del selector
    // repetido dentro de su línea.
    if (!m.titulosSueltos.length && m.cambiarTipo === 0 && m.tituloAsignadosDuplicado === 0) bien(`F.5 ${q} no queda ninguna cabecera suelta, ni «Cambiar», ni el rótulo de quién ejecuta repetido`);
    else mal(`F.5 ${q} sigue vivo lo que F retira: cabeceras sueltas ${JSON.stringify(m.titulosSueltos)} · «Cambiar» ×${m.cambiarTipo} · rótulo del selector repetido ×${m.tituloAsignadosDuplicado}`);

    // F.7 · ESTADO DESPUÉS DE PULSAR: se abre cada línea y se mide lo de dentro.
    for (const [clave, rotulo] of LINEAS_F) {
      const f = m.lineas.find((x) => x.clave === clave);
      // Una línea que no existe es un HALLAZGO con nombre, no una excepción: sobre el producto sin
      // tocar este bloque tiene que caer en rojo LIMPIO (se comprobó así), no reventar el guard.
      if (!f) { mal(`F.7 ${q} no existe la línea «${rotulo}»: no hay nada que pulsar`); continue; }
      // Pulsa el encabezado de una línea y mide lo que hay DENTRO.
      const a = await page.evaluate(async (clave) => {
        const c = document.getElementById('view');
        const norm = (s) => String(s).replace(/[   ]/g, ' ').replace(/\s+/g, ' ').trim();
        const d = c.querySelector(`details.detail-plega[data-linea="${clave}"]`);
        const antes = d.open;
        d.querySelector('summary').click();
        await new Promise((r) => setTimeout(r, 60));
        const cuerpo = d.querySelector('.detail-plega-cuerpo');
        const visible = (e) => e.getClientRects().length > 0;
        const objetivo = (e) => (e.tagName === 'INPUT' && e.type === 'checkbox' && e.closest('label')) ? e.closest('label') : e;
        const controles = cuerpo ? [...cuerpo.querySelectorAll('button, a, input, select, textarea')].filter(visible) : [];
        return {
          antes,
          ahora: d.open,
          hayCuerpo: !!cuerpo,
          texto: cuerpo ? norm(cuerpo.innerText) : '',
          botones: controles.filter((e) => e.tagName === 'BUTTON').map((e) => norm(e.textContent)),
          casillas: controles.filter((e) => e.type === 'checkbox').map((e) => e.getAttribute('aria-label')),
          ids: controles.map((e) => e.id).filter(Boolean),
          marcadores: Object.fromEntries(controles.filter((e) => e.placeholder).map((e) => [e.id, e.placeholder])),
          etiquetadoPor: Object.fromEntries(controles.filter((e) => e.getAttribute('aria-labelledby')).map((e) => [e.id, e.getAttribute('aria-labelledby')])),
          filasGasto: cuerpo ? cuerpo.querySelectorAll('.job-doc-row[data-gasto]').length : 0,
          pequenos: controles.filter((e) => { const r = objetivo(e).getBoundingClientRect(); return r.width < 44 || r.height < 44; })
            .map((e) => { const r = objetivo(e).getBoundingClientRect(); return `${e.tagName.toLowerCase()}«${norm(e.textContent || e.getAttribute('aria-label') || e.id).slice(0, 24)}» ${r.width.toFixed(0)}×${r.height.toFixed(0)}`; }),
        };
      }, clave);
      const fallos = [];
      if (caso.dentro.quien && clave === 'quien' && caso.dentro.quien.fija) {
        // Sin nada que abrir: la línea es fija y NO se abre al pulsarla.
        if (!f.fija) fallos.push('debería ser fija (sin galón ni foco)');
        if (a.ahora) fallos.push('se ha abierto al pulsarla');
        if (a.hayCuerpo) fallos.push('conserva un cuerpo vacío');
      } else {
        if (!a.ahora) fallos.push('no se abre al pulsarla');
        if (a.pequenos.length) fallos.push(`controles por debajo de 44 px al abrir: ${a.pequenos.join(' · ')}`);
        if (clave === 'tipo') {
          if (caso.tecnico) {
            if (a.botones.length !== 0) fallos.push(`el técnico ve ${a.botones.length} tarjetas para CAMBIAR el tipo`);
            if (!/Esta acción es solo para administradores/.test(a.texto)) fallos.push('el técnico no ve POR QUÉ no puede cambiarlo');
          } else {
            const t1 = a.botones.some((b) => b.includes(T_TIPO_UNICO));
            const t2 = a.botones.some((b) => b.includes(T_TIPO_SUELTAS));
            if (a.botones.length !== 2 || !t1 || !t2) fallos.push(`esperaba las dos tarjetas de tipo, hay ${JSON.stringify(a.botones)}`);
          }
        }
        if (clave === 'datos') {
          if (!a.ids.includes('job-nombre') || !a.ids.includes('job-direccion')) fallos.push(`faltan los campos nombre/dirección (hay ${JSON.stringify(a.ids)})`);
          if (a.marcadores['job-nombre'] !== T_MARCADOR_NOMBRE) fallos.push(`marcador del nombre «${a.marcadores['job-nombre']}»`);
          if (!a.texto.includes(T_AYUDA_NOMBRE)) fallos.push('falta la explicación del nombre');
        }
        if (clave === 'quien') {
          const d = caso.dentro.quien;
          if (d.casillas && JSON.stringify(a.casillas) !== JSON.stringify(d.casillas)) fallos.push(`casillas ${JSON.stringify(a.casillas)}, esperaba ${JSON.stringify(d.casillas)}`);
          if (d.nota && !a.texto.includes(d.nota)) fallos.push(`falta «${d.nota}»`);
          if (d.botonAlta && !a.botones.includes('Dar de alta a alguien')) fallos.push('falta «Dar de alta a alguien»');
          if (!d.botonAlta && a.botones.length) fallos.push(`botones que no tocan: ${JSON.stringify(a.botones)}`);
        }
        if (clave === 'notas') {
          if (!a.ids.includes('job-notas-internas')) fallos.push('falta el campo de notas');
          if (a.marcadores['job-notas-internas'] !== T_MARCADOR_NOTAS) fallos.push(`marcador de notas «${a.marcadores['job-notas-internas']}»`);
          if (a.etiquetadoPor['job-notas-internas'] !== 'job-plega-rotulo-notas') fallos.push('el campo de notas no se nombra con el rótulo de su línea');
        }
        if (clave === 'gastos') {
          const d = caso.dentro.gastos;
          if (a.filasGasto !== d.filas) fallos.push(`${a.filasGasto} gastos pintados, esperaba ${d.filas}`);
          if (d.vacio && !a.texto.includes(d.vacio)) fallos.push(`falta «${d.vacio}»`);
        }
      }
      if (!fallos.length) bien(`F.7 ${q} al pulsar «${rotulo}»: ${caso.dentro.quien && clave === 'quien' && caso.dentro.quien.fija ? 'no se abre (no hay nada que abrir)' : 'se abre y lo de dentro es lo esperado'}`);
      else mal(`F.7 ${q} al pulsar «${rotulo}»: ${fallos.join(' · ')}`);
    }

    // «Dar de alta a alguien» ES un botón que hace algo: se pulsa y se mira a dónde va.
    if (caso.dentro.quien && caso.dentro.quien.botonAlta) {
      const nav1 = await page.evaluate(() => {
        const c = document.getElementById('view');
        const b = [...c.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Dar de alta a alguien');
        if (!b) return { sinBoton: true };
        // `app.js` REDEFINE `window.renderAppView` al arrancar y el espía del banco ya no está: se
        // vuelve a poner justo antes de pulsar, que es lo que se quiere observar (a dónde manda).
        window.__navegaciones = [];
        window.renderAppView = (v, o) => { window.__navegaciones.push({ vista: v, opts: o }); };
        b.click();
        return { navegaciones: window.__navegaciones };
      });
      if (!nav1.sinBoton && nav1.navegaciones.length === 1 && nav1.navegaciones[0].vista === 'team') bien(`F.7 ${q} «Dar de alta a alguien» lleva a la pantalla del equipo`);
      else mal(`F.7 ${q} «Dar de alta a alguien» no lleva al equipo: ${JSON.stringify(nav1)}`);
    }

    // F.6 · la casilla «Incluir precios en el parte» ya no está en la barra de Documentos: vive SÓLO
    // en la hoja de alta del albarán (com. 16142). Sólo en un caso: es igual para todos.
    if (caso.sheet) {
      // F.6 · pulsa «+ Nuevo albarán» y mide dónde vive la casilla de precios.
      const r = await page.evaluate(async () => {
        const c = document.getElementById('view');
        const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
        const cuenta = (raiz) => [...raiz.querySelectorAll('label')].filter((l) => /Incluir precios en el parte/.test(l.textContent));
        const barra = c.querySelector('.job-doc-toolbar');
        if (!barra) return { sinBoton: true, antes: { barra: -1, pantalla: cuenta(document).length } };
        const antes = { barra: cuenta(barra).length, pantalla: cuenta(document).length };
        const btn = [...c.querySelectorAll('.job-doc-toolbar button')].find((b) => norm(b.textContent) === '+ Nuevo albarán');
        if (!btn) return { sinBoton: true, antes };
        btn.click();
        await new Promise((r) => setTimeout(r, 500));
        const hoja = document.querySelector('.modal-overlay');
        const dentro = hoja ? cuenta(hoja) : [];
        const casilla = dentro[0] ? dentro[0].querySelector('input[type=checkbox]') : null;
        const res = { antes, hojaAbierta: !!hoja, dentro: dentro.length, marcadaAlAbrir: casilla ? casilla.checked : null };
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        return res;
      });
      if (r.sinBoton) mal(`F.6 ${q} no encuentro «+ Nuevo albarán» para pulsar`);
      else if (r.antes.barra === 0 && r.antes.pantalla === 0 && r.hojaAbierta && r.dentro === 1 && r.marcadaAlAbrir === false) {
        bien(`F.6 ${q} la casilla no está en la barra ni en la pantalla; al pulsar «+ Nuevo albarán» la hoja la lleva UNA vez, sin marcar`);
      } else {
        mal(`F.6 ${q} casilla de precios: en la barra ${r.antes.barra}, en pantalla ${r.antes.pantalla}, hoja abierta=${r.hojaAbierta}, dentro de la hoja ${r.dentro}, marcada=${r.marcadaAlAbrir} (esperaba 0 · 0 · true · 1 · false)`);
      }
    }
    await page.close();
  }
}

await nav.close();
await banco.cerrar();
await bancosF.equipo.cerrar();
await bancosF.tecnico.cerrar();
await bancosF.ciego.cerrar();

const total = bien_ + mal_;
console.log(`\npoblación: ${total} comprobaciones · D y G sobre ${CASOS.length} casos × ${ANCHOS.length} anchuras · F sobre ${CASOS_DE_F.length} casos (${CASOS_DE_F.map((c) => c.banco).join(', ')}) × ${ANCHOS.length} anchuras (${ANCHOS.join(', ')}) · ${suelo_} no medidas`);
if (suelo_) { console.log(`🟡 ${suelo_} cosas no supe medir: no doy veredicto.`); process.exit(2); }
if (mal_) { console.log(`❌ el detalle NO cuadra con su inventario: ${bien_} de ${total}.`); process.exit(1); }
console.log(`✅ el detalle cuadra con su inventario: ${bien_} de ${total}.`);
