# SCRUM-1288 · Dinero en formato es-ES en los avisos y el historial (los tres sitios de S1)

**Medido contra:** `origin/main` = `51d81311b01e19d592ad99a1f1f0817e4121cb55` · 2026-09-29T17:18:35Z

Ticket repartido entre carriles: aquí **solo los tres de S1**. Los de J1 (`invoiceWhatsApp.service.ts`,
`invoicesAdmin.routes.ts`) y J2 (`payBizum.routes.ts`, `mpWebhook.routes.ts`) no se tocan; si otro equipo
escribe su parte, que AÑADA una sección a este fichero, no lo reescriba.

## Rama `scrum-1288-dinero-es-avisos-s1` (S1)

`toFixed(2)` + código de moneda a mano → `formatMoneyEs` (el formateador único, A6.6):

| Sitio | Qué es de verdad |
|---|---|
| `quotes.routes.ts` (`POST /quote/create`) | WhatsApp de texto libre al propietario «Nuevo presupuesto … pendiente de tu aprobación» |
| `sendQuote.service.ts` (`recordCustomerEvent`) | línea del **historial** del cliente al enviar por WhatsApp |
| `quotesAdmin.routes.ts` (`POST /:id/send-email`) | línea del **historial** del cliente al enviar por email |

**Corrección al inventario del ticket (lo escribí yo en SCRUM-1277):** los dos del historial no son avisos
por WhatsApp: son el `detail` de `recordCustomerEvent`, que la ficha del cliente pinta tal cual
(`customerDetailView.js`). Nadie parsea ese texto (medido: `quote_sent` solo se usa para el icono). Las
filas ya guardadas conservan «1234.50 EUR»: no se reescribe historia.

**No es STOP de plantilla:** el primero es `sendWhatsAppText` (texto libre, no plantilla de Meta); los otros
dos no salen por WhatsApp.

## Test — `tests/scrum1288-dinero-es-en-avisos-s1.test.mjs`

Lee lo que sale de verdad, con importe de MILES (1.234,50 €): el WhatsApp del `__waDryRunOutbox` tras
`POST /quote/create` por su manejador (técnico con umbral de aprobación), y la fila que se escribe en
`customerEvent` por `sendQuoteWhatsAppToCustomer` y por `POST /:id/send-email`. Control: dos importes
distintos salen distintos y el de 1277 sigue diciendo 363,00 € (el mensaje real de 1277 lo sigue
vigilando `scrum1277-aviso-importe-aceptado`).

**Rojo contra `51d81311`: 3/3** — «por 1234.50 EUR pendiente de tu aprobación», «el historial dice
1234.50 EUR».

## Pendiente de otros carriles

- J1: `invoiceWhatsApp.service.ts:137`, `invoicesAdmin.routes.ts:306-361` (regla 40: se lee el camino de emisión).
- J2: `payBizum.routes.ts:197`, `mpWebhook.routes.ts:200`.
- S3: el guard que cace `toFixed` junto a un literal de moneda (aceptación 4).

---

# APÉNDICE · SCRUM-1288b (S3) · La aceptación 4: el guard ya existía, y lo que no veía

**Medido contra:** `origin/main` = `85d8d01e64196569928b523c9074542d6ffbbd0a` · 2026-10-09T10:20:20Z

A9: sin fallo que generalice — la primera versión de la forma miraba también la moneda DELANTE del valor y acusó `unidad` en «… €${unidad}»; lo cazó correrla sobre el árbol antes de declarar nada, y se quitó. Y las salidas de evidencias que escribió el `>` de PowerShell salieron mal tres veces: dos en UTF-16 y tres con BOM (A22.1), cazadas por el recuento de bytes antes del commit, y tres con CR, que el recuento no miraba y cazó `scrum533` en la tanda dirigida. Se regeneraron o se limpiaron byte a byte; ninguna llega al PR.

Rama `scrum-1288b-censo-dinero-avisos-src`. Sólo `scripts/_censo-gemelo-crudo.mjs`, dos ficheros de
`tests/` y este registro. No toca `src/`.

## 1 · PASO 0: el guard que pedía la aceptación 4 YA estaba en `main`

