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
