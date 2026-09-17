# PR · SCRUM-600 (DOC-10) · La factura suelta usa el front del presupuesto

> Compare: https://github.com/lwislg99/cobroflash-backend/compare/main...scrum-600b-la-factura-usa-el-front

## La víctima

Hacer una factura suelta metía al profesional en un **modal de 560 px con 12 controles** —cliente,
concepto, cantidad, precio, IVA— **sin vista previa**. El presupuesto, el mismo día y el mismo
profesional, tenía una **página** con vista previa en vivo al lado del formulario.

Ahora la factura suelta **es esa página**. Firma del fundador del 24-ago-2026.

| | modal (antes) | página · documento suelto |
|---|---|---|
| forma | modal 560 px | página, dos tarjetas |
| ruta propia | no: sólo un botón, sin poder enlazar ni recargar | `invoices-new`, en `HASH_VIEWS` |
| controles pintados | **12** | **22** |
| vista previa en vivo | ❌ | ✅ |

## 🔴 Compartir front NO es compartir emisión

**El camino de emisión no se toca** (reglas 29/38): el número de serie, el sellado y lo que se
guarda siguen siendo del servidor. Sólo hay **alta**; nada edita, borra ni renumera un documento
emitido, y la vista **no tiene por dónde recibir el id** de una factura.

Y de ahí sale la regla que decide la pantalla:

> **Un control aparece en modo documento suelto si y sólo si su dato SOBREVIVE al emisor.**

`validarFacturaSuelta` admite `customerId` + líneas `{concept, qty, price, tax}` y **descarta el
resto en silencio** (medido en SCRUM-616). Por eso no se pintan condiciones, envío, dirección de
la obra, IVA por documento, descuentos, coste ni suplido: **pedir datos que el servidor tira sin
avisar es peor que el modal estrecho**.

## Microcopy: ni un literal nuevo

* El **nombre del documento** sale de `rotulosDelDocumento` (SCRUM-776). Con
  `INVOICING_ES_ENABLED` en su valor por defecto la pantalla dice **justificante**.
* **«Total»** para el documento suelto lo **firma el asesor** (7-sep-2026) **derivando**: es el
  rótulo con el que `invoiceDetailView.js` ya destaca el total de una factura. No entra palabra
  nueva. **Sujeto a tu revisión** — si vetas «Total» a secas, es un cambio de una línea.
* Lo que necesitaba texto nuevo **se omite y se declara**: plantillas, coletilla legal del pie,
  subtítulo, pista del bloque de líneas y el tooltip de la IA. Detalle en la entrada del máster.

## Verificación

**🔴 El control que decide** — misma entrada en las dos pantallas, montadas de verdad:

```
PÁGINA → POST /admin/invoices {"customerId":7,"lines":[{"concept":"Mano de obra","qty":2,"price":50,"tax":0.21}]}
MODAL  → POST /admin/invoices {"customerId":7,"lines":[{"concept":"Mano de obra","qty":2,"price":50,"tax":0.21}]}
```

Iguales **byte a byte**, y lo guardado da total **121.00**. Y no por casualidad: el cuerpo lo
compone **una sola pieza** que llaman las dos pantallas.

**🔴 Con el flag por defecto la página no dice «factura» en ningún sitio.** Control positivo: la
misma página en modo factura lo dice en **exactamente dos** sitios, y son los dos rótulos
aprobados.

**✅ El presupuesto no pierde nada:** sus cuatro bloques, el panel de estado, «Total presupuesto»,
la coletilla, plantillas, borrador y la vista previa siguen ahí, byte a byte.

**Los tres rojos probados** (romper a propósito y ver caer el test que toca) están en la entrada
del máster, con el árbol restaurado por `Buffer.compare` = 0.

## Hallazgos que sólo se ven montando la pantalla

Cinco rótulos del presupuesto seguían apareciendo en la pantalla del justificante, y **ninguno
vivía en una ranura que el censo marcara**. El peor: la **vista previa imprimía «Pago 100% al
aceptar el presupuesto.»**, una condición que nadie había elegido, en el papel del cliente.

Y dos del instrumento, **anteriores a esta rama**: el extractor de ranuras no bajaba a los
ternarios (la lista decía 27 posiciones y son **29**), y un envoltorio mío escondió dos rótulos
firmados del censo de SCRUM-601 (16 → 14) — corregido cambiando **la forma**, no el guard.

## Lo que queda esperándote

1. **El vencimiento** (DOC-15) y el **suplido** en la factura: bloqueo de **emisión**, no de texto.
   Ampliar lo que la factura guarda es STOP y puede tocar `prisma/schema.prisma`.
2. **Dos frases** para encender las plantillas en el documento suelto.
3. **Decidir si en el pie del documento suelto va algo**, antes de redactar nada (reglas 7/17).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
