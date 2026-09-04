// tests/scrum402-marcador-no-se-pinta.test.mjs — SCRUM-402
//
// QUE UN `[PENDIENTE …]` EXISTA Y QUE UN `[PENDIENTE …]` SE PINTE SON DOS PROPIEDADES, Y HOY SOLO
// SE VIGILABA UNA.
//
// Los guards de microcopy de la casa (SCRUM-283, SCRUM-302) comprueban que **el marcador esté**
// mientras no haya texto aprobado — impiden que alguien se invente una frase. Correcto y necesario.
// Pero eso no dice **nada** sobre si ese marcador llega a la pantalla de un profesional. Y llega:
// SCRUM-402 nació de un botón rotulado literalmente `[PENDIENTE microcopy oficial]` que era la
// acción PRIMARIA de las facturas `pending`.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 POR QUÉ ESTO ES UN TRINQUETE Y NO UNA PROHIBICIÓN, y hay que decirlo
//
// La propiedad que se querría —«ningún marcador se pinta»— **está violada en 36 sitios hoy**
// (medido, ver `CENSO`). Un guard que la exigiera nacería ROJO y lo apagaría alguien en una hora:
// es el defecto que `docs/METODO_YAQU.md` llama un guard que da rojo en falso.
//
// Así que se vigila lo que sí se puede sostener **desde hoy**: que el número **no suba**. Cada
// marcador nuevo que llegue a un literal cae en rojo NOMBRANDO su fichero. Y cuando el fundador
// apruebe un texto, el número baja y hay que actualizarlo aquí — un trinquete que solo aprieta.
//
// Es la forma del guard de contraste de SCRUM-368: la excepción declara CUÁNTOS nodos ampara, y
// falla si gana o pierde. Una excepción que sobrevive a su causa deja de ser una nota y pasa a ser
// un permiso.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA DISTINCIÓN QUE HACE ÚTIL AL GUARD: literal ≠ comentario
//
// Un marcador dentro de un COMENTARIO no llega a ninguna pantalla, y hacerlo caer sería cobrar un
// impuesto sobre la claridad del código — la lección entera de SCRUM-349. Por eso el censo se hace
// **por AST**: los comentarios no son nodos de literal, así que quedan fuera por CONSTRUCCIÓN, no
// por una lista de excepciones. Medido: 56 marcadores en el árbol, **36 en literales** y 20 en
// comentarios.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// CommonJS con doble vida (script clásico + module.exports): se importa por defecto.
import registro from '../public/dashboard/js/invoiceActionsRegistry.js';
const { INVOICE_ACTION_REGISTRY, destinoEfectivo } = registro;

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_JS = path.join(RAIZ, 'public/dashboard/js');
const MARCA = '[PENDIENTE';

/**
 * CENSO MEDIDO el 7-ago-2026. Números por fichero, no un total: mover un marcador de una pantalla
 * a otra tiene que verse, y un total lo escondería (la lección del suelo por FUNCIÓN de SCRUM-392).
 */
