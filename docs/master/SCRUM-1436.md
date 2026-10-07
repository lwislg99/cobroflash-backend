# SCRUM-1436 · Dos de los cinco hallazgos: el aviso de disputa ya no afirma una firma que no ha mirado, y «ventana cerrada» ya no se dice de una ventana abierta

**Medido contra:** `origin/main` = `eda7ca55f9e2352b9da916c12f80d39aca5e1595` · 2026-10-07T16:01:39Z

7-oct-2026 · **J2** (puesto J2, equipo de Javier), por encargo del orquestador (`cobroflash-backend-90`).
[Escrito por una sesión; no por el fundador. SCRUM-1436 y SCRUM-1477, con sus comentarios, leídos en Jira.]

A9: comprobación → `tests/scrum1436-ventana-abierta-envio-fallido.test.mjs`

**Este tramo es el de los hallazgos 1 y 3.** El hallazgo 2 lo lleva J1 en su rama (`scrum-1436b-…`), con
su anexo propio en este mismo fichero.

**Este registro NO cierra el ticket.** SCRUM-1436 tiene cinco hallazgos y seis líneas de aceptación;
aquí van el hallazgo 3 entero y la mitad del 1. Qué falta, al final.

## Ⓐ Hallazgo 1 · «Tranquilo: tienes el presupuesto FIRMADO»

`src/modules/payments/disputes.service.ts`. Cuando un banco reclama un cobro, el profesional recibe un
WhatsApp. El texto afirmaba la firma SIEMPRE: el código sólo miraba si había factura, y eso para poner
su número.

**El dato existía.** `Invoice.quoteId` → `Quote.signatureUrl`. La casa ya define «firmado» así y no por
`acceptedAt` (`libroRegistro.repo.ts`: «aceptar y firmar no son lo mismo»). «Acepto sin firmar» deja la
firma a `null` (`quotes.routes.ts`).

**La condición** (`presupuestoFirmadoDe`): la frase sale sólo si la factura del cobro apunta a un
presupuesto **de ese negocio** cuya firma **tiene trazo** (`firmaTieneTrazo`, SCRUM-892: una firma
guardada puede ser un lienzo vacío). Es lo mismo que enseña el «Paquete de disputa» al que el aviso
manda: lee `invoice.quote` y pinta su `signatureUrl`. Si la consulta falla, es «no»: el aviso sale
igual, sin la afirmación.

**Divergencia declarada, sobre el mismo campo:** el Libro usa `signatureUrl` no nulo; aquí se pasa por
`firmaTieneTrazo` (SCRUM-892) a propósito, porque el aviso afirma que hay prueba. Confirmado por el
orquestador el 7-oct-2026.

**Sin firma, el aviso es el de siempre MENOS esa oración.** Ni una palabra nueva: qué decirle entonces
es texto que ve el usuario (regla 39). El test lo fija por igualdad de la cadena entera.

**Con firma, el aviso es byte a byte el de antes** (caso ① del test).

**La puerta del comentario 18287, leída:** la frase vive sólo en el `freeText` de `notifyMerchantAlert`
(texto libre). Si el aviso cae a la plantilla `merchant_alert_es` van «ha disputado un cobro» y el
importe con el número: ahí la frase no sale. No hay plantilla de Meta que cambiar.

Límite declarado: un cobro sin factura, o cuya factura no apunta a su presupuesto, sale como «no
firmado» aunque exista un presupuesto firmado por otro camino (`Quote.chargeId`). Ahí el paquete
tampoco lo enseñaría. Cuántos cobros reales están en ese caso: SIN MEDIR (no hay base autorizada).

## Ⓑ Hallazgo 3 · «Tu cliente no ha escrito en 24 h» cuando sí escribió

`src/integrations/whatsapp.ts`, `sendWhatsAppWindowFirst`. Con `sinPlantilla` se llegaba al mismo
`return { reason: 'ventana_cerrada' }` por dos caminos: ventana cerrada (cierto) y ventana ABIERTA con
el envío fallido. `sinPlantilla` es una opción del llamador, no el estado de la ventana.

