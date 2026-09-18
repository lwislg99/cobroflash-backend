# SCRUM-932 · el turno de staging era una NORMA SIN MECANISMO

**Fecha:** 17-sep-2026 (código) · 18-sep-2026 (decisión, prueba en vivo y expediente) · **Carril:** S5 · automatización
**Medido contra:** `origin/main` = `16733a223b3d09d3fdf03bf03c67a2b278b4906c` · 2026-09-18T06:36:35Z
**Rama:** `scrum-932-turno-sin-credencial` · **Worktree:** `wt-839f`
**Horas:** de GitHub (cabecera `Date` de `gh api -i zen`). El reloj de la máquina va ~5,5 min adelantado.

## ① El defecto

`scripts/turno-staging.mjs` moría con «falta DATABASE_URL_TESTS en el entorno». La norma «toma el turno antes de
escribir en staging» existía; la forma de cumplirla, no. El 17-sep dos sesiones necesitaron staging a la vez (S1 en
SCRUM-911, S2 en SCRUM-907) y salió bien por suerte: S1 tomó el turno con un envoltorio PROPIO de su banco
(`tests/banco-scrum911/turno.mjs`), y S2, que no tenía ese envoltorio, siguió sin turno porque solo iba a leer.
Dos sesiones, dos mecanismos distintos, y el turno solo protege si lo usan todas.

## ② PASO 0 · qué faltaba de verdad

El ticket dejaba dos lecturas abiertas: (a) la clave tiene otro nombre en el fichero de secretos, o (b) el árbol no
tiene entorno. Medido:

- **El nombre NO es el defecto.** `DATABASE_URL_TESTS` la nombran 12+ ficheros, `ci.yml` incluido: es el nombre
  canónico del repo.
- **El defecto es de DÓNDE se espera que salga.** `import 'dotenv/config'` lee el `.env` del directorio actual, y
  dotenv no sube por el árbol. Eso valía con cuatro árboles fijos con su `.env` (`cobroflash-backend`, `b1`, `b2`,
  `b3`). Hoy `b1`–`b3` no existen, hay ~90 worktrees `wt-*` sin `.env`, y el checkout compartido solo tiene
  `.env.local`, que `dotenv/config` no lee. **En la máquina no hay ni un `.env`.**
- **Ningún script del repo lee el fichero de secretos de la máquina.** Su único lector es el banco de S1
  (`tests/banco-scrum911/_entorno.mjs`). Por eso (a) sola no arreglaba nada: añadir `DATABASE_URL_TESTS` a ese
  fichero no la habría hecho llegar a ningún `process.env`, y además habría duplicado un valor con dos nombres.
- **La credencial que SÍ existe apunta a la base del turno.** Sin imprimir valores: `DATABASE_URL_STAGING` del
  fichero de secretos = host `acela.proxy.rlwy.net`, base `railway`. Es exactamente la base de pruebas de los carriles
  no principales según `scripts/_clave-vs-destino.mjs`.
- **El lock vive DENTRO de la base** (comentario del catálogo), así que hay un turno por base FÍSICA, no por nombre
  de clave: `--base staging` y un `DATABASE_URL_TESTS` que apunte a `railway` son el mismo turno. No hay cerebro
  partido.

**Decisión: (b), sin credencial nueva.** Aprobada por el orquestador el 18-sep-2026 hacia las 06:40Z.

## ③ El arreglo

- `scripts/_cargar-env.mjs` (nuevo) sustituye a `dotenv/config` en `turno-staging.mjs` y `test-staging-gated.mjs`.
  Busca en una lista DECLARADA y en orden —`YAQU_ENV_FILE`, `.env` de este árbol, `.env` del checkout principal— y
  dice en qué fichero lo encontró. Nunca pisa lo que ya viene en `process.env`. No imprime valores: solo rutas y
  nombres de clave.
- `turno-staging.mjs` acepta `--base tests|staging`. Por defecto `tests`: quien ya podía tomar el turno lo toma igual,
  sin flag y contra la misma base.
- **NEGATIVO, y no se negocia: NO hay cadena `TESTS || STAGING`.** Arrancaría siempre, y en el checkout principal
  movería el turno de `yaqu_dev_javier` a `railway` sin decirlo: tomarías el turno de una base y escribirías en otra.
  Es el accidente de SCRUM-383. Si falta la clave de la base pedida, el script PARA con exit 2 y dice dónde buscó.

Uso desde un worktree efímero:

    YAQU_ENV_FILE=D:/MILLONARIO/cobroFlash/e2e-staging-secret.txt node scripts/turno-staging.mjs tomar --base staging --ref <rama>

## ④ Medido

Guard `tests/scrum932-el-turno-tiene-mecanismo.test.mjs`: **12 pass, 0 fail**, después de mergear `main`
(head `19573ced`). No toca ninguna base: usa URLs con host `localhost`, que la allowlist rechaza antes de conectar.

**Contra staging de verdad** (18-sep-2026, `wt-839f`, con `YAQU_ENV_FILE` = fichero de secretos):

| hora (reloj de la BD) | orden | salida | exit |
|---|---|---|---|
| — | `estado --base staging` **sin** `YAQU_ENV_FILE` | «falta DATABASE_URL_STAGING…», lista los 2 ficheros mirados | 2 |
| ~06:37:46Z | `estado --base staging` | Turno LIBRE en la base "railway" | 0 |
| 06:37:48Z | `tomar --ref scrum-932-prueba-turno --minutos 2 --base staging` | Turno TOMADO | 0 |
| ~06:37:52Z | `estado --base staging` | TOMADO, dueño `DESKTOP-T5MONF5.a4f03df8d5`, VIGENTE | 0 |
| ~06:37:54Z | `soltar --base staging` | Turno SOLTADO (marcador limpio) | 0 |
| ~06:37:57Z | `estado --base staging` | Turno LIBRE en la base "railway" | 0 |

**Qué se escribió en staging:** solo el marcador del turno en el comentario de catálogo de la base `railway`, durante
~6 s, y se dejó limpio. Ninguna fila. Con GO expreso del orquestador para esta prueba.

## ⑤ Lo que NO arregla, dicho

- **La tanda gateada** (`npm run test:staging:gated`) sigue pidiendo `DATABASE_URL_TESTS`, que en los `wt-*` no
  existe: aborta CERRADA, que es lo correcto. No lleva ticket todavía (decisión del orquestador): se abre cuando
  alguien la necesite.
- **El envoltorio de S1** (`tests/banco-scrum911/turno.mjs`) hace justo la cadena `STAGING → TESTS`. En un `wt-*` es la
  misma base y no hace daño; tras esto debería pasar a `--base staging`. Carril S1/S3.
- **El reloj.** El turno compara plazos calculados con `Date.now()` LOCAL contra la hora de la BD. En la prueba, un
  turno de 2 min salió «le quedan ~7 min» porque la máquina va ~5,5 min adelantada. Hoy el error va en la dirección
  segura (el turno parece vivo más tiempo); con el reloj ATRASADO, un turno vivo parecería vencido y se podría
  reclamar. Anotado, sin ticket.
- **`CLAUDE.md`** sigue diciendo que «los cuatro worktrees llevan las tres claves». Es derivado del máster (regla 35):
  su corrección va por cambio de máster, no aquí.

## ⑥ De dónde salió este trabajo

El código es de la S5 de la tanda del 17-sep: commit `e4f6a2aa` (20:24:52Z), **nunca empujado**. Esa tanda murió
hacia las 21:30Z sin traspaso, y el commit solo apareció al arrancar la S5 siguiente y mirar el worktree. Ni el
traspaso ni el orquestador sabían que existía.
