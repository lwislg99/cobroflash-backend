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
3. **🔴 LA FIRMA, Y AHORA SE COMPRUEBA** (SCRUM-726). Una línea, fuera de cualquier cita:

   ```
   **Aprobado por el fundador** el <fecha>, en **SCRUM-<n>**.
   ```

   Si la firma dice otra cosa —«por el asesor», «pendiente»— el registro **se lee igual, pero sus
   textos NO cuentan como aprobados**: `constaAprobado()` los ignora y `pendientesDeFirma()` los
   lista para que el fundador los firme. **No se borra nada de la pantalla por esto.**

   Hasta SCRUM-726 esa función contestaba «aprobado» en cuanto el texto estuviera escrito aquí,
   **sin mirar quién firmaba** — comprobaba que alguien lo hubiera escrito, no que lo hubiera
   aprobado quien puede. La regla 30 estaba escrita y no había nada que la hiciera cierta.

   ⚠️ **La firma se lee FUERA de las líneas de cita (`>`)**, que es donde los registros guardan su
   propia historia: leyendo el fichero entero, una frase citada que explica un error pasado
   decidiría por la firma de verdad.
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

## Si vas a escribir un lector, lee esto antes

Es la parte que más se copia, así que aquí está el patrón bueno.

**Usa el buscador compartido. No abras un fichero por su ruta.**

```js
import { constaAprobado, literalesAprobados } from '../../tests/_microcopy-aprobada.mjs';

const donde = constaAprobado('Guardar precios');   // → ['docs/MICROCOPY_APROBADA_SIN_APLICAR.md']
```

Un lector que abra `docs/MICROCOPY_APROBADA_SIN_APLICAR.md` por su ruta y busque dentro **contestará
«no consta» sobre cualquier aprobación nueva**, porque las nuevas viven aquí, en un fichero propio.
Ese patrón existe hoy en el árbol y funciona sólo porque el registro viejo se conservó entero.

**🔒 Y no compares por subcadena. Un prefijo no es un nombre, y una subcadena tampoco.**

`constaAprobado` compara por **identidad** contra las unidades en las que el registro escribe un
literal: la celda de la columna **«Texto aprobado»** de una tabla, y la línea de **cita (`>`)** en
los ficheros de este directorio. No es una convención inventada: es la que el registro ya usaba.

El motivo está medido, no es teórico. Hay literales aprobados de dos palabras —«Mano de obra»,
«Materiales», «Guardar precios», «Precio por unidad»— y sus trozos aparecen en la prosa normal del
registro. Con búsqueda por subcadena, preguntar por **«Precio por»** o por **«de obra»** contestaba
**aprobado**, y nadie firmó eso. Está corrido en `tests/scrum715-consta-por-identidad.test.mjs`, con
el caso que distingue los dos mecanismos y con el control de que apretar el matching **no tiró
ninguna aprobación legítima**: las 21 conocidas se siguen encontrando una a una.

**Las notas no son textos aprobados.** El registro congelado usa `>` para avisos, así que las citas
sólo cuentan como literal dentro de `docs/microcopy/`. Si aceptaras las de allí, cada advertencia
pasaría a ser un texto «firmado por el fundador», que es exactamente lo que la regla 30 impide.

**Y si tu lector no encuentra nada, que lo diga.** `aprobacionesDeMicrocopy()` **lanza** cuando el
barrido vuelve vacío: cero es «no supe mirar», nunca «no hay aprobaciones».
