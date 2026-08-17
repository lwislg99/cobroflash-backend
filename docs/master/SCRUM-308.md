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


---

# SCRUM-308 · RE-MEDIDO (17-ago-2026) · ¿Puede YaQu emitir hoy una rectificativa? **Sí**

**Medido contra:** `origin/main` = `a241b6e48c6553e453375bf705ca76ac3045ac0d` · 2026-08-17T13:14:25+01:00

> ⚠️ Esa hora es el **committer date del primer commit del trabajo** (`822f371a`), no una lectura de
> reloj — mismo criterio R14 que las dos entradas de arriba.

**Encargo:** **ROAD-39**, del **tablero de roadmap** (no es una ficha de SCRUM; por eso el registro
aterriza aquí y no en un fichero propio). Pedía **medir, no construir**: «¿puede YaQu emitir hoy una
factura rectificativa?».

**Respuesta, en una línea: las rectificativas EXISTEN y FUNCIONAN** — camino de servidor, superficie
de dashboard, serie propia, sellado VeriFactu, auditoría y enlace a la original. No hay nada que
construir.

**Por qué vive en SCRUM-308:** esta medición **confirma y extiende** la caracterización de las dos
entradas de arriba. Es la misma pieza de conocimiento, no una nueva. En particular, **cierra en verde
la pregunta** que la primera entrada dejó abierta con el caso `annulled`, y **reproduce como propio**
el límite que allí se reportó (la secuencia real anular→rectificar contra Postgres sigue sin
ejercerse).

> **Nota de procedencia (registro, no reproche):** el encargo llegó con un identificador de roadmap y
> sin destino de fichero, así que este contenido nació como `docs/master/ROAD-39.md` y el guard de
> **SCRUM-273** lo rechazó en CI, con razón. Se movió aquí como apéndice, íntegro, sin borrar nada de
> lo anterior — la salida que el propio mensaje del guard enuncia. **El guard hizo exactamente su
> trabajo:** el nombre libre habría reintroducido la colisión de ficheros que SCRUM-273 existe para
> impedir.

## RESPUESTA: **A — existe y funciona.**

Hay mecanismo, no solo piezas. `POST /admin/invoices/:id/rectify` emite una R1 real: pide número
de la serie de rectificativas, crea la fila con el total negado, la enlaza a la original, la sella
y la audita — **sin escribir nada sobre la factura original**. Tiene botón en el dashboard y tiene
tests que ejercen la emisión, no solo la existencia del campo.

La premisa del encargo («hay indicios y podrían ser engañosos: un contador en el esquema es un
campo, una serie es una convención») era **la hipótesis prudente y resultó falsa por defecto**: lo
que hay es más de lo que los indicios sugerían. El contador `nextRectInvoiceNumber` no está huérfano;
es la última pieza de una cadena que ya está entera.

---

## Las cinco preguntas, con ruta y línea

### 1 · ¿Existe el TIPO rectificativa en el modelo de datos? SÍ

