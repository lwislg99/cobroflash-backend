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
