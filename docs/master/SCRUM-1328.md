# SCRUM-1328 · Quién pisa el TAP de la tanda: tres hijos que heredan el reporter por `NODE_OPTIONS`

**Medido contra:** `origin/main` = `8f5906bc51c1c17dfd4fd3d44c1bd028324b8f48` · 2026-10-01T07:50:46Z
(J3f del equipo de Javier, relevo de J3e, por encargo del orquestador `cobroflash-backend-5b`)

A9: aviso → cicatriz J3 «Un canario con un solo fichero no ve a quien pisa el TAP: el padre lleva 15 bytes escritos y tapa al hijo. Se mide en mini-tanda, con relleno delante. (SCRUM-1328)» — no se pudo comprobar: es cómo se monta una medición puntual fuera del árbol, no algo del repositorio que un test pueda mirar

## 0 · En una frase

El artefacto `tanda-tap` llega con el 94 % de bytes NUL porque **tres ficheros de test lanzan un hijo
que usa `node:test` quitándole `NODE_TEST_CONTEXT` y dejándole `NODE_OPTIONS`**, que es donde
`.github/workflows/ci.yml` pone el reporter TAP y su destino. El hijo abre **el mismo fichero**,
truncándolo, y escribe desde el byte 0; el padre sigue escribiendo en su desplazamiento. No hay
segunda causa, y no es algo nuevo posterior a SCRUM-1308.

**Este registro es sólo la medición. No arregla nada**: el arreglo vive en SCRUM-1289 (equipo de
Luis, `area-s5`), PR #1990 y PR #2000, abiertos. No se ha tocado ninguno de los dos, ni
`scripts/_suelo-de-la-tanda.mjs`, ni ningún workflow, ni ningún test.

Todo lo de aquí está medido en **Windows 11, node v24.18.0**. El CI corre en Linux con node
v24.21.0: lo que se sabe de allí sale de sus artefactos (§2), no de haberlo ejecutado.

## 1 · El rojo primero, fuera de YaQu

Tres ficheros triviales y un hijo, sin una línea de la casa (`evidencias/scrum1328/laboratorio/`,
se monta con `montar.sh`): 300 casos de relleno, un fichero que lanza un `node` hijo de 5 casos, y
40 casos más. Los reporters van como en `ci.yml`: `spec` a la consola y `tap` a un fichero, los dos
en `NODE_OPTIONS`.

| Qué se le deja al hijo | Reporters del padre | TAP |
| --- | --- | --- |
| no hay hijo (línea base) | `NODE_OPTIONS` | entero: 343 casos, 0 NUL |
| sin `NODE_TEST_CONTEXT`, **con** `NODE_OPTIONS` | `NODE_OPTIONS` | **PISADO: 89,9 % de NUL**; en cabeza los 5 casos del hijo, y del padre sólo se leen los casos 301 a 343 |
| sin `NODE_TEST_CONTEXT` y sin `NODE_OPTIONS` | `NODE_OPTIONS` | entero |
| con `NODE_TEST_CONTEXT` (se cree hijo de la tanda) | `NODE_OPTIONS` | entero |
| sin `NODE_TEST_CONTEXT`, con `NODE_OPTIONS` | **argumentos** de `node --test` | entero |

Repetido: **20 pisadas de 20**. Con el hijo siendo otro `node --test` en vez de un script suelto
(la forma de `scrum850b` y `scrum928`) sale lo mismo: 90,3 % de NUL, y entero en los tres controles.
Salida completa: `evidencias/scrum1328/salida-laboratorio.txt`.

La forma del fichero pisado es la del ticket: **un TAP pequeño y completo al principio, un solo tramo
de NUL, y la cola del padre**. Son dos escritores con desplazamientos distintos sobre el mismo
fichero, no un fichero truncado ni una subida a medias.

## 2 · Lo mismo en los artefactos de hoy

Tres artefactos `tanda-tap` del 1-oct-2026, bajados y medidos byte a byte
(`evidencias/scrum1328/salida-anatomia-3-artefactos.txt`):

| Run | Qué probaba | Bytes | NUL | En cabeza | Cola del padre desde |
| --- | --- | --- | --- | --- | --- |
| 36828206142 | `main` @ `761db44f` | 2.399.429 | 2.259.036 (94,1 %), 1 tramo | 122 casos de `guards:entrada` | caso 9.215 |
| 36826604612 | `main` @ `eb3d3b36` | 2.398.805 | 2.258.422 (94,1 %), 1 tramo | 122 casos de `guards:entrada` | caso 9.212 |
| 36825577571 | PR #2058 | 2.394.903 | 2.254.523 (94,1 %), 1 tramo | 122 casos de `guards:entrada` | caso 9.200 |

De ~9.560 casos se leen 353 del padre. La población anterior, que no repito: J3c contó 94 ilegibles
de 95 tandas acabadas (comentario 17710 del ticket) y J6g 594 de 627 artefactos (comentario 17808
de SCRUM-1339).

## 3 · Quién lo pisa en el árbol

Cada fichero corre en su propia mini-tanda de tres (relleno de 300 casos, el fichero, relleno de 40),
de uno en uno, con los reporters en `NODE_OPTIONS` y el TAP fuera del árbol
(`evidencias/scrum1328/mini-tanda.mjs`).

**Población: 107 ficheros de 1.161** de `tests/*.test.mjs` — los que nombran `child_process`,
`spawn`/`exec…Sync`/`fork(`, `NODE_TEST_CONTEXT` o `NODE_OPTIONS` (`lista-107.txt`).
**104 enteros, 3 pisados, 0 con casos caídos, 0 sin TAP** (`salida-mini-tanda-107.txt`).

