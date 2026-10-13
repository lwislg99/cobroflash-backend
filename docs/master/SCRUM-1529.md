# SCRUM-1529 · Los siete campos de estado que esperan al fundador: la decisión, hecha de medir

**Medido contra:** `origin/main` = `b95e33e4dc818eaa20f500f5a08bb1040c0d080a` · 2026-10-13T06:54:00Z

A9: sin fallo que generalice — mis tres tropiezos (abajo, «Lo que me salió mal») son casos de frases que A10 ya tiene: «Una operación que no se ejecutó se lee exactamente igual que un éxito» y «Contar no es avisar»; no añaden regla nueva y ninguno llegó al resultado.

13-oct-2026 · sesión `jv-j2c` (equipo de Javier), por encargo del orquestador (`cobroflash-backend-2e`).
[Escrito por la sesión, no por Javier. Leídos en Jira: SCRUM-1529 entero; SCRUM-1500 entero con sus 18
comentarios, y en particular su punto ②, `c.18925`, `c.19211`, `c.18912`, `c.18796` y `c.18908`;
SCRUM-1499 entero, que no tiene comentarios.]

**Carril a mano.** El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498); se siguió, como manda la ficha
común del 13-oct. Sólo se ha escrito este registro y `docs/master/evidencias/scrum1529/`. **No se ha
tocado `src/`, ni `prisma/schema.prisma`, ni el máster, ni `public/`, ni ningún test.** No se ha decidido
nada: las siete decisiones son del fundador.

## Qué se pidió y qué estaba ya hecho

Se pidió, por cada uno de los siete campos: qué valores existen hoy en el código, qué fija la Parte L, dónde
discrepan y qué tiene que decidir el fundador en una frase que se conteste con una palabra.

**Las tres primeras columnas ya estaban medidas**, por J5, el 7 y el 8 de octubre, con instrumento en
`main`: los tres primeros campos en `c.18796` (`docs/master/evidencias/scrum1500/cotejo.cjs`) y los otros
cuatro en `c.18908` (`docs/master/evidencias/scrum1500c/cotejo-once.cjs`). **No las he rehecho: las he
vuelto a correr hoy**, con esos dos instrumentos sin tocar, y he añadido lo que faltaba: un control por
campo, lo que cambió en cinco días, las lecturas que J5 dejó sin medir, y la pregunta.

## La tabla

Valores del código y del máster: salida de los dos instrumentos de J5 sobre el árbol de hoy (322 ficheros
`.ts` de `src/`, 0 sin parsear, 199 escrituras de Prisma vistas; máster de 1.905 líneas).

| campo | valores que EXISTEN en el código | qué fija la Parte L | dónde discrepan | la pregunta |
|---|---|---|---|---|
| `QuoteRequest.status` | `pending`, `read`, `done` | línea 401: `new → seen → converted(quoteId) \| discarded(reason)` | en todo: ningún valor en común | ① |
| `ParteTrabajo.estado` | `borrador`, `firmado`, `facturado` | **el máster no lo fija** (no nombra la entidad) | no hay con qué comparar | ② |
| `TeamMember.status` | `invited`, `active`, `suspended` | **el máster no lo fija** (los tres salen en prosa, sin lista) | no hay con qué comparar | ③ |
| `Quote.status` | `draft`, `pending_approval`, `sent`, `accepted`, `rejected`, `expired` | línea 398: `draft → sent → accepted \| rejected`, y `expired` con la etiqueta `F2` | el código tiene `pending_approval` | ④ |
| `Invoice.status` | `pending`, `paid`, `annulled`, `expired` | línea 399: `pending → paid` · `pending → annulled` | el código admite `expired` | ⑤ |
| `Charge.status` | `pending`, `paid`, `failed`, `expired` | línea 400: `pending → paid(…)` · `pending → cancelled` | el código tiene `failed` y `expired`; el máster tiene `cancelled`, que nadie escribe | ⑥a y ⑥b |
| `WhatsAppMessage.status` | `queued`, `sent`, `delivered`, `read`, `failed`, `received` | línea 403 (y J4, línea 309, que dice lo mismo): `queued → sent → delivered → read` · `queued\|sent → failed(error)` | el código tiene `received` | ⑦ |

## Las preguntas, para contestar con una palabra

Cada una es SÍ o NO. Debajo, lo que arrastra cada respuesta, medido. No recomiendo ninguna.

**① `QuoteRequest`: ¿la Parte L pasa a decir `pending → read → done`, que es lo construido?**
- SÍ: cambia una línea del máster (401) y cero código.
- NO: el código va hacia el máster, y no cabe sin esquema: el modelo tiene 11 campos y ninguno es un
  `quoteId` ni un motivo, así que `converted(quoteId)` y `discarded(reason)` piden ALTER aditivo (A5). Hoy
  `done` no distingue «convertida» de «descartada». Los cuatro valores del máster salen 0 veces entre
  comillas en `src/` y en `public/`.

**② `ParteTrabajo`: ¿entra su máquina en la Parte L?**
- SÍ: línea nueva en el máster. Arrastra una segunda pregunta, **CON o SIN `facturado`**: lo declara
  `ESTADOS_PARTE` (`parteTrabajo.ts:78`) y lo lee `puedeEditarPrecios` (`:420`), pero **no lo escribe
  ninguna línea de `src/`**. El máster rechazó para el albarán guardar «facturado» como estado (línea 1329);
  no digo que sea el mismo caso.
- NO: el máster tiene que decir que no es una máquina de la Parte L, y `parteTrabajo.ts:465` deja de citar
  «(Parte L)» para un vocabulario que la Parte L no trae.

**③ `TeamMember`: ¿entra su máquina en la Parte L?**
- SÍ: línea nueva en el máster con `invited`, `active`, `suspended`. Las transiciones no están medidas (ver
  «Lo que NO he medido»): habría que medirlas antes de escribir flechas.
- NO: se dice en el máster que no es una máquina de la Parte L. Cero código en los dos casos.