El ticket se reabrió el 9-oct (comentario 19070) porque «hoy un aviso nuevo del servidor con
`importe.toFixed(2) + ' EUR'` entra en verde». **Corrido, no es así:** ese cebo sale en ROJO desde el
6-oct. Lo caza el trinquete de SCRUM-1452 (`scripts/_censo-gemelo-crudo.mjs`, forma `IMPORTE`), que
recorre `src/**/*.ts` por AST y corre en el check obligatorio. La tabla de aquel comentario miraba tres
instrumentos y no éste, que es el que nombraban los comentarios 18599, 18638 y 19045 del propio ticket.

| qué se hizo | resultado | dónde |
|---|---|---|
| el cebo literal, en memoria, contra el censo de `origin/main` | CAZA · `FUERA (prop text)` | `evidencias/SCRUM-1288b/cebos-1288-antes.txt`, cebo 1 |
| el mismo cebo EN DISCO (`src/modules/messaging/zz-cebo-1288.ts`) y el test real | base 20 de 20 · con cebo 19 de 20, cae «TRINQUETE: ningún sitio NUEVO» nombrando fichero y línea · sin cebo 20 de 20 · árbol limpio | `evidencias/SCRUM-1288b/cebo-en-disco-1288.txt` |
| ¿corre en CI? | sí: sus casos salen con ✔ en el log del obligatorio de `85d8d01e` (run 37907003344) | — |

## 2 · Lo que ese guard NO veía, y había víctimas

Quince cebos de «dinero mal escrito en un aviso»: el censo de `main` cazaba **6 de 15** (los seis con
`toFixed(2)` y la moneda en el mismo texto, que es la aceptación literal). No veía el importe que llega
**ya hecho texto por un parámetro**: el `toFixed(2)` está en quien llama, en otro fichero, y el aviso
sólo escribe `${total} ${currency}`. Barrido el árbol con esa forma (22 valores pegados a una moneda en
321 ficheros; `evidencias/SCRUM-1288b/barrido-antes.txt`), salieron **tres correos vivos**:

| correo | dónde se escribe | qué le pasa quien llama | carril |
|---|---|---|---|
| «Pago recibido», asunto y cuerpo, al profesional | `merchantNotifications.ts::sendMerchantPaymentEmail` | `psp.routes.ts:367` · `(body.amount ?? updated.amount).toString()` | S1 escribe · J2 llama |
| «presupuesto aceptado», al profesional | `…::sendMerchantQuoteAcceptedEmail` | `whatsappIncoming.routes.ts:525` · `Number(quote.total).toFixed(2)` | S1 escribe · J2 llama |
| «presupuesto aprobado», al técnico | `…::sendTechQuoteApprovedEmail` | `quotesAdmin.routes.ts:871` · `Number(quote.total).toFixed(2)` | S1 las dos |

Son el octavo, el noveno y el décimo de la familia de este ticket. **Leído en el código, no en el correo
que sale:** no se ha enviado ninguno para verlo. **No se arreglan aquí:** son `src/` de S1 y J2, y
cambiar lo que se lee es texto con firma (regla 39).

## 3 · Lo construido: la forma `SIN_FORMATEAR`, dentro del mismo trinquete

`IMPORTE` busca el `toFixed(2)` y mira si hay moneda. `SIN_FORMATEAR` mira desde el otro lado: busca la
**moneda** y exige que el valor que lleva pegado (un espacio en medio como mucho) salga de un
formateador de importes de la casa. Libran cuatro caminos, y sólo ésos: la llamada directa a un nombre
de `HELPERS_IMPORTE` (los cuatro exportados), un `const` de su ámbito que la guarda, una función LOCAL
cuyo cuerpo es sólo devolverla (a `fmt` y `money` no se les cree por el nombre: se mira su cuerpo) y las
dos ramas de un ternario. Un parámetro, un `let` o un nombre importado no libran.

Con la forma nueva el censo caza **11 de 15** cebos (`cebos-1288-despues.txt`). Sobre el árbol da 6
sitios, todos declarados en `DECLARADOS`:

| identidad | n | clase | por qué |
|---|---|---|---|
| `merchantNotifications.ts::sendMerchantPaymentEmail` | 2 | DEUDA · S1 | tabla de arriba |
| `merchantNotifications.ts::sendMerchantQuoteAcceptedEmail` | 1 | DEUDA · S1 | tabla de arriba |
| `merchantNotifications.ts::sendTechQuoteApprovedEmail` | 1 | DEUDA · S1 | tabla de arriba |
| `catalogLoader.ts::orientativoLabel` | 1 | DEUDA · S1 | «6000–11000 €»: enteros sin separador de miles (20 de los 310 precios de `data/catalogs` pasan de 1.000) |
| `ai.service.ts::generateQuoteMessage` | 1 | LEGITIMO | instrucciones para el modelo de IA: no lo lee una persona |

Los seis `fmt(…)` del PDF de factura y el `lineTotal` de `pdf.service.ts` NO salen: el censo sigue su
`const` y su función local hasta `fmtImporte`.

**Rojo sobre el defecto real:** con la forma puesta y antes de declarar nada, `scrum1452` cayó en
«ningún sitio NUEVO» nombrando `merchantNotifications.ts:50`, `:64`, `:131` y `:184`.

**Por mutación** (`evidencias/SCRUM-1288b/mutar-1288b.mjs` y `.txt`): base 31 de 31; **11 de 11**
mutantes del censo mueren en el caso que dice guardarlos, con el `numstat` de cada mutación al lado y el
árbol limpio después de cada una. Base al acabar, 31 de 31.

## 4 · Lo que sigue sin ver, declarado (cabecera del censo)

- La moneda que NO toca al valor: `['Cobrado', x.toFixed(2), 'EUR'].join(' ')` (cebo 8).
- `Intl.NumberFormat` a mano con `style: 'currency'` (cebo 12): la moneda la pone él.
- La moneda escrita DELANTE del valor (`€${x}`). Se probó y se quitó: en el árbol sólo casaba con lo que
  va detrás de «€» en una frase («… €${unidad}»).
- Lo que hace por dentro un formateador de `HELPERS_IMPORTE`: se le cree por su nombre.

## 5 · Desviación declarada

`tests/scrum1452-gemelo-crudo.test.mjs` fijaba que `${t.toFixed(1)} €` NO se acusaba: era un límite
declarado del censo. Esa aserción ha cambiado de signo (ahora exige `SIN_FORMATEAR:FUERA`). Es el guard
exigiendo MÁS, no menos; se dice porque es una aserción de un test que ya estaba en `main`.

## 6 · Lo que no se ha hecho

- No se ha corrido la suite completa (memoria de la máquina y turno); sí los dos ficheros, la tanda
  dirigida y `guards:entrada`. Ningún fichero de `src/` cambia, así que `dist/` no interviene.
- No se ha visto ninguno de los tres correos saliendo.

# APÉNDICE · SCRUM-1288c (S3) · El correo «presupuesto aprobado» al técnico, en es-ES

**Medido contra:** `origin/main` = `44cbb050536158705c423950a76254ad8f1848b4` · 2026-10-09T11:46:09Z
**Rama:** `scrum-1288c-el-correo-al-tecnico-en-euros` · **Carril:** `src/` de S1, por encargo del orquestador (punto 3 del lote de la cuarta tanda del 9-oct) · **Resultado:** uno de los tres correos que el apéndice 1288b dejó como DEUDA, arreglado; los otros dos no se tocan

A9: sin fallo que generalice — el arreglo son dos líneas de `src/` y su rojo salió a la primera, corriendo el test nuevo contra el `dist/` de antes de recompilar

## Qué cambia

| fichero | antes | ahora |
|---|---|---|
| `src/modules/system/app/routes/quotesAdmin.routes.ts` (quien llama, S1) | `total: Number(quote.total).toFixed(2)` | `total: Number(quote.total)` |
| `src/modules/messaging/domain/merchantNotifications.ts::sendTechQuoteApprovedEmail` (S1) | `total: string`, y la plantilla escribía `${total} ${currency}` | `total: number`, y la plantilla escribe `formatMoneyEs(total, currency)` |
| `scripts/_censo-gemelo-crudo.mjs` | la entrada `SIN_FORMATEAR` de esa función, DEUDA | pasa a `RETIRADAS` |

