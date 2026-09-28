# SCRUM-1164 · Textos que afirman algo falso con el cobro apagado — parte del PANEL (S4)

**Medido contra:** `origin/main` = `cd78b8264d042dc01afe1ee714b002278f25e0a1` · 2026-09-28T14:45:27Z

Decisión del orquestador (descripción del ticket): en modo `receipt` estos textos se **OCULTAN**, no
se reescriben. Ocultar no es inventar copy, y ocultar no es borrar: la condición se escribe con el
modo, así que en `fiscal`/`demo` siguen saliendo.

**Fuera de este registro, a propósito:** la landing pública (#9) y el bot (#8) son STOP del
fundador; #2 (`invoicesView.js`) es de Javier; #1, #5 y #6 son del servidor (S1); el botón
«VeriFactu XML» (fila D) es SCRUM-1165.

## PASO 0 · recuento en `origin/main` antes de construir

Contra `29b492b0` (y sin cambios en estos ficheros hasta `cd78b826`), los 7 del panel seguían
VIVOS: A (`jobDetailView.js:187-188`, `:218-219`), B (`:415`), C (`:1272`), F (`:802` y el chip de
`:753`), #3 (`homeView.js:939`), #4 (`homeView.js:406`, `:425-426`), #7 (`plansView.js:159`).
Ninguno lo había tapado 1160, 1169 ni 1165.

**En pantalla: NO VERIFICABLE, y no por credenciales.** La cuenta demo (`id=1`) está en modo
`demo`, no `receipt`: ahí estos textos son verdad y deben salir. Medir 1164 en `yaqu.app` exige un
merchant en `receipt` al que se pueda entrar, y hoy no hay ninguno. (Además, la lectura de
producción la denegó el clasificador de permisos; avisado al orquestador en el momento.)

## Incremento 1 · la ficha del Trabajo (`jobDetailView.js`)

Un solo criterio, `enModoJustificante()` = `window.appModoEmision === 'receipt'` (el veredicto del
servidor, `app.js`, SCRUM-298; el mismo que ya usan Planes, el tutorial, Ajustes y el onboarding).
Compara con `=== 'receipt'` y NO con `facturaFiscalDisponible()`: aquello decide si se OFRECE una
acción fiscal y falla cerrado (SCRUM-905); esto decide si se CALLA un texto que es verdad en los
otros dos modos. Con el modo desconocido (`null`) no se calla nada — hay test que lo fija.

| Fila | Qué se calla en `receipt` | Qué se queda |
| --- | --- | --- |
| A | huecos `sin-facturar`, `sin-facturar-nada`, `sin-cobrar` y sus botones | los demás huecos; si sólo había ésos, la sección entera no se monta |
| B | nota «Tú sigues viendo los precios y puedes facturarlo.» | la casilla de ocultar precios |
| C | nota «Nos ayuda a preparar tus facturas correctamente…» | el selector de tipo de trabajo |
| F | foco «Te falta por cobrar X €» / «Cobrado del todo» y el chip de cobro | los lados «Aceptado» y «Cobrado» (datos medidos, no derivados) |

**Comprobado antes de ocultar, contra el código:** en `receipt` no hay NINGÚN documento posible —
`modoDocumentoSuelto` devuelve `'no'` (`facturaSuelta.ts:88`, SCRUM-1027) y facturar desde el
albarán corta con 409 (SCRUM-1160)—, así que «Facturar lo entregado» empuja a una acción que no
existe y el cobrado por YaQu no se mueve nunca de 0.

**Test:** `tests/scrum1164-ocultar-en-receipt-ficha-trabajo.test.mjs` (ficha REAL con
`cargarDashboard`). Cada afirmación se mide en los DOS sentidos: sale en `fiscal` y `demo` (control),
y en `receipt` no. **Rojo medido:** contra el `jobDetailView.js` de `origin/main`, 6 de 7 fallan (el
que pasa es el del modo desconocido, que no cambia de comportamiento); con el cambio, 7/7.

**Dos guards textuales se pusieron rojos por la FORMA de la primera versión** (regla 41: se
reestructuró el código, no se tocó el guard):
- SCRUM-320 exige que la sección se monte bajo `if (typeof seccionCobroVisible === 'function' &&
  seccionCobroVisible(job)) {`. La condición nueva va ANIDADA dentro, no sumada.
- SCRUM-363 exige `job.estadoCobro ? \`<span class="status-pill ${cobroCls}">`. El modo va como
  condición EXTERIOR y la de 363 queda literal.

Suite dirigida (83 ficheros que citan `jobDetailView`/`jobCobroHuecos`/SCRUM-1164): 749 tests,
748 pass, 1 skip, 0 fail.
