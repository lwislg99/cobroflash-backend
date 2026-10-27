# SCRUM-1627 · ¿Main sin comprobarse? Por qué se cancelan las pasadas del CI sobre `main`, y si #2841 lo arregla

**Medido contra:** `origin/main` = `5c3f989ea86de25106fd9f73b41d08f44f62f901` · 2026-10-27T17:20:17Z

A9: comprobación → `docs/master/evidencias/SCRUM-1627/espera1627.mjs`

**Error propio:** di por buena una espera de runner de 0,0 min en la punta `efe2cc59`; eran jobs EN COLA, y GitHub
les pone `started_at` igual a `created_at`. Lo cacé al ver la punta en `queued` un minuto después: `espera1627.mjs` ya
sólo mide jobs `completed`, y la salida guardada es la corregida.

S5 (automatización · CI), por encargo del orquestador del equipo de Luis (`cobroflash-backend-52`), con orden de ir
delante de SCRUM-1621. Sólo medición: **no se ha tocado ningún workflow** ni ningún PR. Horas de GitHub (cabecera
`Date:`), entre 17:10:33Z y 17:18:56Z.

## La respuesta corta

| pregunta del ticket | respuesta medida |
|---|---|
| ¿Cada merge cancela la pasada del anterior y ninguna termina? | **Mitad sí, mitad no.** Las 7 canceladas (16:15Z → 16:44Z) tienen **0 jobs**: nunca arrancaron. Esperaban en el grupo `ci-refs/heads/main` y el push siguiente las **sustituyó** en la cola, que es lo que hace GitHub con el pendiente de un grupo. La que CORRÍA no se cancela (`cancel-in-progress` es falso en `main` desde SCRUM-935b), y **sí terminó**. |
| ¿Por qué tanto rato sin veredicto? | **El tope de 20 jobs a la vez de la cuenta.** En tres muestras (17:12:45Z, 17:13:11Z, 17:14:30Z): **20, 19 y 20 jobs corriendo y 35, 42 y 41 esperando runner.** La pasada viva de `main` (`c992358d`, creada 15:54:35Z) esperó **27 a 44 min por runner** antes de arrancar cada job, y mientras tanto retuvo el grupo. |
| ¿Es SCRUM-935 otra vez? | **No.** 935 era `main` matando a la pasada que CORRÍA (38 de 44). Hoy no se mata ninguna que corra: en las ramas, 1 cancelada de 40, y con 6 jobs (allí sí se mata la que corre, a propósito). El patrón «cancelada con 0 jobs» sólo sale en `main`. |
| ¿#2841 lo resuelve? | **No por sí solo.** Ver abajo: acorta la espera del GRUPO, no la del RUNNER, y su propio registro dejó sin medir justo el tope que hoy está lleno. |
| Una pasada sobre `main` que termine y dé veredicto | **Sí.** Run `40535649172`, `c992358d`: obligatorio **VERDE a las 16:45:46Z**; terminó a las **17:12:52Z** en `failure` por el meta-guard (SCRUM-1620). Antes, `ce1111a6` (run `40532410727`): **`success` a las 16:04:07Z**. |

## ① Lo medido

**Pasadas de `ci.yml` por `push` a `main`** (`evidencias/SCRUM-1627/medida1627.txt`, 25 más recientes a las 17:10:33Z):
18 `cancelled`, 2 `success`, 3 `failure`, 1 en curso, 1 pendiente. **Las 18 canceladas tienen 0 jobs.** Las de las
16:10Z a las 16:44Z cayeron todas detrás de la misma que corría: `c992358d` (15:54:35Z), que tuvo el grupo desde las
16:04Z (cuando acabó `ce1111a6`) hasta las 17:12:52Z.

**La espera, partida en dos** (`espera1627.txt`; sólo jobs terminados):

| | runs de hoy | con jobs | espera de RUNNER por job (p50 · p90 · máx) | espera de GRUPO por run (p50 · máx) |
|---|---|---|---|---|
| `main` (push) | 41 | 10 | 0,0 · 26,9 · **44,5 min** | 4,4 · 26,8 min |
| PR | 50 | 50 | 0,5 · 25,5 · 43,2 min | 0,0 · 0,2 min |

La espera de runner de `main` es TODA de una pasada (`c992358d`: build 26,9 · vigía 28,3 · guards 35,6 · meta-guard
38,7 · trinquete 43,4 · constancia 44,5 min). Las otras nueve de hoy esperaron 0,0-0,1 min. **Es un episodio de esta
tarde, no un estado crónico**: el que lo llena son las ramas (50 pasadas de PR hoy, 264 jobs terminados, p90 de
25,5 min esperando).

**La cola a las 17:12:45Z** (`runners1627.txt`): 30 runs vivos; 20 jobs corriendo, 35 esperando. En curso: 5 CI
(4 de PR y la de `main`), 1 Zona roja, 1 Vigía de main. En cola: 7 CI (de PR, 6 jobs cada una), 5 Avisador de PR en
rojo, 4 Vigía de main, 2 Zona roja, 2 PR automático, 2 Claude Code, 1 Conflicto de registro.

