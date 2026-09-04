# SCRUM-717 · El comprobador de `select` ↔ uso YA EXISTE: es el compilador

**Fecha:** 4-sep-2026 · **Carril:** integridad de las consultas · **Gate:** sin gate — corre en `npm test`, que llama a `npm run build`

**Medido contra:** `origin/main` = `5bfc11360ba26146369d6f994812de665996f566` · 2026-09-04T12:40:00+02:00

> **Este ticket se entrega como DIAGNÓSTICO y sin guard nuevo, a propósito.** No porque no diera
> tiempo: porque el guard que pedía **ya está construido, ya corre en cada tanda, y lo que faltaba
> era saber DÓNDE deja de mirar.** Construir un analizador que imite al compilador habría sido
> añadir un segundo mecanismo peor para una propiedad que el primero ya cubre.

## 1 · PASO 0

Nadie ha metido un comprobador de `select` ↔ uso: los ficheros que salen por nombre
(`scrum138-export-selectivo`, `scrum584-selector-de-columnas`…) son de selección de columnas de
exportación y de selectores de UI, otra cosa. **Control positivo del mismo `git grep`:**
`serializeJobDetail` sí aparece, en tres tests. El comando ve.

## 2 · 🔴 La medición que cambia el ticket

Mi analizador de ayer daba **0 hallazgos sobre 162 consultas** y **no pasaba su propio control
positivo**: no veía el campo leído a través de un `Map` ni por el parámetro de un callback.

Antes de reescribirlo, la pregunta que había que hacer: **¿lo caza ya `tsc`?** Cinco inyecciones,
todas ejecutadas, ninguna deducida:

| # | Inyección | ¿la caza `tsc`? |
| :-: | --- | :-: |
| 1 | quitar `status` del `select` de `hermanas` — se lee vía **`Map`** (`porId.get(r.id)!.status`) | ✅ **SÍ** |
| 2 | leer `paymentTerms` sin pedirlo — por el **parámetro de un callback** (`.filter((h) => h.paymentTerms)`) | ✅ **SÍ** |
| 3 | *(mía, fuera de la lista)* leer `internalNotes` por **desestructuración** (`const [{ internalNotes }] = …`) | ✅ **SÍ** |
| 4 | *(mía)* quitar `total` de un `select` de `job.service.ts` leído en el mismo fichero | ✅ **SÍ** |
| 5 | *(mía)* quitar `phone` de `CUSTOMER_SELECT` — se lee **tras cruzar un `any`** | 🔴 **NO** |

Y el rojo **nombra el campo**, que es lo que se le pedía al guard:

```
error TS2339: Property 'status' does not exist on type
  '{ id: number; createdAt: Date; quoteNumber: number | null; total: Decimal;
     signatureUrl: string | null; revision: number; } | …'
```

**Control positivo del instrumento** (no de mi intuición): con un error de tipos deliberado
—`const base: number = String(...)`— `tsc` sale con `rc=2` y lo nombra. No estaba mudo.

## 3 · Dónde deja de mirar, exactamente

**Donde el valor cruza un `any`.** La inyección 5 lo fija: `refs.customers` está declarado
`Map<number, any>`, así que `refs.customers.get(job.customerId)` devuelve `any` y todo lo que se
lea de ahí deja de comprobarse.

Quitar `phone` de `CUSTOMER_SELECT` da **`tsc rc=0`** — y el teléfono desaparece del rail del
Trabajo, donde `jobRailBlocks.js:45` lo pinta con tap-to-call:

> «📞 34600000000» como texto plano es un número que hay que copiar a mano con las manos sucias;
> pulsable es una llamada.

Se pierde una función que el profesional usa en obra, **sin un solo error**.

## 4 · El alcance, medido — y por qué no cabe en una tanda

| | |
| --- | :-: |
| `select:` explícitos | **343** en **84** ficheros |
| ficheros con `select:` **y** con `any` | **62** |
| anotaciones `any` en esos ficheros | **506** |
| ficheros con `select:` y **sin ningún** `any` | **22** |

Los tres primeros de la lista son `quotes.routes.ts` (41 `any`), `jobs.routes.ts` (34) y
`albaranes.routes.ts` (31). Quitar un `any` ahí **no es un cambio de tipos**: es tocar el camino de
emisión (regla 38) y ficheros que ahora mismo editan otras tres sesiones.

**Y un trinquete sobre esos 506 tampoco se entrega**, aunque sea barato de escribir: sería un guard
que se pone rojo en las PR de otras sesiones por ficheros que no son míos — exactamente el defecto
que este árbol acaba de corregir dos veces (`SCRUM-402`: *«nacería ROJO y lo apagaría alguien en
una hora»*; `SCRUM-652f`: *«un trinquete de igualdad exacta sobre un número que no es mío»*).

## 5 · Lo que hay que hacer con esto, dimensionado

El trabajo **no es escribir un analizador**: es **retirar `any` de las fronteras por las que pasa
un resultado de consulta**, de uno en uno, con su dueño. Cada `any` que se retira devuelve esa
consulta a la vigilancia del compilador — que ya está encendida y ya nombra el campo.

Orden propuesto por relación esfuerzo/valor, **con la medida delante**:

1. `JobRefs` — `quotes`, `quotesPorJob` y `customers` son `Map<number, any>`. Es **una declaración
   de tipo** y devuelve a la vigilancia los `select` de la lista de Trabajos, que es la pantalla más
   vista. **Empezaría por aquí.**
2. `serializeJob(job: any)` y `serializeJobDetail(job: any)` — la frontera grande.
3. El resto, por fichero y por dueño.

## 6 · Lo que NO se entrega, y por qué

**No hay guard nuevo.** La condición innegociable del encargo era no entregar uno que dé verde por
no mirar, y cualquier analizador que escriba aquí sería una imitación parcial de lo que el
compilador ya hace entero: seguir el valor por callbacks, desestructuración y `Map` es trabajo de
tipos, no de identificadores. Lo demostraron las cinco inyecciones.

**Lo que sí queda escrito** es dónde está el agujero, cuánto mide y por dónde se empieza — que era
lo que no se sabía cuando se abrió el ticket.

## 7 · Hallazgo de otro carril — se reporta, no se arregla

🔴 **`CUSTOMER_SELECT` (`jobs.routes.ts:84`) no está vigilado por nadie.** Hoy trae `phone` y el
rail lo pinta; si alguien lo quita, `tsc` calla, la suite queda verde y el teléfono desaparece de
la pantalla. No lo toco —es de otro carril y su arreglo es el punto 1 de arriba— pero queda dicho
con su línea.
