# SCRUM-321 · E0: las nueve preguntas del Bloque E, medidas (informe, cero construcción)

**Fecha:** 5-ago-2026 · **Carril:** B (medición) · **Gate:** sin gate — esta tarea **solo lee**

**Medido contra:** `origin/main` = `f3dc977bc33abdb437a85cc0d5b6139f7d404a9a` · 2026-08-05T00:33:20+01:00

> Las tres derivaciones se re-ejecutaron enteras a esa hora, sobre el árbol de ese `main`
> (la rama está rebasada encima; `git diff` contra él = solo este fichero). No se ha tocado
> **nada**: ni una línea de producto, ni un fichero de diseño, ni `prisma/schema.prisma`.
> Regla 38: leer el camino de emisión no es STOP; aquí ni se lee ni se modifica.

---

## Cómo se ha medido, y cuál es el suelo de cada derivación

Nada de esto es una lista escrita a mano. Tres derivadores, cada uno con su **suelo**: si la
derivación se queda ciega, **sale por `exit 1`** en vez de devolver un cero que se lee como «no
hay nada». «No hay campos de gasto» y «no supe mirar» son el mismo resultado y significados
opuestos — el criterio del propio ticket.

| Derivación | Fuente | Suelo (falla si…) | Control positivo a las 00:33 |
| --- | --- | --- | --- |
| **Q1** — qué produce «Descargar datos» | **AST** (compilador de TypeScript) de `exportData.ts` y `exports.routes.ts` | <5 rutas · <5 cabeceras · **cualquier** builder cuya cabecera no se resuelva | **11 rutas**, **7 builders**, 7/7 cabeceras resueltas |
| **Q2** — campos de Gasto | **DMMF** (`Prisma.dmmf.datamodel`, el schema compilado dentro del cliente ya generado — la misma fuente que `portabilidadCompleta.ts` y `schemaDrift.ts`) | <15 modelos · <5 campos en `Expense` | **24 modelos**, **17 campos** en `Expense` |
| **Q3** — salida de email | **AST de los 166 `.ts` de `src/`** + DMMF | <100 ficheros · **0 emisores** · <50 rutas | **11 emisores**, **180 rutas** declaradas |
| **Q9** — ¿se pregunta por el asesor? | DMMF (los 24 modelos, campo a campo) + barrido de **toda** la superficie (`src`, `public`, `prisma`, `tests`, `scripts`) | <100 ficheros barridos · <15 modelos | **505 ficheros**, **24 modelos**, 97 coincidencias de texto |

No se ha usado `grep` de un literal como medida: el `grep` localiza, la **cita del AST/DMMF**
mide. Y **no se regeneró el cliente de Prisma** — se leyó el ya generado.

---

# Sobre el producto

## Q1 · ¿Qué produce hoy «Descargar datos», exactamente? — **[MEDIDO]**

### Dónde vive y quién puede

Menú lateral **Finanzas › «Descargar datos»** (`public/dashboard/index.html:104-107`,
`data-view="export"`) → `public/dashboard/js/app.js:262-269` → `renderExportView`
(`public/dashboard/js/exportView.js:30`).
Backend: **el router entero es admin-only** — `mountAdmin(app, '/admin/exports',
requireRole('admin'), exportsRouter)` (`src/app.ts:397`). Un Operario no llega.

### Esa pantalla produce DOS descargas distintas, y contestan preguntas distintas

**① `yaqu-datos-AAAA-MM-DD.zip`** — `GET /admin/exports/datos.zip`
(`src/modules/exports/app/routes/exports.routes.ts:133`). Contenido exacto:

| Dentro del ZIP | Origen | Nº de columnas |
| --- | --- | --- |
| `csv/clientes.csv` | `buildClientesReferenciados` (`exportData.ts:179`) | **8** |
| `csv/facturas.csv` | `buildFacturas` (`exportData.ts:198`) | **11** |
| `csv/cobros.csv` | `buildCobros` (`exportData.ts:230`) | **10** |
| `csv/trabajos.csv` | `buildTrabajos` (`exportData.ts:258`) | **11** |
| `csv/presupuestos.csv` | `buildPresupuestos` (`exportData.ts:337`) | **10** |
| `csv/gastos.csv` | `buildGastos` (`exportData.ts:308`) | **9** |
| `facturas/<número>.pdf` | uno por factura del rango (`exports.routes.ts:364-366`) | — |
| `facturas/verifactu_<AAAA>.xml` | uno por ejercicio, **solo** con `INVOICING_ES_ENABLED` + país `ES` + NIF (`exports.routes.ts:143-145`, `:371-373`) | — |
| `LEEME.txt` | `construirLeeme` (`exportData.ts:486`) | — |
| `AVISO-PAQUETE-INCOMPLETO.txt` | solo si falla algún PDF (`exports.routes.ts:349-351`) | — |

