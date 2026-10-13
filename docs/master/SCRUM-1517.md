# SCRUM-1517 · El recibo público contesta 500 a una factura pendiente de sellado: reproducido, y no es la única ruta

**Medido contra:** `origin/main` = `aa0b22acc3abe8572cd5e527caed0dab1e5c0f31` · 2026-10-08T08:14:08Z (hora de GitHub)

A9: sin fallo que generalice — tanda de sólo medición, sin código de `src/` ni de `tests/`; el defecto medido ya tiene su frase en A10 (SCRUM-1344) y su comprobación es el test por destino de la sección ⑤, que NO está construido

Sesión J6 (`jv-j6`, relevo, 8-oct), por encargo del orquestador de Javier (`cobroflash-backend-90`):
**reproducir, contar llamadores y proponer por escrito. No arreglar.** Sólo `docs/`: un guion, sus dos
salidas y este registro. Cero líneas de `src/`, cero de `tests/`. No se han tocado `scrum205`,
`scrum206` ni `scrum1296`, ni el camino de emisión. Nada contra desarrollo, staging ni producción.

Al cerrar, `origin/main` iba por `d47dad333d2c1ca5a763292e7f94c8433498a53d`. Entre los dos, de los
ficheros que nombra este registro sólo cambia `invoicesAdmin.routes.ts`, en otra ruta (`resend-whatsapp`,
SCRUM-1514): **sus líneas de más abajo se corren una**. Las líneas citadas aquí son las de `aa0b22acc`.

## ① La lectura era CORRECTA: sale 500. Ya no es lectura

SCRUM-1510 (`c.18965`) lo dejó escrito como «leído, no ejecutado». **Ejecutado: 500 en 5 de 5.**

Cómo se pidió: las filas las escribe el camino real compilado (`sellarTrasEmision` y `applyVeriFactu`
de `dist/`, la receta de SCRUM-1510); el **router compilado** de la ruta se monta en un express de
verdad, con el mismo prefijo que `src/app.ts:361`, en un puerto efímero de `127.0.0.1`, y se le hace
una **petición HTTP**. Lo único doblado es la base.

| caso | cómo queda pendiente | `GET /recibo/:token/pdf` | cuerpo |
| --- | --- | --- | --- |
| A (positivo del 200) | no queda: se sella | **200**, `application/pdf` | un PDF |
| B | el sellado revienta antes de la huella (**el fallo NORMAL**) | **500** | la página de «no encontrado» |
| C | huella escrita, falla la escritura del estado | **500** | ídem |
| D | justificante `J-`: falla la escritura de «no aplica» | **500** | ídem |
| E | comercio no español: lo mismo | **500** | ídem |
| F | el proceso muere entre el commit y el sellado | **500** | ídem |
| G (positivo del 409) | no queda pendiente (ver ④) | **409** | el texto firmado |
| control a cero | un enlace que no es de ningún cobro | **404** | — |

**El texto firmado sale 0 veces de 5.** En las cinco, el log de la ruta dice
`invoice_pendiente_de_sellado`. Ninguna petición escribe nada ni entrega un PDF: **el corte funciona;
lo que falla es lo que se le dice a quien pregunta.**

🔴 **Y es peor que un 500 a secas.** La página que acompaña a ese 500 es `documentNotFoundHtml()`, y
su titular dice **«Este enlace no corresponde a ningún documento activo.»**, seguido de «pide al
profesional que te reenvíe el enlace». Al cliente final se le dice que su enlace no vale, cuando el
enlace es bueno y el documento existe. Reenviarlo no arregla nada.

**B es el caso que importa, y no es rebuscado:** es exactamente lo que hace `sellarTrasEmision` cuando
el sellado falla (deja la factura donde nació y devuelve «pendiente»). No hace falta un fallo entre dos
escrituras, como en C, D y E.

Salida entera: `docs/master/evidencias/SCRUM-1517/salida-sobre-el-codigo-de-hoy.txt` (6.772 B, 84 líneas).

## ② Por qué pasa

`ensureInvoicePdf` tiene dos cortes y **cada uno lanza un error distinto**:

* el primero, por ESTADO (`src/lib/invoicing.ts:61-62`), lanza `new Error('invoice_pendiente_de_sellado')`:
  un `Error` a secas, sin `code`;
* el segundo, por HUELLA (`:104`), lanza `FacturaSinSellarError`, con `code = 'invoice_sin_sellar'`.

