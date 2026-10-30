// SCRUM-419 (+ SCRUM-456) · CI tiene que DECLARAR lo que no ha ejecutado.
//
// Sin gate — y es el punto entero del fichero: el guard que vigila a los gateados no puede estar
// gateado él mismo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO, MEDIDO (10-ago-2026)
//
// Hay **7 tests** gateados por `LIBRO_PG_URL` en 5 ficheros, que en su día se saltaban SIEMPRE en
// CI — y la suite informaba «0 fallos» exactamente igual que si hubieran pasado.
//
// **«0 fallos porque pasó» y «0 fallos porque no se ejecutó» son hoy el mismo número.** Eso es la
// familia de defectos de toda esta semana: un mecanismo que no corre se lee igual que uno que
// aprueba.
//
// ⚠️ CORRECCIÓN (SCRUM-456, 10-ago-2026): la cabecera decía que *«`ci.yml` no define esa variable
// ni levanta ningún Postgres»*. **Ya no es cierto.** El workflow levanta hoy un
// `postgres:16-alpine` desechable y define `LIBRO_PG_URL`; su paso se llama literalmente «Tests
// (incluidos los 7 de banco)». Se corrige el TEXTO, no el mecanismo — el guard sigue siendo
// necesario, y de hecho fue ese CI el que cazó el rojo de SCRUM-438 que la tanda local no veía.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 SCRUM-456 · POR QUÉ ESTE FICHERO CRECIÓ EN VEZ DE NACER OTRO
//
// El trinquete de arriba vigilaba **7** saltos. Medidos los del árbol entero: **74 saltan, y 67 lo
// hacían MUDOS** —`skip: !ENABLED }`, un booleano pelado— gateados por `QA_DB_TEST`,
// `A55_DB_TEST` y `BOT_SUITE_TEST`. La lección estaba escrita aquí abajo desde el primer día y 67
// tests la incumplían sin que nadie los mirara.
//
// > Un trinquete que vigila la parte que ya sabíamos mirar no es un trinquete: es una confirmación.
//
// Así que **no se ha construido un segundo trinquete** (el defecto que cerraron SCRUM-436 y 447):
// se ha ampliado el UNIVERSO del que ya había. El invariante era correcto —«cada salto dice por
// qué»—; lo que estaba acotado era dónde miraba.
//
// 🔴 Y NO SE ASSERTEA EL TOTAL. Un `assert(saltos === 74)` lo rompe la primera sesión que añada un
// test de base, alguien sube el número, y **un número que la gente sube no es un trinquete: es un
// peaje** (pasó con el marcador de SCRUM-402). Lo que se assertea es el INVARIANTE, que es cierto
// con 74, con 80 y con 3. El único número es el SUELO, y va al revés: si el censo devuelve CERO,
// falla — sabemos que hay decenas, y un cero significa que no supo contar.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LO QUE ESTE FICHERO **NO** HACE, Y ES LO MÁS IMPORTANTE
//
// **No quita el gate.** Los 7 necesitan un Postgres de verdad: crean un `PrismaClient` contra el
// banco y prueban TENENCIA contra el motor real —que un merchant no vea los datos de otro— y el
// cuadre entre pantallas. Hacerlos correr sin banco con un cliente falso sería **fabricar el
// defecto que este ticket persigue**: un test verde que no prueba nada.
//
// Si un test necesita banco, lo necesita. Lo correcto es que **CI declare que no lo corrió**, no
// que finja que lo corrió. Eso es lo que hace este guard.
//
// ⚠️ Y montar un Postgres en CI es **coste recurrente** y decisión del fundador (regla 36): va
// como ticket aparte, no se cuela aquí.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { leerSiSigueAhi, exigirCorpusLeido } from './_barrido-estable.mjs'; // SCRUM-740

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const VARIABLE = 'LIBRO_PG_URL';

/**
 * EL INVENTARIO DECLARADO — 7 tests, uno por línea, con el fichero donde vive.
 *
 * No es decoración: es un TRINQUETE. Si aparece un gateado nuevo y nadie lo declara aquí, el guard
 * se pone rojo — porque un test que deja de ejecutarse en silencio es indistinguible de uno que no
 * existe. Y si un gateado deja de necesitar banco, este número **BAJA**, que es la única dirección
 * buena.
 */
