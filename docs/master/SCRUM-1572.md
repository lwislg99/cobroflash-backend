# SCRUM-1572 · En `docs/master` git une sin conflicto, y un registro que crean dos ramas sale limpio y roto

**Medido contra:** `origin/main` = `b10c9b6ca79e2f0b38368098615dc98140bc063d` · 2026-10-21T13:18:39Z (hora de GitHub al escribir: 2026-10-21T13:33:15Z)
A9: comprobación → `tests/scrum1572-registro-creado-por-dos-ramas.test.mjs`

Puesto J6 (`jv-j6p`) · árbol `j6p-1572` · rama `scrum-1572-registro-creado-por-dos-ramas`. Encargo del
orquestador `cobroflash-backend-5f`; decisión y aceptación en SCRUM-1572 **c.20164** (escrita a petición
de esta sesión, que no quiso construir con un permiso que solo vivía en el prompt). El barrido de la
historia se lanzó sobre `67dde0caf421c9c246775098ab75aee6e8cc41e7` (4.042 merges); la rama sale de la base
del ancla.

## PASO 0

- Nada hecho antes: `git log origin/main --grep=SCRUM-1572`, `ls-remote` anclado a `scrum-0*1572[a-z]?-` y
  `docs/master/` → 0. Control: `git check-attr merge` da `union` en `docs/master/SCRUM-1569.md` y
  `unspecified` en `src/app.ts`.
- Carril (`node scripts/carriles.mjs de`): `.gitattributes`, `scrum839d`, `scrum267` y `scrum273` → «nadie lo
  reclama»; `.github/workflows/conflicto-de-registro.yml` → S5. **No se toca ninguno**: el PR añade un test
  nuevo y este registro.
- `merge=union` sigue igual. No se trae propuesta de quitarlo: la unión sana (dos tramos añadidos a un
  registro que ya existe) es el caso de 839d y este test lo deja en verde a propósito (caso NEGATIVO).

## El mecanismo, medido (no razonado)

