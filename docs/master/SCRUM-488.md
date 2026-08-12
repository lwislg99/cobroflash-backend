# SCRUM-488 · Dos vocabularios de `paid_via` — la medición, y lo que apareció debajo

**Medido contra:** `origin/main` = `db820c35fffa526187057330457593e8b5315aeb` · 2026-08-12T11:40:00+01:00

**12-ago-2026** · **Carril:** Cobros / Informes · **Gate:** sin gate, corre en `npm test`

> 🔸 **`main` se movió DOS veces durante este ticket**: `3d8c1d7d` → `90e810ad` (el fetch del PASO 0)
> → `db820c35` (mientras se medía, movida por otra sesión: los cuatro worktrees comparten refs). Se
> mergeó la segunda y **los números de abajo son de después de ese merge**. El ancla dice contra qué
> `main` se midió, no contra cuál se empezó.

> 🔴 **ESTE TICKET NO PINTA NADA.** Mide, propone una grafía única y para. El texto lo aprueba el
> asesor (regla 30). El mecanismo propuesto se ejerce **dentro del test** para poder enseñar el
> control positivo; en `public/` sería texto nuevo pintado sin aprobar, que es el STOP 4.

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

**Aquí NO se arregla** — el encargo lo dice: ningún agrupamiento se cambia, se mide. Queda como
hallazgo con su guard: si mañana la ruta empieza a normalizar, el test cae **pidiendo que se rehaga
esta medición** en vez de quedarse callado.

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

## ④ LA PROPUESTA — una grafía, dos decisiones para el asesor

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

### 🔴 Decisión 1 · qué dice el informe de un cobro sin `Charge` (`manual`)

Las dos frases son ciertas y dicen cosas distintas (arriba, ①). Tres salidas:

1. **«Método no registrado»** — unifica con Cobros; se pierde que lo marcó una persona.
2. **«Marcado a mano»** en las dos pantallas — unifica al revés; en Cobros habría que aprobar ese
   texto para un cobro cuyo método sigue sin constar.
3. **Las dos cosas, en sitios distintos**: el método no consta (vocabulario) y el registro fue manual
   (otra columna o un matiz). Es lo único que no pierde información — y es más trabajo.

**Propongo la 3**, y si hay que elegir hoy, la **1**: entre afirmar de menos y afirmar de más sobre
cómo entró el dinero, en una pantalla que se cruza con el banco, se afirma de menos.

### 🔴 Decisión 2 · el valor crudo del desconocido (398 y 481 se contradicen)

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

## Verificación

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

## Verificación de la tanda

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

## Ficheros

* `tests/scrum488-un-solo-vocabulario.test.mjs` (nuevo, **12 tests**) — el censo, los dos detectores
  autoprobados, el hallazgo de ③ y el mecanismo propuesto ejercido sin pintarlo.
* `docs/master/SCRUM-488.md` (este).
* **Ni una línea de `public/`**: es un ticket de medición.
