# SCRUM-1281 · El intermitente del check obligatorio: la familia de fixtures de git, en su sitio y con firma

**Medido contra:** `origin/main` = `d2451dbe39f38afc2116e11ce87f5d57c7f1458d` · 2026-09-29T16:20:01Z

Carril S3 (la fixture). La detección en CI es de S5. Sesión s3-29c.

## Decisión de partida (orquestador, 29-sep)

J6 midió la familia (4 rojos: `scrum775` ×2, `scrum753`, `scrum388`, siempre git perdiendo un
fichero bajo `.git/objects` en `repoFixture()` o un clon suyo) y el experimento de
`maintenance.auto=false` salió **negativo** (0/600 en los dos brazos, control 4/4). **No se aplica.**
Tampoco el vigía con inotify/auditd, por ahora. Los dos pasos baratos:

## Qué entra

| Paso | Pieza | Qué hace |
|---|---|---|
| (b) sitio propio | `raizDeFixturesGit()` + `temporalDeFixtureGit()` en `tests/_censo-fixture.mjs`; `temporal(prefijo, { dentroDe })` en `_temporal.mjs` | La familia entera (`repoFixture`, el clon de `scrum775`, el de `_fixture-alcanzabilidad`) vive en `$RUNNER_TEMP/yaqu-fixtures-git/` en CI: **fuera de la `/tmp` compartida** con los ~1.060 ficheros de la tanda. En local, `os.tmpdir()/yaqu-fixtures-git/`. `YAQU_RAIZ_FIXTURES_GIT` lo fuerza. Se sigue borrando al salir, igual que antes. |
| (a) firma | `gitDeFixture()` + `FIRMA_1281` = `[SCRUM-1281-FIRMA]` | Toda operación de git de la familia pasa por él. Si cae con la firma, escribe **una línea propia en stderr** que empieza por `[SCRUM-1281-FIRMA]` y la antepone al mensaje del error. **Sin reintento**: un reintento a secas esconde el problema. |
| test | `tests/scrum1281-fixture-git-raiz-propia.test.mjs` | ① la firma reconoce los 4 textos reales de CI y no 5 errores ajenos · ② **control vivo**: git cae de verdad con «failed to write commit object» (el `objects/xx` del commit, de fechas fijas, no se puede crear) y el marcador sale por el stderr de un **proceso hijo**, que es lo que leerá el CI · ③ la fixture vive en su raíz y, en CI, fuera de `os.tmpdir()`. |

## Verificado

| Prueba | Resultado |
|---|---|
| La familia (388, 753, 775, 864, 864c) + el test nuevo | 62/62 verdes en local |
| Mutante: `esFirma1281` siempre falso | ① y ② en rojo |

## Lo que NO está medido, dicho

**No sé todavía si (b) lo quita.** La tasa es ~0,3 % por montaje; en local no cae nunca, y un
experimento que lo pruebe necesitaría cientos de tandas completas en CI. Lo que este cambio hace es
que la pregunta se conteste SOLA con el tiempo: si tras el merge vuelve a salir `[SCRUM-1281-FIRMA]`
con la fixture ya en `$RUNNER_TEMP`, la causa no es «algo que actúa sobre `/tmp`» y el siguiente paso
es el vigía; si deja de salir, (b) era la cura. Ese recuento lo hace el etiquetado de S5.

## Para S5

El CI busca, en el log del paso de tests, una línea que **empiece** por `[SCRUM-1281-FIRMA]`. Si el
job sale rojo y la única causa es esa línea, se etiqueta como el intermitente; un relanzamiento manual
puede exigir la etiqueta. El marcador es un literal exportado (`FIRMA_1281`); no cambia sin avisar.

# SCRUM-1281b · Los tres rojos propios que quedaban: dos censos que la rama dejaba ciegos

**Medido contra:** `origin/main` = `788a50d77dfff22422ceb7cab4cd728e061aee98` · 2026-10-01T12:16:07Z

A9: comprobación → `tests/scrum723-guard-contra-su-base.test.mjs`

Carril S3. Sesión s3-1oct-b (releva a s3-1oct). El PR #1982 llevaba tres fallos del obligatorio
(`scrum723`, `scrum824`, y `scrum976` por arrastre). Ninguno se arregla cuadrando una lista.

