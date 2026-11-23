# SCRUM-1532 · Cancelar un cobro: qué haría falta, medido sin construir nada

**Medido contra:** `origin/main` = `9226d0f2dd48f885b63b3222441f57554a7cdb1c` · 2026-10-13T07:23:51Z

A9: comprobación → `docs/master/evidencias/scrum1532/puertas.cjs`

13-oct-2026 · sesión `jv-j2d` (equipo de Javier, carril de clientes y cobros), por encargo del
orquestador (`cobroflash-backend-2e`). [Escrito por la sesión, no por Javier.] Leídos en Jira:
SCRUM-1532 entero (0 comentarios) y SCRUM-1529 `c.19222`, `c.19225`, `c.19227` y `c.19228`.

**No se ha tocado `src/`, `prisma/schema.prisma`, el máster, `public/` ni ningún test.** Este PR lleva
sólo este registro y `docs/master/evidencias/scrum1532/`. No se ha decidido nada: se mide y se propone.

## La respuesta corta

Cancelar un cobro **no es poner una palabra en una columna.** Medido leyendo el código (sin ejecutar
ninguna ruta y sin mirar ninguna base ni pasarela): hoy, si un cobro pasara a `cancelled`,

- **tres de las seis páginas públicas de pago seguirían abiertas** (selector, Bizum y Mercado Pago), y
  la de transferencia no mira el estado nunca;
- **una sesión de tarjeta ya abierta en Stripe seguiría viva**, y si el cliente paga en ella el cobro
  cancelado pasa a `paid`: la escritura que marca pagado no mira el estado anterior
  (`psp.routes.ts:136`, `where: { id }`);
- **el recordatorio de los 7 y los 14 días saldría igual**, con su botón de pagar, porque cuelga de la
  FACTURA y no del cobro (`invoiceReminder.service.ts:43`);
- **reenviar la factura mandaría el mismo enlace cancelado**, porque el cobro de una factura se
  reutiliza sin mirar su estado (`invoiceWhatsApp.service.ts:56`);
- y el recibo público diría **«Pago pendiente»** (`receipt.routes.ts:267`: un estado que no conoce cae
  al de pendiente).

**Y lo mismo les pasa HOY a `expired` y a `failed`**, que sí existen (apartado 5). Lo que el fundador
pide construir para `cancelled` es, en su mayor parte, lo que les falta a esos dos.

## 1 · Qué hay enganchado a un cobro pendiente

Un cobro `pending` nace en un solo sitio: `POST /charges` (`charges.routes.ts:53`), y a esa ruta la
llama un solo código, el envío de la factura por WhatsApp (`invoiceWhatsApp.service.ts:67`), y sólo si
la factura no tiene ya un cobro. De él cuelga:

