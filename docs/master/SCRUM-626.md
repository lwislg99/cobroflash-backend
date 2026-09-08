# SCRUM-626 · El arranque en frío que se paga UNA vez

**Fecha de cierre:** 8-sep-2026 · **Rama:** `scrum-626-el-arranque-en-frio-que-se-paga-una-vez`

**Medido contra:** `origin/main` = `24f8cb4dcfd1dba2c9d9d857880952639273f214` · 2026-09-08T07:20:07+01:00

> ⚠️ **El antes/después de `guards:visuales` se corrió contra `15b42968`, no contra este sha** —
> `main` se movió dos veces mientras se trabajaba, que es exactamente el incidente que originó
> SCRUM-267—. No se repite la medida, y el motivo está **medido, no supuesto**: pasar de
> `15b42968` a `24f8cb4d` trajo **4 ficheros, los cuatro bajo `docs/`**
> (`git diff --name-only 15b42968 origin/main | grep -v "^docs/"` da **0**). No hay una línea de
> código que pueda haber movido esos números. Si hubiera tocado `scripts/`, habría que repetirla.

> Este ticket se trabajó en **dos ramas**, y las dos entran: una **DIAGNOSTICA** y la otra
> **MITIGA**. No se parte el ticket y no se elige entre ellas — sin el diagnóstico, el
> calentamiento sería una constante puesta a ojo; sin la mitigación, el diagnóstico se queda en
> un hallazgo sin arreglo. **Los dos documentos originales se conservan ENTEROS más abajo, sin
> quitarles una línea.**

---

# 🔴 EL DATO QUE LO DESBLOQUEA — y confirma LAS DOS MITADES

**Procedencia:** ejecución real de `guards:visuales`, **8-sep-2026**, aportada por **el
fundador**. No es una medida de esta sesión: ninguna sesión puede ver el CI (SCRUM-618), y ése
era exactamente el bloqueo que este ticket declaró desde el primer día.

```
guard:contraste        45,6 s · arranque 32,5 s · verde
los otros catorce      arranque 0,3 s          · verdes
TOPE_ARRANQUE_POR_DEFECTO = 30.000 ms
```

## Qué prueba, punto por punto

**1 · El diagnóstico tenía razón: «30,0 s» era EL TOPE, no el tiempo.** El tiempo real es
**32,5 s**, y está **POR ENCIMA** del tope de 30 s. El dato estaba **censurado por el propio
tope** —no se podía medir sin subirlo— y esa lectura queda ahora **confirmada desde fuera**.

**2 · La mitigación es el arreglo correcto.** 32,5 s la primera vez y **0,3 s las catorce
siguientes** no es una anomalía aleatoria: es **coste de arranque en frío**, y se paga **una
sola vez** por tanda. Calentar antes de la fila es exactamente pagarlo donde no custodia ningún
verde.

**3 · Y satisface la advertencia que la propia mitigación se puso.** Decía, y con razón:

> *«si el calentamiento hace que deje de morir, la anomalía no se ha explicado: se ha escondido»*

Ya no se esconde: **está explicada**, y por un dato ajeno a quien construyó el arreglo. La
diferencia entre las dos cosas es este bloque.

## ⛔ Y lo que NO se toca por saber esto

**`TOPE_ARRANQUE_POR_DEFECTO` sigue en 30.000 ms.** No se sube. El razonamiento es del propio
ticket y no ha caducado: **si el calentamiento funciona no hace falta subirlo; si hiciera falta
subirlo, es que no funciona.** Un tope que crece para tapar un arranque que no se ha explicado
es la constante a ojo que SCRUM-617 prohibió.

---

# ① EL DIAGNÓSTICO — `scrum-626-arranque-en-frio` (1-sep-2026)

> Conservado **entero**, tal como lo dejó su sesión. Su título dice que el experimento no se
> podía decidir allí, y era cierto: el dato que faltaba es el de arriba.

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

---

# ② LA MITIGACIÓN — `scrum-626-calentar-el-navegador` (2-sep-2026)

> Conservada **entera**. Construye el calentamiento declarado que **no aborta**, con sus huecos
> declarados — de los cuales el nº 2 (la anomalía sin explicar) queda **cerrado por el dato del
> principio de este documento**.

