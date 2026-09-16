# SCRUM-590 · CONT-19 — Teléfono + Móvil, el móvil como canal de WhatsApp

**Fecha:** 6-sep-2026 · **Carril:** producto / contactos · **Rama:** `scrum-590-telefono-y-movil`
**Medido contra:** `origin/main` = `00c6cb0cc328eb88cea26bc4b672ebad25e51a47` · 2026-09-06T06:58Z
**Worktree:** `cobroflash-backend`

> ⛔ **ESTA SESIÓN MIDE Y PARA. NO HAY UNA LÍNEA DE CÓDIGO EN ESTA RAMA**, y es deliberado: el
> ticket lleva dos columnas nuevas (esquema = fundador) y toca el camino de envío de WhatsApp
> (modificarlo = STOP). Lo que hay aquí son cuatro mediciones y un diff parado.

---

## 0 · 🔴 DOS PREMISAS DEL ENCARGO QUE EL ÁRBOL CONTRADICE

Se dicen las dos primero porque cambian el tamaño del ticket.

### (a) «Hoy hay UN solo campo: *Teléfono (E.164 sin +)*» — verdad a medias

Ese rótulo **ya no existe en el modal de clientes**. SCRUM-578 lo cambió a **«Teléfono»** a secas
y sacó el prefijo a un selector propio (`fieldPrefijo`, «🇪🇸 España +34»), con este motivo escrito
en el fichero: *el rótulo viejo pedía un FORMATO que ya no se pide, porque lo impone el control de
al lado*.

| dónde | rótulo de HOY | medido en |
|---|---|---|
| modal de clientes | **«Teléfono»** (`ROTULO_TELEFONO`) | `public/dashboard/js/customersView.js:772` · usado en `:955` |
| ficha 360 | **«Teléfono (E.164 sin +)»**, en línea | `public/dashboard/js/customerDetailView.js:307` |

O sea: **la divergencia que yo misma medí en SCRUM-586 ya alcanza al propio campo del teléfono**.
El rótulo viejo sobrevive sólo en la ficha 360, y además allí no hay selector de prefijo, así que
la etiqueta pide un formato que el otro formulario ya no pide. **Eso es CONT-19 antes de añadir
nada.**

### (b) «P-CONT-3 no tiene respuesta hoy» — 🔴 sí la tiene, y está escrita en el código

`src/modules/system/domain/identificadoresDuplicados.ts:99-105` dice, literalmente:

> ⏳ PENDIENTE DE SCRUM-590 (CONT-19): ese ticket parte el teléfono en dos campos —Teléfono y
> Móvil— y el criterio para ellos **YA está decidido (P-CONT-3): «mismo VALOR en CUALQUIER campo
> identificador»**, así que un valor guardado como móvil que ya exista como fijo en otro cliente
> también avisa. […] Cuando 590 lo cree, el cruce sale solo: basta añadir
> `{ campo: 'mobile', canon: canonParaComparar }` a este array, porque la búsqueda de abajo ya
> compara TODOS contra TODOS.

Y el mecanismo está construido para absorberlo: `buscarCoincidencias()` ya cruza cada identificador
contra **todos** los del otro cliente, no campo a campo. **No hay que decidir nada: hay que añadir
una entrada al array.** Lo que sigue teniendo sentido —y es lo que se midió— es *cuánto costaría*
ese criterio en falsos positivos.

> Si el asesor tiene una decisión posterior que deroga ésa, manda la suya; pero entonces hay que
> **borrar ese comentario**, porque hoy dirige a quien construya el ticket.

---

## 1 · DÓNDE VIVE HOY EL TELÉFONO — medido, con control positivo

**CONTROL POSITIVO del censo:** tiene que encontrar el campo del modal que ya conozco.
✅ lo encuentra: `customersView.js:955 · createField(ROTULO_TELEFONO, "phone", "text")`.
Y el de la ficha 360: `customerDetailView.js:307 · id="e360-phone"`.

| capa | dónde | qué |
|---|---|---|
| **columna** | `customers.phone` | `phone String?` — sin `@map`, sin `@unique`, **sin índice** |
| **esquema** | `prisma/schema.prisma`, modelo `Customer` línea 34 | nullable, sin default |
| **zod (cliente)** | `src/core/validation/schemas.ts:488` | `phone: z.string().min(5).optional()` en `customerCreateSchema` (el `update` es su `.partial()`) |
| **zod (cobro)** | `schemas.ts:352` | el cliente embebido del alta de cobro: **otra puerta que crea clientes** |
| **normalización** | `src/core/utils/utils.ts:32` `normalizePhone` | quita espacios/guiones/`+`/`00`, exige 8-15 dígitos, devuelve `''` si no |
| **modal de clientes** | `customersView.js:772,955` + `fieldPrefijo`, `repartirTelefono()` (`:845`) | rótulo «Teléfono» + selector de prefijo |
| **ficha 360** | `customerDetailView.js:307,345,378` | rótulo viejo, **sin** selector de prefijo |
| **duplicados** | `identificadoresDuplicados.ts` + `customersAdmin.routes.ts:73` | `formasBuscables()` genera las grafías para que **el índice** resuelva el filtro |

**Dónde se PINTA o se lee en el panel: 18 sitios en 12 ficheros** (`customerDetailView` ×2,
`customersView` ×1, `globalSearch` ×1, `homeView` ×2, `invoiceDetailView` ×2, `jobDetailView` ×1,
`jobNextAction` ×1, `jobRailBlocks` ×1, `quoteRequestsView` ×1, `quotesDetailView` ×2,
`quotesView` ×3, más una mención en un comentario de `jobActionsRegistry`).

🔴 **Y hay un detalle que decide el diseño:** varias de esas superficies **no muestran el teléfono,
lo usan como interruptor**. `jobNextAction.js:51` y `jobDetailView.js:1787` hacen
`if (job.customer?.phone)` para decidir si ofrecen «Recordar pago»; `quotesDetailView.js:321`
calcula `hasPhone`. Si mañana el fijo es lo que vive en `phone`, **esos botones aparecerían para
clientes a los que no se puede escribir por WhatsApp**.

---

## 2 · 🔴 EL CENSO QUE DECIDE: QUIÉN LEE EL TELÉFONO PARA MANDAR

Por AST sobre `src/`, **sólo lectura**: no se ha tocado una línea del camino de envío.

**Población derivada, no escrita a mano:** las funciones de envío salen de los `export` de
`src/integrations/whatsapp.ts` y `whatsappNotifications.ts`, y **el nombre de su parámetro de
destino se deriva de su firma** (`to`, `toPhone`, `merchantPhone`).

