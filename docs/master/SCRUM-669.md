# SCRUM-669 · Lo que quedó muerto después de DOC-08 — restos 1, 2 y 4 cerrados

**Fecha:** 15-sep-2026 · **Carril:** frontend (banco de pruebas y vista) · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `cae27c2e6dc1482db0567a8561ebeb6863c996b8` · 2026-09-15T16:32:04+01:00
**Rama:** `scrum-669-restos-de-doc08`

> ⛔ **`src/` no se toca.** Esto es la vista, su hoja de estilo y los guards que la vigilan.
> ⛔ **El resto 3 NO se toca**, y se dice por qué: el propio ticket manda coordinarlo con
> SCRUM-663, que lleva otra sesión ahora mismo.

---

## 0 · El resto 2 ya estaba hecho — y la prueba es por contenido

El ticket pedía empezar por el punto 2: un comentario que afirmaba que el margen «viaja también
en las plantillas», siendo falso. **Ya se había retirado.** `quotesView.js` lo dice en el sitio:

> «🔴 AQUÍ DECÍA ADEMÁS «y viaja también en las PLANTILLAS». ERA FALSO, y por eso se retira.
> MEDIDO el 2-sep-2026 (SCRUM-598)»

Contrastado además contra el esquema: **`QuoteTemplate` no declara `markup`** —sus campos son
`id, merchantId, name, currency, lines, tiers, paymentTerms, createdAt, updatedAt`— así que la
afirmación era falsa y la retirada, correcta.

⚠️ **Y el control positivo de ese contraste salió CIEGO la primera vez**: pregunté «¿qué modelos
declaran `markup`?» y la respuesta fue *ninguno*, en todo el esquema. Un «no» cuyo control
positivo también dice «no» no distingue nada. Al mirarlo: **`markup` no existe en NINGÚN modelo**
—el margen se deriva en el catálogo, no se guarda (CAT-01)—, así que el cero era real y no
ceguera. Pero eso hubo que ir a comprobarlo, no darlo por bueno.

## 1 · 🔴 Resto 1 · `pfBasePrice`: cinco escrituras, cero lecturas

El ticket exige **dos instrumentos**, «no con uno», porque *«el censo por AST ya dio 1 donde había
3 esta semana»*. Los dos, independientes:

| instrumento | escrituras | lecturas |
|---|---|---|
| barrido de TEXTO sobre 1626 ficheros (`.ts .js .mjs .html .css`) | 5 | **0** |
| barrido por **AST**, distinguiendo lado izquierdo de asignación | 5 | **0** |

Las cinco: `quotesView.js` líneas 2769, 3185, 3652, 3655, 3691 — **exactamente los cinco sitios
que el ticket declaraba**.

**Vías miradas, declaradas:** `dataset.X` · `dataset['X']` · `getAttribute('data-pf-base-price')` ·
`setAttribute` · selectores `[data-pf-base-price]` · el atributo escrito en HTML · las hojas de
estilo.

> 🔒 **Y con CONTROL POSITIVO en los dos**, porque un cero y una sonda ciega se leen igual: sobre
> `dataset.estado` y `dataset.quoteId` los dos instrumentos **sí ven lecturas**. El cero de
> `pfBasePrice` no es que el detector no mire.

## 2 · 🔴 Resto 4 · `priceHint`: el hueco que nunca dice nada

`priceHint` se creaba, se colgaba de la etiqueta de PRECIO y su `textContent` se ponía a `""` en
los tres sitios donde se tocaba. **Nunca recibía texto.** Sólo existía para avisar de la diferencia
que creaba el margen de la línea, y ese margen se fue en DOC-08.

Se retira con su clase `.price-final-hint`, que sin él es una regla que no pinta nada. El `flex`
de `.quote-line__label` **se queda**: lo que sostiene es la forma de la celda (el descuadre de
BUGS.md P3-13), no aquel aviso.

## 3 · Los guards que los vigilaban — y por qué NO quedan mirando al vacío

