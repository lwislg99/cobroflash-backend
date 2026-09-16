# SCRUM-829 · Un lector de claves leyendo nombres de rama — y una ref rancia haciéndolo intermitente

**Medido contra:** `origin/main` = `0269e8cd24b6a393e23d05db6ac13307b4ac1c1d` · 2026-09-09T09:34:24+02:00
**Rama:** `scrum-829-una-sola-regla-rama-ticket`

> Las mediciones de §1 a §4 son del **8-sep-2026** contra `da5ac06a`, y llevan su fecha dentro.
> Esta cabecera es la del cierre, tras mezclar el `main` del 9-sep con el SCRUM-804 de Javier.

---

## 0 · PASO 0, y una contradicción entre dos informes resuelta antes de tocar nada

Dos sesiones se contradecían: la mía decía que `revert-1192-scrum-824b-el-vigia-que-no-deja-pasar`
era una **rama remota**; la Sesión 0, que **ya no existía en el remoto** y sólo quedaba su ref local.
Los dos comandos, no uno:

```
git ls-remote --heads origin | grep revert-1192          → nada
git for-each-ref refs/remotes/origin/ | grep revert-1192 → nada (ya podada)
```

**Tenía razón la Sesión 0.** Lo que había era la **ref de seguimiento rancia de este clon**, no una
rama. Mi informe de SCRUM-708 decía «rama remota» y era impreciso: queda corregido aquí.

Consecuencia que cambia la premisa del encargo: **esta rama NO era el tapón de los 22 PR.** CI clona
limpio y nunca vio la ref, así que el rojo era local en los seis worktrees y verde en CI.

⚠️ Y de camino: **`gh` no está instalado** en esta máquina (`which gh` → exit 1), y **el remoto pasó
de 491 cabeceras (6-sep) a 104**: hubo una limpieza masiva que se llevó por delante la rama de
SCRUM-708 ya empujada. Se reempujó y GitHub la aceptó como `[new branch]`.

## 1 · Los dos defectos, y no son el mismo

### ① 🔴 Un lector de CLAVES aplicado a un NOMBRE DE RAMA

```js
// scripts/_censo-reparto.mjs · agruparRamas   → /SCRUM-(\d+)/i  (subcadena)   → 824
// scripts/censo-tablero-vs-arbol.mjs          → /^scrum-0*(\d+)[a-z]?-/       → null
```

`numeroDeClave` existe para leer **una clave de Jira** (`SCRUM-304`), donde buscar la subcadena es
correcto porque la cadena entera **es** la clave. Aplicado a un nombre de rama —texto libre que
escribe una persona, o **GitHub al pulsar «Revert»**— encuentra `scrum-824` **en medio** de otra cosa
y contesta con aplomo.

> 🔒 Un lector de claves y un lector de nombres no son el mismo lector aunque acierten en los casos
> fáciles. Los casos fáciles son justo donde no se nota.

Es la misma familia que el `guard:a11y-comparativa` que casó buscando «con iva» dentro de otra
cadena. Por eso el test nuevo lleva un **control negativo del emparejador** con cuatro impostores
(`revert-…`, `fix-…-scrum-999-…`, `backport-scrum-100-…`, `mi-scrum-42-personal`): ninguno lleva el
ticket al principio y ninguno puede resolver a un número.

### ② 🔴 Un censo que hereda las refs de ramas borradas

`traerRefs` hacía `git fetch` **sin `--prune`**, o sea que sólo AÑADÍA. Una rama borrada en `origin`
dejaba su `refs/remotes/origin/…` en **todos los worktrees vivos** —que comparten `.git`— para
siempre, y el censo la contaba como existente.

**Eso es lo que hacía el rojo «intermitente»: no lo era.** Era rojo en cualquier clon vivo y verde en
CI, que clona limpio. El instrumento miraba una copia caducada.

## 2 · Las decisiones (las tomo yo, y son UNA por pregunta)