```
llamadas de envío en código de PRODUCTO (fuera de src/integrations) ... 65
  🔴 RESUELVEN EL DESTINO DESDE EL CLIENTE ........................... 13   ← el número que decide
  al MERCHANT (avisos al profesional) ................................ 16
  respuesta a un ENTRANTE (el número venía en el mensaje) ............. 35
  otros .............................................................. 1
  ILEGIBLES .......................................................... 0
  suma ............................................................... 65  (cuadra)
(+ 9 llamadas dentro de src/integrations: es la fontanería, reenvía lo que le dan)
```

**Los 13, con su expresión resuelta:**

| fichero:línea | función | destino resuelto |
|---|---|---|
| `billing/app/routes/mpWebhook.routes.ts:179` | `sendPaymentConfirmationInvoice` | `updated.customer.phone` |
| `billing/app/routes/mpWebhook.routes.ts:205` | `sendWhatsAppCtaUrl` | `phone = normalizePhone(updated.customer.phone)` |
| `billing/app/routes/psp.routes.ts:238` | `sendPaymentConfirmationInvoice` | `updated.customer.phone` |
| `billing/app/routes/psp.routes.ts:268` | `sendWhatsAppCtaUrl` | `reviewPhone = normalizePhone(updated.customer.phone)` |
| `billing/domain/invoiceReminder.service.ts:143` | `sendWhatsAppWindowFirst` | `normalizePhone(inv.customer?.phone)` |
| `billing/domain/invoiceReminder.service.ts:193` | `sendWhatsAppText` | `normalizePhone(inv.customer?.phone)` |
| `billing/domain/invoiceWhatsApp.service.ts:91` | `sendWhatsAppWindowFirst` | `normalizePhone(invoice.customer.phone)` |
| `jobs/domain/albaranWhatsApp.service.ts:78` | `sendWhatsAppTemplate` | `normalizePhone(customer?.phone …)` |
| `jobs/domain/albaranWhatsApp.service.ts:167` | `sendWhatsAppWindowFirst` | `normalizePhone(customer?.phone …)` |
| `quotes/domain/reminder.service.ts:46` | `sendWhatsAppTemplate` | `normalizePhone(quote.customer?.phone)` |
| `quotes/domain/sendQuote.service.ts:62` | `sendWhatsAppWindowFirst` | `normalizePhone(quote.customer.phone)` |
| `system/app/routes/invoicesAdmin.routes.ts:640` | `sendWhatsAppTemplate` | `normalizePhone(invoice.customer?.phone)` |
| `system/app/routes/invoicesAdmin.routes.ts:659` | `sendWhatsAppText` | `normalizePhone(invoice.customer?.phone)` |

### 🔴 LA CONCLUSIÓN, QUE ES EL TICKET ENTERO

**Los 13 leen `customer.phone`.** Hoy ese campo ES el canal de WhatsApp: no hay otro. Así que
**partir el teléfono en dos columnas y no tocar estos 13 sitios convierte los dos campos en
adorno** — o peor: si `phone` pasa a significar «el fijo», los documentos empezarían a irse al
fijo **sin que nada falle ni avise**.

Por eso este ticket **no se puede cerrar sin tocar el camino de envío**, y por eso esta sesión
para aquí.

### Tres cosas que el censo aprendió de sí mismo (y que se escriben para el siguiente)

1. **El destino no siempre se llama `to`.** Los envoltorios usan `toPhone`/`merchantPhone`;
   buscando sólo `to`, sus 10 llamadas salían «ILEGIBLES» siendo perfectamente legibles.
2. **Un parámetro no es una constante.** `botFlow.service.ts` pasa `from`, parámetro de la función
   que lo envuelve: 24 llamadas del bot salían «no resuelta».
3. **El tipo puede ser una intersección.** Cuatro vías declaran `{ … } & DestinoDeEnvio`
   (SCRUM-245). Leyendo sólo `TypeLiteral` salían con cero propiedades y, como el censo se queda
   con las funciones que tienen destino, **sus llamadas desaparecían de la población entera**: 55
   en vez de 65, y en silencio salvo por la línea de «funciones sin destino reconocible».
4. 🔴 **Y un falso positivo mío:** `customerPortal.routes.ts:478` resuelve a
   `customer.merchant?.whatsappPhone` — es el teléfono **del profesional**, alcanzado a través del
   objeto del cliente. Con «cliente» comprobado antes que «merchant», la palabra `customer` ganaba
   y **inflaba en uno justo el número que decide**. Eran 14; son **13**.

---

## 3 · P-CONT-3, CON DATOS DE DEV — y el número va delante

**Solo lectura contra `acela.proxy.rlwy.net/yaqu_dev_javier`.** Nunca staging, nunca producción.
**No se reimplementó la canonicalización:** se llamó a `buscarCoincidencias()`, la función del
producto importada de `dist/`, sobre las filas reales.

**Controles del instrumento** (respuesta conocida, antes de mirar los datos):

```
CONTROL POSITIVO · el mismo número en dos grafías («34600111222» vs «+34 600 111 222») coincide ... SÍ
CONTROL NEGATIVO · dos números distintos NO coinciden ............................................. SÍ
CONTROL          · dos vacíos NO coinciden (el `''` no es un duplicado de todos) .................. SÍ
```

**La muestra, antes que ningún porcentaje:**

```
clientes en dev ................ 14
merchants distintos ............ 6
con teléfono no vacío .......... 11
SIN teléfono ................... 3
reparto: merchant 1 → 7 · merchant 742 → 3 · los otros cuatro → 1 cada uno
```

**La medida:**

```
clientes con ALGUNA coincidencia de identificador ... 0 de 14
grupos que comparten el mismo teléfono .............. 0
```

### 🔴 LA RESPUESTA HONESTA: CON ESTA MUESTRA NO SE PUEDE DECIDIR

**14 clientes repartidos en 6 merchants, y el mayor tiene 7.** La deduplicación es POR MERCHANT
(multi-tenant), así que la población real donde un duplicado puede ocurrir es **de 7 clientes**.
Un porcentaje de falsos positivos sobre 7 filas no es un dato: es ruido con decimales.

El **0 sí es un cero de verdad** —los tres controles pasan, así que no es ceguera— pero es el cero
de una base de desarrollo sembrada, no el de una cartera real. **No dice nada sobre el riesgo del
criterio.**

**Y los otros dos números que pedía el encargo NO SE PUEDEN MEDIR HOY, ni estimar:**

- *«falsos positivos si el criterio fuera cualquiera de los dos»* → necesita el **segundo campo**.
  No existe. La única cota que da la base es «0 grupos comparten teléfono», y sobre 7 filas no vale.
- *«duplicados reales que se escaparían mirando sólo el móvil»* → ídem: sin saber cuál de los dos
  números tiene cada cliente, el número no se calcula. **Estimarlo sería inventarlo.**

