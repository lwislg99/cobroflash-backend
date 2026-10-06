# SCRUM-1479 · El umbral de relevo pasa de 200k a 500k: el gemelo en código de la A19

**Rama:** `scrum-1479-umbral-de-relevo-500k` · **Carril:** S5 · **Fecha:** 6-oct-2026
**Medido contra:** `origin/main` = `c92d8182697e15667652b786d76a5f8398c2f770` · 2026-10-06 ~13:40Z

A9: comprobación → `tests/scrum1070-vivas-relevo.test.mjs`

> ⏳ **ESPERANDO AUTORIZACIÓN DE COSTE DEL FUNDADOR.** Construido y comiteado; **sin empujar**. Lo paró el
> orquestador de Luis el 6-oct (~13:45Z) al ver la medición de abajo: el coste no está en su delegación
> (`docs/equipo/limites-del-fundador.md`, «Lo que NO está delegado»), y la vez anterior esta misma constante
> llevó el sí escrito del fundador. Este aviso se quita, con la respuesta y su fecha, antes de empujar.

Gemelo de SCRUM-1282 (el texto de la A19 y la A25, de S0). Ninguno de los dos se cierra sin el otro.

## Qué cambia

| Sitio | Antes | Ahora |
|---|---|---|
| `scripts/equipo/sesion.mjs` · `UMBRAL_CONTEXTO` | `200_000` | `500_000`, con las dos fechas y de quién fue cada decisión |
| `scripts/equipo/gasto-arranque.mjs` · `UMBRAL_RELEVO` | `200000`, escrito a mano, «fundador, 21-sep» | `= UMBRAL_CONTEXTO`, importado de `sesion.mjs` |
| `gasto-arranque.mjs` · la ayuda | `--umbral 200000` tecleado | el número que rige, sacado de la constante |
| `docs/equipo/orquestador-autonomo.md` §5bis.1 | 200k (tres veces) | 500k, y nombra el 800k de «a mitad de una entrega» |
| `tests/scrum899c-…` | «A25: el relevo es a 200k, no a 300k» | 500k, con lo que afirmaba antes y desde cuándo |
| `tests/scrum1070-…` | «el umbral del fundador es 200k» | 500k; de quién es el número, con las dos mitades del registro; y un test nuevo que cae si las dos constantes vuelven a escribirse por separado |
| `tests/scrum1350-…` (sección CONTEXTO del latido) | una sesión de 409k avisaba | la de 409k no avisa; control positivo, una de 783k; y con el umbral de antes la de 409k vuelve a salir |

El latido no se toca: su sección CONTEXTO ya leía `UMBRAL_CONTEXTO`, así que su frase pasa sola a «por encima
de 500k (A19)».

## De quién es el número — las dos mitades

El ticket y los ficheros tocados decían cosas distintas, y las dos salían de la misma frase de
`docs/master/SCRUM-1070.md` («1070b»):

> baja el relevo de A19 de 300k a 200k (**decisión del orquestador**; …) y UMBRAL_CONTEXTO de sesion.mjs
> (**autorización escrita del fundador**; la copia de AppData la refresca el orquestador)

- El número de la norma fue del orquestador.
- Tocar la constante de `sesion.mjs` llevó la firma del fundador.

`tests/scrum1070` y el comentario de `gasto-arranque.mjs` decían sólo «del fundador»; el ticket, sólo «del
orquestador». Ahora los dos sitios dicen las dos cosas.

## El coste, medido

Con el instrumento que ya existía (`node scripts/equipo/gasto-arranque.mjs vivas --horas 30 --simular <umbral>`,
SCRUM-1070), el 6-oct-2026 ~13:35Z, sobre las 21 sesiones con actividad (300 `state.json`, 295 con jsonl, 0
ilegibles), Σcontexto = 412,3 M de tokens:

| Relevo a | Sesiones por encima | Σcontexto simulado | Relevos de más |
|---|---|---|---|
| 200k | 18 de 21 | 207,2 M (−49,7 %) | +36 |
| 500k | 3 de 21 | 388,6 M (−5,8 %) | +3 |
| 800k | 1 de 21 | 403,4 M (−2,3 %) | +1 |

Lo que dice y lo que no:

- Es una simulación de Σcontexto, no del coste ni de la eficiencia; el arranque tras un relevo (85k) es un
  supuesto del instrumento.
- El 200k era la palanca de coste de la A25. A 500k se renuncia a ella sobre el papel.
- El ahorro del 200k **no se estaba cobrando**: 18 de 21 pasaban y seguían. Por eso el gasto real no sube al
  mergear esto. Lo que cambia es lo que la norma da por bueno.
- Las cifras del ticket (18 de 21 y 3 de 21) salen iguales aquí. La de «2 de 21 por encima de 800k» sale 1 de
  21: la diferencia es el instante (el ticket se midió sobre el día entero; esto, sobre el último turno).

## El segundo número: 800k «a mitad de una entrega»

No vive en el código. Por encima de 800k el latido dice lo mismo que por encima de 500k: «se releva AL
TERMINAR su entrega». Para una sesión de más de 800k esa frase es la contraria de lo que pide la norma (punto
seguro y relevo ya). Si se quiere un aviso propio, es una constante más en `sesion.mjs` y un renglón distinto
en `seccionContexto`; no se ha construido porque el ticket lo deja a decisión del orquestador.

## Tests

`tests/scrum899c-relevar-y-contexto.test.mjs`, `tests/scrum1070-vivas-relevo.test.mjs` y
`tests/scrum1350-latido.test.mjs`: recuento en el comentario de entrega del ticket.

## Al mergear

- La copia instalada de `sesion.mjs` (`%LOCALAPPDATA%\yaqu-equipo`) deja de ser byte a byte la de `main` y
  responde `ALTERADO` a `lanzar`, `relevar`, `parar` y `contexto` hasta que se refresque. La refresca el
  orquestador con el bloque de `docs/equipo/orquestador-autonomo.md` §5bis.7, o la tarea programada siguiente
  (08:00 / 13:05 / 18:10). Mientras tanto la cifra de contexto la da el latido, que no pasa por esa puerta.
- `sesion.mjs` se instala también en la máquina del otro equipo: el aviso lo lleva el orquestador de Luis.

## Lo que queda igual, dicho

- `gasto-arranque.mjs vivas` señala relevo con el contexto **igual o mayor** que el umbral; `decidirRelevo`
  de `sesion.mjs`, sólo **mayor**. Era así antes y no se ha tocado.
- Los comentarios históricos de `gasto-arranque.mjs` («medido el 21-sep… con relevo a 200k, Σcontexto baja
  ~44 %») siguen: describen la medición de aquel día.
