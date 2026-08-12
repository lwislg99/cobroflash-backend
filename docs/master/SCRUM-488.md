# SCRUM-488 · Dos vocabularios de `paid_via` — la medición, y el total de tarjeta que iba PARTIDO

**Medido contra:** `origin/main` = `bf54914117fb99e596aa7d638c9ebac8ac809564` · 2026-08-12T11:46:06+01:00

**12-ago-2026** · **Carril:** Cobros / Informes · **Gate:** sin gate, corre en `npm test`

> **El ticket tiene DOS fases y las dos están en este documento.**
>
> · **FASE 1 · MEDIR** (mañana del 12-ago, `16d9f6ff`) — secciones ① a ⑥. Censa los dos
>   vocabularios y encuentra debajo algo más gordo que la grafía: el informe agrupa por el valor
>   CRUDO. **No pinta nada**: el texto lo aprueba el asesor (regla 30).
> · **FASE 2 · ARREGLAR LA AGRUPACIÓN** (tarde del 12-ago) — sección ⑦. La clave del informe pasa a
>   ser el CUBO. **Ni un rótulo cambia**, y por eso no hace falta que el asesor apruebe nada.
>
> 🔸 La fase 1 midió contra `origin/main` = `db820c35` (**comprobado en la fase 2: el commit existe
> y es ancestro de `main`**). Lo que sí estaba mal ahí era la HORA: el ancla decía `11:40+01:00` y
> el commit que la trae es de las `10:14+01:00` — una hora escrita a ojo, no leída del reloj. El
> guard de SCRUM-267 valida la FORMA, no que la hora sea la que fue.

> 🔸 **`main` se movió SEIS veces durante este ticket**: `3d8c1d7d` → `90e810ad` → `db820c35`
> (fase 1) → `d5fdedaf` → `aa743fe3` → `934ce469` → `bf549141` (fase 2, movida por otras sesiones:
> los cuatro worktrees comparten refs). Se mergeó `main` DENTRO de la rama cada vez —nunca al revés,
> nunca rebase—, se regeneró el cliente de Prisma en ESTE worktree después de cada uno, y **los
> números de abajo son de después del último merge**.

---

## 🔴 LO PRIMERO, PORQUE CAMBIA EL TAMAÑO DEL TICKET: hay un total PARTIDO en Informes

La pregunta del encargo era si Informes **agrupa** por el valor que etiqueta. La respuesta es que sí,
y por el valor **CRUDO**:

```ts
// src/modules/reports/app/routes/reports.routes.ts:164
const method = inv.charge?.method || 'manual';
const cur = byMethodMap.get(method) ?? { eur: 0, count: 0 };
```

`card` y `card:stripe` son **dos filas separadas** del informe «Cómo te pagan». Y las dos se
etiquetan **«💳 Tarjeta»** — no por descuido: lo **exige** el guard de SCRUM-398
(`scrum398-vocabulario-de-cobro.test.mjs:158`), y con razón, porque las dos son un cobro con tarjeta.

**Medido en la pantalla pintada** (banco de un solo uso, `index.html` servido del disco):

| lo que ve el profesional | € | cobros |
|---|---|---|
| 💳 Tarjeta | 3.210,40 | 9 |
| 💳 Tarjeta | 2.870,15 | 7 |

**Dos filas idénticas con importes distintos, y en ninguna parte el total de lo cobrado con
tarjeta.** No es un texto impreciso: es la respuesta a «¿cuánto he cobrado con tarjeta este año?»
partida en dos trozos que el profesional tiene que sumar a mano sin saber por qué son dos. Y la
barra de comparación se dibuja sobre `maxEur`, así que **también el gráfico compara mal**.

**El servidor ya sabe unirlos.** `cuboDeCobro('card') === cuboDeCobro('card:stripe') === 'card'`, y
es lo que hace que el filtro de Cobros funcione desde SCRUM-474. **El informe tiene esa función al
lado y no la usa.**

> 🔸 **Cuánto dinero es**: no se ha medido contra producción en este ticket. Lo que sí consta es la
> medición registrada en `docs/master/SCRUM-474.md`: **38 de 51 cobros repartidos entre `card` y
> `card:stripe`** en producción el 11-ago-2026, sobre la misma columna (`Charge.method`). Quien
> arregle esto debería re-medirlo el día que lo toque.

**En la fase 1 NO se arregla** — su encargo lo dice: ningún agrupamiento se cambia, se mide. Queda
como hallazgo con su guard: si la ruta empieza a normalizar, el test cae **pidiendo que se rehaga
esta medición** en vez de quedarse callado. → **Se arregló en la fase 2 (⑦), y el guard hizo
exactamente eso: hubo que rehacer la medición, que es la tabla de ⑦.**