> **Lo que sí se puede afirmar sin datos**, y es de diseño, no de estadística: el criterio ya
> decidido («mismo valor en CUALQUIER campo identificador») es el **más amplio** de los tres, así
> que es el que más falsos positivos produce y el que menos duplicados deja escapar. Y el aviso
> **no bloquea** —`AVISO_DUPLICADO`: «Ese dato ya lo tiene otro cliente. Revísalo por si es un
> duplicado.»—, con lo que el coste de un falso positivo es que el profesional lea una línea. Ese
> reparto de costes es el que hace defendible el criterio amplio **sin** el número.
>
> Si el fundador quiere el número de verdad, hay que medirlo **en producción**, y esta sesión no
> toca producción.

---

## 4 · EL DIFF DEL ESQUEMA — ESCRITO Y PARADO

⛔ **NO aplicado. NO commiteado en `prisma/schema.prisma`. NO creado en dev.** Va a firma antes.

```prisma
model Customer {
  // … lo que ya hay …

  /// SCRUM-590 (CONT-19) · EL MÓVIL, y es el que recibe los documentos por WhatsApp.
  /// Nullable y SIN @default, como sus siete vecinos: NULL = «no consta», que no es «no tiene».
  mobile String? @map("mobile")

  /// SCRUM-590 (CONT-19) · POR CUÁL DE LOS DOS SE ESCRIBE. String y no enum, igual que
  /// `tipoDestinatario`, `contactKind` y `billingPeriodicity`: la lista cerrada vive en Zod y
  /// añadir un valor no obliga a migrar un tipo de Postgres.
  /// ⛔ LOS VALORES SON PROPUESTA, NO DECISIÓN (regla 27): ver las tres opciones de abajo.
  waCanal String? @map("wa_canal")
}
```

```sql
-- ⛔ PREPARADO Y NO APLICADO. Aditivo: ni DROP, ni RENAME, ni NOT NULL.
ALTER TABLE "customers" ADD COLUMN "mobile"   TEXT;
ALTER TABLE "customers" ADD COLUMN "wa_canal" TEXT;
```

**Y un índice que hoy no está y que este ticket haría notar:** `customers.phone` **no tiene
índice** (sólo hay `@@index([merchantId])`). El buscador de duplicados
(`customersAdmin.routes.ts:73`) está escrito **a propósito** para que «lo resuelva el índice» —su
comentario lo dice— y hoy no hay índice que lo resuelva. Con un segundo campo serían dos columnas
sin índice en el mismo `OR`. **Se reporta; no se decide aquí** (es carril de rendimiento).

### 🔴 QUÉ PASA CON EL CAMPO ACTUAL — tres opciones, con su coste MEDIDO

| | qué se hace | coste | ¿aditivo? |
|---|---|---|---|
| **A** | `phone` se queda como **fijo**; `mobile` es nuevo | 🔴 **los 13 sitios del §2 pasarían a escribir al FIJO** en silencio. Y los tres interruptores (`if (customer.phone)`) ofrecerían «Recordar pago» a quien no se puede escribir | sí, pero **rompe comportamiento** |
| **B** | `phone` se **renombra** a `mobile` (es lo que es hoy) y nace un `phone` nuevo para el fijo | los 13 sitios se actualizan con el rename; los datos van al campo correcto sin migración de filas | ⛔ **NO**: un rename no es aditivo → STOP de esquema, y deja el esquema fuera de fase con las bases hasta que el fundador lo aplique en las tres |
| **C** | `mobile` es nuevo y el canal se resuelve **`mobile ?? phone`** | los 13 sitios cambian a un resolvedor único; **con `mobile` NULL el comportamiento de hoy es idéntico**, cliente a cliente | **sí**, y sin romper nada |

**Propuesta (no decisión): C.** Es la única que es aditiva **y** conserva el comportamiento actual
para los clientes que ya existen — el mismo criterio de «NULL = no consta» que el esquema aplica en
`contactKind`, `tipoDestinatario`, `recargoEquivalencia`, `dtoPorDefecto` y `internalRef`.

**Y C tiene una consecuencia que hay que decir:** el resolvedor `mobile ?? phone` **es** el camino
de envío. Construirlo es tocar los 13 sitios, y eso es **STOP de esta sesión**. La forma segura es
la del 586: **una pieza pura con su guard**, y los 13 llamadores pasando por ella, en un PR propio.

**Sobre `waCanal`, las tres opciones — el fundador decide (regla 27):**

1. **No existe la columna.** El canal es siempre `mobile ?? phone`. Menos estado, menos que
   mantener; el profesional no puede forzar el fijo.
2. **`waCanal` = `'MOBILE' | 'PHONE'`**, nullable. NULL = «no se ha dicho» → `mobile ?? phone`.
   Permite el caso raro (una empresa que sí atiende WhatsApp en la centralita).
3. **Sin columna, pero el orden lo decide la UI**: el profesional coloca el número que quiere que
   reciba en el campo «Móvil». Es la 1 con otro nombre y sin campo nuevo.

**No se elige aquí.** Lo que sí se mide: la opción 2 estrena un estado nuevo (Parte P/L), y eso es
cambio de máster antes de construirse.

---

## 5 · LOS RÓTULOS, SI SE CONSTRUYE — candidatos con marcador y CAJA MEDIDA

⛔ **NO están firmados.** Van con `[PENDIENTE microcopy oficial]` el día que entren en código.

Medido en navegador real (Edge por `puppeteer-core`), CSS del árbol servido desde disco, en la caja
**del modal de cliente que ya existe**, con **control positivo** (el rótulo ya firmado
«Descuento pactado (%)») y **control negativo** (400 caracteres sin cortes, que desborda).

| candidato | car. | 929 px (campo 472,0) | 390 px (campo 342,0) |
|---|---|---|---|
| *control* «Descuento pactado (%)» | 21 | 19,4 px · 1 línea | 19,4 px · 1 línea |
| *control* «Teléfono» (el de hoy) | 8 | 19,4 px · 1 línea | 19,4 px · 1 línea |
| **«Teléfono fijo»** | 13 | 19,4 px · 1 línea | 19,4 px · 1 línea |
| **«Móvil (WhatsApp)»** | 16 | 19,4 px · 1 línea | 19,4 px · 1 línea |
| «Móvil» | 5 | 19,4 px · 1 línea | 19,4 px · 1 línea |
| «Móvil (los documentos van aquí)» | 31 | 19,4 px · 1 línea | 19,4 px · 1 línea |

Input en **44,5 px**: cumple AB6 sin `min-height`, igual que el campo del 587. **Los seis caben en
una línea en las dos anchuras**, así que la caja **no descarta ninguno**: la elección es de
significado, no de espacio.

