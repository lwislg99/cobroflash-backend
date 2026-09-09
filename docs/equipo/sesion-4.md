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
instrumento. O nunca aterrizó o se perdió en un merge. **No es un
hueco que yo pueda tapar: el fichero ya no es mío.**
