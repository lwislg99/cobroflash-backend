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
