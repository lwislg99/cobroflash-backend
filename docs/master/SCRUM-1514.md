# SCRUM-1514 · La frontera entre comercios: el censo de SCRUM-1390 no la medía, y ahora tiene ese eje

**Medido contra:** `origin/main` = `16e80dea496dad3819bf444983f9974d3c13ebb9` · 2026-10-08T07:38:34Z

A9: comprobación → `docs/evidencias/scrum1390/censo-que-ve-el-tecnico.mjs.txt`

8-oct-2026 · **J1** (sesión `jv-j1`, equipo de Javier), por encargo del orquestador (`cobroflash-backend-90`).
[Escrito por J1. El encargo es la descripción de SCRUM-1514 MÁS su comentario c.18961, leídos en Jira.]

**Carril J1 a mano. Es MEDICIÓN: no se toca `src/`, ni `prisma/`, ni `tests/`, ni ningún filtro.** Tres
cosas en el árbol: este registro, `docs/master/evidencias/SCRUM-1514/` y el instrumento de SCRUM-1390
(`docs/evidencias/scrum1390/censo-que-ve-el-tecnico.mjs.txt`), al que se le AÑADE un eje. Ese fichero lo
escribió J4 y no tiene fila de carril: lo extiendo porque el encargo lo pide y lo digo aquí.

El hook de arranque dijo «SIN IDENTIDAD… no construyas» (SCRUM-1498, carril de S5). Se siguió, como manda
la ficha del día, y queda escrito.

## ① Qué es el censo de SCRUM-1390, leído y vuelto a correr

| pregunta | respuesta, con su cita |
|---|---|
| ¿Cuántas filas? | **78**: «POBLACION: 78 rutas en TECNICO_ALLOWED» (línea 1 de `censo-que-ve-el-tecnico.salida.txt`). Las «filas 5, 6, 7 y 9» que citan SCRUM-1397 y SCRUM-1489 son otra numeración: la tabla a mano de **10** rutas de lectura del registro, sección Ⓓ |
| ¿Qué columnas? | por ruta: el veredicto (NO-DISTINGUE, RECORTA, SIN-DOCUMENTO, NO-LLEGO, CIEGO), los cuatro estados (`A adm · A tec · B adm · B tec`) y la consulta que arma el técnico y, si difiere, la del admin |
| ¿Alguna mide la frontera entre comercios? | **Ninguna.** Las cuatro corridas llevan `merchantId: 1` y el documento «ajeno» que devuelve el doble también es del comercio 1 (`AJENO = { id: 102, merchantId: 1, teamMemberId: 12 …`): ajeno de COMPAÑERO, no de comercio. El doble «NO aplica el `where`: lo APUNTA» |
| ¿Figura `resend-whatsapp`? | **No, y `send-reminder` tampoco.** 0 y 0 apariciones en la salida (positivo del recuento: `send-whatsapp` aparece 2 veces). Las dos son rutas sólo de administrador y la población es lo que alcanza un Técnico |

**Así que no es «un instrumento que no midió»: es un instrumento con otra pregunta y otra población.** Ni
el eje ni las dos rutas del par estaban dentro. Caso ③ del comentario.

Un dato que el censo SÍ tenía impreso y ninguna columna juzgaba: `POST /admin/quotes/:id/send-whatsapp`
sale con `quote.findUnique {"id":102}`, sin comercio. Es la única fila de las 78 en que la consulta del
documento no lleva `merchantId`. Está abajo, en ③.

## ② Lo que se le ha añadido: `--eje=comercio`

Sin la bandera el fichero hace lo que hacía. Con ella:

| | eje del rol (1390) | eje del comercio (1514) |
|---|---|---|
| población | 78 rutas de `TECNICO_ALLOWED` | **191** rutas montadas bajo `/admin` (las 78 dentro: 78 de 78) |
| quién pide | admin y técnico del MISMO comercio | un administrador del comercio 21 |
| qué pide | el documento 102, de un compañero | el recurso 102, que es del comercio **22** |
| el doble de Prisma | apunta el `where`, no lo aplica | aplica UNA cosa: el comercio. Si la consulta fija `merchantId` al de la sesión y pide el 102, devuelve nada; si no lo fija, devuelve la fila del 22 |
| de dónde sale el veredicto | de comparar dos consultas | del **estado que contesta la ruta** y de los envíos que salen |

