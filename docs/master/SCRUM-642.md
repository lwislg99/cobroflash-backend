# SCRUM-642 · ⟦arranque⟧ parte el arranque en sus tramos

**Fecha:** 2-sep-2026 · **Carril:** B · **Gate:** desbloquea SCRUM-626
**Medido contra:** `origin/main` = `9ae6ec070d76da8fbad21d8d6209f2ffd609eab6` · 2026-09-02T00:00:00+02:00
**Rama:** `scrum-642-tramos-del-arranque`

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

---

## EL TICKET, EN UNA LÍNEA

La marca nació para separar «arrancar» de «comprobar», y **repetía un nivel más abajo el problema
que vino a resolver**: un solo número para un proceso de cinco tramos, de los que el tope sólo
vigila dos —y a cada uno le da su presupuesto ENTERO—.

Por eso un arranque de 39,2 s sobrevivió a un tope de 30 s sin que nada estuviera roto, y por eso
la tabla de muestras mezclaba dos cosas distintas en la misma columna.

## 1 · LO QUE MIDE CADA TRAMO (fuente de puppeteer 25.3.0, `BrowserLauncher.ts`)

| Tramo dentro de `launch()` | ¿tope? | Dónde cae ahora |
|---|---|---|
| `computeLaunchArguments` (:135) | ❌ | `proceso+ws` |
| `launch({...})` — arrancar el proceso (:164) | ❌ | `proceso+ws` |
| `waitForLineOutput(…, opts.timeout)` (:382) | ✅ **presupuesto entero** | `proceso+ws` |
| `WebSocketTransport` + `Connection` + `Browser` (:386-393) | ❌ | `proceso+ws` |
| `waitForPageTarget` → `waitForTarget` (:291, :362) | ✅ **OTRO presupuesto** | `primera-página` |

## 2 · CÓMO SE PARTE, Y POR QUÉ EN DOS Y NO EN CINCO

Sólo con opciones documentadas: `waitForInitialPage: false`, y a continuación **la misma espera
que hace puppeteer en :291**, con el mismo tope y cerrando el navegador igual si falla (:363).
Mismas operaciones, mismo orden, mismo resultado — con un reloj en medio.

**Partirlo en cinco exigiría llamar a `@puppeteer/browsers` y `puppeteer.connect()` por separado,
o sea reimplementar `launch()`** (perfil temporal, limpieza, viewport, señales). Y entonces lo
medido sería NUESTRO arranque, no el de puppeteer: **números incomparables con las muestras que
Javier ya tiene**, que es exactamente lo contrario de lo que hace falta. No se hace.

### 🕳️ Hueco declarado

Dentro de `proceso+ws` siguen juntas **la fase 1 presupuestada y los tramos sin presupuesto que
la rodean**. Medido con `timeout: 1` (el `launch` muere en la fase 1 casi al instante, así que lo
que queda es el trozo previo): **0,03 s en local**. O sea que ahí dentro manda la espera del WS
endpoint. **En el runner ese reparto NO está medido** — el mismo truco serviría para acotarlo allí.

Esto es lo que impide, hoy, el control que pedía el encargo en su forma literal: forzar lentitud
en un tramo SIN presupuesto y que la marca lo señale **aparte de la fase 1**. Los dos viven en
`proceso+ws`. Cerrarlo cuesta la reimplementación de arriba, y esa decisión no es mía.

## 3 · UNA MEDIDA CORTADA YA NO SE IMPRIME COMO UNA COMPLETA

```
⟦arranque⟧ 19.6 s COMPLETA · proceso+ws 19.2 s · primera-página 0.4 s
⟦arranque⟧ 30.0 s CORTADA EN «proceso+ws» · proceso+ws ≥30.0 s · primera-página SIN MEDIR
```

El bloque de error decía **«tardó 30,0 s antes de rendirse»**, que se lee como una duración cuando
es un reloj parado. Ahora dice que el reloj **llegó ahí y se cortó**, y que lo que habría tardado
no lo sabe nadie porque se dejó de mirar.

## 4 · CONTROL POSITIVO EN LAS DOS DIRECCIONES

La misma lentitud (0,7 s) metida en un tramo o en el otro, con un doble de puppeteer:

| Dónde se mete | Lo que imprime la marca |
|---|---|
| en `proceso+ws` | `proceso+ws 0.7 s · primera-página 0.0 s` |
| en `primera-página` | `proceso+ws 0.0 s · primera-página 0.7 s` |

Y hay un test que **compara las dos**: si salieran iguales, la marca no distinguiría nada y el
ticket no estaría hecho. Los totales sí se parecen —es la misma espera—, que es el control de que
no se está inventando tiempo.

## 5 · EL ROJO, PROBADO POR EL MECANISMO

Tres roturas deliberadas sobre el código ya commiteado. Cada una tumba lo suyo y nada más:

| Rotura | Qué cae |
|---|---|
| volver al número único | «dice DÓNDE», las dos direcciones y la comparación · **4 rojos** |
| anunciar una cortada como completa | los dos cortes · **2 rojos** |
| separar el total de la marca | la lectura de la puerta y la comparación · **2 rojos** |

## 6 · LO QUE NO SE HA TOCADO

`guards-visuales.mjs`, `TOPE_ARRANQUE_POR_DEFECTO`, el trinquete de SCRUM-617, el workflow,
`guard:contraste` y el código de salida (SCRUM-639). **No se propone ningún tope.**

Un test comprueba que la puerta —que no se toca— sigue extrayendo el total **en las dos formas**,
la completa y la cortada. Si el formato dejara de encajar, la puerta no fallaría: pintaría
«(arranque: ?)» para los nueve, que es la peor manera de romperlo.

## 7 · NÚMEROS

* **Suite: 4.199 tests · 4.120 verdes · 0 rojos · 79 saltados.**
* Los 9 guards de navegador, con navegador de verdad: **verdes, EXIT 0, 50,8 s en serie.**
* Tests nuevos: `tests/scrum642-tramos-del-arranque.test.mjs`, **9**, sin navegador (doble).

### Un dato para la dispersión de SCRUM-626

La primera pasada de los nueve dio **113,0 s** y la segunda, **sobre el MISMO árbol, 50,8 s**. La
causa estaba medida: **11 procesos de Edge huérfanos** que dejó un experimento anterior. Los
arranques no se movieron (0,3-0,9 s en las dos), así que el sobrecoste fue de los guards, no del
navegador. Se anota porque es una muestra de cuánto mueve estos números la carga de la máquina —
y el runner es una máquina compartida.
