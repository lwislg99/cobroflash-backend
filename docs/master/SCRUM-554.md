# SCRUM-554 · Dos copias del medidor accname — medido al desbloquearse, y la deuda ya no era la que se declaró

**Fecha:** 16-sep-2026 · **Carril:** B · instrumentos de navegador · **Gate:** medición · **se propone NO unificar**

**Medido contra:** `origin/main` = `026677a1bd8260ce073648680a8eb7d7003f4b39` · 2026-09-16T04:07:51Z
**Rama:** `scrum-554-dos-copias-del-medidor`
**Preámbulo (A1):** `prisma generate` rc=0 · `git rev-list --count HEAD..origin/main` = **0** al ramificar.

> **Obligación 0:** sin rama remota, sin commit en `main`, sin expediente → causa **(a)**.
> **Desbloqueo comprobado, que era la condición del ticket:** *«se desbloquea cuando SCRUM-543 esté
> en main. Antes, no.»* — `scripts/guard-a11y-landing.mjs` y `tests/scrum543-landing-a11y.test.mjs`
> **están en `main`**. Desbloqueado.

---

## 1 · 🔴 LA DEUDA NO ES LA QUE EL TICKET DECLARÓ

El ticket dice que el medidor está **«copiado tal cual»** y que los dos son **«literalmente el
mismo código»**. Medido con `diff` real y comparación función a función por AST:

| | |
|---|---|
| líneas que difieren | **345 de 535** |
| funciones con el mismo nombre en los dos | 4 |
| **idénticas** | **2** — y las dos son de **una línea** (`caja`, `log`) |
| **divergidas** | **2** — `loQueSeOye` (11 vs 7 líneas) y `calibrar` (12 vs 16) |

**No son copias. Divergieron.** Y no en detalles:

### `loQueSeOye` — distinta FIRMA, distinto objeto

```js
// comparativa: direcciona por ÍNDICE dentro de una colección fija
async function loQueSeOye(page, indiceCelda) { … document.querySelectorAll('.cmp-cell')[i] … }

// landing: direcciona por SELECTOR CSS arbitrario
async function loQueSeOye(page, sel) { … document.querySelector(s) … }
```

Eso **es «lo que cada guard vigila»**, que el propio ticket manda no tocar (punto 2).

### `calibrar` — y aquí el ticket pide un control que no existe

El ticket propone como control: *«la calibración (`<span display:block>uno</span>dos` → `uno dos`)
sigue pasando en los dos»*. **Medido: no es la misma calibración.**

| | qué calibra |
|---|---|
| **comparativa** | UN caso: `<span style="display:block">uno</span>dos` → espera `'uno dos'` |
| **landing** | **DOS** casos: que inserta el espacio **y que NO lo inserta donde no lo hay** (`'unodos'`) |

**La de landing es estrictamente más fuerte.** Unificarlas cambiaría lo que cada guard garantiza
— y eso no es deuda, es su objeto.

---

## 2 · El arranque de Edge YA está unificado (y más allá del ticket)

El punto 2 del alcance daba por hecho que también estaba duplicado. **No lo está:** los dos llaman
a `lanzarNavegador(puppeteer, { headless: 'new' })`, que vive en **`scripts/_navegador.mjs:376`**
y lo usan **más de diez** guards, no dos. Alguien lo resolvió antes y a mayor escala.

**Queda un punto del alcance sin nada que hacer.**

---

## 3 · 🔴 LO INTENTÉ, Y UNIFICAR ROMPE EL GUARD

No me quedé en la lectura. Extraje el núcleo común —las cuatro líneas del truco del
`role="button"` temporal— a `_navegador.mjs` como `accnameDeNodo(page, nodo)`, recibiendo el nodo
**ya localizado** para que cada guard conservara su localización y sus mensajes.

**Ejecutado el guard de comparativa con el cambio puesto:**

```
🔴 NO SUPE MIRAR a 1280px: el detector rechaza algo que SÍ está en la celda.
🔴 NO SUPE MIRAR a 360px:  el detector rechaza algo que SÍ está en la celda.
🔴 2 problema(s).
```