**④ `Quote`: ¿entra `pending_approval` en la máquina de la Parte L?**
- SÍ: una palabra en la línea 398. Lo medido del valor: nace en `quotes.routes.ts:197` (lo elige la `:160`
  cuando un técnico pasa de `merchant.approvalThreshold`) y sale a `draft` en `quotesAdmin.routes.ts:862`.
- NO: se retira algo construido y en uso: 8 líneas en 3 ficheros de `src/` y 33 en 7 ficheros de `public/`,
  con textos que ve el usuario («Pendiente de aprobación»). El máster da las aprobaciones por existentes
  como capacidad del plan Equipo (líneas 129, 1654, 1655).

**⑤ `Invoice`: ¿se quita `expired` de la factura?**
- SÍ: lo que hay que quitar es poco y es de dos sitios: la ruta `PUT /admin/invoices/:id/status` lo admite
  (`invoicesAdmin.routes.ts:555`) y `invoiceAdmin.ts:306` lo guarda; y la lista de facturas tiene un filtro
  «Vencidas» que pide `status=expired` (`invoicesView.js:325` → `invoiceAdmin.ts:46-47`). Tocar el filtro
  es texto de usuario (regla 39).
- NO: una palabra en la línea 399, para un estado al que **hoy no se llega desde ninguna pantalla**: los
  tres sitios de `public/` que llaman a esa ruta mandan sólo `paid` o `pending` (leídos los tres cuerpos:
  `jobDetailView.js:2197`, `invoiceDetailView.js:451-498`, `quotesDetailView.js:942-950`), y ninguna línea
  de `src/` lo escribe con un literal. O sea: el filtro «Vencidas» filtra por un valor que sólo puede
  haber puesto una petición hecha a mano. Si hay filas así, no lo sé: no he mirado ninguna base.

**⑥a `Charge`: ¿entran `failed` y `expired` en la máquina de la Parte L?**
- SÍ: la línea 400 gana dos valores. Los dos están vivos: los escriben `mpWebhook.routes.ts:259` y
  `psp.routes.ts:393`, y `expired` se lee en `payBizum.routes.ts:138`, `payInvoice.routes.ts:32`,
  `payMp.routes.ts:27` y `psp.routes.ts:104`.
- NO: hay que cambiar los avisos de la pasarela, que es flujo de cobro: STOP (AA1.4).

**⑥b `Charge`: ¿se quita `cancelled` de la Parte L?**
- SÍ: la línea 400 pierde un valor que no escribe ni lee nadie como estado de un cobro (la única línea de
  `src/` que lo nombra entre comillas, `mpWebhook.routes.ts:255`, es el estado que devuelve Mercado Pago).
- NO: falta construir quién cancela un cobro. Hoy nadie.

**⑦ `WhatsAppMessage`: ¿entra `received` en la Parte L, como estado de los mensajes ENTRANTES?**
- SÍ: lo ganan la línea 403 y la 309 (J4). Viene con su pareja, que es de SCRUM-1499 y no de estos siete:
  `type: 'inbound'`. Las filas `received` las escribe `recordInboundWaMessage`
  (`whatsappLog.service.ts:218`) y sostienen la ventana de 24 h, que las lee por `type`
  (`whatsappLog.service.ts:236`), no por `status`.
- NO: la ventana de 24 h necesita otra forma de guardar los entrantes.

## Lo que ha cambiado desde que J5 lo midió (8-oct → 13-oct)

Comparada la salida de hoy con la que J5 dejó en `main` (`diff` de los dos ficheros de salida):

- **Los siete veredictos son los mismos.** Ningún campo ha ganado ni perdido un valor.
- 🔴 **Un dato de SCRUM-1499 ha caducado.** Su enunciado dice que `queued`, el estado que la Parte L pone
  primero, «no lo escribe NINGUNA línea de `src/`». Desde el 8-oct lo escribe
  `whatsappLog.service.ts:143` (SCRUM-1513, la reserva del tope de plantillas). De `WhatsAppMessage.status`
  sólo queda en disputa `received`. `failed` también ha ganado un escritor directo (`:182`).
- Lo demás son números de línea que se han movido (por ejemplo `quotesAdmin.routes.ts:854` → `:862`).
- El máster no ha tocado ninguna de estas líneas: desde el 7-oct sólo tiene dos commits (`b9783a0dc`, la
  línea 404; `ada93a1d3`, una nota de SCRUM-1521). **No hay decisión escrita en ningún sitio que yo haya
  mirado:** ni en el máster, ni en SCRUM-1500, ni en SCRUM-1499 (0 comentarios).

## Dónde el planteamiento del encargo no cuadra con lo medido

1. **«Las siete líneas de Ⓔ» no son de los siete campos.** Son siete comentarios del esquema de OTROS
   campos (líneas 18, 67, 201, 973, 1174, 1453 y 1636: `Merchant.trade`, `Merchant.connectStatus`,
   `AuthSession.type`, `Expense.category`, `TeamMember.role`, `Albaran.estado`, `ParteTrabajo.tipo`). El
   propio registro de SCRUM-1500 dice que para 1115, 1175 y 1642 «no se propone nada». Son dos sietes
   distintos que coinciden en el número: las siete líneas esperan una FIRMA; los siete campos, una
   DECISIÓN. Contestar a éstos no aplica aquéllas.
2. **Los siete no son todos los que esperan.** J5 dejó en `c.18908` tres campos más en el mismo cajón que
   `ParteTrabajo.estado` y `TeamMember.status` («es un estado y el máster no trae su máquina»):
   `Merchant.status`, `EmailMessage.status` y `VfSubmission.status`. Hoy siguen igual (salida de
   `cotejo-once.cjs`). Si ② y ③ se contestan con un criterio, ese criterio les toca.
3. **Son siete campos y ocho preguntas, o nueve.** `Charge.status` son dos (lo que sobra y lo que falta) y
   ② arrastra la de `facturado`.