Las columnas, **derivadas una a una**:

* **clientes** (`exportData.ts:138-145`): Nombre · Razón social · NIF/CIF · Teléfono · Email ·
  Notas · Baja WhatsApp · Fecha de alta
* **facturas** (`exportData.ts:206`): Número · Fecha · Cliente · Email cliente · Base · IVA ·
  Total · Moneda · Estado · Pagada en · VeriFactu
* **cobros** (`exportData.ts:238`): Cobro # · Fecha · Cliente · Concepto · Importe · Moneda ·
  **Método (paid_via)** · Estado · Cobrado en · Referencia
* **trabajos** (`exportData.ts:274`): Trabajo # · Título · Estado · Cliente · Operario · Fecha
  prevista · Total aceptado · Total cobrado · Pendiente · Estado de cobro · Alta
* **presupuestos** (`exportData.ts:345`): ID · Fecha · Cliente · Email · Teléfono · Total ·
  Moneda · Estado · Aceptada en · Condiciones de pago
* **gastos** (`exportData.ts:320`): Fecha · Concepto · Categoría · Importe · Moneda · Proveedor ·
  Presupuesto ID · **Registrado por** · Notas

**② `portabilidad-AAAA-MM-DD.zip`** — `GET /admin/exports/portabilidad.zip`
(`exports.routes.ts:765`). No es «lo mismo más grande»: es **art. 15 y 20 RGPD**, sin filtros y
con la lista de tablas **derivada del DMMF**, no elegida. Medido ahora mismo: de **21 modelos con
`merchantId`**, salen **19** (fuera `authSession` y `auditLog`, declarados con su motivo en
`portabilidadCompleta.ts:51-60`); las cabeceras son los **nombres de campo** del DMMF
(`:178-191`). Su `LEEME.txt` está **en blanco a propósito** (`portabilidadCompleta.ts:201`,
microcopy pendiente de aprobación, regla 30) y **toda la card lleva `[PENDIENTE microcopy
oficial]`** en la UI (`exportView.js:79-85`).

### El periodo

`?from=YYYY-MM-DD&to=YYYY-MM-DD` (`exports.routes.ts:74-79`). **No hay periodo por defecto: sin
fechas se descarga TODO el histórico.** `to` se estira a `23:59:59.999` para que el día pedido
entre entero. La UI no propone trimestres ni meses: dos `<input type="date">` vacíos
(`exportView.js:53-60`).

⚠️ **Y el criterio de fecha NO es uno: son cuatro**, derivados del 3.er argumento de `whereRango`
en cada builder — dato crítico para E2 y E4, porque un paquete «de julio» no significa lo mismo
en cada fichero:

| Fichero | Filtra por | Es decir |
| --- | --- | --- |
| facturas · cobros · presupuestos | `createdAt` | fecha de alta del documento |
| trabajos | `scheduledAt` (`exportData.ts:100`) | **ejecución prevista**; los no agendados quedan fuera |
| gastos | `date` (`exportData.ts:311`) | fecha del gasto, no la del apunte |
| clientes (en el ZIP) | **no filtra por fecha** | los referenciados por los documentos del rango (`exportData.ts:179-193`) |

### Formato y límites

CSV **UTF-8 con BOM**, separador **`;`**, decimal con **coma** y sin punto de miles, CRLF, fechas
`AAAA-MM-DD` (`exportData.ts:36`, `:57-60`, `:63-65`). Optimizado para Excel con configuración
regional española — **no es un formato universal** y el propio fichero lo dice (`:31-35`).
**Tope: 100 facturas por descarga** (`MAX_FACTURAS_ZIP`, `exportData.ts:396`); por encima, **409**
antes de renderizar nada (`exports.routes.ts:163-170`). Selección de datasets por
`?incluir=facturas,gastos` (6 datasets, `seleccionExport.ts:19`); vacío o ilegible = todo.

