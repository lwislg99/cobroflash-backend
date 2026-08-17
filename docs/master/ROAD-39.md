# ROAD-39 · ¿Puede YaQu emitir hoy una factura rectificativa?

> **MEDICIÓN, NO CONSTRUCCIÓN.** No se ha escrito ni una línea del camino de emisión. Este
> documento es el entregable completo del encargo.
>
> Medido el **17-ago-2026** contra `main` = **`a241b6e4`** (antes del `fetch` era `d17e5426`:
> main se había movido, y la medición se hizo sobre el nuevo).

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

## HUECOS DECLARADOS — lo que ROAD-39 **no** cierra

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
  límite ya estaba declarado por SCRUM-308 y sigue vigente: la secuencia real **anular → rectificar**
  contra Postgres no se ha ejercido nunca
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
  declarado por SCRUM-308, no nuevo). Necesita turno de staging.

Ninguno tiene víctima hoy ni bloquea nada en vuelo: **cero tickets nuevos** propuestos por esta
medición. El único ticket que ROAD-39 justifica abrir es el del hueco 1 (dictamen `S` vs `I`), y esa
decisión es del asesor.

---

Historia: la emisión nació en **SCRUM-153**, la caracterizó **SCRUM-308** (rama
`scrum-308-caracterizacion-rectify`, último commit `83f66318`, Javier Pereira Fernández,
4-ago-2026 23:21, **ya mergeada en main**), y **SCRUM-319** llevó `rectifiesId` a la pantalla del
Trabajo.