4. **SCRUM-1529 nació sin etiquetas de equipo ni de área y sin «Aceptación»** (sólo lleva `fundador`). No lo
   he tocado: A13.

## Los controles

**Uno positivo y uno de cero POR CAMPO, sembrados** (`siete.cjs`). El instrumento copia `src/`, el esquema,
el máster y los dos instrumentos a un directorio temporal fuera del repositorio, y añade un fichero con
siete escrituras de Prisma fabricadas, una por campo, con un valor que no existe (`zz1529_<delegado>`).

| campo | valor sembrado | árbol real (cero) | copia sin siembra (cero) | copia sembrada (positivo) |
|---|---|---|---|---|
| `QuoteRequest.status` | `zz1529_quoteRequest` | 0 | 0 | sale en ese campo y sólo en él |
| `ParteTrabajo.estado` | `zz1529_parteTrabajo` | 0 | 0 | sale en ese campo y sólo en él |
| `TeamMember.status` | `zz1529_teamMember` | 0 | 0 | sale en ese campo y sólo en él |
| `Quote.status` | `zz1529_quote` | 0 | 0 | sale en ese campo y sólo en él |
| `Invoice.status` | `zz1529_invoice` | 0 | 0 | sale en ese campo y sólo en él |
| `Charge.status` | `zz1529_charge` | 0 | 0 | sale en ese campo y sólo en él |
| `WhatsAppMessage.status` | `zz1529_whatsAppMessage` | 0 | 0 | sale en ese campo y sólo en él |

7 de 7. La copia sin siembra da para los siete los mismos valores que el árbol real, así que lo que hizo
aparecer el valor fue la siembra y no la copia. Población de la copia sembrada: 323 ficheros y 206
escrituras, uno y siete más que el árbol real.

**Visto en rojo, dos veces** (`mutaciones.txt`; `git diff --numstat` 1 1 en cada una, árbol restaurado
después):

- la siembra metida dentro del `where`, donde los instrumentos no miran: 0 de 7, salida 1;
- la siembra sin escribir: «CIEGO: la siembra no llegó al disco», 0 de 7, salida 1.

**Literal o constante.** Era el aviso del encargo y aquí pesa: de los siete, sólo `TeamMember.status` se
escribe entero con literales dentro de Prisma. El resto entra, en todo o en parte, por otra puerta, y los
instrumentos de J5 las declaran una a una: una lista que valida el cuerpo de la petición (`QuoteRequest`,
`Invoice`), una constante (`ESTADOS_PARTE`), una función (`estadoTrasFirmar`), una fábrica (`paid` del cobro
sale de `datosDeCobroPagado`; la revisión de un presupuesto, de `nuevaRevisionDe`), el argumento de una
función (`recordWaMessage`) y las claves de un objeto (`STATUS_RANK`: por ahí entran `delivered` y `read`,
que llegan del aviso de Meta y ninguna línea escribe con un literal). Buscar el literal habría dado, por
ejemplo, que nadie marca un cobro como pagado.

**La sonda de texto**, independiente del AST, sobre 322 ficheros de `src/` y 107 de `public/`: da dos
recuentos por valor (entre comillas, y como palabra entera) y un control derivado por valor
(`<valor>zz1529`), los diez a 0. No atribuye una línea a un campo; lo que este registro afirma de cada
valor lo he leído línea a línea.

## Lo que NO he medido

- **Ninguna base de datos.** No sé qué valores hay en las filas, ni si existe alguna factura `expired`.
- **Las transiciones.** Los instrumentos comparan conjuntos de valores. De las transiciones sólo afirmo
  las que cito con su línea.
- **Las lecturas, sólo de los valores en disputa** y sólo por literal entre comillas. Un valor leído a
  través de una constante no lo vería.
- **SQL crudo:** 16 usos de `$executeRaw`/`$queryRaw` en `src/`, vistos por texto; ninguno lleva `UPDATE`
  ni `INSERT` ni nombra estas tablas. No pasó por el AST.
- **Que el estado que manda Meta esté cerrado.** `updateWaMessageStatus` guarda lo que llega del aviso si
  `shouldApplyStatus` lo deja pasar; leída la función, un valor desconocido no avanza. No lo he ejecutado.
- **Los tres campos de fuera de los siete** (punto 2 de arriba): corridos, no leídos de nuevo.
- **La tanda completa** no se ha corrido: no hay código ni test nuevo. Sí los del registro (abajo).
- No he buscado en Jira, por texto, una decisión escrita en otro ticket: me apoyo en la búsqueda de
  `jv-j2b` (`c.19211`), de hace una hora, y en que el máster no ha cambiado.

## Lo que me salió mal

- La primera versión de la sonda de texto decía contar «entre comillas» y contaba palabras enteras: daba 6
  líneas para `received` donde entre comillas hay 1. Lo vi al comparar con un recuento hecho a mano. Ahora
  da los dos números, cada uno con su nombre.
- Un recuento de SQL crudo no llegó a ejecutarse (el `$` iba entre comillas dobles y se lo comió la
  consola) y dio 0 dos veces. Lo delató el error impreso al lado. Repetido con comillas simples: 16.
- Pasé de 200.000 de contexto sin avisar al cruzarlo: lo medí a 244.412 y avisé entonces.

## Lo que pide el encargo → dónde se ve

| lo que pide | dónde se ve |
|---|---|
| qué valores existen hoy en el código, medidos | «La tabla», y entero en `docs/master/evidencias/scrum1529/siete-salida.txt` |
| qué fija la Parte L, o que no fija nada | «La tabla»: líneas 398 a 403 del máster; dos campos sin lista |
| dónde discrepan | «La tabla» y «Las preguntas» |
| la decisión en una frase que se conteste con una palabra | «Las preguntas», de ① a ⑦ |
| un positivo y un cero por campo | «Los controles»; `docs/master/evidencias/scrum1529/siete.cjs` |
| literal o constante | «Los controles», párrafo «Literal o constante» |
| las siete decisiones tomadas | NO HECHO → son del fundador; este ticket sigue abierto hasta que conteste |