**Y comprobé que el rojo era mío**, no preexistente: restaurado el fichero original, el mismo
guard vuelve a `✓ En los dos anchos, cada celda llega con su etiqueta de columna asociada`.

**Segundo intento:** la diferencia visible era `nodo.evaluate(fn)` frente a `page.evaluate(fn, nodo)`.
Probada la segunda forma —la que reproduce lo que los guards hacían—: **sigue rompiendo**.

> ⚠️ **No diagnostiqué la causa raíz y lo digo en vez de insinuar que la sé.** Sé que rompe, sé
> que es mío y sé que dos formas distintas de poner el rol no lo arreglan. Por qué exactamente
> —si es el momento en que se crea el handle, el aislamiento del contexto o algo del snapshot—
> exige una tanda con el navegador en la mano, y no la he hecho.

**Revertido byte a byte:** `git status` de `scripts/` **vacío**, y los dos guards en verde.

---

## 4 · La propuesta: NO unificar, como en SCRUM-546

El ticket cita el precedente y dice que *«la forma de decidirlo es la misma: medir antes»*. Medido:

1. el **arranque** ya está compartido — no hay nada que unificar;
2. el **medidor** ya divergió en la firma, que es el objeto de cada guard;
3. la **calibración** también, y la de landing es **más fuerte**;
4. y extraer el núcleo común **rompe** uno de los dos.

**Se quedan los dos.** Lo que se gana unificando son ~4 líneas; lo que se pierde, medido, es un
guard que funciona. **Un módulo común que hay que domar para que los dos sigan midiendo lo mismo
cuesta más que las cuatro líneas que ahorra.**

> 🔒 Y el conocimiento que el ticket quería proteger —la trampa del `role="button"` temporal, que
> costó «dos horas y dos trampas medidas»— **no se pierde por estar dos veces: se pierde si no
> está escrito**. Queda escrito aquí, en §6.

---

## 5 · El coste (punto 4 del alcance), parcial y declarado

`npm run censo:guards-navegador` ejecuta cada guard uno a uno. Los primeros, medidos hoy:

```
guard:contraste              31.6 s   verde
guard:caja-avisos            49.3 s   verde
guard:caja-semaforo          17.3 s   verde
guard:caja-documento-suelto  28.9 s   rojo(143)
```

⚠️ **No lo dejé terminar**, así que **no doy el total** — y ese total es el número que pedía
también SCRUM-522. Lo que sí se puede afirmar: **compartir el arranque no ahorraría nada aquí,
porque ya está compartido** desde `lanzarNavegador`, y aun así cada guard arranca su propio
navegador. El ahorro tendría que venir de **reutilizar el navegador entre guards**, que es otro
ticket y otro riesgo (aislamiento entre medidas).

> 📌 **Y un hallazgo de rebote, que se reporta y no se arregla** (regla 9):
> `guard:caja-documento-suelto` sale **rojo(143)** hoy. No es de este ticket y no lo he tocado.

---

## 6 · El conocimiento que se estaba duplicando, escrito una vez

`accessibility.snapshot()` sólo calcula el nombre accesible de un nodo **cuyo rol lo admita**.
Sobre un `<div>` pelado devuelve un árbol sin `name`, y ese vacío **se lee igual que «no tiene
nombre»** — un cero de medidor roto disfrazado de medida. Por eso los dos guards ponen
`role="button"`, miden, y lo quitan.

Y por eso los dos tienen **suelo**: si el medidor devuelve vacío dicen **NO SUPE MIRAR** en vez de
dar verde. Ese suelo es el que se disparó en §3 — hizo exactamente su trabajo.

---

## 7 · Lo NO tocado

Ni una línea de `scripts/` ni de `tests/`: `git status` de `scripts/` vacío tras revertir.
No se unificó nada · no se tocó lo que cada guard vigila · no se relajó ningún suelo · ninguna
dependencia nueva · `prisma/schema.prisma`, el camino de emisión y el copy, intactos.

---

# APÉNDICE · EL `rojo(143)` DEL §5 NO EXISTÍA, Y LO PUSE YO