**El tope de 20 no lo he podido leer de GitHub**: `gh api user` no devuelve el plan con este token. Lo que hay es el
techo medido tres veces (20, 19, 20 con 35-42 esperando) y el repo público de una cuenta de usuario.

## ② La lectura del orquestador, contra el dato

«Cada merge arranca una pasada y el siguiente la cancela por grupos de concurrencia, y ninguna termina»:

- **Cierto:** cada push encola una pasada, y el siguiente la sustituye mientras espera. De las 25 más recientes de
  `main`, 18 murieron así, con 0 jobs. Es el diseño (SCRUM-935b: «GitHub sigue sustituyendo al run PENDIENTE del grupo»),
  y el vigía de main ya lo sabe (SCRUM-1393e/f: el «sustituido» lo absuelve un verde posterior que lo contiene).
- **Falso:** «ninguna termina». La que tiene el grupo termina siempre; lo que pasa es que **tarda lo que tarde el job
  más lento MÁS lo que tarde en conseguir runners**. Hoy, 78 min (15:54 → 17:12) en vez de ~28.
- **La contraprueba de las ramas**, la que pedía el ticket: en PR, 1 cancelada de 40, y con sus 6 jobs. El patrón es
  sólo de `main`, por la razón de arriba.
- **Lo que vio el orquestador** («7 canceladas, ninguna dio veredicto») era la lista de las TERMINADAS: la que corría
  (`c992358d`, `in_progress`) no estaba en ella, y su obligatorio ya era verde a las 16:45:46Z.

## ③ #2841 (SCRUM-1498c), contra esto

Qué hace: cada job de `ci.yml` en su propio grupo (`ci-<job>-<ref>`). El push siguiente espera sólo a SU job, no al
más lento del run. Está en borrador desde el 24-oct, con el obligatorio verde, esperando la respuesta de Javier
(SCRUM-1498 c.20790). Hoy casa con `main` sin conflictos (`git merge-tree`, base 3 commits por detrás).

| | con el grupo por run (hoy) | con #2841 |
|---|---|---|
| espera de GRUPO del obligatorio | hasta que acabe el job más lento del run anterior: hoy, `build + tests` de la punta esperó a un meta-guard (17:11:46Z) y un trinquete (17:12:51Z) que acabaron **26-27 min** después del obligatorio (16:45:46Z) | sólo hasta que acabe el `build + tests` anterior: esos 26-27 min, fuera |
| espera de RUNNER | 27-44 min hoy | **la misma, o más**: los jobs cortos de los commits intermedios ya no mueren con 0 jobs, corren (su propio registro: «un commit sustituido ya no tiene 0 jobs… lo que puede costar es ESPERA si se toca el techo de jobs a la vez. **No lo he medido**») |

**Veredicto:** #2841 quita la mitad del retraso que viene del grupo (hoy ~26 min) y no toca la que viene del tope de
runners (hoy 27-44 min), que es la mayor. Y añade carga justo al recurso que hoy está lleno, en una cantidad que nadie
ha medido. **No lo desbloquea esta medición**: la decisión sigue siendo de Javier (c.20790), y ahora con un dato más
para tomarla.

## ④ Lo que se puede hacer sin apagar nada (regla 41) — para decidir, no lo decido yo

1. **Nada, y vigilarlo.** Es un episodio (una pasada de diez con espera de runner hoy). Coste: cero; riesgo: que los
   episodios crezcan con el equipo.
2. **#2841**, con su pregunta de c.20790 contestada. Coste: más jobs por push en `main`, sin medir.
3. **Repartir la carga de las ramas**, que es quien llena el tope: p. ej. que un PR en borrador no lance los jobs
   largos hasta salir de borrador. Toca `ci.yml` (S5) y el flujo de los dos equipos: decisión de los dos jefes.
4. **Más runners** (plan de pago o runner propio): coste nuevo, lo decide el fundador.

## Lo que NO he hecho y lo que NO he medido

- No he tocado `ci.yml`, ni #2841, ni ningún workflow.
- **El vigía del despliegue** (③ del ticket): no he medido su cola aparte; con 35-42 jobs esperando, sus pasadas
  esperan como las demás. **#2455** sigue abierto por eso: la primera pasada con el arreglo de #2947 aún no ha corrido.
- Cuántos días al mes se llena el tope: sólo he medido hoy.
- El plan de la cuenta (ver ①).

## Cómo se repite

`node docs/master/evidencias/SCRUM-1627/medir1627.mjs` (pasadas de `main` y de PR con sus jobs, y la cola) ·
`node docs/master/evidencias/SCRUM-1627/runners1627.mjs` (jobs corriendo y esperando ahora) ·
`node docs/master/evidencias/SCRUM-1627/espera1627.mjs <desdeISO>` (espera de runner y de grupo). Usan `gh` en
`C:\Program Files\GitHub CLI\gh.exe`; sólo leen.