Comparte el motor (`manosDe`, `peticion`, `pedir`, los manejadores reales de `dist/`). Los modelos «con
comercio» salen del modelo de datos del cliente: 25 de 33 tienen columna `merchantId`.

Como este eje ejecuta también las rutas que cobran y envían, antes de cargar la app corta la resolución de
nombres, `https` y `fetch`, y dobla a Meta en el transporte de `axios`. **Envíos reales: 0. Intentos de
salir de la máquina cortados: 0.** Ninguna base: ni producción, ni staging, ni desechable.

### Los controles, y el rojo visto

| control | esperado (medido por HTTP en SCRUM-1512, caso X1) | sale |
|---|---|---|
| POSITIVO `POST …/resend-whatsapp` | 200 y 1 plantilla | **CRUZA · 200 · 1 envío doblado** |
| NEGATIVO `POST …/send-reminder` | 404 | **FILTRA · 404 · 0 envíos** |
| CERO, una ruta que no está montada | no figura | no figura |
| POBLACIÓN contiene las 78 del rol | sí | 78 de 78 |

Rojo: con `--doble-sordo` (apaga lo único que el doble aplica) las dos rutas del par contestan 404, el
censo dice «¿distingue las dos rutas del par? false» y sale 1 (`salida-rojo-doble-sordo.txt`). Un censo
de este eje que no separe esas dos no mide, y éste lo dice.

Que el eje del rol no ha cambiado: el fichero de `HEAD` y el nuevo, sin bandera, sobre el mismo `dist/`,
dan la misma salida byte a byte quitando las fechas (280 líneas). Con un matiz que es un hallazgo: ver ⑤.

## ③ El número

`salida-eje-comercio.txt`. **191 rutas, 90 con `:parámetro`.**

| veredicto | rutas | con `:parámetro` |
|---|---|---|
| **CRUZA** (consulta sin comercio y contesta 2xx) | **3** | 1 |
| LEE-Y-NIEGA (lee sin comercio y después contesta 404) | 1 | 1 |
| LEE-Y-NO-ACABA | 0 | 0 |
| FILTRA (todas sus consultas van atadas al comercio de la sesión) | 158 | 82 |
| SIN-CONSULTA | 4 | 0 |
| NO-LLEGO (**no medida**) | 25 | 6 |
| suma | 191 | 90 |

**Las 3 que cruzan, miradas una a una. Hallazgo de frontera: UNA.**

| ruta | qué hace | ¿es un cruce? |
|---|---|---|
| `POST /admin/invoices/:id/resend-whatsapp` | `invoice.findUnique {"id":102}`, después lee y ESCRIBE el cobro 900 de esa factura, y sale 1 envío | **SÍ. Es el del ticket, y es el único de las 191** |
| `GET /admin/referral` | `merchant.findUnique {"referralCode": …}` al generar el código propio | no: pregunta si un código ya existe en toda la casa (`referral.service.ts:21`). LEÍDO, no ejecutado contra base |
| `GET /admin/billing/plans` | `merchant.count {"plan":"founding","subscriptionStatus":"active"}` | no: es el contador de plazas vendidas, de toda la casa a propósito (`founding.ts`). LEÍDO |

**La que lee y niega:** `POST /admin/quotes/:id/send-whatsapp` busca el presupuesto sólo por `id` y
compara el comercio DESPUÉS (`sendQuote.service.ts:41`). Contesta 404 y no envía: no cruza. Pero es la
misma forma que `resend-whatsapp` con la comparación puesta: quien llame a ese servicio sin pasarle el
comercio no tiene filtro (`merchantId != null && …`).

**Nada de esto dice «el resto está limpio». Dice lo que este doble puede ver:**