Ahora la función recuerda si llegó a intentar el envío por ventana (`falloEnVentana`). Si lo intentó y
falló, devuelve el motivo que traiga ese envío (`demo_safe_numbers`, la baja, `not_configured`…) y, si
no trae ninguno, `whatsapp_send_failed`, que ya existía con su frase. Ningún texto nuevo.

**Lo que NO cambia, y está en el test:** con `sinPlantilla` no se manda plantilla en ningún caso
(decisión 3 del fundador, 28-jul-2026, SCRUM-195); con la ventana cerrada el motivo sigue siendo
`ventana_cerrada`; sin la opción se sigue cayendo a plantilla.

Único llamador con `sinPlantilla`: `sendQuote.service.ts`, que deja pasar los motivos con frase propia
y convierte el resto en `whatsapp_send_failed`. El segundo caso del bloque ② del test lo recorre entero.

## Ⓒ Lo corrido

Todo en local, contra `dist/` construido con `tsc --noCheck` después del último cambio y después de
mezclar `origin/main`. Las filas de abajo se midieron con `e883e586` mezclado; con `eda7ca55` mezclado
se repitieron los dos tests míos (18 casos, 0 caen), el banco de mutaciones (mismo resultado) y
`guards:entrada`. El build bueno es el del CI.

| Qué | Resultado |
|---|---|
| Rojo primero, disputa (contra `main` `12ecc7bb`, antes del arreglo) | 10 casos, 10 caen |
| Rojo primero, ventana (antes del arreglo) | 8 casos, 3 caen (los 3 del defecto); 2 suelos y 3 positivos pasan |
| Los dos tests, después | 18 casos, 0 caen, 0 saltos |
| Los dos míos, sus vecinos (scrum195-loop-adicional, scrum815-disputa, scrum62-albaran-ventana, scrum590-el-movil, scrum180, scrum227) y los guards de suite (scrum237, 976, 409, 419, 850, 850b, los cuatro scrum245, 864c, 267, 1294, 525d, 514), ya con main mezclado | 193 casos, 191 pasan, 2 caen, 0 saltos. Los 2 son de `scrum245-tipo-obliga-declarar` y caen por el árbol: `Cannot find module …\node_modules\typescript\bin\tsc` (este worktree no tiene `node_modules` propio). No los he visto pasar en ningún sitio: los dirá el CI |
| `npm run guards:entrada`, después del registro | 13 guards, 158 casos, 0 caen |
| Mutaciones (`tests/banco-scrum1436/mutar.mjs`, salida en `docs/evidencias/scrum1436/mutaciones.txt`) | 9 mutaciones: 8 caen, 1 viva y equivalente (M5); las 2 bases sin mutar, 0 caídas |
| `tsc --noEmit` completo | 6 errores, ninguno en mis dos ficheros (3 en `app.ts`, 2 en `invoiceNumber.service.ts`, 1 en `merchantAdmin.ts`); NO he mirado si son del árbol o del `node_modules` compartido |

M5 quita la guarda «sin factura o sin presupuesto». Sale viva porque sin ella `invoice.quoteId` sobre
`null` lanza dentro del `try` y el `catch` devuelve lo mismo. Son dos guardas redundantes, no un hueco.

**NO corrido:** la tanda completa (va en el CI). Nada visto en yaqu.app: los dos caminos necesitan una
disputa de Stripe y un fallo de Meta, que no se pueden provocar desde fuera.

## Ⓓ Dos tropiezos míos

1. El banco del test de ventana inyectaba la base en cada caso. `inyectarBase` sólo descarta el sender
   y el envío; el módulo de la ventana seguía contestando con la base del PRIMER caso, y el contador
   de consultas del segundo salía a 0. Lo cazó el suelo del propio test («no se ha consultado la
   ventana»), no yo. Ahora la base se inyecta una vez y lo que cambia es un estado.
2. Le pasé un guion a node por un heredoc de bash, el arnés lo rechazó, y volví a correr el test sin
   haber cambiado nada: salió idéntico. Una operación que no se ejecutó se lee igual que una que no
   arregló nada. Visto por el error del comando anterior.

## Ⓔ Lo que falta, y de quién es