const GATEADOS_DECLARADOS = Object.freeze({
  // SCRUM-324 (E3): los DOS que necesitan base — la cadena entera hasta el libro de recibidas
  // y su control negativo. Son justo los que prueban que la funcion existe, asi que su skip
  // es lo mas importante que este inventario declara.
  'scrum324-cadena-hasta-el-libro.test.mjs': 2,
  'scrum244-supresion-y-anonimizado.test.mjs': 1,
  // SCRUM-914: los equipos del cliente en el borrado y en el anonimizado. Necesitan banco porque lo
  // que vigilan son las FK RESTRICT de `equipments`, y ésas sólo las hace cumplir el motor.
  'scrum914-equipos-borrado-y-anonimizado.test.mjs': 2,
  'scrum295-modelo-303-postgres.test.mjs': 1,
  'scrum296-libro-postgres.test.mjs': 1,
  // SCRUM-980: el historial de la ficha. Necesita banco porque vigila la TENENCIA de cinco consultas
  // encadenadas (cliente, trabajos, partes, albaranes, fotos) y el recorte del técnico.
  'scrum980-historial-del-cliente.test.mjs': 1,
  'scrum297-evidencias-postgres.test.mjs': 2,
  // SCRUM-979: la «Última visita». Necesita banco porque lo que vigila es la CONSULTA — el
  // `groupBy` con la tenencia dentro y el recorte del técnico por los tres ejes de SCRUM-650.
  'scrum979-ultima-visita.test.mjs': 1,
  // SCRUM-809: el acceso tras cancelar. Necesita banco porque lo que mide es lo que le CONTESTA el producto al
  // profesional que pagó y canceló (una petición real a las rutas con paywall). Su mitad sin banco
  // vive en `scrum809b-paywall-sin-banco.test.mjs`, que sí corre en cada `npm test` y en el meta-guard.
  //
  // 🔴 DE 5 A 7 EL 6-oct-2026 (SCRUM-1469), Y NO ES UN GATEADO NUEVO. Este inventario cuenta LLAMADAS
  // `test(` ESCRITAS, no casos. El 21-sep-2026 se declaró con 5 (`2fad7621`): dos dentro de un bucle
  // sobre las dos puertas de cancelación y tres fuera. SCRUM-1415 pide el nombre de cada caso escrito
  // literal, y desenrollar ese bucle escribe cuatro llamadas donde había dos.
  // EL INVARIANTE, que es la cifra que protege algo: el fichero registra 7 CASOS antes y 7 después, con
  // los mismos nombres y en el mismo orden (medido el 6-oct con y sin el bucle; `docs/master/SCRUM-1469.md`).
  // Ningún test ha dejado de ejecutarse: ha cambiado cuántas veces está escrito `test(`.
  // La decisión es del ORQUESTADOR (mensaje del 6-oct-2026, copiado en SCRUM-1469), no del fundador: la
  // cifra vive sólo en esta lista, no en `ci.yml`, y lo que se corrige es la unidad de medida, no el listón.
  'scrum809-paywall-tras-cancelar.test.mjs': 7,
  // SCRUM-992: los partes recortados por rol. Necesita banco porque lo que vigila es lo que el técnico
  // puede LEER, EDITAR y FIRMAR sobre partes de otros —las nueve rutas, la app entera, tres sesiones—.
  // La mitad estructural (AST) no lo necesita y corre en cada `npm test`.
  'scrum992-partes-recortan-por-rol.test.mjs': 1,
  'scrum389-un-solo-iva.test.mjs': 2,
  // SCRUM-974: el resumen del lunes. Necesita banco porque corre el resumen DE VERDAD, que lee la
  // bandeja de pendientes de facturar y el modo de emisión de cada negocio. Solo el desechable:
  // recorre TODOS los merchants activos de la base (por eso no va a staging).
  'scrum974-firmado-sin-facturar-en-el-lunes.test.mjs': 1,
  // SCRUM-728d: los de la MEDICIÓN en loopback — el suelo (RTT ~0), los tres caminos que
  // reservan con 1/5/10 simultáneas y la pendiente del viaje que escala. Necesitan banco porque
  // cronometran el trabajo REAL del servidor: sin base no hay nada que cronometrar. Y necesitan
  // que sea DESECHABLE porque emiten números de serie y crean facturas — 1.000 en el de la
  // pendiente. SCRUM-1027 (21-sep-2026): el cuarto camino («justificante») dejó de reservar —
  // regla 24, un merchant ES sin flag ya no emite nada — así que se mide APARTE, con su propio
  // test: que el modo `receipt` rechaza siempre bajo concurrencia, sin colar una reserva por una
  // carrera. Sube de 3 a 4.
  'scrum728d-ms-en-loopback.test.mjs': 4,
  // SCRUM-876c (T2): los tres que dependían de `MERCHANT_ID = 1` y pasan a `withMerchant`. Hasta
  // aquí sólo corrían con `QA_DB_TEST=1` (staging) y ese destino lo conservan; éste es el segundo.
  // Necesitan banco porque lo que vigilan ES la escritura: la suma de lo cobrado (13), el
  // operario congelado en el Job (52) y el guardado parcial del cliente (692).
  'scrum13-cobrado.test.mjs': 1,
  'scrum52-operario.test.mjs': 1,
  'scrum692-guardado-parcial-en-base.test.mjs': 1,
  // SCRUM-876e (T3): dos de los OBSOLETOS, alineados al código de hoy. Mismo trato que los tres de
  // arriba: conservan staging con `QA_DB_TEST=1` y ganan éste como segundo destino. Necesitan banco
  // porque levantan la app entera y lo que vigilan es a QUIÉN le contesta: el PDF de la factura de
  // otro merchant (72), y el albarán de otro merchant y sus dos candados, firmado y modo (los dos
  // de `albaran`).
  'scrum72-pdfs-privados.test.mjs': 1,
  'albaran.test.mjs': 2,
  // SCRUM-876f (grupo C de SCRUM-868): el envío del presupuesto por ventana o por plantilla.
  // Conserva staging con `A55_DB_TEST=1` y gana éste como segundo destino. Necesita banco porque
  // lo que vigila son las FILAS que deja el envío (una `template`, una `service` a 0 €) y la
  // ventana que abre un entrante. En este destino va en seco por sí mismo y con la salida cortada.
  'a55-window-quote.test.mjs': 1,
  // SCRUM-876f: la suite del bot, el otro del grupo C. Necesita banco porque recorre el webhook
  // de verdad —sesiones, solicitud, adjunto, baja— y lee lo que deja escrito. Mismo trato: staging
  // con `BOT_SUITE_TEST=1`, y éste como segundo destino, en seco y con la salida cortada.
  'bot-suite.test.mjs': 1,
  // SCRUM-876g (T4 de SCRUM-876): los cuatro del albarán que seguían sólo en staging. Conservan
  // `QA_DB_TEST=1` y ganan éste como segundo destino, en seco y con la salida cortada. Necesitan
  // banco porque levantan la app y leen lo que la ruta deja escrito:
  //   · el envío del albarán firmado por WhatsApp: quién puede (el técnico que lleva el trabajo) y
  //     la fila de `whatsAppMessage` que deja;
  'scrum47-enviar-albaran-wa.test.mjs': 1,
  //   · la firma remota entera: el enlace, la página pública, la versión que el cliente vio y el
  //     auto-envío de la copia firmada;
  'scrum49-firma-remota.test.mjs': 1,
  //   · el webhook cuando el cliente contesta sobre un albarán: el acuse y el aviso al profesional;
  'scrum50-bot-albaranes.test.mjs': 1,
  //   · las evidencias que se sellan al firmar (remoto e in situ) y que no salen por ninguna respuesta.
  'scrum68-evidencias-firma.test.mjs': 1,
  // SCRUM-967b: el enlace del portal. Necesita banco porque lo que vigila es a QUIÉN se le da el
  // token del cliente — el correo real, la firma real que sella y la segunda que no debe soltarlo.
  'scrum967b-el-portal-en-el-envio.test.mjs': 1,
  // SCRUM-1059: las acciones masivas de etiquetado. Necesita banco porque vigila la TENENCIA (un
  // id de otro merchant no se toca) y que se relee igual tras la escritura (quinto eslabón,
  // SCRUM-580). La mitad pura (`aplicarEtiquetaMasiva`) no necesita base y corre siempre.
  'scrum1059b-etiquetado-masivo-postgres.test.mjs': 1,
  // SCRUM-1062: el historial de WhatsApp de la ficha. Necesita banco porque vigila la TENENCIA
  // (dos merchants), que un documento borrado no se lleva el mensaje por delante (tabla suelta,
  // ENT-3) y las páginas de 20 con cursor.
  'scrum1062-historial-whatsapp-cliente.test.mjs': 1,
  // SCRUM-1518b: la misma función, y que el entrante del cliente NO sale. Necesita banco porque el
  // filtro es un operador de Prisma (`not`): el doble en memoria de la sonda de S4 lo ignoraba y
  // daba verde con el arreglo y sin él.
  'scrum1518b-la-ficha-no-ensena-entrantes.test.mjs': 1,
  // SCRUM-1014: los sitios del cliente. Necesita banco porque vigila la TENENCIA (merchant y
  // cliente) en las cuatro funciones, el orden estable, y que crear/editar un sitio no escribe
  // `Quote.shippingAddress` (P2/DOC-12).
  'scrum1014-sitios-del-cliente.test.mjs': 1,
  // SCRUM-1036: las notas del cliente. Necesita banco porque vigila la TENENCIA, que el autor se
  // CONGELA como texto (borrar al técnico no vacía la nota vieja) y la «Nota fija» sintetizada
  // desde `Customer.notes` sin copiarla ni inventarle fecha/autor.
  'scrum1036-notas-del-cliente.test.mjs': 1,
  // SCRUM-1057: fusionar dos clientes duplicados. Necesita banco porque vigila las CUATRO tablas
  // con FK real a `customers` (Quote, Charge, QuoteRequest, CustomerEvent) moviéndose antes del
  // `DELETE` —si no, Postgres lo rechazaría—, las cinco sin FK, el rechazo por factura emitida,
  // la tenencia y el desvínculo de quien apuntara al fusionado como su empresa. SCRUM-1291 sube de
  // 4 a 5: las direcciones de obra (`customer_sites`, FK RESTRICT) — el defecto era que el MOTOR
  // rechazaba el `DELETE`, y eso sólo lo prueba un Postgres de verdad.
  'scrum1057b-fusion-clientes-postgres.test.mjs': 5,
  // SCRUM-1103: la cadena entera de la retención practicada (alta → se lee de vuelta con su
  // precisión Decimal → la LISTA la trae → `updateExpense` corrige sin borrar) y su control
  // negativo. Necesita banco porque lo que prueba es que el ALTER ya aplicado y el dominio
  // escriben y leen la MISMA fila, no que «se pinta el campo» (mismo motivo que SCRUM-324).
  'scrum1103-retencion-practicada-en-gastos.test.mjs': 2,
  // SCRUM-1333: el encolado del alta para la AEAT, una vez por factura. Necesita banco porque lo
  // que vigila es del MOTOR: que `pg_advisory_xact_lock` hace esperar de verdad al segundo
  // encolado (se mira en `pg_locks`) y que su recuento, lanzado tras conseguir el cerrojo, ve la
  // fila que acaba de confirmar el primero. El banco en memoria de su test hermano no lo prueba.
  'scrum1333-carrera-del-encolado-postgres.test.mjs': 3,
  // SCRUM-1397: los DOS que ejercitan el recorte de facturas del Tecnico contra Prisma de verdad.
  // Necesitan banco porque lo que vigilan es el WHERE: que la puerta deje de devolver las facturas
  // del negocio y siga devolviendo las suyas por los tres ejes. Sin base no sirve un doble: medido
  // en scrum597, su doble contesta `invoice.findFirst` con la misma factura sea cual sea el where,
  // pasa 8 de 8 y no dice NADA del recorte.
  'scrum1397-el-tecnico-ve-sus-facturas.test.mjs': 2,
  // SCRUM-1188d: los TRES que miran que `tiers` de una plantilla quede a NULL de SQL (el alta sin
  // niveles y el `PUT` con `tiers: null`), mas su suelo. Necesitan banco porque lo que vigilan es
  // QUE NULL queda en la columna: por la API de Prisma el NULL de SQL y el valor JSON `null` se leen
  // igual, y solo el SQL crudo contra Postgres (`IS NULL`, `jsonb_typeof`) los distingue. La sonda
  // que lo intento sin base salio ciega (SCRUM-1188c). `jsonAnulable`, sin base, corre siempre.
  'scrum1188d-tiers-tambien-se-vacia.test.mjs': 3,
  // SCRUM-1188d: el que crea una revision con `crearRevisionDeQuote` de verdad y relee por SQL que
  // las columnas `Json?` vacias se heredan vacias. Mismo motivo. El censo de la lista y la funcion
  // pura corren siempre.
  'scrum1188d-la-revision-hereda-el-vacio.test.mjs': 1,
  // SCRUM-1515: el merchant que crea nuestro guion nace igual que nacia el de `POST /auth/register`
  // (la ruta se cerro el 8-oct-2026 y la referencia es su foto, `_scrum1515-foto-de-la-ruta.json`),
  // la ruta cerrada no da de alta, y quien ya tiene cuenta sigue entrando. Necesita banco porque
  // compara la FILA campo a campo, con sus valores por defecto, y lo que el alta deja colgando
  // (sesiones, correos). Solo el desechable: da de alta y borra merchants por el guion.
  'scrum1515-nuestra-puerta-de-alta.test.mjs': 1,
  // SCRUM-1403: los TRES que ejercitan el recorte de presupuestos del Tecnico y la pestana de
  // documentos de la ficha de cliente contra Prisma de verdad. Necesitan banco por el mismo motivo
  // que los de SCRUM-1397: lo que vigilan es el WHERE (el recorte en AND con la busqueda y con el
  // filtro por autor, los ejes del Trabajo, las revisiones), y eso lo contesta Postgres, no un doble.
  // SCRUM-1403b: y el CUARTO, el de los eventos con importe y las cifras de la ficha. Necesita banco
  // porque entra por la RUTA real con sesiones guardadas en la base (Tecnica, administradora y duena)
  // y mira lo que `GET /admin/customers/:id/detail` arma con los eventos y facturas que lee de
  // Postgres; luego pinta la ficha con ESA respuesta. Con un doble se probaria el doble, no la ruta.
  // Lo que se lee sin base (los 7 sitios que escriben un importe, el criterio `seesOnlyOwnJobs`)
  // va en los dos casos AST del mismo fichero, que corren siempre.
  'scrum1403-el-tecnico-y-las-otras-puertas.test.mjs': 4,
  // SCRUM-1489: el buscador de arriba pasa por esas mismas dos puertas (fila 9 del censo de
  // SCRUM-1390). Necesita banco por el mismo motivo: lo que vigila es el WHERE que la busqueda
  // manda con el recorte en AND, y que ese filtro deja fuera lo ajeno lo contesta Postgres. La
  // mitad sin base (nueve casos, con Prisma doblado) corre siempre.
  'scrum1489-la-busqueda-recorta-al-tecnico.test.mjs': 1,
  // SCRUM-1346: los CUATRO que entran por la RUTA, con sesiones de verdad, y miran si el Tecnico
  // alcanza el presupuesto o la factura de un companero, si sigue alcanzando lo suyo y si la
  // administradora lo sigue alcanzando todo. Necesitan banco porque lo que vigilan es la consulta
  // que arma cada ruta (con su recorte o sin el), y lo contesta Postgres. El caso sin base (la
  // lista del trinquete solo nombra sondas que existen) corre siempre.
  'scrum1346-el-tecnico-ve-documentos-ajenos.test.mjs': 4,
  // SCRUM-1145: el que crea, edita y borra un sitio por la RUTA real, con sesiones de verdad en dos
  // merchants. Necesita banco porque lo que vigila es la tenencia (un merchant no ve ni toca el
  // sitio de otro: la consulta la contesta Postgres) y que borrar un sitio deja intacta la dirección
  // ya copiada en un presupuesto, que es otra fila. La pantalla (once casos en el banco de vistas)
  // corre siempre.
  'scrum1145-pestana-sitios.test.mjs': 1,
  // SCRUM-1150c: los DOS que miran que dos «Crear revision» a la vez no dejan dos filas con la
  // misma revision. Necesitan banco porque lo que vigilan es del MOTOR: que
  // `pg_advisory_xact_lock` hace esperar de verdad a la segunda creacion (se mira en `pg_locks`)
  // y que su lectura del grupo, lanzada tras conseguir el cerrojo, ve la revision que acaba de
  // confirmar la primera. La mitad con Prisma doblado (cuatro casos) corre siempre.
  'scrum1150c-carrera-de-la-revision-postgres.test.mjs': 2,
  // SCRUM-1390e: los CUATRO que piden el enlace del portal por la RUTA, con sesiones de verdad: el
  // Tecnico no se lo lleva si el cliente tiene un documento ajeno, si se lo lleva cuando todo es suyo,
  // la administradora y la duena sin cambios, y la ficha no lo sirve en crudo. Necesitan banco porque
  // lo que vigilan es la CUENTA de documentos con el recorte de las dos puertas, y eso lo contesta
  // Postgres. Los dos casos AST corren siempre.
  'scrum1390e-el-portal-solo-lo-suyo.test.mjs': 4,
  // SCRUM-1599f (primer lote del diseño B de SCRUM-1599, c.20715): cuatro que hasta aquí SÓLO
  // corrían con `QA_DB_TEST=1` (staging) y que CI saltaba sin que nadie lo viera. Conservan
  // staging y ganan éste como segundo destino, con `_banco-libro.mjs`. Necesitan banco porque lo
  // que vigilan es lo que queda ESCRITO: el autor del gasto (109), el filtro por fecha de
  // ejecución de trabajos.csv (106), los clientes referenciados del paquete (104) y la tenencia
  // de la cotización y el proveedor de un gasto (135). El caso sin base de 106 corre siempre.
  'scrum109-expense-teammember.test.mjs': 2,
  'scrum106-trabajos-fecha.test.mjs': 1,
  'scrum104-clientes-referenciados.test.mjs': 1,
  'scrum135-gasto-tenencia.test.mjs': 4,
  // SCRUM-1599h (segundo lote del diseño B): siete más, con la misma forma. Necesitan banco porque
  // lo que vigilan lo contesta la base: los textos del documento que se guardan, se releen y salen
  // en el PDF (593d), y por la RUTA real con sesiones guardadas: el reenvío de la invitación que no
  // pierde la fila (131), el `payment.confirmed` duplicado que no re-paga (webhooks), el operario
  // del trabajo, el cobro y el albarán (57 y 22), los albaranes de un trabajo sin presupuesto (51) y
  // que la lista de trabajos no crezca en consultas con el número de filas (58). Los casos sin base
  // de webhooks corren siempre.
  'scrum593d-viaje-completo-del-texto.test.mjs': 4,
  'scrum131-resend-honesto.test.mjs': 1,
  'webhooks-idempotencia.test.mjs': 1,
  'scrum57-operario-propagacion.test.mjs': 1,
  'scrum22-operario-readpath.test.mjs': 1,
  'scrum51-job-sin-quote.test.mjs': 1,
  'scrum58-jobs-n1.test.mjs': 1,
  // SCRUM-1599i (tercer lote del diseño B): siete más, con la misma forma. Necesitan banco porque
  // lo que vigilan lo contesta la RUTA real con filas guardadas: el IDOR de /pay/bank y /pay/mp por
  // id numérico (90), el hub de Equipo y sus cuentas por miembro (136), el gate por campo del PATCH
  // de un trabajo (120), el filtro por operario que no le da a un técnico lo ajeno (148), las sumas
  // de /admin/metrics/operarios (24), el PDF regenerado del presupuesto (pdfs) y el tipoOperacion
  // con su auditoría (66). Los casos sin base de pdfs y de 66 corren siempre.
  'scrum90-pay-bank-mp-token.test.mjs': 1,
  'scrum136-hub-equipo.test.mjs': 3,
  'scrum120-patch-job-roles.test.mjs': 1,
  'scrum148-filtro-por-miembro.test.mjs': 2,
  'scrum24-operarios-metrics.test.mjs': 1,
  'pdfs.test.mjs': 1,
  'scrum66-tipo-operacion.test.mjs': 1,
  // SCRUM-1599k (cuarto lote del diseño B): seis más, con la misma forma. Necesitan banco porque lo
  // que vigilan lo contesta el código real con filas guardadas: el IDOR de /recibo/:token por id
  // numérico (74), el 409 de /auth/register sin merchant fantasma (94), la recapitulativa partida
  // por mes (17), el catálogo de information_schema que lee el arranque (222), el .eml de la
  // factura con su PDF adjunto (76) y la factura que se confirma o cae junto con su auditoría (207).
  // Los casos sin base de 17, 222 y 207 corren siempre.
  'scrum74-recibo-token.test.mjs': 1,
  'scrum94-register-teammember.test.mjs': 1,
  'scrum17-recapitulativa.test.mjs': 1,
  'scrum222-deriva-arranque.test.mjs': 2,
  'scrum76-email-adjunto.test.mjs': 1,
  'scrum207-emision-auditada.test.mjs': 2,
  // SCRUM-1599m (quinto lote del diseño B): los ocho «HE», con la misma forma. Necesitan banco porque lo
  // que vigilan lo contesta el código real con filas guardadas: el gate del flag en verifactu.xml (73), el
  // registro que bloquea los bytes del export fiscal (221), la consolidación por cliente que no refactura
  // (171a), la tenencia de los CSV (25-exports), el XML dentro de datos.zip (82), el albarán a medias que
  // no se consolida (170), el rango de fechas del paquete (25-export-zip) y el técnico que solo ve sus
  // Trabajos (tenancy-permisos). Los seis casos sin base de 170 corren siempre.
  'scrum73-verifactu-gate.test.mjs': 1,
  'scrum221-export-fiscal-cero-bytes.test.mjs': 1,
  'scrum171a-consolidar-cliente.test.mjs': 1,
  'scrum25-exports.test.mjs': 1,
  'scrum82-zip-verifactu.test.mjs': 1,
  'scrum170-facturacion-parcial.test.mjs': 1,
  'scrum25-export-zip.test.mjs': 1,
  'tenancy-permisos.test.mjs': 2,
  // SCRUM-1599j: el que 1599i apartó, con la misma forma. Necesita banco porque el IDOR de /pay/card,
  // /pay/bizum y /pay/invoice por id numérico lo contesta la RUTA real con cobros guardados. Su caso
  // sin base (el ancla del id, sembrada) corre siempre.
  'scrum85-pay-routes-token.test.mjs': 1,
  // SCRUM-1599p (lote 6a del diseño B, medido antes en §1599o): los que llevan carrera y no se pisan en la
  // tanda. Cinco con la forma de 1599m (115, 127, 178, 92, 814-carrera-del-tramo.gated) y tres que antes
  // sólo iban a `yaqu_dev_javier` (592, 767, 793), que con el banco toman `URL_BANCO`. Más scrum173, opción
  // (A) de SCRUM-1599 c.20940: de sus 7, el de las cadenas YA PERSISTIDAS SALTA también con el banco (recorre
  // las facturas de toda la base) y se queda en staging; aquí cuenta, porque su salto nombra la variable.
  // El caso sin base de 178 corre siempre.
  'scrum115-wa-fallo-registrado.test.mjs': 2,
  'scrum127-paywall-bloquea.test.mjs': 1,
  'scrum173-cadena-verifactu-serializada.test.mjs': 7,
  'scrum178-emision-manual.test.mjs': 2,
  'scrum92-login-operario.test.mjs': 1,
  'scrum814-carrera-del-tramo.gated.test.mjs': 3,
  'scrum592-concurrencia-serie.test.mjs': 4,
  'scrum767-cura-concurrencia.test.mjs': 4,
  'scrum793-la-carrera-del-token.test.mjs': 6,
  // SCRUM-1599s (lote 6b del diseño B): los dos que 1599p dejó fuera, ya alineados con la serie F en 1599r
  // (SCRUM-1599 c.20947). 234.gated con la forma de 1599m; 781 con `URL_BANCO`, como 592. Los cuatro casos
  // sin base de 781 corren siempre.
  'scrum234-carrera-serie.gated.test.mjs': 1,
  'scrum781-concurrencia-de-la-factura.test.mjs': 4,
  // SCRUM-1599t: scrum574-mismo-cliente-tras-migracion con la forma de 1599m. Su caso «CONTRA POSTGRES», que lee
  // los clientes de TODA la base, salta en el banco con su motivo y se queda en staging (opción A, como 173).
  'scrum574-mismo-cliente-tras-migracion.test.mjs': 2,
});
const TOTAL_DECLARADO = Object.values(GATEADOS_DECLARADOS).reduce((a, b) => a + b, 0);

