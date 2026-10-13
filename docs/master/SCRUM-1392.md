# SCRUM-1392 · Un hallazgo visto no caduca porque el caso lance después

**Medido contra:** `origin/main` = `28166620c923253a3c2c350f415894e6fc2ed1f4` · 2026-10-07T16:43:04Z

A9: comprobación → `tests/scrum1392-un-hallazgo-visto-no-caduca.test.mjs`

Sesión J6 (`jv-j6`), por encargo del orquestador del equipo de Javier (`cobroflash-backend-90`).
El censo y el «antes» del banco se corrieron sobre `f9b4074d33278023f55548b88306421531114174`; entre
ese commit y el del ancla `main` no tocó ninguno de los cinco ficheros de `scripts/` de este PR ni
`public/dashboard/js/quotesView.js` (`git diff --stat`, vacío para ellos). El «después» del banco se
repitió sobre `1c0ec64b0dc734590972a4690a13d36cd4b32226`, que ya lleva ese `main` mezclado.

Se toca: `scripts/_hallazgos-y-ciegos.mjs` (la pieza), cuatro guards de `scripts/`, un ayudante y un
test nuevos en `tests/`, este registro y su carpeta de evidencias. `scripts/` no es del equipo de
Javier por la tabla de reparto: se declara aquí y en el PR. Ningún PR abierto tocaba esos ficheros
(7 abiertos, 7 leídos). **Nada de `src/`, ningún workflow, ningún guard relajado, ninguna lista que
crezca.** `guards-visuales.mjs` y `guards-entrada.mjs` no se tocan.

## El hallazgo: el ticket describía una forma del defecto y señalaba al fichero equivocado

El ticket traía un candidato, `guard-caja-documento-suelto`, «leído, no ejercitado», y daba por
limpios los siete guards de SCRUM-1336. Medido, es al revés:

- **En `guard-caja-documento-suelto` no hay pérdida alcanzable.** Su lista nace en `informar`, que es
  síncrona y corre después del último `await` del caso.
- **La víctima real es `guard-duplicar-926`, uno de los siete.** Apunta los errores de página en una
  lista que nace dentro de `abrirEditorDuplicando`, y detrás tiene siete `await`. Esa lista sólo
  llegaba al informe si el caso NO lanzaba.

## ① El censo: quién lleva la lista en la mano

`docs/master/evidencias/scrum1392/censo-lista-en-la-mano.mjs`, por AST, con el motor de
`tests/_lista-en-la-mano.mjs`. Cinco controles corren antes del número, tres de ellos de cero (lista
del módulo, lista entregada, un recorrido sólo nombrado en un comentario); si alguno no cuadra, el
censo sale 2 y no da número.

| | antes (`f9b4074d`) | después |
|---|---|---|
| ficheros `.mjs` de `scripts/` y `tests/` leídos | 1.749 | 1.750 |
| llamadas a `recorrerCasos` en guards de `scripts/` | 11, en 9 guards | 11, en 9 guards |
| recorridos sin poder leer su caso | 0 | 0 |
| recorridos con una lista de hallazgos en la mano | **4** | **0** |
| de ésos, con un `await` o un `throw` detrás del primer apunte | **1** (`guard-duplicar-926`, 7 `await`) | 0 |

Los cuatro: `guard-duplicar-926` (`errores`), `guard-caja-datos-del-cliente` (`suyos`),
`guard-caja-documento-suelto` (`suyas.hallazgos`) y `guard-portal-en-la-ficha` (`suyos`). En los tres
últimos, detrás del primer apunte sólo hay llamadas síncronas sobre datos ya comprobados
(`toFixed`, `padEnd`, `JSON.stringify`); que no puedan lanzar está **leído, no ejercitado**.

Salidas enteras: `censo-antes.txt` y `censo-despues.txt`.

**Mi error, y por qué el número es del instrumento:** antes de escribir el censo leí los nueve guards
a mano y conté tres. El cuarto, que es el único con víctima, lo encontró el censo: su lista no se
llama `hallazgos` ni se devuelve al recorrido, vuelve dentro de un objeto desde una función que el
caso llama.

## Cuántos hallazgos se han perdido hasta hoy: no se puede saber

La pérdida no deja rastro —sale un 2 legítimo, «no supe medir»— y no hay registro de salidas de
estos guards que consultar. Lo que sí se sabe: el camino existía en **1 guard de 9**, desde que
SCRUM-1336 pasó `guard-duplicar-926` a `recorrerCasos`.

## ② El rojo, visto con navegador

`docs/master/evidencias/scrum1392/banco.mjs`: saca un SHA a un árbol desechable fuera del repo
(`git archive`), rompe allí el producto y corre el guard **sin tocarlo**. Misma técnica que el banco
de SCRUM-1336. Siete pasadas por SHA, **7 válidas de 7 en cada uno**.

| escenario de `guard-duplicar-926` | antes (`f9b4074d`) | después (`1c0ec64b`) |
|---|---|---|
| limpio | 0 | 0 |
| un error de página, y el caso se lee | 1, con el error nombrado | 1, con el error nombrado |
| la lectura lanza, sin error de página | 2 · «0 hallazgos · 4 ciegos» | 2 · «0 hallazgos · 4 ciegos» |
| **un error de página y la lectura lanza** | **2 · «0 hallazgos · 4 ciegos»; el error no se nombra en toda la salida** | **1 · «1 hallazgo · 4 ciegos», con el error nombrado** |

Los otros tres guards tocados, sin romper nada: 0 antes y 0 después.

