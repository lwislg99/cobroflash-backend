# SCRUM-1261 · El bloque de preguntas para el asesor, puesto a salvo

**Medido contra:** `origin/main` = `a4e664cd5d130d330a0b391f0f34d0787020179c` · 2026-09-28T23:13:31Z (hora local del equipo, `date -u`)

Sesión J5 (`jv-j5`), 29-sep-2026 madrugada, por encargo del orquestador de Javier tras el reinicio de
la máquina. Dos vueltas.

## Vuelta 1 · ponerlo a salvo (commit `c80b2f84`)

`docs/legal/ENVIO_ASESOR_2026-09-28.md`, tal como quedó el 28-sep a las 23:39: 36.245 bytes,
527 líneas, sha256 `30b3d9e53e593f2eed8d4887761dbe9d3b39d8f56f9689e8298b12dd7303ec01`. Tres partes
(1 para Javier, 2 lo que se envía, 3 lo que queda fuera); la parte 3 termina con su último párrafo, no
cortado por el reinicio. Sin reescribir.

## Vuelta 2 · el rojo de CI y D5.2/D5.3 (con OK de Javier: «Ok, dale»)

**El rojo.** `tests/scrum525d-anclas-que-apuntan.test.mjs`, trinquete «ninguna coordenada NUEVA sin
testigo», por la línea 32 del bloque (parte 1, no se envía), que citaba `PREGUNTAS_ASESOR.md:848` y
`:978` sin testigo.

Entre las dos vueltas, un commit de `claude[bot]` en esta rama (`6787a7f0`) lo intentó arreglar y
**no lo arregló**, medido en local: el trinquete seguía en rojo. Dos motivos:

1. Cambió `:848` por `:847`, y la 847 de `PREGUNTAS_ASESOR.md` es una **línea en blanco**. La marca
   `Q-C1.` está en la 848.
2. Las coordenadas iban **dentro** de un paréntesis mayor, «(SCRUM-1104 y 1106, volcadas en …)».
   `RE_TESTIGO` de `scripts/_anclas-con-testigo.mjs` se come ese paréntesis entero: el testigo empieza
   antes que las coordenadas y se cierra sin ninguna pendiente. Ningún testigo puesto dentro podía
   engancharse, ni el suyo ni el que yo había propuesto la noche anterior.

Arreglo: las coordenadas salen del paréntesis, con ruta completa (con sólo el basename el veredicto es
`SIN_RUTA` y nunca se compara el testigo), y cada una con el suyo: `docs/legal/PREGUNTAS_ASESOR.md:848`
(`Q-C1.`) y `:978` (`Q-C8.`). Veredicto de `veredictoDe`: las dos **FIRME**. **Control en rojo:** con
los testigos cruzados, las dos **DESFASADA**.

**D5.2 y D5.3.** Pasan de la parte 3 a la parte 2, **dentro de B1** y como dos confirmaciones de una
línea con la norma (ROF 6.1.d) párrafo segundo 3.º y 6.1.e) y la respuesta que esperamos, como decide
la descripción de este ticket. No se abre pregunta nueva, así que el recuento de 28 y las letras que
citan las partes 1 y 3 no cambian. La fila B1 de «De dónde sale cada pregunta» las nombra. D5.4 sigue
fuera y SCRUM-1258 sigue en la parte 3 como dato técnico.

## Vuelta 3 · las cuatro decisiones de Javier (30-sep-2026)

**Medido contra:** `origin/main` = `b6243e1c9f22e23b5a48332acc30ef533e55589f` · 2026-09-30T20:49:10Z

Sesión J5 de relevo, por encargo del orquestador. Antes: el commit `65996e85` de la vuelta 2 no estaba
«sin empujar»: `git merge-base --is-ancestor 65996e85 origin/main` sale 0, entró con el PR #1944
(merge `837a9e53`) y la rama remota se borró al mergear.

Javier contestó el 30-sep las cuatro decisiones de la parte 1 del bloque, y el bloque las contradecía
en seis sitios. Corregidos:

1. Parte 1, tabla de marcas: «ASESOR» · 23-sep, AUTORÍA SIN DECLARAR pasa a **IA · 23-sep** (las
   escribió una herramienta). Debajo, una línea nueva: ninguna de las 28 tiene hoy la revisión de un
   profesional (13 IA, 14 sin respuesta, la A3 con la de la AEAT).
2. Parte 1, «Cuatro decisiones tuyas» pasa a «Las cuatro decisiones, tomadas», con cada respuesta.
3. Parte 1, filas A3, B6 y E4 de «De dónde sale», y el recuento: 14 · 11 · 2 · 1 = 28, contado por
   script sobre la parte 2 (28 encabezados, 28 marcas).
4. Parte 2, la leyenda de marcas: la clase «ASESOR» desaparece y se dice que ninguna pregunta tiene
   hoy respuesta de un profesional.
5. Parte 2, B6 y E4: marca IA · 23-sep; la E4 deja de ser condicional y se envía entera.
6. Parte 3, 1232 Ⓗ.1-4: de «condicional» a **fuera definitivamente** (los 44 justificantes del censo
   del 10-ago eran de prueba).

Sin cambio: A3 sigue dentro (decisión 3) y las 28 siguen en la parte 2 (decisión 2). Los testigos de
`PREGUNTAS_ASESOR.md` de la fila de marcas no se han movido.

A9: sin fallo que generalice — la vuelta es aplicar cuatro decisiones escritas a un documento; el recuento se hizo por script, no a ojo.
