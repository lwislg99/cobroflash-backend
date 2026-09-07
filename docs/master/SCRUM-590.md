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
