# SCRUM-1289 · El «por qué cayó» del check obligatorio estaba ciego: el TAP de la tanda, roto en todas las tandas

**Rama:** `scrum-1289-tap-del-obligatorio` · **Carril:** S5 · automatización (s5-29d) · **Fecha:** 29-sep-2026
**Medido contra:** `origin/main` = `c22f7e9ca080ab1a72407a1c60a492589c547854` · 2026-09-29T17:11:49Z

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

- **S3 (instrumentos) · el arreglo DE RAÍZ.** Mientras un test pueda lanzar `node --test` heredando
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