/**
 * Los tests gateados por la variable, DERIVADOS del AST. No por `grep`: el gate viaja en el objeto
 * de opciones de `test(nombre, { skip: … }, fn)`, y contar apariciones del nombre de la variable
 * contaría también los comentarios que explican cómo correrlos.
 */
function todosLosSaltos() {
  const porFichero = new Map();
  let nodos = 0;
  const ficheros = fs.readdirSync(path.join(RAIZ, 'tests')).filter((f) => f.endsWith('.test.mjs'));

  let leidos = 0;
  for (const f of ficheros) {
    // SCRUM-740: `tests/` es a la vez el árbol que se barre y el sitio donde cuatro autopruebas
    // fabrican ficheros temporales. Se tolera SÓLO su desaparición; el suelo va al salir.
    const src = leerSiSigueAhi(path.join(RAIZ, 'tests', f));
    if (src === null) continue;
    leidos++;
    const sf = ts.createSourceFile('x.mjs', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const encontrados = [];
    const visitar = (n) => {
      nodos += 1;
      if (ts.isCallExpression(n) && /^(test|it)$/.test(n.expression.getText(sf))) {
        for (const a of n.arguments) {
          if (!ts.isObjectLiteralExpression(a)) continue;
          for (const p of a.properties) {
            if (ts.isPropertyAssignment(p) && p.name.getText(sf) === 'skip') {
              const nombre = ts.isStringLiteral(n.arguments[0]) ? n.arguments[0].text : '(dinámico)';
              encontrados.push({
                nombre,
                motivo: p.initializer.getText(sf).replace(/\s+/g, ' '),
                declara: declaraMotivo(p.initializer),
                mencionaBanco: src.includes(VARIABLE),
              });
            }
          }
        }
      }
      ts.forEachChild(n, visitar);
    };
    visitar(sf);
    if (encontrados.length) porFichero.set(f, encontrados);
  }
  // SCRUM-740: `ficherosMirados` cuenta lo que listó `readdir`. Éste cuenta lo que se LEYÓ, que
  // es lo que de verdad se analizó — sin él, tolerar la desaparición podría acabar en un censo
  // vacío que se leería como «ningún skip sin motivo».
  exigirCorpusLeido(leidos, 100, 'SCRUM-419 · censo de skips declarados');
  return { porFichero, nodos, ficherosMirados: ficheros.length, leidos };
}

/**
 * 🔴 SCRUM-456 · ¿ESTE `skip` PRODUCE UN MOTIVO LEGIBLE, O UN BOOLEANO PELADO?
 *
 * El criterio es **estructural, no por nombre de variable**: la expresión tiene que contener algún
 * literal de cadena NO VACÍO. `skip: !ENABLED` no lo tiene; `skip: !ENABLED && 'sin QA_DB_TEST=1'`
 * sí, y node lo imprime tras el `# SKIP` del TAP.
 *
 * Se hace así a propósito y no buscando `QA_DB_TEST` o `LIBRO_PG_URL`: un gate NUEVO con una
 * variable que hoy no existe tiene que entrar solo en la vigilancia. Buscar los nombres de hoy es
 * lo que dejó a 67 tests fuera durante meses.
 */
function declaraMotivo(expr) {
  let hay = false;
  const mirar = (n) => {
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && n.text.trim()) hay = true;
    if (ts.isTemplateExpression(n)) hay = true;   // `sin ${VARIABLE}` también dice algo
    ts.forEachChild(n, mirar);
  };
  mirar(expr);
  return hay;
}

