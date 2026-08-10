# SCRUM-308 · CARACTERIZACIÓN-RECTIFY: qué hace HOY POST /rectify, para que un cambio se vea

**Fecha:** 4-ago-2026 · **Carril:** B (QA/caracterización) · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `eebc191dc75da0040f4934ccd8b92cc857726832` · 2026-08-04T23:18:48+01:00

> ⚠️ Esa hora es el **committer date del primer commit del trabajo** (`a449e06`), no una lectura de
> reloj — el ancla apunta al árbol contra el que se midió (R14, como SCRUM-252/267/299).

## Por qué (medido en SCRUM-308, no supuesto)
Una ruta de emisión fiscal —`POST /admin/invoices/:id/rectify`, con huella VeriFactu encadenada
detrás— **sin un solo test que diga qué hace**: 0 tests demostraban que /rectify FUNCIONA sobre
`pending` o `paid`, 0 rectificaban una `annulled`, y el único test de la ruta (`scrum263:207`)
asserta un 409 por falta de líneas. **Autorización del fundador:** «escribe los tests, SOLO los
tests, NO se toca /rectify (regla 38). Caracterizar el comportamiento actual de una ruta fiscal es
lo más seguro que se le puede hacer; cambiarla sin tests, lo más peligroso.»

## Qué caracterizan (el PRESENTE, no un juicio)
- **ÉXITO (los que faltaban, primero):** R1 sobre `pending` → **201**; R1 sobre `paid` → **201**.
  Sin ellos, cualquier bloqueo futuro se construiría a ciegas y nadie cazaría un «lo bloqueaste todo»
  (la mordida de SCRUM-260).
- **⚠️ EL CASO QUE NADIE ESCRIBIÓ — R1 sobre `annulled` → HOY EMITE (201).** `/rectify` **no mira
  `status`**: es CIEGO al estado. El test dice lo que hace hoy, marcado **EN DISCUSIÓN** (SCRUM-308
  propone bloquearlo: dos registros contradictorios encadenados en VeriFactu, regla 29 = no se
  deshace). NO está bendecido; cuando se decida el bloqueo, ese test cambiará su expectativa — y que
  cambie es la señal de que el comportamiento cambió.
- **Los 3 cortes que sí existen (para que consten):** `type==='R1'` → 409 `cannot_rectify_rectification`
  · `already_rectified` → 409 · `isReceiptNumber` (J-) → 409 `cannot_rectify_receipt`. + `invalid_id`
  → 400 · `not_found` → 404.

## Cómo (patrón de SCRUM-263, sin BD ni turno)
Router REAL del `dist`, handler de negocio invocado con un `res` de doble y `prisma` SUSTITUIDO
(mutando el objeto exportado, que es al que apuntan los `const { prisma }` ya cargados). **El 201 es
REAL:** el doble se completó hasta que el handler llega a su respuesta — incluida la `auditLog` de la
tx, porque `allocateInvoiceNumber` AUDITA la reserva del número dentro de la misma transacción
(SCRUM-207); un doble incompleto habría dado 500 y **mentido sobre lo que hace /rectify** (el SUELO
que el fundador marcó como el peor caso). Merchant NO-ES a propósito: `getEmissionMode='fiscal'`
emite sin depender del flag ni entrar en la cadena VeriFactu, así el doble es mínimo y el test mira
el ESTADO, no el modo. `t.after` restaura `prisma`: no ensucia a otros tests del proceso.

## Rojo por el mecanismo
Rota a mano la guarda `type==='R1'` **en el `dist`** (artefacto de build, NO la fuente `.ts` — regla
38 intacta) → cae **solo** el test del corte `type==='R1'` nombrándolo (`cannot_rectify_rectification`),
los otros siguen verdes: el test es específico de esa guarda, no un 409 en bloque. Restaurado con
`npm run build` desde la fuente intacta; 7/7 verde.

## 🔴 Límite reportado (lo que este doble NO hace)
El doble **PRESENTA** una factura con `status:'annulled'`; **NO la CONDUCE** a anulada por la ruta
`/annul` contra una BD real. La secuencia real **anular→rectificar** —que es la que produciría el
incidente en producción— necesita **gateado** (turno de staging), y es otra conversación. Que ningún
test conduzca a `annulled` de verdad es, además, la razón medida de que nadie viera el hueco.

## Fuera de alcance (regla 38, no tocado)
`/rectify`, `invoicesAdmin.routes.ts`, el flag, `allocateInvoiceNumber` ni ninguna línea del camino de
emisión. Implementar el bloqueo (autorizados los tests, NO el cambio). El front. Producción.

## Ficheros
- `tests/scrum308-caracterizacion-rectify.test.mjs` — 7 tests de caracterización, sin gate.

**Ungated 1303 · 1236 pass · 0 fail · 67 skip.**


---

# SCRUM-308 · EL BLOQUEO (9-ago-2026) · No se rectifica una factura ANULADA

**Medido contra:** `origin/main` = `111e7d2f6e10ab807d6f54e4e1a8a7201dd2a69e` · 2026-08-09T12:40:00+02:00
**Tanda:** 2302 tests, 2229 pass, 0 fail, 73 gateados a staging

> La caracterización de arriba ya estaba **mergeada** y dejó escrito: «autorizados los tests, NO el
> cambio», y que el test del caso `annulled` **cambiaría su expectativa** cuando se decidiera el
> bloqueo. Se decidió. Aquí está el cambio.

## PASO 0 — había trabajo empezado, y estaba bien declarado

