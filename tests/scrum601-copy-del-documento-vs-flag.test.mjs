// tests/scrum601-copy-del-documento-vs-flag.test.mjs — SCRUM-601 (DOC-11)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL COPY DEL DOCUMENTO, ¿ES FUNCIÓN DEL FLAG O ESTÁ ESCRITO A PELO?
//
// LA VÍCTIMA, medida y reproducible sin BD (ver `tests/scrum601-*` y el parte del ticket):
// para un merchant ES real —`country: 'ES'`, sin override— con `INVOICING_ES_ENABLED` en su
// valor por defecto:
//
//     isFlagEnabled            → false
//     getEmissionMode          → 'receipt'
//     modoDocumentoSuelto      → 'justificante'
//
// El botón de la pantalla de Facturas SÍ lo seguía: decía «+ Nuevo justificante»
// (`invoicesView.js`, elegido por `window.appDocumentoSuelto`). El modal que ese botón ABRE, no:
// su título era «Nueva factura» y su botón primario «Emitir factura», los dos escritos a pelo.
//
// O sea que el profesional pulsaba un botón que le prometía un justificante y se le abría una
// ventana que le decía que iba a emitir una factura. En la MISMA pantalla y en el MISMO gesto.
//
// ⚠️ SCRUM-601 MIDIÓ Y NO TOCÓ (regla 30: el microcopy lo firma el asesor): dejó el defecto ATADO
// para que no pudiera crecer en silencio.
//
// ✅ SCRUM-776 LO CERRÓ, con los textos ya firmados (asesor, 6-sep-2026). Siete rótulos derivan
// ahora de `rotulosDelDocumento`, y este fichero se queda como LA RED que lo sostiene: el
// veredicto anclado, el censo que no puede encogerse en silencio y el trinquete —que bajó de
// SEIS entradas a UNA—. La que queda es el `aria-label` del selector de cliente, que el asesor
// NO firmó a propósito porque «cliente al que justificas» no existe en castellano.
//
// 🔴 Este fichero se lee HOY, no el día que se escribió: si vuelve a describir un árbol que ya no
// existe, es el defecto que llevamos cinco veces cazándole al máster de agosto.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { portadoresDelFlag, censoCopy, NOMBRE_FLAG, SEMILLA_FLAG, SEMILLA_TIPO } from './_censo-copy-vs-flag.mjs';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

// Se calcula UNA vez: cada cierre recorre 355 ficheros y no cambia entre aserciones.
const cierre = portadoresDelFlag(RAIZ, SEMILLA_FLAG);
const cierreTipo = portadoresDelFlag(RAIZ, SEMILLA_TIPO);
const censo = censoCopy(RAIZ, cierre.portadores, cierreTipo.portadores);

/**
 * EL VEREDICTO, ANCLADO. Medido el 6-sep-2026 sobre `main` = 00c6cb0c (re-medido tras mezclarlo: la población pasó a 356 ficheros y 19.978 literales, y el reparto NO se movió).
 *
 *   ① FLAG — el texto lo elige, EN CÓDIGO, una condición que baja del flag.
 *   ② TIPO — lo elige el `type` del documento ya emitido. La dependencia es real pero pasa por
 *            una fila de `invoices`: ningún cierre estático puede encadenarla al flag.
 *   ③ A PELO — nada lo elige. Con el flag OFF dirá «factura» a quien emite justificantes.
 *
 * Se anclan los TRES y se exige que SUMEN. Un censo cuyas partes no suman no es un censo, y
 * anclar sólo el total dejaría pasar un trasvase silencioso entre categorías — que es
 * exactamente cómo este defecto se disolvería sin que nadie lo viera.
 */
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 8-sep-2026 · ESTE NÚMERO SE REGENERÓ EN UN MERGE, Y LA PREDICCIÓN ERA FALSA.
//
// Dos ramas subieron `aPelo` de 151 a 152 el mismo día, cada una por SU literal. Al mezclarlas
// razoné que el árbol fusionado tendría los dos y que el número sería 153. **El censo dijo 152**,
// y tenía razón: al ceder el arreglo de SCRUM-814 a la versión de `main` se retiró el módulo que
// llevaba mi literal, así que sólo queda el suyo. Lo mismo con `NO_LEGIBLES_AL_MEDIR`, que
// vuelve a 31.
//
// Es exactamente por esto por lo que una cifra derivada NO SE ELIGE NI SE DEDUCE: se recalcula
// con el generador sobre el árbol que va a quedar. Mi «153» habría sido un ancla que miente por
// uno, y un ancla que miente por uno deja pasar el siguiente cambio sin decir nada.
// ─────────────────────────────────────────────────────────────────────────────────────────