| qué | dónde vive | ¿se apaga solo si el cobro deja de estar `pending`? |
| --- | --- | --- |
| El enlace público (`receiptToken`), el mismo para las seis páginas | `Charge.receiptToken` | depende de cada página: fila siguiente |
| `/pay/invoice/:t` (selector) | `payInvoice.routes.ts:32` | **NO**: cierra sólo `paid` y `expired` |
| `/pay/card/:t` | `payCard.routes.ts:25` | SÍ: exige `pending` |
| `/pay/bizum/:t` (enseña el teléfono del profesional) | `payBizum.routes.ts:138` | **NO**: cierra sólo `paid` y `expired` |
| `/pay/bizum/:t/claimed` («ya te he pagado») | `payBizum.routes.ts:184` | SÍ: exige `pending` |
| `/pay/bank/:t` (enseña el IBAN) | `payBank.routes.ts:27` | **NO mira el estado nunca**, tampoco en un cobro pagado |
| `/pay/mp/:t` (crea o reutiliza la preferencia) | `payMp.routes.ts:26-27` | **NO**: cierra sólo `paid` y `expired` |
| `/recibo/:t` | `receipt.routes.ts:208-228`, `:267` | pinta `pending`, `paid`, `failed`, `expired`; cualquier otro sale como «Pago pendiente», sin mensaje y sin botones |
| Sesión de Stripe Checkout | se crea una NUEVA en cada visita a `/pay/card` (`payCard.routes.ts:102`); su id sólo queda en un `Event` `card_session_created` (`:107`) | **NO**: en `src/` hay 0 llamadas a `sessions.expire` y la sesión se crea sin caducidad propia. Si se paga, llega a `psp.routes.ts:136` |
| Preferencia de Mercado Pago | `Charge.intentId` = `mp_pref_…` (`payMp.routes.ts:62`) | **NO**: se crea sin caducidad (`integrations/mercadopago.ts`); un `approved` marca pagado si el cobro no lo estaba (`mpWebhook.routes.ts:104`) |
| Confirmar Bizum (el profesional) | `chargesAdmin.routes.ts:54` | SÍ: 409 si no está `pending` |
| Recordatorio de 7 y 14 días (cron diario, 10:00) | `invoiceReminder.service.ts:43`, `:64` | **NO**: filtra por `Invoice.status = 'pending'` y manda el enlace del cobro de la factura sin leer su estado (`:139`) |
| Reenvío de la factura por WhatsApp | `invoiceWhatsApp.service.ts:56` | **NO**: reutiliza `invoice.chargeId` tal cual |
| Botón de pagar del portal del cliente | `customerPortal.routes.ts:308`, `:416` | **NO**: mira `inv.status`, no el del cobro |
| El bot de WhatsApp («tienes pagos pendientes») | `botFlow.service.ts:573` | SÍ: consulta `status: 'pending'` |
| Deuda en la pantalla Cobros | `cobros.service.ts:199` (`ESTADOS_DEUDA = ['pending']`) | SÍ en el importe; la fila sigue, sin nada que diga en qué estado está |
| Los WhatsApp ya enviados con el enlace | fuera del sistema | no se pueden retirar: sólo se puede cerrar la página a la que llevan |

No hay ningún cron sobre cobros (los seis de `core/cron/cron.ts` son de presupuestos, facturas,
mantenimientos, resumen, correos y sellos). `Charge.expiresAt` se escribe al crear y **no lo lee
nadie** en `src/`; además el único que crea cobros no lo manda, así que nace vacío.

## 2 · Quién escribe el estado de un cobro (las puertas, no la palabra)

40 llamadas sobre el delegado de cobros, 11 escriben. De las 11, las que tocan el estado:

| puerta | de qué estado | a cuál | cómo entra el valor |
| --- | --- | --- | --- |
| `charges.routes.ts:53` | (nace) | `pending` | literal |
| `chargesAdmin.routes.ts:194` | (nace) | pagado | fábrica `datosDeCobroPagado` |
| `psp.routes.ts:136` | **cualquiera que no sea `paid`** | pagado | fábrica; `where: { id }`, sin estado |
| `psp.routes.ts:390` | `pending`, `failed`, `expired` | `failed` o `expired` | variable; la lista va DENTRO del `where` |
| `mpWebhook.routes.ts:108` | cualquiera que no sea `paid` | pagado | fábrica; la condición es un `if`, no el `where` |
| `mpWebhook.routes.ts:256` | `pending` | `failed` | literal; la condición es un `if`, no el `where` |

Las otras cinco escriben otras columnas (token, preferencia, garantía, cliente al fusionar). 0
escrituras anidadas desde otro modelo, 0 SQL crudo sobre `charges` (de 13 usos de SQL crudo en `src/`).
La fábrica `datosDeCobroPagado` (`instanteDeCobro.ts`) **no la abrí**: que escribe `paid` lo tomo de
sus tres llamadas, de sus comentarios y de `c.19222`.

**Nadie vuelve a escribir `pending`:** un cobro `failed` o `expired` no vuelve a ser cobrable más que
pagándose.

## 3 · Quién LEE el estado

44 lecturas tipadas de `Charge.status` (39 sobre el modelo entero, 5 sobre cobros traídos con
`select`), más 1 hallada a mano bajo un tipo escrito a mano (`cobros.service.ts:288`). Sin juzgar: 25
accesos `.status` sobre algo tipado `any` y 87 sobre tipos que no son de Prisma; de éstos leí a mano
nueve ficheros de cobro y sólo salió esa. `public/` no lo mira este instrumento.