const CENSO = Object.freeze({
  // Sprint Tecnosel (3-sep-2026) · el título de `app.js` ENTRÓ y SALIÓ el mismo día: el fundador
  // firmó «Partes por valorar». Su entrada se BORRA y no se pone a 0 (SCRUM-424 / SCRUM-405):
  // `censoActual()` sólo lista ficheros CON marcadores. El trinquete APRIETA.
  //
  // 🔴 Y `parteOficinaView.js` SALIÓ el mismo día: quedaba UN texto sin firmar —el error de abrir
  // un parte— y el fundador lo firmó como «No se ha podido abrir el parte». Al no quedar ningún
  // marcador, la constante que los sujetaba se retiró ENTERA: dejarla habría mantenido el fichero
  // aquí por un literal que ya no pinta nada. COMPROBADO antes de bajar la entrada, no asumido.
  // (el boton de Trabajos que lleva ahi NO entra: usa la constante `MARCA_651`, no un literal,
  // asi que este censo —que cuenta LITERALES por AST— no lo ve, y con razon.)
  // SCRUM-651 (T2) · ENTRA A CONCIENCIA con 1, y el motivo es que EL MECANISMO NO EXISTE SIN
  // Sprint Tecnosel (3-sep-2026) · `jobNuevoModal.js` SALIÓ: el fundador firmó los diez textos
  // que quedaban y `MARCA_651` se retiró ENTERA. Mientras quedó UNO sin firmar, la constante
  // tenía que seguir viva —retirarla antes habría dado por aprobados los demás sin que nadie los
  // firmara—, y ése era exactamente el motivo por el que esta entrada no bajaba a 0 antes de
  // tiempo. La entrada se BORRA, no se pone a 0: `censoActual()` sólo lista ficheros CON
  // marcadores. COMPROBADO antes de borrarla: cero marcadores en el fichero (SCRUM-703).
  // 🔴 SCRUM-591 (DOC-01) · 3-sep-2026 · `quotesView.js` ENTRÓ y SALIÓ EL MISMO DÍA.
  //
  // Entró con 1 —la opción de alta del selector del documento, y una `<option>` sin rótulo no se
  // puede elegir— y el asesor firmó el texto esa misma tarde: **«+ Nuevo cliente»**, 15
  // caracteres, con la caja medida delante (901px, 247,7px útiles ≈ 18 caracteres anchos). Su
  // entrada se BORRA, no se pone a 0 (SCRUM-424 / SCRUM-405): `censoActual()` sólo lista ficheros
  // CON marcadores, y el trinquete APRIETA.
  //
  // 🔴 MEDIDO AL RETIRARLO — Y CON EL ÁRBOL Y LA FECHA, QUE ES LA PARTE QUE FALTABA:
  //
  //     14 → 13 marcadores pintables (y de 14 a 13 ficheros)
  //     árbol: `origin/main` = 9747d16a con la rama scrum-591 dentro · 3-sep-2026
  //
  // Y cuadra con el suelo de más abajo, que dice «hay 13 medidos»: 13 entradas declaradas aquí,
  // 13 marcadores reales en el árbol, ninguno sin declarar. Barrido entrada por entrada.
  //
  // ⚠️ LA CIFRA SE ESCRIBE CON SU ÁRBOL PORQUE YA CADUCÓ DOS VECES EN ESTE MISMO TICKET: primero
  // 18 → 17 (entró SCRUM-703 y sacó `jobNuevoModal.js`), después 15 → 14 (entró la salida de
  // `jobDetailView.js`). Las dos eran correctas cuando se escribieron. **Una cifra sin árbol es
  // una cifra que va a caducar sin avisar**, y quien la lea no tendrá forma de saberlo.
  // Sprint Tecnosel · `jobDetailView.js` ENTRÓ con 2 el 2-sep-2026 —la PUERTA al parte: el rótulo
  // del botón y el aviso de cuando no se puede abrir— y SALIÓ el 3-sep: el fundador firmó el
  // rótulo primero y el aviso después, en SCRUM-402. Bajó de 2 a 1 y luego se BORRA, que es el
  // camino que dejó escrito su propia nota: bajar el número mientras quedaba marca, borrar la
  // entrada cuando no queda ninguna (precedente SCRUM-424/405). COMPROBADO antes de borrarla:
  // cero marcadores en el fichero, medidos con `soloEjecutable`, no supuestos.
  //
  // El registro de esa aprobación estrena `docs/microcopy/` (SCRUM-709): una aprobación, un
  // fichero. Está en `docs/microcopy/2026-09-03-SCRUM-402-abrir-parte-fallo.md`.
  // SCRUM-650 (T1) · ENTRA A CONCIENCIA con 1, y por el MISMO motivo que `jobNuevoModal.js`:
  // EL MECANISMO NO EXISTE SIN TEXTO. Es el selector de QUIEN EJECUTA el trabajo —el campo
  // «Tecnico» del parte de papel, donde Tecnosel escribe «Israel, Miguel y Jesus.L»—, y un
  // selector sin rotulo no se puede usar: quien lo abre no sabe si esta marcando al que ejecuta,
  // al que lo redacto o al que cobra, que son tres cosas distintas en esta pantalla.
  //
  // Se cuenta 1 y son CINCO textos: el rotulo, el hueco, la nota de solo-lectura del tecnico, el
  // aviso de equipo vacio y el fallo al guardar. Los cinco salen de una sola constante
  // `MARCA_ASIGNADOS`, asi que
  // aprobar el copy los apaga de golpe — y hay un test en `scrum650d` que EXIGE que el literal
  // con marcador sea uno solo, para que ese 1 no pueda convertirse en cuatro sin que salte.
  //
  // El dia que el fundador firme los cuatro textos, esta entrada se BORRA — no se pone a 0.
  'jobAsignados.js': 1,
  // SCRUM-507 (13-ago-2026): `aiQuoteAssistant.js` ENTRO y SALIO del censo el mismo dia. Entro con
  // 2 —el aviso de la linea que no se propone porque su IVA era ilegible, y la marca por linea de
  // lo que la IA se invento— y el fundador FIRMO los dos textos en el mismo ticket.
  //
  // Al aprobarlos cambio la forma de la frase, y ese es el detalle que merece quedar escrito: mi
  // marcador decia «cantidad y precio QUE NO VENIA y hemos supuesto», que no concuerda en plural.
  // El texto aprobado pone el sujeto en «esto» y deja la lista detras de los dos puntos, asi que
  // **la falta de concordancia no se corrige: deja de poder escribirse**.
  //
  // La entrada se BORRA en vez de bajar a 0, como dejaron escrito SCRUM-424 y SCRUM-405 aqui
  // mismo: `censoActual()` solo lista ficheros CON marcadores, asi que un 0 seria una bajada
  // permanente sin anotar. Y salir del censo NO saca de la vigilancia — lo fija R4b.
  // SCRUM-294-a (12-ago-2026) · SUBIDA A CONCIENCIA: el campo del recargo de equivalencia en la
  // ficha del cliente sale con marcador en su rotulo y en sus tres opciones. Es deliberado y no
  // provisional por descuido: decirle en pantalla a que REGIMEN FISCAL pertenece su cliente es
  // asesorarle, y eso es dictamen del asesor, no producto (regla 30). El dato se pide; no se
  // explica. Se apaga el dia que el fundador firme los cuatro textos.
  // 🔴 17-ago-2026 (tanda B) · SALE DEL CENSO: el fundador aprobó la etiqueta del recargo de equivalencia y sus tres opciones. Entrada BORRADA, no
  // puesta a 0 (SCRUM-424 / SCRUM-405): `censoActual()` solo lista ficheros CON marcadores.
  // SCRUM-421 · A CONCIENCIA: el registro de acciones del presupuesto trae 12 rotulos, TODOS sin
  // aprobar (regla 30). El marcador se ve EN PANTALLA a proposito: es la unica forma de que nadie
  // encienda por descuido texto que el fundador no ha firmado. Se cuenta 1: los doce salen de una
  // sola constante `MARCA_MICROCOPY`, asi que aprobar el copy los apaga todos de golpe.
  // 🔴 17-ago-2026 (tanda B) · SALE DEL CENSO: el fundador aprobó los doce rótulos de acción del presupuesto (esa marca pintaba DOCE). Entrada BORRADA, no
  // puesta a 0 (SCRUM-424 / SCRUM-405): `censoActual()` solo lista ficheros CON marcadores.
  // SCRUM-500 (12-ago-2026) · SUBIDA A CONCIENCIA: la casilla «Suplido» del editor de líneas sale
  // con marcador en su rotulo, en su aviso y en el resumen del disparador. Y el aviso NO es
  // decorativo: es el texto que evita un ERROR FISCAL en el segundo exacto en que se comete —
  // marcar como suplido un material propio, que se compra para uno y se revende con su IVA. Que
  // eso lo redacte el fundador (regla 30) es justo lo que hay que esperar, y mientras tanto se ve
  // el marcador a proposito. Se cuenta 1: los tres textos salen de una sola constante
  // `MARCADOR_MICROCOPY`, asi que aprobar el copy los apaga de golpe.
  // 🔴 17-ago-2026 (tanda D) · SALE DEL CENSO: aprobados los TRES textos del suplido —la casilla,
  // el aviso y el resumen del disparador—. Esa marca pintaba TRES. El aviso es el que evita un
  // error fiscal en el segundo en que se comete, y su texto aprobado va SIN mayúsculas: gritar
  // en una pantalla no es énfasis. Entrada BORRADA, no puesta a 0 (SCRUM-424 / SCRUM-405).
  // SCRUM-404 (7-ago-2026) · SUBIDAS A CONCIENCIA, las dos, y con su motivo:
  //
  //   `albaranDetailView.js` +1 → el mensaje de «el servidor rechazó la firma». El fundador
  //   aprobó su texto CON UNA CONDICIÓN: que el profesional tuviera una forma visible de
  //   avisarnos. **Medido: no la tiene.** El único contacto es `hola@yaqu.app` y solo aparece en
  //   `privacidad.html` y `terminos.html`; el botón «?» del panel es la GUÍA DE INICIO
  //   (`tutorial.js:189-201`), no un canal. Así que la frase prometía algo que no existe y se
  //   devolvió: sale con marcador hasta que el fundador fije un texto que no lo prometa.
  //
  //   `signaturePad.js` +1 → el respaldo de cuando el error llega sin mensaje. No estaba entre
  //   los textos aprobados y NO se inventa uno (regla 30).
  //
  // Los otros DOS de SCRUM-404 sí se escribieron, porque sí estaban aprobados: «No se ha podido
  // conectar…» y «No se ha recogido el trazo…». Por eso esto sube 2 y no 4.
  // SCRUM-460 (10-ago-2026) · `albaranDetailView.js` 1 → 3. SUBIDA A CONCIENCIA, y el motivo es
  // que **el mecanismo no existe sin texto**: son los dos avisos de «sin cobertura» de H1 fase 3.
  //
  //   +1 → el albarán NO está precargado y no hay red. Es el CONTROL NEGATIVO del ticket: sin él
  //        la pantalla se queda en blanco, que es peor — invita a reintentar y a firmar a ciegas.
  //   +1 → crear albaranes sin red quedó FUERA DE ALCANCE POR DECISIÓN, y un límite que no se
  //        cuenta se vive como una avería: el pro busca «+ Nuevo albarán» en el sótano y cree que
  //        el producto está roto.
  //
  // Los dos textos están MEDIDOS y PROPUESTOS al asesor con la caja real (338 px a 390, 268 a 320;
  // `.alert` 13,5 px / 1,5), y salen con marcador porque **no se inventa microcopy** (regla 30).
  // Bajan a 1 el commit que los apruebe.
  // SCRUM-460 (11-ago-2026) · 3 → 1: el asesor APROBÓ los dos textos, con un retoque en el
  // primero —«no está descargado» en vez de «no se descargó»: no falló nada, la política
  // simplemente no lo eligió—. Un trinquete que no se aprieta cuando puede deja de serlo.
  // 🔴 17-ago-2026 (tanda B) · SALE DEL CENSO: el fundador aprobó el aviso de firma rechazada. Entrada BORRADA, no
  // puesta a 0 (SCRUM-424 / SCRUM-405): `censoActual()` solo lista ficheros CON marcadores.
  // 🔴 17-ago-2026 (tanda B) · SALE DEL CENSO: el fundador aprobó el aviso de firma no enviada. Entrada BORRADA, no
  // puesta a 0 (SCRUM-424 / SCRUM-405): `censoActual()` solo lista ficheros CON marcadores.
  // SCRUM-285 (10-ago-2026): `cobrosView.js` ENTRÓ y SALIÓ del censo el mismo día. La pantalla de
  // Cobros nació con nueve ranuras marcadas —no había copy aprobada para ninguna— y el asesor las
  // aprobó todas: los ocho textos primero, y las seis cabeceras después al partir en dos la quinta
  // columna. Cero marcadores, así que la entrada se BORRA en vez de bajar a 0: `censoActual()` solo
  // lista ficheros con marcador, y un 0 escrito aquí sería una bajada permanente sin anotar.
  // Mismo trato que `jobRailBlocks.js` con SCRUM-424. El trinquete APRIETA.
  //
  // SCRUM-405 (−1, 10-ago-2026): `api.js` SALE del censo. Su único marcador era el mensaje de
  // «esto no es tu fichero», y el asesor aprobó su microcopy (regla 30) — que resultó ser DOS
  // textos y no uno: hasta hoy las dos causas (`esHtml` y `!cuadra`) pintaban el MISMO, así que
  // cuando era la segunda el texto MENTÍA, culpaba a la wifi de la obra y mandaba al profesional
  // a gastar datos móviles por algo que no estaba en su red.
  //
  // La entrada se BORRA en vez de bajar a 0, siguiendo lo que dejó escrito SCRUM-424 aquí mismo:
  // `censoActual()` sólo lista ficheros CON marcadores, así que un 0 sería una bajada permanente
  // sin anotar. Y salir del censo NO saca de la vigilancia — lo fija R4b.
  // SCRUM-405 (−4, 7-ago-2026): al pasar las tres descargas por la forma común desaparecieron
  // cuatro ramas de error que pintaban marcador. El trinquete APRIETA: 15 → 11.
  // 11 → 5 el 10-ago-2026: SCRUM-244 trajo los ocho textos APROBADOS de la card de portabilidad
  // y del diálogo de descarga. Los 5 que quedan son de la card del LIBRO DE EMITIDAS (SCRUM-325),
  // que nació en `main` después de esa aprobación: nadie ha aprobado su copy todavía.
  // 🔴 17-ago-2026 (tanda B) · 5 → 1. Aprobados cuatro: el estado del botón, el vacío del periodo,
  // «Descarga lista.» y el error de descarga. Queda UNO y con su motivo: el quinto marcador de este
  // fichero es de la tarjeta de portabilidad, que NO estaba en la lista aprobada.
  // SCRUM-578 (24-ago-2026) · SUBIDA A CONCIENCIA: el formulario de clientes saca con marcador
  // el rótulo del teléfono y el aviso de identificador ya usado.
  //
  // El rótulo TENÍA texto —«Teléfono (E.164 sin +)»— y pasa a marcador a propósito: en cuanto el
  // prefijo sale a un selector aparte, ese rótulo describe un campo que ya no existe. Y era, él
  // mismo, la prueba del ticket de que una regla escrita en una etiqueta no se cumple: pedía
  // «E.164 sin +» y se guardaron `+34 662629419` y `662629419` como dos clientes.
  //
  // Van SIN palabra de trabajo detrás, al revés que `switchFormaJuridica` (SCRUM-574): allí el
  // copy era accesorio; aquí es lo que el profesional lee para decidir si está creando un
  // duplicado, y un texto mío «provisional» ahí es justo lo que la regla 30 prohíbe.
  //
  // 🔴 CUENTA 1 Y PINTA 2, y la distinción no es cosmética — se midió en SCRUM-615: este censo
  // cuenta MARCAS, y las dos superficies salen de una sola constante `MARCADOR_MICROCOPY`. Por
  // eso **aprobar UNO de los dos textos NO apaga el otro**: son dos textos distintos que hoy
  // comparten marcador, y habrá que partir la constante el día que el fundador escriba el
  // primero. Decir «se apagan de golpe» aquí sería falso.
  // SCRUM-575 (24-ago-2026) · 1 → 2. SUBIDA A CONCIENCIA: entra el aviso de NIF/CIF mal formado
  // (CONT-02), con CONSTANTE PROPIA y no reutilizando la de CONT-05.
  //
  // 🔴 Y LA CONSTANTE SEPARADA ES LA DECISIÓN, no un descuido. Reutilizar la de CONT-05 habría
  // dejado el censo en 1 —el número no se habría movido— metiendo una superficie nueva EN
  // SILENCIO, que es justo lo que este trinquete existe para impedir. Y peor: ataría la
  // aprobación de este texto a la de los otros dos, así que el fundador no podría firmar uno sin
  // firmar los tres. Una constante por ticket es lo que permite apagarlos por separado.
  //
  // Estado real de este fichero: 2 MARCAS · 3 SUPERFICIES.
  //   · CONT-05 (`MARCADOR_MICROCOPY`) pinta 2: el rótulo del teléfono y el aviso de duplicado.
  //   · CONT-02 (`MARCADOR_NIF`) pinta 1: el aviso de NIF mal formado.
  // La de CONT-05 sigue necesitando partirse el día que se apruebe uno de sus dos textos.
  //
  // El rótulo «NIF/CIF (opcional)» NO se ha marcado: sigue describiendo el campo con exactitud.
  // Sólo se marca lo NUEVO — marcar de más obliga al fundador a reescribir lo que ya estaba bien.
  // SCRUM-641 (1-sep-2026) · SUBIDA A CONCIENCIA: `productsView.js` ENTRA en el censo (y NO `api.js`, que salió con
  // SCRUM-405. Entra con 1: el traductor de códigos de error del servidor a texto para una
  // persona (`mensajeDeError`).
  //
  // POR QUÉ CON MARCADOR Y NO CON TEXTO: hasta hoy el aviso pintaba `e.message`, y cuando el
  // servidor contestaba `{error:"name_duplicate"}` eso es lo que leía el profesional en su
  // catálogo — un identificador en inglés con guion bajo. Quitarlo exige poner OTRA cosa, y esa
  // otra cosa es la frase que le dice que el nombre está cogido: microcopy que el fundador no ha
  // escrito (regla 30). Se ve en pantalla A PROPÓSITO, que es la única forma de que nadie
  // encienda por descuido un texto sin firmar.
  //
  // VA CON PALABRA DE TRABAJO detrás («nombre ya en uso»), al revés que `customersView` (CONT-05):
  // allí el marcador iba solo porque era UN texto; aquí es un control de VARIOS LADOS —este caso
  // frente a todos los demás errores, que caen a su respaldo en castellano—, y un marcador pelado
  // borraría justo la distinción que este ticket viene a dar.
  //
  // 🔴 CUENTA 1 Y PINTA 1, HOY. Y la advertencia, que es la lección de SCRUM-575 aplicada antes de
  // que muerda: el mapa `M` de `mensajeDeError` tiene UNA entrada. Si el siguiente ticket añade
  // otra reutilizando `MARCADOR_MICROCOPY`, **este número NO se moverá** y entrará una superficie
  // nueva EN SILENCIO — que es exactamente lo que este trinquete existe para impedir. Quien
  // añada un código mapeado le pone SU constante, para que el fundador pueda firmar uno sin
  // firmar los dos.
  // SCRUM-593 (2-sep-2026) · LA ENTRADA SE BORRA, no baja a 0 — como dejaron escrito SCRUM-424 y
  // SCRUM-405 aquí mismo. `textoDelDocumento.js` entró ese día con 1 marcador (el rótulo del campo
  // de cabecera del documento) y salió el MISMO día: el fundador lo firmó —«Añadir texto en el
  // documento»— unas horas después. Un marcador que se firma desaparece; no se queda de adorno.
  // 🔴 SCRUM-582 (CONT-09) · 4-sep-2026 · `filtroClientes.js` ENTRÓ y SALIÓ EL MISMO DÍA.
  //
  // Entró con 1 —el CONTADOR de la selección múltiple, y una barra que no dice cuántos hay
  // marcados no informa de nada— y el asesor firmó el texto esa misma tarde, con plural de verdad:
  // **«1 cliente seleccionado» / «N clientes seleccionados»**. La entrada se BORRA, no se pone a 0
  // (SCRUM-424 / SCRUM-405): `censoActual()` sólo lista ficheros CON marcadores.
  //
  // MEDIDO AL RETIRARLO, con su árbol y su fecha:
  //     14 → 13 marcadores pintables (y de 14 a 13 ficheros)
  //     árbol: `origin/main` = 1a359f6e con la rama scrum-582 dentro · 4-sep-2026
  //
  // Es la SEGUNDA vez que este fichero entra y sale: SCRUM-581 retiró sus seis cuando el fundador
  // dijo «nada de marcadores en pantalla». Éste era uno nuevo, no aquéllos.
  //
  // ⚠️ Y la caja de ese texto está **CALCULADA, no medida**: el MCP de Playwright estaba caído. El
  // asesor firmó sabiéndolo y dejando la condición escrita — si al medirla no cabe, el que falla
  // es el cálculo y se cambia el texto. Consta en `docs/microcopy/`.
  'productsView.js': 1,
  // SCRUM-644 (2-sep-2026) · SUBIDA A CONCIENCIA: `providersView.js` ENTRA con 1. Es el MISMO
  // defecto y el MISMO criterio que SCRUM-641 arriba —no se inventa uno nuevo—, en el otro fichero
  // que tenía el camino COMPLETO: `throw new Error(data?.error || …)` en un extremo y `e.message`
  // pintado en el otro. Un profesional leía `name_duplicate` en su pantalla de proveedores.
  //
  // Y NO en `api.js`: es zona sin marcador por decisión (SCRUM-405), ya se intentó y la tanda lo
  // tumbó. Queda además más honesto — el texto sin firmar lo pinta ESTA pantalla.
  //
  // 🔴 CUENTA 1 Y MARCA 1 RÓTULO, HOY: sólo `name_duplicate` lleva marcador. El mapa tiene DOS
  // entradas, y la otra —`provider_in_use`— NO lo lleva a propósito: su texto YA EXISTÍA en este
  // fichero y ya se enseñaba, así que se MUDÓ al mapa sin tocarlo. Marcar texto aprobado obligaría
  // al fundador a refirmar lo que ya firmó.
  //
  // ⚠️ La lección de SCRUM-575, otra vez y por escrito: las otras dos apariciones de
  // `PRV_MARCADOR_MICROCOPY` son respaldos de ÚLTIMO RECURSO (sólo se ven si la llamada no trae
  // respaldo en castellano), y este censo cuenta el LITERAL, que está escrito una sola vez. O sea
  // que si el siguiente ticket añade otro código mapeado reutilizando la constante, **este número
  // NO se moverá** y entrará una superficie sin firmar en silencio. Quien añada un código mapeado
  // le pone SU constante, para que el fundador pueda firmar uno sin firmar los dos.
  'providersView.js': 1,
  // 🔴 SCRUM-575 (2-sep-2026) · `customersView.js` SALE DEL CENSO: pasó de 2 a 1 y de 1 a 0 en el
  // mismo ticket, y la entrada se BORRA — no se pone a 0 — como dejaron escrito SCRUM-424,
  // SCRUM-405 y SCRUM-593 aquí mismo: `censoActual()` sólo lista ficheros CON marcadores, así que
  // un 0 sería una bajada permanente sin anotar.
  //
  // Las TRES marcas que tenía, con quién las firmó:
  //   · el aviso de NIF/CIF mal formado ....... «Ese NIF/CIF no es válido. Compruébalo.»
  //   · el rótulo del teléfono ................ «Teléfono»
  //   · el aviso de identificador ya usado .... «Ese dato ya lo tiene otro cliente. Revísalo por
  //                                              si es un duplicado.»
  // Los dos últimos compartían UNA constante, y por eso hubo que PARTIRLA: sin partirla, aprobar
  // el rótulo le habría cambiado el texto al aviso, que dice otra cosa. Lo dejó avisado SCRUM-615.
  //
  // ⚠️ SALIR DEL CENSO NO ES SALIR DE LA VIGILANCIA, y aquí no es una frase: lo fija **R4b**, y
  // además se ha comprobado a propósito en este ticket metiendo un marcador nuevo en este mismo
  // fichero y viendo que R4 lo caza por la rama `nuevos`. Un cero sin control positivo no es un
  // cero: es un guard que dejó de mirar.
  'exportView.js': 1,
  // 🔴 17-ago-2026 · `invoiceDetailView.js` SALE DEL CENSO (tenía 9). El fundador aprobó los ocho
  // rótulos de acción, y el noveno era `MARCA_MICRO`, una constante que ya no consumía nadie y que
  // se borra con ellos. Eran los ocho botones que un profesional veía sin saber qué hacían: la peor
  // clase de marcador, porque un botón mudo no se puede ni juzgar.
  //
  // La entrada se BORRA en vez de bajar a 0 — lo dejaron escrito SCRUM-424 y SCRUM-405 aquí mismo:
  // `censoActual()` solo lista ficheros CON marcadores, así que un 0 sería una bajada permanente
  // sin anotar. Y salir del censo NO saca de la vigilancia: lo fija R4b.
  // 🔴 17-ago-2026 (tanda B) · SALE DEL CENSO: el fundador aprobó el aviso de recarga y el botón «+ Nueva factura». Entrada BORRADA, no
  // puesta a 0 (SCRUM-424 / SCRUM-405): `censoActual()` solo lista ficheros CON marcadores.
  // 🔴 17-ago-2026 (tanda B) · SALE DEL CENSO: el fundador aprobó los cinco textos de la revisión previa (esa marca pintaba CINCO). Entrada BORRADA, no
  // puesta a 0 (SCRUM-424 / SCRUM-405): `censoActual()` solo lista ficheros CON marcadores.
  // SCRUM-424 (−1, 10-ago-2026): `jobRailBlocks.js` SALE del censo. Su único marcador era el
  // rótulo del enlace a mapa del bloque DÓNDE, y el asesor aprobó «Abrir en mapa» (regla 30). El
  // trinquete APRIETA: la entrada se borra en vez de bajar a 0 — `censoActual()` solo lista
  // ficheros con marcadores, así que un 0 escrito aquí sería una bajada permanente sin anotar.
  'libroRegistroView.js': 1,
  // 🔴 17-ago-2026 · `nuevaFacturaModal.js` SALE DEL CENSO (tenía 1). Esa única marca escrita
  // pintaba **22 superficies** —el modal entero: título, botón de cerrar, cinco placeholders, ocho
  // `aria-label`, la opción vacía, dos errores, dos botones, el estado de «emitiendo» y el aviso
  // final—, y es el ejemplo de por qué este censo cuenta MARCAS y no RÓTULOS.
  //
  // SCRUM-483 dejó escrito que se partiría «el día que se aprueben, partiendo y rellenando en el
  // mismo commit». Ese día es hoy, así que `NF_PENDIENTE` se borra. Entrada BORRADA, no puesta a 0.
  // SCRUM-605 (25-ago-2026) · SUBIDA A CONCIENCIA: 8 → 9 ficheros. Los tres atajos de «Válido
  // hasta» del presupuesto (7 / 14 / 30) necesitan rótulo y nombre accesible, y ése es texto que
  // NO existe. El encargo daba por hecho que no haría falta microcopy; hace falta, porque un
  // botón sin nombre no es accesible y un número suelto («7») no dice de qué.
  //
  // Se cuenta 1: los TRES botones y sus tres `aria-label` salen de una sola constante
  // `MARCA_MICROCOPY`, así que aprobar el copy los apaga de golpe. El NÚMERO va delante del
  // marcador y no es microcopy —es el dato del atajo—, que es lo que los mantiene
  // distinguibles entre sí mientras el texto no llegue.
  //
  // Lo que NO se hizo, y merece quedar escrito: el encargo pedía `[copy: fundador]`. Ese
  // marcador NO lo cuenta este censo (cuenta `[PENDIENTE`), así que habría sido un marcador
  // invisible para el trinquete que existe justo para verlo. Se usa el de la casa.
  // 🔴 4-sep-2026 · SALE DEL CENSO: el ASESOR firmo los seis literales de los tres atajos de
  // «Valido hasta» —tres rotulos («7 dias», «14 dias», «30 dias») y tres nombres accesibles
  // («Valido hasta dentro de N dias»)—, a la espera de la firma del fundador. La entrada se
  // BORRA y no se pone a 0 (SCRUM-424 / SCRUM-405):  solo lista ficheros CON
  // marcadores. COMPROBADO antes de borrarla: cero marcas en el fichero, y el censo baja de 13
  // a 12 entradas con el numero delante.
  'patronDetalleAcciones.js': 1,
  // 🔴 17-ago-2026 (tanda B) · SALE DEL CENSO: el fundador aprobó «Con errores» del resumen de importación de CSV. Entrada BORRADA, no
  // puesta a 0 (SCRUM-424 / SCRUM-405): `censoActual()` solo lista ficheros CON marcadores.
  // 🔴 17-ago-2026 (tanda B) · SALE DEL CENSO: el fundador aprobó los cuatro títulos de bloque del formulario (esa marca pintaba CUATRO). Entrada BORRADA, no
  // puesta a 0 (SCRUM-424 / SCRUM-405): `censoActual()` solo lista ficheros CON marcadores.
  'semaforoFiscal.js': 1,
  // SCRUM-574 (24-ago-2026) · SUBIDA A CONCIENCIA: el switch «Empresa | Persona» de la ficha de
  // cliente sale con marcador en sus TRES rótulos — la pregunta que lo encabeza y las dos
  // etiquetas. No están aprobados y no se inventan (regla 30): las etiquetas del switch son del
  // fundador, y el encargo lo dice con todas las letras («ni de ejemplo ni provisional»).
  //
  // Se cuenta 1: los tres salen de una sola constante `MARCADOR` en `switchFormaJuridica.js`, así
  // que aprobar el copy los apaga de golpe — la misma forma que tuvieron `MARCA_MICROCOPY`
  // (SCRUM-421, pintaba doce) y `NF_PENDIENTE` (pintaba veintidós).
  //
  // 🔴 Y VAN CON PALABRA DE TRABAJO DETRÁS («[PENDIENTE microcopy oficial] Empresa»), no con la
  // marca sola. En un control de DOS LADOS el marcador pelado sería inservible: los dos lados
  // dirían exactamente lo mismo y el profesional no sabría cuál está eligiendo. Es la distinción
  // que `censo-marcadores.mjs` ya hace entre el rótulo que pinta A CIEGAS y el que al menos se
  // puede leer y juzgar.
  // 🔴 SCRUM-667 (2-sep-2026) · `switchTipoArticulo.js` SALE DEL CENSO (tenía 1, que pintaba 3).
  // El fundador aprobó los tres textos TAL CUAL —«Esto es» · «Producto» · «Servicio»— y se retiró
  // el prefijo. Entrada BORRADA, no puesta a 0: el censo lista lo que QUEDA pendiente, y un 0 sería
  // una entrada que no significa nada. El precedente es el de las once entradas del 17-ago.
  //
  // Y se apagaron LOS TRES A LA VEZ, que es justo lo que la entrada anterior avisaba de que NO se
  // podía dar por hecho: salían de una sola constante `MARCADOR`, así que aprobar uno solo habría
  // obligado a partirla. Se aprobaron los tres, así que la constante se retira entera.
  //
  // POR QUÉ AHORA: producción llevaba nueve días sin desplegar por deriva de esquema. Al arreglarse
  // desapareció el hueco entre mergear y desplegar, y estos tres se estaban LEYENDO en la primera
  // pantalla del catálogo, en producción.
  'switchFormaJuridica.js': 1,
  // SCRUM-581 (1-sep-2026) · SUBIDA A CONCIENCIA, autorizada por el asesor: las pestañas
  // Todos|Empresas|Personas y el desplegable de orden de la lista de clientes. El criterio de la
  // casa se cumple — el copy NO es el objeto del ticket (el objeto es filtrar y ordenar), son
  // pocos, y esta pantalla YA lleva marcador en producción por el switch de CONT-01: no se abre
  // una puerta nueva, se usa la que está abierta, y todos se apagan con la misma decisión.
  //
  // CUENTA 1 Y PINTA 6, y la distinción es la de SCRUM-615: este censo cuenta MARCAS —una sola
  // SCRUM-581 (2-sep-2026) · LA ENTRADA SE BORRA, no baja a 0 — la convención que dejaron
  // escrita aquí mismo SCRUM-424 y SCRUM-405. `filtroClientes.js` entró con 1 marcador (una
  // constante que servía a seis ranuras) y sale porque el fundador RETIRÓ el marcador de la
  // pantalla: «nada de marcadores en pantalla». Los seis textos siguen SIN APROBAR — lo que
  // desaparece es el corchete visible, no la aprobación—, y eso lo vigila ahora
  // `tests/scrum581-pestanas-y-orden-clientes.test.mjs`, no este censo.
  // SCRUM-615 (24-ago-2026) · SUBIDA A CONCIENCIA: la salida D+C pinta con marcador el aviso de
  // «este plazo se ha calculado sin el dato» en la bandeja de pendientes, y el error de guardado.
  //
  // 🔴 Y VA SIN PALABRA DE TRABAJO DETRÁS, al revés que `switchFormaJuridica` (SCRUM-574). Allí el
  // copy era ACCESORIO al ticket y el marcador pelado habría dejado dos lados del switch diciendo
  // lo mismo. Aquí el copy ES EL TICKET: es lo que el profesional lee para decidir qué contestar
  // sobre un PLAZO LEGAL. Un texto mío «provisional» ahí es exactamente lo que la regla 30
  // prohíbe, así que sale a ciegas a propósito y con esta entrada delante.
  //
  // CUENTA 1 Y PINTA 2, y la distinción importa porque yo mismo la declaré mal antes de medirla:
  // en el commit anterior dije «+2» contando SUPERFICIES. Este censo cuenta MARCAS —una sola
  // constante `MARCADOR`—, igual que `NF_PENDIENTE` contaba 1 pintando veintidós. Las dos
  // superficies son el aviso (`tipoDestinatarioPendiente.js`) y el error de guardado
  // (`invoicesView.js`, que referencia la constante en vez de repetir el literal). Aprobar UN
  // texto no las apaga las dos: son dos textos distintos que hoy comparten marcador, y el día que
  // el fundador los escriba habrá que partir la constante.
  'tipoDestinatarioPendiente.js': 1,
  // 🔴 SCRUM-652 (T3 fase C) · 2-sep-2026 · `parteDetailView.js` ENTRA con 1, A CONCIENCIA.
  //
  // Es la pantalla del parte en el móvil del técnico. Su microcopy NO está aprobada (regla 30):
  // se propone con las palabras del impreso que ya rellenan —«UNDS», «Mano de obra»,
  // «Materiales», «Entrada», «Salida», «Desplazamiento», «Kilómetros», «REF»— porque estrenar
  // sinónimos obligaría al técnico a traducir entre el papel y la pantalla en casa de un cliente.
  //
  // ⚠️ EL «1» ENGAÑA SI NO SE DICE, y se dice: el censo cuenta MARCAS ESCRITAS, y aquí hay UNA
  // sola —`var M`— concatenada a **20 rótulos**. Es exactamente el caso de `libroRegistroView`
  // (SCRUM-514), donde una marca pintaba 23. Un 1 aquí no significa «un rótulo provisional»:
  // significa «esta pantalla entera está sin firmar».
  //
  // Sale del censo el commit que apruebe los textos, y ese commit BORRA la entrada, no la pone a
  // 0 (precedente SCRUM-424/405).
  'parteDetailView.js': 1,
  'settingsSubmenus.js': 1,
  // SCRUM-674 (2-sep-2026) · `voiceInput.js` SALE del censo: el fundador aprobo el texto del
  // aviso de dictado sin conexion, y sale ya sin marca. La entrada se BORRA, no se pone a 0:
  // un 0 declara «este fichero se vigila y tiene cero», y aqui lo cierto es que no hay nada
  // que vigilar (precedente SCRUM-424/405). Anotado en MICROCOPY_APROBADA_SIN_APLICAR.md.
  // SCRUM-294 (fase C) · 1 -> 5: el criterio de caja entra en Configuracion con marcador A
  // CONCIENCIA. Son 4 literales —el rotulo y sus TRES opciones— y el texto NO esta aprobado:
  // explicarle a un profesional si le conviene el RECC es asesorarle, y eso lo dictamina el
  // asesor (regla 30). El dato se PIDE ya; el texto entra cuando el asesor lo apruebe.
  // SCRUM-328 (12-ago-2026) · SUBE DE 1 A 3, A CONCIENCIA: los dos textos del aviso de «Bizum sin
  // telefono». Salen con marcador A PROPOSITO — ese aviso es lo unico que separa «me falta rellenar
  // un campo» de «esto no funciona», y su texto no lo ha firmado el fundador (regla 30). Se apagan
  // el dia que lo firme.
  // 🔴 CONFLICTO RESUELTO SUMANDO, no eligiendo: los dos tickets subieron este mismo contador en
  // paralelo (SCRUM-294 +4, SCRUM-328 +2, sobre la base de 1). Quedarse con uno habria borrado en
  // silencio los marcadores del otro y el trinquete habria dejado de verlos.
  //
  // SCRUM-293 (③a) · 13-ago-2026 · 7 → 8, A CONCIENCIA. Entra el selector de RETENCIÓN DE IRPF en
  // Configuración > Facturación, y sus rótulos NO los ha aprobado nadie (regla 30). Son tres textos
  // visibles: la etiqueta «Retención de IRPF» y las dos opciones que NO salen del cubo — «Sin
  // indicar» (no lo ha declarado) y «No aplico retención» (declara que no). Los rótulos de los
  // TIPOS no llevan marcador y no es un olvido: vienen del dominio (`CUBO_DE_RETENCION`), y ahí un
  // «15 %» no es microcopy, es el dato.
  //
  // El texto no puede escribirse todavía porque decirle a un profesional cuándo debe retener es
  // asesorarle, y eso lo dictamina el asesor — el mismo motivo por el que el criterio de caja entró
  // marcado dos líneas más arriba. **Baja a 7 el commit que los apruebe.**
  //
  // ⚠️ Y UNA COSA QUE EL NÚMERO NO DICE: son TRES textos marcados y este censo cuenta UNO. No es un
  // fallo del contador sino su regla —cuenta LITERALES que contienen la marca— y el bloque factoriza
  // la marca en una constante (`MARCA_RETENCION`) que luego concatena tres veces. Queda anotado
  // porque significa que este censo mide marcas escritas, no superficies marcadas, y quien lea un
  // «+1» aquí no debe deducir «un rótulo».
  // 🔴 17-ago-2026 (tanda B) · 8 → 1. Aprobados: criterio de caja (etiqueta + 3 opciones), los tres
  // de retención de IRPF y los dos avisos de Bizum. QUEDA UNO, y se queda A PROPÓSITO:
  // `PENDIENTE_MODO_EMISION` — su rama `receipt` toca terreno de la regla 26 y esa pregunta se
  // responde SOLO con el guion H2, así que no se aprueba de refilón con el resto de la pantalla.
  'settingsView.js': 1,
});

