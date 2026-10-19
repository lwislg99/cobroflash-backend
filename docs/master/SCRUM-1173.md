# SCRUM-1173 · El suelo derivado eximía ENTERAS y PARA SIEMPRE las poblaciones con una retirada

**Medido contra:** `origin/main` = `e8d27c636dfce4e80071a28552b40479e7195265` · 2026-10-15T16:45Z

A9: sin fallo que generalice — mis dos rojos de esta entrega fueron de formato de este mismo registro (la línea A9 y el ancla), cazados por sus guards antes de empujar.

S3 · rama `scrum-1173-la-retirada-caduca` · worktree `wt-s3-1173`.

## Qué pasaba, medido HOY (no heredado del ticket)

`sueloDerivado` (`scripts/_suelo-contra-main.mjs`) devolvía `null` en cuanto el nombre de la población
aparecía en `RETIRADAS_A_PROPOSITO`, y `perdidasContraLaReferencia` hacía lo mismo por guard. Tres de las
cuatro poblaciones derivadas (`ficheros-js-de-public`, `scripts-del-dashboard`, `tests-declarados`)
seguían en la lista por bajas de septiembre.

Auditoría por mutación con BASE sin mutar, sobre el árbol real, `tests/scrum810b-los-suelos-derivados.test.mjs`:

| árbol | BASE (sin mutar) | MUTANTE: `tests/scrum808-…test.mjs` borrado, sin declarar |
|---|---|---|
| `main` e8d27c63 (antes) | 7 pass · 0 fail, 2 de 2 | **7 pass · 0 fail, 2 de 2** — el defecto: perder un fichero de tests entero no dice nada |
| esta rama (después) | 9 pass · 0 fail, 2 de 2 | **8 pass · 1 fail, 2 de 2** — «LA POBLACIÓN «tests-declarados» HA PERDIDO CONTRA LA BASE DE FUSIÓN: 11501 → 11488» |

El mutante se puso borrando el fichero (`git status`: ` D tests/scrum808-…`) y se devolvió desde una copia
(`git status` vacío después). Script del banco: `base1173.ps1` en el temporal del job (no versionado: sólo
lanza el test dos veces sin mutar y dos con el fichero quitado).

## El arreglo

- Cada retirada declara su baja con números (`antes`, `ahora`); las tres que hay los llevan ya.
- **Sólo exime su baja:** `cubiertoPorRetiradas` deja pasar una variación de, como mucho, la suma de lo
  declarado para esa población, en la dirección que viola. Una baja mayor habla.
- **Caduca al entrar en la base:** `retiradasPendientes` lee la lista de la BASE DE FUSIÓN
  (`git show <base>:scripts/_suelo-contra-main.mjs`, por AST con `typescript`, nunca por regex) y sólo
  cuenta las que la base aún no lleva (clave `guard` + `fecha`; añadir los números a una vieja no la
  rejuvenece). En su propio PR la retirada vale; mergeada, ya no exime nada.
- **Fail-closed:** sin números, o sin poder leer la lista de la base, no se exime nada.

Tests redefinidos, no borrados: `scrum810b:185-191` («la retirada vale para una población») y
`scrum810:119-131` ahora piden los números; los nuevos casos de `scrum810b` fijan «una baja NUEVA con una
retirada antigua habla; la declarada no», el tamaño (6 declarados no dejan perder 7) y la lectura por AST
con su control positivo sobre el propio fichero.

## Lo que NO se ha medido (declarado)

- El impacto sobre las ramas abiertas: una rama que hoy pierda un `.js` de `public/`, un `<script>` del
  panel o tests sin declararlo pasará a rojo. Es lo que el ticket pide, pero no se ha censado cuántas hay.
- Hueco conocido: cambiar la `fecha` de una retirada vieja la vuelve «pendiente» y exime otra vez su baja.
  Es un cambio visible en el diff de la lista, que es el control que la casa ya usaba.

## Aceptación → dónde se ve

| aceptación (literal del ticket) | dónde se ve |
|---|---|
| «Que una retirada exima la baja concreta que declara, no la población entera» | `tests/scrum810b-los-suelos-derivados.test.mjs` («🔴 SCRUM-1173 · una baja NUEVA…») y `tests/scrum810-el-suelo-a-la-primera.test.mjs` |
| «Que el suelo vuelva a hablar ante cualquier baja NUEVA» | la tabla de arriba: el mutante cae 2 de 2 |
| «una baja nueva en una población con retirada antigua tiene que dar rojo, y la baja declarada no» | `scrum810b`, mismo test, casos ① y ② |
| «redefinirlo, no borrarlo» (`scrum810b:185-191`) | el test sigue, con la retirada llevando sus números |

## El rojo de #2497 (punta 417c128c) era MÍO, y escondía un mutante vivo

**Medido contra:** `origin/main` = `95bb7e71de1b7989716d7a713d2792ae560702e0` · 2026-10-15T17:45Z

A9: comprobación → `tests/scrum836-ancla-de-mutacion-viva.test.mjs`

- Obligatorio (job 116553922090): `scrum836` — tres mutaciones de `scrum810`/`810b` anclaban en las líneas
  de `_suelo-contra-main.mjs` que este ticket reescribió. El otro rojo, `scrum1405c ④`, es el ajeno conocido.
- Reanclarlas no bastaba. Aplicando cada mutación y corriendo su test: en `main` (BASE) caen **7 de 7**; con
  1173, las dos de «CRECER» **sobrevivían** (fail 0). Causa: `cubiertoPorRetiradas` devolvía `true` para lo
  que no viola, y eso duplicaba la decisión de quien llama: apagar una de las dos no tumbaba nada.
- Arreglo: devuelve `false` para lo que no viola. Con eso, 7 de 7 caen otra vez (810: 2·1·1; 810b: 4·3·1·2),
  y el fichero mutado se restauró idéntico (huella antes/después).
