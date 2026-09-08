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

---

## 🤝 CONSOLIDACIÓN · lo que se absorbe de la rama de S6, con crédito

S6 midió esto en paralelo en `scrum-824b-el-vigia-que-no-deja-pasar` (`ce14d37f`). **Su rama no se
mergea y la razón no es de calidad**, sino de dónde va el arreglo — está abajo. Pero varias de sus
mediciones son mejores que las mías y entran aquí enteras.

### ① La correlación que separa las dos poblaciones — N=200, de S6

```
                                    el test pasa      el test FALLA
    8 primeros del sha TODO DÍGITOS      0                 6
    8 primeros con alguna letra        194                 0
```

**Cero excepciones en las dos casillas que importan.** Mi cuantificación es de 50.000 pasadas y da
mejor la frecuencia (4,51 % → 0 %), pero **la suya es la que demuestra la causalidad**: no dice
sólo «pasa un 3 % de las veces», dice **qué distingue** a las que fallan de las que no. Hacen falta
las dos: la mía mide el tamaño, la suya identifica al culpable.

### ② La refutación de la hipótesis del «Update branch» — 100 CON y 100 SIN, de S6

| | pasadas | fallos |
|---|---|---|
| rama **CON** commit de merge encima | 100 | **6** |
| `origin/main` **limpio**, sin merge | 100 | **6** |

**El mismo número exacto.** Lo que hacía el botón era **tirar el dado otra vez**: cada pulsación
lanza un CI nuevo, y más tiradas es más probabilidad de ver un 1-de-43. La correlación que se
percibió era real; la causa, no.

Mi refutación fue más débil —5 pasadas con merge commit, todas verdes— y la suya la sustituye.

⚠️ Y las dos sesiones tropezamos con la MISMA trampa al montar el experimento: `git merge origin/main`
sobre una rama sin commits propios hace **fast-forward y no crea ningún commit de merge**. El
experimento parecía correcto y no medía nada. Se anota porque volverá a pasar.

### ③ Por qué 527 cayó en `:255` **y** `:291` a la vez — de S6

Cabo que yo no había cerrado: **el reloj no mueve el hueco, aleatoriza el sha**. Las fechas del
fixture son «ahora menos 72/60/48 h», así que el hueco sale constante; lo que cambia en cada pasada
es el sha, que es función del instante. **Dos tests que arrancan en el mismo milisegundo generan el
mismo sha**, así que o caen los dos o no cae ninguno. Observado dos veces en su tirada de 200
(`00578033` y `65762544`, cada uno repetido).

### ④ «8/8 verde sobre `main` no probaba nada» — de S6, y vale un guard

Con una frecuencia de 1-de-43, **ocho pasadas tienen un 83 % de probabilidad de no ver nada**
(`(1 − 1/43)^8 ≈ 0,83`). Mis 10 pasadas en aislamiento —y las 8/8 sobre main limpio— **no eran
evidencia de que no hubiera defecto**: eran el resultado más probable habiéndolo.

Es la frase que justifica por qué la prueba de determinismo de este ticket **no** son diez pasadas,
sino **50.000 comparaciones del mecanismo**.

---

## Por qué se mergea esta rama y no la de S6

No es una comparación de esfuerzo: las dos midieron bien. Es dónde va el arreglo.

* **Regla 41** — un guard en rojo se arregla en el **código**, no en lo que el guard mira. Su
  parche mina el sha **en el fixture** para que nunca salga todo dígitos; éste arregla
  `shaLegible`.
* **Alcance** — quitar la moneda de un fixture la quita de **ese** fixture. Quitarla de
  `shaLegible` la quita de **todos los sitios**, incluido el vigía de verdad corriendo contra
  producción. Y eso cierra el hueco **que su propia entrada declaraba**.
* **El segundo defecto** — el de `--reverse` no aparece en su rama, y es peor que el del sha: un
  CONGELADO saliendo verde por 75 h contra un margen de 6.

### Lo que se descarta de su rama, y por qué

* **El minado del sha en el fixture.** Con este arreglo sobra, y un fixture que evita la entrada
  difícil deja de probar la entrada difícil.
* **Su control ⑤ tal cual.** Afirmaba que un `prod=` de ocho dígitos **no** se puede leer, que era
  cierto con su arreglo y es **falso** con éste. No se tira: **se invierte**. Lo que sí se conserva
  entero, porque estaba bien hecho, es que el renglón **se le pide al formateador de verdad**
  (`constanciaDeEjecucion`) en vez de copiarse a mano.
* **Su mutación M5** (quitarle al vigía el rechazo de todo-dígitos) ya no aplica: ese rechazo no
  existe. La sustituye una que ataca **el criterio nuevo** — hacerle aceptar trece dígitos.

### 🔴 Y esa mutación destapó un hueco en mi propio control

Al mutar el vigía para que aceptara trece dígitos, **el control simétrico seguía verde**: por la
constancia, el reloj nunca llega a `shaLegible` como trece dígitos, porque `corto()` ya lo ha
convertido en `?`. Esa mitad la protegía el **formateador**, no el criterio.

En producción el reloj **sí** llega crudo, por el lado de `/version`, que no pasa por `corto()`. Se
añadió esa pata, y ahora la mutación **sí** lo tumba. Queda escrito porque un control que no vigila
lo que dice vigilar es el defecto que este ticket entero persigue.

---

## 🕳️ Mi hueco declarado: **SIGUE ABIERTO**

Dije que no reproduje el fallo *end-to-end en CI*. Con la rama de S6 delante, **eso no lo cierra**:
sus 200 pasadas son **locales**, igual que las mías. Nadie ha visto el defecto ocurrir dentro de un
runner de GitHub y haber leído allí la causa.

**Lo que sí está cerrado es el mecanismo**, y con eso el hueco deja de importar para el arreglo:
correlación 200/200 sin excepciones, frecuencia medida antes y después, y el `40606975` del informe
explicado exactamente. Lo que queda abierto es la observación directa en CI, y se dice porque
darlo por cerrado de gratis sería lo mismo que el defecto que se acaba de arreglar: firmar un verde
sin haber mirado.
