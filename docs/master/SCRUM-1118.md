# SCRUM-1118 · Dos citas del RFACT se saltaban texto legal con «(…)»: la norma estaba bien citada, la FORMA no

**Fecha:** 25-sep-2026 · **Carril:** legal · **Puesto:** J4 (jv-j4)
**Medido contra:** `origin/main` = `dac1f9d7f9cd5237778aa2cd3f9241bd2210855a` · 2026-09-25T15:05:50Z

## Qué pasaba

`docs/producto/CONTABILIDAD.md` §8 afirma que las citas se comprobaron «26 de 26». Corrí el comprobador
de la casa contra las seis fuentes bajadas el 25-sep con `curl` (GET público):
`node docs/verificacion/comprobar-citas-contabilidad.mjs docs/producto/CONTABILIDAD.md <carpeta>`.
Resultado: **29 citas extraídas, 27 encontradas, 2 NO ENCONTRADAS, exit 1**, con el control negativo
OK. Lo introdujo mi propio commit `3810f997` (SCRUM-1106b, 23-sep). Promoví a cita comprobada el RFACT
art. 6.1.m y 6.2.b usando «(…)» para saltarme texto legal real, y la nota de método de §8 prohíbe
justo eso: el comprobador exige una subcadena continua. Lo encontré de rebote en SCRUM-1096 y **no lo
arreglé de paso** (regla 6).

## Lo que importa: la norma estaba bien citada, lo que estaba mal era la FORMA

Cada fragmento, por separado, **es literal** en el RFACT consolidado de hoy (4 de 4 con `grep -F`):
- el encabezado del art. 6.1;
- la letra m);
- el encabezado del art. 6.2;
- la letra b).

Nadie pudo tomar una decisión equivocada por el contenido de estas dos citas. El defecto era que el
comprobador no podía demostrarlo y el documento decía que sí.

## Arreglo

Cada cita se parte en **dos citas contiguas**: el encabezado del apartado y la letra, unidas fuera de
las comillas por «y, en su letra m):» y «y, en su letra b):». No cambia ni una palabra del texto
legal. La nota de método de §8 lleva una marca `[CORREGIDO 25-sep-2026, SCRUM-1118]` con el recuento
de hoy.

⛔ El comprobador **no se toca** (regla 41): se arreglan las citas, no el guard.

## Medición

| pasada | citas | encontradas | exit |
|---|---|---|---|
| `origin/main` (antes) | 29 | 27 | **1** |
| esta rama | 31 (30 en §3, 1 en §4) | **31** | **0** |
| **control positivo**: copia de esta rama con dos citas que hoy SÍ se encuentran rotas a propósito («adquirente» → «adquiriente» en la m); «no se dé» → «sí se dé» en la b) | 31 | 29, y nombra exactamente esas dos | **1** |

El control positivo demuestra que el arreglo no apagó el comprobador: las dos citas nuevas siguen
vigiladas letra a letra.

## Siguiente

SCRUM-1117 (fecha de «Última actualización» por bloque) se construye encima de este comprobador. Por
eso este ticket va primero: un detector de cambios montado sobre un comprobador en rojo no distingue
«la norma cambió» de «estas dos citas nunca se encontraron».
