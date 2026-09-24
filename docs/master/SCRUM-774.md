# SCRUM-774 · aislamiento entre sesiones — el árbol (cara A del ticket plegado)

**Fecha:** 22-sep-2026 10:34Z · **Carril:** S5 · infraestructura/sesiones
**Medido contra:** `origin/main` = `1f92f5733359880115b3f76824d38db25bef56e0` · 2026-09-22T08:34Z
**Rama:** `scrum-774-arbol-mio` · **Worktree:** `wt-s5-774`
**Decisión del fundador:** comentario Jira 16265 (21-sep) — `npm run arbol:mio` en el PASO 0 de las
normas + ampliar `guard-dangerous.mjs:479` a `checkout -b`/`switch -c` con cambios sin commitear.
Condición previa: reproducir el pisotón HOY antes de construir.

Este ticket llegó plegado con dos caras más (LA BASE de dev compartida, LAS REFS de origin que
otras sesiones mueven — comentarios 14629/14647/14706/14710 de Javier) que **no se tocan aquí**:
siguen bloqueadas por «¿qué base le toca a cada worktree?», sin responder. Esta entrega es sólo
**CARA A: el árbol**, que es la que el fundador desbloqueó el 21-sep.

## ① PASO 0 — reproducido, con el guard de HOY (antes de tocar nada)

Repo temporal: rama `scrum-586-victima` con `a.sql` y `b.sql` sin commitear. Sobre ese mismo
árbol, `git checkout -b scrum-760-otra-sesion`:

    ANTES del arreglo → { bloqueado: false, motivo: '' }
    el 'reset --hard' que vino DESPUÉS en el incidente real → { bloqueado: true, ... } (ya cubierto)

**Confirmado: hoy `checkout -b` sobre un árbol con trabajo sin commitear de otra rama NO salta
nada.** El `reset --hard` posterior sí estaba cubierto (regla 6 vieja de `guard-dangerous.mjs`) —
el agujero real es el paso de en medio: cambiar de rama, que no descarta nada pero mueve el suelo
bajo los pies de quien tenía el trabajo.

## ② El arreglo — `.claude/hooks/guard-dangerous.mjs`

`descarteGit()` gana dos casos nuevos, con un campo `tipo` para diferenciar el mensaje:

- `git checkout -b <rama>` / `git checkout -B <rama>` con el árbol sucio → `tipo: 'cambio-de-rama'`.
- `git switch -c <rama>` / `git switch -C <rama>` con el árbol sucio → igual.
- **Fuera de alcance a propósito** (decisión explícita del fundador): cambiar a una rama YA
  EXISTENTE sin crearla (`git checkout otra`, `git switch otra`) sigue sin bloquear, aunque el
  árbol esté sucio — es la operación de rutina de una sola sesión en su propio árbol, y el control
  negativo `'cambiar de rama'` de `scrum454` (l.191, ya existente) lo exige así.

El mensaje para `tipo: 'cambio-de-rama'` NO dice «se perdería» (nada se pierde: git arrastra el
trabajo a la rama nueva) — dice que la rama actual CAMBIA bajo un árbol con algo sin commitear, cita
el incidente y remite a `npm run arbol:mio`.

## ③ `npm run arbol:mio` — punto 2 del ticket

`scripts/arbol-mio.mjs`, sólo lectura: `arbolMio(cwd, ticket)` devuelve `{arbol, rama, veredicto}`.
Veredictos: `MIO` (la rama empieza por `scrum-0*<ticket>[a-z]?-`) · `NO-MIO` · `CIEGO` (HEAD
desacoplado, o no es un repo git) · `INFORMATIVO` (sin ticket, sólo reporta). CLI: exit 1 si
`NO-MIO`/`CIEGO`, exit 0 en los otros dos. Usa `ejecutadoDirectamente()` de
`scripts/_puerta-de-entrada.mjs` para la puerta de entrada (SCRUM-765) — no se reinventa la
comparación rota que otros dos tickets de este mismo lote (922/773) estaban arreglando.

**No se ha tocado `docs/equipo/00-normas-comunes.md`.** Ese fichero tiene un solo dueño (S0,
cabecera del propio documento: «nadie más lo edita») — se REPORTA aquí y en Jira para que la S0
añada la línea de `npm run arbol:mio` al PASO 0, en vez de escribirla yo.

## Medido

- `tests/scrum774-arbol-de-otra-sesion.test.mjs`: **11 pass · 0 fail** — el pisotón reproducido y
  cerrado, el `reset --hard` posterior sigue cubierto, positivo (árbol limpio no bloquea),
  negativo (checkout/switch a rama existente no bloquea), `switch -c` cae igual que `checkout -b`,
  `veredictoArbol` (MIO/NO-MIO/CIEGO/INFORMATIVO, con el caso «7740 no es 774»: un prefijo no es
  un nombre), `arbolMio` sobre repo real y fuera de un repo, y el CLI por código de salida.
- `tests/scrum454-destructivo-sin-comprobacion.test.mjs`: **41 pass · 0 fail**, igual que antes de
  tocar el hook — ningún control negativo se rompió (en particular, l.191 «cambiar de rama» sigue
  sin bloquear).
- Las dos suites juntas + `scrum176`/`scrum176b`: **81 pass · 0 fail**.
- `npm run guards:entrada`: 11 guards, verde (un literal `'main'` en un test disparó el censo de
  SCRUM-723 sobre referencias móviles; se cambió por `'rama-cualquiera'` en vez de declarar una
  excepción — el test no necesitaba ese literal en concreto).

## Lo que NO se ha hecho

- ⛔ Las caras B (la base de dev compartida) y C (las refs de origin) del ticket plegado — siguen
  bloqueadas por la pregunta sin responder de qué base le toca a cada worktree.
- ⛔ `stash@{0}` de S1 — no se toca (regla explícita del ticket).
- ⛔ Ninguna rama reescrita, ningún `--force`.
- ⛔ `docs/equipo/00-normas-comunes.md` — reportado, no editado (dueño único: S0).