/** Los gateados por `LIBRO_PG_URL`, DERIVADOS del censo general. Un solo recorrido del AST. */
function gateadosPorVariable() {
  const { porFichero, nodos, ficherosMirados } = todosLosSaltos();
  const soloBanco = new Map();
  for (const [f, tests] of porFichero) {
    const suyos = tests.filter((t) => t.mencionaBanco);
    if (suyos.length) soloBanco.set(f, suyos);
  }
  return { porFichero: soloBanco, nodos, ficherosMirados };
}

// ── EL SUELO DEL PROPIO GUARD ───────────────────────────────────────────────────────────

test('SCRUM-419 · SUELO: el extractor ENCUENTRA los gateados, o se declara ciego', () => {
  const { porFichero, nodos, ficherosMirados } = gateadosPorVariable();
  assert.ok(ficherosMirados > 100, `🔴 ESCÁNER CIEGO: solo ${ficherosMirados} ficheros de test mirados`);
  assert.ok(nodos > 5_000, `🔴 ESCÁNER CIEGO: solo ${nodos} nodos recorridos`);
  const total = [...porFichero.values()].reduce((a, v) => a + v.length, 0);
  assert.ok(
    total > 0,
    `🔴 ESCÁNER CIEGO: el extractor ve CERO tests gateados por ${VARIABLE}.\n\n` +
      '  «Ningún test está gateado» y «no supe encontrarlos» son el mismo número y significan lo\n' +
      '  contrario — que es EXACTAMENTE el defecto que este fichero persigue, cometido por el\n' +
      '  propio guard. Con cero, todo lo de abajo pasaría por vacío.',
  );
});

