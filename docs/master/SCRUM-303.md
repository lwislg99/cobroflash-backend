# SCRUM-303 (C4) · Crear un albarán en UNA pantalla

**Fecha:** 5-ago-2026 · **Carril:** C · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `f734e33d2df6afc67380e7933db87f01383fed63` · 2026-08-05T16:03:16+01:00

## 🔴 La premisa del ticket estaba a medias, y se midió antes de construir nada

El ticket decía que hoy el flujo es «se crea un albarán **VACÍO** → luego se rellena». **Esa mitad ya
estaba hecha:** SCRUM-257 mandaba las líneas **en el propio POST de creación**, así que el albarán
nacía prellenado, no vacío.

**Los dos números que faltaban en el ticket:**

| Pasos hoy, ANTES de esta tarea | |
|---|---|
| Pulsar «+ Nuevo albarán» → tener albarán **con líneas** | **1** |
| …hasta poder **firmar habiéndolo revisado** | **3** (crear → «Editar líneas» → firmar) |

Lo que seguía roto es lo otro, y es lo que cierra esta tarea: **el documento existía en el instante
del clic**, con su `ALB-YYYY-NNN` ya reservado dentro de la transacción, **sin que nadie lo hubiera
mirado**. No había ningún punto en el código donde revisar antes de que existiera.

### Los cuatro huecos por los que SÍ nacía vacío, que nadie había enumerado

| Caso | Dónde |
|---|---|
| `VALORADO` marcado | el backend exige precio y el presupuesto no lo trae |
| el serializer no manda `quote` | `job.quote?.id != null` |
| el presupuesto no se puede leer | `.catch(() => null)` |
| ninguna línea aprovechable | `if (!lineas.length) lineas = null` |

## Lo que se construye

«Nuevo albarán» abre la hoja **ya rellena**; el pro repasa cantidades y guarda. **El POST —el
único— sale al GUARDAR.** Salir con ×, Esc o Cancelar no crea nada **y no quema número**.

Y los cuatro huecos pasan a abrir la hoja **vacía con su aviso** en vez de crear un albarán vacío:
la misma mitigación, sin documento fantasma.

`BORRADOR` cambia de significado: de «lo creé vacío y ya lo llenaré» a **«lo estoy rellenando»**.

## 🔴 El suelo, y la decisión del fundador que lo cambió de forma

El ticket pedía «si la lectura del presupuesto falla, **falla y dilo**». Eso **contradecía una quinta
decisión de SCRUM-257** —no uno de sus cuatro criterios cerrados— escrita con su motivo en el
código: *«quedarse sin prellenado es un incordio; no poder crear el albarán estando en obra es un
problema»*. Se llevó al fundador como choque en vez de resolverlo por cuenta propia.

**Decisión: gana SCRUM-257** (el bloque H existe porque «sin cobertura» es el caso normal, no el
raro). **Pero el suelo no desaparece, cambia de forma:**

> Se crea igualmente, y se **DICE** que el prellenado falló — no se presenta como si el presupuesto
> estuviera vacío.

«No se pudo leer el presupuesto» y «el presupuesto no tenía líneas» son **la misma pantalla vacía
con significados opuestos**. Cada uno tiene su motivo y su texto, y hay test de que no se confundan.

## 🔴 Dos defectos que este ticket encontró y arregla dentro (regla 37)

Los dos cumplían las tres condiciones: misma zona, tumbaban un criterio de verificación de esta
misma tarea, y caben en el PR.

### ① Había un SEGUNDO camino de alta, y era el peor

La siguiente acción `nuevo` de la cabecera (`nextAct.kind === 'nuevo'`) hacía **su propio POST** y
creaba un albarán **VACÍO** —sin pasar siquiera por el prellenado de SCRUM-257— con el número ya
quemado. Era el camino **más corto** y el **peor**, y el ticket solo hablaba del botón de la sección.

Es el defecto que SCRUM-366 documentó en este mismo fichero: **lo que no se puede nombrar se
reescribe distinto.** Ahora el alta se llama `abrirAltaAlbaran`, se nombra UNA vez, y los dos
botones la llaman. Con guard de que siguen siendo exactamente dos.