### Y además hay 8 CSV sueltos, que NO están en «Descargar datos»

Las 11 rutas derivadas bajo `/admin/exports` son: `datos.zip`, `datos.zip/info`,
`portabilidad.zip`, `customers.csv`, `invoices.csv`, `charges.csv`, `jobs.csv`, `expenses.csv`,
`quotes.csv`, `fees.csv` y `verifactu.xml`. Sus enlaces viven **repartidos por otras pantallas**
(Informes: `reportsView.js:50-53` y `:69`; Gastos: `expensesView.js:100`; Facturas:
`invoicesView.js:82`; Presupuestos: `quotesListView.js:33`; Planes: `plansView.js:56-58`).
**Ninguna vista enlaza `charges.csv` ni `jobs.csv`** — el CSV que el propio código llama «lo que
el asesor cruza con el banco» (`exportData.ts:229`) solo se obtiene dentro del ZIP o llamando a la
API a mano. `fees.csv` es contabilidad de la plataforma y exige owner verificado
(`exports.routes.ts:448-454`): correcto que no tenga botón.

---

## Q2 · ¿Qué campos tiene un Gasto hoy? — **[MEDIDO]**

Censo **derivado del DMMF**, no escrito a mano (`model Expense`, `prisma/schema.prisma:428`).
**14 campos escalares + 3 relaciones:**

| Campo | Columna | Tipo | Obligatorio | Por defecto |
| --- | --- | --- | --- | --- |
| `id` | `id` | Int | sí | autoincrement |
| `merchantId` | `merchant_id` | Int | sí | — |
| `quoteId` | `quote_id` | Int? | no | — |
| `providerId` | `provider_id` | Int? | no | — |
| `concept` | `concept` | String | sí | — |
| `amount` | `amount` | Decimal | sí | — |
| `currency` | `currency` | String | sí | `"EUR"` |
| `category` | `category` | String | sí | `"otros"` |
| `date` | `date` | DateTime | sí | `now()` |
| `notes` | `notes` | String? | no | — |
| `receiptData` | `receipt_data` | String? (`@db.Text`) | no | — |
| `teamMemberId` | `team_member_id` | Int? | no | — |
| `createdAt` / `updatedAt` | `created_at` / `updated_at` | DateTime | sí | `now()` / — |
| relaciones | `merchant`, `quote`, `provider` | — | — | — |

`category` es un `String` libre en BD; la lista real la fija el dominio y son **5 categorías de
oficio, no contables**: `materiales`, `desplazamiento`, `herramientas`, `subcontrata`, `otros`
(`src/modules/expenses/domain/expenses.service.ts:3`). El formulario captura exactamente
concepto, importe, fecha, categoría, trabajo, proveedor (**por ID numérico tecleado a mano**),
notas y foto (`public/dashboard/js/expensesView.js:276-316`, guardado en `:379-385`).

### De lo que necesita un asiento de compra, qué falta

| Lo que pide un asiento | ¿Existe? | Medido en |
| --- | --- | --- |
| **NIF del proveedor** | ❌ **NO** | `Provider` (`schema.prisma:489`) tiene `name`, `phone`, `email`, `notes`, `isActive` — **cero campos** que casen con `tax\|nif\|cif\|vat` (derivado sobre el DMMF) |
| **Fecha** | ✅ sí | `Expense.date` (`schema.prisma:428`+) |
| **Base imponible** | ❌ **NO** | solo `amount`; nada declara si es base o total |
| **Tipo de IVA** | ❌ **NO** | **cero** campos `iva\|vat\|base\|cuota\|deduc\|tax` en `Expense` (derivado) |
| **Cuota de IVA** | ❌ **NO** | ídem |
| **Concepto** | ✅ sí | `concept` (obligatorio) + `category` (5 valores de oficio) |
| **Documento adjunto** | ⚠️ **a medias** | `receiptData String? @db.Text` (`schema.prisma:440`): una **imagen en base64 dentro de una columna de texto**, subida con `fileToBase64` (`expensesView.js:374-377`). **No** usa el modelo `Attachment` (`schema.prisma:743`), cuyos `entityType` en uso derivados del código son solo `quote_request` y `albaran` — **nunca `expense`**. Y **no sale en ningún CSV de gastos** (ni el suelto ni el del ZIP) |
| **¿Es deducible?** | ❌ **NO** | no existe el campo |