// ── EL TRINQUETE: NINGÚN GATEADO NUEVO EN SILENCIO ──────────────────────────────────────

test('SCRUM-419 · el inventario de lo que NO corre está declarado, fichero por fichero', () => {
  const { porFichero } = gateadosPorVariable();
  const real = Object.fromEntries([...porFichero].map(([f, v]) => [f, v.length]));

  assert.deepEqual(
    real, GATEADOS_DECLARADOS,
    '🔴 EL INVENTARIO DE TESTS QUE NO SE EJECUTAN HA CAMBIADO.\n\n' +
      `  declarado: ${JSON.stringify(GATEADOS_DECLARADOS)}\n` +
      `  real:      ${JSON.stringify(real)}\n\n` +
      '  Un test que deja de ejecutarse EN SILENCIO es indistinguible de uno que no existe: la\n' +
      '  suite sigue diciendo «0 fallos». Si has añadido un gateado, decláralo aquí y explica por\n' +
      `  qué necesita banco. Si uno ha dejado de necesitarlo, este número BAJA — y esa es la única\n` +
      '  dirección en la que se mueve solo.',
  );
});

test('SCRUM-419 · cada gateado dice POR QUÉ no corre, y nombra la variable', () => {
  // Un `skip: true` a secas es un test apagado sin motivo: al leer el log no se distingue de uno
  // roto que alguien silenció. El motivo tiene que nombrar la variable que lo gatea.
  const { porFichero } = gateadosPorVariable();
  const mudos = [];
  for (const [f, tests] of porFichero) {
    for (const t of tests) {
      if (!t.motivo.includes(VARIABLE) && !/sin LIBRO_PG_URL|banco/i.test(t.motivo)) {
        mudos.push(`${f} → «${t.nombre.slice(0, 50)}» · skip: ${t.motivo.slice(0, 40)}`);
      }
    }
  }
  assert.deepEqual(
    mudos, [],
    '🔴 HAY TESTS GATEADOS QUE NO DICEN POR QUÉ:\n' + mudos.map((m) => `   · ${m}`).join('\n') + '\n\n' +
      '  Un `skip` sin motivo legible es un test apagado que en el log no se distingue de uno roto\n' +
      '  que alguien silenció.',
  );
});

