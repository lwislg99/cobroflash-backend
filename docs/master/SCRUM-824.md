# SCRUM-824b · El rojo intermitente de `scrum716c`: un sha corto que parecía un número

**Fecha:** 08-sep-2026 · **Carril:** instrumento · **Gate:** ninguno — no toca producto

**Medido contra:** `origin/main` = `ac0c71fa9b1270c3b69f50e3b8f0f02fc79771fa` · 2026-09-08T09:59:23+02:00

## El síntoma

`tests/scrum716c-la-memoria-del-vigia.test.mjs` fallaba en CI **de vez en cuando** —`:255` y
`:291`— y sobre `main` limpio daba 8/8. Un rojo intermitente es peor que uno fijo: no manda a
nadie a mirar, **entrena a relanzar la tanda**.

El informe decía: «producción dice `40606975`, un número y no un sha».

## Lo que NO era, dicho antes que lo que sí

Se midió la pista del **commit de merge** («Update branch») que se propuso, y **no reproduce**:

| intento | resultado |
|---|---|
| 10 pasadas en aislamiento | 10 verdes |
| 5 pasadas con un **merge commit real** en HEAD (2 padres) | 5 verdes |
| 8 copias **en paralelo** forzando contención | 8 verdes |

La hipótesis era razonable y era falsa. Se dice porque descartarla es parte del resultado.

**Dónde apareció:** en la **tanda completa**, que es como corre CI. Ahí `:255` cayó, y con el
mensaje entero delante se pudo leer la causa — que no estaba en el test.

## La causa, y explica el `40606975`

`scripts/_ritmo-de-despliegue.mjs`, en `shaLegible`:

```js
if (!ES_SHA.test(s) || TODO_DIGITOS.test(s)) return null;
```

Se rechazaba **todo lo que fuera enteramente dígitos**, para cazar el fallback de `env.ts`
(`RAILWAY_GIT_COMMIT_SHA || String(Date.now())`).

🔴 **`40606975` no era un número: era un sha corto de ocho caracteres que, por casualidad, son
todos dígitos.** El vigía lo descartaba, se quedaba sin lectura anterior, y contestaba
`NO_SE_SABE` — exit 2 — donde el test esperaba 0.

**El precio estaba DECLARADO en el propio comentario** —«un sha abreviado todo dígitos también se
rechaza… en torno al 2 %… se acepta porque el error va en la dirección segura»—. La dirección era
segura para el veredicto de producción. Lo que no se vio es que en CI ese 2 % **es un rojo
intermitente**.

### Cuantificado, no estimado

| | pares de shas cortos que salen `NO_SE_SABE` |
|---|---|
| **antes** | **2.255 de 50.000 → 4,51 %** ≈ 1 de cada 22 |
| **después** | **0 de 50.000 → 0,000 %** |

Es 4,5 % y no 2,3 % porque basta con que **cualquiera de las dos** lecturas sea todo dígitos.

## El arreglo — en el código del vigía (regla 41)

Se distingue por **LONGITUD**, no por «ser dígitos»:

```js
const LONGITUDES_DE_RELOJ = new Set([10, 13]);   // epoch en segundos y en milisegundos
if (TODO_DIGITOS.test(s) && LONGITUDES_DE_RELOJ.has(s.length)) return null;
```

`String(Date.now())` son **13** caracteres. Un sha en este sistema es **8** (la constancia hace
`.slice(0, 8)`) o **40** (`/version`). Son formas que no se solapan.

🔴 **La seguridad no se pierde, y es la condición del arreglo:** ante un reloj se sigue callando —
dos relojes distintos seguirían dando `NO_SE_SABE`, que es lo que impide que el vigía firme un
verde sin saber qué corre. Lo que se deja de hacer es callar ante un **commit**.

⛔ No se ha relajado nada de lo que el vigía exige, no se espera y no se reintenta.

## Un SEGUNDO defecto, encontrado siguiendo la pista y arreglado también

`scripts/vigilante-de-despliegue.mjs` sacaba «desde cuándo estamos parados» así:

```js
git log --format=%ct --reverse <prod>..<main>   →   y cogía la PRIMERA línea
```

dando por hecho que invertir el listado deja arriba el más antiguo. **`--reverse` invierte el
orden de recorrido del GRAFO, no ordena por fecha**, y el recorrido está obligado a emitir un hijo
antes que su padre. Con un padre de fecha más nueva que su hijo —rebase, cherry-pick, `--amend`,
relojes desfasados— al invertir sube el padre.

**Medido en un repo construido a propósito: 75 horas de diferencia.** Y ese epoch **es** el
veredicto: se compara contra un margen de 6 h, así que 75 de menos convierten un CONGELADO en «aún
dentro del margen». Un vigía que se equivoca así no falla ruidosamente: **firma un verde**.

Arreglado con `Math.min` sobre los `%ct` del rango, que no depende de la topología.

## Verificación

* **Los dos arreglos, probados EN ROJO con el código de antes**, y cada uno tumba **sólo su**
  control: el del sha tumba el caso del sha y deja verde el de la seguridad; el del orden tumba el
  suyo.
* **Determinismo**, `node --test --test-reporter=tap tests/scrum716c-…` — **10 pasadas, 10 verdes,
  `8 ok` y `# skipped 0`** cada una.
* Y la prueba que de verdad cierra el ticket, porque diez pasadas en aislamiento nunca vieron el
  fallo: **50.000 comparaciones del mecanismo, 0 ceguera** (antes: 2.255).

⚠️ **Lo que esto no promete:** no se pudo reproducir el fallo *end-to-end* en CI, sólo en la tanda
completa local. Lo que sí está medido es el mecanismo, su frecuencia antes y después, y que el
caso del informe (`40606975`) es exactamente este defecto.
