# SCRUM-966 · el censo de huérfanos también mira las ramas locales sin worktree

**Fecha:** 20-sep-2026 · **Carril:** S5 · automatización, eficiencia e infraestructura
**Medido contra:** `origin/main` = `8fcfd13fc7e14069bef9ce2b9c3f94fe969f2506` · 2026-09-20T19:19:51Z (GitHub)
**Rama:** `scrum-966-censo-ve-las-ramas` · **Worktree:** `wt-966`

Expediente CORTO a propósito: arreglo de un instrumento, sin dinero, sin fiscal y sin schema
(norma de la tanda del 20-sep, «rigor proporcional al cambio»).

## ① El defecto, y existía hoy

El censo de SCRUM-946 recorre `git worktree list` y mira el **HEAD** de cada árbol. Una rama local
que no es el HEAD de ningún worktree no la ve. Su propia cabecera lo decía —«⚠️ Mira el HEAD de
cada worktree, no las ramas locales sin worktree»—, y decirlo no lo impedía.

El 20-sep-2026 la Sesión 4 dejó `scrum-944b-nombre-del-trabajo` con **5 commits en ningún remoto**
(`git rev-list --count scrum-944b-nombre-del-trabajo --not --remotes` → `5`, medido a las ~19:25Z).
Su worktree, `wt-s4b-943`, estaba en `scrum-943-categoria-validada`. O sea: cinco commits
invisibles para el censo que existe justo para que no haya commits invisibles.

## ② EL ROJO, por efecto y con población

Con el `huerfanos.mjs` de `origin/main` tal cual, contra el repo de verdad:

    censo de huérfanos · 116 worktrees mirados · 5 con commits SIN EMPUJAR · 2 sucios recientes
    (<72 h) · 37 sucios antiguos (no listados) · 0 NO PUDE MIRAR        EXIT=1

116 mirados y **0 ciegos**: la pasada arrancó y llegó al final, así que el silencio es un silencio
de verdad. Y en esa salida **no aparece ninguna** de estas diez ramas, todas con commits que no
alcanza ningún remoto:

    scrum-944b-nombre-del-trabajo · scrum-831-albaranes-sin-acciones · scrum-834-control-e2e
    scrum-468-pantalla-firma-como-el-pdf · scrum-418-puerta-de-produccion · guard-302-respaldo
    scrum-302-pagina-albaran · scrum-271-cantidad-sin-inventar
    scrum-260-constancia-clean-staging-rebasada · scrum-245-fase3-exencion-demo

⚠️ **Una nota de honestidad sobre la medida:** entre el rojo y el verde, la Sesión 4 empujó
`scrum-944b`, que pasó de 5 commits huérfanos a 0. El caso que motivó el ticket ya no se reproduce;
los **otros nueve sí**, y son los que sostienen el rojo. Que el disparador se cure solo no cura el
mecanismo: la próxima rama sin worktree volvería a ser invisible.

## ③ El arreglo

Un segundo censo, el de **ramas**, en el mismo fichero:

- `RAMA-SIN-EMPUJAR` — rama local que **no** es HEAD de ningún worktree y cuyos commits no alcanza
  ningún remoto. Se lista siempre, sea cual sea su edad, igual que los commits sin empujar de ⓐ.
- Las ramas que **sí** tienen worktree no entran: ya las nombra el censo de arriba, y un censo que
  cuenta lo mismo dos veces enseña a no leerlo.
- **POBLACIÓN declarada**, que es la mitad del valor: `y 658 ramas locales sin worktree (de 772) ·
  9 con commits SIN EMPUJAR`. Un «0» sin esa línea seguiría siendo «no he mirado».
- **SUELO:** si `for-each-ref` o el `rev-list` fallan, el censo de ramas sale `ok: false`, se
  imprime bajo «NO PUDE MIRAR» y **el código de salida es 2**. No devuelve una lista vacía.

**El coste, porque esto corre lo primero de cada tanda y hay 772 ramas.** No se lanzan 772
procesos: se lanzan **dos** (`for-each-ref` y un solo `rev-list --branches --not --remotes`, que da
los ~40 commits que no alcanza ningún remoto) y sólo se cuenta de una en una las **9** ramas cuya
punta está en ese conjunto. La punta basta: si el último commit de una rama no lo alcanza un
remoto, esa rama tiene trabajo sin empujar; si lo alcanza, no lo tiene.

⚠️ Trampa medida al construirlo: `git rev-list --no-walk --branches --not --remotes` **no** devuelve
sólo las puntas. `--no-walk` no tiene efecto cuando hay un rango, y `--not --remotes` es un rango,
así que recorre igual (42 commits, de los que sólo 17 eran puntas). No se usa `--no-walk`: se usa el
recorrido entero, que además es lo que hace falta.

## ④ El verde, la misma medida

    censo de huérfanos · 116 worktrees mirados · 5 con commits SIN EMPUJAR · ... · 0 NO PUDE MIRAR
       y 658 ramas locales sin worktree (de 772) · 9 con commits SIN EMPUJAR        EXIT=1

    🔴 RAMAS LOCALES SIN WORKTREE CON COMMITS QUE NO ESTÁN EN NINGÚN REMOTO:
       scrum-831-albaranes-sin-acciones · 1 commit(s) · último 2026-09-09T10:54:26+02:00
       scrum-834-control-e2e · 1 commit(s) · último 2026-09-09T10:04:47+02:00
       scrum-468-pantalla-firma-como-el-pdf · 1 commit(s) · último 2026-08-11T19:22:08+02:00
       scrum-418-puerta-de-produccion · 1 commit(s) · último 2026-08-11T13:50:06+02:00
       guard-302-respaldo · 2 commit(s) · último 2026-08-05T14:06:07+02:00
       scrum-302-pagina-albaran · 2 commit(s) · último 2026-08-05T14:06:07+02:00
       scrum-271-cantidad-sin-inventar · 1 commit(s) · último 2026-08-03T11:39:38+02:00
       scrum-260-constancia-clean-staging-rebasada · 3 commit(s) · último 2026-08-02T17:18:14+02:00
       scrum-245-fase3-exencion-demo · 1 commit(s) · último 2026-08-02T15:19:00+02:00

## ⑤ El control positivo

`tests/scrum966-censo-ve-las-ramas.test.mjs` fabrica su propio repositorio en el temporal del
SISTEMA (SCRUM-824) con un remoto desnudo y cuatro ramas: `main` (empujada), `rama-con-arbol` (con
worktree y sin empujar), `huerfana` (sin worktree y sin empujar) y `empujada` (sin worktree y ya en
el remoto). Siete tests: el rojo, la población, el positivo (la empujada no sale y la que tiene
árbol no se cuenta dos veces), el suelo (con un `git` inyectado que falla en `for-each-ref` → código
2), el negativo (no toca nada) y las decisiones puras.

**Y el control que importaba:** los **10 tests de SCRUM-946 siguen verdes sin tocar ni uno**.
Ganar cobertura no podía perder detección. Los dos ficheros juntos: **17 tests · 17 pass · 0 fail**.

## ⑥ Lo que NO se ha tocado

- Nada de `src/` ni `public/` (S5 no toca producto).
- El censo de worktrees: sus estados, su filtro de edad y su salida siguen igual. La línea de
  población de arriba se conserva **carácter a carácter**; lo nuevo va en una línea propia debajo,
  para que los guards y los ojos que ya leían esa primera línea sigan leyendo lo mismo.
- No se ha empujado, borrado ni commiteado ninguna de las 9 ramas encontradas. Son de otros
  carriles: el censo **nombra**, no arregla.
