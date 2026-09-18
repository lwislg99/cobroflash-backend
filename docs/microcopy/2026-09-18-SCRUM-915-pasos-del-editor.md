# Los pasos del editor de presupuesto (y del documento suelto) — SCRUM-915d

**Aprobado por el orquestador por delegación del fundador** el 18-sep-2026 — SCRUM-915 comentario 15868.

Firmados todos los textos de `docs/prototipos/SCRUM-915/textos-propuestos.md` menos UNO (abajo). Esta ficha
registra los que entran en código con el primer corte, **915d · los pasos**, y se crea **en el mismo acto**
en que se aplican (regla 30). Los demás textos firmados (documento vivo, hoja de envío, menús) se
registran en la ficha del corte que los aplique.

## Texto aprobado, literal

Títulos de los pasos (el número lo pinta la hoja de estilos, no forma parte del texto):

> Cliente

> Conceptos

> Condiciones

> Revisar y enviar

> Revisar y emitir

Frases guía:

> ¿Para quién es el presupuesto?

> ¿Para quién es el justificante?

> Añade lo que vas a hacer, con su cantidad y su precio.

> Añade lo que has hecho, con su cantidad y su precio.

> Ya van puestas las de siempre. Cámbialas sólo si este cliente es distinto.

> Revisa el documento y, si está bien, envíaselo al cliente por WhatsApp.

> Revisa el documento y, si está bien, emítelo.

Botones y avisos de los pasos:

> Continuar

> Atrás

> Cambiar

> Listo

> Elige un cliente para seguir

> Falta al menos una línea con concepto, cantidad y precio

La fila de ajustes del paso Condiciones y su resumen («IVA no incluido» ya existía):

> Ajustes del documento

> IVA sumado

> sin dirección de obra

> con dirección de obra

## Formato aprobado, literal

Resumen de un paso cerrado:

> N conceptos · total

> … · válido hasta dd/mm/aaaa

Tal como se pinta: «2 conceptos · 419,87 €» (con uno solo, «1 concepto · 38,00 €») y «Pago 100% al
aceptar · válido hasta 18/10/2026». `N`, el total, la condición de pago y la fecha son DATOS: el total es
la cifra del KPI, la condición es el rótulo que ya tiene su opción, la fecha es la que eligió el
profesional.

## Texto aprobado: sus partes fijas, tal cual están en el código

> concepto

> conceptos

> válido hasta

## Dónde se pinta

`public/dashboard/js/quotesView.js` — el esqueleto de los pasos (junto a `blockClient`) y su control
(`refrescarPasos`, antes de `loadInitialData`). En el documento suelto, «¿Para quién es el justificante?»
sólo sale en modo JUSTIFICANTE: en modo FACTURA no hay texto firmado y la guía del paso Cliente se omite.

## Lo que NO se firmó, y queda como hoy

«Con su descripción, descuento y suplido.» — la nota al guardar una plantilla. Dice de más (SCRUM-930
decidió descripción y descuento SÍ, suplido NO) y promete lo que hoy no ocurre. 915d no toca la hoja de
guardar plantilla: se queda con su texto de hoy.

## Qué cambió

Los títulos de bloque «1. Cliente», «2. Líneas», «3. Condiciones» y «4. Envío» (aprobados el 17-ago-2026)
dejan de pintarse: los bloques son ahora pasos con los títulos de arriba, y «4. Envío» pasa a ser la fila
«Ajustes del documento». La firma anterior no se desaprueba; queda sin sitio donde pintarse (lo declara
`tests/scrum514-aprobado-y-aplicado.test.mjs`).
