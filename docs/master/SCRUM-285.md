# SCRUM-285 · B4 — CENSO de las acciones que tocan el cobro desde la vista de factura

**Fecha:** 5-ago-2026 · **Carril:** B · **Gate:** sin gate — solo lee ficheros y parsea el AST; ni BD ni red
**Medido contra:** `origin/main` = `193f9a4d2f46c0b7c15e55784408f6bf3da28976` · 2026-08-05T00:04:02+01:00
**Tanda:** 1347 tests, 1280 pass, 0 fail, 67 skipped (`npm test`, exit **0**)

## Qué entrega, y qué NO

**NO separa nada.** La construcción de B4 (mover cobros al menú `Cobros`) necesita **B1** (la entrada
de menú), que sigue parada. Esto es el **CENSO**: enumerar las acciones que TOCAN EL COBRO desde la
vista de factura, con su destino, para que cuando se separe **ninguna se pierda** — «o se queda en la
factura, o se muda al cobro». El riesgo que B4 declara: hoy hay cobro dentro de la factura (Marcar
como PAGADA, Confirmar Bizum, Recordar pago); al separar, una que desaparezca es el fallo mudo.

**La pregunta es distinta a la del 283.** El 283 preguntó «¿está en la vista?». B4 pregunta «¿toca el
cobro?», y se responde por el **ENDPOINT** que llama el handler de cada acción — **NO por el registro**
(está en el registro ≠ toca cobro; por esa vía btnPdf tocaría cobro por llevar un enlace de pago
dentro del documento, y eso es señal de criterio malo). Se mide lo que la acción HACE.

## Población declarada

- **Fichero:** `public/dashboard/js/invoiceDetailView.js`
- **Frontera:** la función `renderInvoiceDetailView` (el cuerpo de la vista)
- **Mido:** el endpoint (`fetch` / `apiRequest` / `window.open`) del handler de cada botón, por AST
- **Excluyo:** la carga (`fetchInvoiceDetail`, no es acción), la navegación (`btnBack`), y los botones
  cuyo endpoint no opera sobre el pago o el charge

## El censo — 4 acciones-cobro, con su destino (DECISIÓN DEL ASESOR)

**Criterio:** una acción toca cobro si su endpoint opera sobre el pago/charge; el **destino sale del
OBJETO** sobre el que actúa el endpoint — `/charges/:id/…` → **Cobros** · `/invoices/:id/…` → **Factura**.

| id | L | endpoint (medido) | objeto | destino |
|----|----|-------------------|--------|---------|
| `btnTogglePaid` | 315 | `/invoices/:id/status` · `/payment-anomaly` | invoice (estado de pago) | **Factura** |
| `btnDispute` | 394 | `/invoices/:id/dispute-package` | **charge** (chargeback) | **Cobros** |
| `btnBizum` | 410 | `/charges/:chargeId/confirm-bizum` | charge | **Cobros** |
| `btnReminder` | 451 | `/invoices/:id/send-reminder` | invoice (deuda a perseguir) | **Factura** |

**No-cobro (6):** `btnBack` (navegación) · `btnPdf` (`/pdf`) · `btnWhatsApp` (`/resend-whatsapp`, `/send-email`)
· `btnRectify` (`/rectify`) · `btnAnular` (su `/annul` vive en el modal, fuera de la vista) · `btnRegen` (`/regenerate-pdf`).

### 🔴 Divergencia medida: `btnDispute`

Su endpoint es `/invoices/:id/dispute-package` — **URL bajo `/invoices/`, no `/charges/`**. Por el atajo
de URL iría a Factura; por el OBJETO (un chargeback es el cobro yéndose para atrás, opera sobre el
charge como Bizum) va a **Cobros**. Es el ÚNICO caso donde la URL y el objeto divergen; manda el objeto.
_(Por qué Bizum-manual y Marcar-pagada van a sitios distintos siendo las dos «registrar un cobro a
mano»: no es intención, es objeto. En Bizum-manual EXISTE un charge; en transferencia/efectivo no hay
charge y el registro se escribe en la factura.)_

### Los bordes, decididos por MEDICIÓN (no intuición)

`btnReminder` aparece **solo en pending** (impagada) → su existencia depende del estado del dinero →
**toca cobro**. `btnWhatsApp` aparece en **pending y paid** → no depende → **no toca cobro**. La
condición de aparición decidió, no la opinión.

## Los cuatro guards — `tests/scrum285-censo-cobro-factura.test.mjs`