Lo que lee el técnico en la fila «Total»: «1234.50 EUR» → «1.234,50 €». Ninguna otra palabra del correo cambia.

## Por qué sólo uno de los tres

Los tres se escriben en el mismo fichero de S1. Lo que los separa es quién les pasa el importe:

| correo | quien llama | qué pasa hoy |
|---|---|---|
| «presupuesto aprobado», al técnico | `quotesAdmin.routes.ts` (S1) | **arreglado aquí** |
| «💰 Pago recibido», al profesional (asunto y cuerpo) | `src/modules/billing/app/routes/psp.routes.ts` (**J2**) | SIGUE: «1234.5 EUR». Es el aviso de un cobro |
| «presupuesto aceptado», al profesional | `src/modules/whatsappBot/app/routes/whatsappIncoming.routes.ts` (**J2**) | SIGUE: «1234.50 EUR» |

El encargo: «si el arreglo es el mismo formateador, hazlo; si cruzan a Javier, nómbralos y paras». Los dos de abajo cruzan: el arreglo limpio (que llegue el número) cambia la llamada en dos ficheros de J2. Siguen en el censo como DEUDA, con su motivo.

## La firma, dicha como está

El cambio lo ve un usuario (regla 39). Lo pedí en Jira (SCRUM-1288, c.19094, punto 2: «no estiro esa firma: te la pido»). La respuesta del orquestador está en el encargo de la cuarta tanda, punto 3, que es un mensaje a esta sesión y **no un comentario de Jira**. No se ha escrito ningún literal nuevo: es el formateador que ya usan los siete avisos de este ticket.

## Los rojos

`evidencias/SCRUM-1288c/mutar-1288c.txt` (guion al lado).

| qué se rompe | resultado |
|---|---|
| El test nuevo contra el `dist/` de antes (sin recompilar) | ROJO en 3 de 4: «1234.5 EUR», «99 EUR», «1500 MXN». El cuarto (asunto, saludo y cliente) pasa: no ha cambiado |
| M1 · la plantilla vuelve a pegar el total a la moneda (`src/`, `numstat` 1 1) | ROJO en 2 de 31: `scrum1288b` («los tres correos… VISTOS») y `scrum1452` («ninguna identidad RETIRADA ha vuelto a aparecer») |
| M2 · quien llama vuelve a pasar `toFixed(2)` (`src/`, `numstat` 1 1) | ROJO: `tsc --noEmit` sale 2, `TS2322: Type 'string' is not assignable to type 'number'` |

Base del trinquete 31 de 31 antes y después; `git status` vacío tras cada restauración.

## Lo que NO mide

- El camino entero por la ruta (aprobar el presupuesto → correo): pide base y ningún test lo corre. El lado de quien llama lo ata el tipo (M2).
- El correo recibido en un buzón: no se ha enviado ninguno. Lo que se lee es el HTML que la función real entrega al emisor, doblado.

## Reproducir

    node --test tests/scrum1288c-el-correo-al-tecnico-en-euros.test.mjs
    node docs/master/evidencias/SCRUM-1288c/mutar-1288c.mjs

## 13-oct · El obligatorio de #2340 estuvo cuatro días en rojo, y el rojo era mío

**Medido contra:** `origin/main` = `6f35b50901fac64347d862255ec755a036ca1f0d` · 2026-10-13T11:02:11Z

A9: comprobación → `tests/scrum622-desconocido-no-es-verde.test.mjs`

No cayó por el arreglo ni por su test. Run 37926919510, un caído de 7.618: `SCRUM-622 · EL CENSO`, que barre el árbol entero buscando expresiones cuyo lado por defecto es el estado bueno. Encontró dos, las dos en el guion de los rojos de este PR:

    docs/master/evidencias/SCRUM-1288c/mutar-1288c.mjs:50   r.fail > 0 ? 'ROJO' : 'VERDE'
    docs/master/evidencias/SCRUM-1288c/mutar-1288c.mjs:59   r.status !== 0 && errores.length ? 'ROJO' : 'VERDE'

