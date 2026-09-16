# SCRUM-345 · El rótulo que bajaba otra cosa, y las tres descargas sin botón

**Fecha:** 10-ago-2026 · **Carril:** producto (exports) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `973f69ea220b539fe2abcbf4a99779459f8ceb57` · 2026-08-10T12:45:30+02:00

## PASO 0 · el ticket era otro, y más viejo

El título hablaba de «dos descargas que nadie puede pedir y un rótulo que enlaza al fichero
equivocado». Medido:

* **Las descargas sin botón eran CUATRO**, no dos… y una de ellas, `datos.zip/info`, **no lo era**:
  `exportView.js:169` la llama. **Falso positivo de mi propio censo** — la regex no capturaba el
  segundo segmento de la ruta. El defecto era del instrumento, no de la ruta, y por eso el guard de
  hoy **deriva las rutas del router** en vez de adivinarlas.
* **El rótulo que miente ya estaba localizado**, y llevaba días esperando decisión **en DOS entradas
  de máster**: `docs/master/SCRUM-343.md:55-58` y `docs/master/SCRUM-321.md:121`.

## 🔴 El defecto caro: un enlace que NO estaba roto

`plansView.js` (tarjeta de prueba caducada) ofrecía **«cobros»** apuntando a
`/admin/exports/invoices.csv` — el CSV que el propio auditor llama `facturas.csv`.

**No daba 404.** Bajaba un fichero **real**, se abría, y eran **facturas**. Un enlace roto se
descubre solo; **uno que apunta a otro fichero real no se descubre nunca**, y el profesional se lo
lleva a su gestoría creyendo que es lo que pidió.

### La decisión: se REAPUNTA el enlace, no se renombra el rótulo

Decisión del fundador (10-ago-2026), y su motivo: **el botón dice «cobros», existe una exportación
de cobros de verdad, y quien lo pulsa quiere cobros.** El rótulo expresa bien la intención; lo que
estaba mal era el destino. Renombrarlo a «facturas» dejaría esa pantalla **sin acceso a cobros** —
una pérdida de función disfrazada de arreglo de copy — y además exigiría microcopy nueva.

**¿Necesita esa pantalla también un enlace a facturas?** Medido: la tarjeta ofrece tres atajos
(presupuestos · cobros · gastos) para el usuario con la prueba caducada, y **Informes ya tiene los
cuatro exports completos** (facturas, gastos, presupuestos, clientes). Añadir facturas aquí es
**decisión de producto con su microcopy**, y no se cuela en este ticket.

## El censo rótulo↔destino, que vale por sí solo

Hoy **nada** vigilaba que el texto de un botón correspondiera a lo que baja — y este caso lo
demuestra con dos entradas de máster de antigüedad. El censo cruza el **texto visible** de cada
enlace de descarga con el **fichero que de verdad baja**, con el vocabulario del dominio a la
vista (cobros · facturas · presupuestos · gastos · clientes). Un rótulo que no nombra ningún tipo
conocido **no se juzga**: el censo no inventa correspondencias.

| control | resultado |
|---|---|
| **SUELO**: si no lee ningún par rótulo/destino, **falla** | ✅ (rojo probado: «solo ha leído 0 pares») |
| **SUELO**: las rutas se derivan del router, y `datos.zip/info` tiene que verse | ✅ (el fallo de hoy, congelado) |
| **rojo por el mecanismo**: «cobros» → `invoices.csv` | ✅ *«plansView.js: «cobros» → /admin/exports/invoices.csv (dice cobros, baja otra cosa)»* |
| **control positivo**: los demás rótulos siguen casando | ✅ |

## Las tres descargas sin botón: superficie de soporte, documentada

Aplicada la regla del fundador —buscar referencias en **todo el repositorio**, no solo en
`public/`—: las tres están referenciadas, así que **ninguna se retira**.

| ruta | dónde está referenciada | qué es |
|---|---|---|
| `/admin/exports/charges.csv` | `SCRUM-321.md` (×3), `SCRUM-343.md` | cobros en CSV. **Se usa a mano**; ahora además es el destino del enlace de «cobros» |
| `/admin/exports/jobs.csv` | los mismos docs + `src/core/http/adminOnlyRoutes.ts:82` | trabajos en CSV, para soporte |
| `/admin/exports/fees.csv` | `DEMO_READY_CHECKLIST_FUNDADOR.md`, `AUDITLOG_FISCAL_CONTRATO.md`, `SCRUM-321.md`, `MIGRATIONS_PENDING.md` | **contabilidad de PLATAFORMA**, y por eso **exige owner verificado**: no es dato de un merchant y no debe tener botón en el panel de un profesional |

**Por qué no tienen botón, dicho:** `charges.csv` y `jobs.csv` van dentro de `datos.zip`, así que el
profesional ya se los lleva en el paquete; el CSV suelto es para soporte. `fees.csv` no es suyo.

## Lo que NO cubre — declarado

* **El censo solo mira `public/dashboard/js`** y las dos formas de enlace que existen hoy
  (`<a href>` y `makeExportBtn`). Una tercera forma bajaría el número de pares y **el suelo la
  cantaría**, pero hasta que alguien la añada no está cubierta.
* **El vocabulario es de cinco tipos.** Un rótulo nuevo que nombre otro dato (p. ej. «albaranes»)
  no se juzga hasta que se añada a la tabla.
* **No se comprueba el CONTENIDO del fichero**, solo su nombre: si mañana `charges.csv` empezara a
  llevar facturas, este censo no lo vería. Eso es SCRUM-343, que ya unificó los builders.
* **No se decide si la tarjeta necesita un enlace a facturas**: es producto y va con su microcopy.
