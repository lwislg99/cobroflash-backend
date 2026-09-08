# ESTADO DEL SPRINT TECNOSEL — certificado contra el árbol

**Medido contra:** `origin/main` = `78f008cb1aa42678a2db06b1ac31193bf57d205a` · 2026-09-03T14:05:00+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `certificacion-sprint-tecnosel`

> Esto **no es una lectura de informes**: cada casilla lleva `fichero:línea` del árbol de hoy, y lo
> que dice «funciona» se ejecutó. Donde el instrumento no pudo decidir, se dice.

## QUÉ SE BARRIÓ — el alcance, declarado

| población | qué | tamaño |
|---|---|---|
| motor | `src/**` (`.ts`) | dentro de los **980** ficheros de `src` + `public/dashboard/js` + `tests` |
| pantalla | los **72** `.js` de `public/dashboard/js`, `index.html` y el `switch` de `app.js` | 72 · 72 scripts en el índice · **25 vistas enrutadas** |
| columna | `prisma/schema.prisma` | **27 modelos** |

**Criterio de PANTALLA, y es el que decide:** no basta con que el fichero exista. Tiene que estar
en `index.html` **y** tener quien lo llame —una ruta del `switch` de `app.js`, o otro módulo—.
Un módulo sin llamador no es una pantalla: es un fichero.

⚠️ **El instrumento automático falló dos veces y por eso no decide él.** La primera versión ADIVINÓ
nombres de función y dio falsos negativos (dijo que `quotesDetailView.js` no tenía llamador, y está
enrutada). La segunda derivó los símbolos y se volvió demasiado laxa (daba `csvImport.js` como
llamador de `jobNuevoModal.js`). **El barrido localiza; las diez filas se decidieron leyendo la
coordenada.** Ningún «no existe» de esta tabla sale de un cero automático.

## LA TABLA

| # | fila | MOTOR | PANTALLA (enganchada) | COLUMNA |
|---|---|---|---|---|
| 1 | Trabajo SIN presupuesto | ✅ `src/modules/jobs/domain/trabajoDirecto.ts:1` · `POST /` en `jobs.routes.ts` | ✅ `jobNuevoModal.js` ← `jobsView.js:53` | ✅ `schema.prisma:911` |
| 1b | …con **tipo de intervención** | 🔴 **CERRADO**: `trabajoDirecto.ts:83` devuelve `tipo_intervencion_sin_columna` | 🔴 el modal no tiene el campo | ✅ `schema.prisma:911` |
| 2 | Asignar a VARIOS empleados | ✅ `asignacionDeTrabajo.ts:120` ← `jobs.routes.ts:67` | 🔴 **NO EXISTE** | ✅ `JobAssignee` `schema.prisma:1131` |
| 3 | Parte con los campos del papel | ✅ `partes.routes.ts` montado en `app.ts:518` | 🔴 `parteDetailView.js` está en `index.html:312` **y no lo llama nadie** | ✅ `ParteTrabajo` `schema.prisma:1150` |
| 4 | Firmar el parte en el móvil, sin cobertura | ✅ `partes.routes.ts:329` (`POST /:id/firmar`) · cola offline ya tipada `colaDeFirmas.js:70` | 🔴 sin pantalla alcanzable (misma que la 3) | ✅ `firmadoAt` en `ParteTrabajo` |
| 5 | **Precios DESPUÉS de firmar** | ⚠️ **A MEDIAS** — ver abajo | 🔴 **NO EXISTE** | ✅ `lineas Json` en `ParteTrabajo` |
| 6 | Rellenar el parte dictando | ✅ `src/modules/jobs/domain/parteDictado.ts:43` | 🔴 `voiceInput.js` engancha en presupuesto (`aiQuoteAssistant.js:173`) y trabajo (`jobDetailView.js:2051`), **no en el parte** | — (no necesita) |
| 7 | IVA al final + casilla al crear | ✅ `quotes.routes.ts:213` · `schemas.ts:158` | ✅ `quotesView.js:3294` (vista `quotes-new`, enrutada) | ✅ `ivaModo` `schema.prisma:443` |
| 8 | Cláusulas fijas del merchant | ✅ `quotes.routes.ts:214` → `pdf.service.ts:972` | 🔴 **NO EXISTE** (ningún `.js` del panel las escribe) | ✅ `schema.prisma:163` y `:445` |
| 9 | Presupuestos con revisiones | ⚠️ `revision.ts:1` existe y **NO LO IMPORTA NADIE** | 🔴 **NO EXISTE** | ✅ `revision` `schema.prisma:438` |
| 10 | Facturar desde el parte | 🔴 **NO EXISTE** | 🔴 **NO EXISTE** | — |

## 🔴 FILA 5 — la que más importaba. Y es peor de lo que temías

**La pantalla donde el jefe pone los precios NO EXISTE.** Dicho con esas palabras.

Y no es solo la pantalla: **tampoco hay camino de escritura.** Ejecutado, no leído:

    estado      contenido   precios
    borrador    true        true
    firmado     false       TRUE      ← el candado de precios SÍ deja
    facturado   false       false

`puedeEditarPrecios` (`parteTrabajo.ts:207`) hace exactamente lo que dijiste. Pero:

* **solo se calcula y se devuelve** (`partes.routes.ts:121`); **nunca guarda un candado de escritura**;
* el **único** `PATCH` del parte (`partes.routes.ts:252`) se cierra con `puedeEditarContenido`
  (`partes.routes.ts:261`), que en `firmado` es **false** → responde **409 `parte_locked`**;
* `parteDetailView.js` **no menciona `puedeEditarPrecios` ni tiene un solo campo de precio**.

**Consecuencia medida:** un parte firmado no se puede valorar por ninguna vía —ni pantalla, ni API—
y, como no hay camino parte→factura (fila 10), **no se puede cobrar**. El agujero que temías está,
y tiene dos mitades, no una.

## Lo que está APAGADO vs lo que NO ESTÁ CONSTRUIDO

La distinción cuesta órdenes de magnitud, así que va aparte. **Ninguna de las diez filas está
apagada por una flag**: no hay ningún `FLAG` que las gobierne. Lo que hay es otra cosa, y son tres
sabores distintos:

* **CONSTRUIDO Y CERRADO POR UN CANDADO VIEJO** (fila 1b): la columna llegó y la puerta sigue
  diciendo que no existe. Es una línea de código y un test que hoy exige el rechazo. **Barato.**
* **MOTOR SIN LLAMADOR** (fila 9): `revision.ts` está escrito y nadie lo importa. No es que esté
  apagado: es que no está enchufado.
* **PANTALLA INEXISTENTE** con motor listo (filas 2, 3, 4, 5, 8): lo caro del sprint está aquí.

## Lo que este documento NO certifica

No he ejecutado el producto contra un navegador ni contra `yaqu.app`: esto certifica **el árbol**.
Que una pantalla esté enganchada no dice que se vea bien; dice que existe y que hay cómo llegar.

## Suelo de ceguera

Ninguna de las diez devolvió un cero automático que yo haya escrito como «no hay». Las cuatro que
dicen **NO EXISTE** se comprobaron con **dos instrumentos** (barrido por contenido sobre los 72
`.js`, y lectura de la coordenada), y la 10 además desde el otro lado (`partes.routes.ts` no
factura, y `src/modules/invoicing/**` no menciona el parte).