// 🔴 151 → 152 · 7-sep-2026 (SCRUM-805) · CUÁL SE MOVIÓ Y POR QUÉ, que es lo que este trinquete
// pide antes de tocar el número. NO es un trasvase entre categorías —ninguno pasó de «flag» a «a
// pelo»—: es UN literal NUEVO en `pdf/pdf.service.ts`, el pie del PDF del presupuesto:
//
//     'Documento sin validez fiscal. No es una factura.'
//
// Entra en el censo porque lleva la diana («factura»), y cae en ③ porque no lo elige ningún flag.
// Y ahí es donde tiene que estar: es una frase que **niega** ser una factura, así que su texto no
// depende de si el merchant emite facturas o justificantes — dice lo mismo en los dos casos, y
// con el flag OFF sigue siendo cierto. NO va a `PENDIENTES_DE_FIRMA`: es copy YA APROBADA
// (SCRUM-67), copiada byte a byte del PDF del albarán y refirmada por el fundador para este uso.

// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 16 → 12 · 152 → 151 · 16-sep-2026 (SCRUM-867) · CUÁL SE MOVIÓ Y POR QUÉ. No es un trasvase
// entre categorías ni un rótulo que se haya estropeado: es un FICHERO QUE SALIÓ DEL ÁRBOL.
// `nuevaFacturaModal.js` estaba muerto (nadie lo abría) y se retiró. Con él se fueron:
//   · sus CUATRO literales que derivaban del flag —los rótulos que leía de `rotulosDelDocumento`—,
//     que es todo lo que baja de `flag`;
//   · su ÚNICO literal a pelo, el `aria-label` «Cliente al que facturas», que nadie llegó a firmar.
// La cifra NO se dedujo: se regeneró con el censo sobre el árbol resultante.
// ─────────────────────────────────────────────────────────────────────────────────────────
// 151 → 152 · 17-sep-2026 (SCRUM-887) · CUÁL ENTRÓ Y POR QUÉ NO ES REGRESIÓN: el 409
// `albaran_con_descuento_global` de `POST /admin/albaranes/:id/convertir-en-factura`, texto FIRMADO
// (SCRUM-887 comentario 15675). Dice «facturar» a pelo y está bien: esa ruta ya ha devuelto
// `facturacion_no_disponible` en modo justificante ANTES de llegar a este rechazo, así que sólo
// lo lee quien emite facturas. Cifra regenerada con el censo, no deducida.
// ─────────────────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────────────────
// 152 → 154 · 17-sep-2026 (SCRUM-895) · CUÁLES ENTRARON Y POR QUÉ NO ES REGRESIÓN. Son DOS
// literales NUEVOS, los dos FIRMADOS (SCRUM-895, comentario 15699), y **ninguno cambió de
// categoría**: hasta hoy esos dos sitios devolvían la constante `MICROCOPY_PENDIENTE_290`, que no
// es un literal visible, así que no estaban en ningún cubo. Sustituir un marcador por su texto
// aprobado SUBE el censo, y eso es lo correcto.
//
//   · `albaranes.routes.ts:1395` — «Este parte todavía no está firmado. Solo se factura lo que el
//     cliente ha firmado.» (409 `albaran_no_firmado`)
//   · `albaranes.routes.ts:1400` — «Este parte ya está facturado entero.» (409 `albaran_ya_facturado`)
//
// **«A pelo» es la categoría correcta para los dos, y no un defecto que se cuela.** Lo que este
// censo persigue es copy que DEBERÍA derivar del flag —el nombre del documento— y no lo hace.
// Éstos no nombran el documento que se emite: dicen el ESTADO del parte que se factura, que es el
// mismo en los tres modos. Por eso el fundador aceptó que la pregunta 25 del asesor no les alcanza.
//
// ⚠️ Lo que sí queda anotado y NO se toca (regla 9): estos dos dicen «parte» y su vecino de
// `:1357` dice «albarán» del mismo objeto. La casa mezcla las dos palabras a pelo en esta ruta.
// El fundador firmó «parte», así que se aplica «parte»; unificarlo es de otro carril y necesita su
// propia firma.
//
// Cifra REGENERADA con el censo sobre el árbol resultante, no deducida.
// ─────────────────────────────────────────────────────────────────────────────────────────
// SCRUM-915d (18-sep-2026) · flag 12 → 13: entra la guía del paso Cliente del editor, que SÍ deriva
// del flag («¿Para quién es el presupuesto?» / «…el justificante?», firmadas en SCRUM-915
// comentario 15868). Regenerada con el censo, no deducida.
// ─────────────────────────────────────────────────────────────────────────────────────────
// 154 → 156 · 22-sep-2026 (SCRUM-1040) · CUÁLES ENTRARON Y POR QUÉ NO ES REGRESIÓN. Los DOS son
// el mismo sumidero, `facturasRecibidasView.js:37` (`recuento`), singular y plural: «1 factura
// recibida» / « facturas recibidas».
//
// **«A pelo» es la categoría correcta, y no un defecto que se cuela.** La pantalla nueva enseña
// las facturas que el profesional RECIBE de sus proveedores (A6/SCRUM-426), no las que él emite:
// un documento de un proveedor SIEMPRE es una factura, gane o no el merchant su propio flag de
// emisión — la palabra no depende de `INVOICING_ES_ENABLED` porque no describe lo que este
// negocio emite, describe lo que otro negocio le ha entregado a él.
//
// Cifra REGENERADA con el censo sobre el árbol resultante, no deducida.
// ─────────────────────────────────────────────────────────────────────────────────────────
// 156 → 157 · 25-sep-2026 (SCRUM-1049) · CUÁL ENTRÓ Y POR QUÉ NO ES REGRESIÓN. El literal no es
// NUEVO: «Sin facturas emitidas en este trimestre.» ya vivía en `reportsView.js`, escrito con
// `vatCard.innerHTML += '<p …>…</p>'`. Ese `+=` no es un `EqualsToken` y el censo no lo veía —
// el literal existía y estaba invisible al instrumento, el mismo defecto de medición que ya
// describió SCRUM-776 con la copy centralizada. SCRUM-1049 lo reescribió a
// `vacio.textContent = '…'` para arreglar OTRO defecto (el `+=` borraba los botones de
// trimestre recién montados, lección de SCRUM-515) y, de paso, el censo empezó a verlo: entra
// por `DOM:textContent`. El texto no cambió ni una letra y no depende de ningún flag ni tipo —
// es un estado vacío fijo, igual en los tres modos —, así que «a pelo» es la categoría correcta.
// Cifra REGENERADA con el censo sobre el árbol resultante, no deducida.
// ─────────────────────────────────────────────────────────────────────────────────────────
// 157 → 158 · 26-sep-2026 (SCRUM-1155, 920f) · «3 · Datos de la factura del proveedor»
// (`expensesView.js:1036`, la cabecera del paso 3 del alta de gasto rediseñada). Es un rótulo
// de SECCIÓN fijo, firmado en SCRUM-920 comentario 15992: no depende de ningún flag ni tipo de
// documento —los gastos no tienen `INVOICING_ES_ENABLED` ni `type`—, así que «a pelo» es la
// categoría correcta, igual que la de la entrada de arriba (156→157).
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 flag 13 → 16 · aPelo 157 → 154 · 26-sep-2026 (SCRUM-1160) · CUÁLES SE MOVIERON Y POR QUÉ, y
// **NO ES UN ARREGLO DE COPY que celebrar**: ninguno de los tres cambió de texto ni elige su
// palabra por el modo de emisión. Son de `jobDetailView.js`:
//     «El WhatsApp del recordatorio falló — reinténtalo desde la factura»   (CTA, rama `recordar`)
//     «⚠️ Factura emitida, revisa su registro» · «✓ Factura emitida.»      (hoja de facturar parcial)
// Pasan a «flag» porque `jobNextAction` ES AHORA portador del flag, y eso sí es verdad: su nivel 1
// («Cobrar el resto») se salta en modo justificante (`facturaFiscalDisponible`), así que la escalera
// que decide qué rama del CTA corre depende del modo. El censo hereda esa dependencia a los literales
// de la función que la llama. AISLADO, no deducido: con `jobNextAction.js` de `origin/main` y el resto
// de la rama, el diff del censo entre main y la rama sale VACÍO. Por eso NO se tocan
// `PENDIENTES_DE_FIRMA` (no se ha firmado nada) ni ningún rótulo.
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔀 CONFLICTO DE MERGE (SCRUM-1155 × SCRUM-1160), 27-sep-2026: las dos ramas tocan este mismo
// anclaje por SU literal, cada una en un fichero distinto (expensesView.js / jobDetailView.js).
// Por A4 de la casa, no se elige lado ni se suma a mano: se REGENERA con el propio censo sobre
// el árbol YA FUSIONADO. Ver el número de abajo y su comentario.
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🟢 flag 16 → 17 · 28-sep-2026 (SCRUM-1164, #3) · UN LITERAL QUE EL CENSO NO VEÍA, y ahora lo ve
// en su categoría correcta. «💡 "100% al aceptar" genera la factura cuando el cliente firma.»
// (`homeView.js`, hoja de presupuesto rápido) vivía DENTRO de la plantilla grande del modal, y el
// censo no la lee (en `origin/main` no aparece en `visibles`: medido con `censoCopy` sobre los dos
// árboles). Ahora es una constante que se calla en `receipt` (`appModoEmision`), así que el censo
// la encuentra y la clasifica como «flag» — que es lo que ES: el modo de emisión elige si sale.
// `aPelo` no baja porque nunca la contó. No se toca `PENDIENTES_DE_FIRMA`: no se ha firmado nada.
// 155 → 156 · 28-sep-2026 (SCRUM-1216b) · «Facturas recibidas» (`facturasRecibidasView.js:31`,
// `titulo: rotulo('Facturas recibidas')`, SCRUM-1040). **NO ES COPY NUEVA:** el fichero no cambió
// (diff vacío entre 1216a y 1216b), y el literal ya era visible (`title.textContent = COPY.titulo`),
// pero el censo no lo veía. Lo que cambió es la PASADA 0 del censo, que junta los nombres que se
// LLAMAN dentro de un sumidero: 1216b pinta `${T.titulo(anio)}` en un `innerHTML` (la pregunta de
// la serie, firmada en SCRUM-1216 comentario 17347), así que `titulo` entró en esa lista y la
// clave homónima de facturas recibidas se volvió visible al instrumento. Es la misma ceguera por
// copy centralizada que describió SCRUM-776, curada por accidente. Es un título de pantalla fijo:
// no depende de flag ni de tipo, así que «a pelo» es su categoría. AISLADO con el propio censo: el
// diff de `visibles` entre 1216a y 1216b es EXACTAMENTE esa línea, y ninguna de las dos pantallas de
// la serie añade una. Renombrar `titulo` para que volviera a no verse sería apagar el instrumento.
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔀 CONFLICTO DE MERGE (SCRUM-1164 × SCRUM-1216b), 28-sep-2026: las dos entradas de arriba
// tocan este anclaje por literales distintos (`homeView.js` / `facturasRecibidasView.js`).
// REGENERADO con el propio censo sobre el árbol YA FUSIONADO (origin/main 0afa87cd + la rama):
// { flag: 17, tipo: 7, aPelo: 156 } — el flag de 1164 y el «a pelo» de 1216b, cada uno por su lado.
// 🟢 flag 17 → 20 · tipo 7 → 11 · aPelo 156 → 154 · 28-sep-2026 (SCRUM-1257) · UN ARREGLO, y aislado
// con el propio censo: el diff de `visibles` entre `origin/main` 4fd0b309 y la rama son EXACTAMENTE
// estas líneas (textos firmados en SCRUM-1257 comentario 17444).
//   flag +3 · `invoicesView.js`, el vacío de Facturas: «Aquí verás tus facturas», «Cuando un cliente
//            acepte un presupuesto, sus facturas aparecerán aquí.» y «Por ahora, YaQu no genera
//            facturas desde tu cuenta.». Los elige `window.appModoEmision === 'receipt'`, que es
//            justo lo que se arreglaba: antes el vacío prometía el documento a todos. (El texto viejo
//            no estaba en el censo: no contaba ni en «a pelo».)
//   tipo +4, aPelo −2 · «🧾 Ver justificante» (`quotesDetailView.js`) y el tooltip de la reclamación
//            del banco (`invoiceDetailView.js`) eran «a pelo» y ahora eligen su palabra por el TIPO
//            del documento (`tipoDeFactura` / `isReceipt`), con su pareja «factura» al lado: +2 y +2.
// Nada de esto va a `PENDIENTES_DE_FIRMA`: está firmado.
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔴🔴 flag 17 → 4 · aPelo 156 → 162 · 28-sep-2026 (SCRUM-825 D1, firma del fundador en SCRUM-825
// comentario 17446). OJO, PORQUE ES LO CONTRARIO DE LO QUE PARECE: EL NÚMERO EMPEORA MIENTRAS EL
// CÓDIGO MEJORA. «a pelo» sube 6 y NO ES DEUDA.
//
// Se retiró la rama «justificante» del panel, que desde SCRUM-1027 no veía nadie. Aislado con el
// propio censo (categorías del árbol de `origin/main` d216084a contra el de la rama):
//   · flag −7, desaparecen: los seis rótulos «justificante» de `rotulosDelDocumento` y la guía
//     «¿Para quién es el justificante?» de `quotesView.js`. Es el borrado firmado.
//   · flag −6 / aPelo +6: los cinco rótulos «factura» de `rotulosDelDocumento` («Facturas»,
//     «Nº factura», «Nueva factura», «Emitir factura», «Factura emitida») y el «Nueva factura» del
//     botón de `invoicesView.js` pierden la vía `WINDOW::appDocumentoSuelto`, porque ya no hay ternario.
//     🔴 PUNTO CIEGO DEL CENSO: EN EJECUCIÓN SIGUEN DETRÁS DE LA PUERTA `appDocumentoSuelto !== 'no'`
//     (el botón no se pinta en `receipt`), pero el censo solo ve la condición PEGADA al literal. El
//     censo ha perdido vista; el código no ha perdido calidad.
//   · Y «+ Nuevo justificante» sale también de los no legibles (ver `NO_LEGIBLES_AL_MEDIR`).
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔀 CONFLICTO DE MERGE (SCRUM-1257 × SCRUM-825 D1), 28-sep-2026: las dos entradas de arriba
// tocan este anclaje por literales distintos. REGENERADO con el propio censo sobre el árbol YA FUSIONADO,
// no sumado a mano (precedente 1155×1160 y 1164×1216b).
// { flag: 7, tipo: 11, aPelo: 160 } — medido con `censoCopy` sobre origin/main 6112855b + la rama. Cuadra
// con la suma de las dos entradas (20−13, 11, 154+6), que se usa como COMPROBACIÓN, no como fuente.
// ─────────────────────────────────────────────────────────────────────────────────────────
// 154 → 155 · 28-sep-2026 (SCRUM-1232) · «1 factura» (`libroRegistroView.js`, `recuento`). ES COPY
// NUEVA Y FIRMADA: el recuento decía «1 facturas» y pasa a `n === 1 ? '1 factura' : n + ' facturas'`,
// firmado por el fundador sólo junto al filtro de justificantes del libro (SCRUM-1232, comentario
// 17435). AISLADO: contra `origin/main` = 6112855b, la única diferencia de `public/` de la rama es
// esa línea; el literal que ya existía (`' facturas'`) se queda y entra UNO nuevo. Es el recuento
// fijo de un libro que sólo lista facturas: no depende de flag ni de tipo, así que «a pelo» es su
// categoría. Tampoco va a `PENDIENTES_DE_FIRMA`: está firmado.
// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔀 CONFLICTO DE MERGE (SCRUM-825 D1 × SCRUM-1232), 29-sep-2026: la entrada de SCRUM-1232 (de
// abajo, 154 → 155) entró en main mientras esta rama llevaba 160. REGENERADO con el propio censo
// sobre el árbol YA FUSIONADO (origin/main 837a9e53 + la rama), no sumado a mano:
// { flag: 7, tipo: 11, aPelo: 161 }. Cuadra con la suma (7, 11, 160+1), que se usa como COMPROBACIÓN.
const VEREDICTO_AL_MEDIR = { flag: 7, tipo: 11, aPelo: 161 };

// ─────────────────────────────────────────────────────────────────────────────────────────
// 1 · EL INSTRUMENTO VE — controles de respuesta conocida, y también de la VÍA
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-601 · el cierre del flag recorre la cadena entera, y por la vía correcta', () => {
  assert.ok(cierre.ficheros > 300, `población: ${cierre.ficheros} ficheros → NO MEDIBLE`);
  assert.ok(cierre.definiciones > 1000, `población: ${cierre.definiciones} definiciones → NO MEDIBLE`);
  assert.equal(cierre.ficheroArranque, 'src/app.ts',
    'no se ha localizado el fichero que sirve `/admin/me`. Sin él no hay puente back→front y ' +
    'todo literal del front saldría «no depende» por ceguera, no por medida.');

  // 🔴 SE COMPRUEBA LA VÍA, NO SÓLO LA PERTENENCIA. La primera versión de este cierre usaba el
  // nombre pelado y daba 5261 portadores: `modoDocumentoSuelto` salía portador «vía merchant»,
  // o sea acertaba la respuesta conocida POR EL MOTIVO EQUIVOCADO. Un control positivo que puede
  // pasar por casualidad no es un control.
  const CADENA = [
    ['EXPORT::getEmissionMode', NOMBRE_FLAG],
    ['EXPORT::modoDocumentoSuelto', 'EXPORT::getEmissionMode'],
    ['WIRE::documentoSuelto', 'EXPORT::modoDocumentoSuelto'],
    ['WINDOW::appDocumentoSuelto', 'WIRE::documentoSuelto'],
  ];
  for (const [clave, viaEsperada] of CADENA) {
    const p = cierre.portadores.get(clave);
    assert.ok(p, `CIERRE CIEGO: no ve \`${clave}\`, que es un eslabón conocido de la cadena del flag.`);
    assert.equal(p.via, viaEsperada,
      `\`${clave}\` sale portador por «${p.via}» y la cadena real pasa por «${viaEsperada}». ` +
      'Acertar la pertenencia por otra vía es el falso positivo que ya se cazó una vez aquí.');
  }

  // Y el cable tiene que ser ESTRECHO: si vuelve a ensancharse, el censo se llena de portadores
  // falsos y todo saldría «depende del flag» — que es cómo este defecto se escondería solo.
  assert.ok(cierre.cables.length <= 20,
    `el puente back→front tiene ${cierre.cables.length} claves y eso es demasiado ancho: ` +
    `${JSON.stringify(cierre.cables.slice(0, 30))}`);
});

