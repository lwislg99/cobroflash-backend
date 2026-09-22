# SCRUM-925 · `scrum804` se ponía rojo solo — y no era por los worktrees

**Medido contra:** `origin/main` = `adaef3c4aee5d72f02d39037edf133d09e37e2b5` · 2026-09-17T18:57:14+01:00
**Rama:** `scrum-925`

`tests/scrum804-la-rama-viva.test.mjs` daba `129 !== 130` en pasadas en las que nadie había tocado
el censo, y acusaba al instrumento de perder una rama concreta
(`scrum-678-los-webhooks-sin-secreto`).

---

## ① LA HIPÓTESIS DEL TICKET, REPRODUCIDA A PROPÓSITO Y **FALSADA**

El ticket traía —de mi propio informe de ayer— que la causa era *«otra sesión tiene una rama tomada
en otro worktree»*. Se probó:

| | |
|---|---|
| línea base | `scrum804` → **9/9, rc=0** |
| rama propia (`scrum-925-sonda-worktree`) tomada en un **segundo worktree**, confirmada con el `+` de `git branch -a` | `scrum804` → **9/9, rc=0** |

**No cae. La hipótesis es falsa.**

Y no podía ser cierta, lo que hace peor mi diagnóstico de ayer: **en este fichero no hay ni un
`git branch -a`**. El censo y `refsCrudas()` leen los dos `refs/remotes/origin/` con
`for-each-ref` — la misma pregunta a la misma fuente. El estado de los worktrees no entra.

> 🔒 **Ayer convertí una observación en un diagnóstico.** Vi el `+` junto a `scrum-678` en
> `git branch -a`, encajaba con el fallo, y lo escribí como causa. Era una coincidencia: esa marca
> sale siempre que alguien tiene una rama tomada, y aquí no la lee nadie. Es la trampa nº1 del
> tablero y caí en ella con la explicación puesta.

## LA CAUSA REAL: no era de FUENTE, era de MOMENTO

    · el censo se tomaba AL IMPORTAR el módulo    → const censo = rastroDeLosTickets(...)
    · refsCrudas() leía EN VIVO dentro de cada test, minutos después
    · y refs/remotes/origin/* está COMPARTIDA por los ~26 worktrees del repositorio

El `git fetch --prune` de cualquier compañero entre el import y la aserción movía la lectura viva y
no el instantáneo. **El comentario del propio test ya prometía** «el censo y git contando la MISMA
población en la MISMA pasada» — y el código no lo hacía.

### Reproducido, determinista, y sin tocar una ref compartida

En un **clon aislado** (provocar esto en el repo de verdad se lo provocaría a las demás sesiones,
que es justo el defecto que se cierra):

```
instantáneo del censo ... 710 ramas
lectura viva (misma pasada) ... 710 ramas
¿cuadran? SÍ

tras la llegada de UNA ref: lectura viva ... 711 ramas
el instantáneo sigue diciendo ... 710

REPRODUCIDO: SÍ  (710 !== 711)
la diferencia, nombrada: scrum-9999-rama-que-llega-a-mitad
```

`710 !== 711` es **la forma exacta** del `129 !== 130` de producción.

## ② LA POBLACIÓN, DECLARADA — y por qué la pregunta del encargo no aplicaba

El encargo pedía elegir entre `git branch -a` y `for-each-ref` porque «una incluye el estado de los
worktrees y la otra no». **Esa elección no existe aquí:** no hay ningún `git branch -a`, y las dos
lecturas que discrepaban eran **la misma orden sobre la misma fuente en dos momentos distintos**.

Así que lo que se declara no es *qué se lee* sino **cuándo**:

> **POBLACIÓN: las tres lecturas de `refs/remotes/origin/` —todas, `--merged`, `--no-merged`—
> tomadas en un solo bloque pegado al censo.** Las pruebas usan ésas y no vuelven a preguntar a
> git. Dos lecturas en momentos distintos no son dos opiniones que promediar: son dos poblaciones.

No se promedia y no se elige «la del número redondo»: se elige la que el censo **vio**, porque es la
única contra la que tiene sentido compararlo.

## ③ EL ROJO NOMBRA, Y ④ TIENE SUELO

- **No se puede instantaneizar una tienda de refs compartida.** Lo que sí se puede es **detectar que
  se movió**: se relee al terminar y, si cambió, la pasada se declara `NO FIABLE` **nombrando la ref
  que entró o salió** (`+ scrum-200-… (llegó a mitad)` / `- … (se podó a mitad)`). No se aprueba
  nada: se declara.
- **Y cuando sí se puede comparar, se comparan CONJUNTOS y se nombran las diferencias**
  (`soloEnGit` / `soloEnElCenso`), no un `129 !== 130` que manda a buscar a ciegas.
- **SUELO (④):** cero refs listadas → **CIEGO** y falla. Cuadrar el censo contra una población vacía
  es cuadrar dos ceros.

## LOS DOS CONTROLES, EJECUTADOS

Sobre poblaciones **fabricadas**, no sobre el árbol: el árbol de hoy puede no tener una rama sin
slug, y un control que depende de que exista pasa por vacío el día que no está.

| | qué exige | resultado |
|---|---|---|
| 🔴 **ROJO REAL** | una rama **sin slug** (`scrum-925` a secas) que el censo pierde sigue cayendo **con su nombre** | ✅ `['scrum-925 → SCRUM-925']`, y con el censo completo **no** acusa |
| ✅ **VERDE QUE DECIDE** | una ref que llega a mitad se nombra como movimiento, **no** acusa al censo | ✅ `['+ scrum-200-llega-a-mitad (llegó a mitad)']`, y sin movimiento la pasada sigue siendo fiable |

Las dos mutaciones se verifican: **exactamente una** pérdida y **exactamente una** ref movida. Y la
poda se comprueba en la otra dirección, porque entrar y salir son el mismo defecto por los dos lados.

> **El ROJO REAL es el que importa.** Arreglar el falso positivo no puede apagar el verdadero: si al
> quitar el ruido se va la señal, el guard está roto, no arreglado. Por eso el control lleva sus dos
> mitades — con el censo completo no acusa, con el censo mutilado acusa y nombra.

## Lo que NO se ha tocado

⛔ **No se ha relajado lo que el guard exige** (regla 41). Cuando la tienda no se mueve, las
comparaciones son las mismas y caen igual. Lo único que deja de pasar es acusar al censo de perder
una rama que llegó **después** de que el censo mirara.
⛔ **Ninguna rama de otra sesión**, ni para reproducir. La sonda fue mía y se retiró (worktree
eliminado y rama borrada).
⛔ **Ninguna ref compartida mutada.** La reproducción vive en un clon.
