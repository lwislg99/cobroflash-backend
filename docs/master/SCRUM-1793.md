# SCRUM-1793 · Borrar los árboles de trabajo `cobroflash-jv-*` de sesiones ya cerradas

**Medido contra:** `origin/main` = `42cae61092ba69761d6d7bba0504abe6baee1e52` · 2026-11-24T02:04:24Z

A9: aviso → cicatriz J6 «El censo de árboles llevaba la lista de sesiones vivas escrita a mano, y una hora después el censo DESPUÉS daba por borrables seis árboles de sesiones lanzadas entretanto» — no se pudo comprobar: el borrado sólo tocó la lista del censo ANTES y re-comprobó commits y suciedad árbol a árbol, pero no volvió a preguntar a `claude agents` antes de cada `git worktree remove`; ningún hook de este árbol lo exige

Carril J6 (máquina; sólo `docs/`). Encargo del orquestador J (`cobroflash-backend-2d`), sesión `jv-j6fg`. Permiso del fundador en la descripción del ticket: «2-Ok la siguiente sesione que vamos ya por el 98%» (23-nov). Nada contra staging ni producción; ningún `--force`, ningún `rm -rf`, ningún `Remove-Item -Recurse`.

## Población

`git worktree list --porcelain` del repositorio: **911** árboles registrados al empezar; de ellos, **401** cuya carpeta es `C:\Users\Javier Pereira\cobroflash-jv-*` (la población). Los otros 510 (`cobroflash-backend`, `cobroflash-orq-*`, `cobroflash-b*`, `.claude/worktrees/*`, `wt-*`, temporales) **no se tocaron**.

Sesiones vivas al empezar (`claude agents --json`): `jv-j1in`, `jv-j1io`, `jv-j1ip`, `jv-j4cc`, `jv-j2eg` y esta, `jv-j6fg`.

## Censo ANTES — `evidencias/SCRUM-1793/censo-arboles.txt`

Por árbol: rama, `git log <rama> --not --remotes` (commits fuera de origin), `git status --porcelain` (sucio), qué es `node_modules` (`LinkType`) y su destino, enlaces en la raíz y dentro de un `node_modules` propio (primer nivel, `@*` y `.prisma`), sesión viva, bloqueado, existe. Instrumento: `evidencias/SCRUM-1793/censo.ps1` (sólo lectura). Cero filas con `ERR` o `?`.

| veredicto | árboles |
|---|---|
| BORRABLE | 389 |
| NO: commits fuera de origin (`j1cj` 1, `j1cz` 3, `j1dr` 6, `j1ew` 1, `j1gw` 1) | 5 |
| NO: sucio (`j1cp`, 4 ficheros, HEAD suelto) | 1 |
| NO: sesión viva (`j2eg`, `j4cc`, `j6fg`) | 3 |
| NO: sesión viva + commits + sucio (`j1in`, `j1io`, `j1ip`) | 3 |
| **total** | **401** |

`node_modules`: 335 junction (todas al compartido `cobroflash-backend\node_modules`), 34 carpeta propia, 32 sin `node_modules`. Ninguna copia con enlaces dentro; ningún otro enlace en la raíz de ningún árbol.

**Sacado a mano de los borrables: `cobroflash-jv-j1cg`.** Su `node_modules` es una COPIA y es el DESTINO de las junctions de `cobroflash-orq-1446e` y `cobroflash-orq-1599o` (barrido de los 910 árboles registrados: 344 `node_modules` enlazados, 2 apuntan dentro de un `cobroflash-jv-*`). Borrarlo habría dejado esos dos árboles sin módulos. Queda: **388** en la lista (`evidencias/SCRUM-1793/borrables.txt`).

`j1gy`, que el encargo daba con commits locales de 1787b: el censo midió 0 fuera de los remotos (su commit está en una rama de `origin`), y se borró. `j1ib`, `j1id`, `j1if`, `j1ih`: igual, 0, borrados.