Y tenía razón en las dos. Una pasada sin recuento (`fail` no numérico) salía `VERDE`; un `tsc` que no llegó a correr, también. Y el guion acababa en `EXIT=0` pasara lo que pasara. El guard no se ha tocado; cambia el guion:

| qué | antes | ahora |
|---|---|---|
| M1 sin recuento de tests | `VERDE` | `CIEGO` |
| M2 con `tsc` caído sin ningún error que nombre el fichero mutado | `VERDE`, o `ROJO` por un error de otro sitio | `CIEGO` |
| Una mutación que no casa | se saltaba, y `EXIT=0` | cuenta como `CIEGO` |
| Código de salida | siempre 0 | 1 si algo no es `ROJO`, o si la base de después no queda verde |

Corrido otra vez sobre el árbol ya fusionado con `main` (`77c630f9`, build exit 0): 2 de 2 `ROJO`, los mismos casos del 9-oct, base 31 de 31 antes y después; `mutar-1288c.txt` es esa salida. Control del camino nuevo: una copia del guion cuya M2 busca un texto que no existe dice `CIEGO`, `RECUENTO · 1 ROJO · 0 VERDE · 1 CIEGO`, y sale 1.

El fallo mío: escribí el guion DESPUÉS de la última pasada de los guards de árbol entero, y empujé. Un guion de `docs/master/evidencias/` es código para esos censos. La sesión se cortó por límite de uso antes de leer el veredicto, y el PR se quedó en rojo cuatro días. La cicatriz del puesto va en el PR #2337, que cayó por lo mismo.

# APÉNDICE · SCRUM-1288d (S3) · Los dos correos al profesional que quedaban, en es-ES

**Medido contra:** `origin/main` = `0279db997e577473c03f088916abd3d448a061c5` · 2026-10-13T14:34:06Z
**Rama:** `scrum-1288d-los-dos-correos-al-profesional-en-euros` · **Carril:** un fichero de `src/` de S1, por encargo del orquestador (punto 1 del lote de las 13:35Z del 13-oct) · **Resultado:** «Pago recibido» y «presupuesto aceptado» dicen el dinero como el resto de la casa. Con el del técnico (1288c), los tres correos que 1288b dejó como DEUDA están arreglados.

A9: sin fallo que generalice — lo que cambia respecto a 1288c es una lectura que faltaba, no un error de esta tanda: dos veces (c.19112 y c.19321) se dio por hecho que estos dos «cruzaban a Javier» sin abrir la firma de `formatMoneyEs`, que acepta texto

## Por qué ahora sí, sin tocar a Javier

El apéndice 1288c dejó estos dos fuera porque «el arreglo limpio (que llegue el número) cambia la llamada en dos ficheros de J2». Eso es cierto del arreglo que se eligió allí, no del defecto. Leída hoy la firma del formateador:

    export function formatMoneyEs(n: number | string | { toString(): string }, currency = 'EUR')

Acepta texto y el `Decimal` de Prisma. Y la propia ruta de J2 ya lo usa así, 79 líneas antes de llamar al correo: `psp.routes.ts:288`, `formatMoneyEs(body.amount ?? updated.amount, cur)`, para el WhatsApp del mismo cobro. Leído en el código: el WhatsApp escribe «1.234,50 €» y el correo del mismo pago «1234.5 EUR».

Así que el formato se pone donde se escribe la moneda, y **quien llama no cambia**:

| fichero | antes | ahora |
|---|---|---|
| `src/modules/messaging/domain/merchantNotifications.ts::sendMerchantPaymentEmail` (S1) | asunto y cuerpo escribían `${amount} ${currency}` | `const importe = formatMoneyEs(amount, currency)`, y los dos escriben `${importe}` |
| `…::sendMerchantQuoteAcceptedEmail` (S1) | la fila «Total» escribía `${total} ${currency}` | `${formatMoneyEs(total, currency)}` |
| `scripts/_censo-gemelo-crudo.mjs` | dos entradas `SIN_FORMATEAR`, DEUDA | pasan a `RETIRADAS` |
| `src/modules/billing/app/routes/psp.routes.ts`, `src/modules/whatsappBot/app/routes/whatsappIncoming.routes.ts` (J2) | — | **sin tocar**: el `git diff --numstat` de la rama no los nombra |