| Qué | Dónde | Nombre exacto |
|---|---|---|
| Tipo de factura | [schema.prisma:439](../../prisma/schema.prisma#L439) | `Invoice.type String @default("F1")` — valores `F1` \| `R1` |
| Enlace a la original | [schema.prisma:440](../../prisma/schema.prisma#L440) | `rectifiesId Int? @map("rectifies_id")` |
| Relación autorreferente | [schema.prisma:493-494](../../prisma/schema.prisma#L493-L494) | `rectifies` / `rectifiedBy`, relación `"Rectification"` |
| Contador de serie propia | [schema.prisma:24](../../prisma/schema.prisma#L24) | `nextRectInvoiceNumber Int @default(1)` |

### 2 · ¿Existe un CAMINO DE SERVIDOR que CREE una rectificativa? SÍ, y no es solo el contador

**La ruta:** [invoicesAdmin.routes.ts:867](../../src/modules/system/app/routes/invoicesAdmin.routes.ts#L867)
— `router.post('/:id/rectify', requireRole('admin'), …)`.

**Quién la llama** (esto es lo que separa «mencionar» de «hacer»):

1. **Montada en la app:** [app.ts:469](../../src/app.ts#L469) — `mountAdmin(app, '/admin/invoices', invoicesAdminRouter)`.
2. **Llamada desde el dashboard:** [invoiceDetailView.js:560](../../public/dashboard/js/invoiceDetailView.js#L560)
   — `fetch('/admin/invoices/${invoice.id}/rectify', { method: 'POST' })`.
3. **Registrada como camino de emisión C5** en el mapa fiscal de la casa:
   [SEMAFORO_MAPA_EMISION.md:53](../legal/SEMAFORO_MAPA_EMISION.md#L53).

**Qué hace, en orden** (todo dentro de [:867-1001](../../src/modules/system/app/routes/invoicesAdmin.routes.ts#L867-L1001)):

- **Cuatro puertas antes de emitir**, todas con código nombrado:
  `cannot_rectify_rectification` ([:877](../../src/modules/system/app/routes/invoicesAdmin.routes.ts#L877)) ·
  estado no rectificable ([:892](../../src/modules/system/app/routes/invoicesAdmin.routes.ts#L892), lista blanca en
  [rectificabilidad.ts:64](../../src/modules/invoicing/domain/rectificabilidad.ts#L64)) ·
  `already_rectified` ([:897](../../src/modules/system/app/routes/invoicesAdmin.routes.ts#L897)) ·
  `cannot_rectify_receipt` ([:913](../../src/modules/system/app/routes/invoicesAdmin.routes.ts#L913)).
- **Líneas negadas** ([:907-909](../../src/modules/system/app/routes/invoicesAdmin.routes.ts#L907-L909)),
  con fallback a una línea única por el total si la original no tenía líneas.
- **Número de la serie R dentro de transacción** ([:922-925](../../src/modules/system/app/routes/invoicesAdmin.routes.ts#L922-L925))
  — `allocateInvoiceNumber(tx, …, { rectifying: true, camino: 'C5' })`, que consume
  `nextRectInvoiceNumber` en [invoiceNumber.service.ts:350-363](../../src/modules/invoicing/domain/invoiceNumber.service.ts#L350-L363).
- **Creación de la fila** ([:926-943](../../src/modules/system/app/routes/invoicesAdmin.routes.ts#L926-L943))
  con `type: 'R1'`, `rectifiesId`, `total` negado y `status: 'paid'` (no es cobrable: no recibe recordatorios).
- **Sellado VeriFactu** ([:948-949](../../src/modules/system/app/routes/invoicesAdmin.routes.ts#L948-L949)) —
  `sellarTrasEmision`, después del commit que consumió el número.
- **Rastro doble:** evento de cliente `invoice_rectified` ([:951-957](../../src/modules/system/app/routes/invoicesAdmin.routes.ts#L951-L957))
  y auditoría `factura_rectificada` ([:961-979](../../src/modules/system/app/routes/invoicesAdmin.routes.ts#L961-L979)).

**Y llega al registro VeriFactu.** El XML emite `FacturasRectificadas` con emisor, número y fecha de
la original ([verifactu.service.ts:694-701](../../src/modules/invoicing/domain/verifactu.service.ts#L694-L701))
y `TipoRectificativa` resuelto en [registro.builder.ts:172](../../src/modules/fiscal/verifactu/registro.builder.ts#L172).

### 3 · ¿Hay SUPERFICIE para lanzarla? SÍ — botón en el dashboard, no hay que tocar la base

[invoiceDetailView.js:547-578](../../public/dashboard/js/invoiceDetailView.js#L547-L578): botón
`btn-danger`, con `window.confirm` que advierte que la acción no se puede deshacer, y que al terminar
abre el detalle de la nueva rectificativa. Se oculta si ya existe rectificativa
([:546](../../public/dashboard/js/invoiceDetailView.js#L546), vía `rectifiedBy`).

El gate es `requireRole('admin')` ([authMiddleware.ts:47](../../src/core/http/authMiddleware.ts#L47)),
que mira `req.userRole` — el rol **dentro del equipo del merchant**. Es decir: **es superficie del
profesional sobre sus propias facturas**, no una herramienta de plataforma. El pro de septiembre
llega a ella solo.

La pantalla también **muestra el vínculo en las dos direcciones**:
[invoiceDetailView.js:216-217](../../public/dashboard/js/invoiceDetailView.js#L216-L217) pinta
«Rectifica a» y «Rectificada por».

### 4 · ¿Tiene TEST? SÍ, y ejercen la emisión

**Censo, con su criterio declarado:** de los ficheros de `tests/`, **52** mencionan rectificativas
de alguna forma (`rectifies`, `rectifiesId`, `nextRectInvoiceNumber`, `R1` — la mayoría solo como
dato de fixture) y **3 ejercen la ruta** `/:id/rectify`:
`scrum263-sin-lineas-409` · `scrum308-bloqueo-rectify` · `scrum308-caracterizacion-rectify`.

**Criterio del recuento:** `grep -ln "'/:id/rectify'" tests/*.test.mjs` — la ruta **entre comillas
simples**, que es la sintaxis con la que se pasa como argumento a `invocar(...)` o se compara contra
`route?.path`. No vale grepear el texto `id/rectify`.

> **Autoprueba del censo, y el número que corrigió.** El primer criterio (`grep -ln "id/rectify"`)
> devolvió **4**, e incluía `scrum289b-factura-suelta`. Es **falso**: ahí la ruta aparece dentro de
> una cadena de texto de un mensaje de assert
> ([:190](../../tests/scrum289b-factura-suelta.test.mjs#L190)), no en una invocación. El criterio
> sintáctico la excluye (0 coincidencias en ese fichero) y conserva las 3 reales.
>
> Control positivo — `scrum308-caracterizacion-rectify`, del que se sabe por lectura que invoca el
> handler, aparece. Control negativo — `scrum215-sin-destinatario`, que solo tiene `rectifies: null`
> de fixture ([:38](../../tests/scrum215-sin-destinatario.test.mjs#L38)), no aparece.
>
> Se deja escrito porque es el modo de fallo del encargo en miniatura: **contar menciones da un
> número más alto y del mismo color que contar mecanismo.**

Los de SCRUM-308 importan el router **real** del `dist`, localizan la capa por método+ruta e invocan
el handler con `prisma` sustituido ([scrum308-caracterizacion-rectify.test.mjs:29-48](../../tests/scrum308-caracterizacion-rectify.test.mjs#L29-L48)),
con SUELO explícito: si la ruta se renombra, el test **falla** en vez de pasar en verde
([:35-37](../../tests/scrum308-caracterizacion-rectify.test.mjs#L35-L37)).

**Verde medido:** los 6 ficheros relevantes → **62 tests, 0 fallos, 0 saltos**.

**Hueco que sí tenían** (medido, y cubierto con un test exploratorio de esta sesión que **no se
commitea**): ninguno comprobaba **los datos del `create`** ni la regla 29 — solo el `code` y el
`body` de la respuesta. Lo ejercido ad hoc, con su suelo:

```
→ R1 creada: {"number":"2026-CF-R-003","type":"R1","total":"-100.00","rectifiesId":11}
→ escrituras observadas (todas): [{"op":"update","id":99}]     ← 99 = la R1; la original es la 11
→ sonda cazada: [{"op":"update-en-tx","id":11}]                ← el detector sabe fallar
```

La tercera línea es el suelo: inyectando en el **doble** (no en el camino de emisión — eso era STOP)
una escritura sobre la original, el detector la caza. Sin ella, el verde de la segunda línea no
valdría nada.

### 5 · ¿Respeta la regla 29 y queda auditable? SÍ, las dos

- **La original no se edita ni se borra.** En las 134 líneas del handler no hay un solo `update`,
  `delete` ni cambio de `status` sobre la original: la única escritura es el `tx.invoice.create` de
  la R1 ([:926](../../src/modules/system/app/routes/invoicesAdmin.routes.ts#L926)). Medido, no leído:
  la única escritura observada al ejercer la ruta fue un `update` sobre `id:99` — la R1 recién
  nacida, que es el sellado. **Cero sobre la original.**
- **Enlazada y auditable en cuatro sitios:** la fila (`rectifiesId`) · el registro de auditoría
  `factura_rectificada` con `numeroOriginal`, `numeroRectificativa` y `estabaSellada`
  ([:961-979](../../src/modules/system/app/routes/invoicesAdmin.routes.ts#L961-L979)) · el XML
  VeriFactu (`FacturasRectificadas`) · el PDF, que imprime «Rectifica a la factura Nº …»
  ([pdf.service.ts:151-152](../../src/modules/invoicing/infra/pdf/pdf.service.ts#L151-L152)).
- **Rectificar ≠ anular, y el código lo sabe:** la auditoría usa `factura_rectificada` y no
  `anular_factura` ([:959-960](../../src/modules/system/app/routes/invoicesAdmin.routes.ts#L959-L960)),
  y la UI separa los dos botones a propósito, con su motivo escrito
  ([invoiceDetailView.js:580-594](../../public/dashboard/js/invoiceDetailView.js#L580-L594)).

---

## HUECOS DECLARADOS — lo que esta medición **no** cierra

Ninguno impide emitir. Los tres son decisiones pendientes, no código que falte.

1. **`TipoRectificativa` = `I` está fijado por el FUNDADOR (30-jul-2026), no por dictamen del
   asesor.** [registro.builder.ts:150](../../src/modules/fiscal/verifactu/registro.builder.ts#L150).
   El motivo está escrito y es sólido: el producto emite el **delta** (total negado), y eso *es* `I`
   por definición ([:131-138](../../src/modules/fiscal/verifactu/registro.builder.ts#L131-L138)).
   Pero **P12 del expediente dice lo contrario** (que nuestras R1 consignan el total corregido → `S`)
   y el máster reserva la confirmación al asesor. **Si se confirma `S`, no basta cambiar la constante:
   hay que cambiar cómo se CREAN las R1** (que consignen el total corregido en vez del negativo) y
   añadir `ImporteRectificacion` ([:146-148](../../src/modules/fiscal/verifactu/registro.builder.ts#L146-L148)).
   Es la única pregunta abierta con coste de reconstrucción.
2. **Merchant ES real con `INVOICING_ES_ENABLED=OFF` no puede rectificar:**
   `allocateInvoiceNumber` lanza `invoicing_es_disabled`
   ([invoiceNumber.service.ts:342](../../src/modules/invoicing/domain/invoiceNumber.service.ts#L342);
   test en [emission.test.mjs:95](../../tests/emission.test.mjs#L95)). **Esto es correcto y es buena
   noticia:** las rectificativas están tras el **mismo** flag que la emisión, así que el día que se
   encienda para el pro de septiembre, la rectificativa se enciende con ella. No es trabajo aparte.
3. **El microcopy del botón está sin aprobar** — pero **no es específico de rectificar**: la marca
   `[PENDIENTE microcopy oficial]` la llevan **9 botones** de esa misma pantalla
   ([invoiceDetailView.js:273, 282, 363, 448, 472, 513, 550, 640](../../public/dashboard/js/invoiceDetailView.js#L252))
   y hay un mecanismo deliberado para sustituirla (`window.MICROCOPY_PENDIENTE`,
   [:252](../../public/dashboard/js/invoiceDetailView.js#L252)). El texto del 409 tiene la misma
   marca ([invoicesAdmin.routes.ts:858](../../src/modules/system/app/routes/invoicesAdmin.routes.ts#L858)).
   Es deuda de copy de la pantalla entera, no un agujero de la rectificativa.

## Lo que esta medición NO alcanzó (suelo)

- **No se ejerció contra una BD real.** Todo con `prisma` sustituido y sin turno de staging. El
  límite ya estaba declarado por la primera entrada de este mismo fichero y **sigue vigente**: la
  secuencia real **anular → rectificar** contra Postgres no se ha ejercido nunca
  ([scrum308-caracterizacion-rectify.test.mjs:15-17](../../tests/scrum308-caracterizacion-rectify.test.mjs#L15-L17)).
- **No se emitió nada contra producción** (era STOP) ni se verificó en yaqu.app con un merchant real:
  con `INVOICING_ES_ENABLED=OFF` el camino ES real está cerrado por diseño (hueco 2).
- **El PDF de una R1 no se generó** en esta sesión. Se leyó el código que imprime «Rectifica a la
  factura Nº» pero no se abrió un PDF resultante.

## Instrumentos usados, y qué vio cada uno por separado

| Instrumento | Qué encontró |
|---|---|
| `grep` del código (`src/`) | 202 coincidencias de `rectific*` en 19 ficheros; la ruta, la lista blanca, el builder del XML |
| `grep` de identificadores (`rectifiesId`, `nextRectInvoiceNumber`, `rectifiedBy`) | el esquema, 4 ficheros de `src/`, la UI, 20+ tests |
| Lectura del esquema | `type`, `rectifiesId`, relación `Rectification`, contador — los 4 campos |
| Lista de rutas (`app.ts` + stack real del router en el `dist`) | `POST /admin/invoices/:id/rectify` montada y alcanzable |
| `grep` de `public/` | **una sola** llamada de frontend: `invoiceDetailView.js:560` |
| Ejecución de la tanda | 62 tests verdes, 0 saltos, en los 6 ficheros relevantes |
| Test exploratorio (no commiteado) | los datos reales del `create` y **cero escrituras sobre la original** |
| Documentación de la casa | `SEMAFORO_MAPA_EMISION.md` ya registraba esto como camino C5 |

Los instrumentos **no coincidieron**: el `grep` de `src/` veía el motor y el XML, pero solo el de
`public/` demostró que hay una superficie que lo dispara, y solo la ejecución demostró que el motor
produce `2026-CF-R-003` y no un 500. Ninguno de los tres bastaba solo.

## Procedencia de la premisa del encargo

Los tres indicios que el encargo marcó como «posiblemente engañosos» resultaron ser **la punta de
algo entero**:

- el contador `nextRectInvoiceNumber` → lo consume [invoiceNumber.service.ts:350-363](../../src/modules/invoicing/domain/invoiceNumber.service.ts#L350-L363) en cada R1;
- «la serie R ya sentó el precedente» → es real: `formatInvoiceNumber(..., rect)` produce `2026-CF-R-003`, medido;
- la R1 del anticipo / rectificación cruzada → fuera del alcance de esta medición; no se buscó.

## Fuera de carril — se reportan, no se arreglan (regla 9)

- **Comentario obsoleto que afirma lo contrario del código:**
  [verifactu.service.ts:673](../../src/modules/invoicing/domain/verifactu.service.ts#L673) dice «Hoy
  `MODO_TIPO_RECTIFICATIVA` vale SIN_CONFIRMAR, así que la R1 se EXCLUYE del registro», pero la
  constante vale `INCREMENTAL_I` desde el 30-jul-2026
  ([registro.builder.ts:150](../../src/modules/fiscal/verifactu/registro.builder.ts#L150)): la R1 **sí**
  entra en el registro. Quien lea ese comentario concluirá que las rectificativas no se declaran.
- **Enlaces caducados en el mapa fiscal:**
  [SEMAFORO_MAPA_EMISION.md:53](../legal/SEMAFORO_MAPA_EMISION.md#L53) apunta a
  `invoicesAdmin.routes.ts:678/714/738` y [:252](../legal/SEMAFORO_MAPA_EMISION.md#L252) a
  `invoiceNumber.service.ts:107`; hoy son **867/922/936** y **342**. El mapa acierta en el fondo y
  falla en las coordenadas.
- **La secuencia real `anular → rectificar` contra Postgres sigue sin ejercerse nunca** (límite ya
  declarado en la primera entrada de este fichero, no nuevo). Necesita turno de staging.
- 🔴 **El ancla de un APÉNDICE no la vigila nadie, y lo medí sobre esta misma entrada.** El guard de
  **SCRUM-267** opera **por FICHERO, no por entrada**:
  [scrum267-ancla-de-medicion.test.mjs:165-168](../../tests/scrum267-ancla-de-medicion.test.mjs#L165-L168)
  hace `motivoSinAncla(e.texto)` sobre el texto completo, y `RE_ANCLA`
  ([:76](../../tests/scrum267-ancla-de-medicion.test.mjs#L76)) lleva flag `/m`: **basta con que UNA
  línea del fichero tenga ancla válida.** Comprobado en rojo a propósito — con el sha de este
  apéndice **abreviado a 7 caracteres**, los 4 guards siguieron dando **17/17 en verde**, porque las
  dos entradas de arriba ya aportaban anclas buenas. Restaurado a los 40 inmediatamente.
  **Y los dos guards se combinan mal:** SCRUM-273 **empuja** a escribir apéndices (es la salida que
  su propio mensaje enuncia, y es por lo que esta entrada está aquí), y en un apéndice el 267 deja de
  mirar. El ancla de esta entrada cumple el formato **porque se escribió a conciencia, no porque un
  guard lo exigiera.** Candidato a ticket propio; la decisión es del asesor.

Ninguno tiene víctima hoy ni bloquea nada en vuelo: **cero tickets nuevos** propuestos por esta
medición. El único ticket que justifica abrir es el del hueco 1 (dictamen `S` vs `I`), y esa
decisión es del asesor.

## Historia de la pieza

La emisión nació en **SCRUM-153**, la caracterizó **SCRUM-308** (rama
`scrum-308-caracterizacion-rectify`, último commit `83f66318`, Javier Pereira Fernández,
4-ago-2026 23:21, **ya mergeada en main** — es la primera entrada de este fichero), el bloqueo de
`annulled` llegó el 9-ago-2026 (segunda entrada), y **SCRUM-319** llevó `rectifiesId` a la pantalla
del Trabajo. Esta tercera entrada la re-mide de punta a punta y responde en verde.