// ── 🔴 SCRUM-456 · EL MISMO INVARIANTE, SOBRE EL ÁRBOL ENTERO ────────────────────────────

test('SCRUM-456 · SUELO: el censo de saltos ve el árbol, y ve saltos', () => {
  // Tres recuentos, TRES asserts. Un suelo agregado puede estar tapando otro: si solo mirase el
  // total de saltos, un escáner que leyera cuatro ficheros y encontrase saltos en ellos pasaría
  // igual, y estaría ciego para los otros 387.
  const { porFichero, nodos, ficherosMirados } = todosLosSaltos();
  assert.ok(ficherosMirados > 300,
    `🔴 ESCÁNER CIEGO: solo ${ficherosMirados} ficheros de test mirados. Había 391 al escribir esto.`);
  assert.ok(nodos > 100_000,
    `🔴 ESCÁNER CIEGO: solo ${nodos} nodos recorridos. No se está entrando en los ficheros.`);

  const total = [...porFichero.values()].reduce((a, v) => a + v.length, 0);
  assert.ok(total > 0,
    '🔴 ESCÁNER CIEGO: el censo ve CERO tests con `skip:`.\n\n' +
    '  Y sabemos que hay decenas. «Ningún test salta» y «no supe encontrarlos» son el mismo\n' +
    '  número y significan lo contrario — que es EXACTAMENTE el defecto que este fichero\n' +
    '  persigue, cometido por el propio guard. Con cero, el invariante de abajo pasaría vacío.');
});