**Lo que sí dice la medición:** «Móvil» a secas no explica que ahí van los documentos, y
«Móvil (los documentos van aquí)» cabe. El coste de ser explícito aquí es **cero píxeles**.

⚠️ Y una nota de método: la primera pasada se midió **sin acentos** (`Telefono`, `Movil`) por el
escapado del shell. Se repitió con los literales exactos. Un rótulo se mide con las letras que va
a llevar.

---

## 6 · LO QUE ESTE TICKET NECESITA ANTES DE CONSTRUIRSE

1. **GO del fundador al diff** del §4 (dos columnas), y decisión sobre `waCanal` (las tres opciones).
2. **Decisión sobre A/B/C** para el campo actual. La propuesta medida es **C**.
3. **Decidir en qué formulario entran los dos campos** — modal, ficha 360, o los dos. Hoy ya
   divergen **en el propio teléfono** (§0a), así que meter dos campos sin decidirlo deja una de las
   dos pantallas coja otra vez.
4. **El PR del camino de envío va aparte**: 13 sitios, pieza pura + guard, como el 586.
5. Firma del asesor para los rótulos.

---

## 7 · HALLAZGOS DE OTRO CARRIL (regla 37 — se reportan, no se arreglan)

1. **El rótulo del teléfono en la ficha 360 está obsoleto**: sigue pidiendo «E.164 sin +» cuando
   el modal ya no lo pide y tiene selector de prefijo. Además está **en línea**, no en constante,
   así que no lo ve ningún censo de microcopy.
2. **`customers.phone` no tiene índice**, y el buscador de duplicados está escrito para apoyarse en
   uno («un `findMany` sin `where` … sería una bomba con 15.000»).
3. **Hay una segunda puerta que crea clientes** con teléfono: el cliente embebido del alta de cobro
   (`schemas.ts:352`). Cualquier campo nuevo del contacto tiene que decidir si entra también ahí.

---

## 8 · HUECOS DECLARADOS

- **No se ha construido nada**, por diseño. Esta rama sólo trae este documento.
- **No se ha creado ninguna columna**, tampoco en dev: el encargo lo prohíbe expresamente esta vez.
- **No se ha tocado el camino de envío de WhatsApp**: sólo se ha leído, por AST.
- **P-CONT-3 no queda respondida con datos**: la muestra de dev (14 clientes, 7 en el merchant
  mayor) no la aguanta, y se dice con el número delante en vez de dar un porcentaje.
- **No se ha medido producción** ni se ha nombrado ninguna credencial suya.
- **Sin capturas** y sin matriz de dispositivos completa: se midieron 929 y 390 px, que es lo que
  pedía el encargo.

---

# APÉNDICE · 7-sep-2026 — LA CONSTRUCCIÓN

**Rama:** `scrum-590-canal-de-envio-al-movil` · **Worktree:** `cobroflash-b4`
**Medido y construido contra:** `origin/main` = `d271d29aff85ed155d23397b7e6a1fca64a86bb0`
(la sesión de medición trabajó sobre `00c6cb0c`, del 6-sep; `main` ha avanzado desde entonces y
todo lo de aquí abajo está **re-medido**, no heredado del documento anterior).

> El cuerpo de este fichero, escrito el 6-sep, **midió y paró**. Este apéndice construye. No se
> corrige ni se borra nada de arriba: donde el árbol de hoy contradice aquella medición, se dice
> aquí y se dice por qué.

---

## A0 · 🔴 LO PRIMERO: ESTE TICKET YA TENÍA RAMA, Y ESTÁ EN `main`

