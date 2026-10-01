# SCRUM-1289 · El «por qué cayó» del check obligatorio estaba ciego: el TAP de la tanda, roto en todas las tandas

**Rama:** `scrum-1289-tap-del-obligatorio` · **Carril:** S5 · automatización (s5-29d) · **Fecha:** 29-sep-2026
**Medido contra:** `origin/main` = `c22f7e9ca080ab1a72407a1c60a492589c547854` · 2026-09-29T17:11:49Z

> 🔴 **EL ALCANCE, DE GOLPE: el TAP de la tanda —el fichero principal de diagnóstico del proyecto—
> salía roto en TODAS las tandas, también en las VERDES.** Lo que lo leyera venía leyendo basura: el
> «por qué cayó» callaba, y `suelo-de-la-tanda.mjs` acertaba solo porque el número que necesita
> estaba en la cola del fichero, detrás del tramo de NUL.
>
> 🔴 **Y el censo que existe para cazar esta familia (`scrum1153-censo-entorno-prestado`) estaba
> CIEGO justo a los dos casos que la causaban**, scrum976 y scrum928. Es un instrumento que devuelve
> silencio cuando no puede mirar.

## Qué pasaba

El paso «Por qué cayó» del job `build + tests` hacía un `awk '/^not ok /'` sobre `tanda.tap`. Ese TAP
estaba **roto en TODAS las tandas, verdes incluidas**, así que el paso imprimía su cabecera y nada,
y eso se leía como «no cayó nada».

Medido sobre los artefactos `tanda-tap` y los logs de los cuatro rojos del ticket:

| run | NUL en el TAP | lo que cayó (del log `spec`) |
|---|---|---|
| 36558271547 | 94,0 %, desde el byte 51.638 | `tests/scrum388-censo-mecanismo.test.mjs` (proceso) |
| 36466769679 (intento 1) | 93,9 %, desde el byte 50.946 | SCRUM-753 · los TRES estados… |
| 36171412632 | 93,9 %, desde el byte 47.867 | SCRUM-775 y SCRUM-804b |
| 36443916358 | 93,9 %, desde el byte 49.198 | SCRUM-775 |

(El artefacto de 36466769679 es el del intento 2, que salió verde, y está **igual de roto**: la
avería no depende del resultado.)

## La causa, con nombre y apellidos

Los reporters de la tanda van en `NODE_OPTIONS` (SCRUM-552). Un test que lanza `node --test`
heredando `NODE_OPTIONS` crea un segundo orquestador que **abre `tanda.tap` truncándolo** y escribe
su TAP desde el byte 0 mientras el padre sigue en su desplazamiento: el hueco queda en NUL.

- **La cabeza de 112 tests** de los cuatro rojos es `npm run guards:entrada`, lanzado por
  `tests/scrum976-guards-entrada-con-techo.test.mjs` (S5), que borraba `NODE_TEST_CONTEXT` pero no
  `NODE_OPTIONS`. Reproducido en local: dos resúmenes (`# tests 4` y `# tests 112`) en un solo TAP.
  Arreglado; después, el mismo ensayo da un TAP legible.
- **Un segundo hijo, que salió al correr la tanda entera en local tras el primer arreglo** (la
  cabeza pasó a ser `a`, `b`, con el 84,7 % de NUL): `tests/scrum928-guards-entrada-recuento-con-color.test.mjs`
  (S5), con el mismo defecto. Arreglado.
- **Queda al menos uno, y no es de S5:** `tests/scrum850b-las-formas-que-mienten.test.mjs` corre un
  `node --test` por `bash -c` con un entorno que conserva `NODE_OPTIONS` (S3, instrumentos). Y el
  censo que debería cazar esta clase de defecto, `scrum1153-censo-entorno-prestado`, no vio ni a
  scrum976 (lanza un guion que a su vez lanza `--test`) ni a scrum928 (lanza `--test` directamente).

## Lo que se ha hecho (S5)

1. **`scripts/equipo/por-que-cayo.mjs`**, que sustituye al `awk`. Antes de leer el TAP mira si se
   puede leer: sin NUL, con **un solo** resumen `# tests N` y con `not ok` si `fail > 0`. Si se puede
   leer, saca los `not ok` con su YAML (`exitCode`, `signal`). Si no, **lo dice** y usa el log `spec`.
   Tres salidas que no se confunden: CAYERON (con la fuente), SIN_FALLOS (el rojo es de otro paso)
   y NO_SUPE_MIRAR. **Sale siempre con 0**, y en el workflow lleva además `|| true`.
2. **El paso «Tests» guarda el log `spec`** (`tee "$RUNNER_TEMP/tanda-spec.log"`) con
   `set -o pipefail`, que no es opcional: sin él, el código de salida sería el de `tee` y una tanda
   roja saldría verde (SCRUM-850).
3. **Un paso informativo en cada tanda, también en verde: «¿Se puede leer el TAP de la tanda?»**
   (`continue-on-error`). Escribe en el resumen del job si el TAP está sano o no. Es el aviso de que
   ha vuelto a entrar un hijo, y la próxima vez nadie tendrá que abrir el artefacto a mano.
4. Arreglados los dos hijos que son de S5: scrum976 y scrum928 (`delete env.NODE_OPTIONS`).
5. `tests/scrum1289-por-que-cayo.test.mjs`: control positivo de cada forma de TAP ilegible, las tres
   salidas distintas, el código de salida de los dos modos, los pasos de `ci.yml` y el hijo de
   scrum976. **Seis mutaciones**, cada una comprobada en rojo **tumbando su test y solo ese**.

**Verificación contra los rojos reales:** con el log de cada uno de los cuatro runs, el guion da
CAYERON desde el log `spec` con los nombres de la tabla de arriba, y avisa de que no pudo leer el
TAP con su porcentaje y su byte.

## Pendiente, con dueño

- 🔴 **S3 (instrumentos) · el arreglo DE RAÍZ. Medido: NO se puede hacer desde `ci.yml`** (no lo
  intentes por ahí): `node --test <ficheros> --test-reporter=…` ignora en silencio los reporters puestos
  detrás de los ficheros, y la tanda es `npm test`, que los pone al final. Mientras un test pueda lanzar `node --test` heredando
  `NODE_OPTIONS`, el TAP se puede volver a romper. Lo que lo quita para siempre es que el envoltorio
  `scripts/tanda-con-veredicto.mjs` (SCRUM-858b, S3) saque los `--test-reporter*` de `NODE_OPTIONS`
  y se los pase **como argumentos** solo al `node --test` que lanza. Medido: detrás de los ficheros
  de la tanda, `node --test` NO acepta reporters (los ignora), así que desde `ci.yml` no se puede;
  va en el envoltorio.
- **S3 · scrum850b** conserva `NODE_OPTIONS` en su `ENTORNO_LIMPIO`.
- **S3 · el censo de scrum1153** no ve los dos casos de arriba.
- **S3 · `scripts/suelo-de-la-tanda.mjs`** lee `# tests N` de este mismo TAP. Hasta hoy acertaba
  porque el resumen del padre queda al final, detrás del tramo de NUL: ha acertado **por suerte**. El
  paso informativo nuevo va justo antes y dice si ese TAP se puede leer, pero el suelo debería
  negarse a contar sobre un TAP ilegible (`integridadTap` está exportada en `por-que-cayo.mjs`).
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
