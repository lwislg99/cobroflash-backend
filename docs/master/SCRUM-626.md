# SCRUM-626 · El experimento NO se puede decidir aquí — y el «30,0 s» del log no es una medición

**Fecha:** 1-sep-2026 · **Carril:** B · **Gate:** medición — NO se ha tocado ni el tope ni el orden
**Medido contra:** `origin/main` = `775bf7e04e4c0f55ca23ad4c9bfe58a0b365c3dc` · 2026-09-01T22:00:00+02:00
**Rama:** `scrum-626-arranque-en-frio` (sale de `scrum-625-formato-importe`, `fd5a9911`)

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

> **🕳️ HUECO:** el MCP de Atlassian sigue caído y **`gh` no está instalado** (medido en SCRUM-638:
> `EXIT 127` en las dos shells). No puedo lanzar el CI, ni ver el histórico, ni leer otro log.

---

## 🔴 LO PRIMERO, PORQUE CAMBIA EL PLAN: «30,0 s» ES EL TOPE, NO EL TIEMPO

El encargo dice: *«si el arranque frío tarda 30,0 s contra un tope de 30 s, esto sería
intermitente»*. **Esa lectura no se sostiene.** El log dice:

```
tardó 30.0 s antes de rendirse, con un tope de 30000 ms.
Detalle: Timed out after 30000 ms while waiting for the WS endpoint URL to appear in stdout!
```

`30.0 s` **es el cronómetro llegando al tope**, no el arranque terminando. Puppeteer abandonó. El
arranque en frío real **no se midió**: sólo sabemos que es **> 30 s**. Podría ser 31 o 90.

**Consecuencia directa sobre el punto 2 del encargo,** que pide medir antes de subir la constante:
**aquí ese orden es imposible.** La medida está *censurada por el propio tope*, así que hay que
**subirlo PARA medir** — y luego fijarlo con el número. Eso no es «subir a ver si cuela»: es la
única secuencia que produce un número.

> Y el repo ya lo tenía previsto: `topeDeArranque()` lee **`NAVEGADOR_TIMEOUT_MS`**, y su comentario
> dice literalmente *«lo sube SOLO PARA MEDIR»* (`_navegador.mjs:143-147`). La herramienta para
> hacerlo bien ya existe; lo que falta es una ejecución en el runner con esa variable puesta.

---

## 1 · EL EXPERIMENTO DEL ORDEN: **INCONCLUSO AQUÍ — que no es lo mismo que refutado**

Se ejecutaron **las dos** pasadas que pedía el encargo, en esta máquina:

| Pasada | Primero | Arranques medidos |
|---|---|---|
| **(a) orden actual** | `guard:contraste` | contraste **0,4 s** · los otros ocho **0,3 s** |
| **(b) reordenado** | `guard:caja-avisos` | **los NUEVE a 0,3 s** |

**El muerto no se movió porque aquí no hay muerto.** El «primero más lento» son **0,1 s** en la
pasada (a) — y en la (b) **desaparece en vez de mudarse**, o sea que era **ruido**, no efecto de
posición.

> 🔴 **Por eso NO digo que tu explicación sea falsa.** El encargo decía: «si el muerto no se mueve,
> mi explicación es falsa». Esa regla vale **donde el fenómeno existe**. Aquí no existe: Edge está
> caliente en Windows y el arranque es 0,3 s en las nueve posiciones, contra los 30 s / 10,4 s /
> 0,3 s del runner. Un experimento que no puede producir el efecto **no puede refutarlo**.
>
> Confundir «no lo reproduzco» con «no ocurre» sería el error que esta casa lleva toda la semana
> cazando, y no lo voy a cometer en el ticket que existe para no cometerlo.

**Y la curva del runner sigue siendo la mejor evidencia que hay:** `30,0 → 10,4 → 0,3` son **tres
valores monótonos decrecientes** en tres arranques consecutivos del mismo binario. Eso es una
curva de calentamiento, y no la explica el contenido de `guard:contraste` — que además pasa en
local. La hipótesis **sobrevive**; lo que falta es ejecutarla donde el efecto existe.

