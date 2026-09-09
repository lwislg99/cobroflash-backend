# SCRUM-824 · El vigía que no deja pasar

**Fecha:** 8-sep-2026 · **Rama:** `scrum-824b-el-vigia-que-no-deja-pasar`

**Medido contra:** `origin/main` = `f0ec26e86a04a21e9e60b748b4c7c5c2c83bace9` · 2026-09-08T09:11:55+01:00

> ⚠️ Es el `merge-base` real de esta rama, no el `origin/main` del momento de escribir: mientras se
> trabajaba esto, `main` ya iba por `ac0c71fa`. Se ancla contra lo que se midió.

---

## 🔴 EL SÍNTOMA, Y POR QUÉ COSTÓ DOS SESIONES

`tests/scrum716c-la-memoria-del-vigia.test.mjs` fallaba en CI **de forma intermitente** y bloqueó
tres ramas: **626** (`:255`), **527** (`:255` y `:291`) y **632b** (`:291`, y su re-run salió
verde). Dos sesiones no lo reprodujeron: worktree limpio sobre `origin/main`, fichero suelto, tanda
entera — **8/8 verde siempre**.

Y ahí está la trampa. Con un fallo de **1 de cada 43**, ocho pasadas verdes no son evidencia de
nada: la probabilidad de no verlo en ocho intentos es del **83 %**. Las dos sesiones anteriores
midieron bien y concluyeron mal, porque *N* era demasiado pequeño para la moneda que estaban
tirando. **El tamaño de la muestra era el problema, no la agudeza de nadie.**

## ✅ LA CAUSA, con N=200 y correlación perfecta

```
                                    el test pasa      el test FALLA
    8 primeros del sha TODO DÍGITOS      0                 6
    8 primeros con alguna letra        194                 0
```

Cero excepciones en las dos casillas que importan. La cadena, eslabón a eslabón:

1. El fixture crea **commits vacíos fechados a partir de `Date.now()`**, así que su sha es distinto
   en cada pasada.
2. `constanciaDeEjecucion` escribe en el historial `prod=` con los **ocho primeros**
   (`corto()`, `scripts/_vigilante-de-despliegue.mjs:240`).
3. `shaLegible` (`scripts/_ritmo-de-despliegue.mjs:76`) **rechaza a propósito lo que sea todo
   dígitos**: sin `RAILWAY_GIT_COMMIT_SHA`, producción publica `String(Date.now())` y trece dígitos
   son hexadecimal válido.

`(10/16)^8 = 2,3 %`. Medido: **6/200 = 3,0 %**.

### 🔴 El vigía no se equivoca ni una vez

Hace exactamente lo que dice que hace, y **el precio está declarado por escrito en su propio
módulo** desde antes de este ticket:

> *«un sha abreviado que salga todo dígitos también se rechaza. Con 8 caracteres eso pasa en torno
> al 2 % de las veces ((10/16)^8) … Se acepta a propósito porque el error va en la dirección
> segura: callar de más, nunca inventar un movimiento que no se ha medido.»*

Quien asumía era **el fixture**, que daba por hecho que un sha de git siempre se puede leer.

## ⚠️ LAS DOS HIPÓTESIS QUE SE CAYERON, medidas y no descartadas de palabra

**① El botón «Update branch» de GitHub.** Era la hipótesis viva, y era razonable: el fundador vio
la correlación con sus propios ojos. No se sostiene:

| | pasadas | fallos |
|---|---|---|
| rama **CON** commit de merge de `main` encima | 100 | **6** |
| `origin/main` **limpio**, sin merge | 100 | **6** |

El mismo número exacto. Lo que hacía el botón era **tirar el dado otra vez**: cada pulsación lanza
un CI nuevo, y más tiradas es más probabilidad de ver un 1-de-43. La correlación que se percibió
era real; la causa, no.

⚠️ Y el primer intento de medirlo **no medía nada**: `git checkout -b prueba origin/main~5 && git
merge origin/main` hace **fast-forward** y no crea ningún commit de merge. Hubo que darle a la rama
un commit propio primero. Se anota porque el experimento parecía correcto y no lo era.

**② El nombre de la rama por defecto de `git init`.** Aquí es `master` —con mi configuración y con
`HOME` vacío, comprobado—, pero el fixture crea `refs/remotes/origin/main` **a mano** con
`update-ref` y el vigía sólo hace `git rev-parse origin/main`. El nombre local nunca entra.