| pregunta | decisión | por qué |
|---|---|---|
| ¿cuál de las dos reglas gana? | **la anclada** (`numeroDeRama`, SCRUM-738) | el patrón no cambia ni un carácter: se **muda**, no se reescribe |
| ¿una `revert-…` resuelve al ticket revertido? | **no: «sin ticket»** | una rama de revert no es trabajo del ticket, **es su deshacer**. Decir «SCRUM-824 tiene rama viva» cuando lo que hay es su marcha atrás es peor que no decir nada, porque parece un dato |
| ¿`ls-remote` o seguir en local? | **local, y el `fetch` poda** | medido abajo |

Y las que no llevan número **no se pierden**: van a `sinNumero`, que `agruparRamas` ya promete por
escrito no descartar en silencio.

### La medición que decide `--prune` frente a `ls-remote`

**8-sep-2026, tres corridas cada uno:**

| | corridas | |
|---|---|---|
| `git ls-remote --heads origin` | 621 · 663 · 765 ms | red |
| `git for-each-ref refs/remotes/origin/` | 85 · 92 · 107 ms | local |
| el `fetch` que el censo **ya** hace | 860 · 902 · 925 ms | red |

`ls-remote` añadiría **~0,66 s de red por corrida** para averiguar lo que ese `fetch` ya trae.
**`--prune` cuesta cero: es la misma llamada, la misma ida y vuelta.** Y el guard `scrum753` ya tenía
fijado por escrito que el censo NO consulta el remoto en vivo (con `ls-remote` los shas pueden no
estar en local y todo saldría indeterminado) — así que ir a `ls-remote` habría roto esa decisión.

⚠️ **Es una escritura sobre refs compartidas, y se declara.** Comprobado antes de aplicarlo sobre
este árbol: **105 refs antes, 105 después**, `origin/HEAD` intacto. Sólo se va lo que miente.

## 3 · Impacto medido ANTES de cambiar la regla

Sobre las **104 ramas del remoto + las refs locales + el literal del ticket** = 106 nombres:

```
nombres a los que el cambio les mueve el número:  1 de 106
   revert-1192-scrum-824b-el-vigia-que-no-deja-pasar    antes 824  →  ahora null
```

**Ninguna rama legítima se mueve**, así que esto no reparte ni un trabajo de otra manera.

🔴 Y mi primer barrido de colisiones dio **84 ramas tocando estos ficheros**, que era **falso
positivo mío**: diffeaba `main` contra ramas viejas que simplemente *no tienen* esos ficheros. La
pregunta correcta es quién los MODIFICA por delante de su base (`git log main..rama --`), y ahí sale
**una**, cuyo diff está **vacío**. Nadie más los toca.

## 4 · Lo construido

| fichero | qué |
|---|---|
| `scripts/_numero-de-rama.mjs` | **nuevo** · la regla, UNA vez. Es una **hoja**: no importa nada, así que no cierra el ciclo de imports que `censo-tablero-vs-arbol.mjs` ya documenta |
| `scripts/censo-tablero-vs-arbol.mjs` | reexporta la regla desde la hoja; el patrón no cambia |
| `scripts/_censo-reparto.mjs` | `agruparRamas` llama a la regla anclada; `numeroDeClave` se queda **para claves**, con el ⛔ de dónde NO usarla |
| `scripts/_censo-alcanzabilidad.mjs` | el `fetch` **poda**; el costurón de dos reglas queda **cosido** en su cabecera |
| `tests/scrum753-censo-de-alcanzabilidad.test.mjs` | el literal exacto en el corpus, el control re-anclado **a los dos consumidores**, el test propio de 829 y el `--prune` fijado |
| `tests/scrum804-la-rama-viva.test.mjs` | **sólo una nota corregida**: mi cambio aquí se RETIRÓ entero por la colisión con Javier (ver §5) |

### 🔒 El control va anclado al mecanismo, no al nombre

