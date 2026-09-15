# SCRUM-836 · ANCLA-QUE-SOBREVIVE: el meta-guard llevaba 7 días ciego, y su rojo no bloqueaba

**Fecha:** 15-sep-2026 · **Carril:** B (guard) · **Gate:** fase ① sin gate; fase ② PENDIENTE del fundador
**Medido contra:** `origin/main` = `47f9180fe84b03db4badac03eea05969cdcfb4f2` · 2026-09-15T10:35:49+01:00
**Tanda:** ver «Verificado en rojo»

> **Una alarma que suena donde nadie está obligado a escucharla no es una alarma.**

## Lo que el ticket promete, ENTERO — y qué queda

| | promete | estado |
| --- | --- | --- |
| **①** | reparar el ancla de la mutación → `ciegas 0` | ✅ **entregado aquí** |
| **②** | el meta-guard pasa a check **OBLIGATORIO**, y su rojo bloquea el auto-merge | 🔴 **NO ES CÓDIGO** — ver abajo |

Y lo que ya había en `main` con este número, medido antes de tocar nada — **ninguna de las dos
fases**:

* `836b` (PR #1216) — **sólo documentación**: 9 líneas de comentario en `pr-automatico.yml`
  explicando que el filtro `scrum-*` deja fuera las ramas `claude/pr-*`. No tocó mecanismo.
* `836c` (PRs #1218, #1219) — dos frases al canon de `docs/equipo/sesion-5.md`. Nada del meta-guard.

## El defecto

El 8-sep-2026 a las 09:24, `278a8bd7` (SCRUM-824b) partió en dos un `if` de
`scripts/_ritmo-de-despliegue.mjs`. **El cambio era correcto** — aquel `||` producía un rojo
intermitente en CI, que entrena a relanzar la tanda y es peor que un rojo fijo. Pero la mutación ③
de `scrum716` estaba anclada al texto exacto de esa línea, y el texto dejó de existir:

```
vivas 165 · mudas 0 · ciegas 1 · ficheros muertos 0
🔴 CIEGO: scrum716-ritmo-de-despliegue.test.mjs · el ancla no está en `scripts/_ritmo-de-despliegue.mjs`
```

## Lo que se midió

* **Desde cuándo**, datado con `git log -S` sobre el texto exacto del ancla y no deducido del
  ticket: nació en `935115cb` (7-sep 03:02) y murió en `278a8bd7` (8-sep 09:24). **Siete días.**
* **Qué entró mientras tanto:** **54 PRs y 218 commits** en `main`. Y **ninguno** tocó el fichero
  vigilado ni su guard, así que la ceguera **no se iba a curar sola**.
* **Cuánto se dejó de vigilar, acotado:** `ciegos` se apunta **por mutación**, dentro del bucle
  `for (const mut of mutaciones)`. Se perdió **1 de 167**; las otras cuatro de ese mismo guard
  siguieron ejerciéndose. El meta-guard **no aborta** ante una ciega: la descarta y sigue.
* **Y no estaba tapando un guard muerto:** tras reparar, la mutación sale **VIVA**, no muda — el
  test que debe caer ejercita `'1788742571305'`, `'no-soy-un-sha'`, `''`, `null`…

## La decisión, y por qué

**No se restaura el ancla vieja.** Volver al `||` desharía el arreglo de SCRUM-824b, que estaba
bien hecho y por un motivo medido.

**Anclar a la línea de un filtro es anclar a cómo está escrito HOY ese filtro** — y un filtro es
justo lo que se reescribe cuando se afina. Por eso el ancla pasa a ser **la identidad de la función
que filtra**: la cabecera de `shaLegible` y su normalización, que son su contrato. La mutación
inserta un `return s;` que corta la función **antes de cualquier filtro**.

La propiedad que se gana: da igual cuántos filtros haya dentro, cómo estén escritos o en qué orden
— **los apaga todos, los de hoy y los que se añadan**. El defecto imitado sigue siendo el mismo:
`shaLegible` deja de decir «no se sabe» ante una lectura que no entiende.

Comprobado **antes** de escribirla: el ancla es **única** en el fichero, y `node --check` confirma
que el fichero mutado **parsea** — el resto de la función queda como código inalcanzable, no como
código roto. Es la lección escrita en la mutación ① de ese mismo guard: *una mutación con más radio
que el defecto que imita no prueba nada.*

### La red que faltaba, y dónde faltaba

Lo que falló **no fue la detección**: el meta-guard lo dijo desde el minuto uno. Falló **quién lo
decía** — un job que tarda minutos y **no bloquea** el auto-merge, cuyo rojo se leía como
«6 of 7 checks passed». Por eso se añade `tests/scrum836-ancla-de-mutacion-viva.test.mjs`, que
comprueba **la mitad barata** —que el `de` de cada mutación exista hoy, byte a byte, en su
fichero— **sin mutar y sin correr tests**, dentro de `npm test`, que sí bloquea.

⚠️ **No sustituye al meta-guard y lo dice en su cabecera:** un ancla presente puede salir MUDA
igual, y eso sólo se sabe ejecutándola.

## 🔴 La fase ②: por qué NO se entrega, y qué hace falta

El auto-merge espera al **check obligatorio**, y esa lista vive en la **protección de rama de
GitHub** — no está versionada en el repositorio (no hay ruleset en `.github/`) y `gh` no está
instalado a propósito, porque el PR lo abre el fundador. **No es algo que una sesión pueda hacer
desde el código.**

Lo que hay que hacer, con el nombre exacto tal y como lo publica `ci.yml`:

> Settings → Branches (o Rulesets) → `main` → **Require status checks to pass** →
> añadir **`meta-guard · los guards caen cuando deben`**

Y su verificación, que el ticket exige y también es del fundador: provocar un PR con el meta-guard
en rojo y comprobar que **no se mergea**. Hay precedente de cómo hacerlo limpio, canonizado por
`836c` a partir de SCRUM-834: *un control que introduce un defecto a propósito se diseña por su
limpieza, no por su resultado* — rama borrada, PR cerrado **sin mergear**, y comprobado aparte que
ni el commit ni el fichero llegaron a `main`.

## Verificado en rojo

**① El meta-guard, pasada completa** (`npm run meta:mutaciones`, exit 0):

```
✔ scrum716-ritmo-de-despliegue.test.mjs · una lectura ilegible da NO SE SABE, no un veredicto a medias
vivas 167 · mudas 0 · ciegas 0 · ficheros muertos 0
```

**② El control positivo que exige el ticket**, con la función REAL del meta-guard (`aplicarUna`),
sin pagar otra pasada entera:

```
ANCLA NUEVA  → ✔ VIVA (el guard cae con la mutación)
ANCLA VIEJA  → ✔ CIEGO · el ancla no está en `scripts/_ritmo-de-despliegue.mjs`: la declaración caducó
```

Sabe volver a ponerse ciego: **no se ha apagado**.

**③ El guard nuevo, roto a propósito sobre el árbol real** (ancla devuelta a la forma caducada):

```
not ok 5 - SCRUM-836 · 🔴 NINGUNA mutación declarada tiene el ancla caducada
    scrum716-ritmo-de-despliegue.test.mjs → scripts/_ritmo-de-despliegue.mjs
        el ancla `de` no está en el fichero
# pass 4 · fail 1
RESTAURADO byte a byte: ✅ idéntico
```

## Lo que NO cubre

* **La fase ② no está hecha**, y hasta que lo esté **este mismo arreglo puede volver a caducar sin
  que nadie lo pare**: el rojo seguirá sin bloquear. Es la mitad que más protege del ticket.
* El guard nuevo cubre **el ancla ausente**, no la mutación muda ni el fichero muerto. Eso sigue
  siendo trabajo de `meta:mutaciones`, que se ejecuta y cuesta minutos.
* **No se toca `RE_ANCLA` de nadie, ni se relaja ningún guard, ni se apaga ninguna mutación** — las
  tres cosas que el ticket prohíbe expresamente.

## Ficheros

* `tests/scrum716-ritmo-de-despliegue.test.mjs` — la mutación ③, reanclada a la identidad de
  `shaLegible`, con el motivo escrito al lado.
* `tests/scrum836-ancla-de-mutacion-viva.test.mjs` — la red en la tanda que sí bloquea.
