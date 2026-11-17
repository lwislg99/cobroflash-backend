# SCRUM-1746 — El campo de los desplazamientos del parte dice su unidad: «Desplazamientos (nº de viajes)»

**Puesto:** S4 · **Rama:** `scrum-1746-rotulo-desplazamientos` · 17-nov-2026
**Skill UI:** cargada
**Medido contra:** `origin/main` = `4566832477aa7b101588984765887369d6d0f024` · 2026-11-17T08:26:13Z (cabecera `Date:` de `gh api -i zen`)
A9: comprobación → `docs/master/evidencias/SCRUM-1746/c1746-rotulo.mjs`

## La firma

**Fundador, 17-nov-2026, en SCRUM-1746** (descripción del ticket). El orquestador le propuso el rótulo
«Desplazamientos (nº de viajes)» en el punto 2 de un lote numerado y el fundador contestó a ese
mensaje, literal, «2 lo que digas». El alcance del sí es ese punto. Ficha:
`docs/microcopy/2026-11-17-SCRUM-1746-desplazamientos-numero-de-viajes.md`.

## El defecto, medido

Recorrido H6 de SCRUM-1686, fila 18 (yaqu.app, 16-nov-2026): la casilla guarda el número de viajes
(`ParteTrabajo.desplazamientos`, un entero) y su rótulo decía solo «Desplazamiento». Quien rellenó el
parte escribió «20» creyendo que eran kilómetros.

PASO 0, hoy: `tests/scrum1746-rotulo-desplazamientos.test.mjs` contra `main` da 4 rojos de 5 (el
literal, el pintado en borrador, el pintado en firmado y la ficha). El quinto es el control y sale verde.
Commit del test en rojo: `9c4a6a48c`. En producción, el testigo del banco lee
`PARTE_TEXTOS.desplazamiento = "Desplazamiento"`.

## Lo que cambia

| fichero | qué |
|---|---|
| `public/dashboard/js/parteDetailView.js` | `TEXTOS.desplazamiento` pasa a «Desplazamientos (nº de viajes)», con su comentario de firma. Nada más. |
| `public/dashboard/css/styles.css` (bloque S4) | `.parte-horas-par { align-items: end; }`. A 390 px el rótulo nuevo ocupa dos líneas y «Kilómetros» una: sin la regla, la casilla de la izquierda queda 20 px más baja que su vecina. |
| `docs/microcopy/2026-11-17-SCRUM-1746-…md` | la ficha de la firma. |
| `scripts/_censo-convenio-microcopy-declarados.json` | el motivo de `TEXTOS.desplazamiento` cita la firma nueva (el censo lee nombres de clave, no textos: sin esto seguiría citando la de SCRUM-1215 para un literal que ya no es el suyo). |
| `tests/scrum1746-rotulo-desplazamientos.test.mjs` | el test, rojo primero. |
| `docs/master/evidencias/SCRUM-1746/c1746-rotulo.mjs` | la acción del banco que mide si el rótulo cabe. |

No cambian el dato, el esquema, la ruta ni el PDF.

## Verde

- El test nuevo: 5 de 5.
- Vecinos, sobre el árbol commiteado (`97e385fe5`): los 618 ficheros de `tests/` que nombran
  `parteDetailView`, `PARTE_TEXTOS`, `renderParte`, `microcopy`, el censo del convenio, `styles.css`,
  `docs/master` o la línea `A9:` → 5.316 tests, 5.196 en verde, 114 saltos y **6 rojos que no son de
  este cambio**, los seis por lo mismo: este worktree no tiene `node_modules` propio (resuelve hacia el
  compartido, un nivel más arriba).
  - `scrum1199-avisos-alta-cliente` (2): pide `express` por la ruta literal `<árbol>/node_modules/express`.
  - `scrum475-schema-vs-sql` (3): «la herramienta de la casa no responde» (el CLI de Prisma).
  - `scrum476-reconciliar-censos` (1): «CERO directorios `node_modules` en el árbol».

  En el CI hay `node_modules`: el veredicto de esos seis es el del check obligatorio, no el de aquí.
  NO se ha corrido la suite completa en local (pide turno; A6).
- En pantalla, con el banco H6 sobre yaqu.app y el front de esta rama servido encima
  (`LOCAL_DIR`; los datos son los de la cuenta QA), parte #23 (borrador) y parte #22 (firmado):

| ancho | estado | antes (producción) | después (esta rama) |
|---|---|---|---|
| 390 | borrador | «Desplazamiento» · 1 línea · casillas a la misma altura | «Desplazamientos (nº de viajes)» · 2 líneas · casillas a la misma altura · desborde 0 |
| 390 | firmado | «Desplazamiento» · 1 línea | «Desplazamientos (nº de viajes)» · 2 líneas · datos a la misma altura · desborde 0 |
| 1280 | borrador | «Desplazamiento» · 1 línea | «Desplazamientos (nº de viajes)» · 1 línea · misma posición que antes · desborde 0 |
| 1280 | firmado | «Desplazamiento» · 1 línea | «Desplazamientos (nº de viajes)» · 1 línea · misma posición que antes · desborde 0 |

- Control «ningún otro texto cambia»: el texto visible de la hoja, antes contra después, difiere en UNA
  línea a 390 (48 líneas) y en una a 1280 (49): la del rótulo.
- Sin la regla de CSS, medido: a 390 la casilla de desplazamientos quedaba en y=450 y la de kilómetros
  en y=430.

Las capturas y los `.txt` del banco están fuera de git, en
`D:\MILLONARIO\cobroFlash\evidencias-s4-17nov-estados\1746\`.

## Lo que salió mal por el camino

La primera medida «después» salió idéntica a la de «antes». El banco navegaba al mismo hash tras
montar el front local, y eso no recarga el documento: la página seguía con el script de producción. Lo
cazó el testigo que la acción imprime (el literal que la página tiene cargado), no la medida. La acción
ahora recarga, y el testigo se queda.

Y antes de empujar, una tanda ancha (618 ficheros de `tests/`) sacó tres rojos que eran de esta rama:
el test llevaba un nombre construido en un bucle (SCRUM-1415), la acción del banco interceptaba
yaqu.app sin importar quien abre su contexto (SCRUM-1233g) y la línea de la skill no tenía la forma que
se lee (SCRUM-1340). Los tres se arreglaron en lo mío, no en el guard.

## Lo que NO está hecho o no se ha medido

- **Regla 42:** falta verlo en yaqu.app tras el merge y el despliegue. Es la misma acción, sin
  `LOCAL_DIR`: el testigo tiene que leer el rótulo nuevo.
- **Los tres avisos de la casilla siguen diciendo «Desplazamiento», en singular** (SCRUM-1491 y
  SCRUM-1492). Tienen firma propia y la de hoy no los alcanza. Si se quieren acordes con el rótulo, es
  una propuesta de texto aparte.
- **El salto de línea a 390 parte el paréntesis** («Desplazamientos (nº de» / «viajes)»). Se lee, pero
  no es bonito. Evitarlo pide o un rótulo más corto (otra firma) o cambiar el par a una columna en móvil
  (otra pantalla). No se ha tocado.
- Un móvil de verdad: la medida es de Chromium con emulación a 390×844.