## 2 · El número: **no lo tengo, y no se puede sacar desde aquí**

Sin `gh` no puedo lanzar el runner ni con `NAVEGADOR_TIMEOUT_MS` puesto. **No propongo ninguna
constante nueva**, porque sería exactamente lo que el encargo prohíbe: una hipótesis disfrazada.

Lo que hace falta es **una ejecución del job con `NAVEGADOR_TIMEOUT_MS=180000`** (o cualquier techo
holgado): con eso, el `⟦arranque⟧` que ya imprime `_navegador.mjs:171` dará **el arranque frío real**
en vez de un tope alcanzado. Un solo número, y el ticket se cierra.

## 3 · La intermitencia: **no la puedo comprobar, y además la pregunta cambia**

No tengo histórico de ejecuciones. Pero hay algo que sí se puede decir con lo medido:

**Si el arranque frío real fuese, digamos, 45 s, el fallo NO sería intermitente: sería seguro.** Lo
que haría intermitente el resultado es que el valor real **cruce** los 30 s según la carga. Y eso
**no se puede saber sin subir el tope** — otra vez la misma censura del punto 0.

> Que `main` esté verde en #1426 **no prueba intermitencia**: prueba que en esa ejecución arrancó
> por debajo del tope. Con una sola observación verde y tres rojas no se distingue «intermitente»
> de «casi siempre falla». Hace falta el número, no más ejecuciones a ciegas.

## 4 · ¿Un tope distinto para el primer arranque? — **las salidas, sin elegir**

| | Salida | Consecuencia |
|---|---|---|
| **A** | **Un solo tope, más alto** | Simple y en un sitio. Pero dimensiona los nueve por un peor caso que ocurre **una vez**: un guard que de verdad se cuelgue tardaría el tope nuevo × 9 en decirlo. |
| **B** | **Tope distinto para el PRIMER arranque** | Ajusta cada caso a su realidad. Cuesta un concepto nuevo («el primero») en `_navegador.mjs`, y hay que decidir quién sabe que es el primero: ¿el agregador, o el módulo? |
| **C** | **Calentar el navegador ANTES de los nueve** | Un arranque de descarte al principio, fuera de la medición. Deja el tope de 30 s intacto y hace que ningún guard pague el frío. ⚠️ Pero **añade un arranque** al job y hay que decidir si su fallo es «no supe mirar» (2/3) o algo nuevo. |
| **D** | **No tocar el tope; declarar el primer arranque como coste conocido** | Cero código. No arregla nada: los PR siguen rojos. |

**Recomendación medida: C, y sólo si el número del punto 2 confirma que el frío es un único
arranque caro.** Es la única que **no** dimensiona los nueve por el peor caso de uno y **no**
inventa un tope por posición. Pero **depende del número**, así que no la doy por buena: si el frío
resultara ser 25 s y el segundo 20 s, C no bastaría y la respuesta sería A.

🛑 **Y no propongo tocar nada todavía.** Sin el número, elegir entre A, B y C es preferencia.

## Lo que NO se ha hecho

* **No se ha tocado el tope** ni `TOPE_ARRANQUE_POR_DEFECTO`.
* **No se ha reordenado nada como arreglo.** El reorden fue **el experimento**, y `package.json`
  quedó **restaurado byte a byte** (`Buffer.compare = 0`, y `git status` limpio).
* **No se ha relajado `guard:contraste`** ni se le ha puesto `skip`.
* **No se ha tocado el exit code del agregador** (SCRUM-639) ni el workflow del CI.
* **No se ha tocado SCRUM-636**, que queda aparcado en su rama con sus rojos declarados.

## Lo siguiente, concreto

1. **Una ejecución del job `guards de navegador` con `NAVEGADOR_TIMEOUT_MS=180000`.** El
   `⟦arranque⟧` de esa pasada da el arranque frío real. Es el único dato que falta.
2. Con ese número, elegir entre A / B / C — y entonces sí, subir la constante **con el número
   delante**.
