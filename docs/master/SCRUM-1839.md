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

# SCRUM-1839b

**Medido contra:** `origin/main` = `84e87de4dcda46c0aeba52edfaab8f55aca0c234` · 2026-11-24T17:30:20Z

A9: aviso → cicatriz J6 «Medí 121k al acabar Jira y escribí un encargo de subagente de ~17k sin medir antes lo que costaba: crucé el umbral de empujar (130k) sin nada en git» — no se pudo comprobar: ningún hook de este árbol lee el usage de la sesión antes de un mensaje largo

**Encargo (jv-j6fz, J6):** segunda mitad: el trinquete «ninguna letra de tramo nueva llega a la rama principal sin su tramo», con la regla decidida en Jira SCRUM-1839 c.22677 (cabecera `#` o `##` exactos de `docs/master/SCRUM-<N>.md`, N+letra enteros con borde por los dos lados, con o sin «SCRUM-» delante). La rama sale de `0bd379704` (la foto `651a143` más el registro de SCRUM-1839); a la hora del ancla, `origin/main` iba tres merges por delante (#3408, #3409, #3410).

Mutaciones: catálogo → `tests/scrum1839-letra-con-tramo.test.mjs`

## Población medida (24-nov-2026, sobre la punta de la rama)

- **13.084 commits** de `git log HEAD` (asunto `%s`), **1.367 registros** `docs/master/SCRUM-<n>.md` en el disco (387 leídos por tener par).
- **1.078 pares** = **975 con tramo** + **89 sin tramo** + **14 sin fichero**.
- La foto congelada `651a143476a309308898fe252360d0b3d6a2a2ad`, reclasificada por el test desde git (`git log` + `git grep '^#'`): 13.083 commits · 1.366 registros · 1.078 pares · 975 / 89 / 14, y el mismo conjunto sin tramo que la rama.
- **Contra jv-j6fy (979 = 881 + 98 / 85 / 14):** cuatro pares pasan de «con tramo» a «sin tramo», uno a uno: `1233i` (`SCRUM-1233.md`, cabecera `### 1233i · «Enviar por email»…`) y `1183c` (`SCRUM-1183.md`, `### Re-medido ANTES de quitar nada (la medida de 1183c …)`) sólo se nombran en `###`; `710b` (``### 🔴 «Cuando `scrum710b` …»``) y `959b` (``## ③ Lo medido (`tests/scrum959b-…`)``) sólo con una letra pegada a la izquierda. La sonda de j6fy contaba `#{1,6}` y un borde izquierdo de sólo dígitos.

## Lo que el orquestador decide (no lo he decidido yo)

- **`##` exactos frente a `#{1,6}`: el delta NO es 0, son 2 pares.** `(1233, i)` con ``### 1233i · «Enviar por email» sólo con algo que hacer (S2, 19-oct, rama `scrum-1233i-email-sin-accion-no-se-pinta`)`` — tiene pinta de tramo de verdad en nivel 3 — y `(1183, c)` con `### Re-medido ANTES de quitar nada (la medida de 1183c tenía 30 h y 88 commits encima)` — una mención, no un tramo. Sigo con la lectura literal: los dos van a la lista.
- **El borde con una letra a la izquierda: 1 par.** `(959, b)` con ``## ③ Lo medido (`tests/scrum959b-el-arranque-no-duplica-el-equipo.test.mjs`, 11 tests)``. Lo leo como borde = ni letra ni dígito ASCII (como `\b`), y sale sin tramo; si «borde» fuera sólo «no dígito», pasaría a con tramo.

## Rojo y verde de cada caso (todos en el propio test)

| caso | resultado |
|---|---|
| asunto «SCRUM-99001z» sin fichero / con fichero sin cabecera | ROJO, nombra `99001z · docs/master/SCRUM-99001.md` |
| su gemelo con `## SCRUM-99001z`, `## 99001z ·` (laxo) o `# SCRUM-99001z` | verde |
| `## 99001zz`, `## SCRUM-199001z`, `scrum99001z-` (letra delante) | no valen, cada uno con su positivo del mismo token |
| `### SCRUM-99001z` y una mención en texto, negrita o cita | no valen; `##` y `#` sí |
| sembrar el asunto sobre la población real | cae exactamente `99001z`; sin siembra, nada |
| inyección real: quitar `1058b` de la lista | ④ ROJO nombrando `1058b · docs/master/SCRUM-1058.md · lo nombra 86296fe9f` |
| inyección real: `## SCRUM-1058b` añadido a `SCRUM-1058.md` | ④ ROJO «PUEDE APRETAR … quítalas», con la cabecera |
| sin inyección | 6 pass / 0 fail, ~1,4 s el fichero entero |

Mutaciones con el runner de la casa (`censoDeDeclaraciones` + `correr` + `aplicarUna`), las tres **VIVAS**: quitar el borde (cae ③, +3 colaterales), cabecera `#{1,6}` (cae ③, +3), `nuevos = []` (cae ②, +1).

## Cómo lee la historia en CI

El job de la tanda lleva `.github/workflows/ci.yml:147` (`fetch-depth: 0`) y `.github/workflows/ci.yml:158` (`git fetch --no-tags`). El test lee `HEAD` (en un PR, el merge) y el sha congelado, nunca una ref que se mueva; si el clon es superficial, o la foto no es antepasada de `HEAD`, sale ROJO «NO MEDIDO», copiado de `tests/scrum1349-entorno-prestado-solo-baja.test.mjs:212` (`--is-shallow-repository`). «La lista no crece» exige la historia completa hasta la foto: la tiene ese job.

## Lo que NO medí

- Tras `git merge origin/main` (`84e87de4dcda46c0aeba52edfaab8f55aca0c234`), `1730h` ya tiene tramo (lo escribió #3409) y salió de la lista en este PR: la lista baja de 103 a 102. Test corrido después del merge: 6 pass / 0 fail, población 13.092 commits · 1.367 registros · 1.081 pares = 979 con tramo + 88 sin tramo + 14 sin fichero; `npm run guards:entrada` 177 / 0. Lo corrió jv-j6fz; lo demás de este tramo lo midió su subagente, y el resto de guards NO se repitió tras el merge.
- El cuerpo de los commits, las ramas sin mergear, y si cada cabecera que cuenta es el tramo de verdad o una mención (la regla no lo distingue y el test tampoco).
- La tanda entera: sólo los guards que se listan en la entrega.