- **Hallazgo 1, los dos textos nuevos** (aceptado sin firma · sin presupuesto), firmados en el
  comentario 18287 (cuenta de Luis) y válidos para este carril por la decisión del comentario 18734.
  Están construidos letra por letra y NO van en esta rama: esperan en `scrum-1436c` a que su ficha de
  `docs/microcopy/` pueda llevar una línea de firma cierta. `tests/scrum726-quien-firma-la-microcopy`
  sólo admite «Aprobado por el fundador» o «por el orquestador por delegación del fundador», y de ese
  comentario no se puede afirmar ninguna de las dos. Lo lleva el orquestador. El commit ⑥ de esta rama
  los traía y el siguiente lo revierte: no están en el árbol.
- **Hallazgo 1, el cobro SIN factura** sigue diciendo «Entra en la factura y pulsa…» sin factura a la
  que entrar. Los dos literales firmados llevan el número de la factura, así que tampoco sirven ahí:
  necesita un texto propio y hoy no hay ninguno firmado. Es lo que le falta a la línea 1 de la
  aceptación («no manda a una factura que no existe»). Lo sube el orquestador.
- **Hallazgos 2, 4 y 5:** no cogidos aquí.
- **SCRUM-1477** (los siete `catch` de `whatsapp.ts` no distinguen «Meta dijo que no» de «Meta no
  contestó») es OTRO trabajo y no se ha tocado. La ficha del encargo le puso ese número al hallazgo 3.

---

# SCRUM-1436c · Los dos literales del aviso de disputa sin firma

**Medido contra:** `origin/main` = `eda7ca55f9e2352b9da916c12f80d39aca5e1595` · 2026-10-07T16:03:30Z

7-oct-2026 · **J2**, rama `scrum-1436c-los-dos-literales-del-aviso-de-disputa`, montada encima de la del
tramo de arriba. [Escrito por una sesión; no por el fundador. Los comentarios 18287, 18734 y 18747 de
SCRUM-1436 los he leído en Jira.]

A9: sin fallo que generalice — el tropiezo de este tramo fue de orden de trabajo (comiteé los literales en la primera rama antes de saber si su ficha podía firmarse, y hubo que revertirlos allí); el guard que lo paró ya existe, `scrum726`, y paró a tiempo

**Sustituye** al primer punto de «Ⓔ Lo que falta» de arriba: los dos textos ya no esperan.

## La firma

- Los escribió S1 en el enunciado del ticket y los dio por firmados el comentario 18287 (6-oct-2026,
  publicado desde la cuenta de Luis; si lo escribió él o su orquestador por delegación, no se sabe).
- El comentario 18734 (7-oct-2026) recoge la decisión de Javier: esa firma vale para este carril.
- **El comentario 18747 (7-oct-2026) es la firma directa de Javier, fundador, sobre los dos textos
  completos: «Firmamos».** Es la que lleva la ficha, `docs/microcopy/2026-10-07-SCRUM-1436-aviso-de-disputa.md`.

Por qué hizo falta la tercera: `tests/scrum726-quien-firma-la-microcopy.test.mjs` sólo admite
«Aprobado por el fundador» o «por el orquestador por delegación del fundador», y del 18287 no se podía
afirmar ninguna de las dos. Con la ficha sin línea de firma el guard caía («firmante: null»). No se
tocó el guard.

## Lo construido

`avisoDeDisputa` en `src/modules/payments/disputes.service.ts`, cuatro formas:

| Caso | Qué sale |
|---|---|
| presupuesto firmado (con trazo) | el aviso de siempre, sin tocar una letra |
| con factura, presupuesto con `acceptedAt` y sin firma con trazo | el literal ① («Tienes el presupuesto aceptado, pero sin firma.») |
| con factura, cualquier otro caso sin firma (sin presupuesto, sin aceptar, de otro negocio, borrado, lectura fallida) | el literal ②, que no dice nada del presupuesto |
| SIN factura | el aviso de siempre menos la oración de la firma |

«Aceptado» se lee de `Quote.acceptedAt`; el rechazo lo pone a `null` (`quotes.routes.ts`,
`quoteAdmin.ts`).

## Los tres hallazgos del encaje