El test viejo comparaba `numeroDeClave` **contra** `numeroDeRama`. Al unificarlas, esa comparación se
habría vuelto **trivialmente cierta** y habría dejado de fijar nada: bastaría con que alguien metiera
un tercer lector dentro de `agruparRamas` para que el guard siguiera verde **sobre el defecto**.
Ahora se le pregunta a **quien AGRUPA** y a **quien ENUMERA**.

Y el literal va **en el corpus, no en el árbol vivo**: la rama ya no existe y su ref se podó, así que
un guard que sólo mirase el árbol estaría verde hoy **por no tener el caso delante** — verde por no
mirar. En el corpus el caso no se puede ir.

## 5 · 🔴 COLISIÓN CON JAVIER, Y SU ANCLA GANA

Al poner el `--prune`, `tests/scrum804-la-rama-viva.test.mjs` se puso rojo en tres tests y lo
arreglé derivando sus poblaciones de `git for-each-ref`. **Ese arreglo se ha retirado entero.**

Javier cerró SCRUM-804 la noche del 8-sep y su versión **ya está en `main`**: ancla las
poblaciones a `git log --merges`. Al mezclar main el 9-sep hubo **conflicto en ese fichero**, y se
resolvió tomando la suya tal cual — no fusionada con la mía.

### Por qué gana la suya, y no es cuestión de gustos

`for-each-ref` lee **ramas del remoto**, que es exactamente la población que el auto-borrado
vacía. Lo medí sin ver que estaba midiendo el problema de mi propia solución: dejé escrito «el
remoto bajó a 98 — y siguió bajando de 104 a 98 mientras trabajaba». Mi lista de 97 será mucho
menor el mes que viene. Un `git log --merges` **no se puede vaciar**: el commit de merge y su
segundo padre siguen alcanzables desde `main` aunque la rama se borre el mismo día.

> 🔒 Si el borrado de una rama puede cambiar tu medición, no estabas midiendo el trabajo:
> estabas midiendo el envase.

⛔ Y no se fusionan las dos: **dos anclas para la misma comprobación es cómo nace la próxima
contradicción** — que es, literalmente, el defecto de este ticket.

### ✅ Lo que yo defendía SÍ está cubierto por la suya, y mejor

Mi lista existía para cazar **ceguera de familia** (que el censo deje de ver los `scrum-8xx`).
Comprobado sobre su fichero: su `CONTROL POSITIVO DERIVADO` hace exactamente eso, y su comentario
lo dice con esas palabras — *«¿ha dejado el barrido de ver una familia entera de ramas?»*.

| | la mía | la de Javier |
|---|---|---|
| ceguera de familia | por NÚMERO de ticket (97 números) | **por RAMA**: toda rama que `for-each-ref` lista tiene que estar agrupada bajo su número |
| ramas inventadas | no lo miraba | **sí**: ninguna rama ajena metida en un ticket |
| umbral de población | derivado | derivado, **y con un test por AST que prohíbe cualquier umbral escrito a mano en ese fichero** |

**No se añade nada encima.** Está cubierto y con más alcance del que yo le daba.

### Lo único que sí quedó desfasado por MI cambio, y se corrige

Su nota del control ② decía «se pregunta con la MISMA regla que usa el instrumento
(`numeroDeClave`)». Desde este ticket el instrumento agrupa con `numeroDeRama`. **Su comprobación
no cambia** —es la permisiva, y todo lo que la regla anclada agrupa cumple también la subcadena—;
lo que se corrige es la nota, para que no nombre una función que ya no es la que agrupa.
## 6 · Verificación — los rojos, provocados uno a uno

