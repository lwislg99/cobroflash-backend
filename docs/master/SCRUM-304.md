# SCRUM-304 (C3) · Los albaranes del Trabajo: tabla, no pila de tarjetas

**Fecha:** 5-ago-2026 · **Carril:** C · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `d5ac9761da139bf9b6de3c808d7c990aa6b82157` · 2026-08-05T17:04:15+01:00

## 🔴 El censo corrige al ticket, y por eso va PRIMERO

El ticket titula «El defecto, **medido**» y lo que sigue es una captura y un cálculo de altura de
pantalla. **Eso no es una medición del código.** Derivado por AST del bloque `albaranes.forEach`:

| El ticket dice | Lo medido |
|---|---|
| «tarjetas verticales apiladas» | Eran filas `.job-doc-row`, y **SCRUM-319 (G4) ya les había dado sección propia** |
| `[PDF] [Firmar] [Editar líneas] [⋯]` | **PDF, Firmar y el `⋯` ya no estaban**: se los llevó SCRUM-302 (C2) al detalle |
| cuatro botones por tarjeta | **Cuatro controles**, y otros: checkbox de consolidación · `Editar líneas` · `Ver albarán` · `Facturar parte` |

**El defecto que el ticket describe estaba medio resuelto por dos tareas posteriores.** Lo que
quedaba es lo que esta tarea hace: que la columna Acción **obedezca a C2** y que desaparezca la
contradicción de «Editar líneas siempre». *El ticket no se cumple al pie de la letra, y eso es el
resultado, no un incumplimiento.*

## 🔴 La contradicción que ya existía, y que solo se ve CONTRASTANDO los dos censos

> Hoy la fila pintaba «Editar líneas» **SIEMPRE**, y C2 declara
> `borrador: secundaria · emitido: oculta · firmado: oculta`.
> **La fila ya contradecía al registro de C2, antes de tocar nada.**

Era la segunda fuente de verdad viva desde antes. No aparece leyendo ninguno de los dos censos por
separado: solo al ponerlos uno contra otro. Por eso el contraste tenía que ir primero.

## Lo que se construye

Tabla `.table`/`.table-scroll` (inventario AB3, cero componentes nuevos) con **Nº · Fecha · Estado ·
Líneas · Acción**. Una fila por albarán, el número enlaza al detalle, y **una sola acción: la
primaria de su estado según C2**, resuelta con `destinoEfectivo` — nunca con una jerarquía escrita
aquí.

**El botón NAVEGA al detalle cuando el ejecutor vive allí.** No es invención: es el precedente que
el fundador aprobó en **SCRUM-366** para la lista de Trabajos —*«un solo ejecutor, en el detalle; la
lista dice qué toca y lleva hasta allí»*—, y allí el rótulo **es el de la acción**. Se copia letra
por letra para no tener dos patrones de «este botón te lleva a donde se hace». Los rótulos salen de
`ROTULOS_ALBARAN`, que ya los tiene aprobados: escribirlos otra vez sería la segunda lista.

**`btnFacturar` es el único que ejecuta aquí**, porque `openFacturarParcialSheet` está anidada en
esta vista. Es también uno de los dos puentes que `scrum302-sin-callejones` exige conservar.

### La celda vacía es información

En `firmado` sin nada pendiente **C2 dice que no hay siguiente paso**, y la celda queda vacía a
propósito. Rellenarla para que la columna «se vea completa» sería inventar un paso que no toca.

### El coste aceptado, con su motivo

En `borrador` hay **dos** controles (`Emitir` + `Editar líneas`), no uno. Bajar a uno exigiría
romper el guard de C2 o inventar una segunda jerarquía, y las dos cosas son peores que dos botones
en un estado. **Decisión del fundador.**

## ⚠️ El detalle que envenena en silencio: el mismo dato con DOS nombres

El derivado de tres valores viaja con nombre distinto según el endpoint:
`estadoFacturacion` en el del albarán (`albaranes.routes.ts:437`) y **`estadoCobro`** en el del
Trabajo (`jobs.routes.ts:328`). **Copiar el `ctx` de C2 literalmente daría `undefined`, y
`undefined !== 'facturado'` es `true`**: la fila ofrecería «facturar» sobre albaranes ya cerrados,
sin error y sin que nada se pusiera rojo. Tiene guard propio y su rojo.

## Los cuatro rojos

| # | Qué se rompe | Qué sale |
|---|---|---|
| 1 | La fila se inventa su jerarquía | 🔴 «LA TABLA NO SIGUE A C2… hay DOS fuentes de verdad» |
| 2 | El `ctx` lee el campo del OTRO endpoint | 🔴 «EL CONTEXTO NO VE EL CAMPO… dice “queda pendiente” SIEMPRE» |
| 3 | Se borra «Editar líneas» de la fila | 🔴 «`openAlbEditorSheet` ya no es ALCANZABLE desde la fila» |
| 4 | (control negativo) mover un destino que NO es primaria | ✅ la tabla **no** se mueve |

### El rojo 3 no saltó a la primera, y el fallo era del guard

La primera versión buscaba el nombre del mecanismo **en el bloque** y pasaba en verde con el botón
construido y **nunca añadido**: `const editBtn = () => mkBtn(…, () => openAlbEditorSheet(alb))`
sigue nombrándolo aunque nadie lo cuelgue. **Mencionar no es alcanzar** — el mismo «escribir sin
leer» que cazó SCRUM-303, esta vez dentro del propio guard. Ahora se deriva de los `appendChild` y
se resuelve un nivel de indirección.

## Código muerto borrado, no dejado «por si acaso»

