# SCRUM-454 · PASO 0: la barrera existe, funciona, y **no cubre nada de esta familia**

**Medido contra:** `origin/main` = `04dc6359bb395a3afccb2bc28ad209932130162b` · 2026-08-11T18:02:58+02:00
**Rama:** `scrum-454-destructivo-sin-comprobacion`

## (b) primero, porque es el hallazgo: **sí hay barrera**

`.claude/hooks/guard-dangerous.mjs`, 209 líneas, y **funciona** — hoy mismo me bloqueó un
`rm -rf` con ruta absoluta. Lo que vigila, derivado de su propio código:

`prisma migrate dev` · `prisma db push` sin preview confirmado · `--force` · `rm -rf`

**Y ejecutándolo contra la familia de este ticket** —segundo instrumento, porque mi extractor de
regex sacaba un patrón mutilado y no me fiaba de él—:

| comando | veredicto |
|---|---|
| `git checkout -- src/app.ts` | **PASA** |
| `git clean -fd` | **PASA** |
| `git restore src/app.ts` | **PASA** |
| `echo x > docs/master/SCRUM-445.md` (ruta existente) | **PASA** |
| `git reset --hard origin/main` | **PASA** |

> **Los cuatro casos documentados se perdieron por mecanismos que la barrera no mira.** No falta
> una barrera: falta *esta* familia dentro de la que ya hay. Eso cambia el trabajo — no se
> construye un hook nuevo, se amplía el que ya para cosas.

## 🔴 Y un defecto de la barrera, encontrado usándola

Al medir, **el hook bloqueó mi propia medición**: mi bucle de prueba contenía la cadena `--force`
dentro de un comando que solo *preguntaba* si `--force` está bloqueado. **La barrera es textual
sobre la línea entera**, así que no distingue *ejecutar* de *mencionar*.

Es la trampa de autorreferencia de SCRUM-203, ahora en el sitio donde más cara sale: la barrera que
protege el repo se dispara contra quien la está verificando. **Y tiene consecuencia práctica**:
cualquier comando que cite uno de estos patrones —un `grep`, un test, un mensaje de commit por
heredoc— queda bloqueado, y la salida obvia es dejar de verificarla.

## (a) El censo, y por qué NO es una lista de memoria

Se deriva de dos fuentes que existen en el repo, no de lo que yo recuerde:

1. **Lo que la barrera ya declara peligroso** (su propio código): `rm -rf`, `--force`, `db push`.
2. **Lo que se ha perdido de verdad**, con su caso: los tres `git checkout --` del ticket, y el
   **cuarto del 11-ago**: `>` sobre `docs/master/SCRUM-447.md`, una ruta que ya existía. Segunda vez
   a la misma sesión.

La unión de las dos, quitando lo ya cubierto, **es exactamente la tabla de arriba**: cinco
mecanismos vivos, cero cubiertos.

## (c) Qué es automatizable — y qué no

| | mecanismo | ¿comprobable ANTES? |
|---|---|---|
| `git checkout -- <ruta>` · `git restore` | **SÍ** | `git status --porcelain <ruta>` dice si hay cambios sin commitear |
| `git clean` · `git reset --hard` | **SÍ** | lo mismo, sobre el árbol |
| `>` sobre ruta existente | **SÍ** | `test -e <ruta>` |
| `rmdir /s` sobre junction | **SÍ** | el `LinkType` lo dice (medido en SCRUM-429) |
| que el trabajo *mereciera* conservarse | **NO** | eso no lo sabe una máquina |

**Las cuatro primeras son mecanismo. La quinta es criterio, y no se automatiza.**

Y el diagnóstico de la sesión del cuarto caso es el que manda, porque nombra la causa exacta:

> «la comprobación estaba en el propio comando y me llegó **DESPUÉS** de haber escrito — **el orden
> era el error**».

Eso descarta de entrada la solución que parece obvia: **encadenar la comprobación en el mismo
comando no vale**, porque el fallo no es que falte la comprobación, es que llega tarde. La barrera
tiene que estar **antes**, y en un sitio que no dependa de que alguien la escriba.

---

# CONSTRUIDO · el diseño, con las tres condiciones

**NO se avisa: se bloquea la pérdida, no el comando.** Cada regla comprueba el estado **antes** y
solo bloquea si hay algo que perder. Un `>` sobre un fichero nuevo, un `git checkout --` con el
árbol limpio o un `git restore --staged` **no caen**.

## Condición 3 primero, porque era prerrequisito (commit 1/2)

SCRUM-176 ya había atacado esto y **se quedó en la forma**: descontaba heredoc, here-string y el
argumento de `-m` — tres maneras concretas de escribir texto. El hecho tiene más:

| medido con el hook real, ANTES | |
|---|---|
| `node medir.mjs "git push --force origin main"` | BLOQUEADO |
| `node hook.mjs '{"tool_input":{"command":"…db push"}}'` | BLOQUEADO |
| `grep -n "rm -rf /" docs/RUNBOOKS.md` | BLOQUEADO |