| | |
|---|---|
| 🔴 **①** | devolviendo `agruparRamas` a `numeroDeClave` caen **DOS** tests, y el mensaje da los dos números: `agrupa: 824` / `enumera: null` |
| 🔴 **②** | quitando `--prune` cae el test que ya vigilaba ese `fetch`, diciendo lo que cuesta la alternativa |
| 🔴 **③** | quitándole el `^` a la regla —el defecto de subcadena, literalmente— cae el test de 829 nombrando al impostor |
| ✅ **positivo** | la rama BUENA `scrum-824b-…` sí agrupa en 824; sin esto, los vacíos de arriba no dirían nada |
| ✅ **negativo** | cuatro impostores con `scrum-N` en medio, todos a `null`; y `scrum-824b`, `scrum-72`, `scrum-727` siguen resolviendo |
| ⛔ **retirados** | los dos rojos que probé sobre `scrum804` (perder una rama · ceguera de familia) NO figuran aquí: aquel arreglo se retiró entero (§5). Los conserva la versión de Javier, con sus propios rojos |

⚠️ **Y un rojo que no lo era:** el primer intento del ③ lo hice con `sed` y **la mutación no se
aplicó** — el test se quedó verde y eso NO es un rojo probado. Se rehízo comprobando la línea mutada
antes de creerse el resultado.

## 7 · ⚠️ Y un accidente que hay que contar: popé el stash de otra sesión

> ✅ **Ya no es sólo una anécdota: es la norma A15** de `docs/equipo/00-normas-comunes.md`,
> escrita en este mismo ticket. Le pasó a la sesión 2 hace unos días y a la 3 el 8-sep: dos
> veces es un patrón, no un accidente.

Al comprobar si `scrum804` fallaba también sin mis cambios hice `git stash push` de cuatro
ficheros y luego `git stash pop`. **El stash se comparte entre worktrees, igual que los refs.** Mi
`push` no llegó a crear entrada y el `pop` sacó a mi árbol el stash de otra sesión
(`scrum713-before-main-20260908-9e7b4a21`), con conflictos en `quotesView.js`, `scrum697`,
`scrum698` y `styles.css`, más tres ficheros sin seguir suyos.

**No se ha perdido nada**: el pop conflictivo CONSERVA la entrada, comprobado antes de tocar el
árbol — `stash@{0}` sigue con sus 4 ficheros seguidos y sus 3 sin seguir. Se devolvieron los
cuatro a `HEAD`, se borraron los tres suyos y el stash quedó intacto.

> 🔒 `git stash` es estado COMPARTIDO en un repo con worktrees, como `refs/remotes/`. Un
> `stash pop` a ciegas es un `git checkout` del trabajo de otro encima del tuyo.

Para separar «mi cambio» de «el árbol» sin tocar estado compartido, lo correcto aquí era lo que se
usó después: copiar el fichero, mutarlo, medir y restaurar por bytes.

## ⛔ No tocado

El patrón de `numeroDeRama` (se muda, no se reescribe) · `numeroDeClave` para claves de Jira · el
lector de declaraciones de SCRUM-757 · `HASH_VIEWS` · `src/` · ningún rótulo.

---

# SCRUM-829b · La ref rancia, FABRICADA: la poda y la regla única, probadas por efecto

**Medido contra:** `origin/main` = `3e5f58db7325058ededc7ba2381140d0be291abc` · 2026-09-15T15:28:43Z
**Rama:** `scrum-829b-la-ref-rancia-fabricada` · **Carril:** `tests/` (Sesión 3) · **Decisión:** del orquestador, 15-sep-2026 — la 4 del rescate del #1212

> Que la palabra `--prune` esté en el fuente no dice que git pode. Y el verde de CI no lo puede
> decir nunca: CI clona limpio, así que jamás tiene una ref rancia delante.

## 0 · Lo que faltaba, medido en `main`

El #1212 entró el 15-sep-2026 (`c3dce7aa`) con las dos mitades de este ticket. Las dos tenían guard,
y las dos de la mitad fácil:

| | cómo estaba vigilada | lo que no probaba |
|---|---|---|
| la regla única | `scrum753` compara quien agrupa con quien enumera sobre **nombres sueltos** | nunca con una ref rancia delante, leída de un repositorio |
| la poda | `scrum753` busca `'fetch', '--prune'` en el fuente con una **expresión regular** | que git pode de verdad lo que tiene que podar |

