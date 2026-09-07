# SCRUM-714 · Cada número con su unidad — tres instrumentos, cuatro cifras, ninguna mal

**Medido contra:** `origin/main` = `8303db7524d3e0e90659c49f840d47adefaf6d5f` · 2026-09-04T21:20:41+01:00
**Rama:** `scrum-714-cada-numero-con-su-unidad`

> El ancla se remidió tras mezclar `main` dentro de la rama (AA2): estaba en `1be34bdd…` y se movió
> mientras se trabajaba.

---

## 1 · PASO 0 (regla 39)

### a) ENTRADA — quién llega hasta aquí, y no es el profesional

No hay pantalla. **La entrada es la siguiente sesión que lee un número** en un mensaje de guard,
en la salida de un censo o en el comentario de un test, y lo compara con otro. Los sitios exactos:
`scripts/censo-marcadores.mjs` (su `resumen`), el objeto `CENSO` de
[scrum402](../../tests/scrum402-marcador-no-se-pinta.test.mjs), la cabecera de
[scrum667:24](../../tests/scrum667-marcador-visible.test.mjs#L24) y el bloque de
[scrum709:210-222](../../tests/scrum709-microcopy-por-fichero.test.mjs#L210-L222).

### b) MECANISMO — existe a medias, y hay que darle superficie

🔴 **La doctrina YA ESTÁ ESCRITA**, y en el sitio correcto:
[`scripts/censo-marcadores.mjs:6-10`](../../scripts/censo-marcadores.mjs#L6) explica que SCRUM-402
cuenta **literales** y que él contesta otra pregunta —«¿cuántos rótulos VE un profesional?»— y que
**no es el mismo número**. Su `resumen` ya sale con las claves nombradas (`marcasEscritas`,
`superficiesPintadas`). O sea: el mecanismo existe **en uno de los cuatro**, y lo que falta es que
los demás digan lo suyo. Este ticket **da superficie**, no rehace.

### c) Las cifras, medidas TODAS A LA VEZ — **y en DOS momentos, porque se movieron**

| cifra | qué es | de dónde sale | 19:5x | **21:20** |
|---|---|---|---|---|
| ficheros leídos | el suelo, no el hallazgo | `censo-marcadores.mjs` | 357 | **358** |
| marcas escritas | literales o constantes que llevan la marca | ídem | 22 | **24** |
| usos de constantes | veces que se invoca una de ellas | ídem | 162 | **162** |
| superficies pintadas | sitios que puede VER un profesional | ídem | 168 | **169** |
| ficheros del panel con marca | — | el `CENSO` de scrum402 | 12 | **13** |
| instrumentos que TOCAN la marca | — | derivado (este ticket) | 53 | **54** |
| marcas de «aprobado» | comentarios que afirman una firma | scrum709 | 56 | 56 |
| citas a `docs/microcopy/` | comentarios que citan un registro | scrum709 | 13 | 13 |

**Ninguna está mal.** Puestas desnudas y una al lado de otra parecen una contradicción; con su
unidad, no. Ésa es toda la diferencia.

> 🔴 **Y LA SEGUNDA COLUMNA ES EL TICKET DEMOSTRÁNDOSE SOLO.** Escribí las siete cifras a las
> 19:5x y **a las 21:20 seis de ellas ya eran otras** — el panel pasó de 12 a 14 marcas mientras se
> escribía esto, porque hay cinco sesiones más trabajando. O sea que **una unidad no basta: un
> número de esta casa necesita ADEMÁS su árbol y su hora**, o caduca en dos horas y la siguiente
> sesión lo lee como una contradicción. Es exactamente lo que le pasó a
> [`scrum667:24`](../../tests/scrum667-marcador-visible.test.mjs#L24), que declara «25 marcas
> (panel 16 · público 1 · servidor 8)» — con su unidad puesta y ya caducado.

### d) `ls-remote` completo (paso 2 de `cerebro-yaqu`)

Sin rama `scrum-714-*`: **carril libre**. (`censo-marcadores-microcopy` existe y es de otro
trabajo; no toca estos ficheros.)

---

## 2 · Qué se construye

**`tests/_unidades-de-microcopy.mjs`** — el vocabulario, en un solo sitio:

- **`UNIDADES`**: cada una con singular, plural y **la PREGUNTA que contesta**, que es lo que de
  verdad la distingue. Dos unidades con la misma pregunta serían el defecto un nivel más arriba, y
  hay un test que lo impide.
- **`frase(n, unidad)`** → `«22 marcas escritas»`. Y acierta el singular: **`«1 marca escrita»`**,
  porque el uno es justo la cifra donde dos unidades se parecen más y donde un plural mal puesto
  hace que quien lee deje de fiarse del resto del mensaje.
- **`numeroSinUnidad(texto)`** — el detector, deliberadamente **conservador**: sólo mira la misma
  frase. Uno agresivo sobre la prosa de esta casa daría falsos positivos en cada comentario largo,
  y un guard que grita por nada se apaga en una semana — que es el mismo final que tiene un número
  desnudo.

⛔ **Ningún instrumento cambia lo que cuenta.** Armonizar destruiría la medición que cada uno daba.

---

## 3 · 🔴 El ticket me mordió a mí mientras lo cerraba, y es su mejor prueba

Mi primer censo de «instrumentos que cuentan microcopy» dio **53** (hoy **54**). El encargo hablaba
de **tres**.

Ninguno estaba mal: **son dos poblaciones y yo las estaba llamando igual.** 53 ficheros de `tests/`
y `scripts/` **tocan** el literal de la marca; los que **publican una cifra** que otra sesión
podría comparar son **cuatro**. Así que se separaron en dos unidades declaradas
(`INSTRUMENTOS_QUE_TOCAN` / `INSTRUMENTOS_QUE_CUENTAN`) y las dos salen con su nombre.

Los que tocan se **derivan** (una lista a mano envejece el día que nace el siguiente). Los que
publican una cifra son **lista declarada, y se dice por qué**: «publicar una cifra» no tiene forma
sintáctica —es un `resumen`, un objeto `CENSO`, un número en una cabecera— y derivarla sería
inventar un criterio. Lo que sí se hace es **comprobar cada entrada**: que exista y que de verdad
publique su número. Una lista a mano cuyos miembros no se verifican es lo que SCRUM-311 dejó
escrito que no vale.

---

## 4 · La víctima, cerrada

`exportView.js:328` declaraba el estado vacío del libro como propuesto y **sin aprobar**. Era falso
**por partida doble**:

1. El fundador lo firmó el **17-ago-2026** y consta **APLICADO** en
   `docs/MICROCOPY_APROBADA_SIN_APLICAR.md` §Addendum.
2. Y **citaba una frase distinta** de la que se pinta —con «emitidas» y «ese periodo»— que,
   medido, **no existe en ningún sitio del árbol**. Un comentario que cita un texto inventado es
   peor que uno que no cita nada: parece una fuente.

La víctima no es el profesional —el texto en pantalla siempre fue el bueno— sino **la siguiente
sesión que lo lea y «corrija» un texto ya firmado**.

📌 **Y el guard se cazó a sí mismo al escribirlo**: la primera versión del comentario nuevo
*citaba* la frase prohibida para explicar que era falsa, y el guard se puso rojo. Se arregla
**describiendo en vez de citando** — nunca bajando la exigencia.

---

## 5 · El rojo, probado por el mecanismo

**Nueve sondas, nueve rojos**, cada uno por su propio caso. Árbol restaurado y verde al cerrar.

| se rompe | cae |
|---|---|
| 🔴 vuelve la víctima (declarar sin aprobar un texto firmado) | «NO dice sin aprobar» |
| 🔴 vuelve la cita a un texto que no existe | ídem |
| el derivador de instrumentos se queda ciego | **SUELO** |
| un instrumento deja de publicar su cifra | «PUBLICAN una cifra» |
| 🔴 `frase` devuelve el número **desnudo** | «pega la unidad al número» |
| el plural se come el caso de UNO | «acierta el SINGULAR» |
| una unidad inventada deja de fallar | «unidad inventada» |
| dos unidades contestan la misma pregunta | «QUÉ PREGUNTA contesta» |
| 🔴 el detector deja de ver un número desnudo | «VE un número desnudo» |

📌 **Una décima sonda salió verde y el fallo era de la sonda**: quité `marcasEscritas` de
`censo-marcadores.mjs` y la comprobación es un OR, así que `superficiesPintadas` seguía
cubriéndola. Es correcto —el instrumento **sigue publicando una cifra**— así que la sonda buena
quita las dos, y con ésa cae nombrando el fichero. La primera hipótesis ante un rojo que no
aparece es «caso mal elegido», no «guard de sobra».

**Control negativo:** una cifra que **ya lleva** su unidad (`«14 marcas escritas»`) **no** se
señala, y una que no habla de microcopy (`«el PDF tiene 14 páginas»`) tampoco.

**Suelo:** si el censo de instrumentos devuelve **cero**, falla — y el mensaje dice que hay
decenas, para que un cero no se lea como «no hay» sino como «el derivador está roto».

---

## 6 · Lo que NO se toca

**`docs/MICROCOPY_APROBADA_SIN_APLICAR.md` no se ha modificado.** Ha chocado siete veces en dos
días (SCRUM-709); aquí sólo se LEE, para acreditar que el texto de `exportView` está aprobado.

**`tests/scrum667-marcador-visible.test.mjs:24` no se corrige aquí** — va como hallazgo. Su
cabecera declara «25 marcas hoy (panel 16 · público 1 · servidor 8)» y a las 21:20 son **24 (panel
14 · público 1 · servidor 9)**. Es un número **con su unidad** pero **caducado**, o sea otro
defecto de la misma familia y no éste. Y no se mete en el guard a propósito: **habría nacido en
rojo**, y un guard que nace rojo lo apaga alguien en una hora. Lo que este ticket sí deja escrito
es por qué caduca — porque le falta el árbol y la hora, no la unidad.
