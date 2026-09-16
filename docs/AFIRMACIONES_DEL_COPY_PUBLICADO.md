# Las afirmaciones del copy publicado

**SCRUM-564.** De los 136 textos de `#como`, `#todo`, `#precios`, `#probar`
y `#faq` —que SCRUM-563 midió como *ni aprobados ni marcados*—, **28 afirman algo del
producto**. Decisión del fundador: se revisan sólo ésos. **Los que afirman pueden ser FALSOS;
los otros 108 sólo pueden ser feos.**

> ⚠️ **Generado** (`node scripts/citar-afirmaciones-publicadas.mjs`). La fuente es
> `scripts/_afirmaciones-publicadas.mjs`, que es lo que leen los tests.

> ⛔ **Este documento no corrige ni reescribe nada.** Mide y cita.

---

## El reparto

| grupo | cuántas | qué se hace |
|---|---|---|
| ✅ verdad hoy, **con ancla viva y alcanzable** | **15** | queda anclada y registrada |
| 🟡 verdad hoy, **sin ancla de código** | **1** | se declara el ancla |
| 🔴 **falsa o no verificable** | **10** | **esto es lo que va delante del fundador** |
| ⚪ descartadas (falso positivo del léxico) | **2** | no son afirmaciones |

El veredicto **se deriva del mecanismo**, no lo escribo yo en cada entrada: el símbolo tiene
que existir (`anclaViva`, SCRUM-551) **y** un merchant nuevo tiene que llegar a él
(`alcanzabilidad`, SCRUM-558). Si la etiqueta la escribiera a mano, el día que alguien
encienda un flag seguiría diciendo lo de ayer.

---

## 🔴 Falsa o no verificable — 10

**Todas por la misma puerta.** `PAYMENTS_CONNECT_ENABLED` y `BIZUM_MANUAL_ENABLED` están
**apagadas por defecto** en `src/core/flags.ts`, así que para un merchant nuevo el único
medio de cobro disponible es la **transferencia**. Es exactamente lo que hizo descartar la
fila del cobro con tarjeta en la comparativa de F5 (SCRUM-332) — reglas 18 y 23 del máster.

⚠️ Y llevan meses publicadas. **Un cambio precipitado sobre copy vivo es peor que la
afirmación**: aquí no se toca ni una palabra, se pone delante.

### `como/p#4`

```
Tarjeta, Bizum o transferencia — él elige, tú cobras. Los pendientes se reclaman solos.
```

- **sección:** `#como` · **señales:** CAPACIDAD
- **promete:** tarjeta (PAYMENTS_CONNECT_ENABLED) y Bizum (BIZUM_MANUAL_ENABLED), las dos APAGADAS por defecto. De los tres medios que enumera, un merchant nuevo sólo tiene transferencia.

### `todo/p#3`

```
Tarjeta, Bizum o transferencia. Cobra trabajos completos o por adelantado, con recordatorios que persiguen solos.
```

- **sección:** `#todo` · **señales:** CAPACIDAD
- **promete:** los mismos dos flags apagados. El final de la frase —los recordatorios— sí tiene ancla viva, pero la frase entera promete tres medios de cobro y hay uno.

### `precios/li#3`

```
Cobro con tarjeta, Bizum y transferencia
```

- **sección:** `#precios` · **señales:** CAPACIDAD
- **promete:** los mismos dos flags. Y ésta va en la LISTA DE LO QUE INCLUYE EL PLAN, al lado del precio.

### `precios/p#2`

```
Solo si cobras con tarjeta:
```

- **sección:** `#precios` · **señales:** CAPACIDAD
- **promete:** PAYMENTS_CONNECT_ENABLED=false. La frase entera del elemento es «Solo si cobras con tarjeta: 0,9 %. Bizum y transferencia: 0 €.»: anuncia la comisión de un medio de cobro que un merchant nuevo no puede usar.

### `precios/p#4`

```
Bizum y transferencia:
```

- **sección:** `#precios` · **señales:** CAPACIDAD
- **promete:** BIZUM_MANUAL_ENABLED=false. La transferencia sí existe; el Bizum no.

### `probar/span#15`

```
Paga como quiera
```

- **sección:** `#probar` · **señales:** CAPACIDAD
- **promete:** los mismos dos flags: de los tres medios que el visitante ve elegir en la demo, un merchant nuevo solo tiene uno.

### `probar/span#16`

```
Tarjeta, Bizum o transferencia.
```

- **sección:** `#probar` · **señales:** CAPACIDAD
- **promete:** los mismos dos flags, dentro de la demo.

### `probar/span#42`

```
Tarjeta
```

- **sección:** `#probar` · **señales:** CAPACIDAD
- **promete:** PAYMENTS_CONNECT_ENABLED=false.

### `probar/span#44`

```
Bizum
```

- **sección:** `#probar` · **señales:** CAPACIDAD
- **promete:** BIZUM_MANUAL_ENABLED=false.

### `faq/div#3`

```
Todo: presupuestos, firma y cobro, más clientes, proveedores, productos, gastos, informes y equipo. Es tu herramienta de gestión completa, no solo para cotizar.
```

- **sección:** `#faq` · **señales:** IDENTIDAD + CAPACIDAD
- **promete:** enumera nueve capacidades como si estuvieran todas disponibles. El «cobro» arrastra los mismos dos flags apagados que las de arriba.

---

## ✅ Verdad hoy, con ancla viva y alcanzable — 15