El tercero lo define: **la barrera impedía leer la documentación de la barrera.**

**Mecanismo:** la línea se tokeniza como la tokenizaría un shell, con una máscara de «esto venía
entrecomillado». Una coincidencia **solo cuenta si toca al menos un carácter no entrecomillado**.
Los cuatro patrones y el texto sobre el que se aplican son los mismos.

Y no abre agujero **por construcción**: lo entrecomillado que sí se ejecuta se sigue mirando por dos
caminos — los **envoltorios** (`bash -c`, `cmd /c`, `eval`) se re-analizan como línea de comando, y
la **sustitución** (`$(…)`) se extrae de la línea original. Son exactamente los dos casos que
SCRUM-176 puso en verde.

## Condición 1 · los once controles negativos, primero

| no puede caer | |
|---|---|
| `> nuevo.txt` (fichero **nuevo**) | PASA |
| `git checkout -- limpio.txt` (árbol **limpio**) | PASA |
| `> ignorado/salida.txt` (git lo ignora) | PASA |
| `>> sucio.txt` (añadir, no truncar) | PASA |
| `> /dev/null` | PASA |
| `git restore --staged` (no toca el árbol) | PASA |
| `git checkout otra-rama` (no es descarte) | PASA |
| `git clean` sin nada no rastreado | PASA |
| `git reset --hard` con el árbol limpio | PASA |
| `git worktree remove` con `node_modules` **real** | PASA |
| `git status` | PASA |

## Condición 2 · los cinco de la tabla, medidos con el hook real

| | ANTES | DESPUÉS (con algo que perder) |
|---|---|---|
| `git checkout -- sucio.txt` | PASA | **BLOQUEA** y enseña qué se perdía |
| `git restore sucio.txt` | PASA | **BLOQUEA** |
| `git reset --hard` | PASA | **BLOQUEA** |
| `git clean -fd` | PASA | **BLOQUEA** y lista qué se llevaría |
| `> fichero-existente` | PASA | **BLOQUEA** |
| **+ el junction** (`worktree remove` / `rm -rf` / `rmdir /s`) | PASA | **BLOQUEA** nombrando el enlace |

**29/29** en el banco (11 negativos + 8 de la familia + 4 de autorreferencia + 6 que ya bloqueaban y
siguen bloqueando). Ejecutando **el hook real** por subproceso, nunca un extractor — el mío ya me
mintió una vez sacando un patrón mutilado.

## Lo que hace que el orden no se pueda deshacer

El diagnóstico de la sesión del cuarto caso era: *«la comprobación estaba en el propio comando y me
llegó DESPUÉS»*. Por eso el permiso es un **sentinel de un solo uso** (`.claude/allow-destructivo`,
el mismo diseño que `allow-db-push`) y **crearlo en la misma línea no sirve**: el hook juzga antes de
que nada se ejecute, así que un `touch … && git checkout --` sigue bloqueado. Hay test.

Y el bloqueo **enseña lo que se perdería** (`git status --porcelain`, o el `git clean -n`): un
bloqueo que no muestra el daño obliga a repetir el comando para enterarse, que es el orden que falló.

## Verificado EN ROJO, una por una

| defecto inyectado | |
|---|---|
| la máscara deja de contar | 🔴 5 fallos |
| el envoltorio deja de re-analizarse | 🔴 4 fallos |
| la redirección deja de mirar si el fichero existe | 🔴 2 fallos |
| el descarte deja de preguntar por el árbol | 🔴 6 fallos |
| `git clean` deja de mirar qué se llevaría | 🔴 1 fallo |
| el enlace deja de distinguirse de una carpeta | 🔴 1 fallo |
| **bloquear de MÁS** (ignorar lo que git ignora) | 🔴 1 fallo |
| mirar el árbol equivocado (ignorar el `cd`) | 🔴 1 fallo |

Los dos últimos importan tanto como los otros: el guard tiene que caer **también** cuando bloquea de
más o cuando juzga desde el árbol que no es — que con cuatro worktrees diría «limpio» de otro sitio.

## Lo que NO cubre, declarado

- **Fuera del repo y lo que el `.gitignore` cubre.** Desde el hook no se distingue un borrador de una
  salida temporal, y bloquear en todo el disco es lo que convierte una barrera en ruido.
- **El quinto mecanismo —si el trabajo *merecía* conservarse— queda fuera a propósito.** Es criterio,
  no mecanismo, y no se automatiza.
- Un editor o un `fs.writeFileSync` sobrescriben sin pasar por aquí: el hook solo ve Bash/PowerShell.
- Si algo revienta **dentro de la familia nueva**, se deja pasar (las cuatro reglas de AA2 no llevan
  esa red). Es cobertura nueva: un fallo mío parando a las cuatro sesiones sería peor que el estado
  de ayer.

