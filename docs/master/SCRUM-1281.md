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