**Fecha:** 16-sep-2026 · **Carril:** B · instrumentos · **Gate:** medición + arreglo del instrumento
**Medido contra:** `origin/main` = `1be773a3e6d929d2f033ae94bc1654855a68731a` · 2026-09-16T07:52:06Z
**Rama:** `scrum-554-el-143-que-nadie-eligio`

> **Obligación 0:** sin rama remota, sin commit suyo en `main`, sin expediente propio → causa **(a)**,
> nunca empujada. Se entrega como APÉNDICE de este mismo fichero porque corrige una frase de él.
>
> ⚠️ `origin/main` se movió **dos veces** durante la tanda (`8dac4cd5` → `1331d5d4` → `1be773a3`;
> otra sesión empujando, y el ref es compartido por los worktrees). Se mergeó y se volvió a medir
> contra el de arriba. Ninguno de esos 12 commits toca los ficheros de este apéndice.

El §5 de arriba dice, en letra grande y marcado como hallazgo:

> 📌 **Y un hallazgo de rebote, que se reporta y no se arregla** (regla 9):
> `guard:caja-documento-suelto` sale **rojo(143)** hoy.

**Es falso. No hay ningún rojo. El 143 lo puse yo, y el §5 se queda escrito con esta corrección
pegada al lado en vez de borrarse**, que es como se corrige aquí.

---

## ③ PRIMERO EL NÚMERO: ¿ES UN CÓDIGO QUE EL GUARD ELIGE, O UNO QUE LE IMPONEN?

Se empieza por aquí porque es lo que decide todo lo demás. Derivado del fichero, no de la memoria —
`scripts/guard-caja-documento-suelto.mjs`, 251 líneas, **sus únicas salidas**:

| línea | código | qué significa |
|---|---|---|
| `:135` | `process.exit(2)` | NO SUPE MIRAR (su suelo) |
| `:248` | `process.exit(1)` | hallazgo |

Y **la cadena `143` no aparece en ninguna de sus 251 líneas.** Ese guard no sabe decir 143.
Es un número que le pusieron desde fuera: 143 = 128 + 15, la convención de «terminado por la
señal 15». No era su veredicto — era su acta de defunción.

## ② ¿TIENE RAZÓN? NO. Y EL ROJO ERA MÍO

Corrido **solo y sin nada que lo envuelva**:

```
$ node scripts/guard-caja-documento-suelto.mjs
…
Todos los rótulos caben en su caja, en los dos modos y en los dos anchos.
rc=0     (05:31:45 → 05:31:52, unos 7 s)
```

**Verde.** No hay defecto vivo que nombrar, y por tanto no hay nada que parar.

**De dónde salió el 143, con la aritmética delante.** La tanda del §5 la lancé yo con un
`timeout 120` alrededor del censo **entero**. Los tres primeros guards consumieron
31,6 + 49,3 + 17,3 = **98,2 s**. Al cuarto le quedaban **21,8 s** de los 120. El censo anotó
28,9 s y estado 143: el `timeout` venció mientras ese guard medía y se lo llevó por delante.

> 🔴 **El instrumento que fabricó el falso rojo fui yo**, y el censo lo etiquetó como si fuera del
> guard. Las dos mitades cuentan: sin mi `timeout` no hay muerte, y sin la ceguera del censo la
> muerte no se disfraza de defecto.

## ① ¿DESDE CUÁNDO, Y BLOQUEA EL MERGE?

**¿Desde cuándo?** La pregunta tal y como venía —«¿desde cuándo está rojo?»— **no tiene respuesta,
porque nunca lo estuvo**. Lo que sí es derivable del árbol es desde cuándo el censo no sabe
distinguir un veredicto de una ejecución: desde el commit que lo creó.

```
$ git log --diff-filter=A --format='%h %ad %s' --date=short -- scripts/censo-guards-navegador.mjs
6bd8e017 2026-08-20 feat(SCRUM-546): … y el censo que faltaba
$ git log -L '/const estado = r.error/,+1:scripts/censo-guards-navegador.mjs'
6bd8e017 2026-08-20   ← única aparición: la línea NO se ha tocado desde que nació
```

