# SCRUM-829 · Un lector de claves leyendo nombres de rama — y una ref rancia haciéndolo intermitente

**Medido contra:** `origin/main` = `da5ac06ac169fca5d3692a63b10b01a6aed7d3d6` · 2026-09-08T13:05:00+02:00
**Rama:** `scrum-829-una-sola-regla-rama-ticket`

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
| `tests/scrum804-la-rama-viva.test.mjs` | sus **dos poblaciones se derivan de git** en vez de ser listas de números a mano (ver §5) |

### 🔒 El control va anclado al mecanismo, no al nombre

El test viejo comparaba `numeroDeClave` **contra** `numeroDeRama`. Al unificarlas, esa comparación se
habría vuelto **trivialmente cierta** y habría dejado de fijar nada: bastaría con que alguien metiera
un tercer lector dentro de `agruparRamas` para que el guard siguiera verde **sobre el defecto**.
Ahora se le pregunta a **quien AGRUPA** y a **quien ENUMERA**.

Y el literal va **en el corpus, no en el árbol vivo**: la rama ya no existe y su ref se podó, así que
un guard que sólo mirase el árbol estaría verde hoy **por no tener el caso delante** — verde por no
mirar. En el corpus el caso no se puede ir.

## 5 · 🔴 EL HALLAZGO QUE NO BUSCABA: dos guards estaban verdes GRACIAS a la caducidad

Al poner el `--prune`, `tests/scrum804-la-rama-viva.test.mjs` se puso rojo en **tres** tests. No era
daño colateral: era el mismo defecto, un piso más arriba.

Ese guard interrogaba una **lista de cinco números escritos a mano** (`819, 816, 820, 821` y `716`)
y les exigía tener rastro. **`scrum-821-…` y `scrum-716-…` ya no existen en `origin`**: se mergearon
y se borraron. El guard sólo seguía en verde porque las **refs de seguimiento rancias** las mantenían
visibles.

> 🔒 Un control que depende de que nadie pode no vigila el árbol: vigila la higiene del clon. Estaba
> pasando gracias a la misma caducidad que este ticket viene a quitar.

Y su suelo de población era `total > 100`, escrito cuando había **558 ramas**. El remoto bajó a 98 en
la limpieza del 8-sep — **y siguió bajando mientras se escribía esto, de 104 a 98 en una hora**. Otro
número envejecido, rojo sin que el instrumento hubiera perdido nada.

### Lo que se hizo, y lo que NO

⛔ **No se bajó el umbral ni se quitaron los dos números de la lista.** Eso es «actualizar el número
para que pase en verde», que es lo que el propio fichero prohíbe por escrito: *«un control positivo
atado al estado de un árbol que nueve sesiones mueven a diario no vigila: envejece, y lo que se acaba
tocando para que pase en verde es el control»*.

✅ **Se derivan las dos poblaciones de `git for-each-ref`**, leído en el test y **aparte del
instrumento** — así conserva lo que motivaba la lista enumerada (cazar que el censo deje de ver una
familia entera de ramas) sin poder envejecer:

| antes | ahora |
|---|---|
| `total > 100` | `censo.resumen.total === RAMAS_DE_GIT.length` — el censo ve **todas** las que git tiene |
| rastro de 4 números escritos | rastro de **todos** los números con rama (97 hoy) |
| árbitro sobre 5 números escritos | árbitro sobre los **12 tickets con rama más recientes**, acotado porque pregunta rama a rama (SCRUM-753 midió 52,6 s sobre 491 refs) |

Los cuatro del origen **siguen impresos** en la salida del test, como foto fechada; lo que ya no
hacen es decidir.

## 6 · Verificación — los rojos, provocados uno a uno

| | |
|---|---|
| 🔴 **①** | devolviendo `agruparRamas` a `numeroDeClave` caen **DOS** tests, y el mensaje da los dos números: `agrupa: 824` / `enumera: null` |
| 🔴 **②** | quitando `--prune` cae el test que ya vigilaba ese `fetch`, diciendo lo que cuesta la alternativa |
| 🔴 **③** | quitándole el `^` a la regla —el defecto de subcadena, literalmente— cae el test de 829 nombrando al impostor |
| ✅ **positivo** | la rama BUENA `scrum-824b-…` sí agrupa en 824; sin esto, los vacíos de arriba no dirían nada |
| ✅ **negativo** | cuatro impostores con `scrum-N` en medio, todos a `null`; y `scrum-824b`, `scrum-72`, `scrum-727` siguen resolviendo |
| 🔴 **⑤ A** | haciendo que el censo pierda UNA rama, el suelo derivado lo dice con los dos números: «cuenta 96 y git tiene 97» |
| 🔴 **⑤ B** | dejando al instrumento ciego a la familia `scrum-8xx`, caen **tres** tests — la propiedad que protegía la lista de cuatro, ahora sobre las 97 |

⚠️ **Y un rojo que no lo era:** el primer intento del ③ lo hice con `sed` y **la mutación no se
aplicó** — el test se quedó verde y eso NO es un rojo probado. Se rehízo comprobando la línea mutada
antes de creerse el resultado.

## 7 · ⚠️ Y un accidente que hay que contar: popé el stash de otra sesión

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