1. **El cobro SIN factura no tiene texto.** Los dos literales dicen «la factura {n}» y ahí no hay
   ninguna. No se han encajado: sería cambiarlos. Ese caso sigue mandando a «la factura» sin que exista.
   El comentario 18747 lo recoge como lo que la firma NO cubre; lo abre el orquestador.
2. **El separador.** El aviso de siempre lleva un salto de línea tras la primera frase; los firmados,
   un espacio. Copiados como están firmados.
3. **«Firmado» pasa por `firmaTieneTrazo`**, más estricto que el Libro sobre el mismo campo. Declarado
   arriba y en el código.

## Lo corrido

En local, con `dist/` de `tsc --noCheck` posterior al último cambio.

| Qué | Resultado |
|---|---|
| `tests/scrum1436-disputa-firmado-solo-con-firma.test.mjs` | 12 casos, 0 caen. Compara cada aviso por igualdad con el literal escrito a mano |
| Los dos tests de 1436 juntos | 20 casos, 0 caen, 0 saltos |
| Mutaciones (`docs/evidencias/scrum1436/mutaciones-con-los-literales.txt`) | 15: 14 caen y M5 es equivalente; entre ellas, quitar una coma (M14) y cambiar los dos puntos (M15) de un literal |
| Los dos de 1436, `scrum815-disputa`, `scrum726`, `scrum861`, `scrum709`, los dos `scrum514`, `scrum267`, `scrum1294`, `scrum525d` y `scrum237`, con la ficha firmada | 122 casos, 0 caen, 0 saltos. Sin la línea de firma, `scrum726` caía con 1 |

Nada visto en yaqu.app: hace falta una disputa real de Stripe.
# SCRUM-1436b · El recordatorio manual nombra el documento por su número

> Este tramo es **SCRUM-1436b**: sólo la parte de J1 del hallazgo 2 del ticket. Los hallazgos 1 y 3
> son de J2 y van en su propia rama, con su propio tramo en este fichero. Por eso hay dos tramos.

**Medido contra:** `origin/main` = `12ecc7bb3bad377e729a01b09fd755f978e125b9` · 2026-10-07T15:47:30Z

A9: comprobación → `tests/scrum1436b-el-recordatorio-nombra-por-el-numero.test.mjs`

Sesión J1 (`jv-j1`, 7-oct) · rama `scrum-1436b-el-recordatorio-nombra-por-el-numero`. Encargo del
orquestador de Javier, sobre lo que midió el equipo de Luis en SCRUM-1436.

## El defecto

`POST /admin/invoices/:id/send-reminder` manda al cliente, cuando el documento no tiene cobro, un
texto libre. Ese texto decía «el pago de la factura *N*» escrito a mano, también para un `J-…`, que
es un justificante y no una factura (reglas 24 y 26).

Visto ejecutando la ruta real de `dist/` (base doblada, WhatsApp en dry-run), antes de tocar nada:

    J-2026-0007 → «…tienes pendiente el pago de la factura *J-2026-0007* por *419,87 €*…»
    F260007     → «…tienes pendiente el pago de la factura *F260007* por *419,87 €*…»

## El arreglo

Una línea, en `src/modules/system/app/routes/invoicesAdmin.routes.ts`: la palabra la decide
`isReceiptNumber(invoice.number)`. Es el criterio que ya usan los otros dos emisores del mismo
documento (`invoiceWhatsApp.service.ts` y `invoiceReminder.service.ts`); el fichero ya lo importaba.
No hay criterio nuevo.

La forma es la acordada en el comentario 18287 del ticket: el artículo va dentro de la etiqueta,
«de la factura» / «del justificante». Ese comentario lo escribió la cuenta de Luis; aquí se cita
como la forma acordada, no como firma del fundador. Para una factura la frase no cambia ni una
letra, y el test lo comprueba entera.

No se ha tocado el camino de emisión: el cambio está dentro del handler del recordatorio y no
mueve ninguna línea del fichero (1 insertada, 1 borrada).

## El test

`tests/scrum1436b-el-recordatorio-nombra-por-el-numero.test.mjs`, 5 casos, por la ruta real:

| caso | antes del arreglo | después |
|---|---|---|
| SUELO: sin cobro sale un texto libre | pasa | pasa |
| 🔴 un `J-…` se llama «justificante» y no «factura» | **cae** | pasa |
| ✅ una factura dice «factura», con la frase entera de siempre | pasa | pasa |
| la palabra coincide con `isReceiptNumber` sobre 7 números (3 justificantes, 4 facturas) | **cae** | pasa |
| CONTROL: con cobro sigue yendo por la plantilla | pasa | pasa |

Antes: 5 casos, 3 pasan, 2 caen. Después: 5 casos, 5 pasan, 0 caen.

## Mi error

El positivo cayó la primera vez sobre el código SIN tocar. El importe lleva un espacio de no
separación (U+00A0) y yo lo había escrito en el test como un espacio normal: dos cadenas que en
pantalla son iguales. Lo delató que un caso que tenía que pasar cayera, no leerlo. Ahora el test
saca el importe del helper de la casa (`formatMoneyEs`) y comprueba su forma antes de usarlo.

## Lo que NO lleva

- **El camino con cobro.** Ahí el recordatorio va por la plantilla `payment_request_es`, cuyo texto
  es de Meta. No se ha mirado qué palabra lleva esa plantilla para un justificante.
- **El recordatorio automático** (`invoiceReminder.service.ts`, «el pago del factura»): es de J2.
- **La otra rama del hallazgo 2:** el recordatorio manual con cobro manda siempre la plantilla, sin
  probar antes la ventana abierta. No se ha tocado.
- **No se ha visto en yaqu.app.** Pide una sesión con un justificante sin cobro y un cliente con
  teléfono.
- **Tipos:** el build local es `--noCheck`. Los tipos los comprueba el CI.

## SCRUM-1436d · Los importes en crudo (hallazgo 4): los cuatro de J1, y los siete de J2 sin tocar

> Cruce de carril: **no lo hay**. El encargo permitía hacer también los de J2 declarándolo aquí, pero
> la cerradura de carril pide que el cruce esté en `docs/equipo/dos-equipos.md` §3.4, y ese fichero
> es de la S0. Los de J2 se quedan medidos, con su test en rojo y el cambio escrito abajo.

**Medido contra:** `origin/main` = `9acfbeba61c997aa838ad2460103a219141cd293` · 2026-10-07T16:40:12Z (hora de GitHub)

A9: comprobación → `tests/scrum1436d-los-importes-en-crudo.test.mjs`

Sesión J1 (`jv-j1`, 7-oct, relevo de la de SCRUM-1436b) · rama `scrum-1436d-los-importes-en-crudo`.

### Lo primero que se midió: ¿alguno es un log?

Ninguno. Son once sitios (los diez del ticket y el undécimo del comentario 18194), y a los once se
llegó EJECUTANDO la ruta o el servicio real de `dist/`, con la base doblada y el WhatsApp en dry-run.
Lo que salió, antes de tocar nada (12 casos, 3 pasan, 9 caen):

| sitio | dueño | dónde lo lee alguien | lo que salía |
|---|---|---|---|
| `invoiceWhatsApp.service.ts:137` | J1 | historial de la ficha del cliente | `1419.87 EUR` |
| `invoicesAdmin.routes.ts:323` | J1 | aviso de la factura y del trabajo, e historial | `Recibidos 300.00 de 1419.87 EUR (faltan 1119.87). …` |
| `invoicesAdmin.routes.ts:324` | J1 | los mismos | `Recibidos 1500.00 EUR (sobran 80.13). …` |
| `invoicesAdmin.routes.ts:378` | J1 | paquete de disputa, que se imprime y va al banco | `1419.87 EUR` |
| `psp.routes.ts:317` | J2 | historial de la ficha | `1419.87 EUR · Justificante J-2026-0007` |
| `psp.routes.ts:348` | J2 | WhatsApp al profesional (texto libre) | `💰 Pago recibido de Cliente de prueba: 1419.87 EUR` |
| `psp.routes.ts:349` | J2 | WhatsApp al profesional (variable de `merchant_alert_es`) | no visto (*) |
| `mpWebhook.routes.ts:214` | J2 | historial de la ficha | no visto (*) |
| `mpWebhook.routes.ts:243` | J2 | WhatsApp al profesional (texto libre) | `… de Cliente de prueba: 1419.8 EUR` |
| `mpWebhook.routes.ts:244` | J2 | WhatsApp al profesional (variable de plantilla) | no visto (*) |
| `payBizum.routes.ts:197` | J2 | WhatsApp al profesional, las dos vías | `… dice que te ha enviado 1419.87 EUR por Bizum. …` (el texto libre; la otra vía, no vista (*)) |

