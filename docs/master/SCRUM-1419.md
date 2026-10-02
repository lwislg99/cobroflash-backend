# SCRUM-1419 · Por qué se cancela una corrida de PR, y cuánto del veredicto es cola

**Rama:** `scrum-1419-canceladas-de-pr` · **Carril:** S5 · **Fecha:** 2-oct-2026
**Medido contra:** `origin/main` = `a2fe215e5fdd5f86b6b13fe009198daed27b3a5a` · 2026-10-02T12:28:18Z

A9: sin fallo que generalice — es una medición de sólo lectura; lo que encontró va abajo, y sus límites también

Encargo del orquestador. **Sólo mide: no toca `ci.yml` ni propone tocarlo.** Dos guiones de sólo
lectura y sus salidas, en `docs/master/evidencias/SCRUM-1419/`.

## En corto

- **Canceladas:** 70 de 246 corridas de PR terminadas (28 %). Las 70 tienen una sustituta: otra
  corrida de la MISMA rama nacida mientras vivían. Es el `cancel-in-progress` de `ci.yml` haciendo lo
  que dice. Ninguna quedó sin sustituta.
- **No es la misma causa que en `main`.** En los PR, 63 de las 70 ya tenían jobs con pasos ejecutados:
  se cancelan A MEDIA EJECUCIÓN por un empujón nuevo, no en cola. (En `main`, `cancel-in-progress`
  está apagado y lo que se sustituye es la corrida pendiente: SCRUM-1385.)
- **Nadie se queda esperando un veredicto que no llega, en esta ventana:** 0 de 127 ramas tienen su
  último commit con la última corrida cancelada.
- **Cola frente a ejecución, job obligatorio:** la ejecución es estable (mediana de 9,0 y 9,4 min). La
  cola depende del día: el 1-oct fue el 36 % del tiempo total y el 2-oct (hasta las 12:30Z) el 9 %.
- **Hay cola, y va a rachas.** El 1-oct, 31 de 168 corridas esperaron más de 10 min antes de tener
  ejecutor; la peor, 42,8 min. Entre las 02 y las 03 UTC la mediana de cola fue de 12,4 min.

## ① Las canceladas (`canceladas.mjs`, salida en `salida-1oct-2oct.txt`)

Ventana 2026-10-01T00:00Z → 2026-10-02T12:30Z. `ci.yml`, `event=pull_request`. La lista se pide con
el filtro de fechas en el servidor y se compara lo que llega con el total que la API declara.

| Qué | Cifra |
|---|---|
| Corridas | 251 (246 terminadas, 5 en curso) · 127 ramas · 240 pares rama+commit |
| Conclusión de las 246 | failure 108 · cancelled 70 · success 68 |
| Canceladas con sustituta de un commit NUEVO de la misma rama | 68 de 70 |
| Canceladas con sustituta del MISMO commit | 2 de 70 |
| Canceladas sin sustituta | 0 de 70 |
| Tenían algún job con pasos ejecutados | 63 de 70 |
| Minutos de vida de una cancelada | mín 0,3 · mediana 11,7 · máx 95,1 |
| Cómo acabó la sustituta | success 22 · failure 25 · cancelled 21 · en curso 2 |
| Commits cuya última corrida es «cancelled» | 68 de 240 |
| De ellos, punta de su rama | 0 de 127 |

Lo que dice `ci.yml` (leído, líneas 37-39 en `a2fe215e`): `group: ci-${{ github.ref }}` y
`cancel-in-progress` encendido para todo lo que no sea `main`.

- «failure 108» es la conclusión de la CORRIDA, que incluye los jobs informativos; no es el veredicto
  del obligatorio. No se usa para nada más aquí.
- 21 sustitutas acabaron a su vez canceladas: son cadenas de empujones seguidos a la misma rama.
- 68 commits no tienen ni tendrán veredicto, pero ninguno es el último de su rama: se empujó encima.

