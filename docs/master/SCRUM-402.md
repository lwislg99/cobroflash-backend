# SCRUM-402 · «Confirmar Bizum recibido» deja de pintarse con Bizum apagado

**Fecha de esta constancia:** 9-ago-2026 · **Escrita por:** sesión 3 · **Código escrito aquí:** ninguno
**Medido contra:** `origin/main` = `8037a7a30049a442eb857733832c9eca0bf99ec2` · 2026-08-09T19:51:07+02:00

> ⚠️ **ENTRADA DE CONSTANCIA, NO DE TRABAJO.** El mecanismo lo construyó otra persona y esta
> entrada solo lo DEJA ESCRITO, citando su commit. No se reconstruye ni se interpreta: lo que
> no consta en el commit o en el código, no se afirma.

**Commit:** `611af2184c846eb23c13b0c927dfd3df1ce8593c` · 2026-08-07 20:23 +0100 · Javier Pereira Fernández
*«fix(SCRUM-402): «Confirmar Bizum recibido» deja de pintarse con Bizum apagado»*

## El defecto

El botón era **acción PRIMARIA** de las facturas `pending` y se pintaba con `if (invoice.chargeId)`
a secas: el navegador no conocía `BIZUM_MANUAL_ENABLED`, que está en `false`. Al **segundo** toque
—después de enseñarle al profesional el importe y el nombre de su cliente— llegaba un 409
`bizum_disabled`. En palabras del propio commit: **«el backend rechazaba bien; el problema es que
se pintaba. Si se pinta, es porque puede funcionar.»**

## El mecanismo, en `main`

* `public/dashboard/js/invoiceDetailView.js:426` — la condición pasa a
  `if (invoice.chargeId && window.appBizumManualEnabled)`.
* `src/app.ts:374` publica `bizumManualEnabled` · `public/dashboard/js/app.js:18` lo recibe.
  El veredicto lo da el servidor; el navegador **no reimplementa la bandera**.
* `src/core/flags.ts:19` — `BIZUM_MANUAL_ENABLED: false` (OFF hasta C1-4).

## Guard

`tests/scrum402-marcador-no-se-pinta.test.mjs` — 6 tests: suelo del escáner, R1 (con la bandera
apagada NO se pinta), **R2 control positivo** (encendida vuelve a ser primaria), R3 (la ranura
nunca queda vacía), R4 (trinquete de marcadores pintables) y R5 (un marcador en un comentario no
cuenta).

## ⚠️ Lo que NO se arregló, y está DECLARADO

El rótulo inicial sigue siendo `[PENDIENTE microcopy oficial]` (`invoiceDetailView.js:431`). **No
es un resto olvidado:** el guard lo trata como **trinquete** y lo razona por escrito — la propiedad
«ningún marcador se pinta» *«está violada en 36 sitios hoy»*, y un guard que la exigiera *«nacería
ROJO y lo apagaría alguien en una hora»*. Así que vigila que el número **no suba**.

**En producción no se ve**, porque la bandera está en `false`. El día que se encienda, ese rótulo
necesita microcopy aprobada ANTES (regla 30).

---

# SCRUM-402 · addendum — el censo PARA APROBAR, y en qué se separa del trinquete

**Fecha:** 17-ago-2026 · **Carril:** B · **Gate:** ninguno — esta tanda MIDE, no construye guard
**Medido contra:** `origin/main` = `a241b6e48c6553e453375bf705ca76ac3045ac0d` · 2026-08-17T13:05:00+02:00
**Entregable:** `docs/CENSO_MICROCOPY_PENDIENTE.md` · **Instrumento:** `scripts/censo-marcadores.mjs`

> El fundador abrió el producto y vio marcadores por todas partes. Hacía falta la lista COMPLETA,
> legible y agrupada por pantalla, para poder aprobar textos. **No se ha escrito ni un texto**: la
> regla 30 es suya.

## §1 · El trinquete NO estaba mal, y eso hay que decirlo primero

`tests/scrum402-marcador-no-se-pinta.test.mjs` declara **38 marcas en 17 ficheros** del panel. El
barrido nuevo ve **exactamente 38 ahí**. Su número es correcto para lo que mide.

