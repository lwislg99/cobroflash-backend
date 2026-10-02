# SCRUM-1427 · El traspaso derivado: lo que una sesión dejó, sacado de su rastro

**Medido contra:** `origin/main` = `643e9a65a5756b9729c9f8d4b911ea0c536988b3` · 2026-10-02T13:24:40Z

A9: comprobación → `tests/scrum1427-traspaso-derivado.test.mjs`

Carril S0 (`scripts/` de verificación, `tests/`, `docs/`). Nace de la rama de SCRUM-1418, de la que reusa
`arbolDe`, `arbolesDeVerdad` y `RUIDO_DEL_ARNES`. No toca el latido ni `memory/`.

`node scripts/traspaso-derivado.mjs <nombre-de-la-sesión> [--sin-arboles]`

## Por qué

El traspaso se escribe al final, y una sesión a la que le cortan la cuota o que muere a mitad de turno no
llega al final. SCRUM-1418 midió 32 sesiones sin traspaso en dos semanas. Se compararon tres formas:

| forma | habría servido para las 16 paradas sin traspaso | completo |
|---|---|---|
| A · la sesión lo escribe al cerrar cada tarea | 7 de 16 (las que llegaron a empujar) | 3 de 16 |
| **B · se deriva de su rastro, a demanda** | **16 de 16** | 16 de 16 en lo que tocó; 0 en lo que iba a hacer |
| C · un hook que apunta cada acción | lo mismo que B | descartada: necesita `.claude/**` y los hooks de `main` no llegan a quien arranca en el checkout viejo |

Aprobada la B por el orquestador. **No sustituye al traspaso escrito por la sesión**, que es lo único que
lleva el porqué: es la red para cuando no llega.

## Qué imprime, y de dónde sale

| | de dónde | ¿estructurado? |
|---|---|---|
| el encargo con el que arrancó | `intent` del `state.json` | sí |
| el último mensaje que recibió, y de quién | última entrada de usuario con `origin` | sí |
| tickets donde ESCRIBIÓ en Jira | llamadas a las herramientas de Jira que escriben | sí |
| PR | entradas `pr-link` | sí |
| órdenes de empujar | sus órdenes `git … push`, tal cual | la orden sí; la rama NO se deduce |
| ficheros escritos después de su último commit, y si hoy siguen sin comitear | sus `Write`/`Edit` y `git status` de cada árbol | sí |
| cómo se cortó | `isApiErrorMessage` / `error` de la entrada | sí |
| sus últimas palabras | el último texto que NO es del arnés | sí |

La salida empieza siempre con su marca: «TRASPASO DERIVADO — NO LO ESCRIBIÓ LA SESIÓN». Quien lo guarde
en `memory/` la conserva.

## Medido con la función ya construida (condición del orquestador: si el 16 de 16 bajaba, decirlo)

**No baja.** Sobre las sesiones reales, el 2-oct:

| | las 16 paradas sin traspaso | las 18 muertas o acabadas sin traspaso |
|---|---|---|
| CON RASTRO | 14 | 10 |
| NO HIZO NADA QUE MUTE | 2 | 8 |
| NO SUPE | 0 | 0 |
| con encargo · con último mensaje recibido | 16 · 16 | 18 · 18 |
| con palabras suyas | 16 | 15 (3 murieron sin decir nada) |
| con ficheros escritos tras su último commit | 10 | 6 |
| **cortadas por el arnés** | **10, las diez por `rate_limit`** | 0 |

Dos cosas que la exploración no había dado:

- **Las diez cortadas por `rate_limit` son exactamente las dos paradas colectivas** de SCRUM-1418 (las seis
  del 17-sep y las cuatro del 1-oct). Antes era una deducción por la hora; ahora lo dice un campo.
- **10 de las 34 no hicieron nada que mute.** No tenían nada que traspasar: «32 sesiones sin traspaso»
  cuenta a esas diez, y no son trabajo perdido.

**La prueba con el caso que conozco:** para `s0-1octb`, la sesión que relevé esta mañana, el comando da
solo el fichero que encontré a mano sin comitear (`scripts/auditoria-cierres.mjs` en su árbol), los tres
tickets, y como últimas palabras las suyas («SCRUM-1372 empujado…»), no el mensaje del límite semanal.

## Lo que NO ve

- Cambios hechos por consola (un `sed`, un script): solo `Write`/`Edit`.
- Por qué decidió nada, qué descartó, qué iba a hacer. Lo más cerca es el último mensaje que recibió.
- Nada, si la carpeta del trabajo ya no está en disco: entonces dice que no la encuentra, no que no hizo
  nada. Quién limpia `~/.claude/jobs` y cuándo no se sabe; va a la lista del fundador.
