# SCRUM-995 · `docs/equipo/traspaso-javier.md`, el estado del equipo de Javier

**Medido contra:** `origin/main` = `1dd09882fefa41186e9852c5bb39f20d4aa495d8` · 2026-09-21T13:28:13Z

21-sep-2026 13:28Z · `origin/main = 1dd09882fefa41186e9852c5bb39f20d4aa495d8` · rama
`scrum-995-traspaso-javier` · escrito por el **orquestador del equipo de Javier**, que es su dueño
(`dos-equipos.md` §3.3).

## El defecto, medido antes de escribir nada (PASO 0)

```
git show origin/main:docs/equipo/traspaso-javier.md   ->  fatal: path does not exist
git show origin/main:docs/equipo/traspaso.md          ->  existe (equipo de Luis, 17-sep)
```

`dos-equipos.md` §5.5 obliga a cada orquestador a escribir el estado de SU equipo y a **leer el del
otro** al arrancar, porque los dos orquestadores **no pueden hablarse**: máquinas distintas, cuentas
distintas, y la memoria de una máquina no la ve nunca la otra. `orquestador-javier.md` §3 dice que
`traspaso-javier.md` lo crea su orquestador **en su primera tanda**.

**No se creó.** El equipo de Javier existe desde el 18-sep-2026; entre esa fecha y hoy, el equipo de
Luis no tenía **ninguna** forma de saber en qué estaba éste: el único canal que les queda es Jira y el
repositorio, y en el repositorio no había nada. Es deuda del orquestador, no de ningún puesto.

## Qué lleva el fichero, y qué NO

**Lleva el ESTADO**, que es lo que caduca: objetivo vigente con el literal de Javier, quién ocupa cada
puesto hoy, los tickets vivos y en qué punto están, lo que este equipo le debe al de Luis y al revés,
los recursos compartidos medidos en esta máquina, el trabajo commiteado que no está en ningún remoto,
y las autorizaciones (que no se heredan).

**NO lleva el MÉTODO** — ése es `orquestador.md`, común a los dos equipos, y lo que cambia para éste,
`orquestador-javier.md`. **NO lleva los LÍMITES** — ésos son `limites-del-fundador.md`. Una regla
escrita dos veces son dos reglas que pueden divergir (regla 35).

## Lo que se comprobó antes de empujar

- **Fecha y SHA en la primera línea** (A14): un traspaso es una foto con fecha, no el ahora, y el que
  lo lea tiene que poder saber cuánto ha caducado.
- **Cada ruta y cada comando citados existen en `origin/main`**, no sólo en esta rama — comprobado uno
  a uno con `git cat-file -e origin/main:<ruta>` sobre las 13 rutas citadas. Es el error que cometió J6
  el 18-sep en SCRUM-956 (citó 4 scripts que sólo vivían en una rama sin mergear) y que no se repite.
- **Ninguna afirmación sobre el código sin su comando.** Lo que no está medido va escrito como tal:
  el censo de huérfanos trae su comando y su fecha; la causa de que las tareas programadas no hayan
  corrido nunca **la confirmó Javier** (el PC estuvo apagado) y así se dice, en vez de deducirla de la
  configuración de las tareas.
- **Ningún secreto:** no aparece ninguna cadena de conexión, usuario ni contraseña, ni real ni de
  ejemplo.

## Hueco declarado, para la S0

`dos-equipos.md` §4 exige **dos** etiquetas en todo ticket (equipo + área), y las de área van de
`area-j1` a `area-j6`. **No hay ninguna para el orquestador**, aunque §3.3 le asigna ficheros propios
(`traspaso-javier.md`, `orquestador-javier.md`). Este ticket usa `area-orquestador` a falta de otra
cosa. La S0 es la dueña de `dos-equipos.md` y decide el nombre; si prefiere otro, se cambia y se dice
en el ticket.

## Lo que este ticket NO hace

No toca `orquestador.md`, `00-normas-comunes.md`, `dos-equipos.md` ni `limites-del-fundador.md`: son
de la S0 y del orquestador de Luis, y se les propone por Jira (`orquestador-javier.md` §4). No toca
`src/`, `public/` ni `prisma/schema.prisma`.
