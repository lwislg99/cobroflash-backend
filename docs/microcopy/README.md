# `docs/microcopy/` — una aprobación, un fichero

Aquí vive el registro de **cada microcopy que aprueba el fundador** (regla 30). Un fichero por
aprobación, creado **en el mismo acto** en que el texto se aplica al código.

## El nombre

```
AAAA-MM-DD-SCRUM-<n>-<ranura>.md
```

- `AAAA-MM-DD` — el día en que el fundador la aprobó, no el día en que se aplica si son distintos.
- `SCRUM-<n>` — el ticket en el que se aprobó.
- `<ranura>` — dos o tres palabras en minúscula y con guiones que digan de qué pantalla o campo es.

Ejemplo, con un ticket que no existe para que este README no pueda confundirse nunca con un
índice de una línea: `2026-01-15-SCRUM-000-ranura-de-ejemplo.md`.

## ⛔ Lo que este directorio NO tiene, y no puede tener

**Un índice a mano.** El listado del directorio **es** el índice. Si alguna vez aparece aquí un
fichero que toda sesión tenga que editar para apuntar su aprobación, el defecto que SCRUM-709
arregló habrá vuelto entero con otro nombre: ese fichero volvería a ser el punto único de escritura
compartido y las ramas volverían a chocar una vez por par. Este README **no se toca** al aprobar:
explica la convención y nada más.

## Qué lleva dentro cada fichero

Lo que hace falta para que la aprobación sea **verificable por alguien que no estuvo**:

1. El **texto literal aprobado**, tal cual se pinta, sin recortar ni parafrasear.
2. **Dónde se pinta**: fichero y, si ayuda, la ranura.
3. **Quién y cuándo**: el fundador, con la fecha.
4. **Qué cambió** respecto a lo que había, si cambió algo, y por qué.
5. Lo que **queda sin firmar** en esa misma pantalla, si queda algo.

## Cómo se busca una aprobación

Con una sola función, que barre **este directorio y el registro congelado**:

```js
import { aprobacionesDeMicrocopy, constaAprobado } from './_microcopy-aprobada.mjs';
```

Está en `tests/_microcopy-aprobada.mjs` y **falla declarándose ciega** si no encuentra ninguna: un
barrido vacío es «no supe mirar», nunca «no hay aprobaciones».

## El registro anterior

`docs/MICROCOPY_APROBADA_SIN_APLICAR.md` queda **congelado**, entero y sin tocar. Era cierto cuando
se escribió y sigue siendo la constancia de todo lo aprobado hasta el 3-sep-2026.