## 🔴 EL RELOJ SÍ ENTRABA — pero no por donde se miró

La pregunta era si los huecos de «48.0 h» y «60.0 h» se calculan contra `now`. **Se calculan, y por
eso NO dependen del reloj:** las fechas son «ahora menos 72/60/48 h», así que el hueco sale
constante. Medido:

```
base 2020-01-01T00:00:00Z → hueco 72.0 h
base 2026-09-08T03:00:00Z → hueco 72.0 h
base (ahora)              → hueco 72.0 h
```

Donde el reloj sí entra es en el **sha**, y es función pura de él:

```
misma base de tiempo, dos repos distintos → 8c1d9da1589e5abd7954a75d9e1b5ac737359faa
                                          → 8c1d9da1589e5abd7954a75d9e1b5ac737359faa   IDÉNTICOS
```

Ése es el acoplamiento que nadie tenía: **el reloj no mueve el hueco, aleatoriza el sha.** Y explica
el último detalle suelto — por qué 527 falló en `:255` **y** `:291` a la vez: dos tests que arrancan
en el mismo milisegundo generan **el mismo sha**, así que o caen los dos o no cae ninguno. Se
observó dos veces en la tirada de 200 (`00578033` y `65762544`, cada uno repetido).

## ✅ EL ARREGLO

El fixture **mina** el commit: si los ocho primeros salen todo dígitos, lo repite con la fecha
corrida **un segundo** hasta que salga legible. Un segundo no mueve un hueco de 48 h ni en la
primera decimal, y el reintento **amenda** en vez de añadir, para que `commits=` siga siendo el que
los casos esperan. El tope de reintentos **peta** en vez de devolver el malo en silencio.

### Lo que NO se ha hecho, punto por punto

- ⛔ **No se toca el vigía.** Ha acertado las tres veces.
- ⛔ **Ningún caso baja a `skip`.** El fichero pasa de 8 a 13 tests, `skipped 0`.
- ⛔ **El margen de 6 h y el veredicto `NO_SE_SABE` siguen intactos.**
- ⛔ **El rechazo de los todo-dígitos NO se anula.** Tiene su propio control, el ⑤.

### ✅ EL NEGATIVO, que es lo que impide que esto sea un apagado

> ⚠️ **El ⑤ que describe este apartado se RETIRÓ** en SCRUM-824b, con su motivo y su sucesor:
> ver «🗃️ RETIRADA» al final de este fichero.

`SCRUM-824 · ⑤` siembra en el historial una constancia con `prod=` de ocho dígitos —**pedida al
formateador de verdad, no copiada a mano**— y exige que el vigía **siga contestando NO SE SABE, exit
2, diciendo por qué**. Eso no es el defecto: es su trabajo. Lo que se ha quitado es que el fixture
lo pisara por azar; ahora está **fijado** en vez de ocurrir por sorpresa una vez de cada 43.

## Verificación

**Cinco mutaciones, cada una comprobada PRESENTE EN EL FICHERO con su huella antes de correr:**

| | mutación | cae |
|---|---|---|
| M1 | el detector nunca ve un prefijo ilegible | ① ② ③ |
| M2 | el detector ve todo como ilegible | ① ② ④ ⑤ y los dos controles de 716c |
| M3 | el minero reintenta sin mover la fecha | ② |
| M4 | al agotar el tope devuelve el sha ilegible | ③ |
| M5 | **al vigía** se le quita el rechazo de los todo-dígitos | ① ⑤ |

> ⚠️ **M1-M4 mutaban el minero, que se RETIRÓ** en SCRUM-824b (ver «🗃️ RETIRADA» al final).
> **M5 sigue viva**, y es la que se usa allí para probar en rojo al sucesor del ⑤.

M5 es la que importa para no engañarse: prueba que el negativo ⑤ vigila **la regla del vigía**, no
una copia suya.

**Y el antes/después, con el mismo comando y el mismo fichero:**

```
SIN el arreglo · rama con commit de merge · 100 pasadas → 6 fallos
SIN el arreglo · origin/main limpio       · 100 pasadas → 6 fallos
CON el arreglo · origin/main limpio       · 100 pasadas → 0 fallos
```

## 🕳️ Hueco declarado

El minero elimina el 1-de-43 **de este fixture**, no la propiedad general: cualquier otro sitio que
guarde un sha abreviado y lo relea con `shaLegible` tiene la misma moneda encima. No se ha barrido
el repo buscándolos —queda fuera de este encargo— y se dice en vez de dejarlo implícito.

