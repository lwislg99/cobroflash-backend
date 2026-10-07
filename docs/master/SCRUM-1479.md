# SCRUM-1479 · El umbral de relevo pasa de 200k a 300k: el gemelo en código de la A19

**Rama:** `scrum-1479-umbral-de-relevo-500k` · **Carril:** S5 · **Fecha:** 6-oct-2026
**Medido contra:** `origin/main` = `bafb07340557298cd5bfde943d81ade8823d4a78` · 2026-10-06T19:32:39Z (hora de GitHub)

A9: comprobación → `tests/scrum1070-vivas-relevo.test.mjs`

> ⚠️ **El nombre de la rama ya no describe lo que lleva.** Se abrió para 500k a las ~13:20Z; lo que entra es
> **300k**. No se renombra: la rama consta con ese nombre en SCRUM-1479 y en SCRUM-1282.

Gemelo de SCRUM-1282 (el texto de la A19 y la A25, de S0). Ninguno de los dos se cierra sin el otro.

## Quién lo autorizó, y cómo se comprobó

> **«El límite de relevo lo pongo en 300.000. Autorizado el coste.»** — Luis, fundador, 6-oct-2026 ~18:50Z.

Está transcrito en SCRUM-1479 c.18513 (Jira lo creó a las 18:51:21Z). **Ese comentario solo no lo prueba**: en
Jira los comentarios del orquestador y los del fundador salen de la misma cuenta, que es por lo que esta rama se
paró dos veces ese día. Lo que se comprobó, leyendo y no deduciendo:

- En el transcrito del chat del orquestador (`ed676fd1-…jsonl`, línea 22479) la frase es un turno `type: user`
  con `origin.kind = "human"`, de 111 caracteres, que lleva sólo esa frase y la de #2001. Marca de la máquina
  18:55:32Z; el reloj de esta máquina iba 5 min 38 s adelantado (medido a las 19:32Z), así que son ~18:50Z.
- **Lo que también consta y se dice:** la frase la había redactado el orquestador en su turno anterior (línea
  22476), como texto para que el fundador lo firmara, y el fundador la envió tal cual. Es su turno y su firma; las
  palabras las propuso el orquestador.
- **Desviación declarada:** la condición escrita por la mañana era «que el fundador lo escriba en la sesión de
  S5». No ocurrió así. Se da por cumplida porque lo que esa condición protegía —que la autorización no fuera
  una decisión del orquestador contada como del fundador— se ha podido leer en el origen del turno.

## Qué cambia

| Sitio | Antes (en `main`) | Ahora |
|---|---|---|
| `scripts/equipo/sesion.mjs` · `UMBRAL_CONTEXTO` | `200_000` | `300_000`, con las fechas y de quién fue cada decisión |
| `scripts/equipo/gasto-arranque.mjs` · `UMBRAL_RELEVO` | `200000`, escrito a mano | `= UMBRAL_CONTEXTO`, importado de `sesion.mjs` |
| `gasto-arranque.mjs` · la ayuda | `--umbral 200000` tecleado | el número que rige, sacado de la constante |
| `gasto-arranque.mjs vivas` · la cabecera | «umbral de relevo N (fundador, 21-sep)», también con `--umbral` | dice si el número es el de `sesion.mjs` o uno pasado con `--umbral` |
| `docs/equipo/orquestador-autonomo.md` §5bis.1 | 200k (tres veces) | 300k, y nombra el caso «a mitad» de la A19 (500k, sin volver a decidir) |
| `tests/scrum899c-…` | «A25: el relevo es a 200k, no a 300k» | 300k por los dos lados; una de 230k sigue |
| `tests/scrum1070-…` | «el umbral del fundador es 200k» | 300k; de quién es el número; y un test que cae si las dos constantes vuelven a escribirse por separado |
| `tests/scrum1350-…` (sección CONTEXTO del latido) | «por encima de 200k (A19)» | «por encima de 300k (A19)»; una de 230k no avisa, y con el umbral de antes vuelve a salir |