Cómo se repite: `node docs/master/evidencias/scrum1529/siete.cjs` (salida 0; un minuto).

# SCRUM-1529b · Los tres del mismo cajón: `Merchant.status`, `EmailMessage.status`, `VfSubmission.status`

**Medido contra:** `origin/main` = `9226d0f2dd48f885b63b3222441f57554a7cdb1c` · 2026-10-13T07:22:14Z (hora de GitHub)

A9: sin fallo que generalice — mis tres tropiezos (abajo, «Lo que me salió mal») son casos de frases que A10 ya tiene: «Una salida recortada para leerla cómoda es media salida» y «Lo que el repositorio llama inferencia puede estar ya medido en Jira»; ninguno llegó al resultado y no añaden regla nueva.

13-oct-2026 · sesión `jv-j2e` (equipo de Javier), por encargo del orquestador (`cobroflash-backend-2e`).
[Escrito por la sesión, no por Javier. Leídos en Jira antes de medir: SCRUM-1529 entero con sus cuatro
comentarios (`c.19222`, `c.19225`, `c.19227`, `c.19228`) y, de SCRUM-1500, `c.18908`. Los otros 17
comentarios de SCRUM-1500 NO los he leído.]

**Carril a mano.** El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498); se siguió, como manda la ficha
común del 13-oct. Sólo se ha escrito este tramo y `docs/master/evidencias/scrum1529b/`. **No se ha tocado
`src/`, ni `prisma/schema.prisma`, ni el máster, ni `public/`, ni ningún test.** `VfSubmission` es la cola
de remisión a la AEAT: su código se ha LEÍDO (regla 38) y no se ha modificado ni instrumentado. No se ha
decidido nada: las tres decisiones son del fundador, y las recomendaciones de abajo son mías.

## Qué estaba ya hecho, y qué añade este tramo

- **Los valores y «el máster no lo fija» ya los midió J5** el 8-oct (`c.18908`,
  `docs/master/evidencias/scrum1500c/cotejo-once.cjs`). **No los he rehecho: he vuelto a correr su
  instrumento**, sin tocarlo. La salida de hoy, comparada con la que dejó en `main`, no cambia en ninguno
  de estos tres campos: mismos valores, mismas líneas, mismo veredicto.
- **Que la cola de `VfSubmission` no la vacía nadie ya lo midió J5** en SCRUM-1500d (tramo de
  `docs/master/SCRUM-1500.md`, instrumento `docs/master/evidencias/scrum1500d/cola.mjs`), y el máster lo
  dice desde el 8-oct en la línea 404. Lo vi al final, no al principio (ver «Lo que me salió mal»). Mi
  contador de llamadas es una segunda sonda y da lo mismo; su instrumento no lo he corrido.
- **Lo que faltaba**, y es lo que pide el criterio del fundador de hoy (`c.19228`): la columna de J5 es la
  UNIÓN de lo declarado (una constante, un enum) y lo escrito, así que no puede contestar «¿hay algún valor
  declarado que nadie escriba?». Este tramo separa las dos cosas, deriva por qué puerta entra cada valor y
  mira si a esa puerta la llama alguien.

## La tabla

Sobre 322 ficheros `.ts` de `src/` (0 sin parsear), 199 escrituras de Prisma vistas, máster de 1.905
líneas. La Parte L son las líneas 396 a 412 del máster y trae doce entradas; ninguna es de estos campos.

| campo | valores DECLARADOS | valores que alguna línea ESCRIBE, y por dónde | qué fija la Parte L | dónde discrepan | ¿declarado que nadie escribe? |
|---|---|---|---|---|---|
| `Merchant.status` | ninguna lista: es un `String` con `@default("active")` | `active`, literal en la creación del comercio (`auth.service.ts:346`) | **el máster no lo fija** («Merchant.status» sale 0 veces) | no hay con qué comparar | no aplica: no hay lista declarada |
| `EmailMessage.status` | los seis de `ESTADOS_CORREO` (`constanciaCorreo.ts:36`) | los seis, y ninguno con un literal dentro de Prisma: dos por `constanciaDeEnvio`, uno por `constanciaDeFallo`, y cuatro por los valores de `EVENTOS_RESEND` (`firmaResend.ts:260-263`) | **el máster no lo fija** (no nombra la entidad: «EmailMessage», «ESTADOS_CORREO» y «email_messages» salen 0 veces) | no hay con qué comparar | **NINGUNO** |
| `VfSubmission.status` | los cinco del enum `VfSubmissionStatus` y de `ESTADOS_VF_SUBMISSION` (`sif.cola.ts:25`) | los cinco: `pending` por el `@default` (`encolarRemision.ts:61` crea sin poner el campo), `sent` con un literal (`sif.procesador.ts:122`) y el resto por las decisiones de `sif.cola.ts` | **no trae la lista, y dice por qué**: la línea 404 dice que su diseño «vive en S1-D (Parte U1.3) hasta que se construya» | en los valores, en nada | **NINGUNO por línea; cuatro de cinco por alcance** (abajo) |

Los seis de `EmailMessage`: `aceptado_sin_confirmacion`, `aceptado_sin_identificador`, `fallo_envio`,
`entregado`, `rebotado`, `reclamado`. Los cinco de `VfSubmission`: `pending`, `sent`, `accepted`,
`rejected`, `manual_review`.

## Campo por campo

### `Merchant.status`

1. **Valores:** uno, `active`. Lo escribe una sola línea, al crear el comercio. Ninguna otra escritura de
   `merchant` en `src/` toca el campo: 4 derrames, ninguno lo nombra, y ninguna escritura lleva el dato
   sin literal.
2. **Parte L:** no lo fija. La Parte L tiene dos entradas del comercio y son otras columnas:
   «Subscription (merchant.plan)» y «Merchant readiness (checklist, no FSM)».
