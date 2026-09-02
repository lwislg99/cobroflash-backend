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