Lo que decide cómo se portaría un estado nuevo es si el lector pregunta «¿es `pending`?» (lista de SÍ:
un estado nuevo queda cerrado) o «¿es `paid` o `expired`?» (lista de NO: queda abierto). La casa ya
eligió la primera forma a propósito en `estadoDelCobro.ts`, y por eso un `cancelled` **quedaría ya
protegido de los avisos de fallo y caducidad sin tocar nada**. No lo estaría del aviso de pago.

## 4 · Los cinco puntos del ticket

**① Quién.** Todo `/admin/charges/*` es sólo del administrador desde el montaje (`app.ts:617`), y
anular una factura también (`invoicesAdmin.routes.ts:872`). Ningún cron ni proceso toca cobros: «el
sistema al expirar» no existe hoy. Propuesta: el administrador; lo demás sería nuevo.

**② Desde dónde.** No existe ficha de cobro (lo dice `cobrosView.js:612`) y la pantalla Cobros no
tiene acciones por fila. La única acción sobre un cobro, «Confirmar Bizum», vive en el detalle de la
factura (`invoiceDetailView.js:576`) y en el del trabajo (`jobDetailView.js:2224`). **Hay que inventar
el control**, y eso es texto de usuario (regla 39): como mínimo el botón, su confirmación, y lo que
dice el recibo público de un cobro cancelado (hoy diría «Pago pendiente»). No redacto ninguno.

**③ El dinero.** Apartado 1. Lo que no se apaga solo: tres páginas de pago, la de transferencia, la
sesión de Stripe, la preferencia de Mercado Pago, el recordatorio, el reenvío y el portal.

**④ Transiciones.** El máster dice `pending → cancelled` y nada más. Propongo esa y sólo esa. Cancelar
desde `failed` o `expired` no está en el máster: sería cambio de máster. Quedan dos decisiones que no
son mías: **qué pasa si entra dinero en un cobro cancelado** (hoy pasaría a pagado) y **qué le pasa a
la factura**, que sigue `pending` con ese cobro colgando.

**⑤ Qué se parece.** Anular factura (`invoicesAdmin.routes.ts:872-1003`): sólo administrador,
idempotente, sólo desde `pending`, motivo de una lista cerrada, el estado dentro del `where` y
constancia en la auditoría. Y `estadoDelCobro.ts`: dos barreras, lista de los que sí. Para la cara
pública, `expired` es el molde: estado no pagable con su mensaje en el recibo.

## 5 · Lo que ya pasa hoy con `expired`, `failed` y la factura anulada

Leído, **no ejecutado**, y sin saber qué avisos tiene Stripe configurados para llegar (eso no está en
el repositorio):

- **`expired` llega solo.** Si el cliente abre el pago con tarjeta y no paga, el aviso de sesión
  caducada (`stripe.routes.ts:209`) deja el cobro `expired`. Desde ahí el enlace de esa factura queda
  muerto para siempre: el reenvío y los dos recordatorios mandan el mismo.
- **`failed` deja al profesional sin poder confirmar un Bizum:** una tarjeta rechazada
  (`stripe.routes.ts:144`, `connectWebhook.routes.ts:123`) deja el cobro `failed`, y «Confirmar Bizum»
  contesta 409 a todo lo que no sea `pending`.
- **Anular una factura no toca su cobro** (`invoicesAdmin.routes.ts:951` escribe sólo la factura). Esto
  ya está descrito en `docs/master/SCRUM-502.md`, que protegió la FACTURA; el cobro sigue pagable.
- En la pantalla Cobros, un cobro `failed` o `expired` sale con la columna «sin cobrar» vacía, igual
  que uno cobrado (leído en `cobrosView.js:413`; no visto en navegador).

## 6 · Donde el encargo no cuadra con lo medido

1. **El recordatorio no cuelga del cobro, cuelga de la factura.** Cancelar el cobro no puede apagarlo
   sin decidir antes qué pasa con la factura. Es la pregunta de diseño que manda sobre las demás.
