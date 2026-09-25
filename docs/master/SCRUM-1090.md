# SCRUM-1090 · la familia B del guard fiscal ignora `!negada` como ya hace la A

**Medido contra:** `origin/main` = `639a276ffbd6e4ce8ef89b7f8e81c72fad31c111` · 2026-09-25T08:47:23Z
**Rama:** `scrum-1090-guard-negacion-familia-b` · **Reportado por:** J3 / equipo de Javier

## El defecto, medido antes de tocar nada (PASO 0)

`scripts/_guard-afirmacion-fiscal.mjs:113` calcula `negada = NEGACION.test(limpia)` una sola vez
para las dos familias que comparten patrón léxico, pero solo la familia A la usaba
(`CERTIFICACION.test(limpia) && !negada`, línea 115). La familia B (línea 127,
`CONSTRUIDA.test(limpia) && !envioConstruido`) no comprobaba `negada`, así que bloqueaba como
afirmación falsa una frase VERDADERA y NEGADA: el subtítulo firmado de SCRUM-1016, «la remisión a
Hacienda todavía no está construida», que es exactamente lo que el guion H2 obliga a decir sobre
VeriFactu antes de SIF-1.

## El arreglo

Una condición: `CONSTRUIDA.test(limpia) && !envioConstruido && !negada` — la misma forma que ya
tenía la familia A en la línea 115. No se toca `NEGACION` ni ninguna otra familia (C sigue sin
mirar `negada`, y no le corresponde a este ticket decidir si debería).

`tests/scrum537-afirmacion-falsa.test.mjs` suma dos casos:
- rojo antes / verde después: la frase negada y verdadera de SCRUM-1016 ya no la bloquea la B.
- control negativo: la misma familia B, sin negación, sigue bloqueando — el arreglo empareja con
  A, no ablanda el guard.

## Lo que se comprobó

`node --test tests/scrum537-afirmacion-falsa.test.mjs` en verde con los dos casos nuevos. No se
relajó ningún guard (norma A7): el guard sigue bloqueando la afirmación falsa sin negar: solo dejó
de bloquear la verdadera y negada.
