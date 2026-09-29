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

## Incremento 2 · Inicio y Planes (`homeView.js`, `plansView.js`)

Mismo criterio (`appModoEmision === 'receipt'`, el que ya usa `plansView.js` para sus dos filas de
SCRUM-1029). Rama apilada sobre la del incremento 1 para no chocar en este registro.

| # | Qué se calla en `receipt` | Por qué |
| --- | --- | --- |
| 3 | nota «💡 "100% al aceptar" genera la factura cuando el cliente firma.» (presupuesto rápido) | no se genera ninguna factura |
| 4 | PASO «Cobra tu primer trabajo» | no se puede cumplir nunca: con él pendiente el checklist no se acababa jamás |
| 4 | nota «Te avisamos cuando acepten o paguen» (el paso de WhatsApp se queda) | nadie paga por YaQu |
| 4+ | PASO «Configura cómo cobras · IBAN para transferencia o Bizum» | regla 24: sin ON no hay transferencia/Bizum por YaQu. **El campo del IBAN en Ajustes no se toca** (orquestador, 28-sep) |
| 4+ | nota «Se lo pedimos al cliente tras pagar» (el paso de reseñas se QUEDA) | «tras pagar» no llega; pero el enlace también sale en el perfil público (`publicProfile.service.ts:73`), así que el paso sigue sirviendo |
| 7 | «+ 0,9 % solo cuando cobras con tarjeta · Bizum y transferencia, gratis» | describe cobros que no ocurren |

Las dos filas «4+» no estaban en el censo de S0: salieron al medir el mismo checklist y el
orquestador las decidió el 28-sep. **Discrepancia declarada:** él pidió quitar también el PASO de
reseñas; medido que el enlace se usa en el perfil público, se calla sólo la nota. En `receipt` el
checklist queda con 7 de 9 pasos, no casi vacío.

**Forma, por dos guards:**
- SCRUM-315 lee `const steps = [ … ];` con una expresión regular y lo EVALÚA sin `window`. Por eso
  el array se queda literal, marca con `soloSiCobra`/`notaSoloSiCobra`, y el filtro va fuera
  (`pasos`). El contador «x/y» cuenta `pasos`, así que en `receipt` dice 0/7 y no 0/9.
- SCRUM-601 (censo de copy vs flag): la nota del #3 vivía dentro de la plantilla grande del modal y
  el censo NO la veía. Como constante, la ve y la clasifica «flag» (16 → 17) y, al llegar al
  `innerHTML` por interpolación, «no legible» (33 → 34). Re-anclado con la medición escrita en el
  propio test (mismo precedente que SCRUM-887/1155); `PENDIENTES_DE_FIRMA` no se toca.

**Test:** `tests/scrum1164-ocultar-en-receipt-inicio-planes.test.mjs`, en los dos sentidos. **Rojo
medido:** con `homeView.js`/`plansView.js` de `origin/main`, 7 de 7 fallan; con el cambio, 7/7.
Suite dirigida (35 ficheros de `homeView`/`plansView`/checklist/601): 324/324. Ratchets de estilo,
censo y microcopy (51 ficheros): 492 pass, 1 fallo de fichero en `scrum910d` — uno de los tres que
fallan bajo carga de la máquina, AJENO (no toca estos ficheros).

**En pantalla: NO VERIFICABLE** por el mismo motivo que el incremento 1.