test('SCRUM-601 · el censo distingue DEPENDER DEL FLAG de estar en un ternario cualquiera', () => {
  assert.ok(censo.literales > 10000, `población: ${censo.literales} literales → NO MEDIBLE`);
  assert.ok(censo.visibles.length > 0, 'cero literales visibles con la diana: el censo no está mirando');

  const en = (f, l) => censo.visibles.filter((v) => v.fichero === f && v.linea === l);

  // POSITIVO, del árbol real: el rótulo del botón SÍ deriva del flag.
  //
  // SCRUM-1124 (26-sep-2026) · 223 → 220: al firmar el rótulo del semáforo sin mapear, el bloque
  // de comentario+constantes que hay ENCIMA de este botón pierde 3 líneas netas en DOS hunks
  // (un `⚠️`→`✅` de 19→17 líneas y un `window.INV_*` de 12→11). Cifra MEDIDA con el propio censo
  // sobre el árbol resultante (no deducida del diff, que sólo enseña -2 en el primer hunk).
  //
  // 🔴 SCRUM-825 D1 (firma del fundador, SCRUM-825 comentario 17446) · EL POSITIVO SE RE-ANCLA. Era
  // «+ Nuevo justificante» (`invoicesView.js:220`), y ese literal se ha BORRADO con su rama muerta:
  // un control anclado en algo que ya no existe está muerto y da verdes que no ha ganado. Se ancla en
  // el literal que depende del modo DE VERDAD, de los cuatro que quedan: la nota de condiciones de la
  // hoja de presupuesto rápido de `homeView.js`, que se calla en `receipt` con
  // `window.appModoEmision === 'receipt'` (SCRUM-1164). Los otros tres (`jobDetailView.js`) heredan la
  // dependencia por `jobNextAction` y su condición local no mira el modo: servirían peor de control.
  //
  // SCRUM-1317 (1-oct-2026) · 864 → 885: el Inicio del operario mete 31 líneas y quita 10 POR ENCIMA
  // de la nota (`git diff --numstat` de `homeView.js`: 31 10). Cifra MEDIDA, no deducida, y se vuelve
  // a medir igual: `grep -n '"100% al aceptar" genera' public/dashboard/js/homeView.js` da una sola
  // línea, y es ésta. Segundo re-anclaje por posición de este control (el primero, SCRUM-1124).
  const boton = en('public/dashboard/js/homeView.js', 885);
  assert.equal(boton.length, 1, 'no se encuentra la nota de condiciones de homeView donde se midió');
  assert.match(boton[0].texto, /100% al aceptar/);
  assert.equal(boton[0].dependeDelFlag, true,
    'el censo no ve que la nota de condiciones la calla `window.appModoEmision`. Con el ' +
    'positivo caído, un «ninguno depende» significaría «no supe mirar».');
  assert.equal(boton[0].via, 'WINDOW::appModoEmision');

  // NEGATIVO, del árbol real: un rótulo del panel que NO deriva del flag.
  //
  // 🔴 SCRUM-867 · ANTES ERA EL `aria-label` DEL MODAL (`nuevaFacturaModal.js:108`, «Cliente al que
  // facturas»). Ese modal se retiró por muerto y su literal se fue con él, así que el negativo se
  // reancla en otro que sí sigue en el árbol: el rótulo de Facturas del menú.
  // SCRUM-918 · 349 → 365: el arranque sin red añade 16 líneas antes en app.js (medido, no deducido).
  // SCRUM-919 · 365 → 366 al fusionar: `app.js` gana además la línea de `appParteAyudas` por encima.
  // SCRUM-1075 · 366 → 367: `app.js` gana `window.appTeamMemberId` por encima (medido, no deducido).
  // SCRUM-825 D1 · 367 → 370: la normalización de `appDocumentoSuelto` gana su comentario (y pierde la
  // lista de dos valores) por encima. Medido con el propio censo sobre el árbol resultante, no contado.
  // SCRUM-1317 · 370 → 386: `app.js` gana por encima las 8 líneas que le quitan Proveedores e Informes
  // de la barra al operario y las 8 netas del guard de rol de `case 'reports'`. Medido, no deducido:
  // `grep -n "textContent = 'Facturas'" public/dashboard/js/app.js` da una sola línea, y es ésta.
  const menu = en('public/dashboard/js/app.js', 386);
  assert.equal(menu.length, 1, 'no se encuentra el rótulo del menú donde se midió');
  assert.equal(menu[0].texto, 'Facturas');
  assert.equal(menu[0].dependeDelFlag, false);
});

