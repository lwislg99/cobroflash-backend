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
