# SCRUM-539 · cuántos guards leen un fichero distinto al que va a CI — medido en dos árboles

**Medido contra:** `origin/main` = `6ec0e44fc2c79f926dcbef5da6b8615af24034eb` · 2026-08-20T03:25:00+01:00

> **20-ago-2026 · SOLO MEDICIÓN. No se arregla nada, no se rematerializa nada, no se toca ninguno
> de los 1.344 ficheros.** Lo único que entra en el repo es este documento.

## La respuesta, primero

**NINGÚN test cambia de veredicto entre los dos árboles.** Medido, no razonado: la misma tanda,
en el mismo commit, en un árbol con **1.344 ficheros con CR** y en un clon fresco con **0**, da
los cuatro números idénticos **y la misma lista de tests con el mismo veredicto en cada uno**.

**Y hay exactamente UNA excepción, que aparece solo en modo CI:** `SCRUM-480 · el ÁRBOL DE
TRABAJO no tiene ni un \r`. Es el **sensor del entorno**, no un guard cuyo sujeto sea el producto.
O sea que lo único que distingue a los dos árboles es el termómetro que existe para distinguirlos.

Eso **no** significa que el riesgo no exista: significa que hoy no se ha materializado. El
apartado del censo dice dónde está la exposición latente y por qué no muerde.

## El montaje: una sola variable

| | árbol veterano | clon fresco |
|---|---|---|
| ruta | `c:/Users/Javier Pereira/cobroflash-backend` | clon `--depth 1` de `origin/main` |
| HEAD | `6ec0e44f` | `6ec0e44f` — **el mismo** |
| `core.autocrlf` | `true` | `true` — **el mismo** |
| ficheros de texto | 1.517 | 1.517 |
| **con CR en disco** | **1.344** | **0** |

Desglose del veterano: `tests/` **504 de 560** · `src/` **216 de 243** · `docs/` 302 de 349 ·
`scripts/` 65 de 74 · `public/` 52 de 80 · otros 205 de 211.

Medido con node sobre `Buffer`, contando bytes 13 — **nunca con `grep`**, que en Git Bash
normaliza CRLF al leer y da falso negativo (medido en SCRUM-533).

## Los cuatro números, y la lista

Mismo comando en los dos: `npm run build && node --test --test-force-exit --test-reporter=tap tests/*.test.mjs`.

| | tests | pass | fail | skipped | exit |
|---|---|---|---|---|---|
| **veterano (1.344 con CR)** | 3760 | 3683 | 0 | 77 | 0 |
| **clon fresco (0 con CR)** | 3760 | 3683 | 0 | 77 | 0 |

Y **la comparación que de verdad decide**, porque cuatro números iguales pueden esconder dos
conjuntos distintos que se compensan: se parsearon las dos salidas TAP y se cruzaron por nombre.

```
nombres únicos · veterano ...... 3744
nombres únicos · clon fresco ... 3744
solo en el veterano ............ 0
solo en el clon ................ 0
🔴 con VEREDICTO DISTINTO ...... 0
```

## 🔴 La calibración, sin la cual lo de arriba no vale

«Las dos listas son idénticas» y «mi comparación está ciega» son el mismo resultado con
significados opuestos. Así que había que demostrar que el experimento **sabe ver** una diferencia.

Se corrió el mismo guard con `CI=1`, que es donde SCRUM-533 dejó bloqueando el censo del árbol:

```
VETERANO  ·  not ok 4 - SCRUM-480 · el ÁRBOL DE TRABAJO no tiene ni un `\r`   (10 tests, 1 fail)
CLON      ·  ok 4     - SCRUM-480 · el ÁRBOL DE TRABAJO no tiene ni un `\r`   (10 tests, 0 fail)
```

**Diferencia de veredicto provocada únicamente por el fin de línea.** El experimento no está
ciego, y de paso queda medido que **CI sí distingue los dos árboles** aunque la tanda local no.

## El censo: quién lee del disco, y quién podría cambiar de veredicto

Se siguió el **grafo de imports**, no solo el fichero del test: muchos leen a través de helpers
compartidos, y contar solo el fichero propio habría subcontado — que en este ticket es el error
caro.

