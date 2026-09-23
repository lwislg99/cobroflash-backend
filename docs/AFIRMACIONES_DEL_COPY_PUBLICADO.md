# Las afirmaciones del copy publicado

**SCRUM-564.** De los 98 textos de `#como`, `#todo`, `#precios`, `#probar`
y `#faq` —que SCRUM-563 midió como *ni aprobados ni marcados*—, **17 afirman algo del
producto**. Decisión del fundador: se revisan sólo ésos. **Los que afirman pueden ser FALSOS;
los otros 81 sólo pueden ser feos.**

> ⚠️ **Generado** (`node scripts/citar-afirmaciones-publicadas.mjs`). La fuente es
> `scripts/_afirmaciones-publicadas.mjs`, que es lo que leen los tests.

> ⛔ **Este documento no corrige ni reescribe nada.** Mide y cita.

---

## El reparto

| grupo | cuántas | qué se hace |
|---|---|---|
| ✅ verdad hoy, **con ancla viva y alcanzable** | **12** | queda anclada y registrada |
| 🟡 verdad hoy, **sin ancla de código** | **1** | se declara el ancla |
| 🔴 **falsa o no verificable** | **2** | **esto es lo que va delante del fundador** |
| ⚪ descartadas (falso positivo del léxico) | **2** | no son afirmaciones |

El veredicto **se deriva del mecanismo**, no lo escribo yo en cada entrada: el símbolo tiene
que existir (`anclaViva`, SCRUM-551) **y** un merchant nuevo tiene que llegar a él
(`alcanzabilidad`, SCRUM-558). Si la etiqueta la escribiera a mano, el día que alguien
encienda un flag seguiría diciendo lo de ayer.

---

## 🔴 Falsa o no verificable — 2

**Todas por la misma puerta.** `PAYMENTS_CONNECT_ENABLED` y `BIZUM_MANUAL_ENABLED` están
**apagadas por defecto** en `src/core/flags.ts`, así que para un merchant nuevo el único
medio de cobro disponible es la **transferencia**. Es exactamente lo que hizo descartar la
fila del cobro con tarjeta en la comparativa de F5 (SCRUM-332) — reglas 18 y 23 del máster.

⚠️ Y llevan meses publicadas. **Un cambio precipitado sobre copy vivo es peor que la
afirmación**: aquí no se toca ni una palabra, se pone delante.

### `todo/p#3`

```
Tarjeta, Bizum o transferencia. Cobra trabajos completos o por adelantado, con recordatorios que persiguen solos.
```

- **sección:** `#todo` · **señales:** CAPACIDAD
- **promete:** undefined

### `faq/div#3`

```
Todo: presupuestos y firma, más clientes, proveedores, productos, gastos, informes y equipo. Es tu herramienta de gestión completa, no solo para cotizar.
```

- **sección:** `#faq` · **señales:** IDENTIDAD + CAPACIDAD
- **promete:** enumera ocho capacidades como si estuvieran todas disponibles (SCRUM-1086 retiró «cobro» de la lista; antes eran nueve, con el mismo motivo que las de arriba).

---

## ✅ Verdad hoy, con ancla viva y alcanzable — 12

| identificador | texto literal | anclas |
|---|---|---|
| `como/h3#2` | «2 · Firma por WhatsApp» | `src/modules/quotes/app/routes/quotes.routes.ts::signatureUrl`<br>`src/integrations/whatsapp.ts::sendWhatsAppTemplate` |
| `como/p#3` | «Le llega como un mensaje normal con un botón. Lo abre, lo revisa y firma con el dedo.» | `src/modules/quotes/app/routes/quotes.routes.ts::signatureUrl`<br>`src/integrations/whatsapp.ts::sendWhatsAppTemplate` |
| `todo/h3#1` | «Presupuestos y firma» | `src/modules/quotes/app/routes/quotes.routes.ts::signatureUrl` |
| `precios/p#1` | «14 días gratis, sin tarjeta. Y sin letra pequeña.» | `src/modules/auth/domain/auth.service.ts::planExpiresAt` |
| `precios/li#2` | «Envío por WhatsApp + firma digital» | `src/modules/quotes/app/routes/quotes.routes.ts::signatureUrl`<br>`src/integrations/whatsapp.ts::sendWhatsAppTemplate` |
| `precios/li#3` | «Recordatorios automáticos de firma» | `src/modules/quotes/domain/reminder.service.ts::sendPendingReminders` |
| `precios/a#1` | «Empieza gratis» | `src/modules/auth/domain/auth.service.ts::planExpiresAt` |
| `precios/p#2` | «o 16,58 €/mes pagando el año (199 € · 2 meses gratis)» | `src/modules/billing/domain/stripePrices.ts::pro_annual` |
| `probar/span#9` | «Lo firma desde el móvil» | `src/modules/quotes/app/routes/quotes.routes.ts::signatureUrl` |
| `probar/div#6` | «Firma para aceptar» | `src/modules/quotes/app/routes/quotes.routes.ts::signatureUrl` |
| `faq/div#1` | «Exacto — por eso esto ES WhatsApp. La diferencia: el tuyo no firma ni lleva el seguimiento solo. Y aquí además llevas clientes, gastos y facturas en el mismo sitio.» | `src/modules/quotes/app/routes/quotes.routes.ts::signatureUrl`<br>`src/modules/quotes/domain/reminder.service.ts::sendPendingReminders` |
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

**81 textos** de las cinco secciones. no afirman ninguna capacidad, condición ni identidad del producto: sólo pueden ser feos, no falsos (decisión del fundador, 20-ago-2026).

Se cuentan, no se callan: «no revisado» y «no existe» se leen igual si nadie escribe la
diferencia.

| sección | textos | de ellos afirman | fuera de alcance |
|---|---|---|---|
| `#como` | 9 | 2 | 7 |
| `#todo` | 15 | 3 | 12 |
| `#precios` | 20 | 5 | 15 |
| `#probar` | 43 | 3 | 40 |
| `#faq` | 11 | 4 | 7 |
| **TOTAL** | **98** | **17** | **81** |

⚠️ **Por qué el extractor de aquí no es el del bloque F:** aquél mira `h1|h2|h3|p|li` y en
estas cinco secciones eso ve 37 de los textos. En `#faq` es casi ciego —las preguntas van en
`<details>/<summary>`— y **las 5 afirmaciones de `#faq` y las 9 de `#probar` caen todas
fuera**. Contar 28 y medir 12 habría sido peor que no medir, así que aquí la unidad es
**cualquier elemento que contenga texto directamente**, con el mismo esquema de
identificadores derivados.