## ② Cola frente a ejecución (`cola.mjs`, salidas `salida-cola-1oct.txt` y `salida-cola-2oct.txt`)

Una llamada por corrida, a sus jobs. Del job obligatorio (último intento): COLA es desde que arranca
el intento hasta su primer paso; EJECUCIÓN, desde ese primer paso hasta que termina. Sólo entran los
que llegaron a success o failure.

| | 1-oct (día entero) | 2-oct (00:00 → 12:30Z) |
|---|---|---|
| Corridas · medidas | 199 · 168 | 54 · 41 |
| Sin veredicto del obligatorio (fuera de la cifra) | 30 | 12 |
| COLA · mediana · p90 · máx | 1,3 · 14,3 · 42,8 min | 0,3 · 1,5 · 9,5 min |
| EJECUCIÓN · mediana · p90 · máx | 9,0 · 10,1 · 12,8 min | 9,4 · 10,6 · 10,7 min |
| TOTAL · mediana · p90 | 10,9 · 22,4 min | 9,9 · 11,4 min |
| Fracción del tiempo que es COLA | 36,2 % (13,8 h de 38,1 h) | 9,1 % (0,6 h de 6,8 h) |
| Corridas con más de 10 min de cola | 31 de 168 | 0 de 41 |

Control de la lectura: la cola leída del primer paso y la leída de `started_at` del job coinciden
(difieren en más de 30 s en 0 de 168 y en 1 de 41).

Por hora, el 1-oct, las horas con cola son las de más corridas: 02h (27 corridas, mediana 12,4 min),
10h a 14h (de 9 a 21 corridas por hora, medianas de 1,4 a 12,4 min). Las horas con menos de diez
corridas tienen mediana de 0,1 min, salvo las 03h, que arrastran la racha de las 02h.

## Lo que se deduce, y lo que no

- La pregunta del encargo era si el techo es de cola o de tanda. Respuesta medida: **depende de la
  carga.** Con pocas corridas por hora el tiempo es casi todo ejecución; con muchas, la cola llega a
  ser más larga que la tanda. Acelerar la tanda no quita las rachas; quitar las rachas no baja los
  9 minutos.
- **Hipótesis, NO medida:** que la cola sea un tope de ejecutores simultáneos de la cuenta. Encaja
  con que cada corrida lanza varios jobs a la vez y con que la cola aparece con la carga, pero el
  tope de la cuenta no lo he podido leer con `gh`, y no he contado cuántos jobs corrían a la vez en
  cada instante.
- Cada cancelación a media ejecución es una tanda empezada y tirada. Cuánta parte de la cola del
  1-oct la causaron esas tandas tiradas no está medido.

## Lo que NO he medido

- QUIÉN cancela: la API no lo dice. «Sustituida» se deduce de que exista otra corrida de la misma
  rama nacida entre el nacimiento y la muerte de la cancelada (con 120 s de holgura).
- Quién empuja la sustituta (una sesión, o el bot al traer `main`).
- La cola de los demás jobs y workflows. El abridor de PR, en concreto, no está aquí: S0 vio dos
  corridas suyas 7 y 9 min en `queued` (37000948438 y 37001163700) y no las he mirado.
- El tiempo del empujón a que la corrida existe (lo midió S0 en SCRUM-1414).
- Más días. Son dos, y uno es medio día: dice que la cola existe y va a rachas, no con qué frecuencia.
- No usé el fichero de corridas de S0: listar cuesta tres llamadas y así la ventana es la que declaro.

## Cómo repetirlo

    node docs/master/evidencias/SCRUM-1419/canceladas.mjs <desde ISO> <hasta ISO> --tsv <fichero>
    node docs/master/evidencias/SCRUM-1419/cola.mjs <desde ISO> <hasta ISO> --tsv <fichero>

Los dos salen 2 y dicen NO PUDE MEDIR si una lista llega cortada o los jobs de una corrida no se
dejan leer. `cola.mjs` hace una llamada por corrida: un día de 200 corridas tarda unos cinco minutos.
