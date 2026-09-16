# SCRUM-659 · Leer las LÍNEAS del PDF, no sólo su texto

**Fecha:** 2-sep-2026 · **Carril:** B · **Gate:** desbloquea DOC-03 (SCRUM-593) y T6 (SCRUM-655)
**Medido contra:** `origin/main` = `558765adf2d2f09288e20e2b878c69d6edc3380b` · 2026-09-02T00:00:00+02:00
**Rama:** `scrum-659-lector-de-lineas-del-pdf`

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.
> El ancla está **medida** con `git rev-parse`.

---

## EL INSTRUMENTO NO PODÍA VER UN SALTO

```
CON salto  ('ALFA\nBETA')  ->  extraerTextoPdf: "ALFABETA"
SIN salto  ('ALFABETA')    ->  extraerTextoPdf: "ALFABETA"
```

PDFKit **sí** respeta el salto —lo pinta en dos líneas—, pero el lector concatenaba los fragmentos
sin separador. Con ese instrumento, **un test del criterio «los saltos se ven» pasaría en verde con
el salto roto**: un guard muerto el día que nace. Afectaba a DOC-03 y al criterio de aceptación de
SCRUM-655 (descripciones de ocho líneas).

## SE AÑADE UNA LECTURA; NO SE CAMBIA LA QUE HAY

`extraerTextoPdf` sostiene siete controles: 603, 604, 604b, 623, 625, 636 y 647. **Medido antes de
decidir**, no supuesto:

| campo | usos en la suite |
|---|---|
| `r.ok` | 147 |
| `r.motivo` | 107 |
| `r.texto` | 54 |
| `r.trozos` | **0** |

Añadir un campo habría sido seguro. Se añadió una **función aparte** (`lineasDePdf`) de todos modos:
el riesgo sobre el camino existente pasa a ser **cero**, no «pequeño», y no cuesta nada. **Los 61
tests de esos siete ficheros siguen verdes.**

## CÓMO, Y ESTÁ MEDIDO

PDFKit emite un bloque `BT … Tm … TJ … ET` **por línea**, con la matriz de texto completa:

```
BT  1 0 0 1 72 712.82 Tm  /F1 10 Tf  [<414c46> 80 <41> 0] TJ  ET     ← «ALFA»
BT  1 0 0 1 72 701.26 Tm  /F1 10 Tf  [<42455441> 0]      TJ  ET      ← «BETA»
```

Misma `x`, distinta `y`. Dos fragmentos con la misma `y` son la misma línea; la `y` decrece hacia
abajo, así que ordenar por `y` descendente da el **orden de lectura**.

## EL CONTROL, EN LAS DOS DIRECCIONES

| | |
|---|---|
| con salto | **2 líneas** — `["ALFA","BETA"]` |
| sin salto | **1 línea** — `["ALFABETA"]` |

Y un test exige que **no coincidan**: si dieran lo mismo, el lector no distinguiría nada y esto no
estaría hecho. Ocho líneas se leen como ocho (el caso de SCRUM-655), y se comprueba sobre un
**presupuesto de verdad**, no sobre un PDF de juguete.

## LA INVARIANTE QUE PROTEGE A LOS SIETE

Los dos lectores leen **lo mismo**: sobre un presupuesto real, **307 caracteres contra 307**, mismo
multiconjunto. Lo único que cambia es el **orden** — el flujo del PDF no va de arriba abajo y el
lector nuevo sí. Por eso **no son intercambiables**, y por eso se añade en vez de sustituir.

## FAIL-CLOSED

Un fragmento que no sepamos situar **hace caer la lectura**, no baja el recuento. Si se descartara
en silencio contaríamos menos líneas de las que hay y un salto roto pasaría desapercibido — que es
exactamente el modo en que este instrumento mentiría en verde.

## EL ROJO, PROBADO POR EL MECANISMO — y una rotura que NO caía

| Rotura | Qué cae |
|---|---|
| la tolerancia se come el interlineado | **4 tests**, incluido el control principal |
| se retira el suelo del fragmento sin posición | su test |
| **se pierde el orden por `y`** | **🔴 al principio, NADA** |

La tercera **no la cazaba nadie**: en un PDF de juguete todas las líneas comparten `x`, así que el
orden de inserción ya coincide con el bueno. Se cerró con una comprobación que **sólo funciona
sobre un documento real** —que las `y` salgan decreciendo— y con su propio suelo: se exige que el
flujo del PDF **no** venga ya ordenado, porque si viniera, esa comprobación no distinguiría nada.
Ahora la rotura cae.

## NÚMEROS

* **Suite: 4.325 tests · 4.246 verdes · 0 rojos · 79 saltados.** `guards:entrada`: 21/21.
* Tests nuevos: `tests/scrum659-lector-de-lineas-del-pdf.test.mjs`, **8**.
* Los 7 ficheros que dependen del lector: **61 tests, todos verdes**.

## LO QUE NO SE HA TOCADO

`extraerTextoPdf` (ni una línea), el esquema, DOC-03 —que no se abre hasta que este instrumento
exista— y el calentamiento del navegador (SCRUM-626).