1. **Firma por causa, byte a byte.** En `fa1897e48` (SCRUM-1569, #2625) y en `18c3e3686` (SCRUM-964,
   #1544) el fichero no existe en la base del merge, los dos padres lo crean con contenido distinto, y
   `git merge-file --union -p <padre1> <vacío> <padre2>` da **exactamente** el blob del merge
   (`58c3da91…` y `c3ed8107…`). Con `merge=union` git trata el «añadido en los dos lados» como una unión
   contra una base vacía.
2. **Cuándo entrelaza y cuándo pega.** La unión solo intercala si los dos ficheros comparten un bloque de
   **4 líneas o más**; con 1, 2 o 3 los pone uno detrás de otro (medido con bloques de 3, 4, 5 y 6 líneas).
   En `fa1897e48` el bloque eran 5 filas de una tabla que las dos sesiones copiaron igual, y por eso el
   título de un tramo cayó dentro de la tabla del otro.
3. **Población: la historia entera.** De los 4.042 merges de `67dde0caf`, **105** tienen un
   `docs/master/*.md` creado por los dos padres; en **61** los dos blobs son iguales (no hay nada que unir)
   y en **44** son distintos. De esos 44, **10** pierden líneas de un lado (resueltos a mano, todos
   anteriores al 16-sep, cuando entró `merge=union`); los otros 34 conservan las dos.

## Lo que se construye

`tests/scrum1572-registro-creado-por-dos-ramas.test.mjs`, en la tanda. Para cada merge de la rama (desde
`baseDeLaRama`, SCRUM-723, hasta el árbol bajo prueba) busca un registro que **crean los dos padres**, con
contenido distinto, cuyo resultado es **exactamente** la unión de los dos, y que **nadie ha vuelto a tocar**
después. Eso es una unión que entrelazó dos registros y que todavía no ha juntado nadie a mano. No mira la
forma del texto, así que caza igual una tabla cortada que dos párrafos de prosa.

Se ve en rojo así: «la unión de git entrelazó registros que crean las dos ramas; junta los dos tramos a mano
y commitéalo», con el fichero y el merge.

| aceptación (c.20164, literal) | dónde se ve |
|---|---|
| positivo SEMBRADO por el propio test (el caso real fabricado: dos ramas que crean el mismo registro y se unen) → **cae** | `tests/scrum1572-registro-creado-por-dos-ramas.test.mjs`, «🔴 POSITIVO SEMBRADO»: repositorio git de verdad con la regla copiada de `.gitattributes`; comprueba que el merge sale sin conflicto, sin marcadores, y con el título del otro tramo DENTRO de la tabla, y que el detector da 1 hallazgo sobre 1 merge y 1 par |
| negativo sobre un registro sano de `main` → **verde** | el mismo fichero, «🔴 NEGATIVO»: una rama crea un registro con el contenido real de `docs/master/SCRUM-1569.md`, y las dos añaden un tramo a un registro que ya existía (la unión sana de 839d) → 1 merge, 0 pares, 0 hallazgos |
| sin la siembra → **CIEGO**, nunca verde | «🔴 CIEGO»: con la segunda rama creando otro fichero la siembra da 0 y el veredicto es `CIEGO`; y «🔴 EL ÁRBOL» no da verde si la siembra de esa misma pasada no cayó |
| una mutación que lo tumbe | cuatro, en `MUTACIONES_QUE_ME_TUMBAN` del mismo fichero; las cuatro aplicadas a mano el 21-oct, cada una con su `numstat` y su restauración comprobada byte a byte, y las cuatro CAEN (abajo) |

Además: «🔴 RESUELTO EN EL PROPIO MERGE» (quien junta los tramos al hacer el merge no cae) y «🔴 REPARADO
DESPUÉS» (el registro reescrito en un commit posterior no cae).

**Contra el repositorio real** (fuera de la tanda, el mismo detector): `fa1897e48^1..fa1897e48` → 1 hallazgo,
`SCRUM-1569.md`; `fa1897e48^1..b7dd7eeb0` (después del arreglo a mano) → 0.

### Las mutaciones, con la base sin mutar primero

Base: 6 de 6 en verde. Luego, una a una, y `git restore --source=HEAD` tras cada una:

| mutación | numstat | cae |
|---|---|---|
| `--diff-filter=A` → `M` | 1 1 | POSITIVO, NEGATIVO, RESUELTO, REPARADO y EL ÁRBOL (este, por CIEGO: la siembra deja de caer) |
| quitar la comparación con la unión | 0 1 | RESUELTO EN EL PROPIO MERGE |
| quitar la comparación con el estado final | 0 1 | REPARADO DESPUÉS |
| el suelo de la siembra, apagado | 1 1 | CIEGO |

`meta-guard-mutaciones --solo-censo`: 622 → 626 declaraciones con el fichero dentro (162 → 163 declarantes).
`guards:entrada`: 170 de 170. `scrum237` + `scrum976`: 19 de 19. Lo que NO he corrido: la tanda entera
(la corre el obligatorio) ni `npm run meta:mutaciones` completo (las cuatro se aplicaron con un guion propio
que imita su contrato, no con el suyo).

## De paso: dos registros rotos que siguen en la línea principal

Contra la punta de hoy (`18c3e36863^1..origin/main`, 1.749 merges, 45 pares), el detector da **dos
registros que la unión dejó así y nadie volvió a tocar**:

- `docs/master/SCRUM-964.md`, merge `18c3e3686` (#1544): **entrelazado** — el final de un tramo cae
  partido alrededor del otro.
- `docs/master/SCRUM-1289.md`, merge `4c3bddde8`: los dos registros enteros **pegados** uno detrás de otro.

**No los arreglo aquí**: son registros de otros tickets, y juntarlos es decidir qué tramo va dónde, que es
de quien los escribió (A8: un registro se anexa, no se reescribe). El test nuevo no los ve, porque solo mira
los merges de la rama: lo que ya está en la línea principal queda fuera a propósito. Lo que sí se sabe ahora
es la respuesta a la pregunta abierta del ticket («no se sabe si había ocurrido antes»): **sí, al menos dos
veces más, y siguen ahí.**

## Lo que no mira, declarado

- Los merges que ya están en la línea principal (los dos de arriba).
- Un registro que alguien toca después de la unión **sin** arreglarlo: cualquier commit posterior que
  cambie el fichero lo da por revisado.
- Una unión limpia que pega dos registros enteros también cae (no solo la que entrelaza): por causa, no por
  síntoma, y lo que pide es lo mismo, mirarlo y commitear.

## Mis errores

- La primera siembra **no entrelazaba**: dos tramos con 1-2 líneas comunes, que la unión pega uno detrás
  de otro. Lo cazó la aserción del propio test («la siembra no entrelazó la tabla»), y de ahí salió la
  medición del umbral de 4 líneas. Sin esa aserción el positivo habría sido un caso de concatenación
  presentado como el defecto.
- Dos de las cuatro anclas de mutación salían **dos veces** en el fichero (la cita dentro de la propia
  declaración); lo dijo mi guion («NO APLICA 2») antes de declararlas buenas. Reancladas a línea entera.
