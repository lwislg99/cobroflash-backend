# SCRUM-702 · El suelo cantó «ha perdido 9 tests» y no faltaba ninguno — pero no era el sistema operativo

**Fecha:** 3-sep-2026 · **Carril:** instrumentos (guards de la casa) · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `4e9e114d1620386c76982efbc4eeae1e9d55fc06` · 2026-09-03T11:46:24Z

**Tanda:** 4937 tests, 4852 pass, **1 fail**, 84 skipped — medida DESPUES del ultimo cambio, entrada incluida.

> 🔴 **El fallo NO es de este ticket y no se disimula:** `SCRUM-652d · ✅ CONTROL POSITIVO: NO se
> estrena una entrada de nav para el parte`. Ya estaba en `main` antes de tocar nada, y con doble
> evidencia: cae en la tanda local sobre `origin/main` = `4e9e114d` limpio, y cae también en el
> TAP del CI de ese mismo commit (`# fail 1`, el mismo test). Se reporta; arreglarlo es otro carril.

---

## 🔴 Lo primero, porque cambia el diagnóstico entero: NO es Windows contra Ubuntu

La hipótesis de partida —«el número se declara con una medición local y se evalúa contra una del
runner: dos poblaciones distintas»— **no se sostiene**. Medido sobre **dos árboles distintos**, en
los **dos entornos**, con el número que el guard lee de verdad (`# tests` del TAP):

| árbol | local (Windows) | CI (Ubuntu) |
|---|---|---|
| `c71635ce` (rama scrum-694, anoche) | **4812** | **4812** |
| `4e9e114d` (main, hoy) | **4928** | **4928** |

El TAP del CI sale del artefacto `tanda-tap` de esos mismos commits. Y en el segundo la
comparación se hizo **nombre a nombre**: 4912 nombres distintos a cada lado, **cero de más en
cualquiera de los dos**.

Lo que **sí** difiere entre entornos es `# skipped` —84 en local, 74 en el CI, porque allí hay
bases de datos que aquí no— y algún `# fail`. Pero **`# skipped` no entra en `# tests`**, que es
el único número que el guard compara. La diferencia de entorno existe; simplemente no toca a
este guard.

---

## Lo que era: el ÁRBOL, no la máquina

El suelo se **declara** en un commit y se **evalúa** en otro. Y `main` se mueve deprisa. De los
artefactos del CI de la noche del 2-sep-2026:

```
22:19  cc67773b  main        4805
22:30  c71635ce  scrum-694   4812     ← una rama con SUS tests dentro
22:33  21a1920b  main        4812     ← main tras mezclarla
22:42  1ef99272  main        4832
22:58  b1ae3fd9  main        4841     ← 36 tests en cuarenta minutos
```

**Y la prueba con nombre y apellidos:** el commit `deeb89a9` (rama `scrum-697`) declaró
`SUELO_TESTS = 4814` mientras **su propio CI medía 4805**. Nueve. Toda rama hermana que no
tuviera esos tests quedaba nueve por debajo **sin haber perdido nada**.

Eso explica también por qué era la primera vez que cantaba: 4766 y 4798 no estaban mejor medidos,
estaban **más flojos**. El primero que lo dejó a ras se comió el colchón — que es exactamente el
diagnóstico del encargo, sólo que la holgura no absorbía una diferencia de entorno sino la
distancia entre dos commits.

**La sospecha de los nueve worktrees queda DESCARTADA, no sin comprobar.** Censados por AST los
`test()` de `tests/`: **uno solo** existe bajo un `if` (y no depende del entorno), y los 23 que se
generan en bucle van sobre **arrays escritos en el propio fichero**, no sobre nada leído del
disco. Ningún test itera worktrees. El número coincidía; no era la causa.

---

## PASO 0

**ENTRADA.** No hay entrada de usuario: **este carril no tiene pantalla**. El guard lo invoca
`.github/workflows/ci.yml:232` sobre el TAP que la propia tanda escribe.

**MECANISMO.** Existía y está bien repartido: `scripts/_suelo-de-la-tanda.mjs` es **puro** (entra
el texto del TAP, sale el veredicto) y `scripts/suelo-de-la-tanda.mjs` sólo lee el fichero. Eso es
lo que permite ejercitar el rojo sin correr la tanda dentro de la tanda, y es lo que se ha
reutilizado: no se ha tocado el reparto.

---

## La decisión: la C es posible, y no necesita ningún número

Se pedía medir si el guard puede comparar **contra su propia población**. Se puede, y por una vía
que no había aparecido: **el defecto deja una firma exacta en el mismo TAP que se está
evaluando.**