# SCRUM-626 · Calentar el navegador antes de los nueve guards

**Fecha:** 2-sep-2026 · **Carril:** S3
**Medido contra:** `origin/main` = `354fdca362063a79a928ed5df7c5120363d64c0b` · 2026-09-02T17:37:37Z
**Rama:** `scrum-626-calentar-el-navegador`

**La víctima:** cada sesión que intenta mergear. `guard:contraste` muere y tumba el CI; tumbó el PR
de SCRUM-670. Lleva días.

---

## PASO 0

**ENTRADA:** `scripts/guards-visuales.mjs`, dentro de `puerta()`, **entre `resolverNavegador()` y
el bucle `for (const g of lista)`**. Es el sitio natural y no hay otro: ahí ya está comprobado que
**hay** navegador y todavía **no ha arrancado ninguno**.

**MECANISMO: existe, y por eso el trabajo era darle superficie.** `lanzarNavegador`
(`scripts/_navegador.mjs`) ya sabe arrancar, cronometrar por tramos, reintentar tres veces
(SCRUM-673) y salir con el código que corresponde. No hacía falta escribir un arranque nuevo:
hacía falta **llamar a uno antes de la fila** y decidir qué hacer con su fallo.

## Las tres mediciones que pedía el encargo

**1 · Dónde empieza la fila.** Medido: `puerta()` hace tres cosas antes del bucle — el suelo de la
lista vacía, `resolverNavegador()`, y dos `console.log`. El calentamiento entra justo después.

**2 · ¿Basta con levantar el proceso, o hace falta abrir página?** **No se pudo medir, y por eso
se calienta el camino ENTERO.** El encargo advertía que «el coste está sólo en levantar el proceso»
era una inferencia, no un dato — y lo sigue siendo: en esta máquina **Edge no levanta en absoluto**
(`Failed to launch the browser process: Code: 0`, en **0,0 s**, ni siquiera llega al tope), así que
no hay forma de repartir el coste desde aquí. Ante la duda se calienta lo mismo que hacen los
nueve: proceso **y** primera página. Si `primera-página` de verdad cuesta 0,0, incluirla no cuesta
nada; calentar de menos por una inferencia sí costaría.

**3 · Qué pasa si el calentamiento falla.** Ver abajo: es la decisión del ticket.

## 🔴 LA DECISIÓN: EL CALENTAMIENTO NO ABORTA

El encargo pedía que un fallo **no se tragara en silencio** y que **se distinguiera de «un guard
encontró un defecto»**. Se cumplen las dos, y **sin abortar**:

> Un calentamiento no mide nada, no da veredicto y no protege ningún verde. Si un calentamiento
> fallido pudiera tumbar la tanda, le estaríamos dando exactamente el poder que acabamos de decir
> que no tiene.

Un fallo **transitorio** abortaría una tanda que los guards —tres intentos cada uno, SCRUM-673—
habrían sacado adelante. Eso es fabricar un «NO MEDIDO» falso. Así que el calentamiento **dice** su
fallo con su propia marca y en la gramática que ya existe («ESTO NO ES UN HALLAZGO… no da
veredicto… la tanda SIGUE»), y el veredicto lo siguen dando los nueve.

**Comprobado en vivo**, no razonado: en esta máquina el navegador no levanta, así que el
calentamiento falló de verdad. La tanda continuó y **salió con 3 (NO MEDIDO), no con 1**.

### Y el mismo argumento es el que permite un tope generoso

`TOPE_CALENTAMIENTO_POR_DEFECTO = 120_000`. Puede esperar mucho **porque no custodia ningún
verde**. `TOPE_ARRANQUE_POR_DEFECTO` sí los custodia y **no se ha tocado** — hay un test que lo
comprueba explícitamente.

### Marca propia, no `⟦arranque⟧`

`⟦arranque⟧` y sus tramos son de SCRUM-642 y los **lee** la tabla de la puerta (`leerArranque`). Si
el calentamiento emitiera esa marca, sus segundos se colarían en el desglose de algún guard y la
tabla contaría como arranque de alguien un arranque que **no es de nadie**. Usa `⟦calentamiento⟧`,
y hay un test que lo ata.