`esErrorSinSellar` (`src/modules/invoicing/domain/portonDocumento.ts:117`) reconoce **sólo el segundo**.
Y una factura pendiente no llega nunca al segundo corte: la para el primero.

Los dos son del mismo día. El portón y la rama del 409 entraron con `58d6d136d` (30-jul, 10:46); el
primer corte, con `f0a005d61` (30-jul, 12:41). **La rama del 409 fue alcanzable para el fallo de
sellado durante dos horas.** Desde entonces `lib/invoicing.ts:12` importa `FacturaSinSellarError` y no
la usa (sólo aparece en esa línea y en dos comentarios).

## ③ Punto 2 del encargo: más llamadores. SÍ, y el otro también cae

`esErrorSinSellar` tiene **2 llamadores en `src/`**, y los dos se quedan fuera por lo mismo:

| llamador | carril | hoy, con una pendiente (medido, 5 de 5) | lo que su rama prometía |
| --- | --- | --- | --- |
| `billing/app/routes/receipt.routes.ts:509` — `GET /recibo/:token/pdf`, pública | **J2** | 500 + «no encontrado» | 409 + el texto del cliente final |
| `system/app/routes/invoicesAdmin.routes.ts:1290` — `GET /admin/invoices/:id/pdf`, «Abrir PDF» del panel | **J1** | 500 `{"error":"pdf_generation_failed"}` | 409 `invoice_sin_sellar` + el texto del profesional |

**El segundo no estaba en el ticket.** El profesional que pulsa «Abrir PDF» en una factura cuyo sellado
falló recibe «falló la generación del PDF» y no la frase firmada para ese caso exacto («Esta factura
todavía no está registrada. Se reintenta solo; si sigue así, avísanos.», SCRUM-1502 `c.18835`). El
propio comentario de esa rama dice por qué importa: llamarlo fallo de generación «manda a quien depure
al sitio equivocado».

Los otros consumidores del error, **leídos, no ejecutados**:

* `exports/app/routes/exports.routes.ts:201` y `messaging/domain/email.service.ts:76` llaman a
  `ensureInvoicePdf` y **no clasifican**: el primero cuenta cualquier excepción como «fallido» y el
  segundo la propaga. No dependen de `esErrorSinSellar`; no se quedan fuera.
* `invoicesAdmin.routes.ts:1210` (regenerar el PDF) no pasa por la función: pregunta al predicado del
  estado y contesta 409 con `invoice_pendiente_de_sellado`. **Es la única ruta que hoy contesta bien a
  una pendiente**, y lo hace con un código distinto del de «Abrir PDF».

Población de la búsqueda: `esErrorSinSellar` sale en 3 ficheros de `src/` (su declaración y los dos de
la tabla). En `public/` ninguno de los dos códigos sale (0), con 33
ficheros del panel que sí nombran `invoices`: **el panel no ramifica por el código**, pinta lo que le
llegue.

**Por qué ningún test lo vio.** `scrum206 (b)` comprueba que el fichero de cada consumidor **nombra**
`esErrorSinSellar`. La nombra. No pide la ruta. Y el test por destino de SCRUM-1510b llega hasta
`ensureInvoicePdf`, no hasta quien la llama.

## ④ Cómo se llega HOY al 409, y una cosa más que sale de ahí

Sin un 409 visto, «no sale 409» no diría nada. El único camino que encontré al error que
`esErrorSinSellar` sí reconoce: una factura emitida cuando la ficha del comercio **no tenía NIF** (queda
«no aplica», sin huella), y el comercio rellena el NIF **después**. El primer corte la deja pasar, el
portón de la huella la niega, y las dos rutas contestan su 409. La fila de la factura no se escribe a
mano: cambia la ficha del comercio.

⚠️ **De paso, sin tocar:** a esa factura el cliente final le lee «Esta factura se está registrando en
Hacienda. Vuelve a intentarlo en un minuto.», y **no he encontrado nada que vaya a registrarla**: su
estado es «no aplica». No he medido si el reintento la recoge. Si no la recoge, hoy el único uso real
del texto firmado es un caso en el que no es verdad.

## ⑤ Punto 3: dónde va el arreglo. Propuesta, NO construida

**Recomiendo ①. Y hay una decisión del fundador antes, que no es técnica.**