(*) La llamada se ejecutó y llegó a ese sitio, pero el caso cayó en la comprobación anterior y no
imprimió ese valor. Que lleva el mismo `toFixed(2)` más el código está leído, no visto salir.

Las líneas son las de `origin/main` del 7-oct; las del ticket iban una por debajo en
`invoicesAdmin.routes.ts`. Que el historial y el aviso se pintan tal cual está leído en
`customerDetailView.js:469`, `invoiceDetailView.js:475` y `jobDetailView.js:2186`, no ejecutado en
un navegador.

### El arreglo (sólo J1)

- **Historial de la factura enviada:** reusa el `importe` que la misma función ya calcula con
  `formatMoneyEs` para el mensaje del cliente.
- **Paquete de disputa:** su `money()` llama a `formatMoneyEs`.
- **Importe distinto:** la frase lleva tres cifras y una sola moneda. Para no añadirle dos símbolos
  que no tenía, la cifra que ya iba con la moneda pasa por `formatMoneyEs` y las otras dos por
  `formatImporteEs` (la misma forma, sin símbolo). Queda «Recibidos 300,00 de 1.419,87 € (faltan
  1.119,87). …». Ninguna palabra cambia: el test compara la frase entera y, aparte, su esqueleto sin
  cifras contra el de la frase vieja.

`formatMoneyEs` no se toca y no entra ningún formateador nuevo. No se toca el camino de emisión:
`invoicesAdmin.routes.ts` tiene la puerta de emisión, pero los cambios están en `payment-anomaly` y
`dispute-package`, que no emiten.

**Un test que ya existía fijaba el formato viejo:** `tests/scrum342-dispute-package-quote-nulo.test.mjs`
exigía `250.00 EUR` en el paquete. Cayó con el arreglo y se le cambió esa línea para que pida la
forma de la casa, sacada del helper. Es consecuencia del cambio, no un guard relajado: sigue
comprobando que el importe del presupuesto sale.

### El test

`tests/scrum1436d-los-importes-en-crudo.test.mjs`, 7 casos. Contra el código sin tocar caían 5 (los
cuatro sitios y el de moneda no euro) y pasaban 2 (el suelo y el positivo de la frase). Después, 7 de 7.
Los importes esperados salen del helper, nunca tecleados, por el espacio duro.

Corrido después del último cambio de código: los 51 ficheros de `tests/` que nombran los dos ficheros
tocados o sus rutas, 525 casos, 521 pasan, 0 caen, 4 saltan (dos piden `LIBRO_PG_URL` y dos
`QA_DB_TEST`). Y `scrum411`, `scrum262`, `scrum1415`, `scrum237`, `scrum708`, `scrum931`, `scrum636`.

### Mi error

El caso positivo («la frase no cambia») cayó la primera vez con el arreglo puesto, y el fallo era
mío: la expresión que quita las cifras pedía un límite de palabra detrás de «€», que nunca casa,
así que dejaba el símbolo suelto. Con el formato viejo («EUR») sí casaba, y por eso había pasado
antes. Lo delató el positivo, y el caso lleva ahora la comprobación contra la frase vieja.

### Lo que queda para J2 (medido, no hecho)

El banco completo está en
`docs/master/evidencias/SCRUM-1436/propuesto-j2-los-importes-de-los-avisos.test.mjs.txt`: sus cuatro
casos de J2 caen hoy. El cambio en cada sitio es el mismo: `formatMoneyEs(<importe>, <moneda>)` en
lugar de `toFixed(2)` más el código. Dos cosas a mirar al hacerlo:

- `psp.routes.ts` y `mpWebhook.routes.ts` no importan nada de `core/utils/utils`: hay que añadir el
  import. Sus comentarios de SCRUM-931 («`amt` sigue vivo debajo…») dejan de ser ciertos.
