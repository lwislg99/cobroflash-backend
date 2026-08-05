# SCRUM-376 · `landing-demo.js` se retira: la documentación lo daba por publicado y no lo cargaba nadie

**Fecha:** 5-ago-2026 · **Carril:** B (limpieza medida) · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `0f7dfd1c1774dd0f9a968c10476d4f066a22b89c` · 2026-08-06T00:03:52+01:00

**Tanda:** 1825 tests, 1758 pass, 0 fail, 67 skipped

## El hecho, medido

`public/index.html` carga **un solo script**, `js/atribucion.js`, y **no menciona `idemo` ni una
vez** — el prefijo de todas las clases y anclas de esa demo. **Nadie cargaba
`public/js/landing-demo.js`** (201 líneas).

Y sin embargo:

* `docs/SPRINT_DEMO_READY_EXT.md:36` decía **«Demo publicada: `public/js/landing-demo.js`»**;
* un test lo citaba como si estuviera en pantalla y **pasaba en verde**.

El máster ya lo tenía bien (`YAQU_MASTER.md:383`: *«el viejo `js/landing-demo.js` queda sin
usar»*), así que la afirmación falsa vivía solo en el documento de sprint.

## La decisión (asesor, 5-ago-2026): se retira

* La demo **no está publicada** y no la echa nadie de menos.
* **Qué lleva la landing lo decide el bloque F**, que está entero por hacer. Encenderla habría sido
  tomar una decisión de producto **por la puerta de atrás**.
* Y si algún día se quiere, **está en el historial de git**: el bloque F la resucita *a propósito*,
  que es distinto de heredarla por inercia.

## Lo que se hizo, y una cosa que NO se hizo

1. **Retirado** `public/js/landing-demo.js`.
2. **Corregida la documentación sin dejar un hueco silencioso**: el párrafo de
   `SPRINT_DEMO_READY_EXT.md` **no se borra** — se marca como retirada, con fecha, motivo y el número
   de este ticket. Un hueco silencioso es exactamente como nació este problema.
3. **Corregidos los dos comentarios que citaban el fichero** (`atribucion.js:136` y el bloque del
   test): un comentario que nombra un fichero inexistente es la siguiente premisa falsa esperando a
   que alguien la lea.

### 🔴 El test NO se ha borrado, y conviene leer por qué

El ticket pedía retirar «el test que lo asume». **Medido: ese test no lo asume.**
`scrum336-atribucion-sin-almacenamiento.test.mjs` simula **un enlace inyectado después de la pasada
inicial** —venga de donde venga— y comprueba que el manejador de respaldo en fase de captura le pone
la atribución. Lo único que citaba a `landing-demo.js` era su **comentario justificativo**.

Borrarlo habría quitado un guard vivo que protege un fallo **mudo y con factura**: los otros ocho
enlaces sí propagan, el guard seguiría verde, y el referidor que trajo a ese usuario no cobra su mes.
Se ha reescrito el comentario y el test se queda. **Si aun así se quiere fuera, es una línea** — pero
que sea una decisión, no un efecto colateral.

## ⚠️ Un texto aprobado para una pantalla que no existía

`landing-demo.js:106` llevaba **«Así de fácil. Pruébalo con tus datos →»**, copy **aprobada dentro de
SCRUM-368**. Se va con el fichero.

Queda escrito porque el proceso no lo detectó: **se aprobó un texto para una pantalla que no estaba
publicada, y nada en el camino lo dijo**. La aprobación de microcopy hoy comprueba que el texto es el
correcto; no comprueba que la pantalla que lo enseña llegue a existir.

## Verificado

* **El guard de SCRUM-378 sigue verde después de retirar el fichero** — comprobado explícitamente,
  porque era la parte que podía morder: si el análisis de la landing se rompiera al desaparecer un
  fichero, el conjunto derivado tendría el mismo encogimiento que ese ticket corrigió. No se rompe:
  `index.html` no lo cargaba, así que ni entra en su cuenta.
* Suite completa en verde contra el `main` resultante.

## El rebase, y qué chocó exactamente

**SCRUM-368 entró en `main` mientras esta rama esperaba**, y toca el mismo fichero: le aplicó la
copy acortada «Pruébalo con tus datos →» en `:106`. Esta rama lo BORRA → conflicto modificar/borrar.

**Resuelto retirando el fichero, sin matices.** Que el cambio de 368 estorbe al retirarlo es la
consecuencia lógica del hallazgo, no una pérdida: era copy aprobada para una pantalla que nadie
carga. Sigue escrito arriba que **la copy aprobada se va con el fichero**.

**El conflicto fue SOLO ese fichero** — medido, no supuesto: un único `U` en `git status --porcelain`
(`UD public/js/landing-demo.js`); los otros cuatro ficheros del commit aplicaron limpios. La interfaz
web enseñaba el primer choque y en este caso era también el único.

Y se barrió el árbol ENTERO por nombre —no solo donde ya se había mirado—: **no queda ninguna
referencia viva**. Las que quedan son de REGISTRO (entradas de 368, 376 y 378 contando el hallazgo)
y esas se conservan a propósito. Ningún test lo asume: el único que lo nombra es el de SCRUM-336, y
solo en el comentario que dice que se retiró.

⚠️ Una frase de `SCRUM-368.md` sí caducó con esto: decía que la copy «se deja como está», y el
fichero ya no existe. Se ha anotado allí con fecha y ticket **sin borrar la medición**, que sigue
siendo cierta de cuando se hizo.

## Lo que NO cubre

* **No se toca `YAQU_MASTER.md:383`**: su frase («queda sin usar») sigue siendo cierta y tocar el
  máster por esto sería mover el documento más delicado del repo sin necesidad.
* **No se decide qué lleva la landing.** Eso es el bloque F.
* **No se revisa si hay más copy aprobada sobre pantallas no publicadas.** Este ticket encontró una;
  saber si hay más es otra medición.

## Ficheros

* `public/js/landing-demo.js` — **retirado**.
* `docs/SPRINT_DEMO_READY_EXT.md` — la afirmación, marcada como retirada con su porqué.
* `public/js/atribucion.js` · `tests/scrum336-atribucion-sin-almacenamiento.test.mjs` — comentarios
  que ya no citan un fichero inexistente.