### ② SCRUM-367 se quedaba sin dato al pasar por la hoja

`mkRow` pinta un input por campo y el guardado **reconstruye la línea desde los inputs**.
`quoteLineIndex` no tiene input, así que se perdía. Mi propio cambio habría dejado sin dato a
SCRUM-367 el mismo día que se mergeó.

**Y destapa que la EDICIÓN ya lo perdía en `main`:** SCRUM-367 demostró que el backend lo CONSERVA
(`validarLineas`), pero **nadie comprobó que el front lo MANDE** — y no lo hacía. Ahora el origen
viaja en `r.dataset` y vuelve a salir al guardar, con la comprobación de dígitos **antes** de
convertir (familia SCRUM-271: `Number('')` es `0`, y un origen ausente habría quedado atado a la
primera partida del presupuesto, en silencio).

## Lo que la suite no vio y sí vio la captura

La primera versión del aviso usaba `className = 'alert'` a secas, y `styles.css:1653` esconde
`.alert` sin modificador de color. **El banner existía en el DOM y no se veía**: el suelo entero
habría quedado verde y mudo. Los tests pasaban porque comprueban que el motivo y su texto EXISTEN,
no que lleguen a la pantalla. El guard nuevo **deriva de la hoja de estilos** qué tonos quedan
visibles, en vez de comparar contra una lista escrita a mano.

## Los seis rojos

| # | Qué se rompe | Qué sale |
|---|---|---|
| 1 | Neutralizar el prellenado | 🔴 «el prellenado de SCRUM-257 ha dejado de llegar a la hoja de creación» |
| 2 | Confundir «ilegible» con «sin líneas» | 🔴 «LOS DOS CASOS SE CONFUNDEN EN UNO» (y cae **solo** ese test) |
| 3 | Devolver el POST al manejador del clic | 🔴 «EL ALBARÁN VUELVE A CREARSE AL PULSAR EL BOTÓN… UN HUECO EN LA SERIE» |
| 4 | El atajo de cabecera vuelve a crear por su cuenta | 🔴 «hay un ALTA fuera de `openAlbCrearSheet`» + «deberían ser DOS» |
| 5 | El aviso vuelve a la clase pelada | 🔴 «el tono «silencioso» no está entre los que styles.css deja visibles» |
| 6 | Quitar cada extremo del origen (a y b) | 🔴 «LA FILA NO GUARDA EL ORIGEN» · «se lee pero no se pone en la línea que se envía» |

Los seis con `node --check` limpio antes de creerse el rojo: un rojo de sintaxis no prueba nada.

## Un guard ajeno saltó, y tenía toda la razón

El de **SCRUM-367** recorta desde `lineasDeQuoteParaAlbaran` hasta `renderJobDetailView` y exige
menos de 3000 caracteres. Mi bloque cayó dentro y su escáner ciego saltó a 5461. **Se movió el
código nuevo por encima del de SCRUM-257 en vez de tocar el guard ajeno**: la región que 367 vigila
vuelve a ser exactamente la que vigilaba.

## Lo que NO se tocó

El mecanismo de firma · el prellenado en sí (`lineasDeQuoteParaAlbaran`, reutilizado **entero y sin
tocar**, con sus cuatro criterios cerrados incluido que **no re-sincroniza nunca** porque
`computeAlbaranContentHash` sella esas líneas como el contenido firmado) · el 409
`job_without_quote` del backend · el detalle (C2) · el listado (C1) · la conversión a factura
(A0.4) · `prisma/schema.prisma`.

## Microcopy (regla 30)

Las **7 ranuras** nuevas salen con `[PENDIENTE microcopy oficial]` **delante del texto**, no en vez
de él: con el marcador solo, «ilegible» y «sin líneas» dirían LO MISMO y el suelo sería decorativo.
El guard compara contra las constantes, nunca contra un literal, así que el día que se aprueben los
textos sigue verde sin tocarlo (patrón de SCRUM-263).

## Verificación

- `npm run build` → **exit 0** · `npm test` → **exit 0**: **1719 tests · 1652 pass · 0 fail · 67
  skipped**, contra el `main` resultante del rebase.
- Capturas AB6 y sus huecos declarados: `docs/capturas/scrum-303/README.md`.
