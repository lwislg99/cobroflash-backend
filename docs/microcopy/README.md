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

   **O la firma delegada** (SCRUM-861), cuando el texto lo aprueba el orquestador por la
   delegación permanente que el fundador dejó escrita en `docs/equipo/limites-del-fundador.md`:

   ```
   **Aprobado por el orquestador por delegación del fundador** el <fecha> — SCRUM-<n> comentario <id>.
   ```

   Cuenta **sólo** con las tres cosas a la vez: esa frase exacta fuera de cita, la referencia al
   comentario de Jira **en la misma línea**, y la sección «Delegación permanente» de
   `limites-del-fundador.md` con su línea de microcopy. Si el fundador retira la delegación, estas
   firmas **dejan de contar solas**. ⛔ Nadie escribe «Aprobado por el fundador» si no es él.

   Si la firma dice otra cosa —«por el asesor», «por el orquestador» a secas, «pendiente»— el
   registro **se lee igual, pero sus textos NO cuentan como aprobados**: `constaAprobado()` los
   ignora y `pendientesDeFirma()` los lista para que se firmen. **No se borra nada de la pantalla
   por esto.**

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

🔴 **«¿Consta en alguna ficha?» no dice que la firma siga vigente** (SCRUM-1306). Este directorio no
se borra, así que cuando un texto se vuelve a firmar en una ficha nueva, el literal viejo **sigue
constando** en la suya. Para un texto que se pueda volver a firmar, el guard lo comprueba contra
**su** ficha, por ticket **y** ranura, o por su ruta exacta:

```js
const r = aprobacionesDeMicrocopy().find((a) => a.ticket === 'SCRUM-n' && a.ranura === 'mi-ranura');
```

Y cuando se vuelva a firmar, la ficha nueva trae ranura nueva y el guard cambia a ella. La ficha
vieja **no se toca**: ni se borra ni se marca. Los guards que preguntan de la forma débil no pueden
aumentar: lo vigila `tests/scrum1306-consta-en-alguno.test.mjs`.

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

## Un texto firmado largo (SCRUM-1329)

`tests/scrum514-aprobado-y-aplicado.test.mjs` trata como **nota** —prosa que nadie pinta— toda cita
de más de 160 caracteres. Un texto firmado puede pasar de ahí, y entonces la ficha lo dice de forma
que el guard lo pueda comprobar leyendo. Las tres cosas a la vez:

1. El texto va **entero en UNA línea de cita** (el encabezado ya no cuenta: SCRUM-1334, abajo).
2. La **línea de la firma nombra el comentario de Jira** donde se firmó, en esa misma línea:
   `**Aprobado por el fundador** el <fecha>, en **SCRUM-<n>** (comentario <id>).` La firma delegada
   ya lo lleva.
3. El código lo **pinta tal cual**, en un solo literal.

Si falta alguna, el guard cae diciendo cuál: no sabe si es una cita firmada o una nota, y no lo
deja pasar. ⛔ **Un texto firmado no se parte ni se reescribe para que quepa** (regla 39): el texto
manda sobre el instrumento. Una frase por línea sigue valiendo cuando el texto son varias frases y
el código las pinta por separado.

Lo que el guard **no** comprueba: que ese comentario contenga ese texto. Un test no lee Jira; la
referencia es para que una persona pueda ir a mirarlo.

## En una ficha, toda cita es un texto aprobado (SCRUM-1334)

Hasta el 1-oct-2026 `tests/scrum514-aprobado-y-aplicado.test.mjs` sólo cruzaba con el código las
citas que iban bajo un encabezado «Texto aprobado»: 110 de 248. Las demás no se miraban, y bastaba
titular el apartado con otras palabras para quedarse fuera. Ahora **ningún encabezado decide nada**:
de una ficha se cruzan **todas** sus líneas de cita, vayan donde vayan. Es la misma unidad que ya usa
`constaAprobado`.

Así que al escribir una ficha:

- **Una línea de cita (`>`) es un texto firmado, y nada más va en cita.** Una nota, un aviso o un
  «qué había antes» se escriben como párrafo normal. Con el `>` delante, el guard los busca en el
  código y cae, y `constaAprobado` los da por firmados.
- **Un texto con huecos** se escribe con llaves, `{n} fotos`: el guard no lo cruza y lo cuenta
  como plantilla.
- **Un texto que el código compone** y que se cita con un ejemplo (`3 fotos`), o que el código
  tiene partido en dos literales, no aparece tal cual. Se declara en `NO_SE_CRUZAN`, dentro del
  propio guard, con el fichero donde se compone y sus partes fijas; el guard comprueba en cada
  pasada que esas partes siguen ahí.
- **Lo que no sea ninguna de esas cosas y el código no pinte, cae**, y el rojo dice la ficha y la
  sección. O se aplica, o se aparca en `APARCADOS` con su motivo.

En cada pasada el guard dice lo que ha hecho: «crucé N de M citas», y cuántas no cruza y por qué
(plantillas, declaradas, de menos de 4 caracteres). ⛔ Un texto firmado no se cambia para que cruce
(regla 39), y el guard no se afloja para que pase (regla 41).
