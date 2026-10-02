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
 *   · un fichero de aprobación → las CITAS bajo el encabezado «Texto aprobado».
 * Las citas se limitan a esa sección a propósito: el registro está lleno de notas en `>` que no
 * son copy, y meterlas convertiría el guard en ruido.
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
function citasAprobadas(opciones) {
  const out = [];
  for (const ap of aprobacionesDeMicrocopy(opciones)) {
    const deFicha = ap.origen === 'fichero';
    const procedencia = {
      ruta: ap.ruta,
      firmaQueCuenta: ap.aprobada === true,
      comentario: deFicha ? comentarioDeLaFirma(ap.texto) : null,
    };
    for (const texto of (deFicha ? citasDeTextoAprobado(ap.texto) : celdasDeTabla(ap.texto))) {
      out.push({ texto, ...procedencia });
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

/** Las citas `> …` que van bajo un encabezado «Texto aprobado». */
function citasDeTextoAprobado(md) {
  const out = [];
  let dentro = false;
  for (const linea of md.split('\n')) {
    if (/^#{1,6}\s/.test(linea)) { dentro = /texto\s+aprobado/i.test(linea); continue; }
    if (!dentro) continue;
    const m = /^>\s?(.+)$/.exec(linea.trim());
    if (!m || m[1].trim().length < 4) continue;
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
    if (/{[^}]+}/.test(m[1])) continue;
    out.push(m[1].trim());
  }
  return out;
}

/** La última columna de las tablas del registro congelado. */
function celdasDeTabla(md) {
  const out = new Set();
  for (const linea of md.split('\n')) {
    const t0 = linea.trim();
    if (!t0.startsWith('|') || /^\|\s*-+/.test(t0)) continue;
    const celdas = t0.split('|').map((c) => c.trim()).filter(Boolean);
    const ultima = celdas[celdas.length - 1] || '';
    for (const m of ultima.matchAll(/`([^`]+)`/g)) {
      const t = m[1].trim();
      if (t.length < 4) continue;
      if (/^[\w.\-/]+\.(js|ts|md)/.test(t)) continue;      // rutas de fichero
      if (/^[A-Z_]{4,}$/.test(t)) continue;                 // constantes
      if (!/[ áéíóúñÁÉÍÓÚÑ]/.test(t) && t.length < 8) continue;
      // 🔴 Las PLANTILLAS se quedan fuera del cruce, y no es una excepción de conveniencia: un
      // texto como `{N} facturas` NUNCA aparece literal en el código porque el código lo
      // COMPONE (`n + ' facturas'`). Buscarlo tal cual daría un rojo permanente por algo que sí
      // está aplicado — medido: `libroRegistroView.js:49`. Lo que el guard puede afirmar de una
      // plantilla es que su parte fija esté, y eso ya lo cubre el resto de la fila.
      if (/{[^}]+}/.test(t)) continue;
      out.add(t);
    }
  }
  return [...out];
}

/** Todo el código donde puede vivir un texto de pantalla. */
function corpus() {
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
  return { texto: ficheros.map((f) => fs.readFileSync(f, 'utf8')).join('\n'), cuantos: ficheros.length };
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
    texto: 'Válido hasta dentro de 7 días',
    motivo: 'CONSTRUIDO Y SIN CABLEAR (SCRUM-605, 4-sep-2026). El nombre accesible existe en '
      + '`quoteAtajosVencimiento.js` (`nombreAccesibleDeAtajo`) pero la vista pone el MISMO '
      + 'texto en el rotulo y en el `aria-label` con una sola llamada, asi que cablearlo es UNA '
      + 'linea en `quotesView.js` — fichero de otro carril en vuelo (SCRUM-594). Lo desbloquea '
      + 'esa sesion al '
      + 'liberar el fichero; el commit que lo cablee borra estas tres entradas.',
  },
  {
    texto: 'Válido hasta dentro de 14 días',
    motivo: 'CONSTRUIDO Y SIN CABLEAR (SCRUM-605, 4-sep-2026). El nombre accesible existe en '
      + '`quoteAtajosVencimiento.js` (`nombreAccesibleDeAtajo`) pero la vista pone el MISMO '
      + 'texto en el rotulo y en el `aria-label` con una sola llamada, asi que cablearlo es UNA '
      + 'linea en `quotesView.js` — fichero de otro carril en vuelo (SCRUM-594). Lo desbloquea '
      + 'esa sesion al '
      + 'liberar el fichero; el commit que lo cablee borra estas tres entradas.',
  },
  {
    texto: 'Válido hasta dentro de 30 días',
    motivo: 'CONSTRUIDO Y SIN CABLEAR (SCRUM-605, 4-sep-2026). El nombre accesible existe en '
      + '`quoteAtajosVencimiento.js` (`nombreAccesibleDeAtajo`) pero la vista pone el MISMO '
      + 'texto en el rotulo y en el `aria-label` con una sola llamada, asi que cablearlo es UNA '
      + 'linea en `quotesView.js` — fichero de otro carril en vuelo (SCRUM-594). Lo desbloquea '
      + 'esa sesion al '
      + 'liberar el fichero; el commit que lo cablee borra estas tres entradas.',
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
  const { texto } = corpus();
  const aparcados = new Set(APARCADOS.map((a) => a.texto));
  const sinAplicar = textosAprobados()
    .filter((t) => !texto.includes(t))
    .filter((t) => !aparcados.has(t));

  assert.deepEqual(sinAplicar, [],
    '🔴 HAY TEXTO APROBADO QUE NO LLEGA A LA PANTALLA:\n    '
    + sinAplicar.map((t) => JSON.stringify(t)).join('\n    ')
    + `\n\n  El fundador lo firmó y un profesional no lo está viendo. O se aplica —copiándolo de `
    + 'la aprobación LITERAL, con sus tildes y su «…» de un solo carácter— o se aparca AQUÍ con su '
    + 'motivo y quién lo desbloquea. Lo que no vale es dejarlo sin decidir: eso es lo que estuvo '
    + 'tres semanas pasando.');
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
    + 'nadie pinta. Si es una nota, sácala de la sección «Texto aprobado» de su ficha. Si es un '
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum514-'));
  try {
    fs.writeFileSync(path.join(dir, '2026-10-01-SCRUM-1329-caso-fabricado.md'), md);
    return citasAprobadas({ dir, congelado: path.join(dir, 'no-existe.md') });
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

test('SCRUM-514 · CONTROL NEGATIVO: el extractor no se traga rutas ni constantes', () => {
  const t = textosAprobados();
  const basura = t.filter((x) => /^[A-Z_]{4,}$/.test(x) || /\.(js|ts|md)$/.test(x));
  assert.deepEqual(basura, [],
    `🔴 el extractor ha metido cosas que no son copy: ${basura.join(', ')}. Con ruido dentro, el `
    + 'guard acabaría rojo por un nombre de fichero y alguien lo apagaría.');
});