- **25 NO-LLEGO, 6 con `:parámetro`.** Tras una segunda pasada con un cuerpo de relleno (31 rutas la
  necesitaron; 14 llegaron), siguen muriendo en la validación: `GET …/customers/:id/fusion-preview`,
  `POST …/customers/:id/fusionar`, `PATCH …/quotes/:id/billing-plan`, `POST …/invoices/:id/annul`,
  `PATCH …/quote-requests/:id` y `POST /admin/supresion/:merchantId`. LEÍDAS a mano, no ejecutadas: las
  dos de fusión pasan `req.merchantId` al servicio; `billing-plan` y `annul` buscan con
  `{ id, merchantId: req.merchantId }`; `supresion` lleva la regla 2 comentada. `quote-requests` no la leí.
- **Cuatro FILTRA contestan 2xx sobre el recurso ajeno**: `PUT`, `PATCH` y `DELETE /admin/customers/:id`
  y `PUT /admin/quotes/:id/notes`. Sus consultas van atadas, así que no tocan la fila del otro; lo que
  hacen es contestar «hecho» sin haber hecho nada. No es frontera; es otra cosa y no la medí más.
- **Lo que el doble no aplica:** todo lo del `where` que no sea el comercio; las consultas en SQL crudo
  (`$queryRaw` devuelve vacío); lo que un servicio decida con datos que el doble no fabrica.
- **Una sola sesión y un solo recurso por ruta.** No se probó el rol técnico de otro comercio, ni un
  cuerpo que lleve un id ajeno (`customerId` de otro en un alta), ni dos `:parámetros` de comercios
  distintos.
- **Fuera de `/admin`:** `/quote/create` recibe `merchant_id` en el cuerpo (visto en el guion de
  SCRUM-1512), `/charges`, los enlaces por token, el bot. Nada de eso está en la población.
- **Por HTTP contra una base real** sólo está el par (SCRUM-1512, X1). Las otras 189 se midieron con
  Prisma doblado. Ni Postgres, ni la app desplegada.
- La salida no es idéntica entre corridas en UNA línea: el código de referido que la app sortea.

## ④ Lo que no se ha hecho, a propósito

No se arregla `resend-whatsapp` ni ninguna otra. El arreglo toca el envío de la factura y pide decisión
(regla 40). El servicio `billing/domain/invoiceWhatsApp.service.ts` es de J1 (`dos-equipos.md:119`): la
ficha dudaba y está medido.

## ⑤ Hallado de paso en el instrumento de 1390 (no arreglado: cambiaría el eje del rol)

1. **El eje del rol tira una moneda en una fila.** `GET /admin/products/frequent-concepts` salió
   NO-DISTINGUE en 7 corridas y RECORTA en 2 (9 en total: 4 del fichero de `HEAD`, 5 del nuevo; las
   2 fueron del nuevo, sin que el nuevo cambie nada de ese eje), con el mismo código. La consulta lleva una fecha calculada
   al pedir, y `canon` no la normaliza (`JSON.stringify` convierte la fecha en texto antes de llamar al
   sustituto): si entre la petición del admin y la del técnico cambia el milisegundo, las dos consultas
   «difieren». La salida que 1390 dejó escrita la tiene en NO-DISTINGUE; pudo haber salido la otra.
2. **Sus controles ya no valen sobre `main`.** Hoy sale 1: tres de los cuatro negativos (`GET
   /admin/quotes`, `…/quotes/:id`, `…/invoices`) son RECORTA desde que SCRUM-1397 y sus hermanos
   construyeron el recorte. No es un fallo del producto: es un control que nombraba un defecto ya cerrado.
   Totales de hoy: NO-DISTINGUE 13 (o 12), RECORTA 33 (o 34), SIN-DOCUMENTO 17, NO-LLEGO 15.

## ⑥ Reproducir

    node ../../../node_modules/typescript/bin/tsc --noCheck
    cp docs/evidencias/scrum1390/censo-que-ve-el-tecnico.mjs.txt <tmp>/censo.mjs
    NO_COLOR=1 node <tmp>/censo.mjs <raíz del árbol> --eje=comercio
    NO_COLOR=1 node <tmp>/censo.mjs <raíz del árbol> --eje=comercio --doble-sordo   # debe salir 1

