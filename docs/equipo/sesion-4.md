# Sesión 4 — «¿esto que ve el usuario está firmado y sujeto?»

Microcopy, guards y el parte de trabajo. Conoce sus 32 textos.
Regeneró tres veces una cifra derivada en vez de elegirla.

TRAMPAS RECURRENTES: encadenar el push a otra cosa (dejó el remoto en
rojo unos minutos) y CORTAR LOS SHA.

## Canon que nació aquí (SCRUM-823, 8-sep-2026)

> **Un control que no se puede usar y no puede explicar por qué, no se
> deshabilita: se quita.**

La sección de Albaranes del detalle ofrecía «+ Nuevo albarán» en un
Trabajo CERRADO. Se OCULTÓ la barra en vez de deshabilitar el botón:

  · deshabilitar deja un control muerto en pantalla, y el usuario no
    sabe si es su permiso, un fallo de carga o el estado del Trabajo;
  · decírselo habría exigido un texto que nadie ha firmado (regla 30),
    y un rótulo inventado para tapar un hueco es peor que el hueco.

Ocultar no miente ni inventa. **Sólo vale cuando el control no puede
explicarse**: si hay un texto firmado que diga por qué, deshabilitar y
decirlo es mejor, porque enseña que la función existe.

Y el control que lo vigila lleva su POSITIVO: la barra TIENE que verse
en un Trabajo en curso. Sin eso, «no se ve en el cerrado» podría ser
que la sección entera dejó de pintarse.

## Y el que lo acota, del mismo ticket

> **Un acto irreversible no es nunca la acción principal.**

La acción principal es la que se pulsa sin leer — para eso está en
primaria y por eso funciona. Se propuso subir «Cerrar trabajo» a
primaria de `terminado` y se descartó: es el único acto sin vuelta
atrás de la FSM, y SCRUM-344 lo puso en el «⋯» con su modal justo por
eso. *Aquí el riesgo no es el clic accidental: es no entender lo que
se hace.*

## Método, corregido por el fundador el 8-sep-2026

Paró de construir «▶ Empezar» porque corregía una tabla que él había
firmado. Eso era de más:

> **Si tu medición tumba una decisión firmada, gana tu medición: se
> dice y se construye, no se para.**

Se para por un rótulo sin firmar o por un componente compartido, no
por tener razón.

## Canon del 9-sep-2026 (SCRUM-831, y el ticket que salió de él)

> 🔒 **Una decisión de producto no vive en una vista.**

Ha mordido TRES veces con la misma forma: la regla que dice qué se
puede hacer con un documento se escribe dentro del fichero de la
pantalla que la estrenó, y la siguiente que la necesita no puede
nombrarla.

  · SCRUM-366 · `jobNextAction` en `jobDetailView.js` → la lista de
    Trabajos escribió la suya: mismo Trabajo, dos acciones distintas.
  · SCRUM-823 · `abrirAgendarTrabajo` en `jobsView.js` → el detalle
    no sabía agendar.
  · SCRUM-831 · `primariaDeAlbaran` en `jobDetailView.js` → la lista
    de Albaranes, la única de las cinco de la casa con CERO acciones.

En 366 se reescribió peor; en 823 y 831 no se usó. **Una función
correcta que la otra pantalla no puede nombrar acaba en una de esas
dos.** Cuántas quedan es SCRUM-837.

> 🔒 **Cuando un guard te estorba, la salida no es apagarlo ni
> excluirte: es que la pregunta que hace sea la correcta.
> «Exactamente este cambio» es más fuerte que «no cambies».**

`guard:lista-trabajos` se puso rojo porque Albaranes cambiaba **a
propósito**. Había dos salidas cómodas —relajarlo o sacar Albaranes
de su población— y las dos dejan la lista sin vigilar para siempre.
La tercera es la buena: cambiarle la PREGUNTA. Ahora exige que las
tres hermanas sigan idénticas por hash y que Albaranes cambie
**exactamente como está declarado**. Después del ticket vigila más
que antes, no menos.

## Reportado a la Sesión 0 — no lo escribo yo (9-sep-2026)

Estos dos van a `00-normas-comunes.md`, que desde hoy tiene **un solo
dueño: la Sesión 0**. Quedan escritos aquí para que no se pierdan, y
como REPORTE, no como norma en vigor.

**① A17, con el texto que dio el fundador:**

    A17 · Un ticket, una rama, un PR, y se empuja el mismo día. Si un
    ticket no cabe en un día, se parte. Nunca se apilan varios tickets
    en una rama: al apilarlos, o entran todos o no entra ninguno.
    🔒 «Un conflicto no lo causa la herramienta: lo causa una rama que
    vive demasiado.»