**Faltan además, y un asiento de compra los pide igual:** número y serie de la factura del
proveedor, retención de IRPF, y cualquier noción de **cuándo y cómo se pagó el gasto** (`Expense`
no tiene `paidAt` ni método) — el mismo agujero que Q4 describe en el lado del cobro, en el lado
de la compra.

**Resumen honesto: de los 8 datos que pedía el ticket, hay 2 completos, 1 a medias y 5 no
existen.** Un gasto de YaQu hoy es un apunte de caja para calcular margen, no un asiento.

---

## Q3 · ¿Existe salida de email transaccional? — **[MEDIDO]**

**Sí, existe, y el proveedor es Resend** (HTTP API). Censo derivado del AST de los 166 `.ts` de
`src/`: **11 emisores** en 5 servicios, todos con el mismo patrón «Resend si hay clave, si no
nodemailer».

| Servicio | Qué manda | Resend | Fallback | Adjuntos |
| --- | --- | --- | --- | --- |
| `messaging/domain/email.service.ts:56` | **factura/justificante al cliente** | sí | SMTP/`.eml` (`:76`) | ✅ **sí**, PDF en base64 |
| `messaging/domain/email.service.ts:147` | **presupuesto al cliente** | sí | SMTP/`.eml` (`:165`) | ✅ sí (best-effort) |
| `auth/domain/auth.service.ts:16` | magic link e invitación de equipo | sí | `sendMail` (`:24`) | ❌ no |
| `messaging/domain/lifecycle.service.ts:20` | ciclo de vida | sí | — (solo log) | ❌ no |
| `messaging/domain/weeklyDigest.service.ts:12` | resumen semanal | sí | `sendMail` (`:21`) | ❌ no |
| `messaging/domain/merchantNotifications.ts:12` | avisos al merchant | sí | `sendMail` (`:25`) | ❌ no |

* **¿Admite adjuntos?** **Sí, y ya se usan en producción.** La factura viaja **siempre** con el
  PDF adjunto: si el PDF no está, `sendInvoiceEmail` **falla ruidosamente** en vez de mandar un
  correo mutilado (`email.service.ts:36`) — desde SCRUM-72/76 el adjunto es la **única** vía de
  entrega del documento al cliente. Configuración: `RESEND_API_KEY` (`src/core/config/env.ts:14`);
  sin ella ni `SMTP_URL`, `createMailer()` cae a `streamTransport` y **el correo no sale a ningún
  sitio** (`src/integrations/mailer.ts:15-24`).

* **¿Hay registro de entrega?** 🔴 **NO. Ninguno.** Tres medidas independientes, y las tres dan
  cero:
  1. **La respuesta de Resend se descarta en los 6 emisores HTTP** — derivado por el AST: el valor
     de `axios.post` no se asigna, ni se devuelve, ni se lee. El `id` de mensaje que Resend
     devuelve **no se guarda en ninguna parte**.
  2. **No hay tabla.** De los 24 modelos del DMMF, **cero** llevan `mail` en el nombre. Sí existe
     `WhatsAppMessage` (`schema.prisma:613`), con estado `queued→sent→delivered→read` que **un
     webhook de Meta actualiza** (`messaging/domain/whatsappLog.service.ts:109`, `:124`). **Para
     WhatsApp hay funnel de entrega; para email no hay ni fila.**
  3. **No hay webhook de entrada.** De las **180 rutas** declaradas en `src/`, las 5 que tocan
     correo son todas de **salida** (`/:id/send-email`, `/:id/resend`, …). Ninguna recibe eventos
     `delivered`/`bounced`/`complained` del proveedor.
  Y tampoco se anota en `AuditLog`: `POST /admin/invoices/:id/send-email`
  (`system/app/routes/invoicesAdmin.routes.ts:410-438`) llama, responde y **no registra nada**;
  el envío automático del webhook de cobro (`billing/app/routes/psp.routes.ts:141-152`) traga el
  error con un `console.error`.