---

## ① EL CENSO DE LOS DOS VOCABULARIOS

**No son dos mapas simétricos.** Uno es una tabla de textos; el otro es una composición.

| | COBROS | INFORMES |
|---|---|---|
| dónde vive | `cubosDeMetodo` (**servidor**, derivado de `PAID_VIA`) + `COBROS_MATICES` y `COBROS_PASARELAS` (`cobrosView.js`) | `paidViaEtiquetas.js` (**navegador**) |
| qué es | una **composición**: `<método> · <calificador>` | un **diccionario**: valor → texto |
| cuántas entradas | 5 cubos + 2 matices + 2 pasarelas | 5 del conjunto + 2 heredados |
| desconocido | «Método no registrado» | «⚠️ Método no reconocido (**valor crudo**)» |
| ticket | SCRUM-474 fase 2 + SCRUM-481 | SCRUM-398 |

### Las 7 filas, con las dos lecturas del MISMO cobro

| valor | COBROS | INFORMES | ¿divergen? |
|---|---|---|---|
| `card` | tarjeta | 💳 Tarjeta | no |
| `transfer` | transferencia | 🏦 Transferencia | no |
| `cash` | efectivo | 💶 Efectivo | no |
| `bizum_auto` | **Bizum · automático** | **📲 Bizum** | **SÍ** |
| `bizum_manual` | **Bizum · manual** | **📲 Bizum (confirmado a mano)** | **SÍ** |
| `card:stripe` | **tarjeta · Stripe** | **💳 Tarjeta** | **SÍ** |
| `manual` | **Método no registrado** | **✍️ Marcado a mano** | **SÍ** |

**Cuatro de siete, y `bizum_manual` no era la única** — la entrada del encargo nombraba solo ésa.

🔸 **El emoji NO cuenta como divergencia**, a propósito: «tarjeta» y «💳 Tarjeta» no dicen cosas
distintas, una decora a la otra. Si se comparase carácter a carácter saldrían las siete y el número
no significaría nada. El comparador tiene su **control negativo** (no marca el emoji) y su control
positivo (sí marca «Bizum · manual» contra «Bizum (confirmado a mano)»).

### 🔴 `manual` no es una divergencia de grafía: son DOS AFIRMACIONES DISTINTAS

Es la más grave de las cuatro y la que no se arregla eligiendo un texto más bonito.

* **Cobros** dice **«Método no registrado»**, y es verdad: `Invoice` **no guarda método de cobro**
  (`cobros.service.ts`: «no consta: la Invoice no guarda método. No se inventa»).
* **Informes** dice **«✍️ Marcado a mano»**, y también es verdad: `manual` **no es un valor de la
  base**, lo FABRICA `reports.routes.ts:164` al leer una factura pagada sin `Charge` — o sea, una
  que alguien marcó a mano en el panel.

Son dos hechos distintos sobre el mismo cobro: **de qué forma entró el dinero** (no consta) y **cómo
se registró** (lo marcó una persona). Unificar a lo bruto pierde uno de los dos. Va a la propuesta
como decisión aparte.

---

## ② ¿ES UNA TERCERA COPIA DE LA PARTICIÓN? **NO**, y así se comprueba

`COPIAS_DE_LA_PARTICION` sigue en **2** (`partirMetodo` y `metodoSinPasarela`). `paidViaEtiquetas.js`
**no parte por «:»**: trata `card:stripe` como **clave entera** de un diccionario. Es un mapa, no una
regla.

Comprobado con el **mismo detector del trinquete de SCRUM-474**, autoprobado antes de creerse su
cero (ve una partición sintética, y discrimina una función que solo toca cadenas), y con la
consecuencia observable:

```
etiquetaMetodoCobro('card:paypal') === '⚠️ Método no reconocido (card:paypal)'
```

**Si partiera, diría «Tarjeta».** Que no lo haga es la prueba de que no hay regla de partición
detrás. Y queda un guard: el día que empiece a partir, salta pidiendo que se declare en el trinquete.

> 🔸 **Esto es también un límite del vocabulario de Informes**, no solo una virtud: `card:mercadopago`
> —o cualquier pasarela nueva— saldría como «no reconocido» aunque sea una tarjeta perfectamente
> normal. Cobros sí lo resuelve, porque compone. Va a la propuesta.

---

## ③ LAS DOS CAJAS, MEDIDAS EN NAVEGADOR