| identificador | texto literal | anclas |
|---|---|---|
| `como/h3#2` | «2 · Firma por WhatsApp» | `src/modules/quotes/app/routes/quotes.routes.ts::signatureUrl`<br>`src/integrations/whatsapp.ts::sendWhatsAppTemplate` |
| `como/p#3` | «Le llega como un mensaje normal con un botón. Lo abre, lo revisa y firma con el dedo.» | `src/modules/quotes/app/routes/quotes.routes.ts::signatureUrl`<br>`src/integrations/whatsapp.ts::sendWhatsAppTemplate` |
| `como/h3#3` | «3 · Cobra» | `src/modules/billing/app/routes/payBank.routes.ts::router` |
| `todo/h3#1` | «Presupuestos y firma» | `src/modules/quotes/app/routes/quotes.routes.ts::signatureUrl` |
| `precios/p#1` | «14 días gratis, sin tarjeta. Y sin letra pequeña.» | `src/modules/auth/domain/auth.service.ts::planExpiresAt` |
| `precios/li#2` | «Envío por WhatsApp + firma digital» | `src/modules/quotes/app/routes/quotes.routes.ts::signatureUrl`<br>`src/integrations/whatsapp.ts::sendWhatsAppTemplate` |
| `precios/a#1` | «Empieza gratis» | `src/modules/auth/domain/auth.service.ts::planExpiresAt` |
| `precios/p#6` | «o 16,58 €/mes pagando el año (199 € · 2 meses gratis)» | `src/modules/billing/domain/stripePrices.ts::pro_annual` |
| `probar/span#9` | «Lo firma desde el móvil» | `src/modules/quotes/app/routes/quotes.routes.ts::signatureUrl` |
| `probar/div#6` | «Firma para aceptar» | `src/modules/quotes/app/routes/quotes.routes.ts::signatureUrl` |
| `probar/div#9` | «Tu cliente paga desde el chat» | `src/integrations/whatsapp.ts::sendWhatsAppTemplate`<br>`src/modules/billing/app/routes/payBank.routes.ts::router` |
| `probar/span#46` | «Transferencia» | `src/modules/billing/app/routes/payBank.routes.ts::router` |
| `faq/div#1` | «Exacto — por eso esto ES WhatsApp. La diferencia: el tuyo no firma, no cobra y no persigue al que no contesta. Y aquí además llevas clientes, gastos y facturas en el mismo sitio.» | `src/modules/quotes/app/routes/quotes.routes.ts::signatureUrl`<br>`src/modules/billing/domain/invoiceReminder.service.ts::sendInvoicePaymentReminders` |
| `faq/div#2` | «Nada. Les llega un WhatsApp normal con un enlace: lo abren, ven el presupuesto y tienen dos botones — Firmar y Pagar. Y si prefieren transferencia de toda la vida, también vale.» | `src/modules/quotes/app/routes/quotes.routes.ts::signatureUrl`<br>`src/integrations/whatsapp.ts::sendWhatsAppTemplate`<br>`src/modules/billing/domain/invoiceReminder.service.ts::sendInvoicePaymentReminders` |
| `faq/div#4` | «Sin permanencia. Tus datos son tuyos: clientes, presupuestos, facturas, cobros, trabajos y gastos se exportan en CSV cuando quieras.» | `src/modules/exports/domain/exportData.ts::csvBody` |

## 🟡 Verdad hoy, sin ancla de código — 1

- `todo/h2#1` — «Seis herramientas. Una sola app.» · **dice 6, hay 6 .prod**
  - no es un símbolo del código: es un RECUENTO. La frase dice cuántas cosas hay, y las cosas están en el marcado — seis `.prod` en #todo. Ya lleva trinquete en tests/scrum555-lo-que-el-censo-no-ve.test.mjs, entre las cifras acopladas.

## ⚪ Descartadas — 2

El léxico es **suelo, no techo**: marca por palabras y se equivoca en las dos direcciones
(medido en SCRUM-555: se le escapa una de cada tres promesas del bloque F). Éstas las marca y
**no son afirmaciones del producto**. Se descartan con su motivo, revisadas con el texto
literal delante — no se toca el léxico para que dejen de aparecer.

- `probar/div#1` — «app.yaqu.app · Nuevo presupuesto»
  - marca IDENTIDAD por la palabra «app», y es la BARRA DE DIRECCIONES de un navegador simulado dentro de la demo. No afirma nada del producto: enseña una URL.
- `faq/summary#1` — «Ya mando presupuestos por WhatsApp gratis. ¿Para qué esto?»
  - marca CONDICION por «gratis», y es la PREGUNTA DEL CLIENTE, no una promesa de YaQu. Lo gratis que se nombra es WhatsApp, no el producto.

---

## Lo que queda fuera de alcance

**108 textos** de las cinco secciones. no afirman ninguna capacidad, condición ni identidad del producto: sólo pueden ser feos, no falsos (decisión del fundador, 20-ago-2026).

Se cuentan, no se callan: «no revisado» y «no existe» se leen igual si nadie escribe la
diferencia.

| sección | textos | de ellos afirman | fuera de alcance |
|---|---|---|---|
| `#como` | 9 | 4 | 5 |
| `#todo` | 15 | 3 | 12 |
| `#precios` | 26 | 7 | 19 |
| `#probar` | 75 | 9 | 66 |
| `#faq` | 11 | 5 | 6 |
| **TOTAL** | **136** | **28** | **108** |

⚠️ **Por qué el extractor de aquí no es el del bloque F:** aquél mira `h1|h2|h3|p|li` y en
estas cinco secciones eso ve 37 de los textos. En `#faq` es casi ciego —las preguntas van en
`<details>/<summary>`— y **las 5 afirmaciones de `#faq` y las 9 de `#probar` caen todas
fuera**. Contar 28 y medir 12 habría sido peor que no medir, así que aquí la unidad es
**cualquier elemento que contenga texto directamente**, con el mismo esquema de
identificadores derivados.