test('SCRUM-456 · 🔴 TODO salto declara su motivo — no solo los del banco', () => {
  // 🔴 AQUÍ NO SE ASSERTEA NINGÚN TOTAL. Que hoy sean 74 y mañana 80 da igual: lo que no puede
  // pasar es que UNO salte sin decir por qué. Ese invariante es cierto con cualquier número, así
  // que ninguna sesión que añada un test tendrá que «subir la cifra» — y por eso no se desactiva.
  const { porFichero } = todosLosSaltos();
  const mudos = [];
  for (const [f, tests] of porFichero) {
    for (const t of tests) {
      if (!t.declara) mudos.push(`${f} → «${t.nombre.slice(0, 60)}» · skip: ${t.motivo.slice(0, 40)}`);
    }
  }

  assert.deepEqual(mudos, [],
    `🔴 HAY ${mudos.length} TEST(S) QUE SE APAGAN SIN DECIR POR QUÉ:\n` +
    mudos.map((m) => `   · ${m}`).join('\n') + '\n\n' +
    '  En el log, un `skip` mudo no se distingue de un test roto que alguien silenció, ni de uno\n' +
    '  que dejó de existir. La suite sigue diciendo «0 fallos», y «0 fallos porque pasó» y «0\n' +
    '  fallos porque no se ejecutó» pasan a ser el mismo número.\n\n' +
    '  Se arregla haciendo que el `skip` produzca TEXTO en vez de un booleano:\n' +
    "     skip: !ENABLED                                    ← mudo\n" +
    "     skip: !ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated'   ← dice qué falta\n\n" +
    '  ⚠️ Y NO se arregla activando el test: si necesita banco, lo necesita. Lo que se pide es que\n' +
    '  DECLARE que no corrió, no que finja que corrió.');
});

test('SCRUM-456 · CONTROL NEGATIVO: un salto CON motivo no hace caer nada', () => {
  // Si el guard acusara también a los que ya hacen lo correcto, se desactivaría al primer roce —
  // el final de SCRUM-450. Se comprueba sobre las formas REALES que hay hoy en el árbol.
  const buenos = [
    "!ENABLED && 'sin QA_DB_TEST=1 · npm run test:staging:gated'",
    "!ENABLED && 'sin LIBRO_PG_URL (banco local)'",
    "!DB && 'sin QA_DB_TEST=1 · npm run test:staging:gated'",
    "'apagado a mano mientras se investiga SCRUM-999'",
    '!hayBanco && `sin ${VARIABLE}`',
  ];
  for (const bueno of buenos) {
    assert.equal(declaraMotivo(expresionDe(bueno)), true,
      `🔴 se acusaría de mudo a un salto que SÍ dice por qué: \`skip: ${bueno}\``);
  }

  // Y el otro lado, que es lo que lo convierte en un control y no en una repetición: las formas
  // MUDAS de verdad tienen que salir como mudas.
  for (const malo of ['true', '!ENABLED', '!DB', 'process.env.CI !== undefined', "!ENABLED && ''"]) {
    assert.equal(declaraMotivo(expresionDe(malo)), false,
      `🔴 se da por bueno un salto MUDO: \`skip: ${malo}\``);
  }
});