| Fichero | Qué lanza | Lanzamientos | Lo que deja en cabeza |
| --- | --- | --- | --- |
| `tests/scrum976-guards-entrada-con-techo.test.mjs` | `scripts/guards-entrada.mjs`, que corre `node --test` sobre 122 casos | 1 | 56 KB: los 122 casos de `guards:entrada` |
| `tests/scrum850b-las-formas-que-mienten.test.mjs` | `bash -c "node --test …"` sobre un fixture | 13 | 2 casos, «ESTE TEST FALLA A PROPOSITO» |
| `tests/scrum928-guards-entrada-recuento-con-color.test.mjs` | `node --test` sobre un fixture | 1 | 2 casos |

Los tres hacen lo mismo: copian `process.env`, borran `NODE_TEST_CONTEXT` (sin eso el hijo se niega a
correr) y no tocan `NODE_OPTIONS`.

🔴 **Sólo se ve al último que trunca.** Cada hijo borra lo que dejó el anterior, así que en los
artefactos de `main` sólo aparece `guards:entrada`; `scrum850b` y `scrum928` están debajo. Limpiar un
hijo destapa al siguiente: J3c ya vio asomar el fixture de `scrum850b` en los artefactos de la rama
de #1990, donde `scrum976` está limpio.

**Y con los reporters como argumentos, los tres salen enteros** sin tocarles nada: 6 de 6 con dos
ficheros limpios de control (`salida-mini-tanda-6-argumentos.txt`, frente a
`salida-mini-tanda-6-opciones.txt`).

## 4 · Lo que le sirve al dueño del arreglo (SCRUM-1289)

1. **Sacar los reporters de `NODE_OPTIONS` (lo que hace #2000) arregla la clase**: nadie hereda el
   destino, lo lance quien lo lance. **Limpiar hijo a hijo (lo que hace #1990 con `scrum976` y
   `scrum928`) deja a `scrum850b` pisando.**
2. Los tres artefactos de hoy llevan la misma huella: 122 casos de `guards:entrada`, un tramo de NUL
   del 94,1 % (2,25 MB) y la cola del padre desde el caso 9.200 a 9.215.
3. Leído en GitHub el 1-oct-2026 a las 07:50Z: #1990 y #2000 no tienen commits desde el 29-sep
   (17:30Z y 17:58Z), van 305 y 299 commits detrás de `main`, y su último «build + tests» (1-oct,
   02:29Z y 03:05Z) acabó en `FAILURE`.

## 5 · Lo que NO está medido

- **Los otros 1.054 ficheros de test.** No nombran ninguna de las palabras de la lista, pero pueden
  lanzar un hijo a través de un helper. No se barrieron por decisión del orquestador: el arreglo es
  de clase y no depende de quién lance el hijo, así que enumerarlos no cambia ninguna decisión.
  **104 de 107 no es «104 de 1.161».**
- **Linux.** Nada de esto se ejecutó allí. Que en CI el que queda en cabeza es `guards:entrada` se
  lee en los artefactos; que `scrum850b` y `scrum928` también truncan allí, no lo he visto escribir.
- **Los tests saltados.** Los gateados por base (`QA_DB_TEST` y hermanos) no corrieron aquí.
- **El control positivo del ticket sobre la tanda de verdad** («un TAP de un run limpio llega
  entero»): está medido en el laboratorio y en las mini-tandas, no en una tanda completa. No se
  lanzó ninguna: la máquina iba justa de memoria y no había turno.

## 6 · Los instrumentos, y lo que cada uno no ve

- `anatomia-tap.mjs` — tramos de NUL y de texto de un TAP, con sus recuentos. Sólo lee.
- `mini-tanda.mjs` — **el que decide.** Mide bytes con el padre llevando ya ~70 KB escritos. No ve a
  un hijo que escribiera más que eso sin dejar hueco; por eso la salida lleva también cuántos casos
  del relleno se leen, y en los 104 enteros se leen los 300.
- `censo-quien-pisa.mjs` + `sonda-proceso.mjs` — segunda opinión, por procesos. Nombra al hijo.
  Da falsos positivos medidos (§7) y por eso no decide.

Para repetirlo: `bash docs/master/evidencias/scrum1328/montar.sh <carpeta fuera del árbol, sin
espacios>` y las órdenes que lleva en su cabecera.

## 7 · Cuatro errores míos

1. **Mi primer instrumento dio `scrum850b` y `scrum928` por limpios.** Miraba los bytes de un canario
   corriendo UN fichero: ahí el padre lleva 15 bytes escritos cuando el hijo trunca, y lo que escribe
   después tapa al hijo entero. Lo cazó que J3c había visto a `scrum850b` en CI. Es la cicatriz de
   arriba.
2. **La sonda de procesos salió CIEGA en su propio control** (el corredor `node --test` no carga el
   `--import`; sólo sus hijos) y después dio **siete falsos positivos**: seis scripts corrientes
   lanzados por `bash` con la marca heredada (`salida-sonda-de-procesos-76-regla-sin-afinar.txt`) y
   `scrum754`, cuyo hijo llama a `run()` y carga el arnés sin abrir el destino. Los desmintió la
   mini-tanda.
3. **Dos veces pasé texto con barras invertidas a `node` a través de `bash`** y reventó. Estaba
   escrito en la memoria del puesto y lo repetí.
4. **Mi control del sufijo usó como positivo una rama que ya no existía** (la de SCRUM-1339, ya
   mergeada y borrada): salió vacío y no valía. Repetido con la de SCRUM-1289.
