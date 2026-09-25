# SCRUM-1096 · La Orden EHA/3786/2008 NO está sustituida: premisa falsa, y una nota de una línea

**Fecha:** 25-sep-2026 · **Carril:** legal · **Puesto:** J4 (jv-j4)
**Medido contra:** `origin/main` = `dac1f9d7f9cd5237778aa2cd3f9241bd2210855a` · 2026-09-25T14:59:10Z

## Encargo

El título del ticket: «Citamos una orden ministerial SUSTITUIDA (EHA/3786/2008 → HAC/27/2026) en
cuatro documentos, uno con URL y hash — el ancla más fuerte que tenemos y aun así caducó». El ticket
no tiene cuerpo. El orquestador lo cierra como **premisa falsa** con esta medición y encarga solo la
nota de §8 (decisión (a)+(b)).

## PASO 0 — medido en el BOE, con `curl` (sin WebFetch)

Descargas del 25-sep-2026, a las 14:56Z:
- `https://www.boe.es/buscar/act.php?id=BOE-A-2008-20953`: 180.543 B, sha256[16] `37c3cc1155203366`.
- `https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-1761`: 63.288 B.

1. **HAC/27/2026 modifica la orden; no la sustituye ni la deroga.** Su título dice «por la que se
   modifican […] la Orden EHA/3786/2008». Su artículo segundo sustituye **solo el anexo I**, que es el
   impreso del 303 con las casillas. El consolidado de EHA/3786/2008 lo anota bajo su ANEXO I: «Se
   sustituye por el que figura como anexo III de la Orden HAC/27/2026, de 22 de enero, según establece
   su art. 2». Se aplica por primera vez al 2T o a febrero de 2026. La orden sigue viva, con su última
   actualización publicada el 26/01/2026.
2. **La cita que usamos sigue vigente y es literal.** `CONTABILIDAD.md` §3 cita el art. 7.2, el plazo
   trimestral del 303. Su última redacción es del 15/05/2017, en vigor desde el 01/07/2017, y
   HAC/27/2026 no la toca. La frase citada entera aparece 1 vez en el texto de hoy (`grep -F`).
3. **Son dos documentos, no cuatro.** Busqué por palabra: `3786/2008`, `BOE-A-2008-20953`,
   `ORDEN303`, `HAC/27` y el hash `0ECC0332`.
   - `docs/producto/CONTABILIDAD.md`: líneas 102, 135 y 212.
   - `docs/master/SCRUM-1039.md:72-74`: ya describe bien la sustitución del anexo.
   - El comprobador y la evidencia de 1039 solo nombran la clave `ORDEN303`.
   - `src/` no cita ninguna orden.
   - Control positivo: la misma búsqueda sí encuentra `HAC/27/2026` en SCRUM-1039.md.

## 4 · Lo que más vale, y no es el ticket

**No hay un ancla que haya caducado. Lo que existe es un ancla que NUNCA protegió nada, ni el texto
ni la norma, y que lo dice ella misma.**

- La URL de §8 es la del **consolidado** (`act.php`), que siempre sirve la versión vigente. Por eso
  nunca puede detectar un cambio.
- El hash **cambia en cada descarga, por diseño**. La propia §8 lo admite: «no comparables con una
  tirada anterior».

Teníamos la sensación de estar anclados sin estarlo, y eso es peor que saber que no lo estás. El
arreglo va aparte, en **SCRUM-1117**: el BOE publica la fecha de «Última actualización» **por bloque**
(art. 7: 15/05/2017; anexo I: con su propia nota). Si cada cita guarda la fecha de su bloque, el
comprobador puede detectar que cambió la NORMA, y un cambio del impreso no da falsa alarma sobre la
cita del plazo.

## Lo que cambia

- `docs/producto/CONTABILIDAD.md` §8: una nota bajo la fila `ORDEN303`. Dice que la orden **no está
  derogada**, que su art. 7.2 sigue en la redacción de 2017 y que su anexo I (el impreso y las
  casillas) hoy es el anexo III de HAC/27/2026.
- Medición en rojo primero: `grep -c 'HAC/27/2026' docs/producto/CONTABILIDAD.md` daba **0** antes y
  da **1** después.

## ⚠️ Hallazgo de rebote, NO arreglado aquí (regla 6: nada de paso)

Corrí el comprobador de §8 contra las seis fuentes bajadas hoy con `curl`:
`node docs/verificacion/comprobar-citas-contabilidad.mjs docs/producto/CONTABILIDAD.md <carpeta>`.
Resultado: **29 citas extraídas, 27 encontradas, 2 NO ENCONTRADAS, exit 1**, con el control negativo
OK. **El resultado es idéntico con el `CONTABILIDAD.md` de `origin/main`**, así que esta rama no lo
provoca.

Las dos citas que fallan son las del RFACT art. 6.1.m y 6.2.b. Las promovió a cita comprobada el
commit `3810f997` (SCRUM-1106b, de J4) usando «(…)» para saltarse texto legal real. Es justo la trampa
que la nota de método de §8 declara: el comprobador exige una subcadena continua. Cada fragmento, por
separado, sí es literal en el RFACT de hoy (4 de 4 con `grep -F`), así que **la norma está bien
citada; lo que falla es la forma de la cita**. La nota de método sigue diciendo «26 de 26», y eso hoy
es falso. Se entrega al orquestador para que abra ticket propio.