2. **«Nadie lee `cancelled`» es cierto del cobro, y aun así la palabra está en `src/`:**
   `mpWebhook.routes.ts:255` lee `cancelled` como estado de un pago de MERCADO PAGO y lo traduce a
   `failed`. Quien busque la palabra la encuentra y no es lo que busca.
3. **No es un estado, son tres:** el apartado 5.
4. El ticket no lleva etiquetas de equipo ni de área ni «Aceptación»; no lo he tocado (A13).

## Los controles

`node docs/master/evidencias/scrum1532/puertas.cjs` (salida 0; su salida, en `puertas-salida.txt`).
Población: 322 ficheros `.ts` de `src/`, 0 sin parsear, cliente de Prisma resuelto.

- **Siembra en memoria** (un fichero que no se escribe en disco) con una escritura fabricada por cada
  forma: literal, fábrica esparcida, delegado por corchete, anidada desde otro modelo, SQL crudo,
  delegado suelto; y tres lecturas (modelo entero, `select`, relación con `select`). Las 9 salen cada
  una en su sonda. **Cero derivado:** el árbol real da 0 apariciones de `zz1532`, y dos lecturas
  sembradas del estado de una FACTURA no salen como de cobro.
- **Visto en rojo:** la primera versión de la sonda de lecturas no veía los cobros traídos con
  `select`; al sembrar esa forma, dos positivos cayeron y la salida fue 1. Y `--sin-siembra` dice
  CIEGO y sale 1.
- **Dos sondas distintas se cruzaron:** la de forma listó `quote.charge.status` (`jobs.routes.ts:767`)
  y la de tipos no; esa discrepancia fue lo que destapó el punto ciego.
- Un recuento por texto daba 41 llamadas y el AST 40: la que sobra es un comentario
  (`charges.routes.ts:112`).

## Lo que NO he medido

Ninguna base de datos (ni cuántos cobros hay en cada estado, ni si existe alguno `failed` o
`expired`). Ninguna pasarela: ni qué avisos manda Stripe a producción, ni cuánto vive una sesión de
Stripe o una preferencia de Mercado Pago. Ninguna ruta ejecutada: todo es lectura. `public/` sólo a
mano y sólo en cuatro ficheros. La fábrica `datosDeCobroPagado`, sin abrir. Las lecturas por
desestructuración. Quién escribe `Quote.chargeId` (no encontré a nadie y no lo perseguí). La tanda
completa no se corrió: no hay código ni test nuevo.

## Lo que me salió mal

- La sonda de lecturas nació ciega a `select` y su control no lo cazaba, porque sólo sembraba la forma
  que ya veía. La comprobación es la siembra de las dos formas que faltaban, en el propio instrumento.
- Crucé los 200.000 de contexto sin avisar: me medí por primera vez a 288.675. Es el mismo tropiezo que
  `jv-j2c` esta mañana, y no lo puedo convertir en comprobación desde este carril.
- Un parche por consola no casó y lo rehice con la herramienta de edición.

| lo que pide el ticket | dónde se ve |
| --- | --- |
| ① quién debería poder cancelar | apartado 4 ① |
| ② desde dónde | apartado 4 ② |
| ③ qué pasa con el dinero | apartados 1 y 5 |
| ④ qué transiciones | apartados 2 y 4 ④ |
| ⑤ qué existe que se parezca | apartado 4 ⑤ |
| un positivo y un cero derivado | «Los controles» y `docs/master/evidencias/scrum1532/puertas-salida.txt` |
| construir la cancelación | NO HECHO → pide GO del fundador y dos decisiones suyas (apartado 4 ④) |

# SCRUM-1532b · Cancelar un cobro: la ruta, el recibo y las páginas públicas

**Medido contra:** `origin/main` = `4aeac0f6c1f5a63b97b009a1c1b3ebc93c973e3e` · 2026-11-23T21:04:07Z

A9: comprobación → `tests/scrum1532b-cancelar-cobro.test.mjs`
Mutaciones: catálogo → `tests/scrum1532b-cancelar-cobro.test.mjs`