/** La expresión de un `skip:` suelto, para poder probar el criterio sin tocar el árbol. */
function expresionDe(texto) {
  const sf = ts.createSourceFile('x.mjs', `test('x', { skip: ${texto} }, () => {});`,
    ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let expr = null;
  const visitar = (n) => {
    if (!expr && ts.isPropertyAssignment(n) && n.name.getText(sf) === 'skip') expr = n.initializer;
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  assert.ok(expr, `🔴 no se ha podido leer la expresión de prueba: ${texto}`);
  return expr;
}

// ── LA DECLARACIÓN: LO QUE CI NO HA EJECUTADO, DICHO ────────────────────────────────────

test('SCRUM-419 · 🔴 CI DECLARA lo que no ha ejecutado, en vez de callarlo', (t) => {
  const hayBanco = !!process.env[VARIABLE];
  const { porFichero } = gateadosPorVariable();
  const total = [...porFichero.values()].reduce((a, v) => a + v.length, 0);

  if (hayBanco) {
    t.diagnostic(`✅ ${VARIABLE} presente: los ${total} tests de banco SÍ se han ejecutado.`);
  } else {
    // Esto es lo que hoy no existe: la línea que separa los dos ceros.
    t.diagnostic(`🔴 ESTA EJECUCIÓN **NO** HA CORRIDO ${total} TESTS (gateados por ${VARIABLE}):`);
    for (const [f, tests] of porFichero) {
      for (const x of tests) t.diagnostic(`     · ${f} → ${x.nombre}`);
    }
    t.diagnostic('   «0 fallos» de esta suite NO incluye esos. Necesitan un Postgres desechable:');
    t.diagnostic(`   ${VARIABLE}="postgresql://postgres@127.0.0.1:55432/yaqu_libro_test" npm test`);
  }

  // Y el suelo del propio aviso: el número declarado y el real no pueden divergir, o la
  // declaración diría una cifra que no es.
  assert.equal(
    total, TOTAL_DECLARADO,
    `🔴 se declaran ${TOTAL_DECLARADO} tests sin ejecutar y hay ${total}. Una declaración con la ` +
      'cifra equivocada es peor que no declararla: se lee como comprobada.',
  );
});

// ── Y LA REALIDAD DE CI, ATADA AL FICHERO, NO A UNA CREENCIA ────────────────────────────

test('SCRUM-419 · 🔴 CI SIGUE levantando el banco: si deja de hacerlo, se dice', () => {
  // ⚠️ ESTE TEST SE INVIRTIÓ el 10-ago-2026, y es el ejemplo de por qué el guard estaba bien
  // construido: pedía que la declaración correspondiera con lo que CI hace HOY. Cuando el fundador
  // dio GO al `services: postgres`, **se puso rojo** — y la respuesta correcta fue ACTUALIZAR LA
  // DECLARACIÓN, no aflojar el guard.
  //
  // Antes exigía que ningún workflow definiera la variable (CI no los corría, y había que decirlo).
  // Ahora exige lo contrario: que **SÍ** la defina. El motivo es el mismo de siempre — si alguien
  // quita el servicio de Postgres, los 7 vuelven a saltarse EN SILENCIO y la suite seguiría
  // diciendo «0 fallos». Un guard que solo mirase «hay declaración» no vería eso.
  const dir = path.join(RAIZ, '.github/workflows');
  assert.ok(fs.existsSync(dir), '🔴 ESCÁNER CIEGO: no encuentro .github/workflows');
  const flujos = fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f));
  assert.ok(flujos.length > 0, '🔴 ESCÁNER CIEGO: cero workflows que mirar');

  // 🔴 SE MIRA LA ASIGNACIÓN, NO LA MENCIÓN — y esto lo aprendí fallando aquí mismo.
  //
  // La primera versión hacía `contenido.includes('LIBRO_PG_URL')`, y al probar el rojo —quitar la
  // variable del workflow— **el guard siguió verde**: casaba con el COMENTARIO que yo mismo había
  // escrito explicando por qué la variable entra. Un guard de texto se caza a sí mismo en el
  // comentario que lo explica; es la quinta vez en esta sesión.
  //
  // Ahora se quitan los comentarios YAML y se exige la forma `LIBRO_PG_URL: <algo>`, que es una
  // asignación y no una frase sobre ella.
  const defineLaVariable = (contenido) => contenido
    .split(/\r?\n/)
    .filter((l) => !/^\s*#/.test(l))
    .some((l) => new RegExp(`^\\s*${VARIABLE}\\s*:\\s*\\S`).test(l));

  const losDefine = flujos.filter((f) => defineLaVariable(fs.readFileSync(path.join(dir, f), 'utf8')));

  // Hermano positivo (SCRUM-237): el detector reconoce la asignación, y NO confunde una mención.
  assert.ok(defineLaVariable(`      ${VARIABLE}: postgresql://x`), '🔴 ESCÁNER CIEGO: no ve la asignación');
  assert.ok(!defineLaVariable(`      # ${VARIABLE} es un banco desechable`), '🔴 el detector cuenta un COMENTARIO');

  assert.ok(
    losDefine.length > 0,
    `🔴 NINGÚN WORKFLOW DEFINE ${VARIABLE}.\n\n` +
      `  Entonces los ${TOTAL_DECLARADO} tests de banco han dejado de correr en CI — y la suite\n` +
      '  seguirá diciendo «0 fallos», porque saltarse y aprobar dan el mismo número. Son los que\n' +
      '  prueban tenencia contra el motor real y el cuadre de las tres pantallas: sin ellos, un PR\n' +
      '  que filtre datos entre merchants entra en verde.\n\n' +
      '  Si el servicio se quitó a propósito, este guard vuelve a su forma anterior (exigir que\n' +
      '  NADIE lo defina) y el aviso de arriba pasa a declararlos como no ejecutados. Lo que no\n' +
      '  vale es quedarse a medias: sin servicio y sin declaración.',
  );

  // Y el suelo del propio workflow: que además levante el SERVICIO. Definir la variable apuntando
  // a un Postgres que nadie arranca haría que los 7 fallaran por conexión — un rojo que se lee como
  // «los tests están rotos» cuando lo que falta es la base.
  const ci = fs.readFileSync(path.join(dir, 'ci.yml'), 'utf8');
  assert.match(
    ci, /services:[\s\S]{0,400}?postgres:/,
    '🔴 `ci.yml` define la variable pero no levanta ningún servicio de Postgres. Los 7 fallarían ' +
      'por conexión, y ese rojo se lee como «los tests están rotos» en vez de «falta la base».',
  );
});