La diferencia con las **109 superficies** del censo son dos cosas, y ninguna es un defecto suyo:

1. **Mide marcas ESCRITAS, no superficies PINTADAS.** Ya se sospechaba desde SCRUM-293 (③b), donde
   quedó anotado que contaba 1 donde había 3 rótulos. Ahora está cuantificado en el caso extremo:
   el Libro de emitidas tiene **1 marca escrita y 23 rótulos en pantalla**.
2. **Su alcance es `public/dashboard/js`.** Hay **9 marcas en `src/`** —mensajes de rechazo de API,
   avisos fiscales, el LÉEME del ZIP de portabilidad— que **no las vigila nadie**.

⚠️ Lo segundo es lo que conviene no perder: no es que el número sea corto, es que hay una población
entera fuera de la vigilancia.

## §2 · 🔴 El nivel que no vi al primer intento, y lo destapó el fundador

Mi primer barrido contaba la marca y sus referencias directas: **81 superficies**. Con eso el Libro
de emitidas daba **1**, y el fundador acababa de decir que ahí ve el título, el subtítulo **y todas
las cabeceras**.

La causa está en `libroRegistroView.js:43`:

```js
function rotulo(t) { return MARCADOR + ' ' + t; }
```

La constante no la pinta nadie: **la envuelve una fábrica**, y quien pinta son sus llamadas. Hay que
seguir la marca **dos saltos**, no uno, y por punto fijo — porque una fábrica puede envolver a otra.

> **Canon:** un contraste humano con el producto delante vale más que el número del instrumento. Yo
> tenía 81 y el número era coherente consigo mismo; lo que lo rompió fue «pero yo veo la tabla
> entera marcada».

## §3 · Y una clasificación mía que estaba mal

Di por hecho que un literal que es **solo** la marca era siempre una constante que no pinta. Falso:

* `const MARCADOR = '[PENDIENTE …]'` → no pinta por sí misma;
* `boton.textContent = '[PENDIENTE …]'` → **pinta, y pinta A CIEGAS.**

Son **23 controles que no dicen absolutamente nada** de lo que hacen — ocho de ellos los botones de
acción del detalle de factura, y el modal de «Nueva factura» entero. Esos son los urgentes: en el
resto la marca va DELANTE de un texto legible, así que el rótulo se puede leer y juzgar.

## §4 · Lo fiscal va aparte, y no es cosmética

De las 109, **38 son terreno fiscal o legal** y están en su propia parte del documento: el Libro de
emitidas (23), el semáforo —que ya se marca `[PENDIENTE ASESOR]`, no «microcopy oficial»—, el
resumen del 303, los libros para la AEAT, y los seis rechazos 409 de facturar un albarán.

**No son microcopy de producto: afirman un hecho fiscal**, y varios los dictamina el asesor. Y un
hallazgo de camino: los **seis** motivos distintos por los que se rechaza facturar un albarán
comparten **un solo mensaje**, así que hoy el profesional no puede saber cuál le ha tocado.

## §5 · El suelo, probado en rojo

`scripts/censo-marcadores.mjs` sale por **error** si el barrido devuelve cero marcadores o lee menos
de 100 ficheros. Probado cambiándole la marca por una que no existe:

```
🔴 CIEGO: CERO marcadores. Imposible — están a la vista en el producto.
   Arregla el barrido antes de creerte el cero.   (exit 1)
```

Sin eso, «está todo aprobado» y «el barrido se rompió» darían la misma salida — que es exactamente
la avería que este proyecto lleva semanas persiguiendo.

## §6 · Lo que NO se ha hecho, a propósito

* **Ni un texto propuesto.** Regla 30.
* **El instrumento NO se ha metido en `npm test`.** El trinquete de SCRUM-402 ya vigila que el número
  no suba y ése es su trabajo; esto es el instrumento de LECTURA para aprobar, y se corre a mano
  cuando haga falta. Meterlo en la suite sería un segundo guard sobre lo mismo sin que nadie lo
  haya pedido.
* **No se ha tocado el censo de SCRUM-402** ni su tope. Su número sigue siendo correcto.
