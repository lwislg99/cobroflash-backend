# Libro de registro con criterio de caja: la señal «cobro sin fecha declarada» · SCRUM-1055

**Aprobado por el fundador** el 26-nov-2026, en **SCRUM-1055** (comentario 22857).

El orquestador J le leyó las cuatro preguntas de SCRUM-1055 c.21863 y publicó su respuesta («2-Ok tus
recomendaciones») en c.22857, punto ③: los tres textos de c.21863 ⑤, literales. La corrección de
c.22874 cambia de dónde sale la señal (`invoice_payments.fecha_origen = 'marcado'`, sin columna nueva),
no los textos. **Aplicado en el mismo acto** (regla 30), en el tramo SCRUM-1055e.

## Textos aprobados, literales

Texto 1, la etiqueta del asiento, junto a la marca «Cobro»:

> Fecha de cobro sin indicar

Texto 2, la explicación al pasar por la etiqueta:

> Esta factura se marcó como cobrada sin indicar el día en que entró el dinero. Se ha tomado el día en que se marcó. Si entró otro día, corrígelo antes de pasarle el trimestre a tu asesor.

Texto 3, la línea del resumen del periodo, en plural y en singular:

> {n} facturas cobradas sin fecha de cobro indicada.

> 1 factura cobrada sin fecha de cobro indicada.

## Dónde se pinta

`public/dashboard/js/libroRegistroView.js`, ranuras de `COPY`: `etiquetaSinFechaCobro` (pastilla
`badge-amber` en la columna «De dónde viene y dónde acabó»), `explicacionSinFechaCobro` (su `title`),
`resumenSinFechaCobroUna` y `resumenSinFechaCobroVarias` (aviso de resumen; el plural se compone como
`{n}` + espacio + la cola). Se pintan cuando el servidor (SCRUM-1055c) manda `cobroSinFechaDeclarada`
en el asiento y `cobrosSinFechaDeclarada` > 0 en el libro.

## Queda sin firmar

Qué decir de las facturas cobradas sin filas de cobro (`cobrosSinFilas`): lo decide el fundador, y no
se pinta.