### Cobros — medido en SCRUM-481, sin cambios

Columna `Método`: **198 px** a 641 y 768 px con el techo componible («transferencia · MercadoPago»,
27), ninguna celda cortada, sin scroll. Oculta a ≤640 px. Detalle en `docs/master/SCRUM-481.md`.

### Informes — caja FIJA de 150 px, y aquí el techo NO EXISTE

`reportsView.js:384`: `<span style="width:150px;flex:none;font-size:13px">`. Sin `overflow`, con
`white-space: normal`: el texto **no se corta, hace wrap y crece en alto**; y si no puede partirse,
**se sale de su caja**.

| etiqueta | largo | alto | pide | ¿desborda? |
|---|---|---|---|---|
| 💳 Tarjeta · 🏦 Transferencia · 💶 Efectivo · 📲 Bizum · ✍️ Marcado a mano | 8–17 | 20 px | 150 | no |
| **📲 Bizum (confirmado a mano)** | 28 | **40 px** (2 líneas) | 150 | no |
| **⚠️ Método no reconocido (`sepa_transfer_instantanea_...`)** | 76 | **60 px** (3 líneas) | **341 px** | **SÍ** |

🔴 **La lección de SCRUM-481 aplicada, y da un resultado peor:** allí se dio por techo un ancho de 21
que era el de la tarjeta, cuando el componible era 27. Aquí **el techo componible no existe**:
`etiquetaMetodoCobro` mete el **valor crudo dentro del texto**, y `charge.method` es una columna de
texto libre para quien la lee. Un valor de 49 caracteres sin espacios **se sale de la caja y pisa la
barra de progreso** — medido, no supuesto (`scrollWidth` 341 contra `clientWidth` 150).

Las etiquetas **aprobadas** sí tienen techo: **28** unidades UTF-16 («📲 Bizum (confirmado a mano)»,
27 caracteres visibles — el emoji cuenta 2). Ese número queda atado en el test.

### Y la propuesta MEJORA la caja — medido en la misma pantalla

Sustituyendo los textos por los propuestos, en el mismo span de 150 px:

| | hoy | con la propuesta |
|---|---|---|
| filas a 2 líneas | «📲 Bizum (confirmado a mano)» | «⚠️ Método no registrado» |
| filas a 3 líneas | el «no reconocido» con valor largo | **ninguna** |
| **desbordes** | **1** (341 px en una caja de 150) | **ninguno** |

---

## ④ LA PROPUESTA DE LA FASE 1 — ⛔ **DESCARTADA**, ver ⑦

> 🔴 **ESTA SECCIÓN YA NO ES EL PLAN.** Se deja escrita porque el motivo por el que se descartó es
> parte del hallazgo: componer en Informes es lo que habría roto el guard de SCRUM-398 —la propia
> fase 1 lo midió y no lo vio—. El fondo: **Cobros cuenta cobros INDIVIDUALES** (ahí cabe «Bizum ·
> manual») e **Informes cuenta FAMILIAS** (ahí manda el cubo, «📲 Bizum»). Dos rótulos para el mismo
> dato no son un choque de vocabulario cuando las pantallas cuentan unidades distintas. **El choque
> estaba en la AGRUPACIÓN**, y es lo único que arregla la fase 2.

**Mecanismo:** Informes deja de tener diccionario propio y **compone igual que Cobros** —el rótulo
del cubo lo sirve el servidor (`cubosDeMetodo`, derivado de `PAID_VIA`), el matiz y la pasarela los
pone `cobrosView`—. El **emoji se queda como decoración de Informes**, delante del texto: es lo único
de su vocabulario que no es vocabulario, y es lo que hace legible una lista de barras.

| valor | COBROS | INFORMES (propuesto) |
|---|---|---|
| `card` | tarjeta | 💳 tarjeta |
| `card:stripe` | tarjeta · Stripe | 💳 **tarjeta · Stripe** |
| `bizum_auto` | Bizum · automático | 📲 **Bizum · automático** |
| `bizum_manual` | Bizum · manual | 📲 **Bizum · manual** |
| `transfer` | transferencia | 🏦 transferencia |
| `cash` | efectivo | 💶 efectivo |

**Por qué gana la composición y no el diccionario:** el diccionario tiene que crecer con cada valor
nuevo (y hoy ya deja fuera cualquier pasarela que no sea Stripe), mientras que la composición sale
de `PAID_VIA` y **no puede quedarse corta sin que el guard de SCRUM-398 lo diga**. Además es la que
sobrevive a la pasarela número tres.