**① Que `esErrorSinSellar` reconozca también el error del primer corte.** Un fichero, de J1
(`portonDocumento.ts`). Arregla las dos rutas a la vez, que es lo que se quiere: son 2 de 2, están rotas
igual y las dos quieren lo mismo. **Ensayado** (sustituyendo la función en memoria, en el proceso del
guion, sin escribir ningún fichero): las 5 pendientes pasan a **409 con el texto firmado** por la ruta
pública y a **409 `invoice_sin_sellar` con el texto del profesional** por la del panel; el 200, el 409
de G y el 404 no se mueven; 0 escrituras, 0 PDF. Salida: `salida-ensayo-de-la-propuesta.txt`.
Lo que el ensayo NO dice: es una sustitución en memoria, no un diff; quien lo construya tiene que
decidir de dónde saca la constante (hoy `portonDocumento.ts` es puro y `selladoEstado.ts` importa la
base).

**② Que cada ruta ramifique además por el otro código.** Dos ficheros, dos carriles (J2 y J1), y la
misma condición escrita dos veces. Es justo lo que la cabecera de `portonDocumento.ts` dice que no se
haga («cuatro correcciones con el mismo espíritu divergen en la quinta ocasión»). Ventaja única: cada
ruta podría contestar distinto a cada error, que es lo que pediría la decisión de abajo si sale «no».

**③ Que el primer corte lance `FacturaSinSellarError`.** Descartada: modifica `ensureInvoicePdf`, que es
camino de emisión (regla 40), y cambia el mensaje que hoy comprueban el test de SCRUM-1510b y
`tests/_factura-fixture.mjs`.

🔴 **STOP, sea cual sea:** ① y ③ tocan `invoicing/domain` o `lib/invoicing.ts`; ② toca una ruta
pública del cobro. Ninguna la construyo sin GO, y el fichero de ① es de **J1**, no mío.

🔴 **La decisión que va antes (regla 39 y claims fiscales): ¿vale el texto firmado para las cinco?**
La frase dice **«se está registrando en Hacienda»**. Es verdad para B, C y F. **Para D y E no:** un
justificante `J-` y la factura de un comercio no español **no se registran en Hacienda nunca**; están
pendientes sólo porque toda factura nace así y la escritura de «no aplica» no llegó. Con ①, a esos dos
el cliente final les leería una frase sobre Hacienda que es falsa. Hoy les sale un 500, que también lo
es. **No propongo texto nuevo.** Lo que hay que decidir es si la frase firmada cubre también al
justificante pendiente, o si ese caso necesita otra (y entonces es ② y una firma).
Lo que acota D y E: piden que falle una escritura concreta o que el proceso muera en el hueco; no he
medido cuánto dura ese hueco en una emisión sana, ni si hay alguna fila así en una base de verdad.

**El test, vaya donde vaya el arreglo: por destino.** Pedir la ruta por HTTP con una factura pendiente
fabricada y exigir el 409 **y** el texto, con el 200 de la sellada y el 404 del enlace ajeno al lado.
El guion de esta entrega es casi ese test. No lo he escrito en `tests/` porque **hoy nacería rojo**.

## Aceptación → dónde se ve

| lo que pedía el encargo | dónde se ve |
| --- | --- |
| Reproducirlo pidiendo la ruta de verdad | `docs/master/evidencias/SCRUM-1517/pedir-el-recibo-de-verdad.mjs` y `salida-sobre-el-codigo-de-hoy.txt` |
| Más llamadores, y si alguno más se queda fuera | sección ③; la segunda ruta está en la misma salida |
| Propuesta escrita de dónde va el arreglo | sección ⑤ y `salida-ensayo-de-la-propuesta.txt` |
| Carril leído en `dos-equipos.md` | `receipt.routes.ts` → J2 (`:120`) · `portonDocumento.ts`, `selladoEstado.ts`, `lib/invoicing.ts` → J1 (`:117`) · `invoicesAdmin.routes.ts` → J1 (`:118`) |
| No arreglar nada | 0 líneas de `src/` y de `tests/` en la rama |

## Lo que NO se midió

Ninguna base de verdad: no sé si hay hoy alguna factura pendiente con un cobro pagado y un enlace de
recibo. La ruta pública con la factura ligada **por presupuesto** (sólo probé la ligada por el evento
del cobro; las dos ramas acaban en la misma llamada). Los middlewares de `src/app.ts` por delante de
las rutas: el router va montado solo, y en la del panel la identidad la pongo yo (un `owner`). El panel
de verdad en un navegador: no sé qué pinta con ese 500. `exports` y el correo, sólo leídos. La tanda
completa, no.

