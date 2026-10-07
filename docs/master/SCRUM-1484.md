# SCRUM-1484 · El latido dice una frase distinta por encima del umbral de «a mitad de entrega»

**Rama:** `scrum-1484-latido-a-mitad-de-entrega` · **Carril:** S5 · **Fecha:** 6-oct-2026
**Medido contra:** `origin/main` = `2822251746ce8fdb2602f693068d313d577eb245` · 2026-10-06T19:57:41Z (hora de GitHub)

A9: comprobación → `tests/scrum1350-latido.test.mjs`

> ⚠️ **Esta rama sale de la de SCRUM-1479 (PR #2235), no de `main`.** Las dos tocan las mismas líneas de
> `sesion.mjs` y de `tests/scrum1350`. Mientras #2235 no entre, el PR de ésta enseña también sus commits.

## El defecto

La A19 tiene dos números y dos conductas: por encima del primero, relevo AL TERMINAR la entrega; por encima del
segundo, YA, en el primer punto seguro. `seccionContexto` de `scripts/equipo/latido.mjs` conocía sólo el primero
y a toda sesión que lo pasaba le escribía «se releva AL TERMINAR su entrega». Para una sesión por encima del
segundo eso es lo contrario de la norma, y el latido es lo que se lee para no tener que acordarse.

## Qué cambia

| Sitio | Antes | Ahora |
|---|---|---|
| `scripts/equipo/sesion.mjs` | un número, `UMBRAL_CONTEXTO` | además `UMBRAL_CONTEXTO_A_MITAD`, al lado |
| `scripts/equipo/latido.mjs` · `seccionContexto` | una frase para todo lo que pasa del primero | por encima del segundo: «…por encima de 500k (A19, a mitad de entrega): se releva YA, sin esperar a terminar — primer punto seguro (un commit local), traspaso y relevo» |
| `seccionContexto`, con los dos números iguales o al revés | (no existía el caso) | sección CIEGA, sale 2: no se elige una frase |
| `tests/scrum1350-latido.test.mjs` | fijaba la frase única | dos tests nuevos: las dos frases con dos sesiones fabricadas, y el caso ciego |

Igual al segundo número todavía es «al terminar»: la norma dice «si pasa de».

## De dónde salen los dos números (aceptación 4)

| Número | Valor | Leído en |
|---|---|---|
| Al entregar · `UMBRAL_CONTEXTO` | 300k | la A19 que entra con SCRUM-1282d en #2235 («si el contexto de la sesión pasa de 300k»); autorizado por el fundador el 6-oct-2026 (SCRUM-1479 c.18513) |
| A mitad · `UMBRAL_CONTEXTO_A_MITAD` | 500k | la A19, «en mitad de una entrega, si pasa de 500k»: está así en `main` (`docs/equipo/00-normas-comunes.md:519` a las 19:57Z) y sigue así en #2235 |

**El segundo NO es una decisión de este ticket.** El 6-oct-2026 el fundador volvió a decidir el primero y no éste;
aquí se copia el que la norma lleva escrito. Lo que la medición de ese día sostiene para él (~450k) está en
`docs/master/SCRUM-1479.md` y espera a quien lo decida. Cambiarlo es una línea, junto con la norma.

## Visto en rojo

Sobre `tests/scrum1350-latido.test.mjs` (37 tests, 37 pasan en limpio):

| Mutación en `latido.mjs` | Test que cae |
|---|---|
| volver a una sola frase (`linea: f.tokens > umbralAMitad` → `linea: false`) | «SCRUM-1484 · 🔴 DOS umbrales, DOS frases…» (36 pasan, 1 cae) |
| quitar la puerta de los umbrales al revés (`if (!(umbralAMitad > umbral))` → `if (false)`) | «SCRUM-1484 · 🔴 CIEGO…» (36 pasan, 1 cae) |

Las dos se deshicieron; `git diff` de `latido.mjs` tras cada una es el del cambio.

## Lo que NO se ha podido ver

**La frase nueva impresa por `node scripts/equipo/latido.mjs` contra una sesión viva.** Corrido a las 19:57Z:
23 leídas, 7 por encima de 300k (todas con «AL TERMINAR», que es lo suyo) y **ninguna por encima de 500k**; la
mayor, 428k. Lo mismo pasó a las 18:33Z (SCRUM-1484 c.18507). La frase de «YA» sólo se ha visto con sesiones
fabricadas en el test. El día que una sesión viva pase de 500k se ve sola en la sección CONTEXTO.

## Lo que queda fuera, dicho

- `sesion.mjs contexto N` y `decidirRelevo` siguen con un solo número (RELEVAR / SEGUIR). No distinguen «a
  mitad»: el ticket pide el latido.
- `gasto-arranque.mjs vivas` tampoco.

## Gemelo (aceptación 5): NO está hecho aquí

La A19 lleva la frase «⚠️ El latido no avisa de este caso (SCRUM-1484)». Sale de la norma cuando esto entre, y
el fichero es de la S0 (`docs/equipo/00-normas-comunes.md`): avisada en SCRUM-1484 y en SCRUM-1282. **Este
ticket no se cierra hasta que esa frase salga.**
