// tests/scrum514-aprobado-y-aplicado.test.mjs — SCRUM-514
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// UN TEXTO APROBADO QUE NO LLEGA A LA PANTALLA ES UNA DECISIÓN QUE NO SIRVIÓ DE NADA.
//
// El ticket nació porque nadie sabía QUÉ quedaba por aplicar: la respuesta exigía cruzar a mano
// `docs/MICROCOPY_APROBADA_SIN_APLICAR.md` con el código, y ese cruce caducaba el día siguiente.
// Medido el 3-sep-2026: **no quedaba ni un texto aprobado sin aplicar** fuera de lo aparcado a
// propósito. Este guard es lo que impide que vuelva a hacer falta medirlo a mano.
//
// 🔴 LO QUE VIGILA, y es lo contrario de lo que vigila SCRUM-402:
//   · 402 mira que no se PINTE un marcador sin aprobar.
//   · éste mira que todo lo APROBADO esté pintado.
// Son las dos mitades de la regla 30, y hasta hoy sólo existía la primera: se podía aprobar un
// texto, no aplicarlo nunca, y ninguna tanda decía nada. Es exactamente lo que pasó durante tres
// semanas con los rótulos del 17-ago.
//
// ⚠️ LA FUENTE SON LOS DOS SITIOS DONDE VIVEN LAS APROBACIONES, y nada más: ni este comentario,
// ni un ticket, ni un informe. Desde SCRUM-709 son `docs/microcopy/` (las nuevas, una por fichero)
// y el registro congelado; se leen con SU lector —`_microcopy-aprobada.mjs`— y no con un segundo
// barrido propio. Si cambian, este guard cambia con ellos sin que nadie lo actualice: la lista NO
// se copia aquí.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aprobacionesDeMicrocopy } from './_microcopy-aprobada.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Los textos aprobados, DE LOS DOS SITIOS DONDE VIVEN.
 *
 * 🔴 SCRUM-709 partió la fuente en dos y este guard nació leyendo sólo una:
 *   · `docs/microcopy/` — una aprobación, un fichero. Donde van las NUEVAS.
 *   · `docs/MICROCOPY_APROBADA_SIN_APLICAR.md` — el registro CONGELADO hasta el 3-sep.
 *
 * Leer sólo el congelado habría sido exactamente la ceguera que `_microcopy-aprobada.mjs` avisa:
 * un texto aprobado HOY y no aplicado no lo vería nadie, y este guard existe justo para eso. Se
 * usa SU lector y no se escribe un segundo: dos barridos de lo mismo divergen.
 *
 * De cada sitio se saca lo que ese sitio usa para el texto aprobado:
 *   · el registro → la ÚLTIMA columna de sus tablas;
 *   · un fichero de aprobación → TODAS sus líneas de cita (SCRUM-1334; ver `poblacion`).
 * Hasta el 1-oct-2026 sólo se leían las citas bajo un encabezado «Texto aprobado», y eso dejaba
 * fuera, sin decirlo, 138 de 248: bastaba titular el apartado con otras palabras.
 *
 * Se descarta lo que no es copy —rutas, identificadores en mayúsculas, fragmentos cortos—. El
 * filtro es por FORMA, nunca por contenido: excluir un texto por lo que dice sería decidir por el
 * fundador.
 *
 * 🔴 POR QUÉ NO SE USA `literalesAprobados()`, QUE EXISTE Y HARÍA ESTO EN UNA LÍNEA (SCRUM-715).
 *
 * Porque responde OTRA PREGUNTA. Esa función contesta «¿consta aprobado?» y para eso acepta toda
 * cita `>` del registro, incluidas las notas en prosa — que es lo correcto para ella. Aquí la
 * pregunta es «¿este copy de PANTALLA está pintado?», y la prosa de una nota no se pinta nunca.
 *
 * MEDIDO el 4-sep-2026, no supuesto: con `literalesAprobados()` el cruce pasa de 0 a 13 sin
 * aplicar, y ~11 son notas del registro («⚠️ **Y el censo de marcadores dice UNO…**»). El guard
 * nacería rojo por prosa y alguien lo apagaría en una hora.
 *
 * ⚠️ Y esto NO es un segundo barrido: los SITIOS los sigue barriendo `aprobacionesDeMicrocopy()`,
 * que es el lector único. Lo que cambia es el CRITERIO de selección sobre lo que él devuelve.
 */
function textosAprobados(opciones) {
  return [...new Set(citasAprobadas(opciones).map((c) => c.texto))];
}

/**
 * Lo mismo que `textosAprobados`, pero cada texto con SU PROCEDENCIA (SCRUM-1329): de qué registro
 * sale, si la firma de ese registro cuenta, y en qué comentario de Jira dice que se firmó.
 *
 * `opciones` son las del lector (`dir`, `congelado`, `limites`) y existen para lo mismo que allí:
 * probar el extractor con fichas fabricadas en un directorio temporal, sin escribir en el real.
 *
 * ⚠️ «La firma cuenta» NO se decide aquí: es el `aprobada` del lector, que es quien sabe quién firma
 * (SCRUM-726, SCRUM-861). Y el comentario sólo se busca en una FICHA: en el registro congelado el
 * fichero entero es la firma, y una línea suya no dice a cuál de sus textos respalda.
 */
function citasAprobadas(opciones, declaradas) {
  return poblacion(opciones, declaradas).filter((c) => c.caja === 'cruce');
}

/**
 * 🔴 SCRUM-1334 · LA POBLACIÓN ENTERA, Y CADA TEXTO EN SU CAJA.
 *
 * Hasta aquí, de una ficha sólo se leían las citas bajo un encabezado que dijera «Texto aprobado».
 * Medido el 1-oct-2026: eso cruzaba 110 de 248 citas. Las otras 138 quedaban fuera EN SILENCIO, y
 * 106 iban bajo nueve títulos que cualquiera leería como de textos aprobados («Textos aprobados,
 * literales», «Los literales, tal cual se pintan»…). Entre ellas, una cita de 276 caracteres que
 * nadie miraba porque su encabezado estaba en plural.
 *
 * Añadir los nueve títulos a una lista habría sido un catálogo por nombre, que se rompe con el
 * décimo. Así que AQUÍ NINGÚN ENCABEZADO DECIDE NADA. En una ficha, TODA línea de cita es un texto
 * aprobado: es la convención que ya usa el lector (`constaAprobado` cuenta toda cita de
 * `docs/microcopy/` como literal firmado) y la que escribe su README. La sección se guarda para
 * DECIRLA en el rojo, no para decidir.
 *
 * Cada unidad cae en UNA caja, y de todas se da cuenta en el recuento:
 *   · `cruce`     — se busca tal cual en el código. Es lo que el guard vigila.
 *   · `plantilla` — lleva huecos `{…}`: el código la COMPONE y nunca aparece literal.
 *   · `corta`     — menos de 4 caracteres: por subcadena, «Sí» está en cualquier fichero.
 *   · `declarada` — está en `NO_SE_CRUZAN`, por ficha y texto, con su motivo y su prueba.
 *   · `forma`     — sólo en el registro congelado: una ruta o una constante, no copy.
 *   · `ajena`     — está en `NOTAS_AJENAS`, por ficha y texto: una línea que el guard no sabe cruzar
 *                   y que escribió OTRO equipo. Sale NOMBRADA en cada pasada, con su dueño, y su
 *                   propiedad se MIDE en cada pasada (ver `fallosDeAjena`).
 *
 * Lo desconocido va a `cruce`. Una cita que el código no pinta y que nadie ha declarado no pasa
 * callada: sale en rojo, y el rojo dice que el guard NO SABE qué es.
 */
const CAJAS = ['cruce', 'plantilla', 'corta', 'declarada', 'forma', 'ajena'];

function poblacion(opciones, declaradas = NO_SE_CRUZAN, ajenas = NOTAS_AJENAS) {
  const out = [];
  for (const ap of aprobacionesDeMicrocopy(opciones)) {
    const deFicha = ap.origen === 'fichero';
    const procedencia = {
      ruta: ap.ruta,
      deFicha,
      firmaQueCuenta: ap.aprobada === true,
      comentario: deFicha ? comentarioDeLaFirma(ap.texto) : null,
    };
    const esDe = (lista, u) => lista.some((d) => d.ficha === ap.nombre && d.texto === u.texto);
    for (const u of (deFicha ? citasDeFicha(ap.texto) : celdasDelCongelado(ap.texto))) {
      const caja = u.caja
        || (esDe(declaradas, u) ? 'declarada' : (esDe(ajenas, u) ? 'ajena' : 'cruce'));
      out.push({ ...u, caja, ...procedencia });
    }
  }
  return out;
}

/**
 * El comentario de Jira que la LÍNEA DE LA FIRMA nombra, o `null`.
 *
 * En la misma línea, y fuera de cita: es el criterio que SCRUM-861 ya fijó para la firma delegada
 * («en otra línea no vale: una referencia suelta en la prosa no demuestra que respalde a ESTA
 * firma»), aplicado aquí también a la del fundador.
 */
function comentarioDeLaFirma(md) {
  for (const linea of md.split(/\r?\n/)) {
    if (/^\s*>/.test(linea)) continue;
    if (!/^\s*\**\s*Aprobad[oa]s?\s+por\s+el\s+(fundador|orquestador\s+por\s+delegaci[oó]n\s+del\s+fundador)\b/i.test(linea)) continue;
    const m = /\bcomentario\s+(\d+)\b/i.exec(linea);
    if (m) return m[1];
  }
  return null;
}

/**
 * TODAS las líneas de cita `> …` de una ficha, cada una con su sección y, si se sabe leyendo sólo
 * el texto, con su caja. La línea en blanco de un bloque de cita (`>` a secas) no es una cita.
 */
function citasDeFicha(md) {
  const out = [];
  let seccion = '(antes del primer encabezado)';
  for (const linea of md.split('\n')) {
    const h = /^#{1,6}\s+(.*)$/.exec(linea.trimEnd());
    if (h) { seccion = h[1].trim(); continue; }
    const m = /^>\s?(.+)$/.exec(linea.trim());
    if (!m || m[1].trim() === '') continue;
    const texto = m[1].trim();
    if (texto.length < 4) { out.push({ texto, seccion, caja: 'corta' }); continue; }
    // 🔴 SCRUM-915e1 · LA MISMA REGLA DE PLANTILLA QUE YA APLICA `celdasDeTabla`, que aquí
    // faltaba. No es una excepción nueva ni una rebaja: es la de 20 líneas más abajo, escrita
    // para el registro congelado y nunca traída a las fichas. Un texto aprobado con un hueco
    // dentro —«Presupuesto válido hasta el {dd/mm/aaaa}.»— NUNCA aparece literal en el código,
    // porque el código lo COMPONE; cruzarlo tal cual da un rojo permanente por un texto que SÍ
    // está aplicado. Lo que este guard puede afirmar de una plantilla es que su parte fija esté,
    // y eso lo cubren los censos de la pantalla que la pinta (`scrum600` la ranura, `scrum600b`
    // el documento renderizado) y el guard de navegador del ticket, que cambia el hueco dos veces
    // y comprueba que la pantalla va detrás.
    //
    // La exención es ESTRECHA a propósito: sólo salta con llaves. Un texto sin ellas se sigue
    // cruzando byte a byte, y eso lo vigila el suelo de este mismo fichero.
    if (/{[^}]+}/.test(texto)) { out.push({ texto, seccion, caja: 'plantilla' }); continue; }
    out.push({ texto, seccion });
  }
  return out;
}

