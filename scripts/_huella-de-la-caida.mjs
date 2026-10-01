// scripts/_huella-de-la-caida.mjs — SCRUM-1331 / SCRUM-1332 · LO QUE UN ROJO DICE DE SÍ MISMO.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA PREGUNTA: ¿puede la tanda decir «esto NO es un caso que falle»?
//
// El 1-oct-2026 dos tandas salieron rojas sin que fallara ningún caso:
//   · SCRUM-1331 — `scrum804b` llamaba a la red AL CARGAR y el runner no tenía DNS: el fichero
//     cayó con 0 casos declarados (PR #2046, el único rojo de 9.404 tests);
//   · SCRUM-1332 — `scrum1216b` pasó sus 9 casos y el PROCESO murió al salir con una aserción
//     nativa de libuv (`src\win\async.c`).
// En los dos casos quien miraba veía «1 fail» y buscaba la causa en su propio diff.
//
// Las dos caídas dejan una huella legible SIN mirar el diff, y nadie la leía. Esto la lee: es un
// lector de la salida del reporter `spec`, línea a línea, que al final dice qué rojos NO son un
// caso que falle. Lo usa `scripts/tanda-con-veredicto.mjs`, que ya ve pasar toda la salida.
//
// 🔴 LO QUE NO HACE: no cambia el código de salida, no quita ni salta nada, no decide. Un rojo
// sigue siendo rojo. Sólo cambia lo que el rojo DICE.
//
// ── DE DÓNDE SALE CADA COSA (medido con una tanda fabricada, node v24.18.0) ────────────────
//
//   · `✖ <ruta>.test.mjs (N ms)` en la sección «failing tests», con `test at <ruta>:1:1`: es el
//     FICHERO el que cae. `node --test` sólo emite esa entrada cuando el proceso del fichero sale
//     ≠ 0 SIN que ninguno de sus casos haya caído — o sea, por construcción, «fichero caído con
//     0 casos caídos». Aun así se COMPRUEBA contando las demás entradas de ese fichero.
//   · La salida de error del fichero pasa por la salida del reporter JUSTO ANTES de su `✖`. Ahí
//     se busca la huella: una frase de red de git/curl, o una caída nativa.
//   · `﹣ <caso> (N ms) # <motivo>` es un salto. Si el motivo dice CIEGO, ese caso NO HA MIRADO, y
//     se repite al final: un salto sólo se ve en el TAP, y el TAP llega ilegible al CI (SCRUM-1289).
//
// ── SUS LÍMITES, DECLARADOS ────────────────────────────────────────────────────────────────
//
//   · Sólo lee `spec` (el reporter por omisión y el que el CI manda a la salida estándar). Con
//     otro reporter no ve la sección de caídos y LO DICE: no se calla.
//   · La «ventana» de un fichero son las líneas desde el último resultado de caso hasta su `✖`.
//     Si el fichero ANTERIOR escribió en su salida de error después de su último caso, esa cola
//     entra en la ventana. No se ha visto, pero no hay con qué excluirlo desde `spec`.
//   · `spec` no trae el código de salida del fichero. Una muerte nativa que no escriba nada
//     (un SIGKILL) sale «sin huella reconocida», no «nativa»: se dice así, no se adivina.
// ═════════════════════════════════════════════════════════════════════════════════════════
import { esFalloDeRed } from './censo-regla-42.mjs';

export const RED = 'RED';
export const NATIVA = 'NATIVA';
export const SIN_HUELLA = 'SIN_HUELLA';

/** Lo que escribe un proceso que muere por debajo de JavaScript. Frases literales, no intuición. */
const HUELLA_NATIVA = /Assertion failed: .+, file .+, line \d+|----- Native stack trace -----|Segmentation fault|FATAL ERROR: |# Fatal error in /;