3. **Discrepancia:** ninguna posible.
4. **¿Valor declarado que nadie escriba?** No hay valores declarados. Lo que hay es el revés: **dos
   lectores con una rama a la que hoy no se llega**, porque nadie escribe otra cosa que `active`:
   `publicProfile.routes.ts:32` (`status === 'active'` para enseñar el perfil público) y
   `botFlow.service.ts:258` (`status !== 'active'` para no atender). Es la misma consecuencia que
   `c.19228` anotó para `facturado`: se mira aparte, no se borra de paso.
5. **La pregunta:** *¿Entra `Merchant.status` en la Parte L con su único valor, `active`?* (SÍ o NO)
   - **Mi recomendación, no decisión: SÍ**, con el valor y sin flechas. Es el criterio de ③ tal cual: el
     valor se escribe, así que entra; transiciones no hay ninguna que medir. Cero código.
   - Si es NO: el máster dice que no es una máquina. Cero código también.

### `EmailMessage.status`

1. **Valores:** seis, y **ninguno entra con un literal dentro de Prisma**. La tabla sólo se escribe en
   `registroDeEnvios.ts`, con dos expresiones:
   - `:223`, `constancia.estado`. Las 10 llamadas a `registrarEnvio()` traen una constancia que sale de
     `constanciaDeEnvio` (`aceptado_sin_confirmacion`, `aceptado_sin_identificador`) o de
     `constanciaDeFallo` (`fallo_envio`); fuera de esas dos fábricas, 0.
   - `:320`, `avanzar(fila.status, estado)`, desde `aplicarAvisoDeProveedor`. Tiene una llamada, la ruta
     del aviso de Resend (`resendWebhook.routes.ts:82`, montada en `app.ts:157`), y el estado sale de
     `EVENTOS_RESEND`: `entregado`, `rebotado`, `reclamado`, `fallo_envio`.
2. **Parte L:** no lo fija, ni lo nombra el máster en ningún sitio.
3. **Discrepancia:** ninguna posible.
4. **¿Valor declarado que nadie escriba?** **Ninguno.** Los seis tienen su línea y a las seis se llega por
   funciones que sí tienen llamadores.
5. **La pregunta:** *¿Entra `EmailMessage.status` en la Parte L con sus seis valores?* (SÍ o NO)
   - **Mi recomendación, no decisión: SÍ**, los seis y sin flechas. El código tiene un orden
     (`RANGO`, `constanciaCorreo.ts:105`), pero las transiciones no las he medido y la regla 27 prohíbe
     inventarlas: como en ③. Cero código.

### `VfSubmission.status` — el caso

1. **Valores:** cinco, y los cinco tienen una línea que los escribe.
   - `pending`: lo pone el `@default` cuando sellar una factura encola su alta (`encolarRemision.ts:61`,
     que crea la fila sin poner el campo; lo llama `selladoEstado.ts:173`).
   - `sent`: literal en `sif.procesador.ts:122`.
   - `accepted`, `rejected`, `manual_review` y la vuelta a `pending`: `sif.procesador.ts:171` escribe
     `d.estado`, y `d` sale de las decisiones de `sif.cola.ts` (11 literales, líneas 106 a 195).
2. **Parte L:** no trae su lista, y esta vez **el máster sí dice algo**. La línea 404, que es de la
   Parte L, dice que la cola «NO está construida» —la emisión la llena y ningún proceso la vacía— y que su
   diseño «vive en S1-D (Parte U1.3) hasta que se construya». Esa frase es del 8-oct y lleva la firma del
   fundador citada (SCRUM-1500e, `c.18925`). Fuera de la Parte L, el máster nombra la entidad en las líneas
   156 y 1060 y `manual_review` una vez, en la 580; la lista de valores, en ninguna.
3. **Discrepancia:** en los valores, ninguna. Y un dato de `c.18908` ha caducado: J5 anotó que las líneas
   404 y 980 no decían lo mismo; la 404 se corrigió el mismo 8-oct y hoy dicen lo mismo.
4. 🔴 **¿Valor declarado que nadie escriba?** Depende de qué se pregunte, y hay que decir las dos:
   - **Por línea, ninguno.** No es el caso de `facturado`, que no tiene ninguna línea que lo escriba.
   - **Por alcance, cuatro de cinco.** `sent`, `accepted`, `rejected` y `manual_review` (y la vuelta a
     `pending`) se escriben sólo dentro de `procesarObligado`, y **`procesarObligado()` tiene 0 llamadas en
     `src/`**. No es un olvido: está declarado sin enchufar a propósito
     (`scripts/_sin-consumir-declarados.json:159`, decisión D2 de SCRUM-1296: se enchufa cuando se decida
     la custodia del certificado). Lo llama un test (`tests/scrum1296-procesador-cola.test.mjs`); ningún
     proceso. Hoy una fila de esta tabla sólo puede estar en `pending`.
5. **La pregunta:** *¿Se queda `VfSubmission.status` fuera de la Parte L hasta que se enchufe el
   procesador, como ya dice la línea 404?* (SÍ o NO)
   - **Mi recomendación, no decisión: SÍ, se queda fuera y no se toca nada.** El fundador ya lo decidió el
     8-oct con esa frase, y su criterio de hoy lo confirma en vez de moverlo: un estado al que no se puede
     llegar es una promesa, y aquí son cuatro. El día que `procesarObligado` tenga un llamante, entran los
     cinco; ese día el guard de SCRUM-1128 lo verá.
   - Si es NO, hay dos formas y las dos son una línea del máster: entran los cinco (y la Parte L lista
     cuatro estados a los que hoy no llega ninguna fila), o entra sólo `pending`.
   - **Cero código en cualquiera de las tres.** Es el camino de emisión: no se propone tocarlo.

## Los controles

Instrumento: `docs/master/evidencias/scrum1529b/tres.cjs`. Salida entera en `tres-salida.txt`. Trabaja
sobre una copia del árbol en un directorio temporal fuera del repositorio.