### 🔴 Decisión 1 · qué dice el informe de un cobro sin `Charge` (`manual`) — **RESUELTA: sale de 488**

> **Tiene ticket propio, SCRUM-491, bloqueado.** No es de grafía: Cobros dice que no consta el
> método e Informes dice que lo marcó una persona, y **las dos son ciertas porque hablan de cosas
> distintas** —método y registro—. En la fase 2 su fila se queda EXACTAMENTE como estaba, y hay un
> control negativo que lo comprueba.

Las dos frases son ciertas y dicen cosas distintas (arriba, ①). Tres salidas:

1. **«Método no registrado»** — unifica con Cobros; se pierde que lo marcó una persona.
2. **«Marcado a mano»** en las dos pantallas — unifica al revés; en Cobros habría que aprobar ese
   texto para un cobro cuyo método sigue sin constar.
3. **Las dos cosas, en sitios distintos**: el método no consta (vocabulario) y el registro fue manual
   (otra columna o un matiz). Es lo único que no pierde información — y es más trabajo.

**Propongo la 3**, y si hay que elegir hoy, la **1**: entre afirmar de menos y afirmar de más sobre
cómo entró el dinero, en una pantalla que se cruza con el banco, se afirma de menos.

### 🔴 Decisión 2 · el valor crudo del desconocido (398 y 481 se contradicen) — **RESUELTA: no había nada que resolver**

> **Sin composición en Informes, ninguna de las dos afirmaciones se contradice**: 398 pide el valor
> crudo en la etiqueta DE INFORMES y 481 lo prohíbe EN COBROS, y son pantallas distintas. El valor
> crudo **no se toca hoy**: que llegue a pantalla un valor que `PAID_VIA` no conoce es síntoma de
> que alguien escribe fuera del conjunto cerrado (regla 22), y eso lo cierran SCRUM-486 y SCRUM-489
> por el lado de quién escribe. La fase 2 deja esa fila igual que estaba.

* **SCRUM-398** exige que el valor vaya **dentro** de la etiqueta: «quien lo vea tiene que poder
  investigarlo» (su guard lo comprueba: `etiqueta.includes(desconocido)`).
* **SCRUM-481** exige lo contrario en Cobros: **nunca** se le enseña al profesional el valor de la
  base de datos.

**Los dos están aprobados, y no pueden cumplirse a la vez con un solo texto.** No lo resuelvo yo:
relajar el guard de 398 sería tocar un guard ajeno (STOP 3). Salidas: (a) el valor crudo solo en
Informes, declarando la asimetría con su motivo; (b) el valor crudo en ninguna de las dos y que se
investigue por el export, que es donde el asesor ya cruza los datos.

**Propongo la (a)**: Informes es la pantalla de repaso anual, no la operativa, y ahí el valor raro es
justo lo que hay que poder mirar. Pero con **la caja arreglada**, porque hoy ese texto se sale de su
span (③).

---

## Verificación de la FASE 1

* **SUELO** — si cualquiera de los dos censos devuelve cero, el fichero **falla declarándose ciego**:
  «cero» y «no supe mirar» no pueden dar el mismo verde.
* **CONTROL POSITIVO** — con el mecanismo propuesto, las dos pantallas dicen lo mismo para los 7
  valores (con y sin emoji), ejercido en el test.
* **🔴 CONTROL NEGATIVO, y protege el dinero** — la unificación **no cambia ningún cubo**:
  `cuboDeCobro` decide igual antes y después de componer el rótulo. Un rótulo no puede mover dinero
  de sitio. Y se deja dicho que **la propuesta NO arregla el total partido** de ③, para que nadie lo
  dé por cerrado.
* **ROJO POR MECANISMO, en los dos sentidos** — se provoca la divergencia sobre una copia del mapa
  (restaurando en `finally`): si aparece una **nueva**, el guard cae **nombrando el valor y las dos
  grafías**; si una **desaparece** sin aprobación, también — un recuento que baja es **sospecha**, no
  mejora.
* **Detectores autoprobados** — el de particiones (ve y discrimina) y el localizador de la agrupación
  del informe (si no la encuentra, se declara ciego en vez de concluir «no agrupa por el crudo», que
  sería la conclusión contraria a la verdadera).

## Verificación de la tanda de la FASE 1

Con `main` (`90e810ad`) dentro y **`scrum-481-metodo-en-castellano` mergeada**, porque sin ella la
premisa de este ticket no existe: **481 todavía no está en `main`**, y en `main` puro la columna de
Cobros pinta el valor crudo. Lo que se mide aquí es el estado que habrá cuando 481 entre.