/** Marcadores que viven en un LITERAL (los que pueden pintarse). Los comentarios no son literales. */
function marcadoresEnLiterales(codigo, nombre) {
  const sf = ts.createSourceFile(nombre, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const hallados = [];
  const v = (n) => {
    const trozos = ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)
      ? [n]
      : ts.isTemplateExpression(n) ? [n.head, ...n.templateSpans.map((s) => s.literal)] : [];
    if (trozos.some((t) => t.text.includes(MARCA))) {
      hallados.push(sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1);
    }
    ts.forEachChild(n, v);
  };
  v(sf);
  return hallados;
}

function censoActual() {
  const out = {};
  for (const f of fs.readdirSync(DIR_JS).filter((n) => n.endsWith('.js'))) {
    const n = marcadoresEnLiterales(fs.readFileSync(path.join(DIR_JS, f), 'utf8'), f).length;
    if (n > 0) out[f] = n;
  }
  return out;
}

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-402 · R6 · SUELO: el escáner encuentra la ranura `btnBizum` y el corpus', () => {
  // Si el escáner se queda ciego, «cero marcadores» y «no supe mirar» dan el mismo verde — y este
  // guard pasaría para siempre sobre una pantalla llena de marcadores.
  const ficheros = fs.readdirSync(DIR_JS).filter((n) => n.endsWith('.js'));
  assert.ok(ficheros.length >= 20, `🔴 ESCÁNER CIEGO: solo veo ${ficheros.length} vistas en ${DIR_JS}`);

  const vista = fs.readFileSync(path.join(DIR_JS, 'invoiceDetailView.js'), 'utf8');
  assert.match(vista, /const btnBizum = document\.createElement/,
    '🔴 ESCÁNER CIEGO: no encuentro la ranura `btnBizum` en invoiceDetailView.js. O se renombró, o ' +
    'se movió — en los dos casos los tests de abajo dejarían de vigilar el botón y saldrían verdes ' +
    'por no encontrar nada. ARREGLA EL ESCÁNER, no el número.');

  // 🔴 EL NÚMERO SE DERIVA, NO SE ESCRIBE (SCRUM-710). Aquí ponía «hay 36 medidos» cuando el censo
  // sumaba 13: un número escrito a mano no miente el día que se escribe, sólo envejece — y éste
  // llevaba tiempo haciéndolo. Se deriva del CENSO declarado, que es justo lo que el trinquete de
  // abajo obliga a mantener al día.
  //
  // Ojo con la distinción, que no es la misma para todos los números de este fichero: esto es una
  // AFIRMACIÓN DE CANTIDAD y por eso se deriva. Los SUELOS DE ALCANCE («>= 100 ficheros leídos»)
  // se escriben a mano a propósito: derivarlos haría que añadir un fichero subiera el listón solo,
  // y el suelo dejaría de poder caer nunca (la lección que SCRUM-377 dejó escrita).
  const declarado = Object.values(CENSO).reduce((a, b) => a + b, 0);
  const total = Object.values(censoActual()).reduce((a, b) => a + b, 0);
  assert.ok(total > 0,
    `🔴 ESCÁNER CIEGO: cero marcadores en literales, y el censo declara ${declarado}. `
    + 'ARREGLA EL ESCÁNER, no el número.');
});

