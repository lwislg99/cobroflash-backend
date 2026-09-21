# SCRUM-972 · el techo de la ÚNICA puerta de `main`, subido antes de que se muera

**Fecha:** 20-sep-2026 · **Carril:** S5 · automatización, eficiencia e infraestructura
**Medido contra:** `origin/main` = `2f05fcae697bb8c1d71a6adc9332f404a1a1acfc` (tras el merge de
SCRUM-966) · 2026-09-20T19:55:27Z (GitHub)
**Rama:** `scrum-972-techo-de-la-puerta` · **Worktree:** `wt-963b`

Expediente CORTO a propósito: un cambio de configuración de CI de ~70 líneas, sin dinero, sin
fiscal y sin schema (norma de la tanda del 20-sep, «rigor proporcional al cambio»). Sale del
hallazgo de ⑥ de `SCRUM-963.md`; el orquestador lo mandó a su propio PR.

## ① El defecto, medido, y todavía no ha mordido

El job `build + tests (con banco desechable)` es **el único check obligatorio del ruleset
`protect-main`** (medido en SCRUM-963: `main` no tiene protección clásica, la tiene un ruleset, y
ese ruleset exige ese único contexto). Tenía `timeout-minutes: 10`, puesto cuando el comentario de
al lado decía «la suite tarda ~30 s».

Sobre los **100 últimos runs de `ci.yml`** (98 con este job medido · 2 sin él · **0 NO PUDE
MIRAR**), de punta a punta del job:

    p50 6:13 · p95 7:25 · máx 9:16          techo 10:00
    por encima del 80 % del techo (8 min): 1 de 98 (run 35317708289, 9:16, `success`)
    conclusiones: success 70 · cancelled 21 · failure 7

**La peor pasada se quedó a 44 segundos del techo.** Y el comentario que lo justificaba —«~30 s»—
llevaba meses siendo falso por un factor de doce; esa frase es la que hizo que nadie volviera a
mirar el número de al lado.

Las 21 `cancelled` son el `cancel-in-progress` de `main`, decisión de coste del fundador, y aquí
no se toca.

## ② Por qué no se espera a que muerda

SCRUM-935 acaba de demostrar, con 97 runs, que un techo fijo **se cruza solo**: la duración crece
con el trabajo (allí, el número de mutaciones pasó de 275 a 307 en un día) y el runner más lento
tarda un **60 % más con la misma carga**. Aquí el trabajo también crece solo: la tanda va por
**7.742 tests**.

La diferencia con 935, y es la que justifica hacerlo hoy: en cualquier otro job, morir en el techo
es **un check en rojo**. En éste, morir en el techo es **`main` sin ninguna puerta** — porque es la
única. Y un timeout de job GitHub se reporta como `cancelled`, que es la palabra que durante
semanas se leyó como «la concurrencia» (935). Se pagaría dos veces: sin puerta, y sin saber por qué.

## ③ Lo hecho

1. **`timeout-minutes: 10 → 25`.** Es **2,7× el máximo medido hoy** (9:16). El margen es a
   propósito mayor que el de 935 (2,1×) por lo de ②. Sigue siendo un tope de verdad: el propósito
   original —cortar un job colgado esperando una red que aquí no existe— se mantiene, porque 25
   minutos acotan y 0 no. En dinero **cero**: el repositorio es público y `/timing` devuelve 0 ms
   facturables.
2. **Una marca de arranque como PRIMER paso del job**, para que la medida cubra el job entero
   (`npm ci`, Postgres, Prisma, compilar y la tanda), que es lo que el techo acota. Medir sólo la
   suite diría que sobra tiempo justo cuando el que se acaba es el del job.
3. **Un paso final `if: always()`** que deja **SIEMPRE** la duración en el resumen del job —también
   en verde— y **AVISA a los 15 min** (60 % del presupuesto, **1,6× el máximo de hoy**), con el
   texto de que eso no se arregla subiendo el techo otra vez. `if: always()` no es opcional: el
   caso que más interesa, el job que se está yendo de tiempo, viene con el paso anterior cortado.
4. **Avisa, no veta.** Un veto por lentitud en ESTE job dejaría a `main` sin puerta una tarde de
   runners lentos, que es justo lo que se viene a evitar. Y un guard que cae por sorteo enseña a
   desconfiar de los rojos (canon de `sesion-5.md`).
5. Se corrige el comentario falso de las «~30 s» por la medición real, con su población.

## ④ Los controles

- **POSITIVO, y es el que vale:** que el workflow **parsee y arme sus 6 jobs** en el PR. En esta
  máquina **no hay parser de YAML** (ni `js-yaml` ni `yaml` en `node_modules`, ni `pyyaml` en
  Python 3.13; comprobado hoy, no heredado), así que la validación la da GitHub **por efecto**: si
  no parsea, el workflow no arranca y el PR se queda sin checks.
- **Estructural, en local:** el job `test` sigue teniendo sus pasos a la misma indentación y ahora
  son 13, con la marca la primera y la duración la última. Ninguna entrada de lista quedó a una
  indentación que no existiera ya en el fichero.
- **NEGATIVO:** no se toca ningún otro job, ni `cancel-in-progress`, ni el ruleset, ni el nombre
  del check (`build + tests (con banco desechable)`), que es lo que el ruleset exige **byte a
  byte**: cambiarlo dejaría a `main` sin puerta de la otra forma, con el tablero en verde.
- **Lo que NO hay, y lo digo:** **no hay guard automático** que impida que este techo vuelva a
  quedarse corto. Sería un guard nuevo sobre `ci.yml`, y un guard nuevo tiene que declarar su
  mutación en el meta-guard: más riesgo y más tiempo que el arreglo. Lo que queda en su lugar es
  el aviso de ③.3, que corre solo en cada pasada. Es menos que un guard; es más que nada, que era
  lo que había.

## ⑤ Lo que NO se ha tocado

- El ruleset `protect-main`: su cambio está preparado en SCRUM-963 y lo aplica un jefe.
- `cancel-in-progress` de `main`: decisión de coste del fundador.
- Los techos de los otros cinco jobs.
- Nada de `src/` ni `public/` (S5 no toca producto).