23-nov-2026 · sesión `jv-j2ea` (J2). GO, dos decisiones y tres textos firmados: SCRUM-1532 `c.22430`;
auditoría y vista: `c.22435`. [Escrito por la sesión, no por Javier.]

**Qué entra.** `POST /admin/charges/:id/cancel` (`chargesAdmin.routes.ts`): sólo administrador, sólo
desde `pending`, idempotente (`cancelled` → 200 `yaEstaba`), 409 `charge_not_pending` desde cualquier
otro estado, `pending` y el comercio DENTRO del `where` (P2025 → el mismo 409), no toca la factura ni
crea `Event` (el recibo pinta los tipos de evento: sería texto sin firma). El recibo de un cobro
`cancelled` dice `Este cobro se ha cancelado.` y no ofrece pagar (antes caía a «Pago pendiente»).
`/pay/invoice`, `/pay/bizum`, `/pay/bank` y `/pay/mp` mandan un cobro cancelado al recibo.

**Decisiones de c.22430, medidas:** ① un `payment.confirmed` sobre un cobro `cancelled` lo deja
pagado, como hoy (`psp.routes.ts` no mira el estado anterior); no hace falta aviso nuevo para que
ocurra. ② cancelar no escribe la factura: se queda pendiente. ⚠️ **Pero «el profesional puede crear
otro cobro» NO se cumple hoy:** el reenvío reutiliza `invoice.chargeId` sin mirar su estado
(`invoiceWhatsApp.service.ts:56`, carril J1), así que mandaría el enlace cancelado. Cambiar la
factura para soltar el cobro sería editar una factura emitida (regla 29): no lo hago.

**Lo que NO entra:** la fila de auditoría (clave `cobro_cancelado` aprobada en c.22435, la añade S1 en
`audit.service.ts`; el test la declara como falta y cae cuando exista → 1532c); el botón y su
confirmación (`invoiceDetailView.js` es de J1, `jobDetailView.js` de S2); el recordatorio de 7/14
días y el portal, que miran la factura (§1). Sin capturas: lo único visual de J2 es el recibo y no me
cupo en contexto. La suite entera no se corrió en local: la corre el obligatorio.

| aceptación (c.22430) | dónde se ve |
| --- | --- |
| GO: única transición `pending → cancelled`; `failed`/`expired` no | `tests/scrum1532b-cancelar-cobro.test.mjs` (① desde `pending`; 409 desde `paid`, `failed`, `expired`) |
| idempotente, estado en el `where` | mismo test (idempotente; P2025; mutación del `where` lo tumba) |
| decisión 1: dinero en un cobro cancelado → pagado | mismo test (④ decisión 1) |
| decisión 2: la factura se queda pendiente | mismo test (④ decisión 2) · «crear otro cobro»: NO HECHO → J1 (`invoiceWhatsApp.service.ts:56`) |
| botón `Cancelar cobro` y su confirmación | NO HECHO → J1 (`invoiceDetailView.js`) y S2 (`jobDetailView.js`) |
| recibo `Este cobro se ha cancelado.` | mismo test (③ recibo; mutación lo tumba) |
| auditoría | NO HECHO → 1532c, tras la clave de S1 (caso «FALTA DECLARADA») |

**Lo que me salió mal:** declaré la mutación del `where` con un `cae` que no era subcadena del nombre
del test y `aplicarUna` la dio CIEGA; corregido y repetido (las dos tumban). Y crucé el tope de
contexto del encargo (190k) sin dejar la vista traspasada a tiempo: me medí a 188.918.

# SCRUM-1532d · Cancelar un cobro: el botón en la ficha de factura y el reenvío con cobro cancelado

**Medido contra:** `origin/main` = `27656eae71e62369a5e87f27ae40e82e5764211d` · 2026-11-23T21:36:19Z

A9: comprobación → `tests/scrum1532d-cancelar-cobro-ficha-y-reenvio.test.mjs`
**Skill UI:** cargada