- Otra máquina.
- Dos sesiones con el mismo nombre: no elige, sale 2 y las nombra.

## La aceptación → dónde se ve

| aceptación (literal) | dónde se ve |
|---|---|
| Dado el nombre de una sesión, imprime: el encargo con el que arrancó · el ÚLTIMO mensaje que recibió y de quién (origen estructurado) · los tickets donde escribió en Jira · los PR · las ramas que empujó · los ficheros que escribió DESPUÉS de su último commit, por árbol, y si hoy siguen sin comitear · sus últimas palabras. | `tests/scrum1427-traspaso-derivado.test.mjs` («lo que dejó», «el último mensaje que recibió», «cada fichero de después del commit») — ver la nota de abajo |
| Las últimas palabras son las SUYAS. Un mensaje del arnés (el de «límite semanal») no cuenta: se salta y se coge el último texto de la sesión. Si no hay ninguno, lo dice («murió sin decir nada»). | `tests/scrum1427-traspaso-derivado.test.mjs` («la sesión cortada por cuota», «murió sin decir una palabra») |
| Tres cubos, y se distinguen: CON RASTRO · NO HIZO NADA QUE MUTE (transcripción leída entera, sin escrituras ni empujones) · NO SUPE (sin transcripción, vacía o con líneas ilegibles). Una carpeta borrada no es «no hizo nada». | `tests/scrum1427-traspaso-derivado.test.mjs` («los TRES cubos no se confunden») |
| La marca es obligatoria: la salida empieza diciendo que es un traspaso DERIVADO, que no lo escribió la sesión y que no lleva intención. | `tests/scrum1427-traspaso-derivado.test.mjs` («la MARCA va la primera siempre») |
| Las cifras de la exploración se fijan con casos fabricados. Si al fijarlas el «16 de 16» baja, se dice antes de terminar. | `docs/master/SCRUM-1427.md` («Medido con la función ya construida») |
| Tests con transcripciones fabricadas, probados en rojo. Entre ellos: la sesión cortada por cuota, la que no hizo nada, la que no tiene transcripción. | `tests/scrum1427-traspaso-derivado.test.mjs` · «Probado en rojo», abajo |
| No sustituye al traspaso escrito por la sesión, y la salida lo dice. | `tests/scrum1427-traspaso-derivado.test.mjs` («la MARCA va la primera siempre») |

**Nota a la primera fila:** la aceptación dice «las ramas que empujó». Lo construido imprime la ORDEN de
empujar tal cual y no deduce la rama: sacar una rama de una orden de consola es leer por la forma, que es
el error de C5 y C6. Quien lee la orden ve la rama; el script no la afirma.

## Probado en rojo

Trece mutaciones, con la base sin mutar en verde. Doce tumbaron el test a la primera: el mensaje del arnés
cuenta como palabra suya · decide por el texto y no por el campo · un corte viejo sigue siendo cómo acabó ·
sin transcripción es «no hizo nada» · una transcripción cortada se da por entera · la memoria cuenta como
trabajo · leer un ticket cuenta como escribir · un resultado de herramienta es un mensaje recibido · sin la
marca · un árbol sin mirar se da por limpio · con dos del mismo nombre elige una · NO SUPE sale 0.

## Mis errores

1. **Una mutación sobrevivió: «no corta en el último commit».** Mi caso editaba antes del commit el mismo
   fichero que después, y como la lista no repite, salía igual con el corte que sin él. → comprobación: el
   caso lleva ahora un fichero editado SOLO antes del commit, que no puede aparecer.
2. **En el diseño dije «34 sesiones sin traspaso» como si las 34 hubieran perdido algo.** Con la función
   construida, 10 de ellas no hicieron nada que mute. La cifra que importa es 24.
3. **Corrí los guards de tres ramas en una sola orden** y pasó de diez minutos: el sistema la mandó sola a
   segundo plano. La paré en cuanto lo vi y la repetí rama a rama.

## Un dato de la máquina que salió al empujar (2-oct)

**La falta de memoria no solo mata sesiones: también vuelve ciegos los guards.** Con 38 procesos de node
vivos en la máquina, `guards:entrada` cortó a su runner al pasar el plazo de 90 s y salió CIEGO (salida 2:
«no terminé; no sé nada de tus guards»). Repetido solo, minutos después y sin cambiar una línea: verde en
57,6 s. Una sesión muerta se ve; un guard ciego se parece a un guard. Lo que lo salvó es que el guard DIJO
que estaba ciego en vez de dar un verde, y que no se empujó con él.