---

# 📎 APÉNDICE · SCRUM-824b

> Segundo ticket sobre el MISMO defecto, trabajado en paralelo por la sesión S5. Se añade como
> apéndice y no se fusiona con lo de arriba: son dos lecturas independientes del mismo rojo, y
> mezclarlas borraría cuál midió qué. La entrada de arriba es la de la rama que entró por PR #1192;
> ésta es la de la rama que la sucede, y la que retira dos de sus piezas — con constancia al final.

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

> Escrito ANTES del merge de PR #1192. Se revisa al final del fichero, ya con la rama de S6 en
> `main` y medida de primera mano; el veredicto no cambia.

Dije que no reproduje el fallo *end-to-end en CI*. Con la rama de S6 delante, **eso no lo cierra**:
sus 200 pasadas son **locales**, igual que las mías. Nadie ha visto el defecto ocurrir dentro de un
runner de GitHub y haber leído allí la causa.

**Lo que sí está cerrado es el mecanismo**, y con eso el hueco deja de importar para el arreglo:
correlación 200/200 sin excepciones, frecuencia medida antes y después, y el `40606975` del informe
explicado exactamente. Lo que queda abierto es la observación directa en CI, y se dice porque
darlo por cerrado de gratis sería lo mismo que el defecto que se acaba de arreglar: firmar un verde
sin haber mirado.

---

# 🗃️ RETIRADA · el ⑤ y el minado del fixture

> Escrito tras el merge de **PR #1192** (`f1c84a8a`), que metió en `main` la rama de S6. Esta rama
> parte ahora de ahí, así que las dos piezas retiradas **estaban en `main`** cuando se retiraron.
> Un test no se relaja para que pase: o mide algo cierto, o se retira con su motivo escrito.

## Qué se retira, y qué medía

| pieza | dónde estaba | qué medía |
|---|---|---|
| `SCRUM-824 · ⑤` | `tests/scrum716c-…:554` | con una lectura anterior **de verdad ilegible**, el vigía sigue diciendo NO SE SABE, exit 2, y dice por qué |
| `SCRUM-824 · ①②③④` | `tests/scrum716c-…:486-553` | que el detector del fixture cuadraba con el vigía, y que el minero reintentaba, petaba y no minaba de más |
| `prefijoIlegible()` + `commitHastaShaLegible()` | `tests/scrum716c-…:247-272` | el minado: comitar en bucle hasta que los ocho primeros del sha no fueran todo dígitos |

## Por qué deja de ser cierto

**El ⑤ preguntaba lo correcto, y por el camino correcto.** Lo que se quedó sin valer es *con qué* lo
preguntaba: sembraba `12345678…` como ejemplo de «ilegible». Desde SCRUM-824b **ese sha se lee** —es
un commit, no un reloj—, así que el ⑤ ya no entra por la rama que dice vigilar. No fallaba por ser
exigente: fallaba porque su caso de prueba había dejado de ser el caso. Un control así no se relaja
para que pase, y tampoco se deja: **mide otra cosa, y en verde**.

**El minado existía por algo real y bien medido**, y ese diagnóstico es lo que permitió llegar al
defecto: `repoDePrueba()` produce un sha de ocho dígitos una vez de cada 43, el vigía lo rechazaba, y
`scrum716c` salía rojo en un ~2,3 % de las pasadas sin que nadie hubiera tocado nada. Deja de hacer
falta porque **lo que se arregló fue el vigía, no el fixture**. Con el criterio por longitud, minar
sería esquivar un caso que el vigía ya atiende — y peor: el fixture evitaría justo la única entrada
que prueba el arreglo.

**Medido, no supuesto** — un sha de ocho dígitos, minado *para encontrarlo* y pasado por el CLI real:

```
sha de producción minado : 63009815  (26 vueltas para dar con él)
renglón sembrado         : vigía · … · atrasado · prod=63009815 · main=bc8868f3 · hueco=48.0h
código de salida         : 0  ← MIDIÓ
dice «no publica un sha legible»?: NO
```

## El sucesor, y el suelo que lo tuvo que rescatar

`tests/scrum716c-…` · **`SCRUM-824b · 🔴 EL NEGATIVO: si la lectura anterior no publica un sha
legible, el vigía SIGUE diciendo NO SE SABE`** — la misma pregunta del ⑤, el mismo camino (CLI real,
código de salida y motivo), con un fixture vivo. Vive en `scrum716c` y no en el fichero del ticket
porque ahí está el arnés del CLI: una segunda copia de `corre()` sería otra cosa que puede derivar.

