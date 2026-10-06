# SCRUM-1486 · `insertBefore` del banco mira su referencia, y el banco gana `firstChild` y `nextSibling`

**Rama:** `scrum-1486-insertbefore-del-banco` · **Carril:** S3 · **Fecha:** 6-oct-2026
**Medido contra:** `origin/main` = `317c0bab5ed17aa7700f97cfca308d05d4238a8d` · 2026-10-06T18:38:34Z

A9: comprobación → `tests/scrum737-cifra-con-arbol-y-hora.test.mjs`

Sesión 3 del equipo de Luis (tests · bancos · instrumentación). Encargo del orquestador de Luis:
«cuenta antes de arreglar; si cambian cero veredictos, arréglalo; si alguno pasa a rojo, para». La
cuenta la dejó hecha la sesión anterior de este puesto en el propio ticket; aquí está el arreglo.

**No se toca ninguna vista ni ningún test que ya existía.** Un fichero cambiado
(`tests/_banco-vistas.mjs`), uno nuevo (`tests/scrum1486-insertbefore-del-banco.test.mjs`) y las
evidencias.

## El defecto

`insertBefore` del banco recibía UN argumento y hacía `unshift`: lo insertado iba siempre el
primero, se pidiera donde se pidiera. Y `firstChild` y `nextSibling` no existían (daban
`undefined`). No es un hueco de los que revientan: la API contestaba, y contestaba otra cosa.

## Qué cambia en el banco

| pieza | antes | ahora |
|---|---|---|
| `insertBefore(nuevo, ref)` | ignora `ref`, pone el primero | justo antes de `ref`; al final si `ref` es `null` o no se pasa |
| `insertBefore(x, x)` | — | `x` se queda donde estaba (el estándar toma su siguiente hermano) |
| `ref` que no es hija del padre | — | lanza `NotFoundError`, **antes** de mover nada |
| `firstChild` | `undefined` | el primer hijo, o `null` |
| `nextSibling` | `undefined` | el siguiente hermano, o `null` |

Las tres van juntas porque arreglar sólo la primera empeoraba el banco: `x.insertBefore(nuevo,
x.firstChild)` caía bien por accidente (referencia `undefined` + `unshift`) y con un `insertBefore`
fiel y sin `firstChild` se iría al final.

**Lanzar con la referencia ajena** era el detalle que el ticket dejaba por decidir. Se ha decidido
como el navegador, y como el propio banco ya hacía en el caso gemelo (`_colocarAdyacente` con una
posición que no existe). En el censo en ejecución hubo cero llamadas así.

**Sin segundo argumento** se trata como `null`. El navegador hace eso con un `undefined` explícito;
con el argumento omitido los navegadores de hoy lanzan `TypeError`. Aquí no se lanza porque
`tests/scrum697-un-solo-render.test.mjs` llama así, y este ticket no cambia veredictos ajenos.
Ninguna vista de `public/` llama con un solo argumento.

## Límite nuevo, declarado en la cabecera del banco (el 5)

El banco no crea nodos de texto a partir del marcado (consecuencia del límite 4). `firstChild` y
`nextSibling` devuelven el hijo o el hermano que el banco TIENE: de `<div> <b>x</b></div>` el
navegador da el espacio y el banco da el `<b>`. Para colocar con `insertBefore` el orden entre
elementos sale igual. Para LEER ese nodo, no. Hoy ninguna vista lo lee: los dos nombres sólo
aparecen en `public/` como segundo argumento de `insertBefore` (censo estático del ticket).

## El censo (de la sesión anterior, sobre `main` `31ff91d9`, 6-oct-2026)

- Estático: 15 llamadas a `insertBefore` en 7 ficheros de `public/dashboard/js/`. Recontado hoy
  sobre `8f77f96d` con `rg 'insertBefore\('` en `public/`: las mismas 15.
- En ejecución: de 401 ficheros de test que cubren el banco, 22 llaman a alguna de las tres piezas
  y en 13 alguna llamada caía en un sitio distinto del navegador. Salida:
  `docs/master/evidencias/SCRUM-1486/censo-en-ejecucion.txt`.

