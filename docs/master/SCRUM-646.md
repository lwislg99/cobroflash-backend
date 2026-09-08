# SCRUM-646 · El cortafuegos del `defaultVat` por país

**Fecha:** 2-sep-2026 · **Carril:** catálogo · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `558765adf2d2f09288e20e2b878c69d6edc3380b` · 2026-09-02T12:57:46+01:00

**Tanda:** 4334 tests, 4255 pass, 0 fail, 79 skipped — medida DESPUÉS del último cambio y del merge de main.

---

## PASO 0

**ENTRADA — dos puertas, y una viene marcada por defecto.**

| ruta | fichero | cómo llega |
|---|---|---|
| `POST /admin/products/load-catalog` | `public/dashboard/js/onboardingView.js:303` | el **onboarding**, con la casilla `ob-load-catalog` **`checked`** (`:284`) |
| la misma | `public/dashboard/js/productsView.js:889` | el botón «Cargar el catálogo de mi gremio» |

En ninguna de las dos se le pregunta al profesional por el IVA. El copy del onboarding dice
«Cárgalos como base y edítalos a tu gusto» y no menciona el impuesto.

**MECANISMO — ya existe, y el trabajo NO era construirlo.** La línea del documento ya tiene su
campo de IVA con una cascada escrita (`quotesView.js`): `initial.vat` → `initial.tax` → el «IVA por
defecto» del documento. O sea que **el sitio donde el profesional elige el tipo ya estaba**. Este
ticket no añade superficie: retira un cableado que decidía por él.

> 🔴 **Y una discrepancia con el encargo, dicha antes de seguir:** dice «SCRUM-611 ya entregó el
> selector … y ya está en main». **No está en `main`** (`git merge-base --is-ancestor` → no; y
> `index.html` no carga `tiposDeIva.js`). No bloquea —la línea ya tenía campo de IVA antes del
> selector, así que el profesional puede fijarlo igual—, pero la premisa es falsa.

---

## 🔢 EL CENSO — tres sitios, y el tercero no lo encontró el censo

Censo **por AST** y **al revés**: no se busca `defaultVat` (eso sólo encuentra a quien lo nombra),
sino **toda escritura de un campo de impuesto** en un `create`/`update`/`upsert` de Prisma, y
después se clasifica de dónde sale su valor.

| # | sitio | forma | ¿lo vio el censo? |
|---|---|---|---|
| ① | `products.service.ts` · `createProduct` | `vat: input.vat ?? null` | sí |
| ② | `products.service.ts` · `importProductsCsv` | `vat` **abreviada** | **sólo tras arreglarlo** |
| ③ | `products.routes.ts` · plantilla del gremio | `tax: vat` dentro de un `.map` | **NO** |

**✅ Control positivo (el que pedía el encargo):** se inyectó a propósito una segunda escritura en
un fichero cualquiera (`ai.service.ts`) y el censo pasó de 2 a 3 y **nombró `sondaCenso646`**.
Revertida byte a byte. Suelo: el censo declara que ve **180 llamadas de escritura**; si viera cero,
aborta en vez de imprimir un número.

### 🔴 Dos huecos del censo, y los cuento porque el número los tuvo

* **La primera versión devolvió UN solo sitio.** No me fié —el encargo avisaba— y al mirarlo tenía
  dos agujeros: la forma **abreviada** `{ vat }` es `ShorthandPropertyAssignment` y no
  `PropertyAssignment`, y un objeto `patch` construido aparte tampoco entra en los argumentos de la
  llamada. Corregidos los dos, el censo pasó de 1 a 3.
* **El tercer sitio no lo encontró ni la versión corregida: lo cazó el COMPILADOR.** `tax: vat`
  vive dentro de un `.map` que construye las líneas de la plantilla, así que la propiedad **no está
  sintácticamente dentro de la llamada a Prisma**. Al quitar la variable, `tsc` dijo «Cannot find
  name 'vat'». Queda escrito en el propio código: **es exactamente la forma que un censo de
  escrituras se pierde.**

### Escritura o sugerencia (punto 2)

| sitio | ¿qué es? | ¿deriva del país? |
|---|---|---|
| `load-catalog` → producto y plantilla | **ESCRITURA sin pantalla** | **SÍ — el defecto** |
| `POST /admin/products` | escritura, del **cuerpo de la petición** | no |
| `importProductsCsv` | escritura, del **fichero del profesional** | no |
| `PUT /admin/products/:id` | escritura, del cuerpo | no |
| `getLocaleJson` → `window.appLocale.defaultVat` | **exposición sin consumidor** | — |

### Caminos de llamada (punto 3)

`createProduct` tiene **tres** llamadores, y sólo dos son el defecto: los dos de `load-catalog`
(que pasaban la variable derivada del país). El tercero, `POST /`, pasa lo que envía el cliente.
**Medido además que ningún fichero del front usa `appLocale.defaultVat`**: la exposición al
navegador no tiene consumidores.

---

## ⚠️ PUNTO 4 · Qué pasa si un producto nace SIN tipo — MEDIDO, y la pregunta

**Medido, no supuesto:**

| | qué pasa |
|---|---|
| ¿falla el alta? | **No.** `Product.vat` es `Decimal?` |
| ¿qué pinta la tabla del catálogo? | **«—»** — ya estaba tratado (`productsView.js:586`) |
| ¿y el CSV de exportación? | vacío — ya estaba tratado (`products.service.ts:97`) |
| ¿qué pinta la LÍNEA que lo use? | cae al **«IVA por defecto» del documento**, que el profesional VE y puede cambiar |

**Las opciones, con su consecuencia** — la decisión es del fundador:

| opción | consecuencia medida |
|---|---|
| **A · nace NULL** (lo implementado) | nada se rompe; la línea cae al defecto del documento, **visible y editable** |
| **B · el alta FALLA sin tipo** | `load-catalog` no tiene ningún tipo que ofrecer → **la carga del catálogo por gremio deja de funcionar entera**, y es la puerta principal del onboarding |
| **C · escribir un tipo fijo (21)** | **es el mismo defecto con otra constante**: sigue grabando un impuesto que el profesional no ha visto, y encima peor, porque ya ni depende del país |

> No elegí por gusto: **B y C se refutan al medirlas.** B rompe la entrada principal; C reintroduce
> el defecto. Queda A. Si el fundador prefiere otra, **son tres líneas** — el guard vale igual para
> las tres, porque lo que prohíbe es derivar el tipo del país, no el valor concreto.

---

## El cortafuegos

`tests/scrum646-cortafuegos-defaultvat.test.mjs`, 5 casos.

**La regla:** nadie fuera del módulo que DEFINE la tabla puede nombrar `defaultVat`.

* **NO hereda su lista del emisor.** La única excepción —`src/core/i18n/locales.ts`— está escrita
  **a mano** en el test, con su motivo. Un trinquete que preguntara a `locales.ts` qué campos tiene
  o quién lo importa cambiaría con aquello que vigila y no saltaría jamás. La duplicación se paga.
* **Anclado por AST.** Un guard de texto se cazaría a sí mismo: este fichero nombra `defaultVat`
  catorce veces. Un caso lo demuestra — la misma cadena en un comentario y en un literal **no
  cuenta**.
* **Suelo doble.** Si el detector no encuentra el campo **ni siquiera en el emisor**, se declara
  ciego: «cero ofensores» y «no supe mirar» son el mismo número con significados opuestos.
* **Control negativo:** la tabla de locales sigue entera (`currency`, `dateLocale`, `quote`,
  `vatName`). **Retirar el cableado del IVA no es borrar la tabla.**

### El rojo, con post-condición

Inyectada la escritura prohibida en `products.routes.ts`:

```
post-condición · products.routes.ts ha cambiado: true
post-condición · lleva la escritura prohibida: true

caen: 🔴 EL TRINQUETE: nadie fuera del emisor nombra `defaultVat`

🔴 ALGUIEN VUELVE A DERIVAR EL TIPO DE IVA DEL PAÍS:
   · src/modules/products/app/routes/products.routes.ts:74 · en `vat` · getLocale(merchant.country).defaultVat
```

**Nombra el fichero, la línea, el símbolo y la expresión.** Revertido byte a byte.

---

## El censo de estrechamientos de SCRUM-619, anotado

Al retirar el cableado, `products.routes.ts` bajó de **1 a 0** estrechamientos y su trinquete
saltó — con razón: «un estrechamiento que desaparece es un arreglo, y un arreglo sin anotar se
deshace solo». **No se ha puesto a 0: se ha RETIRADO la entrada con su motivo**, porque no es que
el estrechamiento se haya arreglado, es que ha desaparecido lo que lo justificaba.

---

## Lo que NO se ha tocado

* **`prisma/schema.prisma`** — es del fundador. No hizo falta: la columna ya era nullable.
* **`pdf.service.ts`** (S3), **`quotesView.js:385`** (el IVA por defecto del documento, SCRUM-660)
  y **el selector de la línea** (SCRUM-611).
* **La tabla de locales.** Sigue sirviendo moneda, idioma y rótulos.
* **Ninguna migración de datos.** Los 13 merchants de producción son de prueba y no hay valor
  histórico que preservar — dato del fundador, no medido por mí.

## Los huecos que declaro

1. **El guard vigila el NOMBRE.** Si alguien copia el número `0.21` a mano en un `create`, no lo
   ve. Vigilar «un tipo impositivo» sin nombre sería vigilar cualquier número: eso no es un guard.
2. **No he verificado en navegador** que el alta por gremio siga funcionando de punta a punta ni
   que la línea pinte el defecto del documento. Se ha medido el código y el efecto sobre los datos.
3. **No he tocado producción ni la he medido.** Los datos de producción que cito (13 merchants, 58
   productos) son del fundador.
4. **El censo por AST no ve una escritura construida en otra función** y pasada por parámetro. Lo
   sé porque el tercer sitio se me escapó por una variante de eso.

## Estado del árbol

* `origin/main` avanzó a `7647eead` (PR #908, SCRUM-652) mientras se cerraba esto. **Comprobado que no
  toca ninguno de los ficheros de este ticket**, y se ha MERGEADO main DENTRO de la rama (no
  rebase: la historia no se reescribe). Sin conflicto.
* Cliente de Prisma regenerado desde este worktree antes de la tanda.
* `npm run guards:entrada` en verde.

## Ficheros

* `src/modules/products/app/routes/products.routes.ts` — se retira `getLocale(...).defaultVat` y
  los **tres** sitios que lo escribían.
* `tests/scrum646-cortafuegos-defaultvat.test.mjs` — **nuevo**, el trinquete.
* `tests/scrum619-vocabulario-de-linea.test.mjs` — el censo de estrechamientos, anotado.

## HALLAZGOS FUERA DE CARRIL — una línea cada uno

* `getLocaleJson` expone `defaultVat` al front y **ningún fichero del front lo usa**: exposición sin consumidor.
* `quotesView.js:385`, el «IVA por defecto» del documento, sigue siendo un campo de texto libre (ya es SCRUM-660).
* **SCRUM-611 no está en `main`** aunque el encargo lo daba por mergeado.
* IGIC (Canarias) e IPSI (Ceuta y Melilla) siguen sin tener bloque impositivo — decisión del fundador, opción B, no se construye.