| | ficheros | tests | pass | fail | skipped |
|---|---|---|---|---|---|
| **línea base** (los tests que declara `main`, este árbol) | 435 | **3.306** | **3.229** | **0** | **77** |
| **después** (tanda entera) | 437 | **3.338** | **3.261** | **0** | **77** |
| diferencia | +2 | **+32** | **+32** | **0** | **0** |

* `npm run guards:entrada` — **17 tests, 4 guards, 0 fail**.
* **Marcadores con el guard oficial** `tests/scrum393` — **6 tests, 0 fail** (0 · 0 · 0).
* **Ni un salto nuevo**: los 77 `skipped` son los mismos antes y después.

> 🔸 Los dos ficheros de más son `scrum481-…` y `scrum488-…`; sus **32 tests** son los 20 de 481 y
> los 12 de éste. La línea base se mide con el conjunto que `main` declara (`git ls-tree`), sobre
> este árbol y **sin borrar ficheros del disco**.

> 🔴 **Y un rojo propio que apareció aquí y se arregló en su rama.** La tanda de este ticket destapó
> que `docs/master/SCRUM-481.md` tumbaba el guard de **SCRUM-267**: el ancla estaba partida en dos
> líneas. **No es de este ticket, es de 481** — se arregló allí (`8f289716`), se re-corrió su tanda
> entera, y de ahí volvió por el merge. La causa está escrita en su entrada: **su tanda se corrió
> antes de la última edición del documento**, que es justo el orden que la casa prohíbe.

## Ficheros de la FASE 1

* `tests/scrum488-un-solo-vocabulario.test.mjs` (nuevo, **12 tests**) — el censo, los dos detectores
  autoprobados, el hallazgo de ③ y el mecanismo propuesto ejercido sin pintarlo.
* `docs/master/SCRUM-488.md` (este).
* **Ni una línea de `public/`**: es un ticket de medición.

---

# ⑦ FASE 2 · LA CLAVE DEL INFORME PASA A SER EL CUBO

**La víctima, en una línea:** un profesional abre Informes, ve DOS filas «💳 Tarjeta», no ve en
ninguna parte cuánto cobró con tarjeta, y la barra le compara dos trozos de lo mismo contra un
tercero entero.

## ⑦.1 Qué se construye, y qué NO

`reports.routes.ts` deja de usar `inv.charge?.method` como clave del mapa y delega el reparto en
`agruparCobrosPorCubo` (`src/modules/reports/domain/cobrosPorCubo.ts`, nuevo), cuya clave es
`cuboDeCobro(metodo)` — la MISMA función con la que el filtro de Cobros une las dos tarjetas desde
SCRUM-474. El informe la tenía en el módulo de al lado y no la usaba.

**Lo que NO se toca, y no por descuido:**

| | por qué |
|---|---|
| `paidViaEtiquetas.js` y el diccionario de SCRUM-398 | cero cambios de rótulo: el choque estaba en la agrupación |
| el guard de SCRUM-398 | **sigue verde sin tocarlo** (⑦.4) |
| `public/dashboard/js/reportsView.js` | **ni una línea**: la vista sigue resolviendo `etiquetaMetodoCobro(m.method)` |
| `public/dashboard/js/cobrosView.js` | es SCRUM-481, ya en `main` |
| la fila de `manual` | es SCRUM-491, y sale idéntica |
| el valor crudo del «no reconocido» | lo cierran SCRUM-486 / SCRUM-489 por el lado de quién escribe |

## ⑦.2 🔴 POR QUÉ LA FILA VIAJA CON UN VALOR DE `PAID_VIA` Y NO CON LA CLAVE DEL CUBO

Es la única decisión de diseño del ticket, y está **medida en navegador, no supuesta**. La clave del
cubo `bizum` **no es un valor de `paid_via`**, así que mandarla tal cual le habría enseñado esto al
profesional en la fila más normal de su informe:

```
etiquetaMetodoCobro('bizum')      === '⚠️ Método no reconocido (bizum)'   ← lo que se evita
etiquetaMetodoCobro('bizum_auto') === '📲 Bizum'                          ← lo que se pinta
```

Así que cada fila agrupada viaja con el **REPRESENTANTE** de su cubo: **el primer valor de
`PAID_VIA` que cae en él**. No es una lista nueva ni un rótulo nuevo —se deriva del conjunto
cerrado— y el rótulo que acaba pintándose es el que la familia YA tiene hoy. Cambiar la vista para
que pintase un rótulo servido por el servidor habría **tumbado el guard de SCRUM-398**, que
comprueba sobre el fuente de la vista que la llamada `etiquetaMetodoCobro(m.method)` sigue ahí: eso
era el STOP 3, y por eso el diseño va por aquí y no por ahí.