- `mpWebhook.routes.ts:243` pinta `payment.amount`, lo que dice el proveedor, y la línea de al lado
  pinta `updated.amount`, lo del cobro. Son dos fuentes para el mismo importe; el test propuesto
  conserva cada una.

La variable de `merchant_alert_es` con «1.419,87 € · F260007» pasa el validador de la casa
(`validateTemplateComponents`), y la muestra aprobada de esa plantilla ya lleva esa forma. No se ha
enviado nada a Meta.

### Lo que NO lleva

- Los siete sitios de J2.
- La tanda completa en local, y los tipos: el build local es `--noCheck`.
- Nada visto en yaqu.app.

## SCRUM-1436e · Los dos rojos del obligatorio de #2271: el trinquete pedía que se dijera, y mi test traía el `>` pegado

**Medido contra:** `origin/main` = `965e3d053f1f7d9ba24830f17abc7a54254c83f9` · 2026-10-07T17:01:01Z (hora de GitHub)

A9: comprobación → `tests/scrum553-etiquetas-pegadas.test.mjs`

Sesión J1 (`jv-j1`, 7-oct, relevo de la de SCRUM-1436d) · misma rama, con `origin/main` mezclado.

El obligatorio de la punta `5b1617d7` (job 112904794612, «Merge 5b1617d7… into 28166620…») salió
rojo: 10.940 casos, 10.845 pasan, 2 caen, 93 saltan. Los dos que caen:

| guard | qué decía | qué se ha hecho |
|---|---|---|
| `SCRUM-1452 · TRINQUETE: ninguna entrada declarada ha BAJADO sin declararlo` | tres identidades IMPORTE de J1 con «declarados 1, 5 y 1, hay 0» | las tres pasan de `DECLARADOS` a `RETIRADAS` con `SCRUM-1436`, en `scripts/_censo-gemelo-crudo.mjs`, que es lo que su mensaje pide |
| `SCRUM-553 · el número de etiquetas con el `>` pegado NO SUBE` | 27 con tope 20; siete eran de `tests/scrum1436d-…` (líneas 187 ×3, 189 y 196 ×3) | los tres extractores dejan hueco a los atributos (`<tr[^>]*>`, `<style[^>]*>`); el tope y el guard no se tocan |

**Que bajaron por el arreglo y no por ceguera del censo**, medido con `censarFuente` sobre los dos
ficheros en la base (`28166620`) y en la punta:

- `invoiceWhatsApp.service.ts`: 1 fila → 0; `toFixed(2)` contados por texto, 1 → 0.
- `invoicesAdmin.routes.ts`: `POST /:id/payment-anomaly` 5 → 0 y `money` 1 → 0; por texto, 8 → 2,
  y esos 2 que quedan el censo los sigue viendo (son sus «sueltos», 2 antes y 2 después), igual que
  la fila `NUMERO|…::GET /:id/dispute-package`, 1 antes y 1 después. El censo sigue leyendo el
  fichero; lo que falta es lo que se cambió.

Rojo primero, en local y con `origin/main` mezclado: los dos caían con el mismo mensaje que en el CI.
Después: 146 casos en 12 ficheros (los dos guards, `scrum1436d`, `scrum342`, `scrum267`, `scrum1294`,
`scrum525d`, `scrum237`, `scrum976`, los dos `scrum1436-` de J2, `scrum1478` y `scrum411`), 146 pasan,
0 caen, 0 saltan; control `SCRUM-1436z ·` = 0.

Mi fallo: el test se empujó sin correr los dos trinquetes que miran lo que el test y el arreglo
tocan. El de las etiquetas ya lo impide en el obligatorio; no hace falta otro mecanismo.

### Lo que NO lleva

- Una mutación del arreglo después de reescribir los extractores: no he visto caer el caso del
  paquete con la fila nueva. El caso sigue llevando su comprobación de «no queda ningún crudo».
- La tanda completa en local, y los tipos (build `--noCheck`).
- Los siete sitios de J2, que siguen en `DECLARADOS` con `retira: 'J2'`.