## ⑦ Mis errores de esta tanda

1. Medí el contexto por primera vez con 152.090 ya gastados: tarde, como avisaba la ficha.
2. Un comando que imprimía la respuesta entera de la API de GitHub me devolvió 47 KB; quería dos líneas.
3. Di por «idéntico» el eje del rol tras UNA comparación que salió distinta, y la diferencia no era mía:
   hizo falta repetir cada versión varias veces para ver la moneda de ⑤.1.

---

# SCRUM-1514b · El único cruce real, arreglado: `resend-whatsapp` sólo reenvía la factura del comercio de la sesión

**Medido contra:** `origin/main` = `4f8c473da8a565fdb6f00316f7ef5b14be3c1f1c` · 2026-10-08T07:57:41Z (hora de GitHub)

A9: comprobación → `tests/scrum1514-el-reenvio-es-del-comercio.test.mjs`

Sesión jv-j1 (relevo), equipo de Javier. Permiso: GO del fundador transcrito en SCRUM-1514 `c.18968`
(una ruta, dos ficheros). Carril: `dos-equipos.md:118` (la ruta) y `:119` (el servicio), los dos de J1,
leído contra `origin/main`. El arranque dijo «SIN IDENTIDAD… no construyas» (SCRUM-1498, carril de S5):
se siguió, como manda la ficha.

## 0 · La respuesta corta

| paso del control | resultado |
|---|---|
| ① antes de tocar nada | `resend-whatsapp` → **CRUZA** 200, 1 envío doblado · `send-reminder` → FILTRA 404, 0 envíos |
| ② arreglo | 2 ficheros de `src/`, 1 test nuevo |
| ③ después | `resend-whatsapp` → **FILTRA** 404, 0 envíos · **190 de las otras 190 filas idénticas**, 0 movidas |
| ④ positivo | el comercio que reenvía SU factura: 200, 1 plantilla al buzón de pruebas, mismo cuerpo que antes |

Envíos reales 0, salidas de la máquina cortadas 0, ninguna base tocada (Prisma doblado, Meta doblado).

## 1 · Qué cambia

- `src/modules/billing/domain/invoiceWhatsApp.service.ts`: `sendInvoicePaymentRequest` admite un segundo
  argumento opcional `{ merchantId }`. Con él, el `where` es `{ id, merchantId }`. Si se pide acotar y el
  comercio no viene, contesta `invoice_not_found` SIN consultar.
- `src/modules/system/app/routes/invoicesAdmin.routes.ts`: la ruta pasa `{ merchantId: req.merchantId }`.
- Los otros dos que llaman al servicio (`quotes.routes.ts:712`, `jobs.routes.ts:1598`) siguen llamando
  sólo con el id: acaban de crear o de leer esa factura con su comercio. No se han tocado.
- **Ningún texto nuevo.** La factura ajena cae en el 404 que la ruta YA daba para la que no existe.

⚠️ **Una diferencia con la letra de `c.18968`, dicha aquí:** el GO pide «404 con la MISMA FORMA que
`send-reminder`». El estado es el mismo (404, `ok:false`), pero el cuerpo es el que `resend-whatsapp`
ya devolvía para una factura inexistente (`error: 'invoice_not_found'` más su `message` de siempre), no
el de `send-reminder` (`error: 'not_found'`, sin `message`). Motivo: copiar el cuerpo de la vecina
obligaba a CAMBIAR la respuesta de un caso que ya existía, o a contestar distinto a «ajena» y a «no
existe», que delata que la factura existe. Así no hay literal nuevo ni respuesta vieja cambiada, y el
test fija que las dos contestan lo mismo. Si se quiere el cuerpo de `send-reminder`, es una línea.

## 2 · El instrumento, y por qué no es el que verá el siguiente