// ── R1/R2/R3 · EL BOTÓN Y SU RANURA ─────────────────────────────────────────────────────────

const CTX = (bizum, charge = true) => ({
  hayCharge: charge,
  'bizum-disponible': charge && bizum,
  'bizum-no-disponible': !(charge && bizum),
});
const primariaDe = (ctx) => INVOICE_ACTION_REGISTRY
  .filter((a) => destinoEfectivo(a, 'pending', ctx) === 'primaria')
  .map((a) => a.id);

test('SCRUM-402 · 🔴 R1: con BIZUM_MANUAL_ENABLED=false el botón NO se pinta', () => {
  assert.deepEqual(primariaDe(CTX(false)).filter((id) => id === 'btnBizum'), [],
    '🔴 con Bizum APAGADO se sigue pintando `btnBizum` como primaria de `pending`. Es el defecto ' +
    'entero: acción primaria que, tras enseñar importe y nombre del cliente, devuelve 409 ' +
    '`bizum_disabled`.');

  // Y la mitad que lo hace real: la VISTA mira la bandera, no solo el dato. Sin esto, el registro
  // podría estar bien y el botón crearse igual.
  const vista = fs.readFileSync(path.join(DIR_JS, 'invoiceDetailView.js'), 'utf8');
  assert.match(vista, /if \(invoice\.chargeId && window\.appBizumManualEnabled\)/,
    '🔴 la vista vuelve a crear el botón mirando solo `invoice.chargeId`. El registro decide DÓNDE ' +
    'va, pero si el botón se crea igual, se pinta igual.');
});