**Consecuencia para el diseño del Bloque E:** el canal «email» existe, es fiable como *envío* y
soporta adjuntos — pero **hoy no se puede demostrar que un correo llegó**. Si E1 («el envío al
gestor») se apoya en el correo como entrega acreditable, eso es una pieza que **hay que construir**
(fila + webhook de Resend), no una que ya esté. La incoherencia del diseño v1 queda cerrada con
dato: el proveedor está, el registro no.

---

## Q4 · 🔴 ¿Cómo sabemos que una factura se ha cobrado por TRANSFERENCIA? — **[MEDIDO]**

> **Medida por otra sesión** (censo B4 / SCRUM-285) y copiada aquí íntegra, tal como pide el
> propio ticket. Ancla: comentario de SCRUM-321 del **2026-08-05T00:56+02:00**.

| Método | `paid` lo escribe… | Sitio |
| --- | --- | --- |
| **Tarjeta** | un **webhook** (evento del proveedor) | `psp.routes.ts` → `POST /webhooks/psp` |
| **Bizum por checkout** (`bizum_auto`) | un **webhook** | `paidVia.ts:42` |
| **Bizum manual** (`bizum_manual`) | una **acción del usuario** | `chargesAdmin.routes.ts:44` (`confirm-bizum`) |
| **Transferencia** | una **acción del usuario, a mano** | `invoicesAdmin.routes.ts:243` (`/status`) |
| **Efectivo** | una **acción del usuario, a mano** | el mismo `/status` |

**La transferencia, el efectivo y el Bizum manual los marca el usuario a mano.** Para esos tres
**no sabemos cuándo entró el euro**: sabemos cuándo el comercio pulsó «Marcar como PAGADA». Solo
tarjeta y Bizum-checkout se confirman por webhook. **Tres de los cinco métodos, y son justo los
que más usa un gremio.**

### La recomendación explícita que el ticket exige

El ticket obliga a decirlo en voz alta si la respuesta era ésta, y lo es: **hay dos textos de
diseño nuestros afirmando lo contrario.** Uno de ellos entró al repo hace minutos (SCRUM-287,
copia verbatim) y ya se puede citar con fichero y línea:

* `docs/diseno/bloque-a.md:156` — *«Ellos lo ofrecen como casilla. Pero **no saben cuándo
  cobras**: no tienen pasarela, ni Bizum, ni conciliación.»*
* `docs/diseno/bloque-a.md:158` — *«**Nosotros sabemos exactamente cuándo entró cada euro.** Así
  que en YaQu el criterio de caja no es una casilla informativa: es una liquidación que se calcula
  sola.»*
* `docs/diseno/bloque-a.md:191` — *«Ellos ofrecen la casilla del RECC y **no pueden calcular su
  consecuencia**.»*
* Y **media justificación del Bloque E** se apoya en lo mismo (ese texto **no está en el repo**:
  la única referencia disponible es el comentario del ticket).

**Para tarjeta y Bizum-checkout la frase es cierta. Para transferencia, efectivo y Bizum manual
hacemos exactamente lo mismo que el competidor, y hay que dejar de decir que no.** La decisión es
del fundador y son dos, no una: **(a)** corregir los dos textos de diseño, o **(b)** construir la
integración bancaria (E5). Y son textos de diseño, no microcopy publicada: corregirlos no toca
producto.

### 🔴 La consecuencia que va más allá del argumento de venta

`/status` escribe `paidAt: new Date()` — **la fecha de cobro que guardamos es la del clic, no la
del ingreso**. El criterio de caja del Bloque A se calcula sobre la fecha en que se cobró de
verdad: si el comercio marca el lunes una transferencia que entró el viernes anterior y ese
viernes cae en el trimestre anterior, **el dato fiscal sale mal y nadie se entera**.

**Punto que el comentario dejaba abierto —«¿existe alguna forma de meter la fecha real del cobro,
o `paidAt` es siempre `now()`?»— y que esta sesión confirma de paso**, al haber leído ese fichero
midiendo Q3: el webhook de la pasarela también escribe `paidAt: new Date()`
(`src/modules/billing/app/routes/psp.routes.ts:121`). **Ni siquiera con el proveedor confirmando
se guarda la fecha del evento**: se guarda la de proceso. No hay ningún sitio donde el usuario
pueda introducir la fecha real.

