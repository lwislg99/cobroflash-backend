# SCRUM-820 · los estados del presupuesto, en castellano y dichos igual en todas partes

**Medido contra:** `origin/main` = `f2d1589041d04e5f465cc4deba010f5563ffea72` · 2026-09-07T17:56:11+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-820-estados-en-castellano`
**Carril:** front / microcopy de estados

## La víctima

El fontanero que abre Presupuestos y lee **DRAFT, SENT, ACCEPTED, REJECTED**. Y la app
contradiciéndose: el MISMO presupuesto salía «Aceptado» en Inicio y ACCEPTED en la lista.

## PASO 0 · los mapas eran CINCO, no tres

El encargo hablaba de tres. Medido:

| # | dónde | qué traduce | cómo lo encontré |
|---|---|---|---|
| 1 | `customerDetailView.js:224` | 8 claves + mapa de clases | leyendo |
| 2 | `globalSearch.js:5` | 7 claves | leyendo |
| 3 | `homeView.js:520` | **4** claves, con `\|\| item.status` | leyendo |
| 4 | `api.js:1110` `invoiceStatusMeta` | el de FACTURAS, patrón `{label, pillClass}` | leyendo |
| 5 | `teamView.js:349` | 8 claves | 🔴 **lo encontró el guard**, no una lectura |

**El quinto no lo contaba nadie.** Salió cuando el censo del guard nuevo se puso rojo solo.

### Los sitios que vuelcan el identificador crudo — **5**, y el suelo pedía ≥4

`quotesListView.js:168` (`st.toUpperCase()`) · `api.js:1118` · `customerDetailView.js:253` y `:280`
(`|| q.status`, `|| inv.status`) · `homeView.js:522` (`|| item.status`).

## El control que decide: Inicio ↔ lista, los seis estados

Las dos pantallas **pintadas** con el mismo dato, el mismo instrumento en los dos lados.

### ANTES — discrepan **6 de 6**

| estado | LISTA | INICIO |
|---|---|---|
| draft | `DRAFT` | Borrador |
| sent | `SENT` | Enviado |
| accepted | `ACCEPTED` | Aceptado |
| rejected | `REJECTED` | Rechazado |
| expired | CADUCADO | `expired` |
| pending_approval | PENDIENTE APROBACIÓN | `pending_approval` |

🔴 **Hallazgo:** el ticket decía que la lista era la que fallaba. **Inicio también volcaba crudo**
en dos estados —`● expired`, `● pending_approval`— porque su mapa tenía cuatro claves de seis.

### DESPUÉS — discrepan **0 de 6**

| estado | LISTA | INICIO |
|---|---|---|
| draft · sent · accepted · rejected | Borrador · Enviado · Aceptado · Rechazado | ídem |
| expired | Caducado | Caducado |
| pending_approval | Pendiente de aprobación | Pendiente de aprobación |

## El arreglo: una sola copia, no un mapa nuevo

`quoteStatusMeta` en `api.js`, con el patrón que la casa ya usa (`invoiceStatusMeta`,
`cobroPillClass`, `jobStatusMeta`): `{label, pillClass}`. Es el diccionario que ya existía en
`customerDetailView`, traído al sitio donde viven los demás. La lista y Inicio leen de ella.

**Los literales son los de producción, sin cambiar una letra** (regla 30). Donde dos copias
discrepaban:

- `expired` → **«Caducado»** (masculino, el del presupuesto) y no «Caducada», que es el de la factura.
- `pending_approval` → **«Pendiente de aprobación»**, y aquí está la contradicción más fina de
  todas: **la propia lista ya usaba ese literal en su filtro** (`quotesListView.js:73`) mientras su
  píldora respondía «PENDIENTE APROBACIÓN». Se filtraba por una cosa y se leía otra, en la misma
  pantalla. Manda el del filtro, por el criterio de SCRUM-727: *el jefe filtra por lo que ve escrito*.

## El control negativo: lo desconocido no se vuelca crudo

Corrido en navegador con un estado que no existe (`pending_signature_v2`): la lista pinta **«—»**
y ni la lista ni Inicio meten el identificador en el HTML.

⚠️ **Y respeta la lección de SCRUM-153**, que decía lo contrario a medias: lo desconocido no puede
disfrazarse del más inocente. Sigue sin disfrazarse —no cae a «Aceptado» ni a «Pendiente»— pero
tampoco se le escupe un código de base de datos a un profesional. El guion es el respaldo que ese
mismo fichero ya usaba. **El rótulo definitivo está sin firmar y va propuesto abajo.**

## El guard

`tests/scrum820-estados-en-castellano.test.mjs`, 7 tests. No vigila «que haya traducción»: vigila
que haya **UNA SOLA** y que las pantallas lean de ella — un guard que sólo comprobara los seis
rótulos pasaría en verde el día que alguien escriba la sexta copia, que es como llegamos aquí.

**Los dos rojos, corridos:** una copia nueva del diccionario en otra vista → cae; el respaldo
volviendo a `toUpperCase()` del identificador → cae. Restaurado, vuelve el verde.

**Suelos:** si no encuentra la pieza, ciego; si el censo de copias baja de tres, ciego —
«no he mirado» no es «están limpias».

## 🖊️ Lo que necesita tu firma (no he inventado nada)

1. **`pending_approval` tiene TRES formas vivas** y he tomado la del filtro. Firma una:
   - «Pendiente de aprobación» — filtro de la lista, `quotesView`, `teamView` *(la aplicada)*
   - «PENDIENTE APROBACIÓN» — `quotesDetailView.js:185`
   - «Pend. aprob.» — `customerDetailView.js:224`
2. **Qué poner cuando el estado no se reconoce.** Hoy va un «—». Propuesta: *«Estado desconocido»*.
3. **`quotesView.js:4088` pinta `"DRAFT"` literal** en el previo del documento. Otro carril, reportado.

## Hallazgos abiertos (regla 37)

- `customerDetailView.js`, `globalSearch.js` y `teamView.js` siguen con su copia: **mezclan estados
  de presupuesto con estados de FACTURA** (`paid`, `pending`) y separarlos es otro ticket. Quedan
  **censados**: no pueden crecer sin que alguien lo afirme.
- Sigue en pie el hueco declarado en SCRUM-722: el censo de marcadores no mira los modales que se
  abren con un clic.

---

# 📌 AÑADIDO ENCIMA DE `d03b1950` — 8-sep-2026

**Rama:** `scrum-820-estados-en-castellano-al-dia`, derivada de
`origin/scrum-820-estados-en-castellano` @ `9a5e8b9d`, con `origin/main` (`15fb3b2f`) mergeado
dentro **sin conflictos**.

**Todo lo de arriba es de `d03b1950` y no se ha tocado.** Lo de aquí abajo son tres huecos medidos
**después**, sobre esta rama ya al día. Cada uno dice qué fichero toca.

> ### 🔴 CÓMO SE LLEGÓ AQUÍ: cuarto ticket del día que ya estaba construido
>
> Este trabajo empezó como una **segunda implementación del mismo ticket**. Se paró al hacer la
> OBLIGACIÓN 0 —`git ls-remote --heads origin | grep 820`— y encontrar esta rama. **Jira daba el
> ticket «En curso» sin ninguna señal de que hubiera código.** La implementación paralela se
> descartó entera y no se empujó; lo único que sobrevivió fueron **las mediciones**, que no
> dependen de cuál implementación gane. Son las tres de abajo.

## 🔴 SON CINCO MAPAS, NO TRES — y el enunciado corto cambia qué significa «elige uno»

El ticket decía **tres**. `d03b1950` ya lo corrigió a **cinco** (los tres + el patrón canónico de
`api.js` + `teamView.js`, que encontró su propio barrido al ponerse rojo). Se deja escrito aquí
porque **el enunciado del ticket estaba corto**, y eso cambia la instrucción: «elige uno» no era
elegir entre tres redacciones parecidas, sino entre cinco de las que **sólo una tenía el género
correcto**.

Y la elección se hizo por CONTENIDO, no por sitio:

| | `customerDetailView` | `globalSearch` | `homeView` | **`teamView`** | `api.js` (hoy) |
|---|---|---|---|---|---|
| `expired` | Caducad**a** ❌ | Caducad**a** ❌ | — | **Caducado** ✅ | **Caducado** ✅ |
| `pending_approval` | «Pend. aprob.» ❌ | — | — | **entero** ✅ | **entero** ✅ |
| `paid` / `pending` | Pagad**a** ❌ | Pagad**a** ❌ | — | **Pagado** ✅ | **Pagado** ✅ |

**El mapa que gana es el de `teamView`**, y por su género: un presupuesto es masculino; la que es
«Caducada» y «Pagada» es la FACTURA. `d03b1950` ya había traído esos literales a `api.js` uno a
uno. **No se ha movido la pieza a `teamView`**: `api.js` es donde viven `invoiceStatusMeta`,
`jobStatusMeta` y `cobroPillClass` —el patrón canónico de la casa— y sacarla de ahí para meterla en
una vista sería deshacer lo bueno. Lo que se ha hecho es **cerrar la copia de `teamView`**, de modo
que sus literales quedan como los únicos: gana el mapa, no su ubicación.

## ① `quotesDetailView.js` — el mismo defecto, COPIADO

Tenía el mismo ternario con `st.toUpperCase()`. Con la lista ya arreglada, **la ficha a la que se
llega pinchando una fila seguía diciendo `ACCEPTED`**: el defecto no estaba cerrado, estaba movido
un clic — y al sitio donde el profesional mira para decidir.

Lo cazó un **barrido por AST** (no `grep`: `toUpperCase()` aparece en iniciales de avatar y en
NIFs, y un grep los contaría igual). **156.042 nodos, 84 ficheros**, con suelo dentro. Era el
**único** `st.toUpperCase()` que quedaba en un camino de presupuesto tras `d03b1950`.

## ② `teamView.js` — la quinta copia, cerrada

`d03b1950` la dejó **censada y vigilada**, que era razonable: el ticket hablaba de la lista. Se
cierra ahora por lo dicho arriba — mientras siguiera viva, la pieza y la referencia eran dos cosas
distintas.

Su entrada **se BORRA del censo, no se pone a 0**, que es lo que exige el propio guard de
`d03b1950` («ENTRADA CADUCA: bórrala») y el criterio de SCRUM-402/424/405.

**Y su SUELO se ha atado al censo en vez de a un número.** Era `>= 3` fijo y cayó al quedar dos
copias. Bajarlo a 2 habría sido ajustar el guard al código; ahora se deriva de
`Object.keys(CENSO_DE_COPIAS).length`, así que **baja solo cuando alguien borra una entrada a
conciencia** y sigue cazando un barrido que deja de ver. Con un `>= 1` delante, por si el censo se
vaciara algún día.

## ③ 🔴 `paid` y `pending`: el servidor los manda y la pieza no los tenía

El más silencioso de los tres, y **no se ve leyendo el diff**:

- `listQuotesAdmin` (`src/modules/system/quoteAdmin.ts:79-91`) **sustituye** `draft` por `paid` o
  `pending` cuando el presupuesto tiene cobro.
- Esa es la ruta que alimenta **la LISTA** (`quotesAdmin.routes.ts:65`), no sólo la ficha de un
  miembro del equipo.
- La pieza no los cubría, así que **un presupuesto ya cobrado caía al respaldo y se pintaba «—»**.

Mejor que el `PAID` en inglés de antes, pero **se perdía el dato**: «pagado» y «no reconozco este
estado» acababan diciendo lo mismo en pantalla. Añadidos con los literales de `teamView`, de donde
vienen. Sin esto, además, cerrar la copia de `teamView` habría convertido su «Pagado» en «—»: una
regresión introducida por el propio arreglo.

## ✅ La tabla que decide, con las TRES pantallas

| estado | Inicio · original | Lista · original | Detalle · tras `d03b1950` | **Las tres · ahora** |
|---|---|---|---|---|
| `draft` | Borrador | `DRAFT` | `DRAFT` | **Borrador** |
| `sent` | Enviado | `SENT` | `SENT` | **Enviado** |
| `accepted` | Aceptado | `ACCEPTED` | `ACCEPTED` | **Aceptado** |
| `rejected` | Rechazado | `REJECTED` | `REJECTED` | **Rechazado** |
| `expired` | **`expired`** 🔴 | CADUCADO | CADUCADO | **Caducado** |
| `pending_approval` | **`pending_approval`** 🔴 | PENDIENTE APROBACIÓN | PENDIENTE APROBACIÓN | **Pendiente de aprobación** |
| `paid` *(derivado)* | — | `PAID` → «—» | `PAID` | **Pagado** |
| `pending` *(derivado)* | — | `PENDING` → «—» | `PENDING` | **Pendiente** |

La columna del detalle es la que este añadido cierra. **Se comprueba montando las dos pantallas de
verdad** (`renderQuotesListView` y `renderQuoteDetailView`) y leyendo el DOM que pintan, no
comparando fuentes.

## Controles añadidos (los de `d03b1950` siguen intactos)

| Control | Qué exige |
|---|---|
| 🔴 Derivados | `paid`/`pending` no caen al respaldo, y en masculino |
| 🔴 SUELO | las tres pantallas montan y pintan su píldora — si no las veo, nada de abajo significa nada |
| ✅ COHERENCIA | lista, **detalle** y pieza dicen lo mismo en los seis estados; Inicio lee de la pieza |
| ✅ NEGATIVO | un estado desconocido no se pinta crudo **en ninguna de las tres** |
| 🔴 Anti-regresión | el **detalle** y **Equipo** leen de la pieza y no vuelven al `toUpperCase()` |

## Un rojo que se cerró, y su dueño

La tanda había dejado abierto `SCRUM-553 · el número de etiquetas con el «>» pegado NO SUBE`.
**Comprobado contra `main` limpio (`15fb3b2f`): 16/16 en verde.** El rojo lo causaba la
implementación paralela descartada —el `<script>` que añadía al índice—, y **muere con ella**. No
queda ningún rojo sin dueño.

## Lo que NO se ha tocado

⛔ Los identificadores internos del estado: esto es cómo se PINTA. ⛔ `prisma/schema.prisma`.
⛔ Camino de emisión (regla 38). ⛔ El CSS de `.status-pill`. ⛔ Los tres puntos que `d03b1950`
dejó pendientes de firma siguen pendientes y **no se ha elegido por gusto** ninguno.
⛔ `customerDetailView.js` y `globalSearch.js` conservan su copia: mezclan estados de presupuesto y
de factura, separarlos es otro carril (regla 37) y siguen censados.