## Mis errores

El primer recuento de temporales sobrantes lo hice con `ls` sobre el temporal de bash y dio 0: no
comprobé que fuera el mismo directorio que usa node en Windows, así que ese 0 no valía. Repetido preguntando a node por
su temporal: 0 directorios `scrum1517-` entre 63.067 entradas, tras tres pasadas del guion.
El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498); seguí por la norma común.

# SCRUM-1517b · Preparar el GO: el 500 sigue vivo, el arreglo son dos líneas, y NO puede ir solo

**Medido contra:** `origin/main` = `9358f02b14e9648f1ab65fbdacf6464d50728242` · 2026-10-13T10:29:30Z (hora de GitHub)

A9: aviso → A10 «Una dependencia entre dos PR escrita en el prompt de UNA sesión no existe para la otra: o es un guard, o no es nada.» — no se pudo comprobar: el orden «el reintento antes que la respuesta» vive en la cabecera de un módulo y en otro ticket, y el guard que lo ataría (sección ④) queda propuesto y sin construir: verlo en rojo pide poner el arreglo, que es STOP
A9: comprobación → `tests/scrum622-desconocido-no-es-verde.test.mjs`

Sesión `jv-j5f` (13-oct), por encargo del orquestador de Javier (`cobroflash-backend-2e`): **preparar
el GO, no construirlo.** 🔴 CRUCE DE CARRIL DECLARADO (A20): los ficheros del arreglo son de J1 y J2;
aquí sólo se LEEN. Esta rama lleva `docs/master/` y nada más: **cero líneas de `src/`, de `tests/` y
de `prisma/`**. Nada contra ninguna base. El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498).

## ① ¿Sigue vivo hoy? SÍ, por efecto

`dist/` compilado hoy de `9358f02b1` con `tsc --noCheck` (322 ficheros `.js`), y el guion de J6
ejecutado tal cual: **500 en 5 de 5 pendientes, por las DOS rutas**; texto firmado, 0 de 5; los 8
controles del guion pasan (200 con PDF, 409 alcanzable, 404). La salida mide 6.772 B, lo mismo que la
del 8-oct. Entre `aa0b22acc` y hoy, de los cinco ficheros implicados sólo cambió
`invoicesAdmin.routes.ts`, en otra ruta (SCRUM-1514): por eso el `catch` del panel está ahora en la
línea **1291**, no en la 1290.

## ② El alcance exacto del arreglo

`esErrorSinSellar` tiene **2 usos en `src/`**, los dos dentro de un `catch` (AST, 322 ficheros; un
nombre que no existe da 0): `receipt.routes.ts:509` y `invoicesAdmin.routes.ts:1291`. Cambiarla mueve
esas dos rutas y ninguna otra cosa.

| variante | ficheros de `src/` | líneas | carril | lo que arrastra |
| --- | --- | --- | --- | --- |
| **①a** · la función reconoce también `ERROR_PDF_SIN_SELLAR`, importándola | 1: `portonDocumento.ts` | **2** (un `import` y la línea 118) | J1 | `portonDocumento.ts` deja de ser un módulo sin dependencias: pasa a cargar `selladoEstado.ts`, que importa la base. Ciclo no hay hoy (`selladoEstado.ts` no importa `portonDocumento.ts`). NO medido: qué les pasa a los tests que cargan `portonDocumento` suelto |
| **①b** · la constante se declara en `portonDocumento.ts` y `selladoEstado.ts` la re-exporta | 2 | 3 o 4 | J1 | toca también `selladoEstado.ts`, que es el fichero que sella |
| ② · cada ruta ramifica además por el otro código | 2 | ≥ 4 | J2 y J1 | la misma condición escrita dos veces |
| ③ · `lib/invoicing.ts:62` lanza `FacturaSinSellarError` | 1 | 1 | J1 | cambia el mensaje que comprueban `tests/_factura-fixture.mjs` y `scrum1510b` |

Ninguna necesita texto nuevo: las dos frases ya están firmadas (`portonDocumento.ts:51-52` y
`invoicesAdmin.routes.ts:1297`) y **no se tocan**. Con el arreglo va un test nuevo por destino
(sección ④) y nada más en `tests/`: los tres ficheros que hoy nombran estos códigos (`_factura-fixture`,
`scrum1510b`, `scrum206`) no fijan el 500 — leído, no ejecutado.

