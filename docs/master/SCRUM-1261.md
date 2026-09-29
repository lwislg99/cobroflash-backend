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