🔴 **Y el primer intento estuvo mal.** Sembré `prod=?` dando por hecho que «ilegible es ilegible».
Salía **exit 2, o sea verde** — pero por la rama de *«no hay lectura anterior»*, que es otra. Habría
sustituido al ⑤ sin cubrir nada de lo que el ⑤ cubría. Lo que hay que sembrar se midió:

| `prod=` sembrado | ¿parsea? | rama a la que llega |
|---|---|---|
| `1788742571305` | sí | **«la lectura anterior no publica un sha legible»** ← la del ⑤ |
| `1788742571` | sí | la misma (epoch en segundos) |
| `40606975` | sí | «despliega» — ya se lee: es el arreglo de 824b |
| `?` | **no** | «no hay lectura anterior» ← otra rama |

Se sustituye **sólo el campo `prod=`** sobre un renglón pedido al formateador de verdad. `corto()` hoy
escribe `?` ante un reloj, así que este vigía no produce ya un renglón así; pero el fichero de
constancias es una **caché que sobrevive al código que la escribió**, y una línea que esta versión no
escribiría puede llegarle igual. Para eso existe el suelo. El sucesor lleva dos: que el reloj quede
en `prod=`, y que el renglón **parsee como lectura** — el segundo es el que cazó el error de arriba.

**Probado en rojo**, no supuesto: quitándole al vigía el rechazo del reloj (la mutación M5 de la
entrada de arriba), el sucesor **cae**, junto con dos controles de `scrum824b-el-sha-que-parecía-un-número`.

## Lo que la entrada de arriba dice y ya no rige

No se borra nada —es el registro de su PR—, pero dos pasajes describen piezas que ya no existen:
su **«✅ EL NEGATIVO»** (el ⑤) y las filas **M1-M4** de su tabla de mutaciones, que mutaban el minero.
**M5 sigue viva y es la que importa**: es la que prueba que el negativo vigila la regla del vigía y
no una copia suya, y es la que se ha usado para probar en rojo al sucesor.

## 🕳️ Mi hueco declarado, revisado DESPUÉS del merge: **SIGUE ABIERTO**

Dije que no reproduje el fallo *end-to-end dentro de un runner de CI*. Con la rama de S6 ya en
`main` y medida de primera mano, **eso no lo cierra**: sus 200 pasadas son locales, igual que las
mías. Nadie ha visto el defecto ocurrir dentro de un runner de GitHub y haber leído allí la causa.

⚠️ Y el merge lo deja **más difícil de cerrar, no menos**: mientras el minado estuvo en `main`, el
fixture evitaba el único caso que lo dispara, así que CI no podía enseñarlo aunque se le pidiera. Al
retirarlo, el caso vuelve a entrar — y ahora tiene que salir verde, que es lo que se ha medido.

Lo que sí está cerrado es **el mecanismo**: correlación 200/200 sin excepciones, frecuencia medida
antes y después, el `40606975` del informe explicado exactamente, y diez pasadas limpias tras el
merge. Lo que queda abierto es la observación directa en CI, y se dice porque darlo por cerrado de
gratis sería lo mismo que el defecto que se acaba de arreglar: firmar un verde sin haber mirado.

---

# 🕐 UN CASO, UNA HORA · el ancla que era una foto del reloj de mi máquina

`tests/scrum824b-el-mas-antiguo-no-es-el-primero.test.mjs:105` caía en CI con una diferencia de
**exactamente 3600 s**. No era lógica: era huso.

## La causa, medida — tres hipótesis daban 3600, y sólo una es

El fixture creaba los commits con fechas **sin huso** (`'2026-09-02T09:00:00'`), y git las interpreta
en la hora **local** de quien corre el test. Mismo comando, mismo repo:

```
git SIN huso · TZ=UTC                → 1788339600
git SIN huso · huso del sistema      → 1788336000     ← 3600 exactos
git SIN huso · TZ=EST5EDT            → 1788354000
git CON Z    · en todos              → 1788339600
```

**No era el cambio de horario** (septiembre no tiene transición) **ni Europe/Madrid**: el
`1788336000` que yo había escrito a mano es `2026-09-02T08:00:00Z`, o sea la lectura de la máquina
donde se escribió — **Europe/London, +1 en septiembre** — y CI corre en UTC.