El censo con `--eje=comercio` no estaba en `main` al empezar (#2312 abierto): el ① se corrió desde el sha
`31d80a78` copiado fuera del árbol. #2312 entró a media tanda (07:52:15Z) y el fichero de `main` es
byte a byte el mismo (`cmp`). Tras mezclar `main` se repitió el «después»: 191 de 191 filas idénticas.

🔴 **Y con el arreglo dentro, ese censo sale 1.** Su control positivo ERA `resend-whatsapp` cruzando.
Ya no cruza, así que dice «¿distingue las dos rutas del par? false». No es un rojo del arreglo: es el
positivo que caduca, lo mismo que les pasó a los negativos del eje del rol con SCRUM-1397. El fichero
no corre en CI. **No se ha tocado:** elegir otro positivo es rediseñar el instrumento y no lo cubre el GO.
Mientras tanto la frontera de ESTA ruta la vigila el test nuevo, que sí corre en el obligatorio.

La comparación fila a fila es `evidencias/SCRUM-1514b/comparar.mjs`. Normaliza UNA cosa, declarada: el
sufijo al azar de los códigos de referido de `GET /admin/referral`. Sus controles:

| control | salida |
|---|---|
| CERO: dos corridas del mismo código (`antes` / `antes-repetida`) | 191 idénticas, 0 movidas, sale 0 |
| POSITIVO: `antes` / `despues` esperando la ruta | 190 idénticas, 1 movida (la esperada), sale 0 |
| ROJO 1: esperar la ruta donde no se mueve | sale 1 |
| ROJO 2: no esperar ninguna donde se mueve una | sale 1 |

## 3 · El test, visto en rojo primero

`tests/scrum1514-el-reenvio-es-del-comercio.test.mjs`, 5 casos. Sin el arreglo: 2 pasan y 3 caen (la
ajena «ha salido 1 mensaje al cliente de otro comercio», ajena distinta de inexistente, y sin comercio
no se corta). Con el arreglo: 5 de 5. El doble de la base aplica sólo el comercio del `where`.

Tanda de alrededor: 65 ficheros (todo test que nombra el servicio, la ruta o `resend-whatsapp`, más
los de suite 237, 976, 812, 267, 1294, 921c, 387, 603b, 723): 630 tests, 628 pasan, 0 caen, 2 saltan
(los dos de SCRUM-1397, sin `LIBRO_PG_URL`). `tsc --noEmit` sobre el árbol: sale 0.

## 4 · Lo que NO se ha hecho ni medido

- La tanda COMPLETA en local no se corrió: sólo esos 65 ficheros. El obligatorio del PR, sin leer al escribir esto.
- Nada por HTTP contra una base ni contra la app desplegada: Prisma doblado, como el censo.
- Las otras dos que cruzan, las 4 SIN-CONSULTA y las 25 NO-LLEGO: sin tocar (fuera del GO).
- `frequent-concepts` y los controles caducados del eje del rol: sin tocar (ticket aparte del orquestador).
- El «antes» se midió sobre `ad377526` y el «después» sobre ese mismo commit más el arreglo; lo que
  `main` trajo luego en `src/` es un comentario de `modoVisible.ts`.

## 5 · Reproducir

    node ../../../node_modules/typescript/bin/tsc --noCheck
    cp docs/evidencias/scrum1390/censo-que-ve-el-tecnico.mjs.txt <tmp>/censo.mjs
    NO_COLOR=1 node <tmp>/censo.mjs <raíz del árbol> --eje=comercio > <tmp>/ahora.txt   # sale 1: ver §2
    node docs/master/evidencias/SCRUM-1514b/comparar.mjs docs/master/evidencias/SCRUM-1514b/despues.txt <tmp>/ahora.txt
    node --test tests/scrum1514-el-reenvio-es-del-comercio.test.mjs

## 6 · Mis errores de esta tanda

1. Leí el estado de #2312 una vez («OPEN») y se lo di al orquestador como dato; entró cuatro minutos
   después y lo vi tarde, al ir a escribir el registro. El dato llevaba hora y no la puse.
2. El primer cotejo de las 190 filas lo hice con `sed` y `diff` en consola; lo rehíce como fichero
   con población y controles porque así no se podía repetir.