## Borrado — `evidencias/SCRUM-1793/borrar.ps1` y `borrado-log.txt`

Árbol a árbol, en PowerShell: ① re-comprobar commits fuera de origin y suciedad (si no son 0, no se toca); ② si `node_modules` es `Junction`/`SymbolicLink`, `[System.IO.Directory]::Delete(ruta)` y comprobar que ya no está; ③ `git worktree remove <ruta>` SIN `--force`; ④ si queda la carpeta vacía, `[System.IO.Directory]::Delete`. Cada 25 árboles, recuento del compartido (entradas de `node_modules` y de `node_modules\@prisma`) con PARADA si baja. Canario de 1 árbol, luego lotes de 25, 75, 75, 60, 60 y 92, cada uno en primer plano y por debajo de 400 s.

| resultado | árboles |
|---|---|
| BORRADO con junction quitada antes | 324 |
| BORRADO con copia propia de `node_modules` (≈1 GB cada una) | 33 |
| BORRADO sin `node_modules` | 30 |
| **borrados** | **387** |
| NO borrado: `j1ik` — git: `failed to delete … Permission denied` | 1 |

`j1ik`: su junction ya estaba quitada; git sí lo desregistró y vació, pero la carpeta (vacía, 0 entradas) la tiene abierta otro proceso: `Directory.Delete` contesta «está siendo utilizado en otro proceso». Se queda como carpeta vacía; se quita sola cuando ese proceso la suelte.

Cuadre con el censo: junction 324 + `j1ik` + 10 de los no borrados = 335 ✓ · copia 33 + `j1cg` = 34 ✓ · sin `node_modules` 30 + `j1cj` + `j1cp` = 32 ✓.

## Control del compartido

`(Get-ChildItem 'C:\Users\Javier Pereira\cobroflash-backend\node_modules' -Force | Measure-Object).Count`: **284 antes · 284 en cada uno de los 18 controles · 284 después**. `@prisma`: **7** en todos. Ninguna PARADA.

## Después — `evidencias/SCRUM-1793/censo-arboles-despues.txt`

`git worktree prune -v`: 0 líneas (nada que podar: `git worktree remove` ya desregistraba). Árboles registrados: **531** (911 − 387 + los nacidos durante el borrado − los que otras sesiones quitaron). Población `cobroflash-jv-*` registrada: **22**:

- los 12 NO borrados del censo ANTES + `j1cg` (sacado a mano) = 13;
- **9 nacidos DESPUÉS del censo** (`j1iq`, `j1ir`, `j1is`, `j1it`, `j1iu`, `j1iv`, `j2eh`, `j4cd`, `j4ce`): no estaban en la lista y **no se tocaron**. El censo DESPUÉS marca seis de ellos «BORRABLE» porque su lista de vivas es la de la mañana: a las 02:00Z `claude agents` daba vivas `j1ir`, `j1is`, `j1it`, `j1iu`, `j1iv` y `j4ce` (y ya no `j1in`, `j1io`, `j1ip`, `j4cc`, `j2eg`). Ese veredicto NO vale para ellos (A9 arriba).

Carpetas `cobroflash-jv-*` en disco: 24 = 22 registradas + `j1ik` (vacía, bloqueada) + `j1fb`, que no es un árbol registrado (fuera de la población: sólo contiene una junction `node_modules` del 18-nov); no se tocó.

Ramas locales: de las 387 borradas, 377 tenían rama (10 con HEAD suelto); **las 377 siguen existiendo** sin árbol (`git for-each-ref refs/heads`: 1.898 ramas locales). No se borró ninguna.

## Lo que NO medí

- El espacio liberado en disco: no lo medí (33 copias a ≈1 GB es la cifra de la descripción del ticket, no mía).
- Enlaces más hondos que el primer nivel de un `node_modules` propio, `@*` y `.prisma`: no los barrí; el control del compartido no bajó.
- Qué proceso tiene abierta `cobroflash-jv-j1ik`: no lo miré.
