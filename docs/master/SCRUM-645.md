# SCRUM-645 · La puerta tiraba los tramos del arranque

**Fecha:** 2-sep-2026 · **Carril:** B · **Gate:** desbloquea las tandas de SCRUM-626
**Medido contra:** `origin/main` = `73d73db7f7776b34c2d777206d2d766dcead049c` · 2026-09-02T00:00:00+02:00
**Rama:** `scrum-645-la-puerta-tira-los-tramos`

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

---

## EL HECHO, MEDIDO

SCRUM-642 partió `⟦arranque⟧` en `proceso+ws` y `primera-página`. La puerta **reproduce la salida
cruda del guard sólo cuando NO sale verde** (`guards-visuales.mjs`, volcado de los no verdes); para
los verdes pinta su propia columna con el total reformateado. En una tanda real con el tope a 180 s:

| | |
|---|---|
| apariciones de `proceso+ws` en el log | **0** |
| apariciones de la columna de la puerta | **9** |

O sea: **el guard emitía el desglose y la puerta lo tiraba.** Y con el tope subido morir es justo
lo que deja de pasar, así que el tope alto tapaba la información que 642 vino a producir. Las tres
tandas de SCRUM-626 habrían dado la misma columna de siempre.

## LO QUE CAMBIA

1. **El desglose se pinta también para los verdes**, en una segunda línea:

```
   ✔ guard:contraste              7.4 s   arranque   0.4 s   verde
       └ arranque COMPLETA · proceso+ws 0.4 s · primera-página 0.0 s
```

2. **Se ve si la medida es COMPLETA o CORTADA, y en qué tramo.** Una cortada conserva el `≥` del
   desglose: un `≥30.0` pintado como `30.0` vuelve a leerse como duración.

3. **La primera línea de la tabla no cambia ni un byte**, y el volcado crudo de los no verdes
   tampoco. Este ticket AÑADE; no toca lo que ya funcionaba.

## EL TRINQUETE, porque es la SEGUNDA vez

En SCRUM-639 el vocabulario de códigos existía dentro y no salía fuera. Ahora los tramos. Dos veces
es un patrón, así que no basta con pintar: **un campo que la tabla no conozca PARA la tanda.**

```
🔴 NO SUPE PINTAR lo que los guards SÍ dijeron. La tanda para aquí.
   guard:contraste  →  conexión-cdp 0.1 s
```

Sale con **2**, que es el código que esta puerta **ya** usaba para su propia ceguera («no supe
mirar»); no se inventa uno nuevo ni se toca `veredicto` (SCRUM-639).

### 🔴 Por qué la lista se escribe a mano

`TRAMOS_QUE_LA_TABLA_PINTA` **no se importa de `_navegador.mjs`, y eso es el trinquete entero.** Si
la puerta heredara la lista de quien emite, un tramo nuevo entraría solo: o se pintaría sin que
nadie decidiera enseñarlo, o caería en un hueco y se tragaría en silencio. Duplicar la lista es el
precio, y se paga a sabiendas. Hay un test que **prohíbe importarla**.

## LOS CONTROLES, en las tres direcciones que pidió el encargo

| Control | Cómo se prueba | Resultado |
|---|---|---|
| guard que **MUERE** → salida cruda igual que hoy | anclado al CONTENIDO del volcado, no a la línea | ✅ intacto |
| guard que **PASA** → enseña sus tramos | tanda real de 9 navegadores | ✅ `EXIT 0`, las 9 con su `└` |
| **trinquete** → campo desconocido y la tanda cae | tramo falso metido en el emisor, tanda real | ✅ **`EXIT 2`** |

El del trinquete se probó **de punta a punta**: se añadió un `conexión-cdp` falso a
`_navegador.mjs`, se corrió la tanda —cayó con 2 nombrando el campo y los guards— y se revirtió.
`git status` confirma el fichero **idéntico al commit**: no se ha entregado ningún cambio suyo.

### 🔴 El suelo que ata al lector con el emisor

Los demás tests usan cadenas escritas a mano; si `_navegador.mjs` cambiara el formato seguirían
pasando y aprobarían un lector que ya no lee nada. Por eso hay un suelo que **arranca el emisor de
verdad** —con un doble, sin navegador— y le da su salida a la puerta: si divergen, cae.

Y hay un test aparte para que el trinquete esté **enchufado**: sin él se podría borrar el bloque
que sale con 2 y todo lo demás seguiría verde. Decidir sin parar es el mismo defecto un piso abajo.

## NÚMEROS

* **Suite: 4.249 tests · 4.170 verdes · 0 rojos · 79 saltados.**
* Tanda real de 9 guards: **verdes, `EXIT 0`**, con el desglose visible en los nueve.
* Tests nuevos: `tests/scrum645-la-puerta-no-tira-los-tramos.test.mjs`, **11**, sin navegador.

## LO QUE NO SE HA TOCADO

`_navegador.mjs` (la marca estaba bien; el problema era quien la leía), `TOPE_ARRANQUE_POR_DEFECTO`,
el trinquete de SCRUM-617, `guard:contraste`, `veredicto`/`VOCABULARIO`/`llegoAMedir` (SCRUM-639) y
`medicion-626-arranque-frio`. Esto va a `main` por su camino; después la rama de medición vuelve a
mezclar `main`.