⚠️ **El riesgo que deja, atado:** el representante sale del ORDEN de `PAID_VIA`, así que reordenar
el conjunto podría rebautizar una familia en silencio (si `bizum_manual` pasara delante, la fila
diría «📲 Bizum (confirmado a mano)», que es el nombre de UNA de las dos mitades). Lo caza el ANCLA
de ⑦.4: la etiqueta del representante tiene que ser la del CUBO.

## ⑦.3 🔴 LA MISMA TABLA DE ③, ANTES Y DESPUÉS — **medida en la pantalla pintada**

Banco de un solo uso, `reportsView.js` y `paidViaEtiquetas.js` **reales** servidos del disco, el
`loadX2` de verdad, y las cargas útiles que produce el reparto que corre. Importes y nº de cobros
leídos del DOM, no calculados aparte. Evidencia:
`docs/master/evidencias/scrum488/scrum488-informe-antes-despues.png`.

| ANTES (la clave era el valor crudo) | € | cobros | | DESPUÉS (la clave es el cubo) | € | cobros |
|---|---|---|---|---|---|---|
| 💳 Tarjeta | 3.210,40 | 9 | → | **💳 Tarjeta** | **6.080,55** | **16** |
| 💳 Tarjeta | 2.870,15 | 7 | ↗ | | | |
| ✍️ Marcado a mano | 900,00 | 3 | → | ✍️ Marcado a mano | 900,00 | 3 |
| 📲 Bizum | 640,00 | 4 | → | **📲 Bizum** | **850,50** | **6** |
| 📲 Bizum (confirmado a mano) | 210,50 | 2 | ↗ | | | |
| **5 filas** | **7.831,05** | **25** | | **3 filas** | **7.831,05** | **25** |

Los dos importes de tarjeta son los que la fase 1 midió en pantalla; el par de Bizum lo añade la
fase 2, porque agrupa por el mismo motivo y la fase 1 no llegó a pintarlo. **El total del informe y
el nº de cobros son idénticos antes y después**: reagrupar mueve filas, nunca dinero.

🔸 **Y de regalo, la caja mejora** (③ de la fase 1): «📲 Bizum (confirmado a mano)» era la única
fila que hacía wrap a dos líneas en el span de 150 px, y desaparece. Medido en el mismo banco:
`scrollWidth` = `clientWidth` = 150 en las tres filas del DESPUÉS, ningún desborde. **El desborde
del «no reconocido» con valor largo SIGUE AHÍ** — no es de este ticket y no se da por arreglado.

## ⑦.4 Verificación de la FASE 2

* **DOS INSTRUMENTOS, y cada uno dice lo suyo por separado.** ① AST de la RUTA: la ruta LLAMA a
  `agruparCobrosPorCubo`, su resultado **es** lo que viaja como `byMethod`, y `byMethodMap` ya no
  existe —*mencionar no es hacer*: que la función exista no probaría que nadie la use—. ② AST del
  DOMINIO: la clave sale de `cuboDeCobro` y no de un mapa nuevo. Y encima, el comportamiento medido
  con la función que corre, importada de `dist`.
* **SUELO** — los dos detectores fallan declarándose CIEGOS si no encuentran su código, y el de la
  ruta se **autoprueba** contra fuente sintética: sabe decir que NO cuando el agrupador no está.
* **ESTRUCTURAL, no de comportamiento** — «ninguna fila comparte etiqueta con otra» se comprueba
  sobre TODO lo que puede llegar a la pantalla (el conjunto cerrado + los heredados + un
  desconocido), no sobre una muestra de datos: hoy dos filas coinciden por accidente, y un test de
  comportamiento no cazaría la bifurcación el día que nazca.
* **CONTROL POSITIVO DENTRO** — el detector de etiquetas repetidas se ejerce primero contra el
  ANTES, donde SÍ había una, y tiene que encontrarla nombrando las dos claves. Una lista vacía haría
  verdad cualquier «ya no hay duplicados», así que se exige un mínimo de filas antes de creerse el
  cero.
* **CONTROL NEGATIVO** — lo que `cuboDeCobro` NO clasifica sale **exactamente como hoy**: `manual`
  dice «✍️ Marcado a mano», el desconocido conserva su valor crudo dentro, y los tres NO se funden
  entre ellos en un cubo «otros» que nadie ha aprobado. Y agrupar no mueve ningún cobro de cubo.