## 723 · el censo perdía de vista a quien importa su git

`_fixture-alcanzabilidad.mjs` desaparecía de la lista de «nombra la referencia móvil fuera de los
argumentos de git» **nombrándola igual que el día anterior**. La rama cambió
`execFileSync('git', args)` por `gitDeFixture(args)`, importado de otro fichero, y el censo sólo
reconocía git escrito en el propio fuente: para él ese fichero pasó a tener **0 llamadas a git**, y
de un fichero que no llama a git no mira las cadenas. Cuadrar la lista habría bendecido la ceguera.

Lo que se le enseña al censo (`tests/_censo-referencia-movil.mjs`), los **pasamanos**: una función
que entrega a git uno de sus propios parámetros como lista de argumentos — importada, de dos pisos
(`g = (...a) => gitDeFixture(a)`), con los argumentos en un array (`git([...])`) o detrás de otro
parámetro (`git(raiz, …)`). Estrecho a propósito: llamar a git por dentro no convierte a nadie en
pasamanos.

| Medida (1.600 ficheros de `tests/` y `scripts/`) | antes | después |
|---|---|---|
| ficheros que llaman a git | 99 | 100 |
| llamadas a git vistas | 667 | 692 |
| ficheros que llaman por un pasamanos importado | no se medía | 2 |
| lista de indirectas, vistos / declarados | 34 / 34 con un fichero cambiado por otro | 34 / 34, **sin tocar la lista** |
| comparaciones contra la punta, vistos / declarados | 17 / 17 | 20 / 20 |

Las **tres nuevas** son de `scripts/censo-regla-42.mjs` (`ls-tree`, `show`, `log` contra
`origin/main`). No son nuevas: estaban ahí y el censo leía `git(['ls-tree', …])` tomando el array
entero por subcomando. Se declaran con su motivo —su pregunta es sobre la punta, como la de
`censo-reparto.mjs`—.

**Error propio.** Mi primera versión daba por pasamanos a cualquiera que le pasara un parámetro
suyo a otro pasamanos, sin mirar en qué sitio: `numeroDelTicket(raiz)` llama a `git(raiz, …)`, donde
`raiz` es el directorio, y con eso `tests/scrum854-…` entró en la lista de indirectas por un
`numeroDeRama('main')` que no es git. Lo cazó comparar CONJUNTOS contra lo declarado, no el número.
Queda como control en el test («la mitad que absuelve»), que es la comprobación de arriba.

## 824 · `temporal()` con `dentroDe` dejaba suelta una confianza del censo

El censo de 824 da por sano todo `temporal(…)` **por su nombre**, y lo que sujetaba ese nombre era
un caso de `scrum864` que casa el texto `os.tmpdir()` en el fuente. Con `{ dentroDe }` el ayudante
ya no cuelga siempre de `os.tmpdir()`, el caso de 864 seguía verde, y
`temporal('x-', { dentroDe: <dentro del repo> })` habría salido clasificado como sano.

- `temporal()` **lanza** si `dentroDe` cae en el repositorio, antes de crear nada (`caeEnElArbol`).
- El censo reconoce `temporalDeFixtureGit` igual que `temporal`: pasa por él.
- `tests/_temporal.mjs` se declara en `SIN_PROBAR_CONOCIDOS` con su motivo: crea en una raíz que le
  llega por parámetro y eso no se prueba leyendo. Los otros tres ficheros que acusaba
  (`_censo-fixture`, `_fixture-alcanzabilidad`, `scrum1281-…`) vuelven a ser demostrables.

## Verificado

| Prueba | Resultado |
|---|---|
| `scrum723` | 8/8 |
| `scrum824` + `scrum1281` + `scrum864` + `scrum864c` + `scrum753` | 43/43 |
| Mutante: `temporal()` sin la negativa (`git diff --numstat` 1 1) | caso ④ de `scrum1281` en rojo |
| Tiempo del censo de 723 | no medible hoy: la máquina iba cargada (1.152 MB libres) y el de `main` daba 8,7 s y 24,2 s en dos pasadas seguidas |