Y **ninguna mutación declarada** sobre esas dos líneas (medido con `git grep` sobre `tests/` el
15-sep-2026: la única declaración cercana es la de `scrum738`, sobre la cabecera de `numeroDeRama`
en otro fichero). El meta-guard no las ejercía.

## 1 · El banco

`tests/scrum829b-la-ref-rancia-se-poda.test.mjs`, por el mismo camino que produjo el incidente:

1. un `origen` con `main`, `scrum-824-la-rama-que-sigue-en-origin` y
   `revert-1192-scrum-824b-el-vigia-que-no-deja-pasar` —el literal del incidente, no uno inventado—;
2. un `clon` que trae las tres;
3. `origen` **borra** la de revert, que es lo que hace GitHub al mergear. El clon no se entera.

* ⛔ **Nunca sobre el repositorio real.** Todo en un directorio temporal. El SUELO comprueba que el
  `.git` del banco está **dentro** de ese directorio, y el test quita `GIT_DIR`, `GIT_WORK_TREE` y
  compañía del proceso antes de tocar git: heredada de un hook, cualquiera de ellas mandaría el
  `fetch --prune` al `.git` que comparten todos los worktrees.
* 🔴 **La poda, apagada en la configuración del clon** (`fetch.prune=false`,
  `remote.origin.prune=false`). Con un `fetch.prune=true` global, git podaría aunque el código no lo
  pidiera y el guard saldría verde sin `--prune`. En esta máquina no hay ninguno en ningún nivel
  (medido el 15-sep-2026), pero lo que se mide es que pode **el código**, no la máquina que corre.
* **Un banco por test**: el de la poda lo modifica, y compartirlo haría que el orden de los tests
  decidiera si hay ref rancia delante o no.

## 2 · EN ROJO — cada mutación tumba SU test, y sólo el suyo

Las dos declaraciones, leídas con el **lector oficial** del meta-guard y aplicadas como él las
aplica (`de` → `a`, una vez):

| mutación | cae | y dice |
|---|---|---|
| **①** `traerRefs` sin `--prune` | 🔴 «traerRefs PODA la ref rancia, y sólo ésa» — **sólo ése** | «`traerRefs` NO poda: la ref de una rama que ya no existe en origin sigue en el clon» — la aserción de la poda, **no** el suelo ni el control |
| **②** `agruparRamas` vuelve a `numeroDeClave` | 🔴 «con la ref rancia DELANTE, quien agrupa y quien enumera dan el mismo número» — **sólo ése** | `agrupa: 824` · `enumera: null` sobre `revert-1192-…` |

Es lo que pedía la decisión: **sin arreglo, las dos reglas discrepan** para `revert-…`; **con arreglo,
dan lo mismo**; y el control `scrum-824-…` **sigue dando 824** en las dos. Pasada limpia antes y
después: 3/3. Ficheros restaurados y verificados **byte a byte**, sin `git stash` (A15).

📍 **Dónde se midió.** Primero en un árbol extraído con `git archive` de `f5720e41` —fuera del worktree, sin crear ni mover ninguna ref, mientras el meta-guard de SCRUM-836e corría en el worktree—. Después, **repetido sobre la rama real** (base `570260a2`), con `_censo-alcanzabilidad.mjs`, `_censo-reparto.mjs`, `_numero-de-rama.mjs`, `censo-tablero-vs-arbol.mjs`, `_censo-tickets.mjs` y el propio meta-guard comprobados **idénticos byte a byte** a los del árbol extraído. El mismo resultado las dos veces.

## 3 · Verificación