La prueba es mía: el PR #1214 llevaba 816 + 823 + 831 dentro, 17
commits y 51 ficheros, y **dos conflictos pararon los tres a la vez**.
Ninguno de los dos conflictos era del ticket que los sufría.

**② A15 NO EXISTE.** La numeración salta de A14 a A16. Medido el
9-sep-2026 sobre `origin/main = ee13c63f`:

    git show origin/main:docs/equipo/00-normas-comunes.md | grep -n "A15"   → 0
    git grep -n "A15" origin/main -- docs/equipo/                            → 0
    git grep -n "^## A15" <todas las ramas remotas> -- <ese fichero>         → 0

Cero en las tres, y con el control positivo hecho: el mismo comando
sobre `A16` sí la encuentra, así que el cero no es ceguera del
instrumento. **No es un hueco que yo pueda tapar: el fichero ya no es
mío.** Y probablemente no está perdida, sino atascada — ver el bloque
del #1212, aquí abajo.

## Canon del merge (SCRUM-831, firmado el 9-sep-2026)

> 🔒 **Un conflicto no se verifica leyendo el diff: se verifica
> comprobando que el resultado contiene los dos lados enteros.**

Leer el diff sólo enseña lo que git decidió enseñar. Lo que hace falta
saber es otra cosa: si alguna línea de alguno de los dos lados se ha
quedado fuera. Eso es una pregunta de CONTENCIÓN, y se contesta con un
comando, no con la vista:

    comm -23 <(sort -u <lado A>) <(sort -u <resultado>)   → vacío
    comm -23 <(sort -u <lado B>) <(sort -u <resultado>)   → vacío

Y lo que salga NO es automáticamente una pisada: cada línea ausente se
rastrea hasta la BASE COMÚN. Si ya estaba en la base, la cambió tu
lado a propósito; si la añadió el otro lado después, la estás pisando.
Sin ese segundo paso, el comando da falsos positivos y se deja de usar.

En este merge salieron 4 ausencias y las 4 eran de la base — cambios
deliberados de SCRUM-816. Cero trabajo ajeno pisado, y demostrado.

> 🔒 **Un historial con un punto en rojo es un historial donde no se
> puede bisecar.**

El trinquete `scrum713c` no estaba en conflicto y aun así se ponía
rojo en el árbol fusionado: pide IGUALDAD, no `<=`, y SCRUM-831 había
bajado la cuenta de 351 a 348. Arreglarlo en un commit POSTERIOR al
merge deja un punto del historial con la suite rota, y ese punto
envenena cualquier `git bisect` que lo pise después. Fue DENTRO del
commit de merge.

Corolario, que es lo que hace falta para poder hacerlo bien: **una
cifra derivada que cruza un merge no se elige, se recuenta sobre el
árbol ya fusionado** — y con el contador del propio guard, no con uno
de casa. Aquí se contó dos veces por caminos distintos: 348 y 348.

## 🔴 EL #1212 PARADO — los tres daños, juntos

Aquí en un sitio, como pidió el fundador el 9-sep-2026, porque es el
argumento del vigía de ramas atascadas. **Cada uno con su origen**: lo
que he medido yo, lo que es hipótesis y lo que me han contado. Mezclar
los tres es cómo una observación se convierte en un hecho falso.

| # | daño | origen | comando que lo mide |
| --- | --- | --- | --- |
| 1 | SCRUM-829 sin cerrar | **contado por el fundador**, no medido aquí | estado del ticket en Jira |
| 2 | un commit ajeno en la punta de la rama | **contado por el fundador**, no medido aquí | `git log origin/<rama del 1212> -1 --format='%an %s'` |
| 3 | **la norma A15 no está en `main`** | **MEDIDO por esta sesión** el 9-sep sobre `origin/main = ee13c63f`, tres comandos a cero con control positivo sobre A16 | los tres de arriba |

**La hipótesis que une los tres —y es HIPÓTESIS, del fundador, no un
hecho—:** la Sesión 3 escribió A15 en un turno anterior y esa
escritura viaja en la rama del #1212. Si es así, A15 no se perdió en
un merge: **está atascada**. Lo comprueba la Sesión 0, que es la dueña
del fichero; esta sesión NO lo ha comprobado, a propósito.

Lo que sí queda establecido sin depender de la hipótesis es el hecho
③: la norma no está en main, y eso es medible hoy.

🔒 **Una rama parada no cuesta una rama: cuesta todo lo que alguien
escribió dentro y nadie sabe que le falta.** El daño de un PR atascado
no se ve en el PR — se ve en un fichero de otra sesión al que le falta
una norma y en una numeración que salta.