**27 días ciego**, y nació así: no es una regresión, es el diseño original.

**¿Bloquea el merge?** **SÍ**, y esto corrige de paso lo que yo mismo daba por sabido («los guards
de navegador están fuera de `npm test`, así que no bloquean»). Está a medias:

| vía | ¿lo corre? | ¿bloquea? |
|---|---|---|
| `npm test` | **no** — `node --test tests/*.test.mjs`, y este guard no es un test | no |
| `ci.yml` · paso «Guards de navegador» → `npm run guards:visuales` | **sí** | **SÍ** |

Medido, no supuesto: `fueraDeLaTanda()` deriva la lista de `package.json` y devuelve **18** guards,
`guard:caja-documento-suelto` entre ellos. O sea que **si ese guard se pone rojo de verdad, el PR
no entra.** La deuda de SCRUM-522 («nueve guards que no corrían en ningún sitio») ya está cerrada;
lo que quedaba mal era cómo se CUENTA lo que devuelven.

---

## 🔴 EL DEFECTO REAL, QUE NO ES EL QUE VENÍA A BUSCAR

`scripts/censo-guards-navegador.mjs`, en la línea que clasifica cada hijo:

```js
const estado = r.error && r.error.code === 'ETIMEDOUT' ? 'TOPE'
  : (r.status === 0 ? 'verde' : (r.status === 2 ? 'CIEGO' : 'rojo(' + r.status + ')'));
```

`rojo(N)` es la frase **«este guard midió y encontró un defecto»**. Y ahí caía todo lo que no
fuera 0 ni 2 — tres cosas distintas en el mismo cajón:

| salida | qué es de verdad | qué decía el censo |
|---|---|---|
| `1` | hallazgo | `rojo(1)` ✅ |
| `3` | **NO ARRANCA** — ceguera que el guard DECLARA | `rojo(3)` 🔴 |
| `4` | **SIN SERVIDOR** — ceguera que el guard DECLARA | `rojo(4)` 🔴 |
| `143` | código **impuesto desde fuera**; no es suyo | `rojo(143)` 🔴 |

O sea que el 143 no era un caso raro: era la punta de un defecto que también estaba mintiendo
sobre dos cegueras **con números que sí existen**. `3` y `4` no son números inventados — son
`SALIDA_NO_ARRANCA` (`scripts/_navegador.mjs:100`) y `SALIDA_SIN_SERVIDOR`
(`scripts/_servidor.mjs:39`), que la casa ya tenía escritos.

### Por qué se arregla éste y NO el que bloquea el merge

`scripts/guards-visuales.mjs` —el que sí es puerta— hace **lo contrario a propósito**, y lleva su
motivo escrito encima de `llegoAMedir()`:

> *«🔴 UN CÓDIGO DESCONOCIDO CUENTA COMO DEFECTO, no como ceguera, y es deliberado. […] leer un
> defecto como ceguera lo convierte en «cosa de infraestructura», se relanza el job, y el defecto
> acaba mergeando. Fail-closed en la dirección que importa.»*

**Tiene razón y no se toca.** En una puerta, equivocarse hacia «paro el merge» es la equivocación
barata. Pero el censo **no es una puerta**: sus únicos `process.exit` son su propio suelo y
`--solo-censo`, no tiene salida de fallo, y su único producto es una tabla que lee una persona.
Ahí no hay nada que dejar abierto — lo único que se juega es si esa persona sale a buscar un
defecto que no existe. Que es exactamente lo que pasó.

> **Un rojo falso que nadie quita entrena a relanzar la tanda.** Y el día que el rojo sea de verdad,
> también se relanzará.

---

## EL ARREGLO

`scripts/_salida-de-guard.mjs` (nuevo, **puro y sin `process`**) — clasifica la salida de un hijo
**reusando el vocabulario que ya existía** en vez de escribir una tercera copia:

```js
export function estadoDeLaSalida(r) {
  if (r && r.error && r.error.code === 'ETIMEDOUT') return 'TOPE';
  if (r && r.signal) return 'MATADO(' + r.signal + ') · NO MEDIDO';
  const v = VOCABULARIO.get(r ? r.status : undefined);
  if (!v) return 'FUERA DEL VOCABULARIO(' + (r ? r.status : r) + ') · NO MEDIDO';
  if (!v.midio) return v.etiqueta;
  return r.status === 0 ? 'verde' : 'rojo(' + r.status + ')';
}
```

Es **puro** por el mismo motivo que `veredicto()` en `scripts/guards-visuales.mjs`: un control que
cuesta dieciocho navegadores es un control que no se ejecuta. Así corre en `npm test` en
milisegundos.

**No se relaja nada: se AÑADE información.** Un `rojo(1)` sigue siendo `rojo(1)`, y el censo sigue
sin tener puerta que cerrar.

### ⚠️ LO QUE MEDÍ ANTES DE ESCRIBIRLO, Y QUE REFUTÓ MI PRIMERA VERSIÓN

La corrección obvia era mirar `r.signal`, y **la escribí así primero**. Está mal en esta máquina.
Medido con `spawnSync` en win32, tres hijos de verdad:

| hijo | `status` | `signal` |
|---|---|---|
| `process.kill(self,'SIGTERM')` | `1` | `null` |
| `process.exit(143)` | `143` | `null` |
| matado por el `timeout` de `spawnSync` | `null` | `'SIGTERM'` |

**En Windows un kill externo llega como un estado normal, sin señal.** `r.signal` sólo aparece en
el caso del tope, que ya tenía rama propia. Preguntar «¿hubo señal?» no habría arreglado nada
aquí: la pregunta que sí se puede medir en las dos plataformas es la del encargo — **«¿es un
número de los que este guard sabe decir?»**.

Y de ahí el nombre de la etiqueta. **No dice `MATADO`** cuando no hay señal: en win32 un 143
elegido a propósito y un 143 impuesto son indistinguibles, y afirmar la causa sería inventarse la
mitad que no se ve. Dice lo que consta: `FUERA DEL VOCABULARIO(143) · NO MEDIDO`.

---

## LOS CONTROLES

`tests/scrum554-el-censo-no-confunde-el-numero.test.mjs` — **7 pass, 0 fail, `# skipped 0`**.
Los hijos son procesos **de verdad** (`spawnSync` saliendo con el código), no objetos a mano: un
`{status:143}` escrito por mí comprueba mi idea de `spawnSync`, no `spawnSync`.

| control | qué exige | resultado |
|---|---|---|
| **SUELO** | el vocabulario llega con ≥5 códigos y con el 0 y el 1 | ok |
| **✅ POSITIVO** | un hijo real con salida `1` sigue siendo `rojo(1)` | ok |
| **✅ POSITIVO** | un hijo real con salida `0` sigue siendo `verde` | ok |
| **✅ NEGATIVO** | un hijo real con salida `143` **no** empieza por `rojo` y dice `NO MEDIDO` | ok |
| **cegueras** | `2`/`3`/`4` → `CIEGO`/`NO ARRANCA`/`SIN SERVIDOR`, ninguna «rojo» | ok |
| **la rama que ya iba** | el tope de `spawnSync` sigue siendo `TOPE` | ok |

**El SUELO no es decorativo**: si el vocabulario llegara vacío, *todo* caería en «FUERA DEL
VOCABULARIO» y el control negativo se pondría verde sin distinguir nada.

### 🔴 MUTACIÓN — y la ejecuta el instrumento de la casa, no yo a mano

El test **declara la mutación que tiene que tumbarlo** (`MUTACIONES_QUE_ME_TUMBAN`, SCRUM-745), así
que `npm run meta:mutaciones` la aplicará **en CI** en cada PR. Devuelve el clasificador a lo que
hacía antes —todo lo desconocido es `rojo(N)`— y exige el rojo:

```
✔ scrum554-el-censo-no-confunde-el-numero.test.mjs · SCRUM-554 · NEGATIVO: un 143 real NO se llama rojo
```

Cayó. Restauración byte a byte verificada (sha256 de los tres ficheros, idénticos antes y después).

---