`enSuSeccion` tenía **un solo llamante** (los albaranes) y se ha ido con él. Un ayudante que ya no
llama nadie se pudre sin que nada lo diga. Misma norma que aplicó C2 al borrar `pdfBtn`/`fotoBtn`.

## AB6: lo que la captura midió, y lo que queda dicho

### 🔴 La primera tanda medía el MARCADOR, no la pantalla

Con `[PENDIENTE microcopy oficial]` delante de cada nombre de columna —29 caracteres **por
columna**, cinco columnas— la cabecera sacaba la tabla de la pantalla y a 390 px solo cabían `Nº` y
`Fecha`. **Eso no era un problema de maquetación: era el coste del marcador.**

> **Regla que sale de aquí (y es la segunda vez hoy, tras las diez pestañas de Configuración):
> CON MARCADOR NO SE JUZGA EL LAYOUT. Solo se comprueba que el marcador esté.**

Con los cinco rótulos aprobados (`Nº · Fecha · Estado · Líneas · Acción`) entran ya `Nº`, `Fecha` y
`Estado`.

### 🔴 LA MEDICIÓN QUE AHORRÓ LA TERCERA AMPUTACIÓN

Tras dos rondas quitando columnas seguíamos a **125 px** de que `Acción` entrara. En vez de amputar
la tercera, la pregunta que nadie había hecho: **¿qué forma tiene una lista de esta familia a 390 px
en el resto del producto?**

**EL PATRÓN YA EXISTÍA.** `styles.css` tiene DOS, y ninguno hubo que inventarlo:

| Patrón | Para | Quién lo usa |
|---|---|---|
| `.table--cards-mobile` | listas **con dinero** | `albaranesView.js` · `invoicesView.js` · `quotesListView.js` |
| `.table--stack-mobile` | tablas **simples** | `customersView.js` · `providersView.js` · `templatesView.js` |

**Se elige `.table--cards-mobile` por un motivo que decide solo: es el que usa `albaranesView.js`**
—C1 (SCRUM-301), la lista global del MISMO documento—. Dos formas móviles para el mismo albarán
según la pantalla sería SCRUM-240 en la capa visual.

Por debajo de 640 px la cabecera se oculta y cada fila se recompone como **card**: no hay columnas
que repartir, así que **el problema de ancho desaparece en vez de resolverse quitando información**.

**Las dos amputaciones se REVIRTIERON**: `Fecha` y `Líneas` vuelven. Y las dos palancas aprobadas
(quitar Fecha en móvil, acortar el rótulo) **no hicieron falta** — no se aplicó ninguna.

| Medido a 390 px | Antes del patrón | Con el patrón |
|---|---|---|
| Borde derecho de la celda Acción | 515 px (viewport 390) | **324 px** |
| ¿Entra sin scrollear? | 🔴 NO, faltaban 125 px | ✅ **SÍ**, con 66 px de holgura |
| Botones de acción | 30 px | ✅ **44 px** |

### El número se enseña ENTERO. Cerrado.

Se descartó acortarlo a «0001». Que el año y la serie se repitan en todas las filas **es verdad hoy
con estos datos, no por diseño**: deja de serlo el 1 de enero y en cuanto un filtro junte dos años.
Y la variante «lo acorto solo si todas comparten prefijo» es peor: el mismo albarán se leería de dos
formas según el filtro. **El profesional dicta ese número a su gestoría; medio número es un número
equivocado.** En la card ocupa `cell-client`, el hueco prominente: dentro de un Trabajo el número
ES la identidad.

### Foco y targets: MEDIDOS, y el patrón arregló la mitad

| | Antes | Con el patrón | AB6 |
|---|---|---|---|
| Anillo de foco | SÍ | SÍ | ✅ |
| Botones de acción | 30 px | **44 px** | ✅ |
| Enlace del número (`.detail-miga-link`) | 20 px | **20 px** | 🔴 < 44 |

Los botones se arreglaron **solos** al cambiar de forma: `cell-actions` trae `min-height: 44px`. El
enlace del número **NO**, porque no cae en esa ranura — sigue para el censo de los 139 conjuntos, y
el argumento que le faltaba a esa decisión es éste: *un botón de 30 px en una fila suelta es un
incordio; en la tabla con la que el profesional gestiona TODAS sus entregas, es el control que más
va a tocar*. Y el enlace a 20 px es peor que los botones, y nadie lo había mirado.

**Y una asimetría medida de paso:** `albaranesView.js` marca la tabla con `.table--cards-mobile`
pero **no pone las clases `cell-*`**, así que su rejilla de card no llega a usarse. Aquí sí se
ponen. No se toca C1 —es otro carril (regla 9)—, pero queda dicho.

## Microcopy (regla 30) · APROBADA

Los **cinco** nombres de columna los aprobó el fundador el 5-ago-2026, **tal cual**: `Nº` · `Fecha` ·
`Estado` · `Líneas` · `Acción`. Son los del propio ticket y describen lo que hay debajo. El guard
cambió de trabajo: antes exigía el marcador, ahora compara columna a columna contra el aprobado.

Los rótulos de la ACCIÓN no son nuevos: salen de `ROTULOS_ALBARAN` (C2), ya aprobados.

## Lo que NO se tocó

El resto de la pantalla del Trabajo (G1) · el detalle (C2) · el listado (C1) · la firma · el PDF ·
`prisma/schema.prisma` · la clase compartida `.table-wrap` · `albaranesView.js` (C1, otro carril).

## Verificación

- `npm test` → **exit 0**: **1755 tests · 1688 pass · 0 fail · 67 skipped**, contra el `main`
  resultante.
- Capturas y huecos: `docs/capturas/scrum-304/README.md`.
