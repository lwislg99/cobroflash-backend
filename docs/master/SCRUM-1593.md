# SCRUM-1593 · El censo táctil abre las pestañas y deja de llamar «sin pintar» a lo no medido

**27-oct-2026 ~17:55Z (Date: de GitHub 17:25:57Z al coger) · medido sobre origin/main `f8ae969172dd142dc3390fae33cd91fc80fb0cee` · worktree `wt-s3-1593` · S3.**
Rama `scrum-1593-censo-tactil-ocultos`. Viene de SCRUM-1584 (J6) y de la decisión ② de SCRUM-962b (`docs/master/SCRUM-962.md:165`).

## El defecto (PASO 0, corrido)

`npm run censo:tactil-panel` sobre main: Configuración `medidos 21 · sinPintar 20` a 929 y a 390. `sinPintar` era
«no tiene caja», sin distinguir **oculto** (panel con `display:none`, `settingsView.js:144`) de **visible sin caja**.
Los dos `select` de Facturación caían ahí: «no pude mirar» y «no hay nada» salían iguales.

## Qué rama de la decisión ② y por qué: las DOS

- **①, abrir los estados ocultos como los abre el producto.** El censo pulsa en el banco cada `[role="tab"]` no
  seleccionado, con el oyente que le puso la vista (`click()` del banco corre los oyentes), serializa el estado y lo
  mide como una página más, con su sonda. Es genérico por contrato ARIA, no una lista a mano: hoy abre **13 de 19
  pestañas en 2 pantallas** (Configuración 8, Cobros 5). Las 6 que no se abren se dicen con su motivo (4 son la
  seleccionada al montar; 2 «pulsarla no cambia nada en el banco»: Plantillas de la lista de presupuestos e Historial
  de Plantillas).
- **②, lo que siga oculto sale como NO MEDIDO, con esa palabra.** Columnas nuevas `ocultos` y `sinCaja` en vez de
  `sinPintar`, y en EL NÚMERO (lo que copia el resumen del CI): «interactivos NO MEDIDOS por estar ocultos (ni
  abriendo pestañas se ven): **88, en 8 pantalla(s)**».
- **Por qué las dos:** ① mide de verdad, pero sólo sabe abrir pestañas; los pasos del editor de presupuestos (77 de
  los 88 están en `renderQuotesView` y `renderDocumentoSueltoView`), desplegables y bloques que se abren con otro
  gesto siguen sin abrirse. Sin ②, ese resto volvería a salir mezclado. **① queda PENDIENTE para todo lo que no es
  pestaña**: no está resuelto, está dicho.
- Identidad de elemento: un estado es el mismo DOM que el de montar y su `i` es el mismo nodo. Si al abrir la pestaña
  cambia el recuento de interactivos (Cobros: 6 frente a 7), ese estado se cuenta con identidad propia y se avisa.

## Lo que mide hoy — y una diferencia con el ticket

Los dos `select` (`#retencion-irpf-tipo`, `#actividad-tipo`) se miden en la pestaña Facturación: **caja 44 · toque
44,9, a 929 y a 390. Cumplen.** El ticket decía 38,9 (medido el 23-oct). No es el instrumento: **J3 los subió a 44 el
26-oct (SCRUM-1577b, `public/dashboard/css/styles.css:4925-4926`)**. Comprobado por mutación: quitando esa regla, el
censo los caza como cortos a **36,9** en la sección «CORTOS QUE SÓLO SE VEN ABRIENDO UNA PESTAÑA» (36,5–37 es lo que
midió J3 en su banco; 38,9 era producción con la fuente de antes de SCRUM-1603).

## Antes → después (mismo árbol, mismos datos)

| | antes | después |
|---|---|---|
| páginas medidas (× 2 anchuras) | 28 | 41 (28 + 13 pestañas) |
| elementos DISTINTOS < 44 px | 101 | **109** (+8: lo que sólo se ve abriendo Avisos, Marca, Equipo y Facturación) |
| mediciones cortas | 151 | 198 |
| `sinPintar` Configuración | 20 | — (pasa a `ocultos` 20 al montar; NO MEDIDOS al final: 2) |
| NO MEDIDOS por ocultos | (no existía) | 88 en 8 pantallas |
| tiempo en local | no lo cronometré | 80 s |

Nada BAJA. El +8 son cortos reales nuevos a la vista (p. ej. `Vista previa` 30,6 y tres `INPUT` de 17 px en Avisos,
`⬆ Subir logo` 30,6 en Marca): **hallazgo, no arreglo** — son pantalla de J3/S2, no de este carril.

## Controles (vistos en ROJO, árbol limpio tras cada uno: `git status --porcelain` = 0)

| mutación | resultado |
|---|---|
| quitar `#retencion-irpf-tipo, #actividad-tipo { min-height: 44px; }` | las 2 select salen cortas a 36,9 (929 y 390) |
| no pulsar las pestañas (`t.click()` comentado) | salida 2 · «🔴 CIEGO: el censo no abre ni las pestañas de Configuración» |
| `oculto()` siempre falso (todo a `sinCaja`) | salida 2 · 82 de 82 sondas «la sonda OCULTA no sale como oculta» |
| `tests/scrum1593-censo-tactil-ocultos.test.mjs` base | 5/5 · 4 mutantes de `noMedidosPorOcultos`, los 4 MUEREN |

Instrumento comiteado antes de mutar: `e8f448610cfb07d545947020059402c72711bff3` y `83acfa6d4f839cf5acd85c22072a866a3b168c05`.

## Ficheros

- `scripts/censo-objetivo-tactil-panel.mjs` (S3, `dos-equipos.md:176`) · `scripts/_censo-distintos.mjs` (S3, `:183`):
  `noMedidosPorOcultos`. NO se toca `_medidor-de-toque.mjs` (SCRUM-1584, J6) ni `ci.yml` (el paso del CI sigue
  copiando el bloque EL NÚMERO, que ahora lleva la línea de NO MEDIDOS).
- ⚠️ Coste: el censo pasa de ~29 s (CI, 29-sep) a 80 s en local por las 13 páginas más × 2 anchuras × 2 (con sonda).
  Es el job informativo, no el obligatorio.

A9: sin fallo propio que generalice en este ticket.
