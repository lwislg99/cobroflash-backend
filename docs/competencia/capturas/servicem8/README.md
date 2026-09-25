# Capturas de ServiceM8 · qué es cada una y qué prueba

**Tomadas el 20-sep-2026** sobre `origin/main` = `c5d642fe889af753ef6d6de27aabc84bdc3fc79b`, de sus
**páginas públicas y su documentación de soporte**, leídas y fotografiadas en el navegador. **Sin
alta, sin dar ningún dato y sin entrar en el producto.**

| fichero | qué enseña | qué propuesta sostiene |
|---|---|---|
| `ficha-de-activo-y-tipos.png` | *«Create & track assets»*: el activo cuelga del cliente y de su sitio, con `Asset Types` que definen sus campos (marca, modelo, nº de serie…) | **La ficha del equipo** (matriz §13.3.1) |
| `qr-escanear-y-portal-del-equipo.png` | *«Scan to service»* y **«Customer asset portal»**: la etiqueta QR única por activo, y el cliente escaneándola **con su propio móvil** para abrir una página suya | **La pegatina con QR** (matriz §13.3.2) |
| `alta-del-equipo-en-la-obra.png` | Su documentación, literal: *«Assets can only be created in the ServiceM8 mobile app»*, *«First, apply an Asset Label to the physical item you want to track»*, y encima el criterio para decidir cuántos `Asset Types` crear | **La pegatina con QR** y, de fondo, **la ficha del equipo** |

## Lo que estas capturas NO son

🔴 **Son su marketing y su manual, no su producto funcionando.** Nadie ha entrado en ServiceM8: no
hay cuenta y no se pidió, porque un alta en un tercero la autoriza el fundador (A19). **Nadie ha
visto un activo real**, ni la app móvil, que es justo donde viven —su propia documentación dice que
los activos *solo* se pueden crear allí—. Sirven para saber **qué forma le han dado a la ficha del
equipo**, que es para lo que se usan aquí, y no para afirmar cómo se comporta.

**Tampoco está comprobado si su gestión de activos se paga aparte.** Su documentación la coloca bajo
«Add-ons», lo que lo sugiere; no se ha medido y por eso no se dice.

El texto literal de cada página se leyó aparte, a `textContent` (nunca con `WebFetch`, por el motivo
que explica «Límites» en [`../../matriz.md`](../../matriz.md)): las citas del §13 vienen de ahí y no
de leer la imagen.

## Segunda tanda: con cuenta real (25-sep-2026, SCRUM-906m)

Las 19 capturas `servicem8-01-*` a `servicem8-19-*` son de **esta** tanda: alta real
(`lwislg99+servicem8@gmail.com`), panel completo, un Job de principio a fin (presupuesto → factura).
Sin tarjeta ni teléfono real (el paso opcional se saltó con "Skip"). El detalle línea a línea, en
[`docs/producto/_RAW-flujo-crear-factura.md`](../../producto/_RAW-flujo-crear-factura.md), sección
`## SERVICEM8`. El registro del máster, en
[`docs/master/SCRUM-906.md`](../../master/SCRUM-906.md), sección `SCRUM-906m`.

Esto **sí** es su producto funcionando, a diferencia de las tres capturas de arriba (solo su
marketing y manual, sin cuenta).
