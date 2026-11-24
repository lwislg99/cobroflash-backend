# SCRUM-1839

**Medido contra:** `origin/main` = `651a143476a309308898fe252360d0b3d6a2a2ad` · 2026-11-24T17:11:22Z

A9: sin fallo que generalice — metí en la sonda una línea suelta de `git cat-file --batch` que habría esperado entrada sin fin, y la quité al releerla antes de la primera pasada; es un descuido de edición en un fichero del TEMP, y el encargo limita este PR al registro

**Encargo (jv-j6fy, J6):** primera mitad, sólo medición: cuántas letras de tramo que llegaron a `main` en un asunto «SCRUM-N<letra>» no tienen su tramo en `docs/master/SCRUM-N.md`. Sonda en el TEMP de la sesión (`medir.mjs`, `extra.mjs`), no en el repo. Lee `origin/main` con `git log` y `git show`, no el disco.

## Población

- **13.083 commits** de `git log origin/main` (asunto, `%s`; el cuerpo no se mira).
- **1.366 ficheros** `docs/master/SCRUM-<n>.md` (sin letra en el nombre).
- Patrón del par: `SCRUM-(\d+)([a-z]{1,2})(?![a-z0-9])`, sólo mayúsculas «SCRUM». Los nombres de rama en minúscula de los asuntos de merge NO entran.

## ① Forma de las cabeceras que nombran un tramo

Sobre las líneas de los 1.366 registros que llevan `SCRUM-<su n><letras>`: **1.051 son cabecera** (`#`…`######`) y **54 no** (negrita, cita o «APÉNDICE» sin `#`). **75 formas distintas** del texto que va delante del número; las que más: `##` 396 · `#` 387 · `## <puesto> ·` 71 · `# APÉNDICE ·` 25 · `# APÉNDICE (X) ·` 15 · `# APÉNDICE · <fecha> ·` 12+7+7+7+6 · `### Pruebas de` 9 · `## Anexo` 7. Además, 98 pares tienen cabecera sólo con el número pegado a la letra SIN «SCRUM-» delante (`## 1058c · …`, `## 1070b · …`): una forma más, que un patrón estricto no ve.

## ② y ③ Cifras

| | pares |
|---|---|
| pares (N, letra) en asuntos de `main` | **1.078** |
| con tramo: cabecera con `SCRUM-N<letra>` | 881 |
| con tramo sólo en forma laxa (`## N<letra>`, sin «SCRUM-») | 98 |
| **sin tramo** (el fichero existe y ninguna cabecera la nombra) | **85** |
| sin fichero `docs/master/SCRUM-N.md` | 14 |

Suman 881 + 98 + 85 + 14 = 1.078. De los 85 sin tramo: **5** se nombran en el cuerpo (no en una cabecera) y **80** no aparecen en el fichero ni una vez. **De los 85, 15 son de los últimos 30 días**; de los 14 sin fichero, 0. Pares con dos letras: 1 (`1787aa`), y sale **sin tramo**.

⚠️ La fecha es la del commit MÁS ANTIGUO que nombra el par (`%ct`), no la del merge: una fecha de commit dice cuándo se escribió, no cuándo entró (A10). Los 30 días se cuentan desde la fecha del commit de la punta medida.

**Control positivo:** `(1730, h)` sale **SIN tramo**, y es lo esperado: `#3409` (1730i, que escribe el tramo) **no está en `main`** a este sha (ningún asunto «Merge pull request #3409»), y las cabeceras de `SCRUM-1730.md` llegan a `1730f`. Cuando entre #3409 tiene que pasar a «con tramo».
**Control negativo, derivado:** `(1839, a)`, la primera letra de 1839 que no nombra ningún asunto, sale **AUSENTE**.
**Control sembrado por la propia sonda:** un asunto fabricado `SCRUM-99001z` sale «sin fichero» y `SCRUM-99002zz` con su fichero fabricado sale «con tramo»; **quitando la siembra, 99001z sale AUSENTE**. Las dos letras de `1787aa` no se confunden con `1787a` (que sale «con tramo»).

**Lo que NO medí:** el cuerpo de los commits; las ramas sin mergear; si los 98 laxos y los 5 «en el cuerpo» son el tramo de verdad o sólo una mención (no los leí uno a uno); y la fecha de entrada en `main` de cada par.

## ④ Propuesta del trinquete (sin escribir)

1. **Dónde:** un test nuevo de J6 en la carpeta de tests (nombre por decidir; aún no existe), en el check obligatorio; lee `git log origin/main` y los registros por `git show`, como esta sonda.
2. **Población que declara:** commits, ficheros, pares y el reparto con / laxo / sin tramo / sin fichero, que tiene que sumar el total; CIEGO (no verde) si los commits leídos son 0.
3. **Cómo cae:** con los asuntos de `merge-base..HEAD` del PR, cualquier par nuevo que no esté en la lista congelada y no tenga cabecera (`SCRUM-N<letra>` o la forma laxa) da ROJO nombrando el par y el fichero.
4. **Las históricas:** lista congelada de los 85 + 14 dentro del test, que sólo baja: un par de la lista que ya tiene tramo la hace caer hasta que se quita.
5. **Controles:** un asunto sembrado `SCRUM-99xxz` sin tramo → rojo, el mismo con su cabecera → verde, y sin siembra el caso dice CIEGO; y la decisión pendiente es si la forma laxa cuenta como tramo (98 pares dependen de ella).
