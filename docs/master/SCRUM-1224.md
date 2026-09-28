# SCRUM-1224 · El guarda de dev miraba la primera acción de un `ALTER TABLE` y se creía el resto: un `DROP COLUMN` detrás de un `ADD COLUMN` pasaba

**Medido contra:** `origin/main` = `a59dc1e692bae683d2d035fe52534b5589d0c7b3` · 2026-09-28T15:05:23Z

J6 (jv-j6). Con GO del orquestador del equipo de Javier para arreglarlo: **no es relajar un guard,
es arreglar uno que no guarda** (regla 41). Toca `scripts/_aplicar-sql-dev.mjs` y su test,
`tests/scrum425-aplicador-sql-dev.test.mjs`.

## El hueco

`_aplicar-sql-dev.mjs` es el **único** guarda entre `aplicar-sql-dev.mjs --go` y
`yaqu_dev_javier`. Su forma `ALTER TABLE … ADD COLUMN` termina en `[\s\S]+`, así que miraba la
**primera** acción y lo que fuera detrás de la coma pasaba sin mirar. Medido con la copia de
`origin/main` `a59dc1e6`:

| sentencia | antes |
|---|---|
| `ALTER TABLE "merchants" ADD COLUMN "x" INTEGER, DROP COLUMN "email";` | **ACEPTADA** («ALTER TABLE … ADD COLUMN») |
| `ALTER TABLE "merchants" ADD COLUMN "x" INTEGER, ALTER COLUMN "email" TYPE INTEGER;` | **ACEPTADA** |
| `ALTER TABLE "merchants" DROP COLUMN "email";` (control) | rechazada |

Lo encontró J6 al aplicar en dev el arranque de serie (SCRUM-1216b), que es un `ALTER` con dos
`ADD COLUMN`. Ese DDL sí estaba limpio (se leyó entero y lo confirmó una segunda sonda, el
clasificador de producción).

**Acota una afirmación de SCRUM-1214:** «9 destructivas rechazadas por las dos listas» era verdad
sólo para sentencias de **una** acción (comentario en 1214).

## El arreglo: el algoritmo que ya funcionaba al lado

El `ALTER TABLE` se parte en acciones por las comas de **primer nivel**, y **cada una**, sola,
tiene que ser una forma de la lista. Es el algoritmo de `partirAcciones` del clasificador de
producción, aplicado sobre su `desnudar` (importado, no copiado). `desnudar` conserva las
posiciones y convierte los literales en espacios, así que una coma o un paréntesis dentro de `'…'`
no parten nada. Lo que no se sabe leer (un literal sin cerrar) se **rechaza**.

**No se ha añadido ni quitado ninguna forma** de `PERMITIDAS`.

## Rojo, verde y controles

- **ROJO**, con el guarda sin tocar: los tests nuevos caen 2 de 3. Son el de la destructiva tras
  la coma y el de la tercera y cuarta acción; el de los positivos ya pasaba.
- **VERDE:** 18/18 en `scrum425`. Los 5 ficheros de test que usan el aplicador de dev, 80/80, más
  `scrum854`.
- **Las 10 destructivas en forma MIXTA**, detrás de un `ADD COLUMN`, rechazadas todas: `DROP
  COLUMN`, `ALTER COLUMN … TYPE`, `DROP TABLE`, `TRUNCATE`, `DELETE`, `UPDATE`, `RENAME COLUMN`,
  `DROP TYPE … CASCADE`, `ALTER COLUMN … DROP NOT NULL` y `DROP CONSTRAINT`.
- **Todas las acciones:** se rechaza también cuando la destructiva va la **tercera** o la
  **cuarta**.
- **Positivos que no caen:** el `ALTER` real de 1216b (dos `ADD COLUMN IF NOT EXISTS`), uno con
  tres columnas y un `NUMERIC(12,2)` (coma dentro de paréntesis), y un `DEFAULT 'a, b'` (coma
  dentro de un literal).
- **Mutación:** con la comprobación nueva desactivada (`return true`) caen los dos tests del
  hueco. Restaurado con el mismo sha256 (`066e23490bc2dab7`).
- **Sobre el SQL real:** 116 versiones históricas de `docs/sql/*.sql` más los ficheros de HEAD,
  415 sentencias. **Cambian 0.** Ninguno de los ficheros que hemos aplicado llevaba una acción
  destructiva escondida, y los `ALTER` reales de varias acciones siguen pasando.

## Lo que sigue igual a propósito

- `ADD COLUMN …, ALTER COLUMN … DROP DEFAULT` en el mismo `ALTER` **pasa**, porque cada acción es,
  sola, una forma admitida (la segunda es la de SCRUM-797). Mirar cada acción no endurece las
  formas: las aplica una a una.
- La lista de producción no se toca (sus cambios van en SCRUM-1214 y SCRUM-1223).