| | |
|---|---|
| test nuevo | **3/3** |
| lector oficial | **2** declaraciones legibles, 0 cojas, cada ancla presente **una** vez |
| tests vecinos | `scrum753` · `scrum738` · `scrum836` · `scrum711` · `scrum737` · `scrum267` · `scrum745` en verde. ⚠️ `scrum804` salió **intermitente, y no por esto**: sobre el mismo árbol y ejecutado SOLO —sin este test en el proceso— dio 9/9 y a continuación 7/9 («el censo dice 148 ramas y `for-each-ref` lista 149»). Cuenta dos veces las refs compartidas y otra sesión las movió en medio; en ese momento no había ninguna ref rancia (148 locales, 148 en el remoto, medido el 15-sep-2026). |
| `meta-guard --solo-censo` | 62 guards · **197** declaraciones sobre el árbol mezclado — `main` (`3e5f58db`): 61 · 195, contados con el lector oficial sobre los blobs de las dos puntas: **+1 guard y +2 declaraciones**, las dos de este test y nada más |
| tanda completa | **6835 tests · 6725 pass · 0 fail · 0 cancelled** · 110 skipped, aparte · 245 s · exit 0 — sobre el árbol mezclado con `3e5f58db`, con esta sección ya dentro · 15:28:43Z → 15:33:16Z |

⚠️ **El meta-guard entero NO se ha corrido en local para esta rama**, y se dice: las dos mutaciones
se aplicaron con su lector y su forma de mutar, pero la pasada completa la hace CI sobre el PR.
`main` lo tenía en verde en su último run terminado: los 4 ciegos de `scrum850`/`scrum850b` los cerró
el #1294, y el #1299 (la ③b de SCRUM-836e) entró con `vivas 179 · mudas 0 · ciegas 0`. Desde entonces
`main` trajo guards nuevos y su run sobre `3e5f58db` seguía en curso al escribir esto. Lo esperado en el
PR de esta rama era **`vivas 197 · mudas 0 · ciegas 0`**.

> 🔴 **CORRECCIÓN (16-sep-2026, SCRUM-868).** Esa cifra NO fue la real: el job del meta-guard del
> PR #1304 dio **`vivas 196 · mudas 1 · ciegas 0`** (job `104450607217`, 15-sep-2026). Las dos
> líneas de `scrum829b` salieron **VIVAS**, que era lo que este ticket tenía que demostrar; la muda
> es de `scrum859` y **ya estaba en `main` antes de este merge** —su run sobre `3e5f58db` dio
> `vivas 194 · mudas 1 · ciegas 0`—, con ticket propio: **SCRUM-866**, carril de Javier. El párrafo
> de arriba decía que un mudo ajeno «se diría»: esto es decirlo, y con la cifra corregida en vez de
> dejar la predicción como si hubiera acertado.

## 4 · Un vecino que lo acusó, y por qué se DECLARA

La primera tanda completa dio **1 fail**: `scrum723` («quién compara contra una referencia MÓVIL, y
cada uno con su motivo») acusó a este test por nombrar `refs/remotes/origin/main` fuera de los
argumentos de git. Tenía razón en verlo y no en el fondo: ese `main` es el del **clon fabricado** en el
directorio temporal —el control de «podar no es vaciar»—, no el de este repositorio. Es el mismo motivo
por el que `_fixture-alcanzabilidad.mjs` ya estaba en su lista.

Se **declara** en `INDIRECTAS_DECLARADAS` con su motivo y quién lo retira, en un commit aparte y antes
de volver a medir. Lo que no se hace es reescribir la cadena para que el censo deje de verla: esconderse
de un guard es exactamente la avería que ese guard vigila. Tras declararlo, `scrum723` + `scrum829b`
11/11, y la tanda de arriba.

## ⛔ No tocado

`scripts/_censo-alcanzabilidad.mjs` · `scripts/_censo-reparto.mjs` · `scripts/_numero-de-rama.mjs`
(se prueban, no se cambian) · `scrum753` · de `scrum723`, nada salvo la entrada declarada del §4 · ninguna ref del repositorio real · ninguna rama
`claude/*` · ningún stash.