23-nov-2026 · sesión `jv-j1ik` (J1). GO, decisiones y literales: SCRUM-1532 `c.22430`; reparto: `c.22435`;
la ruta de J2: `c.22441` (rama `scrum-1532b-cancelar-cobro`, fusionada en esta). [Escrito por la sesión, no por Javier.]

**Qué entra.**
- Ficha de factura (`invoiceDetailView.js`): `Cancelar cobro` en el «⋯», SOLO con la factura `pending` y su
  cobro `pending`; pide `¿Cancelar este cobro? El cliente ya no podrá pagarlo con este enlace.` y llama a
  `POST /admin/charges/:id/cancel`. Tras cancelar, la ficha se repinta y el botón ya no está. Registro de
  acciones: `btnCancelarCobro` (overflow en `pending`, oculta en el resto).
- `GET /admin/invoices/:id` lleva `estadoDelCobro` (solo lectura, `findFirst` con `merchantId`, regla 2).
- Reenvío (`invoiceWhatsApp.service.ts`): si el cobro de la factura está `cancelled`, crea OTRO y la factura
  apunta al nuevo (decisión 2). Con `pending`, `paid`, `expired` o `failed`, como hoy (reutiliza). La escritura
  `invoice.update({ chargeId })` es la que ya existía para una factura sin cobro: no se añade ninguna.
- `scrum283-censo-acciones-factura` (9 → 10) y `scrum283-microcopy-marcador` (rótulo aprobado): una acción
  nueva es una decisión, y está firmada en `c.22430`. Se cambia el VALOR esperado; los nombres de los tests no.

**Textos.** Solo los firmados. Los errores reutilizan dos que la ficha ya pinta: `Este cobro ya no está
pendiente.` (409) y `Error actualizando estado: inténtalo de nuevo` (el resto).

| aceptación (c.22430 / encargo) | dónde se ve |
| --- | --- |
| botón `Cancelar cobro` SOLO con el cobro `pending` | `tests/scrum1532d-cancelar-cobro-ficha-y-reenvio.test.mjs` ① · capturas `evidencias/scrum1532/1532d-menu-con-cancelar-{escritorio,movil}.png` |
| confirmación literal y llamada a la ruta | mismo test ① · guion `evidencias/scrum1532/capturas-1532d.js` (exige el diálogo literal y el POST) |
| tras cancelar, la ficha refleja el estado | el botón desaparece: `1532d-menu-tras-cancelar-{escritorio,movil}.png`. **Sin texto nuevo:** la ficha no pinta nada propio para un cobro no vivo (tampoco hoy para `expired`/`failed`); el bloque «Cobro» sigue con su importe. NO HECHO → pregunta al fundador |
| decisión 2: «puede crear otro cobro» (reenvío) | mismo test ② |
| con cobro `pending` el reenvío reutiliza, como hoy | mismo test ② control |

**Medido:** test nuevo 8/8 (visto ROJO antes: 5 de 8; los 3 verdes eran los controles de «como hoy») ·
dirigida corta 115 casos (1532d, 1532b, 1787b, 1787p, 1514, 1304, 283×3, 1773, 878, 1185): 113/115 con los
dos de 283 en rojo, arreglados arriba; repetidos con 402 y 412: 43/43, 0 saltados · `tsc -p .` con tipos,
salida 0 · capturas a 1280 y 390, miradas.
**No medido:** las mutaciones (declaradas en `MUTACIONES_QUE_ME_TUMBAN`, NO corridas con `aplicarUna`: no
cupo en contexto; las juzga el meta-guard de CI) · la dirigida larga del encargo (836, 700, 710b, 719,
1157/1215/1415, 810, 1294, 267, 273, 525d, 854) salvo lo que corra `guards:entrada` · la suite entera (la
corre el obligatorio) · yaqu.app.

**Lo que me salió mal:** crucé 190k (el tope del encargo) y 200k antes de cerrar: avisé a 202.740.
Mi primer banco de la vista no veía el «⋯» (sus acciones se pintan al abrirlo) y daba «no se pinta» en
verde por vacío; lo cazó el caso positivo, y el test ahora abre el menú y exige ver «Ver la reclamación del banco».
