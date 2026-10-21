# SCRUM-1574 · El ④ de scrum1405c ya no se salta porque lo diga la sonda (J3q)

**Medido contra:** `origin/main` = `67dde0caf421c9c246775098ab75aee6e8cc41e7` · 2026-10-21T12:57:52Z (sesión `jv-j3q`, equipo de Javier, carril J3, por encargo del orquestador `cobroflash-backend-5f`. Lo que entró en `main` entre la base de la rama y esa hora es SCRUM-1260b, que no toca este fichero ni el módulo.)

A9: comprobación → `tests/scrum1405c-tuberia-bloqueante.test.mjs`

**El ticket:** SCRUM-1574, abierto con la medición de jv-j3n (SCRUM-1405 c.20153 y el APÉNDICE SCRUM-1405d de `docs/master/SCRUM-1405.md`). En 14 de los 316 obligatorios de Linux con veredicto, el caso ④ se saltó porque la sonda de 1 MiB dijo «0 bytes pendientes», y esos jobs salieron en verde sin medir nada.

## ① Por qué la sonda da 0: no supo mirar

**Los 14 jobs:** los que `censo.tsv` de j3n marca `saltado` (lista en `evidencias/SCRUM-1574/saltados.txt`). Bajé sus 14 logs y 7 de control de los que sí midieron (uno de cada 40 `pasa` del mismo censo), con `--allow-escape-sequences`: los 21 entre 1.858.154 y 1.937.568 B, ninguno corto.

- **Los dos grupos corren en la misma máquina:** imagen `ubuntu-24.04` (versiones 20261002.596 y 20261012.601 en los dos grupos) y node 24.21.0 (`Found in cache @ /opt/hostedtoolcache/node/24.21.0/x64`). El log no imprime nada más de la sonda: sólo el motivo del salto, que en los 14 es «este node ya escribe BLOQUEANTE… (medido: 0 bytes pendientes tras 1 MiB)». Salida en `mira-salida.txt`.
- **En Linux esa frase es falsa siempre, no sólo esos 14 días.** Leído en el código de node v24.21.0 (no medido en Linux): `lib/net.js:655-658` pone bloqueante la salida estándar en tubería **sólo si `isWindows`**, y `deps/uv/src/unix/process.c:207` crea la salida del hijo con `uv_socketpair`. Los dos trozos, copiados, en `evidencias/SCRUM-1574/`.
- **Así que el 0 no dice «bloquea»: dice «esta vez no quedó nada».** Más de 0 sí lo prueba (una escritura bloqueante no vuelve hasta escribirlo todo), y 0 no prueba nada. **Que el lector vaciara el socket a tiempo** (el padre lee mientras el hijo escribe) es la explicación que encaja, pero es hipótesis: no lo he medido, y sin Linux en esta máquina no puedo.

## ② Qué hace ④ ahora

Quien decide si hay rojo que ver es el **brazo SIN el módulo**, no la sonda. La decisión es una función, `decidirCuarto(pendiente, sinFaltan)`:

| sonda | brazo SIN | ④ |
|---|---|---|
| no contestó | — | 🔴 NO PUDE MIRAR (como antes) |
| cualquiera | pierde en alguna pasada | **mide** el brazo CON y lo juzga con las cifras de 1405d (los 14 de este ticket caen aquí) |
| más de 0 | no pierde | 🔴 CIEGO (como antes) |
| 0 | no pierde | **se salta, y el salto empieza por «NO MEDIDO:» y dice lo que midió** (`faltan 0,0,0,0`) |

**¿Caer o declararse?** Declararse, y no lo he consultado porque sólo queda un caso que se salta: el de Windows, donde node sí bloquea y no hay rojo que ver. Si ahí cayera, caería toda tanda local de Windows. Y en Linux, para llegar ahí el brazo SIN tiene que no perder en sus 4 pasadas, que en los 302 jobs de 1405d no pasó ni una vez (pierden 3 o 4 de 4 en todos). Un `# SKIP` cuenta como «saltado» en la tanda, no como pase. Lo que he cambiado es quién decide el salto, no qué cae.

**El coste:** en Windows ④ ya no se salta sin hacer nada; ahora corre las 4 pasadas del brazo SIN. Medido aquí: 774 ms, y el fichero entero tarda 2,4 s.

## ③ Los controles

Caso nuevo, «SCRUM-1574 · ④ la decisión», que corre en **toda** tanda (también en Windows):

