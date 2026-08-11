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

## Lo que propongo, y lo que NO

**NO propongo avisar.** La regla existe, se conoce y se ha saltado cuatro veces; repetirla es lo que
este ticket dice que no funciona.

**Propongo ampliar `guard-dangerous.mjs`** —que ya es un mecanismo, no una costumbre— para que ante
un comando de la familia **compruebe el estado ANTES** y bloquee solo si **hay algo que perder**:

- `git checkout -- X` / `git restore X` / `git clean` / `reset --hard` → bloquear **si**
  `git status --porcelain` no está vacío para esa ruta;
- `> X` → bloquear **si** `X` ya existe.

⚠️ **CONTROL NEGATIVO OBLIGATORIO, y es el que decide si esto vale**: un `>` sobre un fichero
**nuevo** no puede caer, y un `git checkout --` con el árbol limpio tampoco. Una barrera que bloquea
lo legítimo se desactiva entera en una semana, y entonces protege menos que ninguna.

**No lo he construido en esta tanda**: el hook es infraestructura compartida por las cuatro sesiones
y un falso bloqueo las para a todas. Pido GO con el diseño delante.

## Los dos tickets que salen de aquí (cap 3, gasto 2)

1. **La autorreferencia de la barrera** — que no se dispare con comandos que solo *mencionan* el
   patrón. Hoy impide verificarla, y una barrera que castiga a quien la comprueba deja de
   comprobarse.
2. **`git worktree remove` y las cadenas de junction** — SCRUM-429 midió que hay cadenas
   (`wt-215-probe`, `wt-216-consolidar`, `wt-248-fixtures` → `wt-209-conflicto`) y que un
   `worktree remove` siguió una y **vació el `node_modules` compartido, dos veces**. Es la misma
   familia —destructivo sin comprobación previa— pero el mecanismo es distinto y merece su ticket.