test('SCRUM-601 · EL VEREDICTO: las tres categorías, ancladas, y SUMAN', () => {
  const flag = censo.visibles.filter((v) => v.dependeDelFlag);
  const tipo = censo.visibles.filter((v) => v.derivaDelTipo);
  const aPelo = censo.visibles.filter((v) => !v.dependeDelFlag && !v.derivaDelTipo);

  assert.equal(flag.length + tipo.length + aPelo.length, censo.visibles.length,
    'las categorías no suman el total: un censo cuyas partes no suman no es un censo');

  assert.deepEqual(
    { flag: flag.length, tipo: tipo.length, aPelo: aPelo.length },
    VEREDICTO_AL_MEDIR,
    'El reparto de literales visibles ha cambiado. NO actualices el número sin mirar cuál se ' +
    'movió y por qué: si uno pasó de «a pelo» a «flag», es un arreglo y hay que celebrarlo ' +
    'borrándolo de PENDIENTES_DE_FIRMA; si pasó al revés, es una regresión de copy.\n' +
    `  ① flag=${flag.length}  ② tipo=${tipo.length}  ③ a pelo=${aPelo.length}`);

  // Y que el reparto NO sea trivial: si todo cayera en un solo cubo, el censo no discrimina.
  assert.ok(flag.length > 0 && tipo.length > 0 && aPelo.length > 0,
    'alguna categoría está vacía: el censo no está separando, está clasificando todo igual');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 2 · LO QUE NO SABE LEER, LO DICE
// ─────────────────────────────────────────────────────────────────────────────────────────
/**
 * Sumideros visibles cuyo valor mezcla literales con partes DINÁMICAS: el texto final no se
 * puede afirmar desde el fuente. NO son un fallo del árbol ni se aprueban — son el límite del
 * instrumento, y va escrito con su número para que crecer sea visible.
 *
 * Medido el 6-sep-2026 sobre `main` = 00c6cb0c (re-medido tras mezclarlo: la población pasó a 356 ficheros y 19.978 literales, y el reparto NO se movió).
 */
// 8-sep-2026 · sigue en 31, MEDIDO tras el merge. Mi rama lo había subido a 32 porque el texto
// del 409 llegaba al sumidero por REFERENCIA desde su única constante —el +1 lo producía hacer lo
// correcto—, pero ese arreglo cedió al de `main` y la constante ya no existe. El caso queda
// anotado en `docs/master/SCRUM-814.md`: un censo que penaliza centralizar copy empuja a
// duplicarla, y eso hay que verlo venir antes de que empuje a nadie.
// 17-sep-2026 · 31 → 32, MEDIDO (SCRUM-887). Es el mismo caso que describe la nota de arriba, y esta
// vez se queda: el literal firmado del 409 del albarán con descuento global vive en SU ÚNICA
// constante (`COPY_ALBARAN_CON_DESCUENTO_GLOBAL`) y llega al `json` por referencia. Duplicarlo en
// línea para bajar este número sería cambiar una fuente por dos: justo lo que la nota avisa.
// 26-sep-2026 · 32 → 33, MEDIDO (SCRUM-1155, 920f). «3 · Datos de la factura del proveedor»
// (`expensesView.js:1036`) se pinta como `${TEXTO_PASO3_TITULO} <span …>(${TEXTO_OPCIONAL})</span>`:
// dos constantes compuestas en la misma plantilla HTML, así que el censo no puede afirmar desde el
// fuente cuál es el texto final visible (aunque las DOS mitades sean literales firmados sueltos).
// No se duplica el rótulo en línea para bajar el número: el mismo motivo que 31→32.
// 28-sep-2026 · 33 → 34, MEDIDO (SCRUM-1164, #3). Es el mismo literal que sube `flag` 16 → 17
// (ver `VEREDICTO_AL_MEDIR`): antes el censo no lo veía; ahora lo ve, y llega al `innerHTML` del
// modal por `${notaCondiciones}`, así que no puede afirmar el texto final desde el fuente. Es el
// límite del instrumento con un literal que ANTES ni siquiera contaba, no un literal nuevo.
// 28-sep-2026 · 34 → 37, MEDIDO (SCRUM-1257). Son los tres literales `flag` de arriba: llegan al
// `innerHTML` del vacío de Facturas por `tituloVacio`/`cuerpoVacio`, así que el censo no puede afirmar
// el texto final desde el fuente. No se duplican en línea para bajar el número: el motivo de 31→32.
// 28-sep-2026 · 34 → 33, MEDIDO (SCRUM-825 D1, comentario 17446). BAJA, y no por medición sino por
// borrado: «+ Nuevo justificante» (`invoicesView.js:220`) era una construcción que el censo no sabía
// leer, y se ha retirado con su rama muerta.
// 🔀 CONFLICTO DE MERGE (SCRUM-1257 × SCRUM-825 D1), 28-sep-2026: las dos entradas de arriba
// tocan este anclaje por literales distintos. REGENERADO con el propio censo sobre el árbol YA FUSIONADO,
// no sumado a mano (precedente 1155×1160 y 1164×1216b).
// 36 — medido sobre el árbol fusionado (37 de SCRUM-1257 − 1 de SCRUM-825 D1, como comprobación).
const NO_LEGIBLES_AL_MEDIR = 36;

test('SCRUM-601 · el censo DECLARA lo que no sabe leer, y esa lista no crece sola', () => {
  const n = censo.noLegibles.length;
  assert.ok(n > 0,
    'CERO construcciones no legibles sobre 19.968 literales es increíble: un censo que nunca ' +
    'tropieza no está leyendo. «No hay» y «no supe mirar» se escriben igual.');
  assert.ok(n <= NO_LEGIBLES_AL_MEDIR,
    `las construcciones que el censo NO sabe leer han pasado de ${NO_LEGIBLES_AL_MEDIR} a ${n}. ` +
    'Cada una es un literal visible cuyo texto final no se puede afirmar desde el fuente: ' +
    'míralas a mano y vuelve a anclar el número.\n  ' +
    censo.noLegibles.slice(0, 12).map((v) => `${v.fichero}:${v.linea} ${JSON.stringify(v.texto).slice(0, 50)}`).join('\n  '));
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 3 · 🔴 EL ROJO QUE DECIDE — la contradicción DENTRO DE UN MISMO GESTO
// ─────────────────────────────────────────────────────────────────────────────────────────
/**
 * 🔴 SCRUM-825 D1 (28-sep-2026) · RE-APUNTADO, NO RETIRADO.
 *
 * ANTES: el flujo del documento suelto (botón de Facturas + página) «no hablaba con una sola voz»
 * porque en modo JUSTIFICANTE el botón decía «justificante» y la página tenía rótulos a pelo que
 * decían «factura». Se ataban uno a uno en `PENDIENTES_DE_FIRMA` para que no crecieran.
 *
 * El modo justificante ya no existe (SCRUM-1027; su rama se retiró por firma del fundador, SCRUM-825
 * comentario 17446). Pero el DEFECTO —que el flujo le hable de «factura» a quien no la va a emitir—
 * seguía VIVO por otra vía, medido ejecutándolo: la RUTA `#invoices-new` no miraba el modo, y un
 * merchant en `receipt` veía la página entera. Así que el test no se retira: se apunta a lo que ahora
 * garantiza la sola voz, que el flujo SOLO SE ABRE para quien emite factura. Tiene dos puertas y las
 * dos tienen que cerrarse en el modo 'no':
 *   · el BOTÓN de la lista (`invoicesView.js`): se pinta solo si `appDocumentoSuelto !== 'no'`;
 *   · la RUTA (`app.js`, `case 'invoices-new'`): con `appDocumentoSuelto === 'no'` pinta Facturas.
 *   (La RUTA se ejecuta de verdad en `scrum600b`; aquí se exige que las dos puertas existan.)
 *
 * 🔴 LO QUE DEJA DE ESTAR VIGILADO, dicho para quien lo tenga que recuperar: los rótulos escritos
 * «a pelo» DENTRO de la página del documento suelto (`quotesView.js`) ya no se atan uno a uno. Con
 * las dos puertas cerradas, esa página solo la ve quien emite factura, así que un «factura» a pelo
 * es cierto allí. Si algún día vuelve un segundo documento suelto que no sea factura, la lista vuelve
 * con él: estaba en `PENDIENTES_DE_FIRMA` de este fichero, en `origin/main` d216084a.
 */
test('SCRUM-601 · 🔴 el flujo del documento suelto solo se abre para quien emite factura: sus DOS puertas se cierran en «no»', () => {
  const vista = soloEjecutable(leer('public/dashboard/js/invoicesView.js'));
  assert.match(vista, /if\s*\(\s*window\.appDocumentoSuelto\s*!==\s*'no'\s*\)/,
    '🔴 el BOTÓN de crear factura suelta ya no se esconde en el modo \'no\'.');

  const app = soloEjecutable(leer('public/dashboard/js/app.js'));
  const caso = (app.match(/case 'invoices-new':([\s\S]*?)break;/) || [])[1] || '';
  assert.ok(caso, '🔴 no existe el `case` de `invoices-new` en el router');
  assert.match(caso, /window\.appDocumentoSuelto\s*===\s*'no'/,
    '🔴 la RUTA `#invoices-new` no mira el modo: un merchant en `receipt` que abre el enlace ve la '
    + 'página de crear factura y se come un 409 al pulsar (SCRUM-825, medido).');

  // CONTROL: el mismo detector NO encuentra la puerta en un `case` que no la tiene.
  const sinPuerta = "case 'invoices-new':\n  viewTitle.textContent = 'x';\n  renderDocumentoSueltoView(viewContainer);\n  break;";
  const casoSin = (sinPuerta.match(/case 'invoices-new':([\s\S]*?)break;/) || [])[1];
  assert.doesNotMatch(casoSin, /window\.appDocumentoSuelto\s*===\s*'no'/);
});

