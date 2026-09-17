# SCRUM-915 · Textos NUEVOS del prototipo v3, propuestos y SIN firmar

En `editor-presupuesto.html` salen subrayados (interruptor «Resaltar textos nuevos»). Todo lo que NO está aquí
ya existe hoy en el producto y se reutiliza literal. Pendientes de firma (regla 30). `N`, `M` y `«…»` se rellenan.

## Los pasos (título · frase guía)
| Presupuesto | Justificante |
|---|---|
| «Cliente» · «¿Para quién es el presupuesto?» | «Cliente» · «¿Para quién es el justificante?» |
| «Conceptos» · «Añade lo que vas a hacer, con su cantidad y su precio.» | «Conceptos» · «Añade lo que has hecho, con su cantidad y su precio.» |
| «Condiciones» · «Ya van puestas las de siempre. Cámbialas sólo si este cliente es distinto.» | — |
| «Revisar y enviar» · «Revisa el documento y, si está bien, envíaselo al cliente por WhatsApp.» | «Revisar y emitir» · «Revisa el documento y, si está bien, emítelo.» |

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

## v3 · Ajustes del documento (fila en Condiciones; en el justificante, en Revisar)
- «Ajustes del documento» · resumen «IVA sumado» / «IVA no incluido» (ya existe) · «sin dirección de obra» / «con dirección de obra» · en el justificante «IVA por defecto N %»

## v3 · Enviar
- Botón principal «Enviar por WhatsApp» (ya existe) · secundarias «⬇ Descargar PDF» y «✉ Enviar por email» (ya existen) y «Solo guardar» (NUEVO)
- Confirmación en la misma pantalla: «✓ Enviado por WhatsApp a <cliente> · pendiente de firma» · «✓ Enviado por email a <email>» · «Presupuesto #N guardado · sin enviar»

## Cabecera, menús y hojas
- «Más acciones» (menú ⋯ de arriba) · «Línea N» · «Ajustes (IVA, descuento, descripción…)»
- «Descripción» (sustituye «[PENDIENTE microcopy oficial] descripción») · «Sale bajo el concepto si en Opciones marcas «Incluir descripción en el PDF».»
- «Con su descripción, descuento y suplido.» ⚠️ exige cambio de servidor: decide el fundador
- «El mismo formulario de Clientes, sin salir del documento.»
- «¿Vaciar este documento?» · «Se quitan el cliente, las líneas y los cambios de este documento. Tus plantillas y tus opciones de siempre no se tocan.» · «No, seguir»

## Los cuatro marcadores visibles de hoy
| Hoy | Propuesto |
|---|---|
| «[PENDIENTE microcopy oficial] descripción» | «Descripción» |
| botón de formas de pago pactadas | «Aplicar» |
| «[PENDIENTE microcopy oficial] · N %» | «Este cliente tiene pactado un descuento del N %» |
| botón del descuento pactado | «Aplicar a las líneas» |