## Aceptación 3 · el rojo de cada caso nuevo

`docs/master/evidencias/SCRUM-1486/mutar-1486.mjs`, salida en `salida-mutar-1486.txt` (cada
escritura lleva su `git diff --numstat` al lado):

- **Con el banco de antes entero** (el fichero de `origin/main`): caen los 9 casos de 9.
- **Con cada mutación declarada** en el propio test (`MUTACIONES_QUE_ME_TUMBAN`, 13): las 13 tumban
  su caso, y entre todas tumban los 9. Se leen con el lector del meta-guard: 13 legibles, 0
  incompletas.

Dos de los nueve casos (la referencia es el primer hijo, y la vista de la puerta de serie) daban
el MISMO orden con el banco de antes, por el accidente de arriba. Caen con él porque cada uno
comprueba antes que `firstChild` es de verdad el primer hijo. Sin esa línea habrían nacido verdes
contra el defecto.

## Aceptación 4 · ningún test que ya existía cambia de veredicto

La dirigida de `tests/_banco-vistas.mjs`, dos veces, comparada por conjuntos de (veredicto,
nombre). Salida completa: `docs/master/evidencias/SCRUM-1486/comparacion-antes-despues.txt`.

| | antes (banco de `main`) | después (banco arreglado) |
|---|---|---|
| población | 404 de 1260 ficheros · 3817 tests | 404 de 1260 ficheros · 3817 tests |
| pass · fail · saltados | 3799 · 13 · 5 | 3810 · 2 · 5 |
| sólo en una de las dos | 0 | 0 |
| con veredicto distinto | 11 | |

Las 11, una a una:

- **9** son los casos nuevos, que con el banco de antes caen (es su rojo).
- **`SCRUM-737`** (cifras sin fecha en comentarios) caía en la pasada de antes por dos cifras que
  yo había escrito en la cabecera del test nuevo. Reformuladas antes de la pasada de después.
- **`SCRUM-836`** (anclas de mutación vivas) caía en la pasada de antes porque las anclas que
  declara el test nuevo no existen en el banco de antes.

Esas dos ya existían, y las dos cambian por cómo se construyó la pasada de antes (la rama con el
banco viejo), no por dónde cae un nodo. Medidas aparte sobre `origin/main` `8f77f96d` sin la rama:
22 de 22 en verde. **Respecto a `main`, cero tests que ya existían cambian de veredicto.**

Los 2 que caen después: `SCRUM-1321` (ciego por entorno de esta máquina, ya declarado; en CI corre)
y `SCRUM-854` (la rama no traía todavía este registro cuando se midió).

**La pasada de antes no es `main` puro**: es la rama con el banco de `main`, para que lo único que
cambie entre las dos sea el banco. Por eso aparecen `SCRUM-737` y `SCRUM-836`. Y entre las dos
pasadas cambió una cosa más que el banco: los comentarios reformulados.

## Desviaciones declaradas

- Las dos pasadas corrieron a 2 ficheros a la vez, por tramos, con la memoria libre entre 641 y
  2.691 MB (el umbral del equipo para una suite completa es 2.200). No cambia qué se corre.
- Tras traer `main` (`317c0bab`, que no toca el banco ni `public/`) no se repitió la dirigida
  entera: se compiló y se corrió lo que cubre lo que esta rama añade después. El resto lo dice CI.

## Lo que este arreglo NO cubre

Que algún test COMPRUEBE dónde coloca cada vista sus nodos. Hoy no lo hace ninguno, salvo los tres
casos de vista de este fichero, que miran el banco y no la vista. Sería de quien lleve cada vista.

## Reproducir

```
node docs/master/evidencias/SCRUM-1486/mutar-1486.mjs <raíz del worktree> origin/main
node scripts/tests-que-cubren.mjs tests/_banco-vistas.mjs --lanzar --tramo 1/10 --tap=<fuera del árbol>
node docs/master/evidencias/SCRUM-1486/compara-tap.mjs <antes.tap> <después.tap>
```