* **LA SUMA, EXACTA** — el total de la familia es la suma en CÉNTIMOS ENTEROS de las filas que
  absorbió (mismo motivo que `desgloseEmpleado.ts`: un invariante con tolerancia es donde se
  esconden los fallos). `Invoice.total` es `Decimal(12,2)`, así que no se pierde nada.
* **🔴 EL GUARD DE SCRUM-398 NO SE TOCA Y NO CAE.** Es ESTRUCTURAL —mira el diccionario y el fuente
  de la vista— y las dos cosas siguen igual: **34 tests de 398+481+474, 0 fallos**. Si la agrupación
  lo hubiera tumbado, esto sería un STOP y no un commit.
* **ROJO POR EL MECANISMO** — ⑦.6.

## ⑦.5 🔴 Los tres rojos de SCRUM-411, y qué eran

La tanda de la fase 2 destapó **3 fallos del trinquete de huérfanos**, y la aritmética los separa
sin ambigüedad (192 declarados contra 193 medidos = 192 + 2 − 1): **los tres eran míos, ninguno del
merge**.

1. `claveDeAgrupacion` y `representanteDelCubo` entraban como huérfanos nuevos. **No se declaran:
   se dejan de exportar.** Es el precedente que la propia casa fijó ESTA MAÑANA en SCRUM-441
   («`metodoDeclarado` no era un huérfano, era un export de más»): la superficie pública del módulo
   es `agruparCobrosPorCubo`, que es lo que decide qué fila ve el profesional. De paso, el test dejó
   de medir dos ayudantes y pasó a medir el contrato — que es mejor evidencia, no peor.
2. `CUBO_SIN_METODO` estaba DECLARADO como huérfano («la clave la consume su propio módulo») y este
   ticket **le da su primer importador de fuera**. El propio guard dice qué hacer: *«enhorabuena:
   borra su línea en ESTE MISMO commit»*. Hecho, con el motivo escrito en su lugar.
3. El descuadre de categorías era la consecuencia de los dos anteriores y se cerró con ellos.

## ⑦.6 🔴 ROJO POR EL MECANISMO — DOS mutaciones, y lo que la primera destapó

Con la rama **ya en verde y commiteada** (`dd6f64db`), se inyectaron dos mutaciones distintas, cada
una con su post-condición comprobada (`git diff --stat` tenía que enseñar el fichero tocado, y lo
enseñó las dos veces).

| mutación | qué se rompe | qué cae |
|---|---|---|
| **A** · la RUTA deja de delegar y vuelve a su `byMethodMap` por el crudo | el cable ruta→reparto | **1 test**: INSTRUMENTO A, diciendo *«`byMethodMap` ha vuelto a la ruta»* |
| **B** · el DOMINIO vuelve a devolver el valor crudo como clave | el reparto | **4 tests**: INSTRUMENTO B, el ESTRUCTURAL, la tabla y el ANCLA |

**Control negativo del experimento, en las dos:** el guard de SCRUM-398 (8 tests) y el censo de la
fase 1 (①) siguen **VERDES** con la mutación puesta — porque ningún rótulo ha cambiado, que es justo
lo que no tienen que detectar.

> 🔴 **Y LO QUE ESTO DESTAPÓ, que es el motivo de hacerlo en vez de razonarlo.** La mutación A tira
> **un solo** test: las post-condiciones de ④ miden el REPARTO (importado de `dist`), no la ruta, y
> por tanto no ven que la ruta deje de llamarlo. El único instrumento que ata la pantalla al reparto
> es el AST de la ruta — *mencionar no es hacer*, y aquí se ve por qué ese guard no es decorativo.
> Se declara como el hueco que es (⑦.10) en vez de dejarlo implícito.
>
> 🔴 **Y un defecto del mensaje, encontrado y arreglado.** El ESTRUCTURAL decía «💳 Tarjeta» ← `card`
> **+ `card`**: se identificaba la fila por su `method`, que con la mutación es el representante de
> las dos. Un guard que dice que algo se rompió sin decir el qué obliga a repetir la medición
> entera. Ahora identifica la fila por los valores que absorbió, y en rojo dice:
>
> ```
> 🔴 DOS FILAS DEL INFORME DICEN LO MISMO:
>     «💳 Tarjeta» ← card + card:stripe
>     «📲 Bizum» ← bizum_auto + bizum_manual
> ```

## ⑦.7 Ficheros de la FASE 2

* `src/modules/reports/domain/cobrosPorCubo.ts` (**nuevo**) — el reparto, función pura. Vive en
  `domain/` como `desgloseEmpleado.ts` para que la tanda pueda ejercer **el reparto que corre** en
  vez de una copia escrita en el test.