---

## Q5 · ¿Distinguimos cliente consumidor de cliente empresa? — **[MEDIDO]**

> Medida en **SCRUM-327 (bloque 4, Q19)**; se midió una vez para servir a A0 y a E0.
> Ancla: `docs/master/SCRUM-327.md:127-140`.

* **El CLIENTE FINAL del profesional SÍ se clasifica `PARTICULAR | EMPRESARIO`**
  (`prisma/schema.prisma:157-161`, SCRUM-69/FACT-1). Determina el plazo legal de la recapitulativa
  (art. 13 RD 1619/2012); `null` = «nunca clasificado» → se trata como `PARTICULAR` (plazo más
  corto) en `resolveTipoDestinatario`.
* **El COMPRADOR de YaQu (el merchant) NO se clasifica.** No hay campo `isConsumer`/`buyerType`
  en `Merchant`. `plan='empresa'` (`schema.prisma:67`) es un **tramo de precio**, no un tipo de
  comprador.
* **Consecuencia para E0:** el producto distingue consumidor/empresa **aguas abajo** (clientes del
  pro, con fin fiscal) pero **no en quien compra la suscripción**.

---

# Sobre el mercado

Las tres siguientes **no salen del repositorio**: salen de hablar con usuarios o de mirar datos de
uso. **No se estiman.** Una respuesta inventada aquí cuesta el bloque entero — que es exactamente
lo que pasó en la v1 y por lo que existe este ticket.

**Motivo común, y está medido:** **no hay ninguna instrumentación de analítica** en el producto
(medido en SCRUM-327; ancla: `docs/master/SCRUM-327.md:144-145` — cero analítica de terceros, solo
`localStorage` de atribución en la landing). Sin eventos no hay cohortes, y sin cohortes estas
tres preguntas no tienen fuente interna. La otra fuente posible —preguntar— tampoco existe: **Q9
demuestra que el producto no le pregunta nada de esto al usuario en ningún sitio.**

## Q6 · ¿Qué proporción de nuestros usuarios tiene gestoría? — **[NO SE PUEDE MEDIR HOY]**
Ni se guarda (Q9: cero campos) ni se observa (cero analítica). Sin dato, **el diseño v1 asignó el
100 % del esfuerzo del bloque a un segmento de tamaño desconocido**. Para contestarla: preguntar a
usuarios reales, o añadir el campo — y añadirlo es E-algo, no E0.

## Q7 · ¿Qué le manda hoy a su asesor, por qué canal y cada cuánto? — **[NO SE PUEDE MEDIR HOY]**
El único rastro interno sería el `AuditLog` (`datos_exportados` se registra en cada descarga,
`exports.routes.ts:47-67`) y **no sirve para esto**: sabe que hubo una descarga, no a quién se
entregó, ni por qué canal, ni si acabó en un asesor. Y es deliberado —
`exports.routes.ts:596-603` explica por qué **no** se pregunta el destinatario: *«un dato
autodeclarado metido donde todo lo demás es verificable es cobertura aparente»*. Además, esa
lectura sería contra **producción**, que no se toca ni en lectura. Se contesta hablando con
usuarios.

## Q8 · ¿Quién elige el software, el profesional o el asesor? — **[NO SE PUEDE MEDIR HOY]**
No hay ninguna fuente interna: no hay campo de origen, ni de referidor, ni analítica de adquisición.
Se contesta hablando con usuarios y con asesores. **Y el ticket lo dice bien: si es el asesor, el
bloque entero cambia de prioridad** — o sea que es la pregunta que más barata sale de contestar y
más cara sale de suponer.

---

## Q9 · ¿Hay ya algún sitio del producto donde se pregunte por el asesor? — **[MEDIDO]**

**NO. En ningún sitio.** Dos derivaciones independientes:

1. **En el modelo: cero.** Barridos los **24 modelos** del DMMF campo a campo contra
   `asesor|asesoria|gestor|gestoria|contable|contabilidad|despacho|accountant|bookkeep`:
   **0 campos**. No existe `advisorEmail`, ni `gestoriaId`, ni nada equivalente.
