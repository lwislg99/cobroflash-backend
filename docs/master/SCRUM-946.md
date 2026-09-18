# SCRUM-946 · el censo de huérfanos

**Fecha:** 18-sep-2026 · **Carril:** S5 · automatización y eficiencia
**Medido contra:** `origin/main` = `ecccf94e8c90ec80eed75b5f3d4e320f90a910a8` · 2026-09-18T07:07:38Z
**Rama:** `scrum-946-censo-de-huerfanos` · **Worktree:** `wt-839f`

## ① Por qué

El 17-sep-2026 hacia las 20:27Z (reloj de la máquina) las siete sesiones del equipo, orquestador incluido, recibieron
el mismo evento en cinco minutos: `rate_limit · You've hit your session limit · resets 1:20am (Europe/Madrid)`. Fue el
**límite de uso de la cuenta**, no un fallo técnico, y llegó **sin ningún aviso previo** en ningún jsonl. Tres
sesiones dejaron trabajo que nadie sabía que existía: el commit de SCRUM-932 sin empujar, once ficheros de 931 sin
commitear y el borrador del prototipo de Gastos. Se encontraron a la mañana siguiente porque tres sesiones nuevas
midieron antes de creerse su encargo. No por un mecanismo.

`relevar` (SCRUM-899) **no cubre esto**: el límite es de la cuenta, así que una sesión nueva muere igual, y ninguna
de las seis pasaba de 300k al morir.

## ② Lo que hace — y su única ambición

No evita perder trabajo: **lo hace visible**. `scripts/equipo/huerfanos.mjs` recorre `git worktree list` y clasifica:

| estado | qué es | se lista |
|---|---|---|
| SIN-EMPUJAR | commits desde HEAD que no están en ninguna rama remota | **siempre** |
| SUCIO | cambios sin commitear tocados dentro de la ventana (72 h) | sí |
| SUCIO-ANTIGUO | lo mismo, más viejo | solo se cuenta |
| NO-PUDE-MIRAR | ruta inexistente, git falló, salida ilegible | **siempre**, y sale con 2 |

La edad de lo sucio es el `mtime` del fichero sucio más reciente, no la del último commit: un árbol de julio con un
fichero tocado ayer es de ayer. Sucio sin fecha legible se lista (no se puede decir que sea viejo).

**NEGATIVO:** solo órdenes de git de lectura. No borra, no empuja, no commitea, no cambia de rama, no hace `fetch`.
No imprime contenido de ficheros.

## ③ Medido

**En la máquina** (18-sep ~07:07Z, 15 s): **93 worktrees mirados · 6 con commits SIN EMPUJAR · 8 sucios recientes ·
27 sucios antiguos (no listados) · 0 NO PUDE MIRAR**. El prototipo sin filtro de edad daba 40 avisos; con él, 14.
Los seis sin empujar: `wt-scrum-902` (920b, vivo), `wt-888d` (937, vivo), **`wt-scrum-895` (3 commits del 17-sep
11:54 que nadie buscaba)**, `ancla-mutacion` (9-sep), `wt-716c` (4-sep), `scrum-200-recon-emision` (julio).

**Guard** `tests/scrum946-censo-de-huerfanos.test.mjs`: 10 pass. Fabrica un repositorio de verdad en el temporal
del sistema, con un remoto desnudo y seis worktrees (limpio, commit ya empujado, commit sin empujar, sucio sin
commits, sucio de hace 10 días, registrado sin directorio), y comprueba población, rojo, el caso que decide
(sucio SIN commits), positivo, filtro por edad con su control, suelo, negativo (refs, índice y mtimes iguales
antes y después) y la CLI.

**Mutantes** (cada uno aplicado sobre el script y medido; fichero restaurado después):

| mutante | tests que caen |
|---|---|
| M1 · los commits sin empujar se ignoran | 3 (ROJO, CLI, puras) |
| M2 · sin número de commits = limpio | 1 (puras) |
| M3 · ruta inexistente = limpio | 2 (SUELO, CLI) |
| M4 · sin filtro de edad | 2 (FILTRO, CLI) |
| M5 · solo cuenta lo no seguido | 4 (EL QUE DECIDE, FILTRO, CLI, puras) |
| M6 · «no pude mirar» no gana el código de salida | 2 (SUELO, CLI) |

## ④ Dónde se usa

Paso nuevo en `docs/equipo/orquestador-autonomo.md` §5ter, «Al volver, el orquestador nuevo», punto 1: se corre al
arrancar cada tanda y cada línea se casa con un puesto y va en su encargo.

## ⑤ Lo que no cubre

- Mide contra las ramas remotas que este clon conoce: sin `fetch`, un commit empujado desde otra máquina y no traído
  saldría como SIN-EMPUJAR. Es el lado seguro.
- Mira el HEAD de cada worktree, no ramas locales sin worktree.
- No distingue trabajo vivo de huérfano: `wt-888d` y `wt-scrum-902` salen porque están a medias ahora mismo. Eso lo
  decide quien lee la lista, con los traspasos delante.