| control | qué se siembra | árbol real | copia sin siembra | copia sembrada |
|---|---|---|---|---|
| A · `Merchant.status` | una escritura de Prisma con `zz1529b_merchant` | 0 | 0 | sale en ese campo y sólo en él |
| A · `EmailMessage.status` | una escritura de Prisma con `zz1529b_emailMessage` | 0 | 0 | sale en ese campo y sólo en él |
| A · `VfSubmission.status` | una escritura de Prisma con `zz1529b_vfSubmission` | 0 | 0 | sale en ese campo y sólo en él |
| B · `EmailMessage.status` | se le QUITA a la copia el escritor de `reclamado` (1 sitio) | no lo nombra | no lo nombra | «declarado y nadie lo escribe»: `reclamado`, sólo en ese campo |
| B · `VfSubmission.status` | se le QUITA a la copia el escritor de `rejected` (3 sitios) | no lo nombra | no lo nombra | «declarado y nadie lo escribe»: `rejected`, sólo en ese campo |
| C · llamadas a `procesarObligado()` | una llamada fabricada | 0 | 0 | 1 |

- **El control B es el que sostiene la respuesta que decide.** «Ningún valor declarado sin escribir» es un
  cero, y un cero no distingue limpio de ciego: por eso se fabrica el caso `facturado` en la copia y se
  comprueba que el instrumento lo nombra. `Merchant.status` no tiene lista declarada: no hay valor que
  quitarle, y el instrumento lo dice en vez de darlo por visto.
- **El positivo del control C en el árbol real:** `encolarAltaTrasSellado()` tiene 1 llamada. El contador
  no está mudo cuando dice 0 de `procesarObligado`.
- **Cada expresión que Prisma recibe sin literal tiene que estar explicada por una puerta declarada**
  (`constancia.estado`, `avanzar(…)`, `d.estado`: 3 de 3). Si mañana aparece una cuarta, el campo sale
  CIEGO en vez de verde.
- **Visto en rojo, tres veces** (`rojos.txt`; se repite con `--romper`, no hay que editar nada):
  la siembra A metida en el `where`, 0 de 3 y salida 1; la siembra A sin escribir, «CIEGO» y salida 1;
  el control B sin quitar el escritor, 0 de 2 y salida 1.
- Rastro en el máster, por texto: «VfSubmission» sale en 3 líneas y «QuoteRequest» en 8 (positivos);
  una palabra fabricada, en 0.

## Lo que NO he medido

- **Ninguna base de datos.** No sé qué valores hay en las filas de ninguna de las tres tablas.
- **Las transiciones**, de ninguno de los tres. Los órdenes que cito (`RANGO`, las decisiones de la cola)
  los he leído, no los he ejecutado ni cotejado.
- **Si las ramas de `Merchant.status` son inalcanzables corriendo**: lo afirmo por lectura (nadie escribe
  otro valor), no por ejecución.
- **Si el aviso de Resend llega en producción** (que `RESEND_WEBHOOK_SECRET` esté puesto): la ruta está
  montada; si recibe algo, no lo sé. Tampoco el valor de `SIF_ENABLED`.
- **Las lecturas**, sólo por texto y sólo las que cito.
- **SQL crudo:** no lo he contado; me apoyo en el recuento de `jv-j2c` de esta mañana (16 usos, ninguno
  escribe tablas de estado) sin repetirlo.
- **Fuera de `src/`:** `scripts/` y `prisma/` tienen 12 escrituras de `merchant`, vistas por texto; ninguna
  línea pone un `status` de comercio. No pasaron por el AST. `procesarObligado` fuera de `src/` sólo sale
  en su test y en el fichero de declarados.
- El instrumento de SCRUM-1500d no lo he corrido, y de SCRUM-1500 sólo he leído `c.18908`.
- **La tanda completa** no se ha corrido: no hay código ni test nuevo. Sí los guards del registro (abajo).

## Lo que me salió mal

- **Leí la línea 404 del máster recortada a 900 caracteres** y la frase que decide («su diseño… vive en
  S1-D hasta que se construya») está más allá. Con media línea iba a recomendar que `VfSubmission` entrara
  con sus cinco valores. Lo vi al contar en qué líneas sale «VfSubmission» y encontrar la 404 entre ellas.
- **SCRUM-1500d ya había medido que a la cola no la vacía nadie**, y lo encontré al final, mirando los
  títulos del registro de SCRUM-1500, después de haberlo derivado por mi cuenta. El encargo avisaba
  exactamente de esto. No cambia el resultado; sí habría ahorrado una sonda.
- **Avisé del contexto a 211.374, no al cruzar 200.000.**

## Lo que pide el encargo → dónde se ve

| lo que pide | dónde se ve |
|---|---|
| qué valores existen hoy, derivando quién escribe y con qué | «La tabla» y «Campo por campo», punto 1; entero en `docs/master/evidencias/scrum1529b/tres-salida.txt` |
| qué fija la Parte L, o que no fija nada | «Campo por campo», punto 2: dos sin fijar, y la línea 404 para `VfSubmission` |
| dónde discrepan | «Campo por campo», punto 3 |
| ¿hay algún valor declarado que nadie escriba? | «Campo por campo», punto 4; control B |
| la pregunta en una frase y la recomendación | «Campo por campo», punto 5 |
| un positivo y un cero sembrados por campo, y visto en rojo | «Los controles»; `docs/master/evidencias/scrum1529b/rojos.txt` |
| las tres decisiones tomadas | NO HECHO → son del fundador |

Cómo se repite: `node docs/master/evidencias/scrum1529b/tres.cjs` (salida 0; menos de un minuto).

---

# SCRUM-1529c · Las diez decisiones, aplicadas a la Parte L del máster

**Medido contra:** `origin/main` = `f7a4c816ab2bf5c334a953dee60dc7b73718a0f8` · 2026-10-13T11:38:33Z (hora de GitHub)

A9: comprobación → `tests/scrum1500-el-cotejo-contra-el-master.test.mjs`