const CSI = /\x1b\[[0-9;?]*[ -\/]*[@-~]/g;
const RESULTADO = /^\s*(✔|✖|﹣|ℹ|▶) /;
const CAIDO = /^✖ (.+?) \([\d.]+ms\)\s*$/;
const SALTO = /^\s*﹣ (.+?) \([\d.]+ms\) # (.+?)\s*$/;
const SECCION = /^✖ failing tests:\s*$/;
const SITIO = /^test at (.+):(\d+):(\d+)\s*$/;
const ES_FICHERO = /\.test\.[cm]?js$/;
const TOPE_VENTANA = 400;

const norm = (ruta) => String(ruta).replace(/\\/g, '/');

/** La huella de una ventana de salida: `{ clase, huella }`. La red se mira ANTES que lo nativo. */
export function clasificarVentana(lineas) {
  const deRed = lineas.find((l) => esFalloDeRed(l));
  if (deRed) return { clase: RED, huella: deRed.trim().slice(0, 240) };
  const nativa = lineas.find((l) => HUELLA_NATIVA.test(l));
  if (nativa) return { clase: NATIVA, huella: nativa.trim().slice(0, 240) };
  return { clase: SIN_HUELLA, huella: '' };
}

/**
 * Un lector que se alimenta de TEXTO según llega (trozos, no líneas) y al final da su informe.
 * No lanza: un lector que rompe la tanda que vigila sería peor que no tenerlo.
 */
export function lectorDeHuellas() {
  let resto = '';
  let ventana = [];
  let enSeccion = false;
  let sitio = null;
  let entrada = null;
  let lineasLeidas = 0;
  const ventanasPorFichero = new Map();
  const entradas = [];
  const ciegosSaltados = [];

  function linea(cruda) {
    lineasLeidas += 1;
    const l = cruda.replace(CSI, '').replace(/\r$/, '');
    if (!enSeccion) {
      if (SECCION.test(l)) { enSeccion = true; return; }
      const caido = CAIDO.exec(l);
      if (caido && ES_FICHERO.test(caido[1])) ventanasPorFichero.set(norm(caido[1]), ventana);
      const salto = SALTO.exec(l);
      if (salto && /\bCIEGO\b/.test(salto[2])) ciegosSaltados.push({ nombre: salto[1], motivo: salto[2].slice(0, 300) });
      if (RESULTADO.test(l)) ventana = [];
      else if (ventana.length < TOPE_VENTANA) ventana.push(l);
      return;
    }
    const s = SITIO.exec(l);
    if (s) { sitio = { fichero: norm(s[1]), l: Number(s[2]), c: Number(s[3]) }; entrada = null; return; }
    const caido = CAIDO.exec(l);
    if (caido && sitio && !entrada) {
      entrada = { nombre: caido[1], ...sitio, error: [] };
      entradas.push(entrada);
      return;
    }
    if (entrada && l.trim() && entrada.error.length < 3) entrada.error.push(l.trim());
  }

  return {
    texto(trozo) {
      resto += trozo;
      const partes = resto.split('\n');
      resto = partes.pop();
      for (const p of partes) linea(p);
    },
    fin() {
      if (resto) { linea(resto); resto = ''; }
      const esDeFichero = (e) => e.l === 1 && e.c === 1 && norm(e.nombre) === e.fichero;
      const ficherosCaidos = entradas.filter(esDeFichero);
      const casos = entradas.filter((e) => !esDeFichero(e));
      const ficherosMuertos = ficherosCaidos.map((e) => {
        const casosCaidosDentro = casos.filter((c) => c.fichero === e.fichero).length;
        const v = ventanasPorFichero.get(e.fichero);
        return { fichero: e.fichero, casosCaidosDentro, ...(v ? clasificarVentana(v) : { clase: SIN_HUELLA, huella: '' }) };
      });
      const ciegosCaidos = casos.filter((c) => /\bCIEGO\b/.test(c.error[0] ?? ''))
        .map((c) => ({ nombre: c.nombre, fichero: c.fichero, sinRed: /SIN RED/.test(c.error[0]), motivo: c.error[0].slice(0, 300) }));
      return {
        lineasLeidas,
        vistaLaSeccion: enSeccion,
        caidos: entradas.length,
        ficherosMuertos,
        ciegosCaidos,
        ciegosSaltados,
        casosRojosDeVerdad: casos.length - ciegosCaidos.length,
      };
    },
  };
}

/**
 * El aviso final, o '' si no hay nada que decir. `codigo` es el de la tanda: con una tanda roja
 * de la que no se vio la sección de caídos, se DICE que no se pudo leer.
 */
export function redactar(informe, codigo) {
  const { ficherosMuertos: fm, ciegosCaidos: cc, ciegosSaltados: cs } = informe;
  if (!informe.vistaLaSeccion) {
    const saltos = cs.map((c) => `   ⚠️ ESTA TANDA NO COMPROBÓ «${c.nombre}»: ${c.motivo}\n`).join('');
    if (codigo && codigo !== 0) {
      return '\nℹ️ LO QUE ESTA TANDA DICE DE SUS ROJOS (SCRUM-1331): no puedo decirlo. No ha pasado por la '
        + `salida estándar la sección «failing tests» del reporter \`spec\` (${informe.lineasLeidas} líneas leídas). `
        + 'No es un «no hay»: es que no pude mirar.\n' + saltos;
    }
    return saltos ? `\nℹ️ LO QUE ESTA TANDA NO HA MIRADO (SCRUM-1331) · ${cs.length} caso(s) saltado(s) por CIEGO:\n${saltos}` : '';
  }
  if (!fm.length && !cc.length && !cs.length) return '';

  const out = [];
  out.push('\n══ LO QUE ESTA TANDA DICE DE SUS ROJOS (SCRUM-1331 / SCRUM-1332) · no cambia el código de salida ══');
  out.push(`   población: ${informe.caidos} caído(s) en «failing tests» · ${fm.length} fichero(s) caído(s) SIN caso caído · `
    + `${cc.length} caso(s) caído(s) por CIEGO · ${cs.length} saltado(s) por CIEGO · ${informe.casosRojosDeVerdad} rojo(s) de caso`);
  for (const f of fm) {
    const dentro = `${f.casosCaidosDentro} casos caídos dentro`;
    if (f.clase === RED) {
      out.push(`   🔴 NO HABÍA RED · ${f.fichero} — ${dentro}; el fichero no llegó al remoto: «${f.huella}». `
        + 'No es un caso que falle ni es el cambio que se prueba: RELANZA.');
    } else if (f.clase === NATIVA) {
      out.push(`   🔴 MURIÓ EL PROCESO, NO FALLÓ UN TEST · ${f.fichero} — ${dentro}; huella nativa: «${f.huella}». `
        + 'Relanza UNA vez: si el mismo fichero vuelve a morir, entonces sí es de lo que se prueba.');
    } else {
      out.push(`   🔴 FICHERO CAÍDO SIN CASO CAÍDO · ${f.fichero} — ${dentro}, y sin huella reconocida de red ni nativa. `
        + 'Puede ser un error AL CARGAR el fichero, también del cambio que se prueba: su salida está justo encima de su ✖.');
    }
  }
  for (const c of cc) {
    out.push(`   ⚠️ CIEGO${c.sinRed ? ' · SIN RED' : ''} · «${c.nombre}» (${c.fichero}) cayó porque NO PUDO MIRAR, no porque viera un fallo: ${c.motivo}`);
  }
  for (const c of cs) out.push(`   ⚠️ ESTA TANDA NO COMPROBÓ «${c.nombre}»: ${c.motivo}`);
  out.push(informe.casosRojosDeVerdad > 0
    ? `   Y ADEMÁS hay ${informe.casosRojosDeVerdad} rojo(s) de caso que NO son nada de lo de arriba: ésos sí se miran en el cambio.`
    : '   No hay ningún otro rojo de caso: todo lo que ha caído en esta tanda está en las líneas de arriba.');
  return out.join('\n') + '\n';
}
