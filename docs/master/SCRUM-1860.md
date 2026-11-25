# SCRUM-1860 · El ③ de scrum962f acepta reglas de 44 px ACOTADAS a una pantalla

**Medido contra:** `origin/main` = `92df30d4d9c469d74f842ec596ea0a865ae6cebe` · 2026-11-25T13:07:55Z

Puesto S2 (dueño del guard `tests/scrum962f-editor-cuatro-44.test.mjs`), rama `scrum-1860-guard-por-pantalla` (base
`92df30d4d`). Encargo del orquestador (25-nov, tarde). Origen: SCRUM-1848 c.22742 — J3 tuvo que QUITAR sus dos reglas de 44 px
de las casillas de Ajustes (`fbb2a4ab8`, SCRUM-1848b) porque el ③ solo admitía reglas de esa familia que empezaran por
`.quote-ajustes `. Esas cuatro casillas siguen en 17 px, declaradas PENDIENTES en `tests/scrum1848-ajustes-planes-44.test.mjs`.

Sin cambios en `public/`: solo el test (no hay texto ni pantalla que tocar; no aplica la skill de UI).

## Qué protegía el ③, y qué cambia

El ③ existe porque `.inline-checkbox` la comparten varias pantallas (la ficha 360 de J2, Avisos de J3): una regla de 44 px
GLOBAL de esa familia cambiaría el aspecto de pantallas ajenas. Eso se mantiene. Lo que cambia es la forma de comprobarlo:

- **Antes:** el selector tenía que empezar por `.quote-ajustes ` (el editor de presupuestos).
- **Ahora:** el PRIMER compuesto del selector tiene que nombrar la clase de un contenedor que NO sea de la familia
  (`.quote-ajustes`, `.settings-panel`…). Una regla así solo alcanza a esa pantalla. **Cae** la que empieza por la familia, por un
  elemento a secas (`div .inline-checkbox label`: tiene ancestro, pero alcanza a toda la app), por `*`, por `:root` o por un
  `:not(...)` (acota a todo menos algo).
- Se añade un SUELO al ③: si no ve ninguna regla de la familia en `.quote-ajustes`, cae CIEGO en vez de dar «0 sueltas».

## Rojo primero

Caso nuevo **③b** en el mismo test: pega al CSS real las dos reglas LITERALES que J3 quitó en `fbb2a4ab8` y exige que pasen. Como
control, nueve reglas GLOBALES, una a una, y cada una tiene que caer.

- Commit de todo el árbol antes de inyectar: `60ef0aeb18497b2974dce5d82789f3b8edb0f72c`.
- Con el predicado de antes (`/^\.quote-ajustes /`, inyectado, `numstat 1 0`): **1 rojo de 7**, «la regla de J3 acotada a
  `.settings-panel` cae».
- Con un predicado demasiado permisivo («basta con tener un ancestro», inyectado): ③b **rojo**, «la regla GLOBAL
  `.inline-checkbox label { min-height:44px; }` pasa el ③».
- La mutación de catálogo del ③ (desacotar las reglas del editor en `styles.css`, `numstat 2 2`): ③ **rojo**.
- Con el arreglo: **7/7**. Restaurado con `git restore --source=HEAD`, y `git status --porcelain` vacío.

Mutaciones: catálogo → `tests/scrum962f-editor-cuatro-44.test.mjs` (la del ③ ya estaba y sigue tumbándolo).

## Después del merge

Avisar a J3 a través del orquestador: puede volver a poner sus dos reglas de `.settings-panel .inline-checkbox` (SCRUM-1848) y
quitar las casillas de su lista de PENDIENTES.