/** La última columna de las tablas del registro congelado, cada texto una vez y con su caja. */
function celdasDelCongelado(md) {
  const out = new Map();
  const poner = (texto, caja) => { if (!out.has(texto)) out.set(texto, { texto, seccion: null, caja }); };
  for (const linea of md.split('\n')) {
    const t0 = linea.trim();
    if (!t0.startsWith('|') || /^\|\s*-+/.test(t0)) continue;
    const celdas = t0.split('|').map((c) => c.trim()).filter(Boolean);
    const ultima = celdas[celdas.length - 1] || '';
    for (const m of ultima.matchAll(/`([^`]+)`/g)) {
      const t = m[1].trim();
      if (t.length < 4) { poner(t, 'corta'); continue; }
      if (/^[\w.\-/]+\.(js|ts|md)/.test(t)) { poner(t, 'forma'); continue; }      // rutas de fichero
      if (/^[A-Z_]{4,}$/.test(t)) { poner(t, 'forma'); continue; }                 // constantes
      if (!/[ áéíóúñÁÉÍÓÚÑ]/.test(t) && t.length < 8) { poner(t, 'forma'); continue; }
      // 🔴 Las PLANTILLAS se quedan fuera del cruce, y no es una excepción de conveniencia: un
      // texto como `{N} facturas` NUNCA aparece literal en el código porque el código lo
      // COMPONE (`n + ' facturas'`). Buscarlo tal cual daría un rojo permanente por algo que sí
      // está aplicado — medido: `libroRegistroView.js:49`. Lo que el guard puede afirmar de una
      // plantilla es que su parte fija esté, y eso ya lo cubre el resto de la fila.
      if (/{[^}]+}/.test(t)) { poner(t, 'plantilla'); continue; }
      poner(t, 'cruce');
    }
  }
  return [...out.values()];
}

/** Todo el código donde puede vivir un texto de pantalla. Se lee UNA vez por pasada. */
let corpusLeido = null;
function corpus() {
  if (corpusLeido) return corpusLeido;
  const ficheros = [];
  const walk = (d, ext) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p, ext); continue; }
      if (ext.test(e.name)) ficheros.push(p);
    }
  };
  walk(path.join(RAIZ, 'public'), /\.(js|ts|html)$/);
  walk(path.join(RAIZ, 'src'), /\.ts$/);
  corpusLeido = { texto: ficheros.map((f) => fs.readFileSync(f, 'utf8')).join('\n'), cuantos: ficheros.length };
  return corpusLeido;
}

/** A partir de aquí, una cita se trata como prosa. No se sube ni se baja para que pase un caso. */
const LARGO_DE_PROSA = 160;

/**
 * Lo que ha entrado en el cruce y NO es copy de pantalla, con el porqué de cada uno.
 *
 * 🔴 SCRUM-1329 · LA LONGITUD ERA UN SUSTITUTO, Y SE EQUIVOCABA CON LO FIRMADO.
 *
 * Lo que este control vigila es que no entre en el cruce una NOTA del registro: texto que nadie
 * pinta nunca. «Más de 160» era la forma barata de reconocerla, y acierta casi siempre —medido el
 * 1-oct-2026: de 105 citas bajo «Texto aprobado» sólo una pasa de 160—, pero trata igual a una nota
 * que a una frase larga que el fundador firmó y que SÍ está en la pantalla. Y las frases legales y
 * fiscales son largas.
 *
 * Así que a una cita larga se le pregunta lo que de verdad la separa de una nota, y son TRES cosas
 * que se pueden comprobar leyendo:
 *   1. su ficha lleva una firma que CUENTA (la del fundador, o la delegada vigente: lo decide el
 *      lector, no este fichero);
 *   2. la línea de esa firma dice en qué comentario de Jira se firmó;
 *   3. el texto está PINTADO tal cual en el código. Es lo que una nota no cumple jamás.
 *
 * Con las tres, pasa. Si falta cualquiera, el guard NO SABE si es cita firmada o prosa, y cae
 * diciendo cuál le falta: no pasa en silencio. El umbral no se mueve y la negrita sigue siendo
 * prosa siempre.
 *
 * ⚠️ Lo que esto NO comprueba, y se dice: que el comentario citado contenga ese texto. Un test no
 * lee Jira. La referencia es para que una persona pueda ir a mirarlo.
 */
function prosaEnElCruce(citas, textoDelCorpus) {
  const out = [];
  for (const texto of new Set(citas.map((c) => c.texto))) {
    if (/\*\*/.test(texto)) { out.push({ texto, porque: 'lleva negrita de Markdown: es una nota, no copy' }); continue; }
    if (texto.length <= LARGO_DE_PROSA) continue;
    const suyas = citas.filter((c) => c.texto === texto);
    const falta = [];
    if (!suyas.some((c) => c.firmaQueCuenta)) falta.push('su ficha no lleva una firma que cuente');
    else if (!suyas.some((c) => c.firmaQueCuenta && c.comentario)) falta.push('la línea de la firma no dice en qué comentario de Jira se firmó');
    if (!textoDelCorpus.includes(texto)) falta.push('no está pintado tal cual en el código');
    if (falta.length === 0) continue;
    out.push({
      texto,
      porque: `pasa de ${LARGO_DE_PROSA} caracteres (${texto.length}) y NO SÉ si es una cita firmada o `
        + `prosa: ${falta.join('; ')} [${[...new Set(suyas.map((c) => c.ruta))].join(', ')}]`,
    });
  }
  return out;
}

/**
 * 🔴 LO QUE SE SABE QUE NO ESTÁ APLICADO, CON SU MOTIVO Y QUIÉN LO DESBLOQUEA.
 *
 * No es una lista de perdón: es deuda declarada. Cada entrada dice por qué no se aplica y qué
 * tiene que pasar para que salga de aquí. Una excepción sin eso vuelve a ser el defecto que este
 * ticket cierra — un texto aprobado que nadie aplica y del que nadie se acuerda.
 */
/**
 * 🔴 SCRUM-867 (16-sep-2026) · DIEZ TEXTOS QUE SE QUEDARON SIN PANTALLA, NO SIN APROBACIÓN.
 *
 * Son los rótulos accesibles y los marcadores del modal viejo de «Nueva factura»
 * (`nuevaFacturaModal.js`). Ese fichero estaba MUERTO —nadie lo abría desde que la lista navega a
 * `invoices-new`— pero el índice lo cargaba y el SHELL lo precacheaba, así que se retiró entero.
 *
 * NO se han desaprobado: siguen firmados y siguen en su registro. Lo que ya no existe es la pantalla
 * que los pintaba. Se aparcan aquí —en vez de borrarlos del registro— porque quitarle la firma a un
 * texto es del fundador (regla 30), y porque la pantalla de hoy tiene los suyos, aprobados aparte.
 */
const MOTIVO_MODAL_RETIRADO = 'SU PANTALLA SE RETIRÓ (SCRUM-867, 16-sep-2026). Era un rótulo del '
  + 'modal viejo de «Nueva factura» (`public/dashboard/js/nuevaFacturaModal.js`), que estaba muerto '
  + '—cero llamadas, medido montando la pantalla— y que el panel seguía descargando y ejecutando en '
  + 'cada visita. Sale del árbol con su fichero; NO se desaprueba: la firma se conserva en su '
  + 'registro. Lo desbloquea el fundador el día que decida retirar los textos del registro, o una '
  + 'pantalla nueva que los necesite. Registro del ticket: `docs/master/SCRUM-867.md`.';

const DEL_MODAL_RETIRADO = [
  'Busca por nombre…',
  'Buscar cliente por nombre',
  'Cliente al que facturas',
  'No hemos podido cargar tus clientes. Inténtalo otra vez.',
  'Trabajo o material',
  'Concepto de la línea',
  'Cantidad de unidades',
  'Precio sin IVA',
  'Precio por unidad, sin IVA',
  'Quitar esta línea',
];

const APARCADOS = [
  ...DEL_MODAL_RETIRADO.map((texto) => ({ texto, motivo: MOTIVO_MODAL_RETIRADO })),
  {
    texto: 'Crear una factura nueva',
    motivo: 'RETIRADO POR DECISIÓN DEL FUNDADOR (SCRUM-875, 16-sep-2026). Era el `aria-label` del '
      + 'diálogo de «Nueva factura», servido por `rotulosDelDocumento.ariaDialogo()`. Su único '
      + 'consumidor era el modal viejo, retirado en SCRUM-867; el fundador decidió retirar también el '
      + 'rótulo: una página no es un diálogo, y cablearlo sería inventarle un uso. NO se desaprueba '
      + 'en el registro —la firma ocurrió—. Si algún día hay un diálogo, su texto se aprueba entonces. '
      + 'Registro del ticket: `docs/master/SCRUM-875.md`.',
  },
  {
    texto: 'Se acaba de emitir otra factura de este presupuesto. Vuelve a intentarlo y saldra el tramo siguiente.'.replace('saldra', 'saldrá'),
    motivo: 'APROBADO Y SIN SITIO DONDE PINTARSE (SCRUM-814, 7-sep-2026). Se propuso para el 409 de '
      + 'una carrera de tramos y el fundador lo firmo sin cambios. Entre la firma y el merge, otra '
      + 'sesion cerro la misma carrera en `main` con un arreglo MEJOR: recalcula el tramo dentro '
      + 'del cerrojo, asi que quien llega segundo emite el tramo SIGUIENTE en la misma peticion y '
      + 'no hay carrera que contarle a nadie. Y en el camino del CLIENTE FINAL tampoco se pinta: '
      + 'su aceptacion salio bien y su factura existe, asi que no se le dice nada. Se conserva la '
      + 'firma porque ocurrio; NO se deja una constante sin consumidor en `src/` para justificarla. '
      + 'Lo desbloquea el fundador el dia que quiera un aviso de «otra peticion se te ha '
      + 'adelantado»; registro en `docs/microcopy/2026-09-07-SCRUM-814-tramo-tomado.md`.',
  },
  {
    texto: '2. Líneas',
    motivo: 'SUSTITUIDO POR UNA FIRMA POSTERIOR (SCRUM-915d, 18-sep-2026). Era el título del bloque '
      + 'de líneas del editor. La v3 del editor, APROBADA por el fundador, convierte los bloques en '
      + 'pasos, y sus títulos se firmaron en SCRUM-915 comentario 15868: este bloque es el paso '
      + '«Conceptos» (el número lo pinta la hoja de estilos, aparte). NO se desaprueba en el '
      + 'registro —la firma ocurrió—; ya no tiene dónde pintarse. Registro: `docs/master/SCRUM-915.md`.',
  },
  {
    texto: '¿Para quién es el justificante?',
    motivo: 'RETIRADO CON SU RAMA MUERTA POR FIRMA DEL FUNDADOR (SCRUM-825 D1, comentario 17446, '
      + '28-sep-2026). Era la guía del paso «Cliente» del documento suelto en modo justificante '
      + '(`quotesView.js`). Desde SCRUM-1027 `modoDocumentoSuelto` no devuelve nunca «justificante», '
      + 'así que no la veía nadie (grupo A del censo de SCRUM-1257, re-medido ejecutándolo). NO se '
      + 'desaprueba en el registro —la firma ocurrió—; ya no tiene dónde pintarse. Registro: '
      + '`docs/master/SCRUM-1257.md`, sección SCRUM-1257c.',
  },
  {
    texto: 'Por ahora, YaQu no genera facturas ni justificantes desde tu cuenta.',
    motivo: 'SUSTITUIDO POR UNA FIRMA POSTERIOR (SCRUM-1257 comentario 17676, 1-oct-2026). Era el '
      + 'detalle del modo `receipt` en Ajustes (`settingsView.js`, `DETALLE_MODO_EMISION.receipt`), '
      + 'firmado en SCRUM-1220 comentario 17385. La firma nueva pinta en esa MISMA ranura el mismo '
      + 'texto sin «ni justificantes». NO se desaprueba en el registro —la firma ocurrió—; ya no '
      + 'tiene dónde pintarse. Registro: `docs/master/SCRUM-1257.md`, sección SCRUM-1257d.',
  },
  {
    texto: 'Modo no reconocido',
    motivo: 'RESPALDO del modo de emisión (`settingsView.js:213`). Aparcado por la REGLA 26: el '
      + 'texto que explica qué emite una cuenta toca claims fiscales y se responde sólo con el '
      + 'guion H2. Lo desbloquea el fundador, no una sesión.',
  },
  {
    texto: 'No hemos podido identificar qué emite esta cuenta. Escríbenos antes de emitir nada.',
    motivo: 'La otra mitad del mismo respaldo (`settingsView.js:219`). Mismo motivo y mismo '
      + 'desbloqueo: regla 26.',
  },
];

/**
 * 🔴 SCRUM-1334 · LAS CITAS QUE EL CÓDIGO PINTA SIN QUE APAREZCAN TAL CUAL, CON SU PRUEBA.
 *
 * Una cita de una ficha que el cruce literal no puede encontrar porque el código la COMPONE (un
 * plural, un número, dos constantes) o la tiene PARTIDA en dos literales. No es una lista de
 * perdón, y por eso cada entrada lleva lo que la hace comprobable:
 *   · `ficha`   — de qué ficha es. La declaración vale para ESA cita de ESA ficha y ninguna más.
 *   · `fichero` — dónde se compone.
 *   · `partes`  — la cita, troceada: las cadenas son las partes FIJAS, que tienen que seguir
 *                 escritas en ese fichero; `dato(…)` es lo que el código pone (un número, una fecha).
 *                 El texto de la cita es la suma de las partes: no se escribe dos veces.
 *   · `motivo`  — por qué no aparece tal cual, y qué la sacaría de aquí.
 *
 * ⛔ AQUÍ NO VA UNA NOTA. Una nota o un «qué había antes» escritos como cita no se declaran: se les
 * quita el `>` en su ficha. En `docs/microcopy/` toda cita es un texto firmado —también para
 * `constaAprobado`—, así que declararla aquí pondría este guard en verde dejando a la nota
 * contando como aprobada en el otro.
 */
const dato = (valor) => ({ dato: valor });
const textoDe = (partes) => partes.map((p) => (typeof p === 'string' ? p : p.dato)).join('');

const REMEDIO_DE_887 = 'este presupuesto tiene un descuento global y varios tipos de IVA. Duplícalo, '
  + 'pon el descuento en cada línea y envíaselo al cliente para que lo firme.';
const MOTIVO_DE_887 = 'FRASE COMPLETA QUE EL CÓDIGO COMPONE (SCRUM-887 comentario 15698): un prefijo más '
  + 'la constante `REMEDIO_DESCUENTO_GLOBAL_VARIOS_IVA`, que comparten las dos frases. Ejecutado el '
  + '1-oct-2026 contra `dist/`: la constante compuesta es idéntica a la cita. Sale de aquí si algún '
  + 'día el código la escribe entera en un solo literal.';
const MOTIVO_DE_915 = 'FORMATO DEL RESUMEN DE UN PASO CERRADO (SCRUM-915 comentario 15868): `N`, el '
  + 'total, la condición de pago y la fecha son datos, y la ficha lo dice debajo de la cita. Leído '
  + 'en `quotesView.js` (los `texto` de los pasos), no ejecutado: vive dentro del editor.';
const MOTIVO_DE_917 = 'SINGULAR QUE EL CÓDIGO ELIGE CON N = 1 (SCRUM-917 comentario 15938): '
  + '`pintarCifrasDeLaLista` compone el pie de «Por cobrar» con el número y la palabra en singular o '
  + 'plural. Leído en `jobsView.js`, no ejecutado: necesita el DOM de la lista.';
const MOTIVO_DE_974 = 'EJEMPLO DEL DETALLE CON SUS PLURALES (SCRUM-974 comentario 16056): '
  + '`bloqueFirmadoSinFacturar` compone «{partes} parte(s) firmado(s) de {clientes} cliente(s)» con '
  + 'plurales de verdad; la ficha cita tres casos. Leído en el servicio, no ejecutado: consulta la base.';
const MOTIVO_DE_1215_HOJA = 'EL NÚMERO DEL ALBARÁN ES UN DATO (SCRUM-1215 comentario 18283): '
  + '`openFacturarParcialSheet` compone el título y el `aria-label` de la hoja con `alb.numero` '
  + 'detrás de la parte fija. Ejecutado el 6-oct-2026 en el banco de vistas '
  + '(`tests/scrum1215d-hoja-facturar-lo-entregado.test.mjs`): lo pintado es la cita con el número.';

const NO_SE_CRUZAN = [
  { ficha: '2026-09-17-SCRUM-887-descuento-global-varios-iva-facturar.md', clase: 'compuesta',
    fichero: 'src/modules/quotes/domain/descuentoGlobalConVariosIva.ts',
    partes: ['No se puede facturar: ', REMEDIO_DE_887], motivo: MOTIVO_DE_887 },
  { ficha: '2026-09-17-SCRUM-887-descuento-global-varios-iva-facturar.md', clase: 'compuesta',
    fichero: 'src/modules/quotes/domain/descuentoGlobalConVariosIva.ts',
    partes: ['No se puede crear una revisión: ', REMEDIO_DE_887], motivo: MOTIVO_DE_887 },
  { ficha: '2026-09-18-SCRUM-915-pasos-del-editor.md', clase: 'compuesta',
    fichero: 'public/dashboard/js/quotesView.js',
    partes: [dato('N'), ' ', 'conceptos', ' · ', dato('total')], motivo: MOTIVO_DE_915 },
  { ficha: '2026-09-18-SCRUM-915-pasos-del-editor.md', clase: 'compuesta',
    fichero: 'public/dashboard/js/quotesView.js',
    partes: [dato('…'), ' · válido hasta ', dato('dd/mm/aaaa')], motivo: MOTIVO_DE_915 },
  { ficha: '2026-09-18-SCRUM-917-lista-singulares.md', clase: 'compuesta',
    fichero: 'public/dashboard/js/jobsView.js',
    partes: ['en ', dato('1'), ' ', 'trabajo', ' sin cerrar'], motivo: MOTIVO_DE_917 },
  { ficha: '2026-09-18-SCRUM-917-lista-singulares.md', clase: 'compuesta',
    fichero: 'public/dashboard/js/jobsView.js',
    partes: [dato('1'), ' sin importe de referencia, ', 'no entra'], motivo: MOTIVO_DE_917 },
  { ficha: '2026-09-21-SCRUM-974-firmado-sin-facturar.md', clase: 'compuesta',
    fichero: 'src/modules/messaging/domain/weeklyDigest.service.ts',
    partes: [dato('1'), ' ', 'parte firmado', ' de ', dato('1'), ' ', 'cliente'], motivo: MOTIVO_DE_974 },
  { ficha: '2026-09-21-SCRUM-974-firmado-sin-facturar.md', clase: 'compuesta',
    fichero: 'src/modules/messaging/domain/weeklyDigest.service.ts',
    partes: [dato('3'), ' ', 'partes firmados', ' de ', dato('1'), ' ', 'cliente'], motivo: MOTIVO_DE_974 },
  { ficha: '2026-09-21-SCRUM-974-firmado-sin-facturar.md', clase: 'compuesta',
    fichero: 'src/modules/messaging/domain/weeklyDigest.service.ts',
    partes: [dato('3'), ' ', 'partes firmados', ' de ', dato('2'), ' ', 'clientes'], motivo: MOTIVO_DE_974 },
  { ficha: '2026-09-21-SCRUM-980-historial-del-cliente.md', clase: 'compuesta',
    fichero: 'public/dashboard/js/customerDetailView.js',
    partes: [dato('3'), ' fotos'],
    motivo: 'PLURAL QUE EL CÓDIGO COMPONE (SCRUM-980): el nombre accesible de las fotos sale de '
      + '`ariaFotos(n)`, que devuelve «1 foto» o el número seguido de « fotos». El singular sí está '
      + 'tal cual y se cruza. Leído en `customerDetailView.js`, no ejecutado.' },
  { ficha: '2026-09-25-SCRUM-1124-direccion-albaran-firmado.md', clase: 'partida',
    fichero: 'src/modules/jobs/domain/jobDireccion.ts',
    partes: [
      'No se puede añadir la dirección a este trabajo: tiene un albarán ya firmado que la lleva ',
      'dentro de su firma. Cambiarla dejaría esa firma sin poder verificarse.',
    ],
    motivo: 'UN SOLO TEXTO, PARTIDO EN DOS LITERALES CON `+` (`MSG_DIRECCION_SELLADA`). Ejecutado el '
      + '1-oct-2026 contra `dist/`: la constante es idéntica a la cita. No se junta aquí a propósito '
      + '(orquestador, 1-oct-2026): ese fichero es del sellado del albarán (regla 29) y tocarlo para '
      + 'que un guard pueda leerlo sería mover lo serio por lo cómodo. Sale de aquí el día que quien '
      + 'lleve ese carril lo escriba en una línea.' },
  { ficha: '2026-10-06-SCRUM-1215-hoja-facturar-lo-entregado.md', clase: 'compuesta',
    fichero: 'public/dashboard/js/jobDetailView.js',
    partes: ['Facturar lo entregado · ', dato('{número}')], motivo: MOTIVO_DE_1215_HOJA },
  { ficha: '2026-10-06-SCRUM-1215-hoja-facturar-lo-entregado.md', clase: 'compuesta',
    fichero: 'public/dashboard/js/jobDetailView.js',
    partes: ['Facturar lo entregado del albarán ', dato('{número}')], motivo: MOTIVO_DE_1215_HOJA },
].map((d) => ({ ...d, texto: textoDe(d.partes) }));

/** A partir de aquí un «dato» deja de ser un número, una fecha o un hueco, y es una frase. */
const LARGO_DE_UN_DATO = 12;

/**
 * Lo que le falta a UNA declaración para valer. `[]` es que vale.
 *
 * `leer(ruta)` devuelve el texto de un fichero del repo, o `null` si no existe. Va por parámetro
 * para poder probar esto con una declaración fabricada, sin tocar ni el código ni las fichas.
 */
function fallosDeDeclaracion(d, { leer, textoDelCorpus }) {
  const fallos = [];
  if (!['compuesta', 'partida'].includes(d.clase)) fallos.push(`clase desconocida: «${d.clase}»`);
  if (!d.motivo || d.motivo.length <= 60) fallos.push('no lleva motivo, o es demasiado corto para revisarlo');
  const ficha = leer('docs/microcopy/' + d.ficha);
  if (ficha === null) fallos.push(`su ficha no existe: ${d.ficha}`);
  else if (!citasDeFicha(ficha).some((c) => c.texto === d.texto)) fallos.push('su ficha ya no tiene esa cita: la declaración sobra');
  if (textoDelCorpus.includes(d.texto)) fallos.push('el código YA la pinta tal cual: la declaración sobra');
  const fijas = d.partes.filter((p) => typeof p === 'string');
  const datos = d.partes.filter((p) => typeof p !== 'string').map((p) => p.dato);
  if (!fijas.some((p) => p.trim().length >= 4)) fallos.push('ninguna parte fija tiene 4 caracteres: no prueba nada');
  for (const v of datos) {
    if (v.length > LARGO_DE_UN_DATO) fallos.push(`«${v}» no es un dato (pasa de ${LARGO_DE_UN_DATO} caracteres): es texto, y el texto va como parte fija`);
  }
  if (d.clase === 'partida' && (datos.length > 0 || fijas.length < 2)) fallos.push('una cita partida son dos o más partes fijas y ningún dato');
  const codigo = leer(d.fichero);
  if (codigo === null) fallos.push(`el fichero donde se compone no existe: ${d.fichero}`);
  else for (const p of fijas) if (!codigo.includes(p)) fallos.push(`la parte fija ${JSON.stringify(p)} ya no está en ${d.fichero}`);
  return fallos;
}

const leerDelRepo = (ruta) => {
  const p = path.join(RAIZ, ruta);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
};

/**
 * 🔴 SCRUM-1334 (decisión del orquestador del equipo de Javier, comentario 18018, 2-oct-2026) ·
 * LO QUE EL GUARD NO SABE CRUZAR Y ESCRIBIÓ OTRO EQUIPO: NOMBRADO, CON SU DUEÑO, Y SÓLO BAJA.
 *
 * Al cruzar TODA cita aparecieron líneas de NOTA escritas con `>` en fichas viejas. El arreglo es
 * quitarles el `>`, y eso es de quien las escribió: un equipo no edita lo del otro. Mientras su
 * dueño no lo haga, cada una sale aquí NOMBRADA —esta línea, de esta ficha, de este dueño— en vez
 * de dejar el obligatorio en rojo para todos por algo que quien lo ve no puede arreglar.
 *
 * ⛔ ESTO NO ES UNA LISTA DE PERDÓN, y lo que lo impide no es esta frase:
 *   · DE QUIÉN ES una ficha lo dice la regla escrita de propiedad, `docs/equipo/dos-equipos.md`
 *     §3.3: «cada registro, el puesto que usa el texto». Así que cada entrada declara el fichero
 *     que USA los textos de su ficha (`usa`), y en cada pasada el guard MIDE dos cosas: que ese
 *     fichero pinta de verdad una cita de ESA ficha, y de qué puesto es ese fichero según las tablas
 *     §3.1 y §3.2 — leídas del propio documento, no copiadas aquí.
 *   · No sale del nombre de la ficha ni de su número de ticket: un catálogo por nombre mide el
 *     envoltorio (SCRUM-1296, SCRUM-1396). Ni de quién la tecleó: `git blame` contesta quién
 *     escribió una línea, no de quién es (decisión del orquestador, 2-oct-2026).
 *   · Si el fichero que usa el texto es de un puesto de ESTE equipo (J1 … J6), la entrada cae: lo
 *     nuestro no se declara, se ARREGLA.
 *   · Si §3 no dice de quién es ese fichero, cae diciendo que no lo sabe. Lo que no se pudo mirar no
 *     se da por ajeno.
 *   · Una entrada cuya línea ya no es una cita SOBRA, y cae pidiendo que se borre: el recuento baja
 *     con ella. Y `TECHO_DE_AJENAS`, por ficha, es el trinquete: no sube.
 *
 * Cada entrada lleva las tres cosas de toda excepción de este repositorio —MOTIVO, DUEÑO y FECHA en
 * que se declaró—. Sin las tres no es una excepción: es una promesa.
 *
 * ⚠️ Lo que esto NO arregla, y se dice:
 *   · Con el `>` puesto, `constaAprobado` sigue dando estas líneas por firmadas. El arreglo de
 *     verdad sigue siendo quitárselo, y esto sólo las nombra.
 *   · En una ficha de citas cortas («7 días») el texto sale por subcadena en ficheros de los dos
 *     equipos, así que quién lo usa no se deduce solo: se DECLARA y se comprueba. Elegir a propósito
 *     un fichero de coincidencia lo frena el techo y quien revise la entrada, no un mecanismo.
 */

/** Los equipos cuyas notas se pueden nombrar aquí. Este guard es del equipo de Javier (area-j2). */
const EQUIPOS_AJENOS = ['equipo de Luis'];
const equipoDelPuesto = (puesto) => (puesto.startsWith('J') ? 'equipo de Javier' : 'equipo de Luis');

/**
 * 🔒 TRINQUETE: cuántas notas ajenas quedan en cada ficha. Sólo BAJA. Una ficha que no está aquí
 * tiene techo 0. Subir un número o añadir una ficha es ensanchar la lista (regla 41).
 */
const TECHO_DE_AJENAS = {
  '2026-09-03-SCRUM-704-guardar-lineas-dictadas.md': 6,
  '2026-09-04-SCRUM-605-atajos-valido-hasta.md': 8,
  '2026-09-07-SCRUM-722-nuevo-albaran.md': 1,
  '2026-09-09-SCRUM-832-la-ficha-que-ya-no-esta.md': 2,
};

const ajenasDe = (ficha, comun, textos) => textos.map((texto) => ({ ficha, texto, ...comun }));

/** Lo mismo que el motivo de la ficha, más lo que sólo vale para ALGUNAS de sus líneas. */
const conNota = (entradas, nota) => entradas.map((e) => ({ ...e, motivo: e.motivo + ' ' + nota }));

const NOTAS_AJENAS = [
  ...ajenasDe('2026-09-03-SCRUM-704-guardar-lineas-dictadas.md', {
    dueno: 'equipo de Luis', fecha: '2026-10-02', usa: 'public/dashboard/js/parteDetailView.js',
    motivo: 'NOTA SOBRE EL CENSO DE MARCADORES, ESCRITA COMO CITA (sección «Qué queda sin firmar en esa '
      + 'pantalla»): seis líneas de un párrafo que explica por qué `scrum402` cuenta 1 y no 26. No es '
      + 'texto de pantalla y nadie lo pinta. Sale de aquí cuando su dueño le quite el `>` en la ficha.',
  }, [
    '⚠️ **Y el censo de marcadores dice UNO, no veintiséis, y las dos cifras son correctas.** Ese censo',
    'cuenta **literales que contienen la marca**, y esta pantalla la factoriza en una constante que',
    'concatena veintiséis veces. Quien lea ese «1» no debe deducir «un rótulo pendiente».',
    'Por eso la entrada de `parteDetailView.js` en `tests/scrum402-marcador-no-se-pinta.test.mjs`',
    '**sigue en 1 y no se retira**: aplicar este aviso no ha cambiado el número, porque este aviso',
    'nunca fue un literal marcado aparte.',
  ]),
  ...ajenasDe('2026-09-04-SCRUM-605-atajos-valido-hasta.md', {
    dueno: 'equipo de Luis', fecha: '2026-10-02', usa: 'public/dashboard/js/quoteAtajosVencimiento.js',
    motivo: 'NOTA DE HISTORIA ESCRITA COMO CITA (bajo el título de la ficha): ocho líneas que cuentan '
      + 'cómo estaba atribuida la firma antes de SCRUM-726 y por qué se corrigió. Las añadió ese ticket '
      + '(commit 8f6e0f08). No es texto de pantalla. Sale de aquí cuando su dueño le quite el `>`.',
  }, [
    '⚠️ **Cómo estaba escrito antes, y por qué se corrige.** Nació diciendo «Aprobado por el **ASESOR**»',
    'y añadía, con toda razón, «a la espera de la firma del fundador — esto no es su firma». **El',
    'fichero era escrupuloso: el defecto estaba en `constaAprobado()`**, que lo contaba como aprobación',
    'igualmente, porque sólo miraba que el texto estuviera escrito en `docs/microcopy/` y **no quién lo',
    'firmaba**. La regla 30 dice que la microcopy la aprueba el fundador; el guard comprobaba que',
    'alguien la hubiera escrito. Dos afirmaciones distintas con el mismo verde.',
    'La firma del fundador llegó, así que **la aprobación no se retira**: se corrige la línea que la',
    'atribuía mal, y el hueco del guard se cierra en SCRUM-726.',
  ]),
  ...ajenasDe('2026-09-07-SCRUM-722-nuevo-albaran.md', {
    dueno: 'equipo de Luis', fecha: '2026-10-02', usa: 'public/dashboard/js/albaranDetailView.js',
    motivo: '«QUÉ HABÍA ANTES», ESCRITO COMO CITA: el marcador que la pantalla pintaba hasta SCRUM-722, '
      + 'citado para contarlo. El propio texto dice de sí mismo que está pendiente, y aun así consta '
      + 'como firmado. Sale de aquí cuando su dueño le quite el `>` en la ficha.',
  }, [
    '[PENDIENTE microcopy oficial] Nuevo albarán',
  ]),
  ...ajenasDe('2026-09-09-SCRUM-832-la-ficha-que-ya-no-esta.md', {
    dueno: 'equipo de Luis', fecha: '2026-10-02', usa: 'public/dashboard/js/app.js',
    motivo: 'FRASE DE CANON CITADA EN LA FICHA (dos líneas, entre comillas angulares): la razón por la que '
      + 'los cinco textos valen para «no existe» y «no es tuyo». Es un porqué de diseño, no texto de '
      + 'pantalla. Sale de aquí cuando su dueño le quite el `>` en la ficha.',
  }, [
    '«Dos respuestas distintas a "no existe" y "no es tuyo" convierten la lista de ids en un',
    'directorio de la competencia.»',
  ]),
];

/**
 * Las filas de las tablas §3.1 (servidor) y §3.2 (pantallas) de `docs/equipo/dos-equipos.md`: qué
 * rutas nombra cada una y de qué puesto son. Se LEEN del documento en cada pasada: copiar la tabla
 * aquí serían dos tablas, y la segunda no la actualizaría nadie.
 *
 * Una fila «todo lo demás de `src/`» es el RESTO de ese directorio, y sólo vale si nada más casa.
 */
const DOS_EQUIPOS = 'docs/equipo/dos-equipos.md';
function filasDePropiedad(md) {
  const desde = md.indexOf('### 3.1');
  const hasta = md.indexOf('### 3.3');
  if (desde < 0 || hasta < desde) return [];
  const filas = [];
  for (const linea of md.slice(desde, hasta).split(/\r?\n/)) {
    if (!linea.startsWith('|') || /^\|\s*-+/.test(linea)) continue;
    const celdas = linea.split('|').map((c) => c.trim());
    const puesto = /\*\*([SJ]\d)\*\*/.exec(celdas[2] || '');
    if (!puesto) continue; // la cabecera de la tabla, o una fila sin puesto («nadie»)
    const resto = /todo lo demás de `([^`]+)`/.exec(celdas[1]);
    filas.push({
      puesto: puesto[1],
      resto: resto ? resto[1] : null,
      rutas: resto ? [] : [...celdas[1].matchAll(/`([^`]+)`/g)].map((m) => m[1]),
    });
  }
  return filas;
}

/**
 * De qué puesto es un fichero de código según esas filas, o `null` si no lo dicen.
 *
 * Gana lo más concreto: primero una ruta nombrada (entera o por su final, que es como las escribe
 * la tabla: `dashboard/js/app.js`), después un directorio con `/**`, y sólo al final el resto. Entre
 * dos del mismo tipo, la más larga.
 */
function puestoSegun(filas, ruta) {
  let mejor = null;
  const proponer = (puesto, peso) => { if (!mejor || peso > mejor.peso) mejor = { puesto, peso }; };
  for (const f of filas) {
    for (const r of f.rutas) {
      if (r.endsWith('/**')) {
        if (ruta.startsWith(r.slice(0, -2))) proponer(f.puesto, 1000 + r.length);
      } else if (ruta === r || ruta.endsWith('/' + r)) proponer(f.puesto, 2000 + r.length);
    }
    if (f.resto && ruta.startsWith(f.resto)) proponer(f.puesto, f.resto.length);
  }
  return mejor ? mejor.puesto : null;
}

let filasLeidas = null;
const puestoDelRepo = (ruta) => {
  if (!filasLeidas) filasLeidas = filasDePropiedad(leerDelRepo(DOS_EQUIPOS) || '');
  return puestoSegun(filasLeidas, ruta);
};

/**
 * Lo que le falta a UNA nota ajena para poder estar en la lista. `[]` es que vale.
 *
 * `leer` y `puestoDe` van por parámetro para probar esto con entradas fabricadas, sin tocar ni las
 * fichas ni el reparto. Con los de verdad (`leerDelRepo`, `puestoDelRepo`) MIDE.
 */
function fallosDeAjena(d, { leer, textoDelCorpus, puestoDe }) {
  const fallos = [];
  if (!d.motivo || d.motivo.length <= 60) fallos.push('no lleva motivo, o es demasiado corto para revisarlo');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha || '') || Number.isNaN(Date.parse(d.fecha))) fallos.push('no lleva la fecha en que se declaró (AAAA-MM-DD)');
  if (!EQUIPOS_AJENOS.includes(d.dueno)) fallos.push(`no lleva dueño, o su dueño no es otro equipo (${EQUIPOS_AJENOS.join(', ')})`);
  const ficha = leer('docs/microcopy/' + d.ficha);
  if (ficha === null) return [...fallos, `su ficha no existe: ${d.ficha}`];
  const citas = citasDeFicha(ficha);
  if (!citas.some((c) => c.texto === d.texto)) {
    return [...fallos, 'su ficha ya no tiene esa cita: la entrada SOBRA. Bórrala y baja el número de esa ficha en `TECHO_DE_AJENAS`, en el mismo commit'];
  }
  const pintada = textoDelCorpus.includes(d.texto);
  if (pintada) fallos.push('el código la pinta tal cual: es un texto y se cruza solo. La entrada SOBRA');
  // DE QUIÉN ES LA FICHA (§3.3): del puesto que usa su texto. Se mide que el fichero declarado lo usa
  // de verdad, y de quién es ese fichero.
  const codigo = d.usa ? leer(d.usa) : null;
  if (!d.usa) return [...fallos, 'no dice qué fichero USA los textos de su ficha (`usa`): sin eso no sé de quién es'];
  if (codigo === null) return [...fallos, `el fichero que dice que usa el texto no existe: ${d.usa}`];
  if (!citas.some((c) => !c.caja && c.texto !== d.texto && codigo.includes(c.texto))) {
    fallos.push(`${d.usa} no pinta ninguna cita de esa ficha: no es quien usa su texto, y no prueba de quién es`);
  }
  const puesto = puestoDe(d.usa);
  if (!puesto) fallos.push(`CIEGO: ${DOS_EQUIPOS} §3 no dice de qué puesto es ${d.usa}. Sin saberlo no la doy por ajena`);
  else if (equipoDelPuesto(puesto) !== d.dueno) {
    fallos.push(`el texto de esa ficha lo usa ${d.usa}, que es de ${puesto}: la ficha es del ${equipoDelPuesto(puesto)}, no del ${d.dueno}. `
      + 'Lo que es de ESTE equipo no se declara: se ARREGLA (si es una nota, se le quita el `>` en la ficha)');
  }
  return fallos;
}

/**
 * Lo que está en el cruce y el código NO pinta, quitando lo aparcado. Cada texto, con las fichas y
 * secciones donde aparece: para que el rojo diga dónde mirar.
 */
function sinAplicar(citas, textoDelCorpus, aparcados = APARCADOS) {
  const fuera = new Set(aparcados.map((a) => a.texto));
  const out = new Map();
  for (const c of citas) {
    if (c.caja !== 'cruce' || fuera.has(c.texto) || textoDelCorpus.includes(c.texto)) continue;
    if (!out.has(c.texto)) out.set(c.texto, { texto: c.texto, donde: [] });
    out.get(c.texto).donde.push(c.seccion ? `${c.ruta} · sección «${c.seccion}»` : c.ruta);
  }
  return [...out.values()];
}

// ═══ ① SUELO ═════════════════════════════════════════════════════════════════════════════

test('SCRUM-514 · SUELO: la fuente se lee y tiene textos de sobra', () => {
  const t = textosAprobados();
  assert.ok(t.length >= 60,
    `🔴 CIEGO: sólo he extraído ${t.length} textos aprobados de los DOS sitios donde viven. Todo `
    + 'lo que diga este fichero se apoya en esa población: con menos, un «todo aplicado» no '
    + 'significa nada. ¿Ha cambiado el formato de las tablas o el de `docs/microcopy/`?');
  const { cuantos } = corpus();
  assert.ok(cuantos >= 200,
    `🔴 CIEGO: sólo he barrido ${cuantos} ficheros de código. Un texto «no encontrado» podría ser `
    + 'que no lo he buscado bien.');
});

test('SCRUM-514 · SUELO: el cruce sabe decir SÍ y sabe decir NO', () => {
  // Sin esto, un «cero sin aplicar» podría ser un corpus vacío que lo contiene todo o nada.
  const { texto } = corpus();
  assert.equal(texto.includes('Volver a generar el PDF'), true,
    '🔴 el cruce no encuentra un texto que SÍ está aplicado: no sabría distinguir.');
  assert.equal(texto.includes('Texto que nadie ha aprobado jamas 9x7'), false,
    '🔴 el cruce encuentra un texto inventado: está diciendo que sí a todo.');
});

// ═══ ② LO QUE VIGILA ═════════════════════════════════════════════════════════════════════

test('SCRUM-514 · 🔴 TODO texto APROBADO está aplicado (salvo lo aparcado, con su motivo)', () => {
  const faltan = sinAplicar(poblacion(), corpus().texto);

  assert.deepEqual(faltan.map((f) => f.texto), [],
    '🔴 HAY TEXTO APROBADO QUE EL CÓDIGO NO PINTA TAL CUAL, Y NO SÉ POR QUÉ:\n    '
    + faltan.map((f) => `${JSON.stringify(f.texto)}\n        ${f.donde.join('\n        ')}`).join('\n    ')
    + '\n\n  En una ficha de `docs/microcopy/` toda línea de cita es un texto firmado, vaya bajo el '
    + 'encabezado que vaya (SCRUM-1334). De cada una de arriba no sé cuál de estas tres cosas es, y '
    + 'no la dejo pasar sin saberlo:\n'
    + '   · Un texto firmado que NO se ha aplicado: un profesional no lo está viendo. Se aplica '
    + '—copiándolo LITERAL, con sus tildes y su «…» de un solo carácter— o se aparca en `APARCADOS` '
    + 'con su motivo y quién lo desbloquea.\n'
    + '   · Un texto que el código COMPONE (un plural, un número) o tiene partido en dos literales: '
    + 'se declara en `NO_SE_CRUZAN` con el fichero y sus partes fijas.\n'
    + '   · Una NOTA, o un «qué había antes», escritos como cita: se les quita el `>` en la ficha. '
    + 'No se declaran aquí: con el `>` puesto, `constaAprobado` las sigue dando por firmadas.\n'
    + '  Y si la ficha es de OTRO equipo (`docs/equipo/dos-equipos.md` §3.3: el puesto que usa el texto), '
    + 'el `>` se lo quita su dueño: se le pide por Jira (§5). ⛔ No se añade a `NOTAS_AJENAS`: esa lista '
    + 'sólo baja.\n'
    + '  ⛔ No se cambia un texto firmado para que cruce (regla 39), ni se afloja esto (regla 41).');
});

test('SCRUM-1334 · 🔴 RECUENTO: el guard DICE lo que cruza y lo que no — «crucé N de M»', (t) => {
  const p = poblacion();
  const fichas = p.filter((c) => c.deFicha);
  const congelado = p.filter((c) => !c.deFicha);
  const de = (lista, caja) => lista.filter((c) => c.caja === caja).length;

  // Cada unidad está en UNA caja de las que el recuento nombra: nada se queda sin contar.
  const sinCaja = p.filter((c) => !CAJAS.includes(c.caja));
  assert.deepEqual(sinCaja.map((c) => c.texto), [], '🔴 hay unidades en una caja que el recuento no nombra.');

  // SEGUNDA SONDA, independiente del extractor: las líneas de cita, contadas a pelo sobre el
  // directorio. Si el extractor se dejara alguna fuera, su M sería menor y nadie lo vería.
  const dir = path.join(RAIZ, 'docs', 'microcopy');
  const nombres = fs.readdirSync(dir).filter((n) => n.endsWith('.md') && n !== 'README.md');
  const aPelo = nombres
    .flatMap((n) => fs.readFileSync(path.join(dir, n), 'utf8').split(/\r?\n/))
    .filter((l) => /^\s*>\s*\S/.test(l)).length;
  assert.equal(fichas.length, aPelo,
    `🔴 el extractor ve ${fichas.length} citas en las fichas y a pelo hay ${aPelo}: se está dejando `
    + 'citas fuera sin meterlas en ninguna caja, que es justo lo que SCRUM-1334 vino a cerrar.');

  const { texto } = corpus();
  const aparcados = new Set(APARCADOS.map((a) => a.texto));
  const enCruce = fichas.filter((c) => c.caja === 'cruce');
  const pintadas = enCruce.filter((c) => texto.includes(c.texto)).length;
  const aparcadas = enCruce.filter((c) => !texto.includes(c.texto) && aparcados.has(c.texto)).length;
  t.diagnostic(`SCRUM-514 · fichas: crucé ${enCruce.length} de ${fichas.length} citas de ${nombres.length} fichas `
    + `(${pintadas} pintadas tal cual, ${aparcadas} aparcadas con motivo, ${enCruce.length - pintadas - aparcadas} SIN SABER). `
    + `No cruzo: ${de(fichas, 'plantilla')} plantillas con huecos, ${de(fichas, 'declarada')} declaradas `
    + `(compuestas o partidas, con su prueba), ${de(fichas, 'corta')} de menos de 4 caracteres, `
    + `${de(fichas, 'ajena')} notas de OTRO EQUIPO que no sé cruzar (nombradas una a una en su caso, con su dueño).`);
  t.diagnostic(`SCRUM-514 · registro congelado: crucé ${de(congelado, 'cruce')} de ${congelado.length} textos. `
    + `No cruzo: ${de(congelado, 'plantilla')} plantillas, ${de(congelado, 'forma')} rutas o constantes, `
    + `${de(congelado, 'corta')} de menos de 4 caracteres.`);

  assert.ok(nombres.length >= 100 && fichas.length >= 200,
    `🔴 CIEGO: ${fichas.length} citas en ${nombres.length} fichas, y el 1-oct-2026 eran 248 en 101. `
    + 'Las fichas no se borran: un recuento que baja tanto es que no las estoy leyendo.');
});

test('SCRUM-1334 · 🔴 cada DECLARADA sigue en su ficha, sigue sin pintarse tal cual y sus partes fijas siguen en su fichero', () => {
  const { texto } = corpus();
  for (const d of NO_SE_CRUZAN) {
    assert.deepEqual(fallosDeDeclaracion(d, { leer: leerDelRepo, textoDelCorpus: texto }), [],
      `🔴 la declaración de «${d.texto.slice(0, 70)}» (${d.ficha}) ya no se sostiene. Una declaración `
      + 'que sobrevive a su prueba parece una decisión y no protege nada: o se corrige, o se borra.');
  }
  const claves = NO_SE_CRUZAN.map((d) => d.ficha + '\n' + d.texto);
  assert.equal(new Set(claves).size, claves.length, '🔴 hay una cita declarada dos veces.');
  assert.ok(NO_SE_CRUZAN.length > 0,
    '🔴 la lista de declaradas está vacía. Si de verdad no queda ninguna, este test se retira A MANO '
    + 'diciéndolo; no se deja una lista vacía por simetría.');
});

test('SCRUM-1334 · 🔴 cada NOTA AJENA sale NOMBRADA con su dueño, lleva motivo y fecha, y su ficha es de otro equipo (§3.3, medido)', (t) => {
  const { texto } = corpus();
  for (const d of NOTAS_AJENAS) {
    assert.deepEqual(fallosDeAjena(d, { leer: leerDelRepo, textoDelCorpus: texto, puestoDe: puestoDelRepo }), [],
      `🔴 la nota «${d.texto.slice(0, 70)}» (${d.ficha}) no puede estar en \`NOTAS_AJENAS\`. Esa lista `
      + 'nombra lo que este guard no sabe cruzar y es de OTRO equipo; no es donde se apaga un rojo.');
    const seccion = (poblacion().find((c) => c.caja === 'ajena' && c.ruta === 'docs/microcopy/' + d.ficha && c.texto === d.texto) || {}).seccion;
    t.diagnostic(`SCRUM-514 · NO CRUZO, y es del ${d.dueno} (${puestoDelRepo(d.usa)}, por ${d.usa}; declarada el ${d.fecha}): `
      + `docs/microcopy/${d.ficha} · sección «${seccion}» · ${JSON.stringify(d.texto)}`);
  }
  const claves = NOTAS_AJENAS.map((d) => d.ficha + '\n' + d.texto);
  assert.equal(new Set(claves).size, claves.length, '🔴 hay una nota ajena declarada dos veces.');
  // Ninguna se queda en la lista sin estar de verdad en esa caja: una entrada que no saca nada no nombra nada.
  assert.equal(poblacion().filter((c) => c.caja === 'ajena').length, NOTAS_AJENAS.length,
    '🔴 las notas ajenas que el extractor aparta no son las de la lista, una a una.');
});

test('SCRUM-1334 · 🔒 TRINQUETE: las notas ajenas de cada ficha sólo BAJAN, y ninguna ficha nueva entra', () => {
  const porFicha = {};
  for (const d of NOTAS_AJENAS) porFicha[d.ficha] = (porFicha[d.ficha] || 0) + 1;
  for (const ficha of new Set([...Object.keys(porFicha), ...Object.keys(TECHO_DE_AJENAS)])) {
    const hay = porFicha[ficha] || 0;
    const techo = TECHO_DE_AJENAS[ficha] || 0;
    assert.ok(hay <= techo,
      `🔴 ${ficha} tiene ${hay} notas declaradas ajenas y su techo es ${techo}. La lista NO CRECE: una nota `
      + 'nueva sin cruzar no se declara. Si es de este equipo se arregla; si es de otro, se le pide a su dueño '
      + '(`docs/equipo/dos-equipos.md` §5). ⛔ Subir el techo es aflojar el guard (regla 41).');
    assert.equal(hay, techo,
      `🔴 ${ficha} tiene ${hay} notas declaradas ajenas y su techo dice ${techo}. Ha BAJADO, que es lo que `
      + `tiene que pasar: baja su techo a ${hay} en este mismo commit (y quita la línea si es 0), para que no `
      + 'pueda volver a subir sin que nadie lo vea.');
  }
});

test('SCRUM-1334 · SUELO: las tablas de propiedad de dos-equipos.md §3 se leen, y dicen de quién es cada fichero', () => {
  const filas = filasDePropiedad(leerDelRepo(DOS_EQUIPOS) || '');
  assert.ok(filas.length >= 25,
    `🔴 CIEGO: sólo leo ${filas.length} filas de las tablas §3.1 y §3.2 de ${DOS_EQUIPOS}, y el 2-oct-2026 eran 33. `
    + 'Sin esas tablas no sé de quién es ninguna ficha. ¿Ha cambiado el formato de la tabla o el título de la sección?');
  // Un fichero de cada clase de fila, de los dos equipos: nombrado, por directorio y por el resto.
  assert.deepEqual([
    'public/dashboard/js/customersView.js',
    'public/dashboard/js/parteDetailView.js',
    'public/dashboard/js/app.js',
    'public/dashboard/index.html',
    'public/dashboard/js/quoteAtajosVencimiento.js',
    'src/modules/invoicing/domain/cerrojoSaturado.ts',
    'src/modules/billing/domain/invoiceWhatsApp.service.ts',
    'src/modules/billing/app/routes/charges.routes.ts',
    'src/modules/jobs/app/routes/jobs.routes.ts',
    'docs/microcopy/README.md',
  ].map(puestoDelRepo), ['J2', 'S4', 'S2', 'S2', 'S2', 'J1', 'J1', 'J2', 'S1', null],
  '🔴 las tablas de §3 ya no dicen lo que decían de estos ficheros. Si el reparto ha cambiado de verdad, '
  + 'este control se actualiza con él y se revisa `NOTAS_AJENAS`; si no, el lector se ha roto.');
});

test('SCRUM-514 · 🔴 cada APARCADO sigue sin aplicar, y lleva su motivo', () => {
  // Una excepción que sobrevive al motivo que la justificaba parece una decisión y ya no protege
  // nada (SCRUM-450). Si el texto SE APLICA, la entrada tiene que salir de aquí.
  const { texto } = corpus();
  for (const a of APARCADOS) {
    assert.ok(a.motivo && a.motivo.length > 60,
      `🔴 el aparcado «${a.texto}» no lleva motivo escrito, o es demasiado corto para revisarlo.`);
    assert.equal(texto.includes(a.texto), false,
      `🔴 «${a.texto}» YA ESTÁ APLICADO, así que esta excepción sobra: bórrala de \`APARCADOS\` `
      + '(no la dejes «por si acaso»: una lista que no se limpia deja de leerse).');
  }
  assert.ok(APARCADOS.length > 0,
    '🔴 la lista de aparcados está vacía. Si de verdad no queda ninguno, este test sobra y se '
    + 'retira A MANO diciéndolo; no se deja una lista vacía por simetría.');
});

// ═══ ③ CONTROL NEGATIVO ══════════════════════════════════════════════════════════════════

test('SCRUM-514 · CONTROL NEGATIVO: un texto NO aprobado no entra por estar en el código', () => {
  // El guard mira en una sola dirección: de la fuente al código. Que una frase exista en el
  // producto no la convierte en aprobada — para eso está SCRUM-402, que mira la otra mitad.
  const aprobados = textosAprobados();
  // Medido: este texto existe en el código y NO en la fuente (comprobado con grep antes de
  // elegirlo; el primero que probé sí estaba en la fuente y el control no probaba nada).
  assert.equal(aprobados.includes('Sin líneas.'), false,
    '🔴 un texto que sólo vive en el código aparece como «aprobado»: el extractor está leyendo '
    + 'algo que no son las tablas de la fuente.');
});

test('SCRUM-514 · CONTROL NEGATIVO: el extractor no se traga PROSA del registro', () => {
  // Es la diferencia con `literalesAprobados()` y lo que justifica no usarla aquí: sus 150
  // literales incluyen las notas en prosa del registro. Si esa prosa entrara, el guard nacería
  // rojo por texto que nadie pinta nunca — medido el 4-sep: 13 sin aplicar, ~11 de ellos notas.
  const prosa = prosaEnElCruce(citasAprobadas(), corpus().texto);
  assert.deepEqual(prosa, [],
    '🔴 ha entrado PROSA en el cruce:\n    '
    + prosa.map((p) => `${JSON.stringify(p.texto.slice(0, 50))} — ${p.porque}`).join('\n    ')
    + '\n\n  Son notas del registro, no copy de pantalla, y el guard se pondría rojo por algo que '
    + 'nadie pinta. Si es una nota, quítale el `>` en su ficha: una nota no va en cita. Si es un '
    + 'texto FIRMADO y largo (SCRUM-1329): va entero en UNA línea de cita, la línea de la firma '
    + 'nombra su comentario de Jira («… en SCRUM-n (comentario NNNNN)») y el código lo pinta tal '
    + 'cual. ⛔ No lo partas ni lo reescribas para que quepa: el texto manda sobre el instrumento.');
});

// ═══ ④ SCRUM-1329 · UNA CITA FIRMADA PUEDE SER LARGA; LA PROSA, NO ═══════════════════════════
//
// Fichas FABRICADAS en un directorio temporal (el lector las admite por `dir`): escribir un
// registro de mentira en `docs/microcopy/` lo vería cualquier otro guard que corra a la vez.

/** El literal que el fundador firmó en SCRUM-1258 comentario 17713, en UNA línea. */
const LITERAL_DE_1258 = 'Esta factura se selló como factura completa (F1) y el registro la declararía '
  + 'como simplificada (F2). El tipo forma parte de la huella y no puede cambiar después de sellar, '
  + 'así que queda fuera del registro.';

const FIRMA_CON_COMENTARIO = '**Aprobado por el fundador** el 1-oct-2026, en **SCRUM-1258** (comentario 17713).';
const FIRMA_SIN_COMENTARIO = '**Aprobado por el fundador** el 1-oct-2026, en **SCRUM-1258**.';

const fichaFabricada = (firma, citas) => [
  '# Ficha fabricada por el test', '', firma, '', '## Texto aprobado, literal', '',
  ...citas.flatMap((c) => ['> ' + c, '']),
].join('\n');

/** Las citas que el extractor saca de UNA ficha fabricada, sin registro congelado. */
function citasDeUnaFichaFabricada(md) {
  return poblacionDeUnaFichaFabricada(md).filter((c) => c.caja === 'cruce');
}

const FICHA_FABRICADA = '2026-10-01-SCRUM-1329-caso-fabricado.md';

/** TODO lo que el extractor saca de UNA ficha fabricada, cada unidad con su caja (SCRUM-1334). */
function poblacionDeUnaFichaFabricada(md, declaradas = [], ajenas = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum514-'));
  try {
    fs.writeFileSync(path.join(dir, FICHA_FABRICADA), md);
    return poblacion({ dir, congelado: path.join(dir, 'no-existe.md') }, declaradas, ajenas);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** El veredicto sobre UNA cita fabricada. Aborta si la cita no llegó al extractor (A21). */
function veredictoFabricado({ firma, cita, pintada }) {
  const citas = citasDeUnaFichaFabricada(fichaFabricada(firma, [cita]));
  assert.deepEqual(citas.map((c) => c.texto), [cita],
    '🔴 CIEGO: la cita fabricada no ha llegado al extractor; lo que diga este caso no vale.');
  return prosaEnElCruce(citas, pintada ? `const MOTIVO = '${cita}';` : 'const OTRA = 1;');
}

test('SCRUM-1329 · 🔴 el literal firmado de SCRUM-1258 (comentario 17713), en UNA línea, NO es prosa', () => {
  assert.ok(LITERAL_DE_1258.length > LARGO_DE_PROSA && !LITERAL_DE_1258.includes('\n'),
    `🔴 el caso ya no prueba nada: el literal mide ${LITERAL_DE_1258.length} y el umbral es ${LARGO_DE_PROSA}.`);
  assert.deepEqual(veredictoFabricado({ firma: FIRMA_CON_COMENTARIO, cita: LITERAL_DE_1258, pintada: true }), [],
    '🔴 una cita con firma que cuenta, con su comentario de Jira y PINTADA tal cual sale como prosa '
    + 'sólo por su longitud. Quien firme una frase larga tendría que partirla o reescribirla por una '
    + 'restricción del instrumento (SCRUM-1329).');
});

test('SCRUM-1329 · CONTROL: una nota larga dentro de una ficha FIRMADA sigue cayendo — nadie la pinta', () => {
  const nota = 'Esta nota explica por qué se eligió esta redacción y no la otra, qué se le enseñó al '
    + 'fundador antes de firmar y qué queda pendiente de decidir en la pantalla de exportación del registro.';
  assert.ok(nota.length > LARGO_DE_PROSA);
  const v = veredictoFabricado({ firma: FIRMA_CON_COMENTARIO, cita: nota, pintada: false });
  assert.equal(v.length, 1, '🔴 una nota larga que nadie pinta ha pasado por ir en una ficha firmada.');
  assert.match(v[0].porque, /NO SÉ/);
  assert.match(v[0].porque, /no está pintado/);
});

test('SCRUM-1329 · CONTROL: una prosa larga SIN FIRMA sigue cayendo, aunque esté en el código', () => {
  const v = veredictoFabricado({ firma: 'Pendiente de firma.', cita: LITERAL_DE_1258, pintada: true });
  assert.equal(v.length, 1, '🔴 un texto largo sin firma ha pasado: eso es relajar el guard.');
  assert.match(v[0].porque, /NO SÉ/);
  assert.match(v[0].porque, /firma que cuente/);
});

test('SCRUM-1329 · CONTROL: una firma que no es del fundador ni delegada no abre la puerta', () => {
  const v = veredictoFabricado({
    firma: '**Aprobado por el asesor** el 1-oct-2026, en **SCRUM-1258** (comentario 17713).',
    cita: LITERAL_DE_1258, pintada: true,
  });
  assert.equal(v.length, 1, '🔴 la firma de quien no puede aprobar ha dejado pasar un texto largo.');
  assert.match(v[0].porque, /firma que cuente/);
});

test('SCRUM-1329 · CONTROL: firmada y pintada, pero sin decir en qué comentario — el guard dice que NO SABE', () => {
  const v = veredictoFabricado({ firma: FIRMA_SIN_COMENTARIO, cita: LITERAL_DE_1258, pintada: true });
  assert.equal(v.length, 1, '🔴 una firma sin constancia localizable ha dejado pasar un texto largo.');
  assert.match(v[0].porque, /NO SÉ/);
  assert.match(v[0].porque, /comentario de Jira/);
});

test('SCRUM-1329 · CONTROL: el comentario nombrado en OTRA línea no respalda a la firma', () => {
  const md = fichaFabricada(FIRMA_SIN_COMENTARIO + '\n\nLa conversación está en el comentario 17713.', [LITERAL_DE_1258]);
  const v = prosaEnElCruce(citasDeUnaFichaFabricada(md), LITERAL_DE_1258);
  assert.equal(v.length, 1, '🔴 una referencia suelta en la prosa de la ficha ha contado como constancia de la firma.');
  assert.match(v[0].porque, /comentario de Jira/);
});

test('SCRUM-1329 · la firma DELEGADA, con su comentario, vale igual que la del fundador', () => {
  const firma = '**Aprobado por el orquestador por delegación del fundador** el 1-oct-2026 — SCRUM-1258 comentario 17713.';
  assert.deepEqual(veredictoFabricado({ firma, cita: LITERAL_DE_1258, pintada: true }), [],
    '🔴 la firma delegada completa no abre la puerta. ¿Sigue vigente la delegación en '
    + '`docs/equipo/limites-del-fundador.md`? Si el fundador la ha retirado, este caso se retira con ella.');
});

test('SCRUM-1329 · CONTROL: una celda larga del registro CONGELADO no tiene firma que mirar — NO SÉ', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum514-'));
  try {
    const congelado = path.join(dir, 'congelado.md');
    fs.writeFileSync(congelado, [
      FIRMA_CON_COMENTARIO, '', '| ranura | texto aprobado |', '|---|---|', '| R1 | `' + LITERAL_DE_1258 + '` |', '',
    ].join('\n'));
    const citas = citasAprobadas({ dir: path.join(dir, 'sin-fichas'), congelado });
    assert.deepEqual(citas.map((c) => c.texto), [LITERAL_DE_1258], '🔴 CIEGO: la celda fabricada no llegó al extractor.');
    const v = prosaEnElCruce(citas, LITERAL_DE_1258);
    assert.equal(v.length, 1, '🔴 una firma escrita en el registro congelado ha respaldado a una celda suya.');
    assert.match(v[0].porque, /comentario de Jira/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('SCRUM-1329 · CONTROL: la negrita de Markdown sigue siendo prosa, con firma y pintada', () => {
  const v = veredictoFabricado({ firma: FIRMA_CON_COMENTARIO, cita: '⚠️ **Ojo:** esto es una nota.', pintada: true });
  assert.equal(v.length, 1, '🔴 una nota con negrita ha entrado en el cruce.');
  assert.match(v[0].porque, /negrita/);
});

test('SCRUM-1329 · CONTROL: el umbral no se ha movido — sin firma, LARGO_DE_PROSA pasa y uno más cae', () => {
  assert.equal(LARGO_DE_PROSA, 160, '🔴 el umbral de la prosa ha cambiado. No se sube ni se baja para que pase un caso.');
  const justo = 'a'.repeat(LARGO_DE_PROSA);
  assert.deepEqual(veredictoFabricado({ firma: 'Pendiente de firma.', cita: justo, pintada: false }), []);
  assert.equal(veredictoFabricado({ firma: 'Pendiente de firma.', cita: justo + 'a', pintada: false }).length, 1);
});

// ═══ ⑤ SCRUM-1334 · NINGÚN ENCABEZADO DECIDE QUÉ SE CRUZA ═══════════════════════════════════
//
// Hasta el 1-oct-2026 sólo se cruzaban las citas bajo un encabezado «Texto aprobado»: 110 de 248.
// Las demás no se miraban, y no lo decía nadie. Aquí se prueba lo contrario con fichas fabricadas
// —toda cita entra, lo que no se pinta sale en rojo diciendo dónde— y con el caso real que lo
// destapó: la cita de 276 caracteres de SCRUM-1247, bajo «Textos aprobados, literales».

const fichaConTitulo = (titulo, lineas) => [
  '# Ficha fabricada por el test', '', FIRMA_CON_COMENTARIO, '',
  ...(titulo === null ? [] : ['## ' + titulo, '']),
  ...lineas.flatMap((l) => [l, '']),
].join('\n');

const TITULOS_QUE_NO_DECIDEN = [
  'Texto aprobado, literal',
  'Textos aprobados, literales',
  'Los literales, tal cual se pintan',
  'Formato aprobado, literal',
  'Dónde se pinta',
  'Un título que nadie ha previsto',
  null, // la cita va antes de cualquier encabezado
];

test('SCRUM-1334 · 🔴 una cita entra en el cruce vaya bajo el encabezado que vaya, o bajo ninguno', () => {
  for (const titulo of TITULOS_QUE_NO_DECIDEN) {
    const p = poblacionDeUnaFichaFabricada(fichaConTitulo(titulo, ['> Guardar los cambios del taller']));
    assert.deepEqual(p.map((c) => [c.texto, c.caja]), [['Guardar los cambios del taller', 'cruce']],
      `🔴 bajo ${titulo === null ? 'ningún encabezado' : `«${titulo}»`} la cita no entra en el cruce: el `
      + 'título del apartado vuelve a decidir qué se mira, y un texto firmado puede quedarse sin '
      + 'comprobar sólo por cómo tituló su ficha quien la escribió.');
  }
});

test('SCRUM-1334 · 🔴 TESTIGO REAL: la cita de 276 caracteres de SCRUM-1247 («Textos aprobados», en plural) se cruza', () => {
  const suyas = poblacion().filter((c) => c.ruta === 'docs/microcopy/2026-09-28-SCRUM-1247-rotulo-ia.md');
  const larga = suyas.filter((c) => c.texto.length > LARGO_DE_PROSA);
  assert.deepEqual(larga.map((c) => [c.texto.length, c.seccion, c.caja]), [[276, 'Textos aprobados, literales', 'cruce']],
    '🔴 la cita larga de SCRUM-1247 no está en el cruce. Es el caso que destapó el defecto: pasaba '
    + 'sin que nadie la mirase porque su encabezado dice «Textos aprobados», en plural.');
  const { texto } = corpus();
  assert.deepEqual(prosaEnElCruce(larga, texto), [],
    '🔴 la cita larga de SCRUM-1247 está firmada, nombra su comentario y está pintada: no es prosa.');
  // Y el cruce la mira DE VERDAD: sin el código delante, cae por no estar pintada.
  const sinCodigo = prosaEnElCruce(larga, 'const OTRA = 1;');
  assert.equal(sinCodigo.length, 1, '🔴 la cita larga pasa aunque el código no la pinte: nadie la está cruzando.');
  assert.match(sinCodigo[0].porque, /no está pintado/);
});

test('SCRUM-1334 · 🔴 una cita que el código NO pinta, bajo un título cualquiera, sale en rojo y dice dónde', () => {
  const p = poblacionDeUnaFichaFabricada(fichaConTitulo('Un título que nadie ha previsto', ['> Guardar los cambios del taller']));
  const faltan = sinAplicar(p, 'const OTRA = 1;', []);
  assert.deepEqual(faltan.map((f) => f.texto), ['Guardar los cambios del taller'],
    '🔴 una cita de una ficha firmada que el código no pinta ha pasado en silencio.');
  assert.match(faltan[0].donde[0], /caso-fabricado\.md · sección «Un título que nadie ha previsto»/);
  // CONTROL: la misma cita, pintada, no sale.
  assert.deepEqual(sinAplicar(p, "boton.textContent = 'Guardar los cambios del taller';", []), []);
  // CONTROL: y aparcada con su motivo, tampoco.
  assert.deepEqual(sinAplicar(p, 'const OTRA = 1;', [{ texto: 'Guardar los cambios del taller' }]), []);
});

test('SCRUM-1334 · CONTROL: la prosa de una ficha que NO va en cita sigue sin pasar por texto aprobado', () => {
  const p = poblacionDeUnaFichaFabricada(fichaConTitulo('Textos aprobados, literales', [
    'Este párrafo explica por qué se eligió la redacción y no es un texto de pantalla.',
    '- Una viñeta con «Texto entre comillas» tampoco es una cita.',
    '| ranura | texto aprobado |', '|---|---|', '| R1 | `Texto de una tabla de la ficha` |',
    '`Texto en comillas de código`',
    '> Guardar los cambios del taller',
  ]));
  assert.deepEqual(p.map((c) => c.texto), ['Guardar los cambios del taller'],
    '🔴 ha entrado en la población algo que no es una línea de cita. Abrir el cruce a todas las '
    + 'secciones no es abrirlo a toda la ficha: sólo la cita `>` es un texto aprobado.');
});

test('SCRUM-1334 · CONTROL: lo que ya se cruzaba por su título se sigue cruzando, entero', () => {
  // El criterio de ANTES, escrito aparte y a propósito con otro código: las citas de 4 caracteres o
  // más, sin huecos, bajo un encabezado que diga «Texto aprobado».
  const antes = new Set();
  for (const ap of aprobacionesDeMicrocopy()) {
    if (ap.origen !== 'fichero') continue;
    let dentro = false;
    for (const linea of ap.texto.split(/\r?\n/)) {
      if (/^#{1,6}\s/.test(linea)) { dentro = /texto\s+aprobado/i.test(linea); continue; }
      const m = /^>\s?(.+)$/.exec(linea.trim());
      if (dentro && m && m[1].trim().length >= 4 && !/{[^}]+}/.test(m[1])) antes.add(m[1].trim());
    }
  }
  assert.ok(antes.size >= 90,
    `🔴 CIEGO: el criterio de antes sólo encuentra ${antes.size} textos, y el 1-oct-2026 eran más de cien.`);
  const ahora = new Set(textosAprobados());
  const perdidos = [...antes].filter((t) => !ahora.has(t));
  assert.deepEqual(perdidos, [],
    '🔴 hay textos que se cruzaban por ir bajo «Texto aprobado» y ya no se cruzan. Ensanchar la '
    + 'población no puede sacar a ninguno.');
  assert.ok(ahora.size > antes.size,
    `🔴 el cruce no ha crecido (${antes.size} antes, ${ahora.size} ahora): se sigue mirando sólo lo de antes.`);
});

test('SCRUM-1334 · una plantilla y una cita corta siguen fuera del cruce, y ahora constan en su caja', () => {
  const p = poblacionDeUnaFichaFabricada(fichaConTitulo('Los literales, tal cual se pintan', [
    '> Hola {nombre}, gracias por tu visita', '> Sí', '>', '> Guardar los cambios del taller',
  ]));
  assert.deepEqual(p.map((c) => [c.texto, c.caja]), [
    ['Hola {nombre}, gracias por tu visita', 'plantilla'],
    ['Sí', 'corta'],
    ['Guardar los cambios del taller', 'cruce'],
  ]);
});

// ── Las declaradas: una declaración sin prueba no saca nada del cruce ───────────────────────────

const CITA_COMPUESTA = '3 partes firmados de 2 clientes';
const DECLARACION_FABRICADA = {
  ficha: FICHA_FABRICADA, clase: 'compuesta', fichero: 'src/fabricado.ts',
  partes: [dato('3'), ' ', 'partes firmados', ' de ', dato('2'), ' ', 'clientes'],
  texto: CITA_COMPUESTA,
  motivo: 'Declaración fabricada por el test: el código compone el detalle con sus plurales y dos números.',
};
const REPO_FABRICADO = {
  ['docs/microcopy/' + FICHA_FABRICADA]: fichaConTitulo('Los literales, tal cual se pintan', ['> ' + CITA_COMPUESTA]),
  'src/fabricado.ts': "const d = `${n} ${n === 1 ? 'parte firmado' : 'partes firmados'} de ${c} ${c === 1 ? 'cliente' : 'clientes'}`;",
};
const fallosFabricados = (cambios = {}, repo = REPO_FABRICADO) => fallosDeDeclaracion(
  { ...DECLARACION_FABRICADA, ...cambios },
  { leer: (ruta) => (ruta in repo ? repo[ruta] : null), textoDelCorpus: repo['src/fabricado.ts'] || '' },
);

test('SCRUM-1334 · una cita declarada sale del cruce SÓLO en su ficha: la declaración no es del texto', () => {
  const md = REPO_FABRICADO['docs/microcopy/' + FICHA_FABRICADA];
  assert.deepEqual(poblacionDeUnaFichaFabricada(md, [DECLARACION_FABRICADA]).map((c) => c.caja), ['declarada']);
  assert.deepEqual(
    poblacionDeUnaFichaFabricada(md, [{ ...DECLARACION_FABRICADA, ficha: '2026-01-01-SCRUM-000-otra-ficha.md' }]).map((c) => c.caja),
    ['cruce'],
    '🔴 una declaración hecha para otra ficha ha sacado del cruce a esta cita: se declara por ficha Y '
    + 'texto, o el mismo texto firmado en otro sitio dejaría de mirarse.');
  assert.deepEqual(poblacionDeUnaFichaFabricada(md, []).map((c) => c.caja), ['cruce']);
});

test('SCRUM-1334 · una declaración con su prueba vale; sin ella, dice qué le falta', () => {
  assert.deepEqual(fallosFabricados(), [], '🔴 la declaración fabricada completa no vale: el caso no prueba nada.');

  const caso = (cambios, repo, patron) => {
    const f = fallosFabricados(cambios, repo);
    assert.ok(f.some((x) => patron.test(x)), `🔴 esperaba un fallo ${patron} y hay: ${JSON.stringify(f)}`);
  };
  // La parte fija ya no está en el fichero: el código cambió y la declaración se quedó.
  caso({}, { ...REPO_FABRICADO, 'src/fabricado.ts': 'const d = `${n} albaranes de ${c} clientes`;' }, /"partes firmados" ya no está en/);
  // El fichero donde se compone ya no existe.
  caso({ fichero: 'src/retirado.ts' }, REPO_FABRICADO, /no existe: src\/retirado\.ts/);
  // La ficha ya no tiene esa cita.
  caso({}, { ...REPO_FABRICADO, ['docs/microcopy/' + FICHA_FABRICADA]: fichaConTitulo('X', ['> Otra cosa distinta']) }, /ya no tiene esa cita/);
  // El código ya la pinta tal cual: la declaración sobra.
  caso({}, { ...REPO_FABRICADO, 'src/fabricado.ts': REPO_FABRICADO['src/fabricado.ts'] + ` const e = '${CITA_COMPUESTA}';` }, /YA la pinta tal cual/);
  // Sin motivo que se pueda revisar.
  caso({ motivo: 'Porque sí.' }, REPO_FABRICADO, /no lleva motivo/);
  // Una clase inventada.
  caso({ clase: 'nota' }, REPO_FABRICADO, /clase desconocida/);
  // «Partida» con un dato dentro no es una cita partida: es una compuesta mal declarada.
  caso({ clase: 'partida' }, REPO_FABRICADO, /cita partida son dos o más partes fijas/);
});

test('SCRUM-1334 · CONTROL: una NOTA no cuela como «compuesta» metiéndola entera en un dato', () => {
  const nota = 'Esta nota explica por qué la cifra sale así de la bandeja';
  const f = fallosDeDeclaracion(
    { ficha: FICHA_FABRICADA, clase: 'compuesta', fichero: 'src/fabricado.ts', partes: [dato(nota), ' de ', 'clientes'],
      texto: nota + ' de clientes', motivo: DECLARACION_FABRICADA.motivo },
    { leer: (ruta) => (ruta === 'src/fabricado.ts' ? REPO_FABRICADO[ruta] : fichaConTitulo('X', ['> ' + nota + ' de clientes'])),
      textoDelCorpus: REPO_FABRICADO['src/fabricado.ts'] },
  );
  assert.ok(f.some((x) => /no es un dato/.test(x)),
    `🔴 una frase entera ha pasado por «dato»: así cualquier nota se declara compuesta. Fallos: ${JSON.stringify(f)}`);
  // Y sin ninguna parte fija de verdad, tampoco.
  const g = fallosFabricados({ partes: [dato('3'), ' ', dato('2')], texto: '3 2' },
    { ...REPO_FABRICADO, ['docs/microcopy/' + FICHA_FABRICADA]: fichaConTitulo('X', ['> 3 2']) });
  assert.ok(g.some((x) => /ninguna parte fija/.test(x)), `🔴 una declaración sin partes fijas ha valido: ${JSON.stringify(g)}`);
});

// ── Las notas ajenas: nombrar no es perdonar ────────────────────────────────────────────────────
//
// Una ficha fabricada con UN texto que su pantalla pinta y UNA nota escrita como cita. La pantalla
// es un fichero de mentira; de quién es lo contesta un reparto fabricado, salvo en el caso que lo
// pregunta a las tablas de verdad.

const TEXTO_PINTADO = 'Guardar los cambios del taller';
const NOTA_EN_CITA = 'Esta nota cuenta qué se veía antes y nadie la pinta';
const AJENA_FABRICADA = {
  ficha: FICHA_FABRICADA, texto: NOTA_EN_CITA, dueno: 'equipo de Luis', fecha: '2026-10-02',
  usa: 'public/dashboard/js/fabricadoView.js',
  motivo: 'Nota fabricada por el test: un «qué había antes» escrito como cita en una ficha de otro equipo.',
};
const REPO_CON_NOTA = {
  ['docs/microcopy/' + FICHA_FABRICADA]: fichaConTitulo('Qué había antes', ['> ' + TEXTO_PINTADO, '> ' + NOTA_EN_CITA]),
  'public/dashboard/js/fabricadoView.js': `boton.textContent = '${TEXTO_PINTADO}';`,
};
const REPARTO_FABRICADO = filasDePropiedad([
  '### 3.1 · Servidor', '', '| ruta | dueño | nota |', '|---|---|---|',
  '| `src/modules/cobros/**` | **J2** | |',
  '| todo lo demás de `src/` | **S1** | |',
  '### 3.2 · Pantallas', '', '| ruta | dueño | nota |', '|---|---|---|',
  '| `dashboard/js/fabricadoView.js`, `otraView.js` | **S4** | |',
  '| `dashboard/js/clientesView.js` | **J2** | |',
  '| `dashboard/js/homeView.js` y todo lo demás de `public/` | **S2** | |',
  '### 3.3 · Repositorio', '', '| `docs/microcopy/` | **S4** | |',
].join('\n'));
const fallosDeAjenaFabricada = (cambios = {}, repo = REPO_CON_NOTA, puestoDe = (r) => puestoSegun(REPARTO_FABRICADO, r)) => fallosDeAjena(
  { ...AJENA_FABRICADA, ...cambios },
  { leer: (ruta) => (ruta in repo ? repo[ruta] : null), textoDelCorpus: Object.entries(repo).filter(([r]) => !r.startsWith('docs/')).map(([, t]) => t).join('\n'), puestoDe },
);

test('SCRUM-1334 · el lector del reparto: gana la ruta nombrada, luego el directorio, y al final el resto', () => {
  const de = (r) => puestoSegun(REPARTO_FABRICADO, r);
  assert.equal(REPARTO_FABRICADO.length, 5, '🔴 CIEGO: el reparto fabricado no se ha leído entero (y §3.3 no es parte de él).');
  assert.deepEqual([
    de('public/dashboard/js/fabricadoView.js'), de('public/dashboard/js/otraView.js'), de('public/dashboard/js/clientesView.js'),
    de('public/dashboard/js/cualquierOtra.js'), de('src/modules/cobros/domain/x.ts'), de('src/modules/jobs/x.ts'), de('docs/microcopy/x.md'),
  ], ['S4', 'S4', 'J2', 'S2', 'J2', 'S1', null]);
  // Un nombre que sólo ACABA igual no es ese fichero: `miotraView.js` no es `otraView.js`.
  assert.equal(de('public/dashboard/js/miotraView.js'), 'S2');
});

test('SCRUM-1334 · una nota ajena con sus tres cosas y su propiedad medida vale; sin ellas, dice qué le falta', () => {
  assert.deepEqual(fallosDeAjenaFabricada(), [], '🔴 la nota ajena fabricada completa no vale: el caso no prueba nada.');

  const caso = (cambios, repo, patron) => {
    const f = fallosDeAjenaFabricada(cambios, repo);
    assert.ok(f.some((x) => patron.test(x)), `🔴 esperaba un fallo ${patron} y hay: ${JSON.stringify(f)}`);
  };
  // Las tres de toda excepción: sin una, es una promesa.
  caso({ motivo: 'Porque sí.' }, REPO_CON_NOTA, /no lleva motivo/);
  caso({ fecha: undefined }, REPO_CON_NOTA, /no lleva la fecha/);
  caso({ fecha: 'ayer' }, REPO_CON_NOTA, /no lleva la fecha/);
  caso({ dueno: undefined }, REPO_CON_NOTA, /no lleva dueño/);
  // Este equipo no puede ser el dueño de una nota «ajena».
  caso({ dueno: 'equipo de Javier' }, REPO_CON_NOTA, /su dueño no es otro equipo/);
  // Su dueño le quitó el `>`: la entrada sobra, y hay que borrarla.
  caso({}, { ...REPO_CON_NOTA, ['docs/microcopy/' + FICHA_FABRICADA]: fichaConTitulo('Qué había antes', ['> ' + TEXTO_PINTADO, NOTA_EN_CITA]) }, /la entrada SOBRA/);
  // No era una nota: el código la pinta.
  caso({}, { ...REPO_CON_NOTA, 'src/otro.ts': `const m = '${NOTA_EN_CITA}';` }, /se cruza solo/);
  // Sin decir quién usa el texto, o diciendo un fichero que no existe, o uno que no pinta nada de la ficha.
  caso({ usa: undefined }, REPO_CON_NOTA, /no dice qué fichero USA/);
  caso({ usa: 'public/dashboard/js/retirada.js' }, REPO_CON_NOTA, /no existe: public\/dashboard\/js\/retirada\.js/);
  caso({ usa: 'public/dashboard/js/otraView.js' }, { ...REPO_CON_NOTA, 'public/dashboard/js/otraView.js': 'const OTRA = 1;' }, /no pinta ninguna cita de esa ficha/);
});

test('SCRUM-1334 · 🔴 una nota de una ficha de ESTE equipo no se puede declarar ajena: se arregla', () => {
  // La misma ficha, pero su texto lo pinta una pantalla de J2.
  const repo = { ['docs/microcopy/' + FICHA_FABRICADA]: REPO_CON_NOTA['docs/microcopy/' + FICHA_FABRICADA],
    'public/dashboard/js/clientesView.js': `boton.textContent = '${TEXTO_PINTADO}';` };
  const f = fallosDeAjenaFabricada({ usa: 'public/dashboard/js/clientesView.js' }, repo);
  assert.equal(f.length, 1, `🔴 esperaba un solo fallo y hay: ${JSON.stringify(f)}`);
  assert.match(f[0], /es de J2: la ficha es del equipo de Javier, no del equipo de Luis/);
  assert.match(f[0], /se ARREGLA/);
  // Y si el reparto no dice de quién es el fichero, no se da por ajena: CIEGO.
  const g = fallosDeAjenaFabricada({}, REPO_CON_NOTA, () => null);
  assert.ok(g.some((x) => /CIEGO/.test(x) && /no dice de qué puesto/.test(x)), `🔴 un fichero sin dueño conocido ha valido como ajeno: ${JSON.stringify(g)}`);
});

test('SCRUM-1334 · 🔴 CONTROL REAL: con las tablas de verdad, una ficha cuyo texto usa un fichero de J1 no es ajena', () => {
  // `cerrojoSaturado.ts` vive en `src/modules/invoicing/`, que §3.1 da a J1. Medido el 2-oct-2026: es
  // el único fichero que pinta el texto de la ficha de SCRUM-728, y por eso su nota NO está en la lista.
  const usa = 'src/modules/invoicing/domain/cerrojoSaturado.ts';
  const repo = { ['docs/microcopy/' + FICHA_FABRICADA]: REPO_CON_NOTA['docs/microcopy/' + FICHA_FABRICADA], [usa]: `export const MSG = '${TEXTO_PINTADO}';` };
  const f = fallosDeAjenaFabricada({ usa }, repo, puestoDelRepo);
  assert.equal(f.length, 1, `🔴 esperaba un solo fallo y hay: ${JSON.stringify(f)}`);
  assert.match(f[0], /es de J1: la ficha es del equipo de Javier/);
  // El mismo caso con un fichero de S4 de verdad, vale: el instrumento sabe decir que sí.
  const suyo = 'public/dashboard/js/parteDetailView.js';
  assert.deepEqual(fallosDeAjenaFabricada({ usa: suyo }, { ...repo, [suyo]: repo[usa] }, puestoDelRepo), []);
});

test('SCRUM-1334 · una nota ajena sale del cruce SÓLO en su ficha, y sin declarar cae diciendo dónde', () => {
  const md = REPO_CON_NOTA['docs/microcopy/' + FICHA_FABRICADA];
  const cajas = (ajenas) => poblacionDeUnaFichaFabricada(md, [], ajenas).map((c) => [c.texto, c.caja]);
  assert.deepEqual(cajas([AJENA_FABRICADA]), [[TEXTO_PINTADO, 'cruce'], [NOTA_EN_CITA, 'ajena']]);
  assert.deepEqual(cajas([{ ...AJENA_FABRICADA, ficha: '2026-01-01-SCRUM-000-otra-ficha.md' }]), [[TEXTO_PINTADO, 'cruce'], [NOTA_EN_CITA, 'cruce']],
    '🔴 una nota declarada para otra ficha ha salido del cruce en ésta: se nombra por ficha Y texto.');
  // Sin declarar —que es como nace una nota NUEVA, en la ficha de quien sea— no pasa callada.
  const faltan = sinAplicar(poblacionDeUnaFichaFabricada(md, [], []), REPO_CON_NOTA['public/dashboard/js/fabricadoView.js'], []);
  assert.deepEqual(faltan.map((x) => x.texto), [NOTA_EN_CITA]);
  assert.match(faltan[0].donde[0], /caso-fabricado\.md · sección «Qué había antes»/);
});

test('SCRUM-1334 · CONTROL: «nota ajena» es de las FICHAS: no saca nada del registro congelado', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum514-'));
  try {
    const congelado = path.join(dir, 'congelado.md');
    fs.writeFileSync(congelado, ['| ranura | texto aprobado |', '|---|---|', '| R1 | `' + NOTA_EN_CITA + '` |', ''].join('\n'));
    const p = poblacion({ dir: path.join(dir, 'sin-fichas'), congelado }, [], [{ ...AJENA_FABRICADA, ficha: 'MICROCOPY_APROBADA_SIN_APLICAR.md' }]);
    assert.deepEqual(p.map((c) => [c.texto, c.caja]), [[NOTA_EN_CITA, 'cruce']],
      '🔴 una celda del registro congelado ha salido del cruce por «nota ajena»: el congelado no es de ningún equipo.');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('SCRUM-514 · CONTROL NEGATIVO: el extractor no se traga rutas ni constantes', () => {
  const t = textosAprobados();
  const basura = t.filter((x) => /^[A-Z_]{4,}$/.test(x) || /\.(js|ts|md)$/.test(x));
  assert.deepEqual(basura, [],
    `🔴 el extractor ha metido cosas que no son copy: ${basura.join(', ')}. Con ruido dentro, el `
    + 'guard acabaría rojo por un nombre de fichero y alguien lo apagaría.');
});
