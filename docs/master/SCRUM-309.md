# SCRUM-309 · G0 — medir el Trabajo antes de diseñar sus tareas (informe)

**Fecha:** 5-ago-2026 · **Carril:** G (Trabajos) · **Gate:** sin gate — es un informe

**Medido contra:** `origin/main` = `c0b41e64a520a001471294aae9ece9a3b1546b81` · 2026-08-05T00:23:14+01:00

**Re-anclado a mitad:** a las **00:32:47** (`2026-08-05T00:32:47+01:00`) `main` ya era `f3dc977bc33abdb437a85cc0d5b6139f7d404a9a` (entró el PR #415, SCRUM-287). Comprobado **blob a blob a las 00:33:12** (`2026-08-05T00:33:12+01:00`): los nueve ficheros medidos son **byte-idénticos** en los dos shas — los tres commits nuevos solo tocan `docs/`. **La medición vale en ambos.**
**Suite:** 250 tests · 213 pass · **0 fail** · 37 skip · `npm test` exit **0** (ver la nota honesta del final: ese número describe el árbol de la sesión, no `main`)
**Base de entrega:** este documento se commitea sobre `origin/main` = `f1a8ca507d6df9d530976c3a00289e051014fb0a` (medido **00:48:36**). `main` se movió una tercera vez mientras se preparaba la entrega; comprobado que `f3dc977..f1a8ca50` **no toca ninguno de los nueve ficheros medidos** (entran SCRUM-321, SCRUM-342 y un test), así que la medición sigue válida sobre esta base.

> **ALCANCE: esta tarea NO construye.** Cero código de producción, cero rutas, cero UI, cero
> tickets, `prisma/schema.prisma` intacto (leído para medir, jamás tocado — regla 38). Lo único
> que entra en el repo es este documento. Las derivaciones se hicieron con un script desechable
> **con suelo declarado**; no se incorpora a la suite, porque un guard nuevo sería construir.

---

## Índice de veredictos

| # | pregunta | veredicto |
|---|---|---|
| 1 | Los dos ejes | ⚠️ **corregido** — TRABAJO son **CINCO** estados (falta `cerrado`); COBRO **no es un estado**, es derivado |
| 1b | ¿«terminado y sin cobrar»? | ✅ **alcanzable, y es el camino POR DEFECTO** — el producto ya lo modela en tres sitios |
| 2 | Censo de acciones | ✅ **43 acciones** con línea y condición · **toda la FSM vive en el LISTADO**, no en el detalle |
| 3 | «Iniciar precio en el parte» | 🔴 **NO EXISTE** — cero apariciones; es el **checkbox** `Incluir precios en el parte` = `modoValoracion` |
| 4 | ¿Campo de descripción? | ⚠️ **`Job.titulo` existe y está lleno** — pero **no hay camino de escritura**. G2 cambia |
| 5 | «Tipo de trabajo» | ✅ **`Job.tipoOperacion`** (SCRUM-66) — gobierna **solo** la facturación recapitulativa |
| 6 | La dirección | 🔴 **campo propio de `Job`, que NADIE escribe** salvo el seed del vídeo. **C5 se queda sin premisa** |
| — | las capturas | 3 confirmadas · 3 matizadas · **3 corregidas** |

---

## Anclaje

- **Medido sobre `origin/main` = `c0b41e64a520a001471294aae9ece9a3b1546b81`**, fetch verificado a las **00:23:14** del 5-ago-2026.
- **Re-verificado a las 00:32:47: `main` se había movido a `f3dc977bc33abdb437a85cc0d5b6139f7d404a9a`** (PR #415, SCRUM-287). Comprobado blob a blob a las **00:33:12**: los nueve ficheros medidos son **byte-idénticos** en los dos shas (los tres commits nuevos tocan solo `docs/`). **La medición vale también en `f3dc977`.**
- El árbol de trabajo de la sesión estaba en `e06ffaf`, **740 commits por detrás de `main`** (454 ficheros distintos): medir ahí habría descrito un fósil. Todo lo de abajo se lee de los blobs del ref, **sin checkout**.
- Cero ficheros del repo modificados durante la medición.

## Método y suelo

- **Estados**: derivados de los sitios de ESCRITURA del modelo en el ORM (`\.job\.(create|update|upsert|…)`), no por grep de un literal. **9 sitios** en el árbol → 3 reales en `src/`, 4 en `scripts/`, 1 falso positivo (un comentario). Suelo: aborta con cero sitios.
- **Censo de acciones**: script propio de derivación. **«Aparición» = APPEND**, no declaración: un `createElement('button')` que no se engancha al árbol NO cuenta; un `acts.appendChild(pdfBtn())` SÍ, aunque el botón nazca en otra línea. Suelo: falla si el conjunto de creaciones o el de appends sale vacío, y **lista los huérfanos** (creado y nunca appendeado) en vez de callarlos.
- **Puntos ciegos declarados del script** (resueltos leyendo los dos ficheros enteros, de la 1 a la última línea):
  - `bz@L1402` salió huérfano: sí se appendea, bajo el alias `bizumBtn` en L1485.
  - `payLink` (L1469) se asigna sin `const/let`, así que el append de L1482 se le escapa; lo pilla vía la lista de `addSecondary` en L1486.
  - `paint`, `mkBtn` e `invWaFallback` aparecen como «helper» — ruido filtrado a mano.
- **68** sitios de aparición derivados en `jobDetailView.js`, **13** en `jobsView.js`.

---

# Q1 · Los dos ejes

## Eje TRABAJO: **cinco** estados, no cuatro

`src/modules/jobs/domain/job.service.ts:9`

```
JOB_STATES = ['pendiente_agendar', 'agendado', 'en_curso', 'terminado', 'cerrado']
```

Transiciones (`job.service.ts:22-28`), aplicadas por `canTransition` en el único PATCH (`jobs.routes.ts:374`):

| desde | hacia |
|---|---|
| `pendiente_agendar` | `agendado` |
| `agendado` | `agendado` (reagendar) · `pendiente_agendar` (des-programar) · `en_curso` |
| `en_curso` | `terminado` |
| `terminado` | `cerrado` |
| `cerrado` | **— (terminal)** |

Nombres de pantalla (no del modelo): `jobStatusMeta` en `public/dashboard/js/api.js:356-365` → Sin agendar · Agendado · En curso · Terminado · Cerrado. **Las mayúsculas del chip son CSS** (`styles.css:474-481`, `.status-pill { text-transform: uppercase }`), no valores.

🔴 **La epic se deja `cerrado`, y no es menor**: es la **única transición irreversible** de la FSM y **mata la vía de cobro** (lo dice el propio código, `jobs.routes.ts:353-354`). Además `en_curso → agendado` y `terminado → en_curso` **no existen**: marcar terminado no se deshace.

## Eje COBRO: **no es un estado, es un derivado**

`job.service.ts:212-218`:

```
estadoCobroFor(cobrado, aceptado):
  aceptado > 0 && cobrado >= aceptado → 'Pagado'
  cobrado > 0                        → 'Parcial'
  resto                              → 'Pendiente'
```

**No hay columna de estado de cobro en `Job`.** Solo dos decimales: `totalAceptado` (congelado del presupuesto al aceptar) y `totalCobrado` (materializado sumando las `Invoice` en `paid` de los quotes del Job, `job.service.ts:144-159`). El serializer lo calcula en cada respuesta (`jobs.routes.ts:151-154`). Valores capitalizados y en castellano: `Pagado` | `Parcial` | `Pendiente`.

⚠️ **Caso degenerado medido**: con `totalAceptado` nulo o 0 —un Job sin presupuesto existe, `collect-rest` tiene su propio error `job_without_quote` (`jobs.routes.ts:555`)— `estadoCobro` es `Pendiente` **para siempre**. O sea: **«Pendiente» significa a la vez «te deben todo» y «aquí no hay nada que cobrar»**. Para D5/G5 («qué falta para cobrar») eso importa.

## ¿Son independientes?

**Como ESTADO, sí y del todo**: los dos ejes se escriben por caminos disjuntos. `canTransition` no mira dinero; `estadoCobroFor` no mira `status`. Las 5×3 = 15 combinaciones son representables y **ninguna está prohibida por el código**. Que el dinero se mueva antes que el trabajo no es teórico: la factura del primer tramo se crea **al aceptar el presupuesto** (`quotes.routes.ts:585`, según `paymentTerms`), así que `Pagado` con `pendiente_agendar` es alcanzable con `FULL_UPFRONT`. **La afirmación de la epic «en curso y pagado por adelantado» se confirma.**

**Como ACCIÓN, no: hay dos acoplamientos y la epic no los tiene.**

1. `POST /admin/jobs/:id/collect-rest` **exige `status === 'terminado'`** → si no, **409 `job_not_finished`** con copy «Marca el trabajo como terminado para cobrar el resto» (`jobs.routes.ts:552-554`).
2. `cerrado` es terminal → **cierra esa puerta para siempre**, y «Cerrar trabajo» se ofrece **sin ninguna guarda de dinero** (`jobsView.js:231`). O sea: **«cerrado y sin cobrar» es un callejón sin salida alcanzable con un clic.**

## 🔴 ¿Existe «terminado y sin cobrar»?

**Sí, y no es un caso raro: es el camino POR DEFECTO.** Un Job nace `pendiente_agendar` con `totalCobrado = 0` (`job.service.ts:59-72`), y nada mueve el dinero hasta que una `Invoice` se marca `paid`. El producto **ya lo modela en tres sitios independientes**:

- Grupo propio en el listado: `✅ Terminados — cobra el resto` (`jobsView.js:90`)
- Nivel 1 del CTA del detalle: `status === 'terminado' && remaining.amount > 0` (`jobDetailView.js:51`)
- Guard del backend: `collect-rest` solo desde `terminado` (`jobs.routes.ts:552`)

La corrección 1 de la epic es correcta y está mejor sostenida de lo que la propia epic supone.

---

# Q2 · Censo derivado de acciones, con línea y condición de aparición

## A · Detalle del Trabajo — `public/dashboard/js/jobDetailView.js`

### Cabecera / héroe

| # | Acción | Línea | Aparece cuando |
|---|---|---|---|
| 1 | `← Volver a Trabajos` | 126-130 | siempre |
| 2 | **CTA del héroe** (una sola) | 232-283 | `if (nextAct)` — lo resuelve `jobNextAction` (46-82) |
| 2.1 | `💰 Cobrar el resto (X)` / `🪙 Cobrar siguiente tramo: L (X)` | 51-58 | `!tecnico && status==='terminado' && remaining.amount>0`; variante de tramo si `hasCustomPlan && pendingStagesCount>=2 && nextStage` |
| 2.2 | `Recordar pago` | 63-70 | `!tecnico && customer.phone && ∃ factura no-paid con ≥7 días` |
| 2.3 | `Enviar para firmar` | 74-75 | `∃ albarán 'emitido'` |
| 2.4 | `Emitir albarán` | 76-77 | `∃ albarán 'borrador'` y ninguno emitido |
| 2.5 | `+ Nuevo albarán` | 79 | `albaranes.length === 0` |
| 2.6 | *(nada)* | 81 | resto |
| 3 | Teléfono `tel:` del cliente | 194-199 | `customer.name \|\| customer.phone`, y `customer.phone` |

### Tipo de trabajo

| # | Acción | Línea | Aparece cuando |
|---|---|---|---|
| 4 | `Cambiar` | 320-323 | siempre · **deshabilitado con nota si técnico** (351-354) |
| 5 | Tarjeta `🔧 Varios avisos o visitas sueltas` | 356-383 | siempre (por cada `TIPO_CARDS`), oculta hasta pulsar `Cambiar` |
| 6 | Tarjeta `🏗️ Una obra o reforma de varios días` | 356-383 | ídem |

### Barra de DOCUMENTOS

| # | Acción | Línea | Aparece cuando |
|---|---|---|---|
| 7 | `+ Nuevo albarán` | 452-455 | siempre |
| 8 | ☑️ `Incluir precios en el parte` **(checkbox, no botón)** | 458-464 | siempre |
| 9 | `+ Añadir gasto` | 476-489 | `job.quote?.id != null && typeof openExpenseModal === 'function'` |
| 10 | `🧾 Consolidar en factura` | 509-513 | creado siempre, **`display` solo si** `tipoOperacion==='OPERACIONES_SUELTAS' && ∃ albarán (firmado ∧ VALORADO ∧ !facturado)` (503-504, 512) · deshabilitado si técnico ∧ aplica (517-520) |
| 11 | `Consolidar seleccionados` · `Cancelar` | 524-532 | tras pulsar #10 |
| 12 | Modal: `Cancelar` · `Crear N factura(s)` | 579-598 | tras pulsar #11 |

### Fila de ALBARÁN (por cada uno, 1171-1349)

| # | Acción | Línea | Aparece cuando |
|---|---|---|---|
| 13 | ☑️ `Incluir en la factura` | 1201-1210 | `estado==='firmado' && modoValoracion==='VALORADO' && !facturado && estadoCobro!=='parcial' && estadoCobro!=='facturado'` |
| 14 | `Emitir` (primaria) · `Editar líneas` · «⋯»[`📷 Añadir foto`] | 1260-1271 | `estado === 'borrador'` |
| 15 | `PDF` · `Firmar` (primaria) · `Editar líneas` · «⋯»[`📷 Añadir foto`, `Enviar para firmar`] | 1273-1310 | `estado === 'emitido'` |
| 16 | `PDF` | 1312 | `else` (= `firmado`) |
| 17 | `Facturar parte` / `Facturar lo que queda` | 1317-1323 | `firmado ∧ modoValoracion==='VALORADO' && !facturado && ∃ línea con pendiente>0`; el label cambia si `estadoCobro==='parcial'` · deshabilitado si técnico (1324-1327) |
| 18 | `Enviar por WhatsApp` | 1330-1347 | `firmado` |

### Hoja de edición del albarán (673-987, se abre desde #14/#15)

| # | Acción | Línea | Aparece cuando |
|---|---|---|---|
| 19 | ☑️ `Incluir precios en el parte` | 682-695 | `alb.estado === 'borrador'` (si no, texto «modo congelado tras emitir», 700-705) |
| 20 | `✕` quitar línea | 736-741 | por cada línea |
| 21 | `+ Añadir línea` | 750-754 | siempre |
| 22 | `🎤 Dictar el parte` | 784-791 | `window.appVoiceAlbaranEnabled === true && voiceSupportProbe() && typeof attachVoiceInput === 'function'` |
| 23 | `Convertir en líneas` · `Añadir al parte` | 808 / 891-912 | dentro de #22 |
| 24 | `Guardar cambios` · `Cancelar` · `×` | 947-986 / 1138-1159 | siempre en la hoja |

### Hoja «Facturar parte» (1003-1123, se abre desde #17)

| # | Acción | Línea | Aparece cuando |
|---|---|---|---|
| 25 | Input de cantidad por línea | 1030-1051 | por cada línea con `pendiente > 0` |
| 26 | `Cancelar` · `Emitir factura` · `×` | 1016-1064 | siempre en la hoja |

### Fila de FACTURA (por cada una, 1352-1489) — **todo bajo `if (!paid)`**

| # | Acción | Línea | Aparece cuando |
|---|---|---|---|
| 27 | `Marcar como PAGADA` | 1373-1395 | `!paid` |
| 28 | `📲 Confirmar Bizum recibido` | 1399-1426 | `inv.chargeId` · doble toque, se desarma a los 6 s |
| 29 | `Recordar pago` | 1433-1443 | `job.customer?.phone` |
| 30 | `Reenviar por WhatsApp` | 1446-1465 | `!paid` |
| 31 | `Enlace de pago` (enlace) | 1467-1475 | `inv.payToken` |
| — | **reparto por rol** | 1479-1487 | técnico → 27-30 **visibles y deshabilitadas** + 1 nota, 31 activa · admin → 27 y 28 visibles, «⋯»[29, 30, 31] |
| 32 | Barra de fallback de WhatsApp | 434-443 / 1454 / 1462 | cuando el envío falla |

### Fila del PRESUPUESTO

| # | Acción | Línea | Aparece cuando |
|---|---|---|---|
| 33 | `Ver presupuesto` | 1503-1504 | `if (job.quote)` |
| — | estado vacío (sin acción) | 1510-1514 | `!docs.length` |

## B · Listado de Trabajos — `public/dashboard/js/jobsView.js`

| # | Acción | Línea | Aparece cuando |
|---|---|---|---|
| 34 | Pestañas `Todos·N` `Pendiente·N` `Parcial·N` `Pagado·N` | 59-66 | siempre (con jobs) |
| 35 | `Ver N cerrado(s)` | 109-114 | grupo `cerrado` con elementos (plegado por defecto) |
| 36 | `datetime-local` + `Agendar` / `Reagendar` | 182-194 | `status==='pendiente_agendar' \|\| status==='agendado'` (label `Reagendar` si `agendado`) |
| 37 | `▶ Empezar` | 197 | `status === 'agendado'` |
| 38 | `📆 Añadir a mi calendario` (.ics) | 198-203 | `status === 'agendado'` |
| 39 | 🔴 `✅ Marcar terminado` | 206 | `status === 'en_curso'` |
| 40 | `💰 Cobrar el resto (X)` | 209-227 | `status==='terminado' && remaining && remaining.amount>0` · deshabilitado si técnico (229) |
| 41 | `Cerrar trabajo` | 231 | `status === 'terminado'` — **sin guarda de dinero** |
| 42 | Notas internas (guarda al `blur`) | 235-247 | siempre |
| 43 | La tarjeta navega al detalle | 251-254 | click fuera de `button, a, input, textarea, select, label` |

🔴 **Toda la FSM del Trabajo vive en el LISTADO.** El detalle **no puede cambiar el estado del Trabajo**: su único PATCH es `tipoOperacion` (`jobDetailView.js:371`). `✅ Marcar terminado` **no existe en el detalle** — derivado por todas las transiciones a `'terminado'` del árbol: la única es `jobsView.js:206`.

---

# Q3 · «Iniciar precio en el parte»

🔴 **No existe. Cero apariciones de esa cadena en todo el árbol.**

Es una **transcripción errónea** de `Incluir precios en el parte`, que además **no es un botón: es un checkbox** (`jobDetailView.js:458-464`, y otra vez dentro del editor en 682-695).

**Qué hace**: elige el `modoValoracion` del albarán que se va a crear — `VALORADO` si está marcado, `SIN_VALORAR` si no (`jobDetailView.js:607`), y viaja en el `POST /admin/jobs/:id/albaranes` (635). Subtexto fijo: «El parte sigue sin ser una factura» (495).

**Qué cambia**:
- En `VALORADO` se piden y se ven precio unitario e IVA por línea; el backend **exige ambos en todas** (`validarLineas`), y en `SIN_VALORAR` **los rechaza**.
- El modo **se congela al emitir**: editable solo en `borrador` (677); en `emitido` el backend responde **409 `albaran_locked`**, y por eso la UI ni lo ofrece (700-705, 965-967).
- Es **prerequisito duro de la consolidación**: solo entran partes `firmado ∧ VALORADO ∧ !facturado` (503).

**De dónde viene**: SCRUM-65 (`master:498`), que levantó el «sin precios» de SCRUM-14.

⚠️ **Choca con lo que la epic supone**: el control del medio no es una acción, es una **preferencia previa a crear**. Y **el prellenado desde el presupuesto solo funciona en `SIN_VALORAR`** (`jobDetailView.js:617-632`): en `VALORADO` el backend daría 400 porque las líneas del presupuesto llegan sin precio por decisión del fundador. Cualquier rediseño de esa barra tiene que respetarlo.

---

# Q4 · ¿Hay campo de descripción del trabajo?

**Sí: `Job.titulo String?`** (`prisma/schema.prisma:672`). También `Job.notes String?` (notas internas). No hay ningún campo llamado «descripción» ni «concepto».

🔴 **Pero el resultado útil es otro, y cambia G2**: `titulo` **se siembra una vez y no se puede cambiar nunca desde el producto.**

- Se escribe **solo al crear el Job**, con este criterio (`job.service.ts:56-58`):
  `titulo = ` `` `Presupuesto #${num}${cliente ? ' · ' + cliente : ''}` ``
- **`PATCH /admin/jobs/:id` NO acepta `titulo`.** Los campos admitidos son exactamente `status`, `scheduledAt`, `notes`, `assignedUserId`, `tipoOperacion` (`jobs.routes.ts:372-411`).
- Derivación de escrituras del modelo: **3 sitios reales en `src/`** — `job.service.ts:59` (create), `job.service.ts:155` (solo `totalCobrado`), `jobs.routes.ts:413` (el PATCH de arriba). Ninguno más.
- El detalle pinta ese `titulo` como `<h2>`, cayendo a «Trabajo» si es null (`jobDetailView.js:124` y `160`).

**Por eso la captura pone «Presupuesto #2 · Francisco Jiménez»: no es un rótulo cableado, es el valor del campo.** Así que **D1 está medio mal**: el Trabajo **sí** tiene identidad propia como dato; lo que le falta es (a) una semilla que no sea el número de presupuesto y (b) un camino de escritura. **G2 no es «crear el campo», es «cambiar la semilla + abrir el PATCH»** — y abrir el PATCH toca la lista de campos gateados por rol (`roleCapabilities.ts:90`).

---

# Q5 · «Tipo de trabajo»

Es **`Job.tipoOperacion`** (`schema.prisma:687`), `String` con `@default("TRABAJO_UNICO")`. Enum cerrado en código (`job.service.ts:17`):

- **`OPERACIONES_SUELTAS`** → UI: «🔧 Varios avisos o visitas sueltas» / «Cada visita es un trabajo independiente para este cliente.»
- **`TRABAJO_UNICO`** → UI: «🏗️ Una obra o reforma de varios días» / «Es un solo trabajo que se factura al concluir.»
  (`jobDetailView.js:309-312`)

**Qué gobierna** — derivado por todos los lectores del campo en `src/` y `public/`:

1. **Sí afecta a la FACTURACIÓN, y solo a eso.**
   - Habilita `🧾 Consolidar en factura` en la UI (`jobDetailView.js:504`).
   - `validarConsolidacion` **rechaza** `TRABAJO_UNICO` (`albaran.service.ts:162`).
   - La consolidación **por cliente** excluye esos albaranes con motivo `obra_unica` (`consolidacionCliente.service.ts:151`).
   - La bandeja de pendientes de facturar **solo consulta jobs con `tipoOperacion != 'TRABAJO_UNICO'`** (`pendientesFacturar.service.ts:147`).
   - Base legal: recapitulativa mensual, art. 13 RD 1619/2012.
2. **NO afecta** a los estados del Trabajo, ni a los del albarán, ni al eje de cobro, ni a la firma.
3. **Es admin-only por campo** (`roleCapabilities.ts:90`, `ADMIN_ONLY_JOB_FIELDS`), **fail-closed**: si un técnico lo manda mezclado con campos legítimos se rechaza el PATCH **entero** (`jobs.routes.ts:364-369`). La UI se lo enseña deshabilitado (351-354).
4. Deja traza de auditoría `tipo_operacion_elegido` **solo en el cambio real** (`jobs.routes.ts:407-425`).

**No está sin documentar ni es antiguo**: es SCRUM-66 (TRABAJO-4) y está en el máster. Lo que pasa es que **es una bandera fiscal disfrazada de ajuste de producto**, plegada a una línea en medio de la pantalla (SCRUM-31 F6). Si G4 reordena el detalle, decidir dónde va esto **es una decisión fiscal**, no de layout.

---

# Q6 · La dirección

## ¿Campo propio o del cliente?

**Campo propio del Trabajo: `Job.direccion String?`** (`schema.prisma:671`).
**`Customer` NO tiene dirección.** Ningún campo: `legalName, taxId, id, merchantId, name, phone, email, notes, portalToken, waOptOut, tipoDestinatario, billingPeriodicity` (`schema.prisma:140-192`). **No hay de dónde heredarla.** El serializer no intenta ningún fallback: `direccion: job.direccion ?? null` (`jobs.routes.ts:146`).

## 🔴 Pero nunca se escribe

**En todo el árbol hay UN solo escritor de `direccion`, y es un script de demo**: `scripts/seed-video.mjs:487` (`direccion: client.address`), datos sembrados para el vídeo.

- `ensureJobForQuote` la deja **null a propósito** — lo dice el propio comentario del schema: «direccion sin fuente hoy (ni Quote ni Customer la tienen) → se llenará en la UI (tarea futura)» (`schema.prisma:670`, `job.service.ts:65`).
- **`PATCH /admin/jobs/:id` no acepta `direccion`** (`jobs.routes.ts:372-411`).
- El detalle la pinta con `jdAddRow`, que **salta las filas vacías** (`jobDetailView.js:31`, 294): en una cuenta real **la fila DIRECCIÓN ni siquiera se dibuja**.

**Consecuencia para C5 (SCRUM-300): la suposición «sale del Trabajo, que ya la tiene» es FALSA hoy.** El Trabajo tiene el hueco, no el dato. Para cualquier merchant real `direccion` es `null` salvo que alguien la meta a mano en la BD. Antes de C5 (o dentro de C5) hace falta **un camino de escritura**, y ese camino no existe en ningún sitio del producto.

## ¿Varios trabajos del mismo cliente en direcciones distintas?

**Estructuralmente sí, sin cambiar el schema.** `Job.customerId` no es único (solo indexado, `schema.prisma:692-694`); el único `@unique` es `Job.quoteId`. O sea **1 Trabajo por presupuesto, N Trabajos por cliente**, y cada uno lleva **su propia columna `direccion`**. El modelo ya soporta el caso de gremio. Lo único que falta es poder escribirla.

⚠️ Dato de contexto: **no hay `POST /admin/jobs`**. Las rutas del módulo son exactamente `GET /`, `GET /:id`, `PATCH /:id`, `GET /:id/ics`, `POST /:id/albaranes`, `POST /:id/collect-rest`, `POST /:id/consolidar-albaranes`. Un Trabajo **solo nace de aceptar un presupuesto** (`ensureJobForQuote`).

---

# Las capturas: confirmadas y corregidas

| Afirmación `[MEDIDO]` de la epic | Veredicto |
|---|---|
| Pestañas `Todos · Pendiente · Parcial · Pagado` con contador | ✅ **Confirmado** — `jobsView.js:59-66`. Son estados de COBRO. |
| Secciones `EN CURSO · ESTA SEMANA · SIN AGENDAR` | ⚠️ **Incompleto: son SEIS grupos** — `🔨 En curso · 📅 Esta semana · ⏳ Sin agendar · 🗓 Más adelante · ✅ Terminados — cobra el resto · 🔒 Cerrados (plegado)` (`jobsView.js:85-92`). Solo se pintan los que tienen elementos (104), así que la captura no mentía: la lista estaba corta. Faltan justo los dos del final del ciclo. |
| Dos chips a la vez `[EN CURSO] [PAGADO]` | ✅ **Confirmado y siempre** — `jobDetailView.js:206-211`, sin guarda. Ojo: los valores son `en_curso` y `Pagado`; las MAYÚSCULAS las pone el CSS. |
| El detalle se titula `Presupuesto #2 · Francisco Jiménez` | ⚠️ **Confirmado como texto, mal interpretado**: es el valor de `Job.titulo`, no un rótulo. Ver Q4. |
| `DATOS` debajo de la pila de documentos | ✅ **Confirmado y deliberado** — `infoSec` se construye en 286-296 pero se appendea **después** de `docsSec` (404-405), con la nota de SCRUM-31 F6. |
| `DOCUMENTOS` mezcla presupuesto, albaranes, justificantes y gastos | ⚠️ **Casi**: la lista fusionada lleva **presupuesto + albaranes + facturas/justificantes**, ordenados por fecha ascendente (1509). **Los gastos NO están en la lista**: hay un botón para crearlos, y el propio código dice que no se pintan («mostrar el gasto en el Trabajo sería rentabilidad por obra, que es otro ticket», 1483-1485). Son **tres** tipos en la pila, no cuatro. |
| Tres botones de cabecera: `+ Nuevo albarán · Iniciar precio en el parte · + Añadir gasto` | 🔴 **Corregido en tres cosas**: (a) `Iniciar precio en el parte` no existe — es el **checkbox** `Incluir precios en el parte`; (b) `+ Añadir gasto` es **condicional** (`job.quote?.id != null`); (c) **falta un cuarto control**, `🧾 Consolidar en factura`, que vive en la misma barra y está oculto salvo `OPERACIONES_SUELTAS` con partes elegibles. La barra real es **2 botones fijos + 1 checkbox + 2 botones condicionales**. |
| `TIPO DE TRABAJO: Varios avisos o visitas sueltas [Cambiar]` | ✅ **Confirmado** — `jobDetailView.js:302-394`. Ver Q5. |
| `[Marcar terminado]` en el detalle | 🔴 **Falso.** Está en la **tarjeta del listado** (`jobsView.js:206`), condicionado a `status==='en_curso'`. El detalle no tiene ninguna acción que cambie el estado del Trabajo. |

---

# Las nueve contradicciones con la epic SCRUM-282

1. **Falta `cerrado` entero** en el eje TRABAJO. Es terminal, irreversible, mata el cobro y tiene su propio grupo en el listado y su propio botón sin guarda de dinero. La tabla del cruce necesita su fila.
2. **El eje COBRO no es un estado**: es una función de dos decimales, sin columna. Un diseño que hable de «transicionar el cobro» no tiene dónde escribir.
3. **`Pendiente` es ambiguo** (te deben todo / no hay nada que cobrar). G5 («qué falta para cobrar») se apoya justo ahí.
4. 🔴 **La primaria del cruce ya tiene un competidor en producción.** El detalle tiene `jobNextAction` (`jobDetailView.js:46-82`), una escalera de **6 niveles aprobada por el fundador en SCRUM-31 F4**, que decide la primaria por **albaranes y facturas**, no por el cruce de ejes: solo su nivel 1 mira `status`. G1 no está proponiendo una primaria donde no hay ninguna — **está proponiendo sustituir una escalera existente y aprobada**. Eso es un cambio de máster, no un rediseño de layout.
5. **La tabla del cruce reparte acciones que hoy están en la otra pantalla.** `Agendar` / `Empezar` / `Marcar terminado` existen los tres, pero **en el listado**. Llevarlos al detalle es mover la FSM de sitio, no reordenar botones — y el listado «no se toca en este bloque» según la propia epic (§1).
6. **G2 está mal dimensionada**: el campo existe y está lleno; lo que falta es semilla y camino de escritura (y el PATCH está gateado por rol).
7. **C5 se queda sin premisa**: `Job.direccion` existe pero nadie la escribe salvo el seed del vídeo, y `Customer` no tiene dirección de la que tirar.
8. **D3 cuenta cuatro tipos y son tres** (los gastos no se pintan). Si G4 parte `DOCUMENTOS` en `QUÉ FALTA PARA COBRAR · ALBARANES · GASTOS`, la sección `GASTOS` **nace vacía**: hoy no hay lectura de gastos por Trabajo en ninguna parte de esta vista.
9. **La epic dice que el bloque no toca `prisma/schema.prisma`** (§6). Con lo medido, **G2 y C5 no se pueden hacer sin abrir el PATCH** a `titulo` y `direccion` — no hace falta schema (las columnas ya están), pero sí tocar la lista de campos gateados de `roleCapabilities.ts`. Conviene declararlo.

---

# Suite

Ejecutada entera antes y después de la medición. Cero ficheros del repo tocados.

- **Antes** (00:22, árbol `e06ffaf`): `tests 250 · pass 213 · fail 0 · skipped 37` — exit 0
- **Después** (00:32, mismo árbol): `tests 250 · pass 213 · fail 0 · skipped 37` — exit 0
- `git status` idéntico al del arranque (los mismos 3 untracked previos).

⚠️ **Honestidad sobre el número**: la suite corre en el árbol de la sesión (`e06ffaf`), no en `main`. Correrla en `main` exigiría regenerar el cliente de Prisma —el `pretest` lo comprueba y el schema de `main` no es el de este árbol—, **y regenerarlo está prohibido** (`node_modules` va por junction entre worktrees). Como esta tarea no modifica ni una línea del repo, las dos tandas son la misma medida: **el número prueba que no he roto nada, no describe `main`.**

---

# Qué queda fuera de este informe

- El callejón sin salida de «Cerrar trabajo» (contradicción 1 / §Q1) **tiene ticket propio: SCRUM-344**. Aquí solo se mide.
- Reescribir la epic con las nueve contradicciones **es del asesor**. Este documento no decide diseño.