## ③ Qué más toca. Esto es lo que cambia el GO

🔴 **El arreglo no puede entrar solo: es la pieza ③ de un PR que ya está definido, el PR-2 de
SCRUM-1404.** La cabecera de `src/modules/invoicing/domain/reintentoSellado.ts`, en `main`, dice que lo
activa un segundo PR con tres cosas a la vez —la fecha de corte, su línea en `src/core/cron/cron.ts`
(S1, pedida en SCRUM-1507) y «el arreglo del `catch` de las dos rutas del PDF»— y que el orden es
decisión del fundador (SCRUM-1404, comentario 18783): **la respuesta nunca antes que el reintento**.
Ni la ficha de hoy, ni la entrega de J6, ni el comentario 19147 de este ticket lo nombran.

Y el reintento está inerte, medido: `reintentarSelladosPendientes` tiene **0 usos en `src/`** (AST;
segunda sonda por texto en todo el repo fuera de `docs/`, `tests/` y `dist/`: sólo su declaración y
`scripts/_sin-consumir-declarados.json`, que lo declara sin consumidor a propósito), y
`REINTENTO_ACTIVO_DESDE` vale `null` (`reintentoSellado.ts:74`).

**Por qué importa:** la frase del cliente acaba en «Vuelve a intentarlo en un minuto.» y la del
profesional dice «Se reintenta solo». Con el arreglo puesto y el reintento apagado, las dos prometen
algo que ningún proceso ejecuta. Hoy salen 0 veces para una pendiente; con el arreglo a secas saldrían
siempre.

**Un hueco que el propio reintento declara:** una factura con la huella ESCRITA y el estado sin marcar
(el caso C) queda fuera de su selección. A ésa, incluso con el PR-2 entero, las dos frases le seguirían
prometiendo un reintento que no la recoge. Es 1 de los 3 casos que quedan (B, C, F) desde que D y E
cayeron (comentario 19147).

Las demás rutas que reciben uno de los dos errores. **Ninguna contesta 500 al cliente final; una sí
contesta 500, y es interna.** Población: 4 usos de `ensureInvoicePdf`, 6 de `ensureInvoiceForCharge`,
6 de `sendInvoiceEmail` (AST). Las dos primeras filas están ejecutadas; el resto, LEÍDO:

| ruta | qué error le llega | qué contesta hoy |
| --- | --- | --- |
| `GET /recibo/:token/pdf` | pendiente | 500 + «no encontrado» — **ejecutado** |
| `GET /admin/invoices/:id/pdf` | pendiente | 500 `pdf_generation_failed` — **ejecutado** |
| `POST /invoice/issue` (`invoice.routes.ts:15`, tras `requireInternalSecret`) | el del portón, si el sellado falla al emitir desde un cobro | **500 `internal_error`**: su `catch` no conoce ninguno de los dos |
| `POST /admin/invoices/:id/send-email` (`:713`) | pendiente, vía `sendInvoiceEmail` | 200 con `email_send_failed`: al profesional se le dice que falló el correo |
| webhooks de pago (`mpWebhook.routes.ts:142`, `psp.routes.ts:55` y `:218`) | el del portón | lo tragan a consola y contestan bien a la pasarela; el correo de la factura no sale. No he medido si el aviso de Cobros (SCRUM-1243) salta en ese caso: el fallo ocurre antes de `sendInvoiceEmail`, que es quien deja la fila |
| `GET /exports/datos.zip` (`exports.routes.ts:201`) | pendiente | la cuenta como «fallida» y sigue |
| `POST /admin/invoices/:id/regenerate-pdf` (`:1211`) | no llama a `ensureInvoicePdf` | 409 `invoice_pendiente_de_sellado`, sin frase. Y no pasa por `exigirDocumentoEmitible` (2 usos, los dos en `lib/invoicing.ts`) |
| `/dev/issue-invoice` y `/dev/email-invoice` | — | no se montan en producción (`app.ts:372`) |

Con ①a, el panel contestaría `invoice_sin_sellar` en «Abrir PDF» e `invoice_pendiente_de_sellado` en
«regenerar» para el mismo estado. Ya son dos códigos hoy; el arreglo no lo crea, lo hace visible.

## ④ El control, visto en rojo sin tocar `src/`