| | |
|---|---|
| ficheros `*.test.mjs` | **486** |
| de ellos, **leen contenido del disco** | **398** |
| candidatos (parten líneas o anclan `$`, sin normalizar) | **137** |
| mixtos (algo de su grafo ya es consciente del CR) | 120 |
| sin señal | 141 |

**El patrón naive está extendido y aun así no muerde:** hay **85** `split('\n')` pelados en
**63** ficheros, frente a **35** `split(/\r?\n/)`. La razón, medida: partir `"a\r\nb"` por `'\n'`
deja `["a\r","b"]`, y lo que se hace después con esas líneas —`includes`, `test` sin ancla de
fin, `trim()`— no distingue. El `\r` viaja, pero no llega a cambiar ninguna comparación.

**Y el caso que sí habría cambiado, y por qué no cambia:** `scrum239-huella-de-codigo` calcula
una huella de contenido, que con CRLF daría otro hash. No lo da porque la calcula con
`git hash-object`, **que aplica el filtro de limpieza y normaliza a LF**. El único fichero que
hashea contenido leído a mano es `scrum201-citas-aeat`, y su veredicto coincide en los dos
árboles.

> **Lo que este censo NO demuestra**, y se dice en vez de dejarlo implícito: los 137 candidatos
> son ficheros donde el patrón *existe*; que ese patrón se aplique de verdad al contenido leído
> lo contesta la comparación de los dos árboles, no el heurístico. La cifra que manda es **0**.

## Mediciones pasadas que quedan en duda

**La ventana de divergencia se abre el 13-ago-2026**, y no antes: ese día SCRUM-480 renormalizó
los blobs a LF (`ca983956`) y añadió `eol=lf` (`e3efd01c`). **Antes de eso los blobs también
llevaban CRLF**, así que un checkout nuevo y el repo coincidían y no había nada que divergir.

| | |
|---|---|
| entradas de `docs/master/` que citan un recuento de tanda | **121** |
| anteriores al corte (repo y disco coincidían) | 117 |
| **en la ventana** | **4** |
| de esas, verdes y sin declarar árbol nuevo → **EN DUDA** | **2** |

**Las dos en duda** — se listan, **no se corrigen**, son historia:

- `docs/master/SCRUM-331.md` (20-ago-2026, 3.722 tests)
- `docs/master/SCRUM-333.md` (20-ago-2026, 3.717 tests)

Las otras dos de la ventana **no** están en duda: `SCRUM-513` porque la tanda que cita **no era
verde** (1 fail, justo este guard), y `SCRUM-517` porque **declara haber medido en árbol nuevo**.

> ⚠️ **Y el alcance de la duda es pequeño, medido:** la comparación de los dos árboles dice que
> hoy ningún veredicto cambia, así que esas dos tandas serían idénticas en un árbol limpio. Se
> listan porque **su evidencia no lo declaraba**, no porque se sepa que están mal.

🔴 **UN FALLO DE MI PROPIO INSTRUMENTO, y lo cuento porque es exactamente el tema del ticket:** la
primera versión de esta auditoría devolvió **«0 en la ventana»**. No era un dato: las entradas
nuevas escriben los miles con **punto** (`3.645 pass`) y mi clase de caracteres excluía el punto,
y algunas dicen «0 fallos» en vez de «0 fail». Un cero que sale de un regex roto se lee igual que
un cero medido.

**Lo que esta auditoría NO cubre, declarado:** solo mira entradas de `docs/master/` que citan un
recuento de tanda. Hay 236 entradas en total; las 115 restantes afirman cosas sin adjuntar una
tanda, y este barrido no las toca.

## Lo que sigue abierto, y no es de este ticket

- **Rematerializar el checkout** es de cada uno y no necesita ticket.
- **Los 85 `split('\n')` pelados** no son un defecto hoy —está medido— pero son la superficie por
  la que entraría el problema el día que alguien añada un ancla de fin de línea. No se tocan aquí.
- **`docs/`, `otros` y `public/` no se midieron por tanda** porque ningún test los ejecuta; su CR
  afecta a diffs y merges, que es lo que SCRUM-480 ya documentó.

## Ficheros

- `docs/master/SCRUM-539.md` — esta medición. **Nada más.**