Retirar los restos dejaba tres guards apuntando a código que ya no existe. **Un guard muerto a
cambio de código muerto no es un arreglo**, así que cada uno se decidió por separado:

| guard | qué le pasaba | qué se hizo |
|---|---|---|
| `scrum610` · 2 de sus 4 `ANCLAS` | anclaban las escrituras de `pfBasePrice` | **retiradas**, suelo 4 → 2 |
| `scrum610` · la marca de FRONTERA | usaba una escritura retirada como posición | reapuntada a `priceInput.value = String(base.toFixed(2))`, que sigue viva **y es un ancla declarada** |
| `scrum610` · el modelo (`L.base`) | copiaba el dato muerto | retirado; el precio del documento sale de `precioVisible` |
| `scrum139` · 1 de sus 2 aserciones | exigía la PRESENCIA de `appendChild(priceHint)` | **retirada**; la otra —que el aviso no cuelgue de `priceTd`— **se queda y sigue cazando**, más un suelo nuevo sobre `.quote-line__label` |

🔒 **No se relaja nada: DESAPARECE SU CAUSA.** Es literalmente el criterio —y las palabras— que
`scrum610` ya usó al retirar cinco anclas por SCRUM-598. Un ancla sobre una línea que no existe no
vigila: cae por lo normal, y un guard que cae por lo normal se desactiva en una tarde.

## 4 · El trinquete nuevo, y sus tres mutaciones

`tests/scrum669-restos-de-doc08.test.mjs` impide que los dos restos vuelvan. Las mutaciones,
**con la comprobación de que ENTRARON** —porque una mutación que no entra y una cobertura que no
existe dan la misma salida—:

| mutación | ¿entró? | qué cae |
|---|---|---|
| vuelve `pfBasePrice` a la vista | ✅ sha `5767c7ee` → `59a1584c` | resto 1 |
| vuelve `priceHint` a la vista | ✅ sha `5767c7ee` → `2554bee8` | resto 4 |
| vuelve la clase huérfana al CSS | ✅ sha `5661cbfc` → `494abb6e` | resto 4 |

Ficheros restaurados y verificados por sha tras cada una.

### ⚠️ El trinquete saltó sobre su propio comentario

Su filtro «esto es código, esto es comentario» miraba el principio de línea (`//`, `*`, `/*`) y en
`.css` el comentario es un **bloque** `/* … */`: las líneas interiores no empiezan por ninguna de
esas marcas, así que contó **mi propia explicación** como si fuera la clase de vuelta. Se arregló
el instrumento —se neutralizan los bloques enteros, conservando los saltos de línea para no
descuadrar la numeración— en vez de reescribir el comentario para esquivarlo.

## 5 · 🔴 EL QUE DECIDE, ejecutado

El dashboard **se carga y pinta** sin los restos: `renderQuotesView` sobre el banco de vistas, con
suelo (más de 20 nodos pintados, porque sobre una pantalla vacía «no hay errores» sería cierto por
vacío) y sin un solo `console.error`.

## 6 · ⛔ El resto 3, medido y NO tocado

`quoteMargen.js` **sigue en `index.html`**. El ticket manda coordinarlo con SCRUM-663 (la lista
manual de `sw.js` y el contador de `SCRIPTS_DEL_DASHBOARD`), que lleva otra sesión ahora mismo.
Queda un caso que **fija su estado de hoy**: si alguien lo saca sin coordinar, salta y dice
exactamente qué hay que actualizar a la vez. No es vigilancia de más: es que el ticket avisa de
que sacarlo baja dos contadores y esta sesión no los lleva.

## ⛔ No tocado

**`src/`**: ni una línea · **el resto 3** · **ningún estado ni flag nuevo** (27) · **ninguna
dependencia** (36) · **frontend vanilla, sin bundler** (4) · **ningún microcopy** (30): sólo se
han retirado elementos, no se ha escrito ni un texto de pantalla · **el camino de emisión fiscal**
ni se abre (38).