`scrum-590-telefono-y-movil` (PR #1086) es **ancestro de `origin/main`** — comprobado con
`git merge-base --is-ancestor`, no con el estado de Jira. No trae una línea de código: son las
334 líneas de arriba. **No era un duplicado en vuelo, era la entrada de este mismo ticket**, así
que esta sesión no paró: siguió, con rama NUEVA (`scrum-590-canal-de-envio-al-movil`) para no
reescribir una rama ya mergeada.

---

## A1 · LAS TRES COSAS QUE IBAN JUNTAS

### (1) EL PIPELINE LEE EL NÚMERO MARCADO — 11 puntos de resolución, uno solo que decide

Los **11 puntos** que resolvían el destino desde `customer.phone` pasan ahora por
`canalDeWhatsApp()` (`src/core/contacto/canalDeWhatsApp.ts`). Es la forma de SCRUM-577
(`nombreParaDocumento`) y SCRUM-578 (`identificadoresDuplicados`): la regla en un sitio.

| fichero:línea | vía |
|---|---|
| `billing/app/routes/mpWebhook.routes.ts:180` · `:203` | confirmación de pago · reseña |
| `billing/app/routes/psp.routes.ts:239` · `:264` | confirmación de pago · reseña |
| `billing/domain/invoiceReminder.service.ts:130` | recordatorio de factura (7 y 14 d) |
| `billing/domain/invoiceWhatsApp.service.ts:42` | factura por WhatsApp |
| `jobs/domain/albaranWhatsApp.service.ts:55` · `:126` | albarán firmado · para firmar |
| `quotes/domain/reminder.service.ts:33` | recordatorio de presupuesto |
| `quotes/domain/sendQuote.service.ts:53` | envío del presupuesto |
| `system/app/routes/invoicesAdmin.routes.ts:627` | recordatorio manual (admin) |

**El criterio: `mobile` manda, `phone` es el respaldo. NO hay flag de canal** — la marca es
ESTRUCTURAL (recibe el número que esté en «Móvil»). El `waCanal` que el §4 dejó propuesto **NO se
crea**: sus valores serían un estado nuevo y los estados son cerrados (regla 27). Sigue medido
arriba por si el fundador lo prefiere, y añadirlo después seguiría siendo aditivo.

Con `mobile` a NULL —que es **todo cliente que existe hoy**— `canalDeWhatsApp()` devuelve
exactamente `normalizePhone(phone)`, que es la línea que había. El comportamiento de hoy no es un
caso que se respete: es el caso por defecto.

#### 🔴 Y UNA TRAMPA QUE NO ESTABA EN LA MEDICIÓN: LOS `SELECT` EXPLÍCITOS

Cablear los 11 sitios **no bastaba**. Cuatro consultas traen el cliente con un `select` explícito
que pedía `phone` y no habría pedido `mobile`: el resolvedor lo habría recibido `undefined` y el
documento se habría ido al fijo **sin fallar nada y con la tanda en verde**. Es el «quinto
eslabón» que `customerAdmin.ts` ya tiene avisado tres veces (SCRUM-579, 580, 587). Corregidos:
`albaranWhatsApp` (×2), `quotes/reminder`, `customerAdmin.CUSTOMER_SELECT_NO_TOKEN`,
`customersAdmin.routes` (ficha 360) y `jobs.routes` (×2).

Y los **filtros de consulta** de `invoiceReminder`: `customer: { phone: { not: null } }` pasa a
`OR: [phone, mobile]`. Sin eso, un cliente que sólo tuviera móvil quedaba **fuera del lote** y no
recibía su recordatorio nunca.

#### EL TRINQUETE (`tests/scrum590-el-destino-pasa-por-el-resolvedor.test.mjs`)

El sitio número doce —el que se escriba mañana— es el que de verdad importa. Guard **por AST**
(no `grep`: la prosa que explica la prohibición contiene `.phone` y un guard de texto se caza a
sí mismo, SCRUM-129). La población de senders se **deriva** de los `export` de
`integrations/whatsapp.ts` y `whatsappNotifications.ts`, y el nombre del parámetro de destino se
lee de la firma (`to` / `toPhone` / `merchantPhone`) — cablearla aquí la habría congelado, que es
lo que SCRUM-778 tuvo que deshacer con tres listas idénticas.

**Probado en rojo** con una regresión sintética (devolver `sendQuote` a `normalizePhone(quote.customer.phone)`):

```
✖ SCRUM-590 🔴 ningún envío resuelve su destino leyendo `.phone`
  + 'src/modules/quotes/domain/sendQuote.service.ts:66 (sendWhatsAppWindowFirst)
     → normalizePhone(quote.customer.phone)'
```

Lleva **suelo** (≥5 senders, ≥20 llamadas) y **control positivo** (≥8 resolviendo por el
resolvedor): un guard que no ve la población no protege nada.

### (2) LA BAJA ESTÁ ATADA AL NÚMERO — y ya lo estaba; el agujero era otro

**Medido antes de tocar, y corrige la premisa del encargo:** `isWaOptedOut` **ya** estaba atada al
número y no al registro. No mira el `waOptOut` del cliente al que se envía: compara el DESTINO
contra los teléfonos de los dados de baja de ese merchant. Eso estaba bien y no se ha cambiado.

🔴 **El agujero real que abría este ticket** era que sólo miraba UN campo:

> el cliente pide la baja · su ficha tiene el fijo en `phone` y el móvil en `mobile` · el
> documento sale al MÓVIL (que es el canal) · aquí se compara el móvil contra los `phone` de los
> dados de baja · **no coincide** · el envío pasa.

Sin error, sin log y sin que nadie se entere. Ahora la comprobación usa `numerosDelContacto()`:
**enviar mira UNO —el que toca—, proteger mira LOS DOS.**

#### Y CUATRO CONSULTAS MÁS, EN EL WEBHOOK DE ENTRADA

`whatsappIncoming.routes.ts` preguntaba «¿de quién es este número?» en **cuatro** sitios, los
cuatro mirando sólo `phone`. Con el móvil en su campo, los cuatro dejan de reconocer al cliente:

- **la BAJA no se guarda**, y encima se le contesta «Este número no tiene mensajes activos» — que
  es MENTIRA, porque los documentos le están saliendo justo a ese número;
- el acuse del «👍 Recibido» pierde el merchant;
- su «Acepto» deja de contar como decisión sobre el presupuesto;
- su mensaje normal recibe «no encontramos un presupuesto asociado a este número».

Unificadas en `dondePuedeEstarElNumero()`. **El criterio de coincidencia NO se ensancha**: siguen
siendo las dos grafías de siempre (`34…` y `+34…`); lo único que cambia es DÓNDE se busca.

### (3) LA CLAVE DE DEDUPLICACIÓN — MEDIDA Y REPORTADA. **NO TOCADA.**

El encargo lo marca como obligación y dice que la decisión no es de esta sesión. **No se ha
cambiado ni una línea de `identificadoresDuplicados.ts`.**

Medida **ejecutando `buscarCoincidencias()`** (la función del producto, importada de `dist/`), no
leyéndola, y con sus tres controles delante:

```
CONTROL POSITIVO · mismo número en dos grafías coincide ...................... SÍ
CONTROL NEGATIVO · dos números distintos NO coinciden ........................ SÍ
CONTROL          · dos vacíos NO coinciden ................................... SÍ

campos identificadores de HOY ................................ phone · email · taxId
¿participa `mobile` HOY? ..................................... NO
¿es por campo o CRUZADA? ..................... CRUZADA: mismo VALOR en CUALQUIER campo
   (candidato.phone contra existente.email, mismo texto → coincide)
¿aviso o bloqueo? ............................ AVISO: devuelve una lista, no lanza
¿el nombre es identificador? ................. NO (dos «María García» no coinciden)
```

**LA RESPUESTA A LA PREGUNTA DEL ENCARGO,** literal: hoy no se avisa por el móvil, ni por
cualquiera de los dos, ni por la pareja — **el móvil no es campo identificador**. La clave de hoy
es **«mismo valor normalizado en CUALQUIER campo identificador»**, y esos campos son tres.
**Nunca la pareja:** el código cruza todos contra todos, no campo con campo.

Consecuencia de no tocarla, dicha para que se decida a la vista: **un móvil duplicado NO avisa.**
Si el fundador quiere que avise, es **una línea** —`{ campo: 'mobile', canon: canonParaComparar }`
en `IDENTIFICADORES`— y el cruce sale solo, porque la búsqueda ya compara todos contra todos. El
comentario `⏳ PENDIENTE DE SCRUM-590` de ese fichero **sigue vivo a propósito**: hasta que se
decida, dirige bien.

---

## A2 · EL ESQUEMA — ESCRITO, **NO APLICADO**

⛔ `prisma/schema.prisma` lleva el campo; **ninguna base ha sido tocada**. `npx` no se ha usado
para nada de Prisma (CLI local: `npm run prisma:generate`).

**Preview obligatorio (SCRUM-385), offline, contra el esquema de `origin/main`:**

```
$ node scripts/preview-migracion.mjs --desde <schema de origin/main>
✔ control positivo: la herramienta responde (27 tablas).
──────── SQL QUE SE APLICARÍA ────────
ALTER TABLE "customers" ADD COLUMN     "mobile" TEXT;
──────── VEREDICTO ────────
✔ aditiva: ni DROP, ni RENAME, ni TRUNCATE, ni DELETE, ni SET NOT NULL.
```

- `docs/sql/scrum-590-movil-del-contacto.sql` — el `ALTER`, con `IF NOT EXISTS`.
- `docs/sql/deriva-prod.sql` — **regenerado** (427 columnas; entra `('customers','mobile')`).

⚠️ **ORDEN ①②③**, y aquí es lo de siempre: el `ALTER` va a las tres bases (staging →
`yaqu_dev_javier` → producción) **antes** de que el código desplegado nombre el campo. Hasta
entonces `scripts/constancia-del-alter.mjs` dirá **FALTAN** — eso es la señal funcionando, no un
fallo del PR.

---

## A3 · VERIFICACIÓN — el camino REAL, contra el doble

`tests/scrum590-el-movil-es-el-canal.test.mjs` **ejecuta** `sendQuoteWhatsAppToCustomer`, el
servicio de producción, y mira a qué número acabó llamando. Un guard de texto no habría podido
distinguir «los dos campos se guardan» de «el documento sale al móvil»: en los dos mundos hay una
línea que resuelve un destino.

⛔ **No se ha mandado ni un mensaje a ningún número real, ni un byte a Meta.** Los dobles son dos:
la BASE (`require.cache` de `dist/core/db/prisma.js`) y META (`WHATSAPP_DRY_RUN=1` +
`globalThis.__waDryRunOutbox`, el mecanismo que ya existía). En dry-run los senders **pasan todos
los guards** y sólo se saltan el HTTP — por eso el caso negativo de abajo es real.

| control | resultado |
|---|---|
| 🔴 **EL QUE DECIDE** · fijo + móvil → el documento sale al **MÓVIL** | ✅ |
| 🔴 **el sentido contrario** · y **NO** sale también al fijo | ✅ |
| ✅ **POSITIVO** · un solo número (todo cliente de hoy) → idéntico a hoy | ✅ |
| ✅ móvil en blanco (`''`, `'   '`) → cae al fijo, no deja sin canal | ✅ |
| ✅ **NEGATIVO** · baja sobre el MÓVIL → **no se manda**, con el fijo limpio | ✅ |
| control negativo del guard · una baja AJENA no bloquea este envío | ✅ |
| 🔴 **SUELO** · sin salida en el buzón, el test falla declarándose CIEGO | ✅ |

**Probado en rojo** devolviendo al árbol el código anterior (resolución por `phone` y opt-out por
`phone`):

```
✖ el documento sale al MÓVIL, no al fijo
  AssertionError: el documento NO salió al móvil. Destinos observados: ["34910000111"]   ← el FIJO
✖ opt-out sobre el MÓVIL: NO se manda, aunque el fijo esté limpio
```

Eso —`Destinos observados: ["34910000111"]`— es la medición del sentido contrario que pedía el
encargo: **con el código de antes, salía al fijo.** No es un recuerdo; se produjo.

En el caso negativo, la fila dada de baja lleva **el móvil y `phone: null`** a propósito: así el
bloqueo sólo puede venir del móvil.

---

## A4 · ⛔ LO QUE **NO** ENTRA, Y POR QUÉ

### El campo «Móvil» en el formulario — NO se ha añadido. Se propone el rótulo y se para.

No es olvido ni falta de tiempo: **un campo necesita un rótulo, y un rótulo es texto que ve el
usuario.** El encargo prohíbe literales nuevos (regla 30) y CLAUDE.md lo dice sin matices:
*«Ningún texto que vea el usuario se escribe sin firma del fundador. Se propone el literal y se
para.»*

Y la salida fácil —pintar `[PENDIENTE microcopy oficial]`— está **cerrada por medición previa**:
`customersView.js` tiene escrito, de SCRUM-575, que ese marcador *«acabó delante de un
profesional»* tres veces en una semana desde que producción despliega al mergear.

**Propuesta (no decisión), con la caja ya medida en el §5 de arriba** —los seis candidatos caben
en una línea a 929 px y a 390 px, así que la elección es de significado, no de espacio—:

> **«Móvil (WhatsApp)»** · 16 caracteres · junto a «Teléfono», mismo componente, sin selector de
> prefijo propio (el que ya existe sirve a los dos).

Firmado el rótulo, el campo es un PR pequeño: `createField` + `mobile` en el `body` del guardado.
El backend **ya lo acepta y lo devuelve** (Zod, los `select`, la normalización).

### Lo demás que se deja fuera, cada cosa con su motivo

| qué | por qué no entra |
|---|---|
| `wa_canal` | estado nuevo → regla 27. Medido en el §4; añadirlo después sigue siendo aditivo |
| el móvil en la deduplicación | **no lo decide esta sesión** (§A1.3). Es una línea cuando se decida |
| los 6 interruptores del panel (`if (customer.phone)` → «Recordar pago», `hasPhone`…) | mismo defecto, **hoy inalcanzable**: sin campo en el formulario ningún cliente puede tener móvil. Van con el PR del rótulo, que es cuando se vuelven alcanzables. Regla 37 |
| `charges.routes.ts:34` (la 2ª puerta que crea clientes) | ampliar el contrato de una API pública sin necesidad. Omitirlo **no abre agujero**: los clientes que nacen ahí no tienen móvil, o sea el comportamiento de hoy |
| `botAdmin.routes.ts:27` (lista de reparto del bot) | **sólo pinta un nombre**; no decide a dónde va un mensaje. Ésa es la línea que se ha seguido: lo que decide envío o respuesta se arregla, lo que sólo muestra se reporta |
| `exportData.ts` | la exportación es forma de datos y contrato con el profesional: otro carril |

---

## A5 · HALLAZGOS (regla 37 — se reportan, no se arreglan)

1. **`guard-dangerous` tiene un falso positivo**: leyó `git diff <ruta-rastreada> > <fichero del
   scratchpad>` como si truncara la ruta rastreada, y bloqueó. El destino del `>` era otro
   fichero. Se esquivó sin tocar el guard (regla: un guard en rojo se arregla cambiando el
   código, no el guard) — pero conviene que sepa distinguir el operando del destino.
2. **Los 6 interruptores del panel** y **`botAdmin.routes.ts:27`**, arriba, con su siguiente
   acción concreta.
3. **`customers.phone` sigue sin índice**, y ahora el buscador de duplicados tendría **dos**
   columnas sin índice en el mismo `OR` el día que el móvil entre en la deduplicación. Ya estaba
   reportado en el §7; se re-reporta porque este ticket lo empeora.
4. **El rótulo de la ficha 360 sigue obsoleto** («Teléfono (E.164 sin +)»), y sigue en línea, no
   en constante. Reportado en el §7 y sin tocar.

---

## A6 · HUECOS DECLARADOS

- **Sin campo en el formulario** (§A4), y por tanto **sin capturas ni matriz de dispositivos**:
  no se ha tocado una línea de `public/`. La skill `yaqu-premium-ui` se cargó antes de decidirlo.
- **Ninguna base tocada.** Ni producción, ni staging, ni dev. El `ALTER` está escrito y parado.
- **La deduplicación no se ha medido con datos nuevos**: el §3 ya dejó dicho que la muestra de dev
  (14 clientes, 7 en el merchant mayor) no aguanta un porcentaje, y eso no ha cambiado.
- **El trinquete no ve** el destino calculado dentro de otra función que no se sigue, ni el envío
  por alias (`const f = sendWhatsAppTemplate`). Declarado en su cabecera; falla ABIERTO (sale como
  «no juzgado», nunca como aprobado), y por eso lleva suelo de población.
- **`normalizePhone` no se ha tocado**, y era tentador: tiene ~40 llamadores y **es el número al
  que se envía el WhatsApp**. Cambiar lo que devuelve cambia a dónde se manda un mensaje.

---

## A7 · CORRECCIÓN DEL 7-sep-2026 (misma sesión, más tarde): **DEV YA ESTÁ APLICADA**

El §A2 de arriba dice «ninguna base ha sido tocada». **Eso dejó de ser cierto** cuando el fundador
pidió expresamente aplicar la columna en desarrollo. No se borra la frase —era verdad cuando se
escribió y el apéndice no se reescribe— pero **manda ésta**, que es posterior:

| base | estado |
| --- | --- |
| **desarrollo** (`acela` / `yaqu_dev_javier`) | ✅ **APLICADA y VERIFICADA** leyendo `information_schema`: `mobile \| text \| YES`, 1 fila. El catálogo pasó de 25 a 26 columnas en `customers` |
| **staging** (`acela` / `railway`) | ⏳ pendiente · la aplica el fundador |
| **producción** (`autorack` / `railway`) | ⏳ pendiente · la aplica el fundador |

Se aplicó con `scripts/aplicar-sql-dev.mjs --go`, que **sólo acepta `DATABASE_URL_DEV`** y se niega
si la base no es `yaqu_dev_javier`; el destino se comprobó ANTES con `_db-guard.mjs`
(`¿es el host de PRODUCCIÓN? NO` · `¿es la base de STAGING? NO` · `exigirDestinoCorrecto: CUADRA`).
El detalle, con la medida de antes y de después y su control positivo, está en
`docs/MIGRATIONS_PENDING.md`.

⚠️ **Y una re-medición que contradice a `CLAUDE.md`, dicha porque su regla 3 pide re-fecharla:**
ese fichero registra (10-ago-2026) que «los cuatro worktrees llevan `DATABASE_URL_STAGING`, `_DEV`
y `_TESTS`». **En `cobroflash-b4`, el 7-sep-2026, sólo está `DATABASE_URL_DEV`**: las otras dos NO
existen (`node scripts/comprobar-claves-bd.mjs` sale 1 por eso). `DATABASE_URL` tampoco, que es lo
correcto. Para esta tarea era el estado más seguro posible —no había credencial de staging que
tocar— pero el registro del máster está desfasado para este árbol y alguien debería re-fecharlo.

**El PR sigue SIN SER MERGEABLE:** faltan staging y producción, y `schemaDrift` compara
esperado ⊆ real — una columna de MENOS impide arrancar producción.

---

# APÉNDICE 2 · 8-sep-2026 — LA PANTALLA (el ticket, reabierto y cerrado)

**Medido contra:** `origin/main` = `b521d0a7299efa22153fa776c82cd28e0f907cd9` · 2026-09-08T00:18Z
**Rama:** `scrum-590b-el-campo-en-la-pantalla` · **Worktree:** `cobroflash-b4`

> El fundador **reabrió el ticket** con el motivo escrito: *«lo cerré con la mitad que toca el
> usuario sin construir. Tú dejaste el campo fuera a propósito y lo dijiste; yo lo cerré igual. Un
> falso verde es peor que un falso rojo, siempre.»* El apéndice 1 dejó el backend entero y el
> campo fuera **porque el rótulo no estaba firmado**. Ya lo está.

## B0 · ✅ EL RÓTULO, FIRMADO

**«Móvil (WhatsApp)»** — firmado por el fundador el 7-sep-2026. Va **sin marcador**, porque está
firmado, y **byte a byte en los dos formularios**. Fijado con `===` en su test, la lección de
SCRUM-575: un retoque «de paso» no puede cambiar un texto aprobado sin que algo se ponga rojo.

El paréntesis no es decoración: un campo llamado «Móvil» a secas guarda un segundo número y no
dice nada. Lo que el profesional necesita saber es que **los documentos salen por ahí** — sin esa
palabra, el campo es un dato más y la separación vuelve a ser decorativa.

## B1 · DÓNDE ENTRA, Y EL LADO — medido, no supuesto

El encargo avisa: *«Lado Persona y lado Empresa según corresponda — mídelo, no lo supongas»*.

```
switchFormaJuridica.SOLO_EMPRESA  =  ['legalName']      ← la razón social, y NADA más
docs/CONTACTOS_CAMPOS_POR_LADO.md §3.1 (COMUNES)  incluye  `phone`
```

**El móvil se ve en los DOS lados**, y por eso NO entra en el mapa que se le pasa a `aplicarLado`.
Un móvil es canal de contacto, no forma jurídica: una persona tiene móvil, y una empresa tiene el
de su persona de contacto — que es literalmente la víctima de este ticket.

**Va en LOS DOS formularios** (modal de la lista y ficha 360). El §2 de
`docs/CONTACTOS_CAMPOS_POR_LADO.md` deja medido que los dos YA divergen —`recargoEquivalencia`
sólo en uno, `billingPeriodicity` sólo en el otro— y meter el campo en uno solo habría añadido una
divergencia más, con el agravante de que ésta decide a dónde va el documento.

### Dos decisiones de forma, con su coste dicho

| | qué se hizo | por qué |
|---|---|---|
| **selector de prefijo PROPIO en el modal** | no se comparte con el fijo | compartirlo abría **corrupción silenciosa**: `repartirNumero` coloca el selector leyendo el número que reparte, así que al abrir un cliente quedaría puesto por el fijo; con prefijos distintos, al guardar se recompondría el móvil con el del fijo y **se escribiría encima un número que nadie tecleó** |
| **la ficha 360 NO lleva selector** | su móvil es un input llano, como su fijo | la regla de unión/reparto vive DENTRO de `customersView.js` y los guards de SCRUM-578 leen **esa región** del fichero; sacarla los dejaría vigilando un delegador vacío, y copiarla serían dos sitios donde divergir. Su coste está dicho en el propio fichero: ahí se puede guardar un número sin prefijo — **el mismo riesgo que ese formulario ya tiene con `phone`**, que hoy es el canal de todo |

## B2 · 🔴 EL MÓVIL SE OMITE DEL PAYLOAD CUANDO ESTÁ VACÍO — y no es estilo

**Medido ejecutando `customerCreateSchema`, no deducido:**

```
mobile: "34020000002"   ACEPTA
mobile: ""              RECHAZA · «Too small: expected string to have >=5 characters»
mobile: null            RECHAZA · «expected string, received null»
(ausente)               ACEPTA
```

Mandar el vacío —en cualquiera de sus dos formas— haría que **guardar un cliente sin móvil
devolviera un 400**. Un campo opcional que rompe el guardado del cliente entero se ha vuelto
**obligatorio de rebote**, que es exactamente lo que el control positivo del encargo prohíbe.

Consecuencia dicha en vez de descubierta: **vaciar** el móvil de un cliente que lo tiene NO lo
borra (ausente = «no toques este campo»). Es la limitación que ya tienen `phone` y `email`: se
hereda, no se estrena, y se cierra el día que el esquema acepte `null` en los tres a la vez.

### 🔴 Y LA FORMA DE ESCRIBIRLO LA DECIDIERON DOS GUARDS, no el gusto

La primera versión omitía la clave con un *spread* condicional —`...(movil ? { mobile: movil } :
{})`—. Funcionaba, y la tanda la tumbó dos veces:

| guard | qué dijo | por qué tenía razón |
|---|---|---|
| **SCRUM-692** · «ha cambiado la lista de campos que SÓLO se editan en la ficha 360: `billingPeriodicity, mobile`» | su censo por AST **no puede leer un spread**, así que no veía `mobile` en el modal y declaraba una asimetría **que no existe** | un payload que un censo no puede leer es un payload que nadie puede vigilar |
| **SCRUM-692** (el otro) · «EL MODAL ENVÍA CAMPOS QUE NO MUESTRA: `mobile ← movil || undefined`» | con `const movil = movilCompleto()` arriba, la expresión del payload no tocaba ningún control | es la acusación que ese guard existe para hacer, y aquí habría sido **falsa** |

**Arreglo, en el código y no en el guard:** la clave se escribe literal y la lectura va *inline* —
`mobile: movilCompleto() || undefined`—. En el cable pasa **exactamente lo mismo**, porque
`JSON.stringify` **borra** las claves cuyo valor es `undefined`; la diferencia es que ahora queda
ESCRITA y el censo la ve. Y se añadió `movilCompleto()` a `LEE_UN_CONTROL` —el punto de extensión
que el propio guard documenta en su mensaje— al lado de su hermano `telefonoCompleto()`.

**Y un tercero, en mi propio test:** SCRUM-553 (`el número de etiquetas con el `>` pegado NO
SUBE`) cazó que yo comprobaba el rótulo de la ficha con `` `<label>…</label>` `` literal — que
deja de encontrarlo **en silencio** en cuanto alguien añade un atributo. Cambiado a una expresión
regular que tolera atributos. Los tres se arreglaron cambiando el código; ninguno se relajó.
## B3 · VERIFICACIÓN · de la pantalla al número, EJECUTADO

`tests/scrum590b-el-campo-en-la-pantalla.test.mjs` recorre **los cinco eslabones**, ninguno
simulado salvo la base y Meta:

> ① el modal REAL (banco de vistas: los scripts del panel, en orden, en un solo contexto) → ② se
> pulsa Guardar y se captura el payload que sale por `fetch` → ③ cruza la puerta REAL
> (`customerCreateSchema`) → ④ se guarda por el camino REAL (`createCustomer`, con su
> normalización de servidor) → ⑤ esa fila entra en el camino REAL de envío.

| control | resultado |
|---|---|
| 🔴 **EL QUE DECIDE** · se guarda un móvil DESDE LA PANTALLA y el documento sale **a ese número** | ✅ |
| 🔴 **el sentido contrario, pegado** · y **NO** sale al fijo | ✅ |
| ✅ **POSITIVO** · sólo fijo → se guarda igual que hoy, la clave `mobile` **no viaja**, y el documento le llega | ✅ |
| ✅ **NEGATIVO** · opt-out sobre el MÓVIL → no se manda, con el fijo limpio | ✅ |
| el campo se ve en **los dos lados** (ejecutando `SOLO_EMPRESA`, no leyéndolo) | ✅ |
| ⛔ el móvil **NO** ha entrado en la deduplicación (ejecutando `buscarCoincidencias`, con control positivo) | ✅ |
| 🔴 **SUELO** · si el campo no está en pantalla, el test falla declarándose CIEGO | ✅ |

**Probado en rojo, dos mutaciones:**

```
A · el campo existe pero NO viaja en el payload  (la separación DECORATIVA)
  ✖ EL QUE DECIDE → «el móvil NO viaja en el alta. Payload: {…sin `mobile`…}»
B · el campo desaparece de la pantalla
  ✖ ×3 → «CIEGO: esperaba UN control llamado `mobile` en el modal y hay 0»
```

Restauradas → **6/6 en verde**.

⛔ **Cero mensajes reales**: base y Meta doblados (`_envio-doblado.mjs` + `WHATSAPP_DRY_RUN=1`), y
los números salen del **rango imposible `34 0XX…`** (SCRUM-262) — ningún abonado puede tenerlos.

## B4 · 🔴 LO QUE EL TEST DESTAPÓ AL RECORRER EL CAMINO REAL

**Hoy no se puede guardar un cliente sin email desde el modal** (ni sin teléfono): el formulario
manda `""` y el esquema lo rechaza — 400 y «Error guardando cliente». Ningún test lo veía porque
los de formulario comprobaban el payload, **no la puerta**.

**Registrado como `P1-CONT-19b` en `docs/BUGS.md`. NO se arregla aquí:** cambia el comportamiento
de dos campos que este ticket no tenía encargados, y arreglarlo «de paso» sin registrarlo es justo
lo que la casa prohíbe. El test le da un email para poder medir **lo de este ticket**, y lo dice
en el sitio donde lo hace.

## B5 · HUECOS DECLARADOS

- **Sin capturas ni matriz de dispositivos.** La caja del rótulo estaba medida en navegador real
  en el §5 (16 car., una línea a 929 y a 390 px), pero **el campo montado no se ha vuelto a medir
  en navegador**: se han añadido dos filas al modal y eso alarga la columna. La skill
  `yaqu-premium-ui` se cargó; el componente y las clases son las que ya existían (`createField`,
  `.campo-telefono`, `selectorDePrefijo`), así que **no se estrena ni un token ni una regla CSS**.
- **La ficha 360 sigue sin selector de prefijo**, con su coste escrito en el propio fichero. Es la
  divergencia del §2 de `CONTACTOS_CAMPOS_POR_LADO.md`, de otro carril.
- **El móvil no entra en la deduplicación**, y por tanto **un móvil duplicado no avisa**. Sigue en
  la mesa del fundador, con su medición en el apéndice 1.
- **`charges.routes.ts`** (la segunda puerta que crea clientes) sigue sin `mobile`: omitirlo no
  abre agujero — los clientes que nacen ahí no tienen móvil, que es el comportamiento de hoy.