test('SCRUM-402 · 🔴 R2 · CONTROL POSITIVO: con la bandera ENCENDIDA el botón vuelve a ser primaria', () => {
  // Probar solo el bloqueo no demuestra que no se haya bloqueado todo.
  assert.deepEqual(primariaDe(CTX(true)), ['btnBizum'],
    `🔴 con Bizum ENCENDIDO la primaria de pending es [${primariaDe(CTX(true))}] y debería ser btnBizum: ` +
    'el arreglo ha apagado el botón también cuando SÍ puede funcionar.');
});

test('SCRUM-402 · 🔴 R3: la ranura NUNCA queda vacía — hay primaria en los tres contextos', () => {
  for (const [nombre, ctx] of [
    ['bizum ON · con cobro', CTX(true)],
    ['bizum OFF · con cobro', CTX(false)],
    ['sin cobro en vuelo', CTX(false, false)],
  ]) {
    const p = primariaDe(ctx);
    assert.equal(p.length, 1,
      `🔴 en «${nombre}» la primaria de pending tiene ${p.length} ocupantes ([${p}]). Cero es un ` +
      'callejón sin salida —el estado se queda sin siguiente paso, que es lo que C2 vino a quitar—; ' +
      'dos rompe la regla 1.');
  }
  assert.deepEqual(primariaDe(CTX(false)), ['btnTogglePaid'],
    '🔴 con Bizum apagado la primaria no es `btnTogglePaid`. Se eligió ÉSE porque funciona y su ' +
    'texto ya está aprobado: cualquier otro generaría microcopy nueva (regla 30).');
});

