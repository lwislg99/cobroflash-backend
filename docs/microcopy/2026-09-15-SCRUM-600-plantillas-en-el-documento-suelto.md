# SCRUM-600 · las dos hojas de plantillas, en el documento suelto

**Aprobado por el orquestador por delegación del fundador** el 15-sep-2026 — SCRUM-600 comentario 15357.

La delegación es la permanente de `docs/equipo/limites-del-fundador.md`, sección «Delegación
permanente», línea de microcopy. Esta ficha **no** lleva la firma del fundador y no puede llevarla:
no la ha firmado él.

## Texto aprobado, literal

> Elige una plantilla para cargar sus líneas en este documento.

> Dale un nombre a esta plantilla para reutilizar sus líneas más adelante.

Las dos con **punto final**, que es parte del literal.

## Dónde se pintan

`public/dashboard/js/quotesView.js`, en la página del **documento suelto** (la que monta
`renderDocumentoSueltoView`):

* la primera, en la hoja que abre **«📋 Usar plantilla»** («📋 Ver las N» con más de tres);
* la segunda, en la hoja que abre **«💾 Guardar como plantilla»**.

Salen de **una sola fuente**, `public/dashboard/js/rotulosDelDocumento.js`, en
`hojaUsarPlantilla()` y `hojaGuardarPlantilla()`. **El presupuesto no cambia**: sus dos hojas
siguen con la frase de siempre.

## Por qué estos textos

* **Neutros a propósito.** «este documento» y «sus líneas» sirven igual para una factura que para
  un justificante. Por eso **no hay variante justificante**, y no se escribe: SCRUM-825 retira el
  justificante (decisión tomada en SCRUM-600).
* **La segunda dice lo que de verdad se guarda: las líneas.** Una plantilla sirve igual para
  presupuestos que para facturas. Atar la frase a un tipo de documento prometería una restricción
  que no existe.

## Qué cambió

Hasta ahora, en el documento suelto **no se pintaba ninguno de los dos botones**. Sus hojas
nombraban el presupuesto y no había texto firmado para otro documento (regla 30). En el presupuesto
siguen diciendo *Elige una plantilla para cargar sus líneas en el presupuesto actual.* y *Dale un
nombre a esta plantilla para reutilizarla en futuros presupuestos.*

Con estas dos frases firmadas, los botones aparecen también en el documento suelto. Lo vigila
`tests/scrum600g-plantillas-en-el-documento-suelto.test.mjs`, que monta la pantalla y pulsa los botones.

## Lo que queda sin firmar en esta pantalla

Nada de las plantillas: el resto de sus textos ya era neutro («Empieza con una plantilla», «Guardar
plantilla», «Escribe un nombre para la plantilla.») y se reutiliza tal cual.