⚠️ **Esto entra en vigor para las cuatro sesiones en el MERGE**, no antes: el hook que corre es el
del checkout principal, no el de mi worktree.

**Suite:** 3101 tests, **0 fail** · `npm run guards:entrada` → 0 · Tickets nuevos abiertos: **0** (el
junction entró aquí, como se pidió).

---

# SCRUM-176b · la regla de `--force` comparaba por subcadena

**Medido contra:** `origin/main` = `c9cf435b20287ad7a0dc02a3a17d3fe182dfa372` · 2026-09-04T17:30:22+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-176b-force-por-identidad`
**Carril:** hooks / seguridad de AA2

## El defecto

El patrón era `/(^|[^A-Za-z-])--force(-with-lease)?\b/`. El ancla de la izquierda estaba bien
puesta; la de la derecha no. `\b` entre la `e` de `--force` y el guion de `-device` **existe** —una
es letra y el otro no—, así que `--force-device-scale-factor`, que es calibrado de Chrome y no
borra nada de nadie, salía bloqueada exactamente igual que un push forzado.

Se vio corriendo: el hook bloqueó un `echo` que solo llevaba la palabra, en el mismo comando con el
que iba a leer el hook. El defecto se demostró solo.

## Por qué esto no es una molestia

🔒 **Un guard de seguridad con falso positivo es un guard que alguien va a desactivar.** Éste es el
que sostiene AA2 —el que impide reescribir historia publicada—, y el día que se apague por pesado
se apaga también lo que sí protegía. El criterio ya estaba escrito en este mismo fichero para la
familia de SCRUM-454: «una barrera que bloquea lo legítimo la desactiva entera alguien con prisa,
y entonces protege menos que ninguna».

Y es la **sexta cara de la misma avería esta semana**: `data-view="parte*"` · `window.renderParte`
casando dentro de `renderPartesOficinaView` · `ata` apuntando al alias · el prefijo del censo de
navegación · `constaAprobado` por subcadena · `0%` encontrado dentro de `10%`.
🔒 **Un prefijo no es un nombre, y una subcadena tampoco.**

## El arreglo: negar por defecto, eximir por lista visible

Se compara por **identidad de bandera**: se recorta el argumento hasta el `=` y se mira si **es**
una de las exentas. Tres, enumeradas a mano y con su motivo, en `FORCE_EXENTAS`. Cualquier
`--force-…` nueva sigue bloqueada mientras nadie la escriba ahí — que es la única forma de aflojar
un guard de seguridad sin abrir un agujero invisible. Un test fija la lista: si crece, hay que
tocar el test y explicar por qué.

**Se comparan PALABRAS, y esto se midió antes de escribirlo.** El primer intento filtraba las
entrecomilladas y lo tumbó un test de SCRUM-454 que tenía razón: una bandera entre comillas el
shell la entrega igual. La mención la borra antes `descontarTexto`, que sustituye la carga de texto
entera (un `commit -m "…"` llega como `[git, commit, -m, MENSAJE]`). Las comillas no eran la
frontera entre mencionar y ejecutar; filtrarlas habría abierto justo esa vía de escape.

## 🔴 Un agujero PREEXISTENTE que encontró el control negativo

Al enumerar lo que tenía que seguir cazando apareció que **la forma corta `-f` en `git push` pasaba
el guard entero**. Es la misma orden con otro nombre y nadie la miraba. No lo abrió este ticket: lo
encontró. Se cierra **acotada a `git push`** — en `rm`, `grep` o `npm i` esa misma letra significa
otras cosas, y bloquearla en general sería fabricar el falso positivo que este ticket viene a quitar.

## Controles

**EL ROJO, corrido antes del arreglo:** los tres tests nuevos en rojo, con el de calibrado listando
las cuatro banderas bloqueadas sin motivo.

**EL CONTROL NEGATIVO, enumerado uno a uno** — 15 casos que siguen bloqueados: el push forzado
(pelado, con destino explícito y con la bandera al final), `--force-with-lease` (con y sin `=valor`),
`--force-if-includes`, la forma corta en `git push`, el reseteo de Prisma que tira el esquema
(invocado por npx y por la ruta correcta), `git checkout --force`, `git clean -fd --force`,
`npm install --force`, `git rebase --force-rebase`, y la bandera pelada en un programa cualquiera.

**SUELO:** si la lista de casos peligrosos baja de 14, el test **falla declarándose ciego** en vez
de aprobar. Un control negativo vacío da verde igual que uno que funciona, y ése es justo el fallo
que no puede quedar oculto en un guard de seguridad.

**EL HOOK CORRIDO**, no la función: 8 casos por stdin contra el fichero real, mirando el código de
salida (2 = bloquea). Los ocho, como dice el control.

`npm test` **5141 tests, 0 fallos** · `guards-entrada` 4/4.