// ── R4/R5 · EL TRINQUETE DEL MARCADOR ───────────────────────────────────────────────────────

test('SCRUM-402 · 🔴 R4: el censo de marcadores PINTABLES no sube, y el rojo nombra el fichero', () => {
  const actual = censoActual();
  const subidas = [];
  const nuevos = [];
  for (const [f, n] of Object.entries(actual)) {
    if (!(f in CENSO)) nuevos.push(`${f} (+${n})`);
    else if (n > CENSO[f]) subidas.push(`${f}: ${CENSO[f]} → ${n}`);
  }
  assert.deepEqual([...nuevos, ...subidas], [],
    `🔴 HAY MARCADORES NUEVOS QUE PUEDEN PINTARSE:\n    ${[...nuevos, ...subidas].join('\n    ')}\n\n` +
    '  Un `[PENDIENTE …]` en un literal acaba en la pantalla de un profesional. Si el texto ya está\n' +
    '  aprobado, escríbelo; si no, esa superficie no se pinta todavía. Y si de verdad tiene que\n' +
    '  salir con marcador, súbelo a `CENSO` A CONCIENCIA y di por qué en el commit.');

  // La otra mitad del trinquete: si BAJA, hay que anotarlo — o el censo envejece y deja de apretar.
  const bajadas = Object.entries(CENSO)
    .filter(([f, n]) => (actual[f] ?? 0) < n)
    .map(([f, n]) => `${f}: ${n} → ${actual[f] ?? 0}`);
  assert.deepEqual(bajadas, [],
    `🔴 el censo BAJÓ (enhorabuena) y no se ha actualizado:\n    ${bajadas.join('\n    ')}\n\n` +
    '  Actualiza `CENSO`. Un trinquete que no se aprieta cuando puede deja de ser un trinquete.');
});