| Qué | Resultado |
|---|---|
| ¿Rama con el 308? | `scrum-308-caracterizacion-rectify` — **ya mergeada** |
| ¿Entrada? | sí, la de arriba |
| ¿Tests? | `scrum308-caracterizacion-rectify.test.mjs`, con el caso `annulled` marcado «EN DISCUSIÓN» |
| ¿El front? | **ya lo impedía**: «Rectificar» no se ofrece en `annulled` (registro B2, `invoiceDetailView.js:503`) |

O sea: **el hueco era solo el backend**, que es justo lo que decía el título del ticket.

## Las tres preguntas del encargo, medidas en la ruta

`/rectify` ya cortaba por **tres** motivos: `cannot_rectify_rectification` (la original es una R1),
**`already_rectified`** (ya tiene rectificativa) y `cannot_rectify_receipt` (es un justificante).
**No miraba el `status`.**

Así que la tercera pregunta —«rectificativa sobre una que YA fue rectificada: ¿se permite hoy?»—
tiene respuesta y no hacía falta construir nada: **ya se impedía**. Este ticket no la toca, pero
**la fija con test** para que no se pierda al meter la puerta nueva justo al lado.

## El arreglo: AÑADIR una puerta, no cambiar cómo se emite

Comprobado en el diff: **cero líneas borradas o modificadas** en `/rectify` —solo añadidas— y
**cero cambios** en `invoicing.service.ts`, `invoiceNumber.service.ts`, `verifactu.service.ts` y
`prisma/`. Es exactamente la forma autorizada (regla 38).

**Y va ANTES de pedir número**, con guard que lo fija: comprobarlo después obligaría a abortar una
factura ya numerada, y eso deja el hueco en la serie que hay que justificar ante Hacienda.

## 🔴 LISTA BLANCA, y ése es el suelo del ticket

Lo fácil habría sido «si el estado es anulado, bloquear». **No se hizo**, porque falla hacia el
lado permisivo: un `status` nulo, ilegible o **uno nuevo que alguien añada mañana** pasarían la
comprobación y emitirían.

`puedeRectificarse` solo deja pasar `pending` y `paid`. Todo lo demás —incluido **no saber**— se
bloquea.

> Equivocarse hacia lo estricto cuesta un 409 que el profesional entiende. Equivocarse hacia lo
> permisivo emite un documento fiscal que **no se deshace** (regla 29).

Y **anulada y desconocido NO comparten código**: aplanarlos haría que un dato corrupto se leyera
como «esta factura está anulada» y nadie mirase por qué. Son síntomas distintos y uno hay que
investigarlo.

## Verificado en rojo

| # | Qué se rompe | Qué cae |
|---|---|---|
| 1 | Se quita la puerta (el defecto original) | 🔴 5 tests, incluida la caracterización |
| 2 | Lista NEGRA en vez de blanca | 🔴 el suelo: «no saber el estado no es permiso para rectificar» |
| 3 | La puerta se mueve **dentro de la transacción, tras pedir número** | 🔴 «abortar ahí dejaría un hueco en la serie» |
| 4 | Anulada y desconocido comparten código | 🔴 el test que los separa |

> **El rojo 3 no salió a la primera, y el fallo era mío:** moví la puerta a justo **antes** del
> `$transaction`, donde **sigue ejecutándose antes** del número — o sea que no había violación que
> cazar. La violación real es meterla **dentro**, después de `allocateInvoiceNumber`. Primera
> hipótesis correcta: «el caso está mal elegido», no «el guard sobra».

## El control positivo, que aquí pesa tanto como el negativo

Esto mete una puerta en un camino fiscal que **hoy funciona**. Un bloqueo demasiado ancho sería
peor que el defecto: dejaría al profesional sin la única forma legal de corregir una factura ya
emitida. Hay test de que `pending` y `paid` **siguen rectificándose igual**, con la R1 naciendo en
negativo.

## Un fixture ajeno se quedó corto, y es la misma familia de siempre

El test de SCRUM-264 (la quinta superficie del copy) montaba una factura **sin `status`**. Con la
lista blanca, ese fixture se rechaza antes y el test dejaba de llegar al portón que comprueba.

**Omitía un campo que entonces no cargaba peso y ahora sí.** Arreglado poniéndole `status:
'pending'` —una factura pendiente con una línea a 0 es exactamente el caso real que esa superficie
atiende—, no relajando nada. Es la otra cara de la lección del fixture con `id: 1`.

## Microcopy

El 409 lleva `[PENDIENTE microcopy oficial]`. **PROCEDENCIA: esta sección.** El **código** del
error sí va en claro porque es diagnóstico, no texto de pantalla — y el front ramifica por código,
nunca por el texto (SCRUM-151).

**Regla 26:** no se explica nada. Ni por qué una anulada no se rectifica, ni VeriFactu, ni la AEAT.

## La caracterización NO se borra

El test del caso `annulled` cambia su expectativa de 201 a 409 **y se queda**. Su valor es
precisamente que, el día que alguien reabra la puerta, el rojo salga **también** en el fichero que
caracteriza la ruta. Un caso caracterizado que desaparece al arreglarse deja de vigilar el arreglo.

Ficheros: `src/modules/invoicing/domain/rectificabilidad.ts` (nuevo — la decisión, pura) ·
`src/modules/system/app/routes/invoicesAdmin.routes.ts` (la puerta, solo añadidos) ·
`tests/scrum308-bloqueo-rectify.test.mjs` (11, nuevo) ·
`tests/scrum308-caracterizacion-rectify.test.mjs` (la expectativa que cambia) ·
`tests/scrum263-sin-lineas-409.test.mjs` (el fixture que se quedó corto).
