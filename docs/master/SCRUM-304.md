# SCRUM-304 (C3) · Los albaranes del Trabajo: tabla, no pila de tarjetas

**Fecha:** 5-ago-2026 · **Carril:** C · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `56874623baa406a0e8e38b93c236f7a4740b1e6a` · 2026-08-05T16:43:57+01:00

> ⚠️ **NO MERGEAR TODAVÍA.** El código está completo y en verde, pero el AB6 **no está firmado**:
> a 390 px la columna Acción se sale de pantalla, y la causa medida es el marcador de microcopy
> pendiente. Se cierra aprobando los cinco rótulos y recapturando. Detalle abajo.

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

Tabla `.table`/`.table-wrap` (inventario AB3, cero componentes nuevos) con **Nº · Fecha · Estado ·
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

## 🔴 Lo que falta para cerrar: AB6 y la microcopy

La captura enseñó lo que la suite no ve: **a 390 px solo caben Nº y Fecha; Estado, Líneas y Acción
quedan fuera.** El envoltorio se pasó a `overflow-x: auto` para que al menos se pueda alcanzar
scrollando —**no se tocó la clase compartida `.table-wrap`** (`overflow: hidden`, styles.css:590),
que la usan otras cinco pantallas sin medir—, y la fecha se acortó a «12 jul» porque
«12 jul 2026, 11:15» empujaba sola la columna Acción fuera.

**Pero la causa de fondo es el marcador**: `[PENDIENTE microcopy oficial]` mide 29 caracteres **por
columna**, y con cinco columnas infla la cabecera hasta sacar la tabla de la pantalla. Con los
rótulos aprobados (`Nº`, `Fecha`, `Estado`, `Líneas`, `Acción`) la cabecera cae a una fracción.

**Por eso los cinco rótulos van al fundador para aprobación, y hasta entonces esto no se mergea:**
una tabla cuya única acción hay que buscar scrollando es exactamente lo que este ticket viene a
arreglar.

## Lo que NO se tocó

El resto de la pantalla del Trabajo (G1) · el detalle (C2) · el listado (C1) · la firma · el PDF ·
`prisma/schema.prisma` · la clase compartida `.table-wrap`.

## Verificación

- `npm test` → **exit 0**: **1755 tests · 1688 pass · 0 fail · 67 skipped**, contra el `main`
  resultante.
- Capturas y huecos: `docs/capturas/scrum-304/README.md`.
