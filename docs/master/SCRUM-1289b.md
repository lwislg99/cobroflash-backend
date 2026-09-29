# SCRUM-1289b · El TAP de la tanda, arreglado de raíz: los reporters salen de `NODE_OPTIONS`

**Rama:** `scrum-1289b-reporters-como-argumentos` · **Carril:** S3 · instrumentos (s3-29e) · **Fecha:** 29-sep-2026
**Medido contra:** `origin/main` = `45181d233c74ee36a39db4913d9593e7e9a284df` · 2026-09-29T17:50:20Z

Sigue a SCRUM-1289 (S5, PR #1990): el TAP de TODAS las tandas del CI salía con un 94 % de NUL,
porque un hijo `node --test` heredaba de `NODE_OPTIONS` los reporters y truncaba `tanda.tap`. S5
arregló los dos hijos (scrum976 y scrum928) y dejó cuatro puntos para S3. Los cuatro, aquí.

| # | punto | hecho | cómo se sabe |
|---|---|---|---|
| 1 | arreglo DE RAÍZ | `tanda-con-veredicto.mjs` saca los `--test-reporter*` de `NODE_OPTIONS` y se los pasa como ARGUMENTOS, justo detrás de `--test` (`scripts/_reporters-de-node-options.mjs`). Los argumentos no se heredan. Desde `ci.yml` NO se podía: node ignora los reporters puestos detrás de los ficheros (lo midió S5) | banco del VIAJE en `tests/scrum1289b-…`: una tanda de verdad, con los reporters en `NODE_OPTIONS` como en el CI y un test que lanza su `node --test` sin limpiar nada. **Control positivo**: SIN el envoltorio, el TAP sale roto. **Mutación** (envoltorio sin el arreglo): 3.109 NUL de 3.535 bytes y dos resúmenes `[1, 21]` → cae. Ojo: el control positivo cazó que la primera versión del banco NO reproducía la avería (el padre aún no había escrito cuando el nieto truncaba). Se corrigió con un primer fichero que escribe antes |
| 2 | `scrum850b` conservaba `NODE_OPTIONS` | `ENTORNO_LIMPIO` borra también `NODE_OPTIONS` | 6/6 verde |
| 3 | `suelo-de-la-tanda.mjs` acertaba POR SUERTE | `integridadDelTap` (en `_suelo-de-la-tanda.mjs`): si hay NUL o más de un `# tests N` en la raíz → NO SUPE MIRAR (salida 2), no cuenta. Medido antes de fijar la regla: node 24 con describe/it y `t.test` anidados emite UN solo resumen en la raíz | sobre el TAP roto de VERDAD del banco se niega a contar; sobre el sano cuenta 21. Mutación (`if (false)`) → caen 3 tests. Mismo criterio que `integridadTap` de `por-que-cayo.mjs` (#1990). Cuando entre #1990, convendría que uno importe del otro |
| 4 | el censo de `scrum1153` no vio a 976 ni a 928 | **tres** cegueras, cada una medida: (a) daba por limpio el `env` con UN `delete` cualquiera (los dos borraban `NODE_TEST_CONTEXT`); (b) solo contaba hijos que parsean stdout (un `node --test` trunca el TAP aunque solo mire el `status`); (c) no reconocía `{ cwd, env }` abreviado (976 salía «sin env» y ni entraba). Ahora exige las TRES variables tratadas (`SPREAD_A_MEDIAS` + `faltan`), y el alcance incluye «lanza `--test`» y «borra `NODE_TEST_CONTEXT`» | **control positivo REAL**: 976 y 928 de antes del arreglo, leídos de git (`9911a2dc`), se acusan los dos con `faltan: ['NODE_OPTIONS']`. **Negativo DERIVADO**: el mismo texto con `delete env.NODE_OPTIONS` sale limpio. Con el censo viejo caen los 6 tests nuevos |

## El árbol de hoy, con el censo arreglado: 15 acusados (antes, ninguno de estos)

`node-p-capturado-sin-color:80`, `scrum1123:95` y `:131`, `scrum754:667`, `scrum815:42`,
`scrum899d:83`, `scrum928:109`\*, `scrum932:73`, `scrum946:138`, `scrum949:134`, `scrum966:122`,
`scrum976:69`\*, `scripts/censo-mudez.mjs:90`, `scripts/guards-entrada.mjs:171`,
`scripts/verificacion-s5/romper-los-quince.mjs:169`.

\* los arregla #1990 (S5). El resto NO se toca aquí: son de varios dueños.

🔴 **«YA NO MUERDE» NO ES «ARREGLADO».** Con el punto 1 dentro, **el daño está contenido**: en
`NODE_OPTIONS` no quedan reporters que heredar, así que estos 13 ya no pueden romper el TAP. Pero
**la deuda sigue viva**: siguen prestando `FORCE_COLOR`/`NODE_TEST_CONTEXT`/`NODE_OPTIONS` a su hijo,
y lo próximo que alguien meta en `NODE_OPTIONS` (u otra variable de la familia) volverá a colarse
por ellos. El censo es informativo —ningún test exige hoy cero acusados—, así que nada los obliga a
bajar. **Abren la cola del 30-sep**, para repartir por dueño (decisión del orquestador, 29-sep).

## Lo que se corrió

`tests/scrum1289b-…` (9/9; banco estable en 3 pasadas) · `scrum1153` 15/15 · `scrum850b` 6/6 ·
`scrum672`/`702`/`736` (suelo) · `scrum858b`/`858c`/`899b`/`928`/`928b`/`161`/`265`/`522`/`1245b`
(envoltorio y tanda) 90/90 + 1 skip. NO se corrió `npm test` entero (SCRUM-1244: en esta máquina
revienta por memoria): el veredicto completo es el del CI.
