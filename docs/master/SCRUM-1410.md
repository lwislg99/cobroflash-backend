# SCRUM-1410 · Cuántas veces empujó `claude[bot]` a una rama con una sesión escribiendo en ella

**Medido contra:** `origin/main` = `391212830da7698fed4bccf1da95f668292710ee` · 2026-10-23T13:38:55Z (hora de GitHub al escribir: 2026-10-23T14:00:00Z)
A9: aviso → A10 «Lo que se deduce de NO haber visto algo no vale si algo no se pudo mirar: se queda sin juzgar.» — no se pudo comprobar: una sesión que escribe sin hacer commit no deja nada en git, y mi detector de «paralelo» sólo ve commits; lo cazó que el positivo #2380 no salía

Puesto J4 (`jv-j4r`) · rama `scrum-1410-cuantas-veces-empujo-el-bot`. Encargo del orquestador del equipo de Javier
(`cobroflash-backend-62`): ① y ② en sólo lectura. ③ y ④ son STOP del fundador y no se tocan. Nada en `.github/`.
La medición entera, con sus tablas, está en el comentario **c.20524** del ticket. Aquí va lo que hace falta para repetirla.

## Cómo se repite

Las sondas están en `docs/master/evidencias/SCRUM-1410/`. Son de un solo uso y se corren desde una carpeta de trabajo con `pr.git` al lado:

1. `git init --bare pr.git`, con `objects/info/alternates` apuntando a los objetos del clon. Después, `git fetch <remoto> '+refs/pull/*/head:refs/pr/*' '+refs/heads/*:refs/heads/*'`. Se hace en un repositorio APARTE para no meter 2.732 refs en el `.git` que comparten los worktrees.
2. `git log --all --author='claude\[bot\]' --format='%H %aI %s' > bot-commits.txt` → **161**.
3. `medir.mjs` asigna cada commit a su PR y marca los commits de sesión PARALELOS: los que no son antepasado ni descendiente del commit del bot. `medir2.mjs` recupera 3 commits que ya estaban en main y clasifica a 6 h. `medir3.mjs` saca las 916 ejecuciones de `claude.yml` y cruza las dos sondas.

## Lo que salió (c.20524)

| clase | antes de SCRUM-1263 | después |
| --- | --- | --- |
| A · colisión probada (commit de sesión paralelo + merge) | 7 | 3 (#2058, #2128, #2289) |
| A2 · colisión con la sesión de vuelta a más de 6 h | 1 | 0 |
| B · la sesión siguió encima | 9 | 5 |
| C · un humano actuó en el PR | 2 | 3 (#2380 entre ellos) |
| D · nadie en 6 h | 59 | 18 |
| ramas `claude/pr-*` sin PR | 54 | 0 |

Las dos sondas casan: **161/161** commits del bot caen dentro de una ejecución, y los **29** empujones del workflow posteriores a SCRUM-1263 coinciden uno a uno con sus 29 ejecuciones. Controles: la siembra (bot + sesión paralela + merge) sube el recuento a 162 y sale PARALELO; al quitarla, vuelve a 161. Control cero: antes de la primera ejecución hay **0** commits del bot.

**Límites declarados.** La clase A es un suelo. Una sesión viva sin commit no se ve. La colisión entre ramas (#2380 → `deee52c55` → #2385) cae en la clase C. Un commit tirado por force-push no está en ninguna ref.

## Lo que no entra

③ y ④ → fundador y S5. Las salidas de ② van con su coste en c.20524, **sin elegir**.