- **Huérfana:** una acción cuyo endpoint toca cobro (señal amplia) pero sin regla de destino → falla.
  Cero huérfanas en el árbol; probado con un `/collect-rest` sintético sin destino.
- **Suelo:** si el censo deja de ver acciones-cobro, FALLA (no dice «0 huérfanas»).
- **Rojo por el mecanismo:** cambiar el endpoint de `btnBizum` a `/pdf` lo baja de cobro; el censo cae
  por eso, no por un SyntaxError.
- **Control negativo:** `btnPdf` y `btnWhatsApp` (mueven el documento, no el dinero) no se cuelan.

## Contraste — cobro FUERA de la vista de factura (reportado, NO tocado)

`jobDetailView.js` tiene las MISMAS acciones de cobro duplicadas, más una propia del trabajo:
**Marcar como PAGADA** (`/status`, L1373) · **Confirmar Bizum** (`/charges/confirm-bizum`, L1417) ·
**Recordar pago** (`/send-reminder`, L1435) · **Cobrar el resto** (`/collect-rest`, L244). Cuando B4
separe, estas también son candidatas a `Cobros`. **No se tocan aquí.**

## 🔴 Hallazgo E0 (salió de esta medición; SCRUM-321 Q4 / SCRUM-294 / SCRUM-295)

`btnTogglePaid` → `/status` escribe `paidAt: new Date()`. Rastreado el mecanismo por método:

| Método | `paid` lo escribe… | Sitio |
|--------|--------------------|-------|
| Tarjeta | webhook (evento del proveedor) | `psp.routes.ts:121/167` |
| Bizum checkout (`bizum_auto`) | webhook | `paidVia.ts:42` |
| Bizum manual | acción del usuario (el comercio confirma) | `chargesAdmin.routes.ts:44` |
| Transferencia | **acción del usuario, A MANO** | `invoicesAdmin.routes.ts:243` |
| Efectivo | **acción del usuario, a mano** | mismo `/status` |

**Dos resultados, medidos:** (1) **no existe forma de introducir la fecha REAL del ingreso** —
`updateInvoiceStatusAdmin` (`invoiceAdmin.ts:138`) hace `paidAt = new Date()` y no acepta fecha. (2)
**incluso los webhooks usan `new Date()`** (la llegada), no la fecha del evento del proveedor. Para el
criterio de caja del Modelo 303, la transferencia/efectivo marcados a mano pueden caer en el trimestre
equivocado. Contradice el argumento de venta «sabemos exactamente cuándo entró cada euro» (Bloques A y
E). Es un resultado, no un fracaso.

## Lo que NO toca

El mecanismo de cobro (Bizum/tarjeta/Stripe/conciliación) · el PDF del justificante · `/rectify` y el
back (regla 38) · el modelo de datos · `jobDetailView.js` (contraste, solo reportado) · regla 30.

---

# SCRUM-285 · SEGUNDA ENTREGA (10-ago-2026) — B4 fase 1: la pantalla de Cobros

**Fecha:** 10-ago-2026 · **Carril:** B (UI + dominio) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `6cd4cffac1c3291da0caad6a3a4a10cc5c4a45c2` · 2026-08-10T19:08:12+02:00
**Tanda:** 2680 tests · 2606 pass · **0 fail** · 74 gateados · `npm test` exit **0**
(re-corrida entera tras partir la quinta columna en dos, que es el último cambio)

> ⚠️ **ESTA ENTREGA NO CIERRA SCRUM-285.** El tercer punto de §B4 —el enlace al cobro en la columna
> derecha del detalle de factura— queda como **FASE 2 dentro de este ticket, que sigue ABIERTO**.
> No se declara en un documento aparte, y por un motivo medido: el hueco de la barra lateral de B1
> estaba declarado en `SCRUM-284.md:416`, SCRUM-284 se cerró, y pasó semanas sin estar en ninguna
> lista. No se repite hoy sabiéndolo.

## PASO 0 — lo que decidió el alcance

**ENTRADA: «no hay».** Cero `case 'cobros'`, cero entrada de barra, cero fichero de vista.

**MECANISMO: existía a medias.** `chargesAdmin.routes.ts` tiene **una sola ruta**, `POST
/:id/confirm-bizum` (`:15`) — **no expone listado**. Los únicos `charge.findMany` del árbol están en
exports (`exportData.ts:231`, `buildCobros`) y en el bot. O sea: **el motor de datos existía y su
única superficie era un CSV.** Faltaban el endpoint JSON y la pantalla.

### 🔴 Y la medición que cambió la población: listar solo `Charge` esconde dinero

