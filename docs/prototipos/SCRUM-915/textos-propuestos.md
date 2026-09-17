# SCRUM-915 · Textos NUEVOS del prototipo v2, propuestos y SIN firmar

En `editor-presupuesto.html` salen subrayados (interruptor «Resaltar textos nuevos»). Todo lo que NO está aquí
ya existe hoy en el producto y se reutiliza literal. Pendientes de firma (regla 30). `N`, `M` y `«…»` se rellenan.

## Los pasos (título · frase guía)
| Presupuesto | Justificante |
|---|---|
| «Cliente» · «¿Para quién es el presupuesto?» | «Cliente» · «¿Para quién es el justificante?» |
| «Conceptos» · «Añade lo que vas a hacer, con su cantidad y su precio.» | «Conceptos» · «Añade lo que has hecho, con su cantidad y su precio.» |
| «Condiciones» · «Ya van puestas las de siempre. Cámbialas sólo si este cliente es distinto.» | — |
| «Revisar y enviar» · «Mira el documento a la derecha y, si está bien, genéralo.» | «Revisar y emitir» · «Mira el documento a la derecha y, si está bien, emítelo.» |

- Paso cerrado: «Cambiar» · resumen «N conceptos · total» y «… · válido hasta dd/mm/aaaa»
- «Continuar» · «Atrás» · «Paso N de M» (móvil) · «Ver documento» (móvil) · «Volver al editor»
- Bajo «Continuar» desactivado: «Elige un cliente para seguir» / «Falta al menos una línea con concepto, cantidad y precio» (el de los tramos ya existe)
- Condiciones: «Cambiar» / «Listo» en cada fila

## El documento de la derecha
- «Así lo verá el cliente» · «Se actualiza mientras escribes»
- «Nº al generar» · «Aquí aparecerán los conceptos que añadas.» · «Presupuesto válido hasta el dd/mm/aaaa.» (sustituye al fijo «…válido durante 30 días…»)

## Líneas
- «Propuesto por la IA: precio / cantidad / cantidad y precio. Revísalo antes de enviar.» + «Revisado»
- «Este cliente tiene pactado un descuento del N %» + «Aplicar a las líneas» — sustituyen DOS marcadores
- «Aplicar» (formas de pago pactadas) — sustituye un marcador
- Modal de IA: «Descríbelo con tus propias palabras y te proponemos las líneas usando tu catálogo de productos.» (el de hoy nombra a «Claude», que no es el proveedor que se usa)

## Cabecera, menús y hojas
- «Opciones» / «Opciones del documento» · «Lo que casi nunca cambia. Tócalo sólo si este documento es distinto.»
- «Más acciones» (menú ⋯ de arriba) · «Línea N» · «Ajustes (IVA, descuento, descripción…)»
- «Descripción» (sustituye «[PENDIENTE microcopy oficial] descripción») · «Sale bajo el concepto si en Opciones marcas «Incluir descripción en el PDF».»
- «Con su descripción, descuento y suplido.» ⚠️ exige cambio de servidor: decide el fundador
- «El mismo formulario de Clientes, sin salir del documento.»
- «¿Vaciar este documento?» · «Se quitan el cliente, las líneas y los cambios de este documento. Tus plantillas y tus opciones de siempre no se tocan.» · «No, seguir»
- «Este presupuesto ya está generado» · «Generarlo otra vez crearía un segundo presupuesto. ¿Quieres ver el que ya tienes?» · «Ver el presupuesto #N» · «generado»

## Los cuatro marcadores visibles de hoy
| Hoy | Propuesto |
|---|---|
| «[PENDIENTE microcopy oficial] descripción» | «Descripción» |
| botón de formas de pago pactadas | «Aplicar» |
| «[PENDIENTE microcopy oficial] · N %» | «Este cliente tiene pactado un descuento del N %» |
| botón del descuento pactado | «Aplicar a las líneas» |