- **Positivo sembrado:** sonda a 0 con el brazo SIN de un job real (`115745643294`: `28,12,29,13`) tiene que **medir**; también con una sola pasada que pierde.
- **Negativo:** sonda con pendientes y brazo SIN real (`117734088229`) mide; sonda a 0 y brazo SIN a cero sale «no-medido» y su motivo empieza por `NO MEDIDO: ` y lleva los `faltan`; sonda con pendientes y brazo SIN a cero, CIEGO; sonda que no contesta, NO PUDE MIRAR.
- La cifra de pendientes `983040` es **fabricada**: el log no imprime lo que deja la sonda.
- **Quitándolo dice CIEGO:** borradas las dos filas del positivo, el caso cae con «🔴 CIEGO: falta el caso de SCRUM-1574» (10 tests, 8 pasan, 1 cae), y el fichero se restauró con `git restore`.

**Mutaciones**, declaradas en `MUTACIONES_QUE_ME_TUMBAN` para que el meta-guard las repita: vuelta al salto por la sonda, el salto sin «NO MEDIDO», y sin CIEGO. Aplicadas como las aplica él (`replace(de, a)`, banco fuera del árbol, `mutar.mjs.txt` y `mutar-salida.txt`): la base da 10 tests, 9 pasan, 0 caen, 1 saltado; **las 7 del fichero caen** (las 4 de 1405d en «el juez», las 3 nuevas en «la decisión»), `ambiguedadDelAncla` da `null` para las 7, y el fichero vuelve con el mismo sha256.

**Regla 41:** `CON_MAX_POR_PASADA` y `CON_MAX_PASADAS_QUE_PIERDEN` no se tocan.

## La mini-tanda, en local (Windows, `dist/` con `tsc --noCheck`)

390 ficheros: los que nombran `docs/master`, `MUTACIONES_QUE_ME_TUMBAN` o leen `tests/`, más los de suite (`scrum237`, `scrum976`, `scrum836`, `scrum710b`, `scrum1387`, `scrum1480f`, `scrum850`), sobre la rama ya mezclada con `main` y con este registro dentro: **3.755 tests · 3.721 pasan · 10 caen · 24 saltan** (suman). Los 10 son de 5 ficheros (`scrum1298b`, `scrum245`, `scrum461`, `scrum475`, `scrum476`: hooks, `tsc`, el cliente y el CLI de Prisma, `node_modules`), y **sobre un árbol de `main` (`67dde0caf`) sin mi cambio caen los mismos 10 por nombre** (46 tests, 35 pasan, 10 caen, 1 salta): son de este worktree, que no tiene `node_modules` propio. No he corrido la tanda entera.

## Lo que NO sé, o no he medido

- **El camino «mide» de ④ en Linux no lo he visto correr con este cambio**: aquí es Windows y ④ se salta. Lo que lo prueba es la función, en toda tanda; el cableado (que ④ llame a la función y obedezca su estado) sólo se verá en el obligatorio de este PR. Y un obligatorio no es un régimen.
- **Una mutación del cableado de ④ no la caza ningún caso en Windows**: sólo el ④ de Linux.
- **El mecanismo del 0** (que el lector vació el socket durante la escritura) es hipótesis, arriba.
- **El reparto de los 14 en el tiempo:** 1 el 14-oct, 5 el 16-oct, 3 el 17-oct, 3 el 18-oct y 2 el 19-oct. No he buscado con qué coinciden más allá de la imagen y node, que son los mismos que en los de control.

## Mis errores

- Mi banco de mutación importa el fichero de test para leer sus mutaciones, y al importarlo node corrió la tanda del fichero otra vez: es el bloque `✔ …` que sale al final de `mutar-salida.txt`. No cambia ningún resultado, pero no lo esperaba.
- El primer commit de la rama se llama «wip…»: el bot titula el PR con él. Lo corrijo con `gh pr edit`.

## Reproducir

`E=docs/master/evidencias/SCRUM-1574` · los logs: `gh api --allow-escape-sequences repos/lwislg99/cobroflash-backend/actions/jobs/<job>/logs` para cada línea de `$E/saltados.txt` y `$E/control.txt`, en una carpeta FUERA del árbol con esas dos listas dentro · `node mira.mjs <carpeta>` (es `$E/mira.mjs.txt`) · las mutaciones: `node mutar.mjs <raíz del árbol>` (es `$E/mutar.mjs.txt`), o `npm run meta:mutaciones`.