Un cobro por **transferencia o efectivo NO crea `Charge`**: `updateInvoiceStatusAdmin`
(`system/invoiceAdmin.ts:93`) marca `paidAt` en la Invoice y no toca `Charge` en ningún punto, y
`Invoice.chargeId` es nullable. `buildCobros`, que solo lee `Charge`, se los dejaba fuera.

> **Una pantalla de Cobros que liste solo `Charge` no está incompleta: miente por omisión** — y
> esconde justo el dinero que el profesional marca a mano, que es el que nadie ha confirmado por él.

Decisión del asesor: **las dos poblaciones, fundidas.** `listarCobros` lee `Charge` (todos) e
`Invoice` **con `chargeId: null`** — el `null` es lo que impide contar dos veces.

## ② «Antigüedad de la deuda»: la lectura del asesor era la correcta

Cita literal (`bloque-b.md:202`): *«Filtros por método (Bizum · tarjeta · transferencia · efectivo)
y **por antigüedad de la deuda**»*.

**Deuda = lo que está SIN cobrar.** Y el modelo lo sostiene sin inventar nada: `Charge.status` es
`pending | paid | expired`, así que **un cobro pedido y no recibido ES la deuda**, y su antigüedad
se mide desde `createdAt` — un dato que no se toca nunca.

**Todo el problema de fechas desaparece:** no se usa `paidAt` ni `updatedAt` para esto. Ninguno es
la fecha en que entró el dinero (hallazgo E0 de la primera entrega de este mismo ticket), y para la
deuda ni siquiera hacen falta. Un cobro ya cobrado **no tiene antigüedad de deuda**, y la función
devuelve `null` en vez de un número que no significa nada.

## 🔴 LO QUE BLOQUEA MEDIO FILTRO, y no lo resuelve este ticket

**`Invoice` no guarda método de cobro.** Medido sobre el esquema: no hay `paidVia` ni equivalente;
solo `Charge.method` lo tiene. Así que **de un cobro marcado a mano no consta cómo entró el dinero**.

Eso choca con «filtros por método» sobre la población fundida: los cobros a mano no se pueden
clasificar en ninguno de los cuatro. Y la consecuencia, si no se hace nada, es la misma mentira
colándose por otra puerta: **desaparecerían en cuanto el profesional pulsara un filtro.**

**Lo que se ha hecho, sin tocar `schema.prisma`:** un cubo propio, `sin-metodo`, que los recoge y lo
**dice**. No se inventa un valor por defecto — escribir «transferencia» porque suele serlo es
exactamente el bug que `paidVia.ts` cierra (*«ante lo desconocido, no se toca el método del cobro y
se grita en el log»*). Su rótulo va con marcador.

**Lo que NO se ha hecho, y es decisión del fundador:** que la Invoice guarde el método cuando se
marca a mano. Es una columna nueva y es territorio suyo.

## Lo que se construye

| pieza | dónde |
|---|---|
| la población fundida | `src/modules/billing/domain/cobros.service.ts` (nuevo) — `listarCobros`, `esDeuda`, `diasDeDeuda` |
| la superficie | `src/modules/billing/app/routes/cobrosAdmin.routes.ts` (nuevo) — `GET /admin/cobros` |
| la pantalla | `public/dashboard/js/cobrosView.js` (nuevo) |
| la entrada | `index.html`, grupo **VENTA**, detrás de Facturas — **en el mismo commit** |

**La clasificación la hace `tipoDeFactura`, no una copia.** Es la misma función que reparte la pila
del Trabajo y alimenta el bloque DINERO del rail (G4). Si esta pantalla dedujera por su cuenta qué
es un justificante, tendríamos **dos verdades sobre el mismo documento** — lo que G4 evitó a
propósito.

**Bizum: un solo filtro.** `bizum_auto` y `bizum_manual` son una distinción nuestra —confirmado por
la pasarela frente a dicho por el profesional— y el diseño nombra cuatro métodos porque el
profesional piensa en cuatro. **Filtrar por cuatro, leer los cinco:** la fila enseña el valor de la
casa tal cual.

## Verificado

**Positivo, el que separa esta pantalla de la que esconde dinero:** un cobro por transferencia **sin
Charge** aparece en la lista **y** sobrevive a los filtros. Se comprueba por los dos sitios por los
que se puede romper: en la pantalla (con el banco de SCRUM-417) y en el servidor (que la consulta de
facturas sin charge siga existiendo).

**Rojo por el mecanismo — tres, comprobadas EN DISCO:**