2. **En la superficie: cero preguntas.** Barridos **505 ficheros** (`src`, `public`, `prisma`,
   `tests`, `scripts`): **97 coincidencias de texto y ni una sola es una pregunta al usuario.**
   Repartidas así:
   * **44 en `tests/`** y **5 en `scripts/`** — guards y mensajes de rojo.
   * **27 en `src/`** — todas comentarios que explican **para quién** es el export
     (`exportData.ts:4`, `:134`, `:229`; `exports.routes.ts:123`, `:619`; `paidVia.ts:13`…).
   * **20 en `public/`** — de las cuales solo **dos son texto que el usuario lee**, y las dos le
     dicen que consulte **a su** asesor, sin capturar nada: `public/dashboard/js/api.js:498`
     («…consúltalo con tu asesor») y `public/dashboard/js/jobDetailView.js:389`
     («…confírmalo con tu asesor»). El resto son la copy de la card de descarga
     (`exportView.js:36`) y el hueco `[PENDIENTE ASESOR]` de `semaforoFiscal.js:37`, que es el
     dictamen del asesor **del fundador**, no el del usuario.

**Conclusión para el Bloque E: el campo hay que crearlo; no hay nada que reutilizar.** Y con Q6 sin
contestar, crearlo antes de saber a cuántos aplica es exactamente el orden que este ticket viene a
evitar.

---

## Hallazgos de otros carriles (regla 9 — se reportan, no se arreglan)

1. 🔴 **Los dos `gastos.csv` NO cuadran, y el código afirma que sí.** El del ZIP tiene **9**
   columnas (`exportData.ts:320`, incluye «Registrado por»); el suelto `GET
   /admin/exports/expenses.csv` tiene **8** (`exports.routes.ts:695`, sin ella). El comentario de
   `exportData.ts:299-300` dice literalmente *«Mismas columnas que el CSV suelto, para que las dos
   descargas cuadren entre sí»*. **La causa está a la vista:** el suelto es el único que **no**
   usa el builder compartido — se monta su propia consulta (`exports.routes.ts:684-705`), y por eso
   derivó. Afecta directamente a E2/E4, que se apoyan en este fichero.
2. **`plansView.js:57` etiqueta «cobros» un enlace a `invoices.csv`.** El CSV de cobros es
   `charges.csv`; el usuario con la prueba caducada que pulse «cobros» se lleva facturas. Es
   microcopy + enlace: lo aprueba el fundador (regla 30).
3. **`charges.csv` y `jobs.csv` no tienen entrada de UI en ninguna vista** (derivado del barrido
   de `public/`). Solo se consiguen dentro del ZIP.
4. **La foto del ticket de gasto no sale en ninguna descarga de gastos** (ni suelta ni en el ZIP),
   pero **sí en `portabilidad.zip`**: `camposDe` incluye todos los escalares, así que `receiptData`
   viaja como una celda CSV con una imagen entera en base64 dentro
   (`portabilidadCompleta.ts:94-101`, `:178-191`). Derivado, no ejecutado.
5. **`paidAt` es la fecha del clic también en el webhook** (`psp.routes.ts:121`) — ver Q4.

## Lo que NO cubre esta medición

* **No se ha ejecutado ninguna descarga.** Todo sale del AST y del DMMF: se ha medido **lo que el
  código produce**, no un ZIP abierto. Si alguien necesita el fichero real, eso es otra medición
  (y contra staging, nunca producción).
* **Los tres derivadores son de un solo uso, en el scratchpad: NO son guards de la suite.**
  Convertir cualquiera en un guard permanente sería construcción, y este ticket es cero
  construcción. Si el Bloque E quiere que la divergencia del hallazgo 1 no vuelva a pasar
  desapercibida, **eso es un ticket propio**.
* **Q6, Q7 y Q8 siguen sin contestar** y no se han aproximado por ningún lado.
* **No se ha mirado producción** (ni en lectura), ni Stripe, ni el buzón de Resend.
* Q4 y Q5 **no se han vuelto a medir**: se copian de su medición original con su ancla. Lo único
  nuevo sobre Q4 es la confirmación de `psp.routes.ts:121` y las citas con línea de
  `docs/diseno/bloque-a.md`, que apareció en `main` durante esta sesión.

## Ficheros

* `docs/master/SCRUM-321.md` — **este informe. Es el único fichero que toca la rama.**