test('SCRUM-402 · 🔴 R4b: un fichero que SALE del censo NO sale de la vigilancia', () => {
  // Lo pregunta el asesor al aprobar SCRUM-424, y con razón: `jobRailBlocks.js` se borró de
  // `CENSO` al aprobarse su rótulo. Si el trinquete solo mirase los ficheros que ya conoce, salir
  // de la lista sería salir del radar — la misma forma que el guard de destino que deja pasar la
  // clave que no conoce (SCRUM-418).
  //
  // NO los tiene: `censoActual()` ENUMERA el directorio y cualquier fichero con marcadores que no
  // esté en `CENSO` cae por la rama `nuevos`. Se comprueba con el mecanismo, no de palabra.
  const actual = censoActual();
  assert.ok(
    !('jobRailBlocks.js' in CENSO),
    '🔴 el fixture de este test ya no vale: `jobRailBlocks.js` volvió a `CENSO`, así que esto no ' +
      'estaría probando el caso de un fichero FUERA de la lista.',
  );
  assert.ok(
    !('jobRailBlocks.js' in actual),
    '🔴 `jobRailBlocks.js` tiene marcadores otra vez y R4 ya debería estar en rojo.',
  );

  // La comprobación de verdad: se simula un fichero desconocido CON marcador y se mira que la
  // regla de R4 lo clasifique como `nuevo`. Es la misma expresión que usa R4, sin tocar el disco.
  const inventado = { ...actual, 'ficheroQueNadieCensó.js': 1 };
  const nuevos = Object.keys(inventado).filter((f) => !(f in CENSO));
  assert.deepEqual(
    nuevos, ['ficheroQueNadieCensó.js'],
    '🔴 EL TRINQUETE SOLO VIGILA LO QUE YA CONOCE: un fichero con marcadores que no esté en `CENSO` ' +
      'no se detecta. Entonces borrar una entrada —lo correcto cuando se aprueba un texto— sacaría ' +
      'ese fichero de la vigilancia para siempre, y el siguiente marcador entraría en verde.',
  );
});

