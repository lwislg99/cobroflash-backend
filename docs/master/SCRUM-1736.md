# SCRUM-1736 · latido-cierre: la rama local homónima de OTRA sesión ya no da 🔴 «NO es lo empujado»

## 16-nov-2026 · SCRUM-1736 · CAMBIO: «sin empujar» solo si la local tiene commits que origin no tiene
**Medido contra:** `origin/main` = `848e10bf071d4c807c6424f13a679ddfeaf1aecc` · 2026-11-16T15:58:37Z
A9: comprobación → `tests/scrum1736-latido-cierre-rama-homonima.test.mjs`

Fichero `.claude/hooks/latido-cierre.mjs`: `.claude/**` es de «un jefe» (`dos-equipos.md:205`). Lo toca S5
por encargo del orquestador del 16-nov (cola de S5, punto ②).

### El defecto (medido por J4 el 13-nov, en el ticket) y su rojo, medido hoy
El hook compara el sha de origin con `refs/heads/<rama>` POR IGUALDAD. Los worktrees comparten un solo
`.git`: quien empuja `HEAD:<rama>` desde `<rama>-al-dia` lee ahí la `<rama>` que tiene colgada OTRA sesión.
Reproducido hoy con un origin `--bare` y dos worktrees (guion fuera del repo, mismo banco que el test):
`SIN-EMPUJAR · la rama local (2254859b) NO es lo empujado (20d77893)`, con la local CONTENIDA en lo
empujado (`merge-base --is-ancestor` = sí). Lo mismo que J4 vio en #3137, #3141 y #3142.

### Lo que cambia
- `veredictoDeRama` recibe `dentro`: `true` = la local está contenida en lo empujado (no tiene nada que
  origin no tenga) → se juzga lo empujado por su obligatorio, como si fueran iguales · `false` = la local
  tiene commits propios → `SIN-EMPUJAR`, como antes · `null` = no se pudo comparar → `CIEGO` («no pude
  mirar»), nunca verde · sin dar → como antes (quien no lo mide no cambia de veredicto).
- `localDentroDe(cwd, local, remoto)`: `git merge-base --is-ancestor`; solo 0 y 1 son respuesta. El 128
  —el commit de origin no está en este repo, p. ej. porque el bot metió `main` y nadie lo ha traído— es
  `null`.
- `medir` se exporta y recibe `{ cwd, checks }` para que la tanda lo pruebe ENTERO contra repositorios de
  verdad (ls-remote, rev-parse y merge-base reales; solo los check-runs inyectados, sin red). Por defecto,
  lo de siempre: `RAIZ` y `gh api`.
- De las dos salidas que proponía el ticket elegí la que no depende de saber de quién es cada worktree:
  «contenida en origin» casa con el resto del hook (que ya juzga lo EMPUJADO por su obligatorio) y
  arregla de paso el mismo falso cuando el bot mete `main` en tu PR y tú haces `fetch` (tu local queda
  por detrás). La otra (`git worktree list`) no se hace.

### Lo que sigue sin cubrir, dicho
Si la homónima de OTRA sesión va POR DELANTE de lo empujado (esa sesión tiene commits suyos sin empujar),
el hook te lo sigue atribuyendo (`SIN-EMPUJAR`). Para eso haría falta saber de quién es el worktree; no
lo pide la aceptación y no está medido que pase.

### Comprobado
| corrida | resultado |
|---|---|
| test nuevo, 6 casos | 6/6. El ROJO→VERDE lleva su CONTROL: el mismo banco, juzgado sin `dentro`, da el `SIN-EMPUJAR` falso |
| positivos | commit propio sin empujar → `SIN-EMPUJAR`; local divergida → `SIN-EMPUJAR` |
| suelo | origin movido por otro clon y no traído → `CIEGO` (control: `cat-file -e` del sha falla en ese repo) |
| las 4 mutaciones declaradas, una a una (igualdad de antes · `medir` sin cablear · `if (false)` · 128 leído como «dentro») | 4/4 tumban el test que nombran; fichero restaurado byte a byte |
| vecinos: `scrum1356-latido-enganchado` (incluye el hook como proceso de verdad) y `scrum1350-latido` | 56/56 (62/62 con el nuevo) |
| `guards:entrada` · 5 de árbol entero · 745 · 824 · 854 · 723 | verdes. 723 cazó un `rev-parse main` en el test y 824 escrituras no trazables a `temporal()`: los dos arreglados EN EL TEST (sha de la base capturado; todas las escrituras por `escribir()` dentro de `banco()`), ninguna lista tocada |