| # | qué se rompe | qué sale |
|---|---|---|
| **R1** | el servicio se queda solo con `Charge` | 🔴 «el servicio ya no lee `Invoice`: se ha quedado en la mitad que **ESCONDE el dinero marcado a mano**» |
| **R2** | se quita el cubo `sin-metodo` | 🔴 «no hay cubo para los cobros SIN método registrado … sin este cubo el dinero marcado a mano desaparece al filtrar» |
| **R3** | se quita la entrada de la barra | 🔴 «no hay entrada `Cobros`» + «la pantalla de Cobros existe y NO tiene entrada en la barra» |
| **R4** | los dos estados vacíos se funden en uno | 🔴 «con cobros en la lista y un filtro que no casa, la pantalla dice «no hay cobros». **Eso le afirma al profesional que no le deben nada, y es falso**» |
| **R5** | se pierde el singular de los días | 🔴 «con un solo día tiene que decir «1 día»» · sale `Sin cobrar desde hace 1 días` |
| **R6** | «Método no registrado» pasa a «Otro» | 🔴 los rótulos dejan de ser los aprobados **y** cae el test de que «Otro» no se dice |

**Controles negativos:** un método conocido no cae en el cubo de «no consta» —sin esto el cubo
podría tragárselo todo y el positivo pasaría por avería— y los dos Bizum caen en un filtro mientras
la fila conserva cuál es. **Suelo:** si la vista pinta menos de 6 nodos o no se ven los filtros, se
declara ciego; aquí lo vacío significaría «no le deben nada a nadie».

## Dos guards ajenos me cazaron, y los dos tenían razón

* **SCRUM-55** — `GET /admin/cobros` sin rol declarado. Se pone **`requireRole('admin')`, que es el
  DEFAULT de S1** («ruta nueva = declara rol mínimo; default Admin-only»), no una decisión de
  permisos que me corresponda. Abrirla al Técnico sería añadirla a `TECNICO_ALLOWED` con su motivo,
  y **eso lo decide el fundador**. Queda reportado.
* **SCRUM-402** — el trinquete de marcadores pintables. Sube **+1 a conciencia**, con su motivo en
  el censo: la alternativa a marcar esos textos no era escribirlos, era no entregar la pantalla.
  *Un marcador visible es feo y honesto; un texto inventado es bonito y falso.*

## MICROCOPY — aprobada por el asesor el 10-ago-2026 (regla 30)

Del diseño §B4, literales: **`Cobros`** y los cuatro filtros **`Bizum` · `tarjeta` ·
`transferencia` · `efectivo`**. Aprobados aparte, el mismo día, y **con test carácter a carácter**:

| ranura | texto aprobado |
|---|---|
| título de la pantalla | `Cobros` |
| filtro «todos» | `Todos` |
| filtro sin método | `Método no registrado` |
| método en la fila | `No registrado` |
| error de carga | `No hemos podido cargar los cobros. Vuelve a intentarlo.` |
| días de deuda | `Sin cobrar desde hace {n} días` · con `n=1`, **`1 día`** |
| vacío · sin ningún cobro | `Todavía no hay cobros registrados.` |
| vacío · con filtro puesto | `Ningún cobro coincide con este filtro.` |

### 🔴 El estado vacío son DOS, y confundirlos es el defecto

*«No hay datos»* y *«tu filtro los ha escondido»* son afirmaciones distintas, y la primera dicha en
el sitio de la segunda **le contesta al profesional que no le deben nada** — a la pregunta que vino
a hacer, en la pantalla del dinero. No es un texto impreciso: es una respuesta falsa. Van con test
**por separado**, y con su rojo (fundirlos en uno cae nombrando el daño).

**Y «Método no registrado» no es «Otro»:** «otro» AFIRMA que hubo un método distinto; aquí no consta
ninguno. Es la misma distinción que obligó a crear el cubo — si el rótulo miente, el cubo no sirve
de nada. Hay test de que la palabra «Otro» no aparece en la pantalla.

### 🔴 Y la quinta columna se parte en dos, por una regla que se lleva el asesor

**Una cabecera que necesita una «y» son dos columnas.** La quinta se llamaba «documento y deuda» y
estaba diciendo sola que ahí cabían dos hechos. Y no es estética: **la antigüedad es lo que el
profesional BARRE con la vista** buscando lo que lleva más tiempo sin cobrar, y enterrada junto a un
número de documento no se puede barrer — ni ordenar por ella el día que alguien lo pida.

Las SEIS, aprobadas: `Fecha` · `Cliente` · `Importe` · `Método` · `Documento` · `Sin cobrar`.