test('SCRUM-402 · 🔴 R5: un marcador en un COMENTARIO no lo pone rojo', () => {
  // Sin esto el guard vigilaría la PALABRA y no el hecho, y acabaría desactivado por molesto —
  // exactamente lo que le pasó al trinquete de copy antes de SCRUM-349.
  const conComentario = `// aquí NO se puede escribir ${MARCA} microcopy oficial] todavía\nconst a = 1;\n`;
  assert.deepEqual(marcadoresEnLiterales(conComentario, 'x.js'), [],
    '🔴 un marcador dentro de un comentario cae. Un comentario no llega a ninguna pantalla, y ' +
    'obligar a redactarlo esquivando las palabras que explica es cobrar un impuesto sobre la ' +
    'claridad del código (SCRUM-349).');

  const enBloque = `/**\n * El rótulo va con ${MARCA} microcopy oficial] hasta que lo apruebe el fundador.\n */\nconst b = 2;\n`;
  assert.deepEqual(marcadoresEnLiterales(enBloque, 'x.js'), [], '🔴 el comentario de bloque también cae');

  // Y el CONTROL, que es lo que impide que este test pase por ceguera: el MISMO texto en un
  // literal SÍ tiene que detectarse.
  const enLiteral = `el.textContent = '${MARCA} microcopy oficial]';\n`;
  assert.equal(marcadoresEnLiterales(enLiteral, 'x.js').length, 1,
    '🔴 el mismo texto en un LITERAL tampoco se detecta: el escáner no ve nada y R4 sería un verde ' +
    'vacío.');
});
