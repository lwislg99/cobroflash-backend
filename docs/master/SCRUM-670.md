# SCRUM-670 · Tres regex leían el mismo índice y coincidían por casualidad

**Fecha:** 2-sep-2026 · **Carril:** higiene de guards · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `283143b4701f75835888e82c25f41ad34e916655` · 2026-09-02T15:40:00+02:00

## 1 · Las tres, con fichero y línea, y qué considera cada una «un script»

| dónde | patrón | qué exige |
| --- | --- | --- |
| `tests/dashboard-colision-declaraciones.test.mjs:40` | `/<script src="\.\/js\/([^"]+)"><\/script>/g` | `src` **lo primero**, ruta `./js/`, comillas dobles y `</script>` **pegado** |
| `tests/_banco-vistas.mjs:323` | `/<script src="\.\/([^"]+)"><\/script>/g` | lo mismo, sin exigir `js/` |
| `tests/scrum274-shell-alineado.test.mjs:115` | `/<script[^>]+src\s*=\s*"([^"]+)"/gi` | admite atributos antes del `src`; **no** mira el cierre; comillas dobles |

Y una cuarta que solo cuenta: `tests/scrum274-huella-estaticos.test.mjs:56` — `/<script[^>]+src\s*=/gi`.
Buscando por el árbol apareció **una quinta**: `tests/scrum301-albaranes-seccion.test.mjs:341`, con
comillas simples admitidas; y una sexta comprobación de presencia en
`tests/scrum214-semaforo-sin-llamadores.test.mjs:130`.

**Sobre el índice de hoy las cuatro dan 71.** No están de acuerdo: **el índice está escrito de una
sola manera**.

## 2 · La divergencia, con el caso real escrito

```
<script src="./js/pruebaDefer.js" defer></script>

  71  dashboard-colision   🔴 NO lo ve
  71  _banco-vistas        🔴 NO lo ve
  72  scrum274-shell       sí
  72  scrum274-huella      sí
```

Y lo que se rompe no es un número: **el guard de colisiones deja de parsear ese fichero** y sigue
diciendo «cero colisiones», mientras el del service worker sí lo exige en el precache.

### 🔴 Pero el caso peor no es `defer`: es el CERO UNÁNIME

```
<script src='./js/soloYo.js'></script>      →   0  ·  0  ·  0
```

Con `defer` las tres **discrepan**, y una discrepancia se acaba viendo. Con **comillas simples** las
tres coinciden **en cero**: tres extractores independientes de acuerdo en que ahí no hay ningún
script, con el script delante.

> **Un cero unánime es el resultado más convincente y más falso que puede dar este sistema.** Nadie
> duda de un consenso.

Es la causa de lo que SCRUM-559 trató como síntoma: allí un `defer` en un solo script dejaba 16/16
en verde con ese fichero fuera de toda vigilancia, y se subieron los umbrales a recuento exacto.
El recuento exacto no salva del cero unánime.

## 3 · Una sola fuente — y no una cuarta regex

`tests/_scripts-del-indice.mjs`. **Si tres expresiones regulares sobre el mismo fichero divergen, el
arreglo no es escribir la definitiva: es dejar de leer HTML con expresiones regulares.**

Es un **recorrido de caracteres** de la etiqueta `<script>`: lee el nombre, recorre los atributos,
respeta comillas dobles, simples o ninguna, y termina en el `>` sin comillas abiertas. De ahí salen
gratis cinco cosas que antes eran casos especiales:

- el `src` en cualquier posición entre los atributos;
- `defer`, `async`, `type` y cualquier atributo suelto;
- la etiqueta **partida en varias líneas**;
- comillas simples o sin comillas;
- no hace falta que `</script>` vaya pegado, ni que exista.

**Seis lectores, una fuente.** Los cuatro extractores, el de `scrum301` y la comprobación de
presencia de `scrum214` preguntan ya a la misma función. Y la lista de SCRUM-662 se contrasta contra
**ese** extractor: si no, el problema solo cambiaba de forma.

## 4 · El suelo de ceguera, en la fuente

`scriptsDelIndiceOFalla` **lanza** si la lista sale vacía, y el mensaje lo dice: *un cero no es «no
hay scripts», es «no supe leerlo»*. Va en la fuente y no en cada consumidor, para que ninguno tenga
que acordarse.

Y el contraste que lo hace útil: sobre el documento de **comillas simples** —donde las tres regex
dan cero— el suelo **no** se dispara, porque ahí sí hay un script y la fuente lo ve. Un suelo que
salta con datos buenos acaba desactivado.

## 5 · Un trinquete para la cuarta regex

Si mañana alguien vuelve a escribirse la suya sobre este índice, cae **nombrado**. Se mira el código
sin comentarios, línea a línea, y **no** cuenta el extractor de scripts EN LÍNEA (`(?![^>]*\bsrc=)`)
— ésa es otra población, la de los `<script>` sin `src`, y la pregunta es distinta. No es una
exención por fichero.

Mi primera versión del detector acusó a **cinco**, y tres eran falsos: miraba el fichero entero, así
que marcaba a quien hace un `replace` con una cadena literal (`scrum378`) o a quien escribe «<script
src» dentro de un mensaje de error (los dos de `scrum274`). Un detector que acusa a los sanos se
desactiva.

## 6 · El trinquete que BAJA

`SCRUM-553` (etiquetas con el `>` pegado): **23 → 22**. Bajan al llevar los lectores a la fuente
única — las regex que exigían `></script>` pegado eran justo las que perdían el `defer` y las
comillas simples. Se ajusta en el mismo commit que lo arregla.

## 7 · Lo que NO se ha tocado

El **orden** de los scripts en el índice (hay dependencias declaradas) · `prisma/schema.prisma` ·
`scripts/guards-visuales.mjs`.