Reproducido sobre los bytes exactos del fichero anterior:

```
fichero VIEJO · huso del sistema → pass 2 · fail 0
fichero VIEJO · TZ=UTC           → pass 1 · fail 1   (expected: 1788336000)
```

## El arreglo — en el FIXTURE, que es de donde salía el número

Las tres fechas pasan a una constante `FECHAS` **con huso explícito** (`…Z`), y **el epoch se
deriva de ellas** con `epochDe()` en vez de escribirse. Lo que el caso afirma ahora es lo que de
verdad quiere afirmar: **que git grabó las fechas que el escenario declaró**. Un timestamp absoluto
en un test es una referencia que caduca, igual que referenciar por posición.

⛔ El vigía no se ha tocado: el defecto no estaba ahí.

## El trinquete, con su suelo

`SCRUM-824b · 🔴 TRINQUETE: las fechas del escenario declaran su huso, no lo heredan` — exige que
cada fecha de `FECHAS` traiga huso, y **comprueba que la comprobación sabe decir que no**
(`doesNotMatch` sobre una fecha sin huso): sin ese suelo, una expresión regular mal escrita
aprobaría cualquier cosa y el trinquete sería un adorno. Y afirma la forma del escenario desde las
fechas —el hijo más antiguo que el padre—, que es lo que hace discrepar a `--reverse` y al mínimo.

## El control, y lo que NO se pudo correr

|  | resultado |
|---|---|
| `TZ=UTC` (offset 0) | 3 pass · 0 fail · 0 skipped |
| huso del sistema, `Europe/London` (+1) | 3 pass · 0 fail · 0 skipped |
| `TZ=EST5EDT` (−4) | 3 pass · 0 fail · 0 skipped |
| `TZ=Europe/Madrid` | 3 pass · 0 fail · 0 skipped — **pero no cuenta**, ver abajo |

🔴 **`TZ=Europe/Madrid` NO TOMA EFECTO en esta máquina.** Ni node ni git resuelven ahí los nombres
IANA: los dos caen al huso del sistema (`Europe/London`). Medido, no supuesto — con `TZ=Europe/Madrid`
git devuelve `1788336000`, que es el valor de +1 y no el de +2 que Madrid tendría en septiembre.
Se dice en vez de pegar una salida verde que parecería lo que no es. El par que sí cubre lo que
importa es **UTC vs +1**, que es exactamente el que rompió CI, y `EST5EDT` añade un tercero en −4.

## 🔎 HALLAZGO DE OTRO CARRIL · `scrum804-la-rama-viva` tiene la MISMA enfermedad

Encontrado al correr la tanda completa de este ticket. **No se arregla aquí** (regla 9: hallazgo de
otro carril se reporta), pero se deja escrito porque es literalmente el mismo defecto que este
ticket acaba de corregir, en otro sitio y con otra cara.

`tests/scrum804-la-rama-viva.test.mjs:39` lleva una lista fija:

```js
const LOS_CUATRO = [819, 816, 820, 821];
```

y afirma de ella que «estos cuatro tienen rama en el remoto con su número». **Ya no es verdad**:
medido con `git ls-remote --heads origin`, no queda ninguna rama `scrum-821-*` — se mergeó y se
borró. Caen tres casos:

```
✖ CONTROL POSITIVO ENUMERADO: ve a los cuatro que pararon   → SIN RASTRO: SCRUM-821
✖ EL ÁRBITRO: cada clase coincide con `merge-base`          → «sólo 4 ramas que interrogar»
✖ CONTROL NEGATIVO: una rama mergeada no es trabajo pendiente → «sólo 10 tickets», esperaba más
```

Los tres son **suelos**, y por eso fallan bien: se niegan a medir sobre una población que ha
encogido, en vez de dar un verde vacío. El problema no es el suelo: es que el sujeto —la lista de
tickets— es una **foto de un remoto que se mueve**, igual que mi `1788336000` era una foto de un
reloj. Un ticket propio tendría que decidir si la lista se deriva del remoto o se congela con su
sha, como se hizo en SCRUM-821c con `_foto-antes-de-821.mjs`.

⚠️ **No es de esta rama**: lo único que toca este commit es
`tests/scrum824b-el-mas-antiguo-no-es-el-primero.test.mjs`. En la tanda completa de hace una hora,
sobre este mismo árbol, los tres estaban en verde; lo que cambió entre medias fue el remoto.