## 🔴 DOS HALLAZGOS DE REBOTE — REPORTADOS, NO ARREGLADOS (regla 9)

### 1 · `npm run meta:mutaciones` sale **rc=1**, y no es por este cambio

200 mediciones: **199 vivas · 1 muda · 0 ciegas**. La muda:

```
✖ scrum859-identidad-y-motivo-cerrado.test.mjs · MUDO
  Test que debía ponerse rojo: «SCRUM-859 · 🔴 insertar una entrada en medio NO mueve ninguna clave»
```

**Causa, medida:** la mutación declarada en `tests/scrum859-identidad-y-motivo-cerrado.test.mjs:35-40`
apunta a `fichero: 'tests/scrum267-ancla-de-medicion.test.mjs'` y cambia allí un **punto de
llamada** (`const id = identidadDeEntrada(e.tituloCompleto);`). Pero el test que tiene que caer vive
en `scrum859` y usa **su propia copia** de esa línea — hay **3** apariciones en `scrum859` y **1** en
`scrum267`. `scrum859` importa del 267 sólo las *funciones*, cuyas definiciones la mutación no toca.
Mutar el 267 no puede tumbarlo: el objetivo está mal declarado.

**Que no es mío está medido, no supuesto:** `scrum859` lee únicamente `docs/master/` y
`tests/scrum267-ancla-de-medicion.test.mjs`, y no nombra ninguno de los tres ficheros de este
apéndice. ⚠️ **Lo que NO he medido:** si `meta:mutaciones` ya salía rc=1 en `origin/main` antes de
esta rama. La tanda dura más de veinte minutos y no la he repetido sobre un árbol limpio — así que
lo que consta es la causa y que es independiente de este cambio, no desde cuándo.

### 2 · `npm test` lanzado desde `bash` no corre nada, y lo dice con un número

Primer intento de la tanda: **rc=126 en 31 s**, y `tanda.tap` sin crear.

```
/usr/bin/bash: line 1: /c/Program Files/nodejs/node: Argument list too long
```

`tests/*.test.mjs` son hoy **834** ficheros: `bash` expande el glob y revienta el límite de
argumentos, así que **Node nunca arranca**. `npm test` no lo sufre porque en Windows lo lanza
`cmd.exe`, que no expande el glob y se lo deja a Node. Se arregla poniendo el patrón entre comillas
para que lo expanda Node. **Es la misma trampa que este apéndice documenta**: un número de salida
que parece un veredicto de la tanda y es una queja del intérprete.

---

## LA TANDA

```
ARBOL QUIETO DESDE: 08:52:10 UTC
ARBOL QUIETO HASTA: 08:59:57 UTC
# tests 6988 · # pass 6878 · # fail 0 · # skipped 110
```

`npm run guards:entrada`: 26 tests, 0 fallos, `# skipped 0`.

> ⚠️ **La única edición posterior a la tanda son estas cinco cifras**, sustituidas en este
> fichero de texto. Tras sustituirlas se relanzaron `guards:entrada`, `scrum854` y el control
> de este ticket. Ni una línea de código cambió después de las 08:59:57.

---

## LO NO TOCADO

- **`scripts/guard-caja-documento-suelto.mjs`: ni una línea.** Estaba verde; no había nada que
  arreglar, y tocarlo habría sido arreglar el guard en vez del código (regla 41).
- **`scripts/guards-visuales.mjs`: ni una línea.** Es la puerta que bloquea el merge y su
  fail-closed es deliberado. Queda **reportado, no arreglado**: si algún día se quiere que CI
  distinga «lo mataron» sin dejar de bloquear, es otro carril y otra decisión.
- **`tests/scrum859-*` y `tests/scrum267-*`: ni una línea**, aunque el primero esté mudo. Es el
  hallazgo de rebote nº 1 y arreglarlo es otro carril.
- `src/` intacto · ningún guard relajado ni apagado · ningún tope subido · ningún estado ni flag
  nuevo (27) · ninguna dependencia (36) · `prisma/schema.prisma`, el camino de emisión fiscal y el
  copy, intactos · nada de producción ni de staging · `git stash` no usado.