13-oct-2026 · sesión `jv-j3i` (equipo de Javier, carril de censos e instrumentos), por encargo del
orquestador (`cobroflash-backend-2e`).
[Escrito por la sesión, no por Javier. Leídos en Jira antes de tocar nada: SCRUM-1529 entero, con
`c.19299` (el permiso), `c.19228` y `c.19273` (las decisiones); y después `c.19305` y `c.19316`.]

El trabajo se empezó sobre `3bf6163bb5708e174af74ea2266412eab2f586be`. `main` avanzó hasta el sha del
ancla mientras se hacía: 0 cambios en el máster, en el instrumento de SCRUM-1500 y en su test.

## Qué se pidió

Aplicar a `docs/YAQU_MASTER.md`, Parte L, las diez decisiones de estado del fundador. Tocar el máster
es excepcional: el permiso es `c.19299` y sus límites mandan. Sólo las líneas que las decisiones
nombran; ninguna transición inventada; `VfSubmission` fuera y su línea 404 sin tocar; `ParteTrabajo`
sin `facturado`; nada en `src/`, en el esquema ni en texto que vea el usuario.

## Lo primero: quién cita el máster por número de línea

Sobre 6.161 ficheros seguidos por git (6.161 leídos, 0 ilegibles):

- **177 citas** `YAQU_MASTER.md:<n>` en 45 ficheros.
- **91 de ellas, en 32 ficheros, apuntan por debajo de la línea 397.** Una está en
  `src/modules/fiscal/verifactu/registro.builder.ts` (camino de emisión: no se puede corregir aquí), y
  `tests/scrum525d-anclas-que-apuntan.test.mjs` tiene un control que cae al mover un ancla una línea.
- Control de cero: una cita a una línea que no existe (`:9824`) sale 0 veces.

**Decisión: no se añade NINGUNA línea.** El máster tiene 1.905 líneas antes y después. Las cuatro
entidades que entran nuevas van juntas en la línea 397, que estaba en blanco entre el título de la
Parte L y la línea de `Quote`. El coste, declarado: cuatro entidades comparten línea y quedan por
delante de `Quote`. Al pintarse es el mismo párrafo que ya formaban las líneas 398 a 409.

NO medido: las citas con otra forma («línea 404 del máster»). El patrón sólo ve `YAQU_MASTER.md:<n>`.

## Lo que dice ahora la Parte L

| decisión | línea | qué dice ahora |
|---|---|---|
| ① `QuoteRequest` | 401 | la lista es `pending → read → done`. Lo que decía queda citado entre « » con su fecha, y declarada la distinción que se pierde (`done` no dice por qué terminó) |
| ② `ParteTrabajo.estado` | 397 | `borrador` y `firmado`, sin flechas y SIN `facturado`, con el porqué |
| ③ `TeamMember.status` | 397 | `invited`, `active`, `suspended`, sin flechas |
| ④ `Quote` | 398 | gana `pending_approval` como valor, sin flechas. La máquina que había no se toca |
| ⑤ `Invoice` | 399 | gana `expired` como valor, sin flechas |
| ⑥a `Charge` | 400 | ganan `failed` y `expired`, sin flechas |
| ⑥b `Charge` | 400 | `pending → cancelled` se queda; dice que hoy nadie lo escribe y que construirlo es STOP con GO propio |
| ⑦ `WhatsAppMessage` | 403 | gana `received` para los entrantes, sin flechas |
| ⑧ `Merchant.status` | 397 | `active` |
| ⑨ `EmailMessage.status` | 397 | sus seis valores, copiados de Jira `c.19233`, sin flechas |
| ⑩ `VfSubmission` | 404 | NO entra. La línea 404 es idéntica byte a byte |

Cada línea tocada conserva entero el texto que tenía y lleva al final una nota fechada
(«13-oct-2026, SCRUM-1529c») con el número de la decisión y el del permiso. Es la misma forma que ya
usaba la línea 404.

Lo que NO se ha escrito, a propósito:

- **Ninguna flecha nueva.** Tampoco la de `ParteTrabajo` (`borrador → firmado`): la decisión ② dice
  que entra su máquina, pero las transiciones no las ha medido nadie y no las he medido yo.
- **La tabla `WhatsAppMessage` de la Parte J (línea 309)** repite la lista de los salientes y no lleva
  `received`. No se ha tocado: el permiso cubre sólo la Parte L. La línea 403 lo dice.

## Comprobado por efecto

`node docs/master/evidencias/scrum1529c/aplicado.cjs` (salida 0; entera en `aplicado-salida.txt`).
Compara el máster del árbol con el de la base, leyendo las líneas:

- cambian las líneas 397, 398, 399, 400, 401 y 403, y ninguna más;
- **un positivo y un cero por decisión: 10 de 10** (el valor nuevo está en su línea; lo que no tenía
  que entrar —`facturado` en la lista del parte, una flecha en las listas sin flechas— no está);
- 11 líneas vigiladas idénticas, entre ellas la 404 y la 309;
- citas que ahora apuntan a otro texto sin ser de una línea tocada: 0. Citas a una línea tocada: 2
  (`docs/master/SCRUM-1513.md` a la 403 y `docs/master/SCRUM-534.md` a la 401), y en las dos sigue
  estando lo que citaban;
- **el control del instrumento:** las mismas preguntas sobre el máster de la base cumplen 1 de 10, y
  es la ⑥b, que es «se queda». Si la base cumpliera más, el instrumento diría CIEGO y saldría con 2.

## El guard de SCRUM-1500, que cayó, y lo que se hizo con él

Con sólo el máster cambiado, `tests/scrum1500-el-cotejo-contra-el-master.test.mjs` caía: 13 casos, 7
pasaban y 6 no. El instrumento nombraba sus tres «parados», y la propia entrada de cada uno mandaba
retirarla «en ese mismo PR» que aplicara la decisión. El permiso `c.19299` decía «sólo el máster», así
que **se paró y se preguntó** (`c.19303`) antes de tocar nada.

Lo autorizado y lo hecho:

- **`c.19305` (orquestador):** se puede editar `docs/master/evidencias/scrum1500/cotejo.cjs` y su test,
  porque es consecuencia mecánica del trabajo autorizado. Con el límite de la regla 41: si el arreglo
  baja lo que el instrumento exige, se para.
- **`c.19316` (fundador, opción A):** una excepción nueva y declarada para `ParteTrabajo.estado`, y
  ticket aparte para quitar `facturado` del código. Ese ticket es **SCRUM-1535**.

| campo | antes | ahora |
|---|---|---|
| `QuoteRequest.status` | parado: el código tenía tres valores y el máster otros cuatro | coincide con el máster; excepción BORRADA |
| `TeamMember.status` | parado: el máster no traía su lista | con ancla en la 397; coincide; excepción BORRADA |
| `ParteTrabajo.estado` | parado: el máster no nombraba la entidad | con ancla en la 397; el cotejo ve «el código tiene `facturado` y el máster no»; excepción NUEVA, puente hasta SCRUM-1535 |

**¿Mide ahora más o menos?** Más. Antes cotejaba 7 campos contra el máster y dejaba 3 parados; ahora
coteja 9 y deja 1. Y el que queda ya no está «sin lista»: tiene su lista del máster congelada en la
excepción, así que si alguien le mete `facturado` al máster, o el código gana otro estado, cae.

La excepción nueva lleva dentro lo que `c.19316` exige: el motivo (`facturado` declarado en
`parteTrabajo.ts:78`, ninguna línea de `src/` lo escribe, y por la decisión ② no entra en el máster),
quién la retira y cuándo (quien cierre SCRUM-1535, en ese mismo PR, y el cotejo tiene que seguir verde
sin ella) y el número del ticket. El instrumento imprime esa frase en cada pasada.

El test pasa de 13 a 14 casos, 14 de 14:

- «los tres parados» pasa a ser «el parado»: sin su excepción cae él, y sólo él. Y la lista de
  excepciones queda fijada a ese único campo: una entrada nueva pone el test en rojo.
- un caso NUEVO para los dos que salieron: coinciden, y si a su lista del máster se le quita un valor
  caen por su nombre, sin excepción que los tape.
- el caso de «la excepción cubre lo decidido y nada más» se rehízo sobre la excepción que queda.
- el mecanismo «una línea nueva que junta los valores cae» ya no tiene un parado real sin ancla: se
  conserva probado con la tabla y la excepción de antes, fabricadas dentro del test.

**Visto en rojo, sobre el fichero y no en memoria:** con `facturado` añadido a la lista del parte en
el máster (`git diff --numstat` 1 1), el test cae 7 de 14, salida 1. Restaurado con
`git restore --source=HEAD`; árbol limpio y `aplicado.cjs` otra vez en 0.

## Lo que NO he medido

- Ninguna base de datos. Ningún valor del código: los tomo de `c.19222` y `c.19233` (los instrumentos
  `scrum1529/siete.cjs` y `scrum1529b/tres.cjs` no los he vuelto a correr).
- Las transiciones de ninguno de los diez.
- `docs/master/evidencias/scrum1500c/cotejo-once.cjs` (no está en la tanda): lee sólo las listas con
  flecha, así que no verá los valores que entran sin ella. No lo he corrido ni tocado.
- «Ninguna línea de `src/` escribe `facturado`» es de `c.19222`. El cotejo de SCRUM-1500 no puede
  afirmarlo: sólo ve escrituras con literal, y tampoco ve la de `firmado`. El test sujeta lo que sí
  puede: que no aparezca una escritura literal de `facturado`.
- La tanda completa no se corrió. Corridos: el guard de SCRUM-1500 y los del registro (abajo).
- Cómo se pinta la línea 397 en un visor de Markdown: razonado, no visto.

## Lo que me salió mal

- **Mi instrumento dijo CIEGO en su primera pasada, y era un error mío.** Para la ⑥b exigía que
  `cancelled` saliera suelto entre comillas, cosa que sólo pasa en mi texto nuevo; la base no lo
  cumplía y el control no cuadraba. Corregido antes del primer commit.
- Un rótulo del mismo instrumento decía «3 líneas del tramo» contando el fichero entero. Corregido.
- En el test escribí que el cotejo veía `facturado` como el ÚNICO valor declarado y sin escribir. Ve
  dos: tampoco ve la escritura de `firmado`. Lo dijo el rojo; la aserción ahora afirma sólo lo que el
  instrumento puede ver.
- Avisé del contexto a 213.341, no al cruzar 200.000.

**La lección, y por qué la línea A9 apunta a un test:** el permiso decía «sólo el máster» y eso no se
podía cumplir, porque el guard de SCRUM-1500 ata el máster a sus excepciones. No lo paró ninguna nota:
lo paró el guard, cayendo con el nombre de cada excepción y diciendo quién la retira. Es la
comprobación que ya existía y que volvería a parar a la siguiente sesión.

## Lo que pide el encargo → dónde se ve

| lo que pide | dónde se ve |
|---|---|
| las diez decisiones en la Parte L | `docs/YAQU_MASTER.md`, líneas 397 a 401 y 403 |
| sólo las líneas que las decisiones nombran | `docs/master/evidencias/scrum1529c/aplicado-salida.txt`, apartado ① |
| ninguna transición inventada; `VfSubmission` fuera; `ParteTrabajo` sin `facturado` | el mismo fichero, apartados ② y ③ |
| medir quién cita el máster antes de añadir una línea, y declarar la decisión | arriba, «Lo primero»; el mismo fichero, apartado ④ |
| constancia de qué cambió y cuándo | la nota fechada al final de cada línea tocada |
| positivo que tiene que aparecer y cero derivado | `docs/master/evidencias/scrum1529c/aplicado.cjs` |
| guards del registro y del máster | `tests/scrum1500-el-cotejo-contra-el-master.test.mjs` (14 de 14) |
| quitar `facturado` del código | NO HECHO → SCRUM-1535, con su propio GO |