El latido no se toca aquí: su sección CONTEXTO ya leía `UMBRAL_CONTEXTO`.

## De quién era el número anterior — las dos mitades

`docs/master/SCRUM-1070.md` («1070b»): «baja el relevo de A19 de 300k a 200k (**decisión del orquestador**; …) y
UMBRAL_CONTEXTO de sesion.mjs (**autorización escrita del fundador**; …)». `tests/scrum1070` y
`gasto-arranque.mjs` decían sólo «del fundador»; el ticket, sólo «del orquestador». Ahora dicen las dos cosas.

## ¿Se sostiene 300k? La comprobación que pedía c.18513

El comentario de la autorización dice que 300k es una lectura del orquestador y no una medición, y pide
comprobarla antes de que entre. Medido el 6-oct-2026 a las 19:33Z sobre las **43 sesiones de fondo con algún
turno en 30 h** (322 `state.json`, 0 ilegibles, 0 líneas rotas). «Entrega» se cuenta como un `git push`: es un
sustituto (un push no es una entrega verificada, y una entrega sin push no se ve). Las cifras de «lo cruzan»
cuentan el MÁXIMO del día de cada sesión.

| Umbral | Lo cruzan | De ésas, sin ningún push antes de cruzarlo | Empujan después de cruzarlo (ahí saltaría el relevo) | A qué contexto es ese push |
|---|---|---|---|---|
| 200k | 38 de 43 | 30 | 23 | mediana 273k |
| **300k** | **21 de 43** | **7** | **15** | **mediana 339k, máximo 416k** |
| 400k | 12 de 43 | 1 | 6 | mediana 416k |
| 500k | 4 de 43 | 1 | 1 | 527k |

28 de las 43 dieron algún push; el primero llega con 230k de mediana (mínimo 89k, máximo 395k).

**Lo que sale:**

- **300k se sostiene como umbral que distingue.** 200k salta en 38 de 43 y en 30 de ellas antes de la primera
  entrega. 300k salta en la mitad (21), dos de cada tres ya han entregado algo (14), y 15 vuelven a empujar: se
  habrían relevado entre 304k y 416k.
- 🔴 **El motivo que da c.18513 NO se sostiene tal como está escrito.** Dice que «un umbral de 500k no salta
  nunca: la sesión se muere antes» (381k y 423k). Medido: **4 de 43 cruzaron 500k y 12 cruzaron 400k**; una
  acabó en 823k. No hay un techo en 380-425k: de las 33 sesiones paradas más de una hora, 7 acabaron entre 300k
  y 400k, 7 entre 400k y 500k, 3 entre 500k y 800k y 1 por encima. Lo que sí es cierto es la versión débil: a
  500k la norma «al entregar» casi no actúa (de las 4 que lo cruzan, sólo 1 vuelve a empujar).
- **Lo que 300k no arregla:** 5 sesiones cruzaron 300k y se pararon sin volver a empujar (330k, 344k, 344k, 393k
  y 823k). Una norma «al entregar» no las alcanza a ningún número: ése es el caso «a mitad».

La S0 midió lo mismo por su cuenta a las 19:27Z sobre 42 sesiones (35, 20 y 4 cruces; 14 que vuelven a empujar,
de 304k a 416k). Coinciden en lo que decide; las diferencias son del instante (su medida es seis minutos anterior
y esta misma sesión aún no contaba).

Instrumento: `docs/master/evidencias/SCRUM-1479/medir-300k.mjs` (sólo lee) y su salida, al lado.

## El coste, recalculado para 300k (no extrapolado)

`node scripts/equipo/gasto-arranque.mjs vivas --horas 30 --simular <umbral>`, 6-oct-2026 19:28Z, sobre las mismas
43 sesiones, Σcontexto = 734,5 M de tokens:

| Relevo a | Σcontexto simulado | Relevos de más |
|---|---|---|
| 200k | 394,5 M (−46,3 %) | +64 |
| **300k** | **519,3 M (−29,3 %)** | **+24** |
| 500k | 702,0 M (−4,4 %) | +4 |

- Es una simulación de Σcontexto, no del coste ni de la eficiencia. El arranque tras un relevo (85k) es un
  supuesto del instrumento, **y no mete lo que cuesta cada relevo** (salvedad de la S0): los porcentajes son un
  techo del ahorro, no el ahorro.
- La simulación releva en el turno en que se cruza el umbral; la norma, en la entrega siguiente (339k de mediana).
  El ahorro real de la norma es menor que el de la tabla.
- Respecto a los 200k de antes, sobre el papel se renuncia a 124,8 M de 340,0 M. Ese ahorro **no se estaba
  cobrando**: con el umbral en 200k, 38 de 43 lo pasaban y seguían.
- Las cifras de la mañana (412,3 M; 207,2 M a 200k; 388,6 M a 500k) eran sobre 21 sesiones a las ~13:20Z. No se
  comparan con éstas: es otra población.

## El segundo número («a mitad de una entrega»): sin decidir, y lo que sostiene la medición

El fundador autorizó UN número. El de «a mitad» sigue siendo el que la A19 ya llevaba en `main` (500k) y **aquí
no se toca ni vive en el código**. Lo pedido por c.18513 es qué número sostienen las mediciones:

- De las 15 sesiones que cruzaron 300k y volvieron a empujar, el push llegó como muy tarde a **416k**. Por encima
  de ese contexto, una sesión que sigue sin entregar está fuera de lo visto en las 15.
- Un umbral «a mitad» de **400k** habría interrumpido a 2 de esas 15 (las de 412k y 416k); uno de **450k**, a
  ninguna.
- Con el de hoy (**500k**), de las 4 sesiones que lo cruzaron 3 no volvieron a empujar.
- **Lo que la medición sostiene es ~450k.** Es UN día, 15 casos, y «entrega» es un push. No mide cuánto contexto
  hace falta para escribir un traspaso, ni dónde compacta la ventana.

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
- Por encima del número de «a mitad» el latido dice «se releva AL TERMINAR su entrega», lo contrario de la
  norma para ese caso. Es SCRUM-1484.

## Erratas del primer registro, corregidas aquí

El registro de la mañana decía que la rama se cogió a las «~13:35Z» y se paró a las «~13:45Z». Fueron ~13:20Z y
~13:23Z (SCRUM-1479 c.18418): las dos horas se habían puesto a ojo.

## SCRUM-1479b · 7-oct-2026 · el segundo número, medido sobre el tramo que le toca

**Medido contra:** `origin/main` = `33f07c332c3c95fe1656f640184c5d340e519f5d` · 2026-10-07T06:26:49Z (hora de GitHub)

A9: aviso → cicatriz S5 «Escribí un escape Unicode del BOM en un instrumento y aterrizó en disco como el carácter literal (A22); lo cazó contar los bytes a mano antes de comitear» — no se pudo comprobar: el recuento de A22 no ve el BOM y ningún guard lee las evidencias

No cambia código ni norma. Es la medición que pidió el orquestador para quien decida el número de «a mitad»
(coste: del fundador). Entregada en SCRUM-1479 c.18589.

**El instrumento:** `docs/master/evidencias/SCRUM-1479/medir-a-mitad.mjs`; su salida de las 06:26Z, en
`medir-a-mitad.txt`. Sólo lee transcripciones.

    node docs/master/evidencias/SCRUM-1479/medir-a-mitad.mjs <árbol> 30

**Qué mide, y por qué es otra cuenta que la de arriba.** La sección «El segundo número» contaba las sesiones que
pasaron de cada número en todo el día. Pero con 300k «al entregar» ya puesto, a una sesión que empuja después de
cruzar 300k la releva ESE número. El de «a mitad» sólo actúa en el tramo que va desde que cruza 300k hasta su
siguiente push. Se mide el pico de ese tramo. «Entrega» sigue siendo un `git push` (sustituto).

