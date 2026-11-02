# SCRUM-1648 · guard-dangerous falla hacia ABIERTO con las barras invertidas de PowerShell, con un `>` absoluto lanzado desde otro repo y con las rutas MSYS en la regla de junction

**Medido contra:** `origin/main` = `70eefc40cba2eb9636992b733223bf1555c1755f` · 2026-11-02T20:30Z (cabecera `Date:` de GitHub)

Puesto: S5 (equipo de Luis). **Sólo medida, sin arreglo:** `.claude/hooks/**` es «SIN CERRADURA · un jefe»
(`node scripts/carriles.mjs de .claude/hooks/guard-dangerous.mjs` → `dos-equipos.md:205`). El ticket lo abre S5
por orden de su orquestador, con `decision-jefe` y sin `area-*`. Esta rama sólo lleva documentos: el banco, para
que nadie tenga que repetir la medida.

## El banco: `docs/master/evidencias/scrum1648/`

| fichero | qué es |
|---|---|
| `mide.mjs` | 71 casos: PowerShell y Bash × 5 formas de ruta × 7 familias, más `Remove-Item -Recurse`. Importa `evaluar` del guard de la raíz que se le pase y lo corre contra un banco nuevo (un repo sucio, uno limpio y una carpeta con una junction real hecha con `mklink /J`). El guard sólo PREGUNTA: el guion comprueba que el banco queda intacto. |
| `control-base.mjs` | Separa «las barras» de «desde dónde arranca»: el mismo `>` absoluto con barra normal, lanzado desde el mismo repo, desde otro repo y desde un no-repo. |
| `salida-main.txt` | Corrida contra el guard de `origin/main` (`70eefc40c`): **48 bien · 23 MAL**. |
| `salida-compartido.txt` | Corrida contra el guard del checkout compartido (`e4ea95e5a`): **44 bien · 27 MAL**. Los 4 de más son `cd /d/…`, que arregló SCRUM-1091. |

Uso: `node docs/master/evidencias/scrum1648/mide.mjs <raíz con el guard> <directorio NUEVO para el banco>`.
El guion no borra nada, porque el banco lleva una junction. La limpieza a mano viene en su cabecera.

Resultado de `control-base.mjs` el 2-nov: mismo repo → **BLOQUEA** · otro repo → **deja** · no-repo → **deja**.

## Lo que sale MAL, agrupado

1. **`\` sin comillas en PowerShell.** El tokenizador la trata como escape POSIX (`guard-dangerous.mjs:186`), y
   `cd D:\a\b` queda como `D:ab`. Deja pasar `> rastreado.txt` tras el `cd`, `> X:\…\rastreado.txt`,
   `git worktree remove X:\…` con una junction dentro y `rm -r X:\…`. Además bloquea el `git switch -c` legítimo
   en un árbol limpio. En Bash la `\` sin comillas la lee igual el propio bash: no es defecto del guard.
2. **`>` absoluto desde OTRO repo.** `check-ignore` corre con el cwd de la sesión (`:476`); git da 128 y el guard
   lo trata como fuera de jurisdicción. Falla con cualquier forma de ruta, también con barra normal.
3. **MSYS en la regla 7.** El filtro `!t.startsWith('/')` (`:621`) descarta `/d/…` y no mira la junction.
4. **`Remove-Item -Recurse`** no entra en la regla 7.
5. **`Set-Location X` no cuenta como `cd`** (`cwdDelComando`, `:457`: sólo mira `programa === 'cd'`). Visto EN VIVO
   al abrir esta rama, no en el banco: `Set-Location D:/…/wt-s5-2nov-medir; git switch -c …` se bloqueó listando
   los cambios del checkout compartido (`M LICENSE`, `M package.json`…), no los del worktree, que estaba limpio
   (`git status --porcelain` → 0 líneas). Aquí falla CERRADO, pero sobre el árbol equivocado: por la misma vía, un
   `Set-Location X; git reset --hard` miraría el árbol de la sesión y no el de X. **No está en los 71: se añade
   al banco cuando se construya el arreglo.**

## Lo que sigue bloqueado (ver `salida-main.txt`)

Con barra normal, entre comillas o con MSYS y `cd`, en las dos herramientas: `switch -c` en sucio,
`reset --hard` en sucio, `>` relativo tras el `cd`. Y `worktree remove`/`rm -r` con junction, con barra normal o
con comillas.

## Lo que NO he hecho

No he tocado el guard ni ningún test. No he medido `Set-Location` dentro del banco (punto 5, visto una vez en
vivo). La tanda completa no la he corrido: esta rama sólo añade `docs/`.