Y la antigüedad pasa a tener **dos formas, porque el sitio cambia lo que hace falta decir**: en tabla
la columna ya se llama «Sin cobrar», así que la celda pone solo `3 días`; fuera de la tabla no hay
cabecera que lo explique y va la frase entera, `Sin cobrar desde hace 3 días`. Las dos con singular,
las dos con test. **Ya no queda ningún marcador en esta pantalla** — `cobrosView.js` entró y salió
del censo de SCRUM-402 el mismo día.

### Las seis columnas en MÓVIL — medido, no supuesto

`.table--cards-mobile` a ≤640 px **esconde el `thead`** y convierte cada fila en una card con seis
áreas nombradas (`id · client · amount · date · status · actions`). Así que el número de columnas no
es el problema: **`invoicesView` ya tiene 6 y `quotesListView` 7**, con el mismo mecanismo.

El reparto sigue el de la casa —las que no encajan en un área se esconden con `col-hide-mobile`,
como hacen esas dos—: `Fecha`→`date`, `Cliente`→`client`, `Importe`→`amount`, `Documento`→`id`,
**`Sin cobrar`→`status`** (es lo que hay que barrer, así que sobrevive en el bolsillo) y `Método` se
esconde. Y la celda vacía de un cobro ya cobrado **desaparece sola** (`td:empty { display:none }`),
que es justo lo que se quiere.

⚠️ **Lo que queda por decidir, y se para aquí:** en la card no hay cabecera, así que «Sin cobrar»
aparece como un `3 días` suelto. La frase larga que el asesor aprobó *«si algún día hay tarjeta en
móvil»* **ya tiene sitio hoy** —la tarjeta existe—, pero elegir el texto según el ancho no lo hace
el CSS solo. **No se ha construido**: es la «otra forma en móvil» que el asesor dejó fuera de carril.

## ① Técnico vs admin: ADMIN-ONLY, y queda declarado con su motivo

Decisión del asesor, escrita aquí para que no se lea como descuido: **la pantalla de Cobros es el
dinero del NEGOCIO, no el de un trabajo.** Un operario viendo la facturación completa de su jefe es
una decisión de confianza que no se deshace, y su necesidad real —el dinero de SU trabajo— **ya la
cubre el bloque DINERO del rail** (G3/G4). Se queda con `requireRole('admin')`.

## Lo que NO cubre

* **FASE 2 de este ticket:** el enlace al cobro en la columna derecha del detalle de factura. Y
  medido: **esa columna no existe** — cero `rail`/`aside`/`grid` en `invoiceDetailView.js`. Es un
  cambio de layout de otra pantalla.
* **«Menú Facturas = solo facturas»** (primer punto de §B4): el listado sigue mezclando facturas y
  justificantes — `invoicesView.js` no usa `isReceiptNumber` ni `tipoDeFactura` en ningún filtro.
  **No entra aquí:** tocar Facturas es otra pantalla, y esta entrega ya trae una nueva.
* **El método de los cobros a mano**, que necesita columna (arriba).
* **La card en móvil enseña `3 días` sin etiqueta**, porque ahí no hay cabecera. La frase larga ya
  está escrita y aprobada; elegirla por ancho es otro carril. Ver arriba.
* **AB6 · matriz de dispositivos y capturas: PENDIENTE** (humano).
* **No hay test contra BD.** La población fundida se comprueba por estructura —que las dos consultas
  existan— y por comportamiento en la pantalla; que Prisma devuelva lo que se espera no se mide aquí.

## Ficheros

* `src/modules/billing/domain/cobros.service.ts` (nuevo) · `.../routes/cobrosAdmin.routes.ts` (nuevo)
* `src/app.ts` — monta `/admin/cobros`
* `public/dashboard/js/cobrosView.js` (nuevo) · `index.html` · `sw.js` · `app.js`
* `tests/scrum285-pantalla-cobros.test.mjs` (nuevo, 10)
* `tests/_barra-lateral.mjs` — la ausencia de `cobros` desaparece
* `tests/scrum420-barra-lateral.test.mjs` — el guard se da la vuelta, como pedía su propio mensaje
* `tests/scrum402-marcador-no-se-pinta.test.mjs` — el censo sube +1 a conciencia (de nueve ranuras
  marcadas a cinco tras la aprobación; el trinquete cuenta ficheros, no ranuras)
* `tests/_banco-vistas.mjs` — los oyentes se guardan y se pueden disparar, y el mini-DOM representa
  las etiquetas con `class`/`data-*`, no solo las que llevan `id`. Sin las dos cosas, los dos
  estados vacíos no se podían distinguir: hacía falta PULSAR un filtro y LEER un `data-`.