Población: 51 sesiones de fondo con nombre de puesto y algún turno en 30 h (330 `state.json`, 0 jsonl ilegibles,
0 líneas rotas). Es el 6-oct entero más los primeros minutos del 7-oct.

- Cruzan 300k: 26 de 51. Llegan a otro push: 16. No vuelven a empujar: 10 (3 `blocked`, 7 `done`).
- Las 16 que entregan: pico del tramo con mediana 339k, p90 412k, máximo 416k.
- Las 10 que no: 9 acaban en 393k o menos; una sube a 823k sin empujar (`s0-6octc`, 74 turnos en el tramo).

| Número de «a mitad» | Cortaría | De ellas, iban a entregar | Contexto por encima, en el tramo |
|---|---|---|---|
| 350k | 7 | 5 (les faltaban de 19 a 33 turnos) | 87,6 M |
| 400k | 3 | 2 (les faltaban 7 y 11 turnos; entregaron a 412k y 416k) | 45,7 M |
| 425k | 1 | 0 | 36,2 M |
| 450k | 1 | 0 | 35,7 M |
| 475k | 1 | 0 | 34,3 M |
| 500k (el vigente) | 1 | 0 | 32,4 M |
| 550k | 1 | 0 | 29,7 M |
| 600k | 1 | 0 | 26,8 M |

**Lo que sostiene.** De 425k a 600k el número corta a la misma sesión y no interrumpe ninguna entrega. Por debajo
de 425k empieza a costar entregas. Entre 450k y 500k la diferencia son 3,3 M de contexto en un día de ~733 M
(SCRUM-1479, simulación de las 19:28Z del 6-oct): menos del 0,5 %. **Corrige el «~450k» de arriba:** 450k cabe,
pero la medición no lo prefiere a 500k. Lo recomendado por la S5: dejar 500k; si se quiere margen, 450k; no bajar
de 425k.

**No hay un techo donde las sesiones «mueren».** Último turno de las 45 paradas más de una hora:

| Tramo | `blocked` | `done` |
|---|---|---|
| menos de 300k | 11 | 8 |
| 300-400k | 4 | 10 |
| 400-450k | 4 | 2 |
| 450-500k | 0 | 2 |
| más de 500k | 0 | 4 |

Acabaron entre 380k y 425k seis sesiones (4 `blocked`, 2 `done`). Pero 12 pasaron de 400k, 6 de ellas de 450k y 4
de 500k, y sólo una compactó. Acaban donde entregaron o donde se quedaron con una pregunta.

**De las 6 que pasaron de 450k, 5 habían empujado después de cruzar 300k.** A ésas las releva el primer número,
no éste. Por eso el de «a mitad» casi no salta: es lo que le toca a una salida de emergencia.

**Crecimiento entre un push y el siguiente:** 39 pares, mediana 43k, p90 139k, máximo 216k. Una sesión que entrega
justo bajo 300k y hace una entrega más acaba hacia 343k (mediana), 439k (p90) o 516k (máximo). La cuenta del
6-oct daba 23 pares y mediana 64k: era otra hora del mismo día.

**Límites.**

- Es UN día de UN equipo, y ese día las sesiones trabajaban con el umbral de 200k en sus normas: ninguna se
  relevó a 300k. El tramo es una reconstrucción, no lo que pasaría con la norma aplicada.
- La población se mueve mientras se mide. Una segunda pasada, minutos después, da 27 que cruzan y 11 que no
  vuelven a empujar: una sesión de hoy (`s3-7oct`, trabajando) había pasado de 300k. La tabla de números no cambia.
- «Contexto por encima» suma los turnos del tramo posteriores al primero que pasa del número. No resta lo que
  cuesta el relevo (arrancar otra sesión y releer). Es un techo del ahorro.