Lo que lee el profesional: «💰 Pago recibido: 1234.5 EUR de …» → «💰 Pago recibido: 1.234,50 € de …» (asunto), «1234.5 EUR» → «1.234,50 €» (fila «Importe») y «1234.50 EUR» → «1.234,50 €» (fila «Total»). Ninguna otra palabra de los dos correos cambia.

**Queda dicho para J2, sin ticket:** sus dos llamadas siguen pasando un texto (`.toString()` y `toFixed(2)`). Ya no hace daño; si algún día tocan esas líneas, pueden pasar el número y cambiar el tipo, como en 1288c.

## La firma, dicha como está

El cambio lo ve un usuario (regla 39). La orden es del orquestador, en el encargo de las 13:35Z a esta sesión («si el arreglo es el mismo formateador, hazlo y ciérralo en el momento»): **un mensaje, no un comentario de Jira**, igual que en 1288c. No se escribe ningún literal nuevo: es el formateador de los ocho avisos anteriores de este ticket.

## Los rojos

| qué se rompe | resultado | dónde |
|---|---|---|
| El test nuevo contra el `dist/` de antes (sin recompilar) | ROJO en 5 de 6: «1234.5 EUR» en el cuerpo y en el asunto, «1234.50 EUR», «1500 MXN». El sexto (las frases que no cambian) pasa | `evidencias/SCRUM-1288d/rojo-antes.txt` |
| M1 · el asunto de «Pago recibido» vuelve a pegar importe y moneda (`numstat` 1 1) | ROJO en 2 de 31: `scrum1288b` («los tres correos… VISTOS») y `scrum1452` («ninguna identidad RETIRADA ha vuelto a aparecer») | `evidencias/SCRUM-1288d/mutar-1288d.txt` |
| M2 · lo mismo en el cuerpo (`numstat` 1 1) | ROJO en 2 de 31, los mismos dos | ídem |
| M3 · la fila «Total» de «presupuesto aceptado» (`numstat` 1 1) | ROJO en 2 de 31, los mismos dos | ídem |

Base del trinquete 31 de 31 antes y después; `git status` vacío tras cada restauración. El guion acota cada mutación a SU función: la fila «Total» del aceptado y la del técnico son idénticas letra por letra.

## Lo que cazó la dirigida antes de empujar

El tramo 3 de 4 salió en ROJO por el test nuevo: su sexto caso buscaba las frases con `<strong>` pegado, y el trinquete de `tests/scrum553-etiquetas-pegadas.test.mjs` cuenta eso como un extractor que se rompe en cuanto la etiqueta gane un atributo (23 contra un tope de 20; nombraba las líneas 113 y 117). El guard no se ha tocado: el caso lee ahora el texto sin etiquetas. `scrum553` y el test nuevo, 22 de 22 después. `rojo-antes.txt` es la salida del test ANTES de ese cambio: sus cinco rojos son de los casos que no han cambiado, y el sexto, el que pasaba, es el reescrito.

## Lo que NO mide

- El camino entero por las dos rutas (cobro confirmado → correo; aceptar por WhatsApp → correo): pide base y ningún test lo corre. El test les pasa a las dos funciones lo que hoy les pasan sus llamadores, **leído en el código**: un texto.
- Un importe que no sea un número. `formatMoneyEs('abc')` escribe «NaN €», donde antes salía «abc EUR». No se ha buscado si puede llegar; el WhatsApp del mismo cobro ya se formatea igual desde SCRUM-1436.
- El correo recibido en un buzón: no se ha enviado ninguno. Lo que se lee es el asunto y el HTML que la función real entrega al emisor, doblado.

## Reproducir

    node --test tests/scrum1288d-los-dos-correos-al-profesional-en-euros.test.mjs
    node docs/master/evidencias/SCRUM-1288d/mutar-1288d.mjs
