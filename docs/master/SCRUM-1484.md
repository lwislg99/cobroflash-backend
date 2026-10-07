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

## SCRUM-1484b · `contexto N` dice la misma frase que el latido, y el papel de S5 deja de negarlo

**Rama:** `scrum-1484b-una-frase-y-su-papel` · **Carril:** S5 · **Fecha:** 7-oct-2026
**Medido contra:** `origin/main` = `73ce872cbcb6c914355830fd6b358e30aa066c77` · 2026-10-07T07:14:33Z (hora de GitHub)

A9: comprobación → `tests/scrum899c-relevar-y-contexto.test.mjs`

**El fallo, que es mío.** SCRUM-1484 (#2238) metió el segundo número en el código el 6-oct y dejó dos papeles
diciendo lo contrario. Uno es de la S0 (la A19, abajo). El otro es de S5 y no lo toqué:
`docs/equipo/orquestador-autonomo.md` §5bis.1 seguía diciendo que el número de «a mitad» «no está en el código: el
latido dice la misma frase para los dos casos». El 7-oct el encargo del día repartió «construir» SCRUM-1484, que
ya estaba en `main`. No sé si quien repartió leyó ese párrafo; sé que el párrafo decía eso.

### Qué cambia

| Sitio | Antes | Ahora |
|---|---|---|
| `scripts/equipo/sesion.mjs` · `fraseDeRelevo` | (no existía; la frase vivía dentro del latido) | la frase de la A19 para una ventana que pasó el primer número, en UN sitio |
| `scripts/equipo/sesion.mjs` · `decidirRelevo` (lo que imprime `contexto N`) | `RELEVAR` · «por encima de 300k», también a una sesión de 800k | `RELEVAR` + `momento` (`AL-TERMINAR` o `YA`) y la frase del latido. Con los dos números iguales o al revés: `NO-PUDE-MIRAR` |
| `scripts/equipo/latido.mjs` · `seccionContexto` | escribía las dos frases | las toma de `fraseDeRelevo`; lo que imprime no cambia |
| `docs/equipo/orquestador-autonomo.md` §5bis.1 | «no está en el código» | dónde vive, qué dicen los dos instrumentos y quién dejó el número en 500k |
| `tests/scrum899c-relevar-y-contexto.test.mjs` | sólo el veredicto | dos tests nuevos y dos mutaciones declaradas |

**El número no cambia: sigue en 500k.** El orquestador de Luis lo dejó así el 7-oct (SCRUM-1479 c.18622) con la
medición de `docs/master/evidencias/SCRUM-1479/`. No lo firmó el fundador y aquí queda dicho: no se mueve el
número ni sube el gasto. Su comentario dice que hoy «no hay ningún corte» por encima del umbral de entrega; lo
había desde el 6-oct, en la norma y en el código. La conclusión es la misma: se queda como está.

### La medida que faltaba: el latido contra una sesión VIVA

`node scripts/equipo/latido.mjs` desde un árbol en `725c0e3a1fff3409fdc2db2bdd493918cba5cec0`, el 7-oct entre
las 07:05Z y las 07:12Z: 24 leídas, 10 por encima de 300k y **una por encima de 500k**. Es la primera vez que la
orden entera imprime la frase sin sesiones fabricadas:

    (sin trabajo de fondo: ed676fd1) · 530k de ventana, por encima de 500k (A19, a mitad de entrega): se releva YA, sin esperar a terminar — primer punto seguro (un commit local), traspaso y relevo · último turno hace 3 min

Las otras nueve dicen «AL TERMINAR su entrega». Desde el árbol de la rama, minutos después, las mismas líneas
(la primera ya en 536k). `ed676fd1` es la transcripción del chat del orquestador de Luis.

### `decidirRelevo` con transcripciones reales, en los dos árboles

Sonda fuera de git: lee los jsonl tocados en 36 h de `~/.claude/projects` y les pasa `decidirRelevo` con
`ultimaActividad = ahora`, para medir sólo la rama del tamaño. 60 jsonl, 60 leídos, 0 ilegibles, 59 con algún
turno con uso. No son sólo sesiones del equipo: es todo lo tocado en esa carpeta.

| árbol | `RELEVAR` | con `momento: YA` | con `AL-TERMINAR` | sin `momento` | `SEGUIR` |
|---|---|---|---|---|---|
| la rama | 35 | 7 (de 502k a 845k) | 28 | 0 | 24 |
| `main` (`725c0e3a`) | 35 | 0 | 0 | 35 | 24 |

En `main` a las siete de más de 500k les dice «por encima de 300k», igual que a la de 427k.

### Visto en rojo

Sobre `tests/scrum899c-relevar-y-contexto.test.mjs` y `tests/scrum1350-latido.test.mjs`, con el árbol comiteado
(`2e3dda3e7a47ab80530f438350a887e08786d1fa`). Base: 52 tests, 52 pasan, antes y después.

| Mutación en `sesion.mjs` (`git diff --numstat`: 1 1) | Caen |
|---|---|
| `const yaSinEsperar = tokens > umbralAMitad;` → `false` | 2: el test de las dos frases del latido (SCRUM-1484) y el nuevo de `contexto N` |
| la puerta de los umbrales al revés de `decidirRelevo` → `if (false)` | 1: el nuevo de `contexto N` |
| `momento` siempre `'AL-TERMINAR'` | 1: el nuevo de `contexto N` |
| `sesion.mjs` y `latido.mjs` enteros de `origin/main` (el código viejo) | 1: el nuevo de `contexto N` |
| `UMBRAL_CONTEXTO_A_MITAD = 500_000` → `450_000` | 1: el del papel de S5 |

Tras cada una, `git restore --source=HEAD` y `git status --porcelain` vacío.

### Lo que queda fuera, dicho

- **La copia INSTALADA del lanzador** (`%LOCALAPPDATA%\yaqu-equipo\sesion.mjs`) queda distinta de `main` cuando
  esto entre, hasta que `arranque.cmd` la reescriba. No la he tocado.
- `gasto-arranque.mjs vivas` sigue con un número: lista quién pasa del primero, no dice cuándo.
- El test nuevo ata el papel de S5, no la A19: quien mueva el número sigue teniendo que cambiar la norma a mano.
- No visto: `sesion.mjs contexto <nombre>` impreso por la orden instalada contra una sesión con nombre de más de
  500k. La transcripción de 530k no es un trabajo de fondo y la orden pide un nombre.

### Gemelo de la S0 (aceptación 5): sigue SIN hacer, y ahora son dos frases

En `docs/equipo/00-normas-comunes.md`, A19, a las 07:14Z del 7-oct:

1. «⚠️ **El latido no avisa de este caso** (SCRUM-1484): …» hasta «…los 500k los vigila la propia sesión con la
   casilla 1.» Es falso desde el 6-oct: el latido avisa, y hoy se ha visto con una transcripción viva.
2. «⏳ Ese segundo número está sin volver a decidir (lo decide el fundador; SCRUM-1479)». Desde el 7-oct tiene
   respuesta (c.18622): se queda en 500k, y lo dejó el orquestador, no el fundador.

`docs/equipo/limites-del-fundador.md` no hay que tocarlo: dice que el fundador no lo ha vuelto a decidir y que
sigue valiendo el de antes, y las dos cosas siguen siendo ciertas. La A19 no es de S5.
**SCRUM-1484 no se cierra hasta que salga la primera.**