## Los rojos y los controles

| Prueba | Resultado |
|---|---|
| el proceso no levanta | devuelve `ok:false`, nombra el tramo `proceso+ws` y conserva el motivo |
| la página no llega | `ok:false`, tramo `primera-página`, **y cierra el navegador igual** |
| el aviso de fallo | contiene «NO ES UN HALLAZGO», «no da veredicto», «La tanda SIGUE»; y **no** contiene nada que suene a defecto de accesibilidad |
| **binario inexistente** | lo caza `resolverNavegador()` **antes** del calentamiento y sale con 2. El suelo previo funciona; ese camino nunca llega aquí |
| falta `puppeteer-core` | la puerta **no se cae**: se salta el calentamiento diciéndolo. Un calentamiento no puede impedir que corran los nueve |
| **CONTROL NEGATIVO** | la misma tanda con la versión de `origin/main` y con la nueva dan **el mismo veredicto, salida 3 y el mismo texto**. El calentamiento no cambia lo que dicen los guards |

Los doce tests corren en `npm test` **sin navegador**, con un doble de `puppeteer` y un reloj
inyectado — el patrón que ya usaba `lanzarNavegador`. Un guard que sólo se pudiera ejercitar con
nueve navegadores delante es un guard que no ejercita nadie.

## 🕳️ HUECOS DECLARADOS

**1 · El antes/después de la fila NO está medido de verdad.** Las dos pasadas dieron 27,6 s y
21,3 s, pero **en una máquina donde el navegador no levanta**: los nueve mueren al instante, así
que esa diferencia es ruido entre tiradas, **no** evidencia de mejora. Lo que aquí está probado es
el COMPORTAMIENTO (calienta, falla, no aborta, no cambia el veredicto); que AHORRE tiempo hay que
medirlo en el runner. Se dice en vez de vender la cifra.

**2 · 🔴 LA ANOMALÍA SIGUE SIN EXPLICAR, Y ESTO NO LA EXPLICA.** Tres de las cuatro muestras de
arranque estaban **por debajo** de 30 s —18,6 · 23,6 · 27,0— y aun así el guard murió **6 de 6** con
el tope en 30. Eso no cuadra, y **si el calentamiento hace que deje de morir, la anomalía no se ha
explicado: se ha escondido.** Queda escrito con esas palabras. *Un síntoma que desaparece sin
diagnóstico vuelve* — y volverá con otra forma, probablemente cuando nadie recuerde este ticket.

**3 · El terreno se ha movido desde que se redactó el encargo.** SCRUM-673 ya introdujo **tres
intentos** con topes 30/60/90 s, y está en `main`. O sea que la víctima que este ticket describe ya
tenía una red parcial antes de empezar. El calentamiento sigue valiendo —evita el frío en vez de
sobrevivirlo— pero **cuánto queda de la víctima original no está medido**, y eso también hay que
mirarlo en el runner antes de dar el problema por cerrado.

## Lo que NO se ha tocado

`TOPE_ARRANQUE_POR_DEFECTO` (SCRUM-617, con trinquete) · el marcador `⟦arranque⟧` y sus tramos
(SCRUM-642) · `tests/_banco-vistas.mjs` y `sw.js` (S2) · `prisma/schema.prisma`.

---

## ✅ EL CONTROL, CORRIDO AQUÍ — con números de la salida real

`npm run guards:visuales`, los 15 guards, **tres pasadas reales**, las tres **15 verdes · 0 no
verdes** y las tres con exit 0 leído de fichero:

| | `guard:contraste` · **arranque** | ese guard, total | la serie entera |
|---|---|---|---|
| **A · ANTES** — `main`, SIN calentamiento, máquina en reposo | **0,8 s** | 57,3 s | 278,7 s |
| **B · DESPUÉS** — esta rama, con calentamiento, máquina en reposo | **0,4 s** | 8,1 s | 212,5 s |
| **C · DESPUÉS** — el árbol que se empuja, con calentamiento, **máquina CARGADA** | **0,5 s** | 39,8 s | 537,5 s |

