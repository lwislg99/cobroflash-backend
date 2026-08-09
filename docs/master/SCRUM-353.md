# SCRUM-353 · La excepción deja de estar anclada a una línea

**Fecha:** 9-ago-2026 · **Carril:** guards · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `64c19884a97d240544a203df81a67b33744c1724` · 2026-08-09T20:34:56+02:00

## El defecto, que es de familia

La única excepción del censo de SCRUM-311 decía `linea: 2634`. **Un guard atado a la POSICIÓN
vigila dónde está algo, no qué es**: cualquier inserción por encima lo rompe aunque no toque lo
vigilado.

Y ya había pasado: SCRUM-286 troceó el formulario, metió 49 líneas, la línea saltó de **2585 a
2634**, y el guard cayó con «ya no corresponde a nada: bórrala» sobre un código que nadie había
tocado. Se actualizó el número — es decir, se pagó el peaje en vez de quitar la trampa.

Es la misma familia que ya nos mordió con el ternario, con el `||`, con el objeto indexado y con la
puntuación (`| 'C7';`). Ésta era la variante más burda.

## El arreglo: anclada al HECHO

```js
{ ruta: 'public/dashboard/js/quotesView.js', sujeto: 'line.qtyInput.value', reserva: '1', motivo: … }
```

El hecho es **«esta lectura concreta, con este valor de reserva»**. Sobrevive a cualquier
reordenación del fichero.

**Y no puede ensancharse sola.** Si ese mismo sujeto con esa misma reserva apareciera una **segunda
vez**, la excepción ya no distingue cuál era la perdonada: **no perdona ninguna** y las dos salen.
Una excepción que se estira en silencio al copiar-pegar es la que alguien acaba ampliando.

Los tres llamadores (`scrum286`, `scrum311` ×2) pasan ahora el conjunto de hallazgos, que es lo que
la regla del gemelo necesita.

## ¿Sigue haciendo falta la excepción?

**Sí, medido:** el sitio vigilado sigue en el código (`quotesView.js`, camino de **guardar
plantilla**) y la decisión del fundador de SCRUM-311 sigue pendiente. No se retira.

## Verificado en rojo — los tres por `$?`

| inyección | `$?` | lo que dijo |
|---|---|---|
| el patrón se **copia** a otro sitio del mismo fichero | 1 | «casa con **2** sitios (lineas 2634, 2635)» |
| **40 líneas insertadas por ENCIMA** (el caso que motivó el ticket) | **0** | la excepción **sobrevive** — antes esto la rompía |
| la excepción sin motivo o sin ticket | 1 | el guard de SCRUM-311 ya lo exigía y se conserva |

## Lo que NO cubre

* Si alguien **cambia el sujeto** (renombra `qtyInput`), la excepción deja de corresponder y el
  guard cae pidiendo revisarla. Es lo correcto, pero es trabajo manual: no hay anclaje que
  sobreviva a un renombrado sin dejar de ser específico.
* La regla del gemelo es **por fichero**: dos sitios idénticos en ficheros distintos serían dos
  excepciones distintas, y solo hay una.