`docs/master/evidencias/SCRUM-1517b/control-en-rojo.mjs`: el guion de J6 copiado byte a byte (`cmp`
idéntico antes de editar) y cambiado en tres sitios. Pide las dos rutas por HTTP con el router
compilado; sólo va doblada la base.

| pasada | qué hay | veredicto | código |
| --- | --- | --- | --- |
| `--exigir-el-409` | el código de hoy | **ROJO**: 5 de 5 sin su 409, por las dos rutas | 1 |
| `… --simular-la-propuesta` | la función sustituida en memoria | **VERDE**: 0 de 5 | 0 |
| `… --simular-un-arreglo-que-se-lo-traga-todo` | un arreglo malo, que llama «sin sellar» a cualquier error | **caen 2 controles** (el negativo, por las dos rutas) | 1 |

El caso nuevo, H, es el negativo que le faltaba al ensayo del 8-oct: una factura bien sellada cuyo PDF
falla de verdad (`emisor_sin_nombre_al_generar_pdf`) tiene que **seguir en 500** con el arreglo puesto.
Sigue. Y con el arreglo malo cae, que es lo que demuestra que mira. Los 11 controles pasan en las dos
primeras pasadas. Entre dos pasadas iguales cambian 5 líneas: las huellas (llevan la hora) y el tamaño
del PDF del caso A (6.534 / 6.536 B).

Lo que NO es: no es un test de `tests/`. Hoy nacería rojo, y verde sólo con una sustitución en memoria,
que no es un diff.

**El guard que falta, propuesto y NO construido:** uno que LEA `src/` y caiga si `esErrorSinSellar` (o
el `catch` de cualquiera de las dos rutas) reconoce el error del primer corte mientras
`reintentarSelladosPendientes` siga con 0 usos o `REINTENTO_ACTIVO_DESDE` siga en `null`. Hoy nacería
verde. Convierte la orden del comentario 18783 en mecanismo.

## Lo que NO se midió

El comentario 18783 de SCRUM-1404 **no lo he abierto en Jira**: lo leo de la cabecera de
`reintentoSellado.ts` y de `docs/master/SCRUM-1404.md:242-247`. El estado de SCRUM-1507 (la línea de
cron), tampoco. Ninguna base. Los middlewares de `src/app.ts` por delante de las rutas. El panel en un
navegador. `POST /invoice/issue`, el correo, los webhooks, el ZIP y «regenerar»: leídos, no ejecutados.
Quién llama a `POST /invoice/issue`. La tanda completa y `guards:entrada`, no.

## Aceptación → dónde se ve

| lo que pedía el encargo | dónde se ve |
| --- | --- |
| ¿Sigue vivo en `main` hoy?, por efecto | sección ① · `docs/master/evidencias/SCRUM-1517b/salida-hoy-ROJO.txt` |
| El alcance exacto: ficheros y líneas | sección ② |
| Qué más toca: otras rutas con el patrón | sección ③ · `docs/master/evidencias/SCRUM-1517b/censo-de-usos.mjs` y `salida-censo.txt` |
| El control en rojo, antes y después | sección ④ · `control-en-rojo.mjs` y sus tres salidas |
| Construir el arreglo | NO HECHO → es STOP (regla 40); va con el PR-2 de SCRUM-1404, carril J1 |

## Mis errores

Di por idénticas dos pasadas del control antes de compararlas: `cmp` dijo que no lo eran. Miradas las
diferencias, son la hora de la huella y dos bytes del PDF; el veredicto no cambia. No he leído en Jira
la decisión que más pesa de esta entrega (18783): me quedaba contexto para el ticket propio y no para
SCRUM-1404 entero. Y cité la frase de A10 con su «(SCRUM-1358)» detrás: el guard de la A9 la busca sin
el origen y cayó; corregida y vuelto a correr. Contexto medido en el jsonl al escribir: 220.206.

**Y el primer empujón (`f439d465`) dejó el obligatorio en ROJO, por mi guion:** 11.197 casos, 1 cae,
`SCRUM-622`. El veredicto de `control-en-rojo.mjs` estaba escrito como «si no es rojo, es verde», y sin
pendientes habría dicho VERDE sobre nada. El censo tenía razón. Ahora son tres estados y el verde se
gana; sin población dice CIEGO. No corrí ese censo antes de empujar: corrí siete ficheros de guards y
no era ninguno de ellos. Tras el cambio, las tres pasadas dan lo mismo que antes (ROJO, VERDE, caen 2).