Medido en laboratorio con dos ficheros, uno de ellos con un `import * as X` cuya propiedad ya no
existe (da `undefined`, no error, así que el `if` que envuelve sus tests deja de cumplirse):

```
con sus 3 tests   →  ok 1 - lab A1 · ok 2 - lab A2 · ok 3..5           # tests 5
fichero mudo      →  ok 1 - lab A1 · ok 2 - lab A2 · ok 3 - b.test.mjs # tests 3
```

`node --test` **emite una entrada con el nombre del fichero** cuando el fichero carga y no
registra nada. Y la emite **en verde**, contando como un test — así que el total baja **menos** de
lo que se ha perdido (3 tests menos, el total sólo baja 2) y el porcentaje de verdes hasta mejora.

> Un test de verdad nunca se llama `algo.test.mjs`. Eso es una **igualdad**, no un umbral, y sale
> del TAP que se juzga: no puede equivocarse por haberse medido sobre otro árbol.

**La A no hace falta como arreglo**, y por eso no se ha hecho: el caso que el total ve y los
ficheros mudos no —un fichero renombrado que deja de casar el patrón, y que desaparece del TAP sin
rastro— sigue cubierto por el suelo, que se queda **como indicio** y con el mensaje corregido.
La B no se propone.

---

## Qué se construyó

**`scripts/_suelo-de-la-tanda.mjs`** — una función pura nueva, `ficherosMudosDelTap()`, y el
veredicto reordenado: **primero lo que es seguro, después lo que es un indicio**. Si hubiera las
dos cosas a la vez y mandara el recuento, el mensaje acusaría al árbol de un defecto que está
localizado y con nombre.

**El mensaje, que era la mitad del encargo.** Decía «LA TANDA HA PERDIDO 9 TEST(S)» cuando no se
había perdido ninguno: un guard puede acertar el veredicto y mentir en el diagnóstico, y quien lo
lee actúa sobre el diagnóstico. Aquí ni siquiera acertaba el veredicto. Ahora:

- el título dice **«ESTÁ N TEST(S) POR DEBAJO DEL SUELO»** — describe lo que sabe, no lo que supone;
- el detalle abre con **«ANTES DE BUSCAR UN TEST PERDIDO, DESCARTA QUE SEA OTRO ÁRBOL»**, con los
  números de la noche y el caso `deeb89a9`, y dice **qué hacer**: mezclar `main` y volver a mirar;
- y deja escrito que no es cosa del sistema operativo, con las dos mediciones.

**`tests/scrum702-suelo-misma-poblacion.test.mjs`** — nueve tests: control positivo y negativo del
detector, que un test que **menciona** un fichero no cuente como fichero mudo, que el mudo mande
sobre el recuento, que **una pérdida real siga cantando**, que el mensaje distinga árbol de
cobertura, y el censo.

---

## El censo de dependencias del entorno

Aparecieron dos sin buscarlas, y dos por accidente casi nunca son dos. Medido el 3-sep-2026 sobre
el **código** (no los comentarios, que hablan de esto a menudo): **11 ficheros** de `tests/` y
`scripts/` leen una señal del entorno.

De los que están en `tests/`, **sólo uno cambia el veredicto según dónde corra**:
`scrum480-fin-de-linea.test.mjs:243` y `:307`, y lo declara y lo razona. Los demás normalizan rutas
por plataforma (`scrum476`, `_reconciliar-censos`) o, en `scripts/`, deciden si imprimir una
anotación de GitHub. `scrum419` la nombra justo para **prohibirla** como gate.

El tope no dice «esto está mal»: dice que **la próxima que entre se vea**. Y sus señales van
escritas **partidas** a propósito, para que el censo no se cace a sí mismo — la alternativa,
excluirse de la lista, dejaría ese fichero fuera de vigilancia para siempre.

---

## Lo que NO se hizo

- **No se tocó `SUELO_TOTAL = 646`** de la tanda gateada: otro carril.
- **No se subió `SUELO_TESTS`.** Subirlo es opcional y aquí habría sido volver a declarar un
  número sobre un árbol que se mueve, que es el defecto.
- **Se tocó UN test, y sólo porque el encargo pedía cambiar el mensaje:**
  `scrum672-un-test-que-desaparece.test.mjs` fijaba el texto viejo en dos líneas
  (`/HA PERDIDO 11 TEST/` y `/HA PERDIDO 1 TEST/`). Es el test **del propio guard** que se
  modifica; no actualizarlo dejaba `main` en rojo. Ninguna de sus comprobaciones se relaja: sigue
  exigiendo que el título diga **cuántos** y el total corrido.