El banco del ticket (`docs/master/evidencias/scrum1336/limite-de-recorrer-casos.mjs`, de J1j) se
corrió antes y después y dice lo mismo las dos veces: una lista que nace **dentro** del caso se
sigue perdiendo. Es el límite que queda, y está abajo.

## ③ y ④ El arreglo

**La pieza.** `recorrerCasos` pasa a `juzgarCaso(caso, suyas)`: `suyas` son las dos listas de ese
caso, puestas por el recorrido. Si el caso lanza, lo apuntado ahí se conserva y además se apunta el
ciego del lanzamiento. Lanzar con las manos vacías sigue siendo un ciego y sale 2. El veredicto lo
sigue dando `veredictoDe`, que no se toca. Un caso que no usa el segundo argumento se comporta como
antes.

**Los cuatro guards.** Los tres de caja y portal apuntan en `suyas`. `guard-duplicar-926` apunta los
errores de página en una lista del módulo (`erroresDePagina`), para no cambiar ni un texto ni una
cuenta de los escenarios que ya existían.

**Lo que cambia en un guard existente**, decidido por el orquestador antes de empujar:

- `guard-duplicar-926`, sólo en el escenario «error de página visto y el caso lanza», pasa de 2 a 1.
  Lo consume la puerta `scripts/guards-visuales.mjs`, que sí distingue: un 2 lo cuenta en «no
  llegaron a medir» y un 1 en «midieron y encontraron algo». Por encima de la puerta nadie distingue
  (`.github/workflows/ci.yml` tumba el job con cualquier salida distinta de 0): el job pasa de rojo a
  rojo y cambia la etiqueta, de la que invita a relanzar a la que dice que hay un defecto.
- Los nueve guards ganan una línea de salida. No cambia ningún código.

## ⑤ La línea, y su límite

Sale siempre, una por recorrido, impresa por la pieza:

    ⟦recorrido⟧ 2 casos recorridos · 0 lanzaron · 0 de ésos traían hallazgos en las listas del recorrido

**Se aparta del literal del ticket** («M de ésos traían hallazgos»). Sin «en las listas del recorrido»
mentía: en `guard-duplicar-926` ya arreglado decía «2 lanzaron · 0 de ésos traían hallazgos» con el
error de página visto, porque ese guard apunta en una lista del módulo y el recorrido no la ve.

**Límite:** la tercera cuenta sólo ve las listas que entrega el recorrido. Para los seis guards
que apuntan en listas del módulo (ocho recorridos de los once, con `guard-duplicar-926` dentro)
**dirá 0 siempre y no es informativa**: un 0 ahí no significa «no encontraron nada». Las dos primeras cuentas sí valen para
los once.

## El test, y visto en rojo

`tests/scrum1392-un-hallazgo-visto-no-caduca.test.mjs`, 9 casos: la pieza (cuatro), la línea (dos),
el lector por AST con sus ceros, **ningún guard de `scripts/` lleva una lista de hallazgos en la
mano —sin lista de excepciones—**, y el resumen guardado del banco.

`docs/master/evidencias/scrum1392/mutar.mjs` (base sin mutar primero: 9 pasan, 0 caen; cada fichero
se devuelve byte a byte y se comprueba). **6 mutaciones, 6 VIVAS, 0 ciegas**, y cada una tumba el
caso que le toca: la pieza deja de conservar lo entregado · todo lanzamiento se vuelve hallazgo · la
línea sólo sale con algo que contar · lo entregado se cuenta dos veces · `guard-duplicar-926` vuelve
a su lista · `guard-portal-en-la-ficha` vuelve a la suya. Traza: `mutaciones-traza.txt`.

## Aceptación → dónde se ve

| aceptación (del ticket) | dónde se ve |
|---|---|
| ① censar quién lleva la lista en la mano | `docs/master/evidencias/scrum1392/censo-antes.txt` y `censo-despues.txt` |
| ② el rojo primero, con el caso de navegador | `docs/master/evidencias/scrum1392/antes-duplicar-926-error-visto-y-lanza.txt` |
| ③ lanzar sin haber apuntado nada sigue saliendo ciego | `tests/scrum1392-un-hallazgo-visto-no-caduca.test.mjs` (caso ②) y `despues-duplicar-926-lanza-sin-nada.txt` |
| ④ `veredictoDe` sigue siendo el único sitio | `scripts/_hallazgos-y-ciegos.mjs`: `veredictoDe` sin cambios |
| ⑤ la línea que sale siempre, también con cero | `tests/scrum1392-un-hallazgo-visto-no-caduca.test.mjs` (casos ③), con el texto y el límite de arriba |

## Lo que NO se ha hecho o no se ha medido

1. **Una lista que nace dentro del caso y no pasa por `suyas` se sigue perdiendo.** La pieza no puede
   rescatar lo que no ve. Lo impide el test de AST, no la pieza.
2. **El lector de AST no ve** una lista que nace en una función y se apunta en otra, ni sigue
   imports. Lo dice en su salida.
3. **Los tres guards de caja y portal no se han ejercitado con un lanzamiento después del apunte:**
   no tienen camino alcanzable sin mutar el guard. Sólo se midió que en limpio no cambian.
4. **`guards:visuales` entero no se ha corrido, y la tanda completa en local tampoco** (decisión del
   orquestador: hace de tanda el obligatorio del CI). En local corrieron 17 ficheros, 174 casos, 0
   caen, 0 saltos: los guards de suite que miran ficheros nuevos, más los de SCRUM-1320, 1327 y 1336.
5. Un caso que lanza **fuera** de los recorridos (al montar el servidor, al abrir el navegador)
   sigue como lo dejó SCRUM-1336.