* `src/modules/reports/app/routes/reports.routes.ts` — delega; el mapa a mano desaparece.
* `tests/scrum488-un-solo-vocabulario.test.mjs` — ③ y ④ reescritos (**12 → 16 tests**). Los dos
  tests de la propuesta descartada se sustituyen por las post-condiciones del arreglo, que son más
  duras: donde antes se ejercía un mecanismo que no existía en `public/`, ahora se mide el que
  corre. En un segundo commit, el mensaje del ESTRUCTURAL se endurece con lo que enseñó la mutación
  B (⑦.6).
* `tests/_huerfanos-declarados.mjs` — se retira la declaración de `CUBO_SIN_METODO` (⑦.5).
* `docs/master/evidencias/scrum488/scrum488-informe-antes-despues.png` — la pantalla, antes y después.
* **Ni una línea de `public/`.**

## ⑦.8 Verificación de la tanda de la FASE 2

Con `main` (`bf549141`) dentro, `npx prisma generate` corrido **en este worktree** (los worktrees no
comparten `node_modules`) y la tanda lanzada **después del último cambio de código y de la última
edición de este documento**.

| | ficheros | tests | pass | fail | skipped |
|---|---|---|---|---|---|
| **línea base** (el conjunto que declara `main`, sobre este árbol) | 445 | **3.401** | **3.324** | **0** | **77** |
| **después** (tanda entera, `npm test`) | 446 | **3.417** | **3.340** | **0** | **77** |
| diferencia | +1 | **+16** | **+16** | **0** | **0** |

* `npm run guards:entrada` — **17 tests, 4 guards, 0 fallos**.
* **Ni un salto nuevo**: los 77 `skipped` son los mismos antes y después.
* La línea base se mide con el conjunto que `main` declara (`git ls-tree`), sobre este árbol y
  **sin borrar ficheros del disco**. El único fichero de más es `scrum488-…`, con sus 16 tests.

> 🔸 Se midió una línea base ANTES contra `aa743fe3` (443 ficheros · 3.385 · 3.308 · 0 · 77) y dio la
> misma diferencia (+16/+16/0/0). Se re-midió porque `main` volvió a moverse: una línea base de hace
> dos merges no es una línea base.

El rojo por el mecanismo va en ⑦.6, con las dos mutaciones y su control negativo.

## ⑦.9 Fuera de carril (una línea cada uno, no se arreglan aquí)

* **SCRUM-441 entró en `main` esta misma tarde** con `Invoice.paidVia` —lo que el profesional
  DECLARA al marcar una factura cobrada a mano— y el informe «Cómo te pagan» **no lo lee**: sigue
  fabricando `manual` cuando no hay `Charge`, así que ese dato recién capturado no llega a esta
  pantalla. Toca a SCRUM-491, que ya está abierto sobre `manual`.
* El desbordamiento de la caja de 150 px con un «no reconocido» de valor largo (③) **sigue sin
  arreglar**: no es de este ticket.

## ⑦.10 Huecos DECLARADOS

* **Un solo instrumento ata la pantalla al reparto.** Las post-condiciones de ④ miden
  `agruparCobrosPorCubo` importado de `dist`; lo que garantiza que la ruta lo USE es el AST de
  ⑦.4-①, y la mutación A lo demostró tirando ese test **y solo ese**. Cerrar el hueco de verdad
  pide ejercer `GET /admin/reports/x2` contra una base, que es suite gateada y otro ticket.
* **No se ha verificado en `yaqu.app`**: el cambio no está desplegado —el merge del PR lo hace un
  humano— así que lo que hay es la pantalla pintada en banco de un solo uso (⑦.3) con los ficheros
  reales de `public/`. Verificación en producción, después del merge.
* **`fmtMoneyEs` se sustituyó en el banco** por un `Intl.NumberFormat` equivalente, porque `api.js`
  no se puede cargar suelto. Lo que se mide en ⑦.3 es la COLUMNA DE LA ETIQUETA, que sí la resuelve
  el `reportsView.js` real; los importes se leyeron del DOM y cuadran con los del reparto.
* **Los importes de la tabla de ⑦.3 son los de la fase 1, no una medición contra producción.**
  Cuánto dinero hay de verdad detrás sigue sin medirse: lo último que consta es el
  **38 de 51 cobros repartidos entre `card` y `card:stripe`** de `docs/master/SCRUM-474.md`
  (11-ago-2026). Quien despliegue esto, que lo re-mida.