Y el calentamiento **se cuenta aparte**, como pedía el ticket, con su propia marca (pasada C):

```
⟦calentamiento⟧ 0.9 s · proceso+ws 0.9 s · primera-página 0.0 s  (tope 120000 ms)
   ✔ guard:contraste             39.8 s   arranque   0.5 s   verde
   15 guards · 537.5 s en serie   ·   verdes: 15 · no verdes: 0
```

### 🔴 De estos números, LO ÚNICO que se puede leer — y por qué los demás no dicen nada

⛔ **Los totales NO se comparan, y la pasada C es la prueba de por qué.** B y C son **el mismo
árbol, la misma máquina y el mismo binario**: 212,5 s y **537,5 s**. `guard:contraste` dio 8,1 s
y 39,8 s. La única diferencia es que C se corrió justo después de una tanda de 453 s y la máquina
venía cargada. Restar dos totales aquí es exactamente lo que SCRUM-790 prohibió — **y la
diferencia entre tiradas es mayor que el efecto que se busca medir**, así que el signo saldría de
la carga, no del arreglo.

✅ **Lo que SÍ se sostiene es la comparación DENTRO de una misma pasada, que la carga no puede
falsear.** En C, con la máquina ahogada, los quince arranques fueron:

```
guard:contraste (el PRIMERO de la fila) ......... 0,5 s   ← el MENOR de los quince
los otros catorce .............................. 0,7 – 1,7 s
```

**El primero de la fila pagó MENOS que todos los que van detrás.** Eso es justo lo que el
calentamiento tenía que conseguir: el primero deja de pagar la entrada. Sin calentar (pasada A) el
primero pagaba 0,8 s; calentando paga 0,4 y 0,5 s **incluso con la máquina peor**. Es la única de
las tres cifras que se queda quieta, y es la que el ticket iba a mover.

### 🔴 Y lo que esta medida local NO demuestra — se dice, no se vende

**Aquí no hay 32,5 s que quitar.** El coste en frío de esta máquina es de menos de un segundo, no
de 32,5: lo que mata a `guard:contraste` es **del runner**, no de un portátil. El antes/después
local **apunta en la dirección correcta y no puede probar el arreglo** — quien lo prueba es el
dato del fundador del principio de este documento. Lo que aquí queda demostrado es el
COMPORTAMIENTO: **el calentamiento corre, dice su coste aparte, no aborta, no cambia ningún
veredicto, y quita la penalización de ir primero.**
### 🔴 El tope, intacto

`TOPE_ARRANQUE_POR_DEFECTO = 30_000` — **sin tocar**, comprobado en `scripts/_navegador.mjs:142`.
El del calentamiento es **otro** (`TOPE_CALENTAMIENTO_POR_DEFECTO = 120_000`) y puede ser generoso
precisamente porque **no custodia ningún verde**.

---

## ⚠️ SCRUM-673 · ¿lo hace redundante el calentamiento? **NO. Y no se toca.**

Atacan **causas distintas**, y se ve en el porqué que el propio 673 dejó escrito
(`scripts/_navegador.mjs:218-230`), citado tal cual está escrito:

> *«El mismo guard, el mismo binario y la misma maquina arrancaron en 0,3 s, en 12,9 s y en 38,2 s
> en tiradas distintas. Eso no es el navegador: es la carga del runner.»*

| | qué quita | qué NO quita |
|---|---|---|
| **el calentamiento** (este ticket) | el **coste de arranque en frío**, que se paga UNA vez y antes de la fila | la varianza entre tiradas |
| **los tres intentos** (SCRUM-673) | que **una tirada lenta produzca veredicto** | el coste en frío: sin calentar, se paga igual en el primero |

El dato del fundador lo confirma por su lado: los catorce siguientes arrancan en **0,3 s** — o sea
que lo que el calentamiento elimina es el **primero**, no la dispersión. Y la dispersión de 673
—0,3 · 12,9 · 38,2 en tiradas distintas— **sigue existiendo** con el navegador ya caliente.

**Quitarlos sería cambiar una red por otra que cubre otra cosa.** No se tocan en este ticket, como
manda el encargo, y queda escrito por qué tampoco deberían tocarse en el siguiente.
